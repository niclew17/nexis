# Feature: Claim Startup Flow

The following plan should be complete, but validate documentation and codebase patterns before implementing. Read every file listed under CONTEXT REFERENCES before writing code.

Pay special attention to: existing inline-style conventions in `components/map/InfoPanel.tsx`, the anonymous-auth pattern in `hooks/useAnonymousAuth.ts`, and the service-role write pattern in `scripts/import-startups.ts`. All map UI uses inline styles — no Tailwind in the InfoPanel or its descendants.

## Feature Description

Add the ability for a startup's owner to claim and edit their listing on the Utah startup map. When a user clicks a startup marker, the InfoPanel surfaces a "Claim this startup" button (only when the startup has a verifiable `domain` and is not yet claimed). The button reveals an inline 3-step flow inside the same InfoPanel:

1. **Email** — user enters their company email; we client-side check that the domain matches `startup.domain` exactly, then continue.
2. **Password** — user creates a password; we call Supabase `signUp({ email, password })`. Supabase's email template (configured to use `{{ .Token }}`) sends a 6-digit code.
3. **OTP** — user types the 6-digit code; we verify via `verifyOtp({ email, token, type: 'signup' })`. On success the server route `/api/startups/claim` (1) re-validates the domain match, (2) sets `app_metadata.role = 'startupOwner'` on the user via the service-role admin API, (3) writes `claimed_by` and `claimed_at` on the `startups` row.

Once claimed, the InfoPanel shows an **Edit** button for the claimer. Edit mode lets the owner update description, website, stage, employees, section, hiring, name, address (server-side re-geocoded), logo URL, year founded, and jobs. Saves go through `/api/startups/update`, which verifies the user owns the row before persisting.

## User Story

As a Utah startup founder
I want to claim my company on the Nexis map and keep my profile current
So that prospective investors, recruits, and partners see accurate information about us.

## Problem Statement

Today, the `startups` rows are static and CSV-imported. There's no way for an owner to update their listing — name typos, stale stage/employee counts, broken websites, and missing logos all sit until the next manual import. There is also no identity model on the map, so we can't differentiate trusted owner-supplied data from imported data.

## Solution Statement

A self-serve claim flow gated on email-domain verification:

- **Verification**: an exact match between the email's domain (everything after `@`) and `startups.domain` (already normalized via `normalizeDomain` during import) is the proof-of-ownership signal. No domain on a startup → no claim button shown.
- **Auth**: Supabase Auth `signUp({ email, password })` with the email template configured to deliver a 6-digit token (`{{ .Token }}`). Verified via `verifyOtp({ type: 'signup' })`. A new user is created — we are not converting the visiting anonymous session.
- **Roles**: the role is stored on `auth.users.app_metadata.role` (set server-side using the service role key). Two values planned: `startupOwner` now, with room for one more later. App metadata is JWT-embedded and immutable from the client, which is exactly what we want for RLS-style decisions.
- **Writes**: all DB writes go through Next.js API routes using the service-role client (consistent with existing `scripts/import-startups.ts` pattern). The `startups` RLS stays "public read"; we never grant client-side update privileges.

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Medium-High
**Primary Systems Affected**: `components/map/InfoPanel.tsx` (rewritten), new `components/map/claim/*`, new `app/api/startups/claim/route.ts`, new `app/api/startups/update/route.ts`, new Supabase migration adding claim columns + jobs, Supabase Auth email template (config change in Studio).
**Dependencies (existing)**: `@supabase/ssr`, `@supabase/supabase-js`, `framer-motion`, `mapbox-gl`. No new npm packages.
**Config changes**: Supabase Studio → Authentication → Email Templates → "Confirm signup" must include `{{ .Token }}` so the user receives a 6-digit code (verified via `verifyOtp`). The existing magic link can stay as a fallback if desired.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `components/map/InfoPanel.tsx` (lines 1–261) — Why: the file to rewrite. Note the mobile vs desktop `panel.initial/animate/exit` choice (lines 22–34), the badge inline-style pattern (36–45), the action button inline-style (181–217), and the `× Close` and `← Back to Utah` patterns. **All claim UI must extend this file's existing inline-style language.**
- `lib/map/types.ts` (lines 30–53) — Why: the `Startup` type already has optional `claimed_at: string` and `claimed_by: string` declared. We're materializing those — make sure the new schema columns are reflected and the optional fields stay optional in the type.
- `supabase/migrations/20260509000000_create_startups.sql` (entire file) — Why: existing schema. New migration must add `claimed_by uuid REFERENCES auth.users(id)`, `claimed_at timestamptz`, and `jobs jsonb default '[]'::jsonb`. The PostGIS `location` and the `startups_set_location_trigger` already handle lat/lng → geography on update — re-geocoding does not need new trigger code.
- `lib/supabase/client.ts` (lines 1–9) — Why: browser client uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (NOT `_ANON_KEY`). Do not rename.
- `lib/supabase/server.ts` (lines 1–35) — Why: server pattern. Always create a new client per function. Use this for routes that need the user's session (e.g. `/api/startups/update` reads `auth.getUser()` to confirm ownership).
- `scripts/import-startups.ts` (lines 1–101) — Why: canonical service-role write pattern. The new claim/update routes mirror this for writes.
- `scripts/geocode-startups.ts` (lines 66–113) — Why: copy `normalizeDomain()` and `geocode()` verbatim into a server module so update-with-address re-geocodes the same way the import does. The Mapbox token resolution (`MAPBOX_API_TOKEN || NEXT_PUBLIC_MAPBOX_TOKEN`) must match.
- `hooks/useAnonymousAuth.ts` (lines 1–45) — Why: the user is already anonymously signed in when they hit the claim button. The new sign-up creates a *separate* user (per the chosen flow); after `signUp`, the browser session swaps from the anonymous user to the new pending user. This is fine — anonymous data on the map is unused anyway.
- `components/map/MapClient.tsx` (lines 50–120) — Why: shows where `MapView` mounts and where InfoPanel is reachable from. No changes required here, just understand the tree.
- `components/sign-up-form.tsx` (lines 30–57) — Why: existing `signUp` call signature; mirror exactly. Use `emailRedirectTo` only as a fallback path for users who click the magic link instead of typing the OTP. Keep `options.emailRedirectTo: \`${window.location.origin}/auth/confirm?next=/map\`` for safety.
- `app/auth/confirm/route.ts` (lines 1–30) — Why: the existing magic-link verifier. Don't change; it remains a fallback. We are using the `verifyOtp({ token })` path on the client instead, which is a different code path that doesn't go through this route.
- `components/auth/ConvertAccountForm.tsx` (lines 1–77) — Why: pattern reference for an inline auth state machine (`idle → email_sent → error`). The claim flow is a richer version of this with three concrete steps.
- `components/map/MapView.tsx` (lines 171–206) — Why: `handleMarkerClick` selects the startup; we hook into the same `selectedStartup` state — no changes needed in MapView.
- `app/api/process-answer/route.ts` (entire file) — Why: existing API-route pattern with input validation and error shape. Mirror the response/error shape: `NextResponse.json({ ... }, { status })`.
- `lib/matching/draftEmails.ts` — Why: existing pattern of a server-side helper module. Mirror for `lib/startups/geocode.ts` and `lib/startups/domainCheck.ts`.

### Existing Files That Change

- `components/map/InfoPanel.tsx` — REPLACE the static actions block (lines 172–256) with a state machine that toggles between "view", "claim flow", and "edit mode". Keep the header (lines 70–137), badges (139–153), description (155–170) intact in "view" mode.
- `lib/map/types.ts` — UPDATE the `Startup` interface: change `claimed_at?: string` and `claimed_by?: string` to non-optional in the type (DB defaults make them nullable). Add `jobs?: Array<{ title: string; url: string }>` if not already there (it's already declared — keep it).
- `app/map/page.tsx` (lines 8–22) — UPDATE the `select(...)` column list to include `claimed_by, claimed_at, jobs`.
- `ai-context/SECURITY.md` — APPEND a new "### Map Claim Flow (Feature: claim-startup-flow)" entry covering domain-check bypass risk, role-injection risk, and the choice to skip RLS writes in favor of service-role API routes.
- `ai-context/INEFFICIENCIES.md` — APPEND an entry on the per-update Mapbox geocoding API call (no caching) and the lack of a debounce on rapid edits.
- `.env.example` — No changes (`MAPBOX_API_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` are already documented).

### New Files to Create (in dependency order)

```
supabase/migrations/20260510000000_add_claim_columns.sql   ← claimed_by, claimed_at, jobs
lib/startups/domainCheck.ts                                ← extractEmailDomain + matchesStartupDomain
lib/startups/geocode.ts                                    ← server-side geocode() helper (extracted)
app/api/startups/claim/route.ts                            ← POST: verify session, set role, write claim
app/api/startups/update/route.ts                           ← POST: verify ownership, optional re-geocode, write update
components/map/claim/ClaimSection.tsx                      ← orchestrates email → password → otp inside InfoPanel
components/map/claim/ClaimEmailStep.tsx                    ← step 1: email + domain pre-check
components/map/claim/ClaimPasswordStep.tsx                 ← step 2: password + signUp call
components/map/claim/ClaimOtpStep.tsx                      ← step 3: 6-digit input + verifyOtp + claim API call
components/map/claim/ClaimSuccess.tsx                      ← success view + "Edit" button
components/map/claim/ClaimedBadge.tsx                      ← "Claimed" pill shown in InfoPanel for already-claimed startups
components/map/edit/EditPanel.tsx                          ← form for editable fields
components/map/edit/AddressField.tsx                       ← address textarea + saved-status indicator
hooks/useStartupClaim.ts                                   ← state machine: idle | email | password | otp_sent | verifying | claimed | error
hooks/useStartupOwnership.ts                               ← hydrates whether the current user owns the selected startup
```

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [Supabase: signUp](https://supabase.com/docs/reference/javascript/auth-signup)
  - Specific section: "Sign up with email and password"
  - Why: the entry point for step 2 of the claim flow.
- [Supabase: verifyOtp (email signup)](https://supabase.com/docs/reference/javascript/auth-verifyotp)
  - Specific section: `type: 'signup'` (token + email pair)
  - Why: confirms the 6-digit code from the email; differs from the magic-link path that uses `token_hash`.
- [Supabase: customize email templates with {{ .Token }}](https://supabase.com/docs/guides/auth/auth-email-templates)
  - Specific section: "Variables you can use" — `{{ .Token }}` is the 6-digit code.
  - Why: the Studio config change is required for the OTP path to work. Without it, the user receives only a magic link.
- [Supabase: admin updateUserById (set app_metadata)](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)
  - Specific section: "Update user attributes" with `app_metadata`
  - Why: how the server route sets `role: 'startupOwner'` immutably from the client's perspective.
- [Mapbox Geocoding v6 forward](https://docs.mapbox.com/api/search/geocoding-v6/#forward-geocoding)
  - Why: server-side re-geocoding on address edits. Same endpoint already used in `scripts/geocode-startups.ts:98`.
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
  - Specific section: `POST` handlers + `NextRequest` body parsing
  - Why: the new `/api/startups/*` routes follow this pattern.

### Patterns to Follow

**Inline styles in `components/map/*` (no Tailwind, no shadcn):**

```tsx
// from InfoPanel.tsx:181-217 — copy this exact button shape for "Claim this startup"
<button
  onClick={onClaim}
  style={{
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
  onMouseEnter={(e) => { /* same hover as Visit website */ }}
  onMouseLeave={(e) => { /* same */ }}
>
  Claim this startup
</button>
```

**Step transitions (mirror `components/intake/VoiceIntake.tsx` patterns):**

```tsx
import { motion, AnimatePresence } from "framer-motion";
<AnimatePresence mode="wait">
  <motion.div
    key={step}                              // step is "email" | "password" | "otp" | "success"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.25, ease: "easeOut" }}
  >
    {/* step body */}
  </motion.div>
</AnimatePresence>
```

**Server route shape (mirror `app/api/process-answer/route.ts`):**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const body = await req.json();
  // 1. Validate body shape (return 400)
  // 2. Get user via createServerClient — read auth.getUser() (return 401 if unauthenticated)
  // 3. Use service-role client for the privileged write
  // 4. Return NextResponse.json({ ok: true, ... })
}
```

**Service-role client (mirror `scripts/import-startups.ts:11-20`):**

```ts
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("missing service role envs");
const admin = createServiceClient(SUPABASE_URL, SERVICE_ROLE);
```

**Domain check (new helper):**

```ts
// lib/startups/domainCheck.ts
export function extractEmailDomain(email: string): string | null {
  const match = email.trim().toLowerCase().match(/^[^\s@]+@([a-z0-9.-]+)$/);
  return match?.[1] ?? null;
}

export function matchesStartupDomain(emailDomain: string, startupDomain: string): boolean {
  // Exact match per product decision. Both inputs are already lowercased.
  return emailDomain.trim() === startupDomain.trim().toLowerCase();
}
```

**Re-geocoding (new helper, lifted from `scripts/geocode-startups.ts:94-113`):**

```ts
// lib/startups/geocode.ts — server-side only
const TOKEN = process.env.MAPBOX_API_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  // identical implementation to scripts/geocode-startups.ts:94-113
}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation (database, types, helpers)

Get the schema, type, and shared helpers in place so that downstream UI can compile against them.

**Tasks:**
- New SQL migration: add `claimed_by uuid REFERENCES auth.users(id) on delete set null`, `claimed_at timestamptz`, `jobs jsonb not null default '[]'::jsonb`. Index on `claimed_by` for "what do I own" queries.
- Update `lib/map/types.ts` to reflect non-nullable optional fields plus `jobs` shape.
- Update `app/map/page.tsx` SELECT to include the new columns.
- Add `lib/startups/domainCheck.ts` with two pure functions (no Supabase imports).
- Add `lib/startups/geocode.ts` (server-only wrapper around the existing geocode logic).

### Phase 2: API routes

Lock down server-side trust boundaries before any UI is wired up.

**Tasks:**
- `POST /api/startups/claim`: body `{ slug }`. Reads the authenticated user (must be a confirmed user — i.e. `email_confirmed_at !== null`), loads `startup` by slug, asserts `startup.domain` exists, asserts the user's email domain matches, asserts `startup.claimed_by IS NULL`. On success, uses service-role admin to set `app_metadata.role = 'startupOwner'` and updates `startups` with `claimed_by = user.id, claimed_at = now()`.
- `POST /api/startups/update`: body `{ slug, patch: Partial<EditableStartup> }`. Reads authenticated user, loads `startup`, asserts `startup.claimed_by === user.id`. If `patch.address` differs from current, calls `geocodeAddress(patch.address)`; on success writes new `lat`/`lng` (the existing PostGIS trigger updates `location`). Sanitizes `patch` against an explicit allowlist — never trust client keys.

### Phase 3: Claim UI inside InfoPanel

Build the inline three-step flow that takes over the InfoPanel body.

**Tasks:**
- New `useStartupClaim.ts` hook holds `step | email | password | otp | error | resendDisabledUntil`. Exposes `submitEmail(email)`, `submitPassword(password)`, `submitOtp(token)`, `resend()`.
- `useStartupOwnership.ts` hook resolves whether the *current* signed-in user is the owner: `startup.claimed_by === user?.id && !user?.is_anonymous`.
- `ClaimSection.tsx` renders:
  - Idle: "Claim this startup" button (only shown when `startup.domain && !startup.claimed_by`).
  - Email step: input + domain pre-check + "Continue".
  - Password step: input + "Send code".
  - OTP step: 6-digit input (one `<input maxLength=6 inputMode="numeric">`, no fancy multi-input box for hackathon scope) + "Verify" + "Resend code" link disabled for 30s.
  - Success: "You now own {name}." + "Edit" button.
- Update `InfoPanel.tsx` to render `ClaimSection` (or `ClaimedBadge` + EditPanel for owners) in the actions slot.

### Phase 4: Edit mode

Reuse the same panel; show editable fields in place of the static body.

**Tasks:**
- `EditPanel.tsx`: a vertical form with description (textarea), website (input), name (input), address (textarea, with "Saving will re-locate the marker" hint), logo URL (input), stage (select: same enum as `StartupStage`), employees (select), section (select), hiring (checkbox), year founded (number), jobs (simple list editor — title + url repeating row).
- "Save" submits the diff to `/api/startups/update`. On success, mutate the local `selectedStartup` in the Zustand store so the UI reflects changes immediately.
- "Cancel" closes edit mode without saving.
- "Sign out" link at the bottom for testing/demo (calls `supabase.auth.signOut()`).

### Phase 5: Documentation + Supabase template

Capture the moving parts that aren't in code.

**Tasks:**
- Write `ai-context/SECURITY.md` entry describing the trust boundaries.
- Write `ai-context/INEFFICIENCIES.md` entry on geocoding API usage.
- Document the Supabase Studio email template change (Authentication → Email Templates → "Confirm signup" → ensure body contains `{{ .Token }}`) in a short note inside the plan completion comments + `ai-context/CLAUDE.md` if appropriate.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order. Each task is atomic and independently testable.

### CREATE `supabase/migrations/20260510000000_add_claim_columns.sql`

- **IMPLEMENT**: Add three columns to `startups`: `claimed_by uuid references auth.users(id) on delete set null`, `claimed_at timestamptz`, `jobs jsonb not null default '[]'::jsonb`. Create btree index `startups_claimed_by_idx` on `claimed_by`.
- **PATTERN**: Mirror style of `supabase/migrations/20260509000000_create_startups.sql:44-50` for index DDL.
- **GOTCHA**: Use `if not exists` on the index. Use `add column if not exists` on the columns to keep the migration replayable.
- **VALIDATE**: `npx supabase migration up` (or apply via Studio SQL editor). Then `select claimed_by, claimed_at, jobs from startups limit 1;` should return three nulls/empty array.

### UPDATE `lib/map/types.ts`

- **IMPLEMENT**: Keep `claimed_at?: string` and `claimed_by?: string` (they remain optional because rows can be unclaimed). Ensure `jobs?: Array<{ title: string; url: string }>` is present. Export a new `EditableStartupFields` type that lists the keys the update API will accept (description, website, stage, employees, section, hiring, name, address, logo_url, year_founded, jobs).
- **PATTERN**: Mirror existing exported type style at lines 30–53.
- **GOTCHA**: Don't remove `domain` — the claim button predicate reads it.
- **VALIDATE**: `npm run lint` and `npx tsc --noEmit`.

### UPDATE `app/map/page.tsx`

- **IMPLEMENT**: Change `.select("slug, linkedin_url, name, address, lat, lng, description, website, domain, logo_url, stage, employees, section, year_founded, hiring")` to also include `, claimed_by, claimed_at, jobs`.
- **PATTERN**: Single string columns list, comma-separated.
- **GOTCHA**: Order doesn't matter, but keep new fields at the end so a diff is small.
- **VALIDATE**: Open `/map` in dev, click any startup, log `selectedStartup.claimed_by` — should be `null` for fresh data.

### CREATE `lib/startups/domainCheck.ts`

- **IMPLEMENT**: Two functions: `extractEmailDomain(email): string | null` and `matchesStartupDomain(emailDomain, startupDomain): boolean`. Lowercase + trim both sides; exact equality only. Return null on malformed email rather than throwing.
- **IMPORTS**: None.
- **GOTCHA**: Don't strip `www.` from email side — emails don't have that prefix. Do strip from the `startupDomain` side just in case (the import script already does, but defensive).
- **VALIDATE**: Add a quick scratch test in node: `node -e "const {extractEmailDomain,matchesStartupDomain}=require('./lib/startups/domainCheck.ts'); console.log(matchesStartupDomain(extractEmailDomain('a@acme.com'),'acme.com'))"` → `true`. (Requires tsx; or write a one-off test file if you prefer.)

### CREATE `lib/startups/geocode.ts`

- **IMPLEMENT**: Export `async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null>`. Resolve token from `MAPBOX_API_TOKEN || NEXT_PUBLIC_MAPBOX_TOKEN`. On missing token, throw a clear error (server-only file, this is fine). Replicate the v6 forward geocoder URL exactly as in `scripts/geocode-startups.ts:97-99`.
- **PATTERN**: Mirror `scripts/geocode-startups.ts:94-113`.
- **GOTCHA**: This file is server-only. Do not import from any client component. Tag with a top comment: `// server-only — never import from a client component.`
- **VALIDATE**: Add a temporary route that calls it with `"123 Main St, Salt Lake City, UT"` and logs result. Remove after verifying.

### CREATE `app/api/startups/claim/route.ts`

- **IMPLEMENT**:
  1. `export async function POST(req: NextRequest)`. Parse body `{ slug: string }`. Reject 400 on missing/invalid.
  2. `const supabase = await createClient()` (server client). `const { data: { user } } = await supabase.auth.getUser()`. If `!user || user.is_anonymous || !user.email_confirmed_at` → 401.
  3. `extractEmailDomain(user.email)` → 401 if null.
  4. Service-role read of `startups` by slug. If not found → 404. If `!startup.domain` → 400 ("not claimable"). If `startup.claimed_by` → 409 ("already claimed").
  5. `matchesStartupDomain(...)` → 403 if false.
  6. Service-role admin: `admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata ?? {}), role: 'startupOwner' } })`.
  7. Service-role: `admin.from('startups').update({ claimed_by: user.id, claimed_at: new Date().toISOString() }).eq('slug', slug).is('claimed_by', null)`. If `data.length === 0` → 409 (race lost).
  8. Return `NextResponse.json({ ok: true, startup: { slug, claimed_by: user.id, claimed_at } })`.
- **PATTERN**: `app/api/process-answer/route.ts` for input validation + `NextResponse.json({...}, { status })` shape.
- **IMPORTS**: `NextRequest`, `NextResponse`, `createClient` from `@/lib/supabase/server`, `createClient as createServiceClient` from `@supabase/supabase-js`, `extractEmailDomain`, `matchesStartupDomain`.
- **GOTCHA**: The race-loss path (step 7's `.is('claimed_by', null)` precondition) is critical. Without it, two simultaneous claims could overwrite each other.
- **VALIDATE**: With curl, hit it unauthenticated → 401. After signing up + verifying OTP, hit it for a startup whose domain matches → 200 + row updated.

### CREATE `app/api/startups/update/route.ts`

- **IMPLEMENT**:
  1. Parse body `{ slug: string, patch: Record<string, unknown> }`. Reject 400 on missing.
  2. Server client → `auth.getUser()`. If `!user || user.app_metadata?.role !== 'startupOwner'` → 403.
  3. Service-role read of `startups` by slug → 404 if absent. If `claimed_by !== user.id` → 403.
  4. Whitelist `patch` keys against `EditableStartupFields`. Drop unknown keys silently. Validate types (string/boolean/number/jsonb-shaped jobs).
  5. If `patch.address && patch.address !== startup.address`: call `geocodeAddress(patch.address)`. On null, return 422 "address could not be located". On success, set `lat`/`lng` in the patch.
  6. Service-role update: `admin.from('startups').update(sanitizedPatch).eq('slug', slug).select().single()`. The `startups_set_location_trigger` will refresh the PostGIS column automatically when `lat`/`lng` change.
  7. Return `NextResponse.json({ ok: true, startup })`.
- **PATTERN**: same as the claim route.
- **GOTCHA**: Whitelist by hand — never spread the client patch directly into the update. Keys to allow: `description`, `website`, `name`, `address`, `logo_url`, `stage`, `employees`, `section`, `hiring`, `year_founded`, `jobs`. Notably exclude `slug`, `claimed_by`, `claimed_at`, `id`, `lat`, `lng`, `location`.
- **GOTCHA**: For `jobs`, do shallow validation: must be `Array<{ title: string; url: string }>` with each `title.length <= 80` and `url.length <= 300`.
- **VALIDATE**: After claiming a test startup, send `{ slug, patch: { description: "new" } }` → 200 and DB row updated. Send `{ slug, patch: { claimed_by: "spoof" } }` → 200 but `claimed_by` unchanged (silently filtered).

### CREATE `hooks/useStartupClaim.ts`

- **IMPLEMENT**: Returns `{ step, email, password, error, resendIn, submitEmail, submitPassword, submitOtp, resend, reset }`. Internally drives the state machine:
  - `idle` → user clicked "Claim this startup" → `email`.
  - `email` → `submitEmail(email)` validates domain client-side; sets `step = "password"` on match, sets `error` otherwise.
  - `password` → `submitPassword(password)` calls `supabase.auth.signUp({ email, password, options: { emailRedirectTo: '${origin}/auth/confirm?next=/map' } })`; on success, set `step = "otp"` and start the 30s `resendIn` countdown.
  - `otp` → `submitOtp(token)` calls `supabase.auth.verifyOtp({ email, token, type: 'signup' })`; on success, POST to `/api/startups/claim` with `{ slug }`; on success, set `step = "claimed"`.
  - `resend()` → debounced; calls `supabase.auth.resend({ type: 'signup', email })`. Reset countdown.
- **IMPORTS**: `useState`, `useRef`, `useEffect`, `createClient` from `@/lib/supabase/client`.
- **GOTCHA**: `signUp` will throw "User already registered" if the email exists. Handle this case and fall back to `signInWithOtp({ email })` for repeat-claimers, OR show a clear error and ask them to log in instead. For hackathon, simplest: surface the error and offer a "log in" link — defer the more elaborate path. Document this choice.
- **GOTCHA**: The `supabase.auth.signUp` call may auto-sign-in the user once OTP is verified — that's expected. The user's session changes from anonymous to `startupOwner`. Existing anonymous data on intake is unaffected because `intake_sessions.user_id` was already a different UUID; we don't try to merge.
- **VALIDATE**: Wire the hook into a stub component, walk through the three steps in the browser, watch the Network tab — `signUp` → email arrives with 6-digit code → `verifyOtp` returns 200 → `/api/startups/claim` returns 200.

### CREATE `hooks/useStartupOwnership.ts`

- **IMPLEMENT**: `useStartupOwnership(startup: Startup | null)`. Returns `{ isOwner: boolean, isReady: boolean, user: User | null }`. Internally subscribes to `supabase.auth.onAuthStateChange` and re-derives `isOwner = !!user && !user.is_anonymous && user.id === startup?.claimed_by`.
- **IMPORTS**: `useEffect`, `useState`, `createClient` from `@/lib/supabase/client`.
- **GOTCHA**: Re-fetch `getUser()` once on mount in addition to the subscription, because the subscription only fires on changes — not on the initial state.
- **VALIDATE**: Open the InfoPanel for a startup you've claimed; confirm `isOwner === true`.

### CREATE `components/map/claim/ClaimedBadge.tsx`

- **IMPLEMENT**: A small inline pill that says "Claimed" in `COLORS.accent` with a subtle `rgba(42,94,73,0.15)` background. Nothing else — keep the component dumb.
- **PATTERN**: Mirror `badgeStyle` from `InfoPanel.tsx:36-45`.
- **VALIDATE**: Snapshot the InfoPanel for a claimed startup; the pill should appear next to the name.

### CREATE `components/map/claim/ClaimEmailStep.tsx`

- **IMPLEMENT**: Single email input + "Continue" button. Below the input, render a tiny line: `Verifying ownership of {startup.domain}`. On submit, call the parent's `submitEmail`. Show the error message returned by the hook ("Email must be at @{startup.domain}").
- **PATTERN**: Mirror `components/auth/ConvertAccountForm.tsx:51-75`.
- **GOTCHA**: Use `type="email"` and `autoComplete="email"` so password managers and form fillers behave correctly.
- **VALIDATE**: With a domain mismatch, click Continue → see error inline.

### CREATE `components/map/claim/ClaimPasswordStep.tsx`

- **IMPLEMENT**: Password input (`type="password"`, `autoComplete="new-password"`, `minLength=8`) + "Send code" button. Show a small "We'll send a 6-digit code to {email}" subline.
- **PATTERN**: Mirror `components/sign-up-form.tsx:80-91`.
- **GOTCHA**: Disable the button while the request is in flight; show the literal text "Sending..." per existing convention (`sign-up-form.tsx:106`).

### CREATE `components/map/claim/ClaimOtpStep.tsx`

- **IMPLEMENT**: One input `<input maxLength={6} inputMode="numeric" pattern="\d{6}">` + "Verify" button. Resend link directly below: enabled after 30s, disabled with countdown text otherwise. Wire `submitOtp` and `resend` from the hook.
- **PATTERN**: Mirror the inline-style `Input` shape from `components/sign-up-form.tsx`. Don't introduce a multi-segment OTP component for hackathon scope — a single 6-char input is fine.
- **GOTCHA**: Strip non-digits in onChange before passing to state. The Supabase `verifyOtp` API expects the bare 6 digits, no formatting.

### CREATE `components/map/claim/ClaimSuccess.tsx`

- **IMPLEMENT**: "You now own {startup.name}." headline, brief subline ("Edit your listing or close to keep browsing"), an "Edit" button + "Close" button. Trigger `onEdit` and `onClose` via props.
- **PATTERN**: Reuse the action-button shape from `InfoPanel.tsx:181-217`.

### CREATE `components/map/claim/ClaimSection.tsx`

- **IMPLEMENT**: Top-level orchestrator. Wraps the four step components in `<AnimatePresence mode="wait">`. Reads `useStartupClaim()` and selects the visible step. The "Claim this startup" idle state is rendered when `step === 'idle'`. Handles error display.
- **PATTERN**: Animation pattern from `components/intake/VoiceIntake.tsx`.
- **GOTCHA**: Don't render this component at all if `!startup.domain || startup.claimed_by`. The InfoPanel decides whether to mount it.

### CREATE `components/map/edit/EditPanel.tsx`

- **IMPLEMENT**: A vertical form with one labeled row per editable field. On submit, build a diff of changed values (compare to the original `startup` prop) and POST to `/api/startups/update`. On success, update the Zustand store via `setSelectedStartup(updated)` so the panel reflects new values.
- **PATTERN**: Inline-style form pattern; reuse `Input`, `Label` from `components/ui/`.
- **GOTCHA**: For the address field, show a banner when changed: "Saving will move the marker to the new location." This sets correct expectations because re-geocoding can take a second or two.
- **GOTCHA**: For `jobs`, render a list of `(title, url)` rows with Add/Remove buttons. Cap at 10 rows for sanity.

### CREATE `components/map/edit/AddressField.tsx`

- **IMPLEMENT**: Wraps a textarea with a "changed" indicator. Pure presentational; the EditPanel's submit handler does the actual geocoding via the API route.
- **VALIDATE**: Visual only — confirm the indicator appears when the user types.

### UPDATE `components/map/InfoPanel.tsx`

- **IMPLEMENT**:
  1. Import `ClaimSection`, `ClaimedBadge`, `EditPanel`, `useStartupOwnership`.
  2. Replace the existing actions block (lines 172–256) with a small state machine: `view | claim | edit`.
  3. In `view` mode: render existing badges/description as today. If `startup.claimed_by`: show `<ClaimedBadge />` next to the name (in the header at line 96). If `isOwner`: show "Edit" button alongside Visit website / LinkedIn. If `!startup.claimed_by && startup.domain`: show "Claim this startup" button which sets local state to `claim`.
  4. In `claim` mode: render `<ClaimSection startup={startup} onClose={() => setMode('view')} onClaimed={() => setMode('view')} />`.
  5. In `edit` mode: render `<EditPanel startup={startup} onCancel={() => setMode('view')} onSaved={(updated) => { setSelectedStartup(updated); setMode('view'); }} />`.
- **PATTERN**: Keep the existing wrapper, header, badges, description blocks intact. Only the actions slot changes.
- **GOTCHA**: The "Back to Utah" link at the bottom should remain visible in `view` mode but hidden in `claim` and `edit` modes — the user is mid-task and accidental dismissal would lose progress.
- **VALIDATE**: Manually walk through claim → edit → save → reopen and confirm the badge appears.

### APPEND `ai-context/SECURITY.md`

- **IMPLEMENT**: Add a new "### Map Claim Flow (Feature: claim-startup-flow)" section documenting:
  - Domain check is exact-match server-side; client-side check is UX only.
  - `app_metadata.role` is set via service-role admin API; the client cannot self-elevate.
  - Race condition on simultaneous claims is mitigated by the `.is('claimed_by', null)` precondition on the UPDATE.
  - All writes go through service-role API routes; no client-side update privilege exists.
  - Re-geocoding uses `MAPBOX_API_TOKEN || NEXT_PUBLIC_MAPBOX_TOKEN` server-side; rate limit is whatever Mapbox's free tier allows.
- **PATTERN**: Mirror the existing entry style at lines 69–75.

### APPEND `ai-context/INEFFICIENCIES.md`

- **IMPLEMENT**: Add an entry under "Current" titled "### Claim — Per-update geocoding round-trip (Feature: claim-startup-flow)". Note that every address edit calls the Mapbox API; cache could be added if abuse becomes a concern. Impact: Low.
- **PATTERN**: Mirror the existing entry style at lines 33–37.

### CONFIG: Supabase Studio email template

- **IMPLEMENT**: This is a manual step, NOT a code change. Document at top of the plan completion notes:
  - Open Supabase Studio → Authentication → Email Templates → "Confirm signup".
  - Ensure body contains `{{ .Token }}` somewhere visible (e.g. "Your verification code is: `{{ .Token }}`"). Keep `{{ .ConfirmationURL }}` as a fallback magic link.
  - Save.
- **VALIDATE**: Trigger a signup; verify the email body contains a 6-digit code in addition to (or instead of) the magic link.

---

## TESTING STRATEGY

This codebase has no test framework wired up; the existing pattern is manual end-to-end validation in dev. Mirror that.

### Manual end-to-end (golden path)

1. `npm run dev`. Open `/map`. Click a startup with a `domain` populated and `claimed_by IS NULL`.
2. "Claim this startup" appears. Click it → email step.
3. Enter `wrong@example.com` → see inline domain-mismatch error.
4. Enter `me@{domain}` → password step.
5. Enter password ≥ 8 chars → "Send code". OTP step appears.
6. Check the email inbox; receive a 6-digit code (template confirmed in Studio).
7. Enter the code → success state.
8. Click "Edit" → form appears. Change description, save → InfoPanel re-renders with new description, server row updated.
9. Change address to "100 Main St, Park City, UT" → save → marker moves. Verify in DB that `lat`/`lng` updated.
10. Refresh the page; reopen the same startup; "Claimed" badge present, "Claim this startup" gone, "Edit" visible.

### Edge cases

- Startup with `domain = NULL`: claim button must NOT render.
- Startup already claimed by someone else: claim button must NOT render (badge does instead).
- Wrong OTP entered: inline error, retry allowed.
- Resend before 30s elapses: button disabled, countdown visible.
- `signUp` for an email that already has a Supabase account: clear error message, link to `/auth/login`.
- Anonymous user clicks "Claim" without going through signup: should never happen because the button leads through signUp first; defensive 401 from the API confirms it.
- Race: two browser tabs claiming the same startup at the same time — only one succeeds; the other gets a 409.
- Mobile (`width < 768`): bottom-sheet variant of the InfoPanel still fits the three-step flow without scrolling for short forms; password and OTP steps must remain reachable.

---

## VALIDATION COMMANDS

Execute every command. The goal is zero regressions.

### Level 1: Syntax & Style

```bash
npm run lint
npx tsc --noEmit
```

### Level 2: Dev server

```bash
npm run dev
```

Then walk through the manual end-to-end above. Watch the dev console for any unhandled rejections from the auth state machine.

### Level 3: Production build

```bash
npm run build
```

Catches any client/server boundary violations (e.g. `lib/startups/geocode.ts` accidentally imported from a client component).

### Level 4: DB inspection

```bash
# After applying the migration:
psql "${DATABASE_URL}" -c "\d startups"
# Expect: claimed_by uuid, claimed_at timestamptz, jobs jsonb in the column list.

# After completing one claim end-to-end:
psql "${DATABASE_URL}" -c "select slug, claimed_by, claimed_at, jobs from startups where claimed_by is not null;"
# Expect: one row with the test claim populated.
```

(If `psql` isn't available locally, use Supabase Studio's SQL editor for the same queries.)

### Level 5: Curl smoke tests for the API routes

Get an access token from a browser dev-tools (Application → Cookies → `sb-…-auth-token`), then:

```bash
# Unauthenticated → 401
curl -X POST http://localhost:3000/api/startups/claim \
  -H "Content-Type: application/json" \
  -d '{"slug":"some-slug"}'

# Authenticated but anonymous user → 401
# Authenticated as confirmed user but wrong domain → 403
# Authenticated correctly → 200 + DB row updated
```

---

## ACCEPTANCE CRITERIA

- [ ] Migration applied; `claimed_by`, `claimed_at`, `jobs` exist on `startups`.
- [ ] Clicking a marker for an unclaimed startup with a domain shows the "Claim this startup" button.
- [ ] Clicking the button reveals the inline 3-step flow (email → password → OTP).
- [ ] Email step rejects mismatched domains client-side with a clear error.
- [ ] Password step calls Supabase `signUp` and the user receives an email with a 6-digit code.
- [ ] OTP step verifies via `verifyOtp({ type: 'signup' })`, then calls `/api/startups/claim`.
- [ ] Server route re-validates the domain, sets `app_metadata.role = 'startupOwner'` via service-role admin API, and writes `claimed_by`/`claimed_at` atomically (rejects race with 409).
- [ ] Already-claimed startups show a "Claimed" badge and no claim button.
- [ ] The owner of a startup sees an "Edit" button and can update description, website, name, address (re-geocoded), logo URL, stage, employees, section, hiring, year founded, jobs.
- [ ] `/api/startups/update` whitelists allowed fields and rejects writes from non-owners with 403.
- [ ] Address edits trigger server-side Mapbox re-geocoding and the marker moves on next render.
- [ ] No regressions: anonymous voice intake, results, bubble field, map base interactions all still work.
- [ ] `npm run lint` and `npx tsc --noEmit` pass.
- [ ] `npm run build` succeeds.
- [ ] `ai-context/SECURITY.md` has a new entry; `ai-context/INEFFICIENCIES.md` has the geocoding entry.
- [ ] Supabase Studio email template "Confirm signup" includes `{{ .Token }}`.

---

## COMPLETION CHECKLIST

- [ ] All tasks executed in order.
- [ ] Migration ran cleanly.
- [ ] Manual end-to-end golden path completed in dev.
- [ ] All edge cases verified.
- [ ] No client component imports `lib/startups/geocode.ts`.
- [ ] No client component reads `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Supabase email template manual step done and noted in the PR description.

---

## NOTES

**Why not convert the anonymous user to a real one?**
Per product decision, claiming creates a fresh user via `signUp` (cleaner mental model; future second role is supported by the same `app_metadata.role` field). The cost is that the visiting anonymous session becomes orphaned — but the map flow doesn't depend on anonymous data (no intake rows, no progress to preserve). For users who *also* used the voice intake earlier in the same session, those intake rows remain tied to the original anon UUID; that's fine for hackathon scope.

**Why service-role API routes instead of Supabase RLS write policies?**
Two reasons. (1) RLS on writes would require auth.uid()-aware policies AND a way to set `app_metadata.role` from the client, which isn't possible (app_metadata is service-role-only). (2) Existing codebase pattern: every write goes through a service-role API route (`scripts/import-startups.ts`, `/api/match-resources`, etc.). Sticking with that pattern keeps the trust boundary single and obvious.

**Why pre-fill `app_metadata.role = 'startupOwner'` instead of inferring from `startups.claimed_by`?**
Two reasons. (1) The role field is the right place to add a *second* role (per product hint). (2) Putting role in JWT means future RLS policies can read it without a join. Even though we don't use RLS for writes today, this makes the future-add cheap.

**Failure mode: user lost the OTP email.**
After 1 hour Supabase OTPs expire. The "Resend code" button fixes this. If a user closes the tab mid-flow, on return they hit "Claim this startup" again — `signUp` for an existing email will error; the UI must show a clear error and offer `/auth/login` as a way back in. This is documented as a hackathon-acceptable limitation; full account recovery is out of scope.

**Forward compatibility.**
Adding a second role (e.g. `mapAdmin`) is a one-line change: the API route just checks `app_metadata.role === 'mapAdmin'` for any privileged endpoint. No schema change. Adding admin-edit-any-startup is a permission check change in `/api/startups/update`.

---

## CONFIDENCE SCORE

**8.5/10** for one-pass implementation. Risks:

- The Supabase email template is a Studio configuration change, not a code change — easy to forget. Surfaced explicitly in the plan and in acceptance criteria.
- `signUp` for an already-existing email returns a non-obvious error; the UI must handle this gracefully. Documented but UX is a judgment call.
- Mobile bottom-sheet panel may need height tuning when the multi-step flow expands. The existing `maxHeight: 60dvh` (line 27 of InfoPanel.tsx) should work; verify during manual testing.
