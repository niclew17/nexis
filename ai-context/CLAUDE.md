# Nexis — CLAUDE.md

Nexis is a voice-first web app that helps Utah founders find relevant state resources in under two minutes. A founder speaks through four questions; the app runs a three-layer matching pipeline (structured filter → vector search → LLM synthesis) against 213 imported Utah state programs and returns 3–5 personalized results with one-sentence match explanations.

Full PRD: `ai-context/PRD.md`

---

## Commands

```bash
npm run dev        # start dev server (localhost:3000)
npm run build      # production build
npm run lint       # ESLint
npx tsx --env-file=.env.local scripts/<file>.ts   # run a script with env loaded
```

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15, App Router, TypeScript |
| Styling | Tailwind CSS + shadcn/ui (CSS variables) |
| Theme | `next-themes` (dark/light, class-based) |
| Database | Supabase (Postgres + pgvector) |
| Auth | Supabase Auth via `@supabase/ssr` |
| Speech-to-text | Deepgram WebSocket API |
| LLM | Anthropic SDK (`claude-sonnet-4-6`) — server-side only |

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # ← anon/public key (this project uses PUBLISHABLE_KEY, not ANON_KEY)
SUPABASE_SERVICE_ROLE_KEY=              # server-side only — never import in client files
DEEPGRAM_API_KEY=                       # server-side only
ANTHROPIC_API_KEY=                      # server-side only
RESOURCE_ADMIN_TOKEN=                   # server-side only — anyone with this token + URL can insert resources
```

**Critical:** This project uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — not the typical `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Don't rename it or the existing Supabase client files break.

---

## Directory Structure

```
app/
  page.tsx                    ← voice intake (main experience)
  results/page.tsx            ← personalized resource results
  api/
    deepgram-token/route.ts   ← generates short-lived Deepgram token
    process-answer/route.ts   ← Claude extracts structured data from transcript
    match-resources/route.ts  ← three-layer matching pipeline
  auth/                       ← Supabase auth flows (pre-built, leave alone)
  layout.tsx
  globals.css

components/
  intake/                     ← voice intake UI components
    QuestionDisplay.tsx
    TranscriptDisplay.tsx
    MicIndicator.tsx
    ConfirmedAnswer.tsx
  results/                    ← results display components
    ResourceCard.tsx
    ResultsNarrative.tsx
  ui/                         ← shadcn/ui primitives (don't modify)

lib/
  supabase/
    client.ts                 ← browser client (uses PUBLISHABLE_KEY)
    server.ts                 ← server client (uses PUBLISHABLE_KEY + cookie handling)
  matching/
    structuredFilter.ts       ← county + community array overlap filter
    vectorSearch.ts           ← pgvector cosine similarity query
    synthesize.ts             ← Claude synthesis prompt + call
  utils.ts                    ← cn() helper

scripts/
  import-resources.ts         ← one-time CSV import for the resources table
  001_create_resources.sql    ← run in Supabase SQL editor to create resources table

ai-context/
  PRD.md                      ← full product requirements
  CLAUDE.md                   ← this file
  SECURITY.md
  INEFFICIENCIES.md
  plans/

data/                         ← gitignored; place resources.csv here for import
```

---

## Supabase Patterns

### Server component / API route
Always create a new client per function. Never put it in a module-level global.

```ts
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  // ...
}
```

### Browser component
```ts
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
```

### Service role (write operations in API routes)
For operations that bypass RLS (e.g., writing intake sessions):
```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

---

## Database Schema

### `resources` (213 rows, pre-populated)
```sql
id            uuid primary key
external_id   integer unique       -- from source spreadsheet
title         text
description   text
communities   text[]               -- e.g. ['Veteran', 'Rural']
industries    text[]               -- e.g. ['Manufacturing', 'Agriculture']
locations     text[]               -- Utah county names
topics        text[]               -- ['Funding', 'Start a Business', ...]
link          text
email         text
created_at    timestamptz
updated_at    timestamptz
```

### `intake_sessions`
```sql
id            uuid primary key
status        text                 -- 'in_progress' | 'completed' | 'abandoned'
started_at    timestamptz
completed_at  timestamptz
```

### `intake_answers`
```sql
id              uuid primary key
session_id      uuid references intake_sessions
question_index  integer            -- 0–3
question_text   text
raw_transcript  text
extracted_answer text
structured_data jsonb              -- communities[], counties[], stage, topics[], etc.
is_answered     boolean
answered_at     timestamptz
```

---

## Two-Layer Matching Pipeline

Executed in `/api/match-resources` after all four answers are collected. An embedding pre-filter layer was removed in the secret-link-resource-admin feature — at 213 resources, full-description Claude ranking outperforms vector pre-filter on match quality and latency.

**Layer 1 — Structured filter** (`lib/matching/structuredFilter.ts`)
- County overlap: `locations && '{Salt Lake}'::text[]`
- Community overlap: `communities && '{Veteran}'::text[]` (skip if user provided none)
- Output: ~30–80 candidates

**Layer 2 — LLM synthesis** (`lib/matching/synthesize.ts`)
- Pass candidate resource titles + descriptions + user profile to Claude
- Prompt returns: top 5 ranked, each with a one-sentence personalized match reason
- Model: `claude-sonnet-4-6`

---

## API Routes

### `POST /api/deepgram-token`
Returns a short-lived Deepgram API token for client WebSocket auth. Call once on intake start.

### `POST /api/process-answer`
Called after each question answer. Sends raw transcript + question to Claude; returns extracted structured data.

Request: `{ sessionId, questionIndex, questionText, extractionHint, rawTranscript }`
Response: `{ extractedAnswer, structured, isAnswered }`

### `POST /api/match-resources`
Called once when all four answers are confirmed. Runs the full pipeline.

Request: `{ sessionId, profile: { communities, counties, industry, stage, description, primaryNeed, topics } }`
Response: `{ narrative, results: [{ id, title, matchReason, topics, link }] }`

---

## Voice Intake — Question Flow

| Index | Question | Extracted fields |
|---|---|---|
| 0 | Community identity (veteran, woman, rural, immigrant, LGBTQ+) | `communities: string[]` |
| 1 | Location (city, county, or region) | `counties: string[]` |
| 2 | Business description + stage | `industry, stage, description` |
| 3 | Primary need (funding, getting started, growing, marketing, connecting) | `primaryNeed, topics: string[]` |

### Intake UI states
`idle` → `instructions` → `listening` → `processing` → `confirmed` → `[next question]` → `complete` → navigate to `/results`

---

## Design System

The intake UI deliberately avoids standard app chrome. No nav, no header, no footer.

### Colors
```css
/* Dark mode (primary) */
--black: #000000          /* background */
--white: #FFFFFF          /* primary text */
--accent: #2a5e49         /* confirmed answer, mic indicator, active states */
--muted: #666666          /* live transcript while in-progress */

/* Light mode */
--white: #FFFFFF          /* background */
--black: #000000          /* primary text */
--accent: #2a5e49         /* same accent */
--muted: #999999
```

`#2a5e49` is used only as a **foreground signal**, never as a background fill.

### Typography
- **Instrument Serif** — live transcript (italic) and confirmed answer (regular). Import from Google Fonts.
- **System sans** (`ui-sans-serif, system-ui, -apple-system`) — question text, labels, buttons. No import needed.

### Layout rules
- Everything centered: `min-height: 100dvh`, flexbox column, `justify-content: center`, `align-items: center`
- Max content width: `680px`
- No progress bars, no step counters, no icon libraries, no modals, no toast notifications
- No animation longer than `400ms`; all use `ease-out`

---

## Security Rules

- **Never** call the Anthropic SDK or Deepgram from a client component. All AI calls go through API routes.
- **Never** import `SUPABASE_SERVICE_ROLE_KEY` in any file under `app/` that isn't a `route.ts`.
- **Never** import `DEEPGRAM_API_KEY` or `ANTHROPIC_API_KEY` in client-side code.
- Deepgram tokens are short-lived and fetched server-side per session.

Full security notes: `ai-context/SECURITY.md`

---

## Key Constraints (from PRD)

- No progress bar or step counter on the intake screen
- No icon libraries
- No colored backgrounds other than pure black or white
- No animations longer than 400ms
- The "skip" affordance during interview is a single small text link only — no buttons
- Results cards must include a unique, user-specific match reason (not generic copy)
- The content update path for non-developers is Supabase Studio — no admin UI in MVP

---

## Admin Tools

### `/admin/resources/[token]` (Feature: secret-link-resource-admin)
Token-gated form for adding new rows to the `resources` table without code changes or Supabase Studio access.

- Token comes from `RESOURCE_ADMIN_TOKEN` env var, compared via `crypto.timingSafeEqual` in `lib/admin/token.ts`
- Wrong token → 404 (no info leak)
- Form constrains the four array columns to the enums in `lib/intake/filterConstants.ts` so new resources are immediately matchable by Q1–Q4
- `external_id` auto-increments server-side (max + 1)
- There is no UI link to this page from anywhere in the public app
