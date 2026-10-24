# Task handoff — Courses Workspace revamp plan

- Date / owner: October 23, 2026 Toronto; Codex for Jake.
- Status: planned; approach approval pending under ENGINEERING_PROTOCOL.md section 5.
- Request: Dashboard/calendar, one resource/chat section per graded event, and section-specific MCQ/short-answer/flashcard Quiz me sessions; calendar/meeting/invitation and Anki/Quizlet bridges.
- Branch / baseline: plan/courses-workspace-revamp from main 2cc360f, preserving prior Courses Hub and Orbit fixes.
- Deliverable: docs/COURSES_WORKSPACE_REVAMP_PLAN.md includes verified code foundations/gaps, data model, implementation order, external capability limits, privacy/cost safeguards and acceptance tests.
- Changes: planning documents only. No application code, migration, shared data, OAuth permission, invitation, deployment or paid provider call changed.
- Checks: inspected current UI, course routes/context/parser, section folder ownership, existing calendar connectors and quiz persistence. Checked official Google/Microsoft/Apple/Anki/Quizlet docs. Path/link and diff checks performed; application tests not rerun for documentation only.
- Key constraints: existing calendar auth is browser-held, not background sync; Apple subscription is read-only; Anki/Quizlet import is not account sync. Existing normal-chat quiz state does not establish Orbit quiz support.
- Next / owner: Jake approves approach, then engineering implements and validates on this focused branch. Shared migrations, real invitations, paid tests and production release retain their separate approval boundary.
