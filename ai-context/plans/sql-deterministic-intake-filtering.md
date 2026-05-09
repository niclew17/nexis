# Feature: SQL-Deterministic Intake Filtering (5-Question Voice Flow)

The following plan should be complete, but it is important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files. This project uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — NOT `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Feature Description

Replace the embedding-based bubble elimination on the main voice intake page with a 5-question flow where Q1–Q4 use Claude to map raw voice transcripts to known database enum values and then apply SQL array-overlap filters (`&&`) to progressively eliminate resource bubbles. Q5 is a free-form spoken answer that gets embedded and compared against the SQL-filtered resource pool; the top 5 by cosine similarity are surfaced with Claude-generated match reasons, shown inline in the left panel, and written to sessionStorage for the full `/results` page.

The `/discover` page and its supporting files are removed — the main voice page now does everything.

---

## User Story

As a Utah founder,  
I want to answer 5 short questions by speaking and watch resources narrow in real time,  
So that the final 5 matches are tightly filtered to my actual situation, not approximate embedding guesses.

---

## Problem Statement

The current elimination logic embeds cumulative answers and eliminates the bottom ~22% by cosine similarity each round. This is non-deterministic and opaque — a user asking about "funding" might get resources eliminated that are clearly about funding because their other words shift the embedding. Resources with empty `locations[]` or `communities[]` arrays (i.e., statewide / open-to-all) can be inadvertently penalized.

The current 4-question flow also conflates extraction with synthesis — Claude is doing two jobs (extracting clean answers AND matching semantics) and the SQL filter only uses `counties` and `communities`, ignoring `topics` and `industries` entirely.

---

## Solution Statement

**Q1–Q4 (SQL filtering)**: After each voice answer, Claude maps the transcript to exact known enum values from the resources table. A Supabase SQL query with `&&` (array overlap) then filters the active resource pool, returning the IDs that still match. Bubbles whose IDs were removed get eliminated. Filters accumulate — each question filters within the remaining pool. If any single filter would drop the pool below 5 resources, that filter is skipped (previous pool preserved).

**Q5 (embedding refinement)**: A free-form spoken answer is embedded with `text-embedding-3-small`, scored against the SQL-filtered pool using the existing `match_resources` RPC, and top 5 are returned. Claude generates a one-sentence personalized match reason for each. Results are rendered inline in the left panel and also stored in `sessionStorage` for the `/results` page.

---

## Feature Metadata

**Feature Type**: Enhancement  
**Estimated Complexity**: High  
**Primary Systems Affected**: `hooks/useVoiceIntake.ts`, `app/page.tsx`, `app/api/process-answer/route.ts`, `app/api/match-resources/route.ts`, `components/intake/VoiceIntake.tsx`, new `lib/intake/filterConstants.ts`  
**Dependencies**: No new packages — uses existing `@anthropic-ai/sdk`, `openai`, `@supabase/supabase-js`

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `hooks/useVoiceIntake.ts` (full file) — Hook to be significantly updated. Note `processAnswer`, `triggerProcessRef`, `confirmAnswer`, `skipQuestion`, `begin`, `startQuestion`, `submitTextAnswer`. The `matchResults` state and `MatchResults` type already exist. `UseVoiceIntakeReturn` interface is the public API.
- `app/page.tsx` (full file) — The main page. Uses `useVoiceIntake` + `useBubbleState` + `BubbleField`. The `useEffect` that watches `confirmedAnswers` and calls `/api/discovery/answer` must be replaced with one that watches `activeFilterIds` from the hook.
- `app/api/process-answer/route.ts` (full file) — Will be heavily updated: Claude mapping + SQL filter instead of free-form extraction.
- `app/api/match-resources/route.ts` (full file) — Will be updated: skip layer 1 (SQL filter already done), accept `filterIds` + `freeFormAnswer`.
- `lib/matching/structuredFilter.ts` (full file) — Will be DELETED; its logic is replaced by per-question SQL filters in `process-answer`.
- `lib/matching/vectorSearch.ts` (full file) — Keep as-is. The `match_resources` RPC is still used for Q5 embedding search.
- `lib/matching/synthesize.ts` (full file) — Keep as-is. Claude synthesis still generates match reasons for Q5.
- `components/intake/VoiceIntake.tsx` (full file) — Add inline results rendering when `state === "complete"` and `matchResults` is set.
- `components/results/ResourceCard.tsx` (full file) — Reuse directly for inline results in `VoiceIntake.tsx`.
- `supabase/migrations/20250501000000_create_resources.sql` (full file) — GIN indexes for `locations`, `communities`, `topics` already exist. Add one for `industries`.
- `supabase/migrations/20250501000002_create_match_resources_rpc.sql` (full file) — The `match_resources` RPC signature: `(query_embedding vector(1536), match_count int, candidate_ids uuid[])`. Used unchanged for Q5.
- `app/api/discovery/start/route.ts` — Keep this route. It returns `{id, title, topics}` for all resources. Used by `app/page.tsx` to init bubble state.
- `app/results/page.tsx` — Remove the `/discover` link.

### Files to Create

- `lib/intake/filterConstants.ts` — All known enum values per column (queried from DB), Claude mapping extraction hints per question, question text.
- `supabase/migrations/20250501000004_add_industries_index.sql` — GIN index on `industries` column.

### Files to Delete

- `app/discover/page.tsx`
- `app/api/discovery/answer/route.ts`
- `components/discovery/QuestionPanel.tsx`
- `components/discovery/FinalMatch.tsx`
- `hooks/useDiscoverySession.ts`
- `lib/matching/structuredFilter.ts`

### Files to Keep Unchanged

- `hooks/useBubbleState.ts`
- `hooks/useBubbleSimulation.ts`
- `components/discovery/BubbleField.tsx`
- `components/discovery/BubbleCounter.tsx`
- `components/discovery/ResourceBubble.tsx`
- `lib/matching/vectorSearch.ts`
- `lib/matching/synthesize.ts`
- `app/api/discovery/start/route.ts`

### Patterns to Follow

**Supabase service role client (API routes):**
```ts
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
// Always instantiate inside the handler body — never at module level
```

**Anthropic SDK call (API routes):**
```ts
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Note: the existing process-answer route instantiates at module level — move it inside the handler
```

**Array overlap SQL filter (Supabase JS):**
```ts
supabase.from("resources")
  .select("id")
  .in("id", currentIds)           // restrict to existing pool
  .overlaps("topics", mappedValues)  // && array overlap
```

**JSON-safe Claude parse (existing pattern in `process-answer/route.ts` line 7):**
```ts
function parseJsonSafely(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}
```

**Inline styles everywhere (no Tailwind on intake/results components):**
```tsx
style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", fontSize: "0.875rem" }}
```

---

## PRE-IMPLEMENTATION STEP: Discover Enum Values

**CRITICAL — Do this before writing any code.** Run the following SQL in the Supabase SQL editor to discover all distinct values in each array column:

```sql
-- Topics
SELECT DISTINCT unnest(topics) as val FROM resources ORDER BY val;

-- Industries
SELECT DISTINCT unnest(industries) as val FROM resources ORDER BY val;

-- Locations
SELECT DISTINCT unnest(locations) as val FROM resources ORDER BY val;

-- Communities
SELECT DISTINCT unnest(communities) as val FROM resources ORDER BY val;
```

You will use these results in Task 1 to build `filterConstants.ts`. The known values from existing code (use as fallback if query fails):

**Topics (confirmed):** `"Funding"`, `"Start a Business"`, `"Growing a Business"`, `"Marketing"`, `"Networking"`

**Communities (confirmed):** `"Veteran"`, `"Woman"`, `"Rural"`, `"Immigrant"`, `"LGBTQ+"`

**Locations (confirmed county names):** `"Beaver"`, `"Box Elder"`, `"Cache"`, `"Carbon"`, `"Daggett"`, `"Davis"`, `"Duchesne"`, `"Emery"`, `"Garfield"`, `"Grand"`, `"Iron"`, `"Juab"`, `"Kane"`, `"Millard"`, `"Morgan"`, `"Piute"`, `"Rich"`, `"Salt Lake"`, `"San Juan"`, `"Sanpete"`, `"Sevier"`, `"Summit"`, `"Tooele"`, `"Uintah"`, `"Utah"`, `"Wasatch"`, `"Washington"`, `"Wayne"`, `"Weber"`, `"Statewide"`

**Industries:** Run the SQL query to get the actual values — this column is not enumerated elsewhere in the codebase.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation
Create constants file, add industries GIN index, update SECURITY.md and INEFFICIENCIES.md.

### Phase 2: API Layer
Update `process-answer` (Claude mapping + SQL filter) and `match-resources` (Q5 embedding only).

### Phase 3: Hook Redesign
Update `useVoiceIntake` with 5 questions, filter pool tracking, and new API calls.

### Phase 4: Page Integration
Update `app/page.tsx` to drive bubble elimination from `activeFilterIds`.

### Phase 5: UI Updates
Update `VoiceIntake.tsx` with inline results. Update `results/page.tsx`.

### Phase 6: Cleanup
Delete obsolete files.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

---

### TASK 1: CREATE `lib/intake/filterConstants.ts`

Run the SQL queries from the Pre-Implementation Step above. Then create this file with actual values:

```ts
// All known enum values per resources table column
// Source: SELECT DISTINCT unnest(<column>) FROM resources

export const KNOWN_TOPICS = [
  "Funding",
  "Start a Business",
  "Growing a Business",
  "Marketing",
  "Networking",
  // ADD any additional values found by the SQL query
];

export const KNOWN_INDUSTRIES = [
  // PASTE results from: SELECT DISTINCT unnest(industries) FROM resources
  // e.g. "Agriculture", "Construction", "Healthcare", "Manufacturing", ...
];

export const KNOWN_LOCATIONS = [
  "Beaver", "Box Elder", "Cache", "Carbon", "Daggett", "Davis",
  "Duchesne", "Emery", "Garfield", "Grand", "Iron", "Juab",
  "Kane", "Millard", "Morgan", "Piute", "Rich", "Salt Lake",
  "San Juan", "Sanpete", "Sevier", "Summit", "Tooele", "Uintah",
  "Utah", "Wasatch", "Washington", "Wayne", "Weber", "Statewide",
  // ADD any additional values found by the SQL query
];

export const KNOWN_COMMUNITIES = [
  "Veteran", "Woman", "Rural", "Immigrant", "LGBTQ+",
  // ADD any additional values found by the SQL query
];

// City-to-county mapping for voice input normalization (Claude will handle most but this guides it)
export const CITY_TO_COUNTY: Record<string, string> = {
  "Salt Lake City": "Salt Lake",
  "Provo": "Utah",
  "Orem": "Utah",
  "Lehi": "Utah",
  "American Fork": "Utah",
  "Ogden": "Weber",
  "St. George": "Washington",
  "Saint George": "Washington",
  "Logan": "Cache",
  "Cedar City": "Iron",
  "Moab": "Grand",
  "Park City": "Summit",
  "Vernal": "Uintah",
  "Price": "Carbon",
  "Richfield": "Sevier",
};

// ── Question definitions ──────────────────────────────────────────────────────

// No extractionHint field — the Claude tool schema (built from the column's allowed values)
// carries all the constraint. The question text is the only prompt input needed.
export interface IntakeQuestion {
  index: number;
  text: string;
  column: "topics" | "industries" | "locations" | "communities" | null; // null = free-form (Q5)
}

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    index: 0,
    text: "What kind of help does your business need right now? For example — raising funding or loans, finding customers, marketing and branding, legal help, hiring employees, or connecting with other entrepreneurs.",
    column: "topics",
  },
  {
    index: 1,
    text: "What industry is your business in? For example — software, healthcare, manufacturing, agriculture, food and beverage, construction, or retail.",
    column: "industries",
  },
  {
    index: 2,
    text: "Where in Utah are you based or looking for support? You can name a city, county, or region — like Salt Lake City, Utah County, Cache Valley, or southern Utah.",
    column: "locations",
  },
  {
    index: 3,
    text: "Do any of these describe you or your founding team? For example — veteran-owned, woman-owned, minority-owned, rural entrepreneur, student founder, or nonprofit. You can name one, a few, or skip if none apply.",
    column: "communities",
  },
  {
    index: 4,
    text: "Tell me more about your specific business and exactly what you need help with right now. Be as specific as you like — describe your product or service, your current stage, and your biggest challenge.",
    column: null,
  },
];
```

Also add this helper at the bottom of the file — it is imported by `process-answer/route.ts` to build the tool schema:

```ts
// Returns the allowed enum values for a given column — used to build the Claude tool schema
export function getAllowedValuesForColumn(
  column: "topics" | "industries" | "locations" | "communities"
): string[] {
  switch (column) {
    case "topics":      return KNOWN_TOPICS;
    case "industries":  return KNOWN_INDUSTRIES;
    case "locations":   return KNOWN_LOCATIONS;
    case "communities": return KNOWN_COMMUNITIES;
  }
}
```

- **GOTCHA**: `KNOWN_INDUSTRIES` must be populated with the real DB values from the SQL query. An empty array means the Claude tool schema will have `enum: []`, which causes the API call to fail with a validation error.
- **VALIDATE**: `npx tsc --noEmit` (no type errors)

---

### TASK 2: CREATE `supabase/migrations/20250501000004_add_industries_index.sql`

```sql
-- GIN index for industries array column (missing from initial migration)
create index if not exists resources_industries_idx
  on resources
  using gin (industries);
```

- **RUN IN SUPABASE SQL EDITOR** before testing any industry filtering.
- **VALIDATE**: In Supabase SQL editor: `SELECT indexname FROM pg_indexes WHERE tablename = 'resources';` — should include `resources_industries_idx`.

---

### TASK 3: UPDATE `app/api/process-answer/route.ts` — Claude structured tool use + SQL filter

This route uses **Claude's tool use with `tool_choice: { type: "tool" }`** and an `enum` constraint on `mappedValues` items. The Anthropic API enforces that every value in `mappedValues` is from the allowed list — it is impossible for Claude to return a hallucinated or off-list value. No JSON parsing or post-hoc validation is needed.

Replace the entire file:

```ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { INTAKE_QUESTIONS, getAllowedValuesForColumn } from "@/lib/intake/filterConstants";

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
            enum: allowedValues,  // API-enforced — Claude cannot emit any other value
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
    sessionId: string;
    questionIndex: number;
    rawTranscript: string;
    currentIds: string[];
  };

  if (!sessionId || questionIndex === undefined || !rawTranscript) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (questionIndex < 0 || questionIndex > 4) {
    return NextResponse.json({ error: "Invalid questionIndex" }, { status: 400 });
  }

  const question = INTAKE_QUESTIONS[questionIndex];

  // Q5 is free-form — no enum mapping needed, return currentIds unchanged
  if (question.column === null) {
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
    tool_choice: { type: "tool", name: "map_to_enum" },  // forces tool call — no free-text fallback
    messages: [
      {
        role: "user",
        content: `The user was asked: "${question.text}"\n\nThey said: "${rawTranscript}"\n\nMap their answer to the closest values from the allowed list. If they mentioned a city name, map it to the Utah county it belongs to.`,
      },
    ],
  });

  // With tool_choice forced, the response is always a tool_use block
  const toolUse = msg.content.find(c => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    // Defensive fallback — structurally cannot happen with tool_choice: { type: "tool" }
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

  // SQL array-overlap filter — only apply if Claude found matching values
  let remainingIds = currentIds;
  if (mappedValues.length > 0 && currentIds.length > 0) {
    const { data, error } = await supabase
      .from("resources")
      .select("id")
      .in("id", currentIds)
      .overlaps(question.column, mappedValues);

    if (!error && data && data.length >= 5) {
      remainingIds = data.map((r: { id: string }) => r.id);
    }
    // If filter leaves < 5 resources OR errors — skip this filter, preserve currentIds
  }

  // Audit trail
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

  return NextResponse.json({ extractedAnswer, mappedValues, remainingIds, isAnswered });
}
```

- **WHY `tool_choice: { type: "tool", name: "map_to_enum" }`**: Forces Claude to always return a structured tool call, never a text response. Combined with the `enum` constraint in the schema, the Anthropic API rejects any response containing an off-list value before it reaches your code.
- **WHY `max_tokens: 256`**: The tool response is a small JSON object. 256 tokens is sufficient and keeps latency low.
- **GOTCHA**: `overlaps` in Supabase JS maps to `&&` (array overlap). Do not use `.contains()` (`@>`) — overlap is correct because we want resources that share ANY of the user's mapped values.
- **GOTCHA**: The `enum` array in the tool schema must be non-empty. If `KNOWN_INDUSTRIES` is empty, the Anthropic API returns a 400 for Q2. Complete Task 1's DB discovery step first.
- **VALIDATE**: With dev server running:
  ```bash
  # Q1 — user says colloquial phrasing, not exact DB value
  curl -X POST http://localhost:3000/api/process-answer \
    -H 'Content-Type: application/json' \
    -d '{"sessionId":"test-123","questionIndex":0,"rawTranscript":"I need help raising money and finding investors","currentIds":[]}'
  # mappedValues will be a strict subset of KNOWN_TOPICS — e.g. ["Funding"]
  # It will NEVER contain "raising money" or any value outside the allowed list

  # Q3 — city name maps to county
  curl -X POST http://localhost:3000/api/process-answer \
    -H 'Content-Type: application/json' \
    -d '{"sessionId":"test-123","questionIndex":2,"rawTranscript":"I am based in Lehi Utah","currentIds":[]}'
  # Expected: mappedValues: ["Utah"]
  ```

---

### TASK 4: UPDATE `app/api/match-resources/route.ts` — Q5 only (skip layer 1)

Replace the entire file:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { vectorSearch } from "@/lib/matching/vectorSearch";
import { synthesize } from "@/lib/matching/synthesize";

export async function POST(req: Request) {
  const { sessionId, filterIds, freeFormAnswer } = await req.json() as {
    sessionId: string;
    filterIds: string[];      // IDs remaining after Q1-Q4 SQL filtering
    freeFormAnswer: string;   // Q5 raw transcript
  };

  if (!freeFormAnswer || !filterIds?.length) {
    return NextResponse.json({ error: "Missing filterIds or freeFormAnswer" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Layer 2: vector search within the SQL-filtered pool
  // Build a minimal profile from the free-form answer for embedding
  const minimalProfile = {
    communities: [],
    counties: [],
    industry: "",
    stage: "",
    description: freeFormAnswer,
    primaryNeed: "",
    topics: [],
  };

  const topResources = await vectorSearch(supabase, minimalProfile, filterIds, 10);

  // Layer 3: Claude synthesis — generate match reasons
  const { narrative, results } = await synthesize(
    { ...minimalProfile, description: freeFormAnswer },
    topResources
  );

  if (sessionId) {
    await supabase
      .from("intake_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  return NextResponse.json({ narrative, results });
}
```

- **PATTERN**: `vectorSearch` and `synthesize` are unchanged — they take the same args. We pass an empty profile with only `description` set to the free-form answer. The embedding will be purely semantic on Q5's answer.
- **NOTE**: `vectorSearch` (`lib/matching/vectorSearch.ts`) builds a profile string from `profile.description` + other fields. Since the other fields are empty strings/arrays, the embedding input will just be `freeFormAnswer` — exactly what we want.
- **VALIDATE**: With dev server running + a real set of filterIds from your DB:
  ```bash
  curl -X POST http://localhost:3000/api/match-resources \
    -H 'Content-Type: application/json' \
    -d '{"sessionId":"test-123","filterIds":["<uuid1>","<uuid2>","<uuid3>","<uuid4>","<uuid5>"],"freeFormAnswer":"I run a small food truck in Salt Lake City and need help with a loan to buy equipment"}'
  ```
  Should return `{ narrative: "...", results: [{ id, title, matchReason, topics, link }] }`.

---

### TASK 5: UPDATE `hooks/useVoiceIntake.ts` — 5 questions, filter pool, new API calls

Replace the entire file. Key changes:
- Import `INTAKE_QUESTIONS` from `lib/intake/filterConstants`
- Add `activeFilterIds` state + `initFilterPool` function
- After Q1–Q4: call `/api/process-answer` with `currentIds`, get `remainingIds`, update `activeFilterIds`
- After Q5: call `/api/match-resources` with `filterIds` + `freeFormAnswer`
- Export `activeFilterIds` and `initFilterPool` in the return type

```ts
"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { useDeepgram, MicDeniedError } from "@/hooks/useDeepgram";
import { createClient } from "@/lib/supabase/client";
import { INTAKE_QUESTIONS } from "@/lib/intake/filterConstants";

export type IntakeState =
  | "idle"
  | "instructions"
  | "listening"
  | "processing"
  | "confirmed"
  | "complete";

export interface ConfirmedAnswer {
  questionIndex: number;
  extractedAnswer: string;
  mappedValues: string[];
  remainingIds: string[];
}

interface MatchResult {
  id: string;
  title: string;
  matchReason: string;
  topics: string[];
  link: string;
}

interface MatchResults {
  narrative: string;
  results: MatchResult[];
}

export interface UseVoiceIntakeReturn {
  state: IntakeState;
  currentQuestionIndex: number;
  confirmedAnswers: ConfirmedAnswer[];
  currentTranscript: string;
  interimTranscript: string;
  isListening: boolean;
  micError: boolean;
  sessionId: string | null;
  matchResults: MatchResults | null;
  inputMode: 'voice' | 'text';
  activeFilterIds: string[];
  begin: () => void;
  initFilterPool: (allIds: string[]) => void;
  startQuestion: () => Promise<void>;
  skipQuestion: () => void;
  confirmAnswer: () => void;
  retryMic: () => Promise<void>;
  switchToTextMode: () => void;
  submitTextAnswer: (text: string) => void;
}

export function useVoiceIntake(): UseVoiceIntakeReturn {
  const router = useRouter();
  const { user } = useAnonymousAuth();
  const [state, setState] = useState<IntakeState>("idle");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [confirmedAnswers, setConfirmedAnswers] = useState<ConfirmedAnswer[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResults | null>(null);
  const [micError, setMicError] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const processingRef = useRef(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  currentQuestionIndexRef.current = currentQuestionIndex;
  const confirmedAnswersRef = useRef(confirmedAnswers);
  confirmedAnswersRef.current = confirmedAnswers;
  const sessionIdRef = useRef(user?.id ?? null);
  sessionIdRef.current = user?.id ?? null;
  const inputModeRef = useRef<'voice' | 'text'>('voice');
  inputModeRef.current = inputMode;
  const activeFilterIdsRef = useRef<string[]>([]);
  activeFilterIdsRef.current = activeFilterIds;

  const sessionId = user?.id ?? null;
  const triggerProcessRef = useRef<(() => void) | null>(null);

  const handleSilence = useCallback(() => {
    triggerProcessRef.current?.();
  }, []);

  const {
    transcript,
    interimTranscript,
    isConnected,
    startListening,
    stopListening,
    resetTranscript,
    requestPermission,
  } = useDeepgram(handleSilence);

  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;

  const initFilterPool = useCallback((allIds: string[]) => {
    setActiveFilterIds(allIds);
  }, []);

  const processAnswer = useCallback(
    async (questionIndex: number, rawTranscript: string, allAnswers: ConfirmedAnswer[]) => {
      if (processingRef.current) return;
      processingRef.current = true;

      const currentSessionId = sessionIdRef.current;
      const currentFilterIds = activeFilterIdsRef.current;

      try {
        const res = await fetch("/api/process-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            questionIndex,
            rawTranscript,
            currentIds: currentFilterIds,
          }),
        });

        const data = await res.json() as {
          extractedAnswer: string;
          mappedValues: string[];
          remainingIds: string[];
          isAnswered: boolean;
        };

        const newAnswer: ConfirmedAnswer = {
          questionIndex,
          extractedAnswer: data.extractedAnswer ?? rawTranscript,
          mappedValues: data.mappedValues ?? [],
          remainingIds: data.remainingIds ?? currentFilterIds,
        };

        const updatedAnswers = [...allAnswers, newAnswer];
        setConfirmedAnswers(updatedAnswers);

        // Update the filter pool after Q1-Q4
        if (questionIndex < 4) {
          setActiveFilterIds(data.remainingIds ?? currentFilterIds);
        }

        if (questionIndex === 4) {
          // Q5: free-form → embedding → top 5
          setState("complete");

          const matchRes = await fetch("/api/match-resources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: currentSessionId,
              filterIds: currentFilterIds,
              freeFormAnswer: rawTranscript,
            }),
          });
          const matchData = await matchRes.json() as MatchResults;
          setMatchResults(matchData);
          sessionStorage.setItem("nexis-results", JSON.stringify(matchData));
          // Do NOT auto-navigate — parent page will show inline results + provide link
        } else {
          setState("confirmed");
          setTimeout(async () => {
            const nextIndex = questionIndex + 1;
            setCurrentQuestionIndex(nextIndex);
            resetTranscript();
            setState("listening");
            if (inputModeRef.current === 'voice') {
              try {
                await startListeningRef.current();
              } catch (err) {
                if (err instanceof MicDeniedError) {
                  setMicError(true);
                  setState("idle");
                }
              }
            }
          }, 1200);
        }
      } finally {
        processingRef.current = false;
      }
    },
    [router, resetTranscript]
  );

  const processAnswerRef = useRef(processAnswer);
  processAnswerRef.current = processAnswer;
  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;

  triggerProcessRef.current = () => {
    if (stateRef.current !== "listening") return;
    const t = transcriptRef.current.trim();
    if (t.length < 10) return;
    stopListeningRef.current();
    setState("processing");
    processAnswerRef.current(
      currentQuestionIndexRef.current,
      t,
      confirmedAnswersRef.current
    );
  };

  const begin = useCallback(async () => {
    const permState = await requestPermission();
    if (permState === 'denied') {
      setMicError(true);
      return;
    }
    setState("instructions");
  }, [requestPermission]);

  const startQuestion = useCallback(async () => {
    if (currentQuestionIndexRef.current === 0 && sessionIdRef.current) {
      const supabase = createClient();
      await supabase.from("intake_sessions").upsert(
        {
          id: sessionIdRef.current,
          status: "in_progress",
          started_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }
    resetTranscript();
    setState("listening");
    try {
      await startListening();
    } catch (err) {
      if (err instanceof MicDeniedError) {
        setMicError(true);
        setState("idle");
      }
    }
  }, [resetTranscript, startListening]);

  const skipQuestion = useCallback(() => {
    stopListening();
    const idx = currentQuestionIndexRef.current;
    const emptyAnswer: ConfirmedAnswer = {
      questionIndex: idx,
      extractedAnswer: "",
      mappedValues: [],
      remainingIds: activeFilterIdsRef.current,
    };
    const updated = [...confirmedAnswersRef.current, emptyAnswer];
    setConfirmedAnswers(updated);

    if (idx === 4) {
      setState("complete");
    } else {
      setCurrentQuestionIndex(idx + 1);
      resetTranscript();
      if (inputModeRef.current === 'text') {
        setState("listening");
      } else {
        setState("instructions");
      }
    }
  }, [stopListening, resetTranscript]);

  const switchToTextMode = useCallback(() => {
    setInputMode('text');
    setMicError(false);
    resetTranscript();
    setState('listening');
  }, [resetTranscript]);

  const submitTextAnswer = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    setState("processing");
    processAnswer(
      currentQuestionIndexRef.current,
      t,
      confirmedAnswersRef.current
    );
  }, [processAnswer]);

  const confirmAnswer = useCallback(() => {
    if (stateRef.current !== "listening") return;
    const t = transcriptRef.current.trim();
    if (!t) return;
    stopListening();
    setState("processing");
    processAnswer(
      currentQuestionIndexRef.current,
      t,
      confirmedAnswersRef.current
    );
  }, [processAnswer, stopListening]);

  const retryMic = useCallback(async () => {
    setInputMode('voice');
    setMicError(false);
    resetTranscript();
    setState("listening");
    try {
      await startListening();
    } catch (err) {
      if (err instanceof MicDeniedError) {
        setMicError(true);
        setState("idle");
      }
    }
  }, [resetTranscript, startListening]);

  return {
    state,
    currentQuestionIndex,
    confirmedAnswers,
    currentTranscript: transcript,
    interimTranscript,
    isListening: isConnected,
    micError,
    sessionId,
    matchResults,
    inputMode,
    activeFilterIds,
    begin,
    initFilterPool,
    startQuestion,
    skipQuestion,
    confirmAnswer,
    retryMic,
    switchToTextMode,
    submitTextAnswer,
  };
}
```

- **KEY CHANGE**: `processAnswer` now passes `currentIds: activeFilterIdsRef.current` to the API and updates `activeFilterIds` with the returned `remainingIds`.
- **KEY CHANGE**: Q5 calls `/api/match-resources` with `filterIds` (the current pool after Q1-Q4) + `freeFormAnswer`. It does NOT auto-navigate — the inline results will be shown in `VoiceIntake.tsx`.
- **KEY CHANGE**: `skipQuestion` preserves `activeFilterIds` (doesn't narrow the pool when skipped).
- **VALIDATE**: `npx tsc --noEmit` (no type errors on the new interface)

---

### TASK 6: UPDATE `app/page.tsx` — Drive bubble elimination from `activeFilterIds`

Replace the entire file:

```tsx
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useVoiceIntake } from "@/hooks/useVoiceIntake";
import { useBubbleState } from "@/hooks/useBubbleState";
import { VoiceIntake } from "@/components/intake/VoiceIntake";
import { BubbleField } from "@/components/discovery/BubbleField";

function HomeContent() {
  const intake = useVoiceIntake();
  const { bubbles, activeCount, initBubbles, triggerElimination, onBubbleEliminated } = useBubbleState();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load all resources on mount — init both bubble state and voice intake filter pool
  useEffect(() => {
    fetch("/api/discovery/start")
      .then(r => r.json())
      .then(data => {
        const resources = data.resources ?? [];
        initBubbles(resources);
        intake.initFilterPool(resources.map((r: { id: string }) => r.id));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eliminate bubbles when activeFilterIds narrows after each Q1-Q4 answer
  const prevFilterIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const current = intake.activeFilterIds;
    if (current.length === 0) return; // not initialized yet
    const prev = prevFilterIdsRef.current;
    if (prev.length === 0) {
      prevFilterIdsRef.current = current;
      return; // first initialization — no eliminations yet
    }
    const currentSet = new Set(current);
    const eliminated = prev.filter(id => !currentSet.has(id));
    prevFilterIdsRef.current = current;
    if (eliminated.length > 0) triggerElimination(eliminated);
  }, [intake.activeFilterIds, triggerElimination]);

  // When Q5 results arrive, eliminate all bubbles not in the top 5
  const matchResultsRef = useRef(intake.matchResults);
  useEffect(() => {
    if (!intake.matchResults) return;
    if (matchResultsRef.current === intake.matchResults) return;
    matchResultsRef.current = intake.matchResults;

    const topIds = new Set(intake.matchResults.results.map(r => r.id));
    const toEliminate = intake.activeFilterIds.filter(id => !topIds.has(id));
    if (toEliminate.length > 0) triggerElimination(toEliminate);
  }, [intake.matchResults, intake.activeFilterIds, triggerElimination]);

  if (isMobile) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "black",
          color: "white",
        }}
      >
        <VoiceIntake {...intake} />
      </main>
    );
  }

  return (
    <div
      style={{
        height: "100dvh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "row",
        backgroundColor: "black",
        color: "white",
      }}
    >
      {/* Left — voice intake */}
      <div
        style={{
          width: "45%",
          minWidth: "360px",
          maxWidth: "560px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          borderRight: "1px solid #111",
          padding: "64px 0",
          overflowY: "auto",
        }}
      >
        <VoiceIntake {...intake} />
      </div>

      {/* Right — bubble canvas */}
      <div style={{ flex: 1, height: "100%", position: "relative" }}>
        <BubbleField
          bubbles={bubbles}
          activeCount={activeCount}
          onBubbleEliminated={onBubbleEliminated}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", backgroundColor: "black" }} />}>
      <HomeContent />
    </Suspense>
  );
}
```

- **KEY CHANGE**: The `useEffect` watching `confirmedAnswers` (old embedding-based approach) is gone. Instead, two `useEffect`s watch `activeFilterIds` (for Q1-Q4) and `matchResults` (for Q5 final elimination).
- **KEY CHANGE**: `initFilterPool` is called after bubble state is initialized, using the same resource list.
- **GOTCHA**: The first `useEffect` dep array has `[]` because `initBubbles` and `intake.initFilterPool` are stable `useCallback` refs. The eslint-disable comment is intentional.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 7: UPDATE `components/intake/VoiceIntake.tsx` — New questions + inline results

The component must:
1. Import `INTAKE_QUESTIONS` and use it for question text (instead of the hardcoded `QUESTIONS` array)
2. Accept `matchResults` in its props (it's already in `UseVoiceIntakeReturn`)
3. When `state === "complete"` and `matchResults` is populated: render top-5 `ResourceCard` components inline with a "See full results →" link
4. When `state === "complete"` and `matchResults` is null: keep the "Finding your matches..." spinner

Replace the entire file:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { UseVoiceIntakeReturn } from "@/hooks/useVoiceIntake";
import { INTAKE_QUESTIONS } from "@/lib/intake/filterConstants";
import { InstructionSlide } from "./InstructionSlide";
import { QuestionDisplay } from "./QuestionDisplay";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { MicIndicator } from "./MicIndicator";
import { ConfirmedAnswer } from "./ConfirmedAnswer";
import { ResourceCard } from "@/components/results/ResourceCard";

export function VoiceIntake({
  state,
  currentQuestionIndex,
  confirmedAnswers,
  currentTranscript,
  interimTranscript,
  isListening,
  micError,
  matchResults,
  inputMode,
  begin,
  startQuestion,
  skipQuestion,
  confirmAnswer,
  retryMic,
  switchToTextMode,
  submitTextAnswer,
}: UseVoiceIntakeReturn) {
  const [textInput, setTextInput] = useState('');

  const handleBegin = () => {
    startQuestion().catch(console.error);
  };

  const currentQuestion = INTAKE_QUESTIONS[currentQuestionIndex];

  return (
    <div style={{ maxWidth: "680px", width: "100%", padding: "0 24px" }}>
      {/* Mic permission denied */}
      {micError && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic", fontSize: "1.25rem", color: "white", margin: 0 }}>
            Microphone access is required.
          </p>
          <p style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", fontSize: "0.875rem", color: "#666666", margin: 0, lineHeight: 1.6 }}>
            To enable your mic, click the camera icon in your browser&apos;s address bar and allow access, then try again. Or type your answers below.
          </p>
          <button
            onClick={() => retryMic().catch(console.error)}
            style={{ padding: "10px 32px", border: "1px solid white", background: "transparent", color: "white", fontSize: "0.875rem", fontFamily: "ui-sans-serif, system-ui, -apple-system", cursor: "pointer", letterSpacing: "0.05em" }}
          >
            Try again
          </button>
          <button
            onClick={switchToTextMode}
            style={{ background: "none", border: "none", color: "#666666", fontSize: "0.8rem", fontFamily: "ui-sans-serif, system-ui, -apple-system", cursor: "pointer", padding: 0, textDecoration: "underline" }}
          >
            type instead
          </button>
        </div>
      )}

      {/* Confirmed answers stack */}
      {!micError && confirmedAnswers.length > 0 && state !== "complete" && (
        <div style={{ marginBottom: "32px" }}>
          {confirmedAnswers.map((a) => (
            <ConfirmedAnswer
              key={a.questionIndex}
              answer={a.extractedAnswer}
              questionIndex={a.questionIndex}
            />
          ))}
        </div>
      )}

      {/* Idle */}
      {!micError && state === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "32px" }}>
          <p style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "3rem", color: "white", margin: 0, letterSpacing: "-0.01em" }}>
            Utah&apos;s Nexis
          </p>
          <p style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", fontSize: "0.9375rem", color: "#666666", margin: "0", textAlign: "center", lineHeight: 1.6 }}>
            Utah business resources, matched to your story.
          </p>
          <button
            onClick={begin}
            style={{ padding: "12px 40px", border: "1px solid white", background: "transparent", color: "white", fontSize: "1rem", fontFamily: "ui-sans-serif, system-ui, -apple-system", cursor: "pointer", letterSpacing: "0.05em" }}
          >
            Find your resources →
          </button>
        </div>
      )}

      {/* Instructions */}
      {!micError && state === "instructions" && (
        <InstructionSlide onBegin={handleBegin} />
      )}

      {/* Listening */}
      {!micError && state === "listening" && currentQuestion && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <QuestionDisplay question={currentQuestion.text} />

          {inputMode === 'voice' ? (
            <>
              <TranscriptDisplay finalTranscript={currentTranscript} interimTranscript={interimTranscript} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginTop: "24px" }}>
                <MicIndicator isListening={isListening} />
                <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                  {currentTranscript && (
                    <button
                      onClick={confirmAnswer}
                      style={{ background: "none", border: "none", color: "#888", fontSize: "0.8rem", fontFamily: "ui-sans-serif, system-ui, -apple-system", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                    >
                      confirm
                    </button>
                  )}
                  <button
                    onClick={skipQuestion}
                    style={{ background: "none", border: "none", color: "#666", fontSize: "0.8rem", fontFamily: "ui-sans-serif, system-ui, -apple-system", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                  >
                    skip
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginTop: "24px" }}>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your answer..."
                rows={3}
                style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.25rem", textAlign: "center", lineHeight: 1.7, color: "white", background: "transparent", border: "none", borderBottom: "1px solid #444444", outline: "none", width: "100%", resize: "none", padding: "8px 0" }}
              />
              <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                {textInput.trim() && (
                  <button
                    onClick={() => { submitTextAnswer(textInput); setTextInput(''); }}
                    style={{ background: "none", border: "none", color: "#888", fontSize: "0.8rem", fontFamily: "ui-sans-serif, system-ui, -apple-system", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                  >
                    confirm
                  </button>
                )}
                <button
                  onClick={() => { setTextInput(''); skipQuestion(); }}
                  style={{ background: "none", border: "none", color: "#666", fontSize: "0.8rem", fontFamily: "ui-sans-serif, system-ui, -apple-system", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                >
                  skip
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Processing */}
      {!micError && state === "processing" && currentQuestion && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <QuestionDisplay question={currentQuestion.text} />
          <p style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic", color: "#666666", fontSize: "1.125rem", margin: "16px 0" }}>
            Processing...
          </p>
        </div>
      )}

      {/* Confirmed */}
      {!micError && state === "confirmed" && (
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic", color: "#666666", fontSize: "1rem", margin: "0 0 8px" }}>
            Got it
          </p>
        </div>
      )}

      {/* Complete — loading results */}
      {!micError && state === "complete" && !matchResults && (
        <p style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic", fontSize: "1.25rem", color: "white", textAlign: "center", margin: 0 }}>
          Finding your matches...
        </p>
      )}

      {/* Complete — inline results */}
      {!micError && state === "complete" && matchResults && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
          <p style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic", fontSize: "1.125rem", color: "white", margin: "0 0 8px" }}>
            {matchResults.narrative}
          </p>
          {matchResults.results.map((result) => (
            <ResourceCard
              key={result.id}
              title={result.title}
              matchReason={result.matchReason}
              topics={result.topics}
              link={result.link}
            />
          ))}
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <Link
              href="/results"
              style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", fontSize: "0.875rem", color: "white", textDecoration: "underline" }}
            >
              See full results →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

- **KEY CHANGE**: Question text now comes from `INTAKE_QUESTIONS[currentQuestionIndex].text` — 5 questions instead of 4.
- **KEY CHANGE**: Inline results rendered when `state === "complete"` and `matchResults !== null`.
- **KEY CHANGE**: `ConfirmedAnswer` stack hidden when `state === "complete"` (results replace it).
- **VALIDATE**: Run dev server, complete intake, verify results appear inline without navigating away.

---

### TASK 8: UPDATE `app/results/page.tsx` — Remove /discover link

Find the `/discover` link block (around line 186–198) and remove it:

```tsx
// REMOVE this block entirely:
<div style={{ textAlign: "center", marginTop: "12px" }}>
  <a
    href="/discover"
    style={{
      fontFamily: "ui-sans-serif, system-ui, -apple-system",
      fontSize: "0.8rem",
      color: "#444",
      textDecoration: "underline",
    }}
  >
    Try the visual resource explorer →
  </a>
</div>
```

- **VALIDATE**: `npm run build` — no broken imports referencing removed files.

---

### TASK 9: DELETE obsolete files

Remove the following files entirely:

```bash
rm app/discover/page.tsx
rmdir app/discover/
rm app/api/discovery/answer/route.ts
rmdir app/api/discovery/answer/
rm components/discovery/QuestionPanel.tsx
rm components/discovery/FinalMatch.tsx
rm hooks/useDiscoverySession.ts
rm lib/matching/structuredFilter.ts
```

- **GOTCHA**: `app/api/discovery/start/route.ts` is NOT deleted — `app/page.tsx` still uses it to load all resources on mount.
- **VALIDATE**: `npx tsc --noEmit` (no "Cannot find module" errors)

---

### TASK 10: UPDATE `ai-context/INEFFICIENCIES.md`

Add entry:

```markdown
### Intake — OpenAI embedding called once per question in old discovery flow (Feature: sql-deterministic-intake-filtering)
**Impact:** Low  
**Context:** The old `/api/discovery/answer` route embedded cumulative answers after each of the 4 questions — 4 OpenAI embedding API calls per session. The new flow calls OpenAI embedding only once (for Q5 free-form), reducing API cost by 75%. Claude is called once per question (Q1-Q4) for enum mapping, which is more predictable and auditable than black-box embedding similarity.  
**Ideal solution:** Current approach is the ideal solution.  
**Workaround in place:** None needed.
```

---

### TASK 11: UPDATE `ai-context/SECURITY.md`

Add entry under "Key Rules":

```markdown
### SQL Filter Input Validation (Feature: sql-deterministic-intake-filtering)
- `/api/process-answer` accepts `currentIds: string[]` from the client — these are passed to Supabase `.in("id", currentIds)`. Supabase JS validates UUID format before sending to Postgres; malformed values cause an error rather than SQL injection.
- Claude's `mappedValues` output is used directly in `.overlaps(column, mappedValues)`. While this goes through Supabase's parameterized query layer (not string interpolation), the values should still be validated against the known enum list server-side before use. **TODO post-MVP**: Add a whitelist check: `const validValues = mappedValues.filter(v => KNOWN_TOPICS.includes(v))` before the SQL call.
- `rawTranscript` and `freeFormAnswer` go to Anthropic and OpenAI APIs respectively — these are not SQL-interpolated, so injection risk is minimal. Apply `maxLength: 1000` on frontend textarea inputs.
- `questionIndex` is validated server-side: `0 <= questionIndex <= 4`, returning 400 for out-of-range values.
```

---

## TESTING STRATEGY

No test framework is configured. Validate via curl and manual browser testing.

### API Tests (with dev server running)

```bash
# Q1 filter — topics
curl -X POST http://localhost:3000/api/process-answer \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"test-123","questionIndex":0,"rawTranscript":"I need help raising money and finding investors","currentIds":[]}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Mapped:', d.get('mappedValues'), '| Remaining:', len(d.get('remainingIds',[])))"
# Expected: mappedValues: ["Funding"], remainingIds: <N resources with Funding topic>

# Q2 filter — industries  
curl -X POST http://localhost:3000/api/process-answer \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"test-123","questionIndex":1,"rawTranscript":"I am in software development and building a SaaS tool","currentIds":[]}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Mapped:', d.get('mappedValues'))"

# Q3 filter — location
curl -X POST http://localhost:3000/api/process-answer \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"test-123","questionIndex":2,"rawTranscript":"I am based in Lehi Utah","currentIds":[]}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Mapped:', d.get('mappedValues'))"
# Expected: mappedValues: ["Utah"] (Lehi maps to Utah County)

# Q5 match — free-form
curl -X POST http://localhost:3000/api/match-resources \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"test-123","filterIds":[],"freeFormAnswer":"I build software for restaurants and need a small business loan to hire my first engineer"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('results',[])), 'results')"
# Expected: 5 results (may be fewer if filterIds is empty and pool is tiny)
```

### Manual End-to-End Flow

1. `npm run dev` → open `localhost:3000`
2. Click "Find your resources →" → grant mic permission
3. Complete InstructionSlide → speak Q1 answer about funding
4. Observe: bubbles eliminate after ~2s; counter decrements; "Got it" flashes; Q2 begins
5. Answer Q2 (industry) → Q3 (location: say "Lehi") → Q4 (community identity)
6. Answer Q5 (free-form: describe your business in detail)
7. Observe: remaining bubbles eliminate, top 5 glow green; inline results appear in left panel
8. Verify: 5 ResourceCards render with titles + match reasons + topics + links
9. Click "See full results →" → verify `/results` page loads with same 5 cards from sessionStorage

### Edge Cases

- **Skip all questions**: User skips Q1-Q4 → all resources remain in pool → Q5 embedding runs against all 213
- **Empty pool fallback**: If any filter would produce < 5 results, it's skipped — previous pool preserved
- **Q5 with tiny pool**: If only 5 resources remain after Q1-Q4, `match_resources` returns all 5

---

## VALIDATION COMMANDS

### Level 1: TypeScript
```bash
npx tsc --noEmit
```

### Level 2: Lint
```bash
npm run lint
```

### Level 3: Build
```bash
npm run build
```

### Level 4: Dev + Manual
```bash
npm run dev
# Complete full 5-question flow at localhost:3000
```

---

## ACCEPTANCE CRITERIA

- [ ] 5 questions display in correct order: Help Needed → Industry → Location → Community → Free-form
- [ ] After each Q1-Q4 answer, Claude maps transcript to enum values from `filterConstants.ts`
- [ ] SQL `&&` filter eliminates non-matching resources from the bubble pool
- [ ] Bubble counter decrements after each Q1-Q4 answer
- [ ] Skipping a question preserves the current filter pool (no extra eliminations)
- [ ] A filter that would reduce the pool below 5 resources is skipped
- [ ] Q5 free-form answer is embedded and compared against the SQL-filtered pool
- [ ] Top 5 results appear inline in the left panel without page navigation
- [ ] After Q5, all bubbles except the top 5 are eliminated; top 5 glow green
- [ ] "See full results →" link navigates to `/results` with the same 5 cards
- [ ] `/discover` page and related files are removed
- [ ] `useDiscoverySession.ts`, `structuredFilter.ts`, `QuestionPanel.tsx`, `FinalMatch.tsx` are deleted
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` succeeds

---

## COMPLETION CHECKLIST

- [ ] DB enum values discovered and populated in `filterConstants.ts`
- [ ] Industries GIN index added in Supabase SQL editor
- [ ] `process-answer` route does Claude mapping + SQL filter per Q1-Q4
- [ ] `match-resources` route accepts `filterIds` + `freeFormAnswer` for Q5
- [ ] `useVoiceIntake` tracks `activeFilterIds` and calls correct API per question
- [ ] `app/page.tsx` drives bubble elimination from `activeFilterIds` changes
- [ ] `VoiceIntake.tsx` shows inline results when `matchResults` is populated
- [ ] All obsolete files deleted
- [ ] TypeScript, lint, and build clean

---

## NOTES

### Why Claude for Enum Mapping (Not Embedding)
Embedding-based matching treats user intent as a vector — it works well for open-ended semantic similarity but is inherently probabilistic. When we know the exact allowed values ("Funding", "Utah County", etc.), it's strictly better to have Claude classify the user's words into those categories. This makes the filter deterministic, auditable, and explainable — if a user says "I'm in Salt Lake" and "Salt Lake" bubbles stay alive while "Cache County" bubbles die, the cause is unambiguous.

### Why `&&` (Overlap) Not `@>` (Contains)
`&&` returns resources where the resource's array and the user's mapped values share at least one element. `@>` would require the resource to contain ALL user values. Overlap is correct here: a resource tagged `["Funding", "Start a Business"]` should survive if the user said they need "Funding", even if they didn't mention "Start a Business".

### Why Skip the Filter When Pool Would Drop Below 5
If a user says they're in a very rural county or a niche industry with few resources, a strict AND would leave them with 0-4 results. Rather than dead-ending the experience, we preserve the previous pool and let Q5 embedding pick the best from a broader set. This is a graceful degradation, not a logic error.

### Why No Auto-Navigate After Q5
The user requested "both — inline preview, then full results page." Showing results inline gives immediate gratification without a page transition. The `/results` link provides a clean reading view. SessionStorage is already populated before the link is shown.

### Deleting `structuredFilter.ts`
The entire concept of `UserProfile` (with `communities`, `counties`, `industry`, `stage`, `description`, `primaryNeed`, `topics`) is replaced by the 5-question per-filter approach. There is no longer a need to collect all profile fields before filtering — each answer immediately narrows the pool. The `synthesize.ts` function still uses `UserProfile` — pass a minimal profile with just `description` set to the Q5 free-form answer (as implemented in `match-resources/route.ts`).

### Confidence Score
**8.5/10** — The architecture is clean and the patterns are well-established in the codebase. Main risk: `KNOWN_INDUSTRIES` values must be accurately populated from the DB in Task 1. If that step is skipped or populated with wrong values, Q2 (industry) filtering will return wrong results. Secondary risk: Claude's enum mapping accuracy for unusual phrasings — mitigated by providing all allowed values explicitly in the prompt and by the `< 5 resources` fallback.
