// Shared between the photo API routes and the PhotoManager UI. Numbers must
// match the bucket-level limits set in the
// 20260512000000_add_photos_and_bucket.sql migration.

export const PHOTO_BUCKET = "startup-photos";
export const MAX_PHOTOS_PER_STARTUP = 8;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_PHOTO_MIME_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Canonical mime → extension. Note JPEG is always image/jpeg, never image/jpg.
export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
