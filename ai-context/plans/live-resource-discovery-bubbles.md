# Feature: Live Resource Discovery & Elimination Experience

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files. This project uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — NOT `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Feature Description

A new page at `/discover` that presents all 213 Utah state resources as animated SVG bubbles on a black canvas. The user answers four clarifying questions via text/checkbox inputs on a left panel; after each submission, low-similarity resources are eliminated (shrink + fade to zero), and the remaining bubbles re-cluster via a d3-force physics simulation. A counter in the canvas corner decrements in real time. When ≤3 resources remain, they are highlighted and a details card reveals the full resource information.

This is an alternative to the existing voice intake on `/`. It uses the same resource data and `text-embedding-3-small` embeddings, replaces voice with structured inputs, and replaces the post-intake results page with a live visual elimination experience.

## User Story

As a Utah founder,  
I want to watch 213 resource bubbles narrow down to my best matches as I answer questions,  
So that I can feel the specificity of the matching and arrive at my top resources through an engaging, visual experience.

## Problem Statement

The existing voice intake sends users to a static results page after all four questions are answered, with no real-time feedback during matching. Users have no sense of how the pool narrows or how specific their results are.

## Solution Statement

Build a split-screen `/discover` page where structured text/checkbox answers drive a live elimination loop: each answer is embedded using `text-embedding-3-small`, scored against all non-eliminated resources via a new Supabase RPC, and the bottom 20–28% by similarity score are eliminated each round. The bubble canvas is driven by d3-force simulation via MotionValues — bypassing React's render cycle entirely for position updates.

## Feature Metadata

**Feature Type**: New Capability  
**Estimated Complexity**: High  
**Primary Systems Affected**: New `/discover` route, new `/api/discovery/*` routes, new hooks, new components, one new Supabase RPC  
**Dependencies to install**: `framer-motion d3-force @types/d3-force` (new installs); `openai` already in dependencies

---

## DESIGN CONSTRAINT NOTE: Animation Durations

The project CLAUDE.md specifies "No animations longer than 400ms" for the intake flow. The discovery feature intentionally requires longer durations because animation IS the product:
- 1.5s staggered bubble entry (visual centerpiece)
- 600ms elimination fade-out per bubble
- 800ms simulation re-settle

**These durations apply only to `/discover`. Do not reduce them. The 400ms constraint applies to the intake flow on `/`, not to this page.**

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `lib/matching/vectorSearch.ts` (lines 31–36) — Confirms `text-embedding-3-small` and 1536 dimensions. The new discovery RPC must use the same vector type.
- `supabase/migrations/20250501000002_create_match_resources_rpc.sql` — Pattern to mirror when writing the new discovery RPC. The new RPC differs: it filters by `excluded_ids` (not `candidate_ids`) and returns ALL non-excluded resources with no LIMIT.
- `supabase/migrations/20250501000000_create_resources.sql` (lines 18–21) — Confirms `embedding vector(1536)` column and existing `IVFFLAT` index with `lists = 50`. No new index needed.
- `app/api/match-resources/route.ts` (lines 15–19) — Service role Supabase client instantiation pattern. Mirror exactly in discovery routes.
- `app/api/process-answer/route.ts` (lines 5, 33–38) — Anthropic SDK instantiation pattern; OpenAI embedding pattern is in `lib/matching/vectorSearch.ts`.
- `app/globals.css` (lines 60–63, 64–68) — Utility classes + `@keyframes mic-pulse` CSS animation pattern. Add new keyframes here if needed.
- `app/layout.tsx` (lines 17–23) — `--font-instrument-serif` CSS variable loaded with `weight: ["400"]`, `style: ["normal", "italic"]`.
- `components/results/ResourceCard.tsx` — Reuse directly in `FinalMatch`. Do not duplicate.
- `components/intake/QuestionDisplay.tsx` — System-sans question text style to mirror in `QuestionPanel`.
- `hooks/useAnonymousAuth.ts` — Import for consistent session tracking; `user?.id` available as a stable UUID.
- `lib/supabase/client.ts` — Browser client. Uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `lib/supabase/server.ts` — Server client: always instantiate inside the function body, never at module level.
- `app/results/page.tsx` (lines 92–147) — Add a link to `/discover` here (see Task 16).

### New Files to Create

**SQL Migration:**
- `supabase/migrations/20250501000003_create_discovery_rpc.sql`

**API Routes:**
- `app/api/discovery/start/route.ts` — GET: returns all 213 `{id, title}` records
- `app/api/discovery/answer/route.ts` — POST: stateless scoring + elimination list

**Hooks:**
- `hooks/useDiscoverySession.ts` — Owns answer state, `eliminatedIds[]`, `questionIndex`, `isLocked`, submission logic + question definitions
- `hooks/useBubbleState.ts` — Owns bubble list with status (`active | eliminating | eliminated`) and dynamic radius
- `hooks/useBubbleSimulation.ts` — Drives d3-force simulation; updates MotionValues directly via a setters ref map (zero React re-renders for position)

**Components:**
- `components/discovery/ResourceBubble.tsx` — Single `motion.g`; owns its own `mx`/`my` MotionValues; registers setters with parent
- `components/discovery/BubbleCounter.tsx` — Animated count display
- `components/discovery/BubbleField.tsx` — SVG canvas; manages setter registration map + canvas sizing; renders bubbles
- `components/discovery/QuestionPanel.tsx` — Left panel with multiselect/text inputs; locks during animation
- `components/discovery/FinalMatch.tsx` — Reveals `ResourceCard` components for final 1–3 resources

**Page:**
- `app/discover/page.tsx` — Client component; split-screen layout; wires all hooks + components

---

## CRITICAL ARCHITECTURE: d3-force + MotionValues

This is the single most important pattern to get right. **Do not use React state for bubble positions.** 213 nodes × 60fps ticks = thousands of state updates per second, which React cannot reconcile fast enough.

### The Correct Pattern

Each `ResourceBubble` creates its own pair of MotionValues (`mx`, `my`) and registers their `.set` callbacks with the parent's ref map. The d3 simulation tick handler reads node positions and calls those setters directly — framer-motion updates the DOM without ever touching React state.

```
d3 tick → node.x, node.y updated → setter callbacks called → MotionValues updated → DOM updated
          (pure mutation)          (via ref map)              (no React renders)     (framer-motion)
```

React state is used **only** for bubble status (`active | eliminating | eliminated`) and radius — these change ~4 times total (once per elimination round), not 60 times per second.

### MotionValue Per Node (in ResourceBubble)
```ts
const mx = useMotionValue(0);   // initial 0,0 → d3 pushes to real position on first tick
const my = useMotionValue(0);
```

### Setter Registration (parent → simulation link)
```ts
// In BubbleField — a ref map owned by the canvas component
const nodeSettersRef = useRef<Map<string, { setX: (v: number) => void; setY: (v: number) => void }>>(new Map());
```

### Simulation Tick Updates MotionValues
```ts
// In useBubbleSimulation tick handler
sim.on('tick', () => {
  simNodes.forEach(node => {
    const setters = nodeSettersRef.current.get(node.id);
    setters?.setX(node.x ?? 0);
    setters?.setY(node.y ?? 0);
  });
});
```

### SVG Scale-Origin Fix (REQUIRED on every motion.g)

framer-motion applies `scale` as a CSS transform, not an SVG transform attribute. Without `transform-box: fill-box`, the scale origin defaults to the SVG viewport's top-left corner — bubbles fly off-screen when scaling to zero. Fix with:

```tsx
<motion.g
  style={{
    x: mx,
    y: my,
    transformBox: "fill-box",   // ← REQUIRED: anchors transform-origin to element bounds
    transformOrigin: "center",  // ← REQUIRED: scales from element center
  }}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0, opacity: 0 }}
>
```

---

## Relevant Documentation

- [framer-motion — motion component](https://motion.dev/docs/react-motion-component): `style` + `animate` are independent — `x`/`y` in `style` are instant (no interpolation), `scale`/`opacity` in `animate` are interpolated. No conflict.
- [framer-motion — MotionValues](https://motion.dev/docs/react-motion-value): `motionValue.set()` bypasses React render cycle entirely, updates DOM directly.
- [framer-motion — SVG Animation](https://motion.dev/docs/react-svg-animation): Confirms `transform-box: fill-box` is required for correct SVG scale origin.
- [framer-motion — useAnimate](https://motion.dev/docs/react-use-animate): Imperative `animate()` supports SVG elements and scale/opacity.
- [d3-force](https://d3js.org/d3-force): `forceSimulation`, `forceCollide`, `forceCenter`, `forceManyBody`, `simulation.on('tick')`, `simulation.alpha()`, `simulation.restart()`.

---

## Patterns to Follow

**Inline styles everywhere (not Tailwind classes on new components):**
```tsx
// All discovery components follow the same inline-style convention as intake components
style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", fontSize: "0.875rem", color: "#666" }}
```

**Service role Supabase client (API routes only):**
```ts
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
// Instantiate inside the handler function body — never at module level
```

**API route response:**
```ts
import { NextResponse } from "next/server";
return NextResponse.json({ key: "value" });
return NextResponse.json({ error: "message" }, { status: 400 });
```

**Color constants:**
```
black:        #000000   — all page/panel backgrounds
white:        #FFFFFF   — primary text
accent:       #2a5e49   — foreground/stroke only, never as a fill
muted:        #666666   — secondary text
bubble-fill:  #111111   — SVG circle fill (neutral dark, NOT a colored background)
bubble-stroke-default: #2a2a2a
bubble-stroke-final:   #2a5e49  (accent as stroke only — final 1-3 bubbles)
```

**d3-force imports (subpackage, not full d3 barrel):**
```ts
import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
} from "d3-force";
```
This avoids bundling `d3-selection`, `d3-transition`, and other d3 DOM modules that conflict with React's virtual DOM.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation
Install packages, create Supabase migration.

### Phase 2: API Routes
Two stateless routes: session start (GET all resources) and answer submission (embed + score + eliminate).

### Phase 3: Hooks
Build in dependency order: `useBubbleState` (pure state) → `useBubbleSimulation` (d3 + setters) → `useDiscoverySession` (API orchestration).

### Phase 4: Components — Bottom-Up
`ResourceBubble` → `BubbleCounter` → `BubbleField` → `QuestionPanel` → `FinalMatch`.

### Phase 5: Page + Linking
`app/discover/page.tsx` → add navigation link from results page.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

---

### TASK 1: UPDATE `package.json` — Add dependencies

- **IMPLEMENT**: Add to `dependencies`:
  ```json
  "framer-motion": "^11.0.0",
  "d3-force": "^3.0.0"
  ```
  Add to `devDependencies`:
  ```json
  "@types/d3-force": "^3.0.10"
  ```
  Note: `d3-force` is the physics-only subpackage. Do NOT install the full `d3` barrel — it bundles d3's DOM modules (`d3-selection`, `d3-transition`) which conflict with React's virtual DOM.

- **GOTCHA**: `framer-motion` v11 is correct. Do NOT install `motion` (the successor package) — the import paths differ. All imports in this plan use `from "framer-motion"`.
- **VALIDATE**: `npm install && npx tsc --noEmit 2>&1 | head -20`

---

### TASK 2: CREATE `supabase/migrations/20250501000003_create_discovery_rpc.sql`

- **IMPLEMENT**:
  ```sql
  create or replace function score_resources_for_discovery(
    query_embedding vector(1536),
    excluded_ids    uuid[]
  )
  returns table (
    id          uuid,
    title       text,
    similarity  float
  )
  language sql stable as $$
    select
      id,
      title,
      1 - (embedding <=> query_embedding) as similarity
    from resources
    where
      cardinality(excluded_ids) = 0
      or id != all(excluded_ids)
    order by similarity desc
  $$;
  ```

  Note on the WHERE clause: `cardinality(excluded_ids) = 0` handles the case where `excluded_ids` is an empty array `'{}'::uuid[]`. Without this guard, `id != all('{}')` is always true in Postgres (correct), but the `cardinality` check makes the intent explicit and avoids any NULL edge cases.

- **CRITICAL**: Run this SQL in the Supabase SQL editor before testing any API routes. If the function doesn't exist, the answer route will return a 500 with "function does not exist".
- **VALIDATE**: In Supabase SQL editor, run:
  ```sql
  SELECT id, title, similarity
  FROM score_resources_for_discovery(
    (SELECT embedding FROM resources LIMIT 1),
    '{}'::uuid[]
  )
  LIMIT 5;
  ```
  Should return 5 rows with `similarity` values between 0 and 1.

---

### TASK 3: CREATE `app/api/discovery/start/route.ts`

- **IMPLEMENT**:
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
      .select("id, title")
      .order("external_id");

    if (error) {
      return NextResponse.json({ error: "Failed to load resources" }, { status: 500 });
    }

    return NextResponse.json({ resources: data ?? [] });
  }
  ```
- **RESPONSE**: `{ resources: Array<{ id: string; title: string }> }` — 213 items
- **VALIDATE**: `curl http://localhost:3000/api/discovery/start | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['resources']), 'resources')"`  — should print `213 resources`

---

### TASK 4: CREATE `app/api/discovery/answer/route.ts`

- **IMPLEMENT**: Stateless POST handler. Embeds all cumulative answers, scores all non-excluded resources, returns which to eliminate.

  **Request type** (define at top of file):
  ```ts
  interface AnswerData {
    questionId: string;  // 'communities' | 'location' | 'business' | 'need'
    selected?: string[]; // for multiselect
    text?: string;       // for free-text
  }

  interface AnswerRequest {
    answers: AnswerData[];     // all answers submitted so far (cumulative)
    excludedIds: string[];     // already eliminated resource IDs
    questionIndex: number;     // 0-based index of current question (for threshold)
  }
  ```

  **Implementation**:
  ```ts
  import { NextResponse } from "next/server";
  import OpenAI from "openai";
  import { createClient } from "@supabase/supabase-js";

  function buildQueryString(answers: AnswerData[]): string {
    const parts: string[] = ["Utah business founder"];
    for (const answer of answers) {
      if (answer.questionId === "communities" && answer.selected?.length) {
        parts.push(`identifies as: ${answer.selected.join(", ")}`);
      }
      if (answer.questionId === "location" && answer.text?.trim()) {
        parts.push(`located in ${answer.text.trim()}, Utah`);
      }
      if (answer.questionId === "business" && answer.text?.trim()) {
        parts.push(answer.text.trim());
      }
      if (answer.questionId === "need" && answer.selected?.length) {
        parts.push(`needs help with: ${answer.selected.join(", ")}`);
      }
    }
    return parts.join(". ");
  }

  function computeEliminations(
    scored: Array<{ id: string; similarity: number }>,
    questionIndex: number
  ): string[] {
    if (scored.length <= 5) return []; // never go below 5
    const rates = [0.20, 0.22, 0.25, 0.28];
    const rate = rates[Math.min(questionIndex, 3)];
    const maxEliminate = Math.floor(scored.length * Math.min(rate, 0.30));
    const safeEliminate = Math.min(maxEliminate, scored.length - 5);
    if (safeEliminate <= 0) return [];
    // Sorted ascending by similarity — eliminate the lowest-scoring
    const sorted = [...scored].sort((a, b) => a.similarity - b.similarity);
    return sorted.slice(0, safeEliminate).map(s => s.id);
  }

  export async function POST(req: Request) {
    const body = (await req.json()) as AnswerRequest;
    const { answers, excludedIds, questionIndex } = body;

    if (!answers?.length || questionIndex < 0 || questionIndex > 3) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const queryString = buildQueryString(answers);
    const embRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: queryString,
    });
    const embedding = embRes.data[0].embedding;

    const { data: scored, error } = await supabase.rpc(
      "score_resources_for_discovery",
      {
        query_embedding: embedding,
        excluded_ids: excludedIds ?? [],
      }
    );

    if (error) {
      console.error("score_resources_for_discovery error:", error);
      return NextResponse.json({ error: "Scoring failed" }, { status: 500 });
    }

    const eliminate = computeEliminations(
      (scored ?? []) as Array<{ id: string; similarity: number }>,
      questionIndex
    );

    return NextResponse.json({ eliminate });
  }
  ```

- **VALIDATE**:
  ```bash
  curl -X POST http://localhost:3000/api/discovery/answer \
    -H 'Content-Type: application/json' \
    -d '{"answers":[{"questionId":"communities","selected":["Veteran"]}],"excludedIds":[],"questionIndex":0}' \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Eliminating {len(d[\"eliminate\"])} resources')"
  ```
  Should print `Eliminating 42 resources` (approximately 20% of 213).

---

### TASK 5: CREATE `hooks/useBubbleState.ts`

- **IMPLEMENT**:
  ```ts
  "use client";
  import { useState, useCallback } from "react";

  export type BubbleStatus = "active" | "eliminating" | "eliminated";

  export interface BubbleNode {
    id: string;
    title: string;
    status: BubbleStatus;
    radius: number;
  }

  interface UseBubbleStateReturn {
    bubbles: BubbleNode[];
    activeCount: number;
    initBubbles: (resources: Array<{ id: string; title: string }>) => void;
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
      (resources: Array<{ id: string; title: string }>) => {
        const count = resources.length;
        setInitialCount(count);
        const radius = computeRadius(count, count);
        setBubbles(
          resources.map(r => ({
            id: r.id,
            title: r.title,
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

- **RADIUS**: `13 * sqrt(213 / activeCount)` clamped 12–80px. Gives ~13px at 213 bubbles, ~25px at 50, ~56px at 10, caps at 80px near ~4 bubbles.
- **VALIDATE**: Call `initBubbles` with 3 mock resources, `triggerElimination(['id1'])`, confirm `bubbles.find(b => b.id === 'id1').status === 'eliminating'`. Then `onBubbleEliminated('id1')`, confirm it becomes `'eliminated'` and activeCount is 2.

---

### TASK 6: CREATE `hooks/useBubbleSimulation.ts`

- **IMPLEMENT**: Drives d3-force simulation. Updates bubble positions by calling MotionValue setters registered in the parent's ref map — **zero React state updates for position**.

  ```ts
  "use client";
  import { useEffect, useRef } from "react";
  import {
    forceSimulation,
    forceManyBody,
    forceCenter,
    forceCollide,
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

      // Preserve positions of nodes carried over from previous simulation run
      if (simRef.current) {
        simRef.current.nodes().forEach((n: SimNode) => {
          if (n.x != null && n.y != null) {
            prevPositionsRef.current.set(n.id, { x: n.x, y: n.y });
          }
        });
        simRef.current.stop();
      }

      const simNodes: SimNode[] = activeBubbles.map(b => {
        const prev = prevPositionsRef.current.get(b.id);
        return {
          id: b.id,
          radius: b.radius,
          x: prev?.x ?? width / 2 + (Math.random() - 0.5) * 40,
          y: prev?.y ?? height / 2 + (Math.random() - 0.5) * 40,
        };
      });

      const sim = forceSimulation<SimNode>(simNodes)
        .force(
          "collision",
          forceCollide<SimNode>(n => n.radius + 3).strength(0.8)
        )
        .force("center", forceCenter(width / 2, height / 2).strength(0.04))
        .force("charge", forceManyBody<SimNode>().strength(-20))
        .alphaDecay(0.02)
        .velocityDecay(0.4);

      sim.on("tick", () => {
        simNodes.forEach(node => {
          const setters = nodeSettersRef.current?.get(node.id);
          if (setters && node.x != null && node.y != null) {
            setters.setX(node.x);
            setters.setY(node.y);
          }
        });
      });

      simRef.current = sim;

      return () => {
        sim.stop();
      };
    // Re-run when active bubble list or canvas size changes (i.e., after each elimination round)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeBubbles.length, width, height]);
  }
  ```

- **KEY POINTS**:
  - Restarts simulation when `activeBubbles.length` changes (after eliminations) — reheat is implicit since new simulation starts with `alpha = 1`.
  - Preserves existing positions via `prevPositionsRef` so remaining bubbles don't teleport.
  - New bubbles default to center ± 20px so they bloom outward — the d3 simulation pushes them to their final positions.
  - Uses `activeBubbles.length` as the dependency (not the full array) to avoid re-running on every render.
- **GOTCHA**: `nodeSettersRef` is a ref, not a reactive value. The setter map is populated by `ResourceBubble` components on mount. On first run, the ref may be empty if bubbles haven't mounted yet — the tick handler guards with `if (setters)` so this is safe.
- **VALIDATE**: Instantiate with 5 mock `activeBubbles` in a 400x300 canvas with a mock setters map. After 200ms, verify `setX`/`setY` have been called with non-zero values.

---

### TASK 7: CREATE `hooks/useDiscoverySession.ts`

- **IMPLEMENT**: Owns all session logic: question definitions, answer accumulation, `eliminatedIds`, API calls, loading/locked state.

  ```ts
  "use client";
  import { useState, useCallback } from "react";

  // ── Question definitions ──────────────────────────────────────────

  export interface AnswerData {
    questionId: string;
    selected?: string[];
    text?: string;
  }

  export type QuestionType = "multiselect" | "text";

  export interface DiscoveryQuestion {
    id: string;
    type: QuestionType;
    question: string;
    options?: string[];
    placeholder?: string;
    hint?: string;
  }

  export const DISCOVERY_QUESTIONS: DiscoveryQuestion[] = [
    {
      id: "communities",
      type: "multiselect",
      question: "Do you identify with any of these founder communities?",
      options: ["Veteran", "Woman", "Rural", "Immigrant", "LGBTQ+"],
      hint: "Select all that apply, or skip.",
    },
    {
      id: "location",
      type: "text",
      question: "Where in Utah are you based or operating?",
      placeholder: "e.g. Salt Lake City, Washington County, Cache Valley",
    },
    {
      id: "business",
      type: "text",
      question: "Tell me about your business and where you are in the journey.",
      placeholder: "What do you do? Are you in the idea stage, just starting, or already running?",
    },
    {
      id: "need",
      type: "multiselect",
      question: "What’s the most pressing thing you need help with?",
      options: ["Funding", "Getting Started", "Growing a Business", "Marketing", "Networking"],
      hint: "Select all that apply.",
    },
  ];

  // ── Hook ────────────────────────────────────────────────────────────

  interface UseDiscoverySessionReturn {
    questionIndex: number;
    isLoading: boolean;
    isLocked: boolean;
    isComplete: boolean;
    submitAnswer: (answer: AnswerData) => Promise<{ eliminate: string[] }>;
    onEliminationComplete: () => void;
  }

  export function useDiscoverySession(): UseDiscoverySessionReturn {
    const [questionIndex, setQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<AnswerData[]>([]);
    const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    const isComplete = questionIndex >= DISCOVERY_QUESTIONS.length;

    const submitAnswer = useCallback(
      async (answer: AnswerData): Promise<{ eliminate: string[] }> => {
        const updatedAnswers = [...answers, answer];
        setAnswers(updatedAnswers);
        setIsLoading(true);

        try {
          const res = await fetch("/api/discovery/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              answers: updatedAnswers,
              excludedIds: eliminatedIds,
              questionIndex,
            }),
          });
          const data = await res.json() as { eliminate: string[] };
          setEliminatedIds(prev => [...prev, ...(data.eliminate ?? [])]);
          setIsLocked(true);
          return { eliminate: data.eliminate ?? [] };
        } finally {
          setIsLoading(false);
        }
      },
      [answers, eliminatedIds, questionIndex]
    );

    const onEliminationComplete = useCallback(() => {
      setIsLocked(false);
      setQuestionIndex(prev => prev + 1);
    }, []);

    return {
      questionIndex,
      isLoading,
      isLocked,
      isComplete,
      submitAnswer,
      onEliminationComplete,
    };
  }
  ```

- **VALIDATE**: Mock `fetch` in a test component. Call `submitAnswer(...)`, verify `isLocked` becomes true. Call `onEliminationComplete()`, verify `isLocked` false and `questionIndex` increments.

---

### TASK 8: CREATE `components/discovery/ResourceBubble.tsx`

- **IMPLEMENT**: A single `motion.g` element. Owns its own `mx`/`my` MotionValues. Registers setter callbacks with the parent on mount.

  ```tsx
  "use client";
  import React, { useEffect, useRef } from "react";
  import { motion, useMotionValue, AnimatePresence } from "framer-motion";
  import type { BubbleStatus } from "@/hooks/useBubbleState";
  import type { NodeSetters } from "@/hooks/useBubbleSimulation";

  interface ResourceBubbleProps {
    id: string;
    title: string;
    status: BubbleStatus;
    radius: number;
    initialDelay: number;      // stagger entry: index * 0.007
    isFinalMatch: boolean;
    onEliminated: (id: string) => void;
    onRegister: (id: string, setters: NodeSetters) => void;
    onUnregister: (id: string) => void;
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
  }: ResourceBubbleProps) {
    const mx = useMotionValue(0);
    const my = useMotionValue(0);

    // Register setters on mount so d3 tick can update position
    useEffect(() => {
      onRegister(id, { setX: v => mx.set(v), setY: v => my.set(v) });
      return () => onUnregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const isEliminating = status === "eliminating";
    const fontSize = Math.min(10, radius * 0.4);
    const showText = radius >= 20;

    return (
      <motion.g
        style={{
          x: mx,
          y: my,
          transformBox: "fill-box",    // ← REQUIRED: SVG scale-origin fix
          transformOrigin: "center",   // ← REQUIRED: scale from element center
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={
          isEliminating
            ? { scale: 0, opacity: 0 }
            : { scale: 1, opacity: 1 }
        }
        transition={
          isEliminating
            ? { duration: 0.6, ease: "easeIn" }
            : { duration: 0.3, delay: initialDelay, ease: "easeOut" }
        }
        onAnimationComplete={() => {
          if (isEliminating) onEliminated(id);
        }}
      >
        <circle
          r={radius}
          fill="#111111"
          stroke={isFinalMatch ? "#2a5e49" : "#2a2a2a"}
          strokeWidth={isFinalMatch ? 2 : 1}
        />
        {showText && (
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize,
              fill: "#666666",
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {title.length > 20 ? title.slice(0, 18) + "…" : title}
          </text>
        )}
        <title>{title}</title>
      </motion.g>
    );
  });
  ```

- **`React.memo`**: Required. `BubbleField` re-renders when `bubbles` state changes (after each elimination round). Without memo, all 213+ components re-render unnecessarily on every round.
- **`onRegister` in `useEffect`**: The dep array only contains `id` because `onRegister`/`onUnregister` are stable refs from `BubbleField` (created via `useCallback`). Including them would cause re-registration loops.
- **`onAnimationComplete` guard**: framer-motion fires `onAnimationComplete` for both entry and exit. The `if (isEliminating)` guard ensures only the exit animation triggers `onEliminated`.
- **`<title>{title}</title>`**: Native SVG tooltip on hover — no tooltip library needed.
- **VALIDATE**: Render in a fixed-size SVG. Verify entry animation (scale 0→1). Set status to `"eliminating"`, verify scale 0 + `onEliminated` fires. Verify the bubble scales from center (not from viewport corner).

---

### TASK 9: CREATE `components/discovery/BubbleCounter.tsx`

- **IMPLEMENT**:
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
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "2px",
          pointerEvents: "none",
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
            color: "#444",
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
- **VALIDATE**: Change `count` prop and verify the number slides out/in with the 200ms transition.

---

### TASK 10: CREATE `components/discovery/BubbleField.tsx`

- **IMPLEMENT**: The SVG canvas. Owns the `nodeSettersRef` map, measures its own container, passes setters to `useBubbleSimulation`, renders all active/eliminating bubbles.

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

    // Measure container responsively
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

    // Setter registration map for d3 → MotionValue updates
    const nodeSettersRef = useRef<Map<string, NodeSetters>>(new Map());

    const handleRegister = useCallback((id: string, setters: NodeSetters) => {
      nodeSettersRef.current.set(id, setters);
    }, []);

    const handleUnregister = useCallback((id: string) => {
      nodeSettersRef.current.delete(id);
    }, []);

    // d3 simulation — updates MotionValues via nodeSettersRef (no React state)
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
              />
            ))}
          </AnimatePresence>
        </svg>
      </div>
    );
  }
  ```

- **`activeBubbles` for simulation**: The simulation only needs to know about active nodes. Eliminating bubbles keep their last d3 position (their MotionValues stop being updated, but the values stay at the last position — correct behavior for the exit animation).
- **`visibleBubbles`**: Renders `active` + `eliminating` nodes. `eliminated` nodes are excluded since they've fully disappeared.
- **Stagger**: `index * 0.007s` per bubble. For 213 bubbles: `212 * 0.007 = 1.484s` total stagger — close to the 1.5s target.
- **`handleRegister`/`handleUnregister`**: Wrapped in `useCallback` with empty deps so their references are stable across renders, avoiding `ResourceBubble` re-registration loops.
- **VALIDATE**: Render with 5 mock bubbles, 600px×400px container. After 1s, verify all 5 are visible. Trigger elimination for 2 bubbles, verify they animate out and `onBubbleEliminated` fires twice.

---

### TASK 11: CREATE `components/discovery/QuestionPanel.tsx`

- **IMPLEMENT**: Left panel. Renders current question with the correct input type. Disables all inputs when `isLocked` is true.

  ```tsx
  "use client";
  import { useState, useEffect } from "react";
  import type { DiscoveryQuestion, AnswerData } from "@/hooks/useDiscoverySession";

  interface QuestionPanelProps {
    question: DiscoveryQuestion;
    questionIndex: number;
    isLocked: boolean;
    isLoading: boolean;
    onSubmit: (answer: AnswerData) => void;
  }

  export function QuestionPanel({
    question,
    questionIndex,
    isLocked,
    isLoading,
    onSubmit,
  }: QuestionPanelProps) {
    const [selected, setSelected] = useState<string[]>([]);
    const [text, setText] = useState("");

    // Reset inputs when question advances
    useEffect(() => {
      setSelected([]);
      setText("");
    }, [questionIndex]);

    const disabled = isLocked || isLoading;

    const toggleOption = (opt: string) =>
      setSelected(prev =>
        prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
      );

    const handleSubmit = () => {
      if (disabled) return;
      if (question.type === "multiselect") {
        onSubmit({ questionId: question.id, selected });
      } else {
        if (!text.trim()) return;
        onSubmit({ questionId: question.id, text: text.trim() });
      }
    };

    const handleSkip = () => {
      if (disabled) return;
      if (question.type === "multiselect") {
        onSubmit({ questionId: question.id, selected: [] });
      } else {
        onSubmit({ questionId: question.id, text: "" });
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Question text */}
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "1.25rem",
            color: "white",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {question.question}
        </p>

        {question.hint && (
          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.8rem",
              color: "#666",
              margin: 0,
            }}
          >
            {question.hint}
          </p>
        )}

        {/* Locked state */}
        {disabled && (
          <p
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontStyle: "italic",
              fontSize: "0.9rem",
              color: "#666",
              margin: 0,
            }}
          >
            Processing...
          </p>
        )}

        {/* Multiselect options */}
        {!disabled && question.type === "multiselect" && question.options && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {question.options.map(opt => (
              <button
                key={opt}
                onClick={() => toggleOption(opt)}
                style={{
                  padding: "8px 16px",
                  border: `1px solid ${selected.includes(opt) ? "white" : "#444"}`,
                  background: "transparent",
                  color: selected.includes(opt) ? "white" : "#888",
                  fontSize: "0.875rem",
                  fontFamily: "ui-sans-serif, system-ui, -apple-system",
                  cursor: "pointer",
                  transition: "border-color 200ms ease-out, color 200ms ease-out",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Text input */}
        {!disabled && question.type === "text" && (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={question.placeholder}
            rows={3}
            maxLength={500}
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.125rem",
              color: "white",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #444",
              outline: "none",
              width: "100%",
              resize: "none",
              padding: "8px 0",
              lineHeight: 1.6,
            }}
          />
        )}

        {/* Actions — always small text links, never full buttons */}
        {!disabled && (
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            {(question.type === "multiselect"
              ? selected.length > 0
              : text.trim().length > 0) && (
              <button
                onClick={handleSubmit}
                style={{
                  background: "none",
                  border: "none",
                  color: "#aaa",
                  fontSize: "0.8rem",
                  fontFamily: "ui-sans-serif, system-ui, -apple-system",
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                confirm
              </button>
            )}
            <button
              onClick={handleSkip}
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
              skip
            </button>
          </div>
        )}
      </div>
    );
  }
  ```

- **"confirm" only appears when there's something to confirm** — consistent with intake UX where confirm/skip are small text links.
- **`maxLength={500}`** on textarea — server-side also validates.
- **VALIDATE**: Render with a multiselect question. Toggle options, verify border brightens. Click "confirm", verify `onSubmit` called with correct `selected`. Click "skip", verify `onSubmit` called with `selected: []`.

---

### TASK 12: CREATE `components/discovery/FinalMatch.tsx`

- **IMPLEMENT**: Fetches full resource records for the final 1–3 active IDs and renders `ResourceCard` for each.

  ```tsx
  "use client";
  import { useEffect, useState } from "react";
  import { motion } from "framer-motion";
  import { createClient } from "@/lib/supabase/client";
  import { ResourceCard } from "@/components/results/ResourceCard";

  interface FinalMatchProps {
    activeIds: string[];
  }

  export function FinalMatch({ activeIds }: FinalMatchProps) {
    const [resources, setResources] = useState<Array<{
      id: string;
      title: string;
      description: string | null;
      topics: string[];
      link: string | null;
    }>>([]);

    useEffect(() => {
      if (activeIds.length === 0) return;
      const supabase = createClient();
      supabase
        .from("resources")
        .select("id, title, description, topics, link")
        .in("id", activeIds)
        .then(({ data }) => setResources(data ?? []));
    }, [activeIds.join(",")]); // stable dep: join ensures effect runs only when IDs change

    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <p
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontStyle: "italic",
            fontSize: "1.25rem",
            color: "white",
            margin: "0 0 8px",
          }}
        >
          {resources.length === 1 ? "Your best match" : "Your top matches"}
        </p>
        {resources.map(r => (
          <ResourceCard
            key={r.id}
            title={r.title}
            matchReason={(r.description ?? "").slice(0, 140) + (r.description && r.description.length > 140 ? "…" : "")}
            topics={r.topics ?? []}
            link={r.link ?? ""}
          />
        ))}
        <div style={{ marginTop: "16px" }}>
          <a
            href="/"
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.8rem",
              color: "#666",
              textDecoration: "underline",
            }}
          >
            Try the voice intake for AI-personalized match explanations →
          </a>
        </div>
      </motion.div>
    );
  }
  ```

- **`matchReason`**: Uses `description.slice(0, 140)` since this flow doesn't run Claude synthesis. The link back to `/` surfaces the voice intake for users who want personalized match reasons.
- **`useEffect` dep**: `activeIds.join(",")` avoids array identity issues while still triggering re-fetch when the IDs change.
- **VALIDATE**: Render with 2 real resource UUIDs. Verify cards appear with title, truncated description, topics, link.

---

### TASK 13: CREATE `app/discover/page.tsx`

- **IMPLEMENT**: Client component. Loads resources on mount, wires all hooks, renders split layout.

  ```tsx
  "use client";
  import { useEffect, useRef, useState } from "react";
  import { useBubbleState } from "@/hooks/useBubbleState";
  import { useDiscoverySession, DISCOVERY_QUESTIONS } from "@/hooks/useDiscoverySession";
  import { BubbleField } from "@/components/discovery/BubbleField";
  import { QuestionPanel } from "@/components/discovery/QuestionPanel";
  import { FinalMatch } from "@/components/discovery/FinalMatch";
  import type { AnswerData } from "@/hooks/useDiscoverySession";

  export default function DiscoverPage() {
    const { bubbles, activeCount, initBubbles, triggerElimination, onBubbleEliminated } =
      useBubbleState();
    const { questionIndex, isLoading, isLocked, isComplete, submitAnswer, onEliminationComplete } =
      useDiscoverySession();

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
      const check = () => setIsMobile(window.innerWidth < 768);
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }, []);

    // Load all resources on mount
    useEffect(() => {
      fetch("/api/discovery/start")
        .then(r => r.json())
        .then(data => initBubbles(data.resources ?? []));
    }, [initBubbles]);

    // Detect when all eliminations complete — unlock the panel
    const prevEliminatingRef = useRef(0);
    const eliminatingCount = bubbles.filter(b => b.status === "eliminating").length;
    useEffect(() => {
      if (prevEliminatingRef.current > 0 && eliminatingCount === 0 && isLocked) {
        onEliminationComplete();
      }
      prevEliminatingRef.current = eliminatingCount;
    }, [eliminatingCount, isLocked, onEliminationComplete]);

    const handleAnswerSubmit = async (answer: AnswerData) => {
      const { eliminate } = await submitAnswer(answer);
      triggerElimination(eliminate);
    };

    const finalActiveIds = bubbles.filter(b => b.status === "active").map(b => b.id);
    const showFinalMatch = isComplete || activeCount <= 3;

    return (
      <div
        style={{
          minHeight: "100dvh",
          backgroundColor: "black",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        {/* Left panel */}
        <div
          style={{
            width: isMobile ? "100%" : "40%",
            minWidth: isMobile ? undefined : "320px",
            maxWidth: isMobile ? undefined : "480px",
            padding: isMobile ? "40px 24px" : "64px 40px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            borderRight: isMobile ? "none" : "1px solid #111",
            borderBottom: isMobile ? "1px solid #111" : "none",
            overflowY: "auto",
          }}
        >
          {/* Wordmark + back link */}
          <a
            href="/"
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.25rem",
              color: "white",
              textDecoration: "none",
              display: "block",
              marginBottom: "48px",
            }}
          >
            Utah&apos;s Nexis
          </a>

          {showFinalMatch ? (
            <FinalMatch activeIds={finalActiveIds} />
          ) : (
            <QuestionPanel
              question={DISCOVERY_QUESTIONS[questionIndex]}
              questionIndex={questionIndex}
              isLocked={isLocked}
              isLoading={isLoading}
              onSubmit={handleAnswerSubmit}
            />
          )}
        </div>

        {/* Right panel — bubble canvas */}
        <div
          style={{
            flex: 1,
            minHeight: isMobile ? "50vh" : undefined,
            position: "relative",
          }}
        >
          <BubbleField
            bubbles={bubbles}
            activeCount={activeCount}
            onBubbleEliminated={onBubbleEliminated}
          />
        </div>
      </div>
    );
  }
  ```

- **`showFinalMatch`**: `isComplete || activeCount <= 3`. Shows the final match panel either after all 4 questions OR if the pool drops to ≤3 early.
- **Elimination completion**: The `useEffect` watches `eliminatingCount` via `prevEliminatingRef`. When it drops from >0 to 0 while `isLocked` is true, `onEliminationComplete()` fires — unlocking the panel and advancing `questionIndex`.
- **`handleAnswerSubmit`**: Calls `submitAnswer` (which sets `isLocked = true` and stores eliminated IDs in session), then immediately calls `triggerElimination` on the bubble state to start animations.
- **VALIDATE**: `npm run dev`, navigate to `localhost:3000/discover`. Verify: bubbles stagger in over ~1.5s; submit Q1; verify ~42 bubbles fade out; counter decrements; left panel shows "Processing..." then unlocks to Q2.

---

### TASK 14: UPDATE `app/results/page.tsx` — Add discovery link

- **IMPLEMENT**: Add a small text link to `/discover` below the existing "Save your results" footer (around line 184). This gives users who completed the voice intake a path to the visual explorer.

  ```tsx
  // Add after the existing "Save your results →" anchor, inside the <main> element
  <div style={{ textAlign: "center", marginTop: "12px" }}>
    <a
      href="/discover"
      style={{
        fontFamily: "ui-sans-serif, system-ui, -apple-system",
        fontSize: "0.8rem",
        color: "#444",
        textDecoration: "underline",
      }}
    >
      Try the visual resource explorer →
    </a>
  </div>
  ```

- **VALIDATE**: Run dev server, complete intake, navigate to `/results`, verify link is present.

---

### TASK 15: UPDATE `ai-context/INEFFICIENCIES.md`

Already updated before this plan was written (entries for IVFFLAT over-parameterization and d3+framer-motion performance are present). No action needed.

---

### TASK 16: UPDATE `ai-context/SECURITY.md`

Already updated before this plan was written (discovery route input validation entry is present). No action needed.

---

## TESTING STRATEGY

No test framework is configured. Validate via curl tests and manual browser testing.

### Manual Test Scenarios

**Full 4-question happy path:**
1. Navigate to `localhost:3000/discover`
2. Verify 213 bubbles stagger in over ~1.5s; counter reads 213
3. Select "Veteran" → click "confirm" → verify ~42 bubbles eliminate, counter → ~171, panel shows "Processing..."
4. After animation completes, panel unlocks to Q2
5. Type "Salt Lake City" → confirm → another ~38 eliminate
6. Continue through Q3 and Q4
7. Verify final match reveal when ≤3 remain OR after Q4 completes
8. Verify `ResourceCard` components appear in left panel
9. Verify "Try voice intake..." link is present

**Edge cases:**
- Skip all 4 questions → eliminates based on minimal query strings → should still reach ≤5 by Q4
- Navigate to `/discover` directly → works without prior intake session
- Window resize → canvas reflows; d3 simulation reheat to new dimensions

### API Tests (with dev server running)
```bash
# Start route
curl http://localhost:3000/api/discovery/start \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['resources']), 'resources')"
# Expected: 213 resources

# Answer route Q1 — Veteran community
curl -X POST http://localhost:3000/api/discovery/answer \
  -H 'Content-Type: application/json' \
  -d '{"answers":[{"questionId":"communities","selected":["Veteran"]}],"excludedIds":[],"questionIndex":0}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Eliminating {len(d[\"eliminate\"])} (target ~42)')"

# Answer route Q2 — location (cumulative)
curl -X POST http://localhost:3000/api/discovery/answer \
  -H 'Content-Type: application/json' \
  -d '{"answers":[{"questionId":"communities","selected":["Veteran"]},{"questionId":"location","text":"Salt Lake City"}],"excludedIds":[],"questionIndex":1}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Eliminating {len(d[\"eliminate\"])} (target ~38)')"
```

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

### Level 4: Dev + Manual
```bash
npm run dev
# Open localhost:3000/discover in Chrome
```

---

## ACCEPTANCE CRITERIA

- [ ] `/discover` page loads and shows 213 bubbles with staggered fade-in (~1.5s total)
- [ ] Counter shows 213 in top-right corner of bubble canvas, decrements after each elimination round
- [ ] Left panel shows one question at a time with correct input type (toggle buttons or textarea)
- [ ] "confirm" only appears when there's content to confirm (consistent with intake pattern)
- [ ] Left panel shows "Processing..." and disables inputs during elimination animation
- [ ] Left panel unlocks and advances to next question after all bubble exit animations complete
- [ ] Each round eliminates 20–28% of remaining resources; pool never drops below 5 before all 4 questions are answered
- [ ] Bubbles re-cluster after each elimination (d3 simulation re-heats with fresh alpha)
- [ ] When ≤3 active bubbles remain, they are highlighted with `#2a5e49` stroke
- [ ] FinalMatch panel reveals `ResourceCard` components for the 1–3 remaining resources
- [ ] Link to `/discover` is visible on the `/results` page
- [ ] Page is responsive: stacks vertically below 768px
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] Bubble scaling is centered (not from viewport corner) — `transform-box: fill-box` applied

---

## COMPLETION CHECKLIST

- [ ] `npm install` succeeded
- [ ] `score_resources_for_discovery` RPC deployed in Supabase SQL editor
- [ ] `GET /api/discovery/start` returns 213 resources
- [ ] `POST /api/discovery/answer` eliminates ~20% of resources per round
- [ ] 213 bubbles appear with stagger on `/discover`
- [ ] Full 4-question flow completes with progressive elimination
- [ ] FinalMatch panel reveals correctly
- [ ] TypeScript and lint clean
- [ ] Build passes

---

## NOTES

### Why MotionValues Instead of React State for Position

At 213 nodes × 60fps d3 ticks = ~12,780 potential state updates per second during simulation warm-up. Even with `React.memo`, React cannot reconcile this fast enough without dropped frames. MotionValues bypass React's render cycle entirely — `motionValue.set()` writes to the DOM via framer-motion's own animation pipeline. The result: smooth 60fps physics with zero React renders per tick. React state is used only for the 3–4 status/radius changes per session.

### Why `transformBox: fill-box` Is Not Optional

framer-motion applies `scale` as a CSS transform (not an SVG `transform` attribute). On SVG elements, CSS `transform-origin` is relative to the SVG viewport by default — meaning scale origin is the viewport's top-left corner. Without `transform-box: fill-box`, bubbles appear to fly to the corner when scaling to 0. With it, they scale from their own center. This is confirmed in framer-motion's SVG animation documentation.

### Why d3-force Subpackage, Not Full d3

The full `d3` barrel package bundles `d3-selection`, `d3-transition`, and `d3-axis` — DOM manipulation modules that operate directly on real DOM nodes. This conflicts with React's virtual DOM. `d3-force` is a pure physics engine with no DOM dependencies: it mutates plain JS objects. Using the subpackage keeps the bundle clean and avoids the conflict.

### Why No Claude Synthesis on Discovery Flow

Discovery uses the elimination animation as the feedback mechanism — users already know which resources survived based on their own answers. Adding synthesis would require running all 4 answers through `/api/match-resources` at completion, adding 2–4s of latency. The `FinalMatch` panel uses truncated `description` as a stand-in. Post-MVP: call `/api/match-resources` with the structured answers from the discovery session and replace the truncated description with a real AI-generated `matchReason`.

### Elimination Completion Detection

The page detects animation completion by watching `eliminatingCount` (the number of bubbles with `status === 'eliminating'`) in a `useEffect`. When this count drops from >0 to 0 while `isLocked` is true, all exit animations have completed. This avoids needing a prop counter or a global animation state manager — it flows naturally from the existing bubble status model.

### Confidence Score

**9/10**. The three original risk areas are resolved:
1. ✅ d3 + framer-motion position conflict: MotionValues per node bypasses React entirely
2. ✅ SVG scale-origin: `transformBox: "fill-box"` + `transformOrigin: "center"` confirmed in framer-motion SVG docs
3. ✅ d3 ESM import: d3-force subpackage with `from "d3-force"` is clean in Next.js 15 client components, no `transpilePackages` needed

Remaining 1/10 risk: the `useEffect` dep array on `useBubbleSimulation` uses `activeBubbles.length` rather than the full array to avoid infinite re-runs. If two elimination rounds somehow happen simultaneously (shouldn't be possible given `isLocked`), the simulation might not restart correctly. The `isLocked` mechanism in `useDiscoverySession` prevents this scenario.
