"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

/**
 * A titled, collapsible group in the chat sidebar ("Folders", "Recents"), styled like the apps' own
 * section headings: small muted label, chevron that turns, an optional action that shows on hover.
 * The open/closed choice is remembered per section in this browser.
 */
export function SidebarSection({ title, storageKey, action, actionVisible = false, children }: {
  actionVisible?: boolean; // keep the action shown (e.g. "Show all" while a filter is on)
  title: ReactNode;
  storageKey: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const key = `orbit.sidebar.section.${storageKey}`;
  useEffect(() => {
    try { if (localStorage.getItem(key) === "closed") setOpen(false); } catch {} // eslint-disable-line react-hooks/set-state-in-effect
  }, [key]);
  const toggle = () => setOpen(o => {
    try { localStorage.setItem(key, o ? "closed" : "open"); } catch {}
    return !o;
  });
  return (
    <section className="mt-4">
      <div className="group/section flex h-8 items-center gap-1 pl-3 pr-1">
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={id}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-medium text-ink-subtle transition hover:text-ink-muted">
          <span className="truncate">{title}</span>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden className={`shrink-0 transition duration-200 ${open ? "md:opacity-0 md:group-hover/section:opacity-100" : "-rotate-90"}`}>
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {action && <span className={`flex shrink-0 items-center transition ${actionVisible ? "" : "md:opacity-0 md:group-hover/section:opacity-100 md:focus-within:opacity-100"}`}>{action}</span>}
      </div>
      <div id={id} className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </section>
  );
}

/** Small round icon button used for section actions (e.g. "New folder"). */
export function SectionAction({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted transition hover:bg-surface-300 hover:text-ink disabled:opacity-40">
      {children}
    </button>
  );
}

export const PlusIcon = () => <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
export const FolderIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden className="shrink-0">
    <path d="M2.75 6A1.75 1.75 0 0 1 4.5 4.25h3.1l1.6 1.6h6.3A1.75 1.75 0 0 1 17.25 7.6v6.65A1.75 1.75 0 0 1 15.5 16h-11a1.75 1.75 0 0 1-1.75-1.75z"
      fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 0.15 : undefined} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
