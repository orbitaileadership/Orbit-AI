"use client";

import { useContext, useEffect, useId, useRef, useState } from "react";
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
  const progressRef = useRef(progress);
  const deckRef = useRef<HTMLDivElement>(null);

  const scrollToCard = (index: number, behavior: ScrollBehavior = "auto") => {
    const track = deckRef.current;
    const card = track?.querySelector<HTMLElement>("[data-study-slide]");
    if (!track || !card) return;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollTo({ left: index * (card.offsetWidth + gap), behavior });
  };

  useEffect(() => {
    if (!storageKey) return;
    const frame = requestAnimationFrame(() => {
      try {
        const restored = saved(localStorage.getItem(storageKey), count) ?? empty(count);
        // The previous flashcard UI used count as its results screen. The deck
        // always stays browsable, including when opening an older completed set.
        if (flashcards) restored.current = Math.min(restored.current, count - 1);
        progressRef.current = restored;
        setProgress(restored);
        if (flashcards) requestAnimationFrame(() => scrollToCard(restored.current));
      }
      catch { /* The session still works without browser storage. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey, count, flashcards]);

  const update = (next: Progress) => {
    progressRef.current = next;
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
    const current = progressRef.current;
    const marks = [...current.marks]; marks[Math.min(current.current, count - 1)] = value;
    update({ ...current, marks });
  };
  const reveal = () => {
    const revealed = [...progress.revealed]; revealed[index] = true;
    update({ ...progress, revealed });
  };
  const response = progress.responses[index] ?? "";

  if (flashcards) {
    const go = (next: number) => {
      const target = Math.max(0, Math.min(count - 1, next));
      update({ ...progressRef.current, current: target });
      scrollToCard(target, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
    };
    const flip = (cardIndex: number) => {
      const revealed = [...progressRef.current.revealed];
      revealed[cardIndex] = !revealed[cardIndex];
      update({ ...progressRef.current, current: cardIndex, revealed });
      scrollToCard(cardIndex, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
    };
    const syncScroll = (track: HTMLDivElement) => {
      const card = track.querySelector<HTMLElement>("[data-study-slide]");
      if (!card) return;
      const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
      const next = Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / (card.offsetWidth + gap))));
      if (next !== progressRef.current.current) update({ ...progressRef.current, current: next });
    };
    const current = Math.min(index, count - 1);
    return <section className="p-4 sm:p-5" aria-label={widget.title ?? "Flashcards"}>
      <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <span>{widget.title ?? "Flashcards"}</span>
        <span className="tabular-nums" aria-live="polite">Card {current + 1} of {count}</span>
      </div>
      <div role="progressbar" aria-label="Cards reviewed" aria-valuenow={marked} aria-valuemin={0} aria-valuemax={count}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-300">
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${marked / count * 100}%` }} />
      </div>
      <div ref={deckRef} className="study-deck-track mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-3"
        role="region" aria-label="Flashcard deck" tabIndex={0} onScroll={event => syncScroll(event.currentTarget)}
        onKeyDown={event => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            go(current + (event.key === "ArrowRight" ? 1 : -1));
          }
        }}>
        {widget.cards.map((card, cardIndex) => {
          const flipped = progress.revealed[cardIndex];
          return <div key={cardIndex} data-study-slide className="study-deck-slide shrink-0 snap-start" role="group" aria-label={`Flashcard ${cardIndex + 1} of ${count}`}>
            <button type="button" className="study-flashcard block w-full text-left" data-flipped={flipped} aria-pressed={flipped}
              onClick={() => flip(cardIndex)}>
              <span className="study-flashcard-inner block h-full w-full">
                <span className="study-flashcard-face study-flashcard-front" aria-hidden={flipped}>
                  <span className="text-xs font-semibold uppercase tracking-[.18em] text-ink-muted">Question</span>
                  <span className="study-flashcard-copy">{card.front}</span>
                  <span className="text-xs font-medium text-ink-muted">Click or tap to reveal answer</span>
                </span>
                <span className="study-flashcard-face study-flashcard-back" aria-hidden={!flipped}>
                  <span className="text-xs font-semibold uppercase tracking-[.18em] text-ink-muted">Answer</span>
                  <span className="study-flashcard-copy">{card.back}</span>
                  <span className="text-xs font-medium text-ink-muted">Click or tap to see question</span>
                </span>
              </span>
            </button>
          </div>;
        })}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <button type="button" onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous flashcard"
          className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line bg-surface-100 text-lg text-ink transition-colors hover:bg-surface-200 disabled:cursor-default disabled:opacity-40">←</button>
        <span className="text-center text-xs text-ink-muted">Swipe, scroll, or use arrows</span>
        <button type="button" onClick={() => go(current + 1)} disabled={current === count - 1} aria-label="Next flashcard"
          className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line bg-surface-100 text-lg text-ink transition-colors hover:bg-surface-200 disabled:cursor-default disabled:opacity-40">→</button>
      </div>
      {progress.revealed[current] && <div className="study-card-enter mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Self-check result">
        <span className="mr-auto text-sm text-ink-muted">Did you know it?</span>
        <button type="button" onClick={() => mark(false)} aria-pressed={progress.marks[current] === false}
          className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${progress.marks[current] === false ? "border-warning bg-warning/10 text-ink" : "border-line hover:bg-surface-200"}`}>Review again</button>
        <button type="button" onClick={() => mark(true)} aria-pressed={progress.marks[current] === true}
          className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${progress.marks[current] === true ? "border-success bg-success/10 text-ink" : "border-line hover:bg-surface-200"}`}>Got it</button>
      </div>}
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-muted">
        <span>{marked} of {count} reviewed · {understood} known</span>
        <button type="button" onClick={() => { update(empty(count)); scrollToCard(0); }} className="font-medium text-ink underline underline-offset-4">Restart deck</button>
      </div>
    </section>;
  }

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
