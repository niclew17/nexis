# Feature: Voice Intake UI + Results Page

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files. This project uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — NOT `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Feature Description

Implement the full Nexis founder experience end-to-end: a voice-first four-question intake on the home page (no login required, no auth gate), followed by a personalized results page that displays 3–5 matched Utah state resources with one-sentence match explanations. Login/signup buttons appear only on the results page header — never during the intake flow.

## User Story

As a Utah founder,  
I want to speak answers to four short questions on the home page without creating an account,  
So that I immediately receive personalized state resource recommendations and can optionally save them by signing up.

## Problem Statement

The current home page renders a shell with "Nexis — ready" only after anonymous auth completes, which blocks the user experience before any UI is shown. No intake UI, API routes, matching pipeline, or results page exists yet. Founders hit a blank screen with no affordance to begin.

## Solution Statement

Replace the auth-gated shell on the home page with a full voice intake experience that renders immediately. Run anonymous Supabase sign-in in the background for session tracking. After all four questions are answered, call the three-layer matching pipeline, store results in sessionStorage, and navigate to a results page that shows resource cards and — for the first time in the flow — login/signup buttons in the header.

## Feature Metadata

**Feature Type**: New Capability  
**Estimated Complexity**: High  
**Primary Systems Affected**: `app/page.tsx`, new API routes, new lib/matching, new hooks, new intake/results components, new results page  
**Dependencies**: `@anthropic-ai/sdk` (install), `@deepgram/sdk` (install), `@supabase/supabase-js` (already installed), `openai` (already in devDependencies — move to dependencies)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `app/page.tsx` (lines 1–48) — Current shell; will be replaced wholesale. Note the `useAnonymousAuth` hook usage and layout style pattern (inline styles, black bg, centered flex, 680px max-width).
- `hooks/useAnonymousAuth.ts` (lines 1–44) — Pattern for anonymous Supabase sign-in; `isReady` / `user` / `isAnonymous` return shape. **Do not modify** — just use it.
- `lib/supabase/client.ts` (lines 1–8) — Browser Supabase client. Uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, not ANON_KEY.
- `lib/supabase/server.ts` (lines 1–34) — Server Supabase client. Always instantiate inside a function, never at module level.
- `components/auth-button.tsx` (lines 1–29) — Pattern for async server component that reads auth state. Use `createClient` from `@/lib/supabase/server`.
- `components/auth/ConvertAccountForm.tsx` (lines 1–76) — Uses `supabase.auth.updateUser({ email })` to convert anonymous → real account; redirect to `/auth/confirm?next=/saved`. Follow this exact conversion approach (NOT `signUp()`) on the results page save button.
- `app/globals.css` (lines 1–63) — CSS variables. `--accent` is `153 38% 27%` = `#2a5e49`. Utility classes: `.text-nexis-accent`, `.text-nexis-muted`.
- `app/layout.tsx` (lines 1–42) — Instrument Serif loaded as `--font-instrument-serif` CSS variable. ThemeProvider wraps everything with `defaultTheme="dark"`.
- `app/auth/sign-up/page.tsx` (lines 1–49) — Sign-up flow. Already detects anonymous users and shows ConvertAccountForm. Link to `/auth/sign-up?reason=save` from results.
- `app/protected/layout.tsx` (lines 1–24) — Pattern for a page with a top nav (not used for intake, but reference for results header pattern).
- `lib/utils.ts` — `cn()` helper for conditional Tailwind classes.
- `.env.example` — All required env vars are listed. Add `DEEPGRAM_PROJECT_ID` for short-lived token creation.

### New Files to Create

**API Routes:**
- `app/api/deepgram-token/route.ts` — Returns a short-lived Deepgram key for WebSocket auth
- `app/api/process-answer/route.ts` — Claude extraction per question; upserts to `intake_answers`
- `app/api/match-resources/route.ts` — Three-layer matching pipeline; returns ranked results

**Matching Lib:**
- `lib/matching/structuredFilter.ts` — Postgres array overlap filter (counties, communities)
- `lib/matching/vectorSearch.ts` — pgvector cosine similarity within candidate pool
- `lib/matching/synthesize.ts` — Claude synthesis prompt returning top 5 with match reasons

**Hooks:**
- `hooks/useDeepgram.ts` — WebSocket connection to Deepgram, audio streaming, transcript aggregation, silence detection
- `hooks/useVoiceIntake.ts` — State machine orchestrator: idle → instructions → listening → processing → confirmed → complete

**Intake Components:**
- `components/intake/VoiceIntake.tsx` — Root intake component, uses both hooks, wires together sub-components
- `components/intake/InstructionSlide.tsx` — 3-line onboarding instructions with tap-to-begin
- `components/intake/QuestionDisplay.tsx` — Current question text in system-sans
- `components/intake/TranscriptDisplay.tsx` — Live transcript in Instrument Serif italic, muted color while in-progress
- `components/intake/MicIndicator.tsx` — Pulsing dot in accent `#2a5e49` while listening
- `components/intake/ConfirmedAnswer.tsx` — Confirmed answer in Instrument Serif regular, accent color

**Results Components:**
- `components/results/ResourceCard.tsx` — Resource card: title, match reason, topic tags, link button
- `components/results/ResultsNarrative.tsx` — Narrative header sentence from Claude

**Pages:**
- `app/results/page.tsx` — Client component; reads results from sessionStorage; shows header with auth buttons

**Updated Files:**
- `app/page.tsx` — Replace shell with `<VoiceIntake />` render (no isReady gate blocking UI)
- `ai-context/INEFFICIENCIES.md` — Add entry for auth-gated intake shell
- `ai-context/SECURITY.md` — Add sessionStorage results note
- `package.json` — Add `@anthropic-ai/sdk`, `@deepgram/sdk`; move `openai` to dependencies

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [Deepgram WebSocket Streaming](https://developers.deepgram.com/docs/getting-started-with-live-streaming-audio)
  - Specific section: Connection URL params, message event types (`Results`, `SpeechFinal`, `UtteranceEnd`)
  - Why: Need correct URL params and event parsing for transcript + silence detection
- [Deepgram Create API Key](https://developers.deepgram.com/reference/create-key)
  - Specific section: `POST /v1/projects/{projectId}/keys` with `time_to_live_in_seconds`
  - Why: Short-lived token generation in `/api/deepgram-token`
- [Anthropic SDK Node.js](https://docs.anthropic.com/en/api/getting-started)
  - Specific section: Messages API, JSON mode
  - Why: Claude extraction in `process-answer` and synthesis in `match-resources`
- [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector#querying-your-own-data)
  - Specific section: Cosine similarity query with `<=>` operator
  - Why: Layer 2 vector search implementation

### Patterns to Follow

**Inline styles on intake pages (not Tailwind):**
The intake UI uses raw inline styles — not Tailwind classes — to achieve pixel-exact layout without class conflicts. Follow the pattern in `app/page.tsx`:
```tsx
style={{
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "black",
  color: "white",
}}
```

**Font usage:**
```tsx
// Instrument Serif (transcript, confirmed answers)
style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic" }}

// System sans (questions, labels, buttons) — no class needed
style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
```

**Supabase server client (API routes):**
```ts
import { createClient } from '@/lib/supabase/server'
export async function POST(req: Request) {
  const supabase = await createClient()
  // ...
}
```

**Supabase service role (write bypass RLS):**
```ts
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**Anonymous auth hook (already exists, don't modify):**
```ts
const { user, isReady, isAnonymous } = useAnonymousAuth()
// user?.id is the anonymous UUID — use as sessionId
```

**Claude API call pattern:**
```ts
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const msg = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }],
})
// Parse JSON from msg.content[0].text
```

**API route response pattern:**
```ts
import { NextResponse } from 'next/server'
return NextResponse.json({ key: 'value' })
return NextResponse.json({ error: 'message' }, { status: 400 })
```

**Color constants (use inline, not class):**
```
accent:  #2a5e49   (confirmed answers, mic indicator, active states — foreground only)
muted:   #666666   (live transcript in-progress)
white:   #FFFFFF   (primary text, dark mode)
black:   #000000   (background, dark mode)
```

**Animation constraint:** All transitions ≤ 400ms, use `ease-out`.

---

## IMPLEMENTATION PLAN

### Phase 1: Dependencies + Foundation

Install missing packages, move `openai` to production dependencies, and add the `DEEPGRAM_PROJECT_ID` env var placeholder.

### Phase 2: API Routes

Build the three server-side routes that power the experience. Start here so the hooks can be tested against real endpoints.

### Phase 3: Matching Lib

Implement the three-layer pipeline called by `match-resources`. Each layer is independently testable.

### Phase 4: Hooks

Build `useDeepgram` (Deepgram SDK `listen.v1.createConnection` + MediaRecorder audio) and `useVoiceIntake` (state machine) as separate hooks composed in the root component.

### Phase 5: Intake Components

Build UI components bottom-up: smallest (MicIndicator) → largest (VoiceIntake root).

### Phase 6: Results Page

Build results components and the results page, including the auth header.

### Phase 7: Wire Up Home Page

Replace `app/page.tsx` shell with the full intake experience.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

---

### TASK 1: UPDATE `package.json` — Add missing dependencies

- **IMPLEMENT**: Add `@anthropic-ai/sdk` and `@deepgram/sdk` to `dependencies`. Move `openai` from `devDependencies` to `dependencies`.
- **VALIDATE**: `npm install && npm run build 2>&1 | head -20`

---

### TASK 2: UPDATE `.env.example` — Add `DEEPGRAM_PROJECT_ID`

- **IMPLEMENT**: Add line `DEEPGRAM_PROJECT_ID=xxxxx` below `DEEPGRAM_API_KEY`. This is needed for short-lived token generation.
- **VALIDATE**: `cat .env.example | grep DEEPGRAM`

---

### TASK 3: CREATE `app/api/deepgram-token/route.ts`

- **IMPLEMENT**: POST handler that generates a short-lived Deepgram API key using the management API.
  ```ts
  POST https://api.deepgram.com/v1/projects/{DEEPGRAM_PROJECT_ID}/keys
  Body: { comment: 'nexis-session', scopes: ['usage:write'], time_to_live_in_seconds: 300 }
  Authorization: Token ${DEEPGRAM_API_KEY}
  ```
  Returns `{ token: string }`.
- **FALLBACK**: If `DEEPGRAM_PROJECT_ID` is not set, return `{ token: process.env.DEEPGRAM_API_KEY }` with a console warning. This allows local dev without project ID.
- **SECURITY**: Never expose `DEEPGRAM_API_KEY` directly in client code — this route must remain server-side only.
- **IMPORTS**: None beyond `NextResponse`; use native `fetch` for the Deepgram management API call.
- **VALIDATE**: `curl -X POST http://localhost:3000/api/deepgram-token` (after `npm run dev`)

---

### TASK 4: CREATE `app/api/process-answer/route.ts`

- **IMPLEMENT**: POST handler.
  - Accepts: `{ sessionId: string, questionIndex: number, questionText: string, extractionHint: string, rawTranscript: string }`
  - Calls Claude `claude-sonnet-4-6` with this exact prompt template:
    ```
    You are extracting structured data from a voice transcript for a Utah founder resource app.
    
    Question asked: {questionText}
    Extraction hint: {extractionHint}
    Raw transcript: {rawTranscript}
    
    Return valid JSON only, no markdown, no explanation:
    {
      "extractedAnswer": "<clean human-readable summary of what they said>",
      "structured": <object with fields described in extraction hint>,
      "isAnswered": <true if they gave a substantive answer, false if they said nothing relevant>
    }
    ```
  - Parses the JSON response from Claude.
  - Upserts to `intake_answers` table using service role client:
    ```ts
    supabase.from('intake_answers').upsert({
      session_id: sessionId,
      question_index: questionIndex,
      question_text: questionText,
      raw_transcript: rawTranscript,
      extracted_answer: extractedAnswer,
      structured_data: structured,
      is_answered: isAnswered,
      answered_at: new Date().toISOString(),
    }, { onConflict: 'session_id,question_index' })
    ```
  - Returns: `{ extractedAnswer, structured, isAnswered }`
- **EXTRACTION HINTS** (pass from client):
  - Q0: `"Extract which founder communities the person identifies with. Valid values: Veteran, Woman, Rural, Immigrant, LGBTQ+. Return { communities: string[] }. Return empty array if none."`
  - Q1: `"Extract the Utah location. Map city names to county names (e.g. Salt Lake City → Salt Lake, St. George → Washington, Provo → Utah, Ogden → Weber, Logan → Cache). Return { counties: string[] }."`
  - Q2: `"Extract business industry (one phrase), stage (one of: pre-idea, idea, early, growth, scaling), and a brief description. Return { industry: string, stage: string, description: string }."`
  - Q3: `"Extract primary need and relevant topics. Valid topics: Funding, Start a Business, Growing a Business, Marketing, Networking. Return { primaryNeed: string, topics: string[] }."`
- **IMPORTS**: `Anthropic` from `@anthropic-ai/sdk`, `createClient` from `@supabase/supabase-js` (service role pattern), `NextResponse`
- **GOTCHA**: Parse Claude's text response as JSON — it may include markdown code fences if not prompted correctly. Use regex strip or `JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim())` as fallback.
- **VALIDATE**: `curl -X POST http://localhost:3000/api/process-answer -H 'Content-Type: application/json' -d '{"sessionId":"test","questionIndex":0,"questionText":"Do you identify with any communities?","extractionHint":"Extract communities","rawTranscript":"I am a veteran"}'`

---

### TASK 5: CREATE `lib/matching/structuredFilter.ts`

- **IMPLEMENT**: 
  ```ts
  export interface UserProfile {
    communities: string[]
    counties: string[]
    industry: string
    stage: string
    description: string
    primaryNeed: string
    topics: string[]
  }
  
  export async function structuredFilter(
    supabase: SupabaseClient,
    profile: UserProfile
  ): Promise<{ id: string }[]>
  ```
  - Build Supabase query on `resources` table.
  - If `profile.counties.length > 0`: filter `.contains('locations', profile.counties)` — actually use `overlaps` not `contains`: `.filter('locations', 'ov', `{${profile.counties.join(',')}}`)`. 
  - **IMPORTANT**: Supabase array overlap syntax: `.filter('locations', 'cs', `{"${profile.counties.join('","')}")` uses `cs` (contains), but for overlap use `.filter('locations', 'ov', `{"${profile.counties.join('","')}")`. Actually look up the correct Supabase array overlap operator — it may be using raw `.or()` with `&&` Postgres operator.
  - Use raw `.or()` if needed: `.or(`locations.ov.{${countyStr}},locations.is.null`)` 
  - If `profile.communities.length > 0`: add communities overlap filter similarly; if empty, skip (include all resources).
  - Select only `id` column; return array of `{ id: string }`.
  - Return all 213 resources if no filters match (fallback).
- **PATTERN**: Service role Supabase client — instantiate inside function, not at module level.
- **IMPORTS**: `SupabaseClient` from `@supabase/supabase-js`
- **GOTCHA**: Supabase JS client array overlap operator is `.overlaps('column', array)` — check the Supabase JS v2 docs. The method signature is `supabase.from('resources').select('id').overlaps('locations', profile.counties)`.
- **VALIDATE**: Write a quick test: call with `{ counties: ['Salt Lake'], communities: [] }` and log result count to console.

---

### TASK 6: CREATE `lib/matching/vectorSearch.ts`

- **IMPLEMENT**:
  ```ts
  export async function vectorSearch(
    supabase: SupabaseClient,
    profile: UserProfile,
    candidateIds: string[],
    topK: number = 15
  ): Promise<ResourceResult[]>
  ```
  - Build user profile string: `"${profile.description}. Communities: ${profile.communities.join(', ')}. Location: ${profile.counties.join(', ')}. Stage: ${profile.stage}. Primary need: ${profile.primaryNeed}. Topics: ${profile.topics.join(', ')}."`
  - Generate embedding via OpenAI: 
    ```ts
    import OpenAI from 'openai'
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: profileString })
    const embedding = resp.data[0].embedding
    ```
  - Call Supabase RPC function `match_resources`:
    ```ts
    const { data } = await supabase.rpc('match_resources', {
      query_embedding: embedding,
      match_count: topK,
      candidate_ids: candidateIds,
    })
    ```
  - **GOTCHA**: The `match_resources` RPC function may not exist yet in Supabase. If it doesn't, use raw pgvector query: `supabase.from('resources').select('id, title, description, topics, link, embedding <=> $1 as distance').filter('id', 'in', candidateIds).order('distance').limit(topK)`. Actually, Supabase JS doesn't support raw distance ordering easily. Use the RPC approach and define the function in Supabase SQL editor first.
  - **SQL for RPC** (include in task notes for execution agent to run in Supabase):
    ```sql
    CREATE OR REPLACE FUNCTION match_resources(
      query_embedding vector(1536),
      match_count int,
      candidate_ids uuid[]
    )
    RETURNS TABLE (id uuid, title text, description text, topics text[], link text, similarity float)
    LANGUAGE sql STABLE AS $$
      SELECT id, title, description, topics, link,
             1 - (embedding <=> query_embedding) AS similarity
      FROM resources
      WHERE id = ANY(candidate_ids)
      ORDER BY embedding <=> query_embedding
      LIMIT match_count;
    $$;
    ```
  - Returns: array of `{ id, title, description, topics, link, similarity }`.
- **IMPORTS**: `OpenAI` from `openai`, `SupabaseClient` from `@supabase/supabase-js`
- **VALIDATE**: Test standalone with a hardcoded profile and the full resources table.

---

### TASK 7: CREATE `lib/matching/synthesize.ts`

- **IMPLEMENT**:
  ```ts
  export interface ResourceResult {
    id: string
    title: string
    description: string
    topics: string[]
    link: string
    similarity?: number
  }
  
  export interface SynthesisResult {
    narrative: string
    results: Array<{
      id: string
      title: string
      matchReason: string
      topics: string[]
      link: string
    }>
  }
  
  export async function synthesize(
    profile: UserProfile,
    candidates: ResourceResult[]
  ): Promise<SynthesisResult>
  ```
  - Build synthesis prompt:
    ```
    You are a helpful assistant matching Utah founders to state resources.
    
    Founder profile:
    - Communities: {communities}
    - Location (counties): {counties}
    - Business: {description}
    - Stage: {stage}
    - Primary need: {primaryNeed}
    - Topics of interest: {topics}
    
    Here are {N} candidate resources:
    {candidates mapped as numbered list: "1. TITLE\nDescription: DESCRIPTION"}
    
    Return valid JSON only, no markdown:
    {
      "narrative": "<one sentence starting with 'Based on what you shared' describing the founder's situation>",
      "results": [
        {
          "id": "<resource id>",
          "title": "<resource title>",
          "matchReason": "<one sentence starting with 'This matches you because' — be specific: reference their county, community, stage, and stated need>",
          "topics": ["<topic>"],
          "link": "<resource link>"
        }
      ]
    }
    
    Rules:
    - Return exactly 5 results (or fewer if fewer than 5 candidates are relevant)
    - Rank by relevance to this specific founder — geography and community identity first, then need
    - The matchReason must reference the founder's specific details — never generic copy
    - Only include resources whose location includes the founder's county OR statewide resources
    ```
  - Call Claude `claude-sonnet-4-6` with `max_tokens: 2048`.
  - Parse and return JSON.
- **IMPORTS**: `Anthropic` from `@anthropic-ai/sdk`
- **GOTCHA**: Same JSON parsing fallback as `process-answer` — strip markdown code fences if present.
- **VALIDATE**: Run standalone with a test profile and 10 hardcoded candidate titles/descriptions.

---

### TASK 8: CREATE `app/api/match-resources/route.ts`

- **IMPLEMENT**: POST handler.
  - Accepts: `{ sessionId: string, profile: UserProfile }`
  - Instantiates service role Supabase client.
  - Calls `structuredFilter(supabase, profile)` → `candidateIds: string[]`
  - If `candidateIds.length === 0`: set `candidateIds` to all resource IDs (fallback query `supabase.from('resources').select('id')`)
  - Calls `vectorSearch(supabase, profile, candidateIds, 15)` → `candidates`
  - Calls `synthesize(profile, candidates)` → `{ narrative, results }`
  - Updates `intake_sessions` row: `{ status: 'completed', completed_at: new Date().toISOString() }` where `id = sessionId`
  - Returns `{ narrative, results }`
- **IMPORTS**: `structuredFilter`, `vectorSearch`, `synthesize` from `@/lib/matching/...`, service role Supabase client, `NextResponse`
- **VALIDATE**: `curl -X POST http://localhost:3000/api/match-resources -H 'Content-Type: application/json' -d '{"sessionId":"test","profile":{"communities":["Veteran"],"counties":["Salt Lake"],"industry":"Tech","stage":"early","description":"SaaS for restaurants","primaryNeed":"funding","topics":["Funding"]}}'`

---

### TASK 9: CREATE `hooks/useDeepgram.ts`

- **IMPLEMENT**: Use the `@deepgram/sdk` `DeepgramClient` + `listen.v1.createConnection()` pattern — NOT raw WebSocket. See `ai-context/DEEPGRAM.MD` for the exact SDK call shape.
  ```ts
  interface UseDeepgramReturn {
    transcript: string           // accumulated final transcript for current question
    interimTranscript: string    // live partial transcript
    isConnected: boolean
    startListening: () => Promise<void>
    stopListening: () => void
    resetTranscript: () => void
  }
  
  export function useDeepgram(onSilenceDetected: () => void): UseDeepgramReturn
  ```
  - `startListening()`:
    1. Fetch `{ token }` from `/api/deepgram-token` — this is the API key or short-lived key.
    2. Instantiate the SDK client with the token:
       ```ts
       import { DeepgramClient } from '@deepgram/sdk'
       const deepgram = new DeepgramClient({ apiKey: token })
       ```
    3. Create the live connection via the SDK:
       ```ts
       const socket = await deepgram.listen.v1.createConnection({
         model: 'nova-3',
         language: 'en',
         smart_format: true,
         interim_results: true,
         utterance_end_ms: 2500,   // 2.5s of silence triggers UtteranceEnd
         endpointing: 500,          // 500ms pause = speech endpoint
         punctuate: true,
         numerals: true,
       })
       ```
    4. Register event handlers BEFORE connecting:
       ```ts
       socket.on('message', (data) => {
         if (data.type === 'UtteranceEnd') {
           onSilenceDetected()   // triggers question advance
           return
         }
         if (data.type === 'Results' && data.channel?.alternatives?.[0]) {
           const text = data.channel.alternatives[0].transcript
           if (!text) return
           if (data.is_final) {
             setTranscript(prev => prev ? `${prev} ${text}` : text)
             setInterimTranscript('')
           } else {
             setInterimTranscript(text)
           }
         }
       })
       socket.on('close', () => setIsConnected(false))
       socket.on('error', (err) => console.error('Deepgram error:', err))
       ```
    5. Connect and wait for open:
       ```ts
       socket.connect()
       await socket.waitForOpen()
       setIsConnected(true)
       ```
    6. Request microphone and pipe audio via `socket.sendMedia()`:
       ```ts
       const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
       const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
       recorder.ondataavailable = (event) => {
         if (event.data.size > 0 && socket) socket.sendMedia(event.data)
       }
       recorder.start(250)  // 250ms timeslice
       ```
    7. Store `socket`, `recorder`, `stream` in `useRef` — NOT state — to avoid stale closures.
  - `stopListening()`:
    ```ts
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    socketRef.current?.finish()   // graceful SDK close
    setIsConnected(false)
    ```
  - `resetTranscript()`: `setTranscript('')`, `setInterimTranscript('')`.
- **GOTCHA**: Register all `socket.on()` listeners BEFORE calling `socket.connect()` — the SDK may emit events synchronously on open.
- **GOTCHA**: `socket.finish()` (not `socket.close()`) is the graceful SDK shutdown — it sends a close frame and waits for server acknowledgment.
- **GOTCHA**: Use `useRef` for `socket`, `recorder`, `stream` to avoid stale closure issues in event handlers. Use `useState` only for `transcript`, `interimTranscript`, and `isConnected`.
- **GOTCHA**: `MediaRecorder` with `audio/webm;codecs=opus` is natively supported by Deepgram `nova-3` — no `encoding` or `sample_rate` override needed in `createConnection()`.
- **IMPORTS**: `DeepgramClient` from `@deepgram/sdk`, React `useState`, `useRef`, `useCallback`
- **VALIDATE**: Render a test component that calls `startListening()` and logs `transcript` to console. Speak and verify transcript appears after ~2.5s silence triggers `onSilenceDetected`.

---

### TASK 10: CREATE `hooks/useVoiceIntake.ts`

- **IMPLEMENT**:
  ```ts
  type IntakeState = 'idle' | 'instructions' | 'listening' | 'processing' | 'confirmed' | 'complete'
  
  interface ConfirmedAnswer {
    questionIndex: number
    extractedAnswer: string
    structured: Record<string, unknown>
  }
  
  interface UseVoiceIntakeReturn {
    state: IntakeState
    currentQuestionIndex: number
    confirmedAnswers: ConfirmedAnswer[]
    currentTranscript: string
    interimTranscript: string
    isListening: boolean
    sessionId: string | null
    matchResults: MatchResults | null
    begin: () => void       // idle → instructions
    startQuestion: () => void  // instructions/confirmed → listening
    skipQuestion: () => void   // skip current question
    confirmAnswer: () => void  // manually confirm before silence
  }
  ```
  - Uses `useAnonymousAuth` to get `user?.id` as `sessionId`.
  - Uses `useDeepgram(handleSilence)` hook.
  - Question definitions (hardcode in the hook):
    ```ts
    const QUESTIONS = [
      {
        text: "Do you identify with any of these founder communities — veteran, woman, rural founder, immigrant, or LGBTQ+? You can name one, a few, or skip it if none apply.",
        extractionHint: "Extract which founder communities the person identifies with. Valid values: Veteran, Woman, Rural, Immigrant, LGBTQ+. Return { communities: string[] }. Return empty array if none.",
      },
      {
        text: "Where in Utah are you based or operating? You can name a city, a county, or describe the region — like Salt Lake, St. George, Cache Valley, or rural southern Utah.",
        extractionHint: "Extract the Utah location. Map city names to county names (Salt Lake City → Salt Lake, St. George → Washington, Provo → Utah, Ogden → Weber, Logan → Cache, Cedar City → Iron, Moab → Grand). Return { counties: string[] }.",
      },
      {
        text: "Tell me about your business — what you do and where you are in the journey. Are you still in the idea phase, just getting started, or already running something?",
        extractionHint: "Extract business industry (one phrase), stage (one of: pre-idea, idea, early, growth, scaling), and a brief description (1-2 sentences). Return { industry: string, stage: string, description: string }.",
      },
      {
        text: "What's the most pressing thing you need help with right now? For example — finding funding or loans, figuring out how to get started, growing or scaling, marketing and sales, or connecting with other entrepreneurs and mentors.",
        extractionHint: "Extract primary need (one phrase) and relevant topics. Valid topics: Funding, Start a Business, Growing a Business, Marketing, Networking. Return { primaryNeed: string, topics: string[] }.",
      },
    ]
    ```
  - `handleSilence`: when state is `listening` and `transcript.length > 10` (at least some speech): transition to `processing`, call `processAnswer()`.
  - `processAnswer()`: 
    - POST to `/api/process-answer` with sessionId, current question data, and accumulated transcript.
    - On success: push to `confirmedAnswers`, transition to `confirmed`.
    - If `currentQuestionIndex === 3` (last question) after confirming: build profile, POST to `/api/match-resources`, store results in sessionStorage (`nexis-results`), transition to `complete`.
    - On `complete`: `router.push('/results')` after 600ms delay for animation.
  - `skipQuestion()`: push empty answer, advance question index, return to instructions state.
  - Profile building from confirmedAnswers:
    ```ts
    const profile = {
      communities: confirmedAnswers[0]?.structured?.communities ?? [],
      counties: confirmedAnswers[1]?.structured?.counties ?? [],
      industry: confirmedAnswers[2]?.structured?.industry ?? '',
      stage: confirmedAnswers[2]?.structured?.stage ?? '',
      description: confirmedAnswers[2]?.structured?.description ?? confirmedAnswers[2]?.extractedAnswer ?? '',
      primaryNeed: confirmedAnswers[3]?.structured?.primaryNeed ?? '',
      topics: confirmedAnswers[3]?.structured?.topics ?? [],
    }
    ```
  - Also creates `intake_sessions` row on first question processing (or on `begin()`):
    ```ts
    supabase.from('intake_sessions').insert({ id: sessionId, status: 'in_progress', started_at: new Date().toISOString() })
    ```
    Use browser Supabase client (not service role) since we have the anonymous auth user.
- **IMPORTS**: `useAnonymousAuth` from `@/hooks/useAnonymousAuth`, `useDeepgram` from `@/hooks/useDeepgram`, `useRouter` from `next/navigation`, React hooks, `createClient` from `@/lib/supabase/client`
- **VALIDATE**: Step through state machine with a mock `useDeepgram` that resolves immediately.

---

### TASK 11: CREATE `components/intake/MicIndicator.tsx`

- **IMPLEMENT**: Pulsing circle shown while `isListening`. Accent color `#2a5e49`. Size: 12px circle. CSS animation: scale from 1 to 1.3 and back, 1.2s loop.
  ```tsx
  export function MicIndicator({ isListening }: { isListening: boolean }) {
    if (!isListening) return null
    return (
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        backgroundColor: '#2a5e49',
        animation: 'mic-pulse 1.2s ease-out infinite',
      }} />
    )
  }
  ```
  Add keyframe in `globals.css`:
  ```css
  @keyframes mic-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
  }
  ```
- **VALIDATE**: Render with `isListening={true}` and confirm pulsing dot appears.

---

### TASK 12: CREATE `components/intake/QuestionDisplay.tsx`

- **IMPLEMENT**: Displays the current question text. System sans font, 1.125rem, white, centered. Fades in on question change using opacity transition (200ms ease-out).
  ```tsx
  'use client'
  export function QuestionDisplay({ question }: { question: string }) {
    return (
      <p style={{
        fontFamily: 'ui-sans-serif, system-ui, -apple-system',
        fontSize: '1.125rem',
        color: 'white',
        textAlign: 'center',
        lineHeight: 1.6,
        margin: '0 0 32px',
        transition: 'opacity 200ms ease-out',
      }}>
        {question}
      </p>
    )
  }
  ```
- **VALIDATE**: Render with a question string and verify text displays correctly.

---

### TASK 13: CREATE `components/intake/TranscriptDisplay.tsx`

- **IMPLEMENT**: Shows live transcript in Instrument Serif italic, muted color while in-progress.
  - `finalTranscript`: regular Instrument Serif, white.
  - `interimTranscript` (appended): italic, `#666666`.
  ```tsx
  'use client'
  export function TranscriptDisplay({
    finalTranscript,
    interimTranscript,
  }: { finalTranscript: string; interimTranscript: string }) {
    if (!finalTranscript && !interimTranscript) return null
    return (
      <p style={{
        fontFamily: 'var(--font-instrument-serif)',
        fontSize: '1.25rem',
        textAlign: 'center',
        lineHeight: 1.7,
        margin: '24px 0',
        color: 'white',
      }}>
        {finalTranscript}
        {interimTranscript && (
          <span style={{ color: '#666666', fontStyle: 'italic' }}>
            {finalTranscript ? ' ' : ''}{interimTranscript}
          </span>
        )}
      </p>
    )
  }
  ```
- **VALIDATE**: Render with sample transcript and verify italic/color distinction.

---

### TASK 14: CREATE `components/intake/ConfirmedAnswer.tsx`

- **IMPLEMENT**: Displays a confirmed answer in Instrument Serif regular, accent color `#2a5e49`. Used in the confirmed state and as a persistent record above each new question.
  ```tsx
  'use client'
  export function ConfirmedAnswer({ answer, questionIndex }: { answer: string; questionIndex: number }) {
    return (
      <p style={{
        fontFamily: 'var(--font-instrument-serif)',
        fontSize: '1rem',
        color: '#2a5e49',
        textAlign: 'center',
        margin: '8px 0',
        opacity: 1,
        transition: 'opacity 300ms ease-out',
      }}>
        {answer}
      </p>
    )
  }
  ```
- **VALIDATE**: Render and verify accent color + font.

---

### TASK 15: CREATE `components/intake/InstructionSlide.tsx`

- **IMPLEMENT**: Shown on first visit before any questions. Three lines of instruction, centered, white text. A "Begin" button (large, white border, system-sans) and a small "Skip intro" text link below it.
  ```
  Line 1: "Speak your answers naturally."
  Line 2: "Silence moves you to the next question."
  Line 3: "Four questions. Under two minutes."
  ```
  ```tsx
  'use client'
  export function InstructionSlide({ onBegin }: { onBegin: () => void }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '1.125rem', color: 'white', fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic' }}>
            Speak your answers naturally.
          </p>
          <p style={{ fontSize: '1.125rem', color: 'white', fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic' }}>
            Silence moves you to the next question.
          </p>
          <p style={{ fontSize: '1.125rem', color: 'white', fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic' }}>
            Four questions. Under two minutes.
          </p>
        </div>
        <button
          onClick={onBegin}
          style={{
            marginTop: '16px',
            padding: '12px 40px',
            border: '1px solid white',
            background: 'transparent',
            color: 'white',
            fontSize: '1rem',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          Begin
        </button>
      </div>
    )
  }
  ```
- **VALIDATE**: Render and verify instruction text and Begin button display.

---

### TASK 16: CREATE `components/intake/VoiceIntake.tsx`

- **IMPLEMENT**: Root intake component. Composes all sub-components. Uses `useVoiceIntake` hook. This is the only component that imports the hook.
  - Renders based on `state`:
    - `idle`: Show "Nexis" wordmark centered, plus a "Find your resources →" call-to-action button that calls `begin()`.
    - `instructions`: Show `<InstructionSlide onBegin={startQuestion} />`
    - `listening`: Show `<QuestionDisplay>`, `<TranscriptDisplay>`, `<MicIndicator isListening>`, and a small "skip" text link (`<button onClick={skipQuestion}>skip</button>`)
    - `processing`: Show question text + "Processing..." in muted italic
    - `confirmed`: Show confirmed answer text in accent, then auto-advance to next question's listening state after 1200ms
    - `complete`: Show "Finding your matches..." centered in italic Instrument Serif
  - Above each question, show previously confirmed answers as `<ConfirmedAnswer>` components (stacked).
  - Layout: full-screen black, centered flex column, 680px max-width.
  - **IMPORTANT**: Do NOT gate this component on `isReady` from `useAnonymousAuth` — render immediately. The hook provides `sessionId` from `user?.id` which may be null briefly; the intake session creation should be deferred until `sessionId` is available (check before writing to DB).
- **IMPORTS**: All intake sub-components, `useVoiceIntake`
- **VALIDATE**: Render the component and verify state transitions manually.

---

### TASK 17: UPDATE `app/page.tsx`

- **IMPLEMENT**: Replace the entire current shell. Simple client component that just renders `<VoiceIntake />` inside the full-screen layout. Remove the `isReady` gate — `VoiceIntake` handles its own loading state internally.
  ```tsx
  'use client'
  import { VoiceIntake } from '@/components/intake/VoiceIntake'
  
  export default function Home() {
    return (
      <main style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'black',
        color: 'white',
      }}>
        <VoiceIntake />
      </main>
    )
  }
  ```
- **GOTCHA**: No `useAnonymousAuth` import here — it's used inside `useVoiceIntake`, not on the page.
- **VALIDATE**: `npm run dev` and open `localhost:3000` — should see the idle state with "Nexis" wordmark.

---

### TASK 18: CREATE `components/results/ResultsNarrative.tsx`

- **IMPLEMENT**: Displays the narrative sentence from Claude. Instrument Serif italic, large (1.5rem), white, centered, with bottom margin.
  ```tsx
  export function ResultsNarrative({ narrative }: { narrative: string }) {
    return (
      <p style={{
        fontFamily: 'var(--font-instrument-serif)',
        fontStyle: 'italic',
        fontSize: '1.5rem',
        color: 'white',
        textAlign: 'center',
        lineHeight: 1.5,
        margin: '0 0 48px',
      }}>
        {narrative}
      </p>
    )
  }
  ```
- **VALIDATE**: Render with a sample narrative string.

---

### TASK 19: CREATE `components/results/ResourceCard.tsx`

- **IMPLEMENT**: Displays one resource. Layout: vertical stack, left-aligned, bordered with `border: '1px solid #222'`, padding 24px, gap 12px between elements. Full width within 680px container.
  - Title: system-sans, 1.25rem, white, font-weight 600.
  - Match reason: Instrument Serif regular, 1rem, `#2a5e49`.
  - Topic tags: inline pills, system-sans, 0.75rem, `color: #888`, `border: 1px solid #333`, `padding: 2px 8px`, `borderRadius: 99px`. Render from `topics` array.
  - Link button: system-sans, 0.875rem, white, underline on hover. Renders as `<a href={link} target="_blank" rel="noopener noreferrer">`.
  ```tsx
  interface ResourceCardProps {
    title: string
    matchReason: string
    topics: string[]
    link: string
  }
  export function ResourceCard({ title, matchReason, topics, link }: ResourceCardProps)
  ```
- **VALIDATE**: Render with sample data and verify visual hierarchy.

---

### TASK 20: CREATE `app/results/page.tsx`

- **IMPLEMENT**: Client component (`'use client'`).
  - On mount, reads `nexis-results` from sessionStorage, parses `{ narrative, results }`.
  - If no data found (direct navigation), shows "No results found" with a link back to home.
  - Uses `useAnonymousAuth` to check if user is anonymous.
  - Layout:
    ```
    [Header: "Nexis" left | "Log in" + "Sign up" right (if anonymous)]
    [Body: centered flex column, 680px max-width]
      ResultsNarrative
      ResourceCard × N
      [Footer: "Save your results →" link to /auth/sign-up?reason=save (if anonymous)]
    ```
  - Header: `position: 'sticky'`, `top: 0`, `padding: '16px 24px'`, `backgroundColor: 'black'`, `borderBottom: '1px solid #111'`. Contains Nexis wordmark left, auth buttons right.
  - Auth buttons (only if `isAnonymous`):
    ```tsx
    <a href="/auth/login" style={{ color: '#888', fontSize: '0.875rem', textDecoration: 'none', marginRight: '16px' }}>Log in</a>
    <a href="/auth/sign-up?reason=save" style={{ color: 'white', fontSize: '0.875rem', border: '1px solid white', padding: '6px 16px', textDecoration: 'none' }}>Save results</a>
    ```
  - Body: `padding: '64px 24px'`, black background, full height.
  - SessionStorage key: `nexis-results`
  - Type for stored data:
    ```ts
    interface StoredResults {
      narrative: string
      results: Array<{ id: string; title: string; matchReason: string; topics: string[]; link: string }>
    }
    ```
- **IMPORTS**: `useAnonymousAuth`, `ResourceCard`, `ResultsNarrative`, React hooks
- **VALIDATE**: Navigate to `/results` after completing a full intake flow and verify cards display.

---

### TASK 21: UPDATE `ai-context/INEFFICIENCIES.md`

- **ADD ENTRY**:
  ```markdown
  ### Intake — Auth gate blocks immediate UI render (Feature: voice-intake-ui-and-results)
  **Impact:** Low  
  **Context:** The original `app/page.tsx` gated the entire intake UI on `isReady` from `useAnonymousAuth`, which means the page shows a blank black screen while the anonymous sign-in network call resolves (~200-400ms). The intake instruction slide can be rendered immediately.  
  **Ideal solution:** Render the intake UI immediately; only defer first DB write (intake_sessions insert) until `user?.id` is available.  
  **Workaround in place:** VoiceIntake renders immediately; session creation is deferred inside the hook until sessionId is non-null.
  ```
- **VALIDATE**: `cat ai-context/INEFFICIENCIES.md`

---

### TASK 22: UPDATE `ai-context/SECURITY.md`

- **ADD ENTRY** under Key Rules:
  ```markdown
  ### Results Data Storage (Feature: voice-intake-ui-and-results)
  - Matching results are stored in sessionStorage (`nexis-results`) for client-side results page rendering
  - SessionStorage is isolated per tab/origin — no cross-site access risk
  - Data is cleared when the tab closes — no persistent PII storage in browser
  - In production: add rate limiting to `/api/deepgram-token` to prevent token harvesting
  ```
- **VALIDATE**: `cat ai-context/SECURITY.md`

---

## TESTING STRATEGY

This project has no test framework configured. Validate via:
1. Manual end-to-end flow test (the primary validation path)
2. Individual API endpoint curl tests
3. Browser DevTools for WebSocket message inspection

### Manual Test Scenarios

**Happy path — full intake:**
1. Open `localhost:3000` — see idle state with Nexis wordmark
2. Click "Find your resources" — see instruction slide
3. Click "Begin" — see Question 1, mic indicator pulsing
4. Speak a community identity answer (e.g., "I'm a veteran")
5. After 2.5s silence — auto-advances to Question 2
6. Complete all 4 questions
7. See "Finding your matches..." screen briefly
8. Auto-navigate to `/results`
9. See narrative + 3-5 resource cards
10. Verify Login/Save Results buttons visible in header

**Skip path:**
1. Click "skip" text link on Question 1 — should advance to Question 2

**Anonymous auth:**
1. Confirm no login prompt appears during intake
2. Confirm Login/Save Results appear on results page

**Edge cases:**
- Silence without speech (no transcript) — should NOT trigger advance (guard: transcript length > 10)
- Mic permission denied — should show error state
- `/results` accessed directly — should show "No results found" + home link

---

## VALIDATION COMMANDS

### Level 1: TypeScript + Lint
```bash
npm run lint
npx tsc --noEmit
```

### Level 2: Build
```bash
npm run build
```

### Level 3: API Endpoint Tests (run with dev server active)
```bash
# Deepgram token
curl -X POST http://localhost:3000/api/deepgram-token

# Process answer
curl -X POST http://localhost:3000/api/process-answer \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"00000000-0000-0000-0000-000000000001","questionIndex":0,"questionText":"Do you identify with any communities?","extractionHint":"Extract communities. Return { communities: string[] }.","rawTranscript":"I am a veteran and a woman founder"}'

# Match resources (requires all env vars)
curl -X POST http://localhost:3000/api/match-resources \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"00000000-0000-0000-0000-000000000001","profile":{"communities":["Veteran"],"counties":["Salt Lake"],"industry":"Technology","stage":"early","description":"Building a SaaS product","primaryNeed":"funding","topics":["Funding"]}}'
```

### Level 4: Manual Browser Test
1. `npm run dev`
2. Open `localhost:3000` in Chrome
3. Complete the full intake flow
4. Verify results page renders with cards

---

## ACCEPTANCE CRITERIA

- [ ] Home page renders immediately without any loading gate or auth wall
- [ ] No login or signup buttons visible during the intake flow
- [ ] All four questions can be answered by voice
- [ ] Live transcript displays in real-time (Deepgram WebSocket)
- [ ] 2.5-second silence auto-advances to next question
- [ ] "Skip" affordance is a small text link (not a button)
- [ ] `/api/process-answer` returns structured data and stores to Supabase
- [ ] `/api/match-resources` returns 3-5 personalized results with matchReason
- [ ] Results page shows Login and "Save Results" buttons in header (for anonymous users)
- [ ] Results page hides auth buttons for logged-in users
- [ ] ResourceCard shows title, match reason, topic tags, and link
- [ ] Match reason is specific to the founder (not generic copy)
- [ ] `npm run lint` and `npx tsc --noEmit` pass with zero errors
- [ ] `npm run build` succeeds
- [ ] Design rules respected: no progress bars, no icon libraries, no colored backgrounds, animations ≤ 400ms

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] `npm install` succeeded with `@anthropic-ai/sdk` and `@deepgram/sdk` installed
- [ ] All three API routes respond correctly to curl tests
- [ ] Full end-to-end voice flow completes in browser
- [ ] Results page displays after intake completion
- [ ] TypeScript compiles without errors
- [ ] Lint passes without errors

---

## NOTES

### Key Architectural Decision: sessionStorage for Results

Results are passed from intake to results page via `sessionStorage['nexis-results']`. This avoids:
- URL encoding limitations (too much data for search params)
- Database polling on the results page (slower, requires another round-trip)
- Complicating the results page with server-side data fetching

Tradeoff: results are lost on tab close and can't be shared via URL. Acceptable for MVP.

### Anonymous Auth During Intake

We keep anonymous Supabase sign-in (`useAnonymousAuth`) because:
1. It gives us a stable UUID to use as `sessionId` for linking intake_sessions + intake_answers
2. It enables the conversion flow (anonymous → real account) on the results page without data loss
3. It's fully transparent to the user — no UI appears

The UI just never shows any auth prompts during the intake. The `isReady` gate is removed from the home page so the UI renders immediately.

### Deepgram WebSocket vs. REST

We use Deepgram's WebSocket streaming API (not REST transcription) because:
- Live transcript display requires streaming
- Silence detection via `endpointing` is built-in to the WebSocket API
- REST transcription would require recording, upload, and polling — much slower UX

### Supabase Array Overlap Queries

The Supabase JS v2 client has a `.overlaps(column, value)` method for array overlap (`&&` operator). Use this directly rather than raw `.filter()` with Postgres syntax. If `.overlaps()` isn't available in the installed version, use `.filter('locations', 'ov', `{${counties.join(',')}}`)`.

### Missing `match_resources` RPC

The `match_resources` Supabase RPC function does not exist yet. The execution agent must run the CREATE FUNCTION SQL in the Supabase SQL editor before the vector search will work. The SQL is included in Task 6.

### `openai` Package Placement

`openai` is currently in `devDependencies` which means it won't be available in production builds. Move it to `dependencies` in Task 1.
