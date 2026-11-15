# Courses C7 — Prompt Optimizer

Status: **OFFLINE/MOCK** public-source review only. Baseline: `0a70fd1cba381bbb5c6cb9b7d1cebfbd7dfa340e`. No live/provider calls, prompt/model/provider edits, or application/test changes. Private held-out evidence and `.feedback-runs` were not read. Academic answer quality and cost were not measured.

## Contract and source support

A launched course study request should complete only when its response contains one schema-valid complete study set with the selected format and exact selected item count.

- [study-prompt.ts](../../../lib/courses/study-prompt.ts) requests “Generate exactly” the configured count using the matching widget schema. Its content guidance also requires honest disclosure when evidence is insufficient; format validation does not establish factual correctness or sufficient course grounding.
- [quality.ts](../../../config/quality.ts) explicitly instructs: “Return the complete set in one fenced orbit-widget JSON block; no separate answer list.” It requires every requested item and answer immediately. `quizResponsePrompt(format)` selects the corresponding schema.
- [schema.ts](../../../lib/widgets/schema.ts) validates `quiz`, `short_answer_quiz`, and `flashcards`, each with 1–30 items. [course-workspace.ts](../../../config/course-workspace.ts) and `studyConfig` bound the selected count to 1–30.
- [quiz-output.ts](../../../lib/courses/quiz-output.ts) currently accepts when **any** parsed candidate has the selected type/count. Consequently, an exact-size set plus an additional valid study set can pass, despite the one-complete-set instruction. The regular chat route uses this predicate to decide whether a completed launched study response must become a recoverable error.

## Least-scope recommendation

Keep the existing prompt contract. In the completion predicate, collect schema-valid study widgets across the supported response forms, require exactly one such widget, then compare its type and item count with the validated selection. Do not combine counts from split sets or let one matching set hide extra same-format or different-format sets. Avoid double-counting a bare object by treating whole-response JSON and extracted fenced bodies as alternative representations.

This is a recommendation for root implementation/verification, not an implemented or tested change in this role.

## Compatibility and limits

- Preserve a valid bare JSON response and `orbit-widget`/`json`/`JSON` fenced responses already supported by normalization and public tests. Prose surrounding a supported fenced set remains compatible. Bare JSON embedded in arbitrary prose is not an established supported form; no new extraction heuristic is needed.
- Count only validated `quiz`, `short_answer_quiz`, and `flashcards` sets. Ordinary prose, citations, calculator/chart/diagram widgets and unrelated code fences should not themselves fail completion. “One block” describes the complete study set; the public instructions do not clearly justify a response-wide ban on all other widgets or prose.
- Legacy `multiple_choice` is a distinct keyless widget and is not a complete study set under the current predicate or normalization. Do not silently broaden its treatment in C7.
- Public instructions support rejecting additional **valid study sets**. They do not establish a general malformed-extra-block rejection policy. Preserve schema parsing and existing fallback behavior unless separately authorized; this role does not recommend broader output policing.
- Root should verify exact sets in all three formats, extra valid same/wrong-format sets, split sets, missing/wrong-sized sets, and compatibility with prose/nonstudy widgets and accepted JSON forms. These are proposed checks, not reported test results.

Held C5 scoring, C6 export parsing and peer-owned Orbit O6 routing are excluded. Root owns dependency setup and testing. This review provides no release, deployment, live quality, academic-answer, or cost score claim.
