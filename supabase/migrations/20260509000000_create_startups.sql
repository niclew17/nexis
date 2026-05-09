-- PostGIS for geographic queries (ST_DWithin, etc.)
create extension if not exists postgis;

create table if not exists startups (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  linkedin_url  text,
  name          text not null,
  address       text,
  lat           double precision not null,
  lng           double precision not null,
  -- Auto-populated from lat/lng by the trigger below. Stored as geography
  -- (not geometry) so distance queries work in meters without manual SRID
  -- arithmetic.
  location      geography(Point, 4326),
  description   text,
  website       text,
  domain        text,
  logo_url      text,
  stage         text,
  employees     text,
  section       text,
  year_founded  integer,
  hiring        boolean,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Sync `location` from lat/lng on every insert/update so application code
-- only needs to write the two scalars.
create or replace function startups_set_location() returns trigger as $$
begin
  new.location := ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists startups_set_location_trigger on startups;
create trigger startups_set_location_trigger
  before insert or update of lat, lng on startups
  for each row execute function startups_set_location();

-- Indexes for common query shapes:
--   - GIST on location for radius / nearest-neighbour searches
--   - btree on stage / section / employees for the voice-filter UI
create index if not exists startups_location_idx on startups using gist (location);
create index if not exists startups_stage_idx on startups (stage);
create index if not exists startups_section_idx on startups (section);
create index if not exists startups_employees_idx on startups (employees);

-- RLS: public-read static data. Writes require the service role (bypasses RLS),
-- which is what the import script uses. When a future feature lets users
-- claim/submit businesses, add a write policy keyed on auth.uid().
alter table startups enable row level security;

drop policy if exists "Public read access" on startups;
create policy "Public read access"
  on startups
  for select
  to anon, authenticated
  using (true);
