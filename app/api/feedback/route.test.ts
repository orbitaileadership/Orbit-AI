import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: "user-a", denied: false, rpc: vi.fn(), notify: vi.fn(), rows: [] as Record<string, unknown>[], filters: [] as unknown[] }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("@/lib/api")>(), requireAppUser: async () => state.denied ? { error: Response.json({ error: "not_signed_in" }, { status: 401 }) } : { user: { id: state.user } } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  rpc: state.rpc,
  from: () => {
    const q = {
      select: () => q,
      eq: (key: string, value: unknown) => { state.filters.push([key, value]); return q; },
      order: () => q,
      limit: async () => ({ data: state.rows.filter(r => r.user_id === state.user), error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
    };
    return q;
  },
}) }));
vi.mock("@/lib/feedback/notifications", () => ({ sendFeedbackNotification: state.notify }));
import { GET, POST } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
const payload = { submissionId: id, category: "bug", title: "Orbit vote failed", description: "The voting turn displayed an error instead of a result.", reproductionSteps: "Start a synthetic Orbit vote", pagePath: "/chat" };
const request = (body: unknown, origin = "https://orbit.test") => new Request("https://orbit.test/api/feedback", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { state.user = "user-a"; state.denied = false; state.rpc.mockReset().mockResolvedValue({ data: { ok: true, id, duplicate: false }, error: null }); state.notify.mockReset().mockResolvedValue({ status: "sent" }); state.rows = [{ id, user_id: "user-a", title: "Mine" }, { id: "22222222-2222-4222-8222-222222222222", user_id: "user-b", title: "Private" }]; state.filters = []; });

it("requires an authenticated app user and rejects cross-origin or malformed submissions", async () => {
  state.denied = true;
  expect((await POST(request(payload))).status).toBe(401);
  state.denied = false;
  expect((await POST(request(payload, "https://attacker.test"))).status).toBe(403);
  expect((await POST(request({ ...payload, category: "secret" }))).status).toBe(400);
  expect(state.rpc).not.toHaveBeenCalled();
});

it("attributes feedback to the signed-in user and sends only explicit page path metadata", async () => {
  const response = await POST(request({ ...payload, pagePath: "//attacker.test/?private=1" }));
  expect(response.status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith("submit_feedback_report", expect.objectContaining({ p_user_id: "user-a", p_submission_id: id, p_page_path: null }));
  expect(state.notify).toHaveBeenCalledWith(id, "https://orbit.test/admin/feedback");
});

it("rejects malformed and oversized request bodies with distinct client errors", async () => {
  const malformed = new Request("https://orbit.test/api/feedback", { method: "POST", headers: { origin: "https://orbit.test", "content-type": "application/json" }, body: "{" });
  expect((await POST(malformed)).status).toBe(400);
  expect((await POST(request("x".repeat(9_000)))).status).toBe(413);
});

it("returns an honest rate-limit response and keeps own report history user-scoped", async () => {
  state.rpc.mockResolvedValueOnce({ data: { ok: false, reason: "rate_limited" }, error: null });
  expect((await POST(request(payload))).status).toBe(429);
  const response = await GET();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(state.filters).toContainEqual(["user_id", "user-a"]);
  expect(JSON.stringify(await response.json())).not.toContain("Private");
});
