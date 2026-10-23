import type { ProviderId } from "./models";

/** Configured candidates, not claims of comparative model quality. */
export const ORBIT = {
  version: "orbit-v2",
  voters: { openai: "openai-luna", anthropic: "anthropic-haiku", google: "google-default", xai: "xai-default" } satisfies Record<ProviderId, string>,
  candidates: { openai: "openai-default", anthropic: "anthropic-default", google: "google-pro", xai: "xai-default" } satisfies Record<ProviderId, string>,
  ballotOutput: 256,
  specialistOutput: 900,
  answerOutput: 4_000,
  inputTokens: 8_000,
  contextRows: 100,
  maxAttachments: 3,
  attachmentTokens: 2_000, // total file excerpts per turn; shared by all four voters, specialist and lead
  collaborationVotes: 3,
  helperBudgetMicros: 150_000,
  helperTimeoutMs: 30_000,
  voteRetryDelayMs: 1_000, // one Google HTTP 503 retry, within the original voter timeout and helper cap
  answerTimeoutMs: 150_000,
  enabled: () => process.env.ORBIT_MODE_ENABLED === "on",
};
