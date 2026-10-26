import { afterEach, expect, it, vi } from "vitest";
import { getFeedbackSubmission } from "./submission";

afterEach(() => vi.unstubAllGlobals());

it("reuses the same id after a lost response when the user retries an unchanged report", () => {
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("submission-1") });
  const payload = { title: "Orbit issue", description: "A synthetic report" };
  const firstAttempt = getFeedbackSubmission(payload, null);
  const retry = getFeedbackSubmission(payload, firstAttempt);
  expect(retry).toBe(firstAttempt);
  expect(crypto.randomUUID).toHaveBeenCalledOnce();
});

it("starts a new id when a user edits a pending report before resubmitting", () => {
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("submission-1").mockReturnValueOnce("submission-2") });
  const firstAttempt = getFeedbackSubmission({ title: "First title" }, null);
  const editedAttempt = getFeedbackSubmission({ title: "Edited title" }, firstAttempt);
  expect(firstAttempt.id).toBe("submission-1");
  expect(editedAttempt.id).toBe("submission-2");
});
