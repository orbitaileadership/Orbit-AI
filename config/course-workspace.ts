/** Workspace limits do not change model pricing or per-turn spending controls. */
export const COURSE_WORKSPACE = { maxEvents: 1000, maxRangeDays: 62, maxQuestions: 30, maxCards: 100 };
export const QUIZ_FORMATS = ['mcq', 'short-answer', 'flashcards'] as const;
export type QuizFormat = typeof QUIZ_FORMATS[number];
