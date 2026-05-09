// server-only — never import from a client component.
// Wraps Mapbox Geocoding API v6 forward search. Mirrors the implementation in
// scripts/geocode-startups.ts so address re-geocodes during edit save use the
// same endpoint and token resolution as the bulk import.

const TOKEN =
  process.env.MAPBOX_API_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!TOKEN) {
    throw new Error(
      "MAPBOX_API_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN must be set for server-side geocoding"
    );
  }
  const trimmed = address.trim();
  if (!trimmed) return null;

  const q = encodeURIComponent(trimmed);
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${q}&country=us&limit=1&access_token=${TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("[geocodeAddress] Mapbox returned", res.status, "for", trimmed);
    return null;
  }
  const data = (await res.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
  };
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords) return null;
  return { lng: coords[0], lat: coords[1] };
}
