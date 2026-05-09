"use client";

import { createClient } from "@/lib/supabase/client";
import { COLORS } from "@/lib/map/mapConfig";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// Whitelist of routes the login form is allowed to redirect into via ?next=.
// Open redirect (anywhere off-site) is the obvious abuse — this list blocks it
// while still covering the real flows (map owner returning to edit a listing).
const ALLOWED_NEXT = new Set([
  "/",
  "/map",
  "/resources",
  "/results",
  "/protected",
]);

function safeNextPath(raw: string | null): string {
  if (!raw) return "/protected";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/protected";
  // Strip query/hash for the allowlist check; pass the full thing through if
  // the base path is allowed (so /map?startup=acme works).
  const base = raw.split(/[?#]/)[0];
  return ALLOWED_NEXT.has(base) ? raw : "/protected";
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  // Carry ?next=… through to the sign-up route so the round-trip survives a
  // user who clicks "create one" mid-login.
  const signUpHref = searchParams.get("next")
    ? `/auth/sign-up?next=${encodeURIComponent(searchParams.get("next") ?? "")}`
    : "/auth/sign-up";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push(nextPath);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: COLORS.bg,
        color: COLORS.text,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "720px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "8px",
        }}
      >
        <a
          href="/map"
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "clamp(2.5rem, 6vw, 3.5rem)",
            color: COLORS.text,
            textDecoration: "none",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Nexis
        </a>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 0",
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div>
            <h1
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "2rem",
                color: COLORS.text,
                margin: 0,
                letterSpacing: "-0.01em",
                lineHeight: 1.15,
              }}
            >
              Sign in
            </h1>
            <p
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.9375rem",
                color: COLORS.textMuted,
                margin: "12px 0 0",
                lineHeight: 1.6,
              }}
            >
              Use the email and password you set when you added or claimed your
              listing.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label htmlFor="login-email" style={labelStyle}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <label htmlFor="login-password" style={labelStyle}>
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                style={{
                  fontFamily: "ui-sans-serif, system-ui, -apple-system",
                  fontSize: "0.75rem",
                  color: COLORS.textMuted,
                  textDecoration: "underline",
                }}
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {error && (
            <p
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.8125rem",
                color: "#ef4444",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: "8px",
              padding: "12px 16px",
              border: `1px solid ${COLORS.accent}`,
              background: "transparent",
              color: COLORS.accent,
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.875rem",
              letterSpacing: "0.05em",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
              transition: "background 0.2s ease-out, color 0.2s ease-out",
            }}
            onMouseEnter={(e) => {
              if (isLoading) return;
              (e.currentTarget as HTMLElement).style.background = COLORS.accent;
              (e.currentTarget as HTMLElement).style.color = "black";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = COLORS.accent;
            }}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>

          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.8125rem",
              color: COLORS.textMuted,
              margin: "16px 0 0",
              textAlign: "center",
            }}
          >
            Don&apos;t have an account?{" "}
            <Link
              href={signUpHref}
              style={{
                color: COLORS.accent,
                textDecoration: "underline",
              }}
            >
              Add your startup
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "ui-sans-serif, system-ui, -apple-system",
  fontSize: "0.6875rem",
  color: COLORS.textMuted,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontFamily: "ui-sans-serif, system-ui, -apple-system",
  fontSize: "0.9375rem",
  padding: "10px 12px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
