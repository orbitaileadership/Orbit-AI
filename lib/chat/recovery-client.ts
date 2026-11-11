type SavedReply = {
  id: string;
  role: string;
  kind: string;
  status: string;
  content: string;
  modelId?: string;
};

export async function recoverCompletedReply<T extends SavedReply>(
  conversationId: string,
  replyId: string,
  modelId: string,
  fetcher: typeof fetch = fetch,
): Promise<{ message: T; quiz: unknown; courseOnly: boolean } | null> {
  try {
    const res = await fetcher("/api/conversations/" + encodeURIComponent(conversationId), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const out = await res.json() as { messages?: unknown; quiz?: unknown; courseOnly?: unknown };
    if (!Array.isArray(out.messages)) return null;
    const message = out.messages.find((entry: unknown) => {
      if (!entry || typeof entry !== "object") return false;
      const m = entry as Record<string, unknown>;
      return m.id === replyId && m.role === "assistant" && m.kind === "text" &&
        m.status === "complete" && m.modelId === modelId &&
        typeof m.content === "string" && m.content.trim().length > 0;
    }) as T | undefined;
    return message ? { message, quiz: out.quiz ?? null, courseOnly: out.courseOnly === true } : null;
  } catch {
    return null;
  }
}
