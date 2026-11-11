import { describe, expect, it, vi } from "vitest";
import { recoverCompletedReply } from "./recovery-client";

const conversationId = "conversation-1";
const replyId = "reply-1";
const modelId = "anthropic-sonnet";
const saved = { id: replyId, role: "assistant", kind: "text", status: "complete", content: "A complete saved quiz", modelId };

function fetcher(messages: unknown[], ok = true) {
  return vi.fn(async () => new Response(JSON.stringify({ messages, quiz: { right: 1 }, courseOnly: false }), { status: ok ? 200 : 500 })) as unknown as typeof fetch;
}

describe("completed reply recovery after a broken website stream", () => {
  it("reads only the exact completed reply through one owner-scoped GET", async () => {
    const get = fetcher([{ ...saved, id: "other" }, saved]);
    const result = await recoverCompletedReply(conversationId, replyId, modelId, get);
    expect(result).toMatchObject({ message: saved, quiz: { right: 1 }, courseOnly: false });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/api/conversations/conversation-1", expect.objectContaining({ cache: "no-store" }));
  });

  it.each([
    [{ ...saved, id: "other" }],
    [{ ...saved, status: "partial" }],
    [{ ...saved, status: "error" }],
    [{ ...saved, modelId: "different-model" }],
    [{ ...saved, content: "" }],
  ])("rejects unmatched or incomplete persisted content", async (message) => {
    expect(await recoverCompletedReply(conversationId, replyId, modelId, fetcher([message]))).toBeNull();
  });

  it("keeps the error path when the read fails", async () => {
    expect(await recoverCompletedReply(conversationId, replyId, modelId, fetcher([saved], false))).toBeNull();
    const failed = vi.fn(async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await recoverCompletedReply(conversationId, replyId, modelId, failed)).toBeNull();
  });
});
