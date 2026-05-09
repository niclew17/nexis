# Feature: Logo, Counter, and Tooltip Polish

The following plan should be complete, but validate codebase patterns and exact style values before implementing.

Pay close attention to the existing `tooltip` state type — the type must change from `{ x, y }` to `{ bx, by, radius }` to enable smart positioning, while `ResourceBubble`'s callback signature stays untouched.

---

## Feature Description

Three UI polish improvements:

1. **Nexis logo** displayed at the top of the left sidebar (voice intake panel), loaded from `/public/logo.png`, positioned absolutely so it doesn't disturb the vertical centering of the intake content.

2. **Resource counter** (`BubbleCounter`) made clean and non-overlapping — given a proper dark background and border so it always reads legibly regardless of bubble density beneath it.

3. **Tooltip smart positioning** — when hovering a bubble near the top edge it currently disappears off-screen, and near the left edge it can be clipped or overlap the left sidebar. Fix: store raw bubble center + radius in tooltip state, then compute a clamped X and flip-to-below Y in the render using the already-available `canvasSize`.

## User Story

As a demo viewer,
I want the Nexis logo visible in the sidebar, the resource counter to stay legible without obscuring bubbles, and bubble tooltips to always appear fully on-screen,
So that the UI looks polished and professional during the hackathon demo.

## Problem Statement

- No brand identity visible while the founder is completing the intake.
- The counter (`BubbleCounter`) has no background and visually collides with bubble graphics at the top-right of the canvas.
- Tooltips positioned near the top or left edge of the canvas render outside the visible area, clipped by `overflow: hidden` or hidden behind the left sidebar border.

## Solution Statement

- Add the logo as an absolutely-positioned `<img>` inside the already-`position: relative` outer right-panel wrapper — actually the left panel needs `position: relative` added to support absolute children.
- Give `BubbleCounter` a solid black background + border (matching tooltip style) and bump its `zIndex` to ensure it sits above bubbles but below the tooltip.
- Refactor tooltip state in `BubbleField` to store `{ title, bx, by, radius }` (raw bubble data). Compute display position at render-time: clamp X to `[HALF_W + 4, canvasSize.width - HALF_W - 4]`; flip to "show below" when the bubble top is within ~40px of the canvas top edge.

## Feature Metadata

**Feature Type**: Enhancement / Bug Fix  
**Estimated Complexity**: Low  
**Primary Systems Affected**: `app/page.tsx`, `components/discovery/BubbleField.tsx`, `components/discovery/BubbleCounter.tsx`  
**Dependencies**: None new

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `app/page.tsx` (lines 80–125) — left-panel flex column structure; add `position: "relative"` and logo `<img>` here
- `components/discovery/BubbleField.tsx` (lines 16–155) — full component; tooltip state type, `handleBubbleHover`, and tooltip render block all change here
- `components/discovery/BubbleCounter.tsx` (lines 1–49) — entire file; add dark background container
- `components/discovery/ResourceBubble.tsx` (line 67) — `onMouseEnter` callback passes `(title, mx.get(), my.get(), radius)` — **DO NOT CHANGE** this file

### New Files to Create

None.

### Patterns to Follow

**Absolute positioning inside left panel** — the right-panel wrapper in `app/page.tsx` already uses `position: "relative"` (line 112). Mirror the same pattern on the left panel:
```tsx
<div style={{ position: "relative", width: "45%", minWidth: "360px", maxWidth: "560px", ... }}>
```

**Logo image tag** — the codebase uses plain `<img>` tags (no `next/image`) throughout components. Use `<img src="/logo.png" alt="Nexis" />` in the left panel.

**Tooltip background style** (existing in `BubbleField.tsx` lines 100–119):
```ts
backgroundColor: "#0a0a0a",
border: "1px solid #333",
borderRadius: "4px",
padding: "5px 10px",
```
Mirror this exact style for the `BubbleCounter` container. The design system says "no colored backgrounds other than pure black or white" — `#0a0a0a` and `#000` both qualify.

**Tooltip state type** — currently `{ title: string; x: number; y: number }` at line 21. Must become:
```ts
{ title: string; bx: number; by: number; radius: number }
```

**`handleBubbleHover` current** (line 52–54):
```ts
const handleBubbleHover = useCallback((title: string, bx: number, by: number, radius: number) => {
  setTooltip({ title, x: bx, y: by - radius - 12 });
}, []);
```
New version stores raw data; computation moves to render.

**Tooltip render block** (lines 96–120) — current uses `tooltip.x` and `tooltip.y`. These references must be replaced with computed `clampedX`, `displayY`, and `displayTransform`.

---

## IMPLEMENTATION PLAN

### Phase 1: Logo in left sidebar

Add `position: "relative"` to the left panel, then add a small absolutely-positioned `<img>` at the top-left corner.

### Phase 2: BubbleCounter background

Update `BubbleCounter.tsx` to wrap the existing content in a background container matching the tooltip style.

### Phase 3: Smart tooltip positioning

Update `BubbleField.tsx` in three places:
1. Tooltip state type (line 21)
2. `handleBubbleHover` (lines 52–54)
3. Tooltip render block (lines 96–120)

---

## STEP-BY-STEP TASKS

### TASK 1 — UPDATE `app/page.tsx` — Logo in left sidebar

- **IMPLEMENT**: Add `position: "relative"` to the left-panel `<div>` (currently at line 92). Then insert a logo `<img>` as the **first child** of that div, positioned absolutely at top-left.

**Exact change — left panel opening tag:**
```tsx
<div
  style={{
    position: "relative",          // ← add this
    width: "45%",
    minWidth: "360px",
    maxWidth: "560px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderRight: "1px solid #111",
    overflowY: "auto",
  }}
>
```

**Logo element — insert as first child of the left panel (before the intake wrapper div):**
```tsx
{/* Nexis logo — absolute so it doesn't disturb the vertical centering of intake content */}
<img
  src="/logo.png"
  alt="Nexis"
  style={{
    position: "absolute",
    top: "24px",
    left: "24px",
    height: "32px",
    width: "auto",
    opacity: 0.85,
    pointerEvents: "none",
    userSelect: "none",
  }}
/>
```

- **GOTCHA**: `position: "absolute"` requires the parent to be `position: "relative"` (or any non-static). Without `position: "relative"` on the parent, the logo would be positioned relative to the nearest positioned ancestor (which might be the viewport).
- **GOTCHA**: The left panel has `overflowY: "auto"`. Since the logo is absolutely positioned and the panel doesn't scroll past the intake content normally, the logo won't be hidden by overflow. But if the intake content is taller than the panel and the user scrolls, the logo stays at the top of the scroll container (because it's `position: absolute`, not `position: fixed`). This is the desired behavior.
- **GOTCHA**: `opacity: 0.85` softens the logo against the black background. If the full-opacity version looks better, remove it.
- **VALIDATE**: Start dev server `npm run dev`; verify logo appears at top-left of the left sidebar on desktop; verify vertical centering of the intake content is unaffected.

---

### TASK 2 — UPDATE `components/discovery/BubbleCounter.tsx` — Clean non-overlapping counter

- **IMPLEMENT**: Wrap the entire `return (...)` content in a background container. Add `zIndex: 10` (below tooltip's `zIndex: 20`). Apply the same background/border style as the tooltip.

**Full replacement for `BubbleCounter.tsx`:**
```tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";

export function BubbleCounter({ count }: { count: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "16px",
        right: "16px",
        padding: "8px 14px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #1e1e1e",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "2px",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={count}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "2rem",
            color: "white",
            lineHeight: 1,
            display: "block",
          }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
      <span
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.625rem",
          color: "#555",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        resources
      </span>
    </div>
  );
}
```

- **CHANGES**: Added outer wrapper `div` with `backgroundColor: "#0a0a0a"`, `border: "1px solid #1e1e1e"`, `padding: "8px 14px"`, `zIndex: 10`. Removed these props from the outer `div` that used to carry `position/top/right` (they now live on the wrapper). The "resources" label color changed from `#444` → `#555` (slightly more visible against the dark background).
- **GOTCHA**: The `position: "absolute"`, `top`, `right` props must stay on the **outermost** div — they're what positions the counter within the `BubbleField` container.
- **VALIDATE**: Run dev server; verify counter has a dark background box; verify it doesn't flicker or affect bubble interactions (`pointerEvents: none` preserved).

---

### TASK 3 — UPDATE `components/discovery/BubbleField.tsx` — Smart tooltip positioning

Three sub-tasks, all within the same file:

**3a — Update tooltip state type (line 21):**

Change:
```ts
const [tooltip, setTooltip] = useState<{ title: string; x: number; y: number } | null>(null);
```
To:
```ts
const [tooltip, setTooltip] = useState<{
  title: string;
  bx: number;
  by: number;
  radius: number;
} | null>(null);
```

**3b — Update `handleBubbleHover` (lines 52–54):**

Change:
```ts
const handleBubbleHover = useCallback((title: string, bx: number, by: number, radius: number) => {
  setTooltip({ title, x: bx, y: by - radius - 12 });
}, []);
```
To:
```ts
const handleBubbleHover = useCallback((title: string, bx: number, by: number, radius: number) => {
  setTooltip({ title, bx, by, radius });
}, []);
```

**3c — Update the tooltip render block (lines 95–120).**

Replace the existing `{tooltip && !selectedBubble && (...)}` block with:

```tsx
{/* Tooltip — smart positioning: clamps X to canvas bounds; flips below when near top edge */}
{tooltip && !selectedBubble && (() => {
  const HALF_W = 144; // half of maxWidth (288px) — provides clamping margin
  const FLIP_THRESHOLD = 48; // px from top edge below which we flip to "show below"
  const showBelow = (tooltip.by - tooltip.radius - 12) < FLIP_THRESHOLD;
  const clampedX = Math.max(
    HALF_W + 4,
    Math.min(canvasSize.width > 0 ? canvasSize.width - HALF_W - 4 : HALF_W + 4, tooltip.bx)
  );
  const displayY = showBelow
    ? tooltip.by + tooltip.radius + 12
    : tooltip.by - tooltip.radius - 12;
  const displayTransform = showBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)";

  return (
    <div
      style={{
        position: "absolute",
        left: clampedX,
        top: displayY,
        transform: displayTransform,
        pointerEvents: "none",
        backgroundColor: "#0a0a0a",
        border: "1px solid #333",
        borderRadius: "4px",
        padding: "5px 10px",
        color: "white",
        fontSize: "0.75rem",
        fontFamily: "ui-sans-serif, system-ui, -apple-system",
        whiteSpace: "nowrap",
        zIndex: 20,
        maxWidth: "288px",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {tooltip.title}
    </div>
  );
})()}
```

- **GOTCHA**: The IIFE (`(() => { ... })()`) pattern inside JSX is valid and avoids declaring variables in the component scope for computed tooltip values. If it feels uncomfortable, extract the computation into variables just before the `return (...)` of the component — either approach is fine.
- **GOTCHA**: `maxWidth` changed from `280` → `288` to match `HALF_W * 2 = 288`. If you prefer 280, change `HALF_W` to `140` for consistency.
- **GOTCHA**: `canvasSize.width > 0 ? ... : HALF_W + 4` guards the zero-width initial render case where `canvasSize.width - HALF_W - 4` would be negative, causing `Math.min` to clamp too aggressively.
- **DO NOT CHANGE**: `ResourceBubble.tsx` — its `onMouseEnter` callback signature is unchanged. The `onBubbleHover` prop type in `ResourceBubble` is `(title: string, bx: number, by: number, radius: number) => void` and remains correct.
- **VALIDATE**: `npm run lint && npm run build`

---

## TESTING STRATEGY

### Manual Validation Checklist

1. **Logo**:
   - Desktop: logo visible at top-left of left sidebar ✓
   - Logo does not shift the intake content from center ✓
   - Mobile view: logo absent (mobile renders a different layout that hides the left panel structure) — verify mobile still works ✓

2. **BubbleCounter**:
   - Counter has visible dark background container ✓
   - Bubbles can still be seen moving behind the counter ✓
   - Counter text readable at all bubble counts (213 → 5) ✓
   - No interference with bubble hover/click (`pointerEvents: none`) ✓

3. **Tooltip**:
   - **Top-left bubble**: hover a bubble in top-left corner → tooltip appears **below** the bubble, fully visible, not clipped ✓
   - **Top-right bubble**: hover a bubble in top-right corner → tooltip flips below, X clamped to stay within right boundary ✓
   - **Top-center bubble**: tooltip flips below ✓
   - **Mid-left bubble**: tooltip appears above, X clamped right so full width visible ✓
   - **Center bubble**: tooltip appears above-centered (standard behavior) ✓
   - **Bottom bubble**: tooltip appears above (standard behavior, no flip needed) ✓

### Edge Cases

- Bubble count reaches 1 (final match): counter shows "1 resources" — acceptable, no plural handling needed for demo
- `canvasSize.width === 0` on initial render: tooltip state may never be set before canvas measures, but guard prevents negative-clamping bugs
- Title is very long (exceeds 288px): `textOverflow: "ellipsis"` + `overflow: hidden` truncates gracefully

---

## VALIDATION COMMANDS

### Level 1: Types + Lint
```bash
npm run lint
npm run build
```

### Level 2: Manual Browser Test
```bash
npm run dev
# Open http://localhost:3000
# 1. Verify logo at top-left of left sidebar
# 2. Verify counter has dark background
# 3. Hover bubbles in each corner — tooltip fully visible each time
```

---

## ACCEPTANCE CRITERIA

- [ ] Logo (`/public/logo.png`) renders at top-left of left sidebar, ~32px tall
- [ ] Logo does not affect vertical centering of intake questions
- [ ] `BubbleCounter` has a dark background container; text is legible over bubble graphics
- [ ] `BubbleCounter` `zIndex` (10) is lower than tooltip `zIndex` (20) — tooltip renders above counter when they overlap
- [ ] Tooltip near top edge of canvas flips to display **below** the bubble
- [ ] Tooltip near left edge of canvas is clamped so it stays fully within the canvas width
- [ ] Tooltip near right edge of canvas is clamped symmetrically
- [ ] Standard tooltip position (above, centered) still works for bubbles in the middle of the canvas
- [ ] `npm run build` passes with zero type errors
- [ ] `ResourceBubble.tsx` is not modified

---

## COMPLETION CHECKLIST

- [ ] `app/page.tsx` — `position: relative` added to left panel, logo `<img>` inserted
- [ ] `components/discovery/BubbleCounter.tsx` — background wrapper added, `zIndex: 10`
- [ ] `components/discovery/BubbleField.tsx` — tooltip state type updated, `handleBubbleHover` stores raw data, render block uses clamped/flipped position
- [ ] Manual test in all four corners of the bubble canvas passes
- [ ] `npm run build` clean
- [ ] `ResourceBubble.tsx` unchanged

---

## NOTES

**Why IIFE in JSX for tooltip computation:**
The smart-positioning logic requires 4 computed values (`clampedX`, `displayY`, `displayTransform`, `showBelow`). Rather than hoisting these as variables in the main component body (which would compute them even when `tooltip === null`), the IIFE keeps the computation co-located with its use. Alternative: extract into a helper function `computeTooltipStyle(tooltip, canvasSize)` that returns the style props — equally valid.

**Why `HALF_W = 144` not `140`:**
`maxWidth: 288` is `144 * 2`. The tooltip won't always be 288px wide (it's `maxWidth`, not fixed width), so clamping to `144` is slightly conservative — the tooltip may have more margin than needed for short titles. This is intentional: better to over-clamp than have a long title extend off-screen.

**Why not `position: fixed` for the logo:**
The left panel has `overflowY: auto`. `position: absolute` inside a scrollable container scrolls with the content, keeping the logo at the top of the container's scroll offset, which is correct behavior. `position: fixed` would pin it to the viewport, which could cause issues on narrow viewports.

**Design system compliance:**
- `#0a0a0a` on the counter background is effectively black — satisfies "no colored backgrounds other than pure black or white"
- Logo uses `opacity: 0.85` which doesn't introduce color, just transparency
- No new icon libraries introduced
