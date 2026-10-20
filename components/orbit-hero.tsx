import { PROVIDERS, type ProviderId } from "@/config/models";
import { ProviderLogo } from "./provider-logo";

/**
 * Orbit's signature visual: the four AI apps circling a glowing core. Decorative only.
 * `busy` speeds the orbit up (used while the four AIs vote); `lead` lifts the chosen app.
 */
export function OrbitHero({ size = 200, busy = false, lead = null }: { size?: number; busy?: boolean; lead?: ProviderId | null }) {
  const badge = Math.round(size * 0.2);
  return (
    <div aria-hidden className={`orbit-hero relative ${busy ? "orbit-hero-busy" : ""}`} style={{ width: size, height: size }}>
      <div className="orbit-hero-glow absolute inset-[18%] rounded-full" />
      <div className="absolute inset-[8%] rounded-full border border-line" />
      <div className="absolute inset-[26%] rounded-full border border-dashed border-line-strong opacity-60" />
      <div className="orbit-hero-core absolute inset-[38%] rounded-full" />
      <div className="orbit-hero-ring absolute inset-[8%]">
        {PROVIDERS.map((p, i) => {
          const angle = (i / PROVIDERS.length) * 2 * Math.PI - Math.PI / 4;
          return (
            <span key={p} className="absolute" style={{ left: `${50 + 50 * Math.cos(angle)}%`, top: `${50 + 50 * Math.sin(angle)}%`, transform: "translate(-50%, -50%)" }}>
              <span className={`orbit-hero-badge grid place-items-center rounded-full border bg-surface-100 shadow-composer transition-all duration-500 ${lead === p ? "scale-125 border-brand shadow-glow" : "border-line"}`}
                style={{ width: badge, height: badge }}>
                <ProviderLogo provider={p} size={Math.round(badge * 0.55)} />
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
