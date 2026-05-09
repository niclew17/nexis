import type { FilterCriteria, Startup } from "./types";

type DimKey = "stage" | "size" | "section" | "county" | "hiring";

// True iff `s` matches all currently-active filters EXCEPT the one named in
// `skip`. Pass `null` for skip to enforce all filters (used for totalCount).
//
// "Skip the dimension we're counting" is the standard faceted-counts mechanic:
// an unselected chip in group X should still show its unconditional reach
// within the OTHER active filters, even though selecting it would change the
// match set.
function matchesExcept(
  s: Startup,
  filters: FilterCriteria,
  skip: DimKey | null
): boolean {
  if (
    skip !== "stage" &&
    filters.stage.length > 0 &&
    !filters.stage.includes(s.stage)
  )
    return false;
  if (
    skip !== "size" &&
    filters.size.length > 0 &&
    !filters.size.includes(s.employees)
  )
    return false;
  if (
    skip !== "section" &&
    filters.section.length > 0 &&
    !filters.section.includes(s.section)
  )
    return false;
  if (skip !== "county" && filters.county.length > 0) {
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
  hiringCount: number; // matches all OTHER dims AND s.hiring === true
  totalCount: number; // matches ALL active dims
}

function bumpMap(map: Map<string, number>, key: string | undefined | null): void {
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
    if (matchesExcept(s, filters, "stage")) bumpMap(stage, s.stage);
    if (matchesExcept(s, filters, "size")) bumpMap(size, s.employees);
    if (matchesExcept(s, filters, "section")) bumpMap(section, s.section);
    if (matchesExcept(s, filters, "county")) bumpMap(county, s.county);
    if (matchesExcept(s, filters, "hiring") && s.hiring) hiringCount += 1;
    if (matchesExcept(s, filters, null)) totalCount += 1;
  }

  return { stage, size, section, county, hiringCount, totalCount };
}
