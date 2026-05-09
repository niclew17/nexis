"use client";

import { useState } from "react";
import { COLORS } from "@/lib/map/mapConfig";

interface ClaimPasswordStepProps {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (password: string) => void;
  onBack: () => void;
}

export function ClaimPasswordStep({
  email,
  isSubmitting,
  error,
  onSubmit,
  onBack,
}: ClaimPasswordStepProps) {
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isSubmitting) onSubmit(password);
      }}
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}
    >
      <label
        htmlFor="claim-password"
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.75rem",
          color: COLORS.textMuted,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Create a password
      </label>
      <input
        id="claim-password"
        type="password"
        autoComplete="new-password"
        autoFocus
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters"
        style={{
          background: "transparent",
          border: `1px solid ${COLORS.border}`,
          color: COLORS.text,
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.9375rem",
          padding: "10px 12px",
          outline: "none",
        }}
      />
      <p
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.75rem",
          color: COLORS.textMuted,
          margin: 0,
        }}
      >
        We&apos;ll send a 6-digit code to <span style={{ color: COLORS.accent }}>{email}</span>.
      </p>
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
      <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            flex: 1,
            padding: "10px 16px",
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
        >
          {isSubmitting ? "Sending..." : "Send code"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          style={{
            background: "none",
            border: "none",
            color: COLORS.textMuted,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.8125rem",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            padding: "0 8px",
            textDecoration: "underline",
          }}
        >
          back
        </button>
      </div>
    </form>
  );
}
