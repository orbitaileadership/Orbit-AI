import { dbError, isUuid, json, requireAppUser } from "@/lib/api";
import { ownedCourseEvidenceFiles } from "@/lib/courses/evidence";

// PATCH  /api/files/:id { projectId } → save a chat attachment to a course (or take it out with null), so every chat
//                                       in the course can use it without uploading it again. It stays in its chat too.
// GET    /api/files/:id → a short-lived download link for the student's own file (the Python sandbox reads data files).
// DELETE /api/files/:id → removes the stored file, its passages, and its row.
export async function GET(_: Request, ctx: RouteContext<"/api/files/[id]">) {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: "not_found" }, 404);
  // RLS: only the student's own rows are visible.
  const { data: file } = await auth.supabase.from("files").select("name, storage_path, size_bytes").eq("id", id).maybeSingle();
  if (!file) return json({ error: "not_found" }, 404);
  const { data, error } = await auth.supabase.storage.from("uploads").createSignedUrl(file.storage_path, 60);
  if (error || !data) return json({ error: "download_failed" }, 500);
  return json({ name: file.name, size: file.size_bytes, url: data.signedUrl });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { projectId?: unknown };
  if (!isUuid(id) || !(body.projectId === null || isUuid(body.projectId))) return json({ error: "bad_request" }, 400);
  const file = await auth.supabase.from("files").select("project_id").eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (file.error) return dbError(file.error, "load_failed");
  if (!file.data) return json({ error: "not_found" }, 404);
  try {
    if (file.data.project_id !== body.projectId && (await ownedCourseEvidenceFiles(auth.supabase, auth.user.id)).has(id)) {
      return json({ error: "course_source", message: "This file supports reviewed course details and must stay with its course." }, 409);
    }
  } catch { return json({ error: "load_failed" }, 500); }
  // RLS also checks the course belongs to this student.
  const { data, error } = await auth.supabase.from("files").update({ project_id: body.projectId }).eq("id", id).select("id, project_id").maybeSingle();
  if (error) return dbError(error, "save_failed", 400);
  if (!data) return json({ error: "not_found" }, 404);
  return json({ ok: true, projectId: data.project_id });
}

export async function DELETE(_: Request, ctx: RouteContext<"/api/files/[id]">) {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: "not_found" }, 404);
  const { data: file, error: fileError } = await auth.supabase.from("files").select("storage_path,preview_path,project_id").eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (fileError) return dbError(fileError, "load_failed");
  if (!file) return json({ error: "not_found" }, 404);
    try {
      if ((await ownedCourseEvidenceFiles(auth.supabase, auth.user.id)).has(id)) {
        return json({ error: "course_source", message: "This file supports reviewed course details. Keep it so syllabus evidence remains available." }, 409);
      }
    } catch { return json({ error: "load_failed" }, 500); }
  const removed = await auth.supabase.storage.from("uploads").remove([file.storage_path, ...(file.preview_path ? [file.preview_path] : [])]);
  if (removed.error) return json({ error: "delete_failed" }, 500);
  const { error } = await auth.supabase.from("files").delete().eq("id", id).eq("user_id", auth.user.id);
  if (error) return json({ error: "delete_failed" }, 500);
  return json({ ok: true });
}
