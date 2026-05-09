# Feature: Secret-Link Resource Admin Page

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files etc.

## Feature Description

A token-gated admin page (`/admin/resources/[token]`) that lets a non-developer add new rows to the `resources` table from a single form. The page is reachable only by knowing the URL — no Supabase login, no role check, no UI exposure on the public site. The form uses **enum-only multi-selects** for `communities`, `industries`, `locations`, and `topics` (sourced from the existing `lib/intake/filterConstants.ts`) so newly added resources are guaranteed to be matchable by the four-question intake. `external_id` auto-increments server-side so admins never see it. On submit, the row is inserted via the service-role client.

This feature also removes the **dead `embedding` column** and its surrounding artifacts. The matching pipeline migrated to a Claude-only flow (see `app/api/match-resources/route.ts` + `lib/matching/rankResources.ts`); the `vector(1536)` column, the `resources_embedding_idx`, both pgvector RPCs (`match_resources_by_vector`, `score_resources_for_discovery`), the `openai` npm package, and `OPENAI_API_KEY` are no longer referenced from any runtime code path. Removing them shrinks the schema, cuts one external API key from the surface area, and makes the new admin form a 1:1 mirror of the live columns.

## User Story

As a Nexis program administrator
I want to open a secret URL and submit a form that adds a new Utah state resource to the live database
So that the resource catalog can grow past the seeded 213 entries without me touching code, the CSV import script, or Supabase Studio.

## Problem Statement

Right now there are exactly two ways to add a resource:
1. Edit `data/resources.csv` and re-run `scripts/import-resources.ts` (developer + local env required).
2. Insert a row via Supabase Studio (requires Studio access, manual array formatting, and remembering to set `external_id`).

Both paths are gated on technical access. The PRD explicitly calls out non-developer updatability as a core principle, and the Map already has a `/map/new` self-serve flow for startups. There is no equivalent path for resources — and the matching pipeline can't recommend a resource that isn't in the table.

The admin form must:
- Be unreachable without a secret URL token (no public discoverability)
- Cover every column the live matching pipeline reads (`title`, `description`, `communities`, `industries`, `locations`, `topics`, `link`, `email`)
- Constrain the array fields to **known enum values** so new rows participate in Q1–Q4 filtering immediately
- Auto-assign `external_id` so the admin never has to think about it

## Solution Statement

1. **Schema cleanup migration** (`20260514000000_drop_resource_embeddings.sql`): drop the `embedding` column, the IVFFlat index, and the two pgvector RPCs. Leave the `vector` extension installed (cheap to keep, expensive to re-add if some future feature wants it).
2. **Page**: `app/admin/resources/[token]/page.tsx` — server component that compares `params.token` against `process.env.RESOURCE_ADMIN_TOKEN` with `crypto.timingSafeEqual`; returns `notFound()` on mismatch. On success, renders a client component with the form.
3. **Form**: `components/admin/AddResourceForm.tsx` — text inputs for `title`, `description`, `link`, `email`; checkbox grids for the four enum arrays sourced from `lib/intake/filterConstants.ts`. Mirrors the visual language of `components/map/create/CreateDetailsStep.tsx` (same `COLORS`, same `Field` helper, same submit button hover behavior).
4. **API route**: `app/api/admin/resources/create/route.ts` — re-checks the same token from the request body (server-side enforcement, so a leaked client bundle can't bypass), validates the payload (whitelist arrays against the same enum constants, length-cap strings, reject malformed URLs/emails), computes `external_id = MAX(external_id) + 1`, and inserts via the service-role client.
5. **Code cleanup**: delete the `openai` import + `OPENAI_API_KEY` usage from `scripts/import-resources.ts`, drop the `openai` npm dep, remove `OPENAI_API_KEY` from `.env.example`, prune the `embedding` line from the row payload.

The token lives in `.env.local` only. Anybody who has the URL has full insert access — exactly the trust model the user asked for, mirroring the cron-style "secret URL" pattern.

## Feature Metadata

**Feature Type**: New Capability + Dead-Code Cleanup
**Estimated Complexity**: Low–Medium (the form is straightforward; the dead-code removal touches multiple files)
**Primary Systems Affected**:
- New: `app/admin/resources/[token]/`, `app/api/admin/resources/create/`, `components/admin/`, one new SQL migration
- Modified: `scripts/import-resources.ts`, `package.json`, `.env.example`, `ai-context/CLAUDE.md` (Tech Stack table + schema), `ai-context/PRD.md` (drop "embedding" mentions in Section 6, 7, 8, 15)
**Dependencies**: None new. Removes `openai` (already a dep, only used by the import script).

---

## CONTEXT REFERENCES

### Relevant Codebase Files — IMPORTANT: YOU MUST READ THESE BEFORE IMPLEMENTING

- `app/api/startups/create/route.ts` (entire file, ~277 lines) — Why: canonical example of this codebase's API route pattern. Mirror the `requireString` helper, the `badRequest` helper, the service-role client construction, and the `createServerClient as createServerClient` / `createClient as createServiceClient` import aliasing.
- `components/map/create/CreateDetailsStep.tsx` (entire file, ~415 lines) — Why: copy the visual language. Reuse the `Field` helper, `inputStyle`, `selectStyle`, the submit-button hover swap, the `COLORS` import. The new form is a longer-but-shaped-the-same version of this one.
- `components/map/create/CreateLayout.tsx` (lines 1–66) — Why: the page chrome (centered black surface + Nexis wordmark in the header). Reuse verbatim or near-verbatim.
- `lib/intake/filterConstants.ts` (lines 1–48) — Why: the four enum arrays that the form's checkbox grids must use. **Do not duplicate these constants** — import them.
- `lib/map/mapConfig.ts` (lines 42–54) — Why: the `COLORS` object the form must use for visual consistency.
- `app/api/match-resources/route.ts` (entire file, ~62 lines) — Why: confirms `embedding` is not selected anywhere in the live pipeline. The route only reads `id, title, description, topics, link, email` — exactly the columns the admin form populates (plus the four arrays for the upstream filter step).
- `app/api/process-answer/route.ts` (read for context, file unchanged by this feature) — Why: shows the deterministic SQL filter on `topics`/`industries`/`locations`/`communities`. Confirms why the form must constrain those four fields to known enums — a typo'd "Salk Lake" never matches.
- `scripts/import-resources.ts` (entire file, ~88 lines) — Why: this file is being modified. Understand the existing structure before you delete the OpenAI portions.
- `supabase/migrations/20250501000000_create_resources.sql` (entire file, 30 lines) — Why: the table being modified. The drop migration must reverse exactly what this file added (the `embedding` column at line 16, the index at lines 22–25).
- `supabase/migrations/20250501000002_create_match_resources_rpc.sql` (entire file, ~25 lines) — Why: confirms the RPC signature being dropped. Read it to write a matching `drop function` clause.
- `supabase/migrations/20250501000003_create_discovery_rpc.sql` (entire file) — Why: same as above for the second RPC.
- `supabase/migrations/20260513000000_add_county_column.sql` — Why: the most recent migration. Mirror its file-naming convention (`YYYYMMDDHHMMSS_<verb>_<thing>.sql`) for the new migration.
- `lib/supabase/server.ts` (lines 1–34) — Why: the `createClient` server pattern. The new page imports from here; the API route uses the service-role pattern from `app/api/match-resources/route.ts:29–32`.
- `app/auth/login/page.tsx` (skim) — Why: confirms there is no existing pattern for token-gated server components. You are establishing the pattern.

### New Files to Create

- `supabase/migrations/20260514000000_drop_resource_embeddings.sql` — Drop `embedding` column, drop IVFFlat index, drop `match_resources_by_vector` and `score_resources_for_discovery` RPCs.
- `app/admin/resources/[token]/page.tsx` — Server component. Token compare → render form or `notFound()`.
- `app/admin/resources/[token]/AddResourceClient.tsx` — Client component wrapper that holds `<AddResourceForm>` and the success state. (Server-component pages can't hold `useState`.)
- `components/admin/AddResourceForm.tsx` — The form itself.
- `app/api/admin/resources/create/route.ts` — POST handler. Token check (constant-time), payload validation, `external_id` auto-assign, insert via service role.
- `lib/admin/token.ts` — Tiny helper that exports `verifyAdminToken(provided: string): boolean` using `crypto.timingSafeEqual`. Both the page and the API route call this.

### Files to Modify

- `scripts/import-resources.ts` — Remove `openai` import (line 6), remove `openai` constant (line 13), remove the `embeddingInputs` builder + `openai.embeddings.create` call + sort step (lines 37–52), remove the `embedding: embeddings[i]` line in the row payload (line 64). Update the success log line to drop "with embeddings".
- `package.json` — Remove `"openai": "^6.37.0"` from dependencies.
- `.env.example` — Remove the `OPENAI_API_KEY=xxxxx` line. Add `RESOURCE_ADMIN_TOKEN=xxxxx` line with a comment indicating it should be a long random string and is server-only.
- `ai-context/CLAUDE.md` — In the **Tech Stack** table, remove the "Embeddings" and "Vector search" rows. In the **Environment Variables** block remove the `OPENAI_API_KEY` line; add `RESOURCE_ADMIN_TOKEN`. In the **Database Schema** block, remove the `embedding vector(1536)` line from the `resources` table. In the **Three-Layer Matching Pipeline** section, **rewrite** to two layers (structured filter + Claude synthesis) and explicitly note the embedding layer was removed. Add an **Admin Tools** subsection at the bottom describing `/admin/resources/[token]`.
- `ai-context/INEFFICIENCIES.md` — Add a new entry: **Discovery — IVFFLAT index over-parameterized for 213 rows** is now resolved (the column is gone). Add the resolution under the existing entry rather than deleting; cite this feature.
- `ai-context/SECURITY.md` — Add a new section **Admin Resource Page (Feature: secret-link-resource-admin)** with the specific notes listed under the Security Considerations heading below.
- `app/page.tsx` — **Do nothing.** The admin page is intentionally absent from the landing surface. Do not add a link.

### Relevant Documentation — YOU SHOULD READ THESE BEFORE IMPLEMENTING

- [Next.js App Router — Dynamic Routes (`[param]`)](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
  - Specific section: "Dynamic Segments"
  - Why: The page lives at `app/admin/resources/[token]/page.tsx`. In Next.js 15, `params` is a `Promise` in async server components — `const { token } = await params`.
- [Next.js — `notFound()` in Route Handlers and Pages](https://nextjs.org/docs/app/api-reference/functions/not-found)
  - Why: Token mismatch should return a real 404 (not a JSON error). Use `import { notFound } from "next/navigation"` and call it before rendering.
- [Node.js `crypto.timingSafeEqual`](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
  - Why: Constant-time string compare for token verification. Naive `===` leaks length and per-byte timing under load. Both buffers must be the same length, so pad/truncate both inputs to a fixed length first (or compare lengths separately and return false when they differ — not constant-time on length, but length is not the secret here).
- [Supabase JS — `.in()` and array operators](https://supabase.com/docs/reference/javascript/in)
  - Why: confirms `.in("id", arr)` parameterizes UUIDs — relevant for understanding the whitelist validation pattern, not directly used in the new POST.
- [Supabase migrations CLI](https://supabase.com/docs/reference/cli/supabase-migration)
  - Why: confirms migration file naming convention. Match the existing pattern.
- [pgvector — `drop extension` semantics](https://github.com/pgvector/pgvector#installation)
  - Why: confirms the `vector(1536)` column type belongs to the extension. Drop the column **before** considering whether to drop the extension. We are intentionally **not** dropping the extension (cheap to keep installed, painful to re-enable).

### Patterns to Follow

**Naming Conventions:**
- Files: `kebab-case.ts` for libs and routes, `PascalCase.tsx` for components. Match directory casing of nearest sibling (`components/admin/AddResourceForm.tsx` mirrors `components/map/create/CreateDetailsStep.tsx`).
- API routes: action-oriented under feature dir — `app/api/admin/resources/create/route.ts` mirrors `app/api/startups/create/route.ts`.
- Constants: `SCREAMING_SNAKE_CASE`. Enum value arrays already use this (`KNOWN_TOPICS`, `KNOWN_INDUSTRIES`).

**Error Handling (from `app/api/startups/create/route.ts`):**
```ts
function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function requireString(value: unknown, field: string, maxLen: number): string | NextResponse {
  if (typeof value !== "string") return badRequest(`${field} is required`);
  const trimmed = value.trim();
  if (!trimmed) return badRequest(`${field} is required`);
  if (trimmed.length > maxLen) return badRequest(`${field} too long`);
  return trimmed;
}
```
Use this exact helper shape (copy or import; do not invent a new validation system).

**Service-Role Client (from `app/api/match-resources/route.ts:29–32`):**
```ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```
Bare `createClient` from `@supabase/supabase-js` for service-role; cookie-based `createClient` from `@/lib/supabase/server` only when you need the user's session (not needed here — admin token is the auth).

**Logging Pattern (codebase-wide):**
```ts
console.error("[/api/admin/resources/create] insert failed:", error.message);
```
Square-bracket route prefix, then a verb describing what failed. Don't log full payloads (PII surface).

**Form Pattern (from `components/map/create/CreateDetailsStep.tsx:366–397`):**
```tsx
function Field({ label, htmlFor, children, required, hint, hintIsError }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label htmlFor={htmlFor} style={{ ...labelStyle }}>
        {label}{required ? "" : "  (optional)"}
      </label>
      {children}
      {hint && <p style={{ color: hintIsError ? "#ef4444" : COLORS.textDim }}>{hint}</p>}
    </div>
  );
}
```
Reuse this Field component verbatim (extract to `components/admin/Field.tsx` only if you find yourself copying it more than once across this feature; for now, inline it).

**Multi-select checkbox pattern (new — does not exist in codebase yet):**
```tsx
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
  {KNOWN_TOPICS.map((value) => (
    <label key={value} style={checkboxRowStyle}>
      <input
        type="checkbox"
        checked={topics.includes(value)}
        onChange={(e) => {
          setTopics((prev) =>
            e.target.checked ? [...prev, value] : prev.filter((v) => v !== value)
          );
        }}
        style={{ accentColor: COLORS.accent }}
      />
      <span>{value}</span>
    </label>
  ))}
</div>
```

**Other Relevant Patterns:**
- Inline-style JSX dominates this codebase. Do **not** introduce Tailwind classes on the new page/form. Match the inline `React.CSSProperties` approach from `CreateDetailsStep.tsx`.
- Server-component pages await `cookies()` and `params` (Next 15). Mirror `app/map/page.tsx:5–22` for the async server-component shape.
- Use `Suspense` boundary around DB-touching server components (`app/map/page.tsx:43–49`). The admin page does no DB read on the server, so Suspense is **not needed** here.
- Anonymous-auth flow is irrelevant — the admin token replaces it. Do not call `useAnonymousAuth`.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation (Schema cleanup + token helper)

Bring the database and supporting helpers in line with reality before building the form on top.

**Tasks:**
- Write the drop migration that removes `embedding` column, IVFFlat index, and the two pgvector RPCs.
- Run the migration locally and against the linked Supabase project.
- Create `lib/admin/token.ts` with `verifyAdminToken()` using `crypto.timingSafeEqual`.
- Add `RESOURCE_ADMIN_TOKEN` to `.env.example` and `.env.local`.

### Phase 2: Core Implementation (Form + API route)

Build the user-facing surface and the server-side mutation it calls.

**Tasks:**
- Implement `app/api/admin/resources/create/route.ts` (token check → validate → external_id assign → insert).
- Implement `components/admin/AddResourceForm.tsx` (controlled form, calls the API route).
- Implement `app/admin/resources/[token]/page.tsx` (server component, token check, renders client component).
- Implement `app/admin/resources/[token]/AddResourceClient.tsx` (client wrapper handling success / error / reset).

### Phase 3: Cleanup (Remove dead embedding artifacts)

The schema is gone; now remove the now-orphaned application code.

**Tasks:**
- Strip OpenAI calls from `scripts/import-resources.ts`.
- Remove `openai` from `package.json`; run `npm install` to update lockfile.
- Remove `OPENAI_API_KEY` from `.env.example`.
- Update `ai-context/CLAUDE.md` (Tech Stack, Environment Variables, Database Schema, Matching Pipeline).
- Update `ai-context/INEFFICIENCIES.md` (mark IVFFLAT entry resolved).
- Add new entry to `ai-context/SECURITY.md`.

### Phase 4: Validation

End-to-end smoke test of the full flow plus regression checks on the live pipeline.

**Tasks:**
- `npm run build` — confirms type-check + bundle.
- `npm run lint` — zero warnings.
- Manual: hit `/admin/resources/wrong-token` → expect 404.
- Manual: hit `/admin/resources/<correct-token>` → form renders.
- Manual: submit a complete row → success state, then verify in Supabase Studio.
- Manual: re-run the voice intake against the new resource (use a profile that matches its enum tags) → confirm it appears in candidate pool.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### 1. CREATE `supabase/migrations/20260514000000_drop_resource_embeddings.sql`

- **IMPLEMENT**: Drop the IVFFlat index, then the two pgvector RPCs, then the `embedding` column. Idempotent (`drop ... if exists`). Do **not** drop the `vector` extension.
- **PATTERN**: Mirror migration shape of `supabase/migrations/20260513000000_add_county_column.sql` — short, commented, `if exists` guards.
- **CONTENT**:
  ```sql
  -- Removes the dead pgvector embedding column from `resources`.
  -- The matching pipeline migrated to a Claude-only flow in /api/match-resources;
  -- the embedding column, IVFFlat index, and the two RPCs that referenced it
  -- have been unreferenced from runtime code for several feature iterations.
  -- The `vector` extension is intentionally left installed (cheap to keep,
  -- painful to re-add if a future feature wants semantic search).

  drop index if exists resources_embedding_idx;

  drop function if exists match_resources_by_vector(vector, integer, double precision);
  drop function if exists score_resources_for_discovery(vector, uuid[], integer);

  alter table resources drop column if exists embedding;
  ```
- **GOTCHA**: The function signature in the `drop function` clause must exactly match the original. Read `20250501000002_create_match_resources_rpc.sql` and `20250501000003_create_discovery_rpc.sql` first and copy the parameter types verbatim. If the signature in those files differs from the example above, **use what's in those files**.
- **VALIDATE**: `psql $DATABASE_URL -c "\d resources" | grep -c embedding` returns `0`. (Substitute equivalent Supabase Studio check if no `psql` access.)

### 2. APPLY the migration

- **IMPLEMENT**: Use the project's migration runner (`supabase db push` or whatever the existing workflow is — check `supabase/.temp/` and the existing migration filenames for clues; the project has 7 prior migrations applied this way).
- **GOTCHA**: This is a destructive change against the live DB. Confirm with the user before running against production.
- **VALIDATE**: `select count(*) from resources;` still returns 213 (or current row count). The column is gone but the data is intact.

### 3. CREATE `lib/admin/token.ts`

- **IMPLEMENT**:
  ```ts
  import { timingSafeEqual } from "node:crypto";

  /**
   * Constant-time compare against RESOURCE_ADMIN_TOKEN.
   * Length mismatch returns false immediately (length is not the secret here);
   * equal-length inputs are compared via timingSafeEqual to avoid per-byte
   * timing leaks under load.
   */
  export function verifyAdminToken(provided: unknown): boolean {
    const expected = process.env.RESOURCE_ADMIN_TOKEN;
    if (!expected || typeof provided !== "string") return false;
    if (provided.length !== expected.length) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return timingSafeEqual(a, b);
  }
  ```
- **IMPORTS**: `node:crypto` (Node built-in; works in Next.js Node runtime).
- **GOTCHA**: Don't `console.log` the token. Don't include it in any error message. Don't return early with a different error for "env unset" vs "mismatch" — both return `false` so the page returns the same 404.
- **VALIDATE**: Add a temporary script `scripts/test-token.ts` that calls `verifyAdminToken("foo")` against `RESOURCE_ADMIN_TOKEN=foo` set inline — should print `true`. Delete the script after.

### 4. ADD env vars

- **IMPLEMENT**:
  - In `.env.example` **remove** the `OPENAI_API_KEY=xxxxx` line.
  - In `.env.example` **add**:
    ```bash
    RESOURCE_ADMIN_TOKEN=xxxxx              # server-only. Long random string. Anyone with this token + URL can insert resources.
    ```
  - In `.env.local` (your local file, not in git) set `RESOURCE_ADMIN_TOKEN` to a long random string. Generate with `openssl rand -hex 32`.
- **GOTCHA**: `.env.local` is gitignored — do not commit it. The user must add the variable to Vercel's environment-variables UI separately for production.
- **VALIDATE**: `grep RESOURCE_ADMIN_TOKEN .env.example` returns the line; `grep OPENAI_API_KEY .env.example` returns nothing.

### 5. CREATE `app/api/admin/resources/create/route.ts`

- **IMPLEMENT**: POST handler. Token from request body (header or body — body is simpler and the token already lives in the URL path of the page, so re-sending it in the body is a no-op friction-wise). Validate every field. Compute `external_id`. Insert.
- **PATTERN**: Strongly mirror `app/api/startups/create/route.ts`. Reuse its `badRequest` and `requireString` helpers (copy them — they're four lines each; do not extract to a shared file unless this becomes a third caller).
- **STRUCTURE**:
  ```ts
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

  // Same shape as startups/create/route.ts requireString
  function requireString(value: unknown, field: string, maxLen: number): string | NextResponse { ... }

  // Validate that every entry of `arr` is a string AND in `allowed`.
  // Returns the deduped array on success, or NextResponse on failure.
  function validateEnumArray(value: unknown, allowed: readonly string[], field: string): string[] | NextResponse {
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
    try { body = (await req.json()) as CreateBody; } catch { return badRequest("Invalid JSON body"); }

    if (!verifyAdminToken(body.token)) {
      // Same response shape as a route mismatch — no info leak about whether
      // the route exists.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const title = requireString(body.title, "title", 200);
    if (title instanceof NextResponse) return title;

    // description is required by the matching pipeline
    const description = requireString(body.description, "description", 4000);
    if (description instanceof NextResponse) return description;

    // link + email are optional. Validate URL/email shape only if non-empty.
    let link: string | null = null;
    if (body.link !== undefined && body.link !== null && body.link !== "") {
      const checked = requireString(body.link, "link", 500);
      if (checked instanceof NextResponse) return checked;
      try { new URL(checked); } catch { return badRequest("link must be a valid URL"); }
      link = checked;
    }
    let email: string | null = null;
    if (body.email !== undefined && body.email !== null && body.email !== "") {
      const checked = requireString(body.email, "email", 200);
      if (checked instanceof NextResponse) return checked;
      // RFC-5322 lite — same level of strictness as a typical signup form.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checked)) return badRequest("email is malformed");
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

    // Auto-assign external_id = max + 1. There is no concurrent-admin scenario
    // at hackathon scale, so a SELECT-then-INSERT race is acceptable. If two
    // concurrent inserts collide on the unique constraint, the second one
    // returns a 23505 error which we surface as a 500 — manual retry resolves.
    const { data: maxRow, error: maxErr } = await admin
      .from("resources")
      .select("external_id")
      .order("external_id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) {
      console.error("[/api/admin/resources/create] max external_id lookup failed:", maxErr.message);
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

    return NextResponse.json({ ok: true, id: inserted.id, external_id: inserted.external_id });
  }
  ```
- **GOTCHA**:
  - The `validateEnumArray` whitelist is **load-bearing** — it's the only thing keeping a malicious admin (or a tampered client) from inserting strings that break the deterministic SQL filter in `/api/process-answer`. Do not relax it.
  - `topics` empty would let the resource never appear in any Q1 filter; reject empty topics.
  - `email` null vs empty string: keep both → null in the DB to avoid downstream code (e.g., draftEmails) dealing with `""` vs `null`.
- **VALIDATE**: `curl -X POST localhost:3000/api/admin/resources/create -H "Content-Type: application/json" -d '{"token":"wrong"}'` returns `404`. With correct token + minimal valid body returns `200` and a UUID.

### 6. CREATE `components/admin/AddResourceForm.tsx`

- **IMPLEMENT**: Client component. Controlled form, all eight column fields. Submit POSTs to `/api/admin/resources/create` with `token` from props.
- **PATTERN**: Mirror `components/map/create/CreateDetailsStep.tsx` exactly for visual style. The form is longer because it has four enum-array fields, but the field shape, label style, button style, and error display should be identical.
- **STRUCTURE**:
  ```tsx
  "use client";
  import { useState } from "react";
  import { COLORS } from "@/lib/map/mapConfig";
  import {
    KNOWN_TOPICS,
    KNOWN_INDUSTRIES,
    KNOWN_LOCATIONS,
    KNOWN_COMMUNITIES,
  } from "@/lib/intake/filterConstants";

  interface AddResourceFormProps {
    token: string;
    onSuccess: (id: string, externalId: number) => void;
  }

  export function AddResourceForm({ token, onSuccess }: AddResourceFormProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [link, setLink] = useState("");
    const [email, setEmail] = useState("");
    const [topics, setTopics] = useState<string[]>([]);
    const [communities, setCommunities] = useState<string[]>([]);
    const [industries, setIndustries] = useState<string[]>([]);
    const [locations, setLocations] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit =
      !!title.trim() && !!description.trim() && topics.length > 0 && !isSubmitting;

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!canSubmit) return;
      setIsSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/resources/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token, title, description, link, email,
            communities, industries, locations, topics,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? `Request failed (${res.status})`);
          return;
        }
        onSuccess(data.id, data.external_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setIsSubmitting(false);
      }
    }

    return (
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Header — mirror CreateDetailsStep's h1 + intro <p> */}
        {/* title: text input, required, maxLen 200 */}
        {/* description: textarea, required, rows={6}, maxLen 4000, char count hint */}
        {/* link: url input, optional */}
        {/* email: email input, optional */}
        {/* topics: <CheckboxGrid label="Topics" required values={KNOWN_TOPICS} selected={topics} onChange={setTopics} /> */}
        {/* industries: same shape */}
        {/* locations: same shape (4-column grid since 29 entries) */}
        {/* communities: same shape */}
        {/* error block */}
        {/* submit button */}
      </form>
    );
  }

  // Inline Field + CheckboxGrid helpers below. Field copies CreateDetailsStep:366-397.
  ```
- **CheckboxGrid example**:
  ```tsx
  function CheckboxGrid({ label, required, values, selected, onChange, columns = 2 }: {...}) {
    return (
      <Field label={label} htmlFor={`grid-${label}`} required={required}
             hint={`${selected.length} selected`}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: "6px" }}>
          {values.map((v) => {
            const checked = selected.includes(v);
            return (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: "8px",
                                       padding: "6px 8px", border: `1px solid ${COLORS.border}`,
                                       fontFamily: "ui-sans-serif, system-ui, -apple-system",
                                       fontSize: "0.8125rem", color: COLORS.text, cursor: "pointer",
                                       userSelect: "none" }}>
                <input type="checkbox" checked={checked}
                       onChange={(e) => onChange(e.target.checked ? [...selected, v] : selected.filter((x) => x !== v))}
                       style={{ accentColor: COLORS.accent }} />
                <span>{v}</span>
              </label>
            );
          })}
        </div>
      </Field>
    );
  }
  ```
- **GOTCHA**: 29 location entries in a 2-column grid is too tall — use `columns={4}`. Topics/industries/communities are short enough that 2 columns reads better.
- **VALIDATE**: With `npm run dev` and the correct token URL, every field renders, checkboxes toggle, submit button enables only when title + description + ≥1 topic are present.

### 7. CREATE `app/admin/resources/[token]/AddResourceClient.tsx`

- **IMPLEMENT**: Client wrapper that holds success-state UI, since the form needs to swap in a "Resource created" view.
- **STRUCTURE**:
  ```tsx
  "use client";
  import { useState } from "react";
  import { COLORS } from "@/lib/map/mapConfig";
  import { AddResourceForm } from "@/components/admin/AddResourceForm";

  export function AddResourceClient({ token }: { token: string }) {
    const [created, setCreated] = useState<{ id: string; externalId: number } | null>(null);
    if (created) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.75rem",
                       color: COLORS.text, margin: 0 }}>Resource added</h2>
          <p style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", fontSize: "0.9375rem",
                      color: COLORS.textMuted, margin: 0 }}>
            external_id: {created.externalId}
          </p>
          <button onClick={() => setCreated(null)}
                  style={{ /* mirror submit-button style */ }}>
            Add another
          </button>
        </div>
      );
    }
    return <AddResourceForm token={token} onSuccess={(id, externalId) => setCreated({ id, externalId })} />;
  }
  ```
- **VALIDATE**: After a successful submit, the form is replaced by the success view; "Add another" returns to a blank form.

### 8. CREATE `app/admin/resources/[token]/page.tsx`

- **IMPLEMENT**: Server component. Token compare, then render. Re-uses the `CreateLayout` chrome.
- **STRUCTURE**:
  ```tsx
  import { notFound } from "next/navigation";
  import { verifyAdminToken } from "@/lib/admin/token";
  import { CreateLayout } from "@/components/map/create/CreateLayout";
  import { AddResourceClient } from "./AddResourceClient";

  // Treat this page as fully dynamic: the token is in the URL path and we never
  // want a static cache hit to bypass the verification. force-dynamic also
  // guards against any future ISR experiments accidentally caching the page.
  export const dynamic = "force-dynamic";

  export default async function AddResourcePage({
    params,
  }: {
    params: Promise<{ token: string }>;
  }) {
    const { token } = await params;
    if (!verifyAdminToken(token)) notFound();
    return (
      <CreateLayout>
        <h1 style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "2rem",
          letterSpacing: "-0.01em",
          margin: "0 0 24px",
        }}>
          Add a resource
        </h1>
        <AddResourceClient token={token} />
      </CreateLayout>
    );
  }
  ```
- **GOTCHA**:
  - `params` is a `Promise` in Next 15 server components. The `await params` line is required.
  - `CreateLayout`'s logo links back to `/map`. That's fine for this surface — the admin page lives outside the public nav, but the logo link is still useful to escape.
  - Do **not** add `metadata` export with the page title "Admin" — keep it generic so the page is unremarkable in browser history if the URL leaks.
- **VALIDATE**: Hit `/admin/resources/anything` → 404. Hit `/admin/resources/<correct token>` → form renders. Verify the token does not appear in `<head>` HTML or any rendered text.

### 9. UPDATE `scripts/import-resources.ts`

- **IMPLEMENT**: Strip everything embedding-related so the script remains usable for re-importing the CSV without OpenAI.
- **REMOVE**:
  - Line 6: `import OpenAI from 'openai'`
  - Line 13: `const openai = new OpenAI(...)`
  - Lines 36–52: the entire embeddings block (`embeddingInputs`, `openai.embeddings.create`, the sort + map step, the surrounding `console.log`s)
  - Line 64: the `embedding: embeddings[i]` field in the `rows` payload
- **UPDATE**:
  - Line 82: change `'Done. All resources imported with embeddings.'` to `'Done. All resources imported.'`
  - The `records.map((r, i) => ...)` index `i` is no longer needed — change to `records.map((r) => ...)`.
- **VALIDATE**: `npx tsx --env-file=.env.local scripts/import-resources.ts` (with a `data/resources.csv` present) runs without invoking OpenAI. (For the validation pass alone, you can stub the CSV with 1 row and revert.)

### 10. REMOVE `openai` dependency

- **IMPLEMENT**: Edit `package.json` to remove the `"openai": "^6.37.0"` line. Run `npm install` to update `package-lock.json`.
- **GOTCHA**: Confirm no other file imports `openai` (`grep -rn "from 'openai'" .`). Should return only `scripts/import-resources.ts` (which you just stripped) and zero other matches.
- **VALIDATE**: `npm ls openai` reports the package is no longer installed. `npm run build` succeeds.

### 11. UPDATE `.env.example`

- **IMPLEMENT**: Already done in Task 4 — confirm the file now has `RESOURCE_ADMIN_TOKEN` and lacks `OPENAI_API_KEY`.
- **VALIDATE**: `cat .env.example | grep -E "(OPENAI|RESOURCE_ADMIN)"` shows only the `RESOURCE_ADMIN_TOKEN` line.

### 12. UPDATE `ai-context/CLAUDE.md`

- **IMPLEMENT**: Multiple edits:
  - **Tech Stack table**: delete the rows `| Embeddings | OpenAI text-embedding-3-small |` and `| Vector search | pgvector (<=> cosine distance) |`.
  - **Environment Variables block**: remove `OPENAI_API_KEY=...` line; add `RESOURCE_ADMIN_TOKEN=...                # server-side only — anyone with this token + URL can insert resources` line.
  - **Database Schema → `resources`**: delete the `embedding     vector(1536)         -- text-embedding-3-small on title+description` line.
  - **Three-Layer Matching Pipeline section**: rename heading to **Two-Layer Matching Pipeline**. Delete the **Layer 2 — Vector search** block entirely. Renumber Layer 3 to Layer 2. Add a sentence: "An embedding pre-filter layer was removed in the secret-link-resource-admin feature — at 213 resources, full-description Claude ranking outperforms vector pre-filter on match quality and latency."
  - **At the bottom of the file**, add a new section:
    ```markdown
    ---

    ## Admin Tools

    ### `/admin/resources/[token]` (Feature: secret-link-resource-admin)
    Token-gated form for adding new rows to the `resources` table without code changes or Supabase Studio access.

    - Token comes from `RESOURCE_ADMIN_TOKEN` env var, compared via `crypto.timingSafeEqual` in `lib/admin/token.ts`
    - Wrong token → 404 (no info leak)
    - Form constrains the four array columns to the enums in `lib/intake/filterConstants.ts` so new resources are immediately matchable by Q1–Q4
    - `external_id` auto-increments server-side (max + 1)
    - There is no UI link to this page from anywhere in the public app
    ```
- **VALIDATE**: `grep -c "embedding" ai-context/CLAUDE.md` returns `0`. `grep "RESOURCE_ADMIN_TOKEN" ai-context/CLAUDE.md` returns the new line.

### 13. UPDATE `ai-context/INEFFICIENCIES.md`

- **IMPLEMENT**: Find the existing entry **Discovery — IVFFLAT index over-parameterized for 213 rows**. **Append** this resolution paragraph (do not delete the entry; the audit trail is useful):
  ```markdown
  **Status (Feature: secret-link-resource-admin):** Resolved — the embedding column, IVFFlat index, and both pgvector RPCs were dropped. The matching pipeline never queried them at runtime; the column was inherited from the original three-layer design and orphaned when the SQL-deterministic filter replaced vector search.
  ```
- Also append a new entry at the bottom:
  ```markdown
  ### Admin — No rate limit or audit log on resource inserts (Feature: secret-link-resource-admin)
  **Impact:** Low
  **Context:** `/api/admin/resources/create` accepts unlimited POSTs from any caller with a valid token. A leaked token plus a script could spam the resources table with junk rows that then surface in the matching pipeline. There is no per-IP rate limit and no audit log of who inserted what.
  **Ideal solution:** Wrap the route in a Vercel KV / Upstash rate limit (e.g., 30 inserts/hour/IP); add a `created_by` text column populated from a small "admin name" field on the form (audit trail) plus an `inserted_via` column to distinguish admin-form rows from CSV-imported rows.
  **Workaround in place:** Token rotation. If the token leaks, regenerate it in `.env` + Vercel.
  ```
- **VALIDATE**: Both edits present in the file.

### 14. UPDATE `ai-context/SECURITY.md`

- **IMPLEMENT**: After the existing **Map Self-Serve Add Startup** section (around line 122), insert:
  ```markdown
  ### Admin Resource Page (Feature: secret-link-resource-admin)
  - `/admin/resources/[token]` is gated by a single shared secret in `RESOURCE_ADMIN_TOKEN`. Compare uses `crypto.timingSafeEqual` (`lib/admin/token.ts`) to avoid timing leaks. Length mismatch returns `false` immediately — length is not the secret here.
  - Wrong token at the page returns Next.js's standard 404 (`notFound()`); wrong token at the API returns `{"error":"Not found"}` with status 404. Both responses are indistinguishable from a non-existent route, so the URL surface does not leak the existence of the admin endpoint.
  - The token travels in the URL path (page) and request body (POST). URL paths appear in HTTP referrer headers and server access logs — treat the token as **rotatable, not permanent**. Do not embed it in any link the user might click out of (the page itself does not issue cross-origin requests).
  - All four array fields (`communities`, `industries`, `locations`, `topics`) are server-side whitelisted against `KNOWN_*` constants from `lib/intake/filterConstants.ts`. A tampered client cannot insert arbitrary strings — the route's `validateEnumArray` rejects unknown values with 400.
  - `link` and `email` are loosely validated (URL parser; lite RFC-5322 regex). They are **not** re-fetched, sandboxed, or scrubbed for malicious payloads — both are rendered downstream in `ResourceCard.tsx` and `EmailPanel.tsx`. React's default escaping prevents XSS via these fields, but a `javascript:` URL in `link` could surface in the rendered anchor — **strip the `javascript:` and `data:` schemes** at validation time:
    ```ts
    const protocol = new URL(checked).protocol;
    if (protocol !== "https:" && protocol !== "http:") return badRequest("link must be http(s)");
    ```
  - `external_id` is computed server-side via `MAX(external_id) + 1`. Concurrent inserts can race; the unique constraint catches the second writer (Postgres error 23505 → 500 with manual retry). Acceptable at hackathon scale.
  - Service-role key is used for the insert (bypasses RLS). The route has no auth check beyond the token; do not refactor it to use the cookie-based `createClient` — the admin is intentionally session-less.
  - **Post-MVP**: per-IP rate limit, audit log, magic-link / email-OTP token issuance, automatic token rotation.
  ```
- **GOTCHA**: The `javascript:` / `data:` protocol check **must** be added to the route in Task 5 if you didn't already include it — the security note above assumes it's there. Cross-reference Task 5 and add the protocol check inside the `link` validation block before shipping.
- **VALIDATE**: `grep "secret-link-resource-admin" ai-context/SECURITY.md` returns the section header.

### 15. ADD protocol check to `/api/admin/resources/create` (cross-reference fix)

- **IMPLEMENT**: Inside the `link` validation in Task 5, replace the bare `try { new URL(checked); } catch { ... }` with:
  ```ts
  let parsedLink: URL;
  try { parsedLink = new URL(checked); } catch { return badRequest("link must be a valid URL"); }
  if (parsedLink.protocol !== "https:" && parsedLink.protocol !== "http:") {
    return badRequest("link must be http(s)");
  }
  link = checked;
  ```
- **VALIDATE**: `curl ... -d '{"token":"...","title":"x","description":"x","topics":["Funding"],"link":"javascript:alert(1)","communities":[],"industries":[],"locations":[]}'` returns 400 with "link must be http(s)".

### 16. RUN end-to-end manual flow

- **IMPLEMENT**: Start `npm run dev`. Visit `/admin/resources/<your token>`. Submit a real-looking resource (title, description, one topic, one location). Open Supabase Studio and confirm the row appears with the correct `external_id` (= prior max + 1). Visit `/resources` and run the voice intake (or use the text fallback) with answers that match the new row's tags — confirm the row appears in the bubble field's initial pool.
- **VALIDATE**: The new row is visible in `select * from resources where external_id = <new>;` and surfaces in the discovery bubble field.

---

## TESTING STRATEGY

This codebase has **no automated test suite** (verified by absence of `jest.config`, `vitest.config`, `__tests__/`, `*.test.ts`). Validation is `npm run build`, `npm run lint`, and manual flows. Do not introduce a test framework as part of this feature — match the project's standard.

### Unit Tests

N/A — codebase convention. The token verification logic is small enough (1 file, 10 lines) to validate via the smoke test in Task 3.

### Integration Tests

N/A. Manual end-to-end in Task 16 plays this role.

### Edge Cases (manual checklist)

- [ ] Wrong token at the page → 404 (not a blank page, not a 500)
- [ ] Empty token at the page (`/admin/resources/`) → Next's standard 404 for the missing param
- [ ] Wrong token at the API → 404 JSON
- [ ] Submit with empty title → 400 with "title is required"
- [ ] Submit with empty topics array → 400 with "at least one topic is required"
- [ ] Submit with `topics: ["NotARealTopic"]` → 400 with "topics contains unknown value"
- [ ] Submit with `link: "javascript:alert(1)"` → 400
- [ ] Submit with `link: ""` (empty string) → succeeds, link stored as `null`
- [ ] Submit with `email: "not-an-email"` → 400
- [ ] Submit with no email → succeeds, email stored as `null`
- [ ] Concurrent submit with same `external_id` race → second one fails with 500 (acceptable; admin retries)
- [ ] Long title (210 chars) → 400 "title too long"
- [ ] After successful submit, "Add another" returns to blank form (not pre-filled)
- [ ] After embedding column drop, `npm run build` succeeds (no orphan import of the removed column)
- [ ] After embedding column drop, voice intake from `/resources` still returns recommendations (no runtime regression)

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

```bash
npm run lint         # ESLint, must report zero errors and zero warnings
npx tsc --noEmit     # Type-check without emitting (next build also runs this, but tsc is faster for iterating)
```

### Level 2: Build

```bash
npm run build        # Full Next.js production build. Must succeed without errors.
```

### Level 3: Unit Tests

N/A — no test suite in this project.

### Level 4: Integration Tests

N/A — covered by manual flow.

### Level 5: Manual Validation

```bash
# 1. Confirm migration applied
psql "$SUPABASE_DB_URL" -c "\d resources" | grep -c embedding   # expect 0
psql "$SUPABASE_DB_URL" -c "\df match_resources_by_vector"      # expect 0 rows
psql "$SUPABASE_DB_URL" -c "\df score_resources_for_discovery"  # expect 0 rows

# 2. Confirm dependency removed
npm ls openai                                                    # expect "(empty)"

# 3. Run dev server
npm run dev

# 4. In another terminal, exercise the API:
TOKEN="<paste your RESOURCE_ADMIN_TOKEN>"

# Wrong token → 404
curl -i -X POST localhost:3000/api/admin/resources/create \
  -H "Content-Type: application/json" \
  -d '{"token":"wrong"}' | head -1   # expect: HTTP/1.1 404

# Valid minimal payload → 200
curl -s -X POST localhost:3000/api/admin/resources/create \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\",
    \"title\": \"Test Resource\",
    \"description\": \"A test resource added via the admin form.\",
    \"topics\": [\"Funding\"],
    \"industries\": [\"Other\"],
    \"locations\": [\"Salt Lake\"],
    \"communities\": [],
    \"link\": \"https://example.com\",
    \"email\": \"\"
  }" | head -c 200                   # expect: {"ok":true,"id":"<uuid>","external_id":<n>}

# 5. Visit the page in a browser:
#    /admin/resources/wrong          → 404 page
#    /admin/resources/$TOKEN         → form renders
```

### Level 6: Production Sanity (post-deploy, optional)

- Set `RESOURCE_ADMIN_TOKEN` in Vercel environment variables (Production scope)
- Re-deploy
- Hit the production URL with the production token; confirm the same flow works

---

## ACCEPTANCE CRITERIA

- [ ] `/admin/resources/<wrong token>` returns Next's 404 page
- [ ] `/admin/resources/<correct token>` renders the form on a black background, matching `CreateDetailsStep` visually
- [ ] All eight `resources` columns are populated through the form (title, description, link, email, communities, industries, locations, topics) — `external_id` is auto-assigned by the server and not exposed to the form
- [ ] The four array fields are constrained to `KNOWN_TOPICS / KNOWN_INDUSTRIES / KNOWN_LOCATIONS / KNOWN_COMMUNITIES`; the form has no free-text override
- [ ] Submitting the form inserts a row that is **immediately** matchable by the live voice intake (no embedding step required)
- [ ] The `embedding` column, `resources_embedding_idx`, `match_resources_by_vector` RPC, and `score_resources_for_discovery` RPC are removed from the database
- [ ] `package.json` no longer lists `openai`; `npm ls openai` returns empty
- [ ] `OPENAI_API_KEY` removed from `.env.example`; `RESOURCE_ADMIN_TOKEN` added
- [ ] `ai-context/CLAUDE.md` updated (Tech Stack table, Environment Variables, Database Schema, Matching Pipeline section, Admin Tools section)
- [ ] `ai-context/SECURITY.md` has the new admin section
- [ ] `ai-context/INEFFICIENCIES.md` has the resolution append to the IVFFLAT entry plus the new "no rate limit / audit log" entry
- [ ] `npm run build` succeeds
- [ ] `npm run lint` reports zero issues
- [ ] Voice intake on `/resources` still returns recommendations after the migration (no runtime regression)
- [ ] No new emoji introduced in any file (project convention)
- [ ] No comments added that explain *what* the code does — only the *why* lines required by the project's commenting rules

---

## COMPLETION CHECKLIST

- [ ] Tasks 1–16 completed in order
- [ ] Each task's `VALIDATE` step passed before moving on
- [ ] All Level 1 + Level 2 + Level 5 validation commands executed successfully
- [ ] Manual edge-case checklist walked through
- [ ] No regressions in `/resources` (voice intake) or `/map` (startup map)
- [ ] Acceptance criteria all met
- [ ] User has stored `RESOURCE_ADMIN_TOKEN` somewhere persistent (password manager) — once they close the terminal, only `.env.local` and Vercel know the value

---

## NOTES

### Why drop embeddings entirely instead of keeping the column NULL-able?

A nullable `vector(1536)` column on a 213-row table has no observable cost, so the impulse is to leave it. Two reasons not to:

1. **Schema drift fingerprint.** Anyone reading the schema today would assume vector search is part of the active pipeline (the column, the index, the two RPCs, the OPENAI_API_KEY env var, the `openai` dep all reinforce that story). It isn't, and hasn't been for several feature iterations. Keeping the artifacts is a lie that costs maintainer attention.
2. **Re-introducing the column is one migration, not a major effort.** If a future feature wants semantic search, recreating the column + the IVFFlat index is ~10 lines of SQL plus repopulating from descriptions. The cost of "remove now, re-add later" is bounded; the cost of "leave dead artifacts indefinitely" compounds.

### Why URL-path token instead of header / query string?

- **Header**: requires JS to set on a normal page navigation — can't paste a URL into a browser. Rules out the "share a special link" use case.
- **Query string**: works, but query strings appear in browser autocomplete and in some analytics tools that wouldn't see path params. Path is marginally better.
- **Path (chosen)**: pasteable, no JS required, indistinguishable from any other route in the user's browser history. Still leaks to referrer / access logs — that's the trade-off the user accepted by picking the env-var token option.

### Why no rate limit / audit log in v1?

The user's requirement is "a special link" — single-token, hackathon-grade access control. Rate limiting and audit logging are real concerns for any production system but introduce dependencies (Vercel KV / Upstash) and schema changes that aren't part of the requested scope. Both are noted in `INEFFICIENCIES.md` for future work.

### Why constrain to known enums and not allow free-text?

The matching pipeline (`/api/process-answer`) does an exact-string SQL filter on these four columns. A row tagged `"Salk Lake"` (typo) is invisible to any user who answers "Salt Lake City" → mapped to `"Salt Lake"`. The form is the last enforcement point before junk data lands in the table; whitelisting against the same constants the filter uses is the only way to guarantee parity. If a new community / topic / location ever needs to be added, the path is: update `lib/intake/filterConstants.ts` first → deploy → then admins can tag with the new value via the form. That sequencing is the correct order of operations.

### Why is the page server-rendered when the form is client-side?

Token verification has to happen server-side — never trust client code with secret comparison. A server component lets us call `notFound()` before any HTML reaches the browser, which means the client bundle never runs (and the form code is never delivered) for an invalid token. The client child component only loads after the server has already verified the token, so the token also doesn't appear in any client-side bundle as a literal.

### Confidence

**8/10** for one-pass implementation. The two areas of remaining risk:

1. The exact `drop function` parameter signatures depend on what's in the original migration files — Task 1's GOTCHA flags this. Read those files before writing the migration.
2. The `params: Promise<{ token }>` shape is Next 15-specific. If the project upgrades to a future version with a different async-params API, the page handler needs to track that change. Today's version is correct.
