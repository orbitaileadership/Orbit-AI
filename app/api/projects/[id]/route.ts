import { FOLDER_COLUMNS } from "@/lib/folders/types";
import { dbError, isUuid, json, requireAppUser } from "@/lib/api";

// PATCH /api/projects/:id updates an owned folder, its course, pin or last visit.
// DELETE /api/projects/:id   (its chats stay, moved out of the folder; its files are deleted, except chat attachments)
export async function PATCH(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: "not_found" }, 404);
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; instructions?: unknown; courseId?: unknown; pinned?: unknown; opened?: unknown };
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'bad_request' }, 400);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  if (typeof body.instructions === "string") patch.instructions = body.instructions.slice(0, 8000);
  if (body.pinned !== undefined) {
    if (typeof body.pinned !== "boolean") return json({ error: "bad_request" }, 400);
    patch.pinned_at = body.pinned ? new Date().toISOString() : null;
  }
  if (body.opened !== undefined) {
    if (body.opened !== true) return json({ error: "bad_request" }, 400);
    patch.last_opened_at = new Date().toISOString();
  }
  if (body.courseId !== undefined) {
    if (body.courseId !== null && !isUuid(body.courseId)) return json({ error: "bad_request" }, 400);
    if (body.courseId) {
      const course = await auth.supabase.from("projects").select("id").eq("id", body.courseId).eq("user_id", auth.user.id).eq("is_folder", false).maybeSingle();
      if (course.error) return dbError(course.error, "load_failed");
      if (!course.data) return json({ error: "not_found" }, 404);
    }
    patch.parent_course_id = body.courseId;
  }
  const { data, error } = await auth.supabase.from("projects").update(patch).eq("id", id).eq("user_id", auth.user.id).eq("is_folder", true).select(FOLDER_COLUMNS).maybeSingle();
  if (error) return dbError(error, "save_failed", 400);
  if (!data) return json({ error: "not_found" }, 404);
  return json({ project: data });
}

export async function DELETE(_: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: "not_found" }, 404);
  const folder = await auth.supabase.from("projects").select("id").eq("id", id).eq("user_id", auth.user.id).eq("is_folder", true).maybeSingle();
  if (folder.error) return dbError(folder.error, "load_failed");
  if (!folder.data) return json({ error: "not_found" }, 404);
  // Folder files are deleted with the folder (storage first). Files that are also a chat's attachment stay in that chat.
  const { data: files, error: filesError } = await auth.supabase.from("files").select("id, storage_path, conversation_id").eq("project_id", id).eq("user_id", auth.user.id);
  if (filesError) return dbError(filesError, "load_failed");
  const keep = (files ?? []).filter((f) => f.conversation_id);
  const drop = (files ?? []).filter((f) => !f.conversation_id);
  if (keep.length) {
    const detached = await auth.supabase.from("files").update({ project_id: null }).in("id", keep.map((f) => f.id as string)).eq("user_id", auth.user.id);
    if (detached.error) return dbError(detached.error, "delete_failed");
  }
  if (drop.length) {
    const removed = await auth.supabase.storage.from("uploads").remove(drop.map((f) => f.storage_path as string));
    if (removed.error) return json({ error: "delete_failed" }, 500);
  }
  const { error } = await auth.supabase.from("projects").delete().eq("id", id).eq("user_id", auth.user.id).eq("is_folder", true);
  if (error) return dbError(error, "delete_failed");
  return json({ ok: true });
}
