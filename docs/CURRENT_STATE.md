# Orbit AI — current state

Seeded October 19, 2026. Update after verified changes; this snapshot will age.

## Shared baseline

- Primary repository: https://github.com/orbitaileadership/Orbit-AI.
- Remote `main` verified during preparation: `dcd0b6ef19363138e97053a9945393b0bf303e83`.
- This chat recorded successful Vercel deployment of that revision after Jake explicitly approved the merge.
- Latest recorded checks on that application revision: 499 tests / 66 files, lint and production webpack build including TypeScript passed. These are local/synthetic checks, not a complete signed-in or real-provider launch certification.
- Audience/access rule: exact verified `uwo.ca`, with existing early-access/waitlist enforcement. Other Canadian institutions register waitlist interest; they do not receive app access through that form.
- Keep reserve → call → reconcile, ownership/RLS, privacy and disabled-payment requirements intact. Final pricing/billing lifecycle is not established by this file.

## Courses Workspace production release — October 23, 2026

User explicitly authorized deployment and production migration 0022. [PR #26](https://github.com/orbitaileadership/Orbit-AI/pull/26) merged at `a2ab9f9c95b1d419c2b5321f19a7a3617b70508d`. Vercel [production deployment](https://vercel.com/orbit-ai7/orbit-ai/8sXB8PLb8hp47jQqDccziBSnaPEq) reported **Ready**, Production, exact merge SHA, and assigned `orbit-ai-sand.vercel.app`. Public HTTP smoke: homepage 200; new calendar and quiz GET APIs return 401 `not_signed_in` anonymously. Migration 0022 applied and verified before merge; owner RLS/grants/metadata constraints correct, existing record counts preserved. This release supersedes the pre-merge state below. Signed-in uploads, actual delegated calendar integrations and real AI quiz quality remain awaiting controlled validation. No paid test calls or real invitations were made. See [release handoff](handoffs/2026-10-23-courses-workspace-release.md).

## Latest local Courses Workspace revamp — October 23, 2026

User-approved implementation is on `plan/courses-workspace-revamp` (base main `2cc360f`). Dashboard / Sections / Quiz, persistent local calendar, delegated Google/Outlook adapters, Apple `.ics`, named quiz sessions and Anki/Quizlet exports are implemented locally. **Release authorized; signed-in integration validation remains pending.** Migration `0022_course_workspace_calendar.sql` was explicitly approved and applied to shared project `rcfnptnaoncfsavxgybc`: RLS/four owner policies/anon denial/metadata constraints verified; existing aggregate record counts preserved. Release PR [#26](https://github.com/orbitaileadership/Orbit-AI/pull/26) tracks merge and Vercel production confirmation. This pre-merge record does not itself claim a completed deployment. No paid provider calls or real invitations were made. Final local suite: **744 tests / 87 files passed**, lint and TypeScript passed; synthetic desktop/375px journeys passed. See [implementation handoff](handoffs/2026-10-23-courses-workspace-revamp.md). This supersedes older local Courses interface descriptions below, without establishing deployment or live integration quality.

## Recent implemented changes

### Rolling usage limits — local branch, October 23, 2026

`codex/usage-windows` implements shared rolling 24-hour / 7-day / 30-day caps, with daily = monthly / 30 and weekly = monthly × 7 / 30. Monthly sizing is C$20 converted at the configured account FX rate. Settings and shared meters show colored percentages for students; authorized admins retain monetary details. Trial/lifetime entitlements still cap availability; payments remain disabled. Migration `0023_usage_windows.sql` is applied and verified on production Supabase `rcfnptnaoncfsavxgybc` following Noah's deploy request. It was renumbered from 0022 without changing its SQL after the concurrent Courses migration used 0022. PR #27 is pushed; app production rollout is pending. Current main's Orbit fixes and Courses calendar/quiz release are preserved.

Local checks passed: 668 tests / 86 files, lint, TypeScript, production webpack build, and synthetic actual-Settings desktop/mobile/dark/error/admin/student browser checks. Independent `gpt-6-astra` accounting review found no remaining blockers after corrections. Signed-in staging and true multi-session PostgreSQL contention remain unverified. See [handoff](handoffs/2026-10-23-usage-windows.md).

### Courses Hub — local branch, October 23, 2026

Follow-up presentation refinement: course and assignment files now share a searchable grid/list library with natural filename/type sorting, complete type filters, upload progress, and truthful reading-status labels. Assignment files precede chats. The focused suite passed 74 tests / 12 files and expanded desktop/320px browser journeys passed; see the handoff for the preceding full-suite result and remaining live-validation limits.

`codex/courses-hub` contains the centralized course library, My week, course sections, assignment/file/chat polish, and reviewed-source deletion protection. It was committed and pushed at `8e8d730`; deployment is not verified here. The full local suite passed 631 tests across 81 files; synthetic desktop/mobile flows passed, including 320px layout, partial upload failure, error recovery, syllabus review and assignment-chat return. Independent `gpt-6-astra` review completed: four retention/cascade/inventory findings fixed and final scoped re-review found no blockers. Lint and TypeScript passed. Signed-in staging and concurrent database/storage behavior remain unverified. See [handoff](handoffs/2026-10-23-courses-hub.md) for final checks and limitations.

| Change | Recorded state / source |
|---|---|
| Old repository migration | Source/history and legacy branches preserved in the new repository; migration commit `752758f`; `docs/REPOSITORY_MIGRATION.md` |
| GitHub context handling | Shared input allocation, bounded file pagination and source-shortening disclosure preserved; `docs/ARCHITECTURE.md` |
| Landing and signup | Public landing, single institution-aware signup, Western verification and other-institution waitlists restored in the migration; `docs/PUBLIC_LANDING.md` |
| Shared Courses | Restored; migration `0015` applied to the shared database in this chat |
| Visual/scanned syllabi | `1e49ef9` added native PDF handling, owned evidence references, review and editing support |
| Expanded syllabi | `5dc555a`: 48k estimated text input, 8k output, 240 chunks; 20 visual pages / 20 MB PDF limit; combined model capacity and budget still enforced |
| Token analytics | `dcd0b6e`: standard-chat token totals, depth chart, prompt-size/files/tools proxies, user/model/date filters; older reports retained below |
| Analytics database | `0017` applied; live function matched tested SQL, anonymous/student execution blocked, service-role execution allowed; synthetic empty-scope check passed |

## Database status: verify before changing anything

- Old and new app deployments were confirmed to use the **same Supabase database**. Do not create a replacement database or rerun every migration to set up a new chat.
- `0015` and `0017` were explicitly applied and verified in this conversation. The complete applied state of older migrations and `0016` was not independently audited here.
- Direct production correction after `0015`: revoked `anon` EXECUTE on `confirm_syllabus(uuid,jsonb)` because default grants survived the PUBLIC revoke. This correction is not encoded in the original `0015` file. Noah should capture it in an additive migration before provisioning a fresh database.
- A private rollback copy of six original project-provider assignments was saved in `orbit_migration_backup.projects_provider_before_0015_20261018`; it is not a complete database backup.
- Keep both `0013_ai_memory_consent.sql` and `0013_extensions.sql`. Applied state must come from database evidence, not sequence numbers alone.

## Next checks — proposed, not a newly approved roadmap

1. Noah verifies schema/access configuration, including `0016` and the recorded `0015` permission correction; records evidence in the access map.
2. Run synthetic Western desktop/phone journeys: signup/verification/login, syllabus upload → review → confirm → edit/status, and chat/model switching. Real scanned-PDF quality and signed-in live flows remain unverified by the local tests.
3. Verify the live admin dashboard through an authorized synthetic admin account. New prompt measurements accumulate only after deployment; historical calls cannot be assigned missing complexity metadata.
4. Reconcile stale setup/product/task notes, final public notices/contact details, and launch acceptance with current code and owner approvals.

The original launch target was October 19, 2026. A target date, passing tests and a successful deployment do not by themselves establish launch readiness.

## Course folders — production database update verified October 19, 2026

- Code merged into main at `e1b45546e53d9cae45cc043cf5e328fbfdf3a1c7`; Vercel reported deployment complete for that exact commit.
- Jake explicitly authorized applying the folder database update. Only `0018_course_folders.sql` was applied to Supabase project `rcfnptnaoncfsavxgybc`, production main, through its existing authenticated dashboard.
- The transaction checked project IDs and chat/file project links were unchanged. Before/after: 7 existing courses, 19 conversations, 18 files; zero folders created by the migration.
- Verified all four folder columns, validated shape constraint, enabled ownership trigger and existing projects RLS. Anonymous/authenticated direct execution of the trigger function is blocked.
- No prior migration was rerun, and no student content, provider settings, budget records or credentials were changed. Signed-in end-to-end folder creation/upload/chat checks remain pending.
- See `handoffs/2026-10-19-folder-database-update.md` for evidence and rollback considerations.


## Accounting accuracy branch — October 20, 2026

Phase 1 implementation is integrated on `fix/accounting-accuracy-current-main`, based on current main `1404a26`. See [ACCOUNTING_ACCURACY.md](ACCOUNTING_ACCURACY.md) for semantics, tests, configuration and rollout constraints. Reporting migration 0020 is local-only and has not been applied to the shared database. The app, billing integrations and paid evaluations have not been deployed or run. Production cost reconciliation remains unverified.

## October 22 — Orbit Google voting availability

Deployed diagnostics from PR 21 identified Google `google-default` voting failures as HTTP 503 (`unavailable`) on the owner's post-release attempt. The owner approved deployment of `fix/orbit-google-recovery`: try Google on every turn, retry one eligible pre-stream 503, then explicitly disclose a three-provider vote if Google remains unavailable. Google returns automatically on the next turn where its ballot succeeds. Each attempt retains separate reservation and existing uncertainty handling within the original helper cap. PR 22 merged at d2d5ba1 and its production deployment was verified Ready on orbit-ai-sand.vercel.app. Synthetic tests do not establish live Google recovery. See [recovery handoff](handoffs/2026-10-22-orbit-google-recovery.md).


## October 23 — Google vote timeout correction

The owner reported another Orbit failure after PR 22. Production logs show a Google voting failure without an HTTP status after a 31.34-second invocation, consistent with the configured helper timeout. Branch `fix/orbit-google-timeout` extends the disclosed three-provider fallback to the caller's verified Google voting deadline, with no extra timeout retry or budget increase. User cancellation still stops. PR 24 merged as ab393aa and Vercel production was verified Ready on orbit-ai-sand.vercel.app. 690 synthetic tests / 83 files, lint and production build including TypeScript passed; independent re-review found no blockers. Owner live validation remains pending. Evidence is recorded in [timeout handoff](handoffs/2026-10-23-orbit-google-timeout.md).

## October 24 — Orbit lead thinking control (local)

`feat/orbit-thinking-level` adds Low / Medium / High immediately left of Orbit Send, default Medium. Selection reaches the lead's native effort parameter; voting, specialist work, output caps and accounting stay unchanged. Invalid/unsupported settings fail before paid calls; no silent fallback drops explicit effort. Local tests: 782 / 91 files and synthetic desktop/375px flows passed; see [handoff](handoffs/2026-10-24-orbit-thinking-level.md). No migration or deployment; production release and paid live tests remain separate approvals.
