# Feature: Dynamic Bubble Filtering Fix

The following plan should be complete, but it is important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files. This project uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — NOT `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Feature Description

After each voice question is answered (Q1–Q4), resource bubbles on the right panel should immediately shrink to only those that match the user's answer via SQL array-overlap filter. Currently, bubbles do not visibly eliminate as questions are answered. This plan diagnoses the root causes and provides specific fixes.

---

## User Story

As a Utah founder answering intake questions,  
I want to see the resource bubbles on the right panel reduce in real time as I answer each question,  
So that I have visual feedback that the system is narrowing to my specific situation.

---

## Problem Statement

The bubble elimination pipeline (`processAnswer` → `/api/process-answer` → `setActiveFilterIds` → `triggerElimination`) is architecturally correct but fails silently at the Supabase query step due to a URL length limit bug. The result is that every question appears to do nothing — `remainingIds` always comes back as `currentIds` — and no bubbles are eliminated.

---

## Root Cause Analysis

### Bug 1 — PRIMARY: Supabase PostgREST URL Length Limit (`app/api/process-answer/route.ts` line 125–133)

```ts
// BROKEN — generates a URL with 213 UUIDs in query params (~8KB)
const { data, error } = await supabase
  .from("resources")
  .select("id")
  .in("id", currentIds)           // ← currentIds has 213 UUIDs @ 36 chars each = ~7,900 chars
  .overlaps(question.column, mappedValues);
```

Supabase JS builds PostgREST GET requests with filter conditions in the URL query string. `.in("id", [...213 UUIDs...])` generates a parameter like `id=in.(uuid1,uuid2,...,uuid213)`. With 213 UUIDs at ~37 chars each (36 + comma), that's **~7,900 characters** just for the ID list — right at or past the typical 8,192-byte URL limit enforced by nginx/PostgREST.

When this limit is exceeded, Supabase returns an error. The error is silently handled:
```ts
if (!error && data && data.length >= 5) {
  remainingIds = data.map((r: { id: string }) => r.id);
}
// On error: remainingIds stays as currentIds — no change, no logging
```

The hook receives `remainingIds === currentIds` → `setActiveFilterIds(currentIds)` → `useEffect` in `page.tsx` computes `eliminated = []` → `triggerElimination` is never called → bubbles never disappear.

**Fix**: Replace the combined `.in().overlaps()` query with two separate operations: query ALL resources matching the column filter (a small query, no ID list in URL), then intersect the result with `currentIds` in JavaScript.

---

### Bug 2 — SECONDARY: Silent Error Swallowing

When the Supabase query fails (any reason — URL limit, network, DB error), the error is discarded silently. There is no `console.error`, no `filterSkipped` flag in the response, and the UI shows no indication. This makes the bug invisible during development.

**Fix**: Add `console.error` logging in the route when the filter query fails. Optionally return a `filterSkipped: boolean` field to aid debugging.

---

### Bug 3 — UX: Skip Question Returns to Instructions Slide

```ts
// hooks/useVoiceIntake.ts line 261–266
const skipQuestion = useCallback(() => {
  // ...
  if (inputModeRef.current === 'text') {
    setState("listening");
  } else {
    setState("instructions");  // ← Shows InstructionSlide between every skipped question!
  }
```

After answering (not skipping), the hook correctly advances to `"listening"` via a 1200ms timeout. But after skipping in voice mode, it goes to `"instructions"` — meaning the user sees the InstructionSlide again and must click "Begin" to proceed to the next question. This is wrong: skip should advance directly without requiring another button press.

**Fix**: In `skipQuestion`, call `startListening()` directly and set state to `"listening"` regardless of input mode.

---

## Solution Statement

**Task 1 — Fix the Supabase filter query** in `app/api/process-answer/route.ts`:
- Remove `.in("id", currentIds)` from the Supabase query
- Query all resources matching just the column overlap (small query, no URL limit)
- Intersect results with `currentIds` in JavaScript using a `Set`
- Preserve the `>= 5` minimum pool fallback

**Task 2 — Add error logging** in `app/api/process-answer/route.ts`:
- Add `console.error` when the filter query fails
- Return optional `filterSkipped: boolean` for client-side debugging

**Task 3 — Fix skip question flow** in `hooks/useVoiceIntake.ts`:
- Replace `setState("instructions")` in `skipQuestion` with direct advance to the next question

---

## Feature Metadata

**Feature Type**: Bug Fix  
**Estimated Complexity**: Low  
**Primary Systems Affected**: `app/api/process-answer/route.ts`, `hooks/useVoiceIntake.ts`  
**Dependencies**: No new packages

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `app/api/process-answer/route.ts` (lines 116–134) — The broken filter query. The fix goes here. Supabase service role client instantiation pattern is also on lines 116–119.
- `hooks/useVoiceIntake.ts` (lines 244–267) — `skipQuestion` with the wrong `setState("instructions")` on line 265.
- `app/page.tsx` (lines 33–47) — The `useEffect` that watches `intake.activeFilterIds` and calls `triggerElimination`. This logic is correct and does not need to change.
- `hooks/useBubbleState.ts` — `triggerElimination` implementation. Correct, no changes needed.
- `lib/intake/filterConstants.ts` — `INTAKE_QUESTIONS` and `getAllowedValuesForColumn`. Read to understand the column mapping.

### Files to Modify

- `app/api/process-answer/route.ts` — Fix the filter query (Bug 1 + Bug 2)
- `hooks/useVoiceIntake.ts` — Fix skip behavior (Bug 3)

### Files to Create

None.

### Patterns to Follow

**Supabase service role client (API routes) — always inside handler body:**
```ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

**JavaScript Set intersection (the fix pattern):**
```ts
const matchingSet = new Set((allMatching ?? []).map(r => r.id));
const filteredIds = currentIds.filter(id => matchingSet.has(id));
```

**`skipQuestion` advance pattern (mirror from `processAnswer` confirmed path, lines 168–184):**
```ts
// After answering, the hook does:
setTimeout(async () => {
  setCurrentQuestionIndex(nextIndex);
  resetTranscript();
  setState("listening");
  await startListeningRef.current();
}, 1200);
// Skip should do the same but immediately (no confirmation pause needed)
```

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order. Each is atomic and independently testable.

---

### TASK 1: UPDATE `app/api/process-answer/route.ts` — Fix Supabase filter query

**Location**: Lines 122–133 (the `remainingIds` computation block)

Replace:
```ts
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
}
```

With:
```ts
let remainingIds = currentIds;
let filterSkipped = false;

if (mappedValues.length > 0 && currentIds.length > 0) {
  // Query all resources matching the column filter — no .in() to avoid PostgREST URL length limits.
  // 213 UUIDs in a URL query param (~7,900 chars) exceeds the 8KB limit and causes silent failures.
  // Instead: fetch all matching IDs from the full table, then intersect with currentIds in JS.
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
      // Filter would leave < 5 resources — skip to preserve user experience
      filterSkipped = true;
      console.warn(`[process-answer] filter for ${question.column}=${JSON.stringify(mappedValues)} would leave ${filteredIds.length} resources — skipping`);
    }
  }
}
```

Also update the final `return` statement to include `filterSkipped`:
```ts
return NextResponse.json({ extractedAnswer, mappedValues, remainingIds, isAnswered, filterSkipped });
```

- **WHY no `.in()`**: 213 UUIDs × 37 chars = ~7,900 chars in the URL query string. PostgREST/nginx URL limit is typically 8,192 bytes. Failures are silent (error returned, code falls through to `remainingIds = currentIds`).
- **WHY full-table overlaps query is fine**: The `topics`, `industries`, `locations`, `communities` columns all have GIN indexes. A `column && ARRAY[...]` filter on a GIN-indexed column is fast on 213 rows. The overhead of fetching all 213 rows vs a subset is negligible at this scale.
- **GOTCHA**: Do not add `.in("id", currentIds)` back even partially. If you need to restrict, do it in JS.
- **VALIDATE**:
  ```bash
  # Start dev server, then in a separate terminal:
  curl -s -X POST http://localhost:3000/api/process-answer \
    -H 'Content-Type: application/json' \
    -d '{"sessionId":"test-123","questionIndex":0,"rawTranscript":"I need help raising money and finding investors","currentIds":["<any-real-uuid-from-db>"]}' \
    | python3 -m json.tool
  # Expected: mappedValues: ["Funding"], remainingIds: [subset of IDs], filterSkipped: false
  # remainingIds.length should be LESS than currentIds.length (proves filtering worked)
  ```

---

### TASK 2: UPDATE `hooks/useVoiceIntake.ts` — Fix skip question flow

**Location**: `skipQuestion` callback, lines 244–267

Replace the state transition inside the `else` block:

```ts
// BEFORE (broken):
} else {
  setCurrentQuestionIndex(idx + 1);
  resetTranscript();
  if (inputModeRef.current === 'text') {
    setState("listening");
  } else {
    setState("instructions");  // ← Wrong: forces InstructionSlide between questions
  }
}
```

With:
```ts
// AFTER (fixed):
} else {
  const nextIndex = idx + 1;
  setCurrentQuestionIndex(nextIndex);
  resetTranscript();
  setState("listening");
  // In voice mode, start listening immediately (same as the normal answer advance path)
  if (inputModeRef.current === 'voice') {
    startListeningRef.current().catch((err: unknown) => {
      if (err instanceof MicDeniedError) {
        setMicError(true);
        setState("idle");
      }
    });
  }
}
```

- **WHY**: After a normal answer, the hook does `setState("listening")` + `startListeningRef.current()` inside a 1200ms timeout. Skipping should do the same immediately — no instruction slide re-shown, no extra click required.
- **GOTCHA**: `startListeningRef.current` (the ref) is used instead of `startListening` (the closed-over value) to avoid stale closure — same pattern as `triggerProcessRef` uses `startListeningRef.current`.
- **GOTCHA**: `MicDeniedError` is already imported at the top of the file — no new import needed.
- **VALIDATE**: In the browser, answer a question normally → confirm the question advances after 1.2s. Then skip a question → confirm the next question starts immediately WITHOUT showing the InstructionSlide.

---

## TESTING STRATEGY

No test framework is configured. Validate via curl and manual browser testing.

### API Test (Task 1 validation)

```bash
# 1. Get a real UUID from the DB first:
curl -s http://localhost:3000/api/discovery/start \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['resources'][0]['id'])"

# 2. Test Q1 filter with a real UUID:
curl -s -X POST http://localhost:3000/api/process-answer \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"test-debug\",\"questionIndex\":0,\"rawTranscript\":\"I need help raising money and finding investors\",\"currentIds\":[\"<UUID-FROM-STEP-1>\"]}" \
  | python3 -m json.tool
# ✓ mappedValues should be ["Funding"] (or similar)
# ✓ filterSkipped should be false
# ✓ remainingIds should be [] or ["<UUID>"] depending on whether the resource has Funding topic

# 3. Test with ALL resources as currentIds (the real scenario):
# Get all IDs first:
curl -s http://localhost:3000/api/discovery/start \
  | python3 -c "import sys,json; d=json.load(sys.stdin); ids=[r['id'] for r in d['resources']]; print(json.dumps(ids))" > /tmp/all-ids.json

curl -s -X POST http://localhost:3000/api/process-answer \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"test-debug\",\"questionIndex\":0,\"rawTranscript\":\"I need help raising money\",\"currentIds\":$(cat /tmp/all-ids.json)}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"filtered: {len(d['remainingIds'])}/{len($(cat /tmp/all-ids.json))} | filterSkipped: {d.get('filterSkipped')}\")"
# ✓ filtered count should be LESS than 213
# ✓ filterSkipped should be false
```

### Manual End-to-End Test

1. `npm run dev` → open `localhost:3000`
2. Open browser DevTools → Network tab, filter by `/api/process-answer`
3. Click "Find your resources →" → grant mic → click "Begin"
4. Speak Q1 answer (e.g., "I need funding")
5. Watch: Network tab should show `process-answer` 200 response with `remainingIds.length < 213`
6. Watch: Bubbles on the right panel should visibly reduce in count (~1–2 seconds after processing)
7. Watch: Bubble counter in top-right of canvas should decrement
8. Answer Q2 → verify further reduction
9. Skip Q3 → verify the next question starts immediately (no InstructionSlide shown)
10. Continue through Q4 and Q5

### Edge Cases

- **User answers with unmappable text** (e.g., "I don't know"): `mappedValues: []`, `filterSkipped: true`, `remainingIds = currentIds`, no bubbles eliminated. ✓ Correct.
- **Filter would leave < 5 resources**: `filterSkipped: true`, `remainingIds = currentIds`, no bubbles eliminated. ✓ Correct, prevents dead-ending.
- **Q5 (free-form, `column: null`)**: Filter is bypassed entirely, `remainingIds: currentIds`. ✓ Correct.
- **All questions skipped**: All 213 bubbles remain; Q5 embedding runs against all 213. ✓ Correct.

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

### Level 4: API smoke test
```bash
# With dev server running:
curl -s http://localhost:3000/api/discovery/start | python3 -c "
import sys, json
d = json.load(sys.stdin)
ids = [r['id'] for r in d['resources']]
print(f'Loaded {len(ids)} resource IDs')
print('First ID:', ids[0])
"
```

---

## ACCEPTANCE CRITERIA

- [ ] After answering Q1 (topics), the bubble count visibly decreases on the right canvas
- [ ] After answering Q2 (industries), the bubble count decreases further
- [ ] The bubble counter (top-right of canvas) decrements after each Q1–Q4 answer
- [ ] `process-answer` API response contains `remainingIds` with fewer IDs than `currentIds` (when a valid mapping is found)
- [ ] `filterSkipped: false` in the response when a filter is successfully applied
- [ ] `console.error` appears in server logs when (and only when) a Supabase filter query fails
- [ ] Skipping a question in voice mode advances directly to the next question without showing InstructionSlide
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` succeeds

---

## COMPLETION CHECKLIST

- [ ] `process-answer` filter query uses JavaScript intersection (no `.in()` with UUIDs)
- [ ] `filterSkipped` field returned in response
- [ ] Error logging added for filter failures
- [ ] `skipQuestion` advances directly without showing InstructionSlide
- [ ] TypeScript, lint, and build all clean
- [ ] Manual end-to-end test confirms bubbles reduce after each answer

---

## NOTES

### Why `.in()` Hits the URL Limit

Supabase JS's query builder sends `.select()` queries as HTTP GET requests. Filter conditions are URL query parameters. PostgREST (Supabase's REST layer) and the nginx reverse proxy in front of it both enforce URL length limits — typically 8,192 bytes for nginx. With 213 UUIDs at 36 chars each plus separators, the ID filter alone is ~7,900 chars. The full URL with the `overlaps` filter pushes it over. Supabase returns an error response, which the current code silently ignores (falls back to `currentIds`).

The JavaScript intersection approach avoids this entirely: the `overlaps` query has a small, fixed-size URL regardless of pool size. The intersection is O(n) with a Set.

### Why This Is Hard to Notice During Development

The fallback behavior (`remainingIds = currentIds` on error) is indistinguishable from "Claude found no matching enum values." Both cases produce no bubble elimination. Without server-side logging or a `filterSkipped` field, there is no visible signal that the filter failed.

### Why the Skip Bug Exists

The `skipQuestion` function was likely written before the `"instructions"` state was decoupled from the question flow. After any answer, the hook correctly skips the instruction slide. Skip should follow the same pattern.

### Confidence Score

**9.5/10** — Both fixes are surgical one-file changes to well-understood code. The root cause (URL limit) is definitively identifiable from the code structure. The skip bug is unambiguous. Main risk: the curl test requires a real Supabase connection and real UUIDs — if the DB is unavailable during validation, use the browser end-to-end test instead.
