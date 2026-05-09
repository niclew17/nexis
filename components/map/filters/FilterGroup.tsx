"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { COLORS } from "@/lib/map/mapConfig";

interface FilterGroupProps {
  label: string;
  activeCount: number;
  children: ReactNode;
  defaultOpen?: boolean;
}

// Collapsible labeled section. Default-open so the surface is discoverable —
// the user can collapse to save space, but shouldn't have to expand to see
// that options exist.
export function FilterGroup({
  label,
  activeCount,
  children,
  defaultOpen = true,
}: FilterGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: COLORS.textMuted,
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.6875rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        <span>
          {label}
          {activeCount > 0 && (
            <span style={{ color: COLORS.accent, marginLeft: "8px" }}>
              {activeCount} selected
            </span>
          )}
        </span>
        <span style={{ fontSize: "0.875rem", color: COLORS.textMuted }}>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {children}
        </div>
      )}
    </div>
  );
}
