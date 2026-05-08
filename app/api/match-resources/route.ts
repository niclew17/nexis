import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { structuredFilter } from "@/lib/matching/structuredFilter";
import { vectorSearch } from "@/lib/matching/vectorSearch";
import { synthesize } from "@/lib/matching/synthesize";
import type { UserProfile } from "@/lib/matching/structuredFilter";

export async function POST(req: Request) {
  const { sessionId, profile }: { sessionId: string; profile: UserProfile } =
    await req.json();

  if (!profile) {
    return NextResponse.json({ error: "Missing profile" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let candidates = await structuredFilter(supabase, profile);

  if (candidates.length === 0) {
    const { data: all } = await supabase.from("resources").select("id");
    candidates = all ?? [];
  }

  const candidateIds = candidates.map((c) => c.id);
  const topResources = await vectorSearch(supabase, profile, candidateIds, 15);
  const { narrative, results } = await synthesize(profile, topResources);

  if (sessionId) {
    await supabase
      .from("intake_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  return NextResponse.json({ narrative, results });
}
