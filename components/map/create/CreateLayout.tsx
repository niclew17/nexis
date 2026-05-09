"use client";

import type { ReactNode } from "react";
import { COLORS } from "@/lib/map/mapConfig";

interface CreateLayoutProps {
  children: ReactNode;
}

// Full-screen black surface for the multi-step create flow. The Nexis logo
// link uses a plain <a> (not next/link) for the same reason MapSidebar's logo
// does — full nav wipes any pooled mapbox-gl state when leaving / entering
// the map.
export function CreateLayout({ children }: CreateLayoutProps) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: COLORS.bg,
        color: COLORS.text,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "720px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <a
          href="/map"
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.5rem",
            color: COLORS.text,
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          Nexis
        </a>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 0",
        }}
      >
        {children}
      </div>
    </div>
  );
}
