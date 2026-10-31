"use client";

import { createContext, useContext, useId, useState } from "react";
import { multipleChoiceAnswer, type MultipleChoiceWidget } from "@/lib/widgets/schema";

export type MultipleChoiceInteraction = {
  onAnswer: (answer: string) => void;
  answers: string[];
  disabledReason?: string;
  storageScope?: string;
};
export const MultipleChoiceContext = createContext<MultipleChoiceInteraction | undefined>(undefined);

export function MultipleChoice({ widget }: { widget: MultipleChoiceWidget }) {
  const interaction = useContext(MultipleChoiceContext);
  const [selected, setSelected] = useState<number | null>(null);
  const name = useId();
  const submitted = widget.options.findIndex((_, i) => interaction?.answers.includes(multipleChoiceAnswer(widget, i)));
  const choice = submitted >= 0 ? submitted : selected;
  const reason = interaction?.disabledReason ?? (!interaction ? "Answer this question in the chat." : undefined);
  const disabled = Boolean(reason) || submitted >= 0;

  return (
    <form className="p-4" onSubmit={(event) => {
      event.preventDefault();
      if (choice !== null && !disabled) interaction?.onAnswer(multipleChoiceAnswer(widget, choice));
    }}>
      <fieldset disabled={disabled}>
        <legend className="mb-3 text-base font-semibold leading-relaxed">{widget.question}</legend>
        <div className="space-y-2">
          {widget.options.map((option, i) => (
            <label key={i} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm leading-relaxed ${choice === i ? "border-brand bg-surface-200" : "border-line hover:bg-surface-200"}`}>
              <input type="radio" name={name} value={i} checked={choice === i} onChange={() => setSelected(i)} className="mt-1 accent-[var(--brand)]" />
              <span className="min-w-0 break-words"><span className="mr-2 font-semibold">{String.fromCharCode(65 + i)}.</span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={disabled || choice === null} className="min-h-11 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-surface-000 disabled:cursor-default disabled:opacity-50">
          {submitted >= 0 ? "Answer submitted" : "Submit answer"}
        </button>
        <p role="status" className="text-xs text-ink-muted">{submitted >= 0 ? "Your answer is saved in this chat." : reason ?? "Choose one answer."}</p>
      </div>
    </form>
  );
}
