import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sendFeedbackNotification } from "./notifications";

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "synthetic-key");
  vi.stubEnv("FEEDBACK_NOTIFICATION_FROM", "Orbit Alerts <alerts@example.test>");
  vi.stubEnv("ANALYTICS_ADMIN_EMAILS", "owner@example.test, second@example.test,invalid");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("sends a content-free, idempotent notification without exposing the admin list", async () => {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push([input, init]);
    return new Response(null, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  expect(await sendFeedbackNotification("11111111-1111-4111-8111-111111111111", "https://orbit.example/admin/feedback")).toEqual({ status: "sent" });
  const sent = calls[0];
  if (!sent) throw new Error("Expected notification request");
  const [url, request] = sent;
  if (!request) throw new Error("Expected notification request options");
  expect(url).toBe("https://api.resend.com/emails");
  expect(request.headers).toMatchObject({ "Idempotency-Key": "orbit-feedback-11111111-1111-4111-8111-111111111111" });
  const body = JSON.parse(request.body as string);
  expect(body.to).toEqual(["owner@example.test"]);
  expect(body.bcc).toEqual(["second@example.test"]);
  expect(body.text).toContain("11111111-1111-4111-8111-111111111111");
  expect(body.text).not.toContain("private user report");
});

it("does not make a provider request when email delivery configuration is incomplete", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RESEND_API_KEY", "");
  expect(await sendFeedbackNotification("11111111-1111-4111-8111-111111111111", "https://orbit.example/admin/feedback")).toEqual({ status: "disabled" });
  expect(fetchMock).not.toHaveBeenCalled();
});
