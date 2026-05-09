# Feature: Landing Page & Routing Split

The following plan should be complete, but validate codebase patterns and task sanity before implementing.

Pay special attention to the Framer Motion patterns already in the project. Import from the right files and mirror existing inline style conventions throughout.

## Feature Description

Split the app into three top-level routes:
- `/` — New dynamic landing page that lets users choose between the two product features
- `/resources` — Current home page content (voice intake + bubble field + email panel), moved here
- `/map` — Placeholder page for the forthcoming map feature

The landing page must feel polished and alive: staggered Framer Motion entrance animations, interactive hover states using the #2a5e49 accent, and an ambient background animation — all within the established black/white/accent design system.

## User Story

As a Utah founder landing on Nexis,
I want to see a clear, beautiful feature selection screen,
So that I can immediately understand what Nexis offers and choose the experience I need.

## Problem Statement

The current `/` is the full voice intake product. Adding a second feature (Map) requires a routing split and a home page that presents both features with context and visual appeal.

## Solution Statement

Move the intake/bubble experience to `/resources`. Create a minimal animated landing page at `/` that presents two feature cards with staggered entrance animations, hover glow effects, and an ambient background pulse. Create a `/map` placeholder page with matching aesthetics.

## Feature Metadata

**Feature Type**: Refactor + New Capability (landing page)  
**Estimated Complexity**: Low  
**Primary Systems Affected**: `app/page.tsx`, new `app/resources/page.tsx`, new `app/map/page.tsx`  
**Dependencies**: `framer-motion` (already installed), `next/link`

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `app/page.tsx` (lines 1–153) — Current home; entire file moves to `app/resources/page.tsx` unchanged
- `app/layout.tsx` (lines 17–23) — Instrument Serif font CSS variable `--font-instrument-serif`; no changes needed here
- `app/globals.css` (lines 60–62) — `.text-nexis-accent { color: #2a5e49 }` and `.text-nexis-muted`
- `components/intake/VoiceIntake.tsx` (lines 79–95) — Idle state shows "Utah's Nexis" as text; after move to `/resources`, this text is fine where it is (it's the per-feature header)
- `components/intake/VoiceIntake.tsx` (lines 184–210) — Framer Motion `motion.div` usage pattern: inline style + `animate` + `transition` props. Mirror this pattern on the landing page.
- `app/results/page.tsx` (lines 108–117) — Header `<Link href="/">` — after the split this correctly goes back to the new landing page. **No change needed.**
- `app/page.tsx` (lines 106–121) — Logo `<img src="/logo.png">` at top of left panel; wrap in a `<Link href="/">` on the resources page so the logo navigates back to the landing page.

### New Files to Create

- `app/resources/page.tsx` — Exact copy of current `app/page.tsx` (intake + bubble field), with logo wrapped in Link to `/`
- `app/map/page.tsx` — Placeholder map page, matching black-background aesthetic
- `app/page.tsx` — **Rewrite** as the new landing / feature-selection page

### Patterns to Follow

**Inline styles (not Tailwind)** — All `app/page.tsx`, `app/results/page.tsx`, and intake components use inline style objects. The landing page must continue this pattern, not Tailwind classes, for visual consistency.

**Framer Motion — from `components/intake/VoiceIntake.tsx:184`**
```tsx
import { motion } from "framer-motion";

<motion.div
  style={{ /* inline style */ }}
  animate={{ opacity: [0.65, 1, 0.65] }}
  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
/>
```

**Framer Motion stagger — use `variants` + `staggerChildren`**
```tsx
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};
// Parent: <motion.div variants={container} initial="hidden" animate="show">
// Children: <motion.div variants={item}>
```

**Font usage**
- Instrument Serif headings: `fontFamily: "var(--font-instrument-serif)"`
- System sans body: `fontFamily: "ui-sans-serif, system-ui, -apple-system"`

**Color constants**
- Background: `backgroundColor: "black"`
- Primary text: `color: "white"`
- Accent (border/hover): `#2a5e49`
- Muted text: `color: "#666666"`
- Subtle divider: `#111` or `#1a1a1a`

**Next.js Link from `app/results/page.tsx:7`**
```tsx
import Link from "next/link";
<Link href="/resources" style={{ textDecoration: "none", color: "white" }}>…</Link>
```

**"use client"** — `app/page.tsx` is currently `"use client"` because it uses hooks. The new landing page is a static component — no hooks, no `"use client"` needed. Omit the directive.

---

## IMPLEMENTATION PLAN

### Phase 1: Move Existing Page to `/resources`

Copy `app/page.tsx` → `app/resources/page.tsx`. Add one change: wrap the logo `<img>` in `<Link href="/">` so users can navigate back to the landing page.

### Phase 2: Create `/map` Placeholder

Minimal page matching the aesthetic: centered black screen, "Map" heading in Instrument Serif, one-line description, link back home.

### Phase 3: Rewrite `/` as Landing Page

New `app/page.tsx` — no `"use client"` needed. Animated feature-selection screen with:
- Staggered entrance: wordmark → tagline → two feature cards
- Ambient background: slow-pulsing rings (opacity ~0.04–0.06) using `motion.div` absolutely positioned behind content
- Feature cards with hover glow border in #2a5e49
- Mobile: stack cards vertically

---

## STEP-BY-STEP TASKS

### Task 1: CREATE `app/resources/page.tsx`

- **IMPLEMENT**: Copy entire current `app/page.tsx` verbatim into `app/resources/page.tsx`
- **UPDATE**: In the logo `<img>` block (lines 106–121 of current `app/page.tsx`), wrap the `<img>` tag with `<Link href="/" style={{ display: "block" }}>` and import `Link from "next/link"` at the top
- **GOTCHA**: The file has `"use client"` at the top and Suspense wrapper at the bottom — copy these exactly. Do not remove any existing imports.
- **VALIDATE**: `npx tsc --noEmit` (no type errors)

### Task 2: CREATE `app/map/page.tsx`

- **IMPLEMENT**: Server component (no `"use client"`). Full-screen black. Centered column. Logo at top. "Map" in large Instrument Serif. Subtitle: "Explore Utah's founder resources by location — coming soon." Link back to `/`.
- **PATTERN**: Mirror the mobile layout from current `app/page.tsx` lines 62–78 (centered flex column, black bg, white text)
- **IMPORTS**: `import Link from "next/link"` only
- **VALIDATE**: `npm run build` succeeds; page renders at `/map`

### Task 3: REWRITE `app/page.tsx` as animated landing page

- **IMPLEMENT**: Remove `"use client"` directive — this is a pure Server Component. Use Framer Motion's SSR-safe approach: wrap in a client component boundary if needed. Actually, since Framer Motion requires a client environment, create a small `"use client"` component called `LandingContent` inside the file, and export a thin Server Component default that renders it.
- **GOTCHA**: `motion` from `framer-motion` requires `"use client"`. Pattern from the project: `components/intake/VoiceIntake.tsx` has `"use client"` at top. For `app/page.tsx`, the simplest approach is to keep `"use client"` (as it is today) since we need Framer Motion for animations. This is consistent with the current file.
- **LAYOUT**: Full-screen black (`height: "100dvh"`, `overflow: "hidden"`), flex column, `justify-content: center`, `align-items: center`
- **BACKGROUND ANIMATION**: Two large absolutely-positioned `motion.div` circles (pure CSS border, not filled) that scale and fade in slow loops:
  ```tsx
  // Example ring — position absolutely behind content (zIndex: 0), pointer-events: none
  <motion.div
    style={{
      position: "absolute",
      width: "600px", height: "600px",
      borderRadius: "50%",
      border: "1px solid rgba(255,255,255,0.04)",
      top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
    }}
    animate={{ scale: [1, 1.08, 1], opacity: [0.04, 0.07, 0.04] }}
    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
  />
  // Second ring, offset timing:
  // animate={{ scale: [1.08, 1, 1.08] }}, transition delay: 4
  ```
- **WORDMARK SECTION** (staggered via `variants`):
  - `"Nexis"` — `fontFamily: "var(--font-instrument-serif)"`, `fontSize: "clamp(3rem, 8vw, 6rem)"`, `color: "white"`, `letterSpacing: "-0.02em"`, `margin: 0`
  - Tagline: `"Utah's founder resource navigator"` — system sans, `fontSize: "0.9375rem"`, `color: "#666666"`, `marginTop: "8px"`
- **FEATURE CARDS** (two side-by-side on desktop, stacked on mobile):
  - Use `<Link href="/resources">` and `<Link href="/map">` wrapping each card
  - Card wrapper: `display: "flex"`, `flexDirection: "column"`, `gap: "8px"`, `padding: "32px"`, `border: "1px solid #1a1a1a"`, `cursor: "pointer"`, `textDecoration: "none"`, `color: "white"`, transition border-color on hover to `#2a5e49`
  - Card label (small, muted): `"Resources"` / `"Map"` — system sans, `fontSize: "0.6875rem"`, `color: "#555"`, `letterSpacing: "0.1em"`, `textTransform: "uppercase"`
  - Card heading: `"Find your match."` / `"Explore the map."` — Instrument Serif, `fontSize: "1.5rem"`
  - Card description: one short sentence — system sans, `fontSize: "0.875rem"`, `color: "#666666"`
  - Card CTA: `"→"` in `#2a5e49` with a `transition: "color 0.2s ease-out"` hover to white
  - **Hover**: Use `onMouseEnter`/`onMouseLeave` to set inline border color (`#2a5e49` → `#1a1a1a`) — same pattern as `EmailPanel.tsx` lines 208–213
- **MOBILE BREAKPOINT**: Use the same `isMobile` pattern from current `app/page.tsx` lines 14–19; stack cards vertically when `window.innerWidth < 768`. Or use CSS `flexDirection: isMobile ? "column" : "row"` on the card container.
- **STAGGER ANIMATION**: `container` variant with `staggerChildren: 0.14` and `delayChildren: 0.1`; `item` variant: `hidden: { opacity: 0, y: 20 }` → `show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }`
- **VALIDATE**: `npm run dev` → visit `/`; confirm animations play; confirm card hover states work; confirm links navigate correctly

### Task 4: VERIFY no broken internal links

- **CHECK**: `app/results/page.tsx` links to `/` (line 109) — this now correctly points to the new landing page. No change needed.
- **CHECK**: `components/intake/VoiceIntake.tsx` "Utah's Nexis" idle text (line 83) is display-only on the `/resources` page — acceptable. No change needed.
- **CHECK**: Auth pages (`app/auth/`) — any links to `/` will now land on the new landing page, which is correct behavior.
- **VALIDATE**: `npm run build` — zero TypeScript errors, zero missing-page errors

---

## DESIGN SPEC — Landing Page

```
[black, 100dvh]
                    ┌─────────────────────────────────────────────────────┐
                    │                                                     │
                    │           [subtle pulsing ring, z:0]               │
                    │                                                     │
                    │              Nexis                                  │
                    │    Utah's founder resource navigator                │
                    │                                                     │
                    │  ┌──────────────────┐  ┌──────────────────┐        │
                    │  │ RESOURCES        │  │ MAP              │        │
                    │  │                  │  │                  │        │
                    │  │ Find your match. │  │ Explore the map. │        │
                    │  │                  │  │                  │        │
                    │  │ Voice-first      │  │ Browse Utah's    │        │
                    │  │ discovery across │  │ resources by     │        │
                    │  │ 213 programs.    │  │ location.        │        │
                    │  │                  │  │                  │        │
                    │  │ →                │  │ →                │        │
                    │  └──────────────────┘  └──────────────────┘        │
                    │  [hover: border turns #2a5e49]                     │
                    │                                                     │
                    └─────────────────────────────────────────────────────┘
```

Animation sequence (ms from page load):
1. Background rings: immediate, slow loop (8s, infinite)
2. "Nexis" wordmark: fade + slide up (delay 100ms, 500ms duration)
3. Tagline: fade in (delay 250ms, 400ms duration)
4. Resources card: slide up from y:20 (delay 400ms, 450ms duration)
5. Map card: slide up from y:20 (delay 520ms, 450ms duration)

---

## VALIDATION COMMANDS

### Level 1: Syntax & Types
```bash
npx tsc --noEmit
npm run lint
```

### Level 2: Build
```bash
npm run build
```

### Level 3: Manual Validation
1. `npm run dev` → visit `http://localhost:3000`
   - Staggered entrance animation plays
   - Background rings animate slowly
   - Hovering each card changes border to #2a5e49
   - Clicking "Resources" card navigates to `/resources`
   - Clicking "Map" card navigates to `/map`
2. Visit `http://localhost:3000/resources`
   - Intake experience renders correctly
   - Logo in top-left is clickable → navigates to `/`
   - Bubble field loads on desktop
   - Full voice intake flow works end-to-end
3. Visit `http://localhost:3000/map`
   - Placeholder page renders cleanly
   - "Back to home" or logo link navigates to `/`
4. Visit `http://localhost:3000/results` (after completing intake)
   - Header "Utah's Nexis" link still navigates to `/` (landing page)
5. Mobile (resize browser to <768px)
   - Landing page stacks cards vertically
   - `/resources` shows intake-only (no bubble field)

---

## ACCEPTANCE CRITERIA

- [ ] `/` renders the new animated landing page with two feature cards
- [ ] `/resources` renders the current intake + bubble field experience identically to before
- [ ] `/map` renders a clean placeholder page in the design system
- [ ] Logo on `/resources` links back to `/`
- [ ] All existing `/results` links still work
- [ ] `npm run build` succeeds with zero errors
- [ ] Landing page entrance animation uses Framer Motion stagger
- [ ] Landing page hover states use #2a5e49 accent on border
- [ ] Mobile layout stacks cards vertically on `/`
- [ ] No broken internal links anywhere in the app

---

## COMPLETION CHECKLIST

- [ ] `app/resources/page.tsx` created (copy of old `app/page.tsx` + logo link)
- [ ] `app/map/page.tsx` created (placeholder)
- [ ] `app/page.tsx` rewritten as animated landing page
- [ ] TypeScript types pass (`npx tsc --noEmit`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing of all three routes confirms correct behavior
- [ ] Animation plays correctly in browser
- [ ] Mobile layout correct on `/`

---

## NOTES

**Why no Tailwind on the landing page?** All existing page-level components (`app/page.tsx`, `app/results/page.tsx`) use inline styles exclusively. Mixing Tailwind on the new page would create inconsistency. Stay with inline styles.

**Why keep `"use client"` on the landing page?** Framer Motion's `motion` components require a client environment. Since the landing page uses Framer Motion for animations, `"use client"` is required. This is consistent with the current `app/page.tsx`.

**Background rings vs. particle field**: The ring animation is chosen over a particle field because: (a) zero canvas setup, (b) no additional dependencies, (c) consistent with the circular motif of the bubble field on `/resources`. Two rings at very low opacity (~4–7%) create depth without distraction.

**Card hover via onMouseEnter/Leave**: This follows the pattern in `EmailPanel.tsx:208-213`. React state for hover per card is the cleanest approach without adding a CSS module or Tailwind hover variant.

**Map page content**: Content is intentionally minimal (placeholder). The user will provide map feature details in a subsequent feature request. The page should convey "coming soon" or "in preview" without committing to implementation-specific copy.

**Confidence Score**: 9/10 — All files are clear, patterns are well-established in the codebase, no external dependencies needed beyond what's installed.
