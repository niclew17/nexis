# Feature: UI Typography Refresh — Larger Fonts, "Utah's Nexis" Branding

The following plan should be complete, but validate codebase patterns before implementing.

Pay special attention to existing inline-style patterns — all styles are inline (no Tailwind on intake components), and this plan follows that convention throughout.

---

## Feature Description

A focused typography and layout pass on the intake screens and results page to make the UI feel confident and readable. The transcript text (what the user says) becomes the visual hero — large, centered, prominent. Questions step up in size. The brand name becomes "Utah's Nexis" throughout. A one-line tagline is added to the idle screen to orient first-time visitors. No structural or logic changes — pure presentational.

## User Story

As a Utah founder landing on Nexis,
I want clear, large, readable text and a brand name that signals "this is for me",
So that I feel confident and engaged throughout the four-question intake.

## Problem Statement

Current font sizes are conservative (questions at `1.125rem`, transcript at `1.25rem`). On a full-black screen with no chrome, these feel small and thin. The brand name "Nexis" lacks geographic identity. There is no tagline to orient a first-time visitor on the idle screen.

## Solution Statement

Apply a deliberate typographic scale: brand at `3rem`, questions at `1.375rem`, live transcript at `2rem`, instruction text at `1.375rem`, confirmed answers at `1.125rem`. Add "Utah's" as a prefix to every "Nexis" occurrence in the UI. Add a one-line muted tagline on the idle screen. All changes are inline-style edits to existing components.

## Feature Metadata

**Feature Type**: Enhancement  
**Estimated Complexity**: Low  
**Primary Systems Affected**: `components/intake/VoiceIntake.tsx`, `components/intake/QuestionDisplay.tsx`, `components/intake/TranscriptDisplay.tsx`, `components/intake/InstructionSlide.tsx`, `components/intake/ConfirmedAnswer.tsx`, `app/results/page.tsx`  
**Dependencies**: None — inline styles only, no new packages

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `components/intake/VoiceIntake.tsx` (lines 78–107) — Idle state: contains "Nexis" title (`2rem`) and "Find your resources →" button. The title becomes "Utah's Nexis" at `3rem`; a tagline is inserted between title and button.
- `components/intake/VoiceIntake.tsx` (lines 115–174) — Listening state: renders `QuestionDisplay`, `TranscriptDisplay`, `MicIndicator`, confirm/skip links. No structural changes here — sizing is delegated to the child components.
- `components/intake/VoiceIntake.tsx` (lines 177–215) — Processing + Confirmed states: "Processing..." at `1rem`, "Got it" at `0.875rem`. Both step up slightly.
- `components/intake/QuestionDisplay.tsx` (lines 1–19) — Currently `1.125rem` system sans. Increases to `1.375rem`.
- `components/intake/TranscriptDisplay.tsx` (lines 1–31) — Currently `1.25rem` Instrument Serif. Increases to `2rem`. This is the highest-impact change.
- `components/intake/InstructionSlide.tsx` (lines 1–73) — Three lines at `1.125rem` italic. Increase to `1.375rem`. Button stays at `1rem`.
- `components/intake/ConfirmedAnswer.tsx` (lines 1–25) — Currently `1rem` accent color. Increases to `1.125rem`.
- `app/results/page.tsx` (lines 107–117) — Sticky header contains `<Link>Nexis</Link>` at `1.25rem`. Becomes "Utah's Nexis".
- `app/layout.tsx` (lines 10–15) — `metadata.title` = "Nexis — Find Your Utah Business Resources". Update to "Utah's Nexis — Find Your Utah Business Resources".

### New Files to Create

None.

### Relevant Documentation

No external documentation needed — all changes are inline-style edits to known patterns.

---

## Typography Scale (Target)

| Element | Current | Target | Font |
|---|---|---|---|
| Brand name (idle) | `2rem` | `3rem` | Instrument Serif, normal |
| Tagline (idle, new) | — | `0.9375rem` | system sans, #666 |
| Instruction lines | `1.125rem` | `1.375rem` | Instrument Serif, italic |
| Questions | `1.125rem` | `1.375rem` | system sans |
| Live transcript | `1.25rem` | `2rem` | Instrument Serif |
| Confirmed answers | `1rem` | `1.125rem` | Instrument Serif, #2a5e49 |
| "Processing..." text | `1rem` | `1.125rem` | Instrument Serif, italic, #666 |
| "Got it" text | `0.875rem` | `1rem` | Instrument Serif, italic, #666 |
| Results header "Nexis" | `1.25rem` | `1.25rem` (no size change) | Instrument Serif |

### Design Rationale

- **Transcript at `2rem`**: The voice transcript is the emotional center of the experience — the user's words appearing large on screen creates a powerful feedback loop. At `1.25rem` it reads like a caption; at `2rem` it reads like a statement.
- **Questions at `1.375rem`**: The question needs to register immediately. Moving from `1.125rem` to `1.375rem` gives it weight without competing with the transcript.
- **Brand at `3rem`**: A full-screen black canvas with a small `2rem` title undersells the moment. `3rem` (Instrument Serif, normal) reads like a wordmark.
- **Tagline in muted system sans**: Gives context to first-time visitors. "Utah business resources, matched to your story." — concise, below the brand, above the CTA button.
- **Results header stays `1.25rem`**: The sticky header is chrome, not hero content. No size change needed.

---

## IMPLEMENTATION PLAN

### Phase 1: Core component sizes

Update the four intake child components (QuestionDisplay, TranscriptDisplay, InstructionSlide, ConfirmedAnswer).

### Phase 2: VoiceIntake parent

Update the idle state title (name + size + tagline), and the processing/confirmed state micro-texts.

### Phase 3: Results page + metadata

Update "Nexis" → "Utah's Nexis" in the sticky header and in `layout.tsx` metadata title.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

---

### TASK 1 — UPDATE `components/intake/QuestionDisplay.tsx`

**IMPLEMENT**: Change `fontSize: "1.125rem"` to `fontSize: "1.375rem"`.

No other changes. The `fontFamily`, `color`, `textAlign`, `lineHeight`, `margin`, and `transition` all stay the same.

**Result:**
```tsx
<p
  style={{
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    fontSize: "1.375rem",
    color: "white",
    textAlign: "center",
    lineHeight: 1.6,
    margin: "0 0 32px",
    transition: "opacity 200ms ease-out",
  }}
>
  {question}
</p>
```

**VALIDATE**: `npm run lint` — zero errors.

---

### TASK 2 — UPDATE `components/intake/TranscriptDisplay.tsx`

**IMPLEMENT**: Change `fontSize: "1.25rem"` to `fontSize: "2rem"`.

No other changes. `fontFamily`, `textAlign`, `lineHeight`, `margin`, `color` all stay the same. The interim transcript span styling is unchanged.

**Result:**
```tsx
<p
  style={{
    fontFamily: "var(--font-instrument-serif)",
    fontSize: "2rem",
    textAlign: "center",
    lineHeight: 1.7,
    margin: "24px 0",
    color: "white",
  }}
>
  {finalTranscript}
  {interimTranscript && (
    <span style={{ color: "#666666", fontStyle: "italic" }}>
      {finalTranscript ? " " : ""}
      {interimTranscript}
    </span>
  )}
</p>
```

**VALIDATE**: `npm run lint` — zero errors.

---

### TASK 3 — UPDATE `components/intake/InstructionSlide.tsx`

**IMPLEMENT**: Change all three `<p>` elements from `fontSize: "1.125rem"` to `fontSize: "1.375rem"`. The button stays at `fontSize: "1rem"`.

All three `<p>` elements share the same style object shape. Update each one. No structural changes.

**Result (all three `<p>` elements):**
```tsx
style={{
  fontSize: "1.375rem",
  color: "white",
  fontFamily: "var(--font-instrument-serif)",
  fontStyle: "italic",
  margin: 0,
}}
```

**VALIDATE**: `npm run lint` — zero errors.

---

### TASK 4 — UPDATE `components/intake/ConfirmedAnswer.tsx`

**IMPLEMENT**: Change `fontSize: "1rem"` to `fontSize: "1.125rem"`.

No other changes.

**Result:**
```tsx
<p
  style={{
    fontFamily: "var(--font-instrument-serif)",
    fontSize: "1.125rem",
    color: "#2a5e49",
    textAlign: "center",
    margin: "8px 0",
    opacity: 1,
    transition: "opacity 300ms ease-out",
  }}
>
  {answer}
</p>
```

**VALIDATE**: `npm run lint` — zero errors.

---

### TASK 5 — UPDATE `components/intake/VoiceIntake.tsx`

This task has three sub-changes within the same file.

#### 5a — Idle state: brand title + tagline

Locate the idle state block (lines 71–107). The `<p>` with text "Nexis" at `fontSize: "2rem"` becomes:

```tsx
<p
  style={{
    fontFamily: "var(--font-instrument-serif)",
    fontSize: "3rem",
    color: "white",
    margin: 0,
    letterSpacing: "-0.01em",
  }}
>
  Utah&apos;s Nexis
</p>
```

**ADD** a tagline `<p>` immediately after the brand title, before the button:
```tsx
<p
  style={{
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    fontSize: "0.9375rem",
    color: "#666666",
    margin: "0",
    textAlign: "center",
    lineHeight: 1.6,
  }}
>
  Utah business resources, matched to your story.
</p>
```

**GOTCHA**: The `<p>` containing "Nexis" currently uses a React entity escape for the apostrophe in "Nexis". Confirm there is no apostrophe in the original — there isn't. The new text "Utah's Nexis" contains an apostrophe which must be written as `Utah&apos;s Nexis` in JSX (or as a JS string template `{"Utah's Nexis"}`). Use `Utah&apos;s Nexis` to stay consistent with the existing `&apos;` escapes in VoiceIntake (e.g., line 46 in the mic error block).

**GOTCHA**: The idle state `<div>` has `gap: "32px"`. The tagline sits between title and button — the gap applies to all direct children, so no extra margin is needed on the tagline.

#### 5b — Processing state: increase "Processing..." size

Locate the processing state block (lines 177–198). The italic `<p>` currently has `fontSize: "1rem"`. Change to `fontSize: "1.125rem"`.

```tsx
<p
  style={{
    fontFamily: "var(--font-instrument-serif)",
    fontStyle: "italic",
    color: "#666666",
    fontSize: "1.125rem",
    margin: "16px 0",
  }}
>
  Processing...
</p>
```

#### 5c — Confirmed state: increase "Got it" size

Locate the confirmed state block (lines 201–215). The italic `<p>` currently has `fontSize: "0.875rem"`. Change to `fontSize: "1rem"`.

```tsx
<p
  style={{
    fontFamily: "var(--font-instrument-serif)",
    fontStyle: "italic",
    color: "#666666",
    fontSize: "1rem",
    margin: "0 0 8px",
  }}
>
  Got it
</p>
```

**VALIDATE after all 5a–5c**: `npm run lint` — zero errors.

---

### TASK 6 — UPDATE `app/results/page.tsx`

**IMPLEMENT**: Change `Nexis` to `Utah&apos;s Nexis` in the sticky header `<Link>` (lines 107–117).

The `fontSize` stays at `1.25rem` — the header is functional chrome, not a hero element.

```tsx
<Link
  href="/"
  style={{
    fontFamily: "var(--font-instrument-serif)",
    fontSize: "1.25rem",
    color: "white",
    textDecoration: "none",
  }}
>
  Utah&apos;s Nexis
</Link>
```

**VALIDATE**: `npm run lint` — zero errors.

---

### TASK 7 — UPDATE `app/layout.tsx`

**IMPLEMENT**: Change the metadata title from `"Nexis — Find Your Utah Business Resources"` to `"Utah's Nexis — Find Your Utah Business Resources"`.

```ts
export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Utah's Nexis — Find Your Utah Business Resources",
  description:
    "Answer four questions by voice. Get personalized Utah state resources in under two minutes.",
};
```

**GOTCHA**: This is a plain TypeScript string in `export const metadata`, not JSX. Use a regular apostrophe `'` — no entity escaping needed.

**VALIDATE**: `npm run build 2>&1 | head -40` — zero TypeScript errors, metadata visible in browser tab.

---

## TESTING STRATEGY

No automated test framework. Manual browser validation only.

### Manual Test Checklist

1. `npm run dev`
2. Open `http://localhost:3000` — verify:
   - Brand title reads "Utah's Nexis" at `3rem` (large, dominant)
   - Tagline "Utah business resources, matched to your story." visible in muted grey below title
   - "Find your resources →" button unchanged
3. Click "Find your resources →" → InstructionSlide — verify:
   - Three instruction lines are visibly larger than before (approx 22px)
4. Click "Begin" → listening state — verify:
   - Question text is noticeably larger (approx 22px)
   - When speaking: transcript text appears at `2rem` (large, commanding presence)
5. After silence → processing state — verify "Processing..." is slightly larger
6. After processing → confirmed state — verify "Got it" and the confirmed answer text size
7. Complete all 4 questions → `/results` page — verify:
   - Sticky header reads "Utah's Nexis"
   - Browser tab title reads "Utah's Nexis — Find Your Utah Business Resources"

### Edge Cases

- **Long transcript**: At `2rem`, a lengthy spoken answer will wrap across multiple lines. Verify `lineHeight: 1.7` gives comfortable line spacing and the text doesn't overflow the 680px max-width container.
- **Long question text**: Q2 and Q3 are the longest questions. At `1.375rem` with `lineHeight: 1.6`, verify they don't push the mic indicator off screen on a short viewport (iPhone SE height: 667px). If vertical overflow occurs, the existing centering layout handles scroll naturally.
- **Multiple confirmed answers**: With 4 confirmed answers at `1.125rem`, the confirmed answers section at the top of the listening state grows. Verify it doesn't crowd the active question on a short viewport.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
```bash
npm run lint
```

### Level 2: Build check
```bash
npm run build 2>&1 | head -60
```

### Level 3: Manual (see checklist above)
```bash
npm run dev
```

---

## ACCEPTANCE CRITERIA

- [ ] Brand name reads "Utah's Nexis" in idle screen, results header, and browser tab title
- [ ] Tagline "Utah business resources, matched to your story." appears below brand on idle screen in muted grey (#666666) system sans
- [ ] Questions display at `1.375rem`
- [ ] Live transcript displays at `2rem`
- [ ] Instruction slide text displays at `1.375rem`
- [ ] Confirmed answers display at `1.125rem`
- [ ] "Processing..." text is `1.125rem` and "Got it" is `1rem`
- [ ] No regressions in layout on 680px max-width container
- [ ] No regressions on narrow viewport (test at ~375px wide)
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` passes with zero TypeScript errors

---

## COMPLETION CHECKLIST

- [ ] Tasks 1–7 completed in order
- [ ] `npm run lint` passes after each task
- [ ] `npm run build` passes at end
- [ ] Manual checklist items verified
- [ ] All acceptance criteria met

---

## NOTES

**Why `2rem` and not `1.75rem` or `2.5rem` for the transcript?**
At `1.75rem` it still reads like a subheading. At `2.5rem` it risks overflow on narrow phones (iPhone SE). `2rem` (32px) is the sweet spot — reads like a display statement, comfortably within 680px on wrap.

**Why add a tagline to the idle screen?**
"Find your resources →" as a CTA makes sense only if you know what Nexis is. A single muted line of context gives the visitor enough to commit to clicking without cluttering the minimal aesthetic.

**No changes to the results `ResourceCard`**: The card title is at `1.25rem` (font-weight 600), matchReason at `1rem`, topics at `0.75rem`. These are appropriate for a card layout with multiple items stacked. Out of scope for this pass.

**No changes to `MicIndicator`**: The pulsing 12px green dot is a signal element, not a content element. Size stays as-is.

**Confidence Score**: 10/10 — pure inline-style changes to isolated components, no logic dependencies, no new packages, every change is directly traceable to a file and line.
