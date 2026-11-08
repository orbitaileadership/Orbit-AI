# Automatic website feedback and release

Noah authorized automatic PR merging, production deployment, immediate continuation and plain-English Slack reports in the November 8, 2026 Working Chat. This supersedes the earlier requirement to ask for approval after every loop. The existing account budgets, payment-activation restriction and shared-database migration boundary remain. The runtime is the native Codex app with its connected GitHub/Slack tools and website browser; Node scripts persist and validate evidence but do not invoke agents or external services themselves.

## Scope and release target

- Repository: `orbitaileadership/Orbit-AI`.
- Production branch: `codex/pdf-only-production`, **not main**. Never merge the older coordinator branch's unrelated application history into production.
- Website: `https://orbit-ai-sand.vercel.app/`.
- Reports: Slack `#loop-feedback-report`, channel `C0CFVDUP3FG`.
- Runner source: isolated `orbit-ai-autorelease` worktree. Consult the saved heartbeat for the current private `.feedback-runs/` directory and user-facing loop numbering.
- Continuous loops have no aggregate USD cap by owner choice. Preserve actual per-account/provider limits and reserve → call → reconcile. Two website submissions can incur multiple Orbit provider calls.
- Routine automatic candidates are limited to app/components/config/lib source paths. The controller rejects migration, workflow, automation and billing/budget paths; those require separately scoped work. Never rotate credentials, activate payments, increase account budgets, alter branch protections or run shared migrations as part of a loop.

## Native four-role loop

1. Read AGENTS.md, engineering protocol and this document. Read `app-loop.mjs status` for the current run before acting. Start only from `ready`; reconcile an in-flight request from its existing conversation before any fresh send. Never edit state JSON or steal a lock to bypass a gate.
2. Parent acts as Student Tester/coordinator. Freeze realistic synthetic STEM/business undergraduate tasks with numerical references, units and assumptions: one training task and one held-out task. Use a fresh test-account conversation for each task and keep cross-chat memory off. Never use student coursework or private conversations.
3. Select a concrete mode from the current grant, verify its visible model/effort, and journal `submit` before clicking Send exactly once in the website. No direct API substitutes. Freeze the selected mode for that submission and save its exact prompt and timestamp.
4. Capture actual completed answers, visible mode before/after, conversation/reply IDs (label capture-local identifiers honestly), submission ID, timestamps and screenshot bytes/hash. For Orbit also record ballots, lead, effort and any disclosed exclusions. `capture` validates structure/hash, not authenticity; the reviewer must inspect the actual response and screenshot.
5. Fresh optimizer agents use `fork_turns=none` and only serialized minimal packets from `role-packets.mjs`: Prompt Optimizer sees training only; Backend Optimizer sees relevant source and telemetry only. Neither sees held-out questions, answers, private paths or reviewer transcripts. Optimizers have no tools. A fresh independent second-model Outcome Reviewer receives held-out rubric, actual response/screenshot evidence, exact proposed diff and executed checks; its only permitted tool is viewing the supplied screenshots. Record distinct role IDs and actual known model selections. This is context/tool-instruction separation, not an OS sandbox.
6. Parent inspects proposals, prepares the justified patch in a detached candidate worktree using `candidate.mjs`, and runs real mocked/offline lint, typecheck, tests and build. Preserve unrelated work. Do not make a patch merely to produce activity. Tests are required on the exact frozen candidate; changed contents invalidate earlier results.
7. Produce the exact `finish` report with captures, four role IDs, changes/paths/reasons/patch hashes, actual command/results, honest pass/fail/blocked verdict and no-change reason. Preserve the full evidence locally; never expose held-out content or credentials in public reports.

## Automatic review and release commands

Fresh continuous grants opt in with `automaticRelease` containing `kind: "automatic"`, the exact repository, targetBranch, productionUrl and slackChannelId above, and a real `approvalReference` to Noah's standing authorization. Existing grants are immutable; never reinterpret an old manual run as automatic.

After `finish`, save a second-model review artifact bound to `state.review.reportSha256`, `candidateDigest` and `testsSha256`, with `verdict: "pass"`, matching reviewer ID, authorModel, reviewerModel and real evidenceReference. Call `automatic-review --input <JSON>` where JSON contains reportSha256 and reviewFile. This uses standing authorization while retaining frozen candidate, reviewer and test checks. A failed or blocked report cannot become a release.

For changed candidates, apply only that exact patch, commit only its paths as one local checkpoint whose parent is the reviewed baseline, and rerun relevant checks. Pass the actual verification logs/hashes to `complete-review`. For no change, acknowledge the reviewed report with `complete-review`; it proceeds directly to notification without a PR/deployment.

Use `release --input <JSON>` to journal and validate external actions. The schema and executable tests in `scripts/feedback/automatic-release.mjs` are authoritative:

1. `command: "claim", action: "publish"` records an actionId **before** pushing the exact local head to a unique loop branch and creating its PR against pinned production. Use the connected GitHub tool; never force-push. Search for an existing matching PR after an uncertain tool outcome, never blindly repeat. Save actual PR/head/base observations to a run-local evidenceFile; `command: "observe"` binds them to the claim.
2. Inspect GitHub PR metadata, all review threads/reviews, commit statuses and workflow jobs. Require the named **Offline verification** job and all relevant checks to pass on the exact PR head; Vercel Preview must also be successful. Check remote base/head immediately before merging. Save evidence with `command: "checks"`. A changed base or head requires a new candidate and review, never a stale approval.
3. `claim` the `merge` action, then call GitHub `merge_pull_request` with expected_head_sha and merge_method **merge**. Never bypass protection or use squash/rebase. Observe the actual merge and current production branch SHA. An uncertain merge is inspected/reconciled, not replayed. GitHub's repository auto-merge toggle is unnecessary: the native coordinator issues the checked merge itself.
4. Wait in this execution for Vercel's existing Git integration to deploy. Verify **Ready / Current** on the production URL and exact merged SHA. Run relevant live smoke checks, including the changed student flow when applicable, and record results bound to that SHA. `command: "deployment"` rejects failed, stale or mismatched observations. A Ready label alone is not proof the fix works.
5. Fetch and fast-forward the isolated source branch to that exact merge commit; the resulting tree must match the reviewed local checkpoint. `command: "sync"` checks the baseline before proceeding. Preserve unrelated work and fail on drift.
6. `claim` the `notify` action. Send the plain-English report to the authorized Slack channel and record its returned message URL with `observe`. If delivery is uncertain, inspect the channel and reconcile the existing post before any resend. The next loop is not ready until the receipt is recorded.

The checks validate supplied native-tool evidence; they are not an independent authentication system or replacement for honest external inspection. No credentials are stored in grants, code, reports or prompts.

## Timing, failure and restart

Begin the next loop **immediately in the same active execution** after verified deployment and Slack delivery return the controller to `ready`. A no-change pass continues after its report receipt. No additional start command or ten-minute delay is needed. Never overlap loops. The ten-minute heartbeat is a recovery wake after interruptions; it is not a deployment webhook. Keep the computer awake, app open and test browser session available.

On a visible terminal provider rejection, save failure evidence with matching submission/prompt/mode/URL, screenshot/hash, `status: "failed"`, `terminal: true`, errorCode and reviewerReference. `fail-submission` archives the attempt separately from successful captures and preserves its consumed submission count. Do not replay the question or report the failed loop as complete. A fresh run may test a different available model under Noah's authorization; record the failed mode in the report and exclude it until its allowance resets or availability is verified. Prefer an available lighter model; if even the light models are exhausted, move to another provider. Never silently substitute within a failed request. Unknown outcomes still require reconciliation before any new submission.

Use `stop` plus pause the heartbeat to stop work. Check stop state before each website send and release action. Missing session, failed validation, uncertainty, denied access or deployment failure stops the affected release. Report a new blocker once, without repeated unchanged Slack messages. Never automatically repeat a failed payment/credential operation or change provider budgets.

## Reporting and verification limits

Slack format: **What broke**, **What we fixed**, **What's next**. Keep it short, plain English and accurate. Say “nothing needed changing” or “not fixed yet” when true. Do not include raw error codes, commit hashes, file lists, prompts, credentials or held-out evaluation details; link the full sanitized handoff when useful. Martin the Manager's direct ChatGPT dot identity is unresolved; channel delivery does not prove a direct notification to him.

Local candidate builds use synthetic Supabase settings and mocked font assets to stay offline. They validate compilation, not live fonts or backend access, and must never be deployed. Vercel builds the committed source with its existing production configuration. CI runs without provider secrets and does not run live evaluations or shared migrations.
