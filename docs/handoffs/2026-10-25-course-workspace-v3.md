# Task handoff — Course Workspace V3

- Date / owner: October 25, 2026 / Codex
- Status: implemented locally; awaiting signed-in staging validation and release
- Task and acceptance criteria: Clearer graded-section UI, course → section → chat navigation in all AIs, and saved quizzes that open in the chosen AI and section.
- Repository / branch: Orbit-AI / `codex/course-workspace-v3` (based on V2 `876105b`).
- Working tree: see Git status at handoff; pre-existing `.claude/launch.json` is unrelated and untouched.
- What changed and why: removed duplicate syllabus/copy, promoted status selector, added provider-logo choices and a shared nested sidebar tree. Replaced the embedded quiz chat with a setup/saved-session screen and handoff to the selected AI chat. Quiz first turns use the existing atomic claim and budgeted generation.
- Important decisions and approval source: Noah's October 25 Course Workspace update; [decision record](../DECISIONS.md) and [plan](../COURSE_WORKSPACE_V3_PLAN.md).
- Relevant source: `components/course-chat-tree.tsx`, `components/course-quiz.tsx`, `components/assignment-workspace.tsx`, `app/chat/chat-app.tsx`, `components/orbit-chat.tsx`, conversation GET/list routes.
- Checks: TypeScript and lint passed. Focused Vitest: 67 tests / 5 files passed, including quiz route, Orbit route, conversation GET, and tree. Full test run was stopped after sandbox-local DB/network and worker failures; it did not pass. Production builds could not complete in this environment: the webpack build could not resolve `fonts.googleapis.com` and then hit an `EPERM` in `.next`; a Turbopack attempt stalled and was stopped. Independent second-model review identified three recovery/context issues and found no remaining correctness blockers after fixes; static review only.
- Database: `0024_course_chat_grouping.sql` from V2 is required; not applied to shared database.
- Release: not deployed. No paid provider call or live student data used.
- Known risks: signed-in desktop and phone journeys, Supabase behavior after 0024, and live quiz quality are not verified.
- Rollback/recovery: revert the V3 commit; preserve V2 database contract and do not reverse 0024 after data is written.
- Next action: stage with migration 0024, verify signed-in course/section chat grouping and quiz handoff on phone/desktop, then seek release authorization.
- Authorization still needed: shared migration and deployment.
