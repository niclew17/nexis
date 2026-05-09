"use client";

import { useRef, useCallback, useMemo, useState, useEffect } from "react";
import Map, { Source, Layer, type MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Startup } from "@/lib/map/types";
import { useMapStore } from "@/lib/map/store";
import {
  MAP_STYLE,
  UTAH_BOUNDS,
  MAP_MAX_BOUNDS,
  UTAH_CENTER,
  MAPBOX_STYLE_CONFIG,
  COLORS,
  FOG_2D,
  FOG_3D,
} from "@/lib/map/mapConfig";
import { StartupMarker } from "./StartupMarker";
import { InfoPanel } from "./InfoPanel";

// Mapbox Standard's setConfigProperty isn't on the standard Map type — narrow
// the cast in one place.
type StandardConfigMap = {
  setConfigProperty: (scope: string, key: string, value: unknown) => void;
};

interface MapViewProps {
  startups: Startup[];
}

// Minimum time the black curtain stays opaque before fading. Even on a warm
// Mapbox cache where `load` fires in <100ms, this guarantees the user
// perceives a deliberate transition when arriving on /map (from anywhere —
// landing, refresh, navigation).
const MIN_CURTAIN_MS = 850;

// ~0.0008° ≈ 90m. About 30 coordinate clusters in the dataset share an exact
// lat/lng (largest is an 11-deep stack in a Lehi business park). Without jitter
// only the topmost marker in a cluster is clickable. Spread them around a small
// ring so each is independently selectable. Visible separation appears around
// zoom 11+, where users are picking individual companies.
const COINCIDENT_JITTER_DEG = 0.0008;

function jitterCoincident(startups: Startup[]): Startup[] {
  // globalThis.Map disambiguates from react-map-gl's default `Map` export,
  // which shadows the global Map constructor in this module's scope.
  const groups = new globalThis.Map<string, Startup[]>();
  for (const s of startups) {
    const key = `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }
  const out: Startup[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    group.forEach((s, i) => {
      const angle = (2 * Math.PI * i) / group.length;
      out.push({
        ...s,
        lat: s.lat + COINCIDENT_JITTER_DEG * Math.sin(angle),
        lng: s.lng + COINCIDENT_JITTER_DEG * Math.cos(angle),
      });
    });
  }
  return out;
}

export function MapView({ startups }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const orbitRef = useRef<number | null>(null);
  // Marker components from react-map-gl call map.getCanvasContainer() during
  // mount — that's undefined until the map fires `load` AND has actually
  // attached its canvas to the DOM. Holding the markers out of the tree
  // until then avoids an `appendChild` crash on cold mounts (especially
  // after a client-side navigation from /).
  const [mapLoaded, setMapLoaded] = useState(false);
  const mountedAtRef = useRef(Date.now());
  const { selectedStartup, filters, setSelectedStartup, setMode } =
    useMapStore();

  const renderStartups = useMemo(() => jitterCoincident(startups), [startups]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const isVisible = useCallback(
    (startup: Startup): boolean => {
      const { stage, size, section, county, hiring } = filters;
      if (stage.length && !stage.includes(startup.stage)) return false;
      if (size.length && !size.includes(startup.employees)) return false;
      if (section.length && !section.includes(startup.section)) return false;
      // A startup with county === null/undefined (backfill couldn't resolve)
      // is invisible under any active county filter — the user explicitly
      // asked for a county and we don't know this row's.
      if (county.length && (!startup.county || !county.includes(startup.county)))
        return false;
      if (hiring && !startup.hiring) return false;
      return true;
    },
    [filters]
  );

  // Map setup body. Fires from <Map onLoad={handleMapLoad}> on every fresh
  // mount. With reuseMaps disabled, onLoad reliably refires on each mount,
  // so no idempotency guard or warm-path detector is needed.
  const runMapSetup = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    Object.entries(MAPBOX_STYLE_CONFIG).forEach(([key, value]) => {
      try {
        (map as unknown as StandardConfigMap).setConfigProperty(
          "basemap",
          key,
          value
        );
      } catch {
        // Some Standard config keys may not exist in all style versions —
        // fail silently rather than blocking the whole render.
      }
    });

    try {
      // setFog accepts a partial spec; the union types in mapbox-gl are strict
      // about exact shape so cast through unknown.
      (map as unknown as { setFog: (s: unknown) => void }).setFog(FOG_2D);
    } catch {
      // older style versions may not support fog
    }

    // Fit Utah's bounds to the actual viewport so the whole state is visible
    // regardless of panel width. Without this, a narrow pane (e.g. the
    // /map sidebar layout) would crop the corners at the initial zoom.
    try {
      map.fitBounds(UTAH_BOUNDS, { padding: 24, duration: 0 });
    } catch {}

    // Reveal markers once the dark style has rendered.
    // Primary trigger: `idle` fires after all pending renders complete.
    // Fallback: MIN_CURTAIN_MS after handleMapLoad — handles the reused-map
    // (back-navigation) case where the map is already idle and `idle` won't
    // fire again, and the setConfigProperty continuous-render case.
    //
    // No canvas-container guard needed: StartupMarker already returns null if
    // its own useMap() check fails, and React 18 safely no-ops setState on
    // unmounted components.
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      map.off("idle", reveal);
      const elapsed = Date.now() - mountedAtRef.current;
      const wait = Math.max(0, MIN_CURTAIN_MS - elapsed);
      setTimeout(() => setMapLoaded(true), wait);
    };
    map.on("idle", reveal);
    // 850ms fallback — sufficient for setConfigProperty style commits (~16ms
    // in practice) while preventing the 3s black screen on back-navigation.
    setTimeout(reveal, MIN_CURTAIN_MS);
  }, []);

  const handleMapLoad = useCallback(() => {
    runMapSetup();
  }, [runMapSetup]);

  const stopOrbit = useCallback(() => {
    if (orbitRef.current !== null) {
      cancelAnimationFrame(orbitRef.current);
      orbitRef.current = null;
    }
  }, []);

  const startOrbit = useCallback((map: ReturnType<MapRef["getMap"]>) => {
    const tick = () => {
      map.setBearing((map.getBearing() + 0.05) % 360);
      orbitRef.current = requestAnimationFrame(tick);
    };
    orbitRef.current = requestAnimationFrame(tick);
  }, []);

  const handleMarkerClick = useCallback(
    (startup: Startup) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      setSelectedStartup(startup);
      stopOrbit();

      try {
        (map as unknown as StandardConfigMap).setConfigProperty(
          "basemap",
          "show3dObjects",
          true
        );
      } catch {}

      map.flyTo({
        center: [startup.lng, startup.lat],
        zoom: 17,
        pitch: 65,
        bearing: -28,
        duration: 2200,
        curve: 1.6,
        essential: true,
      });

      map.once("moveend", () => {
        try {
          (map as unknown as { setFog: (s: unknown) => void }).setFog(FOG_3D);
        } catch {}
        setMode("3d");
        startOrbit(map);
      });
    },
    [setSelectedStartup, setMode, startOrbit, stopOrbit]
  );

  const handleBackToUtah = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    stopOrbit();
    setSelectedStartup(null);
    setMode("2d");

    try {
      (map as unknown as StandardConfigMap).setConfigProperty(
        "basemap",
        "show3dObjects",
        false
      );
    } catch {}

    try {
      (map as unknown as { setFog: (s: unknown) => void }).setFog(FOG_2D);
    } catch {}

    // Compute the camera that fits Utah into the *current* viewport rather
    // than hardcoding zoom: 7. fitBounds-style framing keeps the back-to-Utah
    // shot consistent with the initial map load regardless of pane width.
    const camera = map.cameraForBounds(UTAH_BOUNDS, { padding: 24 });
    map.flyTo({
      center: (camera?.center as [number, number]) ?? UTAH_CENTER,
      zoom: camera?.zoom ?? 6,
      pitch: 0,
      bearing: 0,
      duration: 1800,
      essential: true,
    });
  }, [setSelectedStartup, setMode, stopOrbit]);

  // Reset map-level UI state on every mount so navigating to /map always
  // lands on a clean Utah view, regardless of where the prior session left
  // off (e.g. zoomed into a marker in 3D mode). Filters are intentionally
  // NOT reset — voice-set filters are explicit user input and should persist.
  useEffect(() => {
    setSelectedStartup(null);
    setMode("2d");
  }, [setSelectedStartup, setMode]);

  // Unmount cleanup: cancel orbit rAF and reset fog/3d-objects so a recycled
  // map (reuseMaps) doesn't carry 3D-orbit state into the next mount. Without
  // this, startOrbit's rAF closure keeps calling setBearing 60×/sec on the
  // pooled instance after navigation, fighting the next mount's camera reset.
  // Reading mapRef.current inside the cleanup is intentional — with reuseMaps
  // the underlying instance is pooled, not destroyed, so the ref is still
  // valid at unmount time. The exhaustive-deps warning assumes DOM nodes; not
  // applicable here.
  useEffect(() => {
    return () => {
      stopOrbit();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const map = mapRef.current?.getMap();
      if (!map) return;
      try {
        (map as unknown as StandardConfigMap).setConfigProperty(
          "basemap",
          "show3dObjects",
          false
        );
      } catch {}
      try {
        (map as unknown as { setFog: (s: unknown) => void }).setFog(FOG_2D);
      } catch {}
    };
  }, [stopOrbit]);

  // Defensive curtain fallback — even if both onLoad and the warm-path
  // detector somehow miss, force the curtain to fade after a fixed window.
  // setMapLoaded is idempotent so this is safe to fire alongside primary paths.
  useEffect(() => {
    const timer = setTimeout(() => setMapLoaded(true), MIN_CURTAIN_MS + 200);
    return () => clearTimeout(timer);
  }, []);

  if (!token) {
    return (
      <div
        style={{
          width: "100%",
          height: "100dvh",
          backgroundColor: "black",
          color: COLORS.textMuted,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.875rem",
          padding: "32px",
          textAlign: "center",
        }}
      >
        Map requires <code style={{ color: COLORS.accent, margin: "0 6px" }}>NEXT_PUBLIC_MAPBOX_TOKEN</code>{" "}
        in <code style={{ color: COLORS.accent, margin: "0 6px" }}>.env.local</code>.
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "black",
      }}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle={MAP_STYLE}
        // NOTE: reuseMaps was previously enabled to survive React Strict
        // Mode's double-mount in dev. It caused a worse bug on real
        // navigation: pooled marker handles from the prior /map session
        // accumulated against the recycled mapbox-gl instance, freezing
        // the page on second mount and silently dropping new markers.
        // Disabled here — the appendChild-of-undefined crash that originally
        // motivated reuseMaps is already neutered by StartupMarker's
        // getCanvasContainer() null guard (StartupMarker.tsx:31-38).
        initialViewState={{
          longitude: UTAH_CENTER[0],
          latitude: UTAH_CENTER[1],
          zoom: 6,
          pitch: 0,
          bearing: 0,
        }}
        maxBounds={MAP_MAX_BOUNDS}
        minZoom={4}
        maxZoom={18}
        onLoad={handleMapLoad}
        style={{ width: "100%", height: "100%" }}
      >
        <Source id="utah-border" type="geojson" data="/utah-border.geojson">
          <Layer
            id="utah-glow"
            type="line"
            paint={{
              "line-color": COLORS.accent,
              "line-width": 6,
              "line-opacity": 0.15,
              "line-blur": 4,
            }}
          />
          <Layer
            id="utah-border-line"
            type="line"
            paint={{
              "line-color": COLORS.accent,
              "line-width": 2.5,
              "line-opacity": 0.9,
            }}
          />
        </Source>

        {mapLoaded &&
          renderStartups.map((startup) => (
            <StartupMarker
              key={startup.slug || `${startup.lat},${startup.lng},${startup.name}`}
              startup={startup}
              isActive={selectedStartup?.slug === startup.slug}
              isVisible={isVisible(startup)}
              onClick={handleMarkerClick}
            />
          ))}
      </Map>

      {/* Black curtain — opaque until the dark style is fully applied,
          then fades out. Hides the bright default-style flash and gives
          arrival from / a deliberate transition feel. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "black",
          pointerEvents: "none",
          opacity: mapLoaded ? 0 : 1,
          transition: "opacity 0.7s ease-out",
          zIndex: 5,
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
            border: `1px solid ${COLORS.accent}`,
            opacity: mapLoaded ? 0 : 1,
            transition: "opacity 0.4s ease-out",
            animation: "mapCurtainPulse 1.6s ease-in-out infinite",
          }}
        />
      </div>

      {selectedStartup && (
        <InfoPanel startup={selectedStartup} onClose={handleBackToUtah} />
      )}
    </div>
  );
}
