"use client";

import { useContext, useEffect, useId, useState } from "react";
import type { FlashcardsWidget, ShortAnswerQuizWidget } from "@/lib/widgets/schema";
import { MultipleChoiceContext } from "./multiple-choice";

type Widget = FlashcardsWidget | ShortAnswerQuizWidget;
type Progress = { current: number; responses: string[]; revealed: boolean[]; marks: (boolean | null)[] };
const empty = (count: number): Progress => ({ current: 0, responses: Array(count).fill(""), revealed: Array(count).fill(false), marks: Array(count).fill(null) });

function saved(raw: string | null, count: number): Progress | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Progress;
    if (!Number.isInteger(value.current) || value.current < 0 || value.current > count ||
      !Array.isArray(value.responses) || value.responses.length !== count || value.responses.some(v => typeof v !== "string" || v.length > 4000) ||
      !Array.isArray(value.revealed) || value.revealed.length !== count || value.revealed.some(v => typeof v !== "boolean") ||
      !Array.isArray(value.marks) || value.marks.length !== count || value.marks.some(v => v !== null && typeof v !== "boolean")) return null;
    return value;
  } catch { return null; }
}

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

export function StudySessionWidget({ widget }: { widget: Widget }) {
  const fieldId = useId();
  const interaction = useContext(MultipleChoiceContext);
  const flashcards = widget.type === "flashcards";
  const count = flashcards ? widget.cards.length : widget.questions.length;
  const storageKey = interaction?.storageScope ? `orbit.study.v1.${interaction.storageScope}.${fingerprint(JSON.stringify(widget))}` : null;
  const [progress, setProgress] = useState<Progress>(() => empty(count));

  useEffect(() => {
    if (!storageKey) return;
    const frame = requestAnimationFrame(() => {
      try { setProgress(saved(localStorage.getItem(storageKey), count) ?? empty(count)); }
      catch { /* The session still works without browser storage. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey, count]);

  const update = (next: Progress) => {
    setProgress(next);
    // Persist navigation and self-checks, never the student's written answer.
    if (storageKey) try { localStorage.setItem(storageKey, JSON.stringify({ ...next, responses: Array(count).fill("") })); } catch { /* Keep in-memory progress. */ }
  };
  const done = progress.current === count;
  const index = progress.current;
  const marked = progress.marks.filter(mark => mark !== null).length;
  const understood = progress.marks.filter(Boolean).length;
  const item = done ? null : flashcards ? widget.cards[index] : widget.questions[index];
  const prompt = item ? flashcards ? (item as FlashcardsWidget["cards"][number]).front : (item as ShortAnswerQuizWidget["questions"][number]).question : "";
  const answer = item ? flashcards ? (item as FlashcardsWidget["cards"][number]).back : (item as ShortAnswerQuizWidget["questions"][number]).answer : "";
  const explanation = item && !flashcards ? (item as ShortAnswerQuizWidget["questions"][number]).explanation : undefined;

  const mark = (value: boolean) => {
    const marks = [...progress.marks]; marks[index] = value;
    update({ ...progress, marks });
  };
  const reveal = () => {
    const revealed = [...progress.revealed]; revealed[index] = true;
    update({ ...progress, revealed });
  };
  const response = progress.responses[index] ?? "";

  return <section className="p-4 sm:p-5" aria-label={widget.title ?? (flashcards ? "Flashcards" : "Short-answer quiz")}>
    <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
      <span>{widget.title ?? (flashcards ? "Flashcards" : "Short-answer practice")}</span>
      <span className="tabular-nums">{done ? "Results" : `${flashcards ? "Card" : "Question"} ${index + 1} of ${count}`}</span>
    </div>
    <div role="progressbar" aria-label="Items reviewed" aria-valuenow={marked} aria-valuemin={0} aria-valuemax={count}
      className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-300">
      <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${marked / count * 100}%` }} />
    </div>
    {item ? <div key={`${index}:${progress.revealed[index]}`} className="study-card-enter">
      <div className="mt-5 rounded-2xl border border-line bg-surface-000 p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{flashcards ? progress.revealed[index] ? "Back" : "Front" : "Your prompt"}</p>
        <h3 className="mt-2 text-base font-semibold leading-relaxed text-ink">{flashcards && progress.revealed[index] ? answer : prompt}</h3>
      </div>
      {!flashcards && <div className="mt-4">
        <label htmlFor={`${fieldId}-${index}`} className="mb-2 block text-sm font-medium text-ink">Your answer</label>
        <textarea id={`${fieldId}-${index}`} value={response} disabled={progress.revealed[index]} maxLength={4000} rows={4}
          onChange={event => { const responses = [...progress.responses]; responses[index] = event.target.value; update({ ...progress, responses }); }}
          placeholder="Write your answer here…" className="w-full resize-y rounded-xl border border-line bg-surface-000 px-3 py-3 text-sm text-ink outline-none focus:border-brand disabled:opacity-70" />
      </div>}
      {!progress.revealed[index] ? <button type="button" disabled={!flashcards && !response.trim()} onClick={reveal}
        className="mt-4 min-h-11 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-on-brand transition-transform hover:scale-[1.02] disabled:cursor-default disabled:opacity-50 disabled:hover:scale-100">
        {flashcards ? "Flip card" : "Reveal sample answer"}
      </button> : <>
        {!flashcards && <div role="status" className="study-card-enter mt-4 rounded-xl border border-brand/30 bg-surface-200 p-4 text-sm leading-relaxed text-ink">
          <p className="font-semibold">Sample answer</p><p className="mt-1 whitespace-pre-wrap">{answer}</p>
          {explanation && <p className="mt-2 text-ink-muted">{explanation}</p>}
        </div>}
        <p className="mt-4 text-sm text-ink-muted">{flashcards ? "How well did you know it?" : "Compare your answer and mark it yourself. Orbit does not automatically grade free-form answers."}</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Self-check result">
          <button type="button" onClick={() => mark(false)} aria-pressed={progress.marks[index] === false}
            className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${progress.marks[index] === false ? "border-warning bg-warning/10 text-ink" : "border-line hover:bg-surface-200"}`}>Review again</button>
          <button type="button" onClick={() => mark(true)} aria-pressed={progress.marks[index] === true}
            className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${progress.marks[index] === true ? "border-success bg-success/10 text-ink" : "border-line hover:bg-surface-200"}`}>Got it</button>
        </div>
      </>}
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" disabled={index === 0} onClick={() => update({ ...progress, current: index - 1 })}
          className="min-h-11 rounded-xl px-3 text-sm text-ink-muted hover:bg-surface-200 disabled:invisible">Previous</button>
        <button type="button" disabled={progress.marks[index] === null} onClick={() => update({ ...progress, current: index + 1 })}
          className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand disabled:cursor-default disabled:opacity-50">
          {index === count - 1 ? "See results" : flashcards ? "Next card" : "Next question"}
        </button>
      </div>
    </div> : <div className="py-8 text-center">
      <p className="text-sm text-ink-muted">Session complete</p>
      <p className="mt-2 text-4xl font-semibold tabular-nums text-ink">{understood} / {count}</p>
      <p className="mt-2 text-sm text-ink-muted">Marked as understood by you, not an official grade.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => update({ ...progress, current: 0 })} className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium">Review answers</button>
        <button type="button" onClick={() => update(empty(count))} className="min-h-11 rounded-xl bg-brand px-4 text-sm font-medium text-on-brand">Try again</button>
      </div>
    </div>}
  </section>;
}
