/** Explicit lead-answer effort. No change to voting, output caps or pricing. */
export const THINKING_LEVELS = ['low', 'medium', 'high'] as const;
export type ThinkingLevel = typeof THINKING_LEVELS[number];
export const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'medium';
export const isThinkingLevel = (value: unknown): value is ThinkingLevel => THINKING_LEVELS.some(level => level === value);
// Verified provider documentation, October 24, 2026. Fail closed if Orbit candidates change.
export const THINKING_MODELS = ['gpt-6.1-sol', 'claude-sonnet-5-5', 'gemini-3.1-pro-preview', 'grok-4.7'] as const;
export const supportsThinkingLevel = (model: string) => THINKING_MODELS.some(id => id === model);
