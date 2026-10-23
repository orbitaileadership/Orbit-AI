"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProviderId } from "@/config/models";
import { ImportHistory } from "./import-history";
import { emptyProfile, LENGTHS, LIMITS, STYLES, type Memory, type Profile } from "@/lib/profile/personal";
import { DEFAULT_APPEARANCE, loadAppearance, saveAppearance, type Appearance } from "@/lib/appearance";

// Settings, laid out like the apps' own: every section in a searchable list on the left, the section on the right.
// General = appearance on this device; Profile and Memory are used by every AI app; Courses links to course instructions.
export type SettingsTab = "general" | "profile" | "account" | "usage" | "privacy" | "memory" | "courses" | "import";
const LEVELS = ["", "1st year", "2nd year", "3rd year", "4th year", "5th year+", "Graduate (Master's)", "Graduate (PhD)", "Other"];
type Usage = { live: boolean; allowance: number; spent: number; reserved: number; expiresAt?: string | null };

const icon = (d: ReactNode) => <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{d}</svg>;
const SECTIONS: { group: string; items: { key: SettingsTab | "plugins" | "analytics"; label: string; keywords: string; icon: ReactNode }[] }[] = [
  { group: "Settings", items: [
    { key: "general", label: "General", keywords: "appearance theme dark light text size width motion animation", icon: icon(<><circle cx="10" cy="10" r="2.6" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" /></>) },
    { key: "profile", label: "Profile", keywords: "name year program style length about instructions personalization", icon: icon(<><circle cx="10" cy="7.5" r="3" /><path d="M4 16.5c1.2-2.6 3.4-3.8 6-3.8s4.8 1.2 6 3.8" /></>) },
    { key: "account", label: "Account", keywords: "email sign out log out", icon: icon(<><circle cx="10" cy="10" r="7.5" /><circle cx="10" cy="8.5" r="2.4" /><path d="M5.4 15.5c1.1-1.7 2.7-2.6 4.6-2.6s3.5.9 4.6 2.6" /></>) },
    { key: "usage", label: "Usage", keywords: "allowance budget trial limit spent remaining", icon: icon(<><circle cx="10" cy="10" r="7.5" /><path d="M10 10l3.5-3.5" /><path d="M6 13.5h8" /></>) },
    { key: "privacy", label: "Privacy", keywords: "data policy terms memory search", icon: icon(<><path d="M10 2.8l6 2.4v4.3c0 3.7-2.6 6.4-6 7.7-3.4-1.3-6-4-6-7.7V5.2z" /><path d="M7.6 10l1.7 1.7 3.2-3.4" /></>) },
  ] },
  { group: "Personalization", items: [
    { key: "memory", label: "Memory", keywords: "memories remember forget delete", icon: icon(<><path d="M10 3.5a6.5 6.5 0 1 0 6.5 6.5" /><path d="M10 6.5V10l2.5 1.5" /><path d="M14 3.5h2.5V6" /></>) },
    { key: "courses", label: "Courses", keywords: "course instructions folders", icon: icon(<><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.5L9.5 5.5h6A1.5 1.5 0 0 1 17 7v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z" /></>) },
    { key: "import", label: "Import chats", keywords: "import history chatgpt claude export", icon: icon(<><path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" /><path d="M4 13.5V15a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 15v-1.5" /></>) },
  ] },
  { group: "Customize", items: [
    { key: "plugins", label: "Plugins & skills", keywords: "plugins skills connectors integrations google drive notion github", icon: icon(<><path d="M8 3.5h4v3a1.5 1.5 0 0 0 3 0V6h1.5v4h-1a1.5 1.5 0 0 0 0 3h1v3.5h-4v-1a1.5 1.5 0 0 0-3 0v1H3.5V13h1a1.5 1.5 0 0 0 0-3h-1V6H8z" /></>) },
    { key: "analytics", label: "Analytics", keywords: "admin analytics report", icon: icon(<path d="M3.5 16.5v-5M8 16.5V6M12.5 16.5V9M17 16.5H3" />) },
  ] },
];

/** A setting: name and description on the left, its control on the right (stacks on phones). */
function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="text-[15px]">{title}</p>
        {description && <p className="mt-1 text-sm leading-5 text-ink-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-surface-200 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} title={o.title} onClick={() => onChange(o.value)}
          className={`grid min-w-10 place-items-center rounded-lg px-3.5 py-1.5 text-sm transition ${value === o.value ? "bg-surface-100 font-medium text-ink shadow-composer" : "text-ink-muted hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const themeIcon = {
  system: icon(<><rect x="2.5" y="3.5" width="15" height="10" rx="1.5" /><path d="M7 16.5h6M10 13.5v3" /></>),
  light: icon(<><circle cx="10" cy="10" r="3.2" /><path d="M10 2v1.8M10 16.2V18M2 10h1.8M16.2 10H18M4.3 4.3l1.3 1.3M14.4 14.4l1.3 1.3M4.3 15.7l1.3-1.3M14.4 5.6l1.3-1.3" /></>),
  dark: icon(<path d="M16 12.2A6.5 6.5 0 0 1 7.8 4a6.5 6.5 0 1 0 8.2 8.2z" />),
};

export function SettingsDialog({ open, tab: initialTab, onClose, email, appName, courses, onOpenCourse, memoryVersion, onImported, isAdmin = false, signOut, onPlugins }: {
  open: boolean;
  tab?: SettingsTab;
  onClose: () => void;
  email: string;
  appName: string;
  courses: { id: string; name: string; instructions: string }[];
  onOpenCourse: (id: string) => void;
  onImported?: (provider: ProviderId) => void; // chats were imported into this app: reload its list
  memoryVersion?: number; // bumps when the AI saves a memory, so an open list reloads
  isAdmin?: boolean;      // server-decided; /admin/analytics re-checks on the server
  signOut?: () => Promise<void> | void;
  onPlugins?: () => void; // open the Plugins page (closes Settings)
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<SettingsTab>("general");
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<Profile>(emptyProfile());
  const [saved, setSaved] = useState<Profile>(emptyProfile());
  const [memories, setMemories] = useState<Memory[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [look, setLook] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [usage, setUsage] = useState<Usage | null | "error">(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setTab(initialTab ?? "general");
      setQuery("");
      setStatus(null);
      setConfirmClear(false);
      setLook(loadAppearance());
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch("/api/profile").catch(() => null);
      const out = res?.ok ? ((await res.json()) as { profile: Profile; memories: Memory[]; ready: boolean }) : null;
      if (cancelled) return;
      setLoading(false);
      if (!out) return setStatus("Couldn't load your settings. Try again.");
      setProfile(out.profile);
      setSaved(out.profile);
      setMemories(out.memories);
      setReady(out.ready);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, memoryVersion]);

  useEffect(() => {
    if (!open || tab !== "usage") return;
    let cancelled = false;
    fetch("/api/usage").then((r) => (r.ok ? r.json() : Promise.reject())).then((u: Usage) => { if (!cancelled) setUsage(u); }).catch(() => { if (!cancelled) setUsage("error"); });
    return () => { cancelled = true; };
  }, [open, tab]);

  async function save(next: Profile, note = "Saved.") {
    setStatus("Saving…");
    const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
    if (!res?.ok) return setStatus("Couldn't save. Try again.");
    const out = (await res.json()) as { profile: Profile };
    setProfile(out.profile);
    setSaved(out.profile);
    setStatus(note);
  }

  async function addMemory() {
    const content = newMemory.trim();
    if (!content) return;
    const res = await fetch("/api/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }).catch(() => null);
    if (!res?.ok) {
      const err = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      return setStatus(err?.error === "too_many" ? `You can keep up to ${LIMITS.memories} memories. Delete some first.` : "Couldn't save that memory.");
    }
    const { memory } = (await res.json()) as { memory: Memory };
    setMemories((m) => [memory, ...m]);
    setNewMemory("");
    setStatus(null);
  }

  async function forget(id: string) {
    const before = memories;
    setMemories((m) => m.filter((x) => x.id !== id));
    const res = await fetch(`/api/memories/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setMemories(before);
      setStatus("Couldn't delete that memory.");
    }
  }

  async function forgetAll() {
    const res = await fetch("/api/memories", { method: "DELETE" }).catch(() => null);
    setConfirmClear(false);
    if (res?.ok) setMemories([]);
    else setStatus("Couldn't delete your memories.");
  }

  function setAppearance<K extends keyof Appearance>(k: K, v: Appearance[K]) {
    setLook((prev) => {
      const next = { ...prev, [k]: v };
      saveAppearance(next); // idempotent, so a repeated updater call is harmless
      return next;
    });
  }

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SECTIONS.map((g) => ({
      ...g,
      items: g.items.filter((i) => (i.key !== "analytics" || isAdmin) && (i.key !== "plugins" || onPlugins) && (!q || `${i.label} ${i.keywords}`.toLowerCase().includes(q))),
    })).filter((g) => g.items.length);
  }, [query, isAdmin, onPlugins]);

  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setProfile((p) => ({ ...p, [k]: v }));
    setStatus(null);
  };
  const input = "mt-1.5 w-full rounded-xl border border-line-strong bg-surface-000 px-3.5 py-2.5 text-sm outline-none focus:border-brand";
  const label = "mt-4 block text-sm font-medium";
  const primary = "rounded-full bg-brand px-5 py-2 text-sm font-medium text-on-brand disabled:opacity-60";
  const secondary = "rounded-full border border-line-strong px-4 py-2 text-sm font-medium hover:bg-surface-300 disabled:opacity-60";
  const heading = (title: string, description?: string) => (
    <div className="mb-2">
      <h2 className="text-xl font-medium">{title}</h2>
      {description && <p className="mt-1.5 text-sm leading-6 text-ink-muted">{description}</p>}
    </div>
  );
  const money = (micros: number) => `US$${(Math.max(0, micros) / 1e6).toFixed(2)}`;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Settings"
      className="settings-dialog m-auto h-dvh max-h-dvh w-screen max-w-none bg-surface-100 p-0 text-ink shadow-menu backdrop:bg-black/50 sm:h-[min(92dvh,780px)] sm:w-[min(96vw,1040px)] sm:rounded-3xl sm:border sm:border-line"
    >
      <div className="flex h-full flex-col sm:flex-row">
        <nav className="flex shrink-0 flex-col border-b border-line sm:w-64 sm:border-b-0 sm:border-r" aria-label="Settings sections">
          <div className="flex items-center gap-2 p-3 sm:p-4">
            <label className="relative flex-1">
              <span className="sr-only">Search settings</span>
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"
                className="w-full rounded-xl border border-line bg-surface-000 py-2 pl-9 pr-3 text-sm outline-none focus:border-line-strong" />
            </label>
            <button type="button" onClick={onClose} aria-label="Close settings" className="grid h-9 w-9 place-items-center rounded-xl text-ink-muted hover:bg-surface-200 sm:hidden">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 sm:block sm:flex-1 sm:overflow-y-auto sm:px-3 sm:pb-4">
            {sections.map((g) => (
              <div key={g.group} className="flex gap-1 sm:mb-5 sm:block">
                <p className="hidden px-3 pb-1.5 text-xs font-medium text-ink-subtle sm:block">{g.group}</p>
                {g.items.map((i) => {
                  const cls = `flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-left text-[15px] transition sm:w-full ${tab === i.key ? "bg-surface-300 font-medium text-ink" : "text-ink-muted hover:bg-surface-200 hover:text-ink"}`;
                  if (i.key === "analytics") return <a key={i.key} href="/admin/analytics" className={cls}>{i.icon}{i.label}</a>;
                  if (i.key === "plugins") return <button key={i.key} type="button" onClick={() => { onClose(); onPlugins?.(); }} className={cls}>{i.icon}{i.label}<span aria-hidden className="ml-auto hidden text-ink-subtle sm:inline">↗</span></button>;
                  const key = i.key;
                  return <button key={key} type="button" onClick={() => { setTab(key); setStatus(null); }} aria-current={tab === key ? "page" : undefined} className={cls}>{i.icon}{i.label}</button>;
                })}
              </div>
            ))}
            {!sections.length && <p className="px-3 py-2 text-sm text-ink-subtle">No settings match “{query}”.</p>}
          </div>
        </nav>

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <button type="button" onClick={onClose} aria-label="Close settings" className="absolute right-4 top-4 hidden h-9 w-9 place-items-center rounded-xl text-ink-muted hover:bg-surface-200 hover:text-ink sm:grid">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
          <div className="mx-auto max-w-2xl px-5 py-6 sm:px-10 sm:py-10">
            {!ready && ["profile", "memory"].includes(tab) && (
              <p className="mb-4 rounded-2xl bg-surface-100 p-3 text-sm text-warning">
                Settings aren&apos;t set up yet: run <code>supabase/migrations/0008_profile_memory.sql</code> in the Supabase SQL Editor.
              </p>
            )}

            {tab === "general" && (
              <section>
                {heading("Appearance", "Saved on this device.")}
                <Row title="Theme">
                  <Segmented label="Theme" value={look.theme} onChange={(v) => setAppearance("theme", v)}
                    options={[{ value: "system", label: themeIcon.system, title: "Match system" }, { value: "light", label: themeIcon.light, title: "Light" }, { value: "dark", label: themeIcon.dark, title: "Dark" }]} />
                </Row>
                <Row title="Chat text size">
                  <Segmented label="Chat text size" value={look.text} onChange={(v) => setAppearance("text", v)}
                    options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} />
                </Row>
                <Row title="Chat width" description="Maximum width of the conversation and the message box.">
                  <Segmented label="Chat width" value={look.width} onChange={(v) => setAppearance("width", v)}
                    options={[{ value: "narrow", label: "Narrow" }, { value: "medium", label: "Medium" }, { value: "wide", label: "Wide" }]} />
                </Row>
                <Row title="Motion" description="Reduce animation in streaming answers and other parts of Orbit.">
                  <Segmented label="Motion" value={look.motion} onChange={(v) => setAppearance("motion", v)}
                    options={[{ value: "system", label: "System" }, { value: "reduced", label: "Reduced" }]} />
                </Row>
              </section>
            )}

            {tab === "profile" && (
              <form onSubmit={(e) => { e.preventDefault(); save(profile); }}>
                {heading("Profile", "Every AI app uses this to fit answers to you. Course instructions win if they say something different.")}
                <div className="grid gap-x-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pf-name" className={label}>What should the AI call you?</label>
                    <input id="pf-name" value={profile.display_name} onChange={(e) => set("display_name", e.target.value)} maxLength={LIMITS.display_name} placeholder="e.g. Noah" className={input} />
                  </div>
                  <div>
                    <label htmlFor="pf-level" className={label}>Year</label>
                    <select id="pf-level" value={LEVELS.includes(profile.level) ? profile.level : "Other"} onChange={(e) => set("level", e.target.value)} className={input}>
                      {LEVELS.map((l) => <option key={l} value={l}>{l || "Not set"}</option>)}
                    </select>
                  </div>
                </div>
                <label htmlFor="pf-program" className={label}>Program</label>
                <input id="pf-program" value={profile.program} onChange={(e) => set("program", e.target.value)} maxLength={LIMITS.program} placeholder="e.g. BSc Computer Science, minor in Statistics" className={input} />

                <div className="grid gap-x-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pf-style" className={label}>Explanation style</label>
                    <select id="pf-style" value={profile.style} onChange={(e) => set("style", e.target.value as Profile["style"])} className={input}>
                      {Object.entries(STYLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pf-length" className={label}>Answer length</label>
                    <select id="pf-length" value={profile.length} onChange={(e) => set("length", e.target.value as Profile["length"])} className={input}>
                      {Object.entries(LENGTHS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <label htmlFor="pf-about" className={label}>What should the AI know about you? <span className="font-normal text-ink-subtle">(optional)</span></label>
                <textarea id="pf-about" value={profile.about} onChange={(e) => set("about", e.target.value)} maxLength={LIMITS.about} rows={3}
                  placeholder="e.g. I'm taking CS 2210 and STATS 2244 this term. Math isn't my strongest subject. I learn best with diagrams."
                  className={`${input} resize-y leading-relaxed`} />
                <label htmlFor="pf-instr" className={label}>How should it respond? <span className="font-normal text-ink-subtle">(optional)</span></label>
                <textarea id="pf-instr" value={profile.instructions} onChange={(e) => set("instructions", e.target.value)} maxLength={LIMITS.instructions} rows={3}
                  placeholder="e.g. Use SI units. Show formulas in LaTeX. Don't give me full assignment solutions; give hints first."
                  className={`${input} resize-y leading-relaxed`} />

                <div className="mt-5 flex items-center justify-end gap-3">
                  {status && <span role="status" className="text-sm text-ink-muted">{status}</span>}
                  <button type="submit" disabled={!dirty || loading || !ready} className={primary}>Save</button>
                </div>
              </form>
            )}

            {tab === "account" && (
              <section>
                {heading("Account")}
                <Row title="Email" description="You sign in with this address.">
                  <span className="text-sm text-ink-muted">{email}</span>
                </Row>
                {signOut && (
                  <Row title="Sign out" description="Sign out of Orbit on this device.">
                    <form action={signOut}><button className={secondary}>Sign out</button></form>
                  </Row>
                )}
              </section>
            )}

            {tab === "usage" && (
              <section>
                {heading("Usage", "Every answer uses part of your allowance. Cheaper models stretch it further.")}
                {usage === null && <p className="py-5 text-sm text-ink-subtle">Loading…</p>}
                {usage === "error" && <p className="py-5 text-sm text-ink-muted">Couldn&apos;t load your usage. Try again.</p>}
                {usage && usage !== "error" && !usage.live && <Row title="Demo mode" description="Replies are sample answers right now, so nothing is used."><span className="text-sm text-ink-muted">Free</span></Row>}
                {usage && usage !== "error" && usage.live && (() => {
                  const used = usage.spent + usage.reserved;
                  const pct = usage.allowance > 0 ? Math.min(100, (used / usage.allowance) * 100) : 0;
                  return (
                    <>
                      <div className="mt-4 rounded-2xl border border-line bg-surface-100 p-5">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm text-ink-muted">Allowance left</p>
                          <p className="text-2xl font-medium tabular-nums">{money(usage.allowance - used)}</p>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-300" role="progressbar" aria-label="Allowance used" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-2 text-xs tabular-nums text-ink-subtle">{money(used)} of {money(usage.allowance)} used ({Math.round(pct)}%)</p>
                      </div>
                      {usage.expiresAt && <Row title="Trial ends"><span className="text-sm text-ink-muted">{new Date(usage.expiresAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span></Row>}
                      <Row title="In progress" description="Held while an answer is still being written, then settled to the actual cost."><span className="text-sm tabular-nums text-ink-muted">{money(usage.reserved)}</span></Row>
                    </>
                  );
                })()}
              </section>
            )}

            {tab === "privacy" && (
              <section>
                {heading("Privacy")}
                <Row title="Memory" description="Choose whether the AI keeps short notes between chats. You can see and delete every one.">
                  <button type="button" onClick={() => setTab("memory")} className={secondary}>Manage</button>
                </Row>
                <Row title="Privacy policy" description="How Orbit handles your account, chats and files.">
                  <a href="/privacy" target="_blank" className={secondary}>Open ↗</a>
                </Row>
                <Row title="Terms of use">
                  <a href="/terms" target="_blank" className={secondary}>Open ↗</a>
                </Row>
              </section>
            )}

            {tab === "memory" && (
              <div>
                {heading("Memory", "Short notes the AI keeps between chats, like your courses or how you like things explained. You can see and delete every one.")}
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3.5">
                  <input type="checkbox" checked={profile.memory_enabled} disabled={loading || !ready}
                    onChange={(e) => save({ ...saved, memory_enabled: e.target.checked }, e.target.checked ? "Memory is on." : "Memory is off.")}
                    className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
                  <span>
                    <span className="block text-sm font-medium">Use memory</span>
                    <span className="block text-xs text-ink-subtle">
                      The AI uses relevant saved notes and can save new ones when you tell it something lasting.
                      When semantic search is enabled, earlier chat excerpts and saved notes are sent to OpenAI to find relevant context.
                      Turning this off stops saved-memory use and semantic search and removes search vectors; your saved notes and chat history remain.
                    </span>
                  </span>
                </label>

                <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); addMemory(); }}>
                  <input value={newMemory} onChange={(e) => setNewMemory(e.target.value)} maxLength={LIMITS.memory} placeholder="Add a memory, e.g. I'm in Engineering 1st year" aria-label="New memory"
                    className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface-000 px-3.5 py-2 text-sm outline-none focus:border-brand" />
                  <button type="submit" disabled={!newMemory.trim() || !ready} className={secondary}>Add</button>
                </form>
                {status && <p role="status" className="mt-2 text-sm text-ink-muted">{status}</p>}

                <ul className="mt-4 divide-y divide-line rounded-2xl border border-line" aria-label="Saved memories">
                  {memories.length === 0 && <li className="p-4 text-sm text-ink-subtle">{loading ? "Loading…" : "No memories yet."}</li>}
                  {memories.map((m) => (
                    <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm">{m.content}</p>
                        <p className="mt-0.5 text-xs text-ink-subtle">
                          {m.source === "ai" ? "Saved by the AI" : "Added by you"} · {new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <button type="button" onClick={() => forget(m.id)} aria-label={`Delete memory: ${m.content}`}
                        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-300 hover:text-danger">Delete</button>
                    </li>
                  ))}
                </ul>
                {memories.length > 0 && (
                  <div className="mt-3 flex justify-end gap-2">
                    {confirmClear ? (
                      <>
                        <span className="self-center text-sm text-ink-muted">Delete all {memories.length}?</span>
                        <button type="button" onClick={() => setConfirmClear(false)} className={secondary}>Cancel</button>
                        <button type="button" onClick={forgetAll} className="rounded-full bg-danger px-4 py-2 text-sm font-medium text-white">Delete all</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmClear(true)} className="text-sm text-ink-muted underline underline-offset-[3px] hover:text-danger">Delete all memories</button>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "import" && (
              <div>
                {heading("Import chats", "Bring conversations over from another AI app.")}
                <ImportHistory onImported={(p) => onImported?.(p)} />
              </div>
            )}

            {tab === "courses" && (
              <div>
                {heading("Course instructions", `Each course has its own instructions for every chat inside it (in ${appName} only), on top of your profile.`)}
                <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
                  {courses.length === 0 && <li className="p-4 text-sm text-ink-subtle">No courses in {appName} yet. Create one with &quot;New course&quot; in the sidebar.</li>}
                  {courses.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="truncate text-xs text-ink-subtle">{c.instructions.trim() || "No instructions"}</p>
                      </div>
                      <button type="button" onClick={() => onOpenCourse(c.id)} className="shrink-0 rounded-full border border-line-strong px-3 py-1 text-xs font-medium hover:bg-surface-300">Edit</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
