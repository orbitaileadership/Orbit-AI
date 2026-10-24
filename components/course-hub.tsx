'use client';

import { useState, type ReactNode } from 'react';
import type { Course, CourseChat, CourseFile, CourseItem, CourseLaunch } from '@/lib/courses/types';
import { isProvider, PROVIDERS } from '@/config/models';
import { THEMES } from '@/config/themes';
import { CourseBadge, DateTile, ProgressBar, StatusPill, courseColor, courseProgress, daysUntil, dueLabel, groupByDue } from './course-ui';
import { AssignmentWorkspace } from './assignment-workspace';
import { HubIcon, type IconName } from './course-hub-icons';
import { CourseFileBrowser } from './course-file-browser';
import { FolderBrowser } from './folder-browser';
import { OrbitGlyph } from './app-rail';
import { Wordmark } from './brand';
import { ProviderLogo } from './provider-logo';
import './course-hub.css';

export function HubEmpty({ icon = 'book', title, children, action }: { icon?: IconName; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="hub-empty"><span className="hub-empty-icon"><HubIcon name={icon} size={28} /></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}
function Search({ value, onChange, label }: { value: string; onChange: (s: string) => void; label: string }) {
  return <label className="hub-search"><HubIcon name="search" size={18} /><input aria-label={label} placeholder={label} value={value} onChange={e => onChange(e.target.value)} />{value && <button type="button" onClick={() => onChange('')} aria-label={`Clear ${label.toLowerCase()}`}><HubIcon name="close" size={16} /></button>}</label>;
}
function ViewToggle({ value, onChange }: { value: 'grid' | 'list'; onChange: (v: 'grid' | 'list') => void }) {
  return <div className="hub-toggle" aria-label="View layout">{(['grid', 'list'] as const).map(v => <button key={v} type="button" aria-label={`${v === 'grid' ? 'Grid' : 'List'} view`} aria-pressed={value === v} onClick={() => onChange(v)}><HubIcon name={v} size={17} /></button>)}</div>;
}
function AiMark({ provider }: { provider: string }) {
  return provider === 'orbit' ? <OrbitGlyph size={19} /> : isProvider(provider) ? <ProviderLogo provider={provider} size={19} /> : <HubIcon name="chat" size={19} />;
}
function AiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <label className="hub-ai"><AiMark provider={value} /><span className="sr-only">Ask with</span><select aria-label="Ask with" value={value} onChange={e => onChange(e.target.value)}><option value="orbit">Orbit</option>{PROVIDERS.map(p => <option key={p} value={p}>{THEMES[p].appName}</option>)}</select></label>;
}

function TaskRow({ course, item, showCourse, onOpen }: { course: Course; item: CourseItem; showCourse?: boolean; onOpen: () => void }) {
  return <button type="button" className="hub-task" onClick={onOpen}><DateTile due={item.due} urgent={item.status !== 'done' && !!item.due && daysUntil(item.due) <= 1} /><span className="hub-grow"><strong>{item.title}</strong><small>{showCourse ? course.name : item.kind === 'exam' ? 'Exam' : 'Assignment'}{item.weight ? ` · ${item.weight}` : ''}</small></span><span className="hub-task-meta"><StatusPill status={item.status} /><small>{item.status === 'done' ? 'Completed' : dueLabel(item)}</small></span><HubIcon name="arrow" size={16} /></button>;
}

function CourseChats({ chats, onOpen, onNew }: { chats: CourseChat[]; onOpen: (c: CourseChat) => void; onNew: () => void }) {
  const [query, setQuery] = useState('');
  const shown = chats.filter(c => (c.title || 'Untitled chat').toLowerCase().includes(query.toLowerCase()));
  return <section><div className="hub-section-heading"><div><h2>Course chats</h2><p>Resume a conversation with any of your assistants.</p></div><button className="hub-primary" onClick={onNew}><HubIcon name="plus" size={17} />New chat</button></div>
    {chats.length > 0 && <div className="hub-toolbar"><Search label="Search course chats" value={query} onChange={setQuery} /></div>}
    {shown.length ? <div className="hub-chat-list">{shown.map(c => <button className="hub-chat-row" key={c.id} onClick={() => onOpen(c)}><span className="hub-chat-icon"><AiMark provider={c.orbit_mode ? 'orbit' : c.provider} /></span><span className="hub-grow"><strong>{c.title || 'Untitled chat'}</strong><small>{c.orbit_mode ? 'Orbit' : isProvider(c.provider) ? THEMES[c.provider].appName : 'AI'} · Course conversation</small></span><HubIcon name="arrow" size={17} /></button>)}</div> : <HubEmpty icon="chat" title={query ? 'No matching chats' : 'Your next question starts here'}>{query ? 'Try a different search.' : 'Start a conversation about your course. Assignment conversations live in their assignment workspace.'}</HubEmpty>}
  </section>;
}

function StudySetup({ course, files, onStart, onMaterials }: { course: Course; files: CourseFile[]; onStart: (prompt: string) => void; onMaterials: () => void }) {
  const [mode, setMode] = useState('recall'), [topic, setTopic] = useState(''), [duration, setDuration] = useState('15');
  const modes = [
    { id: 'recall', icon: 'spark' as const, title: 'Active recall', detail: 'Practice one question at a time, with feedback.', prompt: 'Quiz me one question at a time. Wait for my answer before explaining it. Cite the course source when available and explain misconceptions.' },
    { id: 'guided', icon: 'book' as const, title: 'Work through a problem', detail: 'Build understanding with hints and clear steps.', prompt: 'Guide me through a practice problem. Start with a question to assess my understanding, offer hints, and wait for my attempt before revealing the solution.' },
    { id: 'exam', icon: 'calendar' as const, title: 'Prepare for an exam', detail: 'Focus a review on topics that matter to you.', prompt: 'Help me prepare for an exam using my course materials and confirmed exam requirements. Ask what I find difficult, outline a focused review, then practice one question at a time.' },
  ];
  const selected = modes.find(m => m.id === mode)!;
  return <section><div className="hub-section-heading"><div><h2>A little practice. A lot of progress.</h2><p>Set up a study conversation, then learn at your own pace.</p></div><span className="hub-label">Guided study</span></div>
    <div className="hub-study-modes">{modes.map(m => <button key={m.id} className="hub-study-mode" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}><span className="hub-action-icon"><HubIcon name={m.icon} size={23} /></span><strong>{m.title}</strong><small>{m.detail}</small><span className="hub-mode-check">{mode === m.id && <HubIcon name="check" size={15} />}</span></button>)}</div>
    <div className="hub-panel hub-study-form"><label>What would you like to focus on?<input className="hub-input" value={topic} maxLength={500} onChange={e => setTopic(e.target.value)} placeholder="e.g. Axial resolution, week 4, or my midterm" /></label>
      <label>Time available<select className="hub-input" value={duration} onChange={e => setDuration(e.target.value)}><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></label>
      <div className="hub-study-context"><HubIcon name="file" /><div><strong>{files.length ? `${files.length} course material${files.length === 1 ? '' : 's'} available` : 'Add materials for course-specific practice'}</strong><p>Relevant text is retrieved when you send your message. The AI should say when course evidence is missing.</p><button className="hub-link" onClick={onMaterials}>{files.length ? 'View materials' : 'Upload materials'} →</button></div></div>
      <div className="hub-study-submit"><p>Opens an editable prompt. AI work uses your allowance when you send it.</p><button className="hub-primary" onClick={() => onStart(`${selected.prompt}\n\nCourse: ${course.name}\nFocus: ${topic.trim() || 'Help me choose a topic from my course.'}\nTime available: ${duration} minutes.\nPrioritize the terminology and formulas in my course materials. Distinguish course evidence from general knowledge, and say when the available excerpts are insufficient.`)}>Prepare study chat<HubIcon name="arrow" size={17} /></button></div>
    </div>
  </section>;
}

type HubProps = {
  courses: Course[]; course: Course | null; files: CourseFile[]; chats: CourseChat[]; item: CourseItem | null;
  tab: string; ai: string; loading: boolean; detailLoading: boolean; detailError: boolean; busy: boolean; active: boolean; userId: string; uploading: string[];
  onPick: (id: string | null) => void; onTab: (tab: string) => void; onItem: (item: CourseItem | null) => void; onAi: (ai: string) => void;
  onChat: () => void; onLaunch: (launch: CourseLaunch) => void; onCreate: () => void; onImport: (course?: Course) => void; onEdit: (course: Course) => void;
  onUpload: (files: File[]) => void; onOpenFile: (id: string) => void; onRemoveFile: (file: CourseFile) => void; onSource: (id: string) => void;
  onStatus: (item: CourseItem, status: CourseItem['status']) => void; onCourse: (course: Course) => void; onRetryDetails: () => void;
};

export function CourseHub(p: HubProps) {
  const { courses, course, files, chats, item, tab, ai, busy } = p;
  const [view, setView] = useState<'home' | 'week' | 'library'>('home'), [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState(''), [term, setTerm] = useState('all'), [sort, setSort] = useState('updated'), [menu, setMenu] = useState(false);
  const [taskQuery, setTaskQuery] = useState(''), [status, setStatus] = useState('all');
  const items = course?.course_data?.items ?? [];
  const work = courses.flatMap(c => (c.course_data?.items ?? []).filter(i => i.kind !== 'topic' && i.status !== 'done').map(i => ({ c, i }))).sort((a, b) => (a.i.due ?? '9999').localeCompare(b.i.due ?? '9999'));
  const visibleCourses = courses.filter(c => (!query || `${c.name} ${c.course_data?.instructor ?? ''} ${c.course_data?.term ?? ''}`.toLowerCase().includes(query.toLowerCase())) && (term === 'all' || (c.course_data?.term || 'No term') === term)).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.updated_at.localeCompare(a.updated_at));
  const home = (next: typeof view) => { p.onPick(null); setView(next); setMenu(false); };
  const pick = (id: string) => { p.onPick(id); setMenu(false); setTaskQuery(''); setStatus('all'); };
  const openItem = (c: Course, i: CourseItem) => { if (course?.id !== c.id) pick(c.id); p.onItem(i); p.onTab('Assignments'); };
  const launch = (prompt: string) => course && p.onLaunch({ course, provider: ai, prompt });
  const openChat = (c: CourseChat) => course && p.onLaunch({ course, provider: c.orbit_mode ? 'orbit' : c.provider, conversationId: c.id, prompt: '' });
  const tabs: { label: string; icon: IconName }[] = [{ label: 'Overview', icon: 'home' }, { label: 'Assignments', icon: 'calendar' }, { label: 'Materials', icon: 'folder' }, { label: 'Chats', icon: 'chat' }, { label: 'Study', icon: 'spark' }, { label: 'Syllabus', icon: 'book' }];
  const task = (c: Course, i: CourseItem, showCourse = false) => <TaskRow key={`${c.id}-${i.id ?? i.title}`} course={c} item={i} showCourse={showCourse} onOpen={() => openItem(c, i)} />;
  const cards = (list: Course[]) => <div className={`hub-course-cards hub-course-${layout}`}>{list.map(c => {
    const next = work.find(w => w.c.id === c.id)?.i;
    const progress = courseProgress(c);
    return <button key={c.id} className="hub-course-card" disabled={busy} onClick={() => pick(c.id)} style={{ '--course-color': courseColor(c.id) } as React.CSSProperties}>
      <div className="hub-course-cover"><CourseBadge course={c} size={44} /><span>{c.course_data?.term || 'Course workspace'}</span><HubIcon name="arrow" size={18} /></div>
      <div className="hub-course-body"><h3>{c.name}</h3><p>{c.course_data?.instructor || 'Notes, assignments & conversations'}</p><ProgressBar course={c} /><small>{next ? `${next.title} · ${dueLabel(next)}` : progress.total ? 'All assignments completed' : 'Add your first assignment'}</small></div>
    </button>;
  })}</div>;

  return <div className="courses-hub">
    <header className="hub-header"><button className="hub-icon-button hub-mobile-toggle" aria-label={menu ? 'Close course navigation' : 'Open course navigation'} aria-expanded={menu} aria-controls="hub-navigation" onClick={() => setMenu(!menu)}><HubIcon name={menu ? 'close' : 'menu'} /></button><Wordmark /><span className="hub-header-divider" /><span className="hub-header-title">Courses</span><span className="hub-grow" /><button className="hub-button" onClick={p.onChat}><HubIcon name="chat" size={17} /><span>Back to chat</span></button></header>
    <div className="hub-layout">
      <aside id="hub-navigation" className={`hub-sidebar ${menu ? 'is-open' : ''}`}>
        <button className="hub-new" disabled={busy} onClick={() => { setMenu(false); p.onImport(); }}><HubIcon name="plus" size={23} />New course</button>
        <nav aria-label="Academic hub">{([{ id: 'home', label: 'Home', icon: 'home' }, { id: 'week', label: 'My week', icon: 'calendar' }, { id: 'library', label: 'All courses', icon: 'book' }] as const).map(n => <button key={n.id} disabled={busy} aria-current={!course && view === n.id ? 'page' : undefined} onClick={() => home(n.id)}><HubIcon name={n.icon} size={19} />{n.label}{n.id === 'library' && <span className="hub-count">{courses.length}</span>}</button>)}</nav>
        <div className="hub-sidebar-title">Your courses</div><nav aria-label="Your courses">{courses.map(c => <button key={c.id} disabled={busy} aria-current={course?.id === c.id ? 'page' : undefined} onClick={() => pick(c.id)} title={c.name}><CourseBadge course={c} size={24} /><span className="hub-grow">{c.name}</span></button>)}</nav>
        {!courses.length && !p.loading && <p className="hub-sidebar-empty">Your courses will appear here.</p>}
        <div className="hub-sidebar-footer"><HubIcon name="spark" size={18} /><p>One workspace.<br /><strong>Every way you learn.</strong></p></div>
      </aside>
      <main className="hub-main" aria-busy={p.loading}>
        {p.loading ? <div className="hub-loading" role="status"><span className="hub-spinner" />Loading your workspace…<div className="hub-skeleton-grid">{[0, 1, 2].map(n => <div key={n} className="pending-line" />)}</div></div> : !course ? <>
          <div className="hub-page-heading"><div><p className="hub-eyebrow">YOUR ACADEMIC WORKSPACE</p><h1>{view === 'home' ? 'A home for your semester.' : view === 'week' ? 'My week' : 'All courses'}</h1><p>{view === 'home' ? 'Your courses, materials, and ideas. Ready when you are.' : view === 'week' ? 'See what’s coming up and pick your next step.' : 'Everything you need for each class, in one place.'}</p></div>{view !== 'home' && <button className="hub-primary" disabled={busy} onClick={p.onCreate}><HubIcon name="plus" size={18} />Create course</button>}</div>
          {view === 'home' && <div className="hub-quick-actions"><button className="hub-quick-action hub-quick-featured" disabled={busy} onClick={() => p.onImport()}><span className="hub-action-icon"><HubIcon name="upload" size={23} /></span><span><strong>Start with a syllabus</strong><small>Upload, review, and organize your course.</small></span><HubIcon name="arrow" size={18} /></button><button className="hub-quick-action" disabled={busy} onClick={p.onCreate}><span className="hub-action-icon"><HubIcon name="plus" size={23} /></span><span><strong>Create a course</strong><small>Build your workspace as you go.</small></span></button><button className="hub-quick-action" onClick={() => home('week')}><span className="hub-action-icon"><HubIcon name="calendar" size={23} /></span><span><strong>Plan your week</strong><small>{work.length ? `${work.length} unfinished assignment${work.length === 1 ? '' : 's'} & exams` : 'Keep your next deadlines in sight.'}</small></span></button></div>}
          {view === 'week' ? <>
            <div className="hub-stats">{[{ title: 'Due in the next 7 days', n: work.filter(w => w.i.due && daysUntil(w.i.due) >= 0 && daysUntil(w.i.due) < 7).length }, { title: 'Overdue', n: work.filter(w => w.i.due && daysUntil(w.i.due) < 0).length }, { title: 'Needs a date', n: work.filter(w => !w.i.due).length }].map(s => <div className="hub-panel" key={s.title}><span>{s.title}</span><strong>{s.n}</strong></div>)}</div>
            {work.length ? groupByDue(work, w => w.i.due).map(g => <section className="hub-panel hub-agenda" key={g.label}><div className="hub-section-heading"><h2>{g.label}</h2><span className="hub-count">{g.rows.length}</span></div>{g.rows.map(w => task(w.c, w.i, true))}</section>) : <HubEmpty icon="check" title="Room to breathe" action={<button className="hub-button" onClick={() => home('library')}>Browse courses</button>}>There are no unfinished assignments or exams. Add or review deadlines inside a course.</HubEmpty>}
          </> : <>
            <div className="hub-section-heading"><h2>{view === 'home' ? 'Your courses' : 'Course library'}</h2><ViewToggle value={layout} onChange={setLayout} /></div>
            <div className="hub-toolbar"><Search value={query} onChange={setQuery} label="Search courses" /><select className="hub-select" aria-label="Filter by term" value={term} onChange={e => setTerm(e.target.value)}><option value="all">All terms</option>{[...new Set(courses.map(c => c.course_data?.term || 'No term'))].sort().map(t => <option key={t}>{t}</option>)}</select><select className="hub-select" aria-label="Sort courses" value={sort} onChange={e => setSort(e.target.value)}><option value="updated">Recently updated</option><option value="name">Name A–Z</option></select></div>
            {visibleCourses.length ? cards(visibleCourses) : <HubEmpty icon={courses.length ? 'search' : 'book'} title={courses.length ? 'No matching courses' : 'Your semester starts here'} action={<button className="hub-primary" onClick={() => courses.length ? (setQuery(''), setTerm('all')) : p.onImport()}>{courses.length ? 'Clear filters' : 'Upload a syllabus'}</button>}>{courses.length ? 'Try a different name or term.' : 'Create your first course to keep assignments, materials, and AI conversations together.'}</HubEmpty>}
            {view === 'home' && work.length > 0 && <section className="hub-panel hub-agenda"><div className="hub-section-heading"><div><h2>On your horizon</h2><p>Your next assignments and exams across courses.</p></div><button className="hub-link" onClick={() => home('week')}>View my week →</button></div>{work.slice(0, 4).map(w => task(w.c, w.i, true))}</section>}
          </>}
        </> : <>
          <div className="hub-breadcrumb"><button onClick={() => home('library')}>All courses</button><span>/</span><span>{course.course_data?.term || 'Course workspace'}</span></div>
          <div className="hub-page-heading hub-course-heading"><CourseBadge course={course} size={56} /><div className="hub-grow"><h1>{course.name}</h1><p>{course.course_data?.instructor || 'Your course, connected.'}{course.course_data?.schedule ? ` · ${course.course_data.schedule}` : ''}</p></div><div className="hub-course-actions"><AiPicker value={ai} onChange={p.onAi} /><button className="hub-primary" disabled={busy} onClick={() => launch(`Help me with ${course.name}.`)}><HubIcon name="plus" size={17} />Course chat</button></div></div>
          <nav className="hub-tabs" aria-label="Course sections">{tabs.map(t => <button key={t.label} aria-current={tab === t.label ? 'page' : undefined} onClick={() => { p.onTab(t.label); p.onItem(null); }}><HubIcon name={t.icon} size={17} />{t.label}</button>)}</nav>
          <div className="hub-content" key={`${course.id}-${tab}`}>
          {tab === 'Overview' && <>
            <div className="hub-overview-grid"><section className="hub-panel"><div className="hub-section-heading"><div><h2>Next up</h2><p>Make a little progress today.</p></div><button className="hub-link" onClick={() => p.onTab('Assignments')}>View all →</button></div>{work.filter(w => w.c.id === course.id).slice(0, 4).map(w => task(course, w.i))}{!work.some(w => w.c.id === course.id) && <HubEmpty icon="check" title="Nothing outstanding">Add assignments or review your syllabus to plan what comes next.</HubEmpty>}</section>
            <section className="hub-panel hub-course-info"><h2>Course at a glance</h2><ProgressBar course={course} /><dl>{(['instructor', 'schedule', 'officeHours'] as const).map(k => <div key={k}><dt>{k === 'officeHours' ? 'Office hours' : k === 'instructor' ? 'Instructor' : 'Class schedule'}</dt><dd>{course.course_data?.[k] || 'Not added yet'}</dd></div>)}</dl><button className="hub-button" disabled={busy} onClick={() => p.onEdit(course)}>Edit course details</button></section></div>
            <div className="hub-overview-grid"><section className="hub-panel"><div className="hub-section-heading"><h2>Recent course chats</h2><button className="hub-link" onClick={() => p.onTab('Chats')}>View all →</button></div>{p.detailLoading ? <p role="status">Loading conversations…</p> : p.detailError ? <button className="hub-button" onClick={p.onRetryDetails}>Retry loading course</button> : chats.length ? chats.slice(0, 4).map(c => <button className="hub-chat-row" key={c.id} onClick={() => openChat(c)}><AiMark provider={c.orbit_mode ? 'orbit' : c.provider} /><span className="hub-grow"><strong>{c.title || 'Untitled chat'}</strong></span><HubIcon name="arrow" size={16} /></button>) : <p className="hub-muted">Course conversations will appear here. Assignment chats stay in their own workspace.</p>}</section><section className="hub-panel hub-study-callout"><span className="hub-action-icon"><HubIcon name="spark" size={25} /></span><h2>Turn your notes into understanding.</h2><p>Practice recalling a concept, work through a problem, or get ready for an exam.</p><button className="hub-button" onClick={() => p.onTab('Study')}>Set up a study session<HubIcon name="arrow" size={16} /></button></section></div>
          </>}
          {tab === 'Assignments' && (item ? <>
            <button className="hub-link" onClick={() => p.onItem(null)}>← All assignments</button><div className="hub-assignment-header"><div><span className="hub-label">{item.kind === 'exam' ? 'Exam workspace' : 'Assignment workspace'}</span><h2>{item.title}</h2><p>{item.due ? `Due ${item.due}` : 'Date unconfirmed'}{item.weight ? ` · ${item.weight} of grade` : ''}</p></div><label className="hub-status-label">Progress<select className="hub-select" disabled={busy} aria-label="Assignment progress" value={item.status} onChange={e => p.onStatus(item, e.target.value as CourseItem['status'])}><option value="todo">Not started</option><option value="doing">In progress</option><option value="done">Completed</option></select></label></div>
            <div className="hub-panel"><h3>Instructions & requirements</h3><p className="hub-requirements">{item.details || 'Upload the assignment instructions below to give your AI the details.'}</p>{item.sourceId && <button className="hub-link" onClick={() => p.onSource(item.sourceId!)}>View syllabus evidence →</button>}</div>
            {item.id ? <AssignmentWorkspace key={`${course.id}-${item.id}`} active={p.active} course={course} item={items.find(i => i.id === item.id) ?? item} userId={p.userId} ai={ai} courseFiles={files} openFile={p.onOpenFile} onLaunch={p.onLaunch} onCourse={p.onCourse} /> : <p className="hub-notice">Save this course to create an assignment workspace.</p>}
          </> : <section><div className="hub-section-heading"><div><h2>Assignments & exams</h2><p>Each one has a home for its instructions, files, and conversations.</p></div><button className="hub-button" disabled={busy} onClick={() => p.onEdit(course)}>Manage assignments</button></div><div className="hub-toolbar"><Search value={taskQuery} onChange={setTaskQuery} label="Search assignments" /><select className="hub-select" aria-label="Filter assignments" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All progress</option><option value="todo">Not started</option><option value="doing">In progress</option><option value="done">Completed</option></select></div>
            {(() => { const matches = items.filter(i => i.kind !== 'topic' && i.title.toLowerCase().includes(taskQuery.toLowerCase()) && (status === 'all' || i.status === status)).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999')); return matches.length ? <div className="hub-panel hub-assignment-list">{matches.map(i => task(course, i))}</div> : <HubEmpty icon="calendar" title="No assignments to show" action={<button className="hub-button" onClick={() => p.onEdit(course)}>Manage assignments</button>}>Add assignments or change your search and progress filters.</HubEmpty>; })()}
          </section>)}
          {(tab === 'Materials' || tab === 'Chats' || tab === 'Study') && (p.detailLoading ? <div className="hub-loading" role="status"><span className="hub-spinner" />Loading course materials and chats…</div> : p.detailError ? <HubEmpty title="Course contents couldn’t load" action={<button className="hub-button" onClick={p.onRetryDetails}>Try again</button>}>Your saved work is still there. Retry when your connection is ready.</HubEmpty> : <>
            {tab === 'Materials' && <><CourseFileBrowser title="Course materials" description="Lecture notes, slides, readings, and your syllabus." searchLabel="Search materials" key={course.id} files={files} uploading={p.uploading} busy={busy} onUpload={p.onUpload} onOpen={p.onOpenFile} onRemove={p.onRemoveFile} /><details className="hub-panel hub-folders"><summary><HubIcon name="folder" />Additional course folders</summary><p className="hub-muted">Organize group projects or other work. Assignment folders are also accessible from Assignments.</p><FolderBrowser key={course.id} userId={p.userId} courseId={course.id} active={p.active} disabled={busy} onOpen={folder => p.onLaunch({ course, folder: { id: folder.id, name: folder.name }, provider: ai, prompt: '' })} /></details></>}
            {tab === 'Chats' && <CourseChats chats={chats} onOpen={openChat} onNew={() => launch(`Help me with ${course.name}.`)} />}
            {tab === 'Study' && <StudySetup key={course.id} course={course} files={files} onStart={launch} onMaterials={() => p.onTab('Materials')} />}
          </>)}
          {tab === 'Syllabus' && <section><div className="hub-section-heading"><div><h2>Your course source of truth</h2><p>Keep the original syllabus and review its details as your course changes.</p></div><button className="hub-button" disabled={busy} onClick={() => p.onImport(course)}><HubIcon name="upload" size={17} />{course.syllabus_id ? 'Upload revision' : 'Add syllabus'}</button></div>
            <div className="hub-panel hub-syllabus-card"><span className="hub-syllabus-icon"><HubIcon name="book" size={38} /></span><div className="hub-grow"><h3>{course.syllabus_id ? 'Original syllabus' : 'No syllabus attached yet'}</h3><p>{course.syllabus_id ? 'Review the document behind your course details and deadlines.' : 'Upload one to draft assignments, exams, and course information.'}</p></div>{course.syllabus_id && <button className="hub-primary" onClick={() => p.onOpenFile(course.syllabus_id!)}>Open document<HubIcon name="arrow" size={17} /></button>}</div>
            <div className="hub-panel"><div className="hub-section-heading"><div><h2>Reviewed course details</h2><p>Check dates and requirements against your syllabus.</p></div><button className="hub-button" disabled={busy} onClick={() => p.onEdit(course)}>Review & edit</button></div><dl className="hub-syllabus-stats"><div><dt>Assignments</dt><dd>{items.filter(i => i.kind === 'assignment').length}</dd></div><div><dt>Exams</dt><dd>{items.filter(i => i.kind === 'exam').length}</dd></div><div><dt>Topics</dt><dd>{items.filter(i => i.kind === 'topic').length}</dd></div><div><dt>Unconfirmed dates</dt><dd>{items.filter(i => i.kind !== 'topic' && !i.due).length}</dd></div></dl></div>
            {items.some(i => i.kind === 'topic') && <section className="hub-panel"><h2>Topics from the syllabus</h2>{items.filter(i => i.kind === 'topic').map((i, n) => <div className="hub-topic" key={i.id ?? n}><span>{String(n + 1).padStart(2, '0')}</span><div><h3>{i.title}</h3><p>{i.details}</p></div>{i.sourceId && <button className="hub-link" onClick={() => p.onSource(i.sourceId!)}>Source</button>}</div>)}</section>}
          </section>}
          </div>
        </>}
      </main>
    </div>
  </div>;
}
