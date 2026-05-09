// Run with: npx tsx --env-file=.env.local scripts/geocode-startups.ts
//
// Reads data/mapdata.csv, geocodes each address via Mapbox Geocoding API v6,
// and writes data/startups.json. Re-runs are incremental — entries already
// present in startups.json (matched by linkedin_url) skip the API call.
import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

// Either NEXT_PUBLIC_MAPBOX_TOKEN (public/pk.) or MAPBOX_API_TOKEN (secret/sk.)
// works for the geocoding API. Prefer the secret one when both exist since it
// has explicit geocoding scope.
const TOKEN =
  process.env.MAPBOX_API_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";
if (!TOKEN) {
  throw new Error(
    "MAPBOX_API_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN is required in .env.local"
  );
}

interface ExistingEntry {
  linkedin_url: string;
  lat: number;
  lng: number;
}

const outputPath = path.resolve("data/startups.json");
const existing: Record<string, { lat: number; lng: number }> = {};
if (existsSync(outputPath)) {
  const prev = JSON.parse(readFileSync(outputPath, "utf-8")) as ExistingEntry[];
  prev.forEach((s) => {
    existing[s.linkedin_url] = { lat: s.lat, lng: s.lng };
  });
  console.log(`Loaded ${prev.length} existing geocodes`);
}

const csv = readFileSync("data/mapdata.csv", "utf-8");
const rows: Record<string, string>[] = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  relax_quotes: true,
  trim: true,
});

function trim(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeLinkedIn(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `https://www.linkedin.com${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url.trim();
  }
}

function getSlug(linkedin_url: string): string {
  const match = linkedin_url.match(/\/company\/([^/?#]+)/);
  return match?.[1] ?? "";
}

function normalizeDomain(website: string): string {
  const w = website.trim();
  if (!w) return "";
  try {
    const url = new URL(w.startsWith("http") ? w : `https://${w}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return w.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  }
}

function normalizeStage(s: string): string {
  const v = s.trim();
  const lower = v.toLowerCase();
  const map: Record<string, string> = {
    "pre-seed": "Pre-Seed",
    "preseed": "Pre-Seed",
    "seed": "Seed",
    "series a": "Series A",
    "series b": "Series B+",
    "series b+": "Series B+",
    "series c": "Series B+",
    "series d": "Series D+",
    "series d+": "Series D+",
  };
  return map[lower] ?? v;
}

async function geocode(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(address);
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${q}&country=us&limit=1&access_token=${TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("  geocode error:", res.status, address);
    return null;
  }
  const data = (await res.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
  };
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords) {
    console.warn("  no result for:", address);
    return null;
  }
  return { lng: coords[0], lat: coords[1] };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OutputEntry {
  slug: string;
  linkedin_url: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  website: string;
  domain: string;
  logo_url: string;
  stage: string;
  employees: string;
  section: string;
}

async function main(): Promise<void> {
  const results: OutputEntry[] = [];
  let geocoded = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    // CSV header has trailing whitespace on some columns ("Startup Name ",
    // "# of Employees ") — `trim: true` handles header trimming.
    const linkedin_url = normalizeLinkedIn(
      trim(row["LinkedIn Link (map it to Links to get the logo)"])
    );
    const name = trim(row["Startup Name"]);
    const address = trim(row["Full Address"]);
    const description = trim(row["Description of startup"]).replace(/\s+/g, " ");
    const website = trim(row["Website"]);
    const stage = normalizeStage(trim(row["Stage"]));
    const employees = trim(row["# of Employees"]);
    const section = trim(row["Section"]);
    const domain = normalizeDomain(website);
    const slug = getSlug(linkedin_url);

    if (!name) continue;

    let lat: number;
    let lng: number;

    if (existing[linkedin_url]) {
      ({ lat, lng } = existing[linkedin_url]);
      skipped++;
    } else if (address) {
      console.log(`Geocoding [${results.length + 1}/${rows.length}] ${name}`);
      const geo = await geocode(address);
      if (geo) {
        ({ lat, lng } = geo);
        geocoded++;
      } else {
        lat = 39.321;
        lng = -111.093;
        failed++;
      }
      await sleep(120); // ~8 req/sec — within Mapbox's free tier rate limit
    } else {
      lat = 39.321;
      lng = -111.093;
      failed++;
    }

    results.push({
      slug,
      linkedin_url,
      name,
      address,
      lat,
      lng,
      description,
      website,
      domain,
      logo_url: domain ? `https://logo.clearbit.com/${domain}` : "",
      stage,
      employees,
      section,
    });
  }

  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(
    `\nDone. Geocoded: ${geocoded}, Skipped (existing): ${skipped}, Failed (centroid): ${failed}`
  );
  console.log(`Output: ${outputPath} (${results.length} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
