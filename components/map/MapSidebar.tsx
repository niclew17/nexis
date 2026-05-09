"use client";

import { useState } from "react";
import { useMapStore } from "@/lib/map/store";
import { COLORS } from "@/lib/map/mapConfig";
import type { Startup } from "@/lib/map/types";
import { VoiceFilterButton } from "./VoiceFilterButton";
import { FilterPanel } from "./filters/FilterPanel";
import { FilterChips } from "./FilterChips";

interface MapSidebarProps {
  startups: Startup[];
}

type SidebarMode = "voice" | "filters";

export function MapSidebar({ startups }: MapSidebarProps) {
  const { isListening } = useMapStore();
  // Default to voice — it's the headline interaction. Users can toggle to the
  // tap-driven FilterPanel when they want to browse what's available. The
  // store's filters apply regardless of which view is active, so toggling
  // doesn't lose any in-flight selections.
  const [mode, setMode] = useState<SidebarMode>("voice");

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
      {/* Plain <a> (not next/link) forces a full browser navigation when
          leaving the map, which wipes all client state — mapbox-gl's pooled
          map instance, the leaked orbit rAF, and Zustand store contents. A
          client-side nav back to / would preserve that state and re-entry
          to /map would render the recycled map without markers. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
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
      </a>

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
            {mode === "voice"
              ? isListening
                ? "Listening — name a stage, sector, or company size."
                : "Tap the mic and tell me what you're looking for."
              : "Pick filters to narrow the map."}
          </p>
        </div>

        <ModeToggle mode={mode} onChange={setMode} />

        {mode === "voice" ? (
          <VoiceFilterButton variant="inline" />
        ) : (
          <div style={{ width: "100%" }}>
            <FilterPanel startups={startups} />
          </div>
        )}

        {/* Active filters strip — visible regardless of which mode set them.
            FilterChips self-hides when there's nothing active. */}
        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <FilterChips />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            marginTop: "8px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.8125rem",
                color: COLORS.textMuted,
                margin: 0,
              }}
            >
              Don&apos;t see your company?
            </p>
            {/* Plain <a> matches the logo link's full-nav rationale above —
                keeps mapbox-gl pooled state clean across navigations. */}
            <a
              href="/map/new"
              style={{
                display: "inline-block",
                marginTop: "8px",
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.875rem",
                color: COLORS.accent,
                textDecoration: "none",
                letterSpacing: "0.05em",
              }}
            >
              Add it →
            </a>
          </div>

          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.8125rem",
                color: COLORS.textMuted,
                margin: 0,
              }}
            >
              Already an owner?
            </p>
            {/* ?next=/map sends the user back to the map after login so they
                can immediately click their pin and hit Edit listing. */}
            <a
              href="/auth/login?next=/map"
              style={{
                display: "inline-block",
                marginTop: "8px",
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.875rem",
                color: COLORS.accent,
                textDecoration: "none",
                letterSpacing: "0.05em",
              }}
            >
              Sign in →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ModeToggleProps {
  mode: SidebarMode;
  onChange: (m: SidebarMode) => void;
}

function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "999px",
        padding: "3px",
        gap: "2px",
      }}
    >
      <ToggleButton
        label="Voice"
        active={mode === "voice"}
        onClick={() => onChange("voice")}
      />
      <ToggleButton
        label="Filters"
        active={mode === "filters"}
        onClick={() => onChange("filters")}
      />
    </div>
  );
}

interface ToggleButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function ToggleButton({ label, active, onClick }: ToggleButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "6px 16px",
        borderRadius: "999px",
        border: "none",
        cursor: "pointer",
        fontFamily: "ui-sans-serif, system-ui, -apple-system",
        fontSize: "0.75rem",
        letterSpacing: "0.05em",
        backgroundColor: active ? COLORS.accent : "transparent",
        color: active ? "#000" : COLORS.textMuted,
        transition: "background 0.15s ease-out, color 0.15s ease-out",
      }}
    >
      {label}
    </button>
  );
}
