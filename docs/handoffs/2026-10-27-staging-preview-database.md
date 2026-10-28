# Task handoff — isolated Preview database

- Date / owner: October 27, 2026 / Codex with Noah's staging approval.
- Status: staging configured; Preview redeployment and signed-in validation pending.
- Task and acceptance criteria: resolve the branch Preview's missing Supabase configuration without using production student data; `/login` should load and course/chat routes should use a complete schema.
- Repository / branch: `orbitaileadership/Orbit-AI`, `codex/large-file-preview`, application commit `82eb2c6b71a37874265fd1993a737acab023a8e9` before this documentation update.
- What changed: created isolated Free Supabase project `orbit-ai-staging` (`bnuiajvlpnvnpvvbpfio`, West US/Oregon); applied all 28 repository SQL migrations in lexical filename order through the staging SQL Editor; used a staging-only 50 MB bucket limit in migration 0026. Added three staging Supabase variables to Vercel's `codex/large-file-preview` scope only. No keys are in the repository.
- Approval source: Noah selected a separate cloud staging database and explicitly approved connecting its publishable and server-only secret keys to Vercel Preview. The project owner entered the database password.
- Evidence: each SQL Editor migration run reported success. A read-only staging query confirmed `projects`, `conversations`, `files`, `file_chunks`, `conversations.section_folder_id`, `files.preview_path`, a private `uploads` bucket capped at 52,428,800 bytes, and RLS on `files`. Vercel listed all three new variables for the branch. The old branch `/login` returned an internal server error before the variables were added.
- Production finding: a read-only query on `rcfnptnaoncfsavxgybc` found `files.preview_path` and `files.processing_attempts` absent while `conversations.section_folder_id` exists. Vercel showed production main commit `daac901` Ready. No production schema or variable was changed.
- Database state: staging schema applied via SQL Editor; CLI migration history not reconciled. Production migration 0026 not applied.
- Release state: branch Preview needs a fresh deployment and app validation; production large-file feature remains incomplete.
- Risks: Free staging supports only 50 MB; 512 MiB remains local-only. No hosted worker is connected. Signed-in browser and phone checks remain pending.
- Rollback: remove the three branch-scoped Vercel variables or disable the branch deployment; the new staging database is isolated from production. Do not delete it until test data and migration records have been reviewed.
- Next action: push this documentation to trigger a branch Preview deployment, verify `/login` and a synthetic account flow, then update this handoff with the observed result. Separately plan and approve any production migration, Storage setting, and worker deployment.
