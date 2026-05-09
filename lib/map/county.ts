// server-only — never import from a client component.
// Loads public/utah-counties.geojson off disk (cached per process) and runs
// hand-rolled ray-casting point-in-polygon. Used by:
//   - scripts/backfill-counties.ts (one-shot)
//   - any future server route that needs lat/lng → county (e.g. self-serve
//     add-startup re-derivation)

import { readFileSync } from "fs";
import path from "path";
import { UTAH_COUNTIES_SET } from "./filterConstants";

type Position = [number, number];
type LinearRing = Position[];
type PolygonCoords = LinearRing[]; // [outer, ...holes]
type MultiPolygonCoords = PolygonCoords[];

interface CountyFeature {
  type: "Feature";
  properties: { NAME?: string };
  geometry:
    | { type: "Polygon"; coordinates: PolygonCoords }
    | { type: "MultiPolygon"; coordinates: MultiPolygonCoords };
}

interface CountyCollection {
  type: "FeatureCollection";
  features: CountyFeature[];
}

let cache: CountyCollection | null = null;

function loadCounties(): CountyCollection {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "public", "utah-counties.geojson");
  const raw = readFileSync(filePath, "utf-8");
  cache = JSON.parse(raw) as CountyCollection;
  return cache;
}

// Standard ray-casting for a single ring. (x, y) = (lng, lat).
function pointInRing(point: Position, ring: LinearRing): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Polygon = inside outer ring AND outside every hole.
function pointInPolygon(point: Position, polygon: PolygonCoords): boolean {
  if (polygon.length === 0) return false;
  if (!pointInRing(point, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(point, polygon[i])) return false;
  }
  return true;
}

// MultiPolygon = in at least one polygon.
function pointInMultiPolygon(
  point: Position,
  multi: MultiPolygonCoords
): boolean {
  for (const poly of multi) {
    if (pointInPolygon(point, poly)) return true;
  }
  return false;
}

export function getCountyForCoordsWith(
  collection: CountyCollection,
  lat: number,
  lng: number
): string | null {
  const point: Position = [lng, lat];
  for (const feature of collection.features) {
    const hit =
      feature.geometry.type === "Polygon"
        ? pointInPolygon(point, feature.geometry.coordinates)
        : pointInMultiPolygon(point, feature.geometry.coordinates);
    if (!hit) continue;
    const name = feature.properties.NAME;
    // Sanity check — if the GeoJSON ever ships an unexpected name, fail fast
    // rather than polluting the column.
    if (typeof name === "string" && UTAH_COUNTIES_SET.has(name)) return name;
    return null;
  }
  return null;
}

export function getCountyForCoords(lat: number, lng: number): string | null {
  return getCountyForCoordsWith(loadCounties(), lat, lng);
}
