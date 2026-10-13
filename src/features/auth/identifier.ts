// Supabase Auth needs an email. Bulk-created learners (often without email, US-P-02) get a
// synthetic address on the reserved `.invalid` TLD (RFC 2606) so it can never reach a real inbox.
export const USERNAME_EMAIL_DOMAIN = "pelajar.interview-ai.invalid";

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,32}$/;

export function usernameToEmail(username: string): string {
  return `${username}@${USERNAME_EMAIL_DOMAIN}`;
}

/** Login field accepts "email atau username". */
export function loginIdentifierToEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value.includes("@")) return value;
  return USERNAME_PATTERN.test(value) ? usernameToEmail(value) : null;
}

/** Only same-origin paths, so `?next=` can't be used as an open redirect. */
export function safeNextPath(next: unknown, fallback = "/dashboard"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : fallback;
}
