"use client";

import { COLORS } from "@/lib/map/mapConfig";

interface FilterChipProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

// Single tap-to-toggle chip. Three visual variants:
//   - active: solid accent fill, dark text
//   - disabled (count === 0): muted border, dim text, no pointer events
//   - inactive: transparent w/ accent border (default chip look)
export function FilterChip({ label, count, active, onClick }: FilterChipProps) {
  const disabled = count === 0;
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "5px 12px",
    borderRadius: "2px",
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    fontSize: "0.75rem",
    letterSpacing: "0.04em",
    cursor: disabled ? "not-allowed" : "pointer",
    transition:
      "background 0.15s ease-out, color 0.15s ease-out, border-color 0.15s ease-out",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };
  const variant: React.CSSProperties = active
    ? {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
        color: "#000",
      }
    : disabled
    ? {
        backgroundColor: "transparent",
        borderColor: COLORS.border,
        color: COLORS.textDim,
      }
    : {
        backgroundColor: "rgba(0,0,0,0.6)",
        borderColor: COLORS.borderAccent,
        color: COLORS.accent,
      };

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...baseStyle, ...variant }}
      aria-pressed={active}
    >
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          style={{
            fontSize: "0.6875rem",
            color: active
              ? "rgba(0,0,0,0.7)"
              : disabled
              ? COLORS.textDim
              : COLORS.textMuted,
          }}
        >
          ({count})
        </span>
      )}
    </button>
  );
}
