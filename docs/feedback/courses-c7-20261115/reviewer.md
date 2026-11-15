# Courses C7 — independent outcome review

**OFFLINE/MOCK scoped pass.** Reviewed November 15, 2026 against baseline `0a70fd1cba381bbb5c6cb9b7d1cebfbd7dfa340e`. No serious scoped error remains. This review measures completion-contract behavior with fixed synthetic outputs; it does not establish real generated-answer quality, production readiness or cost savings.

## Candidate and independence

The application diff changes only [quiz-output.ts](../../../lib/courses/quiz-output.ts): collect schema-valid study widgets, require exactly one, then check the selected format and exact count. [Focused tests](../../../lib/courses/quiz-output.test.ts) cover each format, supported JSON forms, counts 1/2/30, duplicate/mixed/wrong-sized extras in either order, split sets, and surrounding prose with a valid nonstudy chart. No prompt, model, provider, route, schema, migration, C5 scoring, C6 export-parser or Orbit O6 cleanup change is included. The reviewed application file SHA256 is `79eab05f5f9e83c7314961e83451bd831b039c4dbdb43187c450a28483d2d8be`.

The reviewer read the frozen private packet directly from the Student Tester, independently verified its original hash and reran its evaluator against baseline and candidate. No private questions, answer keys, outputs, case identifiers or failure details are reproduced here or supplied to optimizers. Optimizer recommendations use public material only. The coordinator conservatively counted two application/test submissions, exhausting the two-submission limit; no further application repair was requested. A chart-fixture correction, evaluator local-variable rename for lint, and browser assertion/selector refinements are disclosed as verification changes; acceptance criteria and packets were not changed.

## Evidence and result

| Evidence | Baseline | Candidate |
| --- | --- | --- |
| Public completion cases | 9/15 | 15/15 |
| Frozen private completion cases, independently rerun | 15/27 | 27/27 |
| Private MCQ | 5/9 | 9/9 |
| Private short answer | 5/9 | 9/9 |
| Private flashcards | 5/9 | 9/9 |
| Public browser fixtures at both 1440px and 375px | 18/30; 12 false accepts | 30/30 |

The actual local validator/schema/expression modules are loaded by the [public evaluator](student-public/evaluate.mjs), which permits only those dependencies and makes no provider/database call. The final evaluator's mechanical lint correction was inspected and the private candidate rerun still passed 27/27. Public [baseline](checks/baseline-public.json) and [candidate](checks/candidate-1-public.json) results retain the visible expected/actual comparisons.

The [browser harness](../../../scripts/feedback/courses-c7/browser.mjs) mounts the existing production widgets with public synthetic outputs and actual baseline/candidate completion predicates. The reviewer inspected the harness, [final results](browser/results.json), and all six final screenshots. Sixty baseline/candidate journeys ran; six same-browser localStorage/reload checks passed; there were no reported page errors, unexpected network requests, horizontal overflow or screenshot failures. Rejected candidate fixtures show the existing retry message and no widgets. Supporting charts remain compatible.

The reviewer independently reran focused validator tests: **21/21 pass**. Root-run final logs were independently inspected: full Vitest suite **985/985 across 111 files**, feedback-controller tests **64/64**, final lint **pass**, typecheck **pass**, and production `npm run build -- --webpack` **pass**. The reviewer also ran the scoped diff whitespace check: **pass**. Initial lint caught a public evaluator variable-name rule; it was corrected. Initial full tests/build encountered sandbox symlink/loopback/directory permissions; the final authorized offline reruns passed. Those initial failures are not omitted or attributed to the candidate.

## Workflow, sources, storage and practice results

The one-set rule is supported by the explicit task and [quality.ts](../../../config/quality.ts) instruction to return the complete set in one block. [study-prompt.ts](../../../lib/courses/study-prompt.ts) supplies the exact requested count; the existing [widget schema](../../../lib/widgets/schema.ts) remains the authority for required keys, bounds and usable answers. The candidate counts only validated MCQ, short-answer and flashcard sets. Bare JSON and supported fences retain their existing normalization; invalid extra blocks, unrelated widgets and prose retain existing behavior. It neither combines split sets nor uses an exact matching set to hide additional valid study sets.

Server source review shows the standard-chat gate runs only when owned, validated launch instructions are active, after response cleanup and before final status/content storage. Existing complete-status checks gate stored study cards, quiz-state updates and memories. Explicit retry, provider settlement and accounting paths remain unchanged; an invalid response can still have incurred provider cost. Both chat routes use the shared predicate, but the browser fixture does not dispatch either route. Orbit O6's separate cleanup work is excluded.

| Format | Observed safe fixture | Correct interpretation |
| --- | --- | --- |
| MCQ | Browser reload preserves selected choice; completing the two items displays 2/2. | Match to the supplied generated key; no official grade or factual-quality proof. |
| Short answer | Reveal/self-check survives reload; written text reopens blank; completion displays 1/2. | Student self-marking against a sample, with no free-form automatic grading. |
| Flashcards | Reveal/self-check survives reload; two cards reviewed, one marked known. | Browser-local review tracking; no verified mastery claim. |

Screenshots at [desktop](browser/candidate-mcq-1440.png) and [phone](browser/candidate-mcq-375.png), plus corresponding short-answer/flashcard files, show accurate grading/storage disclosures. The synthetic source keys used by the public tasks are consistent with their supplied notes. This does not score the factual accuracy or pedagogy of a newly generated response.

## Scoped MOCK rubric

| Criterion | Score | Basis |
| --- | --- | --- |
| Correctness | 20/20 | Expected structural outcomes pass across all three formats; no serious scoped error. |
| Completeness | 14/15 | Format/count/uniqueness, compatibility and local practice checks pass; fixture stops before dispatched save routes. |
| Relevance | 10/10 | Minimal change addresses the demonstrated one-set contract failure. |
| Clarity | 14/15 | Completion/retry and grading/storage copy is truthful; end-to-end signed-in outcome remains unobserved. |
| Sources | 10/10 | Exact baseline, source-backed contract, original synthetic tasks and independently frozen evidence are traceable. |
| **Total** | **68/70 — PASS** | Threshold 56/70, correctness at least 16/20, and no serious error satisfied. |

This is a **MOCK structural/workflow score only**, not an academic-answer score. **Actual academic quality /70: UNSCORED. Actual all-call cost /30: UNSCORED.** No paid provider experiment, generated-answer comparison, or reconciled all-call cost dataset was supplied. Development agents, evaluation/judge work, failed/uncertain calls, retries, tools and auxiliary calls must be included or explicitly reconciled in any future cost comparison; zero live calls here does not establish zero total development cost.

## Limits and handoff

No signed-in generation, durable database save/reopen, RLS/storage journey, cross-device progress sync, live provider quality or actual cost/latency was demonstrated. Standard-chat final database updates have pre-existing unchecked error returns, so a terminal completion event alone does not prove a durable save. The safe fixture explicitly simulates completion display around the real widgets; it is not production-route validation. Malformed extra blocks retain existing fallback behavior; later follow-up messages retain existing gate activation behavior. Neither is broadened by C7.

The reviewer made no application/test edits, external messages, provider/database calls, deployment, merge or push. Public role handoffs are [Student Tester](student-public/STUDENT_HANDOFF.md), [Prompt Optimizer](prompt-optimizer.md), and [Backend Optimizer](backend-optimizer.md). Coordinator owns the final local handoff/check summary and any separately authorized release decision. A future live paired evaluation would need the same task-quality targets, independently reviewed outputs in each format, signed-in durability evidence, and reconciled all-call totals before scoring academic quality or economics.
