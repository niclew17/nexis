import Anthropic from "@anthropic-ai/sdk";
import type { RankedMatch } from "./rankResources";

export interface AnswerSummary {
  questionIndex: number;
  extractedAnswer: string;
}

export interface EmailedResult {
  id: string;
  title: string;
  matchReason: string;
  topics: string[];
  link: string;
  resourceEmail: string | null;
  draftEmail: string;
  emailSubject: string;
}

const QUESTION_LABELS = [
  "Type of help needed",
  "Industry",
  "Location in Utah",
  "Community identity",
];

function parseJsonSafely(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function draftEmails(
  matches: RankedMatch[],
  allAnswers: AnswerSummary[],
  freeFormAnswer: string
): Promise<EmailedResult[]> {
  if (matches.length === 0) return [];

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const answerContext = allAnswers
    .map(
      (a) =>
        `${QUESTION_LABELS[a.questionIndex] ?? `Q${a.questionIndex + 1}`}: ${a.extractedAnswer || "Not specified"}`
    )
    .join("\n");

  const resourceList = matches
    .map((m, i) => `${i + 1}. ${m.title} — ${m.matchReason}`)
    .join("\n");

  const emailEntries = matches
    .map(
      (m, i) =>
        `    {\n      "id": "${m.id}",\n      "emailSubject": "<subject for resource ${i + 1}>",\n      "draftEmail": "<email body for resource ${i + 1}>"\n    }`
    )
    .join(",\n");

  const prompt = `You are helping a Utah founder reach out to business resources they've been matched with.

Founder profile (from their voice intake):
${answerContext}
Additional details (their own words): "${freeFormAnswer}"

Write a draft outreach email for each of the following ${matches.length} resource${matches.length === 1 ? "" : "s"}. Each email should be professional, warm, and specific — referencing the founder's actual situation and why this resource is relevant to them.

Resources:
${resourceList}

Return valid JSON only, no markdown fences:
{
  "emails": [
${emailEntries}
  ]
}

Rules for each email:
- Open with who the founder is and what they are building
- Explain why this specific resource is relevant to their situation
- Include a clear call to action (request a meeting, ask about eligibility, etc.)
- Close professionally without a signature name — end with "Thank you," on its own line
- Do NOT use placeholder text like [Your Name] or [Resource Name] — use the actual resource title
- Keep each email under 250 words`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3072,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const parsed = parseJsonSafely(text);

  const emailMap = new Map(
    (
      (parsed.emails as Array<{ id: string; emailSubject: string; draftEmail: string }>) ?? []
    ).map((e) => [e.id, e])
  );

  return matches.map((m) => {
    const email = emailMap.get(m.id);
    return {
      ...m,
      draftEmail: email?.draftEmail ?? "",
      emailSubject: email?.emailSubject ?? `Inquiry about ${m.title}`,
    };
  });
}
