// Who may sign up. By default any valid email address (students pick their school, or "Other").
// SCHOOL_EMAILS_ONLY=on limits sign-up to school email addresses at any university or college; a school email proves
// the person controls an inbox at that school, not current enrolment.
//
// In school-only mode a domain counts when it (or a domain it sits under, e.g. mail.utoronto.ca → utoronto.ca) is:
//  - in the bundled list of ~10,000 university and college domains (school-domains.ts), or
//  - an academic domain by name: *.edu, *.edu.xx or *.ac.xx (school districts, *.k12.*, are excluded), or
//  - listed in ALLOWED_EMAIL_DOMAINS (comma-separated, e.g. "sheridancollege.ca,mycompany.com").
// Free mail (gmail.com…) is never a school.
import { SCHOOL_DOMAINS_TEXT } from "./school-domains";

// ASCII-only, so unicode lookalikes (e.g. Cyrillic letters) are rejected.
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/;
const ACADEMIC = /(^|\.)edu$|\.(edu|ac)\.[a-z]{2}$/;
const NOT_SCHOOL = /(^|\.)k12\./;

let schools: Set<string> | null = null;
const schoolSet = () => (schools ??= new Set(SCHOOL_DOMAINS_TEXT.split("\n")));

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The email's domain, or null if it isn't a well-formed address. */
export function emailDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return EMAIL_PATTERN.exec(normalizeEmail(raw))?.[1] ?? null;
}

/** "a.b.utoronto.ca" → ["a.b.utoronto.ca", "b.utoronto.ca", "utoronto.ca"] (never a bare TLD). */
const withParents = (domain: string) => {
  const parts = domain.split(".");
  return parts.slice(0, -1).map((_, i) => parts.slice(i).join("."));
};

const extraDomains = (env: Record<string, string | undefined>) =>
  (env.ALLOWED_EMAIL_DOMAINS ?? "").split(",").map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);

export function isAllowedEmail(raw: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  const domain = emailDomain(raw);
  if (!domain) return false;
  if (!schoolEmailsOnly(env)) return true;
  const extra = extraDomains(env);
  if (extra.includes("*")) return true;
  const candidates = withParents(domain);
  if (candidates.some((d) => extra.includes(d))) return true;
  if (NOT_SCHOOL.test(domain)) return false;
  return ACADEMIC.test(domain) || candidates.some((d) => schoolSet().has(d));
}

/** SCHOOL_EMAILS_ONLY=on: only school email addresses can sign up (default: any email). */
export const schoolEmailsOnly = (env: Record<string, string | undefined> = process.env) => (env.SCHOOL_EMAILS_ONLY ?? "").trim().toLowerCase() === "on";

/** The message shown when an address isn't accepted. */
export function notAllowedMessage(env: Record<string, string | undefined> = process.env): string {
  return schoolEmailsOnly(env) ? "Orbit AI is for students: use your school email address (any university or college)." : "Enter a valid email address.";
}
