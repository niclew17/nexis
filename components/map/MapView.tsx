"use client";

import { useRef, useCallback, useState } from "react";
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

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const isVisible = useCallback(
    (startup: Startup): boolean => {
      const { stage, size, section } = filters;
      if (stage.length && !stage.includes(startup.stage)) return false;
      if (size.length && !size.includes(startup.employees)) return false;
      if (section.length && !section.includes(startup.section)) return false;
      return true;
    },
    [filters]
  );

  const handleMapLoad = useCallback(() => {
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

    // Wait for the next `idle` event before mounting markers. `load` only
    // means the initial style finished — `idle` means the map has actually
    // committed a render with the canvas attached, which is the precondition
    // react-map-gl's <Marker> needs (it does map.getCanvasContainer()
    // .appendChild() in its mount effect; calling that before idle crashed
    // every marker on first navigation from / → /map).
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      map.off("idle", reveal);

      const m = mapRef.current?.getMap?.();
      // Defensive: react-map-gl's destroy() teardown can null out the canvas
      // container under React Strict Mode's mount/unmount/mount cycle. If the
      // map is gone, do nothing — the next mount will fire its own idle.
      if (!m || !m.getCanvasContainer?.()) return;

      // Hold the curtain for at least MIN_CURTAIN_MS so a warm-cache load
      // (which can fire idle in <100ms) still feels like a deliberate
      // transition rather than a flash.
      const elapsed = Date.now() - mountedAtRef.current;
      const wait = Math.max(0, MIN_CURTAIN_MS - elapsed);
      setTimeout(() => {
        if (!mapRef.current?.getMap?.()?.getCanvasContainer?.()) return;
        setMapLoaded(true);
      }, wait);
    };
    map.on("idle", reveal);
    // Fallback: if idle never fires within 3s of `load` (e.g. setConfigProperty
    // kicks the map into a continuous render loop), reveal anyway. The canvas
    // container check inside reveal() guards against the unhealthy case.
    setTimeout(reveal, 3000);
  }, []);

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
        // reuseMaps lets react-map-gl recycle the underlying mapbox-gl Map
        // across React Strict Mode's mount/unmount/mount cycle in dev. Without
        // it, the second mount tries to instantiate a new map into a container
        // that still holds the old map's canvas — Mapbox warns "container
        // element should be empty" and child <Marker>s mount against a stale
        // map whose canvas container is undefined, which is what crashed
        // markers with `appendChild of undefined` on first navigation.
        reuseMaps
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
          startups.map((startup) => (
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
