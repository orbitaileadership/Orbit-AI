'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Course, CourseFile, CourseItem, CourseLaunch } from '@/lib/courses/types';
import { uploadFile } from '@/lib/files/upload-client';
import { THEMES } from '@/config/themes';
import { isProvider } from '@/config/models';
import { ProviderLogo } from './provider-logo';
import { OrbitGlyph } from './app-rail';
import { FileTile } from './file-tile';
import { CourseFileBrowser } from './course-file-browser';

type Folder = { id: string; name: string };
type FolderFile = { id: string; name: string; status: string; kind?: string; mime?: string; page_count?: number | null };
type FolderChat = { id: string; title: string; provider: string | null; orbit_mode: boolean; updated_at?: string };

async function call(path: string, method = 'GET') {
  const r = await fetch(path, { method });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error === 'course_changed' ? 'This course changed in another window. Reload courses and try again.' : 'Could not load this assignment workspace. Please try again.');
  return data;
}

/**
 * An assignment's own workspace inside the course — "Drive meets chat": drop the instructions and any related files,
 * see the course files the AI also reads, and start or reopen this assignment's chats in Orbit or any of the four AIs.
 * The folder is created on first upload or chat, never by just looking.
 */
export function AssignmentWorkspace({ course, item, userId, ai, courseFiles, openFile, onLaunch, onCourse, active = true }: {
  active?: boolean;
  course: Course; item: CourseItem; userId: string; ai: string; courseFiles: CourseFile[];
  openFile: (id: string) => void; onLaunch: (launch: CourseLaunch) => void; onCourse: (course: Course) => void;
}) {
  const [folder, setFolder] = useState<Folder | null>(null);
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [chats, setChats] = useState<FolderChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const working = useRef(false);
  const base = `/api/courses/${course.id}/assignments/${item.id}`;

  const apply = useCallback((d: { folder: Folder | null; files: FolderFile[]; chats: FolderChat[]; course?: Course }) => {
    setFolder(d.folder); setFiles(d.files); setChats(d.chats);
    if (d.course) onCourse(d.course);
  }, [onCourse]);

  useEffect(() => {
    if (!active || busy) return;
    let alive = true;
    // A response captured before an upload/delete must never replace its newer results.
    call(base).then(d => { if (alive && !working.current) { apply(d); setLoading(false); } }).catch(e => { if (alive && !working.current) { setError(e.message); setLoading(false); } });
    return () => { alive = false; };
  }, [base, apply, active, revision, busy]);

  async function ensure(): Promise<Folder> {
    if (folder) return folder;
    const d = await call(base, 'POST');
    apply(d);
    return d.folder;
  }
  async function upload(list: File[]) {
    if (!list.length || working.current || loading) return;
    working.current = true; setBusy(true);
    setError(''); setUploading(list.map(f => f.name));
    try {
      const f = await ensure();
      let added = 0;
      const failures: string[] = [];
      for (let n = 0; n < list.length; n++) {
        const file = list[n];
        try {
          const out = await uploadFile(file, userId, f.id);
          if (!('id' in out)) failures.push(`${file.name}: ${out.error}`);
          else { setFiles(old => [{ id: out.id, name: out.name, status: out.status, kind: out.kind, mime: out.mime, page_count: out.pageCount }, ...old]); added++; }
        } catch { failures.push(`${file.name}: Upload failed. Please try again.`); }
        setUploading(list.slice(n + 1).map(file => file.name));
      }
      if (failures.length) setError(failures.join(' • '));
      if (added) window.dispatchEvent(new CustomEvent('orbit:folders-changed', { detail: { filesFor: f.id } }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Please try again.'); }
    finally { setUploading([]); working.current = false; setBusy(false); }
  }
  async function remove(file: FolderFile) {
    if (working.current) return;
    if (!window.confirm(`Remove ${file.name} from this assignment?`)) return;
    working.current = true;
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      setFiles(old => old.filter(f => f.id !== file.id));
      window.dispatchEvent(new CustomEvent('orbit:folders-changed', { detail: { filesFor: folder?.id } }));
    } catch { setError('Could not remove that file. Please try again.'); }
    finally { working.current = false; setBusy(false); }
  }
  async function startChat() {
    if (working.current) return;
    working.current = true;
    setBusy(true); setError('');
    try {
      const f = await ensure();
      const hasFiles = files.length > 0;
      onLaunch({ course, item, folder: f, provider: ai, prompt: hasFiles ? `Help me get started on ${item.title}. Use the assignment files and the course materials.` : `Help me get started on ${item.title}.` });
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { working.current = false; setBusy(false); }
  }

  const aiName = ai === 'orbit' ? 'Orbit' : isProvider(ai) ? THEMES[ai].appName : 'AI';
  const others = courseFiles.filter(f => f.project_id === course.id);
  const card = 'min-w-0 w-full max-w-full group relative flex items-center gap-3 rounded-2xl border border-line bg-surface-100 p-3 text-left transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-composer';

  return (
    <div className="mt-8 space-y-8">
      {error && <div role="alert" className="rounded-xl border border-line bg-surface-100 p-3 text-sm">{error} <button className="underline" disabled={busy} onClick={() => { setError(''); setRevision(v => v + 1); }}>Reload workspace</button></div>}

      <CourseFileBrowser
        title="Section resources" description="Keep the instructions, rubric, and supporting work together."
        searchLabel="Search section resources" assignment files={files} uploading={uploading}
        busy={busy} loading={loading} onUpload={list => void upload(list)}
        onOpen={openFile} onRemove={file => void remove(file)}
      />
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
        {!loading && !chats.length && <p className="mt-3 text-sm text-ink-muted">Start a conversation using relevant excerpts from the assignment files and course syllabus and notes. Materials stay here when you switch assistants.</p>}
      </section>

      {/* Course files the AI also reads */}
      {others.length > 0 && (
        <section>
          <h3 className="text-lg font-medium">From the course</h3>
          <p className="mt-1 text-sm text-ink-muted">Chats for this section can also quote these.</p>
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
