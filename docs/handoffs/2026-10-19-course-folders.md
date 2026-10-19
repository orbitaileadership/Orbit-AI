# Task handoff — course folders and sidebar

- Date / owner: October 19, 2026 / Jake (product), Noah (engineering acceptance).
- Status: implemented locally; awaiting review and signed-in staging validation.
- Task: main sidebar lists pinned/recent folders; folders group chats and files; multiple folders belong to a course and open from its workspace.
- Repository / branch: orbitaileadership/Orbit-AI / `folders-course-navigation`, based on local workspace commit `e4deeff`; see the branch's implementation commit for the exact revision.
- Changed: folder create/edit/course membership, persisted pins/visits, reusable file management, standard and Orbit sidebar lists, course Folders tab/overview shortcut, folder launch/filtering, additive migration and regression tests. Existing courses and direct chat/file links are preserved.
- Approval: Jake explicitly requested these folder semantics in this chat. P1 student organization/navigation; no release authorization assumed.
- Validation: lint and TypeScript pass; full synthetic/local suite 510 tests across 68 files; final focused regression run 27 tests; final webpack production build passes. Checks used an isolated source copy, with local historical `_local` archives omitted and no service secrets copied. Desktop and 375px phone synthetic browser checks cover folder selection, pinning, course tab, creation of a second course folder, default course selection, and launching the folder into Orbit. Temporary preview fixture was removed; no authentication bypass or preview route ships.
- Database: `0018_course_folders.sql` prepared and exercised in isolated PGlite tests (multiple folders, owner isolation, parent validity, immutable types, persistent pins/visits, course deletion preserving folder chats/files). NOT applied to shared Supabase. No production migrations, credentials, paid provider calls, deployment or push performed.
- Limits: validate actual signed-in storage uploads, persistence across sessions/devices, course folder navigation and both chat modes in staging after the approved migration. Folder context includes its own files/instructions; parent-course materials are not automatically included. Existing legacy direct course chats/files are not relocated.
- Release/rollback: review and apply only the additive 0018 migration before enabling folders. The reviewed code preserves existing course access if it is deployed before that migration. To roll back code after migration, retain the new schema and data; the old course listing does not distinguish folder rows, so restoring the previous UI requires explicit compatibility review. Never drop populated folder metadata without a reviewed backup/recovery plan.
- Next action: Noah reviews the migration and code; obtain the applicable approval for a shared migration and deployment, then complete signed-in staging checks. The local branch is ready for review.

## Pre-merge review — October 19, 2026

Jake explicitly requested push and merge into main. Independent second-model review identified and verified fixes for schema-before-code compatibility, legacy course file/Python capabilities, and deleted-folder state across providers; no remaining merge blockers were found. Final validation: 513 tests / 69 files, lint, TypeScript and webpack production build pass. Existing course access falls back safely when 0018 is absent; folders remain unavailable until 0018 is approved and applied. The shared database remains unchanged. This merge authorization does not authorize the database migration. The branch also includes the previously approved workspace-context commit e4deeff.

## Database applied — October 19, 2026

Jake subsequently authorized the database update. Only 0018 was applied and verified on the existing production database; all 7 courses, 19 chats, 18 files and their project links were preserved. See `2026-10-19-folder-database-update.md`. Code commit e1b4554 was merged to main and Vercel reported deployment complete.
