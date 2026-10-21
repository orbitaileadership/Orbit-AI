'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Course, CourseFile, CourseItem, CourseLaunch } from '@/lib/courses/types';
import { uploadFile } from '@/lib/files/upload-client';
import { THEMES } from '@/config/themes';
import { isProvider } from '@/config/models';
import { ProviderLogo } from './provider-logo';
import { OrbitGlyph } from './app-rail';

type Folder = { id: string; name: string };
type FolderFile = { id: string; name: string; status: string; kind?: string; mime?: string; page_count?: number | null };
type FolderChat = { id: string; title: string; provider: string | null; orbit_mode: boolean; updated_at?: string };

async function call(path: string, method = 'GET') {
  const r = await fetch(path, { method });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error === 'course_changed' ? 'This course changed in another window. Reload courses and try again.' : 'Could not load this assignment workspace. Please try again.');
  return data;
}

/** File-type tile: extension label on a colour that tells PDFs, documents, slides, sheets and images apart. */
export function FileTile({ name, kind, size = 40 }: { name: string; kind?: string; size?: number }) {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  const type = kind === 'image' || /^(png|jpe?g|gif|webp|heic)$/.test(ext) ? 'img' : ext === 'pdf' ? 'pdf' : /^(docx?|odt|rtf|txt|md)$/.test(ext) ? 'doc' : /^(pptx?|key|odp)$/.test(ext) ? 'ppt' : /^(xlsx?|csv|tsv|ods)$/.test(ext) ? 'xls' : 'other';
  return (
    <span aria-hidden className={`ft ft-${type} grid shrink-0 place-items-center rounded-xl font-semibold uppercase`} style={{ width: size, height: size, fontSize: Math.max(9, size * 0.24) }}>
      {type === 'img' ? 'IMG' : (ext || 'file').slice(0, 4)}
    </span>
  );
}

/**
 * An assignment's own workspace inside the course — "Drive meets chat": drop the instructions and any related files,
 * see the course files the AI also reads, and start or reopen this assignment's chats in Orbit or any of the four AIs.
 * The folder is created on first upload or chat, never by just looking.
 */
export function AssignmentWorkspace({ course, item, userId, ai, courseFiles, openFile, onLaunch, onCourse }: {
  course: Course; item: CourseItem; userId: string; ai: string; courseFiles: CourseFile[];
  openFile: (id: string) => void; onLaunch: (launch: CourseLaunch) => void; onCourse: (course: Course) => void;
}) {
  const [folder, setFolder] = useState<Folder | null>(null);
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [chats, setChats] = useState<FolderChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const base = `/api/courses/${course.id}/assignments/${item.id}`;

  const apply = useCallback((d: { folder: Folder | null; files: FolderFile[]; chats: FolderChat[]; course?: Course }) => {
    setFolder(d.folder); setFiles(d.files); setChats(d.chats);
    if (d.course) onCourse(d.course);
  }, [onCourse]);

  useEffect(() => {
    let alive = true;
    call(base).then(d => { if (alive) { apply(d); setLoading(false); } }).catch(e => { if (alive) { setError(e.message); setLoading(false); } });
    return () => { alive = false; };
  }, [base, apply]);

  async function ensure(): Promise<Folder> {
    if (folder) return folder;
    const d = await call(base, 'POST');
    apply(d);
    return d.folder;
  }
  async function upload(list: File[]) {
    if (!list.length) return;
    setError(''); setUploading(list.map(f => f.name));
    try {
      const f = await ensure();
      let added = 0;
      for (const file of list) {
        const out = await uploadFile(file, userId, f.id);
        setUploading(u => u.filter(n => n !== file.name));
        if (!('id' in out)) { setError(`${file.name}: ${out.error}`); continue; }
        setFiles(old => [{ id: out.id, name: out.name, status: out.status, kind: out.kind, mime: out.mime, page_count: out.pageCount }, ...old]);
        added++;
      }
      if (added) window.dispatchEvent(new CustomEvent('orbit:folders-changed', { detail: { filesFor: f.id } }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Please try again.'); }
    finally { setUploading([]); }
  }
  async function remove(file: FolderFile) {
    if (!window.confirm(`Remove ${file.name} from this assignment?`)) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      setFiles(old => old.filter(f => f.id !== file.id));
    } catch { setError('Could not remove that file. Please try again.'); }
    finally { setBusy(false); }
  }
  async function startChat() {
    setBusy(true); setError('');
    try {
      const f = await ensure();
      const hasFiles = files.length > 0;
      onLaunch({ course, item, folder: f, provider: ai, prompt: hasFiles ? `Help me get started on ${item.title}. Use the assignment files and the course materials.` : `Help me get started on ${item.title}.` });
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  const aiName = ai === 'orbit' ? 'Orbit' : isProvider(ai) ? THEMES[ai].appName : 'AI';
  const others = courseFiles.filter(f => f.project_id === course.id);
  const card = 'group relative flex items-center gap-3 rounded-2xl border border-line bg-surface-100 p-3 text-left transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-composer';

  return (
    <div className="mt-8 space-y-8"
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={e => { if (e.currentTarget === e.target) setOver(false); }}
      onDrop={e => { e.preventDefault(); setOver(false); void upload(Array.from(e.dataTransfer.files)); }}>
      <input ref={input} type="file" multiple hidden onChange={e => { const list = Array.from(e.target.files ?? []); e.target.value = ''; void upload(list); }} />
      {error && <p role="alert" className="rounded-xl border border-line bg-surface-100 p-3 text-sm">{error}</p>}

      {/* Chats */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-medium">Chats</h3>
          <button disabled={busy || loading} onClick={startChat} className="orbit-send flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50">
            {ai === 'orbit' ? <OrbitGlyph size={16} /> : isProvider(ai) ? <span className="grid h-5 w-5 place-items-center rounded-full bg-white"><ProviderLogo provider={ai} size={13} /></span> : null}
            New chat with {aiName}
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {chats.map(c => (
            <button key={c.id} className={card} onClick={() => folder && onLaunch({ course, item, folder, provider: c.orbit_mode ? 'orbit' : c.provider ?? 'openai', conversationId: c.id, prompt: '' })}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-200">
                {c.orbit_mode ? <OrbitGlyph size={18} /> : isProvider(c.provider) ? <ProviderLogo provider={c.provider} size={18} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.title || 'Untitled chat'}</span>
                <span className="block text-xs text-ink-subtle">{c.orbit_mode ? 'Orbit' : isProvider(c.provider) ? THEMES[c.provider].appName : 'Chat'}{c.updated_at ? ` · ${new Date(c.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</span>
              </span>
              <span aria-hidden className="text-ink-subtle transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          ))}
        </div>
        {!loading && !chats.length && <p className="mt-3 text-sm text-ink-muted">No chats for this assignment yet. Every chat you start here can read the assignment files below and the course syllabus and notes.</p>}
      </section>

      {/* Assignment files */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-medium">Assignment files</h3>
          <button disabled={busy || loading} onClick={() => input.current?.click()} className="rounded-full border border-line px-3.5 py-2 text-sm transition hover:bg-surface-200 disabled:opacity-50">＋ Add files</button>
        </div>
        {loading ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(n => <div key={n} className="pending-line h-16 rounded-2xl" />)}</div>
        ) : files.length || uploading.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {uploading.map(n => (
              <div key={`u-${n}`} className={`${card} opacity-70`}><FileTile name={n} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{n}</span><span className="orbit-shimmer block text-xs">Uploading and reading…</span></span></div>
            ))}
            {files.map(f => (
              <div key={f.id} className={card}>
                <button onClick={() => openFile(f.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" title={`Open ${f.name}`}>
                  <FileTile name={f.name} kind={f.kind} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{f.name}</span>
                    <span className={`block text-xs ${f.status === 'failed' ? 'text-danger' : 'text-ink-subtle'}`}>{f.status === 'failed' ? 'Could not be read' : f.status === 'needs_ocr' ? 'Scanned · read as page images' : f.page_count ? `${f.page_count} page${f.page_count === 1 ? '' : 's'}` : 'Ready'}</span>
                  </span>
                </button>
                <button disabled={busy} onClick={() => remove(f)} aria-label={`Remove ${f.name}`} title="Remove"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-subtle transition hover:bg-surface-200 hover:text-danger focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.6 9h4.8L11 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button onClick={() => input.current?.click()} disabled={busy}
            className={`mt-3 flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed px-6 py-9 text-center transition ${over ? 'border-brand bg-info-surface' : 'border-line-strong hover:border-brand hover:bg-surface-100'}`}>
            <span className="orbit-send grid h-11 w-11 place-items-center rounded-2xl text-white"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <span className="font-medium">Drop the assignment instructions here</span>
            <span className="max-w-md text-sm text-ink-muted">Instructions, rubrics, starter files, readings — PDF, Word, slides, spreadsheets or images. Chats for this assignment use them as context.</span>
          </button>
        )}
        {over && (files.length > 0 || uploading.length > 0) && <p className="mt-2 text-center text-sm text-brand">Drop to add to this assignment</p>}
      </section>

      {/* Course files the AI also reads */}
      {others.length > 0 && (
        <section>
          <h3 className="text-lg font-medium">From the course</h3>
          <p className="mt-1 text-sm text-ink-muted">Chats for this assignment can also quote these.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {others.map(f => (
              <button key={f.id} onClick={() => openFile(f.id)} className={card} title={`Open ${f.name}`}>
                <FileTile name={f.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.name}</span>
                  <span className="block text-xs text-ink-subtle">{f.id === course.syllabus_id ? 'Syllabus' : 'Course notes'}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
