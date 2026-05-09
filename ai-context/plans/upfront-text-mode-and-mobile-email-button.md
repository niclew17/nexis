# Feature: Upfront Text Mode + Mobile Email Button

The following plan should be complete, but you must validate documentation, codebase patterns, and task sanity before implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files.

---

## Feature Description

Two final UX additions on `app/resources/page.tsx`:

1. **Upfront text-mode opt-in.** Today, users can only reach text mode by denying the mic permission first (post-deny fallback added in `mic-permission-and-text-fallback`). Many users prefer typing from the start — for accessibility, a quiet environment, or simple preference. Add a subtle "type instead" link below the primary "Find your resources →" button on the idle screen so users can skip the mic permission flow entirely and go straight to typing.

2. **Send-email button on mobile.** Today, the send-email + clipboard-copy UX is only available on desktop via `EmailPanel.tsx`. On mobile (`isMobile`), the page renders only `VoiceIntake`, which shows inline `ResourceCard`s with a "Learn more →" link but no email button. Mobile users currently have no way to launch a pre-drafted, personalized email to the resource. Reuse the existing `handleSend` logic (mailto + clipboard) by extracting it into a shared utility, then add a "Send email" button to `ResourceCard` when the resource has an email address.

## User Story

As a Utah founder using the Resources intake,
I want to type my answers from the start (without going through a denied-mic flow) and to send a pre-drafted email to a matched resource directly from my phone,
So that the experience works for me regardless of input preference or device.

## Problem Statement

1. **Hidden text path.** The existing `switchToTextMode()` is only triggered from the `micError` screen. A user who has not (yet) denied mic permission has no way to discover text mode. The flow forces every user through an audio decision they may not want to make.
2. **Mobile email gap.** `EmailPanel.tsx` is the only consumer of `result.draftEmail`, `result.emailSubject`, and `result.resourceEmail`. On mobile (viewport <768px), `EmailPanel` is not rendered at all (`app/resources/page.tsx:63–79`). Mobile users see only `ResourceCard`s with the program description and "Learn more" link — they cannot trigger the personalized email Claude already drafted server-side.

## Solution Statement

1. **Idle-screen text link.** Add a small "type instead" text link below the "Find your resources →" button on the `state === "idle"` block of `VoiceIntake.tsx`. Click → calls `switchToTextMode()` (which already exists in `useVoiceIntake.ts:297–302` and sets `inputMode='text'`, `state='listening'`). No mic permission requested, no `InstructionSlide` shown — straight into Q0 with a textarea.
2. **Shared send-email util + ResourceCard button.** Extract the body of `EmailPanel.handleSend` into a tiny pure function in `lib/results/sendEmail.ts` (signature: `sendDraftEmail({ draftEmail, emailSubject, resourceEmail }) → Promise<void>`). Have both `EmailPanel.tsx` and `ResourceCard.tsx` consume it. Pass `resourceEmail`, `draftEmail`, and `emailSubject` from the `MatchResult` through the `VoiceIntake.tsx` inline render into `ResourceCard`. Render a "Send email" button on cards that have an email address; show "Copied to clipboard ✓" feedback for ~2s on click. When `resourceEmail` is null, the existing "Learn more →" link remains the only action.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Low
**Primary Systems Affected**: `components/intake/VoiceIntake.tsx`, `components/results/ResourceCard.tsx`, `components/results/EmailPanel.tsx`, new `lib/results/sendEmail.ts`
**Dependencies**: None new. Reuses existing `navigator.clipboard.writeText` + dynamic anchor `mailto:` pattern.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — IMPORTANT: YOU MUST READ THESE BEFORE IMPLEMENTING!

- `app/resources/page.tsx` (lines 63–79) — Mobile branch that renders only `<VoiceIntake>`. Why: confirms that `EmailPanel` is desktop-only and the inline `ResourceCard`s in VoiceIntake are the mobile result surface.
- `components/intake/VoiceIntake.tsx` (lines 122–171) — The current `state === "idle"` block. Why: this is where the new "type instead" link is appended below the existing "Find your resources →" button. Mirror the inline-style pattern.
- `components/intake/VoiceIntake.tsx` (lines 444–474) — Inline result rendering for `state === "complete" && matchResults`. Why: this is where `ResourceCard` is mapped on mobile. The new email props must be passed in here.
- `components/intake/VoiceIntake.tsx` (lines 91–106) — Existing "type instead" button pattern on the `micError` screen. Why: copy the exact inline-style for consistency with the new idle-screen link.
- `components/results/EmailPanel.tsx` (lines 26–52) — Current `handleSend` implementation: clipboard write → mailto via dynamic anchor click. Why: this body becomes the shared util. Note the comment "`to` must NOT be URI-encoded" (mail clients won't decode `%40` to `@`) — the body's 1800-char cap is intentional (mailto URI ceiling).
- `components/results/EmailPanel.tsx` (lines 19–24, 187–224) — Component shape and the existing copied-state pattern (`useState(copied)` + `setTimeout(..., 2000)` clear). Why: same `copied` state pattern is mirrored in `ResourceCard`.
- `components/results/ResourceCard.tsx` (lines 1–82) — Current ResourceCard signature and inline-style conventions. Why: this is the file we extend. The current props are `title`, `matchReason`, `topics`, `link`.
- `hooks/useVoiceIntake.ts` (lines 24–60) — `MatchResult` type definition (includes `resourceEmail: string | null`, `draftEmail: string`, `emailSubject: string`) and `UseVoiceIntakeReturn` interface. Why: the type already carries the fields we need; nothing has to change in the API contract.
- `hooks/useVoiceIntake.ts` (lines 297–302) — Existing `switchToTextMode` function. Why: confirms the function already does what we need (sets `inputMode='text'`, clears mic error, resets transcript, sets `state='listening'`). The new idle-screen link only needs to call it.
- `ai-context/plans/mic-permission-and-text-fallback.md` — Prior plan that introduced `inputMode`, `switchToTextMode`, and the post-deny text fallback. Why: confirms the entire text pipeline already exists; this feature is adding one more entry point to it.
- `ai-context/plans/ai-ranking-email-results.md` (lines 446–480) — Origin of the `handleSend` logic and the 1800-char rationale. Why: the comments (`mailto body capped at 1800 chars`) explain why we don't change that limit.

### New Files to Create

- `lib/results/sendEmail.ts` — Shared utility exporting `sendDraftEmail(args)` that does the clipboard write + dynamic-anchor mailto open. Both `EmailPanel.tsx` and `ResourceCard.tsx` import from here.

### Relevant Documentation

- [MDN — `navigator.clipboard.writeText()`](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)
  - Section: "Security considerations" — only works in secure contexts (HTTPS or `localhost`); silently fails in some sandboxed iframes. Why: confirms existing try/catch is correct.
- [RFC 6068 — `mailto:` URI Scheme](https://datatracker.ietf.org/doc/html/rfc6068)
  - Section 5 — "Header Field Encoding": `subject` and `body` MUST be percent-encoded; the `to` segment SHOULD NOT be percent-encoded since most mail clients do not decode `@` from `%40`. Why: justifies the `to` (no encode) vs `subject`/`body` (encoded) split already present in `handleSend`.
- [MDN — Anchor click pattern for `mailto:`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#mailto_links)
  - Why: confirms the dynamic-anchor pattern (`document.createElement('a'); a.click()`) is the right way to fire mailto without leaving an empty popup. Avoid `window.location.href = mailto` (some browsers unload the page).

---

## Patterns to Follow

**Inline-style text-link** (mirror `VoiceIntake.tsx:91–106` "type instead" on micError screen):
```tsx
<button
  onClick={switchToTextMode}
  style={{
    background: "none",
    border: "none",
    color: "#666666",
    fontSize: "0.8rem",
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  }}
>
  type instead
</button>
```

**Bordered action button** (mirror existing "Find your resources →" at `VoiceIntake.tsx:155–169`):
```tsx
<button
  onClick={...}
  style={{
    padding: "12px 40px",
    border: "1px solid white",
    background: "transparent",
    color: "white",
    fontSize: "1rem",
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    cursor: "pointer",
    letterSpacing: "0.05em",
  }}
>
  ...
</button>
```

**Accent-bordered email button** (mirror `EmailPanel.tsx:190–223`):
```tsx
<button
  onClick={...}
  style={{
    padding: "10px 20px",
    border: "1px solid #2a5e49",
    background: "transparent",
    color: "#2a5e49",
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    fontSize: "0.875rem",
    cursor: "pointer",
    letterSpacing: "0.05em",
  }}
>
  Send email →
</button>
```

**Copied-state feedback** (mirror `EmailPanel.tsx:21,33–35`):
```ts
const [copied, setCopied] = useState(false);
// ...inside handler...
setCopied(true);
setTimeout(() => setCopied(false), 2000);
```

**Dynamic-anchor mailto pattern** (mirror `EmailPanel.tsx:42–51`):
```ts
const a = document.createElement("a");
a.href = mailtoUrl;
a.style.display = "none";
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
```

**Inline-style ResourceCard layout** (mirror existing `ResourceCard.tsx:11–82`):
- Outer `<div>` with `border: "1px solid #222"`, `padding: "24px"`, flex column, `gap: "12px"`
- All typography in `ui-sans-serif, system-ui, -apple-system`
- No external CSS files; styles inline only

---

## IMPLEMENTATION PLAN

### Phase 1: Extract shared `sendDraftEmail` utility

Pull the body of `EmailPanel.handleSend` into a single pure function so both consumers share identical mailto-build + clipboard-write behavior. Keeps the 1800-char body cap, the no-encode-to-address rule, and the dynamic-anchor click.

### Phase 2: Wire idle-screen text-mode link

Add a small "type instead" link below the "Find your resources →" button in the `state === "idle"` block of `VoiceIntake.tsx`. Click invokes the already-existing `switchToTextMode()` from `useVoiceIntake`. No new hook state, no permission request, no InstructionSlide.

### Phase 3: Add Send-email button to ResourceCard

Extend `ResourceCard` with three optional props (`resourceEmail`, `draftEmail`, `emailSubject`). When all three are present, render a "Send email →" button alongside the existing "Learn more →" link. Click → `sendDraftEmail()` → flip `copied` for 2s.

### Phase 4: Pass email props through VoiceIntake's inline result rendering

`VoiceIntake.tsx` already maps over `matchResults.results` (lines 464–472). Add the three email fields to the `<ResourceCard>` props. The fields exist on `MatchResult` (see `useVoiceIntake.ts:24–33`) — no API contract change.

### Phase 5: Refactor EmailPanel to consume the same util

Replace the inline `handleSend` body in `EmailPanel.tsx` with a call to `sendDraftEmail()`. Behavior is identical; this is just deduplication.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

---

### TASK 1 — CREATE `lib/results/sendEmail.ts`

- **IMPLEMENT**: Export an async function `sendDraftEmail` that performs clipboard-write of the body and triggers a mailto via a dynamic anchor click. Returns `void` (errors swallowed in clipboard branch only — mailto always fires).
- **PATTERN**: `components/results/EmailPanel.tsx:26–52`
- **IMPORTS**: None — pure browser API usage.
- **CONTENT**:
```ts
// lib/results/sendEmail.ts
// Shared util used by EmailPanel (desktop) and ResourceCard (mobile inline view)
// to copy a draft email to the clipboard and fire a mailto: anchor click.

interface SendDraftEmailArgs {
  draftEmail: string;
  emailSubject: string;
  resourceEmail: string;
}

export async function sendDraftEmail({
  draftEmail,
  emailSubject,
  resourceEmail,
}: SendDraftEmailArgs): Promise<void> {
  // Copy full body to clipboard first (mail clients may truncate the mailto body).
  try {
    await navigator.clipboard.writeText(draftEmail);
  } catch {
    // Clipboard API may be blocked in non-secure contexts; degrade silently.
  }

  // mailto: `to` must NOT be URI-encoded (mail clients won't decode %40 to @).
  // Body capped at 1800 chars to stay within the ~2000-char mailto URI ceiling.
  const mailtoUrl = `mailto:${resourceEmail}?subject=${encodeURIComponent(
    emailSubject
  )}&body=${encodeURIComponent(draftEmail.slice(0, 1800))}`;

  // Anchor-click pattern: triggers the OS mail client without leaving a
  // blank popup and without unloading the page (window.location.href can).
  const a = document.createElement("a");
  a.href = mailtoUrl;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```
- **GOTCHA**: Do not URI-encode `resourceEmail`. Mail clients (Apple Mail, Outlook) treat `%40` literally and reject the address.
- **GOTCHA**: The 1800-char body cap is load-bearing — Claude's drafts can exceed 2000 chars and silently truncate in some mail clients without it. Clipboard always gets the full body.
- **VALIDATE**: `npm run lint`

---

### TASK 2 — UPDATE `components/results/EmailPanel.tsx`

- **REFACTOR**: Replace the inline mailto + clipboard logic in `handleSend` with a call to `sendDraftEmail`. Keep the surrounding `setCopied(true)` / `setTimeout` UX feedback intact.
- **PATTERN**: `EmailPanel.tsx:26–52` (current `handleSend`)
- **IMPORTS**: Add `import { sendDraftEmail } from "@/lib/results/sendEmail";`
- **NEW `handleSend`**:
```ts
const handleSend = async (result: MatchResult) => {
  if (!result.resourceEmail) return;
  await sendDraftEmail({
    draftEmail: result.draftEmail,
    emailSubject: result.emailSubject,
    resourceEmail: result.resourceEmail,
  });
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```
- **GOTCHA**: The `setCopied(true)` previously fired only on successful clipboard. Since `sendDraftEmail` swallows clipboard errors, `setCopied(true)` now always fires after the call resolves. This is acceptable and matches user expectation: the mailto opens, and the toast says "Copied" — even if the actual clipboard call silently failed in a sandboxed context, the user sees the mail compose and the toast disappears in 2s. If you want strict accuracy, return a boolean from `sendDraftEmail` indicating clipboard success and gate `setCopied` on it; out of scope for this task.
- **VALIDATE**: `npm run lint`; manually verify desktop send-email flow still works at `localhost:3000/resources` (unchanged behavior).

---

### TASK 3 — UPDATE `components/results/ResourceCard.tsx`

- **ADD**: Optional `resourceEmail`, `draftEmail`, `emailSubject` props.
- **ADD**: Local `copied` state.
- **ADD**: A "Send email →" / "Copied to clipboard ✓" button between the topics row and the "Learn more →" link, rendered only when all three email props are non-empty strings.
- **PATTERN**: Email button styling mirrors `EmailPanel.tsx:190–223` but at smaller scale (`padding: "10px 20px"`, `fontSize: "0.875rem"`); copied-state pattern mirrors `EmailPanel.tsx:21,33–35`.
- **IMPORTS**:
  - Add `"use client";` directive (already present)
  - Add `import { useState } from "react";`
  - Add `import { sendDraftEmail } from "@/lib/results/sendEmail";`
- **PROP TYPE**:
```ts
interface ResourceCardProps {
  title: string;
  matchReason: string;
  topics: string[];
  link: string;
  resourceEmail?: string | null;
  draftEmail?: string;
  emailSubject?: string;
}
```
- **HANDLER**:
```ts
const [copied, setCopied] = useState(false);

const handleSend = async () => {
  if (!resourceEmail || !draftEmail || !emailSubject) return;
  await sendDraftEmail({ draftEmail, emailSubject, resourceEmail });
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```
- **JSX (insert after the topics block, before the `Learn more →` link)**:
```tsx
{resourceEmail && draftEmail && emailSubject && (
  <button
    onClick={handleSend}
    style={{
      alignSelf: "flex-start",
      padding: "8px 16px",
      border: "1px solid #2a5e49",
      background: "transparent",
      color: "#2a5e49",
      fontFamily: "ui-sans-serif, system-ui, -apple-system",
      fontSize: "0.875rem",
      cursor: "pointer",
      letterSpacing: "0.03em",
      marginTop: "4px",
    }}
  >
    {copied ? "Copied to clipboard ✓" : "Send email →"}
  </button>
)}
```
- **GOTCHA**: Use `alignSelf: "flex-start"` so the button does not stretch to the card's full width (the card is `flexDirection: "column"`).
- **GOTCHA**: Order the conditional render BEFORE the existing `link &&` block so the button is visually above "Learn more →". Both should remain visible when both are available.
- **GOTCHA**: All three fields must be truthy (`emailSubject` and `draftEmail` are always-strings on the type but may be empty strings if Claude's draft was empty — `&& draftEmail && emailSubject` guards against an empty render).
- **VALIDATE**: `npm run lint`; manually check at <768px viewport.

---

### TASK 4 — UPDATE `components/intake/VoiceIntake.tsx` — pass email props to inline ResourceCards

- **UPDATE**: The `matchResults.results.map(...)` block at lines 464–472. Pass `resourceEmail`, `draftEmail`, and `emailSubject` from each result to `ResourceCard`.
- **PATTERN**: Existing prop spread style (one prop per line). The `MatchResult` type at `useVoiceIntake.ts:24–33` already declares all three fields.
- **NEW JSX**:
```tsx
{matchResults.results.map((result) => (
  <ResourceCard
    key={result.id}
    title={result.title}
    matchReason={result.matchReason}
    topics={result.topics}
    link={result.link}
    resourceEmail={result.resourceEmail}
    draftEmail={result.draftEmail}
    emailSubject={result.emailSubject}
  />
))}
```
- **GOTCHA**: `resourceEmail` is `string | null` on the `MatchResult` type — pass it through as-is; the optional prop on `ResourceCard` accepts `string | null`.
- **VALIDATE**: `npm run lint`; render `/resources`, complete the intake (or seed `sessionStorage['nexis-results']`), confirm "Send email →" appears on cards that have an email.

---

### TASK 5 — UPDATE `components/intake/VoiceIntake.tsx` — add idle-screen "type instead" link

- **ADD**: A small "type instead" text link below the "Find your resources →" button in the `state === "idle"` block (lines 122–171).
- **PATTERN**: Use the exact same inline-style as the existing "type instead" button on the micError screen (`VoiceIntake.tsx:91–106`), so the visual treatment is identical.
- **WIRING**: The button's `onClick` calls `switchToTextMode` from the destructured hook return. `switchToTextMode` is already destructured at line 29 — no change to the destructure list.
- **NEW JSX (insert as a sibling immediately after the existing `<button>Find your resources →</button>`)**:
```tsx
<button
  onClick={switchToTextMode}
  style={{
    background: "none",
    border: "none",
    color: "#666666",
    fontSize: "0.8rem",
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  }}
>
  type instead
</button>
```
- **GOTCHA**: The wrapper around the idle-screen content uses `gap: "32px"` (line 130). The new link will inherit a 32px gap from the primary button. If that feels too loose, do NOT change the gap — wrap the primary button + new link in their own `<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>` to tighten the inter-element spacing without affecting the heading↔button gap.
- **GOTCHA**: `switchToTextMode` (in `useVoiceIntake.ts:297–302`) does NOT request mic permission, does NOT show `InstructionSlide`, and does NOT upsert the `intake_sessions` row (the upsert lives only in `startQuestion`). This is consistent with the existing post-deny text fallback, which has the same characteristic. Out of scope to change here. If a future feature requires the session row in text mode, refactor the upsert into a shared `initSession()` helper called from both `startQuestion` and `switchToTextMode`.
- **GOTCHA**: After clicking "type instead", `state` becomes `listening` and `inputMode` becomes `text`. The existing branch at `VoiceIntake.tsx:243–317` already renders the textarea UI for that state combination. No changes are needed in the `listening` block.
- **VALIDATE**: `npm run lint`; manually click "type instead" on idle screen — should jump straight into Q0 textarea without a permission dialog.

---

### TASK 6 — Manual smoke test (no code changes)

- **EXECUTE**: `npm run dev`
- **VERIFY (desktop)**:
  1. Visit `http://localhost:3000/resources`
  2. Idle screen: "Find your resources →" button is primary; "type instead" link sits below it.
  3. Click "type instead" → no permission dialog → textarea for Q0 appears immediately on the left panel.
  4. Type Q0–Q5 answers, confirming each → results render in the left panel + `EmailPanel` on the right.
  5. Right-panel "Send email →" button still works (unchanged behavior, now via shared util).
- **VERIFY (mobile, viewport <768px)**:
  6. Reload `/resources` → idle screen renders centered → "type instead" link visible below primary button.
  7. Click "type instead" → straight into typing flow (no permission dialog, no `InstructionSlide`).
  8. Complete intake → mobile inline `ResourceCard`s render → cards with `resourceEmail` show "Send email →" button.
  9. Tap "Send email →" → mail compose opens with To/Subject/Body filled (or, on platforms without a default mail client, body is at least in clipboard).
  10. Toast flips to "Copied to clipboard ✓" for ~2 seconds, then back.
- **VERIFY (voice unchanged)**:
  11. Reload, click "Find your resources →" → permission dialog appears as before → grant → InstructionSlide → Begin → mic listens → existing voice flow works end-to-end.

---

## TESTING STRATEGY

No automated test framework is configured in this project (manual testing only — see `mic-permission-and-text-fallback.md:461–462`).

### Edge Cases

1. **Resource with no email**: `resourceEmail === null`. ResourceCard renders only the existing "Learn more →" link, no Send-email button. EmailPanel falls through to "Visit website →" (unchanged behavior).
2. **Empty draft / subject**: Claude returned an empty string for `draftEmail` or `emailSubject`. Conditional in ResourceCard (`resourceEmail && draftEmail && emailSubject`) hides the button. EmailPanel still displays the empty draft area but the send button is gated on `resourceEmail` only — no regression.
3. **Clipboard API blocked**: Non-HTTPS origin or sandboxed iframe. `sendDraftEmail` swallows the error; mailto still fires; `copied` toast still flips (acceptable trade-off — see Task 2 GOTCHA).
4. **No default mail client (mobile / kiosk)**: `mailto:` opens the OS picker. On platforms with no client at all, nothing visible happens — but the body is in the clipboard, so the user can paste into Gmail web. This is the same behavior as desktop EmailPanel today.
5. **User clicks "type instead", then later reloads**: Reloading resets `inputMode` to `'voice'` (default in `useVoiceIntake` state). User sees idle screen again, can pick again. No persistence — acceptable.
6. **User clicks "type instead" while permissions are already granted**: `switchToTextMode` sets `inputMode='text'` and skips `startListening`. Mic stream is never opened, even though it could be. Correct — the user explicitly chose text.
7. **User clicks "Find your resources →" first, denies mic, then sees micError screen with "type instead"**: Pre-existing flow unchanged; `switchToTextMode` is the same function called from both screens.
8. **`MatchResult.resourceEmail` is `null` AND `link` is empty string**: ResourceCard renders neither button. (This is a pre-existing data quality gap — not caused by this feature.)
9. **Tapping "Send email →" twice in 2s**: First click flips `copied=true`. Second click also calls `sendDraftEmail` (a second mail-compose may pop). Acceptable for hackathon scope; consider disabling the button while `copied===true` if regression noticed.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
```bash
npm run lint
```
Expect zero errors. Watch for unused imports if a previous Edit removed `useState` from `EmailPanel.tsx` accidentally.

### Level 2: TypeScript Build
```bash
npm run build 2>&1 | head -80
```
Expect zero TypeScript errors. The new optional props on `ResourceCard` should compose cleanly with the existing four required props.

### Level 3: Manual Validation (see Task 6 list above)

Three primary paths:
1. Desktop voice (regression check — should be unchanged)
2. Desktop text-from-idle (new entry point)
3. Mobile text-from-idle + Send-email button (new functionality on smallest viewport)

### Level 4: Browser DevTools sanity

- DevTools → Network: confirm no `getUserMedia`-related requests fire when text-from-idle path is taken.
- DevTools → Application → Permissions: `microphone` should remain in `prompt` state after the text path completes (never moved to `granted` or `denied`).
- DevTools → Sources: set a breakpoint inside `sendDraftEmail`, click the button, confirm `mailtoUrl` has unencoded `@` in the To address and percent-encoded `subject`/`body`.

---

## ACCEPTANCE CRITERIA

- [ ] On idle screen, a "type instead" link is visible below "Find your resources →" with the same inline style as the existing post-deny "type instead" link.
- [ ] Clicking "type instead" goes straight into Q0 with a textarea — no permission dialog, no InstructionSlide.
- [ ] Voice flow is unchanged when the user clicks "Find your resources →" instead.
- [ ] On mobile viewport (<768px), each `ResourceCard` with a `resourceEmail` renders a "Send email →" button.
- [ ] Tapping the mobile "Send email →" button opens the OS mail compose with To/Subject/Body filled, and the body is also written to the clipboard.
- [ ] The button label flips to "Copied to clipboard ✓" for ~2 seconds after click, then back.
- [ ] Cards without a `resourceEmail` do not render the new button; their existing "Learn more →" link still works.
- [ ] Desktop `EmailPanel` "Send email →" button still works (regression check).
- [ ] `lib/results/sendEmail.ts` is the single source of mailto + clipboard logic; `EmailPanel.tsx` and `ResourceCard.tsx` both call into it.
- [ ] `npm run lint` passes with zero errors.
- [ ] `npm run build` produces zero TypeScript errors.

---

## COMPLETION CHECKLIST

- [ ] Task 1: `lib/results/sendEmail.ts` created
- [ ] Task 2: `EmailPanel.tsx` refactored to call `sendDraftEmail`
- [ ] Task 3: `ResourceCard.tsx` extended with email props + button
- [ ] Task 4: `VoiceIntake.tsx` passes email props to inline ResourceCards
- [ ] Task 5: `VoiceIntake.tsx` idle screen has "type instead" link
- [ ] Task 6: Manual smoke test of all three paths passes
- [ ] `npm run lint` clean
- [ ] `npm run build` clean

---

## NOTES

**Why one shared util instead of two copies?**
The mailto + clipboard logic is short (≈10 lines) but has three load-bearing details — no `to` encoding, 1800-char body cap, dynamic-anchor click — that must stay identical between the two consumers. Drift between EmailPanel and ResourceCard would mean a fix on one (e.g., a longer cap) silently failing on the other. One file, one source of truth.

**Why not just import EmailPanel from VoiceIntake on mobile?**
EmailPanel is a 1-of-N tab UI that takes up the right pane on desktop. Embedding it on mobile would duplicate the resource cards (the same titles/match reasons appear in `ResourceCard`s above) and burn vertical space on the smallest viewport. Adding a per-card button is the lighter touch.

**Why doesn't the idle "type instead" call `startQuestion` to upsert the session row?**
The pre-existing post-deny text fallback also doesn't upsert the `intake_sessions` row (the upsert lives only in `startQuestion`, which is gated behind voice mode). Mirroring the existing behavior keeps this feature scoped to the user's request. If a future feature needs telemetry for text-mode intakes, refactor the upsert into an `initSession()` helper called from both entry points.

**Why no `InstructionSlide` on the text path?**
The slide's copy is voice-specific ("Speak your answers naturally. Silence moves you to the next question."). Showing it for text mode would either confuse the user or require a parallel text-mode slide — neither is justified for this hackathon-scope addition. The textarea + question text are self-explanatory.

**Why optional props on `ResourceCard` instead of a new `EmailableResourceCard`?**
Splitting components would mean `VoiceIntake.tsx` has to branch on `result.resourceEmail` to pick the component — pure overhead. Optional props keep the call site identical and the conditional logic local to the card.

**Confidence Score: 9/10** — All integration points are known, the existing post-deny text path is the proven template for the idle entry, and `sendDraftEmail` is a pure extraction of working code. The only minor risk is mobile-Safari mailto behavior (some platforms mismatch the `body` encoding), which is the same risk EmailPanel carries today and is unchanged by this feature.
