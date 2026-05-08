# Feature: Project Cleanup + Anonymous Auth Foundation

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to: the `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env var name (not `ANON_KEY`), the `proxy.ts` vs `middleware.ts` distinction, and the two-step anonymous-to-permanent conversion flow.

## Feature Description

Replace the default Next.js + Supabase starter boilerplate with a clean Nexis project shell. Wire up Supabase anonymous auth so that every visitor is automatically signed in as an anonymous user on arrival — no signup required. Then add the conversion path on the results page so that after seeing their matched resources, a founder can optionally create a permanent account (converting their anonymous session into a saved account while preserving all session data and the same UUID).

## User Story

As a Utah founder arriving at Nexis
I want to immediately start the voice intake without creating an account
So that there is zero friction between landing and getting my results

As a founder who has seen my matched resources
I want to optionally save my results by creating an account
So that I can return later and access my personalized resource list

## Problem Statement

The project is currently the default Next.js + Supabase starter template with tutorial-only UI (Deploy button, hero, connect-steps, env-var warnings). The home page needs to be replaced with the Nexis intake shell, the design tokens must match the Nexis design system (Instrument Serif, black/white/`#2a5e49`), and the auth flow must be rethought: Supabase's standard sign-up-first model is the wrong UX here — founders should complete the intake first, then optionally save.

## Solution Statement

1. **Clean phase** — delete or replace all starter-template components that don't belong in Nexis (`hero`, `deploy-button`, `env-var-warning`, `next-logo`, `supabase-logo`, `tutorial/` directory). Replace the home page with a minimal Nexis shell. Update layout and CSS tokens.
2. **Infrastructure phase** — create `middleware.ts` for session refresh on every request; update proxy route-guard logic to allow anonymous users through the intake and results flow while guarding the `/saved` route for permanent users only.
3. **Anon auth phase** — initialize an anonymous Supabase session on intake entry via a client-side hook so every visitor has an `auth.uid()` from the start. This user ID gets attached to `intake_sessions` and `intake_answers` rows.
4. **Conversion phase** — on the results page, offer a "Save your results" call-to-action. The conversion form calls `updateUser({ email })` (not `signUp`) against the existing anonymous session, triggering a verification email. After confirmation the UUID is preserved — no data migration needed.

## Feature Metadata

**Feature Type**: Refactor + New Capability  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `middleware.ts`/`proxy.ts`, `components/sign-up-form.tsx`, `app/protected/`, `lib/utils.ts`  
**Dependencies**: `@supabase/ssr` (already installed), `next-themes` (already installed), Google Fonts Instrument Serif (loaded via Next.js `next/font/google`)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `app/page.tsx` (lines 1–58) — current starter home page, replace entirely
- `app/layout.tsx` (lines 1–41) — update metadata, swap Geist for Instrument Serif, set dark as default theme
- `app/globals.css` (lines 1–68) — replace CSS vars with Nexis design tokens; keep Tailwind directives
- `lib/supabase/client.ts` (lines 1–8) — uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `ANON_KEY`) — do NOT rename
- `lib/supabase/server.ts` (lines 1–34) — server client pattern, already correct, keep as-is
- `lib/supabase/proxy.ts` (lines 1–76) — Vercel Fluid compute proxy + route guard; update the route-guard logic to handle anonymous users
- `proxy.ts` (lines 1–20) — root-level proxy entry point for Vercel; keep as-is but understand it
- `lib/utils.ts` (lines 9–11) — remove `hasEnvVars` (tutorial artifact)
- `components/sign-up-form.tsx` (lines 19–120) — calls `supabase.auth.signUp()`; needs a companion form that calls `updateUser({ email })` for the conversion flow
- `components/login-form.tsx` (lines 19–110) — standard email/password login; keep, only minor updates
- `app/auth/confirm/route.ts` (lines 1–30) — handles email OTP verification; update redirect from `/protected` to `/results` or `/saved`
- `app/protected/page.tsx` (lines 1–43) — replace tutorial content with "My Resources" placeholder
- `app/protected/layout.tsx` (lines 1–55) — remove starter branding; replace with minimal Nexis nav

### New Files to Create

- `middleware.ts` (root) — standard Next.js middleware for session refresh; replaces the need to depend on Vercel Fluid compute for local dev
- `hooks/useAnonymousAuth.ts` — client hook that calls `signInAnonymously()` if no session exists; used in the intake page
- `components/auth/ConvertAccountForm.tsx` — form that calls `updateUser({ email })` for anon→permanent conversion; shown on results page
- `scripts/002_create_intake_tables.sql` — SQL for `intake_sessions` and `intake_answers` tables with RLS policies

### Files to DELETE (starter-only, no Nexis value)

- `components/hero.tsx`
- `components/deploy-button.tsx`
- `components/env-var-warning.tsx`
- `components/next-logo.tsx`
- `components/supabase-logo.tsx`
- `components/tutorial/code-block.tsx`
- `components/tutorial/connect-supabase-steps.tsx`
- `components/tutorial/fetch-data-steps.tsx`
- `components/tutorial/sign-up-user-steps.tsx`
- `components/tutorial/tutorial-step.tsx`

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [Supabase Anonymous Sign-Ins Guide](https://supabase.com/docs/guides/auth/auth-anonymous)
  - Section: "Sign in a user anonymously"
  - Why: API signatures and caveats for `signInAnonymously()`
- [Supabase JS Reference: signInAnonymously](https://supabase.com/docs/reference/javascript/auth-signinanonymously)
  - Why: Return shape and options
- [Supabase Identity Linking Guide](https://supabase.com/docs/guides/auth/auth-identity-linking)
  - Why: The two-step `updateUser({ email })` → confirm → `updateUser({ password })` conversion flow
- [Supabase SSR Client Setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
  - Section: "Creating a client for Next.js App Router"
  - Why: Middleware pattern for session refresh
- [Next.js middleware.ts docs](https://nextjs.org/docs/app/building-your-application/routing/middleware)
  - Why: File naming (`middleware.ts` at root, not `proxy.ts`) and matcher config

### Patterns to Follow

**Supabase client creation (never module-level globals):**
```ts
// In any server component or API route:
const supabase = await createClient()  // from @/lib/supabase/server
// In any client component:
const supabase = createClient()        // from @/lib/supabase/client
```

**Anonymous user check in client components:**
```ts
const { data: { user } } = await supabase.auth.getUser()
const isAnonymous = user?.is_anonymous === true
// OR from JWT (faster, no network call):
const { data: { session } } = await supabase.auth.getSession()
```

**Anonymous → permanent conversion (TWO STEPS — do not combine):**
```ts
// Step 1: trigger email verification (user is currently logged in anonymously)
await supabase.auth.updateUser({ email: 'user@example.com' })
// → Supabase sends a confirmation email; user clicks link
// Step 2: after confirmation (in a new session or after redirect):
await supabase.auth.updateUser({ password: 'their-password' })
// UUID is preserved. All existing rows remain owned by this user.
```

**GOTCHA — Never call `signUp()` for conversion:** Calling `supabase.auth.signUp({ email, password })` on an existing anonymous session does NOT convert it — it creates a new separate user and abandons the anonymous session, losing all linked data.

**GOTCHA — `updateUser({ password })` before email verify = 422 error:** You cannot set a password until the email is verified. The form must handle the two-step sequence: collect email → show "check your email" state → user verifies → optionally prompt for password.

**Design token pattern (Nexis):**
```css
/* globals.css — use these exact values */
--nexis-black: #000000;
--nexis-white: #ffffff;
--nexis-accent: #2a5e49;   /* foreground only, never as background fill */
--nexis-muted-dark: #666666;
--nexis-muted-light: #999999;
```

**Typography:**
```ts
// In layout.tsx — import Instrument Serif alongside system sans
import { Instrument_Serif } from 'next/font/google'
const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  weight: ['400'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
})
// Apply CSS variable to <body>; Tailwind can reference via font-['Instrument_Serif']
```

**Naming conventions:**
- Components: PascalCase files in `components/` subdirectory matching domain (e.g., `components/auth/ConvertAccountForm.tsx`)
- Hooks: camelCase with `use` prefix in `hooks/` (e.g., `hooks/useAnonymousAuth.ts`)
- SQL scripts: `scripts/NNN_description.sql` pattern (already established: `001_create_resources.sql`)

---

## IMPLEMENTATION PLAN

### Phase 1: Clean the Project

Remove all starter-template files and update core layout files to match Nexis design system. After this phase the app will look like a blank Nexis-branded shell.

### Phase 2: Middleware + Session Infrastructure

Create `middleware.ts` for local dev session refresh. Update the route guard in `proxy.ts` to understand the difference between "unauthenticated" (no session) and "anonymous authenticated" (has session, `is_anonymous: true`). Only the `/saved` route (permanent-users-only) should block anonymous users.

### Phase 3: Anonymous Auth Hook

Build the `useAnonymousAuth` hook that silently creates an anonymous session on arrival. On the intake page, this runs once in a `useEffect` — it calls `getUser()` first; only calls `signInAnonymously()` if there's no existing session (prevents creating a new anon user on every page load).

### Phase 4: Intake Tables SQL

Write the SQL migration for `intake_sessions` and `intake_answers` with RLS policies that let authenticated users (including anonymous) insert and read their own rows. This sets up the database for the intake flow build.

### Phase 5: Post-Results Conversion Flow

Build the `ConvertAccountForm` component and update the sign-up page to detect anonymous users and use the conversion path (`updateUser`) instead of the new-user path (`signUp`).

---

## STEP-BY-STEP TASKS

### TASK 1: DELETE unused starter components

Remove all tutorial and Vercel-branding files that have no place in Nexis.

- **REMOVE**: `components/hero.tsx`
- **REMOVE**: `components/deploy-button.tsx`
- **REMOVE**: `components/env-var-warning.tsx`
- **REMOVE**: `components/next-logo.tsx`
- **REMOVE**: `components/supabase-logo.tsx`
- **REMOVE**: `components/tutorial/` (entire directory, 5 files)
- **GOTCHA**: Check that nothing outside of `app/page.tsx` and `app/protected/` imports these before deleting. Run `grep -r "tutorial\|hero\|deploy-button\|env-var-warning\|next-logo\|supabase-logo" app/ components/ --include="*.tsx" --include="*.ts"` first.
- **VALIDATE**: `npm run build` — should have zero "module not found" errors for deleted files

---

### TASK 2: UPDATE `lib/utils.ts` — remove tutorial artifact

- **REMOVE**: The `hasEnvVars` export (lines 9–11). It is only used by deleted starter components.
- **KEEP**: The `cn()` helper (lines 1–6).
- **GOTCHA**: Grep for `hasEnvVars` across `app/` and `components/` before removing — `app/protected/layout.tsx` and `app/page.tsx` both import it and must be updated in this same pass.
- **VALIDATE**: `npm run lint` — zero unused import errors

---

### TASK 3: UPDATE `app/globals.css` — Nexis design tokens

Replace the shadcn default CSS variable values with Nexis-specific tokens. Keep the Tailwind directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`) and the `@layer base` structure.

- **UPDATE** `:root` block — replace values:
  ```css
  :root {
    --background: 0 0% 100%;         /* white */
    --foreground: 0 0% 0%;           /* black */
    --card: 0 0% 100%;
    --card-foreground: 0 0% 0%;
    --primary: 0 0% 0%;
    --primary-foreground: 0 0% 100%;
    --secondary: 0 0% 96%;
    --secondary-foreground: 0 0% 0%;
    --muted: 0 0% 96%;
    --muted-foreground: 0 0% 40%;    /* #666 equivalent */
    --accent: 153 38% 27%;           /* #2a5e49 in HSL */
    --accent-foreground: 0 0% 100%;
    --border: 0 0% 89%;
    --input: 0 0% 89%;
    --ring: 153 38% 27%;             /* accent ring */
    --radius: 0.5rem;
    /* Remove chart variables — unused in Nexis */
  }
  .dark {
    --background: 0 0% 0%;           /* pure black */
    --foreground: 0 0% 100%;         /* pure white */
    --card: 0 0% 0%;
    --card-foreground: 0 0% 100%;
    --primary: 0 0% 100%;
    --primary-foreground: 0 0% 0%;
    --secondary: 0 0% 10%;
    --secondary-foreground: 0 0% 100%;
    --muted: 0 0% 10%;
    --muted-foreground: 0 0% 40%;    /* #666 */
    --accent: 153 38% 27%;           /* #2a5e49 — same in dark */
    --accent-foreground: 0 0% 100%;
    --border: 0 0% 15%;
    --input: 0 0% 15%;
    --ring: 153 38% 27%;
  }
  ```
- **ADD** after `@layer base` block:
  ```css
  /* Nexis custom utilities */
  .text-nexis-accent { color: #2a5e49; }
  .text-nexis-muted { color: #666666; }
  .dark .text-nexis-muted { color: #666666; }
  ```
- **VALIDATE**: `npm run dev` — visually confirm background is white (light mode) / black (dark mode)

---

### TASK 4: UPDATE `app/layout.tsx` — Nexis metadata + Instrument Serif

- **REMOVE**: Geist font import and usage
- **ADD**: Instrument Serif import from `next/font/google`
- **UPDATE**: metadata title and description to Nexis branding
- **UPDATE**: `defaultTheme` to `"dark"` in ThemeProvider (dark is primary for Nexis per CLAUDE.md)

```ts
import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Nexis — Find Your Utah Business Resources",
  description:
    "Answer four questions by voice. Get personalized Utah state resources in under two minutes.",
};

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${instrumentSerif.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- **VALIDATE**: `npm run dev` — page title shows "Nexis — Find Your Utah Business Resources" in browser tab; `<body>` has `--font-instrument-serif` CSS var available

---

### TASK 5: UPDATE `app/page.tsx` — Nexis intake shell

Replace the entire starter home page with a minimal centered shell that will host the voice intake. This is a placeholder — the full intake UI components are built in a subsequent feature plan.

```tsx
export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "black",
        color: "white",
      }}
    >
      <div style={{ maxWidth: "680px", width: "100%", padding: "0 24px" }}>
        {/* Voice intake UI mounts here */}
        <p style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.25rem", textAlign: "center" }}>
          Nexis — coming soon
        </p>
      </div>
    </main>
  );
}
```

- **NOTE**: Inline styles used here intentionally — no Tailwind classes yet to keep the shell dependency-free. The intake components plan will replace this with proper Tailwind.
- **VALIDATE**: `npm run dev` — navigate to `/`, see a black full-screen page with centered text. No nav, no footer, no Supabase branding.

---

### TASK 6: UPDATE `app/protected/layout.tsx` — remove starter nav

Remove all references to deleted components (`DeployButton`, `EnvVarWarning`, `AuthButton`, `hasEnvVars`) and replace with minimal Nexis-branded nav.

```tsx
import Link from "next/link";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <Link href="/" className="font-semibold">
              Nexis
            </Link>
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5 w-full">
          {children}
        </div>
      </div>
    </main>
  );
}
```

- **VALIDATE**: `npm run lint` — zero import errors

---

### TASK 7: UPDATE `app/protected/page.tsx` — replace with "My Resources" placeholder

Remove `FetchDataSteps`, `InfoIcon`, tutorial content. This page is where returning (permanent, non-anonymous) users will eventually see their saved results.

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SavedPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  // Redirect anonymous users — this page is for permanent accounts only
  if (data.claims.is_anonymous) {
    redirect("/auth/sign-up?reason=save");
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Your Saved Resources</h1>
      <p className="text-muted-foreground">
        Your personalized resource matches will appear here.
      </p>
    </div>
  );
}
```

- **VALIDATE**: `npm run build` — no TypeScript errors

---

### TASK 8: CREATE `middleware.ts` — session refresh for local dev

The existing `proxy.ts` handles Vercel Fluid compute (production). Create a standard Next.js `middleware.ts` at the project root so session refresh also works during local development.

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- **GOTCHA**: The existing `proxy.ts` at root already exports `proxy` with `config`. The new `middleware.ts` uses `export default`-equivalent (`export async function middleware`) — Next.js requires this exact function name for `middleware.ts` to be recognized. Do not name it anything else.
- **GOTCHA**: Both files share the same `updateSession` logic from `lib/supabase/proxy.ts`. This is intentional — DRY.
- **VALIDATE**: `npm run dev` — check browser DevTools > Application > Cookies for `sb-*-auth-token` cookie being set/refreshed on navigation

---

### TASK 9: UPDATE `lib/supabase/proxy.ts` — route guard for anonymous users

The current guard (lines 51–59) redirects any unauthenticated user hitting non-home, non-auth routes to `/auth/login`. With anonymous auth, all users will be authenticated (either anon or permanent). Update the guard to only block the `/saved` route (future permanent-users-only page) for anonymous users.

Replace lines 51–59 with:

```ts
const isAnonymous = user?.is_anonymous === true;

// Unauthenticated users on any non-auth route → login
if (!user && !request.nextUrl.pathname.startsWith("/auth")) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  return NextResponse.redirect(url);
}

// Anonymous users trying to reach permanent-user-only routes → sign-up
const permanentOnlyPaths = ["/saved", "/protected"];
if (
  isAnonymous &&
  permanentOnlyPaths.some((p) => request.nextUrl.pathname.startsWith(p))
) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/sign-up";
  url.searchParams.set("reason", "save");
  return NextResponse.redirect(url);
}
```

- **GOTCHA**: `user?.is_anonymous` comes from the JWT claims object. The `getClaims()` call returns `data.claims` which includes `is_anonymous`. This field is only present in the Supabase JWT when the user was created via `signInAnonymously()`.
- **VALIDATE**: Manually test with an anonymous session — hitting `/protected` should redirect to `/auth/sign-up?reason=save`

---

### TASK 10: CREATE `hooks/useAnonymousAuth.ts`

Client hook that ensures every visitor has an anonymous Supabase session. Checks for existing session first to avoid creating a new anonymous user on every render.

```ts
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAnonymousAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function ensureSession() {
      const { data: { user: existingUser } } = await supabase.auth.getUser();

      if (existingUser) {
        setUser(existingUser);
        setIsReady(true);
        return;
      }

      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error && data.user) {
        setUser(data.user);
      }
      setIsReady(true);
    }

    ensureSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, isReady, isAnonymous: user?.is_anonymous === true };
}
```

- **GOTCHA**: Call `getUser()` (network call to Supabase auth server) not `getSession()` (reads local cookie/storage) — `getUser()` validates the token server-side and is the authoritative check.
- **GOTCHA**: Anonymous rate limit is 30 sign-ins/hour/IP. The `getUser()` check before `signInAnonymously()` prevents re-creating a new anon user on every page reload.
- **VALIDATE**: Add the hook to `app/page.tsx` temporarily, log `user`, confirm anonymous user object appears in console after page load

---

### TASK 11: UPDATE `app/page.tsx` — integrate anonymous auth hook

Update the intake shell to initialize the anonymous session on mount. This ensures every visitor has an `auth.uid()` before the intake begins.

```tsx
"use client";

import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";

export default function Home() {
  const { isReady } = useAnonymousAuth();

  if (!isReady) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "black",
        }}
      />
    );
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "black",
        color: "white",
      }}
    >
      <div style={{ maxWidth: "680px", width: "100%", padding: "0 24px" }}>
        {/* Voice intake UI mounts here */}
        <p
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.25rem",
            textAlign: "center",
          }}
        >
          Nexis — ready
        </p>
      </div>
    </main>
  );
}
```

- **NOTE**: The page is `"use client"` because `useAnonymousAuth` uses `useEffect`. This is correct — the voice intake will also be a client component.
- **VALIDATE**: Open browser DevTools > Network, verify `signInAnonymously` POST to Supabase fires once on first visit. Reload — verify it does NOT fire again (existing session found).

---

### TASK 12: CREATE `components/auth/ConvertAccountForm.tsx`

A form specifically for the anon-to-permanent conversion flow. Shown on the results page. Calls `updateUser({ email })` against the existing anonymous session.

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConversionState = "idle" | "email_sent" | "error";

export function ConvertAccountForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<ConversionState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/saved`,
      },
    });

    setIsLoading(false);

    if (error) {
      setErrorMsg(error.message);
      setState("error");
    } else {
      setState("email_sent");
    }
  };

  if (state === "email_sent") {
    return (
      <div style={{ textAlign: "center" }}>
        <p>Check your email at <strong>{email}</strong> to confirm your account.</p>
        <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "8px" }}>
          Your results are saved and will be waiting when you return.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <Label htmlFor="save-email">Email address</Label>
        <Input
          id="save-email"
          type="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ marginTop: "8px" }}
        />
      </div>
      {errorMsg && (
        <p style={{ fontSize: "0.875rem", color: "#ef4444" }}>{errorMsg}</p>
      )}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save my results"}
      </Button>
    </form>
  );
}
```

- **GOTCHA**: Do NOT call `signUp()` here. `updateUser({ email })` is the correct conversion call — it updates the existing anonymous user record in Supabase, triggers email verification, and preserves the UUID.
- **GOTCHA**: The `emailRedirectTo` must point to `/auth/confirm?next=/saved` — this is the existing OTP confirm route that redirects to `next` after verification.
- **VALIDATE**: With an anonymous session active, submit the form with a real email. Check Supabase Dashboard > Auth > Users — the anonymous user should now have the email attached and `is_anonymous` should still be `true` until they confirm.

---

### TASK 13: UPDATE `app/auth/sign-up/page.tsx` — detect anonymous users

The current sign-up page always shows `SignUpForm` (which calls `signUp()`). Update it to detect if the user is already anonymous and show `ConvertAccountForm` instead.

```tsx
import { createClient } from "@/lib/supabase/server";
import { SignUpForm } from "@/components/sign-up-form";
import { ConvertAccountForm } from "@/components/auth/ConvertAccountForm";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isAnonymous = data?.claims?.is_anonymous === true;
  const { reason } = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {isAnonymous ? (
          <div>
            <h2 className="text-2xl font-semibold mb-2">
              {reason === "save" ? "Save your results" : "Create an account"}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Enter your email to save your personalized resource matches.
            </p>
            <ConvertAccountForm />
          </div>
        ) : (
          <SignUpForm />
        )}
      </div>
    </div>
  );
}
```

- **NOTE**: `searchParams` is now a Promise in Next.js 15 — must `await` it.
- **VALIDATE**: Visit `/auth/sign-up?reason=save` while having an anonymous session active → should show "Save your results" heading and `ConvertAccountForm`. Visit same URL without a session → should show standard `SignUpForm`.

---

### TASK 14: UPDATE `app/auth/confirm/route.ts` — update default redirect

Change the fallback redirect from `"/"` to `/saved` so that after email confirmation the user lands on the saved resources page.

- **UPDATE** line 9: Change `const next = searchParams.get("next") ?? "/"` to `const next = searchParams.get("next") ?? "/saved"`
- **VALIDATE**: Follow the full conversion flow end-to-end (see Manual Validation below)

---

### TASK 15: CREATE `scripts/002_create_intake_tables.sql`

SQL migration for `intake_sessions` and `intake_answers` with RLS allowing authenticated users (including anonymous) to manage their own rows.

```sql
-- Run in Supabase SQL editor after 001_create_resources.sql

-- Intake sessions
create table if not exists intake_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  status       text not null default 'in_progress'
                 check (status in ('in_progress', 'completed', 'abandoned')),
  started_at   timestamptz default now(),
  completed_at timestamptz
);

-- Intake answers (one row per question per session)
create table if not exists intake_answers (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid references intake_sessions(id) on delete cascade,
  question_index   integer not null check (question_index between 0 and 3),
  question_text    text not null,
  raw_transcript   text,
  extracted_answer text,
  structured_data  jsonb,
  is_answered      boolean default false,
  answered_at      timestamptz,
  unique (session_id, question_index)
);

-- Enable RLS
alter table intake_sessions enable row level security;
alter table intake_answers enable row level security;

-- Sessions: users can manage their own rows
create policy "Users manage own sessions"
  on intake_sessions
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Answers: users can manage answers for their own sessions
create policy "Users manage own answers"
  on intake_answers
  for all
  to authenticated
  using (
    session_id in (
      select id from intake_sessions where user_id = auth.uid()
    )
  )
  with check (
    session_id in (
      select id from intake_sessions where user_id = auth.uid()
    )
  );

-- Index for fast session lookup by user
create index if not exists intake_sessions_user_id_idx on intake_sessions (user_id);
create index if not exists intake_answers_session_id_idx on intake_answers (session_id);
```

- **NOTE**: `user_id` is set server-side using `auth.uid()` from the service-role client — do not rely on the client to pass the user ID.
- **NOTE**: The `user_id` UUID is the same whether the user is anonymous or permanent, so rows survive the conversion.
- **VALIDATE**: Run in Supabase SQL editor. Confirm tables appear in Studio. Test that an anonymous user (via the app) can insert a session row but cannot read another user's rows.

---

### TASK 16: UPDATE `ai-context/SECURITY.md` + `ai-context/INEFFICIENCIES.md`

Update project docs to reflect the new auth model.

**SECURITY.md** — add under "Key Rules":
```
- Anonymous users are assigned auth.uid() on arrival via signInAnonymously(); all intake rows are linked to this ID
- Row-level security on intake_sessions and intake_answers restricts reads/writes to the owning user
- The /saved route is guarded server-side against anonymous users via proxy.ts
- updateUser({ email }) is the correct conversion path — never call signUp() for existing anon sessions
- Anonymous sign-in rate limit: 30/hour/IP (Supabase default); enable Turnstile/hCaptcha in production
```

**SECURITY.md** — update "Out of Scope (MVP)":
```
- Rate limiting on API routes (deferred)
- CAPTCHA on anonymous sign-in endpoint (deferred to post-MVP)
```

**INEFFICIENCIES.md** — add entry:
```
### Auth — Two middleware entry points
**Impact:** Low  
**Context:** The project has both proxy.ts (Vercel Fluid compute) and middleware.ts (standard Next.js middleware). Both call the same updateSession() logic. This is intentional duplication for environment compatibility, but adds surface area.  
**Ideal solution:** A single middleware approach once deployed environment is finalized.  
**Workaround in place:** Both files share the updateSession() implementation from lib/supabase/proxy.ts.
```

---

## TESTING STRATEGY

### Unit Tests

No unit test framework is currently configured in this project. Skip automated unit tests; validate via manual flow testing.

### Edge Cases

- **No env vars** — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` not set: the `updateSession` function in `proxy.ts` includes an early return guard (`if (!hasEnvVars)`) — verify this still works after the `hasEnvVars` removal from `lib/utils.ts`. The guard in `proxy.ts` references `lib/utils.ts` so the import must remain there (or the guard must be updated to check the env var directly).

> **CRITICAL FIX**: Because `proxy.ts` imports `hasEnvVars` from `lib/utils.ts`, do NOT remove `hasEnvVars` from `lib/utils.ts` in Task 2 without first updating `lib/supabase/proxy.ts` to replace that guard with a direct env check: `if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)`.

- **Returning visitor** — user has an existing anonymous session cookie: `useAnonymousAuth` calls `getUser()` first, finds the session, skips `signInAnonymously()`. Verify no extra anon user created on each visit.
- **Conversion before results** — user visits `/auth/sign-up` directly without completing intake: show `ConvertAccountForm` (they're anonymous), conversion email still works, data is preserved.
- **Conversion on non-anonymous account** — if somehow a real user hits `/auth/sign-up?reason=save`, show the standard `SignUpForm`.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
npm run lint
```
Zero errors expected.

```bash
npx tsc --noEmit
```
Zero TypeScript errors expected.

### Level 2: Build

```bash
npm run build
```
Zero build errors. No "module not found" errors from deleted components.

### Level 3: Manual Validation

**Full anonymous auth flow:**
1. Clear all cookies/localStorage for localhost:3000
2. `npm run dev` → navigate to `http://localhost:3000`
3. Open DevTools > Network — confirm POST to `*/auth/v1/signup` with `{"data":{"is_anonymous":true}}` fires once
4. Open DevTools > Application > Cookies — confirm `sb-*-auth-token` cookie is set
5. Reload page — confirm the `signInAnonymously` POST does NOT fire again
6. Open DevTools > Application > Cookies — confirm same `sb-*-auth-token` cookie persists

**Route guard (anonymous → /saved redirect):**
1. With anonymous session active, navigate to `http://localhost:3000/saved`
2. Expected: redirect to `/auth/sign-up?reason=save`
3. Expected: "Save your results" heading, `ConvertAccountForm` shown

**Route guard (no session → /saved redirect):**
1. Clear cookies, navigate to `http://localhost:3000/saved`
2. Expected: redirect to `/auth/login`

**Full conversion flow:**
1. With anonymous session, visit `/auth/sign-up?reason=save`
2. Enter a real email address, submit
3. Expected: "Check your email" confirmation state shown
4. Check Supabase Dashboard > Auth > Users — confirm the anonymous user now has email attached, `is_anonymous` still `true`
5. Click confirmation link in email
6. Expected: redirect to `/saved` page showing "Your Saved Resources"
7. Check Supabase Dashboard > Auth > Users — same user UUID, `is_anonymous` now `false`

**Layout and design:**
1. Confirm page title in browser tab reads "Nexis — Find Your Utah Business Resources"
2. Confirm dark background (#000) by default
3. Confirm no Supabase branding, no Deploy button, no tutorial steps

---

## ACCEPTANCE CRITERIA

- [ ] All starter-only components deleted; no broken imports
- [ ] Home page is a full-screen black page with Instrument Serif font, no nav/footer/branding
- [ ] `npm run build` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] Anonymous session created silently on first visit (confirmed via Network tab)
- [ ] Session persists on reload — no new anon user created
- [ ] Anonymous users visiting `/saved` are redirected to `/auth/sign-up?reason=save`
- [ ] `/auth/sign-up?reason=save` shows `ConvertAccountForm` for anonymous users, standard `SignUpForm` for unauthenticated users
- [ ] Submitting `ConvertAccountForm` calls `updateUser({ email })` (not `signUp()`), shows "Check your email" state
- [ ] After email confirmation, user lands on `/saved` and `is_anonymous` is `false` in Supabase Dashboard
- [ ] UUID is identical before and after conversion (confirmed in Dashboard)
- [ ] `intake_sessions` and `intake_answers` tables exist in Supabase with RLS enabled
- [ ] Design tokens updated: dark mode = pure black bg, white text, `#2a5e49` accent

---

## COMPLETION CHECKLIST

- [ ] All 16 tasks completed in order
- [ ] Deleted files verified via `npm run build` (zero import errors)
- [ ] `proxy.ts` guard updated for anonymous user awareness
- [ ] `middleware.ts` created at project root
- [ ] `useAnonymousAuth` hook tested in browser
- [ ] `ConvertAccountForm` tested with real Supabase project
- [ ] SQL migration run in Supabase Studio
- [ ] SECURITY.md and INEFFICIENCIES.md updated
- [ ] Full end-to-end conversion flow validated manually

---

## NOTES

**Why `updateUser` not `signUp` for conversion:** Calling `signUp()` on an existing anonymous session creates a brand new user record and abandons the anonymous one. All `intake_sessions` data linked to the anonymous UUID would be orphaned. `updateUser({ email })` modifies the existing record in-place, preserving the UUID.

**Why two-step conversion (email first, password second):** Supabase enforces this server-side. Attempting `updateUser({ password })` before the email is verified returns a 422 error. The `ConvertAccountForm` handles only Step 1 (email). If you want to let users set a password after confirmation, add a separate form on the `/saved` page that calls `updateUser({ password })` — this is optional for MVP since users can sign in via magic link.

**Magic link vs. password:** For MVP, magic-link-only sign-in (no password) is simpler to implement and removes the second form entirely. After the email is confirmed, the user is permanently signed in via the confirmation link. Returning users request a new magic link to sign in. Consider this for the MVP to reduce complexity.

**The `proxy.ts` / `middleware.ts` duality:** Vercel's Fluid compute uses `proxy.ts` at the edge. Standard Next.js middleware uses `middleware.ts`. Both are needed: `middleware.ts` for local dev and non-Vercel deployments; `proxy.ts` for production on Vercel. Both delegate to `lib/supabase/proxy.ts#updateSession`.

**Confidence Score: 8.5/10** — The Supabase anonymous auth APIs are well-documented and stable. The main risk is the `is_anonymous` JWT claim behavior in `getClaims()` vs `getUser()` — verify this returns the expected shape in the actual Supabase project before building the route guard logic.
