"use client";

import { COLORS } from "@/lib/map/mapConfig";

export function ClaimedBadge() {
  return (
    <span
      style={{
        padding: "3px 10px",
        fontSize: "0.6875rem",
        fontFamily: "ui-sans-serif, system-ui, -apple-system",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        border: `1px solid ${COLORS.borderAccent}`,
        background: "rgba(42, 94, 73, 0.15)",
        color: COLORS.accent,
        borderRadius: "2px",
      }}
    >
      Claimed
    </span>
  );
}
