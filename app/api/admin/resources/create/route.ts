import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminToken } from "@/lib/admin/token";
import {
  KNOWN_TOPICS,
  KNOWN_INDUSTRIES,
  KNOWN_LOCATIONS,
  KNOWN_COMMUNITIES,
} from "@/lib/intake/filterConstants";

interface CreateBody {
  token?: unknown;
  title?: unknown;
  description?: unknown;
  link?: unknown;
  email?: unknown;
  communities?: unknown;
  industries?: unknown;
  locations?: unknown;
  topics?: unknown;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function requireString(
  value: unknown,
  field: string,
  maxLen: number
): string | NextResponse {
  if (typeof value !== "string") return badRequest(`${field} is required`);
  const trimmed = value.trim();
  if (!trimmed) return badRequest(`${field} is required`);
  if (trimmed.length > maxLen) return badRequest(`${field} too long`);
  return trimmed;
}

function validateEnumArray(
  value: unknown,
  allowed: readonly string[],
  field: string
): string[] | NextResponse {
  if (!Array.isArray(value)) return badRequest(`${field} must be an array`);
  const set = new Set<string>();
  for (const v of value) {
    if (typeof v !== "string") return badRequest(`${field} entries must be strings`);
    if (!allowed.includes(v)) return badRequest(`${field} contains unknown value: ${v}`);
    set.add(v);
  }
  return Array.from(set);
}

export async function POST(req: NextRequest) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!verifyAdminToken(body.token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const title = requireString(body.title, "title", 200);
  if (title instanceof NextResponse) return title;

  const description = requireString(body.description, "description", 4000);
  if (description instanceof NextResponse) return description;

  let link: string | null = null;
  if (body.link !== undefined && body.link !== null && body.link !== "") {
    const checked = requireString(body.link, "link", 500);
    if (checked instanceof NextResponse) return checked;
    let parsedLink: URL;
    try {
      parsedLink = new URL(checked);
    } catch {
      return badRequest("link must be a valid URL");
    }
    if (parsedLink.protocol !== "https:" && parsedLink.protocol !== "http:") {
      return badRequest("link must be http(s)");
    }
    link = checked;
  }

  let email: string | null = null;
  if (body.email !== undefined && body.email !== null && body.email !== "") {
    const checked = requireString(body.email, "email", 200);
    if (checked instanceof NextResponse) return checked;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checked)) {
      return badRequest("email is malformed");
    }
    email = checked;
  }

  const communities = validateEnumArray(body.communities, KNOWN_COMMUNITIES, "communities");
  if (communities instanceof NextResponse) return communities;
  const industries = validateEnumArray(body.industries, KNOWN_INDUSTRIES, "industries");
  if (industries instanceof NextResponse) return industries;
  const locations = validateEnumArray(body.locations, KNOWN_LOCATIONS, "locations");
  if (locations instanceof NextResponse) return locations;
  const topics = validateEnumArray(body.topics, KNOWN_TOPICS, "topics");
  if (topics instanceof NextResponse) return topics;

  if (topics.length === 0) return badRequest("at least one topic is required");

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("[/api/admin/resources/create] missing service role envs");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Auto-assign external_id = max + 1. Concurrent inserts can race; the unique
  // constraint catches the second writer (Postgres 23505 → 500). Manual retry
  // resolves at hackathon scale.
  const { data: maxRow, error: maxErr } = await admin
    .from("resources")
    .select("external_id")
    .order("external_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) {
    console.error(
      "[/api/admin/resources/create] max external_id lookup failed:",
      maxErr.message
    );
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  const nextExternalId = (maxRow?.external_id ?? 0) + 1;

  const { data: inserted, error: insertErr } = await admin
    .from("resources")
    .insert({
      external_id: nextExternalId,
      title,
      description,
      communities,
      industries,
      locations,
      topics,
      link,
      email,
    })
    .select("id, external_id")
    .single();

  if (insertErr) {
    console.error("[/api/admin/resources/create] insert failed:", insertErr.message);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    external_id: inserted.external_id,
  });
}
