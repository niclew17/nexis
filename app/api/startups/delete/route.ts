import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { listPhotosByPrefix, removePhotos } from "@/lib/supabase/storage";

// Delete a startup row. Same trust boundary as /api/startups/update:
// only the verified owner (matched by both app_metadata.role === 'startupOwner'
// AND claimed_by === user.id) can remove their listing. There is no admin
// bypass — every delete is owner-initiated.
export async function POST(req: NextRequest) {
  let body: { slug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
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
    console.error("[/api/startups/delete] missing service role envs");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createServiceClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: existing, error: lookupError } = await admin
    .from("startups")
    .select("slug, claimed_by")
    .eq("slug", slug)
    .maybeSingle();

  if (lookupError) {
    console.error("[/api/startups/delete] lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Startup not found" }, { status: 404 });
  }
  if (existing.claimed_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cascade: list every object under <slug>/ in the photos bucket and remove
  // them BEFORE the row delete. Storage failures are logged but don't abort
  // the delete — better to drop the row than block the user's intent on a
  // stuck bucket. Orphaned objects can be swept later.
  const { paths: photoPaths, error: listError } = await listPhotosByPrefix(
    admin,
    slug
  );
  if (listError) {
    console.error("[/api/startups/delete] photo list failed:", listError);
  } else if (photoPaths.length > 0) {
    const removeResult = await removePhotos(admin, photoPaths);
    if (removeResult.error) {
      console.error(
        "[/api/startups/delete] photo cascade failed:",
        removeResult.error
      );
    }
  }

  // Double-eq the delete on (slug, claimed_by) so a race between this read
  // and the delete can't drop someone else's row. If a different user
  // somehow now owns it (impossible given the above check, but defensive),
  // the delete affects 0 rows.
  const { error: deleteError, count } = await admin
    .from("startups")
    .delete({ count: "exact" })
    .eq("slug", slug)
    .eq("claimed_by", user.id);

  if (deleteError) {
    console.error("[/api/startups/delete] delete failed:", deleteError.message);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, slug });
}
