# Orbit AI — current state

Seeded October 19, 2026. Update after verified changes; this snapshot will age.

## Shared baseline

- Primary repository: https://github.com/orbitaileadership/Orbit-AI.
- Remote `main` verified during preparation: `dcd0b6ef19363138e97053a9945393b0bf303e83`.
- This chat recorded successful Vercel deployment of that revision after Jake explicitly approved the merge.
- Latest recorded checks on that application revision: 499 tests / 66 files, lint and production webpack build including TypeScript passed. These are local/synthetic checks, not a complete signed-in or real-provider launch certification.
- Audience/access rule: exact verified `uwo.ca`, with existing early-access/waitlist enforcement. Other Canadian institutions register waitlist interest; they do not receive app access through that form.
- Keep reserve → call → reconcile, ownership/RLS, privacy and disabled-payment requirements intact. Final pricing/billing lifecycle is not established by this file.

## Recent implemented changes

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

## Local work awaiting release — course folders

`folders-course-navigation` adds pinned/recent folders to standard chat and Orbit, folder membership within courses, and a course Folders tab. Existing courses/chat/file links are preserved. Requires reviewed migration `0018_course_folders.sql` to enable folders; not applied to shared services. Existing courses remain available if code is deployed before that migration. Push/merge to main was authorized by Jake; independent review and final checks passed (513 tests). See `handoffs/2026-10-19-course-folders.md` for validation and remaining staging checks.
