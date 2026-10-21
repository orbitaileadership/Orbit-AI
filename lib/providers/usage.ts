// xAI schemas have historically differed. Use the aggregate to distinguish them instead of adding blindly.
export function xaiBillableOutput(input: number, completion: number, reasoning: number, total?: number): number {
  if (total === input + completion) return completion; // reasoning already included
  if (total === input + completion + reasoning) return completion + reasoning;
  // Legacy Chat Completions reports visible completion separately; retain this convention without an aggregate.
  return completion + reasoning;
}


import type { Usage } from "./types";
export const tokenCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Missing required usage never becomes a measured zero. Optional buckets retain reporting flags. */
export function reportedUsage(input: unknown, output: unknown, details: {
  reasoning?: unknown; cached?: unknown; cacheWrite?: unknown;
} = {}): Usage | undefined {
  if (!tokenCount(input) || !tokenCount(output)) return undefined;
  for (const value of Object.values(details)) if (value != null && !tokenCount(value)) return undefined;
  const reasoning = tokenCount(details.reasoning) ? details.reasoning : 0;
  const cached = tokenCount(details.cached) ? details.cached : 0;
  const cacheWrite = tokenCount(details.cacheWrite) ? details.cacheWrite : 0;
  if (reasoning > output || cached + cacheWrite > input) return undefined;
  return { input, output, reasoning, cached, cacheWrite,
    reasoningReported: tokenCount(details.reasoning), cachedReported: tokenCount(details.cached),
    cacheWriteReported: tokenCount(details.cacheWrite) };
}

/** Preserve raw integer precision. One USD micro is 10,000 xAI ticks. */
export function xaiCost(value: unknown): Pick<Usage, "costUsdMicros" | "costInUsdTicks"> {
  if (!(typeof value === "string" && /^\d+$/.test(value)) &&
      !(typeof value === "number" && Number.isSafeInteger(value) && value >= 0)) return {};
  const ticks = BigInt(value as string | number);
  const micros = (ticks + BigInt(9999)) / BigInt(10000);
  if (micros > BigInt(Number.MAX_SAFE_INTEGER)) return {};
  return { costUsdMicros: Number(micros), costInUsdTicks: ticks.toString() };
}
