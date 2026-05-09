# Security Notes

---

## Environment Variables

Never commit `.env.local` to version control. Required secrets:

| Variable | Used by | Exposed to client? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API routes | No — server only |
| `DEEPGRAM_API_KEY` | Token generation route | No — server only |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client | Yes — public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client | Yes — public (anon only) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB writes | No — server only |
| `OPENAI_API_KEY` | Embedding generation | No — server only |

---

## Key Rules

- All Anthropic SDK calls are in `/app/api/` routes — never in client components
- Deepgram tokens are short-lived and generated server-side per session via `/api/deepgram-token`
- `SUPABASE_SERVICE_ROLE_KEY` is only imported in server-side files — never in any file that could be bundled client-side
- Raw transcripts and extracted answers are stored but not linked to any user identity in MVP

### Anonymous Auth (Feature: project-cleanup-anon-auth)

- Anonymous users are assigned `auth.uid()` on arrival via `signInAnonymously()`; all intake rows are linked to this UUID
- RLS on `intake_sessions` and `intake_answers` restricts reads/writes to the owning user (`user_id = auth.uid()`)
- The `/saved` route is guarded server-side against anonymous users via `lib/supabase/proxy.ts`
- **Conversion path**: use `updateUser({ email })` against the existing anonymous session — never call `signUp()` for existing anon sessions (creates a new user, orphans intake data)
- Anonymous sign-in rate limit: 30/hour/IP (Supabase default); enable Turnstile/hCaptcha in production to prevent bot abuse
- The anonymous UUID is preserved after conversion — no data migration needed

### Results Data Storage (Feature: voice-intake-ui-and-results)
- Matching results are stored in `sessionStorage['nexis-results']` for client-side results page rendering
- SessionStorage is isolated per tab/origin — no cross-site access risk
- Data is cleared when the tab closes — no persistent PII storage in browser
- `/api/deepgram-token` is unauthenticated in MVP; add rate limiting in production to prevent token harvesting
- The anonymous-to-real-account conversion uses `updateUser({ email })` on the existing anonymous session — never `signUp()` — to preserve intake data linkage

### Discovery Route — Input Validation (Feature: live-resource-discovery-bubbles)
- `/api/discovery/answer` accepts `answers[]`, `excludedIds[]`, and `questionIndex` from the client
- `excludedIds` is passed directly to the `score_resources_for_discovery` RPC as a Postgres UUID array — Supabase JS validates UUID format server-side; malformed strings will cause the RPC to error rather than return bad data
- `answers[].text` is embedded as a natural language string — injection risk is low (text goes to OpenAI embedding endpoint, not SQL interpolation); still validate `answers.length <= 4` and text fields have `maxLength: 500` enforced in the frontend input components
- `questionIndex` must be validated server-side: `0 <= questionIndex <= 3`; reject with 400 if out of range to prevent threshold logic bypass

### SQL Filter Input Validation (Feature: sql-deterministic-intake-filtering)
- `/api/process-answer` accepts `currentIds: string[]` from the client — passed to Supabase `.in("id", currentIds)`. Supabase JS validates UUID format before sending to Postgres; malformed values cause an error rather than SQL injection.
- Claude's `mappedValues` output is used in `.overlaps(column, mappedValues)` via Supabase's parameterized query layer (not string interpolation). Post-MVP: add a server-side whitelist check against `KNOWN_TOPICS / KNOWN_INDUSTRIES / etc.` before the SQL call.
- `rawTranscript` and `freeFormAnswer` go to Anthropic and OpenAI APIs respectively — not SQL-interpolated. Apply `maxLength: 1000` on frontend inputs.
- `questionIndex` is validated server-side: `0 <= questionIndex <= 4`, returning 400 for out-of-range values.

### Preliminary Founder Info — Prompt Injection via founderInfo (Feature: preliminary-founder-info-question)
- `founderInfo` (`name`, `businessName`, `role`) is extracted by Claude tool use in `/api/process-answer`, returned to the client, stored in hook state, re-submitted from the client to `/api/match-resources`, and injected into a Claude prompt in `draftEmails.ts`
- A user who crafts a malicious business name (e.g., containing prompt-injection instructions) could theoretically influence the email drafting output
- **Mitigation**: Truncate each `founderInfo` field to 100 characters server-side in `match-resources/route.ts` before passing to `draftEmails`. The fields come from Claude's structured tool output (not raw user input), reducing but not eliminating the risk
- **Post-MVP**: Add server-side validation that `founderInfo.name`, `.businessName`, `.role` contain no special characters used in prompt injection patterns

### AI Ranking + Email Results (Feature: ai-ranking-email-results)
- `allAnswers` (Q1–Q4 extracted summaries) is sent from the client to `/api/match-resources` — validate that `questionIndex` is an integer and `extractedAnswer` is a string before using; these values go into a Claude prompt (not SQL), so injection risk is low but prompt injection via crafted transcript answers is theoretically possible
- `filterIds` continues to be client-supplied UUIDs — Supabase JS validates UUID format before the `.in()` query; malformed values error before reaching Postgres
- `draftEmail` and `emailSubject` from Claude's response are rendered inside a `<p>` element with `whiteSpace: pre-wrap` — React's default escaping prevents XSS; do NOT use `dangerouslySetInnerHTML` with these values
- Clipboard API (`navigator.clipboard.writeText`) requires the page to be served over HTTPS or localhost — no security concern, just a browser constraint; fail silently in sandboxed contexts
- `mailto:` links constructed from `resourceEmail` (a database field) and Claude-generated content — the email address is parameterized via `encodeURIComponent`, not interpolated directly; no injection risk
- **Post-MVP**: validate `allAnswers.length <= 5` and `extractedAnswer.maxLength` server-side to prevent prompt-stuffing attacks

### Map Feature — Voice Transcript + External Logo Service (Feature: utah-startup-map)
- `/api/map/parse-filter` accepts user voice transcript — truncate to 500 chars server-side before Claude call to prevent prompt stuffing
- `NEXT_PUBLIC_MAPBOX_TOKEN` is a public token exposed to the client bundle — this is correct and expected for Mapbox public tokens; restrict it to the hackathon domain + localhost in the Mapbox dashboard access token settings
- Clearbit logo URLs (`logo.clearbit.com/{domain}`) are fetched by the browser — only public company domains from the `startups` table's `logo_url` column are used, no user data
- Startup data is served from the Supabase `startups` table (public RLS read policy); no static JSON file is served
- Voice filter does not store transcripts server-side; Claude is called with only the current transcript, no session context

### Map Claim Flow (Feature: claim-startup-flow)
- Domain check is exact-match server-side (`extractEmailDomain` + `matchesStartupDomain`) inside `/api/startups/claim`. The client-side check in the email step is UX only; the server re-verifies before any role/claim write so a tampered client cannot bypass it.
- `app_metadata.role = 'startupOwner'` is set via the service-role admin API (`auth.admin.updateUserById`). `app_metadata` is not writable by the user from any client context, so users cannot self-elevate. Future privileged endpoints can read this from the JWT without a DB join.
- Race condition on simultaneous claims is mitigated by the `.is('claimed_by', null)` precondition on the UPDATE in `/api/startups/claim` — the second writer's update affects 0 rows and gets a 409 instead of silently overwriting.
- All writes go through service-role API routes (`/api/startups/claim`, `/api/startups/update`). The `startups` table keeps "public read" RLS; no client-side update privilege exists. `/api/startups/update` requires `app_metadata.role === 'startupOwner'` AND `claimed_by === user.id` — both checks must pass.
- `/api/startups/update` whitelists `patch` keys against `EDITABLE_STARTUP_KEYS` and validates each value's type/enum membership. Client-supplied `claimed_by`, `claimed_at`, `slug`, `id`, `lat`, `lng`, `location` are silently dropped — the address path is the only way to mutate `lat`/`lng`, via server-side Mapbox geocoding.
- Re-geocoding uses `MAPBOX_API_TOKEN || NEXT_PUBLIC_MAPBOX_TOKEN` from `lib/startups/geocode.ts`. The file is server-only (top-of-file comment) and is only imported from API routes; never from client components. Rate limiting is whatever Mapbox's free tier allows — abuse mitigation is deferred to post-MVP.
- `signUp` for an email that already exists returns a generic error in the OTP step — we surface the message and tell the user to log in instead. We do not auto-log-in or merge accounts (anonymous data on the map is unused).
- `verifyOtp({ type: 'signup' })` swaps the browser session from anonymous to the new pending user. Existing intake data tied to the prior anonymous UUID stays orphaned — acceptable for hackathon scope; account merging is out of scope.

### Map Owner Delete (Feature: claim-startup-flow / owner-delete)
- `/api/startups/delete` requires `app_metadata.role === 'startupOwner'` AND `claimed_by === user.id` — same trust boundary as `/api/startups/update`. There is no admin bypass; every delete is owner-initiated.
- The DELETE is double-eq'd on `(slug, claimed_by)` so any race between the ownership read and the write affects 0 rows rather than dropping a row owned by someone else.
- Client UI (Edit panel danger zone) requires a two-click confirmation before sending the request. This is UX only — the server never sees the arming step and would honor a single direct POST from a verified owner.
- After delete the user's `app_metadata.role` is unchanged (`startupOwner` is harmless without an owned row — they can re-create or claim another listing without an extra round-trip).

### Map Self-Serve Add Startup (Feature: self-serve-add-startup)
- The `/api/startups/create` route is gated on a confirmed, non-anonymous Supabase user (`email_confirmed_at !== null`). Anonymous and unverified sessions are rejected with 401.
- Free-mail providers are blocked server-side via `lib/startups/freeMailDomains.ts`. The client check on `CreateAuthStep` is UX only; the server re-runs the same lookup before the role/insert writes.
- Email-domain ↔ website-domain match is enforced server-side via `matchesStartupDomain(extractEmailDomain(user.email), normalizeDomain(body.website))`. A user with a corporate email cannot add a startup whose website lives on a different domain.
- Duplicate-domain protection: the route queries `startups.domain = <new>` before insert and returns 409 with `existingSlug` so the client can redirect into the existing pin's claim flow. There is no DB-level unique constraint (the imported dataset has legitimate domain duplicates), so this application-level check is the only line of defense — keep it.
- Slug uniqueness: `pickUniqueSlug` retries with numeric suffixes; collisions are bounded at 50 attempts per insert.
- `app_metadata.role = 'startupOwner'` is set via the service-role admin API after a successful insert. Users cannot self-elevate.
- All writes flow through the service-role client. The `startups` table keeps the existing "public read" RLS; no client-side write privilege is granted.
- The `claimed_by` FK to `auth.users(id)` ensures the inserted row's owner is a real, confirmed user.
- **Post-MVP**: rate-limit `/api/startups/create` per IP and per email domain; consider Turnstile/hCaptcha to prevent automated farming of fake listings.

---

## Out of Scope (MVP)

- Rate limiting on API routes
- Row-level security on Supabase tables (no auth in MVP)
- Audit logging
- Input sanitization beyond what Claude's API inherently provides

---

## Post-MVP Security Work

- Add Supabase RLS when user accounts are introduced
- Rate limit `/api/process-answer` and `/api/match-resources` per IP
- Review data retention policy for voice transcripts
