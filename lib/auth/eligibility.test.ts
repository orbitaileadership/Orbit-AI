import { describe, expect, it } from "vitest";
import { accessFor } from "./access";
import { emailDomain, isAllowedEmail } from "./eligibility";

const env = {};

describe("isAllowedEmail", () => {
  it.each([
    "student@uwo.ca", "  Student.Name@UWO.CA ", "a+b@uwo.ca", // Western
    "s@utoronto.ca", "s@mail.utoronto.ca", "s@mcgill.ca", "s@uwaterloo.ca", // other Canadian schools + a subdomain
    "s@mit.edu", "s@cs.stanford.edu", "s@ox.ac.uk", "s@unimelb.edu.au", "s@student.uwo.ca",
  ])("allows %s", (e) => expect(isAllowedEmail(e, env)).toBe(true));

  it.each([
    "", "student@gmail.com", "student@outlook.com", "student@uwo.ca.evil.com", "student@xuwo.ca", "student@uwo.co",
    "student@uwo.ca.", "studеnt@uwo.ca" /* Cyrillic е */, "student@uwо.ca" /* Cyrillic о */, "student@@uwo.ca", "uwo.ca", "@uwo.ca",
    "kid@district.k12.ca.us", "s@edu", "s@fakeedu.com",
  ])("rejects %s", (e) => expect(isAllowedEmail(e, env)).toBe(false));

  it("lets the team add domains or open sign-up to everyone", () => {
    expect(isAllowedEmail("me@mycollege.org", { ALLOWED_EMAIL_DOMAINS: "mycollege.org" })).toBe(true);
    expect(isAllowedEmail("me@staff.mycollege.org", { ALLOWED_EMAIL_DOMAINS: " @MyCollege.org " })).toBe(true);
    expect(isAllowedEmail("me@gmail.com", { ALLOWED_EMAIL_DOMAINS: "*" })).toBe(true);
    expect(isAllowedEmail("not-an-email", { ALLOWED_EMAIL_DOMAINS: "*" })).toBe(false);
  });

  it("finds the domain", () => {
    expect(emailDomain(" A@Mail.UToronto.ca ")).toBe("mail.utoronto.ca");
    expect(emailDomain("nope")).toBeNull();
  });
});

describe("waitlist by school", () => {
  it("lets whole schools in with EARLY_ACCESS_DOMAINS", () => {
    const e = { WAITLIST_MODE: "on", EARLY_ACCESS_DOMAINS: "uwo.ca, utoronto.ca" };
    expect(accessFor("a@uwo.ca", e)).toBe("app");
    expect(accessFor("a@mail.utoronto.ca", e)).toBe("app");
    expect(accessFor("a@mcgill.ca", e)).toBe("waitlist");
    expect(accessFor("a@xuwo.ca", e)).toBe("waitlist");
  });
});
