// Canonical list of Utah's 29 counties — exact spelling, in alphabetical
// order. Used by:
//   - the FilterPanel (chip rendering order)
//   - /api/map/parse-filter system prompt (Claude validates against this list)
//   - lib/map/county.ts (input → output sanity check after point-in-polygon)
//
// Keep these strings byte-identical to GeoJSON properties.NAME values in
// public/utah-counties.geojson (i.e., NO trailing " County").
export const UTAH_COUNTIES = [
  "Beaver",
  "Box Elder",
  "Cache",
  "Carbon",
  "Daggett",
  "Davis",
  "Duchesne",
  "Emery",
  "Garfield",
  "Grand",
  "Iron",
  "Juab",
  "Kane",
  "Millard",
  "Morgan",
  "Piute",
  "Rich",
  "Salt Lake",
  "San Juan",
  "Sanpete",
  "Sevier",
  "Summit",
  "Tooele",
  "Uintah",
  "Utah",
  "Wasatch",
  "Washington",
  "Wayne",
  "Weber",
] as const;

export type UtahCounty = (typeof UTAH_COUNTIES)[number];

export const UTAH_COUNTIES_SET: Set<string> = new Set(UTAH_COUNTIES);
