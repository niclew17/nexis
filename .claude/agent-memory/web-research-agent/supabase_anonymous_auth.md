---
name: Supabase Anonymous Auth Research
description: API details, conversion flow, RLS implications, session persistence in Next.js App Router, known bugs and caveats for Supabase anonymous sign-in
type: reference
---

## Researched: 2026-05-07

### signInAnonymously API
- `const { data, error } = await supabase.auth.signInAnonymously()`
- Returns: `{ data: { user, session }, error }`
- Creates a real user in auth.users with is_anonymous=true, uses `authenticated` Postgres role
- Rate limit: 30 requests/hour per IP (configurable)
- CAPTCHA recommended for production

### Converting Anonymous → Permanent (Email/Password)
**Two-step process (documented flow):**
1. `await supabase.auth.updateUser({ email: 'user@email.com' })` — triggers email confirmation
2. After confirmation: `await supabase.auth.updateUser({ password: 'password' })` — sets password

**OAuth flow:** `await supabase.auth.linkIdentity({ provider: 'google' })` — requires "Manual Linking" enabled in Supabase dashboard

**CRITICAL: UUID is preserved** — "After they have been converted, the user id remains the same, which means that any data associated with the user's id would be carried over." (Supabase blog, primary source)

### Known Bugs (as of 2024, some resolved)
- Issue #29350: updateUser email auto-verifies (email written to email_change instead of email)
- Issue #1578: admin.updateUserById leaves provider=anonymous, cannot set password server-side
- Issue #1619: email verification required even when project has verification disabled — CLOSED/FIXED via PR #1646
- Discussion #29017: "Updating password of an anonymous user is not possible" (422) when calling updateUser({password}) before email verified
- **Key pattern from Discussion #22377:** Do NOT call signInWithOtp() on an anon user (clears the session). Instead: updateUser({email}), then after OTP verify, updateUser({password})

### RLS
- Anonymous users use `authenticated` role (same as permanent users)
- Differentiate via JWT claim: `(select (auth.jwt()->>'is_anonymous')::boolean)`
- MUST review existing RLS policies before enabling — anon users will pass `to authenticated` policies
- Use RESTRICTIVE policies to exclude anon users from certain operations

### Session Persistence in Next.js App Router
- Sessions stored in cookie: `sb-<project_ref>-auth-token`
- @supabase/ssr handles cookie read/write automatically
- Middleware must call updateSession (or getClaims) to refresh tokens before server components
- Anonymous sessions use same cookie mechanism as regular sessions
- Known issue (Discussion #33267, unanswered as of late 2024): signInAnonymously called from a server component cannot be picked up by client components in same render cycle
- RECOMMENDATION: Call signInAnonymously from client component or middleware, not server components

### Session Duration
- JWT access token: 1 hour default (configurable)
- Refresh tokens: indefinite by default, single-use with 10-second reuse window
- No different expiry behavior documented for anonymous vs permanent sessions
- autoRefreshToken: true handles refresh automatically in JS client

### Sources
- https://supabase.com/docs/guides/auth/auth-anonymous (primary, current)
- https://supabase.com/blog/anonymous-sign-ins (primary, April 2024)
- https://supabase.com/docs/reference/javascript/auth-signinanonymously (primary)
- https://supabase.com/docs/guides/auth/auth-identity-linking (primary)
- https://github.com/supabase/auth/issues/1578 (bug report)
- https://github.com/supabase/supabase/issues/29350 (bug report)
- https://github.com/supabase/auth/issues/1619 (bug report, resolved)
- https://github.com/orgs/supabase/discussions/29017 (community)
- https://github.com/orgs/supabase/discussions/22377 (community, working pattern)
- https://github.com/orgs/supabase/discussions/33267 (Next.js App Router issue, unanswered)
