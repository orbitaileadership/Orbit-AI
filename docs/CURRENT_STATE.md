# Orbit AI — current state

## Large-file uploads and in-app previews — local staging, October 27, 2026

On `codex/large-file-preview`, private resumable uploads accept supported documents up to 512 MiB. A Docker worker converts Office files to private PDF renditions and indexes page-scoped text for bounded retrieval. The feature is **not deployed**. [Plan](LARGE_FILE_PREVIEW_PLAN.md), [local setup](LOCAL_DOCUMENT_WORKER.md), and [local validation handoff](handoffs/2026-10-27-local-supabase-document-worker.md) cover the release gates.

Local Docker Desktop 4.97.0 / WSL 2.7.14 and an isolated Supabase stack applied all 28 historical migrations, including 0026, through uniquely numbered disposable copies. Global and bucket Storage limits were 536870912 bytes. Synthetic DOCX conversion/indexing, 20,971,521-byte resumable text upload/indexing (14,980 chunks), and exact 536,870,912-byte resumable upload passed. A synthetic account signed in and opened a chat attachment; its preview API returned a ready private PDF. The in-app browser did **not** visibly paint the embedded PDF (blank/black frame, including a temporary sandbox diagnostic that was reverted), so visual preview still needs verification in a standard browser on desktop and phone. Synthetic test account, chat, file row and both Storage objects were removed after validation. Docker published local ports on all interfaces; an enabled inbound Windows firewall block for 54321/54322/54324 is required and was verified locally, but not from a second machine.

The worker is locally validated only. Production migration, Storage settings, worker deployment, shared keys, and paid provider checks remain untouched. Interrupted-upload resume, large Office load, cross-user preview denial, and signed-in standard-browser rendering are still release gates.

## Response prompt v5 — local branch, October 26, 2026

`codex/chat-response-quality` shortens the shared student response contract and omits text-widget schemas from voice prompts. Text chat still supports multiple-choice and interactive visuals, with a more explicit invitation to add a useful visual without a direct request. All four provider chats and Orbit lead responses use the shared contract. Local validation and prompt-size measurements are in [the response-quality note](RESPONSE_QUALITY.md) and [handoff](handoffs/2026-10-26-response-quality-v5.md). Live provider quality, latency and billed token comparisons remain awaiting approval and validation. This branch has not been merged or deployed.

## Course Workspace V3 production release — October 25, 2026

`codex/course-workspace-v3` added nested course/graded-section chat navigation, streamlined section UI, and saved quizzes that open in the selected provider or Orbit chat. It builds on V2. Production Supabase read-only checks verified both required conversation columns, all three migration 0024 triggers, and zero ungrouped section chats; this supersedes the earlier unverified migration note below. GitHub `main` advanced to `618235e`; [Vercel production deployment](https://vercel.com/orbit-ai7/orbit-ai/9MXgsE9xpYx96xaTkAv5mMaQq5XM) reported Ready for that exact SHA and listed `orbit-ai-sand.vercel.app` as a current domain. The public home page loaded. Signed-in course and quiz journeys on phone/desktop remain unverified. See [plan](COURSE_WORKSPACE_V3_PLAN.md) and [handoff](handoffs/2026-10-25-course-workspace-v3.md).

## Local Course Workspace V2 — October 24, 2026

On `codex/course-resources-v2`, section Resources remain independent while Course Details holds the shared syllabus. Section chats and quizzes are prepared for parent-course grouping with explicit section context via local migration 0024. Independent review found and prompted fixes for section moves/deletions. Focused synthetic and isolated database checks are recorded in `handoffs/2026-10-24-course-resources-v2.md`. Migration 0024 has not been applied to the shared database; this version has not been deployed or validated in a signed-in browser.

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

`codex/usage-windows` implements shared rolling 24-hour / 7-day / 30-day caps, with daily = monthly / 30 and weekly = monthly × 7 / 30. Monthly sizing is C$20 converted at the configured account FX rate. Settings and shared meters show colored percentages for students; authorized admins retain monetary details. Trial/lifetime entitlements still cap availability; payments remain disabled. Migration `0023_usage_windows.sql` is applied and verified on production Supabase `rcfnptnaoncfsavxgybc` following Noah's deploy request. It was renumbered from 0022 without changing its SQL after the concurrent Courses migration used 0022. PR #27 merged as `78fad083ceaa7710c705179ecaaa3a91eb3e3303`; Vercel production `FTSyYHFncLMhe8L6XSro99sZXNZM` verified Ready with `orbit-ai-sand.vercel.app` on October 23, 2026 at 11:59 PM Toronto. Public home returned 200 and unauthenticated usage API returned 401. Current main's Orbit fixes and Courses calendar/quiz release are preserved.

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

## October 24 — Orbit cost-selected voters (local)

`feat/orbit-cost-selected-voters` uses price-selected ballot models and explicitly disables Haiku 5.5 thinking for its bounded 256-token ballot. Lead answers and specialist candidates are unchanged; no live quality comparison was run, so voting quality parity remains unverified. The token-price estimate at configured input/output caps decreases from about US$0.0347 to US$0.0149 per four-model vote; this excludes reservation margins, retries and provider billing variance. Existing reservations and reconciliation remain in place. No provider calls, merge or deployment. See [handoff](handoffs/2026-10-24-orbit-cost-selected-voters.md).

## Courses simplification — October 24, 2026, local

`codex/courses-simplify` contains Noah's course-only list, Graded Sections/section Chats navigation, removed slogans/term filter/duplicate calendar links, equal priority-card heights and centered event dialog. Lint and TypeScript passed; browser validation and release remain pending. No database migration. See [handoff](handoffs/2026-10-24-courses-simplify.md).
Courses simplification release update: PR [#31](https://github.com/orbitaileadership/Orbit-AI/pull/31) merged as `731eeef0793c9adb21484fed6b4a4509c0b57d8f` following Noah's explicit push/deploy request. Local production build and Vercel preview passed; Vercel main deployment `8KK5VigGhTm48vwqfxemvdsSKNzK` reported success. Public site 200, unauthenticated courses API 401. No migration. Signed-in visual checks remain pending; supersedes the local-only status above.
## October 24 — User feedback inbox and email notification (PR #32)

Signed-in app users can send categorized reports, optionally include only the current page path, and see their latest report statuses. Admins have a private queue under `/admin/feedback` with status triage and a copyable, identity-minimized AI coding task packet. Content-free admin email notifications use Resend with per-report idempotency. [PR #32](https://github.com/orbitaileadership/Orbit-AI/pull/32) is rebased onto current main; the required independent review passed after retry-safety fixes. Migration `0024_feedback_reports.sql` is applied in production Supabase, and verification confirmed anonymous and authenticated roles cannot read the table or execute its submit function. Production Vercel has the required variable names configured, but actual notification delivery awaits code deployment and a live test; no secret values are recorded here. Focused route/notification/PGlite/submission tests: 39 passed; lint and webpack production build including TypeScript passed. The feature has not yet been merged or deployed. Full details: [feedback inbox handoff](handoffs/2026-10-24-feedback-inbox.md).

## October 25 — model-directed search (local)

`feat/automatic-web-search` lets standard provider chats request Tavily when needed, preserves Python and summary/retrieval memory, and keeps explicit search as “Always search first.” One ledger claim per question, saved server-owned citations and cancellation/storage checks bound the new path. No migration, paid test call, merge or deployment. See [handoff](handoffs/2026-10-25-automatic-web-search.md) for validation and remaining live checks.

## Pricing trial database update — October 26, 2026

Supabase project rcfnptnaoncfsavxgybc received migration 0025_trial_usd_budget.sql (tool name trial_usd_budget). New trials receive USD $3 for seven days; existing budgets and enrollments are preserved. Verified settings, service-only v2 execution, and unchanged rolling guard. Payments remain disabled. CAD subscription pricing release is in progress; see handoffs/2026-10-26-pricing.md.
