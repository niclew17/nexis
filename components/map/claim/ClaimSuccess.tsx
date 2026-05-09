"use client";

import { COLORS } from "@/lib/map/mapConfig";

interface ClaimSuccessProps {
  startupName: string;
  onEdit: () => void;
  onClose: () => void;
}

export function ClaimSuccess({ startupName, onEdit, onClose }: ClaimSuccessProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "1.125rem",
          color: COLORS.accent,
          margin: 0,
        }}
      >
        You now own {startupName}.
      </p>
      <p
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.8125rem",
          color: COLORS.textMuted,
          margin: 0,
        }}
      >
        Edit your listing or close to keep browsing.
      </p>
      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        <button
          onClick={onEdit}
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
          Edit listing
        </button>
        <button
          onClick={onClose}
          style={{
            padding: "10px 16px",
            border: `1px solid ${COLORS.border}`,
            background: "transparent",
            color: COLORS.textMuted,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.875rem",
            letterSpacing: "0.05em",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
