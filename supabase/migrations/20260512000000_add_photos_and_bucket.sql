-- Photos column on startups: ordered list of object paths in the
-- startup-photos bucket. The path scheme is "<slug>/<uuid>.<ext>" so the
-- whole prefix can be enumerated and purged on row delete.
alter table startups
  add column if not exists photos text[] not null default '{}'::text[];

-- Public bucket: read-anywhere, write-only-via-service-role. We do NOT add a
-- storage.objects write policy for authenticated users — every write flows
-- through /api/startups/photos/* using the service-role client. Public read
-- works automatically when the bucket is public.
--
-- Bucket-level constraints (file_size_limit, allowed_mime_types) duplicate
-- the route-level checks in lib/startups/photoConfig.ts as defense in depth.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'startup-photos',
  'startup-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
