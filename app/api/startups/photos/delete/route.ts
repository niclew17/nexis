import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { removePhotos } from "@/lib/supabase/storage";

const STARTUP_SELECT =
  "slug, linkedin_url, name, address, lat, lng, description, website, domain, logo_url, stage, employees, section, year_founded, hiring, claimed_by, claimed_at, jobs, photos";

export async function POST(req: NextRequest) {
  let body: { slug?: unknown; path?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const path = typeof body.path === "string" ? body.path.trim() : "";
  if (!slug || !path) {
    return NextResponse.json({ error: "Missing slug or path" }, { status: 400 });
  }

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
    console.error("[/api/startups/photos/delete] missing service role envs");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createServiceClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: existing, error: lookupError } = await admin
    .from("startups")
    .select("slug, photos, claimed_by")
    .eq("slug", slug)
    .maybeSingle();
  if (lookupError) {
    console.error("[/api/startups/photos/delete] lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Startup not found" }, { status: 404 });
  }
  if (existing.claimed_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentPhotos = (existing.photos as string[] | null) ?? [];
  // Validate the path actually belongs to this startup AND is in the array.
  // Either check alone is insufficient: array membership prevents arbitrary
  // path deletion; slug-prefix prevents a bug elsewhere from letting a
  // foreign path sneak into the array.
  if (!currentPhotos.includes(path)) {
    return NextResponse.json(
      { error: "Photo not found in listing" },
      { status: 400 }
    );
  }
  if (!path.startsWith(`${slug}/`)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const removeResult = await removePhotos(admin, [path]);
  if (removeResult.error) {
    console.error(
      "[/api/startups/photos/delete] storage remove failed:",
      removeResult.error
    );
    // Don't abort — better to drop the array entry than leak a stuck object.
  }

  const updatedPhotos = currentPhotos.filter((p) => p !== path);
  const { data: updated, error: updateError } = await admin
    .from("startups")
    .update({ photos: updatedPhotos })
    .eq("slug", slug)
    .eq("claimed_by", user.id)
    .select(STARTUP_SELECT)
    .single();

  if (updateError) {
    console.error("[/api/startups/photos/delete] db update failed:", updateError.message);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, startup: updated });
}
