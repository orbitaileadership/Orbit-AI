# Task handoff — Course Workspace V3

- Date / owner: October 25, 2026 / Codex
- Status: released to main and Vercel production; awaiting signed-in validation
- Task and acceptance criteria: Clearer graded-section UI, course → section → chat navigation in all AIs, and saved quizzes that open in the chosen AI and section.
- Repository / branch: Orbit-AI / `codex/course-workspace-v3` (based on V2 `876105b`).
- Working tree: see Git status at handoff; pre-existing `.claude/launch.json` is unrelated and untouched.
- What changed and why: removed duplicate syllabus/copy, promoted status selector, added provider-logo choices and a shared nested sidebar tree. Replaced the embedded quiz chat with a setup/saved-session screen and handoff to the selected AI chat. Quiz first turns use the existing atomic claim and budgeted generation.
- Important decisions and approval source: Noah's October 25 Course Workspace update; [decision record](../DECISIONS.md) and [plan](../COURSE_WORKSPACE_V3_PLAN.md).
- Relevant source: `components/course-chat-tree.tsx`, `components/course-quiz.tsx`, `components/assignment-workspace.tsx`, `app/chat/chat-app.tsx`, `components/orbit-chat.tsx`, conversation GET/list routes.
- Checks: After merging the latest `origin/main` (including feedback and larger chat context), TypeScript and lint passed; focused Vitest passed 145 tests / 9 files, including course/quiz, feedback, chat route and context efficiency. A production webpack build passed with network access (all 43 static pages generated). The earlier sandboxed full test run was stopped after local DB/network and worker failures; it did not pass. Independent second-model review identified three recovery/context issues and found no remaining correctness blockers after fixes; static review only.
- Database: `0024_course_chat_grouping.sql` from V2 is required. Read-only checks of production Supabase project `rcfnptnaoncfsavxgybc` on October 25 verified both conversation columns, all three triggers, and zero chats still pointing directly at a section folder. No migration was run in this task.
- Release: GitHub `main` `618235e` pushed October 25. Vercel [deployment `9MXgsE9xpYx96xaTkAv5mMaQq5XM`](https://vercel.com/orbit-ai7/orbit-ai/9MXgsE9xpYx96xaTkAv5mMaQq5XM) showed Ready, Production, exact SHA, and current domain `orbit-ai-sand.vercel.app`. Public home page loaded. No paid provider call or live student data used in validation.
- Known risks: signed-in desktop and phone journeys, Supabase behavior after 0024, and live quiz quality are not verified.
- Rollback/recovery: revert the V3 commit; preserve V2 database contract and do not reverse 0024 after data is written.
- Next action: verify signed-in course/section chat grouping and quiz handoff on phone/desktop.
- Authorization: Noah explicitly requested a push to main on October 25; no migration was run in this task.
