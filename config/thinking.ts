/** Explicit lead-answer effort. No change to voting, output caps or pricing. */
export const THINKING_LEVELS = ['low', 'medium', 'high'] as const;
export type ThinkingLevel = typeof THINKING_LEVELS[number];
export const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'medium';
export const isThinkingLevel = (value: unknown): value is ThinkingLevel => THINKING_LEVELS.some(level => level === value);
// Flash low/medium/high verified November 8, 2026; other entries October 24. Fail closed for unknown models.
export const THINKING_MODELS = ['gpt-6.1-sol', 'claude-sonnet-5-5', 'gemini-3.1-pro-preview', 'gemini-3.8-flash', 'grok-4.7'] as const;
export const supportsThinkingLevel = (model: string) => THINKING_MODELS.some(id => id === model);
