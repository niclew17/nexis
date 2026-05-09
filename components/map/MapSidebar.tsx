"use client";

import Link from "next/link";
import { useMapStore } from "@/lib/map/store";
import { COLORS } from "@/lib/map/mapConfig";
import { VoiceFilterButton } from "./VoiceFilterButton";
import { FilterChips } from "./FilterChips";

export function MapSidebar() {
  const { filters, isListening } = useMapStore();
  const hasFilters =
    filters.stage.length + filters.size.length + filters.section.length > 0;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflowY: "auto",
      }}
    >
      <Link
        href="/"
        style={{
          position: "absolute",
          top: "32px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "block",
          lineHeight: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Nexis"
          style={{ height: "72px", width: "auto", opacity: 0.9, userSelect: "none" }}
        />
      </Link>

      <div
        style={{
          marginTop: "auto",
          marginBottom: "auto",
          width: "100%",
          padding: "128px 32px 64px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "32px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "2.25rem",
              color: COLORS.text,
              margin: 0,
              letterSpacing: "-0.01em",
              lineHeight: 1.15,
            }}
          >
            Utah&apos;s startup map
          </p>
          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.9375rem",
              color: COLORS.textMuted,
              margin: "12px 0 0",
              lineHeight: 1.6,
              maxWidth: "360px",
            }}
          >
            {isListening
              ? "Listening — name a stage, sector, or company size."
              : hasFilters
              ? "Speak again to refine, or browse the highlighted markers."
              : "Tap the mic and tell me what you're looking for, or explore the map."}
          </p>
        </div>

        <VoiceFilterButton variant="inline" />

        {hasFilters && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              maxWidth: "100%",
            }}
          >
            <span
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.6875rem",
                color: COLORS.textDim,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Filters
            </span>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <FilterChips />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
