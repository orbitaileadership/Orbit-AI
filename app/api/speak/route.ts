import { failureState } from "@/lib/billing/outcome";
import { errorForStatus } from "@/lib/providers/types";
import { randomUUID } from "node:crypto";
import { SPEECH } from "@/config/voice";
import { json, requireAppUser } from "@/lib/api";
import { reserve, settle } from "@/lib/billing/budget";
import { defaultVoice, listVoices, speechMicros, speechService, synthesize } from "@/lib/voice/tts";

// Spoken replies.
// GET  /api/speak → { service: "elevenlabs" | "openai" | "browser", voices, defaultVoice }
// POST /api/speak { text, voice? } → audio/mpeg (streamed). Allowance charged by characters; ambiguous provider outcomes retain their reservation.
export const maxDuration = 60;

export async function GET() {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  const s = speechService();
  if (!s) return json({ service: "browser", voices: [], defaultVoice: null });
  return json({ service: s.kind, voices: await listVoices(s), defaultVoice: defaultVoice(s) });
}

export async function POST(request: Request) {
  const auth = await requireAppUser();
  if ("error" in auth) return auth.error;
  const s = speechService();
  if (!s) return json({ error: "speech_not_configured" }, 503);
  const body = (await request.json().catch(() => ({}))) as { text?: unknown; voice?: unknown };
  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim().slice(0, SPEECH.maxChars) : "";
  if (!text) return json({ error: "bad_request" }, 400);
  const voice = typeof body.voice === "string" && /^[\w-]{1,64}$/.test(body.voice) ? body.voice : defaultVoice(s);

  const id = randomUUID();
  const cost = speechMicros(s.kind, text.length);
  const r = await reserve(auth.user.id, id, SPEECH.ledgerId, "text", cost, { provider: s.kind, operation: "speech", apiModel: SPEECH[s.kind].model, unitType: "1000_characters", units: text.length / 1000, unitCostUsdMicros: speechMicros(s.kind, 1000), costBasis: "estimated" });
  if (!r.ok) return json({ error: ["budget", "trial_expired", "fx_not_configured"].includes(r.reason) ? r.reason : "reserve_failed" }, r.reason === "budget" ? 402 : 503);
  const res = await synthesize(s, text, voice, AbortSignal.timeout(30_000)).catch(() => null);
  if (!res?.ok || !res.body) {
    await settle(id, res ? failureState(errorForStatus(res.status)) : "uncertain", 0, undefined, `speak_${res?.status ?? "failed"}`);
    return json({ error: "speak_failed" }, 502);
  }
  const reader = res.body.getReader();
  let clientGone = false;
  const bodyStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!clientGone) { try { controller.enqueue(value); } catch { clientGone = true; } }
        }
        await settle(id, "settled", cost);
        if (!clientGone) controller.close();
      } catch {
        await settle(id, "uncertain", 0, undefined, "speech_stream_failed");
        if (!clientGone) controller.error(new Error("speech_stream_failed"));
      } finally { reader.releaseLock(); }
    },
    cancel() { clientGone = true; },
  });
  return new Response(bodyStream, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
