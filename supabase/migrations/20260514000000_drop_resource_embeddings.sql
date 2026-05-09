-- Removes the dead pgvector embedding column from `resources`.
-- The matching pipeline migrated to a Claude-only flow in /api/match-resources;
-- the embedding column, IVFFlat index, and the two RPCs that referenced it
-- have been unreferenced from runtime code for several feature iterations.
-- The `vector` extension is intentionally left installed (cheap to keep,
-- painful to re-add if a future feature wants semantic search).

drop index if exists resources_embedding_idx;

drop function if exists match_resources(vector, integer, uuid[]);
drop function if exists score_resources_for_discovery(vector, uuid[]);

alter table resources drop column if exists embedding;
