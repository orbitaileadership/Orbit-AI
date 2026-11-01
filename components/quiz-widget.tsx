"use client";

import { useContext, useEffect, useState } from "react";
import type { QuizWidget } from "@/lib/widgets/schema";
import { MultipleChoiceContext } from "./multiple-choice";

type Progress = { current: number; answers: (number | null)[] };
const empty = (count: number): Progress => ({ current: 0, answers: Array(count).fill(null) });

function savedProgress(raw: string | null, widget: QuizWidget): Progress | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Progress;
    if (!Array.isArray(value.answers) || value.answers.length !== widget.questions.length ||
      !Number.isInteger(value.current) || value.current < 0 || value.current > widget.questions.length) return null;
    if (!value.answers.every((answer, i) => answer === null ||
      (Number.isInteger(answer) && answer >= 0 && answer < widget.questions[i].options.length))) return null;
    return value;
  } catch { return null; }
}

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

export function QuizWidgetView({ widget }: { widget: QuizWidget }) {
  const interaction = useContext(MultipleChoiceContext);
  const storageKey = interaction?.storageScope ? `orbit.quiz.v1.${interaction.storageScope}.${fingerprint(JSON.stringify(widget))}` : null;
  const legacyKey = interaction?.legacyStorageScope ? `orbit.quiz.v1.${interaction.legacyStorageScope}.${fingerprint(JSON.stringify(widget))}` : null;
  const [progress, setProgress] = useState<Progress>(() => empty(widget.questions.length));

  useEffect(() => {
    if (!storageKey) return;
    const frame = requestAnimationFrame(() => {
      try {
        let progress = savedProgress(localStorage.getItem(storageKey), widget);
        if (!progress && legacyKey) {
          progress = savedProgress(localStorage.getItem(legacyKey), widget);
          if (progress) try { localStorage.setItem(storageKey, JSON.stringify(progress)); localStorage.removeItem(legacyKey); } catch { /* Keep the restored progress in memory. */ }
        }
        setProgress(progress ?? empty(widget.questions.length));
      }
      catch { /* Storage can be unavailable in private browsing. The quiz still works in memory. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey, legacyKey, widget]);

  const update = (next: Progress) => {
    setProgress(next);
    if (storageKey) try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the current session usable. */ }
  };
  const count = widget.questions.length;
  const answered = progress.answers.filter(answer => answer !== null).length;
  const score = progress.answers.reduce<number>((total, answer, i) => total + (answer === widget.questions[i].correct ? 1 : 0), 0);
  const done = progress.current === count;
  const q = done ? null : widget.questions[progress.current];
  const chosen = done ? null : progress.answers[progress.current];

  return <section className="p-4 sm:p-5" aria-label={widget.title ?? "Multiple-choice quiz"}>
    <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
      <span>{widget.title ?? "Practice quiz"}</span>
      <span className="tabular-nums">{done ? "Results" : `Question ${progress.current + 1} of ${count}`}</span>
    </div>
    <div role="progressbar" aria-label="Questions answered" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={count}
      className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-300">
      <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${answered / count * 100}%` }} />
    </div>
    {q ? <>
      <h3 className="mt-5 text-base font-semibold leading-relaxed text-ink">{q.question}</h3>
      <div className="mt-4 space-y-2" role="group" aria-label="Choose an answer">
        {q.options.map((option, i) => {
          const picked = chosen === i;
          const revealed = chosen !== null;
          const correct = revealed && i === q.correct;
          return <button key={i} type="button" disabled={revealed} onClick={() => {
            const answers = [...progress.answers]; answers[progress.current] = i; update({ ...progress, answers });
          }} aria-pressed={picked} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm leading-relaxed transition-colors ${
            correct ? "border-success bg-success/10" : picked ? "border-danger bg-danger-surface" : "border-line bg-surface-100 hover:bg-surface-200"
          } disabled:cursor-default`}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-200 font-semibold">{String.fromCharCode(65 + i)}</span>
            <span className="min-w-0 flex-1 break-words">{option}</span>
            {correct && <span className="shrink-0 font-semibold text-success" aria-label="Correct answer">✓</span>}
          </button>;
        })}
      </div>
      {chosen !== null && <div role="status" className={`mt-4 rounded-xl border p-3 text-sm leading-relaxed ${chosen === q.correct ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger-surface"}`}>
        <p className={`font-semibold ${chosen === q.correct ? "text-success" : "text-danger"}`}>{chosen === q.correct ? "Correct" : "Not quite"}</p>
        <p className="mt-1 text-ink">{q.explanation}</p>
      </div>}
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" disabled={progress.current === 0} onClick={() => update({ ...progress, current: progress.current - 1 })}
          className="min-h-11 rounded-xl px-3 text-sm text-ink-muted hover:bg-surface-200 disabled:invisible">Previous</button>
        <button type="button" disabled={chosen === null} onClick={() => update({ ...progress, current: progress.current + 1 })}
          className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand disabled:cursor-default disabled:opacity-50">
          {progress.current === count - 1 ? "See results" : "Next question"}
        </button>
      </div>
    </> : <div className="py-8 text-center">
      <p className="text-sm text-ink-muted">Quiz complete</p>
      <p className="mt-2 text-4xl font-semibold tabular-nums text-ink">{score} / {count}</p>
      <p className="mt-2 text-sm text-ink-muted">Review your answers or try again at your own pace.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => update({ ...progress, current: 0 })} className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium">Review answers</button>
        <button type="button" onClick={() => update(empty(count))} className="min-h-11 rounded-xl bg-brand px-4 text-sm font-medium text-on-brand">Try again</button>
      </div>
    </div>}
  </section>;
}
