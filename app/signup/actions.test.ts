import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signup: vi.fn(), verify: vi.fn(), resend: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signUp: mocks.signup } }) }));
vi.mock("@/lib/auth/flows", () => ({ verifyEmailCode: mocks.verify, resendSignupCode: mocks.resend }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { signUpAction } from "./actions";
const previous = { step: "details" as const, email: "" };
function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ institution: "western", email: " Student@UWO.ca ", password: "Synthetic123", confirm: "Synthetic123", ...values })) data.set(key, value);
  return data;
}
describe("school-aware registration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.signup.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null });
  });
  it("stores the server-resolved institution with normalized credentials and requests verification", async () => {
    expect(await signUpAction(previous, form())).toMatchObject({ step: "verify", email: "student@uwo.ca" });
    expect(mocks.signup).toHaveBeenCalledWith({ email: "student@uwo.ca", password: "Synthetic123", options: { data: { institution: "western", institution_name: "Western University" } } });
  });
  it("signs up students at other listed schools with that school's email", async () => {
    expect(await signUpAction(previous, form({ institution: "waterloo", email: "s@uwaterloo.ca" }))).toMatchObject({ step: "verify", email: "s@uwaterloo.ca" });
    expect(mocks.signup).toHaveBeenLastCalledWith(expect.objectContaining({ options: { data: { institution: "waterloo", institution_name: "University of Waterloo" } } }));
    expect(await signUpAction(previous, form({ institution: "toronto", email: "s@mail.utoronto.ca" }))).toMatchObject({ step: "verify" });
  });
  it("signs up any school email when the school isn't listed", async () => {
    expect(await signUpAction(previous, form({ institution: "other", email: "s@mit.edu" }))).toMatchObject({ step: "verify" });
    expect(mocks.signup).toHaveBeenLastCalledWith(expect.objectContaining({ options: { data: { institution: "other", institution_domain: "mit.edu" } } }));
    expect(await signUpAction(previous, form({ institution: "other", email: "s@ox.ac.uk" }))).toMatchObject({ step: "verify" });
  });
  it.each(["fake", ""])("needs a real school choice (%s)", async (institution) => {
    expect((await signUpAction(previous, form({ institution }))).error).toContain("Select your school");
    expect(mocks.signup).not.toHaveBeenCalled();
  });
  it("rejects an email from a different school than the one picked", async () => {
    expect((await signUpAction(previous, form({ institution: "waterloo", email: "s@uwo.ca" }))).error).toContain("@uwaterloo.ca");
    expect(mocks.signup).not.toHaveBeenCalled();
  });
  it("accepts any email under Other, but a listed school still needs its own email", async () => {
    expect(await signUpAction(previous, form({ institution: "other", email: "student@gmail.com" }))).toMatchObject({ step: "verify" });
    expect((await signUpAction(previous, form({ institution: "western", email: "student@gmail.com" }))).error).toContain("@uwo.ca");
    expect((await signUpAction(previous, form({ email: "student@uwo.ca.evil.com" }))).error).toContain("@uwo.ca");
    expect((await signUpAction(previous, form({ institution: "other", email: "not an email" }))).error).toContain("valid email");
  });
  it.each(["student@gmail.com", "student@uwo.ca.evil.com", "student@xuwo.ca"])("with SCHOOL_EMAILS_ONLY=on rejects %s", async (email) => {
    vi.stubEnv("SCHOOL_EMAILS_ONLY", "on");
    expect((await signUpAction(previous, form({ email }))).error).toContain("school email");
    expect((await signUpAction(previous, form({ email, institution: "other" }))).error).toContain("school email");
    expect(mocks.signup).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
  it("retains verification, resend, and change-email actions", async () => {
    mocks.verify.mockResolvedValue(null);
    await expect(signUpAction(previous, form({ intent: "verify", code: "123456" }))).rejects.toThrow("redirect:/");
    expect(mocks.verify).toHaveBeenCalledWith("student@uwo.ca", "123456");
    mocks.resend.mockResolvedValue(null);
    expect(await signUpAction(previous, form({ intent: "resend" }))).toMatchObject({ step: "verify" });
    expect(mocks.resend).toHaveBeenCalledWith("student@uwo.ca");
    expect(await signUpAction(previous, form({ intent: "back" }))).toEqual({ step: "details", email: "student@uwo.ca" });
  });
  it("keeps an invalid code on the verification form", async () => {
    mocks.verify.mockResolvedValue("Invalid code");
    expect(await signUpAction(previous, form({ intent: "verify", code: "000000" }))).toMatchObject({ step: "verify", error: "Invalid code" });
  });
  it("checks the school even on verification requests", async () => {
    expect((await signUpAction(previous, form({ intent: "verify", institution: "fake" }))).error).toContain("Select your school");
    expect((await signUpAction(previous, form({ intent: "verify", institution: "waterloo" }))).error).toContain("@uwaterloo.ca");
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
