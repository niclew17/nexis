import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You extract filter criteria from a user's spoken request about Utah startups.
Return ONLY a JSON object: { "stage": string[], "size": string[], "section": string[] }.
Valid stage values: "Pre-Seed", "Seed", "Series A", "Series B+", "Series D+".
Valid size values: "1", "2-10", "11-50", "51-200", "201-500", "200+".
Valid section values: "B2B Software", "FinTech", "Security", "Bio/Medical Tech", "Energy", "Consumer", "Marketplaces".
Empty array = no filter on that dimension. Return nothing except the JSON object.`;

export async function POST(req: Request) {
  const { transcript } = (await req.json()) as { transcript?: string };

  if (!transcript?.trim()) {
    return NextResponse.json({ stage: [], size: [], section: [] });
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
      stage?: string[];
      size?: string[];
      section?: string[];
    };
    return NextResponse.json({
      stage: Array.isArray(parsed.stage) ? parsed.stage : [],
      size: Array.isArray(parsed.size) ? parsed.size : [],
      section: Array.isArray(parsed.section) ? parsed.section : [],
    });
  } catch {
    return NextResponse.json({ stage: [], size: [], section: [] });
  }
}
