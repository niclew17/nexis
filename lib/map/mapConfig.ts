// Utah map bounds and Mapbox Standard style configuration.
// Land color is set to near-black so the map blends into the page background;
// only the green Utah border outline (added via custom GeoJSON layer) and
// startup markers remain visible at low zoom.

// Tight bounding box of Utah — used with map.fitBounds() to frame the state.
export const UTAH_BOUNDS: [[number, number], [number, number]] = [
  [-114.05, 36.99], // SW corner
  [-109.04, 42.00], // NE corner
];

// Wider box used as the map's maxBounds. Mapbox clamps the zoom-out so the
// maxBounds always fills the viewport — if maxBounds == UTAH_BOUNDS, narrow
// panes can't zoom out far enough to fit all of Utah. This expanded box gives
// the camera ~2° of slack on every side while still keeping the user roughly
// scoped to the region.
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-116.5, 35.0],
  [-106.5, 44.0],
];

export const UTAH_CENTER: [number, number] = [-111.093, 39.321];

export const MAP_STYLE = "mapbox://styles/mapbox/standard";

// Applied via setConfigProperty("basemap", key, value) after map load.
// Each call is wrapped in try/catch in MapView since Standard style key names
// can change between versions; unsupported keys fail silently.
export const MAPBOX_STYLE_CONFIG: Record<string, string | boolean> = {
  lightPreset: "night",
  colorBackground: "#000000",
  colorSurface: "#010101",
  colorWater: "#020f08",
  colorMotorways: "#151515",
  colorTrunks: "#111111",
  colorRoads: "#0a0a0a",
  colorAdminBoundaries: "#1a3329",
  showPointOfInterestLabels: false,
  showTransitLabels: false,
};

export const COLORS = {
  bg: "#000000",
  surface: "#0a0a0a",
  surfaceElevated: "#111111",
  accent: "#2a5e49",
  accentDim: "rgba(42, 94, 73, 0.3)",
  accentBright: "#3a7a60",
  text: "#ffffff",
  textMuted: "#666666",
  textDim: "#333333",
  border: "#1a1a1a",
  borderAccent: "rgba(42, 94, 73, 0.4)",
};

// Atmospheric fog presets — applied via map.setFog(...).
// 3D mode uses dramatic horizon depth; 2D uses minimal fog so the
// black land fill stays uniform.
export const FOG_3D = {
  range: [0.5, 10] as [number, number],
  "horizon-blend": 0.2,
  color: "#000000",
  "high-color": "#020f08",
  "space-color": "#000000",
  "star-intensity": 0.0,
};

export const FOG_2D = {
  range: [10, 20] as [number, number],
  "horizon-blend": 0.0,
  color: "#000000",
  "high-color": "#000000",
  "space-color": "#000000",
  "star-intensity": 0.0,
};
