-- Claim columns: enables a startup founder to claim/edit their listing.
-- claimed_by  → auth.users.id of the verified owner
-- claimed_at  → timestamp of the claim
-- jobs        → array of { title, url } for the founder to advertise open roles
alter table startups
  add column if not exists claimed_by uuid references auth.users(id) on delete set null;

alter table startups
  add column if not exists claimed_at timestamptz;

alter table startups
  add column if not exists jobs jsonb not null default '[]'::jsonb;

-- "What do I own" lookups when a signed-in user lands on the map.
create index if not exists startups_claimed_by_idx on startups (claimed_by);
