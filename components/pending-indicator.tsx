import type { ProviderId } from "@/config/models";

// The "waiting for the first words" mark, styled after each app's own wait state:
// ChatGPT a pulsing dot, Claude a turning spark with shimmering text, Gemini a gradient
// spark over shimmering lines, Grok a shimmering "Thinking". Own drawings, no copied assets.
export function PendingIndicator({ provider }: { provider: ProviderId }) {
  if (provider === "anthropic") {
    return (
      <span role="status" aria-label="Thinking" className="inline-flex items-center gap-2 text-[15px]">
        <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" className="pending-spin text-brand">
          <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <span className="orbit-shimmer">Thinking…</span>
      </span>
    );
  }
  if (provider === "google") {
    return (
      <span role="status" aria-label="Thinking" className="block w-full max-w-md space-y-2.5">
        <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" className="pending-spin">
          <defs><linearGradient id="gem-pending" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4285f4" /><stop offset=".55" stopColor="#9b72cb" /><stop offset="1" stopColor="#d96570" /></linearGradient></defs>
          <path d="M12 1c.6 5.8 5.2 10.4 11 11-5.8.6-10.4 5.2-11 11-.6-5.8-5.2-10.4-11-11 5.8-.6 10.4-5.2 11-11z" fill="url(#gem-pending)" />
        </svg>
        <span className="pending-line block h-3 w-full rounded-full" />
        <span className="pending-line block h-3 w-4/5 rounded-full" />
        <span className="pending-line block h-3 w-3/5 rounded-full" />
      </span>
    );
  }
  if (provider === "xai") {
    return <span role="status" aria-label="Thinking" className="orbit-shimmer text-[15px]">Thinking</span>;
  }
  return <span role="status" aria-label="Writing" className="orbit-caret inline-block h-3 w-3 rounded-full bg-ink align-middle" />;
}
