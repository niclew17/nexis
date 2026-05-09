-- GIN index for industries array column (missing from initial migration)
create index if not exists resources_industries_idx
  on resources
  using gin (industries);
