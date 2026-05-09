import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { INTAKE_QUESTIONS, getAllowedValuesForColumn } from "@/lib/intake/filterConstants";
import type { FounderInfo } from "@/lib/matching/draftEmails";

// Q0 tool: extract founder name + business name + role from the spoken intro.
function buildFounderInfoTool() {
  return {
    name: "extract_founder_info" as const,
    description: "Extract the founder's name, business name, and role from their spoken introduction.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string" as const,
          description: "The founder's name (first name, full name, or however they introduced themselves).",
        },
        businessName: {
          type: "string" as const,
          description: "The name of their business, startup, or venture.",
        },
        role: {
          type: "string" as const,
          description: "Their title or role, if mentioned (e.g., 'founder', 'CEO', 'co-founder'). Empty string if not mentioned.",
        },
        extractedAnswer: {
          type: "string" as const,
          description: "A clean one-sentence summary: '<name>, <role> of <businessName>'.",
        },
        isAnswered: {
          type: "boolean" as const,
          description: "True if the user provided at least a name.",
        },
      },
      required: ["name", "businessName", "role", "extractedAnswer", "isAnswered"],
    },
  };
}

// Build a Claude tool with an enum-constrained schema for a specific column.
// The `enum` array in the JSON schema is enforced by the Anthropic API — Claude
// cannot emit any value not in this list, no matter what the transcript says.
function buildMappingTool(column: string, allowedValues: string[]) {
  return {
    name: "map_to_enum" as const,
    description: `Map what the user said to the closest values from the allowed list for "${column}". Only select values that genuinely match — return an empty array if nothing applies.`,
    input_schema: {
      type: "object" as const,
      properties: {
        mappedValues: {
          type: "array" as const,
          items: {
            type: "string" as const,
            enum: allowedValues,
          },
          description: "Zero or more values from the allowed list that best describe the user's answer.",
        },
        extractedAnswer: {
          type: "string" as const,
          description: "A clean, human-readable summary of what the user actually said (1 sentence).",
        },
        isAnswered: {
          type: "boolean" as const,
          description: "True if the user gave a substantive answer relevant to the question.",
        },
      },
      required: ["mappedValues", "extractedAnswer", "isAnswered"],
    },
  };
}

export async function POST(req: Request) {
  const { sessionId, questionIndex, rawTranscript, currentIds } = await req.json() as {
    sessionId: string | null;
    questionIndex: number;
    rawTranscript: string;
    currentIds: string[];
  };

  if (questionIndex === undefined || questionIndex === null || !rawTranscript) {
    console.error("[process-answer] 400 — missing fields:", { hasSession: !!sessionId, questionIndex, transcriptLen: rawTranscript?.length ?? 0 });
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (questionIndex < 0 || questionIndex > 5) {
    return NextResponse.json({ error: "Invalid questionIndex" }, { status: 400 });
  }

  const question = INTAKE_QUESTIONS[questionIndex];

  // Q0: preliminary founder info — extract name/business via tool, no SQL filter.
  // Distinct from Q5 (also column: null) because Q0 needs structured Claude extraction.
  if (questionIndex === 0) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const tool = buildFounderInfoTool();

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      tools: [tool],
      tool_choice: { type: "tool", name: "extract_founder_info" },
      messages: [
        {
          role: "user",
          content: `The user was asked: "${question.text}"\n\nThey said: "${rawTranscript}"\n\nExtract their name, business name, and role.`,
        },
      ],
    });

    const toolUse = msg.content.find(c => c.type === "tool_use");
    const toolInput = toolUse?.type === "tool_use"
      ? (toolUse.input as { name: string; businessName: string; role: string; extractedAnswer: string; isAnswered: boolean })
      : null;

    const founderInfo: FounderInfo = toolInput
      ? { name: toolInput.name, businessName: toolInput.businessName, role: toolInput.role }
      : { name: "", businessName: "", role: "" };
    const extractedAnswer = toolInput?.extractedAnswer ?? rawTranscript.trim();
    const isAnswered = toolInput?.isAnswered ?? rawTranscript.trim().length > 3;

    if (sessionId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabase.from("intake_answers").upsert(
        {
          session_id: sessionId,
          question_index: 0,
          question_text: question.text,
          raw_transcript: rawTranscript,
          extracted_answer: extractedAnswer,
          structured_data: { founderInfo, column: null },
          is_answered: isAnswered,
          answered_at: new Date().toISOString(),
        },
        { onConflict: "session_id,question_index" }
      );
    }

    return NextResponse.json({
      extractedAnswer,
      founderInfo,
      mappedValues: [],
      remainingIds: currentIds,
      isAnswered,
    });
  }

  // Q5 is free-form — no enum mapping, return currentIds unchanged
  if (question.column === null) {
    if (sessionId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabase.from("intake_answers").upsert(
        {
          session_id: sessionId,
          question_index: questionIndex,
          question_text: question.text,
          raw_transcript: rawTranscript,
          extracted_answer: rawTranscript.trim(),
          structured_data: { mappedValues: [], column: null },
          is_answered: rawTranscript.trim().length > 10,
          answered_at: new Date().toISOString(),
        },
        { onConflict: "session_id,question_index" }
      );
    }
    return NextResponse.json({
      extractedAnswer: rawTranscript.trim(),
      mappedValues: [],
      remainingIds: currentIds,
      isAnswered: rawTranscript.trim().length > 10,
    });
  }

  const allowedValues = getAllowedValuesForColumn(question.column);
  const tool = buildMappingTool(question.column, allowedValues);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    tools: [tool],
    tool_choice: { type: "tool", name: "map_to_enum" },
    messages: [
      {
        role: "user",
        content: `The user was asked: "${question.text}"\n\nThey said: "${rawTranscript}"\n\nMap their answer to the closest values from the allowed list. If they mentioned a city name, map it to the Utah county it belongs to.`,
      },
    ],
  });

  const toolUse = msg.content.find(c => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({
      extractedAnswer: rawTranscript.trim(),
      mappedValues: [],
      remainingIds: currentIds,
      isAnswered: false,
    });
  }

  const { mappedValues, extractedAnswer, isAnswered } = toolUse.input as {
    mappedValues: string[];
    extractedAnswer: string;
    isAnswered: boolean;
  };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // SQL array-overlap filter — only apply if Claude found matching values AND
  // the resulting pool has at least 5 resources (preserve previous pool otherwise).
  // NOTE: Do NOT use .in("id", currentIds) — 213 UUIDs × 37 chars = ~7,900 chars in the URL,
  // which hits PostgREST/nginx's ~8KB limit and causes silent failures. Instead, query all
  // matching resources from the full table, then intersect with currentIds in JavaScript.
  let remainingIds = currentIds;
  let filterSkipped = false;

  if (mappedValues.length > 0 && currentIds.length > 0) {
    const { data: allMatching, error } = await supabase
      .from("resources")
      .select("id")
      .overlaps(question.column, mappedValues);

    if (error) {
      console.error(`[process-answer] filter query failed for ${question.column}:`, error.message);
      filterSkipped = true;
    } else {
      const matchingSet = new Set((allMatching ?? []).map((r: { id: string }) => r.id));
      const filteredIds = currentIds.filter(id => matchingSet.has(id));

      if (filteredIds.length >= 5) {
        remainingIds = filteredIds;
      } else {
        filterSkipped = true;
        console.warn(`[process-answer] filter for ${question.column}=${JSON.stringify(mappedValues)} would leave ${filteredIds.length} resources — skipping`);
      }
    }
  }

  if (sessionId) {
    await supabase.from("intake_answers").upsert(
      {
        session_id: sessionId,
        question_index: questionIndex,
        question_text: question.text,
        raw_transcript: rawTranscript,
        extracted_answer: extractedAnswer,
        structured_data: { mappedValues, column: question.column },
        is_answered: isAnswered,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "session_id,question_index" }
    );
  }

  return NextResponse.json({ extractedAnswer, mappedValues, remainingIds, isAnswered, filterSkipped });
}
