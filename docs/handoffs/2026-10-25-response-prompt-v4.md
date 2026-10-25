# Task handoff — response prompt v4

- Date / owner: October 25, 2026 / Jake (approval), Codex (implementation).
- Task: deploy the reviewed response-core draft; P1 response quality.
- Authorization: Jake approved the draft, requested tests, then explicitly requested deployment in this chat.
- Repository / branch / base: orbitaileadership/Orbit-AI, `feat/response-prompt-v4`, base `97b8b39` (current remote main at preparation).
- Changes: replace only shared response-core prose with the exact reviewed draft; retain multiple-choice and visual-widget contracts and existing study, source, voice and context assembly. Version `student-v4` is recorded through existing usage metadata. Update existing contract assertions to the reviewed wording.
- Local evidence: 107 tests / 6 files passed covering chat route, prompt/context, source selection, evaluation grader/accounting and completion adapters; lint and TypeScript passed. Production webpack build passed, including TypeScript and static page generation. Earlier draft-only validation passed 67 checks; those checks did not measure generated-answer quality.
- Live quality: not evaluated; the tested checkout has no provider credentials or dedicated evaluation-account configuration. No paid provider calls were made. Prompt wording remains an unmeasured quality hypothesis.
- Database: no migration.
- Release: authorized, pending PR/production verification. Final service evidence will be recorded in the task release report.
- Risks: live answer quality, hints/quiz compliance, identity wording and response style require real-provider observation. Application request, budget and completion behavior are unchanged.
- Rollback: revert this prompt commit to restore `student-v3` and its prior core; no data rollback.
- Next action: verify production exact-commit status and public access after merge. No additional release approval is required by this chat.
