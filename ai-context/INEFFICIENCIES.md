# Known Inefficiencies

Track performance bottlenecks, suboptimal patterns, and technical debt decisions made under time pressure.

---

## Current

### Auth — Two middleware entry points (Feature: project-cleanup-anon-auth)
**Impact:** Low  
**Context:** The project has both `proxy.ts` (Vercel Fluid compute) and `middleware.ts` (standard Next.js middleware). Both call the same `updateSession()` logic from `lib/supabase/proxy.ts`. This duplication is intentional for environment compatibility (local dev needs `middleware.ts`; Vercel edge uses `proxy.ts`).  
**Ideal solution:** A single middleware approach once the deployment target is finalized.  
**Workaround in place:** Both files share the `updateSession()` implementation — logic lives in one place, two entry points call it.

---

### Intake — Auth gate blocks immediate UI render (Feature: voice-intake-ui-and-results)
**Impact:** Low  
**Context:** The original `app/page.tsx` gated the entire intake UI on `isReady` from `useAnonymousAuth`, which means the page shows a blank black screen while the anonymous sign-in network call resolves (~200–400ms). The intake instruction slide can be rendered immediately.  
**Ideal solution:** Render the intake UI immediately; only defer first DB write (intake_sessions insert) until `user?.id` is available.  
**Workaround in place:** VoiceIntake renders immediately; session creation is deferred inside `useVoiceIntake` until sessionId is non-null.

---

## Template

```
### [Area] — [Short description]
**Impact:** Low / Medium / High
**Context:** Why this decision was made (e.g., "time constraint during hackathon")
**Ideal solution:** What the right approach would be with more time
**Workaround in place:** What we're doing instead
```
