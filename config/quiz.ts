/** Whole-session limits. Input, reasoning, output and failed/uncertain calls share one cap. */
export const QUIZ = {
  defaultCount: 10,
  maxCount: 30,
  dailyFraction: 0.01, // migration 0027 enforces daily_limit / 100 server-side
  maxTopicChars: 1800,
  contextTokens: 1800,
  questionOutputTokens: 220,
  timeoutMs: 90_000,
  defaults: { openai: 'openai-luna', anthropic: 'anthropic-haiku-5-5', google: 'google-2-5-flash-lite', xai: 'xai-grok-build-0-1' },
};
