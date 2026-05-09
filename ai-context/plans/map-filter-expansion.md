# Feature: Map Filter Expansion — Tap-to-Filter, Counties, Hiring, Facet Counts

The following plan should be complete, but it is important that you validate documentation, codebase patterns, and task sanity before you start implementing.

Pay special attention to: the **inline-styles-only** rule inside `components/map/*` (no Tailwind), the existing partial filter machinery in `lib/map/store.ts` + `components/map/FilterChips.tsx` + `components/map/VoiceFilterButton.tsx`, and the fact that `MapView.isVisible` (the marker-dimming function) is the single source of truth for "is this startup currently visible." Every new dimension must flow through that function.

---

## Feature Description

Today the only way to filter the map is by voice — you say "show me Series A FinTech," `parse-filter` calls Claude, and the store's `filters` object updates. There is no manual UI: no chips to tap, no county filter, no hiring toggle. The user can never *discover* what filter dimensions exist or how many companies match each option. The "filterable and fast" + "rewards exploration" requirement is asking for a tap-driven filter surface that surfaces every dimension visibly, with live match counts.

This plan adds:

1. **A new `county text` column** on `startups`, populated by a one-time backfill script that runs Utah-counties point-in-polygon against existing `lat/lng`. Future self-serve inserts (planned in `self-serve-add-startup.md`) compute county at insert time using the same shared helper.
2. **A new `FilterCriteria` shape** that adds `county: string[]` and `hiring: boolean`. Existing voice flow continues to work; the parser is extended to populate the new fields.
3. **A tap-driven `FilterPanel`** with five dimension groups (Stage, Size, Sector, County, Hiring). Each option is a chip showing both the value AND the live count of matching startups given the *other* active filters (proper faceted counts — never zero out the only option in its own group).
4. **Desktop layout**: FilterPanel embeds inside the existing `MapSidebar` directly below the voice mic. Mobile gets a single "Filters (N)" button that opens a bottom-sheet `FilterDrawer` wrapping the same FilterPanel.
5. **Voice + tap parity**: speaking "Series A FinTech in Salt Lake County hiring" sets the same store state as tapping the equivalent chips. Voice and tap merge into the same FilterChips strip at the top of the map. "Clear all" resets every dimension.

The map is already client-side: 255 startups loaded once on `/map`, filtered in `MapView.isVisible`. We keep that architecture — facet counts are computed in-memory in O(N × M) where N=255, M=5, which is sub-millisecond. No new server queries, no new RPCs.

## User Story

As a visitor exploring Utah's startup ecosystem,
I want to filter the map by stage, size, sector, county, and hiring status with my taps OR my voice, with live counts that show me what I'd find,
So that I can discover companies along whichever dimension matters to me — without learning what to ask for first.

## Problem Statement

Three concrete gaps, all visible to a hackathon judge:

- **Discoverability**: a first-time visitor doesn't know voice filtering exists, doesn't know what dimensions they can ask about, and gets no preview of what filtering would reveal. The map looks impressive but feels static.
- **Two of the requested five dimensions are missing**: hiring status is in the schema but unfilterable; location is mentioned in voice prompts but isn't a filter dimension at all.
- **Voice-only is fragile**: Deepgram's silence detection + Claude's extraction add 1–3 seconds of latency per filter change. Tap is instant.

## Solution Statement

- **County**: cleanest dimension for "location." 29 Utah counties is a manageable chip count, and once derived from `lat/lng` via point-in-polygon, filtering becomes a string-set lookup. Region presets and distance-from-point are deferred — county is the right starting granularity for an ecosystem map.
- **Hiring**: a single boolean toggle. "Hiring only" is the only mode users actually want; "not hiring" is never a useful filter.
- **Facet counts**: each chip shows `<value> (<count>)` where count is recomputed on every filter change, excluding the chip's own dimension from the active filters (so unselected chips in the same group always show their unconditional reach within the *other* dimensions). This is the standard Algolia/Mapbox/Airbnb pattern and is the cheapest mechanic that delivers the "rewards exploration" feeling.
- **No new dependencies, no new server endpoints**. The voice route already exists; we extend its prompt. The store already exists; we extend its shape. The `isVisible` function already exists; we extend its checks.

## Feature Metadata

**Feature Type**: Enhancement (extends existing filter system) + small Schema change (county column + backfill)
**Estimated Complexity**: Medium
**Primary Systems Affected**:
- New: `lib/map/county.ts`, `lib/map/facets.ts`, `lib/map/filterConstants.ts`, `public/utah-counties.geojson`, `scripts/backfill-counties.ts`, `components/map/filters/{FilterPanel,FilterDrawer,FilterGroup,FilterChip}.tsx`, `supabase/migrations/20260513000000_add_county_column.sql`
- Modified: `lib/map/types.ts`, `lib/map/store.ts`, `components/map/MapView.tsx`, `components/map/FilterChips.tsx`, `components/map/VoiceFilterButton.tsx`, `components/map/MapSidebar.tsx`, `components/map/MapClient.tsx`, `app/api/map/parse-filter/route.ts`, `app/map/page.tsx`, `ai-context/SECURITY.md`, `ai-context/INEFFICIENCIES.md`

**Dependencies**: existing only. No new npm packages. (We could pull `@turf/boolean-point-in-polygon` for the backfill script but a hand-rolled ray-casting routine is ~30 lines and avoids the dep.)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `lib/map/types.ts` (entire file) — Why: the `FilterCriteria` interface (lines 55–59) gets two new fields. The `Startup` interface gets `county?: string`. **Don't break existing imports** — `FilterCriteria` is referenced from multiple components.
- `lib/map/store.ts` (entire file) — Why: the Zustand store's initial state at line 20 and `clearFilters` at line 26 must be updated to include `county: []` and `hiring: false`.
- `components/map/MapView.tsx` (lines 89–98) — Why: `isVisible` is the single dimming function. Extend it for `county` and `hiring`. **Performance matters here** — `isVisible` is called once per marker per render; keep it allocation-free.
- `components/map/FilterChips.tsx` (entire file) — Why: rewrite to also render county chips and the hiring chip. Same chip animation, same removal pattern. **Critical**: with 5 dimensions × multiple selected values per dim, the strip can wrap aggressively — verify on mobile.
- `components/map/VoiceFilterButton.tsx` (lines 43–49) — Why: the response-shape destructure (`{ stage, size, section }`) must be extended to include `county` and `hiring`. The setter call already takes the whole `FilterCriteria` object.
- `app/api/map/parse-filter/route.ts` (entire file) — Why: extend `SYSTEM_PROMPT` (lines 4–9) with the new dimensions; extend the response JSON validation (lines 32–46). The 500-char truncate stays.
- `components/map/MapSidebar.tsx` (entire file) — Why: where `FilterPanel` mounts on desktop. The existing `hasFilters` block (lines 95–120) becomes the responsibility of `FilterChips` — but we keep `FilterChips` separate so it can also live at the top of the mobile map.
- `components/map/MapClient.tsx` (lines 97–116) — Why: where the mobile filter button + drawer mounts. Replace the bare `FilterChips` rendering at the top with a "Filters (N)" button that opens `FilterDrawer`.
- `app/map/page.tsx` (line 12) — Why: add `, county` to the SELECT.
- `scripts/import-startups.ts` (entire file) — Why: pattern reference for service-role bulk write. Backfill script mirrors this almost verbatim.
- `scripts/geocode-startups.ts` (lines 60–113) — Why: pattern reference for the one-off script style + dotenv loading + chunked progress logging.
- `lib/matching/structuredFilter.ts` if it exists — Why: existing pattern for facet-style filtering on `resources`. (May or may not be similar; reference if present.)
- `ai-context/SECURITY.md` (lines 67–74) — Why: format for the new map-filter entry.
- `ai-context/INEFFICIENCIES.md` (lines 81–110) — Why: format for the new entries (facet recomputation, full-state geojson size).
- `public/utah-border.geojson` (existing file) — Why: precedent for shipping GeoJSON in `public/`. Same source the new `public/utah-counties.geojson` is fetched from.

### Existing Files That Change

- `supabase/migrations/` — ADD `20260513000000_add_county_column.sql`.
- `lib/map/types.ts` — EXTEND `FilterCriteria` and `Startup`. **Add a backwards-compat shim**: `setFilters` callers passing the old shape (without `county`/`hiring`) must still type-check. Either: make the new fields optional in `FilterCriteria` and default in the store reducer, OR (cleaner) update every call site in this same change. **Choose the second**: there are only 3 call sites (`VoiceFilterButton`, `FilterChips`, parse-filter response handler) — easier to update them all than carry a shim forever.
- `lib/map/store.ts` — EXTEND initial state, `setFilters` accepts the new shape, `clearFilters` resets all five dimensions.
- `components/map/MapView.tsx` — EXTEND `isVisible`.
- `components/map/FilterChips.tsx` — REWRITE chip iteration to handle 5 dimensions including the boolean.
- `components/map/VoiceFilterButton.tsx` — EXTEND parse-filter response handling.
- `components/map/MapSidebar.tsx` — INSERT `<FilterPanel />` below the voice mic block.
- `components/map/MapClient.tsx` — REPLACE the mobile-only `FilterChips` block at the top with a "Filters (N) ▾" button that toggles `<FilterDrawer />`.
- `app/api/map/parse-filter/route.ts` — EXTEND prompt + JSON parser.
- `app/map/page.tsx` — ADD `, county` to the SELECT string.
- `ai-context/SECURITY.md` — APPEND a new entry.
- `ai-context/INEFFICIENCIES.md` — APPEND new entries.

### New Files to Create (in dependency order)

```
supabase/migrations/20260513000000_add_county_column.sql      ← county text + index
public/utah-counties.geojson                                  ← 29 Utah county polygons
lib/map/filterConstants.ts                                    ← UTAH_COUNTIES list (canonical names)
lib/map/county.ts                                             ← point-in-polygon → county name
lib/map/facets.ts                                             ← computeFacets(startups, filters) → counts
scripts/backfill-counties.ts                                  ← one-time service-role backfill
components/map/filters/FilterChip.tsx                         ← single option chip with count
components/map/filters/FilterGroup.tsx                        ← labeled group (chips + collapse)
components/map/filters/FilterPanel.tsx                        ← all 5 groups, desktop inline
components/map/filters/FilterDrawer.tsx                       ← mobile bottom-sheet wrapping FilterPanel
```

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [Mapbox: Utah counties GeoJSON via US Census](https://www2.census.gov/geo/tiger/GENZ2018/shp/) — the canonical source. We can fetch the simplified state-counties file and filter to Utah's 49 FIPS code (state) → 29 county polygons.
- [PublicaMundi mirror — US counties simplified](https://github.com/PublicaMundi/MappingAPI/blob/master/data/geojson/us-states.json) — the existing repo also serves a counties file at the same prefix; convenient one-line `curl` source.
- [Ray-casting point-in-polygon (Wikipedia)](https://en.wikipedia.org/wiki/Point_in_polygon#Ray_casting_algorithm) — the algorithm we hand-roll. ~25 lines, no edge cases for our use (counties don't overlap, points either land in one or are off the map).
- [Algolia: faceting overview](https://www.algolia.com/doc/guides/managing-results/refine-results/faceting/) — vocabulary primer. We're implementing the simplest version: per-option counts.
- [shadcn/ui: command + popover patterns](https://ui.shadcn.com/docs/components/popover) — reference only. **We don't use shadcn inside `components/map/*`** — inline styles only.
- [framer-motion: AnimatePresence list](https://www.framer.com/motion/animate-presence/) — already used for FilterChips; reuse.

### Patterns to Follow

**Inline styles in `components/map/*`** (no Tailwind, no shadcn). Mirror existing chip shape from `FilterChips.tsx:44-56`:

```tsx
{
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "5px 12px",
  backgroundColor: "rgba(0,0,0,0.82)",
  backdropFilter: "blur(8px)",
  border: `1px solid ${COLORS.borderAccent}`,
  fontFamily: "ui-sans-serif, system-ui, -apple-system",
  fontSize: "0.75rem",
  color: COLORS.accent,
  letterSpacing: "0.04em",
}
```

**Active vs inactive chip variants** (new pattern, follows the rest of the design language):

```tsx
// Active (selected): solid accent fill, dark text
{
  border: `1px solid ${COLORS.accent}`,
  backgroundColor: COLORS.accent,
  color: "#000",
}
// Inactive: same as the existing chip shape above (transparent w/ accent border)
// Disabled (count = 0): muted border, dim text, cursor not-allowed
{
  border: `1px solid ${COLORS.border}`,
  color: COLORS.textDim,
  cursor: "not-allowed",
  pointerEvents: "none",
}
```

**Zustand store extension (mirror `lib/map/store.ts:20-26`):**

```ts
// Initial state — keep the field order matching the FilterCriteria interface order
filters: { stage: [], size: [], section: [], county: [], hiring: false },
clearFilters: () => set({
  filters: { stage: [], size: [], section: [], county: [], hiring: false },
}),
```

**Facet counts (new helper, see `lib/map/facets.ts` task below):**

```ts
import type { FilterCriteria, Startup } from "./types";

// For each dimension, return a Map<option, count> where count is the number
// of startups matching ALL other active filters AND that option in this dim.
// "Other" = excluding the dimension itself, so an unselected chip in the same
// group still shows its unconditional reach within the other dims.
export function computeFacets(
  startups: Startup[],
  filters: FilterCriteria
): {
  stage: Map<string, number>;
  size: Map<string, number>;
  section: Map<string, number>;
  county: Map<string, number>;
  hiringCount: number; // count of startups matching all other filters AND hiring=true
  totalCount: number;  // count matching all current filters
};
```

**Voice prompt extension (mirror `app/api/map/parse-filter/route.ts:4-9`):**

```ts
const SYSTEM_PROMPT = `You extract filter criteria from a user's spoken request about Utah startups.
Return ONLY a JSON object: { "stage": string[], "size": string[], "section": string[], "county": string[], "hiring": boolean }.
Valid stage values: "Pre-Seed", "Seed", "Series A", "Series B+", "Series D+".
Valid size values: "1", "2-10", "11-50", "51-200", "201-500", "200+".
Valid section values: "B2B Software", "FinTech", "Security", "Bio/Medical Tech", "Energy", "Consumer", "Marketplaces".
Valid county values (Utah counties only, exact spelling): "Beaver", "Box Elder", "Cache", "Carbon", "Daggett", "Davis", "Duchesne", "Emery", "Garfield", "Grand", "Iron", "Juab", "Kane", "Millard", "Morgan", "Piute", "Rich", "Salt Lake", "San Juan", "Sanpete", "Sevier", "Summit", "Tooele", "Uintah", "Utah", "Wasatch", "Washington", "Wayne", "Weber".
hiring: true ONLY if the user explicitly mentions hiring/recruiting/jobs.
Empty array = no filter on that dimension. Return nothing except the JSON object.`;
```

---

## IMPLEMENTATION PLAN

### Phase 1: Schema + data backfill

The county column must exist and be populated before any filter UI ships against it. Otherwise the `Salt Lake (0)` chips would render and confuse the demo.

**Tasks:**
- New migration adding `county text` + index.
- New `public/utah-counties.geojson` (29 county polygons).
- New `lib/map/county.ts` — pure point-in-polygon helper.
- New `scripts/backfill-counties.ts` — service-role one-shot script that reads every startup, computes county, writes back.
- New `lib/map/filterConstants.ts` — exported `UTAH_COUNTIES` ordered list (used by both the parser route and the FilterPanel).

### Phase 2: Type + store extension

Once the column exists, extend the TS shape so every consumer compiles against the new `FilterCriteria` and `Startup`.

**Tasks:**
- Extend `FilterCriteria` and `Startup` in `lib/map/types.ts`.
- Extend the Zustand store init + `clearFilters`.
- Update every existing call site (`VoiceFilterButton`, `FilterChips`, `MapView.isVisible`, parse-filter response). The TS compiler will surface them all.

### Phase 3: Facet helper + filter UI

The visual surface where the user discovers what they can filter.

**Tasks:**
- `lib/map/facets.ts` — `computeFacets(startups, filters)` returning per-dimension Maps.
- `components/map/filters/FilterChip.tsx` — single chip with active/inactive/disabled variants and an optional `count` suffix.
- `components/map/filters/FilterGroup.tsx` — collapsible labeled group rendering an array of chips.
- `components/map/filters/FilterPanel.tsx` — all 5 groups stacked, takes startups + facets as props.
- `components/map/filters/FilterDrawer.tsx` — mobile bottom-sheet wrapping FilterPanel.
- Embed `<FilterPanel />` in `MapSidebar.tsx`.
- Replace the mobile-only `FilterChips`-at-top block in `MapClient.tsx` with a "Filters (N)" button + `<FilterDrawer />`.

### Phase 4: Voice route + chip surface extension

The voice flow needs to produce the new filter shape; the chip strip needs to display it.

**Tasks:**
- Extend `parse-filter` route's prompt + JSON parsing.
- Extend `FilterChips.tsx` to render county chips and the hiring chip.
- Extend `MapView.isVisible` to gate on county and hiring.

### Phase 5: Documentation + manual validation

**Tasks:**
- Append SECURITY.md entry (parse-filter input validation against the canonical UTAH_COUNTIES list — no SQL injection surface, but defense in depth).
- Append INEFFICIENCIES.md entries (facet recomputation on every filter change; full-counties GeoJSON shipped client-side; missing per-county marker clustering).
- Manual end-to-end browser testing on desktop + mobile.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order. Each task is atomic and independently testable.

### CREATE `supabase/migrations/20260513000000_add_county_column.sql`

- **IMPLEMENT**:
  ```sql
  -- Canonical Utah county for each startup, derived from lat/lng via
  -- point-in-polygon at insert/backfill time. Used as a filter dimension on
  -- the map. Nullable for legacy rows that haven't been backfilled or for
  -- coordinates outside the Utah polygon (e.g., a stray remote-only HQ).
  alter table startups
    add column if not exists county text;

  create index if not exists startups_county_idx on startups (county);
  ```
- **PATTERN**: Mirror `supabase/migrations/20260510000000_add_claim_columns.sql` for `add column if not exists` + `create index if not exists` shape.
- **GOTCHA**: Do NOT add a CHECK constraint enforcing the value matches `UTAH_COUNTIES`. New companies in border edge cases (e.g., a row whose lat/lng polygon-tests false for all counties) need to insert with `null`, not error.
- **VALIDATE**:
  ```bash
  npx supabase migration up
  # Then in Studio:
  # select column_name, data_type from information_schema.columns
  # where table_name = 'startups' and column_name = 'county';
  ```
  Should return one row.

### CREATE `public/utah-counties.geojson`

- **IMPLEMENT**: Fetch the US Census Bureau 2018 5m simplified counties file, filter to Utah's STATEFP `49`, save as a `FeatureCollection` of 29 county polygons. Each feature must have `properties.NAME` containing the canonical county name (without the word "County" — `"Salt Lake"`, not `"Salt Lake County"`).
- **METHOD**:
  ```bash
  curl -s "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-counties-5m.json" \
    | node -e "
      const chunks=[];
      process.stdin.on('data', c => chunks.push(c));
      process.stdin.on('end', () => {
        const data = JSON.parse(Buffer.concat(chunks).toString());
        const utah = data.features.filter(f => f.properties.STATE === '49');
        // Strip ' County' suffix if present
        utah.forEach(f => {
          if (typeof f.properties.NAME === 'string') {
            f.properties.NAME = f.properties.NAME.replace(/\s+County$/, '');
          }
        });
        console.log(JSON.stringify({ type: 'FeatureCollection', features: utah }));
      });" \
    > public/utah-counties.geojson
  ```
  If the PublicaMundi URL has shifted or 404s, alternative is the US Census Bureau TIGER simplified files at https://www2.census.gov/geo/tiger/GENZ2018/shp/cb_2018_us_county_5m.zip — convert via `mapshaper` or use the same node filtering on `cb_2018_us_county_5m.shp.json`.
- **PATTERN**: Mirror the fetch-and-filter pattern documented in `ai-context/plans/utah-startup-map.md:298-309` (Utah border).
- **GOTCHA**: Verify the file size is 100–500 KB. If it's >2 MB, the polygons aren't simplified — re-source from `cb_2018_us_county_5m` (5m simplification level).
- **GOTCHA**: Verify exactly 29 features land in the file. Utah has 29 counties. Anything off → wrong STATEFP filter or wrong source.
- **VALIDATE**:
  ```bash
  node -e "const d = JSON.parse(require('fs').readFileSync('public/utah-counties.geojson','utf8')); console.log(d.features.length, 'counties:', d.features.map(f=>f.properties.NAME).sort().slice(0,5))"
  ```
  Expect: `29 counties: [ 'Beaver', 'Box Elder', 'Cache', 'Carbon', 'Daggett' ]`.

### CREATE `lib/map/filterConstants.ts`

- **IMPLEMENT**:
  ```ts
  // Canonical list of Utah's 29 counties — exact spelling, in alphabetical order.
  // Used by:
  //   - the FilterPanel (chip rendering order)
  //   - /api/map/parse-filter system prompt (Claude validates against this list)
  //   - lib/map/county.ts (input → output sanity check after point-in-polygon)
  //
  // Keep these strings byte-identical to GeoJSON properties.NAME values in
  // public/utah-counties.geojson (i.e., NO trailing " County").
  export const UTAH_COUNTIES = [
    "Beaver", "Box Elder", "Cache", "Carbon", "Daggett",
    "Davis", "Duchesne", "Emery", "Garfield", "Grand",
    "Iron", "Juab", "Kane", "Millard", "Morgan",
    "Piute", "Rich", "Salt Lake", "San Juan", "Sanpete",
    "Sevier", "Summit", "Tooele", "Uintah", "Utah",
    "Wasatch", "Washington", "Wayne", "Weber",
  ] as const;

  export type UtahCounty = (typeof UTAH_COUNTIES)[number];

  export const UTAH_COUNTIES_SET: Set<string> = new Set(UTAH_COUNTIES);
  ```
- **PATTERN**: Mirror the `as const` + derived type + Set sibling pattern used in `lib/map/types.ts:63-77` for `EDITABLE_STARTUP_KEYS`.
- **GOTCHA**: Don't include county-name aliases (e.g., "SLC" → "Salt Lake"). The Claude prompt does fuzzy mapping; the constant list is the authoritative spelling only.
- **VALIDATE**: `npx tsc --noEmit`.

### CREATE `lib/map/county.ts`

- **IMPLEMENT**: A pure helper that loads the GeoJSON synchronously (server-side via `fs.readFileSync` for the backfill script + future create route) and runs point-in-polygon. Two exported entry points:
  ```ts
  // server-only — reads public/utah-counties.geojson off disk.
  // Used by scripts/backfill-counties.ts and any future server route that
  // needs to compute a county from lat/lng (e.g. self-serve add-startup).
  export function getCountyForCoords(lat: number, lng: number): string | null;

  // pure — accepts a pre-loaded FeatureCollection and runs the same logic.
  // Useful for tests and for any client-side code that wants to import the
  // GeoJSON via fetch + cache it.
  export function getCountyForCoordsWith(
    collection: GeoJSON.FeatureCollection,
    lat: number,
    lng: number
  ): string | null;
  ```
- **PATTERN**: Mirror `lib/startups/geocode.ts` for the server-only file convention (top comment marker).
- **POINT-IN-POLYGON**: Hand-rolled ray-casting — ~30 lines:
  ```ts
  function pointInRing(point: [number, number], ring: number[][]): boolean {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
  ```
  For multipolygons (some Utah counties are simply-connected, but a few have holes / outer-inner ring pairs), the algorithm is: a point is in the multipolygon iff for at least one polygon, it's inside the outer ring AND outside every inner ring. A standard textbook expansion of the above.
- **IMPORTS**:
  ```ts
  import { readFileSync, existsSync } from "fs";
  import path from "path";
  import { UTAH_COUNTIES_SET } from "./filterConstants";
  ```
- **CACHING**: Read the GeoJSON exactly once per process via a module-level `let cache: GeoJSON.FeatureCollection | null = null;`. The backfill script is short-lived; the API-route case (future create-startup) reuses the cache across requests, so disk read is amortized.
- **GOTCHA**: A point may legitimately fall outside every county polygon (a row geocoded with bad coords, or one straddling the state border). Return `null` — let the caller decide whether to insert as null or reject.
- **GOTCHA**: After point-in-polygon, sanity-check `UTAH_COUNTIES_SET.has(name)` before returning. If the GeoJSON ever ships an unexpected name, we want to fail fast instead of polluting the column.
- **VALIDATE**:
  ```bash
  npx tsx -e 'import { getCountyForCoords } from "./lib/map/county.ts"; console.log(getCountyForCoords(40.7608, -111.8910)); console.log(getCountyForCoords(40.2338, -111.6585));'
  ```
  Expect: `Salt Lake` and `Utah`.

### CREATE `scripts/backfill-counties.ts`

- **IMPLEMENT**: A one-shot service-role script:
  1. Load env from `.env.local`.
  2. `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)`.
  3. `select slug, lat, lng, county from startups` → all rows.
  4. For each row where `county === null`, call `getCountyForCoords(lat, lng)`.
  5. Group updates into chunks of 100; `update startups set county = ? where slug = ?` per row (or one batched RPC if you're feeling fancy — chunked individual updates is fine for hackathon).
  6. Log progress every chunk + a final summary `{ total, computed, null_county }`.
- **PATTERN**: Mirror `scripts/import-startups.ts:1-101` for env loading, service-role client, chunk size 100, exit-on-error.
- **IMPORTS**:
  ```ts
  import "dotenv/config";
  import { createClient } from "@supabase/supabase-js";
  import { getCountyForCoords } from "@/lib/map/county";
  ```
  (Or relative path if `@/` doesn't resolve in tsx scripts.)
- **GOTCHA**: This is a one-shot script. Mark it idempotent — re-running over rows that already have a `county` set should skip them (`where county is null` in the SELECT). Saves Mapbox/CPU when re-running after a partial failure.
- **GOTCHA**: Do NOT include a `where lat is not null` guard — every row has `lat/lng` (`NOT NULL` in the schema). If the script crashes on a row with bad coords, surface the slug so the human can investigate.
- **VALIDATE**:
  ```bash
  npx tsx --env-file=.env.local scripts/backfill-counties.ts
  ```
  Then in Studio:
  ```sql
  select county, count(*) from startups group by county order by count(*) desc limit 5;
  ```
  Expect Salt Lake / Utah / Davis at the top with sensible counts (largest counties have the most companies). `null` count should be very small (border cases or geocode failures).

### UPDATE `lib/map/types.ts` — extend `FilterCriteria` and `Startup`

- **IMPLEMENT**:
  - Add `county?: string;` to the `Startup` interface (next to `address`/`lat`/`lng`).
  - Replace the `FilterCriteria` interface with:
    ```ts
    export interface FilterCriteria {
      stage: string[];
      size: string[];
      section: string[];
      county: string[];
      hiring: boolean;
    }
    ```
- **PATTERN**: Mirror existing field declarations.
- **GOTCHA**: `FilterCriteria` is referenced from `lib/map/store.ts`, `components/map/FilterChips.tsx`, `components/map/MapView.tsx`, and indirectly by the parse-filter route's response type. **All four sites must update in this PR**.
- **GOTCHA**: Don't add `hiring?: boolean` (optional). Make it required and default it to `false` everywhere — optional booleans cause subtle bugs around presence-vs-absence-vs-explicit-false.
- **VALIDATE**: `npx tsc --noEmit` — expect compile errors at every call site that hasn't been updated yet. Each downstream task fixes one of these errors.

### UPDATE `lib/map/store.ts` — extend initial state + `clearFilters`

- **IMPLEMENT**: Replace lines 20 and 26:
  ```ts
  filters: { stage: [], size: [], section: [], county: [], hiring: false },
  // ...
  clearFilters: () => set({
    filters: { stage: [], size: [], section: [], county: [], hiring: false },
  }),
  ```
- **PATTERN**: Mirror existing state shape.
- **VALIDATE**: `npx tsc --noEmit` — store no longer errors.

### UPDATE `app/map/page.tsx` — add `county` to SELECT

- **IMPLEMENT**: At line 12, append `, county` to the SELECT string. Position doesn't matter; place at the end so the diff is small.
- **GOTCHA**: Run the migration AND backfill before this change ships, otherwise the column doesn't exist yet and the SELECT errors.
- **VALIDATE**: After backfill completes, open `/map` in dev and log `selectedStartup.county` in the InfoPanel — should be a county name for any imported row.

### UPDATE `components/map/MapView.tsx` — extend `isVisible`

- **IMPLEMENT**: Replace the body of `isVisible` (lines 89–98) with:
  ```ts
  const isVisible = useCallback(
    (startup: Startup): boolean => {
      const { stage, size, section, county, hiring } = filters;
      if (stage.length && !stage.includes(startup.stage)) return false;
      if (size.length && !size.includes(startup.employees)) return false;
      if (section.length && !section.includes(startup.section)) return false;
      if (county.length && (!startup.county || !county.includes(startup.county)))
        return false;
      if (hiring && !startup.hiring) return false;
      return true;
    },
    [filters]
  );
  ```
- **PATTERN**: Existing structure of `isVisible`.
- **GOTCHA**: A startup with `county === null` (backfill couldn't resolve) is invisible whenever a county filter is active. That's correct: the user explicitly asked for "X county" and we don't know this row's county. Document this so the next contributor doesn't "fix" it.
- **VALIDATE**: After the FilterPanel ships, tap `Hiring only` → confirm only `hiring=true` markers are full-opacity.

### UPDATE `app/api/map/parse-filter/route.ts` — extend prompt + parser

- **IMPLEMENT**: Replace `SYSTEM_PROMPT` (lines 4–9) with the version in the "Patterns to Follow" block above. Replace the JSON parsing block (lines 32–46) with:
  ```ts
  try {
    const parsed = JSON.parse(text) as {
      stage?: string[];
      size?: string[];
      section?: string[];
      county?: string[];
      hiring?: boolean;
    };
    // Whitelist county values against UTAH_COUNTIES_SET — Claude's accuracy
    // is high but defense in depth.
    const validCounty = Array.isArray(parsed.county)
      ? parsed.county.filter((c) => UTAH_COUNTIES_SET.has(c))
      : [];
    return NextResponse.json({
      stage: Array.isArray(parsed.stage) ? parsed.stage : [],
      size: Array.isArray(parsed.size) ? parsed.size : [],
      section: Array.isArray(parsed.section) ? parsed.section : [],
      county: validCounty,
      hiring: typeof parsed.hiring === "boolean" ? parsed.hiring : false,
    });
  } catch {
    return NextResponse.json({
      stage: [], size: [], section: [], county: [], hiring: false,
    });
  }
  ```
- **PATTERN**: Existing parse + return shape.
- **IMPORTS**: Add `import { UTAH_COUNTIES_SET } from "@/lib/map/filterConstants";`.
- **GOTCHA**: If Claude returns `"Salt Lake County"` (with the suffix), the whitelist filter drops it. Add a defensive normalization step:
  ```ts
  const normalized = parsed.county?.map((c) => typeof c === "string" ? c.trim().replace(/\s+County$/i, "") : "") ?? [];
  const validCounty = normalized.filter((c) => UTAH_COUNTIES_SET.has(c));
  ```
- **GOTCHA**: The empty-transcript early-return at line 14 must also return the new shape — update it: `return NextResponse.json({ stage: [], size: [], section: [], county: [], hiring: false });`.
- **VALIDATE**:
  ```bash
  curl -X POST http://localhost:3000/api/map/parse-filter \
    -H "Content-Type: application/json" \
    -d '{"transcript":"show me Series A FinTech in Salt Lake County hiring"}' | jq .
  ```
  Expect `{ "stage": ["Series A"], "section": ["FinTech"], "county": ["Salt Lake"], "hiring": true, "size": [] }`.

### UPDATE `components/map/VoiceFilterButton.tsx` — extend response handling

- **IMPLEMENT**: At lines 43–49 replace the destructure with:
  ```ts
  const filters = (await res.json()) as {
    stage: string[];
    size: string[];
    section: string[];
    county: string[];
    hiring: boolean;
  };
  setFilters(filters);
  ```
- **GOTCHA**: `setFilters` accepts the full `FilterCriteria` object (no merge), so the caller is responsible for sending all five fields. The route's response shape now matches; this works.
- **VALIDATE**: Voice "show me FinTech in Davis County hiring" → store updates with all three dims AND chips reflect each.

### CREATE `lib/map/facets.ts`

- **IMPLEMENT**:
  ```ts
  import type { FilterCriteria, Startup } from "./types";

  type DimKey = "stage" | "size" | "section" | "county" | "hiring";

  function matchesExcept(
    s: Startup,
    filters: FilterCriteria,
    skip: DimKey
  ): boolean {
    if (skip !== "stage" && filters.stage.length && !filters.stage.includes(s.stage))
      return false;
    if (skip !== "size" && filters.size.length && !filters.size.includes(s.employees))
      return false;
    if (skip !== "section" && filters.section.length && !filters.section.includes(s.section))
      return false;
    if (skip !== "county" && filters.county.length) {
      if (!s.county || !filters.county.includes(s.county)) return false;
    }
    if (skip !== "hiring" && filters.hiring && !s.hiring) return false;
    return true;
  }

  export interface FacetCounts {
    stage: Map<string, number>;
    size: Map<string, number>;
    section: Map<string, number>;
    county: Map<string, number>;
    hiringCount: number; // matching all OTHER dims AND hiring=true
    totalCount: number;  // matching ALL active dims
  }

  function bumpMap(map: Map<string, number>, key: string | undefined): void {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  export function computeFacets(
    startups: Startup[],
    filters: FilterCriteria
  ): FacetCounts {
    const stage = new Map<string, number>();
    const size = new Map<string, number>();
    const section = new Map<string, number>();
    const county = new Map<string, number>();
    let hiringCount = 0;
    let totalCount = 0;

    for (const s of startups) {
      // Hits the "everything matches" set used for the chip strip total.
      if (matchesExcept(s, filters, "stage")) bumpMap(stage, s.stage);
      if (matchesExcept(s, filters, "size")) bumpMap(size, s.employees);
      if (matchesExcept(s, filters, "section")) bumpMap(section, s.section);
      if (matchesExcept(s, filters, "county")) bumpMap(county, s.county);
      if (matchesExcept(s, filters, "hiring") && s.hiring) hiringCount += 1;

      const matchesAll =
        matchesExcept(s, filters, "stage" /* dummy */) &&
        (filters.stage.length === 0 || filters.stage.includes(s.stage));
      if (matchesAll) totalCount += 1;
    }

    return { stage, size, section, county, hiringCount, totalCount };
  }
  ```
  Tighten `totalCount` if needed — the snippet above is illustrative; the cleanest version reads `if (matchesExcept(s, filters, "__none__" as DimKey)) totalCount += 1;` after extending `matchesExcept` to accept a sentinel.
- **PATTERN**: Pure data utility, no React, no Supabase. Sibling to `lib/map/county.ts` and `lib/map/mapConfig.ts`.
- **GOTCHA**: For each option chip in the FilterPanel, the count to display is `facets.<dim>.get(option) ?? 0`. A zero indicates the option is currently disabled — chip shows as muted with `cursor: not-allowed`.
- **GOTCHA**: Performance: 255 startups × 5 dimensions = 1,275 comparisons per filter change. Sub-millisecond. Don't over-engineer.
- **VALIDATE**: `npx tsc --noEmit`.

### CREATE `components/map/filters/FilterChip.tsx`

- **IMPLEMENT**:
  ```tsx
  "use client";
  import { COLORS } from "@/lib/map/mapConfig";

  interface FilterChipProps {
    label: string;
    count?: number;
    active: boolean;
    onClick: () => void;
  }

  export function FilterChip({ label, count, active, onClick }: FilterChipProps) {
    const disabled = count === 0;
    const baseStyle: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "5px 12px",
      borderRadius: "2px",
      fontFamily: "ui-sans-serif, system-ui, -apple-system",
      fontSize: "0.75rem",
      letterSpacing: "0.04em",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "background 0.15s ease-out, color 0.15s ease-out, border-color 0.15s ease-out",
      border: "1px solid transparent",
      whiteSpace: "nowrap",
    };
    const variant: React.CSSProperties = active
      ? {
          backgroundColor: COLORS.accent,
          borderColor: COLORS.accent,
          color: "#000",
        }
      : disabled
      ? {
          backgroundColor: "transparent",
          borderColor: COLORS.border,
          color: COLORS.textDim,
        }
      : {
          backgroundColor: "rgba(0,0,0,0.6)",
          borderColor: COLORS.borderAccent,
          color: COLORS.accent,
        };
    return (
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        style={{ ...baseStyle, ...variant }}
        aria-pressed={active}
      >
        <span>{label}</span>
        {typeof count === "number" && (
          <span
            style={{
              fontSize: "0.6875rem",
              color: active ? "rgba(0,0,0,0.7)" : disabled ? COLORS.textDim : COLORS.textMuted,
            }}
          >
            ({count})
          </span>
        )}
      </button>
    );
  }
  ```
- **PATTERN**: Mirror the existing FilterChips chip style at `FilterChips.tsx:44-56`. The "active" variant is new but consistent with the design language.
- **GOTCHA**: When count is undefined (e.g., the hiring chip's no-count fallback), don't render the count span at all.
- **VALIDATE**: Render in a Storybook-style scratch page with `count: 0`, `count: 12`, `active: true`. Confirm the three visual states.

### CREATE `components/map/filters/FilterGroup.tsx`

- **IMPLEMENT**:
  ```tsx
  "use client";
  import { useState } from "react";
  import { COLORS } from "@/lib/map/mapConfig";

  interface FilterGroupProps {
    label: string;
    activeCount: number; // number of selected options in this group
    children: React.ReactNode;
    defaultOpen?: boolean;
  }

  export function FilterGroup({ label, activeCount, children, defaultOpen = true }: FilterGroupProps) {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: COLORS.textMuted,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.6875rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <span>
            {label}
            {activeCount > 0 && (
              <span style={{ color: COLORS.accent, marginLeft: "8px" }}>
                {activeCount} selected
              </span>
            )}
          </span>
          <span style={{ fontSize: "0.875rem", color: COLORS.textMuted }}>
            {open ? "−" : "+"}
          </span>
        </button>
        {open && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {children}
          </div>
        )}
      </div>
    );
  }
  ```
- **PATTERN**: Existing label style at `FilterChips.tsx:54-55`.
- **GOTCHA**: Default-open every group on the first render so the surface is discoverable. The user can collapse to save space, but they shouldn't have to expand to see options exist.
- **VALIDATE**: Render with `<FilterGroup label="Stage" activeCount={2}>...</FilterGroup>` — confirm the activeCount accent and the toggle behavior.

### CREATE `components/map/filters/FilterPanel.tsx`

- **IMPLEMENT**: The orchestrator. Reads `startups` (passed in as a prop from the parent so we don't tightly couple to `useMapStore`'s startup list — there isn't one anyway; startups live in `MapClient` props). Reads `filters` from the store. Computes facets via `useMemo([startups, filters])`. Renders 5 `<FilterGroup>`s with `<FilterChip>` children:
  ```tsx
  "use client";
  import { useMemo } from "react";
  import { useMapStore } from "@/lib/map/store";
  import type { Startup } from "@/lib/map/types";
  import { computeFacets } from "@/lib/map/facets";
  import { UTAH_COUNTIES } from "@/lib/map/filterConstants";
  import { COLORS } from "@/lib/map/mapConfig";
  import { FilterChip } from "./FilterChip";
  import { FilterGroup } from "./FilterGroup";

  const STAGE_OPTIONS = ["Pre-Seed", "Seed", "Series A", "Series B+", "Series D+"];
  const SIZE_OPTIONS = ["1", "2-10", "11-50", "51-200", "201-500", "200+"];
  const SECTION_OPTIONS = ["B2B Software", "FinTech", "Security", "Bio/Medical Tech", "Energy", "Consumer", "Marketplaces"];

  interface FilterPanelProps {
    startups: Startup[];
  }

  export function FilterPanel({ startups }: FilterPanelProps) {
    const { filters, setFilters, clearFilters } = useMapStore();
    const facets = useMemo(() => computeFacets(startups, filters), [startups, filters]);

    const toggleArrayValue = (dim: "stage" | "size" | "section" | "county", value: string) => {
      const current = filters[dim];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      setFilters({ ...filters, [dim]: next });
    };

    const toggleHiring = () => setFilters({ ...filters, hiring: !filters.hiring });

    const totalActive =
      filters.stage.length +
      filters.size.length +
      filters.section.length +
      filters.county.length +
      (filters.hiring ? 1 : 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.6875rem",
            color: COLORS.textDim,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            Filters · {facets.totalCount} matches
          </span>
          {totalActive > 0 && (
            <button
              onClick={clearFilters}
              style={{
                background: "none",
                border: "none",
                color: COLORS.textMuted,
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.75rem",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              clear all
            </button>
          )}
        </div>

        <FilterGroup label="Stage" activeCount={filters.stage.length}>
          {STAGE_OPTIONS.map((value) => (
            <FilterChip
              key={value}
              label={value}
              count={facets.stage.get(value) ?? 0}
              active={filters.stage.includes(value)}
              onClick={() => toggleArrayValue("stage", value)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Size" activeCount={filters.size.length}>
          {SIZE_OPTIONS.map((value) => (
            <FilterChip
              key={value}
              label={value}
              count={facets.size.get(value) ?? 0}
              active={filters.size.includes(value)}
              onClick={() => toggleArrayValue("size", value)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Sector" activeCount={filters.section.length}>
          {SECTION_OPTIONS.map((value) => (
            <FilterChip
              key={value}
              label={value}
              count={facets.section.get(value) ?? 0}
              active={filters.section.includes(value)}
              onClick={() => toggleArrayValue("section", value)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="County" activeCount={filters.county.length}>
          {UTAH_COUNTIES.map((value) => (
            <FilterChip
              key={value}
              label={value}
              count={facets.county.get(value) ?? 0}
              active={filters.county.includes(value)}
              onClick={() => toggleArrayValue("county", value)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Hiring" activeCount={filters.hiring ? 1 : 0}>
          <FilterChip
            label="Hiring only"
            count={facets.hiringCount}
            active={filters.hiring}
            onClick={toggleHiring}
          />
        </FilterGroup>
      </div>
    );
  }
  ```
- **PATTERN**: Existing inline-style language. `useMemo` for facets so the per-render cost is bounded.
- **GOTCHA**: Don't let the County group's 29 chips overflow horizontally — the wrapper has `flexWrap: wrap`. On narrow sidebars (the desktop sidebar is 360–560px), 29 chips wrap to ~6 rows. Fine.
- **GOTCHA**: The order of groups matters — Stage / Size / Sector match the existing voice prompt; County and Hiring are new. Putting Hiring last + as a single chip makes it visually distinct.
- **VALIDATE**: Render inside MapSidebar; tap chips; confirm markers dim/un-dim instantly.

### CREATE `components/map/filters/FilterDrawer.tsx`

- **IMPLEMENT**: Mobile bottom-sheet wrapper. Props: `{ startups, isOpen, onClose }`. Animates in from the bottom with framer-motion, takes `maxHeight: 80dvh`, scrolls internally:
  ```tsx
  "use client";
  import { motion, AnimatePresence } from "framer-motion";
  import type { Startup } from "@/lib/map/types";
  import { COLORS } from "@/lib/map/mapConfig";
  import { FilterPanel } from "./FilterPanel";

  interface FilterDrawerProps {
    startups: Startup[];
    isOpen: boolean;
    onClose: () => void;
  }

  export function FilterDrawer({ startups, isOpen, onClose }: FilterDrawerProps) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.6)",
                zIndex: 90,
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                position: "fixed",
                bottom: 0, left: 0, right: 0,
                maxHeight: "80dvh",
                overflowY: "auto",
                backgroundColor: "rgba(0,0,0,0.95)",
                backdropFilter: "blur(16px)",
                borderTop: `1px solid ${COLORS.border}`,
                zIndex: 100,
                paddingTop: "16px",
                paddingBottom: "32px",
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 16px 16px",
                borderBottom: `1px solid ${COLORS.border}`,
                marginBottom: "16px",
              }}>
                <span style={{
                  fontFamily: "ui-sans-serif, system-ui, -apple-system",
                  fontSize: "0.875rem",
                  color: COLORS.text,
                }}>
                  Filters
                </span>
                <button
                  onClick={onClose}
                  style={{
                    background: "none",
                    border: "none",
                    color: COLORS.textMuted,
                    fontSize: "1.25rem",
                    cursor: "pointer",
                  }}
                  aria-label="Close filters"
                >
                  ×
                </button>
              </div>
              <FilterPanel startups={startups} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }
  ```
- **PATTERN**: Mirror the InfoPanel's mobile bottom-sheet motion at `InfoPanel.tsx:38-43`.
- **GOTCHA**: Backdrop click closes the drawer; close button does too. **Don't** auto-close on filter selection — users want to make multiple selections in one drawer session.
- **VALIDATE**: Resize browser to mobile width; tap "Filters" button; drawer slides up; tapping outside closes it.

### UPDATE `components/map/MapSidebar.tsx` — embed `<FilterPanel />`

- **IMPLEMENT**: After the existing voice mic block (line 93) but before the closing `</div>` of the inner column, insert:
  ```tsx
  <div style={{ width: "100%", marginTop: "16px" }}>
    <FilterPanel startups={startups} />
  </div>
  ```
  Then update the `MapSidebar` signature to accept `startups: Startup[]` as a prop.
- **GOTCHA**: `MapSidebar` doesn't currently take `startups` — it's invoked from `MapClient.tsx:93` as `<MapSidebar />`. Update the call site to `<MapSidebar startups={startups} />` (the prop is already in scope at MapClient level).
- **GOTCHA**: The existing `hasFilters && <FilterChips />` block in MapSidebar (lines 95–120) becomes redundant — the FilterPanel header line `Filters · {totalCount} matches` already shows active state, and the chip strip belongs at the top of the map (visible from outside the sidebar). **Remove** the `hasFilters` block from MapSidebar; let `MapClient.tsx` own the FilterChips placement at the top of the map view.
- **VALIDATE**: Open `/map` on desktop; the sidebar shows the mic + FilterPanel; tapping chips dims markers immediately.

### UPDATE `components/map/MapClient.tsx` — mobile filter button + drawer

- **IMPLEMENT**: Replace the mobile-only `<FilterChips />` block at lines 99–113 with a "Filters (N)" button that toggles a `FilterDrawer`:
  ```tsx
  // Top of the file:
  import { useState } from "react";
  import { useMapStore } from "@/lib/map/store";
  import { FilterDrawer } from "./filters/FilterDrawer";
  // ...
  // Inside MapClient, before the return:
  const { filters } = useMapStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const totalActiveFilters =
    filters.stage.length + filters.size.length + filters.section.length +
    filters.county.length + (filters.hiring ? 1 : 0);
  ```
  Then in the mobile chrome block (replacing lines 97–115):
  ```tsx
  {showMobileChrome && (
    <>
      {/* Filter chips strip — always visible, summarizes active filters */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        zIndex: 10,
        padding: "16px 20px",
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}>
        <FilterChips />
      </div>

      {/* Mobile-only "Filters (N)" trigger */}
      <button
        onClick={() => setDrawerOpen(true)}
        style={{
          position: "absolute",
          bottom: "100px",   // above the floating mic button
          left: "16px",
          zIndex: 50,
          padding: "8px 14px",
          backgroundColor: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${COLORS.borderAccent}`,
          color: COLORS.accent,
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.8125rem",
          letterSpacing: "0.04em",
          cursor: "pointer",
        }}
        aria-label="Open filters"
      >
        Filters{totalActiveFilters > 0 ? ` (${totalActiveFilters})` : ""}
      </button>

      <FilterDrawer
        startups={startups}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <VoiceFilterButton />
    </>
  )}
  ```
- **PATTERN**: Existing absolute-position chrome layering.
- **IMPORTS**: Add `import { COLORS } from "@/lib/map/mapConfig";`.
- **GOTCHA**: On desktop (`showSidebar === true`), do NOT render the FilterDrawer or the trigger button — the FilterPanel is already inline in the sidebar. The conditional block above already guards behind `showMobileChrome`.
- **VALIDATE**: Resize between desktop/mobile widths; confirm the sidebar shows the inline panel on desktop, the filter trigger + drawer on mobile, and the chip strip on both.

### REWRITE `components/map/FilterChips.tsx` — render all 5 dimensions

- **IMPLEMENT**: Replace the file body so the chip iteration covers every dimension:
  ```tsx
  "use client";
  import { motion, AnimatePresence } from "framer-motion";
  import { useMapStore } from "@/lib/map/store";
  import { COLORS } from "@/lib/map/mapConfig";

  type FilterEntry =
    | { type: "stage" | "size" | "section" | "county"; value: string }
    | { type: "hiring"; value: "Hiring only" };

  export function FilterChips() {
    const { filters, setFilters, clearFilters } = useMapStore();

    const allFilters: FilterEntry[] = [
      ...filters.stage.map((v) => ({ type: "stage" as const, value: v })),
      ...filters.size.map((v) => ({ type: "size" as const, value: v })),
      ...filters.section.map((v) => ({ type: "section" as const, value: v })),
      ...filters.county.map((v) => ({ type: "county" as const, value: v })),
      ...(filters.hiring ? [{ type: "hiring" as const, value: "Hiring only" as const }] : []),
    ];
    if (allFilters.length === 0) return null;

    const removeFilter = (entry: FilterEntry) => {
      if (entry.type === "hiring") {
        setFilters({ ...filters, hiring: false });
        return;
      }
      setFilters({
        ...filters,
        [entry.type]: filters[entry.type].filter((v) => v !== entry.value),
      });
    };

    return (
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", pointerEvents: "auto" }}>
        <AnimatePresence>
          {allFilters.map((entry) => (
            <motion.div
              key={`${entry.type}-${entry.value}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 12px",
                backgroundColor: "rgba(0,0,0,0.82)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${COLORS.borderAccent}`,
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.75rem",
                color: COLORS.accent,
                letterSpacing: "0.04em",
              }}
            >
              {entry.value}
              <button
                onClick={() => removeFilter(entry)}
                style={{
                  background: "none",
                  border: "none",
                  color: COLORS.textMuted,
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1,
                  fontSize: "0.875rem",
                }}
                aria-label={`Remove ${entry.value} filter`}
              >
                ×
              </button>
            </motion.div>
          ))}
          {allFilters.length > 1 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={clearFilters}
              style={{
                background: "none",
                border: "none",
                color: COLORS.textMuted,
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.75rem",
                cursor: "pointer",
                textDecoration: "underline",
                padding: "5px 0",
              }}
            >
              clear all
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    );
  }
  ```
- **PATTERN**: Existing chip animation + style.
- **GOTCHA**: The hiring entry is a single, non-array dimension — the type union encodes that. Don't try to remove `"Hiring only"` from `filters.hiring` as if it were an array.
- **VALIDATE**: Tap chips in FilterPanel → corresponding chip appears in FilterChips strip. × on the chip removes it from the panel.

### APPEND `ai-context/SECURITY.md`

- **IMPLEMENT**:
  ```markdown
  ### Map Filter Expansion (Feature: map-filter-expansion)
  - The voice transcript still flows through `/api/map/parse-filter`; the new prompt extends to county + hiring. The route applies a server-side whitelist on `parsed.county` against `UTAH_COUNTIES_SET` (`lib/map/filterConstants.ts`), dropping any unrecognized name. A motivated user (or Claude hallucinating "California") cannot inject arbitrary strings into the filter store.
  - `parsed.hiring` is coerced to a strict boolean (`typeof === 'boolean' ? value : false`); any other shape (array, string) is dropped.
  - The county column on `startups` has no CHECK constraint; the canonical-list enforcement is application-level. This is intentional — adding a CHECK now would lock us into the 29-county taxonomy if Utah ever added or merged a county. The whitelist on read is the right enforcement layer.
  - Facet counts are computed entirely client-side in `lib/map/facets.ts`. No server query, no PII, no surface for injection.
  - The `public/utah-counties.geojson` file is read-only static asset served by Next.js. It contains no PII; it's the same census-derived data Mapbox already serves through their tile system.
  - **Post-MVP**: the parse-filter route should rate-limit per IP. Today it's open to anyone with a valid request; a determined attacker could cost-spike the Anthropic bill. Same gap exists across all `/api/map/*` and `/api/discovery/*` routes; document once, fix together.
  ```
- **PATTERN**: Mirror existing entry style at `SECURITY.md:67-74`.

### APPEND `ai-context/INEFFICIENCIES.md`

- **IMPLEMENT**:
  ```markdown
  ### Filters — Facet recomputation on every filter change (Feature: map-filter-expansion)
  **Impact:** Low
  **Context:** `lib/map/facets.ts` iterates all 255 startups × 5 dimensions on every `filters` change to compute the per-option counts. At 1,275 comparisons per change it's sub-millisecond, but if the dataset grows to 5,000+ rows the per-tap latency starts to bite (especially on mobile under animation contention).
  **Ideal solution:** Maintain incremental facet indexes — a `Map<DimKey, Map<value, Set<slug>>>` built once at startup, then bitset-intersect on filter changes. Or move to server-side facets via a Postgres aggregation when the row count exceeds ~2,000.
  **Workaround in place:** None — the math is fast enough at hackathon scale and `useMemo([startups, filters])` keeps it from running unnecessarily.

  ### Filters — Full Utah counties GeoJSON shipped client-side and read disk-side (Feature: map-filter-expansion)
  **Impact:** Low
  **Context:** `public/utah-counties.geojson` (~150–300 KB even simplified) ships with the public bundle. The point-in-polygon helper reads the same file from disk for the backfill script and any future server-side insert. We could ship a smaller "centroid-only" file for the client (the client never does point-in-polygon) and keep the polygon file server-only.
  **Ideal solution:** Two artifacts: `public/utah-counties.geojson` (client centroids, ~5 KB) and `data/utah-counties.full.geojson` (server polygons, gitignored, fetched-on-build).
  **Workaround in place:** None — 150–300 KB on a one-time fetch is acceptable; the client doesn't currently need the file at all (FilterPanel uses the constant list, not the GeoJSON).

  ### Filters — No marker clustering by county (Feature: map-filter-expansion)
  **Impact:** Low
  **Context:** With a county filter active, a dense county like Salt Lake (~97 startups) still renders 97 individual HTML markers. At zoom <9 most overlap visually. The existing INEFFICIENCIES entry on HTML markers (`map-load-state-bugfix` adjacent) covers this generally; the new entry is to call out that the filter doesn't help with the at-zoom density.
  **Ideal solution:** Use Mapbox's native `cluster: true` source at low zoom, swap to HTML markers at zoom ≥10. Compose with the filter so dim/full-opacity rules still apply within clusters.
  **Workaround in place:** None — visual overlap is the same as the unfiltered map; the filter just tells you which markers are non-dim.
  ```
- **PATTERN**: Mirror existing entries.

---

## TESTING STRATEGY

This codebase has no automated test framework. Validation is manual end-to-end browser testing + curl smoke tests.

### Manual end-to-end (golden path — desktop)

1. Apply migration; run backfill; confirm `select count(*) from startups where county is null;` is small.
2. `npm run dev`. Open `/map` on a desktop-width browser. Confirm:
   - Sidebar shows mic + FilterPanel below.
   - Each group has chips; each chip has a count in parentheses.
   - "Filters · 255 matches" header.
3. Tap `Seed (61)` chip → markers dim except the 61 Seed-stage ones; the chip turns accent-filled; `Stage 1 selected` appears in the group header; `Filters · 61 matches` updates; the chip strip at the top of the map shows `Seed`.
4. Tap `B2B Software (84)` → counts in OTHER groups update to reflect the AND filter; the County group shows fewer chips with non-zero counts.
5. Tap `Salt Lake` in County → matches drop further; markers visually concentrate on the Wasatch Front.
6. Tap `Hiring only (24)` → counts shrink again; only hiring + B2B Software + Seed-stage Salt Lake startups remain.
7. Tap × on the `B2B Software` chip in the top strip → that filter removes; counts re-expand.
8. Tap "clear all" → state resets to `255 matches`, no chips active, all markers full-opacity.
9. Tap the mic → say "show me FinTech in Davis County hiring" → after 2s, the chips for FinTech / Davis / Hiring all activate; FilterPanel reflects them.

### Manual end-to-end (golden path — mobile)

1. Resize to <768px. Confirm:
   - Sidebar is hidden; map fills viewport.
   - Bottom-left "Filters" button visible above the bottom-center mic.
   - Top-center chip strip is visible only when filters are active.
2. Tap "Filters" → bottom-sheet slides up with the same FilterPanel.
3. Tap chips → count in the trigger button updates: "Filters (1)", "Filters (2)", ...
4. Tap × on the close button or backdrop → drawer closes; map re-shows with active filters honored.

### Edge cases

- **No backfill yet**: open `/map` BEFORE running `backfill-counties.ts`. `county` is null on every row, so the County group's chips all show `(0)` and are disabled. Map renders correctly otherwise — no crash. Document this as the bootstrap state.
- **Border-case row**: a startup whose lat/lng falls exactly on a county boundary (or just outside the state). `county` = null. Filter by any county → it's invisible. Filter by no county → visible. Acceptable.
- **Voice + tap merge**: tap `Salt Lake`, then say "Provo." Claude should map "Provo" → "Utah" county; the new filter ADDS to the existing one (since `setFilters` from the route passes the full new shape, the OR-merge happens at the prompt level, not the route). **Decision**: voice REPLACES the filter set (Claude's output is treated as authoritative). Document this behavior so users learn it. If voice should ADD to existing, the route would need a separate "merge" mode — out of scope.
- **"clear all" doesn't fire when only one filter is active**: matches the existing FilterChips behavior (line 76 — `allFilters.length > 1`). Intentional — the × on the single chip is the obvious affordance.
- **County chip 0-count**: e.g., after filtering by `Pre-Seed + B2B Software`, "San Juan (0)" shows as muted/non-clickable. Confirm visual.
- **Responsive collapse**: on a narrow desktop sidebar (~360px), the County group's 29 chips should wrap to 5–7 rows without overflow.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
npm run lint
npx tsc --noEmit
```

### Level 2: Production build

```bash
npm run build
```

Catches any client/server boundary violations (e.g., `lib/map/county.ts` accidentally imported from a `'use client'` component) and `useMemo` hook order regressions.

### Level 3: Backfill + DB inspection

```bash
npx tsx --env-file=.env.local scripts/backfill-counties.ts
```

Then in Studio:
```sql
select county, count(*)
from startups
group by county
order by count(*) desc;
```

Expect: `Salt Lake`, `Utah`, `Davis` at the top; `null` count low (<5).

### Level 4: API smoke test

```bash
curl -X POST http://localhost:3000/api/map/parse-filter \
  -H "Content-Type: application/json" \
  -d '{"transcript":"show me Series A FinTech in Davis County hiring"}' | jq .
```

Expect:
```json
{
  "stage": ["Series A"],
  "size": [],
  "section": ["FinTech"],
  "county": ["Davis"],
  "hiring": true
}
```

### Level 5: Manual end-to-end

Walk through both golden paths above (desktop + mobile).

---

## ACCEPTANCE CRITERIA

- [ ] `county text` column exists on `startups`; index `startups_county_idx` exists.
- [ ] `public/utah-counties.geojson` exists, contains exactly 29 features, each with `properties.NAME` matching a value in `UTAH_COUNTIES`.
- [ ] `scripts/backfill-counties.ts` populates `county` for ≥95% of existing rows.
- [ ] `FilterCriteria` includes `county: string[]` and `hiring: boolean`; all call sites compile against the new shape.
- [ ] Desktop: `/map` sidebar shows the FilterPanel under the mic; tapping chips updates the map dimming instantly.
- [ ] Mobile: `/map` shows a "Filters (N)" trigger that opens a bottom-sheet drawer with the same FilterPanel.
- [ ] Each chip in the FilterPanel shows a live facet count; counts recompute on every filter change.
- [ ] Chips with `count === 0` render in a muted/disabled style and are not clickable.
- [ ] FilterChips strip at the top of the map renders ALL active filters (stage / size / section / county / hiring) with × removal and a "clear all" link.
- [ ] Voice flow ("show me Series A FinTech in Salt Lake County hiring") sets the same store state as the equivalent taps.
- [ ] `parse-filter` route whitelists county values against `UTAH_COUNTIES_SET` and coerces `hiring` to a strict boolean.
- [ ] No regressions: voice intake, results, bubble field, base map interactions, claim flow, edit flow all still work.
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` succeeds.
- [ ] `ai-context/SECURITY.md` and `INEFFICIENCIES.md` updated.

---

## COMPLETION CHECKLIST

- [ ] Phase 1: migration + GeoJSON + helpers + backfill all complete; `select` confirms most rows have a county.
- [ ] Phase 2: type + store extension complete; TypeScript builds clean.
- [ ] Phase 3: facets + FilterChip + FilterGroup + FilterPanel + FilterDrawer all rendered, sidebar shows panel on desktop and drawer on mobile.
- [ ] Phase 4: voice route returns the new shape; FilterChips renders all dimensions; isVisible gates on all dimensions.
- [ ] Phase 5: SECURITY.md and INEFFICIENCIES.md updated; manual golden paths complete on desktop and mobile.
- [ ] No client component imports `lib/map/county.ts`.
- [ ] No server route imports the client `useMapStore`.

---

## NOTES

**Why client-side filtering?**
255 rows. Every dimension is in-memory already. A round-trip to Postgres for an `IN` query would be slower than the in-memory check. The faceted-counts compute is sub-millisecond. If we ever cross 2,000+ rows, the right move is incremental facet indexes (bitsets) — not a server query.

**Why faceted counts?**
The user explicitly said "rewards exploration." The cheapest mechanic that delivers exploration is showing the user what they'd find. Counts on every chip are the standard pattern (Algolia, Airbnb, Mapbox docs filtering examples). Computed in 5 lines. Free win.

**Why store county on the row instead of computing point-in-polygon at filter time?**
Two reasons. (1) The point-in-polygon GeoJSON is 150–300 KB; loading that in the client just to filter is wasteful. (2) The county is used in multiple places (filter, future tag display in InfoPanel, future "browse by county" view). One-time backfill amortizes the work. Server-side recomputes happen only on insert (via the future create-startup route, which is a low-frequency event).

**Why no CHECK constraint on `county`?**
Future-proofing. If Utah ever splits or merges a county, a CHECK requires a migration. The whitelist enforcement is at the application layer.

**Why don't we stream the FilterPanel under the chip strip on mobile?**
The chip strip + filter trigger duplicates context but the duplication is fine — the strip shows what's active, the trigger lets you change it. Stuffing the panel inline at the top would push the map down and break the immersive feel.

**Why hiring is a single chip not a tri-state?**
"Hiring only" is the only filter direction users actually want. "Not hiring" filters are hostile (you're rarely interested in companies that aren't hiring). One chip > three chips for a binary preference.

**Voice REPLACES, tap MERGES.**
A user saying "show me FinTech" while having already selected `Salt Lake` will see voice REPLACE the entire filter set with `{ section: ['FinTech'] }`. This is intentional — voice is a "start fresh" affordance; tap is incremental. Document this in a tooltip post-MVP if it confuses users.

**Forward compatibility.**
Adding a new dimension (e.g., `year_founded` ranges) is: extend `FilterCriteria`, extend `isVisible`, extend `computeFacets`, add a `<FilterGroup>` to FilterPanel. ~30 lines per dimension.

**Failure mode: bad GeoJSON breaks backfill.**
Script logs the offending slug + coords and exits non-zero. Re-run after fixing the GeoJSON.

**Failure mode: Claude returns an unknown county name.**
Whitelist filter drops it; the user sees no county filter applied for that voice command. Better than a confused-looking chip strip.

**Confidence Score: 8.5/10** for one-pass implementation. Risks:

- The Utah counties GeoJSON source URL may have shifted; the backfill task includes an alternate source. If both 404, the implementer needs to source from the US Census Bureau directly (~5 minutes of work).
- The `FilterCriteria` type extension touches 4–5 call sites; the TS compiler will flag every one, but the implementer must update them in one PR or the build breaks mid-task.
- Mobile drawer height (`maxHeight: 80dvh`) may need tuning when 5 groups + 29 county chips both expand — verify on a real iPhone-sized viewport.
- The `MapSidebar` signature change (`startups` prop) is a small API ripple; the only caller is `MapClient.tsx`.
