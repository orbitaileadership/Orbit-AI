"use client";
import type { UsageWindow } from '@/lib/billing/usage-windows';

// Shared rolling-window meter for Settings. Students see percentages only.
// The server controls monetary detail visibility; all enforcement stays in the reservation RPC.
export type UsageData = {
  live: boolean;
  allowance: number; spent: number; reserved: number;  // USD micros
  allowanceCad?: number | null; usdCadRate?: number | null;
  expiresAt?: string | null;                           // set for trials
  windows?: UsageWindow[];
  canViewCosts?: boolean;
  available?: number;
  expired?: boolean;
};

/** Share of the allowance used (spent + held for running answers), 0–100. */
export function usedPercent(u: Pick<UsageData, "allowance" | "spent" | "reserved">) {
  return u.allowance > 0 ? Math.min(100, Math.max(0, ((u.spent + u.reserved) / u.allowance) * 100)) : 100;
}

/** Status colour for what's left: more than half → good, 20–50% → warning, under 20% → critical. */
export function leftTone(pctUsed: number): "good" | "warning" | "critical" {
  const left = 100 - pctUsed;
  return left > 50 ? "good" : left >= 20 ? "warning" : "critical";
}
const TONE = { good: "var(--success)", warning: "var(--warning)", critical: "var(--danger)" } as const;
const TONE_LABEL = { good: "Plenty left", warning: "Running low", critical: "Almost used up" } as const;

/** "Ends in 2 hr 8 min", "Ends Thu 8:00 AM", "Ends Nov 3", or "Ended". */
export function endsLabel(iso: string, now = new Date()) {
  const end = new Date(iso);
  const ms = end.getTime() - now.getTime();
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return "Ended";
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `Ends in ${min} min`;
  if (min < 24 * 60) return `Ends in ${Math.floor(min / 60)} hr ${min % 60} min`;
  if (ms < 7 * 86_400_000) return `Ends ${end.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
  return `Ends ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/** Provider usage budgets and cost details are always USD. */
export function moneyFor(u: UsageData) {
  void u;
  return (usdMicros: number) => `US$${(Math.max(0, usdMicros) / 1e6).toFixed(2)}`;
}

export function UsageMeter({ usage, size = "compact", children }: { usage: UsageData | null; size?: "compact" | "large"; children?: React.ReactNode }) {
  const large = size === "large";
  if (!usage) return <div className={`rounded-2xl border border-line bg-surface-100 ${large ? "p-5" : "p-3.5"} text-sm text-ink-subtle`}>Loading usage…</div>;
  if (!usage.live) {
    return (
      <div className={`rounded-2xl border border-line bg-surface-100 ${large ? "p-5" : "p-3.5"}`}>
        <p className="text-xs text-ink-muted">Usage limits · Demo mode</p>
        <p className="mt-1.5 text-sm text-ink-muted">Replies are sample answers right now, so nothing is used.</p>
      </div>
    );
  }
  if (!usage.windows?.length) return <div role="status" className="rounded-2xl border border-line p-4 text-sm text-ink-muted">Usage limits are temporarily unavailable. Refresh to try again.</div>;
  const trial = Boolean(usage.expiresAt);
  const accountLeft = Math.max(0, 100 - usedPercent(usage));
  const labels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
  const periods = { daily: 'Past 24 hours', weekly: 'Past 7 days', monthly: 'Past 30 days' };
  return <div className={`rounded-2xl border border-line bg-surface-100 ${large ? 'p-5' : 'p-3.5'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className={`${large ? 'text-base' : 'text-sm'} font-medium`}>Usage limits</h3>
      {trial && <span className="rounded-full bg-surface-200 px-2 py-1 text-[11px] text-ink-muted">Free trial</span>}
    </div>
    <p className="mt-1 text-xs leading-relaxed text-ink-muted">Shared across all your AIs and models.</p>
    {usage.expired ? <p role="status" className="mt-3 rounded-xl bg-danger-surface p-3 text-xs text-danger">Your trial has ended. Rolling limits do not extend your trial.</p> : accountLeft <= 0 ? <p role="status" className="mt-3 rounded-xl bg-danger-surface p-3 text-xs text-danger">Your account allowance is exhausted. Recovering daily or weekly capacity does not refill it.</p> : null}
    <div className={large ? 'mt-6 space-y-6' : 'mt-4 space-y-4'}>
      {usage.windows.map(window => {
        const left = window.remainingPercent;
        const tone = leftTone(100 - left);
        const displayed = Math.floor(left);
        return <section key={window.key} aria-label={`${labels[window.key]} usage limit`}>
          <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{labels[window.key]}</span><span className="tabular-nums font-medium">{left > 0 && left < 1 ? '<1' : displayed}% left</span></div>
          <div role="meter" aria-label={`${labels[window.key]} allowance remaining`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={left} aria-valuetext={`${left.toFixed(1)}% remaining`}
            className={`mt-2 overflow-hidden rounded-full bg-surface-300 ${large ? 'h-2.5' : 'h-2'}`}>
            <div className="h-full rounded-full transition-[width,background-color] duration-500 motion-reduce:transition-none" style={{ width: `${left}%`, background: TONE[tone] }} />
          </div>
          <div className="mt-1.5 flex flex-wrap justify-between gap-1 text-[11px] text-ink-subtle"><span>{periods[window.key]}</span><span>{left <= 0 ? 'Limit reached' : TONE_LABEL[tone]}</span></div>
          {large && window.nextReleaseAt && <p className="mt-1 text-[11px] text-ink-subtle">Usage starts freeing up {new Date(window.nextReleaseAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.</p>}
          {window.heldPercent > 0 && <p className="mt-1 text-[11px] text-ink-subtle">Includes {window.heldPercent < 1 ? '<1' : Math.ceil(window.heldPercent)}% held for work in progress.</p>}
          {usage.canViewCosts && window.costs && <p className="mt-1 text-[11px] text-ink-muted">Admin · US${((window.costs.spent + window.costs.reserved) / 1e6).toFixed(2)} used/held of US${(window.costs.limit / 1e6).toFixed(2)}</p>}
        </section>;
      })}
    </div>
    <p className="mt-4 text-[11px] leading-relaxed text-ink-subtle">Limits recover gradually as usage leaves each window. Work in progress remains held until its cost is confirmed.</p>
    <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{trial ? 'Trial' : 'Account'} allowance: {Math.floor(accountLeft)}% left. {usage.expiresAt ? endsLabel(usage.expiresAt) + '.' : 'Your account allowance also applies.'}</p>
    {children}
  </div>;
}

/** A single-row shortcut keeps usage details out of the chat sidebar. */
export function UsageShortcut({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label="Usage & limits" aria-haspopup="dialog"
    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-ink-muted transition hover:bg-surface-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
    <svg viewBox="0 0 20 20" width="18" height="18" className="shrink-0" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7.5" /><path d="M10 10l3.5-3.5M6 13.5h8" /></svg>
    <span className="flex-1">Usage &amp; limits</span>
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 4 4 4-4 4" /></svg>
  </button>;
}
