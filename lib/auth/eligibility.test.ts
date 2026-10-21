import { describe, expect, it } from "vitest";
import { accessFor } from "./access";
import { emailDomain, isAllowedEmail, notAllowedMessage } from "./eligibility";

const env = { SCHOOL_EMAILS_ONLY: "on" };

describe("default: any email", () => {
  it.each(["me@gmail.com", "s@uwo.ca", "x@company.co.uk"])("allows %s", (e) => expect(isAllowedEmail(e, {})).toBe(true));
  it.each(["", "nope", "a@@b.com", "studеnt@gmail.com"])("rejects malformed %s", (e) => expect(isAllowedEmail(e, {})).toBe(false));
  it("explains the rule in each mode", () => {
    expect(notAllowedMessage({})).toBe("Enter a valid email address.");
    expect(notAllowedMessage(env)).toContain("school email");
  });
});

describe("SCHOOL_EMAILS_ONLY=on", () => {
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
    expect(isAllowedEmail("me@mycollege.org", { ...env, ALLOWED_EMAIL_DOMAINS: "mycollege.org" })).toBe(true);
    expect(isAllowedEmail("me@staff.mycollege.org", { ...env, ALLOWED_EMAIL_DOMAINS: " @MyCollege.org " })).toBe(true);
    expect(isAllowedEmail("me@gmail.com", { ...env, ALLOWED_EMAIL_DOMAINS: "*" })).toBe(true);
    expect(isAllowedEmail("not-an-email", { ...env, ALLOWED_EMAIL_DOMAINS: "*" })).toBe(false);
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

describe("open sign-up (OPEN_SIGNUP=on)", () => {
  const on = { OPEN_SIGNUP: "on" };
  it("is off unless the team turns it on", () => {
    expect(openSignupEnabled({})).toBe(false);
    expect(openSignupEnabled({ OPEN_SIGNUP: "yes" })).toBe(false);
    expect(openSignupEnabled({ OPEN_SIGNUP: " ON " })).toBe(true);
    expect(isAllowedEmail("student@gmail.com", {})).toBe(false);
    expect(notAllowedMessage({})).toContain("@uwo.ca");
  });
  it.each(["student@gmail.com", "Name.Last@Hotmail.com", "a+b@outlook.com", "me@icloud.com", "x@mail.utoronto.ca", "student@uwo.ca"])("allows %s when on", (e) => {
    expect(isAllowedEmail(e, on)).toBe(true);
  });
  it.each(["", "student@localhost", "student@gmail", "student@-gmail.com", "student@gmail-.com", "student@gmail.c0m", "student@127.0.0.1", "studеnt@gmail.com", "@gmail.com", "student@@gmail.com", "student@gmail..com"])("still rejects %s", (e) => {
    expect(isAllowedEmail(e, on)).toBe(false);
  });
  it("keeps the school check exact", () => {
    expect(isSchoolEmail("student@uwo.ca")).toBe(true);
    expect(isSchoolEmail("student@gmail.com")).toBe(false);
    expect(isSchoolEmail("student@uwo.ca.evil.com")).toBe(false);
  });
});
