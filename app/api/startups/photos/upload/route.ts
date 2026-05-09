import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  MAX_PHOTOS_PER_STARTUP,
  MAX_PHOTO_BYTES,
  ALLOWED_PHOTO_MIME_TYPES,
} from "@/lib/startups/photoConfig";
import {
  buildPhotoObjectPath,
  uploadPhoto,
  removePhotos,
} from "@/lib/supabase/storage";

// Note: Node runtime is the App Router default — no `export const runtime`
// needed (and Next 16 + Cache Components rejects it). Vercel's hobby tier
// caps the platform request body at 4.5 MB regardless; surfaced as a 413
// to the client and documented in INEFFICIENCIES.md.

const STARTUP_SELECT =
  "slug, linkedin_url, name, address, lat, lng, description, website, domain, logo_url, stage, employees, section, year_founded, hiring, claimed_by, claimed_at, jobs, photos";

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const slug =
    typeof form.get("slug") === "string"
      ? (form.get("slug") as string).trim()
      : "";
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const fileEntries = form.getAll("file").filter((f): f is File => f instanceof File);
  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
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
    console.error("[/api/startups/photos/upload] missing service role envs");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createServiceClient(SUPABASE_URL, SERVICE_ROLE);

  // Resolve the slug-to-row + ownership BEFORE any file IO so an attacker
  // with a valid session can't waste storage uploads against another slug.
  const { data: existing, error: lookupError } = await admin
    .from("startups")
    .select("slug, photos, claimed_by")
    .eq("slug", slug)
    .maybeSingle();
  if (lookupError) {
    console.error("[/api/startups/photos/upload] lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Startup not found" }, { status: 404 });
  }
  if (existing.claimed_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentPhotos = (existing.photos as string[] | null) ?? [];
  if (currentPhotos.length + fileEntries.length > MAX_PHOTOS_PER_STARTUP) {
    return NextResponse.json(
      {
        error: `Maximum ${MAX_PHOTOS_PER_STARTUP} photos per listing. You have ${currentPhotos.length}; can't add ${fileEntries.length} more.`,
      },
      { status: 400 }
    );
  }

  const newPaths: string[] = [];
  for (const file of fileEntries) {
    if (!ALLOWED_PHOTO_MIME_TYPES.has(file.type)) {
      await removePhotos(admin, newPaths);
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || "(none)"}.` },
        { status: 415 }
      );
    }
    if (file.size > MAX_PHOTO_BYTES) {
      await removePhotos(admin, newPaths);
      return NextResponse.json(
        { error: "File too large (max 5 MB)." },
        { status: 413 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const path = buildPhotoObjectPath(slug, file.type);
    const uploadResult = await uploadPhoto(admin, path, buf, file.type);
    if (uploadResult.error) {
      console.error("[/api/startups/photos/upload] upload failed:", uploadResult.error);
      await removePhotos(admin, newPaths);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
    newPaths.push(path);
  }

  const updatedPhotos = [...currentPhotos, ...newPaths];
  const { data: updated, error: updateError } = await admin
    .from("startups")
    .update({ photos: updatedPhotos })
    .eq("slug", slug)
    .eq("claimed_by", user.id)
    .select(STARTUP_SELECT)
    .single();

  if (updateError) {
    console.error("[/api/startups/photos/upload] db update failed:", updateError.message);
    // Roll back the just-uploaded objects so the bucket doesn't carry orphans.
    await removePhotos(admin, newPaths);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, startup: updated });
}
