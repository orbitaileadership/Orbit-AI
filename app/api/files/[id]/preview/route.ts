import { isUuid, json, requireAppUser } from "@/lib/api";

/** Owner-checked, short-lived URL for a PDF's original bytes. Requires no large-file schema. */
export async function GET(_: Request, ctx: RouteContext<"/api/files/[id]/preview">) {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: "not_found" }, 404);
  const { data: file, error } = await auth.supabase.from("files")
    .select("name,mime,storage_path")
    .eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (error) return json({ error: "load_failed" }, 500);
  if (!file) return json({ error: "not_found" }, 404);
  if (file.mime !== "application/pdf") return json({ name: file.name, status: "failed", message: "In-app preview is available for PDFs. Download this file to open it." });
  const { data, error: signedError } = await auth.supabase.storage.from("uploads").createSignedUrl(file.storage_path, 60 * 60);
  if (signedError || !data) return json({ error: "preview_unavailable" }, 500);
  return json({ name: file.name, status: "ready", mime: "application/pdf", url: data.signedUrl });
}
