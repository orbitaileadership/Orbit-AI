# Complete source migration to orbitaileadership/Orbit-AI

## Sources and history

- New repository base: fad7980 (organization main, including its context-limit fix).
- Legacy main: b6cc5b1.
- Final legacy fix branch: 87479e3, which includes legacy main and the reviewed context-limit fix.
- Organization initial snapshot 938904f and legacy b758dd6 have identical Git trees: e0f609796d771ead14befe513cb2f0b10e4c0622.

The histories are joined at the verified matching snapshot without changing files or rewriting the new repository. A normal merge then imports the remaining legacy updates. All legacy branch tips (Jake, codex/course-workspace, codex/orbit-mode, main and fix-github-context-budget) are reachable through the final legacy branch and included in the merged history. The old repository has no tags to transfer.

## Restored updates

- Shared course workspace, syllabus review/import, assignments, notes, and cross-provider course context.
- Simplified public landing page and unified institution-aware signup.
- Western verification and login-routing regression checks.
- Institution-specific public waitlists and server-side institution validation.
- Institution branding assets and public notice routes.
- Engineering protocol and references for future agent sessions.
- Database migration files 0015 and 0016 and their local database tests.

The organization context-limit update is preserved. All 308 tracked files from the final legacy branch are present. Runtime source, configuration, tests, assets and migration files match that branch exactly. Differences are documentation only: retained organization validation notes and this migration report.

## Validation and deployment boundaries

458 tests across 59 files, lint, generated route types/TypeScript, and the production webpack build passed. Independent review found no source-integration blockers. Imported SVG whitespace/CRLF is preserved byte-for-byte. No provider calls were made for migration verification.

The user confirmed the new and old deployments use the same Supabase database. This is a source/history migration; no student data was copied and no shared database migrations were executed. The restored Courses and waitlist code requires schema migrations 0015/0016 to already be installed. Live signed-in validation and target schema state were not independently verified in this session. GitHub issues/PR metadata, repository settings, hosting secrets and service permissions are not source-controlled files and are not copied by this merge.
