import { isUuid, json, requireAppUser } from "@/lib/api";

/** Owner-checked, short-lived links to an original PDF/image or private Office PDF rendition. */
export async function GET(_: Request, ctx: RouteContext<"/api/files/[id]/preview">) {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ error: "not_found" }, 404);
  const { data: file, error } = await auth.supabase.from("files")
    .select("name,mime,kind,status,storage_path,preview_path,preview_status,error")
    .eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (error) return json({ error: "load_failed" }, 500);
  if (!file) return json({ error: "not_found" }, 404);

  // Text may have been stored with an HTML content type; never embed its signed URL in a frame.
  const native = file.mime === "application/pdf" || file.kind === "image";
  if (!native && !/\.(docx|pptx|xlsx|xlsm)$/i.test(file.name)) return json({
    name: file.name, indexStatus: file.status, status: "failed",
    message: "In-app preview isn't available for this format. Download the original file.",
  });
  const path = native ? file.storage_path : file.preview_status === "ready" ? file.preview_path : null;
  if (!path) return json({
    name: file.name, indexStatus: file.status, status: file.preview_status === "failed" || file.status === "failed" ? "failed" : "processing",
    message: file.preview_status === "failed" ? "Orbit couldn't render this file. You can still download the original." : "Preparing the document preview…",
  });
  const { data, error: signedError } = await auth.supabase.storage.from("uploads").createSignedUrl(path, 60 * 60);
  if (signedError || !data) return json({ error: "preview_unavailable" }, 500);
  return json({ name: file.name, indexStatus: file.status, status: "ready", mime: native ? file.mime : "application/pdf", url: data.signedUrl });
}
