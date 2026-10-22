"use client";

import { useEffect, useRef, useState } from "react";

type Folder = { id: string; name: string };

/** The "⋯" menu on a chat in the sidebar, as in ChatGPT and Claude: rename, move to a folder, delete. */
export function ChatRowMenu({ title, folders, folderId, onRename, onMove, onDelete }: {
  title: string;
  folders: Folder[];
  folderId: string | null;
  onRename: () => void;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const close = () => { setOpen(false); setMoving(false); };
  const row = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-200";

  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); setMoving(false); }} aria-haspopup="menu" aria-expanded={open} aria-label={`Options for ${title}`} title="More"
        className={`grid h-7 w-7 place-items-center rounded-md text-ink-subtle transition hover:text-ink focus-visible:opacity-100 md:group-hover:opacity-100 ${open ? "text-ink md:opacity-100" : "md:opacity-0"}`}>
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden><circle cx="3.5" cy="8" r="1.2" fill="currentColor" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="12.5" cy="8" r="1.2" fill="currentColor" /></svg>
      </button>
      {open && (
        <div role="menu" className="model-menu absolute right-0 top-full z-40 mt-1 w-52 origin-top-right rounded-xl border border-line bg-composer p-1 shadow-menu">
          {moving ? (
            <>
              <button type="button" role="menuitem" onClick={() => setMoving(false)} className={`${row} text-ink-muted`}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M10 4L6 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Move to folder
              </button>
              <div className="my-1 border-t border-line" />
              <div className="max-h-56 overflow-y-auto">
                {folders.map((f) => (
                  <button key={f.id} type="button" role="menuitemradio" aria-checked={f.id === folderId} onClick={() => { onMove(f.id); close(); }} className={row}>
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    {f.id === folderId && <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                ))}
                {folderId && <button type="button" role="menuitem" onClick={() => { onMove(null); close(); }} className={`${row} text-ink-muted`}>Remove from folder</button>}
              </div>
            </>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => { onRename(); close(); }} className={row}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M10.5 2.5l3 3L6 13H3v-3z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                Rename
              </button>
              {folders.length > 0 && (
                <button type="button" role="menuitem" aria-haspopup="menu" onClick={() => setMoving(true)} className={row}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
                  <span className="flex-1">Move to folder</span>
                  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="text-ink-subtle"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )}
              <div className="my-1 border-t border-line" />
              <button type="button" role="menuitem" onClick={() => { onDelete(); close(); }} className={`${row} text-danger hover:bg-danger-surface`}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.6 9h4.8L11 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
