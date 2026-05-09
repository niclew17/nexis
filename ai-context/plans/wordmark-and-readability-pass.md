# Feature: wordmark-and-readability-pass

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

A pure UI / readability refresh across the app. Three concerns:

1. **Logo unification.** Two pages currently render a `<img src="/logo.png" />` image in their left sidebar (resources page + map page). Replace both with the canonical "Nexis" text wordmark from `app/page.tsx` — keep the `<Link>` / `<a href="/">` wrapper and all click behavior; only the rendered element changes. The wordmark must be visually centered horizontally inside the sidebar and large enough to read as a brand mark (not a label).
2. **Promote small top-left wordmarks to a centered hero.** Four pages render a tiny "Nexis" or "Utah's Nexis" wordmark anchored to `flex-start` / top-left at ~1.25–1.5 rem. Move each to top-center and scale it up to match the home page's wordmark scale, preserving any controls (auth buttons) that currently share the bar.
3. **Readability sweep on the resources page.** Modal text (`ResourcePopup`), drafted email panel (`EmailPanel`), and the inline result cards (`ResourceCard`) are too small. Bump font sizes to a comfortable reading scale. On `ResourceCard`, also drop the green (`#2a5e49`) match-reason color — it disappears against the black background — and replace it with a high-contrast neutral.

No functional changes. No router changes. No state changes. No new components. CSS / inline-style values only.

## User Story

As a Utah founder using Nexis on a desktop monitor
I want the Nexis brand to be recognizable on every page and the result/email content to be comfortably readable
So that I can scan recommendations and drafted emails without squinting and always know where I am in the product

## Problem Statement

- The product currently mixes a raster logo image with a text wordmark — the brand is inconsistent across pages, and the raster's visual weight (72px PNG) doesn't match the text wordmark's authority on the home page.
- Multiple inner pages reduce the wordmark to a 1.25–1.5 rem top-left affordance, which makes the brand feel like a back-button and hides the visual anchor on the page.
- Result cards, the resource modal, and the drafted email panel use 0.6875–1 rem text on a black background. Combined with the green `#2a5e49` color used for match reasons, body content is below comfortable reading contrast.

## Solution Statement

- Replace the raster logo with the same Instrument-Serif "Nexis" wordmark used on `app/page.tsx`, sized to feel like a brand mark in each sidebar (~3–3.5 rem). Preserve every existing href and `<a>` vs `<Link>` choice (the map page deliberately uses a plain `<a>` to force a full nav — see `components/map/MapSidebar.tsx:37-42` rationale).
- Restructure the four small-wordmark headers so the "Nexis" mark is centered horizontally and matches a single shared scale (~2.5–3 rem). Where auth controls currently share that header bar (results page), keep them but absolutely-position them on the right so the wordmark stays optically centered.
- Bump every text size in `ResourceCard`, `ResourcePopup`, and `EmailPanel` by one step on the type scale, and recolor `ResourceCard.matchReason` from `#2a5e49` (green) to a near-white neutral that holds against `#000`.

## Feature Metadata

**Feature Type**: Enhancement (UI/readability)
**Estimated Complexity**: Low
**Primary Systems Affected**: `app/resources/page.tsx`, `app/results/page.tsx`, `app/protected/layout.tsx`, `components/map/MapSidebar.tsx`, `components/map/create/CreateLayout.tsx`, `components/login-form.tsx`, `components/discovery/ResourcePopup.tsx`, `components/results/EmailPanel.tsx`, `components/results/ResourceCard.tsx`
**Dependencies**: None — all changes are inline-style edits in existing files. No new imports, no new packages, no schema changes.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `app/page.tsx` (lines 171–184) — **The reference wordmark.** Defines the canonical Nexis wordmark style:
  ```tsx
  fontFamily: "var(--font-instrument-serif)",
  fontSize: "clamp(3rem, 8vw, 6rem)",
  color: "white",
  letterSpacing: "-0.02em",
  margin: 0,
  lineHeight: 1,
  ```
  Sidebar/header replacements must use the same family + tracking, but a smaller `fontSize` (the home page is the loudest instance — sidebars and inner-page headers should be a step quieter so the home stays the largest).

- `app/resources/page.tsx` (lines 105–129) — Existing logo image inside the left panel. Wrapped in `<Link href="/">` with `position: absolute`, `top: 32px`, `left: 50%`, `transform: translateX(-50%)`. Image is `<img src="/logo.png" alt="Nexis" height=72px width=auto opacity=0.9>`. **The wrapping `Link` and its href must remain.** Only the inner `<img>` is replaced with a `<span>` containing "Nexis".

- `components/map/MapSidebar.tsx` (lines 37–60) — Same pattern as above, but uses a plain `<a href="/">` not `<Link>`. **Do not change the `<a>` to a `<Link>`** — comment at lines 37–41 explains the deliberate full-nav requirement (mapbox-gl pooled-state cleanup). Only the inner `<img>` becomes a `<span>` with "Nexis".

- `app/results/page.tsx` (lines 92–146) — Sticky header with wordmark `<Link>` on the left (1.25 rem) and an auth-button cluster (`Log in` / `Save results`) on the right via `justifyContent: space-between`. Refactor target: position-relative header, centered wordmark (large), absolutely-positioned auth cluster on the right (top/right). Keep the conditional `{isAnonymous && (…)}` block intact.

- `components/login-form.tsx` (lines 76–97) — Top-of-page header with a small left-aligned `<a href="/map">Nexis</a>` at 1.5 rem. Refactor: keep the same `<a href="/map">`, recenter and resize.

- `components/map/create/CreateLayout.tsx` (lines 28–49) — Identical pattern to `login-form.tsx`. Same refactor.

- `app/protected/layout.tsx` (lines 8–24) — Tailwind nav with `<Link href="/" className="font-semibold">Nexis</Link>` on the left. This file is Tailwind/className-based (the only one in this set that is); the rest are inline-styled. Match the inline-style refactor by replacing the className header with a centered Instrument-Serif version. **Do not modify the page body wrapper or its `gap-20 max-w-5xl` content area.**

- `components/discovery/ResourcePopup.tsx` (lines 1–135) — Modal that appears when a bubble on `/resources` is clicked. Body sizes: title `1.125rem`, description `0.9375rem` (Instrument Serif), topic pills `0.75rem`, "Learn more" link `0.875rem`. Bump the entire content one step.

- `components/results/EmailPanel.tsx` (lines 60–225) — Right-panel email drafter on `/resources` after match results. Sizes to bump: tab labels `0.8125rem` (line 84), section labels "Subject"/"To" `0.6875rem` (lines 113, 142), Subject value `0.9375rem` (line 124), To value `0.875rem` (line 152), email body `1rem` (line 168, Instrument Serif), CTA button `0.875rem` (line 202). The active-tab underline `#2a5e49` and the CTA button's `#2a5e49` border + text are deliberate accent uses on contained UI shapes — **leave those green** (the user's "no green text" rule was scoped explicitly to the cards).

- `components/results/ResourceCard.tsx` (lines 10–82) — Inline result card. Sizes to bump: title `1.25rem` (line 26), match reason `1rem` (line 36), topic pills `0.75rem` (line 51), Learn more link `0.875rem` (line 71). **Color change:** `matchReason` color (line 38) `#2a5e49` → `#e5e5e5` (or similar high-contrast neutral). Verify against `app/page.tsx` description text which uses `#666666` for muted body — match-reason should be brighter than that since it's the most important card content.

- `components/intake/VoiceIntake.tsx` (lines 82–84) — **Do not modify.** This `Utah's Nexis` headline is the idle-state hero of the intake module, not a top-of-page logo. The user's request did not mention this; leaving it preserves the centered-column intake flow.

- `app/layout.tsx` (lines 1–18) — Confirms `var(--font-instrument-serif)` is registered globally via `next/font/google`. No changes needed; existing components already use the variable correctly.

### New Files to Create

None. Every change is an inline-style edit in an existing file.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- `ai-context/CLAUDE.md` — Design system section, specifically:
  - "Colors: `#2a5e49` is used only as a foreground signal, never as a background fill." → The match-reason color change keeps the accent foreground rule but de-emphasizes it on text long enough to read. Single-line CTAs and tab indicators retain the accent.
  - "Typography: Instrument Serif — live transcript (italic) and confirmed answer (regular)." → All wordmark replacements use this same font variable.
  - "No animations longer than 400ms" → Header refactors must not introduce hover transitions longer than 0.3s ease-out.
- `app/page.tsx` lines 171–200 — The reference for any new wordmark. Same font, same letter-spacing, same `lineHeight: 1`.

### Patterns to Follow

**Logo replacement pattern (the new wordmark inside an existing link wrapper):**

```tsx
// BEFORE — components/map/MapSidebar.tsx:42-60
<a href="/" style={{ position: "absolute", top: "32px", left: "50%", transform: "translateX(-50%)", display: "block", lineHeight: 0 }}>
  <img src="/logo.png" alt="Nexis" style={{ height: "72px", width: "auto", opacity: 0.9, userSelect: "none" }} />
</a>

// AFTER
<a href="/" style={{ position: "absolute", top: "32px", left: "50%", transform: "translateX(-50%)", display: "block", textDecoration: "none" }}>
  <span
    style={{
      fontFamily: "var(--font-instrument-serif)",
      fontSize: "3rem",
      color: COLORS.text,         // or "white" for the resources page (no COLORS import)
      letterSpacing: "-0.02em",
      lineHeight: 1,
      userSelect: "none",
      display: "block",
    }}
  >
    Nexis
  </span>
</a>
```

Note: drop `lineHeight: 0` on the wrapper (that was needed to suppress the inline-image baseline gap; for text we want `lineHeight: 1` on the inner span). Drop the `opacity: 0.9` — the wordmark is more legible at full opacity.

**Centered-top header pattern (replaces top-left small wordmark headers):**

For pages where the wordmark is currently in a `flex-start` row (login form, create layout):

```tsx
// BEFORE — components/login-form.tsx:76-97
<div style={{ width: "100%", maxWidth: "720px", display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
  <a href="/map" style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.5rem", color: COLORS.text, ... }}>
    Nexis
  </a>
</div>

// AFTER
<div style={{ width: "100%", maxWidth: "720px", display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "8px" }}>
  <a
    href="/map"
    style={{
      fontFamily: "var(--font-instrument-serif)",
      fontSize: "clamp(2.5rem, 6vw, 3.5rem)",
      color: COLORS.text,
      textDecoration: "none",
      letterSpacing: "-0.02em",
      lineHeight: 1,
    }}
  >
    Nexis
  </a>
</div>
```

**Centered-with-side-controls pattern (results page sticky header):**

The results page header has both a wordmark and auth buttons. Center the wordmark and absolutely position the auth cluster.

```tsx
// AFTER — app/results/page.tsx:94-146
<header
  style={{
    position: "sticky",
    top: 0,
    padding: "20px 24px",
    backgroundColor: "black",
    borderBottom: "1px solid #111",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  }}
>
  <Link
    href="/"
    style={{
      fontFamily: "var(--font-instrument-serif)",
      fontSize: "clamp(2.25rem, 5vw, 3rem)",
      color: "white",
      textDecoration: "none",
      letterSpacing: "-0.02em",
      lineHeight: 1,
    }}
  >
    Utah&apos;s Nexis
  </Link>
  {isAnonymous && (
    <div
      style={{
        position: "absolute",
        right: "24px",
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}
    >
      {/* …existing Log in + Save results anchors unchanged… */}
    </div>
  )}
</header>
```

**Type scale bump (ResourcePopup / EmailPanel / ResourceCard):**

| Component | Field | Current | New |
|---|---|---|---|
| ResourcePopup | title | `1.125rem` | `1.5rem` |
| ResourcePopup | description | `0.9375rem` | `1.125rem` |
| ResourcePopup | topic pill | `0.75rem` | `0.875rem` |
| ResourcePopup | Learn more | `0.875rem` | `1rem` |
| EmailPanel | tab label | `0.8125rem` | `0.9375rem` |
| EmailPanel | "Subject"/"To" label | `0.6875rem` | `0.8125rem` |
| EmailPanel | Subject value | `0.9375rem` | `1.125rem` |
| EmailPanel | To value | `0.875rem` | `1rem` |
| EmailPanel | email body | `1rem` | `1.125rem` |
| EmailPanel | CTA button | `0.875rem` | `1rem` |
| ResourceCard | title | `1.25rem` | `1.5rem` |
| ResourceCard | match reason | `1rem` | `1.125rem` |
| ResourceCard | topic pill | `0.75rem` | `0.875rem` |
| ResourceCard | Learn more | `0.875rem` | `1rem` |

**Color change (single token):**

`ResourceCard.tsx:38` — change `color: "#2a5e49"` → `color: "#e5e5e5"`. No other green-text changes are in scope.

---

## IMPLEMENTATION PLAN

### Phase 1: Logo image → wordmark (sidebars)

Replace the two `<img src="/logo.png" />` occurrences with the Nexis wordmark span. Preserve every wrapper attribute and href.

**Tasks:**
- Edit `app/resources/page.tsx` — swap `<img>` (lines 118–128) for a styled `<span>Nexis</span>`. Keep the `<Link href="/">` wrapper, drop `lineHeight: 0`, drop the `eslint-disable-next-line @next/next/no-img-element` comment.
- Edit `components/map/MapSidebar.tsx` — same swap (lines 54–59). Keep the `<a href="/">` wrapper (full-nav rationale stays). Drop the `eslint-disable-next-line @next/next/no-img-element` comment.

### Phase 2: Top-left wordmarks → centered hero

Make every inner-page wordmark centered and large.

**Tasks:**
- Edit `components/login-form.tsx` (lines 76–97) — change container's `justifyContent` to `center`, bump `fontSize` to the scale shown in the pattern.
- Edit `components/map/create/CreateLayout.tsx` (lines 28–49) — same refactor as login form. Note the comment block (lines 10–13) about the deliberate plain `<a>` — leave that comment intact and keep the `<a href="/map">`.
- Edit `app/results/page.tsx` (lines 94–146) — restructure the sticky header to center the `Utah's Nexis` wordmark and absolutely position the auth cluster on the right (only when `isAnonymous`). The header must remain `position: sticky; top: 0;`.
- Edit `app/protected/layout.tsx` (lines 8–24) — replace the Tailwind className header with an inline-styled centered wordmark. The page is otherwise Tailwind-based, so keep the outer `<main>` and `<div className="flex-1 …">` shells; only the inner `<nav>` block is rewritten.

### Phase 3: Readability bumps + green removal

**Tasks:**
- Edit `components/discovery/ResourcePopup.tsx` — apply the four font-size bumps in the type-scale table.
- Edit `components/results/EmailPanel.tsx` — apply the six font-size bumps. **Do not change** the active-tab underline color or the CTA button's accent color/border.
- Edit `components/results/ResourceCard.tsx` — apply the four font-size bumps and recolor `matchReason` from `#2a5e49` to `#e5e5e5`.

### Phase 4: Validation

**Tasks:**
- Run `npm run lint` — must pass with zero errors.
- Run `npm run build` — must compile without TypeScript errors.
- Start `npm run dev` and walk through each affected route in a browser. See "Manual Validation" below.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: UPDATE `app/resources/page.tsx` — replace `<img>` with wordmark

- **IMPLEMENT**: Replace the `<img src="/logo.png" alt="Nexis" …>` element (lines 118–128) with a styled `<span>Nexis</span>`. Keep the `<Link href="/">` wrapper. Remove the now-unnecessary `eslint-disable-next-line @next/next/no-img-element` comment (line 118) and the wrapper's `lineHeight: 0` (line 115) — replace with `textDecoration: "none"`.
- **PATTERN**: See "Logo replacement pattern" above. Use `color: "white"` (this file does not import `COLORS` — see line 1–9; do not introduce a new import).
- **IMPORTS**: No new imports.
- **GOTCHA**:
  - The page's left-panel content has `padding: "128px 0 64px"` (line 134) specifically to clear the absolute logo. Do not change this padding — the wordmark span at ~3 rem occupies similar vertical space to the 72 px image once you account for `lineHeight: 1`. Verify visually that `Find your resources →` does not collide with the wordmark on a 1080 px tall viewport.
  - The wordmark must use `fontSize: "3rem"` (or `clamp(2.5rem, 5vw, 3.5rem)`) — large enough to read as a logo, smaller than the home page's `clamp(3rem, 8vw, 6rem)` to preserve home-page primacy.
- **VALIDATE**: `npm run lint` (must pass); visit `/resources` and confirm the wordmark appears centered at the top of the left panel.

### Task 2: UPDATE `components/map/MapSidebar.tsx` — replace `<img>` with wordmark

- **IMPLEMENT**: Replace the `<img src="/logo.png" alt="Nexis" …>` (lines 54–59) with the same styled `<span>Nexis</span>`. Keep the existing plain `<a href="/">` and its surrounding comment (lines 37–42 explain the deliberate full-nav rationale — preserve it verbatim). Remove the `eslint-disable-next-line @next/next/no-img-element` comment (line 54) and replace the wrapper's `lineHeight: 0` with `textDecoration: "none"`.
- **PATTERN**: See "Logo replacement pattern". Use `color: COLORS.text` since this file already imports `COLORS` from `@/lib/map/mapConfig` (line 5).
- **IMPORTS**: No new imports — `COLORS` is already imported.
- **GOTCHA**:
  - Match the resources page wordmark size (`fontSize: "3rem"` or matching `clamp`) so the two sidebars feel consistent.
  - The container content below uses `padding: "128px 32px 64px"` (line 67) which already accounts for the absolute-positioned mark. Do not change.
- **VALIDATE**: `npm run lint`; visit `/map` and confirm the wordmark renders centered at the top of the sidebar; confirm clicking it navigates to `/`.

### Task 3: UPDATE `components/login-form.tsx` — center + enlarge wordmark

- **IMPLEMENT**: In the header `div` at lines 76–97, change `justifyContent: "flex-start"` → `"center"`. On the `<a href="/map">Nexis</a>` element, increase `fontSize` from `"1.5rem"` to `"clamp(2.5rem, 6vw, 3.5rem)"` and add `lineHeight: 1`.
- **PATTERN**: See "Centered-top header pattern" above.
- **IMPORTS**: No new imports.
- **GOTCHA**: The form below the header has its own centering; the wordmark's increased height will push the form down a few pixels. That's fine. Do not introduce a fixed top spacer — the existing `padding: "24px"` on the outer container remains correct.
- **VALIDATE**: `npm run lint`; visit `/auth/login` and confirm the wordmark is top-center and prominent.

### Task 4: UPDATE `components/map/create/CreateLayout.tsx` — center + enlarge wordmark

- **IMPLEMENT**: In the header `div` at lines 28–49, change `justifyContent: "flex-start"` → `"center"`. On the `<a href="/map">Nexis</a>` element, increase `fontSize` from `"1.5rem"` to `"clamp(2.5rem, 6vw, 3.5rem)"` and add `lineHeight: 1`. Leave the file-top comment (lines 10–13) about the plain `<a>` rationale untouched.
- **PATTERN**: See "Centered-top header pattern".
- **IMPORTS**: No new imports.
- **GOTCHA**: Same as Task 3 — do not add a spacer; the children `padding: "48px 0"` (line 59) below the header already provides clearance.
- **VALIDATE**: `npm run lint`; visit `/map/new` and confirm the wordmark is top-center.

### Task 5: UPDATE `app/results/page.tsx` — restructure sticky header

- **IMPLEMENT**: In the sticky header (lines 94–146), change the layout from `justifyContent: "space-between"` to `"center"`, bump the wordmark `fontSize` from `"1.25rem"` to `"clamp(2.25rem, 5vw, 3rem)"` and add `letterSpacing: "-0.02em"` and `lineHeight: 1`. Move the `{isAnonymous && (…)}` cluster into a sibling `<div>` with `position: "absolute"`, `right: "24px"`, `top: "50%"`, `transform: "translateY(-50%)"`. Keep the cluster's inner `<a>` elements (Log in / Save results) byte-for-byte identical. Bump the header's `padding` from `"16px 24px"` to `"20px 24px"` so the larger wordmark has breathing room.
- **PATTERN**: See "Centered-with-side-controls pattern" above.
- **IMPORTS**: No new imports.
- **GOTCHA**:
  - On narrow widths the centered wordmark may visually overlap the absolute right cluster. The page only renders this layout on desktop (the `/results` page does not branch on mobile, but it will degrade gracefully because `clamp(2.25rem, 5vw, 3rem)` shrinks below 768 px). If the cluster collides at ~480 px width, the right cluster's `gap: "16px"` keeps total width small enough — verify in DevTools at 480 px and accept the collision (this app's mobile layout for `/results` is not in scope here).
  - Keep `position: sticky; top: 0;` and `zIndex: 10` on the header.
- **VALIDATE**: `npm run lint`; visit `/results` (after running an intake) and confirm wordmark is centered with auth cluster on the right; scroll to confirm header remains sticky.

### Task 6: UPDATE `app/protected/layout.tsx` — replace Tailwind nav with centered inline-styled wordmark

- **IMPLEMENT**: Replace the `<nav>` block (lines 11–17) with an inline-styled `<nav>` whose only child is a centered `<Link href="/">Nexis</Link>`. Use the same wordmark style as Task 5 (`fontSize: "clamp(2.25rem, 5vw, 3rem)"`, `letterSpacing: "-0.02em"`, `fontFamily: "var(--font-instrument-serif)"`, `color: "white"` or theme-equivalent). Keep the outer `<main>` and the body's `flex-1 flex flex-col gap-20 max-w-5xl p-5 w-full` div untouched.
- **PATTERN**: See "Centered-top header pattern" — but this file is mixed Tailwind / inline-style; just replace the `<nav>`'s `className` with inline `style` for the wordmark. The Tailwind shells at lines 9 and 18 stay.
- **IMPORTS**: No new imports — `Link` is already imported (line 1).
- **GOTCHA**: The Tailwind `border-b border-b-foreground/10 h-16` styling on the nav uses a CSS variable for the border color; if you keep an inline `border-bottom`, use `1px solid #111` to match the project's other dark dividers (e.g., `app/results/page.tsx:101`).
- **VALIDATE**: `npm run lint`; if you have an authenticated user, visit `/protected` and confirm the wordmark renders centered.

### Task 7: UPDATE `components/discovery/ResourcePopup.tsx` — bump modal text sizes

- **IMPLEMENT**: Apply these inline-style changes:
  - Line 73 (title): `fontSize: "1.125rem"` → `"1.5rem"`
  - Line 87 (description): `fontSize: "0.9375rem"` → `"1.125rem"`
  - Line 104 (topic pill): `fontSize: "0.75rem"` → `"0.875rem"`
  - Line 124 (Learn more link): `fontSize: "0.875rem"` → `"1rem"`
- **PATTERN**: Type-scale table above.
- **IMPORTS**: No new imports.
- **GOTCHA**: The modal has `maxWidth: "480px"` (line 43) — the larger title at `1.5rem` should still fit on one line for typical resource names. Do not change `maxWidth`.
- **VALIDATE**: `npm run lint`; on `/resources`, click an active bubble and verify the popup text is readable.

### Task 8: UPDATE `components/results/EmailPanel.tsx` — bump email-panel text sizes (keep accent green on tab indicator + button)

- **IMPLEMENT**: Apply these inline-style changes:
  - Line 84 (tab label): `fontSize: "0.8125rem"` → `"0.9375rem"`
  - Line 113 ("Subject" label): `fontSize: "0.6875rem"` → `"0.8125rem"`
  - Line 124 (Subject value): `fontSize: "0.9375rem"` → `"1.125rem"`
  - Line 142 ("To" label): `fontSize: "0.6875rem"` → `"0.8125rem"`
  - Line 152 (To value): `fontSize: "0.875rem"` → `"1rem"`
  - Line 168 (email body): `fontSize: "1rem"` → `"1.125rem"` and `color: "#cccccc"` → `"#e5e5e5"` (slight contrast lift to match ResourceCard)
  - Line 202 (CTA button): `fontSize: "0.875rem"` → `"1rem"`
- **PATTERN**: Type-scale table.
- **IMPORTS**: No new imports.
- **GOTCHA**:
  - **Do not change** the active-tab underline color (`#2a5e49` on line 81) or the CTA button's `border: "1px solid #2a5e49"` and `color: "#2a5e49"` (lines 198, 200, 210, 215). These are deliberate accent uses on contained UI shapes — the user's "no green text" rule is scoped to the cards.
  - The body slice cap at line 42 (`body.slice(0, 1800)`) is a mailto: URI length workaround documented in `INEFFICIENCIES.md` — do not modify.
- **VALIDATE**: `npm run lint`; complete an intake on `/resources`, switch tabs in the email panel, and verify text is comfortably readable.

### Task 9: UPDATE `components/results/ResourceCard.tsx` — bump sizes + remove green from match reason

- **IMPLEMENT**: Apply these changes:
  - Line 26 (title): `fontSize: "1.25rem"` → `"1.5rem"`
  - Line 36 (matchReason): `fontSize: "1rem"` → `"1.125rem"`
  - Line 38 (matchReason): `color: "#2a5e49"` → `"#e5e5e5"`
  - Line 51 (topic pill): `fontSize: "0.75rem"` → `"0.875rem"`
  - Line 71 (Learn more): `fontSize: "0.875rem"` → `"1rem"`
- **PATTERN**: Type-scale table; "Color change (single token)" note above.
- **IMPORTS**: No new imports.
- **GOTCHA**:
  - The matchReason still uses `fontFamily: "var(--font-instrument-serif)"` (line 36) — keep that. Only the color and size change.
  - The card is rendered both inside the inline left-panel of `/resources` (via `VoiceIntake.tsx:259-266`) and inside `/results/page.tsx:162-168`. Verify both layouts visually.
- **VALIDATE**: `npm run lint`; complete an intake and verify the cards in both surfaces are readable and the match reason no longer disappears against the background.

### Task 10: VALIDATE end-to-end build

- **IMPLEMENT**: Run `npm run lint` and `npm run build` from the project root.
- **PATTERN**: N/A.
- **IMPORTS**: N/A.
- **GOTCHA**: If `npm run build` fails with an `<img>` ESLint warning anywhere, you missed removing the `eslint-disable-next-line @next/next/no-img-element` comment in either Task 1 or Task 2 (the comment must be removed because there is no longer an `<img>` element on that line — leaving it is a stale lint suppression that may produce its own warning under stricter ESLint configs).
- **VALIDATE**: Both commands exit 0.

---

## TESTING STRATEGY

This codebase has no test framework (no `test`, `vitest`, or `jest` script in `package.json`). Validation is manual + lint + build.

### Unit Tests

Not applicable. No test runner configured.

### Integration Tests

Not applicable.

### Edge Cases

Manually verify these scenarios in a browser:

1. **Resources page wordmark on a tall viewport (1440 × 900):** The wordmark is absolutely positioned with `top: 32px`. Ensure the centered intake content (`Find your resources →` and the subsequent flow) doesn't visually collide with the wordmark.
2. **Resources page wordmark on a short viewport (1280 × 720):** Confirm the wordmark + intake content still fit without scroll on the left panel during idle state.
3. **Results page header at narrow widths (768 px and below):** The `clamp` font-size shrinks to 2.25 rem; verify the auth cluster on the right doesn't overlap the centered wordmark when both are present (with `isAnonymous = true`).
4. **Results page when authenticated (no auth cluster):** Verify the centered wordmark is alone and centered; no leftover whitespace bias from the removed `space-between`.
5. **Map sidebar after navigating away and back:** The `<a>` (not `<Link>`) is deliberate — confirm clicking the wordmark does a full nav to `/` and not a client-side route swap (open DevTools Network tab; look for a fresh document request).
6. **Resources popup on a long description:** Pick a resource with a long description (e.g., one of the 213 imported resources with multi-paragraph descriptions). Verify the modal still fits within the canvas and scrolls properly with the larger text.
7. **EmailPanel with a 1800-char email body:** Verify the larger body font wraps correctly and the panel's `overflowY: "auto"` (line 100) still scrolls.
8. **ResourceCard match reason on a black background:** Confirm `#e5e5e5` is high-contrast and readable. Compare against the `#666666` muted body text used elsewhere — match-reason should be visibly brighter.
9. **Protected layout:** If you have an authenticated user, navigate to `/protected` and confirm the centered wordmark replaces the previous top-left affordance without breaking the page body's `gap-20 max-w-5xl` Tailwind grid.
10. **No regressions on the home page:** `/` should be unchanged. Confirm visually.

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

```bash
npm run lint
```

Must exit 0. ESLint config at `eslint.config.mjs` extends `next/core-web-vitals`.

### Level 2: Unit Tests

N/A — no test framework configured.

### Level 3: Integration Tests

N/A.

### Level 4: Manual Validation

Run the dev server and walk through each route:

```bash
npm run dev
```

Then in a browser at `http://localhost:3000`:

1. Visit `/` — confirm home page wordmark is unchanged.
2. Visit `/resources` — confirm the left-panel wordmark replaces the prior logo image, is centered, and is sized like a brand mark. Click it; confirm it navigates to `/`.
3. Complete an intake on `/resources` (or paste a saved profile). When `EmailPanel` renders on the right, verify all text sizes are larger and readable, and that the active-tab underline + CTA button retain the green accent.
4. Click an active bubble (before completing the intake) — confirm the `ResourcePopup` modal text is readable.
5. Visit `/map` — confirm the sidebar wordmark replaces the prior logo image; click it and confirm it does a **full** nav to `/` (Network tab should show a fresh document request).
6. Visit `/map/new` — confirm the wordmark is top-center and large.
7. Visit `/auth/login` — confirm the wordmark is top-center and large.
8. Run a fake intake (or load `/results` with a `nexis-results` sessionStorage entry) — confirm the sticky header has a centered, large wordmark. If anonymous, confirm the auth cluster is on the right without overlapping the wordmark on a desktop viewport.
9. If authenticated, visit `/protected` — confirm the nav header has a centered, large wordmark.
10. Spot-check `/results` `ResourceCard` — confirm the match reason is no longer green; confirm it is readable on the black background.

### Level 5: Build Validation

```bash
npm run build
```

Must compile without TypeScript errors or stale `eslint-disable` warnings.

---

## ACCEPTANCE CRITERIA

- [ ] No `<img src="/logo.png" />` references remain in `app/` or `components/` (verify with `grep -rn "logo.png" app components`).
- [ ] `app/resources/page.tsx` and `components/map/MapSidebar.tsx` render a centered "Nexis" Instrument-Serif wordmark in their respective sidebar tops, wrapped in the original `<Link href="/">` / `<a href="/">` (preserved verbatim).
- [ ] `app/results/page.tsx`, `components/login-form.tsx`, `components/map/create/CreateLayout.tsx`, and `app/protected/layout.tsx` all show the wordmark top-center, sized roughly `clamp(2.25rem, 5vw, 3.5rem)` with `letterSpacing: -0.02em` and Instrument Serif. The home page's `clamp(3rem, 8vw, 6rem)` remains the loudest instance.
- [ ] On `/results`, when `isAnonymous` is true, the auth cluster (Log in / Save results) appears on the right via absolute positioning without overlapping the centered wordmark on a 1280px+ viewport.
- [ ] `components/discovery/ResourcePopup.tsx` text sizes match the type-scale table above.
- [ ] `components/results/EmailPanel.tsx` text sizes match the table; the active-tab underline (`#2a5e49`) and the CTA button border/text (`#2a5e49`) are unchanged.
- [ ] `components/results/ResourceCard.tsx` text sizes match the table; the match reason is `#e5e5e5` (or equivalent high-contrast neutral), not `#2a5e49`.
- [ ] `npm run lint` exits 0.
- [ ] `npm run build` exits 0.
- [ ] No functional changes — every existing href, click handler, state hook, and API call still works exactly as before.
- [ ] The home page (`app/page.tsx`) and intake idle-state hero (`components/intake/VoiceIntake.tsx:82-84`) are untouched.

---

## COMPLETION CHECKLIST

- [ ] All 10 tasks completed in order
- [ ] `grep -rn "logo.png" app components` returns no matches
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] Manual walkthrough of all 10 validation steps complete
- [ ] Acceptance criteria all met
- [ ] No green text remains on any `ResourceCard` body content (only on accents — tab indicator and CTA button)

---

## NOTES

**Why two different "centered" patterns?**
- The two **sidebar** logo replacements use absolute positioning (`top: 32px; left: 50%; transform: translateX(-50%)`) because the sidebar's content is vertically centered and the logo must "float" above it without disturbing centering — see the `marginTop: auto / marginBottom: auto` trick at `app/resources/page.tsx:134` and `components/map/MapSidebar.tsx:64`.
- The four **inner-page header** wordmarks use a flex container with `justifyContent: center` because they are part of a top-of-page row, not floating overlays. The results page additionally needs an absolutely-positioned auth cluster because it shares the row with controls.

**Why not unify into a single `<NexisWordmark />` component?**
The user explicitly scoped the work to "make these fixes first. Do not change any functionality, but make everything more readable and change the use of the logo." Extracting a shared component is a refactor; per the codebase's `CLAUDE.md` directives ("Don't add features, refactor, or introduce abstractions beyond what the task requires"), this is out of scope. Each call site uses inline styles already and the duplication is small (~6 lines).

**Why `#e5e5e5` for the match reason?**
- Pure white (`#FFFFFF`) is reserved for the card title — using it on the match reason would erase the visual hierarchy.
- The codebase's existing muted neutral is `#666666` (used for descriptions on the home page and tagline text); applying it to match reasons would be too quiet — match reasons are the primary value of each card.
- `#e5e5e5` reads as "secondary content" — brighter than `#666666`, dimmer than `#FFFFFF`. This preserves hierarchy: title (white) → match reason (e5e5e5) → topic pills (#888) → Learn more (white underlined link).

**Why preserve `<a>` vs `<Link>` distinctions?**
The map sidebar's plain `<a>` (and the create layout's `<a href="/map">`) is documented as deliberate (full-nav cleans up pooled mapbox-gl state). Switching to `<Link>` would silently regress map navigation. Verified at `components/map/MapSidebar.tsx:37-42` and `components/map/create/CreateLayout.tsx:10-13`.

**What was deliberately left out of scope:**
- The intake idle-state "Utah's Nexis" hero in `components/intake/VoiceIntake.tsx:82-84` — this is the page's content, not a top-of-page logo, and the user did not mention it.
- The active-tab underline and CTA button green in `EmailPanel.tsx` — the user's "no green text" rule was specific to the cards.
- Any responsive/mobile refinement of the new centered headers — the existing app does not have a robust mobile layout for `/results` or `/auth/login`, and adding one is a separate piece of work.
- Component extraction — see "Why not unify…" above.

**Confidence in one-pass implementation:** **9/10.** All edits are localized, every line number is verified against the current file content, the type scale and color decisions are explicit, and there are no hidden cross-file dependencies. The single risk: at narrow widths the centered results-page header may overlap the auth cluster — that's covered in "Edge Cases" item 3 with explicit guidance.
