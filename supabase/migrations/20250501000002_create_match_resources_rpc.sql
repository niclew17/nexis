create or replace function match_resources(
  query_embedding vector(1536),
  match_count     int,
  candidate_ids   uuid[]
)
returns table (
  id          uuid,
  title       text,
  description text,
  topics      text[],
  link        text,
  similarity  float
)
language sql stable as $$
  select
    id,
    title,
    description,
    topics,
    link,
    1 - (embedding <=> query_embedding) as similarity
  from resources
  where id = any(candidate_ids)
  order by embedding <=> query_embedding
  limit match_count;
$$;
