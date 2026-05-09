# Feature: Self-Serve Add Startup

The following plan should be complete, but it is important that you validate documentation, codebase patterns, and task sanity before you start implementing.

Pay special attention to: the existing claim-flow scaffolding (`hooks/useStartupClaim.ts`, `components/map/claim/*`, `app/api/startups/claim/route.ts`), the `Startup` type's enum unions in `lib/map/types.ts`, the server-only constraint on `lib/startups/geocode.ts`, and the **all-inline-styles** convention inside `components/map/*` (no Tailwind, no shadcn primitives).

---

## Feature Description

A self-serve onboarding route at **`/map/new`** that lets a Utah founder add their company to the startup map in one sitting. The flow has three steps:

1. **Account** — email + password on a single screen. The email domain is validated against a free-mail blocklist (gmail/yahoo/outlook/hotmail/icloud/proton/aol) so only company emails are accepted. We call `supabase.auth.signUp({ email, password })`.
2. **OTP** — the user enters the 6-digit code from the email Supabase sends. Verified via `supabase.auth.verifyOtp({ type: 'signup' })` (same path as the existing claim flow).
3. **Company details** — a single long form that collects every field the `startups` table needs: name, website, LinkedIn URL, address, description, stage, employee count, industry/section, year founded, hiring flag. On submit we POST to a new `/api/startups/create` route which:
   - Re-validates the auth + free-mail rule server-side.
   - Verifies the email domain matches the website's hostname (proof of ownership — same standard as the claim flow).
   - Returns **409 with `existingSlug`** if a startup at that domain already exists, so the client can deep-link the user into the existing pin's claim flow.
   - Geocodes the address with the existing `geocodeAddress` helper.
   - Generates a unique slug (LinkedIn handle preferred; slugified name with numeric suffix as fallback).
   - Inserts the row with `claimed_by = user.id, claimed_at = now()` (the creator is automatically the verified owner).
   - Sets `app_metadata.role = 'startupOwner'` so future calls to `/api/startups/update` succeed.
   - Returns the new `slug` so the client can redirect to `/map?startup=<slug>`.

The entry point is a `Don't see your company? Add it →` link in `components/map/MapSidebar.tsx`. The map page must read a `?startup=<slug>` query param on mount and auto-open that pin's `InfoPanel`, so the post-create redirect lands the user back on the map with their new pin highlighted.

## User Story

As a Utah startup founder whose company is not yet on the Nexis map,
I want to add my company in a few minutes by verifying a company email and filling one form,
So that prospective investors, recruits, and partners can discover us alongside the imported startups.

## Problem Statement

Today the only way onto the map is to be in the original CSV import (255 rows). The existing claim flow assumes the row already exists — there is no mechanism to add a new startup. Founders whose company isn't pre-loaded have no path in. Manually emailing a maintainer doesn't scale and breaks the "non-developer update path" principle from the PRD.

## Solution Statement

Reuse every primitive the claim flow already established (Supabase email+password+OTP auth, service-role API route for the privileged write, `app_metadata.role = 'startupOwner'`, server-side geocoding) and bolt on:

- A **free-mail blocklist** so only company emails can begin the flow.
- A **website-domain match** rule so a `me@acme.com` user can only add a startup whose website resolves to `acme.com`.
- A **duplicate-domain short-circuit** so a row at that domain can never be created twice — the user is redirected to the existing pin's claim flow instead.
- A **unique-slug generator** that handles LinkedIn-handle derivation, slugified-name fallback, and numeric collision suffixes.
- A **new top-level route** `/map/new` so the long form gets a quiet full-screen surface (the InfoPanel is too narrow for ~10 fields).
- A **deep-link auto-open** on `/map` so the post-create redirect lands the user on their new pin.

No new dependencies, no schema changes (the columns already exist).

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Medium-High (orchestrating 4 steps, ~10 form fields, three new server validations, slug uniqueness, post-create deep-link)
**Primary Systems Affected**: new `app/map/new/`, new `app/api/startups/create/`, new `components/map/create/*`, new `hooks/useStartupCreate.ts`, new `lib/startups/freeMailDomains.ts`, new `lib/startups/normalize.ts`, modified `components/map/MapSidebar.tsx`, modified `components/map/MapClient.tsx` (or `MapView.tsx`) to handle the `?startup=<slug>` deep-link, modified `lib/map/types.ts`, appended `ai-context/SECURITY.md` + `INEFFICIENCIES.md`.
**Dependencies (existing)**: `@supabase/ssr`, `@supabase/supabase-js`, `framer-motion`, `next/navigation`. No new npm packages.
**Config changes**: none beyond what the claim flow already required (Supabase Studio "Confirm signup" template must contain `{{ .Token }}` — already done if the claim flow is working; verify before testing).

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `hooks/useStartupClaim.ts` (lines 1–214) — Why: the state-machine pattern + `signUp` + `verifyOtp` + resend-cooldown + post-verify API call. The new `useStartupCreate` is a sibling that follows this shape almost exactly, with the post-verify call going to `/api/startups/create` instead of `/api/startups/claim` and adding a `details` step before completion.
- `app/api/startups/claim/route.ts` (lines 1–112) — Why: canonical structure for an authenticated, service-role write. Mirror the auth gate (lines 22–32), the service-role client init (39–45), and the `NextResponse.json({ error }, { status })` shape exactly.
- `app/api/startups/update/route.ts` (lines 1–222) — Why: shows how `EDITABLE_STARTUP_KEYS`, the per-key validation switch (lines 51–125), the post-edit re-geocode (lines 190–200), and the trigger-driven `lat/lng → location` flow work. The new create route does roughly the same validation logic over a slightly larger required set.
- `components/map/claim/ClaimEmailStep.tsx` (lines 1–129) — Why: input + submit + cancel + error message styling. The new auth step combines this with a password field; reuse the input/button/label inline-style language verbatim.
- `components/map/claim/ClaimPasswordStep.tsx` (lines 1–125) — Why: password input pattern, "Sending..." disabled state, autofocus.
- `components/map/claim/ClaimOtpStep.tsx` (lines 1–131) — Why: the OTP step is identical between claim and create. The new `CreateOtpStep` can be a near-copy (different copy text, same input).
- `components/map/InfoPanel.tsx` (lines 162–377) — Why: button shapes, badge styles, and the panel's "view" mode layout. Anything we render inside `/map/new` should look like it could be lifted out of this file. **Inline styles only** — no Tailwind classes inside `components/map/*`.
- `lib/startups/domainCheck.ts` (lines 1–19) — Why: the `extractEmailDomain` helper is reused for the free-mail check and the website-domain match. `matchesStartupDomain` is reused server-side after geocoding the website.
- `lib/startups/geocode.ts` (lines 1–35) — Why: server-only address geocoder. **Never import from any client component** — this is enforced by a top-of-file comment, not a runtime check.
- `lib/map/types.ts` (lines 1–91) — Why: `StartupStage`, `StartupEmployees`, `StartupSection` enum unions. The form's selects must use exactly these values; the API route must validate against the same sets defined inline at the top of `app/api/startups/update/route.ts:7-35`. Refactor those sets out into shared constants in this file.
- `scripts/geocode-startups.ts` (lines 60–113) — Why: `getSlug`, `normalizeDomain`, `normalizeLinkedInUrl`, `geocode` reference implementations. Lift the first three into `lib/startups/normalize.ts` so the create route uses the exact same logic the bulk import does. Leave the script's copies alone (avoid disturbing the import path).
- `components/map/MapSidebar.tsx` (lines 50–123) — Why: where the new "Don't see your company? Add it →" CTA lands. Note the use of a plain `<a href>` rather than `<Link>` (line 31 comment explains why — full nav wipes mapbox-gl pooled state).
- `components/map/MapClient.tsx` (lines 50–120) — Why: where deep-link logic for `?startup=<slug>` should mount. Reading `useSearchParams()` here (or in `MapView`) and dispatching `setSelectedStartup(matching)` is the cleanest hook-in.
- `components/map/MapView.tsx` (entire file, especially the `selectedStartup` resolver and `handleMarkerClick`) — Why: shows where `setSelectedStartup` is called and what the camera fly-to expects. The deep-link must trigger the same code path so the user lands with the InfoPanel open and the camera framed on their pin.
- `lib/map/store.ts` — Why: `setSelectedStartup` is the imperative API. No new store state needed for create flow — it lives entirely in `useStartupCreate`'s local state.
- `app/auth/confirm/route.ts` — Why: existing magic-link verifier as a fallback path. The create flow uses the OTP path (verifyOtp), but if the user clicks the magic link instead of typing the code, the redirect target should be `/map/new?resume=1` (or simply `/map`) so they don't land on a 404. Document this in the plan but don't add a new route — the existing one already handles `next=` query params.
- `components/sign-up-form.tsx` (lines 30–106) — Why: existing reference for the standard Supabase signUp call signature with `emailRedirectTo`. Use the same `${window.location.origin}/auth/confirm?next=/map` pattern.
- `app/page.tsx` (lines 97–227) — Why: landing page styling baseline. Anything we add to the landing OR sidebar should respect this aesthetic (Instrument Serif headings, `#666666` muted text, no decorative icons).
- `ai-context/plans/claim-startup-flow.md` (entire file) — Why: the immediate predecessor plan. Read the "NOTES" section about why service-role + `app_metadata.role` was chosen — the same rationale applies here.
- `ai-context/SECURITY.md` (lines 76–84) — Why: existing claim-flow security notes. The new entry follows that style and references the new free-mail and duplicate-domain rules.

### Existing Files That Change

- `components/map/MapSidebar.tsx` — APPEND a small CTA `Don't see your company?` text + `Add it →` link beneath the filters block. Use `<a href="/map/new">` for the same full-nav reasoning the existing logo `<a>` cites.
- `components/map/MapClient.tsx` (or `MapView.tsx`) — ADD a `useSearchParams()` read on mount that, if `?startup=<slug>` matches a known startup in the `startups` prop, calls `setSelectedStartup(match)` once. Do NOT poll or re-trigger on subsequent renders.
- `lib/map/types.ts` — EXPORT three new sets (or a single record):
  - `STAGE_VALUES`, `EMPLOYEES_VALUES`, `SECTION_VALUES` — `Set<string>` constants of the enum unions, used by both the create and update routes for runtime validation.
  - `CREATE_STARTUP_REQUIRED_KEYS` — array literal of the keys that must be present and non-empty on the create payload (everything except `year_founded` and `hiring`).
  - Keep `EDITABLE_STARTUP_KEYS` as it is.
- `app/api/startups/update/route.ts` — REPLACE the inline `STAGE_VALUES`/`EMPLOYEES_VALUES`/`SECTION_VALUES` constants (lines 7–35) with imports from `lib/map/types.ts`. Both routes must agree on the canonical set.
- `ai-context/SECURITY.md` — APPEND a `### Map Self-Serve Add Startup (Feature: self-serve-add-startup)` section.
- `ai-context/INEFFICIENCIES.md` — APPEND an entry under "Current".

### New Files to Create (in dependency order)

```
lib/startups/freeMailDomains.ts                  ← FREE_MAIL_DOMAINS Set + isFreeMailDomain()
lib/startups/normalize.ts                        ← normalizeDomain, normalizeLinkedInUrl, getLinkedInSlug, slugifyName
app/api/startups/create/route.ts                 ← POST: validate, dedupe, geocode, slug, insert, set role
hooks/useStartupCreate.ts                        ← state machine: account | otp | details | submitting | created | duplicate | error
components/map/create/CreateLayout.tsx           ← black-background full-screen wrapper with logo header
components/map/create/CreateAuthStep.tsx         ← email + password form
components/map/create/CreateOtpStep.tsx          ← 6-digit OTP (mirror ClaimOtpStep)
components/map/create/CreateDetailsStep.tsx     ← long form for startup details
components/map/create/DuplicateDomainNotice.tsx ← shown when 409 + existingSlug
components/map/create/CreateStartupClient.tsx    ← orchestrator; reads useStartupCreate; renders the right step
app/map/new/page.tsx                            ← server component; renders <CreateStartupClient />
```

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [Supabase: signUp](https://supabase.com/docs/reference/javascript/auth-signup#sign-up-with-an-email-and-password) — entry point for the auth step. Same call shape as the claim flow.
- [Supabase: verifyOtp (signup)](https://supabase.com/docs/reference/javascript/auth-verifyotp) — `type: 'signup'` with `{ email, token }`. Confirm the email template includes `{{ .Token }}` in Supabase Studio.
- [Supabase: admin updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) — sets `app_metadata.role = 'startupOwner'` server-side. The user cannot self-elevate.
- [Supabase: insert with service-role](https://supabase.com/docs/reference/javascript/insert) — service-role client bypasses RLS. Same pattern as `scripts/import-startups.ts`.
- [Mapbox Geocoding v6 forward](https://docs.mapbox.com/api/search/geocoding-v6/#forward-geocoding) — already wrapped in `lib/startups/geocode.ts`; do not duplicate.
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) — `POST` handler structure.
- [Next.js useSearchParams](https://nextjs.org/docs/app/api-reference/functions/use-search-params) — for the `?startup=<slug>` deep-link on `/map`. Note: must be inside a `'use client'` component; in Next 16 it requires a `<Suspense>` ancestor.
- [Disposable / public email lists (reference only)](https://github.com/disposable-email-domains/disposable-email-domains) — for inspiration when seeding the free-mail blocklist; do NOT install the package, just hand-pick the canonical providers.

### Patterns to Follow

**Inline styles in `components/map/*` (no Tailwind, no shadcn):**

```tsx
// Mirror this button shape from InfoPanel.tsx:301-328 (the "Edit listing" button)
<button
  type="submit"
  style={{
    flex: 1,
    minWidth: "140px",
    padding: "10px 16px",
    border: `1px solid ${COLORS.accent}`,
    background: "transparent",
    color: COLORS.accent,
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    fontSize: "0.875rem",
    letterSpacing: "0.05em",
    cursor: "pointer",
    transition: "background 0.2s ease-out, color 0.2s ease-out",
  }}
  onMouseEnter={(e) => {
    (e.currentTarget as HTMLElement).style.background = COLORS.accent;
    (e.currentTarget as HTMLElement).style.color = "black";
  }}
  onMouseLeave={(e) => {
    (e.currentTarget as HTMLElement).style.background = "transparent";
    (e.currentTarget as HTMLElement).style.color = COLORS.accent;
  }}
>
  Submit listing →
</button>
```

**Server route shape (mirror `app/api/startups/claim/route.ts`):**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  // 1. Parse body, return 400 on bad JSON
  // 2. Server client → auth.getUser(); 401 if missing/anon/unconfirmed
  // 3. Service-role client for the privileged write
  // 4. Return NextResponse.json({ ok: true, ... }) or NextResponse.json({ error }, { status })
}
```

**Service-role client (lifted from `app/api/startups/claim/route.ts:39-45`):**

```ts
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("[/api/startups/create] missing service role envs");
  return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
}
const admin = createServiceClient(SUPABASE_URL, SERVICE_ROLE);
```

**Step transition (mirror `components/map/claim/ClaimSection.tsx:54-98`):**

```tsx
import { motion, AnimatePresence } from "framer-motion";
<AnimatePresence mode="wait">
  <motion.div
    key={step}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.25, ease: "easeOut" }}
  >
    {/* step body */}
  </motion.div>
</AnimatePresence>
```

**Free-mail blocklist (new, server-authoritative):**

```ts
// lib/startups/freeMailDomains.ts
export const FREE_MAIL_DOMAINS = new Set<string>([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "msn.com",
  "yandex.com",
  "zoho.com",
  "gmx.com",
  "fastmail.com",
  "duck.com",
]);

export function isFreeMailDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return FREE_MAIL_DOMAINS.has(domain.trim().toLowerCase());
}
```

**Slug uniqueness (new helper, server-side):**

```ts
// Inside app/api/startups/create/route.ts — uses normalize.ts helpers
async function pickUniqueSlug(
  admin: SupabaseClient,
  base: string
): Promise<string> {
  let candidate = base;
  let suffix = 1;
  // Cap at 50 attempts — paranoid, would require 50 same-slug collisions to overflow
  for (let i = 0; i < 50; i++) {
    const { data } = await admin
      .from("startups")
      .select("slug")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  throw new Error("Could not generate unique slug");
}
```

**Domain match (existing `matchesStartupDomain` from `lib/startups/domainCheck.ts:9-19`):** reuse verbatim. The "startup domain" passed in for the create flow is the normalized hostname of the user-supplied website URL.

---

## IMPLEMENTATION PLAN

### Phase 1: Shared primitives (constants, helpers, types)

Lift the three enum-validator sets out of `app/api/startups/update/route.ts` so the new create route shares them. Add the free-mail blocklist, the URL/slug normalizers, and a server-side helper to pick a unique slug. No UI yet.

**Tasks:**
- Move `STAGE_VALUES` / `EMPLOYEES_VALUES` / `SECTION_VALUES` from the update route into `lib/map/types.ts` as exports.
- Update the update route to import from `@/lib/map/types`.
- Add `lib/startups/freeMailDomains.ts` (constant + helper).
- Add `lib/startups/normalize.ts` (`normalizeDomain`, `normalizeLinkedInUrl`, `getLinkedInSlug`, `slugifyName`).
- Add `CREATE_STARTUP_REQUIRED_KEYS` constant.

### Phase 2: Server route

Build `/api/startups/create` end-to-end with no UI. Test with curl + a real test session cookie.

**Tasks:**
- Validate body shape (all required fields present and well-typed).
- Auth gate: confirmed non-anonymous user.
- Free-mail check on email.
- Website-hostname matches email domain.
- Duplicate-domain short-circuit (`existingSlug` in 409 response).
- Geocode address; 422 on failure.
- Generate unique slug via `pickUniqueSlug`.
- Service-role insert with `claimed_by = user.id, claimed_at = now()`.
- Set `app_metadata.role = 'startupOwner'`.
- Return `{ ok: true, slug }`.

### Phase 3: Client state machine + UI

The auth + OTP + details flow lives entirely on `/map/new`. Only the server route is shared with the rest of the app.

**Tasks:**
- `useStartupCreate` hook: 6 steps (`account` → `otp` → `details` → `submitting` → `created` → `duplicate`). Owns email/password/details state, `signUp`, `verifyOtp`, `resend`, and the final POST.
- `CreateLayout` wrapper: full-screen black, Nexis logo top-left, max-width column.
- `CreateAuthStep`: email + password fields together, server-aligned client-side checks.
- `CreateOtpStep`: copy of `ClaimOtpStep` with create-flow copy.
- `CreateDetailsStep`: single long form with all fields.
- `DuplicateDomainNotice`: shown if server returns 409 with `existingSlug`. Has a "Claim this listing instead →" link to `/map?startup=<slug>`.
- `CreateStartupClient`: top-level orchestrator with `<AnimatePresence>` step swapping.
- `app/map/new/page.tsx`: renders the orchestrator inside the layout.

### Phase 4: Entry point + deep-link

Wire up the sidebar CTA and the `?startup=<slug>` deep-link on `/map`.

**Tasks:**
- Append the "Add it →" link to `MapSidebar.tsx` (full-nav `<a>` like the logo).
- Add `useSearchParams` reader to `MapClient.tsx` (or `MapView.tsx`) that calls `setSelectedStartup` on first matching slug.
- Verify both: clicking sidebar link lands on `/map/new`; the redirect from successful create lands on `/map?startup=<slug>` with the new pin's InfoPanel auto-open.

### Phase 5: Documentation

**Tasks:**
- Append `ai-context/SECURITY.md` entry covering: free-mail enforcement is server-authoritative; website-domain match prevents anyone with a corporate email from adding any company; race on duplicate domain is mitigated by the existing-row check + slug uniqueness retry; `app_metadata.role` is set via service-role admin API.
- Append `ai-context/INEFFICIENCIES.md` entry covering: free-mail blocklist is hand-maintained (drift risk); no rate limiting on `/api/startups/create`; no abuse signal beyond domain match.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order. Each task is atomic and independently testable.

### UPDATE `lib/map/types.ts` — export shared enum sets and required-keys list

- **IMPLEMENT**: Add three exported `Set<string>` constants and one array literal:
  ```ts
  export const STAGE_VALUES = new Set<StartupStage>([
    "Pre-Seed", "Seed", "Series A", "Series B+", "Series D+", "",
  ]);
  export const EMPLOYEES_VALUES = new Set<StartupEmployees>([
    "1", "2-10", "11-50", "51-200", "201-500", "200+", "",
  ]);
  export const SECTION_VALUES = new Set<StartupSection>([
    "B2B Software", "FinTech", "Security", "Bio/Medical Tech",
    "Energy", "Consumer", "Marketplaces", "",
  ]);
  export const CREATE_STARTUP_REQUIRED_KEYS = [
    "name", "website", "linkedin_url", "address",
    "description", "stage", "employees", "section",
  ] as const;
  export type CreateStartupRequiredKey = (typeof CREATE_STARTUP_REQUIRED_KEYS)[number];
  ```
- **PATTERN**: Mirror existing `EDITABLE_STARTUP_KEYS` block at lines 63–77 — same `as const` array + derived type.
- **GOTCHA**: Keep `""` in the value sets even though the create flow rejects empty strings — the update flow legitimately allows clearing back to empty. Reject the empty string at the create-route level, not at the type-set level.
- **VALIDATE**: `npx tsc --noEmit`.

### UPDATE `app/api/startups/update/route.ts` — import shared sets

- **IMPLEMENT**: Replace lines 7–35 (`const STAGE_VALUES = ...`, `EMPLOYEES_VALUES`, `SECTION_VALUES`) with a single import from `@/lib/map/types`. Keep the rest of the file unchanged.
- **PATTERN**: Existing import on line 5 (`import { EDITABLE_STARTUP_KEYS } from "@/lib/map/types";`).
- **GOTCHA**: The update route currently uses `STAGE_VALUES.has(value)` etc. — that signature stays identical because we're exporting `Set<string>`-typed constants.
- **VALIDATE**: `npx tsc --noEmit`; manually claim+edit a test row to confirm no regression in `/api/startups/update`.

### CREATE `lib/startups/freeMailDomains.ts`

- **IMPLEMENT**: Export `FREE_MAIL_DOMAINS: Set<string>` and `isFreeMailDomain(domain: string | null | undefined): boolean`. Seed with the canonical providers listed in the "Patterns to Follow" block above. All entries lowercase, no leading dot, no `www.`.
- **IMPORTS**: None.
- **GOTCHA**: Don't try to be exhaustive. Add the top ~20 the user likely controls. Document at the top of the file: "Hand-maintained list. Add to it as new free providers surface in the wild."
- **VALIDATE**: `node -e "const {isFreeMailDomain}=require('./lib/startups/freeMailDomains.ts'); console.log(isFreeMailDomain('gmail.com'), isFreeMailDomain('acme.com'))"` (use tsx if needed) → `true false`.

### CREATE `lib/startups/normalize.ts`

- **IMPLEMENT**: Four pure functions:
  ```ts
  export function normalizeDomain(websiteOrDomain: string): string;     // hostname only, no www., lowercase
  export function normalizeLinkedInUrl(url: string): string;            // canonical https://www.linkedin.com/...
  export function getLinkedInSlug(url: string): string;                 // extracts /company/<slug>; "" if not a company URL
  export function slugifyName(name: string): string;                    // lowercase, dashes, ASCII only, max 60 chars
  ```
- **PATTERN**: Lift implementations of `normalizeDomain` (lines 65–73), `normalizeLinkedInUrl` (the `try { new URL(...) }` block), and `getLinkedInSlug` (`/\/company\/([^/?#]+)/` regex) verbatim from `scripts/geocode-startups.ts:60-90`. Add `slugifyName` from scratch:
  ```ts
  export function slugifyName(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFKD").replace(/[̀-ͯ]/g, "") // strip accents
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);
  }
  ```
- **IMPORTS**: None — pure helpers.
- **GOTCHA**: Do NOT modify `scripts/geocode-startups.ts`. Leave its inline copies; the import script is a one-off and we don't want to risk breaking the bulk-import path during the hackathon. Convergence can come later.
- **GOTCHA**: `getLinkedInSlug("")` must return `""`, not throw. The form will pre-validate the LinkedIn URL but server validation should be tolerant of empty strings if needed.
- **VALIDATE**: Run a one-off node check:
  ```bash
  npx tsx -e 'import {normalizeDomain,getLinkedInSlug,slugifyName} from "./lib/startups/normalize.ts"; console.log(normalizeDomain("https://www.Acme.IO/"), getLinkedInSlug("https://linkedin.com/company/acme-corp/?ref=x"), slugifyName("Acme Café & Co."))'
  ```
  Expect: `acme.io  acme-corp  acme-cafe-co`.

### CREATE `app/api/startups/create/route.ts`

- **IMPLEMENT**: A `POST` handler that orchestrates:
  1. Parse body. Required fields: `name`, `website`, `linkedin_url`, `address`, `description`, `stage`, `employees`, `section`. Optional: `year_founded` (integer 1800–2100), `hiring` (boolean). Reject 400 on missing/wrongly-typed.
  2. `const supabase = await createServerClient(); const { data: { user } } = await supabase.auth.getUser();` — 401 if missing, anonymous, unconfirmed, or no email.
  3. `extractEmailDomain(user.email)` — 401 if null.
  4. `isFreeMailDomain(emailDomain)` — 403 with `error: "Use a company email"`.
  5. `normalizeDomain(body.website)` → `websiteDomain`. If `!matchesStartupDomain(emailDomain, websiteDomain)` → 403 with `error: "Email domain must match the website domain"`.
  6. Validate `stage`, `employees`, `section` against `STAGE_VALUES` / `EMPLOYEES_VALUES` / `SECTION_VALUES`. Reject the empty string for create even though the set contains it.
  7. Service-role admin client init (mirror claim route lines 39–45).
  8. **Duplicate-domain short-circuit**: `admin.from('startups').select('slug, name').eq('domain', websiteDomain).limit(1).maybeSingle()`. If a row exists → respond `409` with `{ error: "A startup at that domain already exists", existingSlug: row.slug, existingName: row.name }`.
  9. `geocodeAddress(address)` → 422 with `error: "Address could not be located"` if null.
  10. Build the slug base: `getLinkedInSlug(body.linkedin_url) || slugifyName(body.name)`. If empty → 400 ("Could not derive a slug; check your LinkedIn URL or company name").
  11. `pickUniqueSlug(admin, base)` → resolves a non-colliding slug.
  12. Insert via service role:
      ```ts
      const insertPayload = {
        slug,
        name: body.name.trim(),
        linkedin_url: normalizeLinkedInUrl(body.linkedin_url),
        website: body.website.trim(),
        domain: websiteDomain,
        logo_url: `https://logo.clearbit.com/${websiteDomain}`,
        address: body.address.trim(),
        lat: geo.lat,
        lng: geo.lng,
        description: body.description.trim(),
        stage: body.stage,
        employees: body.employees,
        section: body.section,
        year_founded: typeof body.year_founded === "number" ? body.year_founded : null,
        hiring: typeof body.hiring === "boolean" ? body.hiring : null,
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
        jobs: [],
      };
      const { data: inserted, error } = await admin
        .from("startups")
        .insert(insertPayload)
        .select("slug")
        .single();
      ```
  13. If insert fails on the `slug` unique constraint (race), retry once with `pickUniqueSlug` — otherwise 500.
  14. Set `app_metadata.role = 'startupOwner'`:
      ```ts
      const existingMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
      await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...existingMetadata, role: "startupOwner" },
      });
      ```
  15. Return `NextResponse.json({ ok: true, slug: inserted.slug })`.
- **PATTERN**: Mirror `app/api/startups/claim/route.ts` for auth + service-role client + error shape.
- **IMPORTS**:
  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { createClient as createServerClient } from "@/lib/supabase/server";
  import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
  import { extractEmailDomain, matchesStartupDomain } from "@/lib/startups/domainCheck";
  import { isFreeMailDomain } from "@/lib/startups/freeMailDomains";
  import { normalizeDomain, normalizeLinkedInUrl, getLinkedInSlug, slugifyName } from "@/lib/startups/normalize";
  import { geocodeAddress } from "@/lib/startups/geocode";
  import { STAGE_VALUES, EMPLOYEES_VALUES, SECTION_VALUES } from "@/lib/map/types";
  ```
- **GOTCHA**: The `domain` column has no DB unique constraint (existing CSV-imported rows have collisions, e.g., subsidiaries). The duplicate-domain check is application-level only; that's by design. Don't add a unique index — it would break the existing dataset.
- **GOTCHA**: The `lat`/`lng` columns are `NOT NULL` in the schema; only insert after geocoding succeeds. Don't fall back to Utah centroid here (that's an import-script-only fallback).
- **GOTCHA**: `claimed_by` references `auth.users(id)` — make sure the user is *confirmed* before insert (`email_confirmed_at` non-null). Otherwise the FK still resolves but the user is half-formed and the create flow's promise of "verified ownership" is broken.
- **GOTCHA**: `body.linkedin_url` can be a bare URL like `linkedin.com/company/acme` — `normalizeLinkedInUrl` should canonicalize. If `getLinkedInSlug` returns empty after normalization, fall back to `slugifyName(body.name)`. If both fail (no LinkedIn URL AND nameless), reject 400.
- **VALIDATE**:
  ```bash
  # With dev server running and a confirmed test user logged in (cookie):
  curl -X POST http://localhost:3000/api/startups/create -H "Content-Type: application/json" --cookie "$(cat dev-cookie.txt)" -d '{ ... full payload ... }' | jq .
  ```
  Expect `{ ok: true, slug: "acme-corp" }`. Then re-submit the same payload → expect `409` with `existingSlug: "acme-corp"`.

### CREATE `hooks/useStartupCreate.ts`

- **IMPLEMENT**: A `useStartupCreate()` hook that returns:
  ```ts
  type CreateStep = "account" | "otp" | "details" | "submitting" | "created" | "duplicate" | "error";
  interface CreateState {
    step: CreateStep;
    email: string;
    password: string;
    details: Partial<DetailsForm>;
    error: string | null;
    isSubmitting: boolean;
    resendIn: number;
    createdSlug: string | null;
    duplicate: { slug: string; name: string } | null;
  }
  ```
  Plus methods: `submitAccount({ email, password })`, `submitOtp(token)`, `resendOtp()`, `submitDetails(details)`, `reset()`.

  State transitions:
  - **`account`** (initial): `submitAccount` runs `extractEmailDomain` + `isFreeMailDomain` client-side first. On success calls `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`. On success → step `otp`, start 30s resend cooldown. On `"already registered"` error → set `error: "An account already exists for this email. Log in instead."` and don't advance.
  - **`otp`**: `submitOtp(token)` calls `verifyOtp({ email, token, type: 'signup' })`. On success → step `details`. On error → stay on `otp` with error message. `resendOtp()` calls `supabase.auth.resend({ type: 'signup', email })` (same as claim flow's `resend`).
  - **`details`**: `submitDetails(details)` POSTs to `/api/startups/create`. While in flight: step `submitting`. On 200 → step `created` with `createdSlug`. On 409 → step `duplicate` with `{ slug, name }`. On other errors → step `details` with error message.
- **PATTERN**: Heavily mirror `hooks/useStartupClaim.ts` — copy structure and the `RESEND_COOLDOWN_MS` ref pattern (lines 20, 108–115, 193–203).
- **IMPORTS**:
  ```ts
  import { useCallback, useEffect, useRef, useState } from "react";
  import { createClient } from "@/lib/supabase/client";
  import { extractEmailDomain } from "@/lib/startups/domainCheck";
  import { isFreeMailDomain } from "@/lib/startups/freeMailDomains";
  ```
- **GOTCHA**: The hook MUST surface free-mail rejections client-side as a UX nicety, but the server still re-checks. Don't trust the client.
- **GOTCHA**: `submitDetails` should pre-process the form before POSTing: trim strings, parse `year_founded` to number-or-null, default `hiring` to false.
- **GOTCHA**: The `details` step's form values should live INSIDE the hook so they survive a step-back if the user edits the email after seeing the duplicate notice. But since the duplicate notice's only CTA is "claim instead → leave the page", form retention isn't critical for v1 — just keep the field state in `useState` inside `CreateDetailsStep` and lift only the submit handler. Document this trade-off.
- **VALIDATE**: Wire into a stub component, walk all three steps in the browser, watch the Network tab.

### CREATE `components/map/create/CreateLayout.tsx`

- **IMPLEMENT**: A full-screen black wrapper. Top-left has the Nexis wordmark linking back to `/map` via `<a href="/map">` (full-nav, not next/link). Centered column max-width `560px`, padding `48px 24px`. Children render inside.
- **PATTERN**: Mirror the map sidebar logo block (`MapSidebar.tsx:30-48`) for the link styling, and the landing-page max-width pattern (`app/page.tsx:107-119`).
- **GOTCHA**: Don't use `<Link>` — full nav is consistent with the map's own navigation pattern (see comment in `MapSidebar.tsx:25-29`).
- **VALIDATE**: Visual — render `<CreateLayout><div>hello</div></CreateLayout>` at `/map/new`; confirm the wordmark + centered column.

### CREATE `components/map/create/CreateAuthStep.tsx`

- **IMPLEMENT**: A form with two inputs (email + password), one submit button, plus a small subline `Use your company email — we'll verify ownership of the domain.` Uses `<input type="email" autoComplete="email" required>` and `<input type="password" autoComplete="new-password" required minLength={8}>`. On submit calls the parent's `onSubmit({ email, password })`. Disable the submit button while `isSubmitting`. Show server error inline.
- **PATTERN**: Combine `ClaimEmailStep.tsx:23-128` (email form) and `ClaimPasswordStep.tsx:23-124` (password form) into a single screen with one submit. Reuse the inline-style language exactly.
- **GOTCHA**: Surface a client-side preview of the free-mail rejection: if the user types `me@gmail.com` and tabs away, show `Free email providers aren't allowed. Use your company email.` in the error slot before they hit submit. The hook also rejects server-side, but the client check tightens the UX loop.
- **GOTCHA**: Display `8+ chars` minLength as a hint under the password field; don't gate submit on it client-side beyond the native `minLength` attribute (the server doesn't re-check; Supabase enforces ≥6 by default and we just want a friendlier minimum).
- **VALIDATE**: Render the step in `/map/new`, type `me@gmail.com` + a password → click Continue → see inline error before any network call.

### CREATE `components/map/create/CreateOtpStep.tsx`

- **IMPLEMENT**: Near-verbatim copy of `components/map/claim/ClaimOtpStep.tsx`. Only change is the subline text (e.g., "We sent a 6-digit code to {email} — enter it to verify your address.").
- **PATTERN**: Direct copy.
- **GOTCHA**: Strip non-digit input via `onChange` handler exactly as ClaimOtpStep does (line 55).
- **VALIDATE**: Visual; identical behavior to claim flow.

### CREATE `components/map/create/CreateDetailsStep.tsx`

- **IMPLEMENT**: A single long form with the following fields, in order:
  - **Company name** (text, required) — autofocus.
  - **Website** (url, required) — placeholder `https://acme.com`. The form pre-validates that `normalizeDomain(value)` matches the email's domain (use the email passed in via props from the parent). Display `Website domain must be {emailDomain}` as inline error if mismatch.
  - **LinkedIn URL** (url, required) — placeholder `https://linkedin.com/company/acme`. Pre-validate that `getLinkedInSlug(value)` is non-empty.
  - **Street address** (textarea, required) — placeholder `123 Main St, Salt Lake City, UT 84101`.
  - **Description** (textarea, required, max 1500 chars) — placeholder `What does your company do?`.
  - **Stage** (select, required) — options from `StartupStage` minus the empty string.
  - **Employees** (select, required) — options from `StartupEmployees` minus the empty string.
  - **Industry** (select, required) — options from `StartupSection` minus the empty string. Label "Industry" (not "Section") for the user-facing copy.
  - **Year founded** (number, optional, min 1800 max current year + 1) — placeholder `2024`.
  - **Hiring?** (checkbox, optional) — label `Currently hiring`.
  - **Submit** button: `Submit listing →`. While submitting, label `Submitting...`, disabled.
- **PATTERN**: Inline-style inputs/labels matching `ClaimEmailStep`. Use a vertical flex layout with `gap: 16px` between rows. Field labels uppercase 0.6875rem like `ClaimSection.tsx:42-50`.
- **IMPORTS**:
  ```ts
  import { COLORS } from "@/lib/map/mapConfig";
  import { normalizeDomain } from "@/lib/startups/normalize";
  import { getLinkedInSlug } from "@/lib/startups/normalize";
  ```
- **GOTCHA**: All required fields gate submit client-side. The server re-validates everything — never trust the form.
- **GOTCHA**: For selects, render a `<select>` element with inline-styled appearance to match the dark theme. shadcn's `Select` is not used here (would break the inline-style invariant inside `components/map/*`).
- **GOTCHA**: Year-founded `min` should be `1800` and `max` should be `new Date().getFullYear() + 1` (some companies "incorporate next year"). The server uses `1800–2100` — narrower client range is fine.
- **VALIDATE**: Render the step. Type a website URL with a different domain than the test email → submit blocked with inline error. Fill everything correctly → form submits.

### CREATE `components/map/create/DuplicateDomainNotice.tsx`

- **IMPLEMENT**: A small notice card shown when the server returns 409 with `existingSlug`. Copy:
  > A startup at **{websiteDomain}** is already on the map: **{existingName}**. If that's your company, claim it instead.
  Action: a button `Claim {existingName} →` that navigates to `/map?startup={existingSlug}` via `<a href>` (full nav). Below: a smaller link `That's not us — try a different domain` that calls `onRetry()` to step back to `account`.
- **PATTERN**: Reuse the InfoPanel button shape (lines 301–328) for the primary action.
- **GOTCHA**: Don't try to merge accounts. The user we just created sticks around as a confirmed user; if the duplicate's existing `claimed_by` is null, the claim flow will succeed for them; if it's already claimed by a different user, the claim flow will reject — that's the right behavior.
- **VALIDATE**: Force a 409 by re-submitting an existing-domain payload. Click "Claim {name}" → land on `/map?startup=<slug>` with the InfoPanel auto-open and the claim flow available.

### CREATE `components/map/create/CreateStartupClient.tsx`

- **IMPLEMENT**: The orchestrator. Reads `useStartupCreate()`, renders the right step inside `<CreateLayout>` with `<AnimatePresence mode="wait">`. After step `created`, schedules `router.replace('/map?startup=' + createdSlug)` after a 500ms reveal animation showing `Listing created — opening your pin...`.
- **PATTERN**: Mirror `components/map/claim/ClaimSection.tsx:54-98` for the AnimatePresence + step-key approach.
- **IMPORTS**:
  ```ts
  "use client";
  import { useRouter } from "next/navigation";
  import { motion, AnimatePresence } from "framer-motion";
  import { useStartupCreate } from "@/hooks/useStartupCreate";
  import { CreateLayout } from "./CreateLayout";
  import { CreateAuthStep } from "./CreateAuthStep";
  import { CreateOtpStep } from "./CreateOtpStep";
  import { CreateDetailsStep } from "./CreateDetailsStep";
  import { DuplicateDomainNotice } from "./DuplicateDomainNotice";
  ```
- **GOTCHA**: `router.replace` (not `push`) so the `/map/new` page is replaced in history — the user can't accidentally go "back" to a half-completed form.
- **GOTCHA**: After `created`, use `<motion.div>` with a 400ms fade-in for the success copy before navigation. Total time-on-success-screen ≤ 900ms.
- **VALIDATE**: Manually walk the full flow in the browser end-to-end.

### CREATE `app/map/new/page.tsx`

- **IMPLEMENT**: A server component that just renders `<CreateStartupClient />`. No data fetching needed. Add Next.js metadata (`title: "Add your startup — Nexis"`).
- **PATTERN**: Mirror `app/map/page.tsx` shape but without the `Suspense` since there's no async data.
- **IMPORTS**:
  ```ts
  import type { Metadata } from "next";
  import { CreateStartupClient } from "@/components/map/create/CreateStartupClient";
  export const metadata: Metadata = { title: "Add your startup — Nexis" };
  export default function MapNewPage() { return <CreateStartupClient />; }
  ```
- **GOTCHA**: This route should NOT be SSR'd through any wrapper that mounts mapbox-gl; it's a plain auth+form page with no map. Don't accidentally import `MapView` here.
- **VALIDATE**: `/map/new` renders the form; no console errors; `npm run build` succeeds.

### UPDATE `components/map/MapSidebar.tsx` — add CTA

- **IMPLEMENT**: Append a small block below the existing filters block (after the closing `</div>` of `hasFilters && ...` at line 120) containing:
  ```tsx
  <div style={{ marginTop: "auto", paddingTop: "32px", textAlign: "center" }}>
    <p
      style={{
        fontFamily: "ui-sans-serif, system-ui, -apple-system",
        fontSize: "0.8125rem",
        color: COLORS.textMuted,
        margin: 0,
      }}
    >
      Don&apos;t see your company?
    </p>
    {/* Full nav, not next/link — matches the existing logo link rationale */}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a
      href="/map/new"
      style={{
        display: "inline-block",
        marginTop: "8px",
        fontFamily: "ui-sans-serif, system-ui, -apple-system",
        fontSize: "0.875rem",
        color: COLORS.accent,
        textDecoration: "none",
        letterSpacing: "0.05em",
      }}
    >
      Add it →
    </a>
  </div>
  ```
- **PATTERN**: Same `<a href>` rationale as `MapSidebar.tsx:31-48` (full nav wipes mapbox-gl state cleanly).
- **GOTCHA**: The existing layout uses `marginTop: "auto"` already on the inner block (line 52). Verify the new block lands at the bottom of the sidebar without breaking the vertical centering. If the layout fights, wrap inside the existing inner column rather than as a sibling.
- **VALIDATE**: Visual; click the link → land on `/map/new`; back-button returns to `/map` without breaking pin clustering.

### UPDATE `components/map/MapClient.tsx` — handle `?startup=<slug>` deep-link

- **IMPLEMENT**: Add a `useSearchParams()` reader inside `MapClient`. On mount, if `searchParams.get("startup")` matches a `startup.slug` in the props array, call `useMapStore.getState().setSelectedStartup(match)`. Run only once per slug-and-mount.
- **PATTERN**: New code; place it near the existing `useEffect` that detects mobile (lines 58–64).
  ```tsx
  import { useSearchParams } from "next/navigation";
  import { useMapStore } from "@/lib/map/store";
  // ...
  const searchParams = useSearchParams();
  useEffect(() => {
    const slug = searchParams.get("startup");
    if (!slug) return;
    const match = startups.find((s) => s.slug === slug);
    if (match) {
      useMapStore.getState().setSelectedStartup(match);
    }
    // Empty deps → run once on mount; ignore later searchParams changes
    // because the user may legitimately close the panel without us re-opening it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  ```
- **GOTCHA**: Reading `useSearchParams()` requires a `Suspense` ancestor in Next 16. `app/map/page.tsx` already wraps `MapContent` in `<Suspense>` (line 45) — confirm `MapClient` mounts inside that boundary. If TypeScript complains, the existing setup is fine; just make sure the import path is `next/navigation` (App Router), not `next/router`.
- **GOTCHA**: Do NOT include `searchParams` or `startups` in the deps array — that would re-fire if the user navigates internally and the URL still has the param, fighting their attempt to close the panel.
- **GOTCHA**: `MapView` already exists; if the map's `handleMarkerClick` does anything beyond `setSelectedStartup` (e.g., camera fly-to), this deep-link won't trigger that camera move. **Decision for v1**: opening the panel without flying the camera is acceptable — the user will usually be at the Utah-wide view and the marker is visible. If polish is needed later, add a `flyTo` call inside the warm-path detector once `selectedStartup` is set.
- **VALIDATE**: `/map?startup=<known-slug>` → InfoPanel auto-opens for that startup. `/map` (no param) → no panel.

### APPEND `ai-context/SECURITY.md`

- **IMPLEMENT**: Add a new section under "Map Claim Flow":
  ```markdown
  ### Map Self-Serve Add Startup (Feature: self-serve-add-startup)
  - The `/api/startups/create` route is gated on a confirmed, non-anonymous Supabase user (`email_confirmed_at !== null`). Anonymous and unverified sessions are rejected with 401.
  - Free-mail providers are blocked server-side via `lib/startups/freeMailDomains.ts`. The client check is UX only; the server re-runs the same lookup.
  - Email-domain ↔ website-domain match is enforced server-side via `matchesStartupDomain(extractEmailDomain(user.email), normalizeDomain(body.website))`. A user with a corporate email cannot add a startup whose website lives on a different domain.
  - Duplicate-domain protection: the route queries `startups.domain = <new>` before insert and returns 409 with `existingSlug` so the client can redirect to the existing pin's claim flow. There is no DB-level unique constraint (the imported dataset has legitimate domain duplicates), so the application-level check is the only line of defense — keep it.
  - Slug uniqueness: `pickUniqueSlug` retries with numeric suffixes; collisions are bounded at 50 attempts per insert (paranoid guardrail).
  - `app_metadata.role = 'startupOwner'` is set via the service-role admin API after a successful insert. Users cannot self-elevate.
  - All writes flow through the service-role client. The `startups` table keeps the existing "public read" RLS; no client-side write privilege is granted.
  - The `claimed_by` FK to `auth.users(id)` ensures the inserted row's owner is a real, confirmed user.
  - **Post-MVP**: rate-limit `/api/startups/create` per IP (currently unlimited), and consider a CAPTCHA or hCaptcha gate to prevent automated farm-up of fake listings.
  ```
- **PATTERN**: Mirror existing entry style (`SECURITY.md:76-84`).

### APPEND `ai-context/INEFFICIENCIES.md`

- **IMPLEMENT**: Add a new "Current" entry:
  ```markdown
  ### Add Startup — Hand-maintained free-mail blocklist + no rate limit (Feature: self-serve-add-startup)
  **Impact:** Low
  **Context:** `lib/startups/freeMailDomains.ts` is a hand-curated list of ~20 canonical free-mail providers. Newer privacy-mail or regional providers will not be caught until the list is updated. Additionally, `/api/startups/create` has no rate limiting, so a determined actor with a valid corporate domain could spam the table with off-brand variations.
  **Ideal solution:** Use a maintained blocklist library (e.g., the `disposable-email-domains` repo) refreshed via a build step; add per-IP rate limiting (5 creates/hour) and per-domain rate limiting (1 create/domain/day) at the route level, using Vercel KV or Supabase Edge.
  **Workaround in place:** Hand-maintained list covers the top 20 providers (~95% of expected misuse). Domain match + Mapbox geocoding requirement raise the cost of casual abuse. Rate limiting deferred to post-MVP.
  ```
- **PATTERN**: Mirror existing entries (`INEFFICIENCIES.md:33-37`).

---

## TESTING STRATEGY

This codebase has no automated test framework wired up. Mirror the established pattern: manual end-to-end browser validation, with curl smoke tests for the API routes.

### Manual end-to-end (golden path)

1. `npm run dev`. Open `/map`. Click `Add it →` in the sidebar → arrives on `/map/new`.
2. Type `me@gmail.com` + any password → see inline error `Free email providers aren't allowed.` Don't advance.
3. Type `me@<your-test-domain>.com` + an 8+ char password → click Continue. Observe Supabase email arriving with the 6-digit code (template confirmed in Studio).
4. Enter the OTP → step `details`.
5. Type a website URL whose domain doesn't match the email → see inline error before submit.
6. Type matching website + LinkedIn URL + address + description + select stage/employees/section → click `Submit listing →`. Watch the Network tab for the POST.
7. On 200, see `Listing created — opening your pin...`, then auto-redirect to `/map?startup=<new-slug>`. The InfoPanel opens for the new pin; the new pin shows on the map at the geocoded location with the Clearbit logo (or initials fallback if Clearbit doesn't have it).
8. Close + re-open the panel → "Edit listing" button is visible (the user is the owner).
9. Click "Edit listing" → existing edit flow works (regression check on the update route's shared validators).

### Edge cases

- **Free-mail domain on the server**: even if a user bypasses the client check (e.g., disabled JS, raw curl), the server returns 403.
- **Mismatched website**: same, server-authoritative.
- **Duplicate domain**: submit a payload whose `website` domain is `acme.com` when an `acme.com` startup already exists → server returns 409 with `existingSlug`. UI shows `DuplicateDomainNotice` linking to `/map?startup=acme-corp`. Click it → claim flow available.
- **Slug collision**: two simultaneous creates with the same `name` and no LinkedIn URL → second one gets `acme-2`. Verify by inserting two rows with the same slugified name.
- **Bad address**: type a nonsense address → server returns 422 `Address could not be located`. Form re-renders with error inline.
- **Wrong OTP**: error shown; retry allowed; resend disabled for 30s.
- **`signUp` for an email that already has an account**: client surfaces `An account already exists for this email. Log in instead.` Document this as a hackathon limitation — full account recovery is out of scope.
- **Anonymous user lands on `/map/new`**: the form lets them through the auth step (signUp creates a fresh user); the backend's `is_anonymous` check rejects only when their `auth.getUser()` is anonymous after the route is called. This shouldn't happen because `verifyOtp` swaps the session, but the 401 is defensive.
- **Non-Utah address**: Mapbox returns coordinates outside Utah's bounds. The `startups` table doesn't gate on Utah-bounds, so the row is inserted but the marker shows up off-map. Acceptable for hackathon — add a Utah-bounds check post-MVP.
- **Mobile (`width < 768`)**: `/map/new` should be usable on mobile. Confirm the form scrolls cleanly inside `100dvh`. Use `padding: 24px` and a stacked column with no horizontal overflow.

---

## VALIDATION COMMANDS

Execute every command. The goal is zero regressions.

### Level 1: Syntax & Style

```bash
npm run lint
npx tsc --noEmit
```

### Level 2: Production build

```bash
npm run build
```

Catches client/server boundary violations (e.g., `lib/startups/geocode.ts` accidentally imported from a client component) and `useSearchParams`-without-Suspense errors.

### Level 3: Dev server + manual end-to-end

```bash
npm run dev
```

Walk through the manual end-to-end above. Watch the dev console for unhandled rejections.

### Level 4: DB inspection

After completing one create end-to-end:

```sql
-- Run in Supabase Studio SQL editor
select slug, name, domain, claimed_by, claimed_at, lat, lng
from startups
where claimed_at is not null
order by claimed_at desc
limit 5;
```

Expect: a row with the new test slug, `claimed_by` matching your test user's UUID, sensible lat/lng, and `claimed_at` close to now.

```sql
select count(*) from startups where domain = '<your-test-domain>.com';
```

Expect: exactly 1.

### Level 5: Curl smoke tests

```bash
# Unauthenticated → 401
curl -X POST http://localhost:3000/api/startups/create \
  -H "Content-Type: application/json" \
  -d '{"name":"X","website":"https://x.com","linkedin_url":"https://linkedin.com/company/x","address":"123 Main St, SLC, UT","description":"x","stage":"Seed","employees":"1","section":"B2B Software"}'

# Authenticated as confirmed user with mismatched website domain → 403
# Authenticated correctly with duplicate domain → 409 + existingSlug
# Authenticated correctly with new domain → 200 + slug
```

(Get an access token from a browser dev-tools cookie jar to replay the authenticated cases.)

---

## ACCEPTANCE CRITERIA

- [ ] `/map/new` renders an auth screen with email + password fields and the Nexis wordmark linking back to `/map`.
- [ ] Free-mail emails are rejected client-side with an inline error AND server-side with 403.
- [ ] After signUp, the user receives a 6-digit OTP code via email and can verify it on the OTP step.
- [ ] After OTP verification, the form lets the user enter all required fields (name, website, LinkedIn, address, description, stage, employees, section) and the optional fields (year founded, hiring).
- [ ] If the website domain doesn't match the email domain, the form shows an inline error before submit AND the server returns 403 if the client check is bypassed.
- [ ] If a startup already exists at the email's domain, the server returns 409 with `existingSlug` and the UI shows the duplicate notice with a deep-link to claim the existing pin.
- [ ] On successful create, the new row exists in `startups` with `claimed_by = user.id`, `claimed_at = now()`, sensible `lat/lng`, and a unique slug.
- [ ] The user's `app_metadata.role` is set to `startupOwner` after create — they can immediately use `/api/startups/update` on their new row without an extra claim step.
- [ ] After create, the client redirects to `/map?startup=<slug>` and the InfoPanel auto-opens for the new pin.
- [ ] The new pin shows the Clearbit logo (or initials fallback) and the entered address.
- [ ] The "Add it →" CTA appears in the map sidebar and full-navigates to `/map/new`.
- [ ] No regressions: anonymous voice intake, results, bubble field, map base interactions, and the existing claim flow all still work.
- [ ] `STAGE_VALUES` / `EMPLOYEES_VALUES` / `SECTION_VALUES` are exported from `lib/map/types.ts` and imported by both `/api/startups/create` and `/api/startups/update`.
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` succeeds.
- [ ] `ai-context/SECURITY.md` has a new entry; `ai-context/INEFFICIENCIES.md` has the free-mail / rate-limit entry.

---

## COMPLETION CHECKLIST

- [ ] Phase 1: shared sets exported, free-mail blocklist + normalize helpers added.
- [ ] Phase 2: `/api/startups/create` route end-to-end tested via curl.
- [ ] Phase 3: `useStartupCreate` + 5 step components + orchestrator + page render correctly.
- [ ] Phase 4: sidebar CTA + `?startup=<slug>` deep-link both working.
- [ ] Phase 5: SECURITY.md + INEFFICIENCIES.md updated.
- [ ] Manual end-to-end golden path completed in dev with a real Supabase OTP email round-trip.
- [ ] All edge cases verified.
- [ ] No client component imports `lib/startups/geocode.ts`.
- [ ] No client component imports `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Supabase email template "Confirm signup" still includes `{{ .Token }}` (already required by claim flow).

---

## NOTES

**Why a dedicated route (`/map/new`) instead of inline inside `InfoPanel`?**
The InfoPanel is `380px` wide on desktop and bottom-sheet on mobile — too narrow for ~10 form fields. The auth-then-form flow is also a context-switch (the user is leaving the map to onboard their company), and a quiet full-screen surface signals that more clearly. Reusing the existing `InfoPanel`-style chrome inside `/map/new` keeps the visual continuity without crowding the map.

**Why combine email + password on one screen but keep OTP separate?**
The claim flow split them because the user is mid-flow on the map — each step is a small commitment. For a brand-new startup, the user is already committed to the onboarding act; combining email+password is the standard sign-up convention and shaves one click. OTP must stay separate because the email round-trip happens between the password submit and the OTP entry.

**Why `claimed_by = user.id` on insert (vs. forcing a separate claim step)?**
The user just verified their email AND domain match, which is exactly the proof the existing claim flow requires. Forcing them to "claim" their own brand-new row would be theater. The `claimed_by` write happens atomically with the insert.

**Why no DB-level unique constraint on `domain`?**
The imported dataset has legitimate duplicates — subsidiaries, brand splits, agencies-and-clients. A unique constraint would break the import. Application-level dedupe is the right layer.

**Why hand-maintained free-mail list?**
A library like `disposable-email-domains` is ~5MB and updated by GitHub PR cadence. For a hackathon's scope, ~20 hand-picked entries cover the dominant ~95% of misuse. Documented as an inefficiency for post-MVP.

**Why redirect to claim flow on duplicate domain instead of allowing both?**
Duplicate listings on a small map are user-hostile. The claim flow is the right path for "I work at a company that's already on the map." If the existing row is already claimed by someone else, the claim flow returns 403 — that's the correct UX (the new user contacts the original claimer or the maintainer out-of-band).

**Forward compatibility.**
Adding a `created_via: 'csv_import' | 'self_serve'` column would be a one-line schema change later. Adding a Utah-bounds check on geocoded coordinates would be a one-line guard before insert. Replacing the hand-maintained free-mail list with an npm package would be a one-import swap.

**Failure mode: user closes the tab between OTP verify and details submit.**
The user is now a confirmed Supabase user with no `app_metadata.role`. They can't use `/api/startups/update` (yet) but they have an account. On return, they hit `/map/new` again, sign in (existing auth flow at `/auth/login`), and the form should pre-skip to the `details` step if their session is already authenticated. **Decision for v1**: don't implement session-resume — the user goes through the auth + OTP steps again with the same email; Supabase will return "already registered" and the UI pivots to "log in instead." Document as hackathon-acceptable.

**Failure mode: Mapbox geocode succeeds with bad coordinates (e.g., 0,0).**
The `lat/lng` `NOT NULL` constraint catches actual nulls; (0,0) lands the pin in the Atlantic Ocean. Add a Utah-bounds sanity check post-MVP (`lat 36–43, lng -114 to -109`).

**Confidence Score:** **8.5/10** for one-pass implementation. Risks:

- The `useSearchParams` deep-link on `MapClient.tsx` may need a `<Suspense>` adjustment in Next 16 — the existing page-level Suspense should cover it, but verify during build.
- The duplicate-domain UX has one corner: if `existingSlug` is already claimed by someone *else*, the redirect lands the user on a pin where the claim button is hidden. The user sees nothing actionable. Acceptable hackathon limitation; document inline in the duplicate notice copy.
- Slug-collision retry is bounded at 50 — astronomically safe for hackathon scope but technically race-able. Acceptable.
- The hand-maintained free-mail list will drift. Documented as an inefficiency.
