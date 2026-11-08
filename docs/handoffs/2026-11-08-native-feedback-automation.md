# Native feedback automation — prepared, paused

Historical setup checkpoint. The later [continuous-feedback handoff](2026-11-08-continuous-feedback-approval.md) supersedes the mode, target, cadence and authorization details below and records the live provider failure.

## Owner clarification — local preview and student-selected modes

Noah authorized the Student Tester to choose whichever mode suits the task and specified local deployment only, retaining the decision to push. The native run is now initialized disabled at `http://localhost:3000/`, scope `local`, mode policy `student-choice`, with one provisional loop. No grant, submission or reserved spend exists. The paused heartbeat and execution protocol reflect this preference. The controller rejects public origins for local-scope runs and records a concrete selected mode before each submission; captures must match that immutable mode. Local hosting does not authorize paid inference or shared database actions. This configuration does not start a preview server.

- Date: November 8, 2026. Owner: Noah. Status: implemented locally; awaiting owner configuration and supervised live validation.
- Worktree: `C:\Western University\Computer Science\projects\AI Projects\Orbit AI\orbit-ai-feedback`.
- Branch/base: `codex/local-feedback-coordinator`, base `3306058fc2d82b2ae296d889e54ac1ff9ee36c79`. All changes remain uncommitted.
- Automation: `orbit-ai-four-role-feedback-loop`, heartbeat on this chat, hourly schedule, **PAUSED**. Creation and subsequent view/update confirmed through the app tool. Native state is initialized disabled; no live submission or grant exists.

## Changes since the mock coordinator

| Files | What changed and why |
|---|---|
| `scripts/feedback/app-loop.mjs`, `.test.mjs` | Native-app state controller with initially disabled authorization, durable pre-Send journal, no automatic uncertain-request replay, mode/response/screenshot validation, loop/submission/allowance caps, stop/restart/one repair, and evidence-backed reporting. Ten tests. |
| `scripts/feedback/candidate.mjs`, `.test.mjs` | Applies exact proposals only to detached candidate worktrees, preserves source work, checks provenance and runs allowlisted local checks. Saves actual outputs/exit codes and rejects source drift. Ten tests. |
| `scripts/feedback/role-packets.mjs`, `.test.mjs` | Minimal training-only optimizer packets; backend telemetry/source packet; independent reviewer packet with held-out rubrics and explicitly allowed screenshot inspection. Four tests. |
| `package.json` | Adds `feedback:app` and `feedback:candidate` entry points. No dependencies added. |
| `docs/FEEDBACK_AUTOMATION.md` | Concrete app heartbeat execution protocol: real native role agents, selected-mode website interaction, fresh conversations/memory controls, evidence capture, candidate testing, reporting and activation prerequisites. |
| `docs/LOCAL_FEEDBACK_COORDINATOR.md` | Distinguishes legacy mock CLI from the new native automation and links activation instructions. |
| This handoff | Actual implementation, verification, review and remaining owner actions. |

Native worker dispatch and browser actions run through the app's available tools under the saved heartbeat prompt. Node CLI code handles durable state and checks; it does not itself invoke agents or pretend browser captures are API answers. The Student Tester is the root app agent; fresh Prompt Optimizer, Backend Optimizer and Outcome Reviewer agents are launched with no inherited conversation. Browser-control inventory was read successfully without opening/submitting an Orbit conversation.

## Verification

- `npm run test:feedback`: **43 passed, 0 failed, 0 skipped**. Log: ignored `.feedback-runs/verification-native.txt`. Includes legacy 19 tests plus ten native-controller, ten candidate-pipeline and four role-packet tests.
- Candidate integration tests actually prepare disposable Git worktrees, apply synthetic patches, run syntax/diff checks, and finish controller reports from generated artifacts. Test suite covers failing syntax, blocked dependencies, removed credentials, outbound Node-network denial, source drift, packet isolation, evidence mismatch and repair-gate bypass.
- Scoped ESLint, Node syntax checks and `git diff --check`: passed. React auto-detection warning arises from no application dependencies installed in this worktree; lint uses the original clone's installed tool/config. An unused import warning was corrected.
- Independent read-only review found and corrected candidate artifact-directory mismatch, provenance/test claims, role identity checks, stop/resume repair bypass and reviewer screenshot access. Final review found no remaining blockers for the paused/live-disabled implementation. Reviewer did not independently run tests.
- No authenticated live website flow, real role/browser loop, paid provider call or full application build was run. Synthetic screenshots validate structure/hash checks, not authenticity. The supervised live acceptance check remains required.

## Remaining activation steps

1. Start and verify the local preview (currently configured as `http://localhost:3000/`). The student chooses each task's concrete mode/model/effort. Noah still sets loop/submission limits and a conservative spending allowance; establish a defensible per-submission bound covering every permitted route. Counters track owner-supplied allowances, not verified provider invoices or a guaranteed hard cost cap.
2. Open the chosen Orbit session with a dedicated synthetic account and cross-chat memory disabled; retain fresh conversations per task. Confirm the native UI can inspect the selected mode and capture responses/screenshots.
3. Explicitly authorize the bounded paid supervised run in this chat. Record the matching unexpired grant, authorize the initialized native controller, and perform one supervised loop. No generic setup request substitutes for paid-call approval.
4. Once that loop verifies the real path, activate the existing paused heartbeat. Keep the computer awake, Codex open and browser session available. Windows control may activate the browser window.

Optimizer access is constrained by fresh minimal packets and no-tools instructions. Native subagent tools do not provide an OS-enforced filesystem deny-list. The reviewer may use view_image only for the exact supplied screenshots. The candidate Node network guard and stripped environment protect ordinary trusted tests; they are not a hostile-code security sandbox. Use stronger OS/tool isolation before evaluating untrusted workers or patches.

Changes requiring review, failed checks, missing session/mode and uncertain outcomes stop progress. Shared migrations, commits, pushes, merges and deployment remain unperformed and unauthorized. The original worktree remains untouched. No software installation or Windows startup task was performed.

## Final verification after owner clarification

- `npm run test:feedback`: **48 passed, 0 failed, 0 skipped**; log `.feedback-runs/verification-local-choice.txt`. The initial rerun failed an existing interval-stop test. Reproduction exposed Windows `EPERM` during checkpoint replacement. The mock and native writers now share a bounded rename-only retry for `EPERM`, `EACCES`, and `EBUSY`; no role, browser submission or provider action is replayed. Two regression tests cover recovery and persistent failure. The three new native tests cover local scope and student-selected modes.
- Scoped ESLint, all feedback module syntax checks, and `git diff --check` passed. Independent read-only review found no blockers in the mode/scope changes or checkpoint repair; reviewer inspected rather than reran the tests.
- Native status remains disabled, local scope, student-choice policy, one provisional loop, zero submissions, zero reservations and no authorization. Heartbeat remains paused. Original repository status remains unchanged. No preview server or live loop was started.
