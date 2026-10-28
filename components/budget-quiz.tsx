'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QUIZ } from '@/config/quiz';
import { MODELS } from '@/config/models';
import type { QuizView } from '@/lib/quiz/schema';

const errors: Record<string, string> = {
  quiz_budget: 'The whole quiz cannot fit within 1% of your daily allowance. Choose a cheaper model or a shorter topic.',
  budget: 'Your remaining allowance cannot cover this quiz.',
  quiz_setup: 'Budget quizzes need the quiz database update before they can run.',
  quiz_provider_unavailable: 'This model is unavailable. Choose another model explicitly.',
  rate_limited: 'Please wait a minute before starting another quiz.',
  quiz_incomplete: 'The AI did not finish this quiz. Completed questions are kept. No paid retry will run automatically.',
  quiz_generation_failed: 'Generation failed. Completed questions are kept. No paid retry will run automatically.',
};
async function api(path: string, body?: object) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errors[data.error] ?? 'Could not load the quiz. Retry the same request to check its saved state.');
  return data;
}
type Saved = { id: string; topic: string; count: number; model_id: string };
export function BudgetQuiz({ topic: initialTopic, modelId: initialModel, count: initialCount = QUIZ.defaultCount, projectId, onClose }: {
  topic: string; modelId: string; count?: number; projectId?: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), id = useRef(crypto.randomUUID()), preparing = useRef<string | null>(null);
  const [topic, setTopic] = useState(initialTopic), [modelId, setModelId] = useState(initialModel), [count, setCount] = useState(initialCount);
  const [quiz, setQuiz] = useState<QuizView | null>(null), [choice, setChoice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [feedback, setFeedback] = useState(false);
  const [sessions, setSessions] = useState<Saved[]>([]);
  const [prepareRetry, setPrepareRetry] = useState(0);
  const [prepareError, setPrepareError] = useState('');
  const alive = useRef(true), activeId = useRef<string | null>(null), lock = useRef(false);
  const listing = `/api/quiz${projectId ? `?projectId=${projectId}` : ''}`;
  useEffect(() => {
    alive.current = true; dialog.current?.showModal();
    void api(listing).then(d => { if (alive.current) setSessions(d.sessions); }).catch(e => { if (alive.current) setError(e.message); });
    return () => { alive.current = false; };
  }, [listing]);
  const accept = useCallback((q: QuizView) => {
    if (alive.current && activeId.current === q.id) setQuiz(old => old && old.id === q.id &&
      (old.index > q.index || Date.parse(old.updatedAt) > Date.parse(q.updatedAt)) ? old : q);
  }, []);
  useEffect(() => {
    if (!quiz || quiz.done || !['new', 'first_ready'].includes(quiz.phase) || preparing.current === `${quiz.id}:${quiz.phase}`) return;
    preparing.current = `${quiz.id}:${quiz.phase}`;
    // Two bounded generation calls, rather than resending sources after every answer.
    void api('/api/quiz', { action: 'prepare', id: quiz.id }).then(d => { accept(d.quiz); if (alive.current) setPrepareError(''); })
      .catch(e => { if (alive.current) setPrepareError(e.message); });
  }, [quiz, accept, prepareRetry]);
  useEffect(() => {
    if (!quiz || quiz.done || !['first_running', 'rest_running', 'first_ready'].includes(quiz.phase)) return;
    const timer = window.setInterval(() => {
      void api(`/api/quiz?id=${quiz.id}`).then(d => accept(d.quiz)).catch(e => { if (alive.current) setError(e.message); });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [quiz, accept]);
  async function act(body: object, answer = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { accept((await api('/api/quiz', body)).quiz); if (answer) { setFeedback(true); setChoice(null); } }
    catch (e) { setError((e as Error).message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const field = 'w-full rounded-xl border border-line bg-surface-100 p-3';
  return <dialog ref={dialog} onClose={onClose} onCancel={onClose} aria-label="Multiple-choice quiz"
    className="m-auto max-h-[92dvh] w-[min(94vw,720px)] overflow-y-auto rounded-3xl border border-line bg-surface-000 p-5 text-ink shadow-menu backdrop:bg-black/50 sm:p-8">
    <header className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-medium">Multiple-choice quiz</h2><button type="button" onClick={onClose} className="min-h-11 rounded-full border border-line px-4">Close</button></header>
    {error && <p role="alert" className="mb-4 rounded-xl border border-line p-3">{error}</p>}
    {!quiz ? <div className="space-y-4">
      <label className="block">Topic<textarea className={`${field} mt-1`} value={topic} maxLength={QUIZ.maxTopicChars} onChange={e => { setTopic(e.target.value); id.current = crypto.randomUUID(); }} disabled={busy}/></label>
      <label className="block">Questions<input className={`${field} mt-1`} type="number" min={1} max={QUIZ.maxCount} value={count} onChange={e => { setCount(Number(e.target.value)); id.current = crypto.randomUUID(); }} disabled={busy}/></label>
      <label className="block">Quiz model<select className={`${field} mt-1`} value={modelId} onChange={e => { setModelId(e.target.value); id.current = crypto.randomUUID(); }} disabled={busy}>{MODELS.filter(m => m.enabled).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      <p className="text-sm text-ink-muted">The entire quiz shares a 1% daily-allowance cap. It uses the single model selected above. Answers are checked without extra AI calls. {projectId ? 'Uses selected course text excerpts, which may omit material.' : 'Uses this topic only; chat history and attachments are not included.'} Next questions are prepared while you answer. AI feedback is not an official grade.</p>
      <button type="button" disabled={busy || !topic.trim() || !Number.isInteger(count) || count < 1 || count > QUIZ.maxCount} className="min-h-11 rounded-xl bg-ink px-5 text-surface-000 disabled:opacity-50" onClick={() => { activeId.current = id.current; void act({ action: 'start', id: id.current, topic, modelId, count, projectId }); }}>{busy ? 'Preparing question 1…' : 'Start quiz'}</button>
      {!!sessions.length && <section><h3 className="mt-5 font-medium">Saved quizzes</h3>{sessions.map(s => <button key={s.id} disabled={busy} type="button" className="mt-2 block min-h-11 w-full rounded-xl border border-line p-3 text-left" onClick={async () => {
        if (lock.current) return; lock.current = true; setBusy(true); setError(''); activeId.current = s.id;
        try { accept((await api(`/api/quiz?id=${s.id}`)).quiz); } catch (e) { setError((e as Error).message); } finally { lock.current = false; if (alive.current) setBusy(false); }
      }}>{s.topic} · {s.count} questions</button>)}</section>}
    </div> : <div className="space-y-4">
      <p className="text-sm text-ink-muted">{MODELS.find(m => m.id === quiz.modelId)?.label} · {quiz.index}/{quiz.count} answered · {quiz.score} correct</p>
      {quiz.error && <p role="alert">{errors[quiz.error] ?? 'This quiz could not finish.'}</p>}
      {prepareError && ['new', 'first_ready'].includes(quiz.phase) && <div><p role="alert">{prepareError}</p><button type="button" disabled={busy} className="min-h-11 rounded-xl border border-line px-4" onClick={() => { preparing.current = null; setPrepareError(''); setPrepareRetry(n => n + 1); }}>Retry question preparation</button></div>}
      {feedback && quiz.feedback ? <section aria-live="polite"><h3 className="font-semibold">{quiz.feedback.correct ? 'Correct' : 'Not quite'}</h3><p>Answer: {quiz.feedback.answer}</p><p className="mt-2">{quiz.feedback.explanation}</p><button type="button" className="mt-4 min-h-11 rounded-xl border border-line px-5" onClick={() => setFeedback(false)}>{quiz.done ? 'See result' : 'Next question'}</button></section>
        : quiz.done ? <p role="status" className="text-lg font-medium">Quiz complete: {quiz.score}/{quiz.count}</p>
        : quiz.question ? <form onSubmit={e => { e.preventDefault(); if (choice !== null) void act({ action: 'answer', id: quiz.id, index: quiz.index, choice }, true); }}><fieldset disabled={busy}><legend className="mb-4 text-lg font-medium">Question {quiz.index + 1}: {quiz.question.question}</legend>{quiz.question.options.map((option, i) => <label key={i} className="mb-2 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line p-3"><input type="radio" name="quiz-choice" className="mt-1" checked={choice === i} onChange={() => setChoice(i)}/><span>{String.fromCharCode(65 + i)}. {option}</span></label>)}</fieldset><button disabled={busy || choice === null} type="submit" className="mt-3 min-h-11 rounded-xl bg-ink px-5 text-surface-000 disabled:opacity-50">{busy ? 'Saving answer…' : 'Submit answer'}</button></form>
        : <p role="status">{quiz.phase === 'failed' ? 'Available questions are complete.' : 'Preparing your next question…'}</p>}
      {['first_running', 'rest_running'].includes(quiz.phase) && <p className="text-xs text-ink-muted">Preparing the remaining questions in the background…</p>}
    </div>}
  </dialog>;
}
