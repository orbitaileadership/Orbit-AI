import { PROVIDERS } from "@/config/models";
import { THEMES } from "@/config/themes";
import { ProviderLogo } from "@/components/provider-logo";
import type { Decision } from "@/lib/orbit/voting";

const STEPS = ["voting", "summarizing", "collaborating", "answering"] as const;
const LABELS: Record<string, string> = { voting: "Voting", summarizing: "Context", collaborating: "Specialist", answering: "Answering" };

// Live view of an Orbit turn: four providers pulse while voting, then the votes land on the chosen lead.
// Purely presentational; it only reflects stage/decision events the server already sends.
export function OrbitVotePanel({ phase, decision, message }: { phase: string; decision: Decision | null; message: string }) {
  const votes = (p: string) => decision?.ballots.filter(b => b.nominee === p).length ?? 0;
  return (
    <div role="status" aria-live="polite" className="orbit-panel-in mb-5 rounded-3xl border border-line bg-surface-100 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 sm:justify-center sm:gap-6">
        {PROVIDERS.map(p => {
          const lead = decision?.lead === p;
          const specialist = decision?.specialist === p;
          return (
            <div key={p} className="flex flex-col items-center gap-1.5">
              <span className={`relative grid h-12 w-12 place-items-center rounded-full border bg-surface-200 transition-all duration-500 ${lead ? "scale-110 border-brand shadow-glow" : "border-line"} ${!decision ? "orbit-vote-pulse" : ""}`}>
                <ProviderLogo provider={p} size={24} />
                {decision && votes(p) > 0 && (
                  <span key={votes(p)} className="orbit-pop absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-semibold text-on-brand">{votes(p)}</span>
                )}
              </span>
              <span className={`text-[11px] ${lead ? "font-semibold text-ink" : "text-ink-subtle"}`}>{THEMES[p].appName}{lead ? " · lead" : specialist ? " · specialist" : ""}</span>
            </div>
          );
        })}
      </div>
      <ol className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-ink-subtle" aria-hidden>
        {STEPS.map(s => (
          <li key={s} className={`rounded-full px-2.5 py-1 transition-colors ${s === phase ? "bg-surface-300 font-semibold text-ink" : ""}`}>{LABELS[s]}</li>
        ))}
      </ol>
      <p className="mt-3 text-center text-sm text-ink-muted">{message}</p>
    </div>
  );
}
