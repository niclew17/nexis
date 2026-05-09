# Feature: Bubble Visual Polish — Color, Canvas Fill, Bounds, Hover Tooltip

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

**This plan amends `ai-context/plans/live-resource-discovery-bubbles.md`.** It modifies specific tasks in that plan — the same files, no new files needed. If implementing both plans together (neither has been executed yet), apply this plan's version of each file rather than the parent plan's version.

Pay special attention to naming of existing utils, types, and models. Import from the right files. This project uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — NOT `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Feature Description

Visual polish pass on the discovery bubble canvas from `live-resource-discovery-bubbles`:

1. **Color**: Replace gray bubbles (`#111111` fill, `#2a2a2a` stroke) with topic-based color coding — 5 distinct colors, one per resource topic category, at low opacity so the bubbles glow against the black canvas rather than blend into it.
2. **Canvas fill**: Make bubbles spread across the full available right-panel space (not cluster in the center). Fix the panel height so it fills `100dvh`. Add boundary clamping so no bubble overflows behind the question panel or off-screen.
3. **Hover tooltip**: Show the full resource title in a floating tooltip when hovering over any bubble, regardless of bubble size.

## User Story

As a user exploring the discovery canvas,  
I want bubbles to fill the screen with distinct colors and show me what each one is when I hover,  
So that the canvas feels alive and informative rather than a field of anonymous gray circles.

## Problem Statement

The parent plan's bubbles are all dark gray (`#111111` fill, `#2a2a2a` stroke), cluster toward the center, can drift outside the canvas bounds, and only show the title when `radius >= 20px` via a dim `#666666` text label. At 213 nodes with a 13px base radius, most text is invisible and the canvas looks like a monochrome blob.

## Solution Statement

- **Color**: Add a `topics` field to the start API response; derive a `color` string in `useBubbleState` using a topic-to-color map; pass color to `ResourceBubble` as a prop.
- **Canvas fill**: Strengthen the d3 repulsion force; weaken the center force; add per-tick position clamping to keep bubbles within `[r, width-r] × [r, height-r]`; fix the page layout so the right panel is always `100dvh` tall.
- **Hover tooltip**: Track `tooltip: {title, x, y} | null` in `BubbleField`; receive `onBubbleHover` / `onBubbleLeave` callbacks from each `ResourceBubble`; render a floating positioned div.

## Feature Metadata

**Feature Type**: Enhancement  
**Estimated Complexity**: Low  
**Primary Systems Affected**: `app/api/discovery/start/route.ts`, `hooks/useBubbleState.ts`, `hooks/useBubbleSimulation.ts`, `components/discovery/ResourceBubble.tsx`, `components/discovery/BubbleField.tsx`, `app/discover/page.tsx`  
**Dependencies**: None (all packages already specified in parent plan)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `ai-context/plans/live-resource-discovery-bubbles.md` — The parent plan this amends. Read the full implementation plan before applying these changes. Tasks here replace the equivalent tasks in that plan.
- `supabase/migrations/20250501000000_create_resources.sql` (lines 12–15) — Confirms `topics text[] default '{}'` column exists on `resources`. The start route can safely add `topics` to its SELECT.
- `app/globals.css` (lines 60–63) — Design system color constants. Bubble topic colors are new named constants not in the design system — they are SVG element colors, not page/background colors, so they don't violate the "no colored backgrounds" rule.
- `components/results/ResourceCard.tsx` (lines 1–82) — The existing `ResourceCard` uses `#2a5e49` as `color` for `matchReason`. That accent convention is preserved; the topic colors are separate and apply only to SVG bubble elements.
- `components/discovery/BubbleField.tsx` (full file, as defined in parent plan) — This task replaces the BubbleField implementation entirely with the hover-aware version.
- `components/discovery/ResourceBubble.tsx` (full file, as defined in parent plan) — This task replaces the ResourceBubble implementation entirely with the color+hover version.
- `hooks/useBubbleState.ts` (full file, as defined in parent plan) — Add `color` field and topic-color derivation.
- `hooks/useBubbleSimulation.ts` (full file, as defined in parent plan) — Replace force params and add bounds clamping.
- `app/discover/page.tsx` (full file, as defined in parent plan) — Fix container height.

### New Files to Create

None. All changes are modifications to files defined in the parent plan.

### Patterns to Follow

**SVG element colors vs. page background colors (design rule interpretation)**:

The project CLAUDE.md says "No colored backgrounds other than pure black or white" and "`#2a5e49` is used only as a foreground signal, never as a background fill." This rule governs HTML page/section backgrounds and div fills. SVG `<circle fill="...">` is a drawing primitive, not a page background — the same way a colored icon wouldn't violate this rule. The bubble topic colors are applied only to SVG circle elements and are explicitly requested by the user.

**Hover tooltip pattern (BubbleField → floating div)**:
```tsx
// BubbleField manages tooltip state
const [tooltip, setTooltip] = useState<{ title: string; x: number; y: number } | null>(null);

// ResourceBubble fires callbacks on mouse events
<motion.g
  onMouseEnter={(e) => onBubbleHover(title, e.clientX, e.clientY)}
  onMouseLeave={onBubbleLeave}
>

// BubbleField renders an absolutely-positioned overlay div
{tooltip && (
  <div style={{
    position: "absolute",
    left: tooltip.x + 14,
    top: tooltip.y - 28,
    pointerEvents: "none",
    ...
  }}>
    {tooltip.title}
  </div>
)}
```

The tooltip is positioned relative to `containerRef.current.getBoundingClientRect()`. The `tooltip.x` and `tooltip.y` are container-relative coordinates (not viewport coordinates). `onBubbleHover` converts `clientX/clientY` → container-relative by subtracting `containerRef.current.getBoundingClientRect().left/top`.

**React.memo and hover callbacks**:
`onBubbleHover` and `onBubbleLeave` are wrapped in `useCallback` with empty deps (stable refs). This means `React.memo` on `ResourceBubble` will correctly skip re-renders when `tooltip` state changes in `BubbleField` — only the tooltip div itself re-renders.

**Inline styles everywhere (no Tailwind):**
All discovery components use inline style objects. Follow this pattern for the tooltip div and any new styling.

---

## TOPIC COLOR PALETTE

Define this constant in `hooks/useBubbleState.ts`. The colors are chosen to contrast well against a black (#000000) background:

```ts
const TOPIC_COLORS: Record<string, string> = {
  "Funding":              "#3b82f6",  // blue
  "Start a Business":     "#10b981",  // emerald
  "Growing a Business":   "#f59e0b",  // amber
  "Marketing":            "#ec4899",  // pink
  "Networking":           "#8b5cf6",  // violet
};
const DEFAULT_BUBBLE_COLOR = "#6b7280"; // gray — resources with unlisted topics
```

**Color derivation rule**: Use the first element of `resource.topics[]` to pick the color. If `topics` is empty or has no match in `TOPIC_COLORS`, use `DEFAULT_BUBBLE_COLOR`.

```ts
function deriveColor(topics: string[]): string {
  for (const topic of topics) {
    if (TOPIC_COLORS[topic]) return TOPIC_COLORS[topic];
  }
  return DEFAULT_BUBBLE_COLOR;
}
```

**Bubble visual specification**:
```tsx
// Normal state
<circle
  r={radius}
  fill={color}
  fillOpacity={0.18}
  stroke={color}
  strokeWidth={1.5}
  strokeOpacity={0.75}
/>

// Final match state (activeCount <= 3 AND status === 'active')
<circle
  r={radius}
  fill="#2a5e49"
  fillOpacity={0.25}
  stroke="#2a5e49"
  strokeWidth={2.5}
  strokeOpacity={1}
/>

// Eliminating state — let framer-motion animate scale/opacity to 0, no style change needed
```

**Text in bubbles**:
```tsx
// Show text when radius >= 16 (was 20 in parent plan — lower threshold shows more titles)
// Text color: white at 0.8 opacity for readability on colored fill
{radius >= 16 && (
  <text
    textAnchor="middle"
    dominantBaseline="middle"
    style={{
      fontSize: Math.min(9, radius * 0.38),
      fill: "rgba(255, 255, 255, 0.8)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system",
      pointerEvents: "none",
      userSelect: "none",
    }}
  >
    {title.length > 16 ? title.slice(0, 14) + "…" : title}
  </text>
)}
```

---

## D3 FORCE PARAMETERS FOR BETTER CANVAS FILL

Replace the parent plan's force parameters in `useBubbleSimulation.ts`:

```ts
// PARENT PLAN (replace this):
.force("collision", forceCollide<SimNode>(n => n.radius + 3).strength(0.8))
.force("center", forceCenter(width / 2, height / 2).strength(0.04))
.force("charge", forceManyBody<SimNode>().strength(-20))
.alphaDecay(0.02)
.velocityDecay(0.4)

// THIS PLAN (use this instead):
.force("collision", forceCollide<SimNode>(n => n.radius + 4).strength(0.9))
.force("center", forceCenter(width / 2, height / 2).strength(0.015))  // weaker — allows spread
.force("charge", forceManyBody<SimNode>().strength(-60))               // stronger repulsion
.alphaDecay(0.008)                                                      // slower cooling = more spread time
.velocityDecay(0.35)
```

**Why**: Stronger repulsion (`-60` vs `-20`) pushes bubbles apart. Weaker center force (`0.015` vs `0.04`) stops them from re-clustering. Slower cooling (`alphaDecay: 0.008`) gives more simulation time to settle into a distributed layout.

**Boundary clamping** (add to tick callback in `useBubbleSimulation.ts`):
```ts
sim.on("tick", () => {
  simNodes.forEach(node => {
    // Clamp positions to canvas bounds — prevents bubbles from going off-screen or behind left panel
    node.x = Math.max(node.radius + 4, Math.min(width - node.radius - 4, node.x ?? 0));
    node.y = Math.max(node.radius + 4, Math.min(height - node.radius - 4, node.y ?? 0));

    const setters = nodeSettersRef.current?.get(node.id);
    if (setters && node.x != null && node.y != null) {
      setters.setX(node.x);
      setters.setY(node.y);
    }
  });
});
```

The `+ 4` / `- 4` margin ensures the bubble stroke (1.5px) doesn't clip at the exact boundary.

---

## CANVAS HEIGHT FIX

The right panel must fill the full viewport height. In `app/discover/page.tsx`, change the outer container from `minHeight: "100dvh"` to `height: "100dvh"` with `overflow: "hidden"`:

```tsx
// PARENT PLAN (replace this):
<div style={{
  minHeight: "100dvh",
  backgroundColor: "black",
  display: "flex",
  flexDirection: isMobile ? "column" : "row",
}}>

// THIS PLAN (use this instead):
<div style={{
  height: "100dvh",
  overflow: "hidden",
  backgroundColor: "black",
  display: "flex",
  flexDirection: isMobile ? "column" : "row",
}}>
```

And the right panel div:
```tsx
// PARENT PLAN:
<div style={{ flex: 1, minHeight: isMobile ? "50vh" : undefined, position: "relative" }}>

// THIS PLAN:
<div style={{ flex: 1, height: "100%", minHeight: isMobile ? "50vh" : undefined, position: "relative" }}>
```

The left panel already has `overflowY: "auto"` so it scrolls internally if content is tall. With `height: 100dvh` on the root and `overflow: hidden`, both panels are constrained to the viewport.

---

## IMPLEMENTATION PLAN

### Phase 1: Data — add topics to start route

Add `topics` to the API response so the canvas knows how to color each bubble.

### Phase 2: State — add color to BubbleNode

Extend `BubbleNode` with a `color` field; derive it from topics in `initBubbles`.

### Phase 3: Simulation — better spread + bounds

Replace force params; add boundary clamping in the tick callback.

### Phase 4: Components — color, text, hover

Update `ResourceBubble` with color props and hover event handlers. Update `BubbleField` with tooltip state and the floating tooltip div.

### Phase 5: Layout — fix height

Fix the page container height so the right panel fills `100dvh`.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

---

### TASK 1: UPDATE `app/api/discovery/start/route.ts` — Add `topics` to SELECT

- **IMPLEMENT**: Change `.select("id, title")` to `.select("id, title, topics")`.
  ```ts
  // Before:
  const { data, error } = await supabase
    .from("resources")
    .select("id, title")
    .order("external_id");

  // After:
  const { data, error } = await supabase
    .from("resources")
    .select("id, title, topics")
    .order("external_id");
  ```
- **RESPONSE SHAPE CHANGE**: `{ resources: Array<{ id: string; title: string; topics: string[] }> }`
- **VALIDATE**: `curl http://localhost:3000/api/discovery/start | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['resources'][0]; print(r['title'], r['topics'])"`  — should print a resource title and its topics array.

---

### TASK 2: UPDATE `hooks/useBubbleState.ts` — Add `color`, update `BubbleNode` and `initBubbles`

- **IMPLEMENT**: Add the topic color map and `color` field to `BubbleNode`. Update `initBubbles` to accept `topics` and derive color.

  ```ts
  // Add these constants at the top of the file (after imports):
  const TOPIC_COLORS: Record<string, string> = {
    "Funding":              "#3b82f6",
    "Start a Business":     "#10b981",
    "Growing a Business":   "#f59e0b",
    "Marketing":            "#ec4899",
    "Networking":           "#8b5cf6",
  };
  const DEFAULT_BUBBLE_COLOR = "#6b7280";

  function deriveColor(topics: string[]): string {
    for (const topic of topics) {
      if (TOPIC_COLORS[topic]) return TOPIC_COLORS[topic];
    }
    return DEFAULT_BUBBLE_COLOR;
  }

  // Update BubbleNode interface — add color:
  export interface BubbleNode {
    id: string;
    title: string;
    status: BubbleStatus;
    radius: number;
    color: string;           // ← new field
  }

  // Update initBubbles — accept topics, derive color:
  const initBubbles = useCallback(
    (resources: Array<{ id: string; title: string; topics: string[] }>) => {  // ← topics added
      const count = resources.length;
      setInitialCount(count);
      const radius = computeRadius(count, count);
      setBubbles(
        resources.map(r => ({
          id: r.id,
          title: r.title,
          status: "active" as BubbleStatus,
          radius,
          color: deriveColor(r.topics ?? []),  // ← derive color
        }))
      );
    },
    []
  );
  ```

  The `onBubbleEliminated` radius recalculation also needs to preserve color — update that section:
  ```ts
  // In onBubbleEliminated, preserve color when recalculating:
  return updated.map(b =>
    b.status === "active" ? { ...b, radius: newRadius } : b  // color preserved via spread
  );
  ```

- **VALIDATE**: Call `initBubbles([{ id: 'abc', title: 'Test', topics: ['Funding'] }])`, verify `bubbles[0].color === '#3b82f6'`. Call with `topics: []`, verify `color === '#6b7280'`.

---

### TASK 3: UPDATE `hooks/useBubbleSimulation.ts` — Better spread + bounds clamping

- **IMPLEMENT**: Replace the force parameters and add boundary clamping in the tick callback.

  Replace the entire `forceSimulation` chain with:
  ```ts
  const sim = forceSimulation<SimNode>(simNodes)
    .force(
      "collision",
      forceCollide<SimNode>(n => n.radius + 4).strength(0.9)
    )
    .force("center", forceCenter(width / 2, height / 2).strength(0.015))
    .force("charge", forceManyBody<SimNode>().strength(-60))
    .alphaDecay(0.008)
    .velocityDecay(0.35);

  sim.on("tick", () => {
    simNodes.forEach(node => {
      // Clamp to canvas bounds before broadcasting positions
      node.x = Math.max(node.radius + 4, Math.min(width - node.radius - 4, node.x ?? 0));
      node.y = Math.max(node.radius + 4, Math.min(height - node.radius - 4, node.y ?? 0));

      const setters = nodeSettersRef.current?.get(node.id);
      if (setters) {
        setters.setX(node.x);
        setters.setY(node.y);
      }
    });
  });
  ```

- **WHY `alphaDecay(0.008)`**: Default is `0.0228`. Lower value = simulation runs longer before cooling = bubbles have more time to spread out across the full canvas. At 213 nodes with strong repulsion (`-60`), this is necessary for good distribution.
- **WHY boundary clamp**: Without it, `forceCenter` and the initial random positions can place bubbles partially off-screen or (in the split layout) overlapping with the left panel's right edge. The `containerRef` measures only the RIGHT panel, so the coordinate system starts at the right panel's left edge — bubbles can't cross into the left panel.
- **VALIDATE**: With dev server running, navigate to `/discover`. After the stagger-in, bubbles should be distributed across most of the canvas area, not clustered in the center. No bubble should be partially clipped by the canvas edge.

---

### TASK 4: UPDATE `components/discovery/ResourceBubble.tsx` — Color, text threshold, hover handlers

- **IMPLEMENT**: Replace the full component with the color+hover version:

  ```tsx
  "use client";
  import React, { useEffect } from "react";
  import { motion, useMotionValue } from "framer-motion";
  import type { BubbleStatus } from "@/hooks/useBubbleState";
  import type { NodeSetters } from "@/hooks/useBubbleSimulation";

  interface ResourceBubbleProps {
    id: string;
    title: string;
    status: BubbleStatus;
    radius: number;
    color: string;             // ← new prop
    initialDelay: number;
    isFinalMatch: boolean;
    onEliminated: (id: string) => void;
    onRegister: (id: string, setters: NodeSetters) => void;
    onUnregister: (id: string) => void;
    onBubbleHover: (title: string, clientX: number, clientY: number) => void;  // ← new
    onBubbleLeave: () => void;                                                  // ← new
  }

  export const ResourceBubble = React.memo(function ResourceBubble({
    id,
    title,
    status,
    radius,
    color,
    initialDelay,
    isFinalMatch,
    onEliminated,
    onRegister,
    onUnregister,
    onBubbleHover,
    onBubbleLeave,
  }: ResourceBubbleProps) {
    const mx = useMotionValue(0);
    const my = useMotionValue(0);

    useEffect(() => {
      onRegister(id, { setX: v => mx.set(v), setY: v => my.set(v) });
      return () => onUnregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const isEliminating = status === "eliminating";
    const showText = radius >= 16;
    const fontSize = Math.min(9, radius * 0.38);

    // Final match uses accent green; otherwise use topic color
    const fillColor = isFinalMatch ? "#2a5e49" : color;

    return (
      <motion.g
        style={{
          x: mx,
          y: my,
          transformBox: "fill-box",
          transformOrigin: "center",
          cursor: "default",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={isEliminating ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
        transition={
          isEliminating
            ? { duration: 0.6, ease: "easeIn" }
            : { duration: 0.3, delay: initialDelay, ease: "easeOut" }
        }
        onAnimationComplete={() => {
          if (isEliminating) onEliminated(id);
        }}
        onMouseEnter={(e) => onBubbleHover(title, e.clientX, e.clientY)}
        onMouseLeave={onBubbleLeave}
      >
        <circle
          r={radius}
          fill={fillColor}
          fillOpacity={isFinalMatch ? 0.25 : 0.18}
          stroke={fillColor}
          strokeWidth={isFinalMatch ? 2.5 : 1.5}
          strokeOpacity={isFinalMatch ? 1 : 0.75}
        />
        {showText && (
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize,
              fill: "rgba(255, 255, 255, 0.8)",
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {title.length > 16 ? title.slice(0, 14) + "…" : title}
          </text>
        )}
      </motion.g>
    );
  });
  ```

- **REMOVED**: `<title>{title}</title>` — replaced by the hover tooltip in BubbleField.
- **IMPORTANT**: `onMouseEnter` and `onMouseLeave` on `motion.g` fire as normal React synthetic events. They don't conflict with MotionValue position updates (which bypass React entirely). Hover events will work correctly.
- **VALIDATE**: In a static SVG test, render one bubble with a color. Verify the circle appears with colored fill+stroke. Hover over it and verify `onBubbleHover` fires with the correct title and clientX/clientY.

---

### TASK 5: UPDATE `components/discovery/BubbleField.tsx` — Add hover tooltip + pass color prop

- **IMPLEMENT**: Replace the full BubbleField with the tooltip-aware version:

  ```tsx
  "use client";
  import { useRef, useEffect, useState, useCallback } from "react";
  import { AnimatePresence } from "framer-motion";
  import { useBubbleSimulation, type NodeSetters } from "@/hooks/useBubbleSimulation";
  import { ResourceBubble } from "./ResourceBubble";
  import { BubbleCounter } from "./BubbleCounter";
  import type { BubbleNode } from "@/hooks/useBubbleState";

  interface BubbleFieldProps {
    bubbles: BubbleNode[];
    activeCount: number;
    onBubbleEliminated: (id: string) => void;
  }

  export function BubbleField({ bubbles, activeCount, onBubbleEliminated }: BubbleFieldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [tooltip, setTooltip] = useState<{ title: string; x: number; y: number } | null>(null);

    useEffect(() => {
      const measure = () => {
        if (containerRef.current) {
          setCanvasSize({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      };
      measure();
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }, []);

    const nodeSettersRef = useRef<Map<string, NodeSetters>>(new Map());

    const handleRegister = useCallback((id: string, setters: NodeSetters) => {
      nodeSettersRef.current.set(id, setters);
    }, []);

    const handleUnregister = useCallback((id: string) => {
      nodeSettersRef.current.delete(id);
    }, []);

    // Hover tooltip handlers — stable refs so React.memo on ResourceBubble isn't broken
    const handleBubbleHover = useCallback((title: string, clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({
        title,
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
    }, []);

    const handleBubbleLeave = useCallback(() => {
      setTooltip(null);
    }, []);

    const activeBubbles = bubbles.filter(b => b.status === "active");
    useBubbleSimulation(activeBubbles, canvasSize.width, canvasSize.height, nodeSettersRef);

    const isFinalPhase = activeCount <= 3;
    const visibleBubbles = bubbles.filter(b => b.status !== "eliminated");

    return (
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          backgroundColor: "black",
          overflow: "hidden",
        }}
      >
        <BubbleCounter count={activeCount} />

        {/* Hover tooltip */}
        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x + 14,
              top: tooltip.y - 36,
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
              maxWidth: "260px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {tooltip.title}
          </div>
        )}

        <svg
          width={canvasSize.width}
          height={canvasSize.height}
          style={{ display: "block", overflow: "visible" }}
        >
          <AnimatePresence>
            {visibleBubbles.map((bubble, index) => (
              <ResourceBubble
                key={bubble.id}
                id={bubble.id}
                title={bubble.title}
                status={bubble.status}
                radius={bubble.radius}
                color={bubble.color}            // ← pass color through
                initialDelay={index * 0.007}
                isFinalMatch={isFinalPhase && bubble.status === "active"}
                onEliminated={onBubbleEliminated}
                onRegister={handleRegister}
                onUnregister={handleUnregister}
                onBubbleHover={handleBubbleHover}  // ← new
                onBubbleLeave={handleBubbleLeave}  // ← new
              />
            ))}
          </AnimatePresence>
        </svg>
      </div>
    );
  }
  ```

- **TOOLTIP POSITIONING**: `tooltip.x + 14` offsets right of cursor; `tooltip.y - 36` places it above the cursor. The `maxWidth: 260px` and `textOverflow: ellipsis` handle very long resource titles.
- **`handleBubbleHover` and `handleBubbleLeave` are stable refs** (empty `useCallback` deps). `React.memo` on `ResourceBubble` checks prop identity — since these callbacks never change, the 211 non-hovered bubbles will NOT re-render when `tooltip` state changes. Only the tooltip div itself re-renders.
- **VALIDATE**: Hover over a bubble in the canvas. Verify tooltip appears ~14px to the right and ~36px above the cursor with the full resource title. Move cursor away, verify tooltip disappears.

---

### TASK 6: UPDATE `app/discover/page.tsx` — Fix container height

- **IMPLEMENT**: Two changes to the root layout div and right panel div.

  ```tsx
  // Root container — change minHeight → height, add overflow: hidden
  // BEFORE:
  <div style={{
    minHeight: "100dvh",
    backgroundColor: "black",
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
  }}>

  // AFTER:
  <div style={{
    height: "100dvh",
    overflow: "hidden",
    backgroundColor: "black",
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
  }}>
  ```

  ```tsx
  // Right panel — add explicit height: "100%"
  // BEFORE:
  <div style={{ flex: 1, minHeight: isMobile ? "50vh" : undefined, position: "relative" }}>

  // AFTER:
  <div style={{ flex: 1, height: "100%", minHeight: isMobile ? "50vh" : undefined, position: "relative" }}>
  ```

- **WHY `height: 100dvh` instead of `minHeight`**: `minHeight` allows the page to grow taller than the viewport (e.g., if left panel content is long). With `height: 100dvh` + `overflow: hidden`, both panels are strictly contained. The left panel has `overflowY: "auto"` for scrolling its own content. The right panel fills exactly the available height for the canvas measurement to work correctly.
- **VALIDATE**: Navigate to `/discover`. Open DevTools, inspect the right panel div. Verify its `clientHeight` matches `window.innerHeight`. Verify bubbles fill the full vertical space (not just the top portion).

---

## TESTING STRATEGY

No test framework configured. Manual browser validation.

### Manual Test Scenarios

**Color validation:**
1. Load `/discover` — verify bubbles have distinct colors (blue, green, amber, pink, violet, gray)
2. Count the distinct colors — should see all 5 topic colors plus gray for unlisted topics
3. Complete questions until ≤3 remain — verify final bubbles switch to `#2a5e49` stroke treatment

**Canvas fill validation:**
1. Resize browser window — verify bubbles redistribute to fill new canvas size
2. Verify no bubbles are clipped at the canvas boundary (none partially visible at edges)
3. Verify no bubbles cross into the left panel area
4. Verify bubbles are distributed across the full right panel, not clustered in the center

**Hover tooltip validation:**
1. Hover over any bubble — verify tooltip appears with full resource title
2. Move cursor off the bubble — verify tooltip disappears
3. Hover over a small bubble (radius < 16) — verify tooltip appears (even though no text is visible in the bubble)
4. Hover over a bubble near the right/bottom edge — verify tooltip doesn't get clipped (may go off-screen; acceptable for MVP)

**Height validation:**
1. Open DevTools console: `document.querySelector('[data-canvas]')?.clientHeight` — should match `window.innerHeight`
2. Verify no scrollbar appears on the discover page

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

### Level 4: Manual browser validation
```bash
npm run dev
# Open localhost:3000/discover
# Check: colored bubbles, canvas fill, no overflow, hover tooltip
```

---

## ACCEPTANCE CRITERIA

- [ ] All 213 bubbles have colored fills (blue, green, amber, pink, violet, or gray) — no more `#111111` gray
- [ ] Bubble color reflects the resource's primary topic category
- [ ] Final match bubbles (≤3 remaining) switch to `#2a5e49` stroke treatment
- [ ] Bubbles are distributed across the full right-panel canvas, not clustered centrally
- [ ] No bubble overflows outside the canvas bounds or behind the left panel
- [ ] Right panel fills `100dvh` (same height as the browser viewport)
- [ ] Hovering any bubble shows a floating tooltip with the full resource title
- [ ] Tooltip disappears on mouse leave
- [ ] `npx tsc --noEmit` passes with zero errors (new `color` prop is correctly typed throughout)
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds

---

## COMPLETION CHECKLIST

- [ ] Start route returns `topics` in response
- [ ] `BubbleNode` has `color: string` field
- [ ] `initBubbles` derives color from topics
- [ ] `ResourceBubble` accepts and renders `color`, `onBubbleHover`, `onBubbleLeave` props
- [ ] `BubbleField` manages tooltip state and renders floating tooltip div
- [ ] d3 simulation uses stronger repulsion + bounds clamping
- [ ] Page container is `height: 100dvh` with `overflow: hidden`
- [ ] TypeScript and lint clean

---

## NOTES

### Why Topic-Based Colors (Not Hash-Based)

An ID-hash approach would give consistent but semantically meaningless colors. Topic-based colors let users visually group resources by category ("all the blue ones are funding resources") which adds navigational value to the canvas. The 5 resource topics map neatly to 5 distinct hues; resources with unlisted topics get a neutral gray.

### Why `fillOpacity: 0.18` (Subtle Fill, Not Solid)

A solid `fill="#3b82f6"` at full opacity on 213 circles would be visually overwhelming on a black background. At 0.18 opacity, the colored fill creates a "glowing orb" effect — each bubble has a distinct color identity without the canvas becoming garish. The stroke at 0.75 opacity is the primary color signal; the fill is ambient.

### Tooltip Position Edge Cases

Tooltips near the right or bottom edges of the canvas may overflow the visible area. For MVP, this is acceptable — the tooltip will simply be clipped by the container's `overflow: hidden`. Post-MVP fix: detect canvas boundary and flip the tooltip to appear left-of or above the cursor when close to the edge.

### Why `height: 100dvh` Instead of `minHeight`

`minHeight: 100dvh` allows the page to grow taller if the left panel's content pushes it. This breaks the canvas height measurement: `containerRef.current.clientHeight` would return a value larger than the viewport, causing the d3 simulation to spread bubbles beyond what's visible. `height: 100dvh + overflow: hidden` strictly constrains both panels to the viewport.

### Confidence Score

**9.5/10** — All changes are straightforward modifications to the parent plan's files. The one remaining risk: tooltip positioning near canvas edges (see above), which is acceptable for a hackathon demo.
