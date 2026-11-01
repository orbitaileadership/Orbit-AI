import { reportedUsage, tokenCount } from "./usage";
import { readSse } from "./sse";
import { errorForStatus, normalizeTurns, parseArgs, ProviderError, type FinishReason, type ChatTurn, type ProviderAdapter } from "./types";

function anthropicError(type: unknown, status?: number, started = false): ProviderError {
  const code = type === "overloaded_error" || type === "api_error" ? "unavailable"
    : type === "rate_limit_error" ? "rate_limit"
    : type === "authentication_error" || type === "permission_error" ? "auth"
    : type === "not_found_error" ? "model_unavailable"
    : type === "invalid_request_error" ? "bad_request" : "unknown";
  return new ProviderError(code, status, started);
}

// Anthropic Messages API (streaming, tool use). Claude has no image generation.

function toMessage(t: ChatTurn) {
  if (t.toolResults?.length) {
    return { role: "user", content: t.toolResults.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.output || "(empty)" })) };
  }
  if (t.toolCalls?.length) {
    return {
      role: "assistant",
      content: [
        ...(t.content.trim() ? [{ type: "text", text: t.content }] : []),
        ...t.toolCalls.map((c) => ({ type: "tool_use", id: c.id, name: c.name, input: c.args })),
      ],
    };
  }
  if ((t.images?.length || t.documents?.length) && t.role === "user") {
    return {
      role: "user",
      content: [
        ...(t.documents ?? []).map((d) => ({ type: "document", title: d.name, source: { type: "base64", media_type: d.mime, data: d.data } })),
        ...(t.images ?? []).map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: i.data } })),
        { type: "text", text: t.content || " " },
      ],
    };
  }
  return { role: t.role, content: t.content };
}
export const anthropic: ProviderAdapter = {
  id: "anthropic",

  async *stream({ model, system, history, maxOutput, apiKey, signal, tools, cacheKey, thinkingLevel, disableThinking }) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model.apiModel,
        ...(disableThinking && model.apiModel === "claude-haiku-5-5" ? { thinking: { type: "disabled" } } : {}),
        ...(thinkingLevel && !disableThinking ? { output_config: { effort: thinkingLevel } } : {}),
        max_tokens: maxOutput,
        system,
        ...(cacheKey ? { cache_control: { type: "ephemeral" } } : {}),
        messages: normalizeTurns(history).map(toMessage),
        ...(tools?.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
        stream: true,
      }),
      signal,
    });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => null);
      const type = body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "type" in body.error ? body.error.type : null;
      throw type ? anthropicError(type, res.status) : errorForStatus(res.status);
    }

    let input: number | undefined;
    let cached: number | undefined;
    let cacheWrite: number | undefined;
    let output: number | undefined;
    let finish:FinishReason="unknown";
    const blocks = new Map<number, { id: string; name: string; json: string }>(); // tool_use blocks being streamed
    for await (const { data } of readSse(res.body)) {
      const ev = JSON.parse(data);
      switch (ev.type) {
        case "message_start": {
          const u = ev.message?.usage ?? {};
          cached = u.cache_read_input_tokens;
          cacheWrite = u.cache_creation_input_tokens;
          input = tokenCount(u.input_tokens) && (cached == null || tokenCount(cached)) && (cacheWrite == null || tokenCount(cacheWrite))
            ? u.input_tokens + (cached ?? 0) + (cacheWrite ?? 0) : undefined;
          output = u.output_tokens;
          break;
        }
        case "content_block_start":
          if (ev.content_block?.type === "tool_use") blocks.set(ev.index, { id: ev.content_block.id, name: ev.content_block.name, json: "" });
          break;
        case "content_block_delta":
          if (ev.delta?.type === "text_delta" && ev.delta.text) yield { delta: ev.delta.text as string };
          else if (ev.delta?.type === "input_json_delta") {
            const b = blocks.get(ev.index);
            if (b) b.json += ev.delta.partial_json ?? "";
          }
          break;
        case "content_block_stop": {
          const b = blocks.get(ev.index);
          if (b) {
            blocks.delete(ev.index);
            yield { toolCall: { id: b.id, name: b.name, args: parseArgs(b.json) } };
          }
          break;
        }
        case "message_delta":
          if (ev.usage?.output_tokens != null) output = ev.usage.output_tokens;
          if(ev.delta?.stop_reason) finish=ev.delta.stop_reason==="max_tokens"?"length":ev.delta.stop_reason==="refusal"?"blocked":ev.delta.stop_reason==="tool_use"?"tool_calls":["end_turn","stop_sequence"].includes(ev.delta.stop_reason)?"stop":"unknown";
          break;
        case "message_stop": {
          const usage = reportedUsage(input, output, { cached, cacheWrite });
          if (usage) yield { usage: { ...usage, inputEstimated: !tokenCount(cached) || !tokenCount(cacheWrite) } };
          yield {finish};
          return;
        }
        case "error":
          throw anthropicError(ev.error?.type, undefined, true);
      }
    }
    throw new ProviderError("incomplete_stream",undefined,true);
  },
};
