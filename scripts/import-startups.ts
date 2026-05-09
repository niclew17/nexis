// Run with: npx tsx --env-file=.env.local scripts/import-startups.ts
//
// Reads data/startups.json (produced by scripts/geocode-startups.ts) and
// upserts every entry into the `startups` table by slug. Re-runs are safe —
// existing rows get updated, missing slugs are inserted.
import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local"
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

interface JsonStartup {
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

async function main() {
  const jsonPath = path.resolve("data/startups.json");
  const raw = readFileSync(jsonPath, "utf-8");
  const all = JSON.parse(raw) as JsonStartup[];

  // Dedupe by slug — the source CSV has a few repeated company rows.
  const seen = new Set<string>();
  const rows = all.filter((s) => {
    const key = s.slug || `${s.linkedin_url}|${s.name}`;
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Loaded ${all.length} JSON entries → ${rows.length} unique`);

  // Skip rows we can't key on (no slug). These would collide on the unique
  // constraint and aren't useful for the Phase 2 profile routing anyway.
  const importable = rows.filter((r) => r.slug);
  const skipped = rows.length - importable.length;
  if (skipped > 0) {
    console.log(`Skipping ${skipped} entries without a usable slug`);
  }

  const payload = importable.map((s) => ({
    slug: s.slug,
    linkedin_url: s.linkedin_url || null,
    name: s.name,
    address: s.address || null,
    lat: s.lat,
    lng: s.lng,
    description: s.description || null,
    website: s.website || null,
    domain: s.domain || null,
    logo_url: s.logo_url || null,
    stage: s.stage || null,
    employees: s.employees || null,
    section: s.section || null,
  }));

  // Chunk to avoid hitting Supabase's request size limit on large payloads.
  const CHUNK = 100;
  let upserted = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("startups")
      .upsert(slice, { onConflict: "slug" });
    if (error) {
      console.error(`Chunk ${i}-${i + slice.length} failed:`, error.message);
      process.exit(1);
    }
    upserted += slice.length;
    console.log(`Upserted ${upserted}/${payload.length}`);
  }

  console.log(`Done — ${upserted} startups in the database.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
