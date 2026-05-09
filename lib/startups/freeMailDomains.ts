// Hand-maintained list of free / consumer email providers. Add to it as new
// free providers surface in the wild. Used by both the /api/startups/create
// route (server-authoritative) and the create-flow auth step (UX pre-check).
// Pure helper — no Supabase imports.

export const FREE_MAIL_DOMAINS = new Set<string>([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "msn.com",
  "yandex.com",
  "zoho.com",
  "gmx.com",
  "fastmail.com",
  "duck.com",
]);

export function isFreeMailDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return FREE_MAIL_DOMAINS.has(domain.trim().toLowerCase());
}
