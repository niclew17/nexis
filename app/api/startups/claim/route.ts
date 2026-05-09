import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  extractEmailDomain,
  matchesStartupDomain,
} from "@/lib/startups/domainCheck";

export async function POST(req: NextRequest) {
  let body: { slug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous || !user.email_confirmed_at || !user.email) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const emailDomain = extractEmailDomain(user.email);
  if (!emailDomain) {
    return NextResponse.json({ error: "Invalid email" }, { status: 401 });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("[/api/startups/claim] missing service role envs");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createServiceClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: startup, error: startupError } = await admin
    .from("startups")
    .select("slug, domain, claimed_by")
    .eq("slug", slug)
    .maybeSingle();

  if (startupError) {
    console.error("[/api/startups/claim] startup lookup failed:", startupError.message);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!startup) {
    return NextResponse.json({ error: "Startup not found" }, { status: 404 });
  }
  if (!startup.domain) {
    return NextResponse.json({ error: "Startup has no domain on file" }, { status: 400 });
  }
  if (startup.claimed_by) {
    return NextResponse.json({ error: "Startup already claimed" }, { status: 409 });
  }
  if (!matchesStartupDomain(emailDomain, startup.domain)) {
    return NextResponse.json(
      { error: "Email domain does not match startup domain" },
      { status: 403 }
    );
  }

  const existingMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const { error: roleError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...existingMetadata, role: "startupOwner" },
  });
  if (roleError) {
    console.error("[/api/startups/claim] role assignment failed:", roleError.message);
    return NextResponse.json({ error: "Could not assign role" }, { status: 500 });
  }

  const claimedAt = new Date().toISOString();
  // .is('claimed_by', null) is the race-loss precondition: if another tab/session
  // claimed the row between our read and this write, the update affects 0 rows
  // and we return 409 instead of silently overwriting their claim.
  const { data: updated, error: updateError } = await admin
    .from("startups")
    .update({ claimed_by: user.id, claimed_at: claimedAt })
    .eq("slug", slug)
    .is("claimed_by", null)
    .select("slug, claimed_by, claimed_at");

  if (updateError) {
    console.error("[/api/startups/claim] claim write failed:", updateError.message);
    return NextResponse.json({ error: "Claim write failed" }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "Startup was claimed by someone else just now" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    startup: {
      slug,
      claimed_by: user.id,
      claimed_at: claimedAt,
    },
  });
}
