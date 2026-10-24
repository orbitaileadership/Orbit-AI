'use client';

import { useRef, useState } from 'react';
import { MATERIAL_TYPES, materialStatus, selectMaterials, type MaterialFile, type MaterialSort, type MaterialType } from '@/lib/courses/file-display';
import { FileTile } from './file-tile';
import { HubIcon } from './course-hub-icons';

/** One file library for course materials and assignment instructions. */
export function CourseFileBrowser<T extends MaterialFile>({
  files, uploading, busy, loading = false, title, description, searchLabel,
  assignment = false, onUpload, onOpen, onRemove,
}: {
  files: T[];
  uploading: string[];
  busy: boolean;
  loading?: boolean;
  title: string;
  description: string;
  searchLabel: string;
  assignment?: boolean;
  onUpload: (files: File[]) => void;
  onOpen: (id: string) => void;
  onRemove: (file: T) => void;
}) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<MaterialType>('all');
  const [sort, setSort] = useState<MaterialSort>('recent');
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const filtered = selectMaterials(files, query, type, sort);
  const disabled = busy || loading;
  const clear = () => { setQuery(''); setType('all'); search.current?.focus(); };

  return <section className={`hub-material-browser${over ? ' is-dragging' : ''}`} aria-label={title}
    onDragOver={event => { event.preventDefault(); if (!disabled && event.dataTransfer.types.includes('Files')) setOver(true); }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false); }}
    onDrop={event => { event.preventDefault(); setOver(false); if (!disabled && event.dataTransfer.files.length) { clear(); onUpload(Array.from(event.dataTransfer.files)); } }}>
    <input hidden multiple ref={input} type="file" aria-label={`Upload ${title.toLowerCase()}`} onChange={event => {
      const selected = Array.from(event.target.files ?? []); event.target.value = '';
      if (!disabled && selected.length) { clear(); onUpload(selected); }
    }} />
    <div className="hub-section-heading">
      <div><h2>{title}</h2><p>{description}</p></div>
      <button className="hub-primary" disabled={disabled} onClick={() => input.current?.click()}><HubIcon name="upload" size={17} />{assignment ? 'Add files' : 'Upload files'}</button>
    </div>
    <div className="hub-toolbar">
      <div className="hub-search"><HubIcon name="search" size={18} /><input ref={search} type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={event => setQuery(event.target.value)} />
        {query && <button aria-label={`Clear ${searchLabel.toLowerCase()}`} onClick={() => { setQuery(''); search.current?.focus(); }}><HubIcon name="close" size={16} /></button>}
      </div>
      <select className="hub-select" aria-label="File type" value={type} onChange={event => setType(event.target.value as MaterialType)}>{MATERIAL_TYPES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
      <select className="hub-select" aria-label="Sort files" value={sort} onChange={event => setSort(event.target.value as MaterialSort)}><option value="recent">Recently added</option><option value="name">Name A–Z</option><option value="type">File type</option></select>
      <div className="hub-toggle" role="group" aria-label="File view">{(['grid', 'list'] as const).map(layout => <button key={layout} aria-label={`${layout === 'grid' ? 'Grid' : 'List'} view`} aria-pressed={view === layout} onClick={() => setView(layout)}><HubIcon name={layout} size={17} /></button>)}</div>
    </div>
    {!loading && <div className="hub-file-summary"><span role="status">{filtered.length === files.length ? `${files.length} file${files.length === 1 ? '' : 's'}` : `${filtered.length} of ${files.length} files`}</span>{(query || type !== 'all') && <button className="hub-link" onClick={clear}>Clear filters</button>}</div>}
    {uploading.length > 0 && <div className="hub-upload-queue" role="status" aria-live="polite"><span className="hub-spinner" /><div><strong>Uploading and reading {uploading.length} file{uploading.length === 1 ? '' : 's'}…</strong><small>{uploading[0]}</small></div></div>}
    {loading ? <div role="status" aria-label="Loading files" className="hub-skeleton-grid">{[0, 1, 2].map(n => <div key={n} className="pending-line" />)}</div> : filtered.length > 0 ?
      <div className={`hub-files hub-files-${view}`}>{filtered.map(file => <div key={file.id} className={`hub-file${file.status === 'failed' ? ' hub-file-failed' : ''}`}>
        <button className="hub-file-open" disabled={busy} onClick={() => onOpen(file.id)} title={`Open ${file.name}`}><FileTile name={file.name} kind={file.kind} /><span className="hub-grow"><strong>{file.name}</strong><small>{materialStatus(file)}</small></span><span className="hub-file-kind">{file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() : 'FILE'}</span></button>
        {file.retained_for_course ? <span className="hub-label" title="Retained as evidence for reviewed course details">Course source</span> : <button className="hub-icon-button" disabled={busy} aria-label={`${assignment ? 'Remove' : 'Delete'} ${file.name}`} onClick={() => onRemove(file)}><HubIcon name="trash" size={17} /></button>}
      </div>)}</div> : files.length > 0 ? <div className="hub-empty"><span className="hub-empty-icon"><HubIcon name="search" size={28} /></span><h3>No matching files</h3><p>Try a different name or file type.</p><button className="hub-button" onClick={clear}>Reset file filters</button></div> : null}
    {!loading && <button className={`hub-file-drop${files.length ? ' is-compact' : ''}`} disabled={disabled} onClick={() => input.current?.click()}>
      <span className="hub-action-icon"><HubIcon name="upload" size={22} /></span><span><strong>{over ? 'Drop to upload' : files.length ? 'Drop more files here' : assignment ? 'Drop the assignment instructions here' : 'Add your course materials'}</strong><small>{files.length ? 'or choose files from your device' : assignment ? 'Instructions, rubrics, starter files, and readings' : 'Lecture notes, slides, readings, and images'}</small></span><HubIcon name="plus" size={18} />
    </button>}
    <p className="hub-footnote">AI uses relevant excerpts within context limits. Scanned pages and images may not be available in every mode.</p>
  </section>;
}
