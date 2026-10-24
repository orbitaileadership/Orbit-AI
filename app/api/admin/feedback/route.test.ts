import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ admin: false, update: vi.fn(), notify: vi.fn(), currentStatus: "failed" }));
vi.mock("@/lib/analytics/admin", () => ({ requireAnalyticsAdmin: async () => state.admin ? { user: { id: "admin" } } : { error: Response.json({ error: "forbidden" }, { status: 403 }) } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => {
  const q = { update: (value: unknown) => { state.update(value); return q; }, eq: () => q, select: () => q, maybeSingle: async () => ({ data: { id: "11111111-1111-4111-8111-111111111111", status: "triaged", notification_status: state.currentStatus }, error: null }) };
  return q;
} }) }));
vi.mock("@/lib/feedback/notifications", () => ({ sendFeedbackNotification: state.notify }));
import { PATCH } from "./route";
beforeEach(() => { state.admin = false; state.update.mockClear(); state.notify.mockReset().mockResolvedValue({ status: "sent" }); state.currentStatus = "failed"; });
const request = (body: unknown) => new Request("https://orbit.test/api/admin/feedback", { method: "PATCH", headers: { origin: "https://orbit.test", "content-type": "application/json" }, body: JSON.stringify(body) });

it("denies non-admin feedback status changes before database access", async () => {
  expect((await PATCH(request({ id: "11111111-1111-4111-8111-111111111111", status: "fixed" }))).status).toBe(403);
  expect(state.update).not.toHaveBeenCalled();
});

it("validates admin status values and accepts only known workflow states", async () => {
  state.admin = true;
  expect((await PATCH(request({ id: "11111111-1111-4111-8111-111111111111", status: "delete-everything" }))).status).toBe(400);
  const response = await PATCH(request({ id: "11111111-1111-4111-8111-111111111111", status: "triaged" }));
  expect(response.status).toBe(200);
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ status: "triaged", updated_at: expect.any(String) }));
});

it("lets admins retry failed mail idempotently and refuses to resend an already sent report", async () => {
  state.admin = true;
  const body = { id: "11111111-1111-4111-8111-111111111111", action: "retry_notification" };
  expect((await PATCH(request(body))).status).toBe(200);
  expect(state.notify).toHaveBeenCalledWith(body.id, "https://orbit.test/admin/feedback");
  state.currentStatus = "sent";
  expect((await PATCH(request(body))).status).toBe(409);
});
