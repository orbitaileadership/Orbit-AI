// Public synthetic validation fixture; never an application route or real model answer.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from '@/components/chat-widgets';
import { MultipleChoiceContext } from '@/components/multiple-choice';
import { parseWidget } from '@/lib/widgets/schema';
import { hasInteractiveStudySet, normalizeQuizOutput, STUDY_WIDGET_ERROR_TEXT } from '@/lib/courses/quiz-output';
import { hasInteractiveStudySet as baselineHas } from './baseline-validator.mjs';
import training from '@/docs/feedback/courses-c7-20261115/student-public/training-cases.json';
import '@/app/globals.css';
import 'katex/dist/katex.min.css';

const params = new URLSearchParams(location.search);
const sample = training.cases.find(c => c.id === params.get('case')) ?? training.cases[0];
const mode = params.get('mode') === 'baseline' ? 'baseline' : 'candidate';
const text = normalizeQuizOutput(sample.output);
const accepted = (mode === 'baseline' ? baselineHas : hasInteractiveStudySet)(text, sample.format, sample.count);
const widgets = [...text.matchAll(/```orbit-widget\s*\n([\s\S]*?)\n```/g)].map(m => parseWidget(m[1])).filter(Boolean);
window.c7 = { mode, id: sample.id, format: sample.format, count: sample.count, expected: sample.expectedAccept, accepted, widgets };
createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-3xl p-4 text-ink">
  <h1 className="text-xl font-semibold">C7 OFFLINE / MOCK</h1>
  <p className="my-2 text-sm">Synthetic output and local completion gate. No provider, account, database or real website.</p>
  <p data-testid="gate" className="my-3">{accepted ? 'MOCK completion accepted' : 'MOCK completion rejected'}</p>
  {accepted ? <MultipleChoiceContext.Provider value={{ storageScope: `c7-${mode}-${sample.id}` }}>
    {widgets.map((widget, index) => <ChatWidget key={index} widget={widget} />)}
  </MultipleChoiceContext.Provider> : <p role="alert">{STUDY_WIDGET_ERROR_TEXT}</p>}
</main>);
