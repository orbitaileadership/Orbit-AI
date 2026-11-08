# Local feedback coordinator

Status: mock runner plus native app automation integration. Live execution is disabled pending owner setup and validation. Node 24 is the locally verified runtime. See [FEEDBACK_AUTOMATION.md](FEEDBACK_AUTOMATION.md) for the actual app-agent/browser workflow, authorization controller, candidate worktrees and local test pipeline. The commands below remain the deterministic mock path.

## Scope and roles

This development workflow coordinates four roles outside the student application:

- Student Tester: creates synthetic undergraduate STEM and business tasks and obtains responses through the selected execution adapter.
- Prompt Optimizer: receives training cases only. Evaluation questions, reference answers, and individual evaluation responses are withheld.
- Backend Optimizer: inspects routing, cache and cost evidence, preserving reserve → call → reconcile and model identity. Mock observations cannot establish real cache savings or provider quality.
- Outcome Reviewer: separately evaluates responses and workflow integrity. Optimizer approval never substitutes for reviewer approval.

Bundled roles are deterministic mocks, not autonomous model-powered engineers. Role adapter boundaries make the workflow testable without paid calls. A new adapter is trusted code: packet separation does not sandbox a process that has filesystem access. Before attaching real optimizer agents, restrict their workspace and tools so they cannot read evaluation storage, student/reviewer transcripts, or private reports. An instruction alone does not enforce that restriction.

## Mock operation

Run commands from the isolated worktree. The run directory must be dedicated to this coordinator; keep it under ignored `.feedback-runs/` and out of source control.

```powershell
npm run test:feedback
npm run feedback -- init --run .feedback-runs/demo --loops 3 --interval-ms 1000 --mode "Orbit / Medium"
npm run feedback -- run --run .feedback-runs/demo
npm run feedback -- status --run .feedback-runs/demo
npm run feedback -- stop --run .feedback-runs/demo
```

The runner can progress automatically for a bounded number of loops while its process and computer remain on. It is not installed as a startup service or scheduled task. Mock execution does not require the Orbit website. Keep the terminal open; use a second terminal for stop/status. Suspended computers do not perform work.

Use `resume` with the same run directory after a graceful stop. An uncertain interrupted stage must be reconciled explicitly; do not blindly rerun a possibly submitted website request. The runner owns the lock and checkpoint lifecycle. Do not delete locks or edit state to bypass recovery checks. At most one explicit recovery attempt is allowed by this run's policy.

```powershell
npm run feedback -- resume --run .feedback-runs/demo
# Only after inspecting an uncertain mock stage and confirming its prior process exited:
npm run feedback -- recover --run .feedback-runs/demo --ack-uncertain
npm run feedback -- resume --run .feedback-runs/demo
```

Stopping between stages pauses normally. Stopping during an active stage signals cancellation and records an uncertain failure, requiring explicit recovery. Adapters must honor AbortSignal; trusted in-process adapters cannot be forcibly terminated by this runner. A proposed change or failed review stops at `review_required` for human inspection rather than consuming more loops.

## Review artifacts

Each loop records the task, mock response, optimizer proposals, independent review result and checks. Changes are prepared as proposed patches for review, not automatically applied to application source. Reports must distinguish candidate changes from applied changes, and mock checks from commands actually executed against the repository. No-change outcomes are legitimate. Failed or unverified checks must remain visible.

Completed tasks and responses are retained in each loop's `evidence.private.json`. This file is private by workflow convention and ignored by Git, not protected by a separate operating-system access boundary. Do not give real optimizers access to the run directory.

The final report should identify the baseline commit, loop number, files/hunks, reason for each proposal, executed checks with outcomes, unresolved findings and release state. Any change after validation requires the affected checks and review again. Preserve unrelated staged, unstaged and untracked work. Do not copy secrets, `.env` files, real student data or authenticated browser state into run artifacts.

## Before live loops

The legacy mock CLI always rejects live mode. Native app execution uses the separate `app-loop.mjs` approval controller and the paused Codex automation; it starts disabled and requires explicit owner authorization recorded in the chat.

The native browser runtime is the app's computer-use tool, operated under FEEDBACK_AUTOMATION.md. It requires an explicitly authorized synthetic account/session. The Student Tester must open the Orbit website, observe the mode selected by the user, submit through the visible composer, wait for the actual completed response and preserve evidence. It must not call an AI provider or substitute a backend response for the website interaction.

`website-evidence.mjs` checks the expected site origin, unchanged selected mode, exact prompt and submission identifier, conversation/reply identifiers, completion state, capture times and screenshot reference. This is structural validation only: the trusted browser adapter and reviewer must verify the screenshot exists, its hash matches, and its visible content supports the response. The validator cannot authenticate caller-supplied JSON.

Before enabling live operation:

1. Specify the website URL, selected mode (including model/effort controls where relevant), allowed task scope, loop count and spending ceiling; obtain authorization for paid calls.
2. Perform the supervised browser acceptance check for the selected website/session. Mode mismatch, missing session and uncertain sends pause execution under the native protocol; live behavior is not certified by synthetic tests.
3. Journal a unique submission before clicking Send. After an interruption, inspect the saved conversation and reconcile it; never automatically resubmit an uncertain request.
4. Restrict optimizer access to training packets and approved source files. Give held-out evidence only to the tester and reviewer. Freeze evaluation sets for comparison; keep review details out of optimizer retry inputs.
5. Run fresh native app role agents with the generated packets and use candidate.mjs for isolated patch application and real local checks. Supply installed dependencies if lint/typecheck/tests/build need them. Confirm required checks actually pass.
6. Verify actual desktop/phone website capture with a synthetic account under a separately approved live test. Then activate the already prepared paused app heartbeat.

Merges, pushes, deployment, shared migrations, payment activation and paid evaluations remain separate actions requiring authorization. Local mock success does not certify live response quality or production readiness.
