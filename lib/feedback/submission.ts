export type PendingFeedbackSubmission = { id: string; fingerprint: string };

/** Reuse one id for an unchanged payload after an uncertain network outcome. */
export function getFeedbackSubmission(payload: unknown, pending: PendingFeedbackSubmission | null): PendingFeedbackSubmission {
  const fingerprint = JSON.stringify(payload);
  if (pending?.fingerprint === fingerprint) return pending;
  return { id: crypto.randomUUID(), fingerprint };
}
