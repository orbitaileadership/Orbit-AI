import { OrbitHero } from "@/components/orbit-hero";
import type { Decision } from "@/lib/orbit/voting";

export function OrbitAvailabilityNotice({ decision }: { decision: Decision }) {
  return decision.unavailableProviders?.includes("google") ? <p role="note" className="mt-2 text-sm leading-5 text-ink-muted">Google was unavailable for this turn.</p> : null;
}

// Live view of an Orbit turn: the orbit spins fast while the four AIs vote, then the chosen lead lifts out.
// Purely presentational; it only reflects stage/decision events the server already sends.
export function OrbitVotePanel({ phase, decision, message }: { phase: string; decision: Decision | null; message: string }) {
  return (
    <div role="status" aria-live="polite" className="orbit-panel-in flex items-center gap-5 py-2">
      <OrbitHero size={92} busy={!decision} lead={decision?.lead ?? null} unavailableProviders={decision?.unavailableProviders ?? (phase === "voting_without_google" ? ["google"] : [])} />
      <div className="min-w-0">
        <p className="orbit-shimmer text-[15px] font-medium">{message}</p>
        {decision && <OrbitAvailabilityNotice decision={decision} />}
      </div>
    </div>
  );
}
