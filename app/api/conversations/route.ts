import { isProvider } from "@/config/models";
import { dbError, json, requireAppUser } from "@/lib/api";

// GET /api/conversations?provider=anthropic → this app's chats, newest first.
export async function GET(request: Request) {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  const params = new URL(request.url).searchParams;
  const provider = params.get("provider");
  const archived = params.get("archived") === "true";
  const offset = Number(params.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) return json({ error: "bad_request" }, 400);
  if (!isProvider(provider) && provider !== "orbit") return json({ error: "bad_request" }, 400);

  const { data, error } = await auth.supabase
    .from("conversations")
    .select("id, title, model_id, project_id, section_folder_id, updated_at")
    .eq("provider", provider === "orbit" ? "openai" : provider)
    .eq("orbit_mode", provider === "orbit")
    .eq("user_id", auth.user.id)
    .eq("archived", archived)
    .order("updated_at", { ascending: false })
    .order("id")
    .range(offset, offset + 199);
  if (error) return dbError(error, "load_failed");
  return json({
    conversations: (data ?? []).map((c) => ({
      id: c.id, title: c.title, modelId: c.model_id, projectId: c.project_id, sectionFolderId: c.section_folder_id, updatedAt: c.updated_at,
    })),
  });
}
