# Feature: AI Ranking + Email Results Panel

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing types, imports, and inline style conventions throughout the codebase.

---

## Feature Description

Replace the current OpenAI embedding + pgvector matching pipeline with two sequential Claude calls: the first reads full resource descriptions for all remaining resources (after Q1–Q4 SQL filtering) and selects the top 3 most relevant based on Q5's free-form answer; the second takes those 3 resources plus all five of the user's answers and writes a personalized outreach email for each. Full descriptions are passed without truncation. The right panel transitions from the bubble field to an email drafts panel once results arrive; the left panel shows the three matched resource cards cleanly. Each email has a one-click send button that copies the full email to clipboard and opens the user's mail client.

---

## User Story

As a Utah founder who just completed the five-question voice intake,
I want to see my top 3 matched resources with personalized explanations and a ready-to-send outreach email for each,
So that I can immediately take action without needing to write anything myself.

---

## Problem Statement

1. **Filtering bug**: `filterIds` in `match-resources` currently comes from `activeFilterIdsRef` at the moment Q5 fires — this is correct, but the current API discards the filter pool and runs vector search across all embeddings if `filterIds` is empty, silently degrading to a full-table scan.
2. **Embedding dependency**: The vector search path requires OpenAI, adding latency, cost, and a third API dependency. With 30–80 resources remaining after filtering, Claude can read them directly — this is both faster (no embed round-trip) and more accurate (full semantic understanding).
3. **Dead-end UX**: After results load, there's nothing actionable — no path for the founder to contact the resource immediately. A pre-drafted email closes the gap between discovery and action.

---

## Solution Statement

- Delete `lib/matching/vectorSearch.ts` (OpenAI dependency gone).
- Create `lib/matching/rankResources.ts` — Claude call 1: reads all remaining resource full descriptions + Q5 answer, returns top 3 ranked results with match reasons.
- Create `lib/matching/draftEmails.ts` — Claude call 2: takes the top 3 ranked resources + all five answer summaries, writes a draft email and subject line for each.
- Update `/api/match-resources/route.ts` to fetch full resource records for `filterIds`, call `rankResources`, then call `draftEmails`, then merge and return.
- Update `useVoiceIntake.ts` to send `allAnswers` (Q1–Q4 summaries) in the match-resources request.
- Replace the right `BubbleField` panel with an `EmailPanel` once results arrive.
- Update `VoiceIntake.tsx` left panel to show 3 clean result cards (remove the "See full results →" link).
- The `app/results/page.tsx` continues to work from `sessionStorage["nexis-results"]` — no changes needed there.

---

## Feature Metadata

**Feature Type**: Enhancement / Refactor  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: `match-resources` API route, `synthesize`/ranking lib, `useVoiceIntake`, `page.tsx` layout, new `EmailPanel` component  
**Dependencies**: Anthropic SDK (already installed), no new packages needed

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `lib/matching/synthesize.ts` (lines 1–84) — current Claude synthesis pattern; new `rankAndDraft.ts` will mirror its structure but return 3 results + emails
- `lib/matching/vectorSearch.ts` (lines 1–59) — **DELETE THIS FILE** entirely; nothing else imports it except `match-resources/route.ts`
- `app/api/match-resources/route.ts` (lines 1–47) — replace vectorSearch + synthesize calls with new rankAndDraft call; add Supabase fetch for descriptions
- `hooks/useVoiceIntake.ts` (lines 108–197, esp. 158–171) — where match-resources is called; add `allAnswers` to request body
- `app/page.tsx` (lines 80–117) — right panel layout; needs conditional: BubbleField when no results, EmailPanel when results arrive
- `components/intake/VoiceIntake.tsx` (lines 186–213) — inline results display; simplify and remove "See full results" link
- `components/discovery/ResourcePopup.tsx` (lines 1–135) — reference for popup card style (border `#2a5e49`, `#080808` bg) to match EmailPanel aesthetic
- `components/results/ResourceCard.tsx` (lines 1–82) — existing card style to use in left panel results
- `lib/intake/filterConstants.ts` (lines 78–104) — `INTAKE_QUESTIONS` array for building the answer summary for Claude
- `app/api/discovery/start/route.ts` — pattern for fetching resource records with service role client

### New Files to Create

- `lib/matching/rankResources.ts` — Claude call 1: reads full resource descriptions, ranks top 3 by Q5 relevance, returns match reasons
- `lib/matching/draftEmails.ts` — Claude call 2: writes personalized outreach email for each of the top 3 using all five answers
- `components/results/EmailPanel.tsx` — right panel component: tab selector for 3 resources, email preview, send button

### Files to Delete

- `lib/matching/vectorSearch.ts` — no longer needed; remove import from `match-resources/route.ts`

### Patterns to Follow

**Inline styles** (entire codebase uses inline styles, no Tailwind classes in these files):
```tsx
style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1rem", color: "#2a5e49" }}
style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", fontSize: "0.875rem" }}
```

**Claude tool-use pattern** (`process-answer/route.ts` lines 9–36):
Use `tool_choice: { type: "tool", name: "..." }` to force structured JSON output. Prefer this over freeform JSON parsing.

**Claude freeform JSON pattern** (`synthesize.ts` lines 62–83):
For more complex shapes, pass structured prompt and use `parseJsonSafely()`. Mirror this in `rankAndDraft.ts`.

**Supabase service-role pattern** (`match-resources/route.ts` lines 17–20):
```ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

**sessionStorage result persistence** (`useVoiceIntake.ts` line 171):
```ts
sessionStorage.setItem("nexis-results", JSON.stringify(matchData));
```
The new `matchData` shape (with `draftEmail`, `emailSubject`, `resourceEmail`) must be stored here so `app/results/page.tsx` can also read them if needed.

**Color constants** (established across codebase):
- Background: `black` / `#000000`
- Border accent: `#2a5e49`
- Text accent: `#2a5e49`
- Muted: `#666666` / `#888`
- Card bg: `#080808`
- Subtle border: `#222`, `#333`, `#111`

---

## IMPLEMENTATION PLAN

### Phase 1: Backend — Replace ranking pipeline (two sequential Claude calls)

Remove OpenAI + vectorSearch. Create `rankResources.ts` (Claude call 1: reads full descriptions, picks top 3) and `draftEmails.ts` (Claude call 2: writes personalized emails for those 3 using all five answers).

### Phase 2: API route update

Update `/api/match-resources` to accept `allAnswers`, fetch full resource records by `filterIds`, call `rankResources` then `draftEmails` sequentially, merge and return.

### Phase 3: Hook update

Update `useVoiceIntake.ts` to send `allAnswers` in the match-resources request.

### Phase 4: EmailPanel component

Create `components/results/EmailPanel.tsx` — tab navigation between 3 resources, email preview, clipboard + mailto send button.

### Phase 5: Page layout transition

Update `app/page.tsx` to render `EmailPanel` instead of `BubbleField` once `matchResults` is set. Update `isFinalPhase` threshold to 3.

### Phase 6: Left panel cleanup

Update `VoiceIntake.tsx` inline results display: 3 cards only, remove "See full results →" link.

---

## STEP-BY-STEP TASKS

### Task 1: DELETE `lib/matching/vectorSearch.ts`

- **REMOVE**: Delete the entire file — it's only imported by `match-resources/route.ts`
- **VALIDATE**: `grep -r "vectorSearch" /path/to/nexis --include="*.ts" --include="*.tsx"` — should return zero results after completing Task 2

---

### Task 2a: CREATE `lib/matching/rankResources.ts`

**Claude call 1** — reads all remaining resource full descriptions + Q5 free-form answer, returns top 3 ranked results with match reasons and a narrative sentence.

- **IMPORTS**: `import Anthropic from "@anthropic-ai/sdk"`
- **EXPORTS**: `rankResources(candidates, freeFormAnswer)` → `RankResult`

- **TYPES**:
```ts
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
  matchReason: string; // "This matches you because..."
  topics: string[];
  link: string;
  resourceEmail: string | null;
}

export interface RankResult {
  narrative: string;
  matches: RankedMatch[];
}
```

- **IMPLEMENT** the candidate list — pass full descriptions, no truncation:
```ts
const candidateList = candidates
  .map((r, i) =>
    `${i + 1}. [ID: ${r.id}]\nTitle: ${r.title}\nDescription: ${r.description ?? "No description"}\nTopics: ${r.topics.join(", ")}`
  )
  .join("\n\n");
```

- **IMPLEMENT** Claude prompt (user message, expect JSON back):
```
You are matching a Utah founder to state business resources.

The founder's specific need (their own words):
"{freeFormAnswer}"

Here are {candidates.length} pre-filtered resources to evaluate:
{candidateList}

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
- Do NOT include resources that are clearly irrelevant to what the founder described
```

- **IMPLEMENT** `parseJsonSafely` helper (mirror from `synthesize.ts`):
```ts
function parseJsonSafely(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}
```

- **IMPLEMENT** result merge — restore `topics`, `link`, `resourceEmail` from original candidate map:
```ts
const candidateMap = new Map(candidates.map(c => [c.id, c]));
const matches: RankedMatch[] = (parsed.matches ?? []).map(m => {
  const orig = candidateMap.get((m as RankedMatch).id);
  return {
    id: (m as RankedMatch).id,
    title: (m as RankedMatch).title,
    matchReason: (m as RankedMatch).matchReason,
    topics: orig?.topics ?? [],
    link: orig?.link ?? "",
    resourceEmail: orig?.email ?? null,
  };
});
```

- **MODEL**: `claude-sonnet-4-6`, `max_tokens: 1024` (ranking only — short output)
- **GOTCHA**: If `candidates.length === 0`, return `{ narrative: "We couldn't find specific matches.", matches: [] }` immediately — skip the Claude call.
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 2b: CREATE `lib/matching/draftEmails.ts`

**Claude call 2** — takes the top 3 ranked resources + all five answer summaries, writes a personalized draft email and subject line for each.

- **IMPORTS**: `import Anthropic from "@anthropic-ai/sdk"`
- **IMPORTS**: `import type { RankedMatch } from "./rankResources"`
- **EXPORTS**: `draftEmails(matches, allAnswers, freeFormAnswer)` → `EmailedResult[]`

- **TYPES**:
```ts
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
```

- **IMPLEMENT** answer context string (Q1–Q4 + Q5):
```ts
const QUESTION_LABELS = [
  "Type of help needed",
  "Industry",
  "Location in Utah",
  "Community identity",
];
const answerContext = allAnswers
  .map(a => `${QUESTION_LABELS[a.questionIndex] ?? `Q${a.questionIndex + 1}`}: ${a.extractedAnswer || "Not specified"}`)
  .join("\n");
```

- **IMPLEMENT** Claude prompt for all 3 emails in one call (batch):
```
You are helping a Utah founder reach out to business resources they've been matched with.

Founder profile (from their voice intake):
{answerContext}
Additional details (their own words): "{freeFormAnswer}"

Write a draft outreach email for each of the following 3 resources. Each email should be professional, warm, and specific — referencing the founder's actual situation and why this resource is relevant to them.

Resources:
1. {matches[0].title} — {matches[0].matchReason}
2. {matches[1].title} — {matches[1].matchReason}
3. {matches[2].title} — {matches[2].matchReason}

Return valid JSON only, no markdown fences:
{
  "emails": [
    {
      "id": "<matches[0].id>",
      "emailSubject": "<concise subject line under 60 chars>",
      "draftEmail": "<full email body, 3-4 short paragraphs>"
    },
    {
      "id": "<matches[1].id>",
      "emailSubject": "...",
      "draftEmail": "..."
    },
    {
      "id": "<matches[2].id>",
      "emailSubject": "...",
      "draftEmail": "..."
    }
  ]
}

Rules for each email:
- Open with who the founder is and what they are building
- Explain why this specific resource is relevant to their situation
- Include a clear call to action (request a meeting, ask about eligibility, etc.)
- Close professionally without a signature name — end with "Thank you," on its own line
- Do NOT use placeholder text like [Your Name] or [Resource Name] — use the actual resource title
- Keep each email under 250 words
```

- **IMPLEMENT** result merge — zip emails back to matched resources:
```ts
const emailMap = new Map((parsed.emails ?? []).map((e: {id: string; emailSubject: string; draftEmail: string}) => [e.id, e]));
return matches.map(m => {
  const email = emailMap.get(m.id);
  return {
    ...m,
    draftEmail: email?.draftEmail ?? "",
    emailSubject: email?.emailSubject ?? `Inquiry about ${m.title}`,
  };
});
```

- **MODEL**: `claude-sonnet-4-6`, `max_tokens: 3072` (3 emails × ~200 words each + JSON overhead)
- **GOTCHA**: If `matches.length === 0`, return `[]` immediately — skip the Claude call.
- **GOTCHA**: Build the resource list in the prompt dynamically — if only 1 or 2 matches exist (small filter pool), adjust the prompt to ask for only that many emails.
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 3: UPDATE `app/api/match-resources/route.ts`

- **REMOVE**: Imports of `vectorSearch` and `synthesize`
- **ADD**: Imports of `rankResources` from `@/lib/matching/rankResources` and `draftEmails` from `@/lib/matching/draftEmails`
- **UPDATE**: Request body type to include `allAnswers`:
```ts
const { sessionId, filterIds, freeFormAnswer, allAnswers } = await req.json() as {
  sessionId: string;
  filterIds: string[];
  freeFormAnswer: string;
  allAnswers: Array<{ questionIndex: number; extractedAnswer: string }>;
};
```

- **UPDATE**: Validation:
```ts
if (!freeFormAnswer || !filterIds?.length) {
  return NextResponse.json({ error: "Missing filterIds or freeFormAnswer" }, { status: 400 });
}
```

- **ADD**: Fetch full resource records (full descriptions, no truncation):
```ts
const { data: resources, error: fetchError } = await supabase
  .from("resources")
  .select("id, title, description, topics, link, email")
  .in("id", filterIds);

if (fetchError || !resources?.length) {
  return NextResponse.json({ error: "Failed to load resources" }, { status: 500 });
}
```

- **IMPORTANT GOTCHA**: `.in("id", filterIds)` can hit PostgREST URL length limits when `filterIds` has 200+ UUIDs. Q1-Q4 filtering typically leaves 30–80 IDs — acceptable. Log a warning if `filterIds.length > 150`.

- **UPDATE**: Two sequential Claude calls — rank first, then draft emails:
```ts
// Call 1: rank the filtered pool by Q5 relevance
const { narrative, matches } = await rankResources(resources, freeFormAnswer);

// Call 2: draft personalized emails for the top 3
const results = await draftEmails(matches, allAnswers ?? [], freeFormAnswer);
```

- **KEEP**: The session `completed` status update at end.
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 4: UPDATE `hooks/useVoiceIntake.ts`

- **LOCATE**: The match-resources fetch call at lines ~160–170
- **UPDATE**: Add `allAnswers` to the request body:
```ts
body: JSON.stringify({
  sessionId: currentSessionId,
  filterIds: currentFilterIds,
  freeFormAnswer: rawTranscript,
  allAnswers: confirmedAnswersRef.current.map(a => ({
    questionIndex: a.questionIndex,
    extractedAnswer: a.extractedAnswer,
  })),
}),
```

- **UPDATE**: The `MatchResult` interface to include new fields:
```ts
interface MatchResult {
  id: string;
  title: string;
  matchReason: string;
  topics: string[];
  link: string;
  resourceEmail: string | null;
  draftEmail: string;
  emailSubject: string;
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 5: CREATE `components/results/EmailPanel.tsx`

This is the right-side panel shown after results arrive. It replaces the BubbleField.

- **IMPLEMENT**: Three-tab selector (one per result). Active tab shows that resource's draft email.
- **IMPLEMENT**: `handleSend` — copies email body to clipboard, then opens mail client:
```ts
const handleSend = async (result: MatchResult) => {
  const body = result.draftEmail;
  const subject = result.emailSubject;
  const to = result.resourceEmail ?? '';

  try {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // clipboard API may be blocked; degrade silently
  }

  const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
  window.open(mailtoUrl, '_blank');
};
```

- **NOTE**: mailto body is capped at 1800 chars to stay within email client limits. The full email is always in clipboard.

- **IMPLEMENT**: Full component structure:
```tsx
"use client";
import { useState } from "react";

interface MatchResult {
  id: string;
  title: string;
  matchReason: string;
  topics: string[];
  link: string;
  resourceEmail: string | null;
  draftEmail: string;
  emailSubject: string;
}

interface EmailPanelProps {
  results: MatchResult[];
}

export function EmailPanel({ results }: EmailPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!results.length) return null;
  const active = results[activeIndex];

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "black",
      borderLeft: "1px solid #111",
    }}>
      {/* Tab row */}
      <div style={{ display: "flex", borderBottom: "1px solid #111" }}>
        {results.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setActiveIndex(i)}
            style={{
              flex: 1,
              padding: "16px 12px",
              background: "none",
              border: "none",
              borderBottom: i === activeIndex ? "2px solid #2a5e49" : "2px solid transparent",
              color: i === activeIndex ? "white" : "#555",
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.8125rem",
              cursor: "pointer",
              textAlign: "center",
              letterSpacing: "0.03em",
              transition: "color 0.2s ease-out",
            }}
          >
            {r.title.length > 28 ? r.title.slice(0, 28) + "…" : r.title}
          </button>
        ))}
      </div>

      {/* Email preview area */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}>
        {/* Subject line */}
        <div>
          <p style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.6875rem",
            color: "#555",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            margin: "0 0 6px",
          }}>Subject</p>
          <p style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.9375rem",
            color: "white",
            margin: 0,
            fontWeight: 500,
          }}>{active.emailSubject}</p>
        </div>

        {/* To line */}
        {active.resourceEmail && (
          <div>
            <p style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.6875rem",
              color: "#555",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              margin: "0 0 6px",
            }}>To</p>
            <p style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.875rem",
              color: "#888",
              margin: 0,
            }}>{active.resourceEmail}</p>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: "1px", backgroundColor: "#1a1a1a" }} />

        {/* Email body */}
        <p style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "1rem",
          color: "#cccccc",
          lineHeight: 1.75,
          margin: 0,
          whiteSpace: "pre-wrap",
        }}>{active.draftEmail}</p>
      </div>

      {/* Send button */}
      <div style={{
        padding: "20px 28px",
        borderTop: "1px solid #111",
        display: "flex",
        gap: "12px",
        alignItems: "center",
      }}>
        <button
          onClick={() => handleSend(active)}
          style={{
            flex: 1,
            padding: "12px 24px",
            border: "1px solid #2a5e49",
            background: "transparent",
            color: "#2a5e49",
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.875rem",
            cursor: "pointer",
            letterSpacing: "0.05em",
            transition: "background 0.2s ease-out, color 0.2s ease-out",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "#2a5e49";
            (e.currentTarget as HTMLElement).style.color = "black";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "#2a5e49";
          }}
        >
          {copied ? "Copied to clipboard ✓" : "Send email →"}
        </button>
        {!active.resourceEmail && (
          <p style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.75rem",
            color: "#555",
            margin: 0,
          }}>No email on file — visit website</p>
        )}
      </div>
    </div>
  );
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 6: UPDATE `app/page.tsx` — right panel transition

- **ADD**: Import `EmailPanel` from `@/components/results/EmailPanel`
- **UPDATE**: Right panel render logic — replace `<BubbleField .../>` with conditional:
```tsx
{/* Right — bubble canvas OR email panel */}
<div style={{ flex: 1, height: "100%", position: "relative" }}>
  {intake.matchResults ? (
    <EmailPanel results={intake.matchResults.results} />
  ) : (
    <BubbleField
      bubbles={bubbles}
      activeCount={activeCount}
      onBubbleEliminated={onBubbleEliminated}
    />
  )}
</div>
```

- **UPDATE**: `isFinalPhase` threshold in `BubbleField.tsx` line 79 from `<= 5` to `<= 3` to match "top 3" approach. This controls which bubbles glow brighter.

- **VALIDATE**: Dev server renders correctly — bubbles show during intake, EmailPanel after results

---

### Task 7: UPDATE `components/intake/VoiceIntake.tsx` — clean left panel results

- **LOCATE**: The "Complete — inline results" block (lines ~186–213)
- **REMOVE**: The `<Link href="/results">See full results →</Link>` at bottom
- **UPDATE**: Narrative text style to be more understated (it's now paired with EmailPanel):
```tsx
{/* Complete — inline results */}
{!micError && state === "complete" && matchResults && (
  <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
    <p style={{
      fontFamily: "var(--font-instrument-serif)",
      fontStyle: "italic",
      fontSize: "1rem",
      color: "#888",
      margin: "0 0 4px",
    }}>
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
  </div>
)}
```

- **NOTE**: `ResourceCard` props are unchanged — `title`, `matchReason`, `topics`, `link`. The new `draftEmail`, `emailSubject`, `resourceEmail` fields are consumed by `EmailPanel` only.
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 8: UPDATE `components/discovery/BubbleField.tsx`

- **UPDATE**: Line 79 — change `isFinalPhase` threshold:
```ts
const isFinalPhase = activeCount <= 3;
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 9: DELETE `lib/matching/synthesize.ts`

- **REMOVE**: Delete the file — it's replaced by `rankResources.ts` + `draftEmails.ts`. Since `app/results/page.tsx` reads from `sessionStorage` only, `synthesize.ts` is no longer called from anywhere.
- **VALIDATE**: `grep -r "synthesize" --include="*.ts" --include="*.tsx" .` — confirm zero imports remain before deleting

---

### Task 10: UPDATE `app/results/page.tsx`

The results page reads from `sessionStorage["nexis-results"]`. The new shape includes extra fields (`draftEmail`, `emailSubject`, `resourceEmail`). The results page currently only uses `title`, `matchReason`, `topics`, and `link` in `ResourceCard` — so it will continue to work without changes to the template.

- **OPTIONAL ENHANCEMENT**: If you want the full results page to also show emails, add `EmailPanel` to the results page too. But this is out of scope for the hackathon — the primary experience is inline on `app/page.tsx`.
- **NO CHANGES REQUIRED** for the basic flow to work.

---

## TESTING STRATEGY

### Manual Validation (Primary)

This is a hackathon project with no test suite. Manual testing is the validation path.

### Edge Cases to Test Manually

1. **Empty filter pool**: If all four Q1-Q4 answers are very specific and leave 0 resources, `match-resources` returns a 400. Make sure the UI handles this gracefully — show "Finding your matches..." forever currently. After this change, handle empty `results` in `VoiceIntake.tsx` inline results (show a fallback message).

2. **No email on resource**: `resourceEmail` is null — EmailPanel shows "No email on file — visit website" note next to send button. The send button still works (opens mail client with empty `to:`).

3. **Clipboard API blocked**: Some browsers block `navigator.clipboard.writeText` in non-HTTPS or sandboxed contexts. Wrap in try/catch (Task 5 already does this). Degradation: email client still opens via mailto, user just doesn't get clipboard copy.

4. **Large filter pool (80+ resources)**: Test that Claude handles the description list without timeout. With 80 resources × 300 char description truncation ≈ 24,000 chars — should complete in ~5–10s. If timeout is a concern, reduce truncation to 150 chars or cap candidates at top 60.

5. **Mobile path**: The mobile layout (`isMobile` check in `app/page.tsx`) renders only `VoiceIntake`. After results, the left panel already shows inline result cards. `EmailPanel` is NOT shown on mobile (acceptable for hackathon). Verify the mobile flow still completes correctly.

---

## VALIDATION COMMANDS

### Level 1: TypeScript

```bash
cd /Users/nicholaslewis/business_projects/hackathon/nexis
npx tsc --noEmit
```

Expected: 0 errors

### Level 2: ESLint

```bash
npm run lint
```

Expected: 0 errors, 0 warnings on new/modified files

### Level 3: Build

```bash
npm run build
```

Expected: Clean build, no missing module errors (especially after deleting vectorSearch.ts)

### Level 4: Manual E2E Flow

1. `npm run dev` — open `http://localhost:3000`
2. Click "Find your resources →" → grant mic or switch to text
3. Answer all 5 questions
4. Verify: bubbles eliminate per answer through Q1-Q4
5. After Q5: left panel shows 3 resource cards with match reasons; right panel shows EmailPanel
6. Click through the 3 tabs — each shows correct resource name and draft email
7. Click "Send email →" — verify clipboard gets email body AND mail client opens
8. Verify send button changes to "Copied to clipboard ✓" for 2 seconds
9. If resource has no email, verify warning text appears next to button

### Level 5: Verify filterIds flow

Add a `console.log("[match-resources] filterIds count:", filterIds.length)` temporarily to the route handler to confirm Q1-Q4 narrowing is working — the count should be meaningfully less than 213.

---

## ACCEPTANCE CRITERIA

- [ ] Vector search / OpenAI embeddings completely removed (no OpenAI import anywhere in runtime code)
- [ ] Q5 match uses only the `filterIds` pool from Q1-Q4 — never all 213 resources
- [ ] Claude returns exactly 3 results (or fewer if pool < 3) with personalized match reasons
- [ ] Each result includes a draft email and subject line specific to that resource
- [ ] Left panel shows 3 ResourceCards after Q5 is answered
- [ ] Right panel transitions from BubbleField to EmailPanel when `matchResults` is set
- [ ] EmailPanel tab navigation works for all 3 resources
- [ ] Send button copies full email to clipboard and opens mail client
- [ ] Copied confirmation state shows for ~2s then resets
- [ ] No TypeScript errors, no ESLint errors, clean build
- [ ] Mobile flow (left-only layout) still works end-to-end

---

## COMPLETION CHECKLIST

- [ ] Task 1: `vectorSearch.ts` deleted
- [ ] Task 2: `rankAndDraft.ts` created and compiles
- [ ] Task 3: `match-resources/route.ts` updated — no vectorSearch/synthesize imports
- [ ] Task 4: `useVoiceIntake.ts` sends `allAnswers` in match request
- [ ] Task 5: `EmailPanel.tsx` created
- [ ] Task 6: `page.tsx` right panel conditional renders EmailPanel
- [ ] Task 7: `VoiceIntake.tsx` left panel cleaned up
- [ ] Task 8: `BubbleField.tsx` isFinalPhase threshold updated to <= 3
- [ ] Task 9: `synthesize.ts` deleted (or confirmed unused)
- [ ] Task 10: `results/page.tsx` confirmed working with new data shape
- [ ] All validation commands pass
- [ ] Manual E2E flow tested

---

## NOTES

### Why two Claude calls instead of one

Separating ranking from email drafting keeps each call focused with a tight system prompt and predictable output shape. The ranking call (`rankResources`) does one thing — read all descriptions and pick the best 3 — and its output is short (`max_tokens: 1024`). The email call (`draftEmails`) then has clean inputs (just the 3 winners + all answers) and doesn't need to reason about the full pool of 80 resources again. This also makes each call independently debuggable.

### Why full descriptions (no truncation)

Truncating descriptions risks losing the exact sentence that makes a resource relevant to a specific founder. A resource for "veteran-owned food businesses in rural Utah" might have that specificity only in its third sentence. Claude reading the full description catches nuance that cosine similarity or keyword matching misses. The full payload (~15,000–22,000 tokens for 80 resources) is well within Claude's 200K context window.

### Email draft quality

`draftEmails` is given all five answer summaries plus the free-form Q5 text and the specific `matchReason` for each resource. Instruct Claude not to use placeholder text — emails should be usable immediately, closing with "Thank you," and leaving the signature area empty for the founder to fill in.

### Fallback for `synthesize.ts` removal

`app/results/page.tsx` reads from `sessionStorage` only — it never calls `synthesize.ts`. The page continues to work with the new data shape as long as `title`, `matchReason`, `topics`, and `link` are present on each result (they are).

### Bubble elimination timing

The bubble elimination animation runs when `matchResults` is set (a `useEffect` in `page.tsx` eliminates non-top-3 bubbles). On the very next render, the right panel switches from `BubbleField` to `EmailPanel`. The timing is: Q5 answer → ~8–12s for both Claude calls → `matchResults` set → bubbles eliminate + EmailPanel appears simultaneously. The overlap is brief and acceptable for a demo.

---

**Confidence Score: 9/10**

The implementation is straightforward given how well the existing patterns are established. The main risk is Claude's response time with a large description payload — mitigated by the 300-char truncation. The email mailto UX relies on browser behavior (clipboard API + mail client detection) which varies — the copy-to-clipboard fallback ensures the email is always accessible.
