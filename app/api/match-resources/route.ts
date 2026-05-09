import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rankResources } from "@/lib/matching/rankResources";
import { draftEmails, type FounderInfo } from "@/lib/matching/draftEmails";

export async function POST(req: Request) {
  const { sessionId, filterIds, freeFormAnswer, founderInfo, allAnswers } = await req.json() as {
    sessionId: string | null;
    filterIds: string[];
    freeFormAnswer: string;
    founderInfo?: FounderInfo | null;
    allAnswers: Array<{ questionIndex: number; extractedAnswer: string }>;
  };

  if (!freeFormAnswer || !filterIds?.length) {
    return NextResponse.json({ error: "Missing filterIds or freeFormAnswer" }, { status: 400 });
  }

  // Truncate founder fields to 100 chars before injecting into Claude prompt — defense
  // against prompt injection via a crafted business name.
  const safeFounderInfo: FounderInfo | null = founderInfo
    ? {
        name: (founderInfo.name ?? "").slice(0, 100),
        businessName: (founderInfo.businessName ?? "").slice(0, 100),
        role: (founderInfo.role ?? "").slice(0, 100),
      }
    : null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (filterIds.length > 150) {
    console.warn(`[match-resources] filterIds.length=${filterIds.length} — large pool, may approach PostgREST URL limit`);
  }

  const { data: resources, error: fetchError } = await supabase
    .from("resources")
    .select("id, title, description, topics, link, email")
    .in("id", filterIds);

  if (fetchError || !resources?.length) {
    return NextResponse.json({ error: "Failed to load resources" }, { status: 500 });
  }

  // Call 1: rank the filtered pool by Q5 relevance
  const { narrative, matches } = await rankResources(resources, freeFormAnswer);

  // Call 2: draft personalized emails for the top 3
  const results = await draftEmails(matches, allAnswers ?? [], freeFormAnswer, safeFounderInfo);

  if (sessionId) {
    await supabase
      .from("intake_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  return NextResponse.json({ narrative, results });
}
