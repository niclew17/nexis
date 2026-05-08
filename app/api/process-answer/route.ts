import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseJsonSafely(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(req: Request) {
  const { sessionId, questionIndex, questionText, extractionHint, rawTranscript } =
    await req.json();

  if (!sessionId || questionIndex === undefined || !rawTranscript) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const prompt = `You are extracting structured data from a voice transcript for a Utah founder resource app.

Question asked: ${questionText}
Extraction hint: ${extractionHint}
Raw transcript: ${rawTranscript}

Return valid JSON only, no markdown, no explanation:
{
  "extractedAnswer": "<clean human-readable summary of what they said>",
  "structured": <object with fields described in extraction hint>,
  "isAnswered": <true if they gave a substantive answer, false if they said nothing relevant>
}`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const parsed = parseJsonSafely(text) as {
    extractedAnswer: string;
    structured: Record<string, unknown>;
    isAnswered: boolean;
  };

  const { extractedAnswer, structured, isAnswered } = parsed;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.from("intake_answers").upsert(
    {
      session_id: sessionId,
      question_index: questionIndex,
      question_text: questionText,
      raw_transcript: rawTranscript,
      extracted_answer: extractedAnswer,
      structured_data: structured,
      is_answered: isAnswered,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "session_id,question_index" }
  );

  return NextResponse.json({ extractedAnswer, structured, isAnswered });
}
