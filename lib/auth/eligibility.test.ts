import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAllowedEmail, isSchoolEmail, notAllowedMessage, openSignupEnabled } from "./eligibility";

// Never inherit OPEN_SIGNUP from a developer shell.
beforeEach(() => { vi.stubEnv("OPEN_SIGNUP", ""); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("isAllowedEmail", () => {
  it.each(["student@uwo.ca", "  Student.Name@UWO.CA ", "a+b@uwo.ca"])("allows %s", (e) => {
    expect(isAllowedEmail(e)).toBe(true);
  });

  it.each([
    "",
    "student@gmail.com",
    "student@sub.uwo.ca",
    "student@uwo.ca.evil.com",
    "student@xuwo.ca",
    "student@uwo.co",
    "student@uwo.ca.",
    "studеnt@uwo.ca", // Cyrillic "е"
    "student@uwо.ca", // Cyrillic "о"
    "student@@uwo.ca",
    "uwo.ca",
    "@uwo.ca",
  ])("rejects %s", (e) => {
    expect(isAllowedEmail(e)).toBe(false);
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
