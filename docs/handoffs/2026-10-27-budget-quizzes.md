# Task handoff — budgeted MCQ prefetch

- Date / owner: October 27, 2026 / Codex for user.
- Status: implemented locally, awaiting review and signed-in validation.
- Acceptance: default 10 MCQs; requested count respected; prepare remaining questions while the student answers; private keys/server grading; combined quiz reservation cap = 1% of full daily allowance; no duplicate paid generation.
- Repository / branch: `orbitaileadership/Orbit-AI`, isolated `codex/quiz-cost-prefetch` worktree based on local HEAD. Changes are uncommitted; original D: checkout and its existing package-lock change are preserved.
- Decisions: user explicitly clarified **entire quiz**; savings take priority over quality. Batch remaining questions in the background to avoid 10 repeated-context calls. Exact scope/tradeoffs: [QUIZ_BUDGET.md](../QUIZ_BUDGET.md).
- Relevant files: `config/quiz.ts`, `lib/quiz/`, `app/api/quiz/`, `components/budget-quiz.tsx`, chat/course entry points, migration 0027, and new regression tests.
- Checks: TypeScript, lint and production webpack build passed. The last full suite had **870 passing / 3 failing tests (873 total, 107 files)** before the final incomplete-usage test was added. All three failures reproduced in the unchanged original checkout: two `course folders` assertions in `test/financial-database.test.ts` and one migration-compatibility assertion in `app/api/courses/route.test.ts`. The final focused rerun had **23 new quiz tests passing across four files**. They cover reservations/duplicate phases, hidden keys, owner isolation, default/explicit count, partial/unknown outcomes, background generation, immutable grades, and concurrent answer retention. Incomplete pricing information retains the full reservation; incomplete usage totals fail without exposing questions or dispatching a paid retry.
- Database: 0027 applied only inside disposable in-memory PGlite tests with all historical migrations. No shared or production migration.
- Release: not pushed, merged, or deployed; no paid provider calls. No browser use. Build initially failed on a cross-drive node_modules junction; a local dependency copy fixed it.
- Risks: real model JSON validity/latency, phone/desktop UX, live PostgreSQL contention, and independent financial/context review remain unverified. The broader every-prompt cap and alternate/legacy quiz formats remain outside this implementation.
- Recovery: application revert; retain private quiz state and ledger evidence. Unknown costs stay held.
- Next: independent review, signed-in staging validation, then separate migration/release approval.
