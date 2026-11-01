"use client";

import { createContext } from "react";
import type { MultipleChoiceWidget } from "@/lib/widgets/schema";

// QuizWidgetView uses this scope to keep local progress across reloads.
export type MultipleChoiceInteraction = { storageScope?: string; legacyStorageScope?: string };
export const MultipleChoiceContext = createContext<MultipleChoiceInteraction | undefined>(undefined);

/** Legacy single-question replies have no answer key. Display them without an
 * answer control so a click can never dispatch a paid model turn. */
export function MultipleChoice({ widget }: { widget: MultipleChoiceWidget }) {
  return <section className="p-4" aria-label="Older multiple-choice question">
    <h3 className="mb-3 text-base font-semibold leading-relaxed">{widget.question}</h3>
    <ol className="space-y-2">
      {widget.options.map((option, i) => <li key={i} className="flex min-h-11 items-start gap-3 rounded-xl border border-line px-3 py-3 text-sm leading-relaxed">
        <span className="font-semibold">{String.fromCharCode(65 + i)}.</span><span className="min-w-0 break-words">{option}</span>
      </li>)}
    </ol>
    <p className="mt-3 text-xs text-ink-muted">This older question has no answer key for instant grading. Ask for a new interactive quiz to click through.</p>
  </section>;
}
