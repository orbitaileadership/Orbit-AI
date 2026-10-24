import { isUuid, json, requireAppUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFeedbackNotification } from "@/lib/feedback/notifications";

const MAX_BODY_BYTES = 8_000;
const validCategory = (v: unknown): v is "bug" | "usability" | "idea" | "other" =>
  v === "bug" || v === "usability" || v === "idea" || v === "other";
const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";

async function readBody(request: Request): Promise<{ body: Record<string, unknown> } | { invalid: true } | { tooLarge: true }> {
  const reader = request.body?.getReader();
  if (!reader) return { invalid: true };
  let raw = "", bytes = 0;
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > MAX_BODY_BYTES) { await reader.cancel(); return { tooLarge: true }; }
    raw += decoder.decode(chunk.value, { stream: true });
  }
  raw += decoder.decode();
  try {
    const body: unknown = JSON.parse(raw);
    return body && typeof body === "object" && !Array.isArray(body) ? { body: body as Record<string, unknown> } : { invalid: true };
  } catch { return { invalid: true }; }
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

export async function GET() {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  try {
    const { data, error } = await createAdminClient().from("feedback_reports")
      .select("id,category,title,status,created_at,updated_at")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(20);
    if (error) return json({ error: "feedback_unavailable" }, 503);
    return Response.json({ reports: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return json({ error: "feedback_unavailable" }, 503); }
}

export async function POST(request: Request) {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  if (!sameOrigin(request)) return json({ error: "same_origin_required" }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "invalid_request" }, 400);
  const parsed = await readBody(request);
  if ("tooLarge" in parsed) return json({ error: "request_too_large" }, 413);
  if ("invalid" in parsed) return json({ error: "invalid_request" }, 400);
  const body = parsed.body;
  const category = body.category;
  const title = clean(body.title, 120);
  const description = clean(body.description, 3000);
  const steps = clean(body.reproductionSteps, 2000);
  const submissionId = body.submissionId;
  const rawPath = clean(body.pagePath, 300);
  const pagePath = rawPath.startsWith("/") && !rawPath.startsWith("//") && !/[?#\s]/.test(rawPath) ? rawPath : null;
  if (!validCategory(category) || title.length < 3 || description.length < 10 || !isUuid(submissionId)) {
    return json({ error: "invalid_feedback" }, 400);
  }
  try {
    const { data, error } = await createAdminClient().rpc("submit_feedback_report", {
      p_user_id: auth.user.id,
      p_submission_id: submissionId,
      p_category: category,
      p_title: title,
      p_description: description,
      p_reproduction_steps: steps,
      p_page_path: pagePath,
    });
    if (error) return json({ error: "feedback_unavailable" }, 503);
    if (!data?.ok && data?.reason === "rate_limited") return json({ error: "rate_limited" }, 429);
    if (!data?.ok || !isUuid(data.id)) return json({ error: "feedback_unavailable" }, 503);
    // A replay returns the existing report. Do not turn client retries into duplicate mail;
    // admins can retry a failed notification from the private inbox.
    if (data.duplicate !== true) {
      const notified = await sendFeedbackNotification(data.id, new URL("/admin/feedback", request.url).toString());
      await createAdminClient().from("feedback_reports").update({
        notification_status: notified.status,
        notification_sent_at: notified.status === "sent" ? new Date().toISOString() : null,
      }).eq("id", data.id).neq("notification_status", "sent");
    }
    return json({ ok: true, id: data.id, duplicate: data.duplicate === true });
  } catch { return json({ error: "feedback_unavailable" }, 503); }
}
