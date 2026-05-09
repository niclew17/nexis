-- Canonical Utah county for each startup, derived from lat/lng via
-- point-in-polygon at insert/backfill time. Used as a filter dimension on
-- the map. Nullable for legacy rows that haven't been backfilled or for
-- coordinates outside the Utah polygon (e.g., a stray remote-only HQ).
alter table startups
  add column if not exists county text;

create index if not exists startups_county_idx on startups (county);
