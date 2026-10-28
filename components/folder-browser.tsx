'use client';

import { useEffect, useRef, useState } from 'react';
import { folderSections, type Folder } from '@/lib/folders/types';
import { uploadFile, type UploadedFile } from '@/lib/files/upload-client';
import { ProjectDialog } from './project-dialog';
import { DocumentPreview } from './document-preview';
import { FolderIcon, PlusIcon, SectionAction, SidebarSection } from './sidebar-section';

type CourseOption = { id: string; name: string };
async function request(path: string, body?: object, method = 'POST') {
  const response = await fetch(path, body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error === 'db_setup' ? 'Folders are not available in this environment yet. Please contact the Orbit team.' : data.message ?? 'Could not load or save folders. Please try again.');
  return data;
}
export function FolderBrowser({ userId, courseId, standaloneOnly = false, active = true, disabled = false, onOpen }: {
  userId: string; courseId?: string; standaloneOnly?: boolean; active?: boolean; disabled?: boolean; onOpen: (folder: Folder) => void;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [editing, setEditing] = useState<Folder | null | undefined>(undefined);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const dialogVersion = useRef(0);
  useEffect(() => {
    const refresh = () => setRevision(v => v + 1);
    window.addEventListener('orbit:folders-changed', refresh);
    return () => window.removeEventListener('orbit:folders-changed', refresh);
  }, []);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    Promise.all([request(`/api/projects${courseId ? `?courseId=${courseId}` : ''}`), request('/api/courses')])
      .then(([data, options]) => { if (!cancelled) { setFolders(data.projects); setCourses(options.courses); setError(''); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [active, courseId, revision]);
  const changed = (detail: { deletedId?: string; filesFor?: string } = {}) => window.dispatchEvent(new CustomEvent('orbit:folders-changed', { detail }));
  async function act(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }
  async function settings(folder: Folder) {
    const version = ++dialogVersion.current;
    setFiles([]); setEditing(folder);
    await act(async () => {
      const data = await request(`/api/files?projectId=${folder.id}`);
      if (dialogVersion.current === version) setFiles(data.files);
    });
  }
  const shownFolders = standaloneOnly ? folders.filter(f => !f.parent_course_id) : folders;
  const sections = folderSections(shownFolders);
  const create = () => { setFiles([]); setEditing(null); };
  const open = (folder: Folder) => act(async () => { const data = await request(`/api/projects/${folder.id}`, { opened: true }, 'PATCH'); changed(); onOpen(data.project); });
  const row = (folder: Folder) => {
    const pinned = Boolean(folder.pinned_at);
    return <div key={folder.id} className="group/row flex items-center rounded-xl transition-colors hover:bg-surface-200">
      <button disabled={busy || disabled} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left text-[15px]" onClick={() => open(folder)}>
        <span className={pinned ? 'text-brand' : 'text-ink-muted'}><FolderIcon filled={pinned} /></span>
        <span className="truncate">{folder.name}</span>
      </button>
      <button disabled={busy || disabled} aria-label={`${pinned ? 'Unpin' : 'Pin'} ${folder.name}`} title={pinned ? 'Unpin' : 'Pin to top'}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition hover:bg-surface-300 hover:text-ink ${pinned ? 'text-brand' : 'text-ink-subtle md:opacity-0 md:group-hover/row:opacity-100'}`}
        onClick={() => act(async () => { await request(`/api/projects/${folder.id}`, { pinned: !pinned }, 'PATCH'); changed(); })}>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden><path d="M9.8 2.2l4 4-2.1.7-2.3 2.3.3 3-1.1 1.1-2.4-2.4L3 14.1 1.9 13l3.2-3.2-2.4-2.4 1.1-1.1 3 .3 2.3-2.3z" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
      </button>
      <button disabled={busy || disabled} aria-label={`${folder.name} settings and files`} title="Settings and files"
        className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-subtle transition hover:bg-surface-300 hover:text-ink md:opacity-0 md:group-hover/row:opacity-100"
        onClick={() => settings(folder)}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><circle cx="3.5" cy="8" r="1.2" fill="currentColor" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="12.5" cy="8" r="1.2" fill="currentColor" /></svg>
      </button>
    </div>;
  };
  return <><SidebarSection title={courseId ? 'Course folders' : 'Folders'} storageKey={courseId ? 'course-folders' : 'folders'}
    action={<SectionAction label="New folder" onClick={create} disabled={busy || disabled}><PlusIcon /></SectionAction>}>
    <div aria-label={courseId ? 'Course folders' : 'Folders'} className="space-y-0.5">
      {error && <p role="alert" className="mx-3 my-1 text-xs text-danger">{error} <button className="underline" onClick={() => setRevision(v => v + 1)}>Retry</button></p>}
      {loading && [0, 1].map(n => <div key={n} className="mx-3 my-2 flex items-center gap-3"><span className="pending-line h-4 w-4 rounded" /><span className="pending-line h-3 flex-1 rounded-full" /></div>)}
      {sections.pinned.map(row)}
      {sections.pinned.length > 0 && sections.recent.length > 0 && <div className="mx-3 my-1.5 border-t border-line" />}
      {sections.recent.map(row)}
      {!shownFolders.length && !loading && <button disabled={busy || disabled} className="group/new flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] text-ink-muted transition hover:bg-surface-200 hover:text-ink" onClick={create}>
        <span className="relative"><FolderIcon /><span className="absolute -bottom-1 -right-1 grid h-2.5 w-2.5 place-items-center rounded-full bg-surface-100 text-[10px] leading-none">+</span></span>
        New folder
      </button>}
    </div>
    <ProjectDialog open={editing !== undefined} initial={editing ?? undefined} courses={courses} defaultCourseId={courseId}
      files={files} uploading={uploading} error={error} onClose={() => { dialogVersion.current++; setEditing(undefined); }}
      onSave={async value => act(async () => { await request(editing ? `/api/projects/${editing.id}` : '/api/projects', value, editing ? 'PATCH' : 'POST'); setEditing(undefined); changed(); })}
      onDelete={editing ? () => act(async () => { await request(`/api/projects/${editing.id}`, {}, 'DELETE'); changed({ deletedId: editing.id }); setEditing(undefined); }) : undefined}
      onUpload={editing ? list => { const folder = editing; void act(async () => {
        setUploading(list.map(f => f.name));
        try { for (const file of list) { const out = await uploadFile(file, userId, folder.id); if (!('id' in out)) throw new Error(out.error); setFiles(old => [out, ...old]); changed({ filesFor: folder.id }); } }
        finally { setUploading([]); }
      }); } : undefined}
      onDeleteFile={editing ? id => { void act(async () => { await request(`/api/files/${id}`, {}, 'DELETE'); setFiles(old => old.filter(f => f.id !== id)); changed({ filesFor: editing.id }); }); } : undefined}
      onOpenFile={id => setPreviewFileId(id)}/>
  </SidebarSection><DocumentPreview fileId={previewFileId} onClose={() => setPreviewFileId(null)} /></>;
}
