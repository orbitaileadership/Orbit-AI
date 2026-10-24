# Task handoff — centralized Courses Hub

- Date / owner: October 23, 2026 / Noah, implemented with Codex.
- Status: implemented and independently reviewed; awaiting signed-in staging validation.
- Task: central course library, upcoming work, course materials, assignment folders/chats, reviewed syllabus flows and study preparation in one responsive hub. User approved sustained implementation after the workspace memo.
- Repository / branch: `orbitaileadership/Orbit-AI`, `codex/courses-hub`, based on `608ad6d`; changes remain uncommitted. Pre-existing untracked `.claude/` is preserved.
- Changes: `components/course-hub.tsx` and CSS provide the hub; course/assignment controllers handle navigation, refresh, uploads and errors. Course details and file DELETE use `lib/courses/evidence.ts` to retain reviewed source files. Existing model/context/budget pipeline remains unchanged.
- Decisions / plan: `docs/COURSES_HUB_PLAN.md`, `docs/DECISIONS.md`, `docs/COURSE_WORKSPACE.md`. Study launches an editable prompt, not an adaptive quiz engine.
- Checks: TypeScript and focused ESLint passed. Relevant Vitest run (`npm test -- lib/courses app/api/courses app/api/files lib/folders`) passed 70 tests / 14 files, including seven new file-delete tests. Synthetic Chrome checks exercised actual components with mocked API/storage: home search/grid/list; course/material filters; mixed upload success/failure; deletion; assignments/status/chat return; study prompt; manual creation; syllabus revision review/source/confirm; load failure/retry; source retention; desktop and 390/320px layouts; dark mode and reduced motion. Expected synthetic 422/500 responses were exercised. Screenshots saved in this task's visualization directory. Temporary harness lives under ignored `node_modules/.cache/course-hub-preview/`.
- Database/release: no migration, shared database change, live provider call, merge or deployment. Existing migration 0018's shared status was not reverified.
- Final checks: full `npm run lint`, `npm run typecheck`, and `npm run build -- --webpack` passed. Production build generated all 40 pages. `git diff --check` passed (only Git line-ending notices). The synthetic preview server was stopped after validation.
- Risks: mocked APIs do not establish live storage, RLS or extraction quality. Source retention checks are not a transaction with concurrent reassignment/source updates. Study uses selective bounded excerpts. The first review attempt hit a usage limit; the completed retry and fixes are recorded below.
- Recovery: revert this focused UI/API change set; no schema rollback needed.
- Next action: signed-in synthetic staging journeys covering file/chat/folder deletion, source access and concurrent changes. Resolve findings before merge.
- Authorization: implementation is approved. Production release and paid provider checks remain separate.

## Iteration after user requested continued work

- Ignored in-flight UI refresh results during uploads/deletions, refreshed after mutations, and preserved partial-upload errors until explicitly dismissed/retried.
- Independent `gpt-6-astra` review succeeded after the earlier usage-limit failure. Fixed four findings: moved-file deletion bypass, chat deletion cascade, truncated chat attachment inventories, and folder deletion of previously moved sources. Final scoped re-review found no remaining blockers; nontransactional concurrency and live RLS/FK/storage behavior remain limitations.
- Evidence resolution now scans owned course references independently of current file placement, protects reassignment, and refuses incomplete inventories. Chat deletion detaches project-linked/evidence files; folder deletion detaches evidence files. Added route regressions and optional exact-count/row-cap behavior to the test double.
- Updated synthetic desktop/mobile browser suite passed, including mixed uploads, assignment chat return, review, dark mode, reduced motion and 320px layout. Typecheck passed after the final fixes. No shared database changes or paid calls.
- Full `npm test`: 631 tests across 81 files passed after final retention fixes. Full lint and TypeScript passed. Test doubles now exercise truncated query inventories but still do not implement database FK cascades or RLS.
- Final production webpack build passed after all review fixes (40 pages generated); diff whitespace check passed. Synthetic preview server stopped. Work remains local and uncommitted on `codex/courses-hub`.

## Shared file library iteration

- User asked to keep iterating/building/improving. Course and assignment files now use `components/course-file-browser.tsx`; icons and file tiles are shared, with display rules in `lib/courses/file-display.ts`.
- Added natural filename/type sorting, complete type filters, file counts, persistent drop/upload target, visible filename progress, keyboard focus, and accurate status/count labels. Assignment files precede chats. Existing owned course GET includes kind/page-count metadata; local uploads preserve it. No context selection, billing, or model-call changes.
- Focused course regression/display suite: 74 tests / 12 files passed. Lint and TypeScript passed. Expanded synthetic browser flows passed for both libraries, including CSV/image filters, sort/reset, assignment upload/delete, desktop and 320px grid layouts. Prior full-suite result (631 tests) belongs to the preceding iteration; it was not rerun for these presentation refinements.
- Screenshots: `courses-hub-assignment-files.png` and `courses-hub-assignment-files-mobile.png` in the task visualization directory. Live staging, RLS/storage and concurrent mutations remain unverified. Work is still local, uncommitted and not deployed.
- Shared-library production webpack build passed (40 pages). Final mobile CSS/filter refinements passed a repeated browser run and whitespace checks. `courses-hub-file-library.png` is a focused synthetic-data preview; the temporary server is stopped.
