create or replace function score_resources_for_discovery(
  query_embedding vector(1536),
  excluded_ids    uuid[]
)
returns table (
  id          uuid,
  title       text,
  similarity  float
)
language sql stable as $$
  select
    id,
    title,
    1 - (embedding <=> query_embedding) as similarity
  from resources
  where
    cardinality(excluded_ids) = 0
    or id != all(excluded_ids)
  order by similarity desc
$$;
