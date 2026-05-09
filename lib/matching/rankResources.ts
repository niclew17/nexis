import Anthropic from "@anthropic-ai/sdk";

export interface RawResource {
  id: string;
  title: string;
  description: string | null;
  topics: string[];
  link: string | null;
  email: string | null;
}

export interface RankedMatch {
  id: string;
  title: string;
  matchReason: string;
  topics: string[];
  link: string;
  resourceEmail: string | null;
}

export interface RankResult {
  narrative: string;
  matches: RankedMatch[];
}

function parseJsonSafely(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function rankResources(
  candidates: RawResource[],
  freeFormAnswer: string
): Promise<RankResult> {
  if (candidates.length === 0) {
    return { narrative: "We couldn't find specific matches.", matches: [] };
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const candidateList = candidates
    .map(
      (r, i) =>
        `${i + 1}. [ID: ${r.id}]\nTitle: ${r.title}\nDescription: ${r.description ?? "No description"}\nTopics: ${r.topics.join(", ")}`
    )
    .join("\n\n");

  const prompt = `You are matching a Utah founder to state business resources.

The founder's specific need (their own words):
"${freeFormAnswer}"

Here are ${candidates.length} pre-filtered resources to evaluate:
${candidateList}

Return valid JSON only, no markdown fences:
{
  "narrative": "<one sentence starting with 'Based on what you shared' — summarize why these results fit this founder>",
  "matches": [
    {
      "id": "<exact id from the list above>",
      "title": "<exact title>",
      "matchReason": "<one sentence starting with 'This matches you because' — be specific to what the founder said they need>"
    }
  ]
}

Rules:
- Return exactly 3 matches ranked by relevance to the founder's stated need (or fewer if fewer than 3 candidates exist)
- matchReason must be specific — reference exact phrases or concepts from the founder's words above
- Do NOT include resources that are clearly irrelevant to what the founder described`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const parsed = parseJsonSafely(text);

  const candidateMap = new Map(candidates.map((c) => [c.id, c]));
  const matches: RankedMatch[] = (
    (parsed.matches as Array<{ id: string; title: string; matchReason: string }>) ?? []
  ).map((m) => {
    const orig = candidateMap.get(m.id);
    return {
      id: m.id,
      title: m.title,
      matchReason: m.matchReason,
      topics: orig?.topics ?? [],
      link: orig?.link ?? "",
      resourceEmail: orig?.email ?? null,
    };
  });

  return { narrative: parsed.narrative as string, matches };
}
