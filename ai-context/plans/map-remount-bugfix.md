# Feature: Map Remount Bug Fix — Reliable Render on Every Navigation

The following plan should be complete, but validate documentation and codebase patterns before implementing. Read the files listed under CONTEXT REFERENCES first — the bug is subtle and hinges on react-map-gl's `reuseMaps` lifecycle, not on any single line in this codebase.

Pay special attention to: the difference between `Map`'s `onLoad` event and the underlying mapbox-gl `loaded()` state, and to where every reveal/setup pathway currently lives (all of them are inside `handleMapLoad`).

## Feature Description

Fix a hard-to-diagnose bug where navigating from `/` → `/map` works on the first visit, but on every subsequent visit (`/map` → `/` → `/map`) the map renders in the *default* Mapbox Standard style (a "regular map" — light, with default labels, no Utah outline, no markers), and the page becomes unresponsive. Refresh always recovers it. After this fix, every navigation to `/map` reliably renders the dark/transparent custom style with the green Utah border, all startup markers, and Utah-framed camera — regardless of how many times the user has come and gone.

## User Story

As a visitor to the Nexis map,
I want the dark custom style, the Utah outline, all startup markers, and Utah-framed camera to appear every time I land on `/map`,
So that I never need to refresh to get a working map.

## Problem Statement

`components/map/MapView.tsx` uses `<Map reuseMaps>` (line 285). `reuseMaps` is what allows the underlying mapbox-gl instance to survive React unmount/mount cycles — it was added intentionally to fix an `appendChild of undefined` crash on first navigation. The catch: when react-map-gl reuses a pooled map on a *second* mount, **`onLoad` does NOT re-fire** because the underlying mapbox-gl instance already considers itself loaded.

Every setup pathway in `MapView.tsx` lives inside `handleMapLoad` — the `setConfigProperty(...)` calls that apply the dark style, `setFog(...)`, `fitBounds(UTAH_BOUNDS, ...)` that frames the camera, the `idle` listener that flips `mapLoaded`, AND the `setTimeout(reveal, MIN_CURTAIN_MS)` fallback. Because `handleMapLoad` itself never runs on remount, none of these pathways execute. Result on remount:

1. Map shows in default Standard style (`setConfigProperty` never re-applied) → "regular map" appearance.
2. `mapLoaded` stays `false` → no markers render (`{mapLoaded && renderStartups.map(...)}` at line 321) and Utah border `<Source>` is mounted but layered under a permanent black curtain (when curtain is opaque) — *or*, if the prior session left curtain logic in a triggered state, the curtain could be hidden but markers still gated. Either way: no markers.
3. `fitBounds(UTAH_BOUNDS, ...)` never re-runs → camera holds whatever position the prior session left (could be a 3D zoom into a marker).

Compounding the visible bug, `startOrbit(map)` schedules a `requestAnimationFrame` loop that's **never cancelled on unmount**. With `reuseMaps`, the rAF closure holds a reference to the pooled mapbox-gl instance and keeps calling `map.setBearing(...)` 60×/sec on the new mount — making the page feel unresponsive even after remount, and silently fighting any camera-reset logic.

The previous bug-fix plan (`ai-context/plans/map-load-state-bugfix.md`) tried to address remount by lowering the fallback timeout from 3000ms to 850ms. But the fallback is *inside* `handleMapLoad`, so if `handleMapLoad` doesn't fire, the fallback doesn't either. That plan didn't actually address the root cause.

## Solution Statement

1. **Detect the reused-map case.** Add a mount-only `useEffect` in `MapView` that, after the next animation frame, asks the underlying mapbox-gl instance whether it's already loaded (`map.loaded() === true`). If yes, manually invoke the same setup logic that `handleMapLoad` runs — so `setConfigProperty`, `setFog`, `fitBounds`, and the reveal/`mapLoaded = true` flip all fire on remount.
2. **Make `handleMapLoad` idempotent.** Add a per-mount ref guard so calling it twice in the same mount (cold path: `onLoad` fires AND the detector fires) is a no-op the second time. Listeners and timeouts only register once.
3. **Always reset map UI state on every mount.** On `MapView` mount: clear `selectedStartup`, force `mode = '2d'`, and let `handleMapLoad`'s `fitBounds(UTAH_BOUNDS, ...)` re-frame the camera. The user explicitly wants Utah-framed every time.
4. **Cancel the orbit rAF on unmount.** Add a `useEffect` cleanup that calls `stopOrbit()` (and resets fog + 3d-objects config to their 2D defaults) when `MapView` unmounts. This prevents the leaked rAF from running on the recycled map across navigations.
5. **Defensive curtain timeout outside `handleMapLoad`.** Add a top-level `useEffect` that fires a fallback `setMapLoaded(true)` after `MIN_CURTAIN_MS + 200ms` from mount, so even if both `onLoad` and the loaded-detector somehow miss, the curtain reliably fades. Ref-guarded so it doesn't fight the primary path.

Result: every `/map` mount runs the full setup, every unmount cleans up, and the curtain reliably fades on every visit.

## Feature Metadata

**Feature Type**: Bug Fix
**Estimated Complexity**: Low-Medium (small surface area, but requires understanding react-map-gl + mapbox-gl lifecycle interactions)
**Primary Systems Affected**: `components/map/MapView.tsx` only. No schema, no API, no other components.
**Dependencies**: None. No new packages.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `components/map/MapView.tsx` (entire file, especially lines 80–207) — Why: this is the surgery site. The `mapLoaded` state, `handleMapLoad`, `handleMarkerClick`, `handleBackToUtah`, `startOrbit`, `stopOrbit`, the `<Map>` JSX with `reuseMaps`, and the curtain JSX all live here.
- `components/map/StartupMarker.tsx` (lines 31–38) — Why: shows the existing `useMap()` null guard. We do **not** need to replicate that guard in MapView; markers self-protect against `getCanvasContainer()` returning undefined.
- `components/map/MapClient.tsx` (lines 17–44) — Why: confirms `MapView` is dynamically imported with `ssr: false`. The dynamic loading state matters because Next 16 prerenders the shell while waiting for the import; the bug only manifests once the client component mounts.
- `lib/map/store.ts` (entire file) — Why: the Zustand store is module-level (singleton). `selectedStartup` and `mode` carry across navigations unless we explicitly reset them. Setters available: `setSelectedStartup(null)`, `setMode("2d")`. **Do NOT** call `clearFilters()` — voice-set filters are intentional state.
- `lib/map/mapConfig.ts` (entire file) — Why: source of `UTAH_BOUNDS`, `MAPBOX_STYLE_CONFIG`, `FOG_2D`, `FOG_3D`. The dark style is applied through `MAPBOX_STYLE_CONFIG` keys via `setConfigProperty`. We need to factor the setup steps into a function that's called from both `handleMapLoad` and the new mount detector — same constants, same calls.
- `app/map/page.tsx` (entire file) — Why: confirms the route tree. `MapClient` wraps `MapView` in a `<Suspense>` boundary; the page itself is a server component. No fix is needed here, but understand the entry flow.
- `ai-context/plans/map-load-state-bugfix.md` (entire file) — Why: explains the prior (incomplete) attempt at fixing remount issues. The "Why `reuseMaps` is kept" section at lines 369–371 documents why we can't just remove `reuseMaps`.
- `ai-context/INEFFICIENCIES.md` (lines 81–94) — Why: existing entries on the map. Add a new entry documenting the orbit-rAF leak so future maintainers know what was fixed.

### Existing Files That Change

- `components/map/MapView.tsx` — the only code file changed. Surgical edits inside the existing component:
  - Extract `handleMapLoad`'s body into a `runMapSetup()` helper (still inside the component, as a `useCallback`).
  - Add `mapSetupFiredRef` (a `useRef<boolean>(false)`) for idempotency.
  - Add a mount-only `useEffect` that detects `map.loaded()` and calls `runMapSetup()` for the reuseMaps path.
  - Add a mount-only `useEffect` that resets Zustand state (`setSelectedStartup(null)`, `setMode("2d")`).
  - Add a defensive curtain-fallback `useEffect` (`setMapLoaded(true)` after MIN_CURTAIN_MS + 200ms, guarded).
  - Add an unmount cleanup `useEffect` that calls `stopOrbit()` and resets fog/3d-objects to 2D defaults.

### New Files to Create

None.

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [react-map-gl `reuseMaps` prop](https://visgl.github.io/react-map-gl/docs/api-reference/map#reusemaps)
  - Specific section: "If true, the underlying Mapbox instance will be reused across mounting and unmounting."
  - Why: confirms the recycle behavior. Read the linked GitHub discussions for the well-known onLoad-doesn't-refire caveat.
- [react-map-gl issue #2296: "onLoad not called on second mount with reuseMaps"](https://github.com/visgl/react-map-gl/issues/2296)
  - Why: documents the exact bug we're working around. The recommended workaround is exactly this plan: post-mount `map.loaded()` check.
- [mapbox-gl `Map#loaded`](https://docs.mapbox.com/mapbox-gl-js/api/map/#map#loaded)
  - Specific section: "Returns a Boolean indicating whether the map is fully loaded."
  - Why: this is the canonical signal that the style + sources + tiles are ready. Use this in the detector.
- [mapbox-gl `Map#isStyleLoaded`](https://docs.mapbox.com/mapbox-gl-js/api/map/#map#isstyleloaded)
  - Why: alternative gate — `loaded()` includes tiles, `isStyleLoaded()` is just style. We want `loaded()` for parity with `onLoad`.
- [react-map-gl Map ref API](https://visgl.github.io/react-map-gl/docs/api-reference/map#methods)
  - Specific section: `getMap()` returns the underlying mapbox-gl `Map` instance.
  - Why: the detector uses `mapRef.current?.getMap()?.loaded()`.
- [React 18 "useEffect runs after paint"](https://react.dev/reference/react/useEffect#examples-basic)
  - Why: the detector should use `requestAnimationFrame` inside the effect to wait one frame after paint, giving react-map-gl time to assign the ref.

### Patterns to Follow

**`useCallback` with stable refs (existing pattern in this file):**

```tsx
// from MapView.tsx:100-154 — handleMapLoad uses [] deps with .current refs
const runMapSetup = useCallback(() => {
  const map = mapRef.current?.getMap();
  if (!map) return;
  if (mapSetupFiredRef.current) return;
  mapSetupFiredRef.current = true;
  // ... apply config + fog + fitBounds + reveal logic here ...
}, []);
```

**Try/catch around Mapbox config calls (existing pattern, do not change):**

```tsx
try {
  (map as unknown as StandardConfigMap).setConfigProperty("basemap", key, value);
} catch {
  // Some Standard config keys may not exist in all style versions
}
```

**Zustand setter calls (existing pattern):**

```tsx
const { setSelectedStartup, setMode } = useMapStore();
// ...
setSelectedStartup(null);
setMode("2d");
```

**Mount-only useEffect with rAF for "after first paint" timing:**

```tsx
useEffect(() => {
  // Wait one animation frame so react-map-gl has wired up the ref
  // (the ref assignment happens during commit, before paint, but
  // mapbox-gl's internal loaded state may need one frame to settle).
  let cancelled = false;
  const id = requestAnimationFrame(() => {
    if (cancelled) return;
    const map = mapRef.current?.getMap();
    if (map?.loaded()) {
      runMapSetup();
    }
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(id);
  };
}, [runMapSetup]);
```

**Unmount cleanup (NEW — pattern to introduce):**

```tsx
useEffect(() => {
  // Cleanup-only effect: cancel the orbit rAF and reset fog/3d on unmount,
  // so a recycled map doesn't carry rotation or 3D state into the next mount.
  return () => {
    stopOrbit();
    const map = mapRef.current?.getMap();
    if (!map) return;
    try { (map as unknown as StandardConfigMap).setConfigProperty("basemap", "show3dObjects", false); } catch {}
    try { (map as unknown as { setFog: (s: unknown) => void }).setFog(FOG_2D); } catch {}
  };
}, [stopOrbit]);
```

---

## IMPLEMENTATION PLAN

### Phase 1: Refactor — extract `runMapSetup` from `handleMapLoad`

The current `handleMapLoad` body contains both event-listener setup (`setConfigProperty`, `setFog`, `fitBounds`) and reveal logic (`map.on("idle", reveal)` + `setTimeout(reveal, MIN_CURTAIN_MS)`). We want to call this same logic from two places: the cold-path `onLoad` event AND the warm-path mount detector.

**Tasks:**
- Add a `mapSetupFiredRef = useRef(false)` to guard against double-execution.
- Extract the body of `handleMapLoad` into a new `useCallback` named `runMapSetup`. Both the existing `onLoad={handleMapLoad}` callback and the new mount detector call `runMapSetup()`.
- Make `handleMapLoad` itself a one-line wrapper that calls `runMapSetup()`. (Keeps the existing JSX wiring intact.)
- Inside `runMapSetup`: at the top, `if (mapSetupFiredRef.current) return; mapSetupFiredRef.current = true;`
- Inside the cleanup `useEffect`, **DO NOT** reset `mapSetupFiredRef.current = false`. The ref is already fresh on remount because `useRef(false)` initializes on every component mount.

### Phase 2: Add the warm-path detector

Add a mount-only `useEffect` that runs once after first paint and checks if the map is already loaded.

**Tasks:**
- Inside the effect, schedule a `requestAnimationFrame` to wait one frame, then read `mapRef.current?.getMap()?.loaded()`.
- If `loaded()` is true, call `runMapSetup()`. The ref guard prevents double-fire if `onLoad` is also about to fire.
- Cleanup function cancels the rAF.

### Phase 3: Reset Zustand state on every mount

The Zustand store is module-level; `selectedStartup` and `mode` carry across navigations. On every `MapView` mount, clear them so the user always lands on the Utah view with no panel open.

**Tasks:**
- Add a mount-only `useEffect` that calls `setSelectedStartup(null)` and `setMode("2d")` once on mount.
- Do **not** include the setters in the dep array as they're stable Zustand setters; an empty dep array is correct and matches the existing pattern in this codebase.
- Do **not** clear filters — voice-set filters from `MapSidebar` are intentional and should persist.

### Phase 4: Add unmount cleanup for orbit + fog

Cancel the rAF and reset fog/3d state when `MapView` unmounts so the recycled map starts each new mount in a clean 2D state.

**Tasks:**
- Add a `useEffect` whose body is `return () => { stopOrbit(); /* reset fog + 3d-objects */ };`. Empty body, only cleanup runs.
- Reset `setConfigProperty("basemap", "show3dObjects", false)` and `setFog(FOG_2D)` defensively. These will be re-set correctly on the next mount via `runMapSetup`.
- This is independent of the existing `handleBackToUtah` callback; it covers the case where the user navigates away from `/map` while in 3D orbit mode without first clicking "← Back to Utah."

### Phase 5: Defensive curtain fallback

Add a top-level fallback that flips `mapLoaded = true` after `MIN_CURTAIN_MS + 200ms` from mount, regardless of `onLoad` or detector outcomes. This is belt-and-suspenders insurance against any future regression in the primary paths.

**Tasks:**
- Add a `useEffect` with empty deps that schedules `setTimeout(() => setMapLoaded(true), MIN_CURTAIN_MS + 200)`.
- Cleanup clears the timer on unmount.
- This is safe because `setMapLoaded(true)` is idempotent at the React state level — calling it twice is a no-op after the first.

### Phase 6: Documentation

**Tasks:**
- Update `ai-context/INEFFICIENCIES.md` with a new entry "Map — Orbit rAF leaked across navigations (Feature: map-remount-bugfix)" documenting the prior bug and the cleanup added.
- No `SECURITY.md` change needed (no security surface area here).

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order. Each task is atomic and independently testable.

### UPDATE `components/map/MapView.tsx` — extract `runMapSetup` and add idempotency guard

- **IMPLEMENT**: Add `const mapSetupFiredRef = useRef(false);` near the other refs (right after `mountedAtRef` at line 81). Then refactor `handleMapLoad` (lines 100–154):
  - Create a new `runMapSetup` `useCallback` that contains the existing body of `handleMapLoad` verbatim, but prefixed with the idempotency guard.
  - Reduce `handleMapLoad` to: `const handleMapLoad = useCallback(() => runMapSetup(), [runMapSetup]);`. Keep this so the `<Map onLoad={handleMapLoad} />` wiring at line 296 doesn't change.
  - Inside `runMapSetup`, at the top: `const map = mapRef.current?.getMap(); if (!map) return; if (mapSetupFiredRef.current) return; mapSetupFiredRef.current = true;` then the rest of the existing handleMapLoad body.
- **PATTERN**: Existing `useCallback` style at lines 100, 156, 163, 171.
- **IMPORTS**: No new imports — `useRef` is already imported via `useRef` at line 73.
- **GOTCHA**: Don't move the `Object.entries(MAPBOX_STYLE_CONFIG).forEach(...)` block, the `setFog(FOG_2D)` call, or the `map.fitBounds(UTAH_BOUNDS, ...)` call. Keep them in `runMapSetup` exactly where they are. Only the wrapping has changed.
- **GOTCHA**: The `let revealed = false` and `reveal` closure must stay inside `runMapSetup` (not pulled out to module scope) so each setup invocation gets fresh state. The ref guard above prevents re-entry within a single mount.
- **VALIDATE**: `npx tsc --noEmit` — no TypeScript errors. Open `/map` once, confirm the dark style applies and markers render.

### UPDATE `components/map/MapView.tsx` — add warm-path mount detector

- **IMPLEMENT**: Add a new `useEffect` directly below the existing `useState`/`useRef` declarations (around line 86, before any handlers):
  ```tsx
  // Warm-path detector — when react-map-gl reuses a pooled mapbox-gl
  // instance (after the first /map → / → /map navigation), `onLoad`
  // does NOT re-fire because the underlying instance is already loaded.
  // We detect that here by checking map.loaded() one animation frame
  // after mount. The idempotency guard inside runMapSetup prevents a
  // double-fire on the cold path (when onLoad fires moments later).
  useEffect(() => {
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      const map = mapRef.current?.getMap();
      if (map?.loaded()) {
        runMapSetup();
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [runMapSetup]);
  ```
- **PATTERN**: Mirror the rAF + cancelled-flag pattern from any other useEffect that needs "wait one frame" semantics.
- **GOTCHA**: `runMapSetup` must be in the deps array. Because it's wrapped in `useCallback([])`, its identity is stable, so this effect only runs once per mount.
- **GOTCHA**: Don't use `requestIdleCallback` — Safari support is incomplete and the timing window is wider than we want.
- **VALIDATE**: Manual test — navigate `/map` → `/` → `/map`. The dark style, Utah border, and markers must appear within ~1 second. Do this 3 times to confirm reliability.

### UPDATE `components/map/MapView.tsx` — reset Zustand UI state on every mount

- **IMPLEMENT**: Add another mount-only `useEffect` after the warm-path detector:
  ```tsx
  // Reset map-level UI state on every mount so a navigation to /map
  // always lands on a clean Utah view, regardless of where the prior
  // session left off (e.g. zoomed into a marker in 3D mode).
  useEffect(() => {
    setSelectedStartup(null);
    setMode("2d");
  }, [setSelectedStartup, setMode]);
  ```
- **PATTERN**: Existing Zustand setter usage at lines 82, 176, 213.
- **GOTCHA**: Zustand setters are stable identities — including them in the dep array is technically fine but the effect only runs once on mount. Do **NOT** include `selectedStartup` or `mode` themselves in the deps; they would cause the effect to re-fire when state changes during normal use, fighting the user's interactions.
- **GOTCHA**: Do **NOT** also call `clearFilters()`. Voice-set filters are intentional state and should persist.
- **VALIDATE**: Manual test — click a marker on `/map` (enters 3D zoom + opens InfoPanel), navigate to `/`, navigate back to `/map`. The view should be Utah-framed in 2D and the InfoPanel should be closed.

### UPDATE `components/map/MapView.tsx` — add unmount cleanup for orbit + fog

- **IMPLEMENT**: Add a useEffect that exists *only* for its cleanup function:
  ```tsx
  // Unmount cleanup: cancel orbit rAF and reset fog/3d-objects so a
  // recycled map doesn't carry 3D-orbit state into the next mount.
  useEffect(() => {
    return () => {
      stopOrbit();
      const map = mapRef.current?.getMap();
      if (!map) return;
      try {
        (map as unknown as StandardConfigMap).setConfigProperty(
          "basemap",
          "show3dObjects",
          false
        );
      } catch {}
      try {
        (map as unknown as { setFog: (s: unknown) => void }).setFog(FOG_2D);
      } catch {}
    };
  }, [stopOrbit]);
  ```
- **PATTERN**: The same try/catch pattern used in `handleBackToUtah` (lines 215–227).
- **GOTCHA**: This effect's *body* is empty (just returns the cleanup). That's intentional. The cleanup runs on unmount.
- **GOTCHA**: `stopOrbit` is a `useCallback` (line 156) with stable identity — including it in deps is fine.
- **VALIDATE**: Add a `console.log("MapView unmount cleanup ran")` in the cleanup temporarily. Click a marker (starts orbit), navigate away. Confirm the log fires. Remove the log before final commit.

### UPDATE `components/map/MapView.tsx` — defensive curtain fallback

- **IMPLEMENT**: Add a final mount-only useEffect:
  ```tsx
  // Defensive curtain fallback — even if both onLoad and the warm-path
  // detector somehow miss, force the curtain to fade after a fixed
  // window. setMapLoaded is idempotent so this is safe to fire alongside
  // the primary paths.
  useEffect(() => {
    const timer = setTimeout(() => setMapLoaded(true), MIN_CURTAIN_MS + 200);
    return () => clearTimeout(timer);
  }, []);
  ```
- **PATTERN**: Existing `setTimeout(reveal, MIN_CURTAIN_MS)` pattern at line 153.
- **GOTCHA**: Empty deps array `[]` — runs once per mount. setMapLoaded is stable across renders, no need to include it.
- **VALIDATE**: Temporarily disable the warm-path detector (comment out its body) and disable `onLoad` (set `onLoad={undefined}`). Navigate to `/map`. Confirm the curtain fades after ~1 second and (visually) the map appears even though the dark-style config didn't apply (this confirms the curtain falls back independently). Re-enable both paths before committing.

### UPDATE `ai-context/INEFFICIENCIES.md`

- **IMPLEMENT**: Append a new entry under the existing "Current" section:

  ```markdown
  ### Map — Orbit rAF leaked across navigations (Feature: map-remount-bugfix)
  **Impact:** Medium (cause of the post-navigation freeze symptom)
  **Context:** `startOrbit(map)` schedules a `requestAnimationFrame` loop that calls `map.setBearing(...)` 60×/sec. The loop was never cancelled on `MapView` unmount. Combined with `reuseMaps` (which preserves the underlying mapbox-gl instance across navigations), the rAF kept running on the new mount, fighting any camera reset and creating an unresponsive feel.
  **Ideal solution:** Current solution — `useEffect` cleanup that calls `stopOrbit()` on unmount.
  **Workaround in place:** None needed — fixed in this feature.
  ```

- **PATTERN**: Mirror the existing entry style at lines 33–37.

### VERIFY (no edit) — `<Map>` JSX still has `reuseMaps`

- **IMPLEMENT**: Confirm `reuseMaps` is still on the `<Map>` element (line 285). Do **NOT** remove it. The fix is compatible with `reuseMaps`; removing it would re-introduce the `appendChild of undefined` marker crash documented in the comment at lines 278–285.
- **VALIDATE**: `grep -n "reuseMaps" components/map/MapView.tsx` should return one line.

---

## TESTING STRATEGY

This codebase has no test framework. All validation is manual end-to-end browser testing. The bug only reproduces in real navigation; HMR / hot reload doesn't always trigger it.

### Manual end-to-end (the primary regression case)

1. `npm run dev` and open `http://localhost:3000`.
2. Click "Explore the map." → arrives on `/map`. Confirm:
   - Black curtain fades within ~1 second.
   - Dark Mapbox Standard style applied (near-black land, dim roads).
   - Green Utah border outline visible.
   - All ~255 startup markers visible.
   - Camera is framing all of Utah.
3. Click any startup marker → 3D zoom-in + InfoPanel opens.
4. Without clicking "← Back to Utah", click the Nexis logo or browser back to navigate to `/`.
5. Click "Explore the map." again → arrives on `/map`. Confirm:
   - Black curtain fades within ~1 second.
   - Dark style is reapplied (NOT the default light Standard style).
   - Green Utah border visible.
   - All ~255 markers visible.
   - Camera is framing all of Utah (NOT zoomed into the prior marker).
   - InfoPanel is closed.
   - Page is responsive: hover on markers shows tooltip, clicking a different marker triggers fly-to.
6. Repeat steps 4–5 three more times in rapid succession. The map must render correctly every time.

### Edge cases

- **Cold first load on a fresh tab**: works as before — no regression.
- **Navigate from `/resources` → `/map`**: works the same as `/` → `/map`.
- **HMR / fast refresh during dev**: `mapSetupFiredRef.current` resets on every fast-refresh remount, so setup re-runs. Confirm dev experience is unchanged.
- **Click marker, navigate away, navigate back, click same marker again**: the second click should fly-to from Utah view (because state was reset on remount).
- **Navigate to `/map` with no `NEXT_PUBLIC_MAPBOX_TOKEN`**: the existing token-missing fallback at line 242 still applies; the new effects don't run because `<Map>` isn't rendered.
- **Voice-set filters before navigating away**: filters should persist (we explicitly do not reset them). Confirm by setting filters via voice, navigating away, navigating back — filters still applied.
- **Mobile viewport (`width < 768`)**: `MapClient.tsx` switches sidebar visibility but `MapView` is the same; bug should be fixed on mobile too.

### What to look for in the browser console

- No new errors. The pre-existing `events.mapbox.com` `ERR_BLOCKED_BY_CLIENT` and `logo.clearbit.com` `ERR_BLOCKED_BY_CLIENT` lines are an ad blocker — unrelated and unchanged.
- No "Cannot read property 'getCanvasContainer' of undefined" errors. The `useMap()` guard in `StartupMarker.tsx` handles this; the new code doesn't introduce any path where it would surface.
- No "Source already exists" or "Layer with id ... already exists" errors. react-map-gl's reconciliation should handle this; if any appear after this change, they indicate a regression in the `<Source id="utah-border">` lifecycle and must be investigated.

---

## VALIDATION COMMANDS

### Level 1: Syntax & types

```bash
npm run lint
npx tsc --noEmit
```

### Level 2: Production build

```bash
npm run build
```

Catches any client/server boundary or hook-rules violations.

### Level 3: Dev server + manual end-to-end

```bash
npm run dev
```

Then walk the manual steps above. The fix is verified by completing 3 consecutive `/map → / → /map` cycles with the dark style and markers appearing every time.

### Level 4: Optional — verify rAF cleanup

In Chrome DevTools, open Performance → Record. Click a marker (orbit starts), navigate to `/`, stop recording. In the flame chart, look for `requestAnimationFrame` callbacks after the navigation timestamp. After this fix: there should be NONE. Before this fix: there were continuous `setBearing` calls firing post-navigation.

---

## ACCEPTANCE CRITERIA

- [ ] Navigating `/` → `/map` → `/` → `/map` shows the full dark-styled map with green Utah outline and all markers on every visit, no exceptions.
- [ ] After clicking a marker (entering 3D zoom + InfoPanel), navigating away, and navigating back, the map is reset to Utah-framed 2D with no panel open.
- [ ] The page remains responsive after multiple navigation cycles (hover effects work, clicks register, no apparent slowdown from leaked rAF).
- [ ] Voice-set filters persist across navigations (not reset by the new effects).
- [ ] `npm run build` succeeds with zero errors.
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] No new console errors appear in normal usage; pre-existing ad-blocker noise is unchanged.
- [ ] `ai-context/INEFFICIENCIES.md` has the new entry on orbit rAF cleanup.
- [ ] `reuseMaps` is still set on `<Map>` (we did NOT regress the appendChild fix).

---

## COMPLETION CHECKLIST

- [ ] Refactor: `runMapSetup` extracted, `handleMapLoad` reduced to a wrapper.
- [ ] `mapSetupFiredRef` ref guard added; setup is idempotent within a single mount.
- [ ] Warm-path detector `useEffect` added (rAF + `map.loaded()` check).
- [ ] State-reset `useEffect` added (`setSelectedStartup(null)`, `setMode("2d")`).
- [ ] Unmount cleanup `useEffect` added (`stopOrbit()` + reset fog + 3d-objects).
- [ ] Defensive curtain fallback `useEffect` added.
- [ ] `INEFFICIENCIES.md` updated.
- [ ] All validation commands executed.
- [ ] Manual 3× back-and-forth navigation test passed.

---

## NOTES

### Why we don't remove `reuseMaps`

Removing `reuseMaps` would trigger the `appendChild of undefined` crash that was specifically fixed by adding it (see `MapView.tsx:278-285` and `map-load-state-bugfix.md` notes). Each navigation would also pay ~200–500ms to instantiate a fresh mapbox-gl Map, which is wasteful. The detector approach is strictly additive: cold path keeps using `onLoad`, warm path uses the new detector — no regression risk on either side.

### Why a `requestAnimationFrame` delay in the detector

react-map-gl assigns `mapRef.current` during commit (synchronously, before paint). However, `useEffect` runs after commit and *after* paint in React 18. In practice the ref is already set by the time the effect runs, but we add `requestAnimationFrame` as a defensive single-frame delay so we never read `loaded()` before mapbox-gl has had a chance to settle its internal flags after a remount. This costs at most ~16ms of additional latency on the warm path.

### Why we don't use `map.on("load", ...)` directly

Adding our own `load` listener to the underlying mapbox-gl instance would also work — but `load` is a one-shot event. On a reused map, mapbox-gl has already fired `load` on a prior session, and our new listener would never receive it. The same problem as `onLoad`. The `loaded()` accessor is the only reliable check.

### Why the ref guard `mapSetupFiredRef`

Without it, the cold path could double-fire setup: detector calls `runMapSetup()` (because the map happens to load *very* quickly, before paint), then `onLoad` fires and calls it again. The `setConfigProperty` calls are idempotent — but `map.on("idle", reveal)` and `setTimeout(reveal, ...)` are not (they'd attach two listeners and start two timers). The ref guard is cheap insurance.

### Why state reset uses an empty-deps `useEffect`

We want this to fire exactly once per `MapView` mount. The Zustand setters `setSelectedStartup` and `setMode` have stable identities (Zustand guarantees this), so technically the dep array doesn't matter — but `[setSelectedStartup, setMode]` is more explicit and lints cleanly. Including the *current values* (`selectedStartup`, `mode`) in deps would cause the effect to re-fire whenever those change during normal interaction, fighting the user.

### Why we don't reset `filters`

Voice-set filters from `MapSidebar`'s `VoiceFilterButton` are explicit user input. Resetting them on every navigation would surprise the user — they'd say "show me FinTech companies", look at the map, navigate to read about a startup elsewhere, navigate back, and find their filter gone. Filters persist by design.

### Forward compatibility

If a future change replaces `<Map reuseMaps>` with `<Map>` (no reuse), the warm-path detector becomes a no-op (because `loaded()` will be false on every fresh mount, and `onLoad` will fire shortly after). All other effects stay valid.

---

## CONFIDENCE SCORE

**9/10** for one-pass implementation. Risks:

- The bug is reproducible only in real navigation (not refresh), so visual validation must be done in a browser, not via build/lint. The plan calls this out and includes specific manual steps.
- The "freeze" component of the user's report is most likely the leaked orbit rAF, but if there's another underlying cause not captured here (e.g. an infinite render loop introduced elsewhere on a recent commit), the rAF cleanup alone won't resolve it. The defensive curtain fallback gives partial cover.
- Strict-mode double-mounts in dev could cause the warm-path detector to fire `runMapSetup()` from one mount, then strict-mode unmounts and remounts, and the second mount's detector also fires. The ref guard within the *new mount* (fresh ref) means setup runs once per real mount — which is correct. Confirmed safe by inspection.
