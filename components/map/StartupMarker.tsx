"use client";

import { Marker, useMap } from "react-map-gl";
import { useState } from "react";
import type { Startup } from "@/lib/map/types";
import { COLORS } from "@/lib/map/mapConfig";

interface StartupMarkerProps {
  startup: Startup;
  isActive: boolean;
  isVisible: boolean;
  onClick: (startup: Startup) => void;
}

export function StartupMarker({
  startup,
  isActive,
  isVisible,
  onClick,
}: StartupMarkerProps) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const RADIUS = 20;

  // Defensive: react-map-gl's <Marker> calls map.getCanvasContainer() in its
  // mount effect. During brief transitional states (HMR, fast navigation,
  // Strict Mode double-mounts) the container can be undefined even after the
  // map's `load` event has fired, which crashes with `appendChild` on
  // undefined. Skip render entirely in that case — the marker will mount
  // cleanly on the next render once the map is fully ready.
  const mapCollection = useMap();
  let mapReady = false;
  try {
    mapReady = Boolean(mapCollection.current?.getMap?.()?.getCanvasContainer?.());
  } catch {
    mapReady = false;
  }
  if (!mapReady) return null;

  const initials = startup.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();

  // Outer wrapper is sized to the maximum scaled disc (RADIUS*2 * 1.2 = 48px)
  // and never changes size. Mapbox uses the child element's bounding box to
  // anchor a Marker; if our hover scale grew that box, the marker would shift
  // on the map. Keeping the outer box static + scaling only the inner disc
  // pins the anchor in place.
  const OUTER = Math.round(RADIUS * 2 * 1.2);

  return (
    <Marker longitude={startup.lng} latitude={startup.lat} anchor="center">
      <div
        style={{
          width: OUTER,
          height: OUTER,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: isVisible ? "auto" : "none",
          opacity: isVisible ? 1 : 0.12,
          transition: "opacity 0.2s ease-out",
        }}
      >
        <div
          onClick={() => onClick(startup)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: RADIUS * 2,
            height: RADIUS * 2,
            borderRadius: "50%",
            border: isActive
              ? `3px solid ${COLORS.accentBright}`
              : `2px solid ${COLORS.accent}`,
            overflow: "hidden",
            cursor: "pointer",
            backgroundColor: COLORS.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition:
              "transform 0.15s ease-out, border-color 0.15s ease-out, box-shadow 0.15s ease-out",
            transform: hovered || isActive ? "scale(1.2)" : "scale(1)",
            boxShadow: isActive
              ? `0 0 12px ${COLORS.accentDim}, 0 0 4px ${COLORS.accent}`
              : hovered
              ? `0 0 6px ${COLORS.accentDim}`
              : "0 2px 6px rgba(0,0,0,0.5)",
            animation: isActive ? "markerPulse 2s ease-out infinite" : "none",
          }}
        >
          {!imgError && startup.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={startup.logo_url}
              alt={startup.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setImgError(true)}
            />
          ) : (
            <span
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.625rem",
                fontWeight: 600,
                color: COLORS.text,
                letterSpacing: "0.02em",
              }}
            >
              {initials || "•"}
            </span>
          )}
        </div>
      </div>
    </Marker>
  );
}
