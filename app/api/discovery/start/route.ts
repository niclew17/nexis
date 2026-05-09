import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("resources")
    .select("id, title, topics, description, link")
    .order("external_id");

  if (error) {
    return NextResponse.json({ error: "Failed to load resources" }, { status: 500 });
  }

  return NextResponse.json({ resources: data ?? [] });
}
