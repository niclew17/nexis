import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { geocodeAddress } from "@/lib/startups/geocode";
import { EDITABLE_STARTUP_KEYS } from "@/lib/map/types";

const STAGE_VALUES = new Set([
  "Pre-Seed",
  "Seed",
  "Series A",
  "Series B+",
  "Series D+",
  "",
]);

const EMPLOYEES_VALUES = new Set([
  "1",
  "2-10",
  "11-50",
  "51-200",
  "201-500",
  "200+",
  "",
]);

const SECTION_VALUES = new Set([
  "B2B Software",
  "FinTech",
  "Security",
  "Bio/Medical Tech",
  "Energy",
  "Consumer",
  "Marketplaces",
  "",
]);

interface JobEntry {
  title: string;
  url: string;
}

function sanitizePatch(
  raw: Record<string, unknown>
): Record<string, unknown> | { error: string } {
  const out: Record<string, unknown> = {};

  for (const key of EDITABLE_STARTUP_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];

    switch (key) {
      case "name":
      case "description":
      case "website":
      case "address":
      case "logo_url": {
        if (value === null || value === "") {
          out[key] = null;
          break;
        }
        if (typeof value !== "string") return { error: `${key} must be a string` };
        if (value.length > 2000) return { error: `${key} too long` };
        out[key] = value;
        break;
      }
      case "stage": {
        if (typeof value !== "string" || !STAGE_VALUES.has(value)) {
          return { error: "Invalid stage" };
        }
        out[key] = value;
        break;
      }
      case "employees": {
        if (typeof value !== "string" || !EMPLOYEES_VALUES.has(value)) {
          return { error: "Invalid employees" };
        }
        out[key] = value;
        break;
      }
      case "section": {
        if (typeof value !== "string" || !SECTION_VALUES.has(value)) {
          return { error: "Invalid section" };
        }
        out[key] = value;
        break;
      }
      case "hiring": {
        if (typeof value !== "boolean") return { error: "hiring must be boolean" };
        out[key] = value;
        break;
      }
      case "year_founded": {
        if (value === null) {
          out[key] = null;
          break;
        }
        if (typeof value !== "number" || !Number.isInteger(value)) {
          return { error: "year_founded must be an integer" };
        }
        if (value < 1800 || value > 2100) {
          return { error: "year_founded out of range" };
        }
        out[key] = value;
        break;
      }
      case "jobs": {
        if (!Array.isArray(value)) return { error: "jobs must be an array" };
        if (value.length > 10) return { error: "jobs capped at 10" };
        const cleaned: JobEntry[] = [];
        for (const entry of value) {
          if (!entry || typeof entry !== "object") {
            return { error: "Each job must be an object" };
          }
          const e = entry as Record<string, unknown>;
          const title = typeof e.title === "string" ? e.title.trim() : "";
          const url = typeof e.url === "string" ? e.url.trim() : "";
          if (!title || !url) continue;
          if (title.length > 80) return { error: "job title too long" };
          if (url.length > 300) return { error: "job url too long" };
          cleaned.push({ title, url });
        }
        out[key] = cleaned;
        break;
      }
    }
  }

  return out;
}

export async function POST(req: NextRequest) {
  let body: { slug?: unknown; patch?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  if (!body.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) {
    return NextResponse.json({ error: "Missing patch" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user ||
    user.is_anonymous ||
    (user.app_metadata as { role?: string } | undefined)?.role !== "startupOwner"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("[/api/startups/update] missing service role envs");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createServiceClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: existing, error: existingError } = await admin
    .from("startups")
    .select("slug, address, claimed_by")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError) {
    console.error("[/api/startups/update] lookup failed:", existingError.message);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Startup not found" }, { status: 404 });
  }
  if (existing.claimed_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sanitized = sanitizePatch(body.patch as Record<string, unknown>);
  if ("error" in sanitized) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  // Re-geocode if the address actually changed.
  if (typeof sanitized.address === "string" && sanitized.address !== existing.address) {
    const geo = await geocodeAddress(sanitized.address);
    if (!geo) {
      return NextResponse.json(
        { error: "Address could not be located" },
        { status: 422 }
      );
    }
    sanitized.lat = geo.lat;
    sanitized.lng = geo.lng;
  }

  if (Object.keys(sanitized).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await admin
    .from("startups")
    .update(sanitized)
    .eq("slug", slug)
    .eq("claimed_by", user.id)
    .select(
      "slug, linkedin_url, name, address, lat, lng, description, website, domain, logo_url, stage, employees, section, year_founded, hiring, claimed_by, claimed_at, jobs"
    )
    .single();

  if (updateError) {
    console.error("[/api/startups/update] update failed:", updateError.message);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, startup: updated });
}
