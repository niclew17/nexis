// Pure helpers used by both the client (UX pre-check) and the server
// (authoritative re-check inside /api/startups/claim). No Supabase imports.

export function extractEmailDomain(email: string): string | null {
  const match = email.trim().toLowerCase().match(/^[^\s@]+@([a-z0-9.-]+)$/);
  return match?.[1] ?? null;
}

export function matchesStartupDomain(
  emailDomain: string | null,
  startupDomain: string | null | undefined
): boolean {
  if (!emailDomain || !startupDomain) return false;
  // Strip an accidental www. on the startup side defensively — the import
  // already normalizes this, but we should not let a stray prefix block a
  // legitimate match if a future writer skips normalization.
  const normalizedStartup = startupDomain.trim().toLowerCase().replace(/^www\./, "");
  return emailDomain.trim() === normalizedStartup;
}
