"use client";

import { useEffect, useRef, useState } from "react";
import { getModel, isPremium, MENU_MAIN, modelsFor, PROVIDERS, type ModelOption, type ProviderId } from "@/config/models";
import { THEMES } from "@/config/themes";
import { ProviderLogo } from "./provider-logo";

type Sub = null | "more" | "other";

const Check = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden className="shrink-0 text-brand"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Chevron = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="shrink-0 text-ink-subtle"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
/** The quiet pill the apps use for models that cost more ("Requires usage credits" in Claude). */
const PremiumTag = () => (
  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface-200 px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M8 7.2v3.6M8 5.1v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    Uses more budget
  </span>
);

/**
 * Model picker in the style of the apps' own: this app's current models first (no descriptions, a check on the
 * selected one, number keys 1–9), older models under "More models ›", and the other three AIs under "Other AIs ›"
 * so a chat can still continue with a different provider. placement="header" is ChatGPT's "ChatGPT Sol ▾".
 */
export function ModelMenu({ provider, app, value, onChange, disabled, placement = "composer", title }: {
  provider: ProviderId;     // provider of the selected model
  app?: ProviderId;         // the app whose menu this is (defaults to provider)
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placement?: "composer" | "header";
  title?: string;
}) {
  const home = app ?? provider;
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<Sub>(null);
  const [wide, setWide] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const current = getModel(value);
  const own = modelsFor(home);
  const main = MENU_MAIN[home].map((id) => own.find((m) => m.id === id)).filter((m): m is ModelOption => Boolean(m));
  const more = own.filter((m) => !main.includes(m));
  const others = PROVIDERS.filter((p) => p !== home);

  function pick(id: string) { onChange(id); setOpen(false); setSub(null); }

  useEffect(() => {
    if (!open) return;
    setWide(window.matchMedia("(min-width: 640px)").matches); // eslint-disable-line react-hooks/set-state-in-effect
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) { setOpen(false); setSub(null); } };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (sub) setSub(null); else setOpen(false); return; }
      const n = Number(e.key);
      if (!sub && n >= 1 && n <= main.length && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
        onChange(main[n - 1].id); setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, sub, main, onChange]);

  const item = (m: ModelOption, index?: number) => (
    <button key={m.id} type="button" role="menuitemradio" aria-checked={m.id === value} onClick={() => pick(m.id)}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[15px] text-ink transition-colors hover:bg-surface-200 ${m.id === value ? "font-medium" : ""}`}>
      <span className="truncate">{m.short}</span>
      {isPremium(m) && <PremiumTag />}
      <span className="ml-auto flex shrink-0 items-center">
        {m.id === value ? <Check /> : index !== undefined && index < 9 ? <span className="w-4 text-right text-sm tabular-nums text-ink-subtle">{index + 1}</span> : null}
      </span>
    </button>
  );
  const subRow = (key: Exclude<Sub, null>, label: string, note?: string) => (
    <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={sub === key}
      onClick={() => setSub(sub === key ? null : key)} onMouseEnter={() => { if (wide) setSub(key); }}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[15px] text-ink transition-colors hover:bg-surface-200 ${sub === key ? "bg-surface-200" : ""}`}>
      {label}
      {note && <span className="ml-auto truncate text-sm text-ink-subtle">{note}</span>}
      <span className={note ? "" : "ml-auto"}><Chevron /></span>
    </button>
  );
  const subList = sub === "more"
    ? more.map((m) => item(m))
    : sub === "other"
      ? others.map((p) => (
        <div key={p} className="py-0.5">
          <p className="flex items-center gap-2 px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle"><ProviderLogo provider={p} size={13} />{THEMES[p].appName}</p>
          {MENU_MAIN[p].map((id) => getModel(id)).filter((m): m is ModelOption => Boolean(m?.enabled)).map((m) => item(m))}
        </div>
      ))
      : null;
  const otherSelected = Boolean(current && current.provider !== home);
  const moreSelected = Boolean(current && more.includes(current));

  // Opening side: the composer menu sits at the bottom right, the header menu at the top left.
  const panelPos = placement === "header" ? "left-0 top-full mt-1.5 origin-top-left" : "bottom-full right-0 mb-2 origin-bottom-right";
  const flyoutPos = placement === "header" ? "left-full top-0 ml-1.5 origin-top-left" : "right-full bottom-0 mr-1.5 origin-bottom-right";

  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); setSub(null); }} disabled={disabled} aria-haspopup="menu" aria-expanded={open}
        className={placement === "header"
          ? `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-lg text-ink transition hover:bg-surface-200 disabled:opacity-50 ${open ? "bg-surface-200" : ""}`
          : `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-surface-300 hover:text-ink disabled:opacity-50 ${open ? "bg-surface-300 text-ink" : ""}`}>
        {placement === "header" && title
          ? <>{title} <span className="hidden text-ink-subtle sm:inline">{current?.short}</span></>
          : <>{otherSelected && current && <ProviderLogo provider={current.provider} size={14} />}{current?.short ?? "Model"}</>}
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div role="menu" className={`model-menu absolute z-40 w-72 rounded-2xl border border-line bg-composer p-1.5 shadow-menu ${panelPos}`}>
          {wide || !sub ? (
            <>
              {main.map((m, i) => item(m, i))}
              <div className="mx-3 my-1.5 border-t border-line" />
              {more.length > 0 && subRow("more", "More models", moreSelected ? current?.short : undefined)}
              {subRow("other", "Other AIs", otherSelected && current ? THEMES[current.provider].appName : undefined)}
            </>
          ) : (
            <>
              <button type="button" onClick={() => setSub(null)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-200">
                <span className="rotate-180"><Chevron /></span>{sub === "more" ? "More models" : "Other AIs"}
              </button>
              <div className="max-h-[50vh] overflow-y-auto">{subList}</div>
            </>
          )}
          {wide && sub && (
            <div role="menu" className={`model-menu absolute max-h-[70vh] w-72 overflow-y-auto rounded-2xl border border-line bg-composer p-1.5 shadow-menu ${flyoutPos}`}>
              {subList}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
