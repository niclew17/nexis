# Feature: Mic Permission — Early Request + Text Fallback

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files.

---

## Feature Description

Improve the microphone permission experience so the browser's permission dialog appears on the very first user gesture ("Find your resources →"), not buried after the InstructionSlide. If the user denies mic access, present a clear "Type instead" option that lets them complete the full four-question intake by typing, with answers processed through the same `/api/process-answer` pipeline.

## User Story

As a Utah founder using the Nexis intake flow,
I want the browser mic permission dialog to appear immediately when I click "Find your resources", and to be able to type my answers if I deny mic access,
So that I can complete the intake without friction regardless of mic availability.

## Problem Statement

1. The permission dialog currently appears only after reading the InstructionSlide and clicking "Begin" — two clicks into the flow. Users may feel surprised or unsure why they're being asked.
2. If permission is denied, the app shows a dead-end error screen. Users must manually find the browser's camera icon in the address bar to re-enable the mic. There is no "type instead" fallback.

## Solution Statement

1. Move mic permission request to the first user gesture (`begin()` — the "Find your resources →" click). Pre-check via `navigator.permissions.query` if available; fall through to `getUserMedia` for `'prompt'` state. If already `'granted'` or `'denied'`, skip the dialog and handle accordingly.
2. Add `inputMode: 'voice' | 'text'` state to `useVoiceIntake`. When mic is denied (new or already denied at page load), the error screen gains a "Type instead →" affordance. Clicking it switches to text mode, where each question gets a `<textarea>` in place of the mic indicator, and answers flow through the same `processAnswer` pipeline.

## Feature Metadata

**Feature Type**: Enhancement  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: `hooks/useDeepgram.ts`, `hooks/useVoiceIntake.ts`, `components/intake/VoiceIntake.tsx`  
**Dependencies**: `navigator.permissions` (optional, with fallback), `navigator.mediaDevices.getUserMedia` (existing)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `hooks/useDeepgram.ts` (lines 43–51) — Where `getUserMedia` is called; the comment at line 44 explains the user-gesture constraint. We'll add `requestPermission()` here.
- `hooks/useDeepgram.ts` (lines 25–41) — The full hook signature and `stopListening` — needed to understand what `requestPermission` must NOT break.
- `hooks/useVoiceIntake.ts` (lines 74–110) — State declarations, ref patterns used throughout (mirror the `stateRef`, `currentQuestionIndexRef` patterns for new `inputModeRef`).
- `hooks/useVoiceIntake.ts` (lines 181–203) — The auto-advance `setTimeout` inside `processAnswer` where `startListeningRef.current()` is called — this is where we gate on `inputMode`.
- `hooks/useVoiceIntake.ts` (lines 225–252) — `begin()` and `startQuestion()` — `begin()` becomes async here.
- `hooks/useVoiceIntake.ts` (lines 288–300) — `retryMic()` — needs to reset `inputMode` to `'voice'` when retrying.
- `components/intake/VoiceIntake.tsx` (lines 40–55) — The existing `micError` block — the "Type instead" link is added here.
- `components/intake/VoiceIntake.tsx` (lines 115–174) — The `listening` state block — add text input branch here.
- `components/intake/TranscriptDisplay.tsx` — Transcript styling pattern (Instrument Serif, `fontSize: 1.25rem`, centered) — mirror for the `<textarea>`.
- `components/intake/MicIndicator.tsx` — Rendered inside `listening` block; must be hidden in text mode.

### New Files to Create

None — all changes are in existing files.

### Relevant Documentation

- [MDN — MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
  - Section: "Exceptions" — lists `NotAllowedError` (permission denied) and `NotFoundError` (no mic hardware)
  - Why: Confirm which errors map to `MicDeniedError` vs other failures
- [MDN — Permissions API](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API)
  - Section: `Permissions.query()` — returns `{ state: 'granted' | 'denied' | 'prompt' }`
  - Why: Pre-check permission without triggering dialog; note that `'microphone'` requires a type cast in TypeScript
- [MDN — PermissionDescriptor](https://developer.mozilla.org/en-US/docs/Web/API/PermissionDescriptor)
  - Why: `'microphone'` is not in the TypeScript DOM lib's `PermissionName` type by default; use `{ name: 'microphone' as PermissionName }`

---

## Patterns to Follow

**Ref pattern for state values inside callbacks** (mirror `stateRef` pattern from `useVoiceIntake.ts:85–92`):
```ts
const inputModeRef = useRef(inputMode);
inputModeRef.current = inputMode;
```

**Async hook function returning early on denied** (mirror `startQuestion` error handling from `useVoiceIntake.ts:243–251`):
```ts
} catch (err) {
  if (err instanceof MicDeniedError) {
    setMicError(true);
    setState("idle");
  }
}
```

**Inline style, text link affordance** (mirror "skip" link from `VoiceIntake.tsx:155–170`):
```tsx
<button
  onClick={switchToTextMode}
  style={{
    background: "none",
    border: "none",
    color: "#666",
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

**Textarea mirroring TranscriptDisplay style**:
```tsx
<textarea
  style={{
    fontFamily: "var(--font-instrument-serif)",
    fontSize: "1.25rem",
    textAlign: "center",
    lineHeight: 1.7,
    margin: "24px 0",
    color: "white",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid #444444",
    outline: "none",
    width: "100%",
    resize: "none",
    padding: "8px 0",
  }}
/>
```

---

## IMPLEMENTATION PLAN

### Phase 1: Add `requestPermission` to `useDeepgram`
Expose a new function that pre-checks and (if needed) triggers the browser permission dialog from the user gesture, without starting recording.

### Phase 2: Update `useVoiceIntake`
- Make `begin()` async; call `requestPermission()` on first click
- Add `inputMode` state + ref
- Add `switchToTextMode()` and `submitTextAnswer(text: string)` functions
- Gate `startListeningRef.current()` in auto-advance on `inputMode === 'voice'`
- Reset `inputMode` to `'voice'` in `retryMic()`

### Phase 3: Update `VoiceIntake.tsx`
- Consume new return values: `inputMode`, `switchToTextMode`, `submitTextAnswer`
- Mic error screen: add "type instead" link
- Listening state: branch on `inputMode` — voice gets existing UI; text gets textarea + confirm link

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

---

### TASK 1 — UPDATE `hooks/useDeepgram.ts`

**IMPLEMENT**: Add `requestPermission` function and export it.

The function:
1. Tries `navigator.permissions.query({ name: 'microphone' as PermissionName })`. If result is `'granted'` or `'denied'`, return immediately (no dialog triggered).
2. If `navigator.permissions` is unavailable or query throws, fall through.
3. Calls `navigator.mediaDevices.getUserMedia({ audio: true })`, immediately stops all tracks, returns `'granted'`.
4. If `getUserMedia` throws, returns `'denied'`.

```ts
const requestPermission = useCallback(async (): Promise<'granted' | 'denied'> => {
  if (typeof navigator === 'undefined') return 'denied';
  try {
    if (navigator.permissions) {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (result.state === 'granted') return 'granted';
      if (result.state === 'denied') return 'denied';
      // state === 'prompt' — fall through to getUserMedia
    }
  } catch {
    // permissions API unavailable or query threw — fall through
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}, []);
```

**EXPORTS**: Add `requestPermission` to `UseDeepgramReturn` interface and return object.

**GOTCHA**: `'microphone'` requires `as PermissionName` cast — TypeScript's DOM lib does not include it in `PermissionName` union. Do not install any type packages; use the cast.

**GOTCHA**: Do NOT stop the `streamRef` here — `requestPermission` is a pre-check only and does not interact with `streamRef`, `recorderRef`, or `socketRef`.

**VALIDATE**: `npm run lint` — no TypeScript errors on the cast.

---

### TASK 2 — UPDATE `hooks/useVoiceIntake.ts`

#### 2a — Add `inputMode` state + ref

After the existing `const [micError, setMicError] = useState(false)` line (line 81), add:
```ts
const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
```

Immediately after `stateRef.current = state` and the other ref assignments (around line 92), add:
```ts
const inputModeRef = useRef<'voice' | 'text'>('voice');
inputModeRef.current = inputMode;
```

#### 2b — Destructure `requestPermission` from `useDeepgram`

The existing destructuring of `useDeepgram(handleSilence)` at lines 103–110 — add `requestPermission` to the destructured list.

#### 2c — Make `begin()` async + call `requestPermission`

Replace the current `begin`:
```ts
const begin = useCallback(() => {
  setState("instructions");
}, []);
```

With:
```ts
const begin = useCallback(async () => {
  const permState = await requestPermission();
  if (permState === 'denied') {
    setMicError(true);
    return; // stay on idle, micError screen handles it
  }
  setState("instructions");
}, [requestPermission]);
```

**GOTCHA**: The `begin()` function is called from `onClick={begin}` in `VoiceIntake.tsx` (line 93). Async functions as event handlers do not need wrapping — the browser ignores the returned Promise. No change needed in VoiceIntake for this call.

#### 2d — Gate `startListeningRef.current()` in `processAnswer` auto-advance

In `processAnswer`, inside the `setTimeout` (around lines 182–196), change:
```ts
setState("listening");
try {
  await startListeningRef.current();
} catch (err) {
  if (err instanceof MicDeniedError) {
    setMicError(true);
    setState("idle");
  }
}
```
To:
```ts
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
```

#### 2e — Add `switchToTextMode` function

```ts
const switchToTextMode = useCallback(() => {
  setInputMode('text');
  setMicError(false);
  resetTranscript();
  setState('listening');
}, [resetTranscript]);
```

#### 2f — Add `submitTextAnswer` function

```ts
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
```

#### 2g — Reset `inputMode` to `'voice'` in `retryMic`

Add `setInputMode('voice')` as the first line of the existing `retryMic` useCallback body.

#### 2h — Update `UseVoiceIntakeReturn` interface + return object

Add to interface:
```ts
inputMode: 'voice' | 'text';
switchToTextMode: () => void;
submitTextAnswer: (text: string) => void;
```

Add to return object:
```ts
inputMode,
switchToTextMode,
submitTextAnswer,
```

**VALIDATE**: `npm run lint` — no TypeScript errors, all new return values match interface.

---

### TASK 3 — UPDATE `components/intake/VoiceIntake.tsx`

#### 3a — Destructure new values from hook

Add `inputMode`, `switchToTextMode`, `submitTextAnswer` to the destructuring from `useVoiceIntake()` (lines 18–31).

#### 3b — Add local text state for textarea

After the destructuring, add:
```ts
const [textInput, setTextInput] = useState('');
```

Add `useState` to the React import if not already present. Check the top of the file — it currently imports from `@/hooks/useVoiceIntake` but not from React directly. Add:
```ts
import { useState } from 'react';
```

#### 3c — Update the `micError` screen to add "type instead" link

Current (lines 40–55):
```tsx
{micError && (
  <div style={{ ..., gap: "24px" }}>
    <p ...>Microphone access is required.</p>
    <p ...>To enable it, ...</p>
    <button onClick={() => retryMic().catch(console.error)} ...>Try again</button>
  </div>
)}
```

Add a "type instead" link after the "Try again" button — a small text link, consistent with the "skip" link style:
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

Also update the descriptive paragraph to acknowledge both options:
```tsx
<p style={{ ..., color: "#666666" }}>
  To enable your mic, click the camera icon in your browser&apos;s address bar and allow access, then try again. Or type your answers below.
</p>
```

#### 3d — Update `listening` state block to branch on `inputMode`

Current listening block (lines 115–174) renders `TranscriptDisplay`, `MicIndicator`, confirm/skip links — all voice-only.

Replace the inner content with a branch:

```tsx
{/* Listening */}
{!micError && state === "listening" && (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    <QuestionDisplay question={QUESTIONS[currentQuestionIndex]} />

    {inputMode === 'voice' ? (
      <>
        <TranscriptDisplay
          finalTranscript={currentTranscript}
          interimTranscript={interimTranscript}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginTop: "24px" }}>
          <MicIndicator isListening={isListening} />
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            {currentTranscript && (
              <button onClick={confirmAnswer} style={{ /* same as existing confirm style */ }}>
                confirm
              </button>
            )}
            <button onClick={skipQuestion} style={{ /* same as existing skip style */ }}>
              skip
            </button>
          </div>
        </div>
      </>
    ) : (
      /* Text mode */
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginTop: "24px" }}>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type your answer..."
          rows={3}
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.25rem",
            textAlign: "center",
            lineHeight: 1.7,
            color: "white",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid #444444",
            outline: "none",
            width: "100%",
            resize: "none",
            padding: "8px 0",
          }}
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
```

**GOTCHA**: `textInput` must be cleared when advancing to the next question. The `setTextInput('')` in the `onClick` of confirm/skip handles the current question. But auto-advance in text mode (via `processAnswer → setTimeout`) also needs the textarea cleared. This is handled because `setTextInput('')` is called in the `onClick` handler before `submitTextAnswer` — so by the time auto-advance fires, the textarea is already empty. Confirm this is the case before trusting it.

**GOTCHA**: The `placeholder` text color on `<textarea>` will inherit from the browser default (grey) — this is acceptable and consistent with a minimal design. Do NOT use a custom CSS class for placeholder styling since this is inline-style only; if needed, add a `::placeholder` rule in `globals.css` scoped to the textarea (but only if placeholder colour is an issue — skip for now).

**VALIDATE**: `npm run lint` — no TypeScript errors, no unused imports.

---

## TESTING STRATEGY

No automated test framework is configured in this project. Testing is manual.

### Edge Cases

1. **Permission pre-granted** (returning user): `begin()` calls `requestPermission()` → `permissions.query` returns `'granted'` → no dialog, goes straight to InstructionSlide. Verify flow is uninterrupted.
2. **Permission pre-denied** (browser setting already blocked): `begin()` → `requestPermission()` → `getUserMedia` throws → returns `'denied'` → `micError = true` → error screen visible immediately without ever showing InstructionSlide.
3. **Permission prompt** (first visit): Dialog appears on "Find your resources →" click. User allows → InstructionSlide shows, then "Begin" → listening starts without another dialog. User denies → error screen shows immediately.
4. **Text mode — all 4 questions**: Switch to text mode after deny → type answers for Q0–Q3 → each `submitTextAnswer` triggers `processAnswer` → auto-advance to next question (voice disabled) → completes and navigates to `/results`.
5. **Text mode skip**: Click "skip" in text mode → `skipQuestion()` is called → empty answer inserted → advances. Confirm `stopListening()` is a no-op when not recording (it is — all `?.` null-safe in `useDeepgram.stopListening`).
6. **Retry mic from error screen**: Click "Try again" → `retryMic()` resets `inputMode` to `'voice'` → tries `startListening()` again. If still denied, error screen reappears with both options intact.
7. **`navigator.permissions` unavailable** (e.g., old Safari): `requestPermission` catches the error and falls through to `getUserMedia` → dialog appears normally.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
```bash
npm run lint
```
Zero errors expected. The `as PermissionName` cast may produce a lint note but not an error.

### Level 2: TypeScript Build Check
```bash
npm run build 2>&1 | head -60
```
Zero TypeScript errors. Watch for: missing return types on new functions, missing items in interface.

### Level 3: Manual Validation

1. `npm run dev`
2. Open `http://localhost:3000` in Chrome
3. Open DevTools → Application → Clear site data (to reset permission state)
4. **Happy path — voice**: Click "Find your resources →" → permission dialog appears → Allow → InstructionSlide shows → "Begin" → mic starts (green dot) → speak answers → complete intake → `/results` page
5. **Deny path**: Repeat clear, click "Find your resources →" → Deny → error screen appears immediately (no InstructionSlide) → click "type instead" → Q0 textarea appears → type answer → click "confirm" → processes → advances to Q1 → repeat for all 4 → `/results` page
6. **Retry path**: On error screen, click "Try again" → if still denied (mic blocked), error screen reappears with both "Try again" and "type instead" still visible

---

## ACCEPTANCE CRITERIA

- [ ] Browser mic permission dialog appears on the first "Find your resources →" click, not after InstructionSlide
- [ ] If permission is already granted (returning user), no dialog appears and the flow continues to InstructionSlide uninterrupted
- [ ] If permission is denied (via dialog or pre-blocked), the mic error screen is shown immediately with "Try again" and "type instead" options
- [ ] "Type instead" switches to text input mode and hides the mic error screen
- [ ] Text mode shows a centered textarea in Instrument Serif for each question
- [ ] Text mode "confirm" submits the typed answer through the same `processAnswer` pipeline
- [ ] Text mode "skip" works identically to voice skip
- [ ] All 4 questions are completable in text mode, resulting in navigation to `/results`
- [ ] Auto-advance between questions works in text mode (does not attempt to start mic)
- [ ] "Try again" on the error screen resets to voice mode and reattempts mic permission
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` produces zero TypeScript errors
- [ ] No regressions in voice mode (existing tests/flow unchanged)

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order (1 → 2a–2h → 3a–3d)
- [ ] `npm run lint` passes after each task
- [ ] `npm run build` passes at end
- [ ] Manual validation for all 3 paths (voice allow, deny+text, retry)
- [ ] Acceptance criteria all met

---

## NOTES

**Why pre-request on `begin()` and not on page load?**
The Permissions API `query()` call is silent and fine at any time. But `getUserMedia` (needed when state is 'prompt') requires a user gesture to show the inline permission bubble. Page load has no gesture, so calling `getUserMedia` there would result in a blocked or popup-style dialog. The "Find your resources →" click is the first meaningful user gesture and the right moment.

**Why not pre-fetch the Deepgram token during InstructionSlide?**
Out of scope for this feature. Token fetching is cheap and fast (happens in `startListening`). Prefetching would add complexity without material UX benefit for the hackathon timeline.

**Why a `<textarea>` and not `<input type="text">`?**
Founders describe their business stage and needs in multiple sentences. A single-line input would feel constraining. Three rows with `resize: none` mirrors the transcript area's visual weight without being distracting.

**Why keep the text input state (`textInput`) local to `VoiceIntake.tsx` instead of in the hook?**
It's ephemeral UI state (cleared on confirm/skip), not part of the session or answer data. Keeping it in the component avoids polluting the hook's public interface.

**Confidence Score**: 9/10 — all integration points are known, all edge cases are documented, patterns mirror existing code directly.
