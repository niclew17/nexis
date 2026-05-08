import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { UserProfile } from "./structuredFilter";

export interface ResourceResult {
  id: string;
  title: string;
  description: string;
  topics: string[];
  link: string;
  similarity?: number;
}

export async function vectorSearch(
  supabase: SupabaseClient,
  profile: UserProfile,
  candidateIds: string[],
  topK: number = 15
): Promise<ResourceResult[]> {
  const profileString = [
    profile.description,
    profile.communities.length > 0 ? `Communities: ${profile.communities.join(", ")}` : "",
    profile.counties.length > 0 ? `Location: ${profile.counties.join(", ")}` : "",
    `Stage: ${profile.stage}`,
    `Primary need: ${profile.primaryNeed}`,
    profile.topics.length > 0 ? `Topics: ${profile.topics.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: profileString,
  });
  const embedding = resp.data[0].embedding;

  const { data, error } = await supabase.rpc("match_resources", {
    query_embedding: embedding,
    match_count: topK,
    candidate_ids: candidateIds,
  });

  if (error) {
    console.error("vectorSearch RPC error:", error);
    return [];
  }

  return (data ?? []) as ResourceResult[];
}
