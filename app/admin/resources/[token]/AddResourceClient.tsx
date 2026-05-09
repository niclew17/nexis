"use client";

import { useState } from "react";
import { COLORS } from "@/lib/map/mapConfig";
import { AddResourceForm } from "@/components/admin/AddResourceForm";

export function AddResourceClient({ token }: { token: string }) {
  const [created, setCreated] = useState<{ id: string; externalId: number } | null>(null);

  if (created) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h2
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.75rem",
            color: COLORS.text,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Resource added
        </h2>
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.9375rem",
            color: COLORS.textMuted,
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          external_id: {created.externalId}
        </p>
        <button
          type="button"
          onClick={() => setCreated(null)}
          style={{
            alignSelf: "flex-start",
            padding: "12px 16px",
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
          Add another
        </button>
      </div>
    );
  }

  return (
    <AddResourceForm
      token={token}
      onSuccess={(id, externalId) => setCreated({ id, externalId })}
    />
  );
}
