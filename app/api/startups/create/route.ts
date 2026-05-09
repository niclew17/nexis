import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  createClient as createServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  extractEmailDomain,
  matchesStartupDomain,
} from "@/lib/startups/domainCheck";
import { isFreeMailDomain } from "@/lib/startups/freeMailDomains";
import {
  normalizeDomain,
  normalizeLinkedInUrl,
  getLinkedInSlug,
  slugifyName,
} from "@/lib/startups/normalize";
import { geocodeAddress } from "@/lib/startups/geocode";
import {
  STAGE_VALUES,
  EMPLOYEES_VALUES,
  SECTION_VALUES,
} from "@/lib/map/types";

interface CreateBody {
  name?: unknown;
  website?: unknown;
  linkedin_url?: unknown;
  address?: unknown;
  description?: unknown;
  stage?: unknown;
  employees?: unknown;
  section?: unknown;
  year_founded?: unknown;
  hiring?: unknown;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

// Validates each required string field is present and non-empty. Returns the
// trimmed value or a NextResponse error if validation fails.
function requireString(
  value: unknown,
  field: string,
  maxLen: number
): string | NextResponse {
  if (typeof value !== "string") {
    return badRequest(`${field} is required`);
  }
  const trimmed = value.trim();
  if (!trimmed) return badRequest(`${field} is required`);
  if (trimmed.length > maxLen) return badRequest(`${field} too long`);
  return trimmed;
}

// Resolve a non-colliding slug by appending numeric suffixes. Bounded retry
// so a pathological collision pattern can't loop indefinitely.
async function pickUniqueSlug(
  admin: SupabaseClient,
  base: string
): Promise<string | null> {
  let candidate = base;
  let suffix = 1;
  for (let i = 0; i < 50; i++) {
    const { data, error } = await admin
      .from("startups")
      .select("slug")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) {
      console.error("[/api/startups/create] slug lookup failed:", error.message);
      return null;
    }
    if (!data) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const name = requireString(body.name, "name", 200);
  if (name instanceof NextResponse) return name;
  const website = requireString(body.website, "website", 500);
  if (website instanceof NextResponse) return website;
  const linkedinUrlRaw = requireString(body.linkedin_url, "linkedin_url", 500);
  if (linkedinUrlRaw instanceof NextResponse) return linkedinUrlRaw;
  const address = requireString(body.address, "address", 500);
  if (address instanceof NextResponse) return address;
  const description = requireString(body.description, "description", 2000);
  if (description instanceof NextResponse) return description;

  const stage = typeof body.stage === "string" ? body.stage : "";
  if (!stage || !STAGE_VALUES.has(stage)) {
    return badRequest("Invalid stage");
  }
  const employees = typeof body.employees === "string" ? body.employees : "";
  if (!employees || !EMPLOYEES_VALUES.has(employees)) {
    return badRequest("Invalid employees");
  }
  const section = typeof body.section === "string" ? body.section : "";
  if (!section || !SECTION_VALUES.has(section)) {
    return badRequest("Invalid section");
  }

  let yearFounded: number | null = null;
  if (body.year_founded !== undefined && body.year_founded !== null) {
    if (
      typeof body.year_founded !== "number" ||
      !Number.isInteger(body.year_founded) ||
      body.year_founded < 1800 ||
      body.year_founded > 2100
    ) {
      return badRequest("year_founded must be an integer between 1800 and 2100");
    }
    yearFounded = body.year_founded;
  }

  let hiring: boolean | null = null;
  if (body.hiring !== undefined && body.hiring !== null) {
    if (typeof body.hiring !== "boolean") {
      return badRequest("hiring must be a boolean");
    }
    hiring = body.hiring;
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

  if (isFreeMailDomain(emailDomain)) {
    return NextResponse.json(
      { error: "Use a company email — free providers are not allowed." },
      { status: 403 }
    );
  }

  const websiteDomain = normalizeDomain(website);
  if (!websiteDomain) {
    return badRequest("Invalid website URL");
  }
  if (!matchesStartupDomain(emailDomain, websiteDomain)) {
    return NextResponse.json(
      {
        error: `Email domain (${emailDomain}) must match the website domain (${websiteDomain}).`,
      },
      { status: 403 }
    );
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("[/api/startups/create] missing service role envs");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createServiceClient(SUPABASE_URL, SERVICE_ROLE);

  // Duplicate-domain short-circuit. The `domain` column has no DB-level
  // unique constraint (the imported dataset has legitimate duplicates), so
  // this application-level check is the only line of defense. Returning
  // `existingSlug` lets the client redirect into the existing pin's claim
  // flow instead of forcing the user to start over.
  const { data: existingByDomain, error: dupErr } = await admin
    .from("startups")
    .select("slug, name")
    .eq("domain", websiteDomain)
    .limit(1)
    .maybeSingle();
  if (dupErr) {
    console.error("[/api/startups/create] dup lookup failed:", dupErr.message);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (existingByDomain) {
    return NextResponse.json(
      {
        error: "A startup at that domain already exists",
        existingSlug: existingByDomain.slug,
        existingName: existingByDomain.name,
      },
      { status: 409 }
    );
  }

  const geo = await geocodeAddress(address);
  if (!geo) {
    return NextResponse.json(
      { error: "Address could not be located" },
      { status: 422 }
    );
  }

  const linkedinUrl = normalizeLinkedInUrl(linkedinUrlRaw);
  const slugBase = getLinkedInSlug(linkedinUrl) || slugifyName(name);
  if (!slugBase) {
    return badRequest("Could not derive a slug from LinkedIn URL or company name");
  }
  const slug = await pickUniqueSlug(admin, slugBase);
  if (!slug) {
    return NextResponse.json(
      { error: "Could not generate a unique slug" },
      { status: 500 }
    );
  }

  const insertPayload = {
    slug,
    name,
    linkedin_url: linkedinUrl,
    website,
    domain: websiteDomain,
    logo_url: `https://logo.clearbit.com/${websiteDomain}`,
    address,
    lat: geo.lat,
    lng: geo.lng,
    description,
    stage,
    employees,
    section,
    year_founded: yearFounded,
    hiring,
    claimed_by: user.id,
    claimed_at: new Date().toISOString(),
    jobs: [],
  };

  const { data: inserted, error: insertErr } = await admin
    .from("startups")
    .insert(insertPayload)
    .select("slug")
    .single();

  if (insertErr) {
    console.error("[/api/startups/create] insert failed:", insertErr.message);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  // Set startupOwner role so the user can immediately use /api/startups/update
  // on their new row without an extra claim round-trip. Service-role only —
  // app_metadata is not writable by the user.
  const existingMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const { error: roleErr } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...existingMetadata, role: "startupOwner" },
  });
  if (roleErr) {
    // Insert already succeeded; surface the role-set failure but don't try to
    // roll back. The user can still see the pin; they'd just have to claim it
    // explicitly to edit. Logging is enough for hackathon scope.
    console.error(
      "[/api/startups/create] role assignment failed (insert succeeded):",
      roleErr.message
    );
  }

  return NextResponse.json({ ok: true, slug: inserted.slug });
}
