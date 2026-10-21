// Access rule: verified addresses at the exact domain "uwo.ca" may use Orbit AI. When the team turns on
// OPEN_SIGNUP=on (server env), verified addresses at any real-looking domain (Gmail, Hotmail, …) may too.
// Either way this proves the person controls the inbox; it does not prove current enrolment. Early access /
// waitlist rules (lib/auth/access.ts) still decide who gets into the app.

const ALLOWED_DOMAIN = "uwo.ca";

// ASCII-only local part, so unicode lookalikes (e.g. Cyrillic letters) are rejected.
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@([a-z0-9.-]+)$/;
// A public domain: labels of letters/digits/hyphens, at least one dot, a letters-only top-level domain.
const PUBLIC_DOMAIN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,24}$/;

type Env = Record<string, string | undefined>;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Non-school sign-up is off unless the team sets OPEN_SIGNUP=on on the server. */
export function openSignupEnabled(env: Env = process.env): boolean {
  return (env.OPEN_SIGNUP ?? "").trim().toLowerCase() === "on";
}

function domainOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = EMAIL_PATTERN.exec(normalizeEmail(raw));
  return match ? match[1] : null;
}

/** A Western address (exact domain: rejects sub.uwo.ca, uwo.ca.evil.com, xuwo.ca, etc.). */
export function isSchoolEmail(raw: string | null | undefined): boolean {
  return domainOf(raw) === ALLOWED_DOMAIN;
}

/** Any address with a valid public domain (used only when open sign-up is on). */
export function isPublicEmail(raw: string | null | undefined): boolean {
  const domain = domainOf(raw);
  return Boolean(domain && domain.length <= 253 && PUBLIC_DOMAIN.test(domain));
}

export function isAllowedEmail(raw: string | null | undefined, env: Env = process.env): boolean {
  return isSchoolEmail(raw) || (openSignupEnabled(env) && isPublicEmail(raw));
}

/** What to tell someone whose address isn't accepted. */
export function notAllowedMessage(env: Env = process.env): string {
  return openSignupEnabled(env) ? "Enter a valid email address." : "Orbit AI is only open to @uwo.ca email addresses.";
}
