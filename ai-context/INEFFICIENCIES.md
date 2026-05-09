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

### Map — HTML markers for 255 startups (Feature: utah-startup-map)
**Impact:** Low  
**Context:** Using custom HTML markers (react-map-gl Marker) for all 255 startups. At low zoom, all markers are visible simultaneously — 255 DOM nodes + logo image loads. No clustering implemented.  
**Ideal solution:** At zoom <9, use Mapbox's native symbol/circle layer (GeoJSON source with `cluster:true`) for performance; switch to custom HTML markers when zoomed in past a threshold.  
**Workaround in place:** 255 HTML markers is performant enough for demo purposes. Logo images load lazily (natural browser behavior).

---

### Map — `public/startups.json` served by Next.js (Feature: map-load-state-bugfix)
**Impact:** Low  
**Context:** `geocode-startups.ts` writes the geocoded startup dataset to `public/startups.json` as an intermediate step before `import-startups.ts` loads it into Supabase. Once the import runs, the JSON has no runtime purpose but is publicly accessible at `/startups.json`. 142KB of company data is served to anyone who knows the URL.  
**Ideal solution:** Use `data/startups.json` (gitignored) for the intermediate file so it's never served by Next.js. Delete `public/startups.json` now that all data is in Supabase.  
**Workaround in place:** Addressed in `map-load-state-bugfix` — file deleted, script paths updated to `data/`.

---

### Map — Orbit rAF leaked across navigations (Feature: map-remount-bugfix)
**Impact:** Medium (cause of the post-navigation freeze symptom)  
**Context:** `startOrbit(map)` schedules a `requestAnimationFrame` loop that calls `map.setBearing(...)` 60×/sec. The loop was never cancelled on `MapView` unmount. Combined with `reuseMaps` (which preserves the underlying mapbox-gl instance across navigations), the rAF kept running on the new mount, fighting any camera reset and creating an unresponsive feel. Compounded the visual regression where `onLoad` doesn't re-fire on reused maps, so the dark-style config never re-applied.  
**Ideal solution:** Current solution — `useEffect` cleanup that calls `stopOrbit()` on unmount, paired with a warm-path detector that re-runs `runMapSetup()` when `map.loaded()` is already true on remount.  
**Workaround in place:** None needed — fixed in this feature.

---

### Claim — Per-update geocoding round-trip (Feature: claim-startup-flow)
**Impact:** Low  
**Context:** `/api/startups/update` calls Mapbox Geocoding v6 every time the address field changes — no caching, no debouncing. A claimer who repeatedly toggles the address (or a script that hammers the endpoint after compromising a session) burns Mapbox API quota one request per save. At hackathon scale (a handful of daily edits) this is well below Mapbox's free-tier limit.  
**Ideal solution:** Cache the `(address → lat/lng)` pair in a small server-side LRU keyed on the trimmed address; debounce or rate-limit per `claimed_by` (e.g. max 5 saves per minute). For abuse-resistance, gate the geocode call on whether the new address actually differs from the cached one for that startup.  
**Workaround in place:** None — the address-diff check in the route only suppresses the call when the address text is unchanged, not when it's recently been the same.

---

### Routing — Home page doubles as feature entry point (Feature: landing-page-and-routing-split)
**Impact:** Low  
**Context:** Pre-split, `/` directly renders the voice intake experience, making it impossible to add a second top-level feature (Map) without a home page split. The new architecture adds one route layer (`/resources`, `/map`) with a landing page at `/`.  
**Ideal solution:** Current plan is the ideal solution — a clean three-route structure.  
**Workaround in place:** None needed — resolved by this feature.

---

### Photos — Plain `<img>` instead of `next/image` (Feature: startup-photo-gallery)
**Impact:** Low  
**Context:** The InfoPanel's HeroGallery and PhotoManager render photos via plain `<img>` tags rather than `next/image`. Reasons: the codebase already uses raw `<img>` for the existing Clearbit logo (`StartupMarker.tsx:42-52`) and avoiding `next/image` avoids the `next.config.ts` `images.domains` whitelist hassle. Trade-off: no automatic resizing, no format negotiation (WebP/AVIF), no lazy-load attribute beyond the browser default.  
**Ideal solution:** Migrate to `next/image` with `images.remotePatterns` allowing the Supabase storage hostname; the optimizer handles resizing per device + auto-format conversion.  
**Workaround in place:** None needed for hackathon scale (≤8 photos × ≤5 MB on a fast page).

---

### Photos — No upload-time downscale or thumbnail generation (Feature: startup-photo-gallery)
**Impact:** Medium  
**Context:** A user uploading a 5 MB photo gets that exact 5 MB photo rendered as a 64×48 thumbnail in the InfoPanel strip. The browser downloads the full file even when displaying a tiny preview. At ~250 startups × 8 photos × 5 MB worst case = 10 GB of egress per fully-loaded map session.  
**Ideal solution:** Resize at upload time on the server (sharp / @vercel/og or a Supabase Edge Function transform); store both `<uuid>.jpg` and `<uuid>.thumb.jpg` and reference the thumbnail in the strip. Or use Supabase's image-transformation render endpoint (`?width=128&height=96`).  
**Workaround in place:** Deferred to post-MVP. The 5 MB cap and 8-photo limit bound the worst case.

---

### Photos — Per-photo round-trip on delete and reorder (Feature: startup-photo-gallery)
**Impact:** Low  
**Context:** Each photo deletion requires a round-trip to `/api/startups/photos/delete`; reordering N photos is one round-trip but still touches the full row. Deleting four photos in succession costs four DB reads + four storage removes + four full-row updates.  
**Ideal solution:** A bulk `DELETE` route accepting `paths: string[]`. Or: client-side optimistic update with a single `commit` route at panel close.  
**Workaround in place:** None — owner photo edits are rare enough to make the simple per-action route pattern acceptable.

---

### Photos — `req.formData()` body size capped on Vercel hobby tier (Feature: startup-photo-gallery)
**Impact:** Low  
**Context:** Vercel's hobby/free tier caps API request body at 4.5 MB; a 5 MB photo upload fails on that tier even though our app limit is 5 MB. The route is configured with `export const runtime = "nodejs"` to avoid the edge runtime's 1 MB cap, but the platform-level cap on hobby still applies.  
**Ideal solution:** Either (a) drop the per-photo cap to 4 MB; (b) require Vercel Pro for production; (c) switch to direct browser → bucket uploads with a presigned URL flow (adds RLS complexity).  
**Workaround in place:** Document the 4.5 MB ceiling and align the per-photo limit with the deployment plan before launch.

---

### Add Startup — Hand-maintained free-mail blocklist + no rate limit (Feature: self-serve-add-startup)
**Impact:** Low  
**Context:** `lib/startups/freeMailDomains.ts` is a hand-curated list of ~20 canonical free-mail providers. Newer privacy-mail or regional providers will not be caught until the list is updated. Additionally, `/api/startups/create` has no rate limiting, so a determined actor with one valid corporate domain could spam the table with off-brand variations of their own listing (within the slug-uniqueness retry cap).  
**Ideal solution:** Use a maintained blocklist library (e.g., the `disposable-email-domains` repo) refreshed via a build step; add per-IP rate limiting (5 creates/hour) and per-domain rate limiting (1 create/domain/day) at the route level via Vercel KV or Supabase Edge.  
**Workaround in place:** Hand-maintained list covers the top 20 providers (~95% of expected misuse). The email-domain ↔ website-domain match plus Mapbox geocoding requirement raise the cost of casual abuse. Rate limiting deferred to post-MVP.

---

## Template

```
### [Area] — [Short description]
**Impact:** Low / Medium / High
**Context:** Why this decision was made (e.g., "time constraint during hackathon")
**Ideal solution:** What the right approach would be with more time
**Workaround in place:** What we're doing instead
```
