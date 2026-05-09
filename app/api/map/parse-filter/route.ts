import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { UTAH_COUNTIES_SET } from "@/lib/map/filterConstants";

const SYSTEM_PROMPT = `You extract filter criteria from a user's spoken request about Utah startups.
Return ONLY a JSON object: { "stage": string[], "size": string[], "section": string[], "county": string[], "hiring": boolean }.
Valid stage values: "Pre-Seed", "Seed", "Series A", "Series B+", "Series D+".
Valid size values: "1", "2-10", "11-50", "51-200", "201-500", "200+".
Valid section values: "B2B Software", "FinTech", "Security", "Bio/Medical Tech", "Energy", "Consumer", "Marketplaces".
Valid county values (Utah counties only, exact spelling, no "County" suffix): "Beaver", "Box Elder", "Cache", "Carbon", "Daggett", "Davis", "Duchesne", "Emery", "Garfield", "Grand", "Iron", "Juab", "Kane", "Millard", "Morgan", "Piute", "Rich", "Salt Lake", "San Juan", "Sanpete", "Sevier", "Summit", "Tooele", "Uintah", "Utah", "Wasatch", "Washington", "Wayne", "Weber".
hiring: true ONLY if the user explicitly mentions hiring/recruiting/jobs.
Empty array = no filter on that dimension. Return nothing except the JSON object.`;

const EMPTY_RESPONSE = {
  stage: [] as string[],
  size: [] as string[],
  section: [] as string[],
  county: [] as string[],
  hiring: false,
};

export async function POST(req: Request) {
  const { transcript } = (await req.json()) as { transcript?: string };

  if (!transcript?.trim()) {
    return NextResponse.json(EMPTY_RESPONSE);
  }

  // Truncate to 500 chars to bound prompt-stuffing risk on user voice input.
  const safeTranscript = transcript.trim().slice(0, 500);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: safeTranscript }],
  });

  const text =
    msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "{}";

  try {
    const parsed = JSON.parse(text) as {
      stage?: unknown;
      size?: unknown;
      section?: unknown;
      county?: unknown;
      hiring?: unknown;
    };

    // Defensive normalization: trim any " County" suffix Claude might attach
    // before whitelist-checking against UTAH_COUNTIES_SET.
    const rawCounty = Array.isArray(parsed.county) ? parsed.county : [];
    const normalizedCounty = rawCounty
      .map((c) =>
        typeof c === "string" ? c.trim().replace(/\s+County$/i, "") : ""
      )
      .filter((c) => UTAH_COUNTIES_SET.has(c));

    return NextResponse.json({
      stage: Array.isArray(parsed.stage)
        ? (parsed.stage.filter((v) => typeof v === "string") as string[])
        : [],
      size: Array.isArray(parsed.size)
        ? (parsed.size.filter((v) => typeof v === "string") as string[])
        : [],
      section: Array.isArray(parsed.section)
        ? (parsed.section.filter((v) => typeof v === "string") as string[])
        : [],
      county: normalizedCounty,
      hiring: typeof parsed.hiring === "boolean" ? parsed.hiring : false,
    });
  } catch {
    return NextResponse.json(EMPTY_RESPONSE);
  }
}
