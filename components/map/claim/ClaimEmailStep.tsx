"use client";

import { useState } from "react";
import { COLORS } from "@/lib/map/mapConfig";

interface ClaimEmailStepProps {
  startupDomain: string;
  initialValue: string;
  error: string | null;
  onSubmit: (email: string) => void;
  onCancel: () => void;
}

export function ClaimEmailStep({
  startupDomain,
  initialValue,
  error,
  onSubmit,
  onCancel,
}: ClaimEmailStepProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}
    >
      <label
        htmlFor="claim-email"
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.75rem",
          color: COLORS.textMuted,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Company email
      </label>
      <input
        id="claim-email"
        type="email"
        autoComplete="email"
        autoFocus
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`you@${startupDomain}`}
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
        Verifying ownership of <span style={{ color: COLORS.accent }}>{startupDomain}</span>
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
          style={{
            flex: 1,
            padding: "10px 16px",
            border: `1px solid ${COLORS.accent}`,
            background: "transparent",
            color: COLORS.accent,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.875rem",
            letterSpacing: "0.05em",
            cursor: "pointer",
            transition: "background 0.2s ease-out, color 0.2s ease-out",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = COLORS.accent;
            (e.currentTarget as HTMLElement).style.color = "black";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = COLORS.accent;
          }}
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "none",
            border: "none",
            color: COLORS.textMuted,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.8125rem",
            cursor: "pointer",
            padding: "0 8px",
            textDecoration: "underline",
          }}
        >
          cancel
        </button>
      </div>
    </form>
  );
}
