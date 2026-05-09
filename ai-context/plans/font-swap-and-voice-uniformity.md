# Feature: font-swap-and-voice-uniformity

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

A two-part UI consistency pass.

**Part 1 — Font swap.** Today the app uses Instrument Serif (`var(--font-instrument-serif)`) for almost every prominent piece of text — section headings, instruction copy, modal descriptions, results narrative, drafted email bodies, error messages. On a black background, that font reads as an aesthetic statement, not a clear sentence. Swap **everything** that is not (a) the **Nexis logo / "Utah's Nexis" wordmark** or (b) **the user's spoken/typed answer text** to the system sans (`ui-sans-serif, system-ui, -apple-system`) for readability. Where the current style adds `fontStyle: "italic"` on a serif-only-italic phrase ("Got it.", "Processing…", "No results found."), drop the italic when switching to sans — italic on system sans reads as emphasis and degrades the very readability the swap is meant to improve.

**Part 2 — Voice UI uniformity.** The voice control on `/resources` (intake) and on `/map` (filter) currently look completely unrelated. The intake shows a 12 px green dot beneath a 2 rem transcript; the map shows a 52 px circular mic button with a 5-bar audio meter and a glowing accent border. Same hook (`useDeepgram`), totally different visuals. Extract a shared `MicVisual` component (52 px round button, animated 5-bar meter, microphone SVG, accent-border glow on listening) and use it on both pages. The intake variant is non-interactive (listening auto-starts per question — clicks do nothing); the map variant retains its existing click-to-toggle behavior.

No functional changes to voice capture, no changes to the matching pipeline, no changes to API routes or hooks (`useDeepgram`, `useVoiceIntake`). Pure visual / typographic.

## User Story

As a Utah founder reading Nexis on a black background
I want body copy, headings, and status messages to render in a clear sans-serif while only my own words and the Nexis brand stay in the serif display face
So that I can scan the page quickly without fighting the font, and the brand mark feels like a deliberate accent instead of background noise

As the same founder switching between `/resources` and `/map`
I want the voice control to look like the same control on both pages
So that I recognize what to do (and what's happening) without re-learning a new visual every time the speaking experience appears

## Problem Statement

- Instrument Serif is currently applied to ~36 distinct text elements across the codebase — including section h1s ("Sign in", "Add your startup"), modal bodies, the drafted email body, the results narrative, error states, and admin-form headings. None of those are brand or quoted-speech moments; they are body content. Reading speed and contrast suffer.
- The voice control on `/resources` (the `MicIndicator` 12 px pulsing dot) and on `/map` (the `VoiceFilterButton` 52 px circle with audio bars and glow) share zero visual DNA, despite using the same Deepgram pipeline. A user encountering both within the same session has to relearn what "listening" looks like.

## Solution Statement

- Walk every `var(--font-instrument-serif)` usage in `app/` and `components/` and reclassify each one. Anything that is **not** the Nexis wordmark or the user's transcript/typed answer flips to `ui-sans-serif, system-ui, -apple-system`. Where the existing style sets `fontStyle: "italic"` on text being switched to sans, remove the italic so the result reads as plain body copy.
- Create `components/voice/MicVisual.tsx` — a single component that renders the mic chrome (52 px round button + accent border + glow + animated 5-bar audio meter when `isListening`). Accept an optional `onClick` to support both the interactive (map) and passive (intake) call sites. Replace `components/intake/MicIndicator.tsx`'s body with `<MicVisual passive isListening={…} />`. Refactor `components/map/VoiceFilterButton.tsx` to delegate the button + meter to `<MicVisual onClick={…} isListening={…} />` while keeping its existing speech-bubble transcript overlay and click handler logic.

## Feature Metadata

**Feature Type**: Enhancement (UI / readability + cross-page consistency)
**Estimated Complexity**: Low–Medium (low per-file change, but ~25 files touched for the font swap; the voice unification adds one shared component and refactors two existing ones)
**Primary Systems Affected**:
- All files under `app/` and `components/` that reference `var(--font-instrument-serif)` (see exhaustive list in CONTEXT REFERENCES)
- New: `components/voice/MicVisual.tsx`
- Refactored: `components/intake/MicIndicator.tsx`, `components/map/VoiceFilterButton.tsx`
**Dependencies**: None — uses existing `framer-motion`, `COLORS` from `@/lib/map/mapConfig`, no new packages.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

**The two reference fonts (already wired up):**
- `app/layout.tsx` (lines 17–19) — Defines `--font-instrument-serif` via `next/font/google`. **No changes here.** The CSS variable stays available for the elements we're keeping in serif (logo + transcripts).
- The system sans is used inline as `"ui-sans-serif, system-ui, -apple-system"` everywhere — there is no `--font-sans` CSS variable in this project. Do not invent one. Match the exact string literal already in use.

**Voice components (Part 2 — unification):**
- `components/intake/MicIndicator.tsx` (entire file, 16 lines) — Current intake mic. A 12 px green pulsing dot. Animation lives in `app/globals.css` as `mic-pulse` keyframes. Will be reduced to a thin wrapper around `MicVisual`.
- `components/map/VoiceFilterButton.tsx` (lines 91–214) — Current map mic. A 52 px round button (`width: 52, height: 52, borderRadius: 50%, border: 2px solid …`), framer-motion 5-bar audio meter (lines 138–172), microphone SVG (lines 198–212), glow `boxShadow` on listening (lines 191–195). The structural source for the new shared component.
- `hooks/useDeepgram.ts` — The Deepgram hook used by both pages. **Do not modify.** The new `MicVisual` doesn't touch listening state — it renders chrome from props.
- `lib/map/mapConfig.ts` (lines 42–54) — The `COLORS` palette. `accent` (#2a5e49), `accentBright` (#3a7a60), `accentDim` (rgba(42,94,73,0.3)), `borderAccent` (rgba(42,94,73,0.4)). The new `MicVisual` should import from here.
- `app/globals.css` — Confirm whether `mic-pulse` is still referenced after `MicIndicator` is rewritten. If nothing else uses it, remove the keyframes (search with `grep -rn "mic-pulse"` — see Task 12).

**Speaking-text components (Part 1 — KEEP serif):**
- `components/intake/TranscriptDisplay.tsx` (line 14) — Live transcript while user is speaking. **Keep `var(--font-instrument-serif)`.** This is "the user's words appearing on screen", per `ai-context/CLAUDE.md` design principles.
- `components/intake/ConfirmedAnswer.tsx` (line 13) — User's confirmed spoken answer. **Keep serif.**
- `components/intake/VoiceIntake.tsx` (line 137) — The text-mode `<textarea>` used as a fallback when the mic is denied. The user is typing their own answer here, so this is "speaking text" by category. **Keep serif.**
- `components/map/VoiceFilterButton.tsx` (line 126) — The speech bubble that shows live transcript / placeholder ("What companies do you want to see?" / `transcript`). **Keep serif** — same justification.

**Logo / wordmark elements (Part 1 — KEEP serif):**
- `app/page.tsx` (line 175) — Home page Nexis wordmark.
- `components/intake/VoiceIntake.tsx` (line 82) — "Utah's Nexis" idle-state hero on the intake page. Functions as the page's wordmark, not body copy.
- `app/resources/page.tsx` (line 120) — Sidebar Nexis wordmark (post-`wordmark-and-readability-pass.md`).
- `components/map/MapSidebar.tsx` (line 56) — Map sidebar Nexis wordmark.
- `app/results/page.tsx` (line 110) — "Utah's Nexis" sticky-header wordmark.
- `app/protected/layout.tsx` (line 24) — Protected nav Nexis wordmark.
- `components/login-form.tsx` (line 89) — Login top wordmark.
- `components/map/create/CreateLayout.tsx` (line 41) — Create flow top wordmark.

**Everything else with `var(--font-instrument-serif)` — SWITCH to sans (Part 1):**

For each file below, the listed line is currently `fontFamily: "var(--font-instrument-serif)"`. Change it to `fontFamily: "ui-sans-serif, system-ui, -apple-system"` (use the exact string already used elsewhere in the project) and, where flagged, also drop `fontStyle: "italic"`.

| File | Line(s) | Element | Drop italic? |
|---|---|---|---|
| `app/page.tsx` | 60 | FeatureCard heading ("Find your match." / "Explore the map.") | n/a (no italic) |
| `app/admin/resources/[token]/page.tsx` | 25 | h1 "Add a resource" | n/a |
| `app/admin/resources/[token]/AddResourceClient.tsx` | 15 | h2 "Resource added" | n/a |
| `app/results/page.tsx` | 69 | "No results found." empty state | **Yes** — line 71 has `fontStyle: "italic"` |
| `components/login-form.tsx` | 119 | h1 "Sign in" | n/a |
| `components/discovery/BubbleCounter.tsx` | 31 | Bubble counter number | n/a |
| `components/discovery/ResourcePopup.tsx` | 86 | Modal description body | n/a |
| `components/intake/InstructionSlide.tsx` | 25, 36, 47 | Three instruction lines | **Yes** — each block has `fontStyle: "italic"` (lines 26, 37, 48) |
| `components/intake/VoiceIntake.tsx` | 45 | "Microphone access is required." error | **Yes** (line 45 inline) |
| `components/intake/VoiceIntake.tsx` | 164 | "Processing..." | **Yes** (inline) |
| `components/intake/VoiceIntake.tsx` | 173 | "Got it" | **Yes** (inline) |
| `components/intake/VoiceIntake.tsx` | 214 | "Finding your matches" loader | **Yes** (lines 214–219 — the parent `motion.p` has `fontStyle: italic` at line 216) |
| `components/intake/VoiceIntake.tsx` | 255 | Match results narrative | **Yes** (inline) |
| `components/results/ResourceCard.tsx` | 36 | Match reason | n/a |
| `components/results/EmailPanel.tsx` | 168 | Drafted email body | n/a |
| `components/results/ResultsNarrative.tsx` | 7 | Top results narrative | **Yes** — line 8 sets `fontStyle: "italic"` |
| `components/map/InfoPanel.tsx` | 207 | Startup description | n/a |
| `components/map/MapSidebar.tsx` | 84 | "Utah's startup map" h1 | n/a |
| `components/map/create/DuplicateDomainNotice.tsx` | 26 | h1 "Already on the map" | n/a |
| `components/map/create/CreateStartupClient.tsx` | 93 | h1 "Listing created" | n/a |
| `components/map/create/CreateDetailsStep.tsx` | 107 | h1 "Tell us about your company" | n/a |
| `components/map/create/CreateAuthStep.tsx` | 45 | h1 "Add your startup" | n/a |
| `components/map/create/CreateOtpStep.tsx` | 36 | h1 "Check your email" | n/a |
| `components/map/claim/ClaimSuccess.tsx` | 16 | "You now own {startupName}" | n/a |

Total: **24 files** for the font swap (some of which have multiple line updates, e.g., `VoiceIntake.tsx` and `InstructionSlide.tsx`).

### New Files to Create

- `components/voice/MicVisual.tsx` — Shared mic visualization (52 px round button + 5-bar audio meter + accent glow when listening). Two variants: `interactive` (renders a `<button>`, accepts `onClick` and `aria-label`) vs `passive` (renders a `<div>` with no click target). Default `interactive`.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- `ai-context/CLAUDE.md` — Design system section:
  - **Typography:** "Instrument Serif — live transcript (italic) and confirmed answer (regular). System sans — question text, labels, buttons. No import needed." This sentence already encodes the rule we're enforcing. The font swap brings the codebase back into compliance with the documented design system.
  - **Colors:** `#2a5e49` is used only as a foreground signal. The `MicVisual` glow uses `accent` and `accentBright` as foreground border/glow on a transparent or `accentDim` fill — already compliant.
- `ai-context/PRD.md` (Section 7 — "Design System") — confirms Instrument Serif is reserved for "live transcript (italic) and confirmed answer (regular)".
- `ai-context/plans/wordmark-and-readability-pass.md` — Sibling plan that has already been executed. The line numbers and styles in the post-execution state are reflected in this plan.

### Patterns to Follow

**Font swap pattern (sans + drop italic):**

```tsx
// BEFORE — components/intake/InstructionSlide.tsx:21-31
<p
  style={{
    fontSize: "1.375rem",
    color: "white",
    fontFamily: "var(--font-instrument-serif)",
    fontStyle: "italic",
    margin: 0,
  }}
>
  Speak your answers naturally.
</p>

// AFTER
<p
  style={{
    fontSize: "1.375rem",
    color: "white",
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    margin: 0,
  }}
>
  Speak your answers naturally.
</p>
```

**Font swap pattern (sans, no italic to drop):**

```tsx
// BEFORE — components/results/ResourceCard.tsx:34-44
<p
  style={{
    fontFamily: "var(--font-instrument-serif)",
    fontSize: "1.125rem",
    color: "#e5e5e5",
    margin: 0,
    lineHeight: 1.5,
  }}
>
  {matchReason}
</p>

// AFTER
<p
  style={{
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    fontSize: "1.125rem",
    color: "#e5e5e5",
    margin: 0,
    lineHeight: 1.5,
  }}
>
  {matchReason}
</p>
```

**MicVisual structure (new shared component):**

```tsx
// components/voice/MicVisual.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { COLORS } from "@/lib/map/mapConfig";

interface MicVisualProps {
  isListening: boolean;
  /** When true, renders a button with an onClick handler. When false, renders
   *  a non-interactive div — used by the intake flow where listening starts
   *  automatically per question. */
  interactive?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export function MicVisual({
  isListening,
  interactive = true,
  onClick,
  ariaLabel,
}: MicVisualProps) {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  };

  const buttonStyle: React.CSSProperties = {
    width: 52,
    height: 52,
    borderRadius: "50%",
    border: `2px solid ${isListening ? COLORS.accentBright : COLORS.accent}`,
    backgroundColor: isListening ? COLORS.accentDim : "rgba(0,0,0,0.8)",
    backdropFilter: "blur(8px)",
    cursor: interactive ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease-out",
    boxShadow: isListening
      ? `0 0 20px ${COLORS.accentDim}, 0 0 6px ${COLORS.accent}`
      : `0 0 8px ${COLORS.accentDim}`,
    padding: 0,
  };

  const icon = (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={isListening ? COLORS.accentBright : COLORS.accent}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );

  return (
    <div style={containerStyle}>
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: "flex",
              gap: "4px",
              alignItems: "center",
              height: "20px",
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                animate={{ scaleY: [0.4, 1.5, 0.4], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 0.7,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: "easeInOut",
                }}
                style={{
                  width: 3,
                  height: 20,
                  backgroundColor: COLORS.accent,
                  borderRadius: 2,
                  transformOrigin: "center",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {interactive ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={ariaLabel}
          style={buttonStyle}
        >
          {icon}
        </button>
      ) : (
        <div style={buttonStyle} aria-label={ariaLabel}>
          {icon}
        </div>
      )}
    </div>
  );
}
```

**Note:** The map's `VoiceFilterButton` ties listening state to its hook (`isConnected` from `useDeepgram` controls whether bars show). After refactor, the map will pass `isListening={isConnected}` (which mirrors the prior `isConnected && (…)` gate). Confirm by reading `VoiceFilterButton.tsx:138-172` — `isConnected` is what currently gates the bars. The intake will pass `isListening` from the `useVoiceIntake` hook.

---

## IMPLEMENTATION PLAN

### Phase 1: Font swap

Mechanical, file-by-file: replace `fontFamily: "var(--font-instrument-serif)"` with `fontFamily: "ui-sans-serif, system-ui, -apple-system"` on each line in the table above, and drop `fontStyle: "italic"` only where the table flags it. Preserve every other style property (`fontSize`, `color`, `margin`, `lineHeight`, etc.) verbatim.

### Phase 2: Shared MicVisual component

- Create `components/voice/` folder.
- Create `components/voice/MicVisual.tsx` per the pattern above.

### Phase 3: Wire MicVisual into both call sites

- Replace the body of `components/intake/MicIndicator.tsx` so it returns `<MicVisual interactive={false} isListening={isListening} />`. Preserve the prop signature `{ isListening: boolean }`.
- Refactor `components/map/VoiceFilterButton.tsx` to delegate the audio bars + button to `<MicVisual />` while keeping its existing speech-bubble overlay (`voicePromptVisible`) and click handler (`handleMicClick`).

### Phase 4: Cleanup

- If nothing else references `mic-pulse`, remove the keyframes from `app/globals.css`.
- Run `npm run lint` and `npm run build`.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: UPDATE `app/page.tsx` — swap FeatureCard heading font

- **IMPLEMENT**: On line 60 inside the `FeatureCard` component's `<h2>` style, replace `fontFamily: "var(--font-instrument-serif)"` with `fontFamily: "ui-sans-serif, system-ui, -apple-system"`. **Do not change** line 175 (the home page Nexis wordmark — keep serif).
- **PATTERN**: See "Font swap pattern (sans, no italic to drop)".
- **IMPORTS**: No new imports.
- **GOTCHA**: There are two `var(--font-instrument-serif)` matches in this file (lines 60 and 175). Only line 60 changes.
- **VALIDATE**: `grep -n "instrument-serif" app/page.tsx` should return exactly one match (line 175).

### Task 2: UPDATE `app/admin/resources/[token]/page.tsx` — swap "Add a resource" h1

- **IMPLEMENT**: On line 25, replace `fontFamily: "var(--font-instrument-serif)"` with the sans string.
- **PATTERN**: Same.
- **IMPORTS**: None.
- **GOTCHA**: The h1 sits inside `<CreateLayout>`, which still renders a serif "Nexis" wordmark above it (CreateLayout line 41 stays serif). Verify the visual hierarchy still reads cleanly.
- **VALIDATE**: `grep -n "instrument-serif" app/admin/resources/\[token\]/page.tsx` returns nothing.

### Task 3: UPDATE `app/admin/resources/[token]/AddResourceClient.tsx` — swap "Resource added" h2

- **IMPLEMENT**: On line 15, swap fontFamily.
- **VALIDATE**: `grep -n "instrument-serif" app/admin/resources/\[token\]/AddResourceClient.tsx` returns nothing.

### Task 4: UPDATE `app/results/page.tsx` — swap "No results found" + drop italic

- **IMPLEMENT**:
  - Line 69: swap fontFamily to sans.
  - Line 71: remove the `fontStyle: "italic"` property entirely (and its trailing comma — clean removal, no orphaned comma).
  - **Do not change** line 110 — that's the "Utah's Nexis" sticky-header wordmark, keep serif.
- **GOTCHA**: There are two `var(--font-instrument-serif)` matches here. Only line 69 changes.
- **VALIDATE**: `grep -n "instrument-serif" app/results/page.tsx` returns one match (line 110).

### Task 5: UPDATE `components/login-form.tsx` — swap "Sign in" h1

- **IMPLEMENT**: Line 119: swap fontFamily. **Do not change** line 89 (the top Nexis wordmark — keep serif).
- **VALIDATE**: `grep -n "instrument-serif" components/login-form.tsx` returns one match (line 89).

### Task 6: UPDATE `components/discovery/BubbleCounter.tsx` — swap counter number

- **IMPLEMENT**: Line 31: swap fontFamily. The counter number is body content, not a logo.
- **GOTCHA**: The `motion.span` keeps its `key={count}` and `framer-motion` animation. Only `fontFamily` changes.
- **VALIDATE**: `grep -n "instrument-serif" components/discovery/BubbleCounter.tsx` returns nothing.

### Task 7: UPDATE `components/discovery/ResourcePopup.tsx` — swap modal description

- **IMPLEMENT**: Line 86: swap fontFamily.
- **VALIDATE**: `grep -n "instrument-serif" components/discovery/ResourcePopup.tsx` returns nothing.

### Task 8: UPDATE `components/intake/InstructionSlide.tsx` — swap three instruction lines + drop italic

- **IMPLEMENT**: For each of the three `<p>` blocks (lines 21–31, 32–42, 43–53):
  - Replace `fontFamily: "var(--font-instrument-serif)"` with the sans string.
  - Remove `fontStyle: "italic"` and its trailing comma.
- **GOTCHA**: The "Begin" button at line 64 already uses sans — leave it untouched.
- **VALIDATE**: `grep -n "instrument-serif\|italic" components/intake/InstructionSlide.tsx` returns nothing.

### Task 9: UPDATE `components/intake/VoiceIntake.tsx` — swap five status messages, keep two serif elements

- **IMPLEMENT**: This file has multiple `var(--font-instrument-serif)` references. Apply this exact split:
  - **Line 45** (mic-error message "Microphone access is required."): swap to sans, drop `fontStyle: "italic"`.
  - **Line 82** ("Utah's Nexis" idle hero): **KEEP serif** — this is the wordmark.
  - **Line 137** (text-mode `<textarea>`): **KEEP serif** — this is the user typing their own answer.
  - **Line 164** ("Processing..."): swap to sans, drop italic.
  - **Line 173** ("Got it"): swap to sans, drop italic.
  - **Line 214** ("Finding your matches" `motion.p`): swap to sans, drop `fontStyle: "italic"` on line 216.
  - **Line 255** (matchResults narrative `<p>`): swap to sans, drop italic.
- **GOTCHA**:
  - Inline-style p tags here pack many props on one line — be careful to remove only `fontStyle: "italic",` without breaking the surrounding properties.
  - Line 137's textarea uses Instrument Serif intentionally — that's the user's typed input, the keyboard equivalent of speaking. Do not change.
- **VALIDATE**: `grep -n "instrument-serif" components/intake/VoiceIntake.tsx` returns exactly two matches (lines 82 and 137).

### Task 10: UPDATE `components/results/ResourceCard.tsx` — swap match reason font

- **IMPLEMENT**: Line 36: swap fontFamily to sans. Match reason is body copy, not the user's words.
- **VALIDATE**: `grep -n "instrument-serif" components/results/ResourceCard.tsx` returns nothing.

### Task 11: UPDATE `components/results/EmailPanel.tsx` — swap drafted email body font

- **IMPLEMENT**: Line 168: swap fontFamily to sans. Email body is generated content, not user speech.
- **GOTCHA**: Keep the `whiteSpace: "pre-wrap"` and `lineHeight: 1.75` — those are content properties unrelated to the font swap.
- **VALIDATE**: `grep -n "instrument-serif" components/results/EmailPanel.tsx` returns nothing.

### Task 12: UPDATE `components/results/ResultsNarrative.tsx` — swap narrative + drop italic

- **IMPLEMENT**:
  - Line 7: swap fontFamily to sans.
  - Line 8: remove `fontStyle: "italic"` and its trailing comma.
- **VALIDATE**: `grep -n "instrument-serif\|italic" components/results/ResultsNarrative.tsx` returns nothing.

### Task 13: UPDATE `components/map/InfoPanel.tsx` — swap startup description font

- **IMPLEMENT**: Line 207: swap fontFamily to sans.
- **VALIDATE**: `grep -n "instrument-serif" components/map/InfoPanel.tsx` returns nothing.

### Task 14: UPDATE `components/map/MapSidebar.tsx` — swap "Utah's startup map" headline only

- **IMPLEMENT**: Line 84: swap fontFamily to sans. **Do not change** line 56 (the Nexis sidebar wordmark — keep serif).
- **VALIDATE**: `grep -n "instrument-serif" components/map/MapSidebar.tsx` returns exactly one match (line 56).

### Task 15: UPDATE `components/map/create/DuplicateDomainNotice.tsx` — swap "Already on the map" h1

- **IMPLEMENT**: Line 26: swap fontFamily to sans.
- **VALIDATE**: `grep -n "instrument-serif" components/map/create/DuplicateDomainNotice.tsx` returns nothing.

### Task 16: UPDATE `components/map/create/CreateStartupClient.tsx` — swap "Listing created" h1

- **IMPLEMENT**: Line 93: swap fontFamily to sans.
- **VALIDATE**: `grep -n "instrument-serif" components/map/create/CreateStartupClient.tsx` returns nothing.

### Task 17: UPDATE `components/map/create/CreateDetailsStep.tsx` — swap "Tell us about your company" h1

- **IMPLEMENT**: Line 107: swap fontFamily to sans.
- **VALIDATE**: `grep -n "instrument-serif" components/map/create/CreateDetailsStep.tsx` returns nothing.

### Task 18: UPDATE `components/map/create/CreateAuthStep.tsx` — swap "Add your startup" h1

- **IMPLEMENT**: Line 45: swap fontFamily to sans.
- **VALIDATE**: `grep -n "instrument-serif" components/map/create/CreateAuthStep.tsx` returns nothing.

### Task 19: UPDATE `components/map/create/CreateOtpStep.tsx` — swap "Check your email" h1

- **IMPLEMENT**: Line 36: swap fontFamily to sans.
- **VALIDATE**: `grep -n "instrument-serif" components/map/create/CreateOtpStep.tsx` returns nothing.

### Task 20: UPDATE `components/map/claim/ClaimSuccess.tsx` — swap claim success line

- **IMPLEMENT**: Line 16: swap fontFamily to sans.
- **VALIDATE**: `grep -n "instrument-serif" components/map/claim/ClaimSuccess.tsx` returns nothing.

### Task 21: VERIFY font-swap completeness

- **IMPLEMENT**: Run `grep -rn "instrument-serif" app/ components/` and review the full output.
- **EXPECTED OUTPUT**: Exactly the following matches (the keepers):
  - `app/layout.tsx:18` — variable definition
  - `app/page.tsx:175` — home wordmark
  - `app/results/page.tsx:110` — results header wordmark
  - `app/protected/layout.tsx:24` — protected nav wordmark
  - `app/resources/page.tsx:120` — resources sidebar wordmark
  - `components/login-form.tsx:89` — login top wordmark
  - `components/map/MapSidebar.tsx:56` — map sidebar wordmark
  - `components/map/create/CreateLayout.tsx:41` — create layout wordmark
  - `components/intake/VoiceIntake.tsx:82` — "Utah's Nexis" idle hero
  - `components/intake/VoiceIntake.tsx:137` — text-mode textarea
  - `components/intake/TranscriptDisplay.tsx:14` — live transcript
  - `components/intake/ConfirmedAnswer.tsx:13` — confirmed answer
  - `components/map/VoiceFilterButton.tsx:126` — speech bubble (still in pre-refactor file; will remain after Task 23 — see note in that task)
- **GOTCHA**: If any other match shows up, you missed a swap above.
- **VALIDATE**: `grep -rn "instrument-serif" app/ components/ | wc -l` should be 13 (or 12 if you've already started Task 23 and the speech-bubble line moved).

### Task 22: CREATE `components/voice/MicVisual.tsx` — shared mic visualization

- **IMPLEMENT**: Create the new folder `components/voice/`. Inside it, create `MicVisual.tsx` per the pattern shown in CONTEXT REFERENCES → "MicVisual structure". The full file body is given there — copy it verbatim.
- **PATTERN**: See "MicVisual structure" pattern above.
- **IMPORTS**: `motion`, `AnimatePresence` from `framer-motion`; `COLORS` from `@/lib/map/mapConfig`.
- **GOTCHA**:
  - Use `interactive` (not `passive`) as the boolean prop with `interactive = true` default. This matches more common React conventions ("opt out of clickability" feels more deliberate than "opt in to passivity"). The intake call site will pass `interactive={false}`.
  - The `aria-label` is required when `interactive` is true (it becomes a button) — pass it through. When `interactive` is false, the prop is optional but still useful for screen readers on the inert `<div>`.
  - The `<button>` includes `type="button"` to avoid accidental form submission if a parent ever wraps it in a `<form>` (the intake doesn't, but defense-in-depth costs nothing).
- **VALIDATE**: `npm run lint` should pass; `ls components/voice/` should show `MicVisual.tsx`.

### Task 23: UPDATE `components/map/VoiceFilterButton.tsx` — delegate button + meter to MicVisual

- **IMPLEMENT**: Replace the inner JSX block (current lines 138–212 — the `AnimatePresence` for the bars + the `<button>` for the mic) with a single `<MicVisual interactive isListening={isConnected} onClick={handleMicClick} ariaLabel={isListening ? "Stop listening" : "Filter by voice"} />`. Keep:
  - The component's prop signature (`variant?: "floating" | "inline"`).
  - The Deepgram hook usage (`useDeepgram(handleSilence)`).
  - The transcript ref pattern (lines 27–29).
  - The `handleSilence` and `handleMicClick` callbacks.
  - The outer `containerStyle` (floating vs inline positioning).
  - The speech bubble (`voicePromptVisible` block, lines 113–136). **Keep it serif** — the speech bubble is the user's transcript display.
- **PATTERN**: After this edit the file should look roughly:
  ```tsx
  return (
    <div style={containerStyle}>
      <AnimatePresence>
        {voicePromptVisible && (
          <motion.div ...>
            {transcript || "What companies do you want to see?"}
          </motion.div>
        )}
      </AnimatePresence>
      <MicVisual
        interactive
        isListening={isConnected}
        onClick={handleMicClick}
        ariaLabel={isListening ? "Stop listening" : "Filter by voice"}
      />
    </div>
  );
  ```
- **IMPORTS**: Remove unused — after the refactor, the `<button>`-related styles and the bars `<motion.div>` JSX go away. **Keep `motion` and `AnimatePresence` imports** — the speech bubble still uses them.
- **GOTCHA**:
  - The semantic distinction between `isConnected` (Deepgram socket open) and `isListening` (UI flag) is preserved upstream. The bars have always been gated by `isConnected`, so passing that to `MicVisual.isListening` keeps the behavior. Do not pass the Zustand `isListening` instead — that would change when bars appear.
  - The `<button>`'s `aria-label` toggles between "Stop listening" and "Filter by voice" based on `isListening` (the Zustand flag) — preserve that derived label.
- **VALIDATE**: `npm run lint`; visit `/map`, click the mic, confirm bars animate and glow appears identically to before.

### Task 24: UPDATE `components/intake/MicIndicator.tsx` — replace dot with MicVisual

- **IMPLEMENT**: Rewrite the component body. New version:
  ```tsx
  "use client";
  import { MicVisual } from "@/components/voice/MicVisual";

  export function MicIndicator({ isListening }: { isListening: boolean }) {
    if (!isListening) return null;
    return <MicVisual interactive={false} isListening={isListening} ariaLabel="Listening" />;
  }
  ```
- **GOTCHA**:
  - Preserve the early-return `if (!isListening) return null;` — the intake conditionally hides the indicator when not listening, which `MicVisual` does not do on its own (it would render the chrome with bars hidden).
  - Actually — `MicVisual` already hides the bars when not listening (via the `AnimatePresence`), but the button itself stays visible. For the intake's current behavior we want the whole thing to disappear when not listening, hence the early return.
  - The prop signature `{ isListening: boolean }` stays the same — `VoiceIntake.tsx:111` already passes this prop, no upstream changes needed.
- **VALIDATE**: `npm run lint`; complete an intake on `/resources` and verify the mic indicator now looks like the map's voice button (52 px circle, audio bars when listening) instead of a 12 px dot.

### Task 25: REMOVE unused `mic-pulse` keyframes (if applicable)

- **IMPLEMENT**: Run `grep -rn "mic-pulse" app/ components/`. If the only match is the keyframes definition in `app/globals.css`, remove the `@keyframes mic-pulse { ... }` block from that CSS file. If anything else references it, leave it alone.
- **GOTCHA**: Do not preemptively delete other CSS — only the `mic-pulse` keyframes go.
- **VALIDATE**: `grep -rn "mic-pulse" app/ components/` returns nothing after the cleanup.

### Task 26: VALIDATE the build

- **IMPLEMENT**: Run `npm run lint && npm run build` from project root.
- **VALIDATE**: Both exit 0.

---

## TESTING STRATEGY

This codebase has no test framework configured. Validation is manual + lint + build.

### Unit Tests

Not applicable.

### Integration Tests

Not applicable.

### Edge Cases

Manually verify these scenarios in a browser:

1. **`/resources` initial load (idle state)** — The "Utah's Nexis" idle hero should remain in Instrument Serif. The "Find your resources →" button should remain in sans (it already was).
2. **`/resources` instructions slide** — The three instruction lines should now be sans, no italic. The "Begin" button stays sans.
3. **`/resources` listening state** — The mic indicator should now show the 52 px circle + 5-bar audio meter (no longer the 12 px dot). The live transcript above stays Instrument Serif italic. The Q1 question stays sans.
4. **`/resources` "Got it" + "Processing…" + "Finding your matches"** — All sans, no italic. (Brief; trigger by completing a question.)
5. **`/resources` complete state** — Match results narrative + ResourceCard match reason both render in sans.
6. **`/resources` mic-denied error** — "Microphone access is required." shows in sans.
7. **`/resources` text-mode fallback** — The textarea (after switching to text input) keeps Instrument Serif. This is the user's typed answer.
8. **`/resources` bubble click → ResourcePopup** — Description body in sans.
9. **`/resources` after results → EmailPanel** — Email body in sans.
10. **`/map` initial sidebar** — "Utah's startup map" h1 in sans; the Nexis sidebar wordmark stays serif.
11. **`/map` voice mode → click mic** — Mic button visually identical to before; bars animate the same way; speech bubble (transcript / placeholder) still in Instrument Serif italic.
12. **`/map` startup pin → InfoPanel** — Description body in sans.
13. **`/results` (after intake)** — Sticky-header "Utah's Nexis" wordmark in serif. ResultsNarrative + ResourceCard match reasons in sans.
14. **`/results` empty state** — Visit without `nexis-results` in sessionStorage; "No results found." shows in sans, no italic.
15. **`/auth/login`** — Top "Nexis" wordmark in serif; "Sign in" h1 in sans.
16. **`/map/new` flow** — Each step's h1 ("Add your startup", "Check your email", "Tell us about your company", "Listing created", "Already on the map") all in sans. The Nexis wordmark in CreateLayout stays serif.
17. **`/admin/resources/<token>` (with valid token)** — "Add a resource" h1 in sans; "Resource added" h2 in sans.
18. **`/protected` (authenticated)** — Top "Nexis" nav wordmark in serif.
19. **`/`** — FeatureCard headings ("Find your match." / "Explore the map.") in sans; main "Nexis" wordmark in serif.
20. **Voice mic visual cross-page check** — Side-by-side: open `/resources` (with intake listening) and `/map` (with voice filter listening). The mic chrome should be visually indistinguishable.

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

```bash
npm run lint
```

Must exit 0.

### Level 2: Unit Tests

N/A.

### Level 3: Integration Tests

N/A.

### Level 4: Manual Validation

Start the dev server:

```bash
npm run dev
```

Then walk through each of the 20 edge cases above in a browser at `http://localhost:3000`.

### Level 5: Static checks

```bash
# Confirm only the 13 expected serif keepers remain
grep -rn "instrument-serif" app/ components/

# Confirm mic-pulse is gone (if Task 25 applied)
grep -rn "mic-pulse" app/ components/

# Build with type checking
npm run build
```

---

## ACCEPTANCE CRITERIA

- [ ] Every `var(--font-instrument-serif)` usage in `app/` and `components/` is one of these 13 (the variable definition is also fine):
  - `app/layout.tsx` (definition)
  - `app/page.tsx` line ~175 (home wordmark)
  - `app/results/page.tsx` line ~110 (results header wordmark)
  - `app/protected/layout.tsx` line ~24 (protected nav wordmark)
  - `app/resources/page.tsx` line ~120 (resources sidebar wordmark)
  - `components/login-form.tsx` line ~89 (login top wordmark)
  - `components/map/MapSidebar.tsx` line ~56 (map sidebar wordmark)
  - `components/map/create/CreateLayout.tsx` line ~41 (create layout wordmark)
  - `components/intake/VoiceIntake.tsx` line ~82 (idle hero "Utah's Nexis")
  - `components/intake/VoiceIntake.tsx` line ~137 (text-mode textarea)
  - `components/intake/TranscriptDisplay.tsx` line ~14 (live transcript)
  - `components/intake/ConfirmedAnswer.tsx` line ~13 (confirmed answer)
  - `components/map/VoiceFilterButton.tsx` line ~126 (speech bubble transcript)
- [ ] Every status / instruction / heading / body element listed in the swap table now reads `fontFamily: "ui-sans-serif, system-ui, -apple-system"`.
- [ ] `fontStyle: "italic"` no longer appears on any element flagged for italic removal in the swap table.
- [ ] `components/voice/MicVisual.tsx` exists and exports a `MicVisual` component with the documented interface.
- [ ] `components/intake/MicIndicator.tsx` no longer renders the 12 px dot — it renders `<MicVisual interactive={false} …/>`.
- [ ] `components/map/VoiceFilterButton.tsx` no longer renders its own `<button>` or 5-bar `<motion.div>` audio meter — those are delegated to `MicVisual`. The speech-bubble overlay remains in this file.
- [ ] On `/resources` and `/map`, the mic visual is identical (52 px circle, same border, same glow, same audio bars).
- [ ] `npm run lint` exits 0.
- [ ] `npm run build` exits 0.
- [ ] No functional regressions: voice capture works on both pages; question advancement on `/resources` still triggers on silence; filter parsing on `/map` still triggers on silence.

---

## COMPLETION CHECKLIST

- [ ] All 26 tasks completed in order
- [ ] `grep -rn "instrument-serif" app/ components/` shows only the 13 keepers above (plus the layout.tsx definition)
- [ ] `grep -rn "mic-pulse" app/ components/` shows no matches (if Task 25 applied)
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] All 20 manual validation scenarios pass
- [ ] Acceptance criteria all met

---

## NOTES

**Why a shared component instead of CSS-only unification?**
The differences between `MicIndicator` and `VoiceFilterButton` are not just CSS. The map version has a 5-bar framer-motion meter, an SVG icon, hover glow logic, and accessibility wiring. A pure CSS approach would require duplicating all that markup into `MicIndicator`. Extracting one shared component is fewer total lines and guarantees the two surfaces stay in sync if either changes again.

**Why pass `isConnected` (not `isListening`) from the map?**
On `/map`, the audio bars currently appear when the Deepgram socket is connected (`isConnected` from `useDeepgram` — see `VoiceFilterButton.tsx:138`). The Zustand `isListening` flag is a UI signal that the user has tapped the mic, but bars are gated by socket readiness. Preserving that gating in the refactor avoids any subtle timing regression where bars would now appear before audio is actually flowing.

**Why keep italic on the transcript and confirmed answer (lines preserved in serif)?**
The italic on `TranscriptDisplay.tsx:24` is on the *interim* transcript span only (the not-yet-finalized portion). It's a deliberate signal: "this is provisional." Keeping the italic preserves that semantic. `ConfirmedAnswer.tsx` is regular (not italic) — also kept as-is.

**Why no italic on sans?**
Italic in a serif display face is one of the design tokens that gives the project its character — it's a deliberate "spoken aloud" or "soft instruction" cue. Italic in a sans-serif system font reads as emphasis (like `<em>`) and breaks the readability that motivated the swap. The user's stated goal is readability — dropping italic when going to sans is the consistent move.

**Sibling plan coordination.**
This plan presumes `wordmark-and-readability-pass.md` has already been executed (line numbers reflect post-execution state). If for some reason that plan is reverted, line numbers here may shift by ±10 lines but the file paths and target strings remain accurate.

**Out of scope (deliberate).**
- Transcript layout differences between `/resources` (huge centered display) and `/map` (small floating pill). These are context-appropriate — the intake transcript IS the page's primary content while the map transcript is a transient hint. Forcing them to match would harm UX.
- The `QuestionDisplay`, button labels, and form input labels — these were already in sans before this work. Untouched.
- The "Save results" / "Log in" controls in the results header — already sans.
- Any new typography token or design-system variable. The user did not ask for an abstraction, only a swap.

**Confidence in one-pass implementation:** **9/10.** The font swap is mechanical and per-file with explicit line numbers and a final grep verification step (Task 21). The voice unification is one new component + two narrow refactors with the new component's full source code provided in the plan. The single risk: line numbers can drift if any of the targeted files are edited between plan-write and plan-execution. The Task 21 grep + the explicit "what the keepers are" list catches any drift before the build step.
