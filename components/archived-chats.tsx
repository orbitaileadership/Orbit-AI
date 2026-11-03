"use client";

import { useEffect, useRef, useState } from "react";
import { matchChats } from "./search-chats";

export type ArchivedChat = { id: string; title: string; modelId: string; projectId: string | null; sectionFolderId?: string | null; updatedAt: string };
// Mount once per opening/provider so searches and pending loads cannot leak across apps.
export function ArchivedChats({ provider, onClose, onRestored }: { provider: string; onClose: () => void; onRestored: (chat: ArchivedChat) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [chats, setChats] = useState<ArchivedChat[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
    const controller = new AbortController();
    fetch(`/api/conversations?provider=${provider}&archived=true`, { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!controller.signal.aborted) { setChats(data.conversations); setMore(data.conversations.length === 200); }
    }).catch(() => { if (!controller.signal.aborted) setStatus("Could not load archived chats. Close and reopen to try again."); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [provider]);
  async function loadMore() {
    setBusy(true); setStatus("");
    try {
      const res = await fetch(`/api/conversations?provider=${provider}&archived=true&offset=${chats.length}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChats(prev => [...prev, ...data.conversations]); setMore(data.conversations.length === 200);
    } catch { setStatus("Could not load more chats. Try again."); }
    finally { setBusy(false); }
  }
  async function restore(chat: ArchivedChat) {
    setRestoring(chat.id); setStatus("");
    try {
      const res = await fetch(`/api/conversations/${chat.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: false }) });
      if (!res.ok) throw new Error();
      const result = await res.json();
      setChats(prev => prev.filter(c => c.id !== chat.id)); onRestored({ ...chat, updatedAt: result.updatedAt ?? chat.updatedAt }); setStatus("Chat restored to your chat list.");
    } catch { setStatus("Could not restore this chat. Try again."); }
    finally { setRestoring(null); }
  }
  const hits = matchChats(chats, query);
  return <dialog ref={ref} onClose={onClose} onClick={e => e.target === ref.current && onClose()} aria-labelledby="archived-title" className="m-auto w-[min(94vw,640px)] rounded-3xl border border-line bg-composer p-5 text-ink shadow-menu backdrop:bg-black/50">
    <div className="flex items-center justify-between gap-3"><h2 id="archived-title" className="text-lg font-medium">Archived chats</h2><button onClick={onClose} aria-label="Close archived chats" className="rounded-lg px-3 py-2 hover:bg-surface-200">✕</button></div>
    <p className="mt-2 text-sm text-ink-muted">Restore a chat to continue where you left off. Its messages and attachments stay saved.</p>
    <input aria-label="Search archived chats" placeholder="Search archived chats…" value={query} onChange={e => setQuery(e.target.value)} className="mt-4 w-full rounded-xl border border-line-strong bg-surface-000 p-3 text-sm" />
    <ul className="mt-3 max-h-[50dvh] divide-y divide-line overflow-y-auto">
      {hits.map(c => <li key={c.id} className="flex items-center gap-3 py-3"><span className="min-w-0 flex-1 break-words text-sm">{c.title || "Untitled"}</span><button disabled={restoring !== null || busy} onClick={() => restore(chats.find(chat => chat.id === c.id)!)} aria-label={`Restore ${c.title || "chat"}`} className="shrink-0 rounded-full border border-line-strong px-3 py-2 text-sm hover:bg-surface-200 disabled:opacity-60">{restoring === c.id ? "Restoring…" : "Restore"}</button></li>)}
    </ul>
    {!busy && !hits.length && <p className="py-5 text-sm text-ink-subtle">{query ? "No loaded chats match your search." : "No archived chats."}</p>}
    {more && <button disabled={busy || restoring !== null} onClick={loadMore} className="mt-3 rounded-full border border-line-strong px-4 py-2 text-sm disabled:opacity-60">Load more archived chats</button>}
    {busy && <p role="status" className="mt-3 text-sm">Loading archived chats…</p>}
    {status && <p role="status" className="mt-3 text-sm text-ink-muted">{status}</p>}
  </dialog>;
}
