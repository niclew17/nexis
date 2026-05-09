# Feature: Preliminary Founder Info Question for Email Personalization

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to the existing question index numbering — all current Q0–Q4 shift to Q1–Q5. Import from the right files and match naming conventions exactly.

---

## Feature Description

Add a new preliminary question at the very start of the intake flow — before the existing filtering questions — that asks the founder for their name, business name, and role. Claude extracts these as structured fields via tool use. The extracted `founderInfo` object (`name`, `businessName`, `role`) is stored in hook state, passed to `/api/match-resources`, and injected into the `draftEmails` prompt so that every generated email opens with the founder's real name and business name and closes with a proper signature.

## User Story

As a Utah founder completing the voice intake,
I want to provide my name and business name at the start,
So that the three draft outreach emails feel like they were written by me — containing my real name, business name, and professional signature.

## Problem Statement

Currently the draft emails have no personalization about *who* is sending them. Claude is explicitly told not to use a signature ("end with 'Thank you,' on its own line" / "Do NOT use placeholder text like [Your Name]") because the founder's identity is unknown. This makes the emails feel generic and unusable without heavy editing.

## Solution Statement

Insert a new free-form preliminary question (new Q0) that uses a dedicated Claude tool to extract `name`, `businessName`, and `role` from the founder's spoken answer. Thread the extracted `founderInfo` struct through the hook → match-resources API → `draftEmails` prompt, allowing Claude to open emails with "My name is [name] and I'm the [role] of [businessName]..." and close with a real signature.

## Feature Metadata

**Feature Type**: Enhancement  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: `filterConstants.ts`, `process-answer`, `useVoiceIntake`, `match-resources`, `draftEmails`  
**Dependencies**: None new — uses existing Anthropic SDK, existing tool-use pattern

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `lib/intake/filterConstants.ts` (lines 78–116) — `INTAKE_QUESTIONS` array + `getAllowedValuesForColumn`; new Q0 inserted here, all indices shift
- `app/api/process-answer/route.ts` (lines 1–171) — Full route; Q0 needs its own extraction branch (separate from enum-mapping and free-form pass-through)
- `hooks/useVoiceIntake.ts` (lines 111–203) — `processAnswer` callback; update final-question check (`=== 4` → `=== 5`), filter-update guard (`< 4` → `< 5 && > 0`), store `founderInfo` from Q0 response
- `app/api/match-resources/route.ts` (lines 1–50) — Request destructuring; accept new `founderInfo` field and pass to `draftEmails`
- `lib/matching/draftEmails.ts` (lines 1–108) — `draftEmails` function signature and prompt; inject `founderInfo` for personalized open and signature
- `components/intake/VoiceIntake.tsx` (lines 37–38) — Uses `INTAKE_QUESTIONS[currentQuestionIndex]`; no change needed here since the array shift handles it automatically

### New Files to Create

None — all changes are in existing files.

### Relevant Documentation

- Claude tool use (force tool): The project already uses `tool_choice: { type: "tool", name: "..." }` in `process-answer/route.ts` (lines 90–94). Mirror this exact pattern for the `extract_founder_info` tool.
- Supabase upsert pattern: `process-answer/route.ts` lines 154–168 shows the `intake_answers` upsert. The new Q0 branch must do the same upsert so the session record is complete.

### Patterns to Follow

**Tool-use extraction (existing pattern — `process-answer/route.ts` lines 6–36):**
```ts
function buildMappingTool(column: string, allowedValues: string[]) {
  return {
    name: "map_to_enum" as const,
    description: "...",
    input_schema: {
      type: "object" as const,
      properties: {
        mappedValues: { ... },
        extractedAnswer: { type: "string" as const, description: "..." },
        isAnswered: { type: "boolean" as const, description: "..." },
      },
      required: ["mappedValues", "extractedAnswer", "isAnswered"],
    },
  };
}
```
Mirror this shape for the new `extract_founder_info` tool — same `name`, `description`, `input_schema` structure; just different properties.

**Free-form Q branch (existing pattern — `process-answer/route.ts` lines 57–83):**
```ts
if (question.column === null) {
  if (sessionId) { /* upsert */ }
  return NextResponse.json({
    extractedAnswer: rawTranscript.trim(),
    mappedValues: [],
    remainingIds: currentIds,
    isAnswered: rawTranscript.trim().length > 10,
  });
}
```
Q0 (new preliminary) also has `column: null` but differs from Q5 (also `column: null`) in that Q0 requires a Claude call. Use `questionIndex === 0` as the distinguishing condition, checked **before** the `column === null` check.

**founderInfo stored in a ref in `useVoiceIntake` (new pattern):**
```ts
const founderInfoRef = useRef<FounderInfo | null>(null);
// Set in processAnswer when questionIndex === 0
founderInfoRef.current = data.founderInfo ?? null;
// Passed to match-resources body:
founderInfo: founderInfoRef.current,
```
Use a ref (not state) because `founderInfo` doesn't need to trigger re-renders — it only needs to be available when the final match call fires.

**Naming conventions:** camelCase for interfaces (`FounderInfo`), camelCase for fields (`firstName`, `businessName`, `role`). Match existing interface naming in `draftEmails.ts` (`AnswerSummary`, `EmailedResult`, `RankedMatch`).

---

## IMPLEMENTATION PLAN

### Phase 1: Question array + new FounderInfo type

Update `filterConstants.ts` to insert the new Q0, shifting all existing questions by one. Define the `FounderInfo` interface in `draftEmails.ts` (canonical location, since it's consumed there).

### Phase 2: Process-answer route — Q0 extraction branch

Add a `questionIndex === 0` early-exit branch in the route that:
1. Calls Claude with the `extract_founder_info` tool
2. Returns `{ extractedAnswer, founderInfo, mappedValues: [], remainingIds: currentIds, isAnswered }`
3. Upserts to `intake_answers` with the structured data

Update the `questionIndex > 4` validation to `questionIndex > 5`.

### Phase 3: Hook — store founderInfo + update index guards

In `useVoiceIntake.ts`:
- Store `founderInfo` in a ref
- Update final-question check from `=== 4` → `=== 5`
- Update filter-pool guard from `< 4` → `>= 1 && < 5` (Q0 answer doesn't narrow the pool)
- Pass `founderInfo` in the `match-resources` fetch body

### Phase 4: API route + email drafting

In `match-resources/route.ts`: accept + thread `founderInfo` through to `draftEmails`.
In `draftEmails.ts`: add `founderInfo` parameter; inject into prompt for personalized email open and signature.

---

## STEP-BY-STEP TASKS

### TASK 1 — UPDATE `lib/intake/filterConstants.ts`

- **IMPLEMENT**: Add new Q0 (preliminary, `column: null`) at array index 0. Shift current Q0 → 1, Q1 → 2, Q2 → 3, Q3 → 4, Q4 → 5.
- **NEW Q0 TEXT**: `"Before we start — what's your name, and what's the name of your business or venture? Feel free to mention your role or title too."`
- **COLUMN**: `null` (no SQL filtering — same as the existing final question)
- **GOTCHA**: The `index` property on each `IntakeQuestion` object must also be updated to match the new position (0–5). Check all six entries.
- **VALIDATE**: `npm run lint` — no TypeScript errors

**New Q0 entry:**
```ts
{
  index: 0,
  text: "Before we start — what's your name, and what's the name of your business or venture? Feel free to mention your role or title too.",
  column: null,
},
```

Updated indices for existing questions:
| Old index | New index | column |
|---|---|---|
| — (new) | 0 | null |
| 0 | 1 | "topics" |
| 1 | 2 | "industries" |
| 2 | 3 | "locations" |
| 3 | 4 | "communities" |
| 4 | 5 | null |

---

### TASK 2 — ADD `FounderInfo` interface to `lib/matching/draftEmails.ts`

- **IMPLEMENT**: Export a new `FounderInfo` interface at the top of the file (after existing imports):
```ts
export interface FounderInfo {
  name: string;
  businessName: string;
  role: string;
}
```
- **REASON**: Canonical location is `draftEmails.ts` because it's the primary consumer. Re-exported from there by other files that need it.
- **VALIDATE**: `npm run build` — no type errors

---

### TASK 3 — UPDATE `app/api/process-answer/route.ts`

Three changes:

**3a — Update validation range:**
- **CHANGE**: Line `if (questionIndex < 0 || questionIndex > 4)` → `if (questionIndex < 0 || questionIndex > 5)`
- **VALIDATE**: Route rejects `questionIndex: 6` with 400

**3b — Add `extract_founder_info` tool builder (above `buildMappingTool`):**
```ts
import type { FounderInfo } from "@/lib/matching/draftEmails";

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
```

**3c — Add Q0 early-exit branch (insert BEFORE the `question.column === null` check):**
```ts
// Q0: preliminary founder info — extract name/business via tool, no SQL filter
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
  const founderInfo: FounderInfo = toolUse?.type === "tool_use"
    ? (toolUse.input as FounderInfo)
    : { name: "", businessName: "", role: "" };

  const extractedAnswer = toolUse?.type === "tool_use"
    ? ((toolUse.input as { extractedAnswer: string }).extractedAnswer ?? rawTranscript.trim())
    : rawTranscript.trim();

  const isAnswered = toolUse?.type === "tool_use"
    ? ((toolUse.input as { isAnswered: boolean }).isAnswered ?? false)
    : rawTranscript.trim().length > 3;

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
```

- **GOTCHA**: The `buildFounderInfoTool` function must be placed before `buildMappingTool` or after it — doesn't matter, but keep at the top of the file for clarity.
- **GOTCHA**: The `FounderInfo` import must be from `@/lib/matching/draftEmails` (server-side lib, safe to import in a route).
- **VALIDATE**: `npm run build` — no type errors

---

### TASK 4 — UPDATE `hooks/useVoiceIntake.ts`

Four changes:

**4a — Add `FounderInfo` import and `founderInfoRef`:**
```ts
import type { FounderInfo } from "@/lib/matching/draftEmails";

// Inside useVoiceIntake(), after other refs:
const founderInfoRef = useRef<FounderInfo | null>(null);
```

**4b — In `processAnswer` callback, update the `data` type to include `founderInfo`:**
```ts
const data = await res.json() as {
  extractedAnswer: string;
  mappedValues: string[];
  remainingIds: string[];
  isAnswered: boolean;
  founderInfo?: FounderInfo;         // ← add this
};
```

**4c — In `processAnswer`, immediately after parsing `data`, store `founderInfo` for Q0:**
```ts
if (questionIndex === 0 && data.founderInfo) {
  founderInfoRef.current = data.founderInfo;
}
```

**4d — Update the two index guards in `processAnswer`:**

Change:
```ts
// Update the filter pool after Q1-Q4
if (questionIndex < 4) {
  setActiveFilterIds(data.remainingIds ?? currentFilterIds);
}

if (questionIndex === 4) {
  // Q5: free-form → embedding → top 5
```

To:
```ts
// Update the filter pool after Q1–Q4 (skip Q0 — no SQL filter on founder info)
if (questionIndex >= 1 && questionIndex < 5) {
  setActiveFilterIds(data.remainingIds ?? currentFilterIds);
}

if (questionIndex === 5) {
  // Q5 (free-form): trigger match
```

**4e — In the `match-resources` fetch body, add `founderInfo`:**
```ts
body: JSON.stringify({
  sessionId: currentSessionId,
  filterIds: currentFilterIds,
  freeFormAnswer: rawTranscript,
  founderInfo: founderInfoRef.current,          // ← add this
  allAnswers: confirmedAnswersRef.current.map(a => ({
    questionIndex: a.questionIndex,
    extractedAnswer: a.extractedAnswer,
  })),
}),
```

**4f — Update the `skipQuestion` callback's final-question check:**

Change:
```ts
if (idx === 4) {
  setState("complete");
```
To:
```ts
if (idx === 5) {
  setState("complete");
```

- **GOTCHA**: There is also a check in `skipQuestion` for `idx === 4` — search the file for all occurrences of `=== 4` and update appropriately. The only `=== 4` that should become `=== 5` are the ones checking for the **last question**. The `questionIndex < 4` in the bubble-elimination logic in `app/page.tsx` is separate and not affected (it checks `intake.activeFilterIds`).
- **VALIDATE**: `npm run lint`

---

### TASK 5 — UPDATE `app/api/match-resources/route.ts`

**5a — Accept `founderInfo` in the request body:**
```ts
const { sessionId, filterIds, freeFormAnswer, founderInfo, allAnswers } = await req.json() as {
  sessionId: string | null;
  filterIds: string[];
  freeFormAnswer: string;
  founderInfo?: import("@/lib/matching/draftEmails").FounderInfo | null;
  allAnswers: Array<{ questionIndex: number; extractedAnswer: string }>;
};
```

**5b — Pass `founderInfo` to `draftEmails`:**
```ts
const results = await draftEmails(matches, allAnswers ?? [], freeFormAnswer, founderInfo ?? null);
```

- **VALIDATE**: `npm run build` — no type errors

---

### TASK 6 — UPDATE `lib/matching/draftEmails.ts`

**6a — Update `draftEmails` function signature:**
```ts
export async function draftEmails(
  matches: RankedMatch[],
  allAnswers: AnswerSummary[],
  freeFormAnswer: string,
  founderInfo?: FounderInfo | null         // ← add
): Promise<EmailedResult[]> {
```

**6b — Update `QUESTION_LABELS` to reflect shifted indices:**
```ts
const QUESTION_LABELS = [
  "Founder info",               // 0 (new)
  "Type of help needed",        // 1 (was 0)
  "Industry",                   // 2 (was 1)
  "Location in Utah",           // 3 (was 2)
  "Community identity",         // 4 (was 3)
];
```

**6c — Update the prompt to inject `founderInfo`:**

Replace the existing `Rules for each email` block with:

```ts
const founderIntro = founderInfo?.name
  ? `The founder's name is ${founderInfo.name}${founderInfo.businessName ? `, and their business is called ${founderInfo.businessName}` : ""}${founderInfo.role ? ` (${founderInfo.role})` : ""}.`
  : "";

const signatureLine = founderInfo?.name
  ? `Close with:\nThank you,\n${founderInfo.name}${founderInfo.businessName ? `\n${founderInfo.businessName}` : ""}`
  : `Close with:\nThank you,`;
```

Then update the prompt string — replace the `Rules` section:

```ts
const prompt = `You are helping a Utah founder reach out to business resources they've been matched with.

${founderIntro}

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
- Open with who the founder is and what they are building${founderInfo?.name ? ` — use their real name (${founderInfo.name}) and business name (${founderInfo.businessName || "their venture"})` : ""}
- Explain why this specific resource is relevant to their situation
- Include a clear call to action (request a meeting, ask about eligibility, etc.)
- ${signatureLine}
- Do NOT use placeholder text like [Your Name] or [Resource Name] — use the actual resource title
- Keep each email under 250 words`;
```

- **GOTCHA**: The `founderIntro` and `signatureLine` variables must be declared before the `prompt` template literal. Place them after `const resourceList = ...`.
- **GOTCHA**: If `founderInfo` is null (founder skipped Q0 or the extraction failed), the prompt must still generate valid emails. Verify the fallback path: `founderIntro` becomes `""` (empty string — no extra context added) and `signatureLine` becomes `"Close with:\nThank you,"` (existing behavior).
- **VALIDATE**: `npm run build` — no type errors

---

### TASK 7 — Verify `app/page.tsx` bubble-elimination logic

No changes should be needed — but verify the two `useEffect` hooks that track `intake.activeFilterIds`:

1. The "Q1-Q4 answer narrows bubbles" effect: it fires whenever `intake.activeFilterIds` changes. Since Q0 returns `remainingIds === currentIds` (unchanged), the `eliminated` array will be empty and `triggerElimination` won't fire. **No change needed.**

2. The "Q5 results arrive" effect: it fires when `intake.matchResults` appears. **No change needed.**

- **VALIDATE**: Run the app, answer Q0 (name/business), confirm bubble count does NOT change. Answer Q1 (topics), confirm bubbles start disappearing.

---

### TASK 8 — Update SECURITY.md

Add an entry for this feature's prompt-injection surface:
- `founderInfo` fields (`name`, `businessName`, `role`) are returned from a Claude tool call (already sanitized by Claude's output), then re-sent client → server in the `match-resources` body.
- They are injected into a Claude prompt in `draftEmails.ts` — prompt injection via a crafted business name is theoretically possible.
- **Mitigation**: Truncate each field server-side to 100 chars before using in the prompt.
- Add truncation in `match-resources/route.ts` before passing to `draftEmails`:
  ```ts
  const safeFounderInfo = founderInfo ? {
    name: (founderInfo.name ?? "").slice(0, 100),
    businessName: (founderInfo.businessName ?? "").slice(0, 100),
    role: (founderInfo.role ?? "").slice(0, 100),
  } : null;
  ```

---

## TESTING STRATEGY

### Manual End-to-End Test

1. Start `npm run dev`
2. Click "Find your resources →"
3. Complete `InstructionSlide`
4. **Q0**: Speak "My name is Sarah Chen, I'm the founder of Bloom Foods" → confirm extracted answer shows "Sarah Chen, founder of Bloom Foods" in the confirmed stack
5. Verify bubble count has NOT changed
6. Answer Q1–Q5 normally
7. When `EmailPanel` appears: verify each email opens with "My name is Sarah Chen..." and closes with "Thank you,\nSarah Chen\nBloom Foods"

### Edge Cases

- **Skip Q0**: Press "skip" on the name question → `founderInfo` remains `null` → emails generate with old generic closings (graceful fallback)
- **Partial answer**: Only says name, no business name → `businessName` is `""` → email opens with name only, no business reference
- **Role mentioned**: "I'm Alex, CEO of TechStartup" → `role: "CEO"` appears in the email intro
- **Long business name**: Provide a 200+ character business name → truncated to 100 chars before prompt injection

### Validation Commands

```bash
# Level 1: lint + types
npm run lint
npm run build

# Level 2: verify question count
node -e "const {INTAKE_QUESTIONS} = require('./lib/intake/filterConstants.ts'); console.log(INTAKE_QUESTIONS.length)" 
# Expected: 6

# Level 3: manual flow
npm run dev
# Test the full flow as described above
```

---

## ACCEPTANCE CRITERIA

- [ ] New Q0 question appears as the first question after the instruction slide
- [ ] Q0 does not change the active filter IDs / bubble count
- [ ] Q0 confirmed answer shows in the stacked answers list (name/business extracted)
- [ ] All five existing questions (Q1–Q5) still function correctly with shifted indices
- [ ] `founderInfo` is passed to `draftEmails` when available
- [ ] Generated emails contain the founder's real name in the opening line
- [ ] Generated emails contain the business name in the opening line (when provided)
- [ ] Generated emails close with the founder's name as a proper signature
- [ ] Skipping Q0 falls back to the current generic email format (no crash)
- [ ] `npm run build` passes with zero type errors
- [ ] `npm run lint` passes with zero warnings

---

## COMPLETION CHECKLIST

- [ ] `lib/intake/filterConstants.ts` — Q0 inserted, all indices updated
- [ ] `lib/matching/draftEmails.ts` — `FounderInfo` interface exported, function signature updated, prompt updated
- [ ] `app/api/process-answer/route.ts` — validation range updated, Q0 branch added with tool extraction and upsert
- [ ] `hooks/useVoiceIntake.ts` — `founderInfoRef` added, index guards updated, `founderInfo` passed to match-resources
- [ ] `app/api/match-resources/route.ts` — `founderInfo` accepted, passed to `draftEmails`, truncation guard added
- [ ] Manual E2E test confirms personalized emails
- [ ] Edge case: skipping Q0 produces valid emails
- [ ] All validation commands pass

---

## NOTES

**Why `founderInfoRef` (ref, not state) in the hook:**
`founderInfo` only needs to be available when the Q5 match call fires. It doesn't need to trigger a re-render. Using a ref avoids a needless re-render cycle after Q0 completion.

**Why Q0 is `column: null` but still calls Claude:**
The `column` field on `IntakeQuestion` drives the SQL filter logic. Q0 has no SQL filter (we don't filter resources by founder name), so `column: null` is correct. But unlike Q5 (also `column: null`), Q0 wants structured extraction. The distinction is made by `questionIndex === 0` checked before the `column === null` early-exit.

**Why `FounderInfo` lives in `draftEmails.ts`:**
`draftEmails.ts` is the consumer. Defining it there avoids a separate types file and keeps the interface co-located with where it's used. Route files import it as a type-only import.

**Trade-off — Q0 adds one more Claude API call per session:**
This is a ~50ms tool-use call with `max_tokens: 256`. Adds one serial Claude call before the user even reaches Q1. Given the hackathon context and the dramatically improved email quality, this trade-off is correct.
