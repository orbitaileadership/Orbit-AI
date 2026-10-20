"use client";

import { useEffect, useState } from "react";
import type { ProviderId } from "@/config/models";

// The "waiting for the first words" state, styled after each app's own: ChatGPT a pulsing dot that becomes
// "Thinking", Claude a turning spark, Gemini a sparkle over shimmering lines, Grok an orbiting mark. Long waits
// say so ("Still thinking…") instead of looking stuck. Own drawings, no copied assets.
const LABELS = ["Thinking", "Still thinking", "Working on a longer answer"];

function useStage() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setStage(1), 6_000);
    const b = setTimeout(() => setStage(2), 18_000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  return stage;
}

export function PendingIndicator({ provider }: { provider: ProviderId }) {
  const stage = useStage();
  const label = <span key={stage} className="pending-label orbit-shimmer">{LABELS[stage]}…</span>;

  if (provider === "anthropic") {
    return (
      <span role="status" aria-label={LABELS[stage]} className="inline-flex items-center gap-2.5 text-[15px]">
        <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" className="claude-spark text-brand">
          {[0, 30, 60, 90, 120, 150].map((r) => <path key={r} d="M12 2.5v19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" transform={`rotate(${r} 12 12)`} />)}
        </svg>
        {label}
      </span>
    );
  }
  if (provider === "google") {
    return (
      <span role="status" aria-label={LABELS[stage]} className="block w-full max-w-md">
        <span className="flex items-center gap-2.5">
          <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" className="pending-spin lg:hidden">
            <defs><linearGradient id="gem-pending" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4285f4" /><stop offset=".55" stopColor="#9b72cb" /><stop offset="1" stopColor="#d96570" /></linearGradient></defs>
            <path d="M12 1c.6 5.8 5.2 10.4 11 11-5.8.6-10.4 5.2-11 11-.6-5.8-5.2-10.4-11-11 5.8-.6 10.4-5.2 11-11z" fill="url(#gem-pending)" />
          </svg>
          {stage > 0 && <span className="text-sm">{label}</span>}
        </span>
        <span className="mt-3 block space-y-2.5">
          <span className="gemini-line block h-3 w-full rounded-full" />
          <span className="gemini-line block h-3 w-4/5 rounded-full" style={{ animationDelay: "0.15s" }} />
          <span className="gemini-line block h-3 w-3/5 rounded-full" style={{ animationDelay: "0.3s" }} />
        </span>
      </span>
    );
  }
  if (provider === "xai") {
    return (
      <span role="status" aria-label={LABELS[stage]} className="inline-flex items-center gap-2.5 text-[15px]">
        <span aria-hidden className="grok-orbit relative grid h-5 w-5 place-items-center">
          <span className="h-2 w-2 rounded-full bg-ink" />
          <span className="grok-orbit-dot absolute h-1.5 w-1.5 rounded-full bg-ink-muted" />
        </span>
        {label}
      </span>
    );
  }
  // ChatGPT: the pulsing dot, then a "Thinking" line once it takes longer than a moment.
  return (
    <span role="status" aria-label={LABELS[stage]} className="inline-flex items-center gap-2.5 text-[15px]">
      <span aria-hidden className="chatgpt-dot inline-block h-3.5 w-3.5 rounded-full bg-ink" />
      <ChatGptThinking stage={stage} />
    </span>
  );
}

function ChatGptThinking({ stage }: { stage: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 1_500); return () => clearTimeout(t); }, []);
  return shown ? <span key={stage} className="pending-label orbit-shimmer">{LABELS[stage]}…</span> : null;
}

/** Placeholder while an image is being made: a soft gradient sweep, like the apps' image canvases. */
export function ImagePending({ label = "Creating image…" }: { label?: string }) {
  return (
    <div role="status" className="image-pending relative grid aspect-square w-full max-w-sm place-items-center overflow-hidden rounded-2xl bg-surface-200">
      <span className="relative z-10 flex items-center gap-2 text-sm text-ink-muted">
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden className="pending-spin"><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.3 4.3l2.1 2.1M13.6 13.6l2.1 2.1M4.3 15.7l2.1-2.1M13.6 6.4l2.1-2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        <span className="orbit-shimmer">{label}</span>
      </span>
    </div>
  );
}
