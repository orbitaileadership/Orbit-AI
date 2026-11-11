# Task handoff — Courses feedback review blocked before execution

- Date / owner: 2026-11-11 / Courses workstream coordinator.
- Status: blocked; four independent static role reviews completed. The executable feedback loop has not completed.
- Task and acceptance criteria: improve Courses/study correctness and persistence through Student Tester → Prompt Optimizer → Backend Optimizer → student execution → independent Outcome Reviewer. Start with synthetic tasks and mocked providers, then separately authorized real website submissions; check desktop and phone, preserve held-out separation, permit at most two repair attempts, and report quality and complete cost evidence.
- Repository / branch / baseline: orbitaileadership/Orbit-AI; `codex/courses-feedback-audit-20261111`; inspected main commit `ec6522390484d11d70437320be7019d44cf1cf21`. This documentation commit is a descendant of that frozen baseline; no application code changed.
- Working tree: no local checkout/worktree was available. A unique remote documentation branch was created through the GitHub connector; main and other branches were not modified.
- Important authorization: the current request explicitly authorizes continuous work, merges and deployments subject to cross-chat release coordination. Paid live tests and shared migrations still require separate approval. No fresh merge/deploy permission is needed merely to repeat the existing authorization.

## Independent handoffs

Four distinct agent instances performed read-only source review:
- Student Tester: `/root/student_tester`. Supplied synthetic undergraduate operations/electrical training sources and retained a separate held-out behavior packet for the reviewer.
- Prompt Optimizer: `/root/prompt_optimizer`. Reviewed training/public source only; found no evidence justifying a prompt rewrite. Recommended explicit source IDs and units in the task instruction.
- Backend Optimizer: `/root/backend_optimizer`. Traced actual storage, scoring and budget paths; no measured cost baseline.
- Outcome Reviewer: `/root/outcome_reviewer`. Independently checked findings and rejected overbroad conclusions. Actual underlying role model identities are unavailable; this is not evidence of different-model review.

No agent submitted a provider request, executed repository tests or inspected a working browser. No mock answer is presented as real. Repair attempts used: zero.

## Existing behavior verified in source

- Saved study sessions use `conversations.study_config`; saved responses/cards use `messages.content/study_cards`. Legacy chat grading uses `conversations.quiz_state`.
- Interactive MCQ scores compare choices to the generated answer key. Schema validity alone cannot prove that key is correct.
- Interactive MCQ progress and study navigation/self-checks use browser localStorage. Short-answer writes deliberately replace written responses with empty strings; short answers are explicitly self-marked, not automatically graded. Do not claim server or cross-device synchronization.
- Quiz create/reopen endpoints do not call a provider. Initial generation has an atomic ready-to-started claim; provider generation and each Orbit phase use reserve → call → settle. Helpers, retries, tools and evaluation must be included in any cost comparison. Uncertain settlement can retain the reservation charge and is not free.

Relevant source: [quiz API](../../app/api/courses/[id]/quiz/route.ts), [MCQ widget](../../components/quiz-widget.tsx), [study widget](../../components/study-session-widget.tsx), [widget parent](../../components/chat-widgets.tsx), [study prompt](../../lib/courses/study-prompt.ts), [output validation](../../lib/courses/quiz-output.ts), [legacy scoring](../../lib/chat/quiz.ts).

## Focused finding and next candidate

Both widget restore effects return immediately when storage scope disappears, and their storage-read exception paths leave previous state in memory. The parent keys these children by widget JSON only. Under reuse with identical widget content and changed scope, prior choices, self-checks or typed answers may remain visible rather than resetting to the new session. This is a conditional code-path finding, not a browser reproduction or demonstrated cross-user exploit.

The parent remounts changed widget content. A suggested shorter-question-set crash is therefore not established as an application defect and should not justify a patch by itself. Verify actual caller identity changes before selecting a fix. Keep any candidate limited to progress ownership/reset and corresponding meaningful interaction tests; coordinate `components/chat-widgets.tsx` and shared study UI with frontend.

Acceptance after runtime recovery: same-device saved-session resume; scope changes and unavailable storage never inherit previous session state; typed short answers never persist; completed decks stay browsable; answer clicks/reveal/navigation issue no provider calls. Exercise actual mounted components, reloads and storage failures on desktop and phone. Existing static-markup tests do not establish those effects.

## Checks and scores

Actually performed: GitHub read-only source/document inspection at the frozen SHA; independent agent review; live GitHub main-ref and open-PR read. Documentation source paths checked against the frozen repository tree. No shell, lint, typecheck, unit/integration, build, browser, screenshot or mocked-provider test executed.

Outcome: unscored /70. Cost efficiency: unscored /30. Overall: unscored /100. There is no generated answer or measured same-task baseline. Proposed rubric: correctness 25, completeness 15, relevance 10, undergraduate clarity 10, sources 10; freeze the quality threshold and cost formula before comparison. Serious factual/source errors block quality approval. A workflow pass is not answer-quality approval.

## Blockers, release and recovery

Environment `ccarenv_b64_Y2NhcmVudl8yNzYzMmVlMTgwMjQ4MTkxOGYzZjU3MmY0NWMyYmZmZA` failed during container creation: snapshot_metadata_failed / gateway_unavailable / HTTP 502. A later status also failed to query executor capabilities. This is an infrastructure failure, not an approval denial.

A read of open PRs found [production rollback PR #75](https://github.com/orbitaileadership/Orbit-AI/pull/75), head `93fe8fecf5c2728d4317455d2c27e8ea067d2ec3`, targeting `codex/pdf-only-production`. Its report describes a wrong live quiz key after PR #74. This workstream has not independently reproduced that incident or approved the rollback. Reconcile its latest status first.

[Current state](../CURRENT_STATE.md) and [feedback release protocol](../FEEDBACK_AUTOMATION.md) describe production pinned to `codex/pdf-only-production`, separate from main. Fresh hosting target verification is still required. No global release lock or single coordinator shared by all four chats has been verified; a local controller lock cannot establish that coordination.

Database: no migration created or applied. Release: no merge or deployment attempted, no continuous controller enabled or existing run modified. Restore the execution environment, create the required isolated worktree, reproduce the focused finding, and run mocked/offline checks before candidate review. Establish one shared release coordinator or verified shared lock across all four chats; fetch/integrate current target and revalidate the exact candidate before each serialized merge/deploy, then verify the deployed SHA and changed flow. If that coordination cannot be established, pause release and resolve with the user/control-room chat.

Next owner: Courses chat for runtime recovery and focused validation; control-room/release coordinator for rollback reconciliation, shared release serialization and production-target verification. Separate approval remains needed for paid live testing and shared database migrations.
