'use client';

import { useEffect, useRef, useState } from 'react';
import type { Course, CourseLaunch } from '@/lib/courses/types';
import { QUIZ_FORMATS, type QuizFormat } from '@/config/course-workspace';
import { cardsTsv, quizLabel, validStudyCards, type StudyCard, type StudyConfig } from '@/lib/courses/quiz';
import { THEMES } from '@/config/themes';
import { isProvider, PROVIDERS } from '@/config/models';
import { downloadCourseFile } from './course-calendar';
import { ProviderLogo } from './provider-logo';
import { OrbitGlyph } from './app-rail';
import { HubIcon } from './course-hub-icons';

type Session = { id: string; title: string; provider: string; orbit_mode: boolean; study_config: StudyConfig };
type SavedMessage = { role: string; status: string; study_cards?: StudyCard[] };

async function api(path: string, body?: object) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error === 'quiz_launch_pending' ? 'This quiz is being saved. Open it from Saved quizzes.' : data.error === 'db_setup' ? 'Quiz sessions need the workspace database update.' : 'Could not open the quiz. Try again.');
  return data;
}

export function CourseQuiz({ course, ai, onAi, onCourse, onLaunch, onSessionSaved, active = true }: {
  course: Course; ai: string; onAi: (value: string) => void; onCourse: (course: Course) => void;
  onLaunch: (launch: CourseLaunch) => void; onSessionSaved: () => void; active?: boolean;
}) {
  const sections = (course.course_data?.items ?? []).filter(item => item.kind !== 'topic' && item.id);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [format, setFormat] = useState<QuizFormat>('mcq');
  const [count, setCount] = useState(10);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cards, setCards] = useState<StudyCard[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const launchId = useRef(crypto.randomUUID());
  const locked = useRef(false);
  const base = `/api/courses/${course.id}/quiz`;

  useEffect(() => {
    if (!active) return;
    let alive = true;
    api(base).then(data => { if (alive) setSessions(data.sessions ?? []); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [active, base, revision]);

  function handoff(conversation: Session, prompt: string, folder: { id: string; name: string }) {
    const item = sections.find(section => section.id === conversation.study_config.section_id);
    if (!item) throw new Error('This graded section is no longer available.');
    onLaunch({ course, item, folder, provider: conversation.orbit_mode ? 'orbit' : conversation.provider,
      conversationId: conversation.id, prompt: conversation.study_config.start_state === 'ready' ? prompt : '',
      startQuiz: conversation.study_config.start_state === 'ready' });
  }

  async function start() {
    if (locked.current || !sectionId) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const workspace = await api(`/api/courses/${course.id}/assignments/${sectionId}`, {});
      if (workspace.course) onCourse(workspace.course);
      const saved = await api(base, { launchId: launchId.current, sectionId, format, count, provider: ai });
      launchId.current = crypto.randomUUID();
      onSessionSaved();
      handoff(saved.conversation, saved.prompt, saved.folder);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the quiz.'); }
    finally { locked.current = false; setBusy(false); setRevision(v => v + 1); }
  }

  async function open(session: Session) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const saved = await api(`${base}?conversationId=${session.id}`);
      const item = sections.find(section => section.id === session.study_config.section_id);
      if (!item?.folderId) throw new Error('This graded section is no longer available.');
      handoff(saved.conversation, saved.prompt, { id: item.folderId, name: item.title });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open the quiz.'); }
    finally { locked.current = false; setBusy(false); }
  }

  async function showExports(session: Session) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const saved = await api(`${base}?conversationId=${session.id}`);
      const values = [...new Map((saved.messages as SavedMessage[]).filter(m => m.role === 'assistant' && m.status === 'complete')
        .flatMap(m => validStudyCards(m.study_cards)).map(card => [JSON.stringify(card), card])).values()].slice(0, 100);
      if (!values.length) throw new Error('No completed flashcards to export yet.');
      setCards(values);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load flashcards.'); }
    finally { locked.current = false; setBusy(false); }
  }

  return <section className="workspace-quiz workspace-quiz-v3">
    <div className="hub-section-heading"><h2>Quiz</h2></div>
    {error && <p className="workspace-alert" role="alert">{error}</p>}
    <div className="hub-panel workspace-quiz-setup">
      <label>Graded section<select value={sectionId} onChange={e => { setSectionId(e.target.value); launchId.current = crypto.randomUUID(); }}>
        {sections.length ? sections.map(item => <option key={item.id} value={item.id}>{item.title}</option>) : <option value="">No graded sections yet</option>}
      </select></label>
      <div className="workspace-quiz-formats" role="group" aria-label="Quiz format">{QUIZ_FORMATS.map(choice => <button key={choice} type="button" aria-pressed={format === choice} onClick={() => { setFormat(choice); launchId.current = crypto.randomUUID(); }}><HubIcon name={choice === 'flashcards' ? 'file' : choice === 'mcq' ? 'list' : 'chat'} size={24} /><strong>{quizLabel(choice)}</strong></button>)}</div>
      <div className="workspace-quiz-options"><label>Questions<select value={count} onChange={e => { setCount(Number(e.target.value)); launchId.current = crypto.randomUUID(); }}>{[5, 10, 15, 20, 30].map(n => <option key={n}>{n}</option>)}</select></label>
        <div><span className="workspace-quiz-choice-label">Study with</span><div className="section-ai-choices" role="group" aria-label="Choose quiz AI">{(['orbit', ...PROVIDERS] as const).map(choice => <button key={choice} type="button" className="section-ai-choice" title={choice === 'orbit' ? 'Orbit' : THEMES[choice].appName} aria-label={choice === 'orbit' ? 'Orbit' : THEMES[choice].appName} aria-pressed={ai === choice} onClick={() => { onAi(choice); launchId.current = crypto.randomUUID(); }}>{choice === 'orbit' ? <OrbitGlyph size={20} /> : <ProviderLogo provider={choice} size={21} />}</button>)}</div></div>
      </div>
      <footer><span className="text-xs text-ink-muted">AI replies use your allowance.</span><button type="button" className="hub-primary" disabled={busy || !sectionId} onClick={() => void start()}>{busy ? 'Saving…' : 'Start in selected AI'}<HubIcon name="arrow" size={17} /></button></footer>
    </div>
    <div className="hub-panel"><h3>Saved quizzes</h3>{sessions.length ? <div className="workspace-saved-quizzes">{sessions.map(session => {
      const item = sections.find(section => section.id === session.study_config.section_id);
      return <div className="workspace-saved-quiz" key={session.id}><span className="workspace-saved-quiz-logo">{session.orbit_mode ? <OrbitGlyph size={22} /> : isProvider(session.provider) ? <ProviderLogo provider={session.provider} size={22} /> : null}</span>
        <div className="min-w-0 flex-1"><strong>{item?.title ?? session.title}</strong><small>{quizLabel(session.study_config.format)} · {session.orbit_mode ? 'Orbit' : isProvider(session.provider) ? THEMES[session.provider].appName : 'AI'}</small></div>
        {session.study_config.format === 'flashcards' && <button className="hub-button" disabled={busy} onClick={() => void showExports(session)}>Export</button>}
        <button className="hub-primary" disabled={busy} onClick={() => void open(session)}>Open<HubIcon name="arrow" size={15} /></button></div>;
    })}</div> : <p className="hub-muted">No quizzes yet.</p>}
      {cards && <div className="workspace-card-export"><strong>{cards.length} completed flashcards</strong><button className="hub-button" onClick={() => downloadCourseFile(cardsTsv(cards), `${course.name}-flashcards.txt`, 'text/plain;charset=utf-8')}>Download for Anki</button><button className="hub-button" onClick={async () => { try { await navigator.clipboard.writeText(cardsTsv(cards)); } catch { setError('Copy was blocked. Download the text file instead.'); } }}>Copy for Quizlet</button><a className="hub-link" target="_blank" rel="noreferrer" href="https://quizlet.com/create-set">Open Quizlet ↗</a></div>}
    </div>
  </section>;
}
