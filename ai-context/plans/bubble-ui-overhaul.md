# Feature: Bubble UI Overhaul — Grid Layout, Uniform Color, Click Popup, External Tooltip

The following plan should be complete, but it is important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files. This project uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — NOT `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Feature Description

Four visual and interaction improvements to the bubble canvas on `app/page.tsx`:

1. **Uniform color** — All bubbles become `#2a5e49` (the site accent green) regardless of topic. Remove topic-based color derivation from `useBubbleState`.
2. **Grid-filling layout** — Replace the center-clustering d3-force configuration (`forceCenter` + `forceManyBody`) with `forceX`/`forceY` forces targeting evenly-spaced grid cells. Bubbles spread to fill the full canvas width and height, not cluster in the middle. When bubbles are eliminated, the remaining ones reflow to new grid positions.
3. **Click-to-popup** — Clicking any active bubble opens a centered popup modal showing the full resource title, description, topic tags, and "Learn more" link. Clicking the backdrop or pressing Escape closes it.
4. **External hover tooltip** — The resource title tooltip is always positioned above the bubble's top edge (never inside it), regardless of bubble size. Remove all text labels rendered inside the SVG circles.

---

## User Story

As a founder watching the bubble canvas during intake,  
I want bubbles to fill the screen in a clean green grid, show me the resource name on hover above the bubble, and let me click any bubble to read its full description,  
So that I can explore resources visually while answering questions and understand what each circle represents.

---

## Problem Statement

Currently: bubbles cluster in the center (weak `forceCenter`), have 5 different topic colors, render small truncated text labels inside circles (invisible at small sizes), show hover tooltips at cursor position (inside large bubbles), and are not interactive beyond hover.

---

## Solution Statement

- **Color**: Set a single fill and stroke color (`#2a5e49`) for all bubbles in `ResourceBubble`. Remove `color` prop and all topic-color derivation from `useBubbleState`.
- **Grid layout**: Replace `forceCenter` + `forceManyBody` in `useBubbleSimulation` with `forceX`/`forceY` that assign each bubble a target cell in a rectangular grid computed from `width`, `height`, and `activeBubbles.length`. Grid recalculates on each simulation restart (after each elimination round).
- **Popup**: Add `onBubbleClick` callback to `ResourceBubble`. `BubbleField` tracks `selectedBubble: BubbleNode | null` and renders a new `ResourcePopup` component. `BubbleNode` gains `description` and `link` fields pre-loaded from the start API.
- **External tooltip**: Change the hover callback signature to pass bubble center coordinates `(bx, by)` and `radius`. `BubbleField` positions the tooltip div at `(bx, by - radius - 12)` with `transform: translate(-50%, -100%)` — always above the bubble top edge. Remove all `<text>` elements inside `ResourceBubble`.

---

## Feature Metadata

**Feature Type**: Enhancement  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: `hooks/useBubbleState.ts`, `hooks/useBubbleSimulation.ts`, `components/discovery/ResourceBubble.tsx`, `components/discovery/BubbleField.tsx`, `app/api/discovery/start/route.ts`  
**Dependencies**: No new packages — `d3-force` already has `forceX`/`forceY`; `framer-motion` already used

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `components/discovery/ResourceBubble.tsx` (full file) — To be replaced. Remove `color` prop, remove `<text>` label, add `onBubbleClick`, change hover callback signature. The `transformBox: "fill-box"` + `transformOrigin: "center"` pattern is REQUIRED on `motion.g` — do not remove.
- `components/discovery/BubbleField.tsx` (full file) — To be updated. Change tooltip positioning to bubble-center-relative. Add click state, `bubblesRef`, `handleBubbleClick`. Render `ResourcePopup` when `selectedBubble !== null`.
- `hooks/useBubbleState.ts` (full file) — Remove `color` field from `BubbleNode`, remove `TOPIC_COLORS`/`DEFAULT_BUBBLE_COLOR`/`deriveColor`. Add `description: string` and `link: string` fields. Update `initBubbles` parameter type.
- `hooks/useBubbleSimulation.ts` (full file) — Replace force configuration. Import `forceX`, `forceY` (already in `d3-force`). Add `targetX`/`targetY` to `SimNode`. Compute grid positions before creating simulation.
- `app/api/discovery/start/route.ts` (full file) — Add `description` and `link` to the SELECT query.
- `app/page.tsx` (full file) — Update the type hint on the resources map to include `description` and `link` if TypeScript requires it.
- `components/discovery/BubbleCounter.tsx` — Read for reference; not modified.

### New Files to Create

- `components/discovery/ResourcePopup.tsx` — Centered modal with backdrop, shows resource title + description + topics + link. Handles Escape key via parent.

### Patterns to Follow

**Inline styles only (no Tailwind on discovery components):**
```tsx
style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", color: "#666" }}
```

**React.memo stability — stable callbacks via `useCallback` + `useRef`:**
```tsx
// Bubbles ref pattern — lets handleBubbleClick be stable while always reading current bubble data
const bubblesRef = useRef(bubbles);
bubblesRef.current = bubbles;
const handleBubbleClick = useCallback((id: string) => {
  const bubble = bubblesRef.current.find(b => b.id === id);
  if (bubble?.status === "active") setSelectedBubble(bubble);
}, []); // stable — reads via ref, not closure over bubbles
```

**MotionValue-based tooltip positioning — read current value at event time:**
```tsx
// In ResourceBubble — pass bubble center coordinates from MotionValues
onMouseEnter={() => onBubbleHover(title, mx.get(), my.get(), radius)}
```

**`transformBox: "fill-box"` + `transformOrigin: "center"` on every `motion.g`** — REQUIRED for correct SVG scale origin. Never remove these.

**d3-force imports — subpackage only:**
```ts
import { forceSimulation, forceCollide, forceX, forceY, type SimulationNodeDatum } from "d3-force";
// Do NOT import from "d3" barrel — it bundles DOM modules that conflict with React
```

**Service role client (API routes):**
```ts
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
// Always inside handler body — never at module level
```

**Colors:**
```
bubble fill:   #2a5e49 at fillOpacity 0.18
bubble stroke: #2a5e49 at strokeOpacity 0.8, strokeWidth 1.5
final-match:   #2a5e49 at fillOpacity 0.30, strokeOpacity 1.0, strokeWidth 2.5
popup border:  #2a5e49
popup bg:      #080808
backdrop:      rgba(0, 0, 0, 0.65)
```

---

## IMPLEMENTATION PLAN

### Phase 1: Data layer
Add `description` and `link` to the start API response and `BubbleNode` type.

### Phase 2: Physics
Replace center-clustering forces with grid-targeting forces.

### Phase 3: Visual
Uniform color, remove inner text, external-only tooltip.

### Phase 4: Interaction
Click popup component, click handler wiring, Escape key support.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

---

### TASK 1: UPDATE `app/api/discovery/start/route.ts` — add `description` and `link`

Change `.select("id, title, topics")` to `.select("id, title, topics, description, link")`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("resources")
    .select("id, title, topics, description, link")
    .order("external_id");

  if (error) {
    return NextResponse.json({ error: "Failed to load resources" }, { status: 500 });
  }

  return NextResponse.json({ resources: data ?? [] });
}
```

- **RESPONSE SHAPE**: `{ resources: Array<{ id: string; title: string; topics: string[]; description: string | null; link: string | null }> }` — 213 items
- **VALIDATE**:
  ```bash
  curl http://localhost:3000/api/discovery/start \
    | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['resources'][0]; print(r['title'], '|', bool(r.get('description')), '|', bool(r.get('link')))"
  ```
  Should print `<title> | True | True`.

---

### TASK 2: UPDATE `hooks/useBubbleState.ts` — remove color, add description/link

Replace the entire file:

```ts
"use client";
import { useState, useCallback } from "react";

export type BubbleStatus = "active" | "eliminating" | "eliminated";

export interface BubbleNode {
  id: string;
  title: string;
  description: string;
  topics: string[];
  link: string;
  status: BubbleStatus;
  radius: number;
  // color removed — all bubbles use #2a5e49 directly in ResourceBubble
}

interface UseBubbleStateReturn {
  bubbles: BubbleNode[];
  activeCount: number;
  initBubbles: (resources: Array<{
    id: string;
    title: string;
    topics: string[];
    description: string | null;
    link: string | null;
  }>) => void;
  triggerElimination: (ids: string[]) => void;
  onBubbleEliminated: (id: string) => void;
}

function computeRadius(activeCount: number, initialCount: number): number {
  const base = 13;
  const scaled = base * Math.sqrt(Math.max(initialCount, 1) / Math.max(activeCount, 1));
  return Math.min(80, Math.max(12, scaled));
}

export function useBubbleState(): UseBubbleStateReturn {
  const [bubbles, setBubbles] = useState<BubbleNode[]>([]);
  const [initialCount, setInitialCount] = useState(213);

  const activeCount = bubbles.filter(b => b.status === "active").length;

  const initBubbles = useCallback(
    (resources: Array<{
      id: string;
      title: string;
      topics: string[];
      description: string | null;
      link: string | null;
    }>) => {
      const count = resources.length;
      setInitialCount(count);
      const radius = computeRadius(count, count);
      setBubbles(
        resources.map(r => ({
          id: r.id,
          title: r.title,
          description: r.description ?? "",
          topics: r.topics ?? [],
          link: r.link ?? "",
          status: "active" as BubbleStatus,
          radius,
        }))
      );
    },
    []
  );

  const triggerElimination = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setBubbles(prev =>
      prev.map(b => idSet.has(b.id) ? { ...b, status: "eliminating" as BubbleStatus } : b)
    );
  }, []);

  const onBubbleEliminated = useCallback((id: string) => {
    setBubbles(prev => {
      const updated = prev.map(b =>
        b.id === id ? { ...b, status: "eliminated" as BubbleStatus } : b
      );
      const newActive = updated.filter(b => b.status === "active").length;
      const newRadius = computeRadius(newActive, initialCount);
      return updated.map(b =>
        b.status === "active" ? { ...b, radius: newRadius } : b
      );
    });
  }, [initialCount]);

  return { bubbles, activeCount, initBubbles, triggerElimination, onBubbleEliminated };
}
```

- **REMOVED**: `TOPIC_COLORS`, `DEFAULT_BUBBLE_COLOR`, `deriveColor`, `color` field on `BubbleNode`.
- **ADDED**: `description: string`, `topics: string[]`, `link: string` on `BubbleNode`.
- **VALIDATE**: `npx tsc --noEmit` (no type errors — `color` references elsewhere will surface here)

---

### TASK 3: UPDATE `hooks/useBubbleSimulation.ts` — grid-filling forceX/forceY layout

Replace the entire file. Key changes:
- Import `forceX`, `forceY` (replacing `forceCenter`, `forceManyBody`)
- Add `targetX`/`targetY` to `SimNode`
- Compute a rectangular grid before building `simNodes`
- New nodes start at their grid target (± small jitter) so they bloom outward from the right position

```ts
"use client";
import { useEffect, useRef } from "react";
import {
  forceSimulation,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import type { BubbleNode } from "./useBubbleState";

export interface NodeSetters {
  setX: (v: number) => void;
  setY: (v: number) => void;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  radius: number;
  targetX: number;
  targetY: number;
}

// Compute a rectangular grid that fills width × height for n nodes.
// Returns [targetX, targetY] for each node index.
function computeGridTargets(n: number, width: number, height: number): Array<[number, number]> {
  if (n === 0) return [];
  const aspectRatio = width / height;
  const cols = Math.max(1, Math.round(Math.sqrt(n * aspectRatio)));
  const rows = Math.ceil(n / cols);
  const cellW = width / cols;
  const cellH = height / rows;
  return Array.from({ length: n }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return [(col + 0.5) * cellW, (row + 0.5) * cellH];
  });
}

export function useBubbleSimulation(
  activeBubbles: BubbleNode[],
  width: number,
  height: number,
  nodeSettersRef: React.RefObject<Map<string, NodeSetters>>
): void {
  const simRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const prevPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (width === 0 || height === 0 || activeBubbles.length === 0) return;

    // Preserve positions of surviving nodes before restarting
    if (simRef.current) {
      (simRef.current.nodes() as SimNode[]).forEach(n => {
        if (n.x != null && n.y != null) {
          prevPositionsRef.current.set(n.id, { x: n.x, y: n.y });
        }
      });
      simRef.current.stop();
    }

    const gridTargets = computeGridTargets(activeBubbles.length, width, height);

    const simNodes: SimNode[] = activeBubbles.map((b, i) => {
      const [targetX, targetY] = gridTargets[i];
      const prev = prevPositionsRef.current.get(b.id);
      return {
        id: b.id,
        radius: b.radius,
        targetX,
        targetY,
        // Surviving nodes keep their position; new nodes start at grid target ± jitter
        x: prev?.x ?? targetX + (Math.random() - 0.5) * 20,
        y: prev?.y ?? targetY + (Math.random() - 0.5) * 20,
      };
    });

    const sim = forceSimulation<SimNode>(simNodes)
      // Pull each bubble toward its grid target cell
      .force("x", forceX<SimNode>(n => n.targetX).strength(0.12))
      .force("y", forceY<SimNode>(n => n.targetY).strength(0.12))
      // Prevent overlap — radius + 3px gap
      .force("collision", forceCollide<SimNode>(n => n.radius + 3).strength(0.85))
      .alphaDecay(0.015)
      .velocityDecay(0.4);

    sim.on("tick", () => {
      simNodes.forEach(node => {
        // Clamp to canvas bounds
        node.x = Math.max(node.radius + 4, Math.min(width - node.radius - 4, node.x ?? 0));
        node.y = Math.max(node.radius + 4, Math.min(height - node.radius - 4, node.y ?? 0));

        const setters = nodeSettersRef.current?.get(node.id);
        if (setters) {
          setters.setX(node.x);
          setters.setY(node.y);
        }
      });
    });

    simRef.current = sim as unknown as ReturnType<typeof forceSimulation>;

    return () => {
      sim.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBubbles.length, width, height]);
}
```

- **WHY no `forceManyBody`**: With `forceX`/`forceY` targeting grid cells, `forceManyBody` repulsion would fight the grid positioning. The collision force alone is sufficient to prevent overlap while the X/Y forces handle distribution.
- **WHY `strength(0.12)` for X/Y**: Moderate pull. Too high (>0.3) makes bubbles snap rigidly to grid with no physics feel. Too low (<0.05) makes the settling slow and bubbles don't fully fill the canvas.
- **VALIDATE**: Navigate to `localhost:3000`. After bubbles load, verify they are distributed across the full canvas (not clustered center). Answer a question and verify remaining bubbles reflow to fill the canvas.

---

### TASK 4: CREATE `components/discovery/ResourcePopup.tsx`

New component — renders a centered modal with resource details. Receives the full `BubbleNode` (which now includes `description`, `topics`, `link`).

```tsx
"use client";
import { useEffect } from "react";
import type { BubbleNode } from "@/hooks/useBubbleState";

interface ResourcePopupProps {
  bubble: BubbleNode;
  onClose: () => void;
}

export function ResourcePopup({ bubble, onClose }: ResourcePopupProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop — click to dismiss */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.65)",
          zIndex: 30,
        }}
      />

      {/* Card — centered in the canvas */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "#080808",
          border: "1px solid #2a5e49",
          padding: "32px",
          maxWidth: "480px",
          width: "calc(100% - 48px)",
          zIndex: 31,
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            color: "#666",
            fontSize: "1.25rem",
            cursor: "pointer",
            lineHeight: 1,
            padding: "4px 8px",
          }}
          aria-label="Close"
        >
          ×
        </button>

        {/* Title */}
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "white",
            margin: 0,
            paddingRight: "32px",
          }}
        >
          {bubble.title}
        </p>

        {/* Description */}
        {bubble.description && (
          <p
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "0.9375rem",
              color: "#aaaaaa",
              margin: 0,
              lineHeight: 1.65,
            }}
          >
            {bubble.description}
          </p>
        )}

        {/* Topics */}
        {bubble.topics.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {bubble.topics.map(topic => (
              <span
                key={topic}
                style={{
                  fontFamily: "ui-sans-serif, system-ui, -apple-system",
                  fontSize: "0.75rem",
                  color: "#888",
                  border: "1px solid #333",
                  padding: "2px 8px",
                  borderRadius: "99px",
                }}
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        {/* Link */}
        {bubble.link && (
          <a
            href={bubble.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.875rem",
              color: "#2a5e49",
              textDecoration: "underline",
            }}
          >
            Learn more →
          </a>
        )}
      </div>
    </>
  );
}
```

- **PATTERN**: Inline styles throughout — matches every other discovery component.
- **`e.stopPropagation()`** on the card div: prevents the backdrop's `onClick` from firing when clicking inside the card.
- **Escape key**: Attached to `window` in a `useEffect` — removed on cleanup.
- **VALIDATE**: Import and render `<ResourcePopup bubble={mockBubble} onClose={() => {}} />` temporarily in `BubbleField` and verify it renders centered with backdrop. Click backdrop — verify it closes. Press Escape — verify it closes.

---

### TASK 5: UPDATE `components/discovery/ResourceBubble.tsx` — uniform color, no inner text, click handler, fixed hover signature

Replace the entire file:

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
  initialDelay: number;
  isFinalMatch: boolean;
  onEliminated: (id: string) => void;
  onRegister: (id: string, setters: NodeSetters) => void;
  onUnregister: (id: string) => void;
  onBubbleHover: (title: string, bx: number, by: number, radius: number) => void;
  onBubbleLeave: () => void;
  onBubbleClick: (id: string) => void;
}

export const ResourceBubble = React.memo(function ResourceBubble({
  id,
  title,
  status,
  radius,
  initialDelay,
  isFinalMatch,
  onEliminated,
  onRegister,
  onUnregister,
  onBubbleHover,
  onBubbleLeave,
  onBubbleClick,
}: ResourceBubbleProps) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  useEffect(() => {
    onRegister(id, { setX: v => mx.set(v), setY: v => my.set(v) });
    return () => onUnregister(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isEliminating = status === "eliminating";

  return (
    <motion.g
      style={{
        x: mx,
        y: my,
        transformBox: "fill-box",   // REQUIRED — SVG scale-origin fix
        transformOrigin: "center",  // REQUIRED — scale from element center
        cursor: isEliminating ? "default" : "pointer",
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={isEliminating ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
      transition={
        isEliminating
          ? { duration: 0.5, ease: "easeIn" }
          : { duration: 0.3, delay: initialDelay, ease: "easeOut" }
      }
      onAnimationComplete={() => {
        if (isEliminating) onEliminated(id);
      }}
      onMouseEnter={() => onBubbleHover(title, mx.get(), my.get(), radius)}
      onMouseLeave={onBubbleLeave}
      onClick={() => { if (!isEliminating) onBubbleClick(id); }}
    >
      <circle
        r={radius}
        fill="#2a5e49"
        fillOpacity={isFinalMatch ? 0.30 : 0.18}
        stroke="#2a5e49"
        strokeWidth={isFinalMatch ? 2.5 : 1.5}
        strokeOpacity={isFinalMatch ? 1.0 : 0.80}
      />
      {/* No text rendered inside bubble — title always shown via external tooltip */}
    </motion.g>
  );
});
```

- **REMOVED**: `color` prop (no longer on `BubbleNode`), `<text>` element and `showText`/`fontSize` logic.
- **CHANGED**: `onBubbleHover` signature now passes `(title, mx.get(), my.get(), radius)` — bubble-center-relative coordinates, not cursor coordinates.
- **ADDED**: `onBubbleClick` prop, `onClick` handler guards against firing during elimination.
- **ALL BUBBLES**: `fill="#2a5e49"` with `fillOpacity` varying by final-match state.
- **VALIDATE**: `npx tsc --noEmit` (no type errors from removed `color` prop).

---

### TASK 6: UPDATE `components/discovery/BubbleField.tsx` — external tooltip, click handler, popup

Replace the entire file:

```tsx
"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useBubbleSimulation, type NodeSetters } from "@/hooks/useBubbleSimulation";
import { ResourceBubble } from "./ResourceBubble";
import { BubbleCounter } from "./BubbleCounter";
import { ResourcePopup } from "./ResourcePopup";
import type { BubbleNode } from "@/hooks/useBubbleState";

interface BubbleFieldProps {
  bubbles: BubbleNode[];
  activeCount: number;
  onBubbleEliminated: (id: string) => void;
}

export function BubbleField({ bubbles, activeCount, onBubbleEliminated }: BubbleFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Tooltip: positioned above bubble top edge (never inside the bubble)
  const [tooltip, setTooltip] = useState<{ title: string; x: number; y: number } | null>(null);

  // Selected bubble for popup
  const [selectedBubble, setSelectedBubble] = useState<BubbleNode | null>(null);

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

  // Hover: receives bubble center (bx, by) + radius from ResourceBubble
  // Positions tooltip above the bubble's top edge, centered horizontally
  const handleBubbleHover = useCallback((title: string, bx: number, by: number, radius: number) => {
    const tooltipY = by - radius - 12;
    setTooltip({ title, x: bx, y: tooltipY });
  }, []);

  const handleBubbleLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Click: use ref so this callback is stable across bubble state changes
  const bubblesRef = useRef(bubbles);
  bubblesRef.current = bubbles;

  const handleBubbleClick = useCallback((id: string) => {
    const bubble = bubblesRef.current.find(b => b.id === id);
    if (bubble && bubble.status === "active") {
      setTooltip(null); // hide tooltip when popup opens
      setSelectedBubble(bubble);
    }
  }, []);

  const handleClosePopup = useCallback(() => {
    setSelectedBubble(null);
  }, []);

  const activeBubbles = bubbles.filter(b => b.status === "active");
  useBubbleSimulation(activeBubbles, canvasSize.width, canvasSize.height, nodeSettersRef);

  const isFinalPhase = activeCount <= 5;
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

      {/* Hover tooltip — always above the bubble top edge, centered on bubble x */}
      {tooltip && !selectedBubble && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",  // centered horizontally, sits just above the top edge
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
            maxWidth: "280px",
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
              initialDelay={index * 0.007}
              isFinalMatch={isFinalPhase && bubble.status === "active"}
              onEliminated={onBubbleEliminated}
              onRegister={handleRegister}
              onUnregister={handleUnregister}
              onBubbleHover={handleBubbleHover}
              onBubbleLeave={handleBubbleLeave}
              onBubbleClick={handleBubbleClick}
            />
          ))}
        </AnimatePresence>
      </svg>

      {/* Resource popup — rendered inside BubbleField so it's clipped to the canvas */}
      {selectedBubble && (
        <ResourcePopup bubble={selectedBubble} onClose={handleClosePopup} />
      )}
    </div>
  );
}
```

- **TOOLTIP POSITIONING**: `left: bx, top: by - radius - 12, transform: "translate(-50%, -100%)"`. `bx` is the SVG bubble center x (container-relative), `by - radius - 12` is 12px above the bubble top edge. `translate(-50%, -100%)` centers the tooltip box horizontally on the bubble center and anchors the tooltip's bottom to that point.
- **TOOLTIP HIDDEN WHILE POPUP OPEN**: `{tooltip && !selectedBubble && ...}` — no tooltip when a popup is visible.
- **`bubblesRef` pattern**: `handleBubbleClick` captures `bubblesRef.current` at call time (not at hook creation time), so it's always up-to-date without being recreated on every `bubbles` state change. This preserves `React.memo` stability.
- **`isFinalPhase = activeCount <= 5`** (changed from ≤3): Highlights the final 5 bubbles when they remain, matching the top-5 results flow.
- **VALIDATE**: Hover over a small bubble — verify tooltip appears above it, not inside. Hover over a large bubble at any point inside — verify tooltip still appears above the top edge. Click a bubble — verify popup opens. Click backdrop — closes. Press Escape — closes.

---

### TASK 7: UPDATE `app/page.tsx` — fix type hint for resource shape

In the `useEffect` that loads resources on mount, the inline type hint `{ id: string }` on the `map` call is outdated. Update it to reflect the new resource shape:

```tsx
// Before:
intake.initFilterPool(resources.map((r: { id: string }) => r.id));

// After:
intake.initFilterPool(resources.map((r: { id: string; title: string; topics: string[]; description: string | null; link: string | null }) => r.id));
```

Or simply remove the inline type and let TypeScript infer from the API response shape:

```tsx
intake.initFilterPool(resources.map((r: { id: string }) => r.id));
// Keep as-is if TypeScript does not complain — the id field is still present.
```

- **NOTE**: If `sql-deterministic-intake-filtering` plan has already been executed, `app/page.tsx` already has `initFilterPool` and this type hint update is the only change needed. If not, the page still uses the old `confirmedAnswers` approach — in that case, only the `initBubbles(data.resources)` call needs the type to be correct, which TypeScript will infer automatically.
- **VALIDATE**: `npx tsc --noEmit` — zero errors.

---

## TESTING STRATEGY

No test framework configured. Manual browser validation.

### Manual Test Scenarios

**Color validation:**
1. Load `localhost:3000`
2. All 213 bubbles should be `#2a5e49` (green) — no blue, amber, pink, or violet bubbles
3. No text labels visible inside any bubble at any size

**Grid distribution:**
1. After bubbles load, verify they fill the full right-panel area — top to bottom, left to right
2. No cluster in the center; bubbles should be roughly evenly spaced
3. Resize the browser window — bubbles reflow to fill the new canvas dimensions

**Hover tooltip:**
1. Hover over any bubble (small radius ~13px) — tooltip appears above the bubble
2. Hover over a large bubble (~60–80px radius, when few remain) — cursor deep inside the bubble — tooltip still appears above the bubble's top edge, not above the cursor
3. Move cursor off bubble — tooltip disappears

**Click popup:**
1. Click any bubble — popup appears centered in the canvas with backdrop
2. Popup shows: resource title, description, topics, "Learn more" link
3. Click the backdrop — popup closes
4. Press Escape — popup closes
5. Click the × button — popup closes
6. Click inside the popup card (not backdrop) — popup does NOT close

**Elimination:**
1. Answer a question
2. Bubbles that no longer match start their exit animation (~0.5s) immediately after the API responds
3. Counter decrements as each bubble disappears
4. Remaining bubbles reflow to new grid positions

### Edge Cases

- Bubble near top edge: tooltip may overflow above canvas → acceptable (clipped by `overflow: hidden`)
- Popup opened on a bubble that gets eliminated: bubble disappears behind the popup — popup remains open since `selectedBubble` is a snapshot of `BubbleNode`, not a live reference
- All questions skipped: all 213 bubbles remain; layout stays grid-like
- Only 1 bubble remains: single bubble centered in canvas, `isFinalMatch: true`, green glow

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

### Level 4: Manual browser
```bash
npm run dev
# Open localhost:3000
# Complete all manual test scenarios above
```

---

## ACCEPTANCE CRITERIA

- [ ] All bubbles render as `#2a5e49` — no topic-based colors
- [ ] No text labels inside bubbles at any size
- [ ] Bubbles fill the full canvas area (top/bottom/left/right), not clustered center
- [ ] After each answer, remaining bubbles reflow to fill updated grid
- [ ] Hovering any bubble shows title tooltip above the bubble top edge — never inside
- [ ] Tooltip is centered horizontally above the bubble regardless of cursor position within the bubble
- [ ] Clicking an active bubble opens `ResourcePopup` centered in the canvas
- [ ] Popup shows title, description, topic tags, and "Learn more" link
- [ ] Clicking backdrop closes popup
- [ ] Pressing Escape closes popup
- [ ] Clicking inside the popup card does not close it
- [ ] Tooltip is hidden while popup is open
- [ ] `BubbleNode` has `description`, `topics`, `link` fields (no `color`)
- [ ] `/api/discovery/start` returns `description` and `link` fields
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` succeeds

---

## COMPLETION CHECKLIST

- [ ] Start API returns `description` and `link`
- [ ] `BubbleNode` has `description`/`topics`/`link`, no `color`
- [ ] `useBubbleSimulation` uses `forceX`/`forceY` grid layout
- [ ] `ResourceBubble` has no inner text, uniform green color, click handler, new hover signature
- [ ] `BubbleField` tooltip positioned above bubble top edge; popup state managed
- [ ] `ResourcePopup` created and integrated
- [ ] TypeScript, lint, and build clean

---

## NOTES

### Why forceX/forceY instead of forceCenter

`forceCenter` pulls all nodes toward a single point — by design it creates clustering. `forceX`/`forceY` assign each node an individual target position derived from a grid. The collision force prevents overlap while X/Y forces distribute bubbles across the full canvas. When bubble count changes, grid positions recalculate and bubbles animate to their new targets as the simulation restarts.

### Why No Text Inside Bubbles

At the initial radius (~13px for 213 bubbles), text is 4–5px and unreadable. At large radii (~60–80px for the final few), a title like "Utah Veteran Entrepreneur Program" overflows the circle. The external tooltip solves both cases without compromise: always readable, always outside, never clutters the visual.

### Why Tooltip Uses Bubble Center Not Cursor

If the cursor is near the bottom of a large bubble (radius 70px), `clientY - 36px` still leaves the tooltip inside the bubble. By using `mx.get()` and `my.get()` (the MotionValue current values — the bubble's actual center in container coordinates), and offsetting by `radius + 12`, the tooltip is guaranteed to be above the bubble's geometric edge regardless of where inside the bubble the cursor is.

### Why `isFinalPhase = activeCount <= 5`

Changed from ≤3 to ≤5 to match the top-5 results flow in the SQL-deterministic intake plan. The final 5 matching resources get the stronger green treatment, preparing the user visually for the result reveal.

### Popup vs. Side Panel

A centered popup (rather than a side drawer or inline expansion) keeps the bubble canvas unobstructed for as long as possible. The backdrop clearly signals "this is a temporary overlay, click anywhere to continue." The popup is contained within the BubbleField's `overflow: hidden` boundary, so it won't bleed into the voice intake panel on the left.

### Confidence Score

**9/10** — All changes are isolated to well-understood files with clear existing patterns. Main risk: tooltip edge cases near the canvas boundary (top overflow). This is acceptable for the demo — the canvas has sufficient height that most bubbles won't be near the very top.
