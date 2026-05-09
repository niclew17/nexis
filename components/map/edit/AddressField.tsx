"use client";

import { COLORS } from "@/lib/map/mapConfig";

interface AddressFieldProps {
  value: string;
  originalValue: string;
  onChange: (value: string) => void;
}

export function AddressField({ value, originalValue, onChange }: AddressFieldProps) {
  const hasChanged = value.trim() !== (originalValue ?? "").trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label
        htmlFor="edit-address"
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.6875rem",
          color: COLORS.textMuted,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Address
      </label>
      <textarea
        id="edit-address"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        style={{
          background: "transparent",
          border: `1px solid ${hasChanged ? COLORS.accent : COLORS.border}`,
          color: COLORS.text,
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.875rem",
          padding: "8px 10px",
          outline: "none",
          resize: "vertical",
        }}
      />
      {hasChanged && (
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.75rem",
            color: COLORS.accent,
            margin: 0,
          }}
        >
          Saving will move the marker to the new location.
        </p>
      )}
    </div>
  );
}
