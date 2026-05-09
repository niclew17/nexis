import { Suspense } from "react";
import type { Startup } from "@/lib/map/types";
import { MapClient } from "@/components/map/MapClient";
import { createClient } from "@/lib/supabase/server";

// Public-read RLS means the anon role works — no service role needed here.
async function loadStartups(): Promise<Startup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("startups")
    .select(
      "slug, linkedin_url, name, address, lat, lng, description, website, domain, logo_url, stage, employees, section, year_founded, hiring, claimed_by, claimed_at, jobs, photos"
    )
    .order("name", { ascending: true });

  if (error) {
    console.error("[/map] failed to load startups:", error.message);
    return [];
  }

  return (data ?? []) as Startup[];
}

// Suspense boundary lets Next 16 prerender the shell immediately and stream
// the markers in once the DB query resolves. Without it, the whole route
// blocks on the await — Cache Components flags that as a blocking-route error.
async function MapContent() {
  const startups = await loadStartups();
  return <MapClient startups={startups} />;
}

function MapFallback() {
  return (
    <div
      style={{
        height: "100dvh",
        backgroundColor: "black",
      }}
    />
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<MapFallback />}>
      <MapContent />
    </Suspense>
  );
}
