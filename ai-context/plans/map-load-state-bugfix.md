# Feature: Map Load State Bug Fix + JSON Cleanup

The following plan is implementation-ready. Read every file listed under CONTEXT REFERENCES before writing a single line of code. The bugs are subtle — understanding the Mapbox lifecycle, `reuseMaps` behavior, and the `idle` event semantics is required before touching any code.

## Feature Description

The `/map` route occasionally loads with markers missing and/or the wrong camera position (not centered on Utah). A browser refresh always fixes it. Additionally, `public/startups.json` (142KB, 255 company records) is being publicly served by Next.js even though all data now lives in Supabase — this file predates the database import and should be removed.

## User Story

As a visitor to the Nexis map,
I want the startup markers and correct Utah camera position to appear reliably on every load,
So that I never need to refresh the page to get a working map.

## Problem Statement

Two distinct bugs cause the map to load in a broken state:

**Bug 1 — `revealed` flag set before the canvas guard check (primary bug)**

In `MapView.tsx`'s `handleMapLoad`, the `reveal()` function sets `revealed = true` BEFORE checking whether `mapRef.current?.getMap()?.getCanvasContainer()` is available. If that check fails (which can happen in the React Strict Mode double-mount cycle or during quick navigations away), `reveal()` returns early without calling `setMapLoaded(true)`. Since `revealed` is now `true`, the 3-second fallback timer finds `if (revealed) return` and exits immediately. Result: `setMapLoaded(true)` is NEVER called → the black curtain stays forever → markers never render.

```
// CURRENT (broken):
const reveal = () => {
  if (revealed) return;
  revealed = true;           // ← flag set here
  map.off("idle", reveal);
  const m = mapRef.current?.getMap?.();
  if (!m || !m.getCanvasContainer?.()) return;  // ← early return WITHOUT resetting flag
  // ... setMapLoaded(true) never reached
};
setTimeout(reveal, 3000);   // ← fallback blocked by revealed = true
```

**Bug 2 — 3000ms fallback is far too long (secondary UX bug)**

When the map is reused across navigation (user goes `/map` → `/` → `/map`), the underlying Mapbox instance is preserved by `reuseMaps`. When `MapView` remounts, `handleMapLoad` fires. At this point the map may already be in an `idle` state — no pending renders. The `idle` listener is set up, but since the map is already idle and no render is triggered, `idle` never fires again. The 3-second fallback is the only recovery path, creating a 3-second black screen with a pulsing ring. Users interpret this as the map being broken and hit refresh — which works because a fresh load follows the happy path (idle fires normally).

**Bug 3 (secondary) — `public/startups.json` is publicly served**

`geocode-startups.ts` writes company data to `public/startups.json`. `import-startups.ts` reads it to populate Supabase. Both scripts have already been run and all data is now in the database. The file serves no runtime purpose but is accessible at `https://domain/startups.json` (exposing company data). Both scripts should be updated to use `data/startups.json` (gitignored) instead.

## Solution Statement

1. Fix `reveal()` in `MapView.tsx`: move `revealed = true` to AFTER the canvas-ready check, OR (preferred — simpler and correct) remove the overly-defensive `getCanvasContainer` guards entirely. React 18 safely no-ops `setState` calls on unmounted components. The `StartupMarker` component already has its own guard against the `appendChild` crash (`useMap()` null check), making the MapView canvas guards redundant.

2. Reduce the fallback timeout from `3000ms` to `MIN_CURTAIN_MS` (850ms). This is sufficient for `setConfigProperty` style changes to commit (they render within 1-2 animation frames, ~16-33ms) while providing a much better UX for the already-idle reused-map case.

3. Delete `public/startups.json`. Update `scripts/geocode-startups.ts` output path to `data/startups.json` and `scripts/import-startups.ts` read path to `data/startups.json`. Update `ai-context/SECURITY.md`.

## Feature Metadata

**Feature Type**: Bug Fix  
**Estimated Complexity**: Low  
**Primary Systems Affected**: `components/map/MapView.tsx`, `scripts/geocode-startups.ts`, `scripts/import-startups.ts`, `public/startups.json`  
**Dependencies**: None (no new libraries)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `components/map/MapView.tsx` (lines 36–128) — The entire `handleMapLoad` callback. The `reveal()` closure and the `mapLoaded` state gate are the surgery site.
- `components/map/StartupMarker.tsx` (lines 31–38) — The `useMap()` null guard that makes the MapView canvas guards redundant. Read this to understand why removing the guards in MapView is safe.
- `components/map/MapClient.tsx` — Confirms `reuseMaps` is on `<Map>` which is the trigger for the reused-map edge case.
- `lib/map/mapConfig.ts` — `MIN_CURTAIN_MS = 850` is defined in `MapView.tsx` (not mapConfig.ts). Verify the constant before touching the timeout value.
- `scripts/geocode-startups.ts` (line 29) — `outputPath = path.resolve("public/startups.json")` — update to `data/startups.json`.
- `scripts/import-startups.ts` (line 39) — `jsonPath = path.resolve("public/startups.json")` — update to `data/startups.json`.
- `ai-context/SECURITY.md` (line 73-75) — References `startups.json` being static and public. Update after file removal.

### New Files to Create

None.

### Files to Delete

- `public/startups.json` — 142KB company data file; all data is in Supabase `startups` table.

### Patterns to Follow

**Inline styles** — All `components/map/` files use inline styles, not Tailwind classes. Don't add class names.

**`useCallback` with empty deps** — `handleMapLoad` uses `useCallback(() => {...}, [])`. All stable refs (`mapRef`, `mountedAtRef`) are accessed via `.current` inside the callback — correct pattern, no lint warnings expected.

**Error handling** — `setConfigProperty`, `setFog`, `fitBounds` are all individually wrapped in `try/catch` with silent failure. This pattern is intentional (Mapbox Standard style config keys can change between style versions). Don't add error logging inside these specific blocks.

**React 18 setState on unmounted component** — Safe to call; React 18 silently ignores it (no error, no effect on other component instances' state). This is why removing the canvas guard inside the final `setTimeout` is safe.

---

## IMPLEMENTATION PLAN

### Phase 1: Fix `handleMapLoad` in `MapView.tsx`

The surgery is confined to the `reveal()` closure and the fallback `setTimeout` inside `handleMapLoad`. No other code in the file changes.

**Target function** (`components/map/MapView.tsx`, starting around line 62):

```typescript
// CURRENT (broken) — do not keep this
const handleMapLoad = useCallback(() => {
  // ... setup code (keep as-is) ...

  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;           // BUG: flag set before guard
    map.off("idle", reveal);

    const m = mapRef.current?.getMap?.();
    if (!m || !m.getCanvasContainer?.()) return;  // BUG: blocks fallback

    const elapsed = Date.now() - mountedAtRef.current;
    const wait = Math.max(0, MIN_CURTAIN_MS - elapsed);
    setTimeout(() => {
      if (!mapRef.current?.getMap?.()?.getCanvasContainer?.()) return;  // BUG: redundant
      setMapLoaded(true);
    }, wait);
  };
  map.on("idle", reveal);
  setTimeout(reveal, 3000);  // BUG: 3000ms too long
}, []);

// REPLACEMENT (fixed) — use this
const handleMapLoad = useCallback(() => {
  // ... setup code (keep as-is) ...

  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;           // FIX: flag set before off() and timer, guards are gone
    map.off("idle", reveal);
    const elapsed = Date.now() - mountedAtRef.current;
    const wait = Math.max(0, MIN_CURTAIN_MS - elapsed);
    setTimeout(() => setMapLoaded(true), wait);  // FIX: no canvas guard needed
  };
  map.on("idle", reveal);
  setTimeout(reveal, MIN_CURTAIN_MS);  // FIX: 850ms instead of 3000ms
}, []);
```

**Why removing the canvas guards is safe:**
- `StartupMarker` already guards itself via `useMap()` null check (returns `null` if canvas not ready)
- React 18 safely ignores `setState` on unmounted components
- `reuseMaps` preserves the canvas across navigations — the container is never truly gone while the component is mounted

**Why MIN_CURTAIN_MS (850ms) as the fallback:**
- `setConfigProperty` renders within 1-2 animation frames (~16-33ms total). 850ms provides 800ms of buffer — more than enough for the dark style to commit before the curtain fades.
- For the reused-map case: if `idle` fires quickly (< 850ms from mount), `wait = MAX(0, 850 - elapsed)` computes the remaining curtain time. If `idle` doesn't fire and the fallback triggers at ~850ms after `handleMapLoad`, `elapsed` from mount is >= 850ms, so `wait = 0` and `setMapLoaded(true)` fires immediately. Either way, the curtain shows for exactly MIN_CURTAIN_MS from mount.
- Previous 3000ms created a 3-second blank screen on back-navigation — that's the user experience that prompted refreshing.

### Phase 2: Update scripts to use `data/` path

Move the intermediate JSON file out of `public/` so it can't be accidentally served if the scripts are re-run.

- `scripts/geocode-startups.ts` line 29: `path.resolve("public/startups.json")` → `path.resolve("data/startups.json")`  
- `scripts/import-startups.ts` line 39: `path.resolve("public/startups.json")` → `path.resolve("data/startups.json")`

The `data/` directory is already gitignored (the CSV import scripts put source data there). No new directory setup needed.

### Phase 3: Delete `public/startups.json`

Simple file deletion. The file serves no runtime purpose — `app/map/page.tsx` loads startup data from Supabase (`startups` table), not from this file.

### Phase 4: Update `ai-context/SECURITY.md`

The security doc has a note saying "Clearbit logo URLs... only public company domains from `startups.json` are sent" and "`startups.json` is a static read-only file". Update to reflect that logos come from the `startups` table's `logo_url` column (populated from `domain` field during import), not the JSON file.

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `components/map/MapView.tsx` — fix `reveal()` and fallback timeout

**IMPLEMENT**: Replace the `reveal` closure and `setTimeout` fallback at the bottom of `handleMapLoad`.

**Exact change** — find this block (approximately lines 100–128):
```typescript
let revealed = false;
const reveal = () => {
  if (revealed) return;
  revealed = true;
  map.off("idle", reveal);

  const m = mapRef.current?.getMap?.();
  // Defensive: react-map-gl's destroy() teardown can null out the canvas
  // container under React Strict Mode's mount/unmount/mount cycle. If the
  // map is gone, do nothing — the next mount will fire its own idle.
  if (!m || !m.getCanvasContainer?.()) return;

  // Hold the curtain for at least MIN_CURTAIN_MS so a warm-cache load
  // (which can fire idle in <100ms) still feels like a deliberate
  // transition rather than a flash.
  const elapsed = Date.now() - mountedAtRef.current;
  const wait = Math.max(0, MIN_CURTAIN_MS - elapsed);
  setTimeout(() => {
    if (!mapRef.current?.getMap?.()?.getCanvasContainer?.()) return;
    setMapLoaded(true);
  }, wait);
};
map.on("idle", reveal);
// Fallback: if idle never fires within 3s of `load` (e.g. setConfigProperty
// kicks the map into a continuous render loop), reveal anyway. The canvas
// container check inside reveal() guards against the unhealthy case.
setTimeout(reveal, 3000);
```

Replace with:
```typescript
// Reveal markers once the dark style has rendered.
// Primary trigger: `idle` fires after all pending renders complete.
// Fallback: MIN_CURTAIN_MS after handleMapLoad — handles the reused-map
// (back-navigation) case where the map is already idle and `idle` won't
// fire again, and the setConfigProperty continuous-render case.
//
// No canvas-container guard needed: StartupMarker already returns null if
// its own useMap() check fails, and React 18 safely no-ops setState on
// unmounted components.
let revealed = false;
const reveal = () => {
  if (revealed) return;
  revealed = true;
  map.off("idle", reveal);
  const elapsed = Date.now() - mountedAtRef.current;
  const wait = Math.max(0, MIN_CURTAIN_MS - elapsed);
  setTimeout(() => setMapLoaded(true), wait);
};
map.on("idle", reveal);
// 850ms fallback — sufficient for setConfigProperty style commits (~16ms
// in practice) while preventing the 3s black screen on back-navigation.
setTimeout(reveal, MIN_CURTAIN_MS);
```

**GOTCHA**: Don't change anything else in `handleMapLoad` — the setup block (`setConfigProperty` calls, `setFog`, `fitBounds`, the `let revealed` → `map.on("idle", reveal)` pattern) is all correct. Only replace the reveal closure and the fallback timeout.

**VALIDATE**: `npm run build` — no TypeScript errors.

---

### Task 2: UPDATE `scripts/geocode-startups.ts` — move output to `data/`

**Line 29**: Change `path.resolve("public/startups.json")` to `path.resolve("data/startups.json")`.

Also update the `console.log` at the end (line ~200) if it mentions `public/startups.json`.

**VALIDATE**: Verify the line reads `const outputPath = path.resolve("data/startups.json");` after the edit.

---

### Task 3: UPDATE `scripts/import-startups.ts` — move read path to `data/`

**Line 39**: Change `path.resolve("public/startups.json")` to `path.resolve("data/startups.json")`.

**VALIDATE**: Verify the line reads `const jsonPath = path.resolve("data/startups.json");` after the edit.

---

### Task 4: DELETE `public/startups.json`

Delete the file. It is 142KB of startup data that is now fully replicated in the Supabase `startups` table. The file has no runtime consumers — `app/map/page.tsx` loads from Supabase.

**VALIDATE**: `ls public/` — only `logo.png` and `utah-border.geojson` remain.

---

### Task 5: UPDATE `ai-context/SECURITY.md` — fix stale JSON reference

In the **Map Feature** security note (around line 69–75), update the text that references `startups.json`:

**Find**:
```
- Clearbit logo URLs (`logo.clearbit.com/{domain}`) are fetched by the browser — only public company domains from `startups.json` are sent, no user data
- `startups.json` is a static read-only file; no user writes are possible
```

**Replace with**:
```
- Clearbit logo URLs (`logo.clearbit.com/{domain}`) are fetched by the browser — only public company domains from the `startups` table's `logo_url` column are used, no user data
- Startup data is served from the Supabase `startups` table (public RLS read policy); no static JSON file is served
```

**VALIDATE**: Confirm the file saves cleanly.

---

## TESTING STRATEGY

No automated tests exist in this project. Manual validation only.

### Manual Validation Steps

**Test 1: Cold first load**
1. `npm run dev`
2. Navigate to `http://localhost:3000/map`
3. Confirm: black curtain fades after ~850ms, Utah is visible in correct position, startup markers appear
4. Expected: markers render within ~1 second of navigation, no 3-second blank screen

**Test 2: Back-navigation (the main regression case)**
1. From `/map`, click the Nexis logo → navigates to `/`
2. Click "Explore the map." → navigates back to `/map`
3. Confirm: curtain fades and markers appear within ~1 second (no 3-second blank screen, no permanent black screen)
4. Confirm: Utah is correctly framed (not zoomed in to a previous marker click)

**Test 3: Marker click → back-navigation**
1. On `/map`, click any startup marker → flydown to 3D view
2. Click "← Back to Utah" → camera returns to Utah view
3. Navigate to `/` then back to `/map`
4. Confirm: camera shows full Utah (not the previously selected startup's location)

**Test 4: Multiple back-navigations**
1. Repeat Test 2 three times in a row
2. Confirm: map loads correctly every time (no occasional failure)

**Test 5: JSON file gone**
1. `ls public/` — confirm only `logo.png` and `utah-border.geojson` are present
2. `npm run build` — confirm no build errors from missing `startups.json`
3. Navigate to `/map` — confirm startups load from Supabase (check Network tab: no request to `/startups.json`)

---

## VALIDATION COMMANDS

```bash
# Level 1: Lint
npm run lint

# Level 2: Build (catches TypeScript errors)
npm run build

# Level 3: File cleanup verification
ls -la public/
# Expected: logo.png, utah-border.geojson only

# Level 4: Manual browser testing (see steps above)
npm run dev
# Open http://localhost:3000/map
```

---

## ACCEPTANCE CRITERIA

- [ ] Navigating to `/map` always shows startup markers within ~1 second (not 3+ seconds, not never)
- [ ] Back-navigation (`/map` → `/` → `/map`) reliably shows markers without requiring a refresh
- [ ] Camera position is always Utah-framed on `/map` load (regardless of previous marker click)
- [ ] `public/startups.json` is deleted and not recreated by the application
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero errors
- [ ] `ai-context/SECURITY.md` no longer references `startups.json`

---

## COMPLETION CHECKLIST

- [ ] Task 1: `MapView.tsx` reveal closure fixed, fallback reduced to MIN_CURTAIN_MS
- [ ] Task 2: `geocode-startups.ts` output path changed to `data/startups.json`
- [ ] Task 3: `import-startups.ts` read path changed to `data/startups.json`
- [ ] Task 4: `public/startups.json` deleted
- [ ] Task 5: `SECURITY.md` updated
- [ ] All validation commands executed
- [ ] Manual browser testing passed for all 5 test cases

---

## NOTES

### Why `reuseMaps` is kept

`reuseMaps` was added specifically to fix the `appendChild of undefined` crash that occurred when navigating from `/` → `/map`. Without it, the second mount of `MapView` would try to instantiate a new Mapbox instance into a container that still holds the old canvas, crashing all markers. Do NOT remove `reuseMaps`.

### Why the `idle` event listener is kept

`idle` is still the primary, preferred trigger for revealing markers (fires as soon as dark style is fully committed). The MIN_CURTAIN_MS fallback is the safety net. Keeping both gives us:
- Fast reveal when idle fires (typically < 500ms from `handleMapLoad`)
- Reliable reveal when idle doesn't fire (reused/already-idle map) via 850ms fallback

### Why the `StartupMarker` null guard is not removed

The `useMap()` null check in `StartupMarker.tsx` provides defense-in-depth against the `appendChild` crash in edge cases (HMR, dev Strict Mode, etc.). It's independent of the MapView fix and should stay.

### Scripts are one-time utilities

`geocode-startups.ts` and `import-startups.ts` are run once to populate the database. The path update is a future-safety measure — if someone re-runs them, the output won't be accidentally served by Next.js.

### INEFFICIENCIES.md entry (no update needed)

The existing entry "Map — HTML markers for 255 startups" in `INEFFICIENCIES.md` is still accurate and doesn't need changes for this bug fix.
