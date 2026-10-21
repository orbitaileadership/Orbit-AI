import { emailDomain, normalizeEmail } from "./eligibility";

// Who gets into the app vs. the waitlist.
// WAITLIST_MODE=off opens the app to every verified school-email account.
// While the waitlist is on, EARLY_ACCESS_EMAILS (comma-separated) lets the team and testers in, and
// EARLY_ACCESS_DOMAINS (e.g. "uwo.ca,utoronto.ca") lets whole schools in, including their subdomains.
export type Access = "app" | "waitlist";

export function accessFor(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): Access {
  if (!email) return "waitlist";
  if ((env.WAITLIST_MODE ?? "on").trim().toLowerCase() === "off") return "app";
  const allowed = (env.EARLY_ACCESS_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  if (allowed.includes(normalizeEmail(email))) return "app";
  const domains = (env.EARLY_ACCESS_DOMAINS ?? "").split(",").map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
  const domain = emailDomain(email);
  return domain && domains.some((d) => domain === d || domain.endsWith(`.${d}`)) ? "app" : "waitlist";
}
