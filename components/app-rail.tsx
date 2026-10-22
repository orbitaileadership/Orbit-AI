"use client";

import Image from "next/image";
import { useId, type ReactNode } from "react";
import { PROVIDERS, type ProviderId } from "@/config/models";
import { THEMES } from "@/config/themes";
import { ProviderLogo } from "./provider-logo";

/** Orbit's own mark for the mode: a core with one orbiting dot. */
export function OrbitGlyph({ size = 22, className = "" }: { size?: number; className?: string }) {
  // Unique per instance: a shared id would resolve to a copy inside the hidden rail on phones and paint nothing.
  const id = `orbit-glyph-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--ice)" />
          <stop offset="1" stopColor="var(--brand-strong)" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" fill="none" stroke={`url(#${id})`} strokeWidth="1.5" strokeDasharray="44 13" transform="rotate(-50 12 12)" />
      <circle cx="12" cy="12" r="4" fill={`url(#${id})`} />
      <circle cx="19.2" cy="6.6" r="2" fill="var(--ice)" />
    </svg>
  );
}

type Dots = Partial<Record<ProviderId | "orbit", "running" | "done">>;

/** Orange pulsing = an answer is still running there; blue = it finished while you were elsewhere. */
export function RunDot({ state, className = "" }: { state: "running" | "done"; className?: string }) {
  return (
    <span role="status" aria-label={state === "running" ? "Answer running" : "New answer"} title={state === "running" ? "Answer running" : "New answer"}
      className={`run-dot run-dot-${state} inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`} />
  );
}

/** The left rail on computers: Orbit mode plus the four AI apps, and the account button at the bottom. */
export function AppRail({ active, busy, onOrbit, onProvider, account, dots = {} }: {
  active: ProviderId | "orbit";
  busy?: boolean;
  dots?: Dots;
  onOrbit: () => void;
  onProvider: (p: ProviderId) => void;
  account: ReactNode;
}) {
  const tile = (on: boolean) => `relative grid h-11 w-11 place-items-center rounded-2xl border transition duration-200 ${on ? "border-line-strong bg-surface-300 shadow-composer" : "border-transparent group-hover:bg-surface-200 group-active:scale-95"}`;
  // Edge marker like a desktop app switcher: full height when active, a nub on hover.
  const marker = (on: boolean) => <span aria-hidden className={`absolute -left-4 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-ink transition-all duration-200 ${on ? "h-6 opacity-100" : "h-2 opacity-0 group-hover:opacity-60"}`} />;
  const label = (on: boolean) => `text-[11px] ${on ? "font-semibold text-ink" : "text-ink-subtle group-hover:text-ink-muted"}`;
  return (
    <nav aria-label="AI apps" className="hidden w-[76px] shrink-0 flex-col items-center gap-3 border-r border-line bg-surface-100 py-4 md:flex">
      <Image src="/brand/orbit-mark.png" alt="Orbit AI" width={32} height={32} className="logo-mono mb-3 h-8 w-8 object-contain" />
      <button onClick={onOrbit} disabled={busy && active !== "orbit"} aria-pressed={active === "orbit"} title="Orbit mode"
        className="group flex flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50">
        <span className={tile(active === "orbit")}>{marker(active === "orbit")}<OrbitGlyph size={24} />{dots.orbit && <RunDot state={dots.orbit} className="absolute -right-0.5 -top-0.5 ring-2 ring-surface-100" />}</span>
        <span className={label(active === "orbit")}>Orbit</span>
      </button>
      <span aria-hidden className="my-0.5 h-px w-8 bg-line" />
      {PROVIDERS.map((p) => (
        <button key={p} onClick={() => onProvider(p)} disabled={busy && p !== active} aria-pressed={p === active} title={THEMES[p].appName}
          className="group flex flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50">
          <span className={tile(p === active)}>{marker(p === active)}<ProviderLogo provider={p} size={24} />{dots[p] && <RunDot state={dots[p]!} className="absolute -right-0.5 -top-0.5 ring-2 ring-surface-100" />}</span>
          <span className={label(p === active)}>{THEMES[p].appName}</span>
        </button>
      ))}
      <div className="mt-auto">{account}</div>
    </nav>
  );
}

/** Phone header: the same switcher as small icons. */
export function AppSwitcher({ active, busy, onOrbit, onProvider, dots = {} }: {
  active: ProviderId | "orbit";
  busy?: boolean;
  dots?: Dots;
  onOrbit: () => void;
  onProvider: (p: ProviderId) => void;
}) {
  return (
    <div className="flex gap-0.5 md:hidden" role="group" aria-label="AI apps">
      <button onClick={onOrbit} disabled={busy && active !== "orbit"} aria-pressed={active === "orbit"} aria-label="Orbit mode"
        className={`relative grid h-8 w-8 place-items-center rounded-xl ${active === "orbit" ? "bg-surface-300" : ""}`}><OrbitGlyph size={19} />{dots.orbit && <RunDot state={dots.orbit} className="absolute right-0 top-0 h-2 w-2" />}</button>
      {PROVIDERS.map((p) => (
        <button key={p} onClick={() => onProvider(p)} disabled={busy && p !== active} aria-pressed={p === active} aria-label={THEMES[p].appName}
          className={`relative grid h-8 w-8 place-items-center rounded-xl ${p === active ? "bg-surface-300" : ""}`}>
          <ProviderLogo provider={p} size={19} />
          {dots[p] && <RunDot state={dots[p]!} className="absolute right-0 top-0 h-2 w-2" />}
        </button>
      ))}
    </div>
  );
}
