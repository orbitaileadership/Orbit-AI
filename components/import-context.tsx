"use client";

import { useState } from "react";
import type { Profile } from "@/lib/profile/personal";
import { CONTEXT_TRANSFER_PROMPT, mergeContextTransfer, parseContextTransfer } from "@/lib/import/context";

export function ImportContext({ profile, disabled, onReview }: { profile: Profile; disabled: boolean; onReview: (profile: Profile) => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(CONTEXT_TRANSFER_PROMPT); setStatus("Prompt copied. Paste it into your old AI, then bring its response here."); }
    catch { setStatus("Copy the prompt manually from the text below."); }
  }
  return <section aria-labelledby="context-import-title">
    <h3 id="context-import-title" className="text-base font-medium">Bring context from another AI</h3>
    <p className="mt-2 text-sm text-ink-muted">Bring your background, projects and response preferences to Orbit. Your old AI can only summarize context it can access. Chat history has a separate import below; files must be uploaded separately.</p>
    <ol className="mt-4 list-inside list-decimal space-y-2 text-sm"><li>Copy this prompt into your old AI.</li><li>Paste its response below and remove anything you don&apos;t want to share.</li><li>Review your combined Profile, then save.</li></ol>
    <button type="button" onClick={copy} className="mt-4 rounded-full border border-line-strong px-4 py-2 text-sm hover:bg-surface-300">Copy transfer prompt</button>
    <details className="mt-3 text-sm"><summary className="cursor-pointer text-ink-muted">View prompt / copy manually</summary><textarea readOnly aria-label="Transfer prompt" value={CONTEXT_TRANSFER_PROMPT} rows={8} className="mt-2 w-full rounded-xl border border-line bg-surface-000 p-3" /></details>
    <label htmlFor="import-context" className="mt-4 block text-sm font-medium">Response from your old AI</label>
    <textarea id="import-context" value={text} onChange={e => { setText(e.target.value); setStatus(""); }} maxLength={12001} rows={7} placeholder={'{"about": "…", "instructions": "…"}'} className="mt-2 w-full rounded-xl border border-line-strong bg-surface-000 p-3 text-sm focus:border-brand" />
    <p className="mt-2 text-xs text-ink-subtle">Only reviewed profile text will be saved. Existing preferences are kept. This does not enable Memory or transfer hidden reasoning.</p>
    <button type="button" disabled={disabled || !text.trim()} onClick={() => {
      try { onReview(mergeContextTransfer(profile, parseContextTransfer(text))); }
      catch (e) { setStatus((e as Error).message); }
    }} className="mt-4 rounded-full bg-brand px-5 py-2 text-sm font-medium text-on-brand disabled:opacity-60">Review in Profile</button>
    {status && <p role="status" className="mt-3 text-sm text-ink-muted">{status}</p>}
  </section>;
}
