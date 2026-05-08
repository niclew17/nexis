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
