# Feature: Startup Photo Gallery + Polished InfoPanel + Cascade Deletion

The following plan should be complete, but it is important that you validate documentation, codebase patterns, and task sanity before you start implementing.

Pay special attention to: the **inline-styles-only** rule inside `components/map/*` (no Tailwind, no shadcn primitives), the existing `EditPanel` patterns for jobs/danger-zone (we mirror those for photos), and the fact that `EditPanel.tsx` already calls `/api/startups/delete` and accepts an `onDeleted` prop — but **the route doesn't exist yet** and the parent `InfoPanel` doesn't pass `onDeleted`. The plan repairs this dangling wire as part of the cleanup work, since photo cleanup belongs inside the same delete route.

---

## Feature Description

Three connected pieces of work:

1. **Photo gallery (owner-managed)**: a startup owner can upload up to 8 photos (JPEG/PNG/WebP, ≤5 MB each) for their listing. Photos live in a new public Supabase Storage bucket `startup-photos` under a per-startup prefix. The owner can re-order, remove individual photos, or remove all of them.
2. **Cascade deletion**: when a startup is deleted via the `Delete listing` button (currently broken — calls a missing route), every photo under that startup's prefix is purged from the bucket and the row is removed. Account-level deletion is explicitly out of scope (the existing `claimed_by` FK already sets to NULL on user delete; photos remain with the unclaimed listing for the next claimer).
3. **Polished InfoPanel**: a hero image strip at the top, a horizontal thumbnail row below the description, and an elevated `Open roles` card replace the current minimal layout. Owners see an `Edit` affordance the same way they do today; viewers see a clean, gallery-rich profile that signals the difference between an unclaimed CSV row and a fully-fleshed-out claimed listing.

A new column `photos text[]` on `startups` stores the per-startup ordered list of object paths (not full URLs). The client derives public URLs at render time via `supabase.storage.from('startup-photos').getPublicUrl(path)` so a future migration to a private bucket is one route change away with no schema migration.

## User Story

As a startup owner who has claimed my listing on the Nexis map,
I want to upload a small set of company photos and showcase open roles in a polished sidebar,
So that visitors see what we're building, who we are, and what we're hiring for — not just a name and a logo.

## Problem Statement

The InfoPanel today is text-and-badges. Even claimed listings look like the unclaimed CSV rows — there's no payoff for going through the claim flow beyond an `Edit` button. There's no media surface, the `jobs` data already in the schema renders as an undifferentiated bullet list, and the `Delete listing` button silently 404s because `/api/startups/delete` was wired in `EditPanel.tsx` but never created. Together these gaps make ownership feel hollow.

## Solution Statement

- **Storage**: a new public bucket `startup-photos` with deterministic per-startup prefixes (`<slug>/<uuid>.<ext>`). Public read keeps the gallery one-fetch — writes go through service-role API routes. The bucket has no client-side RLS write policies; the only writers are the new routes.
- **Schema**: add `photos text[] not null default '{}'` to `startups`. The array order is the gallery order. **Photos are not editable through `/api/startups/update`** — they have dedicated routes so we never trip on multipart limits or accidental clobbering when the edit form omits the field.
- **Routes**: four new owner-only routes that mirror the existing `/api/startups/claim` + `/api/startups/update` shape:
  - `POST /api/startups/photos/upload` — multipart form data; one or more files; appends to the photos array.
  - `POST /api/startups/photos/delete` — JSON `{ slug, path }`; removes one photo from storage + array.
  - `POST /api/startups/photos/reorder` — JSON `{ slug, paths }`; replaces the array (validated as an exact permutation of current paths).
  - `POST /api/startups/delete` — JSON `{ slug }`; lists every object under `<slug>/` in the bucket, deletes them, deletes the startup row. This route is **also the missing route** the existing `EditPanel.tsx` already calls.
- **InfoPanel UI**: rewritten layout — hero image at the top, thumbnail strip after description, elevated `Open roles` card, lightbox modal on photo click.
- **EditPanel UI**: a new `PhotoManager` section above the existing `Open roles` block. Owner uploads via a single `<input type="file" multiple>` (drag-and-drop nice-to-have, deferred). Removal via per-thumbnail × button. Re-order via simple ↑/↓ arrows on each thumbnail (drag-reorder out of scope for hackathon).

No new npm dependencies. The Supabase JS SDK already ships `storage.from(...).upload`, `.list`, and `.remove`.

## Feature Metadata

**Feature Type**: New Capability (gallery, cascade delete) + Enhancement (InfoPanel polish)
**Estimated Complexity**: Medium-High
**Primary Systems Affected**: new `app/api/startups/photos/{upload,delete,reorder}/`, new `app/api/startups/delete/`, new `components/map/edit/PhotoManager.tsx`, new `components/map/info/HeroGallery.tsx` + `Lightbox.tsx` + `RolesCard.tsx`, modified `components/map/InfoPanel.tsx`, modified `components/map/edit/EditPanel.tsx` (insert PhotoManager), modified `lib/map/types.ts`, new `lib/startups/photoConfig.ts`, new `lib/supabase/storage.ts`, new migration `20260512000000_add_photos_and_bucket.sql`, modified `app/map/page.tsx` SELECT, modified `next.config.ts` (allow Supabase storage hostname for `<Image>` if used — but we use plain `<img>` per existing convention, so no change needed).
**Dependencies**: existing only (`@supabase/supabase-js`, `@supabase/ssr`, `framer-motion`). No new npm packages.
**Storage / Cost note**: 8 photos × 5 MB × ~250 startups (worst case all-claimed) = 10 GB max bucket footprint. Supabase free tier ships 1 GB of storage; Pro is 100 GB. Hackathon scope assumes Pro or fewer claimed listings.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `components/map/edit/EditPanel.tsx` (entire file, especially lines 49 / 132–211 / 366–420 / 473–571) — Why: the file we extend. Note the existing `onDeleted` prop (line 49) which is **required by the type but not passed by InfoPanel** today; the danger-zone two-click confirm (473–571); the jobs editor pattern (366–420) we mirror for photo manager; the `handleDelete` call to `/api/startups/delete` (190–210) pointing at the route we're creating in this feature.
- `components/map/InfoPanel.tsx` (entire file, especially lines 162–377) — Why: the surface we rewrite. Keep the wrapper / motion / mobile-vs-desktop choice; replace the body. Notice the existing `jobs` rendering (199–233) — we replace it with `<RolesCard />`.
- `app/api/startups/update/route.ts` (entire file) — Why: canonical service-role write pattern. Mirror the auth gate (146–157), service-role client init (159–165), ownership check (167–182), `EDITABLE_STARTUP_KEYS` validation pattern (42–129).
- `app/api/startups/claim/route.ts` (lines 1–112) — Why: same auth pattern; the photo routes use the same `email_confirmed_at && !is_anonymous && app_metadata.role === 'startupOwner'` gate.
- `lib/map/types.ts` (lines 30–91) — Why: `Startup.photos?: string[]` already declared (line 50); the type is correct, only the DB column is missing. Keep `EDITABLE_STARTUP_KEYS` as-is — `photos` is **deliberately not included** because it's mutated through dedicated routes.
- `supabase/migrations/20260509000000_create_startups.sql` (entire file) — Why: existing schema + trigger + RLS pattern. New migration follows this style.
- `supabase/migrations/20260510000000_add_claim_columns.sql` (entire file) — Why: idempotent `add column if not exists` pattern + index DDL.
- `lib/supabase/server.ts` (lines 1–34) — Why: server cookie-aware client; reads the user session for auth checks.
- `lib/supabase/client.ts` — Why: browser client used inside `EditPanel` for sign-out today. Photo upload UI uses the **server route** for upload (multipart through Next), not direct browser → bucket — that way we don't need a write RLS policy on `storage.objects`.
- `scripts/import-startups.ts` (lines 1–101) — Why: canonical service-role bulk write reference. New routes import the same `createServiceClient` shape.
- `lib/startups/geocode.ts` (lines 1–35) — Why: example of a server-only helper with a top-of-file marker comment. New `lib/supabase/storage.ts` follows this convention.
- `lib/map/store.ts` — Why: `setSelectedStartup` is the imperative API the InfoPanel uses to refresh after a save. Photo upload/delete responses must include the new full Startup so we can call it.
- `app/map/page.tsx` (lines 7–22) — Why: the SELECT list must include `photos` after the migration so the column flows through to the InfoPanel.
- `components/map/edit/AddressField.tsx` — Why: small inline-styled subcomponent pattern; mirror for `PhotoManager`'s thumbnail tile.
- `components/map/StartupMarker.tsx` — Why: `<img onError>` fallback pattern (Clearbit logos sometimes 404). Reuse the same fallback for photo thumbnails that fail to load.
- `ai-context/SECURITY.md` (lines 76–84) — Why: format for the new "Map Photo Gallery" entry.
- `ai-context/INEFFICIENCIES.md` (lines 81–110) — Why: format for the new entry on per-photo round-trips.

### Existing Files That Change

- `supabase/migrations/` — ADD new migration `20260512000000_add_photos_and_bucket.sql`.
- `lib/map/types.ts` — ALREADY has `photos?: string[]` (line 50); leave as-is. Ensure no regression.
- `app/map/page.tsx` — APPEND `, photos` to the SELECT string at line 12.
- `components/map/InfoPanel.tsx` — REWRITE the `view` mode body (lines 162–377). Header/footer chrome stays intact.
- `components/map/edit/EditPanel.tsx` — INSERT `<PhotoManager />` between the existing form body (after the hiring checkbox, line 364) and the `Open roles` block (366). Touch nothing else.
- `next.config.ts` — VERIFY the existing config doesn't gate `<img>` against external hosts (the project uses raw `<img>` tags, not `next/image` for these). No change expected; just confirm.
- `ai-context/SECURITY.md` — APPEND `### Map Photo Gallery (Feature: startup-photo-gallery)` entry.
- `ai-context/INEFFICIENCIES.md` — APPEND entries for: `<img>` instead of `next/image`, no thumbnail downscale at upload time, per-photo delete round-trip.

### New Files to Create (in dependency order)

```
supabase/migrations/20260512000000_add_photos_and_bucket.sql ← photos column + bucket creation + (no) RLS on storage.objects
lib/startups/photoConfig.ts                                  ← MAX_PHOTOS, ALLOWED_MIME, MAX_BYTES, PUBLIC_URL_PREFIX
lib/supabase/storage.ts                                      ← server-only service-role storage helper (upload, listAndDeletePrefix, deletePath)
app/api/startups/photos/upload/route.ts                      ← multipart upload; appends to photos[]
app/api/startups/photos/delete/route.ts                      ← single-photo delete; removes from photos[] + storage
app/api/startups/photos/reorder/route.ts                     ← replace photos[] with a permutation of existing paths
app/api/startups/delete/route.ts                             ← list-and-delete bucket prefix; delete row
components/map/edit/PhotoManager.tsx                         ← upload + thumbnails + reorder + per-photo delete
components/map/info/HeroGallery.tsx                          ← hero image + thumbnail strip + lightbox trigger
components/map/info/Lightbox.tsx                             ← full-screen modal viewer with arrow nav
components/map/info/RolesCard.tsx                            ← elevated open-roles card
components/map/info/StatRow.tsx                              ← optional: shared row of badges (Stage / Employees / Section / Hiring)
```

(StatRow is optional — only create if extracting it from the InfoPanel rewrite materially simplifies the code. Otherwise inline the badge row.)

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [Supabase Storage: upload](https://supabase.com/docs/reference/javascript/storage-from-upload) — `storage.from(bucket).upload(path, fileBody, { contentType, upsert: false })`. Note: pass a `Blob` or `File` directly; or a `Buffer` after `Buffer.from(await file.arrayBuffer())`.
- [Supabase Storage: list](https://supabase.com/docs/reference/javascript/storage-from-list) — `storage.from(bucket).list(prefix)`. Returns `{ name, ... }[]`. Used in the cascade delete to enumerate every object under `<slug>/`.
- [Supabase Storage: remove](https://supabase.com/docs/reference/javascript/storage-from-remove) — `storage.from(bucket).remove([path1, path2, ...])` accepts an array; one round-trip removes many. Used in cascade delete and individual deletes.
- [Supabase Storage: getPublicUrl](https://supabase.com/docs/reference/javascript/storage-from-getpublicurl) — returns `{ data: { publicUrl } }`. Stable; no expiry. Use client-side from the rendering components.
- [Supabase Storage: bucket creation via SQL](https://supabase.com/docs/guides/storage/security/access-control) — `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (...)`. Bucket-level limits are belt-and-suspenders alongside our route-level checks.
- [Supabase Storage: storage.objects RLS](https://supabase.com/docs/guides/storage/security/access-control#policy-examples) — we **do not add a write policy** because all writes go through service-role routes. Public read works automatically when `public: true`.
- [Next.js Route Handlers: parsing FormData](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#request-body-formdata) — `await req.formData()` returns a `FormData` instance; `.getAll('file')` returns `(File | string)[]`.
- [MDN: File.size / File.type](https://developer.mozilla.org/en-US/docs/Web/API/File) — server-side validation hooks. The file's reported `type` is the browser's mime-sniff; cross-check with a magic-byte read for serious validation. For hackathon, mime-string check is sufficient.
- [Supabase rate limits (storage)](https://supabase.com/docs/guides/storage#rate-limits) — defaults are generous; we won't hit them at hackathon scale.

### Patterns to Follow

**Inline styles in `components/map/*`** (no Tailwind, no shadcn) — copy InfoPanel.tsx button shape:

```tsx
// Button shape — InfoPanel.tsx:301-328
<button
  style={{
    flex: 1,
    minWidth: "140px",
    padding: "10px 16px",
    border: `1px solid ${COLORS.accent}`,
    background: "transparent",
    color: COLORS.accent,
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    fontSize: "0.875rem",
    letterSpacing: "0.05em",
    cursor: "pointer",
    transition: "background 0.2s ease-out, color 0.2s ease-out",
  }}
/>
```

**Service-role client in routes (mirror `app/api/startups/claim/route.ts:39-45`):**

```ts
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("[/api/startups/photos/upload] missing service role envs");
  return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
}
const admin = createServiceClient(SUPABASE_URL, SERVICE_ROLE);
```

**Owner-only auth gate (mirror `app/api/startups/update/route.ts:146-182`):**

```ts
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (
  !user ||
  user.is_anonymous ||
  (user.app_metadata as { role?: string } | undefined)?.role !== "startupOwner"
) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
// ...
const { data: existing } = await admin
  .from("startups")
  .select("slug, photos, claimed_by")
  .eq("slug", slug)
  .maybeSingle();
if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
if (existing.claimed_by !== user.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Public URL helper (client-side):**

```tsx
// Use the existing browser client. The publicUrl is stable; cache it once per render.
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
const { data: { publicUrl } } = supabase.storage.from("startup-photos").getPublicUrl(path);
```

**Photo path convention:**

```
{slug}/{uuid}.{ext}

Examples:
  acme-corp/9b3f0e8a-7c50-49a4-8e9d-1f6e4f1f7b3e.jpg
  acme-corp/2c8a4d09-5f1f-4d62-9b8e-aa3b7e1f7d44.png
```

`<slug>` is read from the startups row, not from the client (which could spoof). The UUID is generated server-side via `crypto.randomUUID()`. The extension comes from the validated mime-type, not the original filename.

**Image rendering (existing convention in this codebase):** plain `<img>` tags with `onError` fallbacks, NOT `next/image`. See `components/map/StartupMarker.tsx:42-52`. Reasoning: external Clearbit images, no need for Next's image optimizer, and avoiding the `next.config.ts` `images.domains` whitelist hassle.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation (schema, bucket, helpers)

Database column + bucket exist before any UI is built. Helpers are server-only and self-contained.

**Tasks:**
- Migration: add `photos text[]` column; create the public bucket via `insert into storage.buckets`.
- `lib/startups/photoConfig.ts`: shared constants — limits, mime-types.
- `lib/supabase/storage.ts`: server-only helpers `uploadPhoto`, `removePhotos`, `removePhotosByPrefix`, `buildObjectPath`. Each takes a service-role admin client to keep the helper pure.
- Update `app/map/page.tsx` SELECT to include `photos`.

### Phase 2: API routes

Lock down the trust boundary before any UI work.

**Tasks:**
- `POST /api/startups/photos/upload`: accept multipart; iterate files; validate; upload each; append paths to row; return updated startup.
- `POST /api/startups/photos/delete`: validate path is in current photos[]; remove from storage; remove from photos[]; return updated startup.
- `POST /api/startups/photos/reorder`: validate body is exact permutation of current photos[]; update photos[]; return updated startup.
- `POST /api/startups/delete`: list `<slug>/` prefix; remove all; delete row; return `{ ok: true }`.

### Phase 3: Owner UI — `PhotoManager` inside `EditPanel`

Wire the upload + thumbnails + reorder + remove flow. Keep it inline-styled and small.

**Tasks:**
- New `components/map/edit/PhotoManager.tsx` reading `startup.photos` from props, calling the three photo routes, and emitting `onChange(updatedStartup)` so the parent EditPanel and its `setSelectedStartup` chain stays consistent.
- Insert it inside `EditPanel.tsx` between the hiring checkbox and the Open roles block.
- Update the parent `InfoPanel.tsx` to pass `onDeleted={() => { setSelectedStartup(null); onClose(); }}` to `EditPanel` (currently missing — TypeScript should already flag this).

### Phase 4: Viewer UI — `HeroGallery` + `Lightbox` + `RolesCard` inside `InfoPanel`

Rewrite the InfoPanel `view` mode body. Owner-edit affordance preserved.

**Tasks:**
- `HeroGallery.tsx`: hero photo + thumbnail strip; click any to open lightbox.
- `Lightbox.tsx`: fixed-position fullscreen overlay with click-to-close, arrow keys, prev/next chevrons.
- `RolesCard.tsx`: bordered card listing each open role with title + apply link.
- Rewrite InfoPanel `view` mode to compose these in the order: hero → header → badges → description → thumbnail strip → roles card → action buttons → back-to-utah.
- If `photos.length === 0`, render the existing logo-in-circle header treatment as today (graceful empty state).
- If `jobs.length === 0`, hide the RolesCard (graceful empty state).

### Phase 5: Documentation + polish

**Tasks:**
- Append `ai-context/SECURITY.md` entry.
- Append `ai-context/INEFFICIENCIES.md` entries.
- Manual end-to-end browser testing on desktop + mobile viewports.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order. Each task is atomic and independently testable.

### CREATE `supabase/migrations/20260512000000_add_photos_and_bucket.sql`

- **IMPLEMENT**:
  ```sql
  -- Photos column on startups: ordered list of object paths in the
  -- startup-photos bucket. The path scheme is "<slug>/<uuid>.<ext>" so the
  -- whole prefix can be enumerated and purged on row delete.
  alter table startups
    add column if not exists photos text[] not null default '{}'::text[];

  -- Public bucket: read-anywhere, write-only-via-service-role. We do NOT add
  -- a storage.objects write policy for authenticated users — every write
  -- flows through /api/startups/photos/* using the service-role client.
  -- Public read works automatically when the bucket is public.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'startup-photos',
    'startup-photos',
    true,
    5242880,                                          -- 5 MB per object (belt + suspenders)
    array['image/jpeg', 'image/png', 'image/webp']    -- match lib/startups/photoConfig.ts
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
  ```
- **PATTERN**: Mirror `supabase/migrations/20260510000000_add_claim_columns.sql` for the `add column if not exists` shape; bucket-creation SQL pattern is from Supabase docs.
- **GOTCHA**: `storage.buckets` requires the `storage` schema to be in scope. Most Supabase projects have it pre-installed; if the migration errors with `relation does not exist`, verify `Authentication → Storage` is enabled in the project before retrying.
- **GOTCHA**: `on conflict (id)` makes the migration idempotent so it can be re-run safely if the bucket already exists from a manual click in Studio.
- **VALIDATE**:
  ```bash
  # Apply via Studio SQL editor or:
  npx supabase migration up
  # Confirm via SQL:
  # select column_name from information_schema.columns where table_name = 'startups' and column_name = 'photos';
  # select * from storage.buckets where id = 'startup-photos';
  ```
  Both queries should return one row.

### CREATE `lib/startups/photoConfig.ts`

- **IMPLEMENT**:
  ```ts
  // Shared between API routes and the PhotoManager UI. Numbers must match the
  // bucket-level limits set in 20260512000000_add_photos_and_bucket.sql.
  export const PHOTO_BUCKET = "startup-photos";
  export const MAX_PHOTOS_PER_STARTUP = 8;
  export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
  export const ALLOWED_PHOTO_MIME_TYPES = new Set<string>([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  export const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  ```
- **IMPORTS**: None.
- **GOTCHA**: Keep `MIME_TO_EXT` keyed on the canonical mime-string (no `image/jpg`) — JPEG files are reported as `image/jpeg`, never `image/jpg`. Reject `image/jpg` if it ever appears.
- **VALIDATE**: `npx tsc --noEmit`.

### CREATE `lib/supabase/storage.ts`

- **IMPLEMENT**: A server-only helper. Top comment: `// server-only — never import from a client component.`
  ```ts
  import type { SupabaseClient } from "@supabase/supabase-js";
  import { PHOTO_BUCKET, MIME_TO_EXT } from "@/lib/startups/photoConfig";

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

  export async function removePhotos(
    admin: SupabaseClient,
    paths: string[]
  ): Promise<{ error: string | null }> {
    if (paths.length === 0) return { error: null };
    const { error } = await admin.storage.from(PHOTO_BUCKET).remove(paths);
    return { error: error?.message ?? null };
  }

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
  ```
- **PATTERN**: Mirror `lib/startups/geocode.ts` for the server-only file convention (top-of-file comment, throw on misconfig).
- **GOTCHA**: `crypto.randomUUID()` requires Node 19+ or Edge runtime. The project runs Next 15 which uses Node 20+; safe.
- **GOTCHA**: `storage.from(...).remove()` accepts up to 1000 paths per call — well above our 8-photo cap. No need to batch.
- **GOTCHA**: `storage.from(...).list()` does NOT recursively descend; it returns one level. Since our path scheme is exactly `<slug>/<uuid>.<ext>` (one level deep), `list(slug)` is sufficient.
- **VALIDATE**: `npx tsc --noEmit`.

### UPDATE `app/map/page.tsx` — add `photos` to SELECT

- **IMPLEMENT**: At line 12, change:
  ```ts
  "slug, linkedin_url, name, address, lat, lng, description, website, domain, logo_url, stage, employees, section, year_founded, hiring, claimed_by, claimed_at, jobs"
  ```
  to:
  ```ts
  "slug, linkedin_url, name, address, lat, lng, description, website, domain, logo_url, stage, employees, section, year_founded, hiring, claimed_by, claimed_at, jobs, photos"
  ```
- **GOTCHA**: Order doesn't matter, but keep `photos` at the end so the diff is small.
- **VALIDATE**: Open `/map` in dev (after migration applied), click any startup, log `selectedStartup.photos` — should be `[]` for fresh data.

### CREATE `app/api/startups/photos/upload/route.ts`

- **IMPLEMENT**:
  1. `export async function POST(req: NextRequest)`. Parse `await req.formData()`. Read `slug` (string) and `files` (`File[]` via `formData.getAll('file')`). Reject 400 if either missing.
  2. Auth gate: `createServerClient()`, `getUser()`, require `!is_anonymous && app_metadata.role === 'startupOwner'`. 403 otherwise.
  3. Service-role admin client init (mirror claim route 39–45).
  4. Read existing row: `admin.from('startups').select('slug, photos, claimed_by').eq('slug', slug).maybeSingle()`. 404 if missing; 403 if `claimed_by !== user.id`.
  5. Reject 400 if `existing.photos.length + files.length > MAX_PHOTOS_PER_STARTUP`.
  6. For each file:
     - Reject 415 if `!ALLOWED_PHOTO_MIME_TYPES.has(file.type)`.
     - Reject 413 if `file.size > MAX_PHOTO_BYTES`.
     - `const buf = Buffer.from(await file.arrayBuffer());`
     - `const path = buildPhotoObjectPath(slug, file.type);`
     - `await uploadPhoto(admin, path, buf, file.type);` — on error, attempt to remove any already-uploaded paths in this request before returning 500.
     - Push `path` to a local `newPaths` array.
  7. Update DB: `admin.from('startups').update({ photos: [...existing.photos, ...newPaths] }).eq('slug', slug).select('...all columns...').single()`. On error, also rollback storage uploads.
  8. Return `{ ok: true, startup: updatedRow }`.
- **PATTERN**: Mirror `app/api/startups/update/route.ts` for the auth + service-role + return shape. Use the same SELECT column list as `update/route.ts:212` so the response is a full Startup the client can drop into `setSelectedStartup`.
- **IMPORTS**:
  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { createClient as createServerClient } from "@/lib/supabase/server";
  import { createClient as createServiceClient } from "@supabase/supabase-js";
  import {
    MAX_PHOTOS_PER_STARTUP,
    MAX_PHOTO_BYTES,
    ALLOWED_PHOTO_MIME_TYPES,
  } from "@/lib/startups/photoConfig";
  import { buildPhotoObjectPath, uploadPhoto, removePhotos } from "@/lib/supabase/storage";
  ```
- **GOTCHA**: Next 16's default body size is 1 MB for JSON. **`req.formData()` has its own pipeline** but Next's middleware/edge runtime can still cap at 4.5 MB on Vercel's hobby tier. For dev this is fine. For prod, the route should run on Node runtime (`export const runtime = "nodejs"` at the top of the file) — add this. Document the Vercel-tier caveat in INEFFICIENCIES.md.
- **GOTCHA**: Validate `slug` is a non-empty string AND matches the startup the auth user owns BEFORE doing any file IO. Otherwise an attacker with a valid session could spam uploads against any slug.
- **GOTCHA**: Files are not magic-byte-checked — we trust the browser's `file.type`. Acceptable for hackathon; flag in SECURITY.md.
- **GOTCHA**: Do NOT include the raw FormData in any logging; it could echo image bytes into logs.
- **VALIDATE**:
  ```bash
  # With dev server + a logged-in startupOwner cookie:
  curl -X POST http://localhost:3000/api/startups/photos/upload \
    --cookie "$(cat dev-cookie.txt)" \
    -F "slug=acme-corp" \
    -F "file=@./test.jpg" \
    -F "file=@./test2.png" | jq .
  ```
  Expect `ok: true` and `startup.photos.length` increased by 2.

### CREATE `app/api/startups/photos/delete/route.ts`

- **IMPLEMENT**:
  1. Parse JSON `{ slug, path }`. Reject 400 on missing/wrongly-typed.
  2. Same auth gate as upload route.
  3. Read row + ownership check.
  4. Validate `existing.photos.includes(path)` — 400 if not. **Prevents arbitrary path deletion.**
  5. Validate `path.startsWith(slug + "/")` — defense in depth against a path that snuck into the array but doesn't belong.
  6. `await removePhotos(admin, [path])`.
  7. `admin.from('startups').update({ photos: existing.photos.filter(p => p !== path) }).eq('slug', slug).select(...all...).single()`.
  8. Return `{ ok: true, startup: updatedRow }`.
- **PATTERN**: Mirror upload route's auth/ownership block.
- **GOTCHA**: If storage delete succeeds but DB update fails, the row points at a phantom path. Acceptable: the next list operation drops the missing entries from `<img onError>`. Don't introduce a transaction here — the storage API isn't transactional with Postgres.
- **VALIDATE**:
  ```bash
  curl -X POST http://localhost:3000/api/startups/photos/delete \
    --cookie "..." -H "Content-Type: application/json" \
    -d '{"slug":"acme-corp","path":"acme-corp/<uuid>.jpg"}'
  ```
  Expect 200 + the path removed from `startup.photos`.

### CREATE `app/api/startups/photos/reorder/route.ts`

- **IMPLEMENT**:
  1. Parse JSON `{ slug, paths: string[] }`. Reject 400 on missing/wrong type.
  2. Same auth gate + ownership check.
  3. Validate `paths` is an exact permutation of `existing.photos`: same length, same set membership. 400 otherwise.
  4. `admin.from('startups').update({ photos }).eq('slug', slug).select(...all...).single()`.
  5. Return `{ ok: true, startup: updatedRow }`.
- **GOTCHA**: Reject if any path in `paths` does not appear in `existing.photos`. Don't accept "almost a permutation" — the only legitimate use is reordering. Add/remove flow through their own routes.
- **VALIDATE**: After uploading 3 photos, `curl ... -d '{"slug":"...","paths":[<3rd>,<1st>,<2nd>]}'` and confirm the array order changes.

### CREATE `app/api/startups/delete/route.ts`

- **IMPLEMENT**:
  1. Parse JSON `{ slug }`. 400 if missing.
  2. Auth + ownership check (same as photo routes).
  3. `listPhotosByPrefix(admin, slug)` → array of paths under `<slug>/`. Don't error on empty.
  4. If any paths returned: `removePhotos(admin, paths)`. On storage error, log but **don't abort** — better to drop the row than block delete on a stuck bucket.
  5. `admin.from('startups').delete().eq('slug', slug).eq('claimed_by', user.id)`. The `.eq('claimed_by', user.id)` is a defense-in-depth race protection: if some other process re-claims while we're cleaning up, the row delete affects 0 rows and we return 409.
  6. Return `{ ok: true }`.
- **PATTERN**: Auth/ownership block from update route.
- **GOTCHA**: This route is **already called by EditPanel.tsx:197**. The current code expects 200 → `onDeleted()`. Keep that contract.
- **GOTCHA**: When the row is deleted, the `auth.users → claimed_by` FK kicks in via `on delete set null` — but the row no longer exists, so nothing happens to the user. The user retains `app_metadata.role = 'startupOwner'` but has no claimed startup. That's fine; they could re-claim a different listing. Don't reset the role here.
- **VALIDATE**: After uploading photos, hit this route. Confirm: row gone (`select count(*) from startups where slug='...';` → 0); bucket prefix empty (`storage.from('startup-photos').list('<slug>')` returns `[]`).

### CREATE `components/map/edit/PhotoManager.tsx`

- **IMPLEMENT**: A self-contained section that owns its file input, thumbnail rendering, reorder arrows, and per-photo delete buttons. Props:
  ```ts
  interface PhotoManagerProps {
    startup: Startup;
    onChange: (updated: Startup) => void;
  }
  ```
  Behavior:
  - Render a label `Photos`, then a horizontal flex row of thumbnails (each ~84×84 with rounded corners). Each thumbnail has overlay controls: ↑ ↓ × in the corner.
  - Below thumbnails: a single `<input type="file" multiple accept="image/jpeg,image/png,image/webp">` styled as a dashed-border drop area with text `Drop or choose photos · {remaining} left · 5 MB max each`.
  - On file change: validate count + size + type client-side; show inline error and DON'T submit the upload if invalid; otherwise POST as `multipart/form-data` to `/api/startups/photos/upload`. On success, call `onChange(json.startup)`.
  - Reorder: ↑ swaps with prev; ↓ swaps with next. Submit a single `/api/startups/photos/reorder` POST with the new order. On success, `onChange`.
  - Delete: per-thumbnail × → `/api/startups/photos/delete`. On success, `onChange`.
  - Each pending request shows a small spinner overlay on the affected thumbnail (or a "uploading..." text on the file input area).
- **PATTERN**: Mirror the jobs editor inside `EditPanel.tsx:366-420` — same flex column, same 6px gap between rows, same per-row × button.
- **IMPORTS**:
  ```ts
  "use client";
  import { useState } from "react";
  import { createClient } from "@/lib/supabase/client";
  import type { Startup } from "@/lib/map/types";
  import { COLORS } from "@/lib/map/mapConfig";
  import {
    MAX_PHOTOS_PER_STARTUP,
    MAX_PHOTO_BYTES,
    ALLOWED_PHOTO_MIME_TYPES,
  } from "@/lib/startups/photoConfig";
  ```
- **GOTCHA**: The browser client only computes the public URL (`getPublicUrl(path)`); all writes go through the API routes. Don't introduce direct browser → bucket uploads.
- **GOTCHA**: When `startup.photos === undefined` (legacy row), default to `[]` defensively.
- **GOTCHA**: Disable the file input when `photos.length >= MAX_PHOTOS_PER_STARTUP`. Show "Maximum {N} photos. Remove one to add another."
- **GOTCHA**: Reset the `<input>` value to `""` after a successful upload — otherwise re-selecting the same file does nothing.
- **VALIDATE**: Render inside `<EditPanel>`, upload one photo from a real claim flow, see thumbnail appear, reorder, delete. All three round-trips return 200.

### UPDATE `components/map/edit/EditPanel.tsx` — insert `<PhotoManager />`

- **IMPLEMENT**: After the hiring checkbox closing `</label>` (currently line 364), insert:
  ```tsx
  <PhotoManager
    startup={startup}
    onChange={(updated) => {
      // Bubble the updated row up so InfoPanel's selectedStartup stays fresh.
      onSaved(updated);
    }}
  />
  ```
  Then continue with the existing `Open roles` block.
- **PATTERN**: Mirror the surrounding inline-style flex column.
- **GOTCHA**: `onSaved` is the only existing callback that updates the parent. Reusing it is correct. Do NOT call `onSaved` AND `onCancel` — the user is still mid-edit; they may want to keep editing other fields.
- **VALIDATE**: Save in the edit panel after a photo upload — confirm the InfoPanel re-renders with the new photo when the user closes edit mode.

### UPDATE `components/map/InfoPanel.tsx` — pass `onDeleted` to `EditPanel`

- **IMPLEMENT**: At the existing `<EditPanel ... />` invocation (currently around lines 395–404), add the missing `onDeleted` prop:
  ```tsx
  <EditPanel
    startup={startup}
    onCancel={() => setMode("view")}
    onSaved={(updated) => {
      setSelectedStartup(updated);
      setMode("view");
    }}
    onDeleted={() => {
      // The row is gone — close the panel; the next render resets the map.
      setSelectedStartup(null);
      onClose();
    }}
  />
  ```
- **PATTERN**: Existing prop list at the same location.
- **GOTCHA**: Without this fix, the file is currently a TypeScript error — the existing EditPanel signature requires `onDeleted: () => void`. The `onClose` prop on `InfoPanel` (line 17) is the right composition target.
- **VALIDATE**: `npx tsc --noEmit` should pass after this change.

### CREATE `components/map/info/HeroGallery.tsx`

- **IMPLEMENT**: Renders the photo strip. Props: `{ photos: string[], onOpen: (index: number) => void }`. Behavior:
  - If `photos.length === 0`: render nothing (parent decides whether to show a logo treatment instead).
  - Else: render the first photo as a 16:9 hero (`width: 100%`, `aspect-ratio: 16/9`, `objectFit: cover`). Tap → `onOpen(0)`.
  - Below: a horizontal scrolling row of thumbnails (`overflow-x: auto`, `gap: 6px`). Each ~64×48, `objectFit: cover`. Tap → `onOpen(index)`.
  - First thumbnail mirrors the hero (so the indexing is consistent).
- **IMPORTS**:
  ```tsx
  "use client";
  import { useMemo } from "react";
  import { createClient } from "@/lib/supabase/client";
  import { PHOTO_BUCKET } from "@/lib/startups/photoConfig";
  import { COLORS } from "@/lib/map/mapConfig";
  ```
- **PATTERN**: Mirror the existing logo `<img onError>` fallback at `components/map/StartupMarker.tsx:42-52`.
- **GOTCHA**: Compute publicUrl once per photo using `useMemo([photos])`. Re-creating the supabase client on every render is fine; `getPublicUrl` is synchronous.
- **GOTCHA**: Wrap the hero `<img>` in a `<button onClick={...}>` so it's keyboard-focusable; lightbox triggers should be reachable without a mouse.
- **VALIDATE**: Render in a story-style scratch component with a test array of 3 photos; confirm the hero shows, the thumbnail strip scrolls, and click handlers fire.

### CREATE `components/map/info/Lightbox.tsx`

- **IMPLEMENT**: A fixed-position fullscreen overlay. Props: `{ photos: string[], startIndex: number, onClose: () => void }`. Behavior:
  - Background `rgba(0,0,0,0.96)` + `backdropFilter: blur(20px)`.
  - Centered `<img>` with `maxWidth: 92vw, maxHeight: 86vh, objectFit: contain`.
  - Top-right `×` button (close); arrow keys `ArrowLeft`/`ArrowRight` cycle; click outside the image closes.
  - Render via React portal? No — the parent InfoPanel already uses `position: fixed` itself; nesting fixed elements works. Use plain JSX.
  - Use `framer-motion` `motion.div` for `initial: { opacity: 0 }` → `animate: { opacity: 1 }` 200ms fade.
- **IMPORTS**: same as HeroGallery + `motion, AnimatePresence` from framer-motion.
- **PATTERN**: Mirror the InfoPanel motion shape (`InfoPanel.tsx:68-87`).
- **GOTCHA**: Always remove the keyboard listener on unmount.
- **GOTCHA**: The lightbox should NOT prevent map interactions — though since it's z-index 200+, that's automatic.
- **VALIDATE**: Click a photo in HeroGallery → lightbox opens; press `→` → next photo; click outside the image → close.

### CREATE `components/map/info/RolesCard.tsx`

- **IMPLEMENT**: A bordered card. Props: `{ jobs: Array<{ title: string; url: string }> }`. Behavior:
  - Outer container: `1px solid rgba(42,94,73,0.4)` (= `COLORS.borderAccent`), padding 16px, border-radius 4px.
  - Header label: `Open roles` (uppercase, 0.6875rem, COLORS.textMuted).
  - Each role: title + right-aligned `apply →` link, separated by a 1px `COLORS.border` divider.
  - If `jobs.length === 0`: render nothing.
- **IMPORTS**:
  ```tsx
  "use client";
  import { COLORS } from "@/lib/map/mapConfig";
  ```
- **PATTERN**: Mirror the existing badge style (`InfoPanel.tsx:52-61`) for the border treatment, and the existing `Open roles` rendering (`InfoPanel.tsx:199-233`) for the title + link shape — only the visual chrome changes.
- **VALIDATE**: Visual; render with 0/1/3 jobs; confirm graceful behavior at each.

### REWRITE `components/map/InfoPanel.tsx` — `view` mode body

- **IMPLEMENT**: Replace the `view` mode block (currently lines 162–377) with the new layout:
  1. **HeroGallery** at the top (only if `startup.photos.length > 0`); else fall back to the existing centered-logo header.
  2. **Header** (existing): name + ClaimedBadge + address.
  3. **Badges row** (existing): Stage / Employees / Section / Hiring.
  4. **Description** (existing).
  5. **Thumbnail strip** is rendered INSIDE HeroGallery — no separate block here.
  6. **RolesCard** (new) — replaces the existing inline jobs list (currently lines 199–233). Shown only when `jobs.length > 0`.
  7. **Action buttons** row: Visit website / LinkedIn / Edit / Claim — keep as today.
  8. **Back to Utah** link — keep as today.

  Add at the top of the file:
  ```tsx
  import { useState } from "react";
  import { HeroGallery } from "./info/HeroGallery";
  import { Lightbox } from "./info/Lightbox";
  import { RolesCard } from "./info/RolesCard";
  ```
  Add lightbox state inside the component:
  ```tsx
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  ```
  Pass `onOpen={(i) => setLightboxIndex(i)}` to `HeroGallery`. Render `{lightboxIndex !== null && <Lightbox photos={startup.photos ?? []} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}` near the closing tag.
- **PATTERN**: Keep the `motion.div` wrapper, mobile-vs-desktop choice, and header section intact. Only the body composition changes.
- **GOTCHA**: When `mode !== 'view'`, the lightbox MUST not render even if `lightboxIndex !== null` from a prior interaction. Reset `setLightboxIndex(null)` whenever `mode` switches away from `view`.
- **GOTCHA**: When `startup` changes (different pin selected), reset `lightboxIndex` to null in the existing slug-change effect (`InfoPanel.tsx:34-36`).
- **VALIDATE**: Click any pin with photos → hero shows, click → lightbox opens. Click a pin without photos → existing logo treatment; no broken layout.

### APPEND `ai-context/SECURITY.md`

- **IMPLEMENT**:
  ```markdown
  ### Map Photo Gallery (Feature: startup-photo-gallery)
  - The `startup-photos` bucket is **public read** but has NO `storage.objects` RLS policy granting client-side writes. All writes go through service-role API routes (`/api/startups/photos/{upload,delete,reorder}`), so users cannot upload to or delete from the bucket directly with their JWT.
  - Per-photo path scheme is `<slug>/<uuid>.<ext>`. The `<slug>` is read from the authenticated startup row, NOT the client request — a user with a valid session for startup A cannot upload into startup B's prefix because the route resolves the slug-to-row first and re-checks `claimed_by === user.id`.
  - Mime-type and size are validated route-side against `ALLOWED_PHOTO_MIME_TYPES` and `MAX_PHOTO_BYTES` in `lib/startups/photoConfig.ts`. The bucket also has matching `allowed_mime_types` and `file_size_limit` constraints (defense in depth).
  - The path supplied to `/api/startups/photos/delete` is validated to (a) appear in the current `photos[]` AND (b) start with `<slug>/`. A user cannot delete photos from another startup's prefix even if they guess paths.
  - Reorder is restricted to an **exact permutation** of the current photos[]. Adds and removes flow through their dedicated routes only.
  - Cascade delete on `/api/startups/delete` lists `<slug>/` and removes every object under that prefix BEFORE the row is deleted. Storage-removal failures are logged but do not block the row delete (we prioritize row removal so the user's "delete listing" intent always succeeds).
  - We do NOT magic-byte-check uploaded files. The browser-reported `file.type` is trusted. A motivated user could upload a renamed binary blob with a valid image mime header. Hackathon-acceptable; document for post-MVP hardening (e.g., `file-type` library or Supabase Edge Function transform).
  - Account-deletion is OUT OF SCOPE for this feature. The existing `claimed_by → auth.users(id) on delete set null` FK leaves the row + photos behind when an owner deletes their account; the next claimer inherits the photo gallery. **Post-MVP**: add a `before delete on auth.users` trigger that calls a Supabase Edge Function to enumerate owned startups and clean up.
  - Photos contain potentially sensitive marketing imagery but no PII. The public bucket is acceptable for hackathon scope. If a future feature stores team headshots or anything PII-adjacent, migrate to a private bucket + signed URLs (the route layer changes; the schema does not).
  ```
- **PATTERN**: Mirror the existing entry style at `SECURITY.md:76-84`.

### APPEND `ai-context/INEFFICIENCIES.md`

- **IMPLEMENT**:
  ```markdown
  ### Photos — Plain `<img>` instead of `next/image` (Feature: startup-photo-gallery)
  **Impact:** Low
  **Context:** The InfoPanel's HeroGallery and PhotoManager render photos via plain `<img>` tags rather than `next/image`. Reasons: the codebase already uses raw `<img>` for the existing Clearbit logo (`StartupMarker.tsx:42-52`) and avoiding `next/image` avoids the `next.config.ts` `images.domains` whitelist hassle. Trade-off: no automatic resizing, no format negotiation (WebP/AVIF), no lazy-load attribute beyond the browser default.
  **Ideal solution:** Migrate to `next/image` with `images.remotePatterns` allowing the Supabase storage hostname; the optimizer handles resizing per device + auto-format conversion.
  **Workaround in place:** None needed for hackathon scale (≤8 photos × ≤5 MB on a fast page).

  ### Photos — No upload-time downscale or thumbnail generation (Feature: startup-photo-gallery)
  **Impact:** Medium
  **Context:** A user uploading a 5 MB photo gets that exact 5 MB photo rendered as a 64×48 thumbnail in the InfoPanel strip. The browser downloads the full file even when displaying a tiny preview. At ~250 startups × 8 photos × 5 MB worst case = 10 GB of egress per fully-loaded map session.
  **Ideal solution:** Resize at upload time on the server (sharp / @vercel/og or a Supabase Edge Function transform); store both `<uuid>.jpg` and `<uuid>.thumb.jpg` and reference the thumbnail in the strip. Or use Supabase's image-transformation render endpoint (`?width=128&height=96`).
  **Workaround in place:** Deferred to post-MVP. The 5 MB cap and 8-photo limit bound the worst case.

  ### Photos — Per-photo round-trip on delete and reorder (Feature: startup-photo-gallery)
  **Impact:** Low
  **Context:** Each photo deletion requires a round-trip to `/api/startups/photos/delete`; reordering N photos is one round-trip but still touches the full row. The `EditPanel`'s `onSaved` callback reloads the entire startup, so deleting four photos in succession costs four DB reads + four storage removes + four full-row updates.
  **Ideal solution:** A bulk `DELETE` route accepting `paths: string[]`. Or: client-side optimistic update with a single `commit` route at panel close.
  **Workaround in place:** None — owner photo edits are rare enough to make the simple per-action route pattern acceptable.

  ### Photos — `req.formData()` body size capped on Vercel hobby tier (Feature: startup-photo-gallery)
  **Impact:** Low
  **Context:** Vercel's hobby/free tier caps API request body at 4.5 MB; a 5 MB photo upload fails on that tier even though our app limit is 5 MB. The route is configured with `export const runtime = "nodejs"` to avoid the edge runtime's 1 MB cap, but the platform-level cap on hobby still applies.
  **Ideal solution:** Either (a) drop the per-photo cap to 4 MB; (b) require Vercel Pro for production; (c) switch to direct browser → bucket uploads with a presigned URL flow (adds RLS complexity).
  **Workaround in place:** Document the 4.5 MB ceiling and align the per-photo limit with the deployment plan before launch.
  ```
- **PATTERN**: Mirror existing entries (`INEFFICIENCIES.md:81-110`).

---

## TESTING STRATEGY

This codebase has no automated test framework. Validation is manual end-to-end browser testing + curl smoke tests for the API routes.

### Manual end-to-end (golden path)

1. Apply the migration. Confirm the bucket and column exist.
2. `npm run dev`. Sign in as a confirmed startupOwner of an existing claimed pin.
3. Open the InfoPanel for that pin → click `Edit listing` → scroll to the new `Photos` section.
4. Upload one JPEG (≤5 MB) → thumbnail appears within ~2s.
5. Upload three more (one PNG, one WebP, one JPEG) — all four thumbnails visible.
6. Click `↑` on the third thumbnail → it swaps with second. Click `×` on the second → confirm; gone.
7. Click `Save changes` → the InfoPanel re-renders in `view` mode showing the hero photo + thumbnail strip.
8. Click the hero → lightbox opens. Press `→` → next photo. Click outside the image → close.
9. Click `Edit listing` → scroll to `Danger zone` → click `Delete listing` → confirm. Panel closes; pin disappears from the map.
10. Open Supabase Studio → confirm the row is gone AND the bucket prefix `<slug>/` is empty.

### Edge cases

- **Free-mail or non-owner attempts a photo upload via curl**: returns 403.
- **Wrong slug**: 403 (ownership check fails before any IO).
- **File too large** (>5 MB): 413; no row mutation.
- **Wrong mime** (e.g., GIF): 415.
- **9th photo**: 400 with clear message; the existing 8 untouched.
- **Reorder with one path missing**: 400; no mutation.
- **Delete a photo whose path isn't in the array**: 400; no storage call.
- **Listing has no photos**: InfoPanel falls back to the centered-logo header treatment.
- **Listing has no jobs**: RolesCard hidden; no empty bordered box.
- **Mobile (`width < 768`)**: hero photo aspect-ratio holds at 16:9; thumbnail strip scrolls horizontally; lightbox fills the viewport.
- **Lightbox on mobile**: arrow chevrons reachable; close button reachable.
- **Owner deletes a startup that already has 8 photos**: storage prefix list returns all 8, removes them in one round-trip; row delete succeeds. Re-list returns `[]`.
- **Two owner tabs racing on photo upload**: each gets a separate UUID; both succeed; the array contains both. No collision.
- **Two owner tabs racing on row delete**: first succeeds; second's `.eq('claimed_by', user.id)` matches 0 rows → 409. (Acceptable.)
- **Owner re-claims a different startup AFTER deleting their first**: their `app_metadata.role = 'startupOwner'` is preserved; the existing claim flow's `.is('claimed_by', null)` precondition handles ownership transfer. (Doesn't regress.)

---

## VALIDATION COMMANDS

Execute every command. Goal: zero regressions.

### Level 1: Syntax & Style

```bash
npm run lint
npx tsc --noEmit
```

### Level 2: Production build

```bash
npm run build
```

Catches client/server boundary violations (e.g., `lib/supabase/storage.ts` accidentally imported from a client component) and `runtime = "nodejs"` declaration errors on the upload route.

### Level 3: Dev server + manual end-to-end

```bash
npm run dev
```

Walk through the golden path above.

### Level 4: DB + bucket inspection

```sql
-- After applying migration:
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'startups' and column_name = 'photos';
-- Expect: text[] / '{}'::text[]

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'startup-photos';
-- Expect: public=true, 5242880, {image/jpeg,image/png,image/webp}

-- After a few uploads:
select slug, array_length(photos, 1) as photo_count
from startups
where photos != '{}';
```

### Level 5: Curl smoke tests

```bash
# Auth-required: upload as anonymous → 403
curl -X POST http://localhost:3000/api/startups/photos/upload \
  -F "slug=acme-corp" -F "file=@./test.jpg"

# Auth as wrong owner → 403
# Auth correctly + 9th photo → 400
# Auth correctly + valid upload → 200 + updated startup
# Delete with bogus path → 400
# Delete with correct path → 200
```

(Get the auth cookie from a browser dev-tools session.)

---

## ACCEPTANCE CRITERIA

- [ ] Migration `20260512000000_add_photos_and_bucket.sql` applies cleanly; `photos text[]` exists; `startup-photos` bucket exists with public read + 5 MB + 3 mime-types.
- [ ] Owner can upload up to 8 photos via the `Edit listing` panel; over-quota uploads are rejected with a clear inline message.
- [ ] Each upload appears in the InfoPanel hero/strip in real time (after the panel re-renders post-save).
- [ ] Owner can reorder photos via ↑/↓ controls in `PhotoManager`; the new order persists on reload.
- [ ] Owner can delete individual photos; the bucket object is removed; the array shrinks.
- [ ] Clicking the hero or any thumbnail opens a fullscreen lightbox with arrow-key navigation.
- [ ] `Open roles` renders inside an elevated bordered card; rows have apply links; empty roles array hides the card entirely.
- [ ] `Delete listing` (the existing button in the danger zone) now resolves a real route, removes all photos from the bucket, deletes the row, and closes the panel.
- [ ] Mobile bottom-sheet variant of the InfoPanel renders the gallery + roles card cleanly within `75dvh`.
- [ ] No client component imports `lib/supabase/storage.ts`.
- [ ] No regressions: voice intake, results, bubble field, base map interactions, claim flow, edit flow (sans photos), and the existing jobs editing all still work.
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes (especially the previously-broken `EditPanel onDeleted` requirement).
- [ ] `npm run build` succeeds.
- [ ] `ai-context/SECURITY.md` and `INEFFICIENCIES.md` updated.

---

## COMPLETION CHECKLIST

- [ ] Phase 1: migration + photoConfig + storage.ts + page.tsx SELECT.
- [ ] Phase 2: 4 new API routes manually smoke-tested with curl.
- [ ] Phase 3: PhotoManager wired into EditPanel; InfoPanel passes `onDeleted`.
- [ ] Phase 4: HeroGallery + Lightbox + RolesCard built; InfoPanel `view` mode rewritten; lightbox state resets on slug change and mode change.
- [ ] Phase 5: SECURITY.md + INEFFICIENCIES.md updated; manual golden path completed; mobile viewport verified.
- [ ] All validation commands executed.
- [ ] No ESLint warnings on the new files; no `as unknown` shortcuts.
- [ ] Bucket prefix is empty after a delete-listing flow on a startup that previously had photos.

---

## NOTES

**Why a public bucket?**
Photos are explicitly meant to be visible to anyone viewing the map. A private bucket adds latency (signed URL fetch per render) and complexity (refresh on expiry) for zero security benefit at hackathon scope. The route layer still gates writes via service-role; only reads are public. If we ever store PII-adjacent imagery, swap to private + signed URLs without touching the schema.

**Why no `storage.objects` write RLS policy?**
Because we don't *want* the browser to write directly. All writes go through `/api/startups/photos/*` so we get a single auth/ownership check, mime/size validation, and atomic photos-array update. Skipping the RLS policy means a forgetful future contributor *can't* enable a path we'd have to defend.

**Why store paths instead of full URLs in `photos`?**
Schema-stable across bucket migrations. If we ever rename the bucket or move to a CDN-fronted private flow, no DB migration. The render cost (`getPublicUrl` is a sync string concat) is negligible.

**Why one column instead of a separate `startup_photos` table?**
Photos belong to a startup 1:N with no metadata beyond order. A `text[]` is the simplest representation and Postgres preserves array order. If we ever add per-photo metadata (caption, alt text, dimensions, uploaded_by), promote to a sub-table.

**Why include `<seedy validation>` server-side AND in the bucket policy?**
Defense in depth. The bucket policy bounds the worst case (a future RLS slip-up still can't allow 50 MB MP4s). The route validation is the friendly UX path.

**Why lightbox instead of an off-page route?**
Same in-place context as the rest of the InfoPanel. A route would unmount the map and disrupt the orbit/3D state. The lightbox is z-index-stacked, has its own keyboard listener, and closes back to the InfoPanel cleanly.

**Why are reorder + delete + upload separate routes?**
Each represents a distinct mutation type; the round-trip cost is dwarfed by the storage IO. Combining them would force a single endpoint to multiplex multipart and JSON, adding parsing complexity for no real win.

**Why isn't account-deletion in scope?**
Photos belong to the *startup*, not the *user*. The existing `claimed_by → auth.users(id) on delete set null` already handles the user-deletion case correctly: the row stays unclaimed for the next claimer, with photos preserved. Deleting an owner doesn't have to delete their work product. Documented as a post-MVP option in SECURITY.md.

**Forward compatibility.**
Adding image transforms (Supabase render endpoint) is a one-line render change. Adding per-photo metadata (caption, alt) is a `photos jsonb` schema change with a one-time migration. Adding video support is a new mime allowlist + bucket policy change.

**Failure mode: storage delete partially fails during cascade.**
The row is still deleted (we prioritize the user's intent). Orphaned objects under `<slug>/` consume bucket quota until manually swept. Document a future cleanup script that compares `storage.objects` prefixes against `select slug from startups` and deletes orphans.

**Failure mode: user uploads, then closes the tab before the row update commits.**
The route updates the array atomically inside the same response — there is no half-commit window. Either the file is in storage AND the array, or neither (we rollback storage on DB-update error).

**Confidence Score: 8/10** for one-pass implementation. Risks:

- Vercel/Next runtime quirks around `req.formData()` body size — flagged in INEFFICIENCIES, mitigated by `runtime = "nodejs"` and a 5 MB cap aligned with bucket policy.
- Storage list semantics: `storage.from(...).list(prefix)` returns one level deep. Our path scheme is intentionally one-level so this is fine, but verify on first cascade-delete test.
- The TypeScript fix to `InfoPanel` for the missing `onDeleted` prop unblocks the build; without it the project may already be in a half-broken state. Prioritize that wire-up before the rest of the InfoPanel rewrite.
- Mobile bottom-sheet height (`maxHeight: 75dvh`) may need tuning when the gallery + jobs card both expand — verify during manual testing.
