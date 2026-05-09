"use client";

import { useState } from "react";
import { COLORS } from "@/lib/map/mapConfig";
import { extractEmailDomain } from "@/lib/startups/domainCheck";
import { isFreeMailDomain } from "@/lib/startups/freeMailDomains";

interface CreateAuthStepProps {
  initialEmail: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (creds: { email: string; password: string }) => void;
}

export function CreateAuthStep({
  initialEmail,
  isSubmitting,
  error,
  onSubmit,
}: CreateAuthStepProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);

  // Local UX-only check; the hook also rejects free-mail server-side.
  const trimmedDomain = extractEmailDomain(email);
  const localError =
    touched && trimmedDomain && isFreeMailDomain(trimmedDomain)
      ? "Free email providers aren't allowed. Use your company email."
      : null;
  const displayError = error ?? localError;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isSubmitting) return;
        onSubmit({ email, password });
      }}
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
          Add your startup
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
          Use your company email — we&apos;ll verify ownership of the domain.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label
          htmlFor="create-email"
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.6875rem",
            color: COLORS.textMuted,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Company email
        </label>
        <input
          id="create-email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="you@yourcompany.com"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label
          htmlFor="create-password"
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.6875rem",
            color: COLORS.textMuted,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Password
        </label>
        <input
          id="create-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          style={inputStyle}
        />
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.75rem",
            color: COLORS.textDim,
            margin: 0,
          }}
        >
          8+ characters. We&apos;ll send a 6-digit code to your email next.
        </p>
      </div>

      {displayError && (
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.8125rem",
            color: "#ef4444",
            margin: 0,
          }}
        >
          {displayError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          marginTop: "8px",
          padding: "12px 16px",
          border: `1px solid ${COLORS.accent}`,
          background: "transparent",
          color: COLORS.accent,
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.875rem",
          letterSpacing: "0.05em",
          cursor: isSubmitting ? "not-allowed" : "pointer",
          opacity: isSubmitting ? 0.6 : 1,
          transition: "background 0.2s ease-out, color 0.2s ease-out",
        }}
        onMouseEnter={(e) => {
          if (isSubmitting) return;
          (e.currentTarget as HTMLElement).style.background = COLORS.accent;
          (e.currentTarget as HTMLElement).style.color = "black";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = COLORS.accent;
        }}
      >
        {isSubmitting ? "Sending..." : "Continue"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontFamily: "ui-sans-serif, system-ui, -apple-system",
  fontSize: "0.9375rem",
  padding: "10px 12px",
  outline: "none",
};
