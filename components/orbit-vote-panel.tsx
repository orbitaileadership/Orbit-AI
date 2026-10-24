import { PROVIDERS } from "@/config/models";
import { THEMES } from "@/config/themes";
import { OrbitHero } from "@/components/orbit-hero";
import type { Decision } from "@/lib/orbit/voting";

const STEPS = ["voting", "summarizing", "collaborating", "answering"] as const;
const LABELS: Record<string, string> = { voting: "Vote", summarizing: "Context", collaborating: "Specialist", answering: "Answer" };

export function OrbitAvailabilityNotice({ decision }: { decision: Decision }) {
  return decision.unavailableProviders?.includes("google") ? <p role="note" className="mt-2 text-xs leading-5 text-ink-muted">Google was unavailable and did not participate in this vote. Three AIs voted. Google is tried again on your next turn.</p> : null;
}

// Live view of an Orbit turn: the orbit spins fast while the four AIs vote, then the chosen lead lifts out.
// Purely presentational; it only reflects stage/decision events the server already sends.
export function OrbitVotePanel({ phase, decision, message }: { phase: string; decision: Decision | null; message: string }) {
  const votes = (p: string) => decision?.ballots.filter(b => b.nominee === p).length ?? 0;
  const step = phase === "retrying_google" || phase === "voting_without_google" ? "voting" : phase;
  const at = STEPS.indexOf(step as (typeof STEPS)[number]);
  return (
    <div role="status" aria-live="polite" className="orbit-panel-in flex items-center gap-5 py-2">
      <OrbitHero size={92} busy={!decision} lead={decision?.lead ?? null} unavailableProviders={decision?.unavailableProviders ?? (phase === "voting_without_google" ? ["google"] : [])} />
      <div className="min-w-0">
        <p className="orbit-shimmer text-[15px] font-medium">{message}</p>
        {decision ? (
          <p className="mt-1 text-xs text-ink-muted">
            {PROVIDERS.filter(p => votes(p) > 0).map(p => `${THEMES[p].appName} ${votes(p)}`).join(" · ")}
            {" — "}<span className="text-ink">{THEMES[decision.lead].appName} leads</span>
          </p>
        ) : <p className="mt-1 text-xs text-ink-muted">Each AI nominates another to answer.</p>}
        {decision && <OrbitAvailabilityNotice decision={decision} />}
        <ol className="mt-2.5 flex flex-wrap items-center gap-1 text-[11px] text-ink-subtle" aria-hidden>
          {STEPS.filter(s => s !== "summarizing" || phase === "summarizing").filter(s => s !== "collaborating" || decision?.specialist).map(s => {
            const i = STEPS.indexOf(s);
            return <li key={s} className={`rounded-full px-2 py-0.5 transition-colors ${s === step ? "bg-surface-300 font-semibold text-ink" : at > i ? "text-ink-muted" : ""}`}>{at > i ? "✓ " : ""}{LABELS[s]}</li>;
          })}
        </ol>
      </div>
    </div>
  );
}
