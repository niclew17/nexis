import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const STARTUP_SELECT =
  "slug, linkedin_url, name, address, lat, lng, description, website, domain, logo_url, stage, employees, section, year_founded, hiring, claimed_by, claimed_at, jobs, photos";

// True iff `paths` is an exact reordering of `current` — same length, same
// multiset. Used to gate this route to reorder-only mutations; adds and
// removes have their own routes.
function isExactPermutation(current: string[], paths: string[]): boolean {
  if (current.length !== paths.length) return false;
  const sortedA = [...current].sort();
  const sortedB = [...paths].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

export async function POST(req: NextRequest) {
  let body: { slug?: unknown; paths?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  if (
    !Array.isArray(body.paths) ||
    !body.paths.every((p): p is string => typeof p === "string")
  ) {
    return NextResponse.json({ error: "paths must be a string array" }, { status: 400 });
  }
  const paths = body.paths as string[];

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (
    !user ||
    user.is_anonymous ||
    (user.app_metadata as { role?: string } | undefined)?.role !== "startupOwner"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("[/api/startups/photos/reorder] missing service role envs");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createServiceClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: existing, error: lookupError } = await admin
    .from("startups")
    .select("slug, photos, claimed_by")
    .eq("slug", slug)
    .maybeSingle();
  if (lookupError) {
    console.error("[/api/startups/photos/reorder] lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Startup not found" }, { status: 404 });
  }
  if (existing.claimed_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentPhotos = (existing.photos as string[] | null) ?? [];
  if (!isExactPermutation(currentPhotos, paths)) {
    return NextResponse.json(
      { error: "paths must be an exact permutation of the current photos" },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await admin
    .from("startups")
    .update({ photos: paths })
    .eq("slug", slug)
    .eq("claimed_by", user.id)
    .select(STARTUP_SELECT)
    .single();

  if (updateError) {
    console.error("[/api/startups/photos/reorder] db update failed:", updateError.message);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, startup: updated });
}
