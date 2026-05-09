"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Startup } from "@/lib/map/types";
import { useMapStore } from "@/lib/map/store";
import { COLORS } from "@/lib/map/mapConfig";
import { MapSidebar } from "./MapSidebar";
import { VoiceFilterButton } from "./VoiceFilterButton";
import { FilterChips } from "./FilterChips";
import { FilterDrawer } from "./filters/FilterDrawer";

// Mapbox GL JS requires browser APIs (Worker, Canvas) — disable SSR for the
// MapView component. Next 16 requires this dynamic import to live in a Client
// Component, which is why this wrapper exists.
//
// The loading state mirrors MapView's curtain (same black background + pulse
// ring) so the transition from / → /map reads as one continuous moment
// rather than: empty black → flash → curtain → fade.
const MapView = dynamic(
  () => import("@/components/map/MapView").then((m) => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: "1px solid #2a5e49",
            animation: "mapCurtainPulse 1.6s ease-in-out infinite",
          }}
        />
      </div>
    ),
  }
);

interface MapClientProps {
  startups: Startup[];
}

export function MapClient({ startups }: MapClientProps) {
  // We default to `null` (unknown) on the server / first paint and resolve to
  // a concrete boolean once we can read window.innerWidth. Rendering the same
  // tree on every render — only the *style* of the wrapper differs — means
  // <MapView> stays mounted across breakpoint changes. Swapping it between
  // two distinct JSX trees would trigger a full mapbox-gl unmount/remount
  // (and lose the canvas container during the transition, which is what
  // caused markers to crash with `appendChild of undefined` on first nav).
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Deep-link: when the URL carries ?startup=<slug>, auto-open that pin's
  // InfoPanel. Used by /map/new's redirect after a successful create and by
  // the duplicate-domain notice's "Claim {name}" link. Runs once on mount;
  // we deliberately don't include searchParams or startups in the deps so
  // the user can close the panel without us re-opening it.
  const searchParams = useSearchParams();
  useEffect(() => {
    const slug = searchParams.get("startup");
    if (!slug) return;
    const match = startups.find((s) => s.slug === slug);
    if (match) {
      useMapStore.getState().setSelectedStartup(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Treat unknown as desktop for layout purposes — desktop is the larger
  // viewport so the sidebar reserves space without overflowing on mobile
  // (mobile hides the sidebar via display:none below).
  const showSidebar = isMobile === false;
  const showMobileChrome = isMobile === true;

  const filters = useMapStore((s) => s.filters);
  const totalActiveFilters =
    filters.stage.length +
    filters.size.length +
    filters.section.length +
    filters.county.length +
    (filters.hiring ? 1 : 0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div
      style={{
        height: "100dvh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "row",
        backgroundColor: "black",
        color: "white",
      }}
    >
      <div
        style={{
          width: "45%",
          minWidth: "360px",
          maxWidth: "560px",
          borderRight: "1px solid #111",
          display: showSidebar ? "flex" : "none",
          flexDirection: "column",
        }}
      >
        <MapSidebar startups={startups} />
      </div>
      <div style={{ flex: 1, height: "100%", position: "relative" }}>
        <MapView startups={startups} />

        {showMobileChrome && (
          <>
            {/* Mobile-only chip strip overlay — desktop renders this inside
                MapSidebar so it doesn't sit on top of the map. */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10,
                padding: "16px 20px",
                display: "flex",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <FilterChips />
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              style={{
                position: "absolute",
                bottom: "100px",
                left: "16px",
                zIndex: 50,
                padding: "8px 14px",
                backgroundColor: "rgba(0,0,0,0.85)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                border: `1px solid ${COLORS.borderAccent}`,
                color: COLORS.accent,
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.8125rem",
                letterSpacing: "0.04em",
                cursor: "pointer",
              }}
              aria-label="Open filters"
            >
              Filters
              {totalActiveFilters > 0 ? ` (${totalActiveFilters})` : ""}
            </button>
            <FilterDrawer
              startups={startups}
              isOpen={drawerOpen}
              onClose={() => setDrawerOpen(false)}
            />
            <VoiceFilterButton />
          </>
        )}
      </div>
    </div>
  );
}
