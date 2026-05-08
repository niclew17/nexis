import Anthropic from "@anthropic-ai/sdk";
import type { UserProfile } from "./structuredFilter";
import type { ResourceResult } from "./vectorSearch";

export interface SynthesisResult {
  narrative: string;
  results: Array<{
    id: string;
    title: string;
    matchReason: string;
    topics: string[];
    link: string;
  }>;
}

function parseJsonSafely(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function synthesize(
  profile: UserProfile,
  candidates: ResourceResult[]
): Promise<SynthesisResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const candidateList = candidates
    .map((r, i) => `${i + 1}. ${r.title}\nDescription: ${r.description}`)
    .join("\n\n");

  const prompt = `You are a helpful assistant matching Utah founders to state resources.

Founder profile:
- Communities: ${profile.communities.join(", ") || "none specified"}
- Location (counties): ${profile.counties.join(", ") || "none specified"}
- Business: ${profile.description}
- Stage: ${profile.stage}
- Primary need: ${profile.primaryNeed}
- Topics of interest: ${profile.topics.join(", ") || "none specified"}

Here are ${candidates.length} candidate resources:
${candidateList}

Return valid JSON only, no markdown:
{
  "narrative": "<one sentence starting with 'Based on what you shared' describing the founder's situation>",
  "results": [
    {
      "id": "<resource id from the list — use the exact id field>",
      "title": "<resource title>",
      "matchReason": "<one sentence starting with 'This matches you because' — be specific: reference their county, community, stage, and stated need>",
      "topics": ["<topic>"],
      "link": "<resource link>"
    }
  ]
}

Rules:
- Return exactly 5 results (or fewer if fewer than 5 candidates are relevant)
- Rank by relevance to this specific founder — geography and community identity first, then need
- The matchReason must reference the founder's specific details — never generic copy
- Only include resources whose location includes the founder's county OR statewide resources`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const parsed = parseJsonSafely(text) as unknown as SynthesisResult;

  // Merge link/topics from original candidates since Claude may not have them
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));
  const results = (parsed.results ?? []).map((r) => {
    const orig = candidateMap.get(r.id);
    return {
      ...r,
      topics: r.topics?.length ? r.topics : (orig?.topics ?? []),
      link: r.link || orig?.link || "",
    };
  });

  return { narrative: parsed.narrative, results };
}
