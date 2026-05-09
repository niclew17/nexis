// Pure URL/slug helpers shared between the bulk-import script and the
// self-serve create route. Implementations mirror scripts/geocode-startups.ts
// so a self-serve insert produces the same shape of `domain`, `linkedin_url`,
// and `slug` that the CSV import does. The script keeps its own inline copies
// to avoid disturbing the import path mid-hackathon.

export function normalizeDomain(websiteOrDomain: string): string {
  const w = websiteOrDomain.trim();
  if (!w) return "";
  try {
    const url = new URL(w.startsWith("http") ? w : `https://${w}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return w
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .split("/")[0]
      .toLowerCase();
  }
}

export function normalizeLinkedInUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return `https://www.linkedin.com${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return trimmed;
  }
}

export function getLinkedInSlug(url: string): string {
  if (!url) return "";
  const match = url.match(/\/company\/([^/?#]+)/);
  return match?.[1] ?? "";
}

// Lowercase, ASCII-only, hyphenated, capped at 60 chars. Used as a slug
// fallback when the LinkedIn URL doesn't yield a /company/<handle> match.
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
}
