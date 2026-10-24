import { json, isUuid } from "@/lib/api";
import { requireAnalyticsAdmin } from "@/lib/analytics/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFeedbackNotification } from "@/lib/feedback/notifications";

const statuses = new Set(["new", "triaged", "in_progress", "fixed", "closed", "duplicate"]);

export async function GET() {
  const auth = await requireAnalyticsAdmin();
  if ("error" in auth) return auth.error;
  try {
    const { data, error } = await createAdminClient().from("feedback_reports")
      .select("id,user_id,category,title,description,reproduction_steps,page_path,status,notification_status,notification_sent_at,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) return json({ error: "feedback_unavailable" }, 503);
    return Response.json({ reports: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return json({ error: "feedback_unavailable" }, 503); }
}

export async function PATCH(request: Request) {
  const auth = await requireAnalyticsAdmin();
  if ("error" in auth) return auth.error;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json({ error: "same_origin_required" }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "invalid_request" }, 400);
  const body = await request.json().catch(() => null);
  if (!isUuid(body?.id)) return json({ error: "invalid_feedback_update" }, 400);
  if (body.action === "retry_notification") {
    try {
      const admin = createAdminClient();
      const current = await admin.from("feedback_reports").select("id,notification_status").eq("id", body.id).maybeSingle();
      if (current.error) return json({ error: "feedback_unavailable" }, 503);
      if (!current.data) return json({ error: "not_found" }, 404);
      if (current.data.notification_status === "sent") return json({ error: "already_sent" }, 409);
      const notification = await sendFeedbackNotification(body.id, new URL("/admin/feedback", request.url).toString());
      const { error } = await admin.from("feedback_reports").update({
        notification_status: notification.status,
        notification_sent_at: notification.status === "sent" ? new Date().toISOString() : null,
      }).eq("id", body.id);
      if (error) return json({ error: "feedback_update_failed" }, 503);
      return json({ notification_status: notification.status });
    } catch { return json({ error: "feedback_update_failed" }, 503); }
  }
  if (typeof body.status !== "string" || !statuses.has(body.status)) return json({ error: "invalid_feedback_update" }, 400);
  try {
    const { data, error } = await createAdminClient().from("feedback_reports")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", body.id).select("id,status,updated_at").maybeSingle();
    if (error) return json({ error: "feedback_update_failed" }, 503);
    if (!data) return json({ error: "not_found" }, 404);
    return json({ report: data });
  } catch { return json({ error: "feedback_update_failed" }, 503); }
}
