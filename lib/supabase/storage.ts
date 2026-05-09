// server-only — never import from a client component.
// Wraps the bucket-level operations the photo routes need. Each helper takes
// a service-role admin client so callers stay in control of credentials and
// the helper itself remains free of env reads.

import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET, MIME_TO_EXT } from "@/lib/startups/photoConfig";

// Build "<slug>/<uuid>.<ext>". The UUID is generated server-side via
// crypto.randomUUID() so the client cannot influence the object key.
export function buildPhotoObjectPath(slug: string, mimeType: string): string {
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) throw new Error(`Unsupported mime: ${mimeType}`);
  return `${slug}/${crypto.randomUUID()}.${ext}`;
}

export async function uploadPhoto(
  admin: SupabaseClient,
  path: string,
  body: Buffer | Blob,
  contentType: string
): Promise<{ error: string | null }> {
  const { error } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType, upsert: false });
  return { error: error?.message ?? null };
}

// One round-trip removes up to 1000 paths — well above our 8-photo cap.
export async function removePhotos(
  admin: SupabaseClient,
  paths: string[]
): Promise<{ error: string | null }> {
  if (paths.length === 0) return { error: null };
  const { error } = await admin.storage.from(PHOTO_BUCKET).remove(paths);
  return { error: error?.message ?? null };
}

// `list` does NOT recurse; one level deep is exactly our path scheme.
export async function listPhotosByPrefix(
  admin: SupabaseClient,
  prefix: string
): Promise<{ paths: string[]; error: string | null }> {
  const { data, error } = await admin.storage
    .from(PHOTO_BUCKET)
    .list(prefix, { limit: 100 });
  if (error) return { paths: [], error: error.message };
  return {
    paths: (data ?? []).map((entry) => `${prefix}/${entry.name}`),
    error: null,
  };
}
