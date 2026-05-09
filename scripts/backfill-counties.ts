// Run with: npx tsx --env-file=.env.local scripts/backfill-counties.ts
//
// One-shot backfill: reads every startup whose `county` is null, computes
// the county from lat/lng via point-in-polygon, and writes it back. Safe to
// re-run — already-set rows are skipped via the WHERE clause.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getCountyForCoords } from "../lib/map/county";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local"
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

interface Row {
  slug: string;
  lat: number;
  lng: number;
}

async function main() {
  const { data, error } = await supabase
    .from("startups")
    .select("slug, lat, lng")
    .is("county", null);

  if (error) throw error;
  const rows = (data ?? []) as Row[];
  console.log(`Found ${rows.length} startups with null county`);

  let computed = 0;
  let nullResult = 0;
  const chunkSize = 100;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const county = getCountyForCoords(row.lat, row.lng);
    if (county === null) {
      nullResult += 1;
      // Don't write null back — column already null. Log for inspection.
      console.warn(`  no county for ${row.slug} at (${row.lat}, ${row.lng})`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("startups")
      .update({ county })
      .eq("slug", row.slug);
    if (updateError) {
      console.error(`  update failed for ${row.slug}: ${updateError.message}`);
      continue;
    }
    computed += 1;

    if ((i + 1) % chunkSize === 0) {
      console.log(`  progress: ${i + 1}/${rows.length}`);
    }
  }

  console.log("");
  console.log("Done.");
  console.log(`  total scanned: ${rows.length}`);
  console.log(`  county set:    ${computed}`);
  console.log(`  null result:   ${nullResult}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
