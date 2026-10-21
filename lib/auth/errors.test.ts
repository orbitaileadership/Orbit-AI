import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "./errors";

describe("friendlyAuthError", () => {
  it("explains rate limits", () => {
    expect(friendlyAuthError({ code: "over_email_send_rate_limit", status: 429 }, "send")).toMatch(/wait a minute/i);
  });
  it("explains email sending failures (e.g. SMTP rejected)", () => {
    expect(friendlyAuthError({ status: 500 }, "send")).toMatch(/couldn't send/i);
  });
  it("explains addresses Supabase's email service won't send to", () => {
    expect(friendlyAuthError({ code: "email_address_not_authorized", status: 400 }, "send")).toContain("can't send email to this address");
    expect(friendlyAuthError({ code: "email_address_invalid", status: 400 }, "send")).toContain("can't receive email");
  });
  it("never reveals which part of a login was wrong", () => {
    expect(friendlyAuthError({ code: "invalid_credentials", status: 400 }, "signin")).toBe("Email or password is incorrect.");
  });
  it("falls back sensibly for unknown verify errors", () => {
    expect(friendlyAuthError({ status: 403 }, "verify")).toMatch(/wrong or expired/i);
  });
});
