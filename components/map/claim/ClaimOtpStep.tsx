"use client";

import { useState } from "react";
import { COLORS } from "@/lib/map/mapConfig";

interface ClaimOtpStepProps {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  resendIn: number;
  onSubmit: (token: string) => void;
  onResend: () => void;
}

export function ClaimOtpStep({
  email,
  isSubmitting,
  error,
  resendIn,
  onSubmit,
  onResend,
}: ClaimOtpStepProps) {
  const [token, setToken] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isSubmitting) onSubmit(token);
      }}
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}
    >
      <label
        htmlFor="claim-otp"
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.75rem",
          color: COLORS.textMuted,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Enter the 6-digit code
      </label>
      <input
        id="claim-otp"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        required
        maxLength={6}
        pattern="\d{6}"
        value={token}
        onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
        placeholder="123456"
        style={{
          background: "transparent",
          border: `1px solid ${COLORS.border}`,
          color: COLORS.text,
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "1.125rem",
          letterSpacing: "0.4em",
          padding: "10px 12px",
          outline: "none",
          textAlign: "center",
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
        Sent to <span style={{ color: COLORS.accent }}>{email}</span>. Check spam if it doesn&apos;t arrive.
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
      <div style={{ display: "flex", gap: "12px", marginTop: "4px", alignItems: "center" }}>
        <button
          type="submit"
          disabled={isSubmitting || token.length !== 6}
          style={{
            flex: 1,
            padding: "10px 16px",
            border: `1px solid ${COLORS.accent}`,
            background: "transparent",
            color: COLORS.accent,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.875rem",
            letterSpacing: "0.05em",
            cursor: isSubmitting || token.length !== 6 ? "not-allowed" : "pointer",
            opacity: isSubmitting || token.length !== 6 ? 0.5 : 1,
            transition: "background 0.2s ease-out, color 0.2s ease-out",
          }}
        >
          {isSubmitting ? "Verifying..." : "Verify"}
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={resendIn > 0 || isSubmitting}
          style={{
            background: "none",
            border: "none",
            color: resendIn > 0 ? COLORS.textDim : COLORS.textMuted,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.8125rem",
            cursor: resendIn > 0 || isSubmitting ? "not-allowed" : "pointer",
            padding: "0 8px",
            textDecoration: "underline",
          }}
        >
          {resendIn > 0 ? `resend in ${resendIn}s` : "resend code"}
        </button>
      </div>
    </form>
  );
}
