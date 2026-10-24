# Task handoff — simplify Courses workspace

- Date / owner: October 24, 2026 / Codex for Noah.
- Status: implemented locally; awaiting browser validation and release.
- Acceptance: only courses in navigation; equal priority-card height; centered event popup; remove requested slogans, term dropdown and duplicate calendar shortcuts; Graded Sections with section-only chat navigation/AI selection.
- Repository / branch: orbitaileadership/Orbit-AI, `codex/courses-simplify`; integrated origin/main `d911093` before edits. Implementation uncommitted.
- Working tree: courses API, course-hub TSX/CSS, assignment workspace, workspace CSS and these docs. Preexisting `.claude/launch.json` preserved.
- Changes: metadata filter removes legacy non-course projects from course responses; UI repeats the filter defensively. Course search is name-only with A–Z ordering. Removed course-level chat controls/list and study promotion; section workspace owns Resources/Chats navigation and AI choice. CSS removes sibling panel margins and equalizes grid row heights; native dialog has fixed inset and automatic margins.
- Approval: Noah's Course workspace Updates request. Quiz retains its separate configuration workflow. Existing chat records remain in assistant history; no deletion or reassignment.
- Sources: `app/api/courses/route.ts`, `components/course-hub.tsx`, `components/course-hub.css`, `components/assignment-workspace.tsx`, `components/course-workspace-revamp.css`.
- Checks: local `npm run typecheck`, `npm run lint`, and `git diff --check` passed. No tests added/run; no browser check or production build in this task.
- Database: no migration or shared-data changes.
- Release: not pushed, merged or deployed.
- Limitations: actual desktop/mobile layout and signed-in flows still need validation. Legacy projects lacking course metadata are hidden from Courses but not deleted; historical course chats stay in normal chat history.
- Recovery: revert focused API/UI changes; no database rollback.
- Next / owner: preview desktop/mobile, especially unequal priority counts, calendar dialog and section chat navigation, then release with owner authorization.
- Authorization: deployment/merge not requested for these new UI changes; no paid provider calls needed.

## Release confirmation — October 24, 2026

User explicitly requested push and deployment. Implementation pushed as `bc1dfbc167526e69f3522d273d96a9388e1c9627`; PR #31 merged as `731eeef0793c9adb21484fed6b4a4509c0b57d8f`. Local production webpack build including TypeScript passed. Vercel preview `9z1ZVzAk5v95W734VG27Peve64jC` succeeded; Vercel reported successful deployment for the exact main merge commit at `https://vercel.com/orbit-ai7/orbit-ai/8KK5VigGhTm48vwqfxemvdsSKNzK`. Public site `https://orbit-ai-sand.vercel.app/` returned 200; unauthenticated `/api/courses` returned 401. No migration, paid calls or data deletion. Signed-in visual verification remains pending. This supersedes the earlier uncommitted/not-deployed checkpoint. Revert PR #31 for application rollback.
