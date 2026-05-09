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

### Intake — Mic permission requested after InstructionSlide (Feature: mic-permission-and-text-fallback)
**Impact:** Low  
**Context:** Permission dialog appears on the second button click ("Begin" on InstructionSlide), not the first ("Find your resources →"). Users may be surprised mid-flow.  
**Ideal solution:** Call `requestPermission()` on the first user gesture so the dialog appears immediately and the InstructionSlide can be read while permission resolves.  
**Workaround in place:** None — addressed directly in this feature.

---

### Discovery — IVFFLAT index over-parameterized for 213 rows (Feature: live-resource-discovery-bubbles)
**Impact:** Low  
**Context:** The `resources_embedding_idx` was created with `lists = 50` (IVFFlat). Recommended lists for pgvector is `sqrt(row_count)` ≈ 15 for 213 rows. With 50 lists and 213 rows, many list buckets contain ~4 rows — the index provides minimal benefit over a sequential scan and may actually be slower on cold cache.  
**Ideal solution:** `DROP INDEX resources_embedding_idx; CREATE INDEX ... USING ivfflat ... WITH (lists = 15);`  
**Workaround in place:** At 213 rows the performance difference is negligible for a demo — deferred to post-MVP.

---

### Discovery — d3-force + framer-motion on 213+ SVG nodes (Feature: live-resource-discovery-bubbles)
**Impact:** Medium  
**Context:** The bubble discovery feature runs d3-force simulation ticks at up to 60fps and React re-renders each tick for up to 213 nodes. Without `React.memo` on `ResourceBubble`, each tick re-renders all 213 components. Even with memo, SVG performance with framer-motion animated groups is heavier than canvas rendering would be.  
**Ideal solution:** Use an HTML5 Canvas with manual draw loop for the bubble field (pure performance), keeping framer-motion only for the enter/exit transition. OffscreenCanvas + Web Worker for the simulation would isolate physics from the main thread entirely.  
**Workaround in place:** `React.memo` on `ResourceBubble`, `requestAnimationFrame` throttle on position state updates, and limiting framer-motion to scale/opacity only (not position).

---

### Intake — Embedding called 4x per session in old discovery flow (Feature: sql-deterministic-intake-filtering)
**Impact:** Low  
**Context:** The old `/api/discovery/answer` route embedded cumulative answers after each of Q1-Q4 — 4 OpenAI embedding API calls per session. The new SQL-deterministic flow calls OpenAI embedding only once (for Q5 free-form), reducing API cost by 75%. Claude is called once per question (Q1-Q4) for enum mapping, which is more predictable and auditable than black-box embedding similarity.  
**Ideal solution:** Current approach is the ideal solution.  
**Workaround in place:** None needed — the new architecture eliminates this inefficiency.

---

### Matching — Two Claude calls per session with full descriptions (Feature: ai-ranking-email-results)
**Impact:** Medium  
**Context:** After removing OpenAI embeddings, ranking uses two sequential Claude calls: call 1 sends full resource descriptions for all remaining resources (30–80) to rank the top 3; call 2 writes 3 draft emails. Full descriptions are passed without truncation — at average 150 words per resource, call 1 sends ~12,000–18,000 words (~15,000–22,000 tokens) for the description payload. Well within Claude's 200K context but meaningfully more expensive than embedding-based retrieval.  
**Ideal solution:** For larger datasets (500+ resources), a hybrid approach: embedding pre-filter to top 20, then Claude ranks those 20 and writes emails. For 213 resources and a hackathon demo, full-description reading gives the best match quality.  
**Workaround in place:** Splitting into two calls (ranking vs. email drafting) keeps each call focused and its output token budget tight — call 1 is `max_tokens: 1024`, call 2 is `max_tokens: 3072`.

---

### Matching — mailto body length capped at 1800 chars (Feature: ai-ranking-email-results)
**Impact:** Low  
**Context:** The HTML mailto: URI scheme has a ~2000-char body limit enforced by most email clients. Draft emails generated by Claude may exceed this. The clipboard always receives the full text; only the mailto body is truncated.  
**Ideal solution:** Use a web-share API or deep-link to Gmail compose for longer emails. For MVP, clipboard fallback is sufficient.  
**Workaround in place:** `body.slice(0, 1800)` in the mailto URL; full email always copied to clipboard.

---

### Intake — Additional Claude call for Q0 founder-info extraction (Feature: preliminary-founder-info-question)
**Impact:** Low  
**Context:** The preliminary founder-info question (new Q0) requires a Claude tool-use call with `max_tokens: 256` to extract `name`, `businessName`, and `role`. This adds one serial API call before the user reaches the filtering questions, adding ~50–150ms latency at the start of the flow.  
**Ideal solution:** Extract name/business client-side via a regex heuristic ("I'm [Name] from [Company]") for the common case, falling back to Claude only when the heuristic fails.  
**Workaround in place:** The call is small (256 tokens max) and fires once per session. Acceptable for a hackathon demo. Post-MVP: consider a client-side extraction heuristic or batch Q0+Q1 into a single Claude call.

---

### Routing — Home page doubles as feature entry point (Feature: landing-page-and-routing-split)
**Impact:** Low  
**Context:** Pre-split, `/` directly renders the voice intake experience, making it impossible to add a second top-level feature (Map) without a home page split. The new architecture adds one route layer (`/resources`, `/map`) with a landing page at `/`.  
**Ideal solution:** Current plan is the ideal solution — a clean three-route structure.  
**Workaround in place:** None needed — resolved by this feature.

---

## Template

```
### [Area] — [Short description]
**Impact:** Low / Medium / High
**Context:** Why this decision was made (e.g., "time constraint during hackathon")
**Ideal solution:** What the right approach would be with more time
**Workaround in place:** What we're doing instead
```
