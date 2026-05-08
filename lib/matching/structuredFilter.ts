import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserProfile {
  communities: string[];
  counties: string[];
  industry: string;
  stage: string;
  description: string;
  primaryNeed: string;
  topics: string[];
}

export async function structuredFilter(
  supabase: SupabaseClient,
  profile: UserProfile
): Promise<{ id: string }[]> {
  let query = supabase.from("resources").select("id");

  if (profile.counties.length > 0) {
    query = query.overlaps("locations", profile.counties);
  }

  if (profile.communities.length > 0) {
    query = query.overlaps("communities", profile.communities);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    // Fallback: return all resources
    const { data: all } = await supabase.from("resources").select("id");
    return all ?? [];
  }

  return data as { id: string }[];
}
