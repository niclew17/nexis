-- Run this in the Supabase SQL editor before running the import script

-- Enable pgvector extension
create extension if not exists vector;

-- Resources table
create table if not exists resources (
  id            uuid primary key default gen_random_uuid(),
  external_id   integer unique not null,
  title         text not null,
  description   text,
  communities   text[] default '{}',
  industries    text[] default '{}',
  locations     text[] default '{}',
  topics        text[] default '{}',
  link          text,
  email         text,
  embedding     vector(1536),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Index for fast cosine similarity search
create index if not exists resources_embedding_idx
  on resources
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- Index for fast array filtering
create index if not exists resources_locations_idx on resources using gin (locations);
create index if not exists resources_communities_idx on resources using gin (communities);
create index if not exists resources_topics_idx on resources using gin (topics);
