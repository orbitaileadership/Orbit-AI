"use client";

// The allowance card (sidebar, Orbit, Settings → Usage), laid out like the apps' usage limits: what the allowance is,
// when it ends, how much is used, and a bar whose colour says how much is left (green, then amber, then red).
// Figures come from /api/usage (budgets table): USD micros, shown in CAD when the account has a CAD allowance.
export type UsageData = {
  live: boolean;
  allowance: number; spent: number; reserved: number;  // USD micros
  allowanceCad?: number | null; usdCadRate?: number | null;
  expiresAt?: string | null;                           // set for trials
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

/** Money in the account's currency: C$ when it has a CAD allowance and rate, otherwise US$. */
export function moneyFor(u: UsageData) {
  const cad = Boolean(u.usdCadRate && u.allowanceCad != null);
  return (usdMicros: number) => cad ? `C$${(Math.max(0, usdMicros) * u.usdCadRate! / 1e6).toFixed(2)}` : `US$${(Math.max(0, usdMicros) / 1e6).toFixed(2)}`;
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
  const pct = usedPercent(usage);
  const tone = leftTone(pct);
  const money = moneyFor(usage);
  const trial = Boolean(usage.expiresAt);
  const left = usage.allowance - usage.spent - usage.reserved;
  return (
    <div className={`rounded-2xl border border-line bg-surface-100 ${large ? "p-5" : "p-3.5"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`${large ? "text-sm" : "text-xs"} text-ink-muted`}>Usage limits · {trial ? "Free trial" : "Orbit"}</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: TONE[tone] }} />{TONE_LABEL[tone]}
        </span>
      </div>
      <div className={large ? "mt-4" : "mt-2.5"}>
        <div className="flex items-baseline justify-between gap-3">
          <p className={`${large ? "text-[15px]" : "text-sm"} truncate font-medium`}>{trial ? "Trial allowance" : "Allowance"}</p>
          <p className="flex shrink-0 items-baseline gap-2 text-xs tabular-nums text-ink-muted">
            {large && usage.expiresAt && <span className="hidden sm:inline">{endsLabel(usage.expiresAt)}</span>}
            <span className="font-medium text-ink">{Math.round(pct)}%</span>
          </p>
        </div>
        <div className={`mt-2 ${large ? "h-2.5" : "h-2"} overflow-hidden rounded-full bg-surface-300`} role="meter" aria-label="Allowance used"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-valuetext={`${Math.round(pct)}% used, ${money(left)} left`}>
          <div className="h-full rounded-full transition-[width,background-color] duration-500" style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, background: TONE[tone] }} />
        </div>
        <p className="mt-1.5 flex justify-between gap-2 text-[11px] tabular-nums text-ink-subtle">
          <span>{money(left)} left of {money(usage.allowance)}</span>
          {usage.expiresAt && <span className={large ? "sm:hidden" : ""}>{endsLabel(usage.expiresAt)}</span>}
        </p>
      </div>
      {children}
    </div>
  );
}
