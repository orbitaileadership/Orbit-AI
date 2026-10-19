# Task handoff — folder database update

- Date / owner: October 19, 2026 / Jake explicitly requested “do the database update.”
- Status: production migration applied and schema verified; signed-in application validation still pending.
- Target: existing Supabase `orbit-ai`, project `rcfnptnaoncfsavxgybc`, production main. Existing authenticated in-app browser dashboard access was verified before execution; credentials were neither requested nor exposed.
- Applied: only the exact repository migration `0018_course_folders.sql`, wrapped in a repeatable-read transaction with 5-second lock timeout, 30-second statement timeout, and preservation checks. A private temporary aggregate-check table was dropped automatically on commit. No migration history table exists in this database, so this record and the dashboard query are the application evidence.
- Preservation: existing projects 7 → 7, conversations 19 → 19, files 18 → 18. Project IDs and conversation/file project-link digests matched within the transaction; migration aborts on mismatch. Existing projects all remain courses; zero folders were inserted.
- Verification: four folder columns present; folder shape constraint validated; ownership trigger enabled; project row security still enabled; direct trigger function execution denied to `anon` and `authenticated`.
- Dashboard evidence: https://supabase.com/dashboard/project/rcfnptnaoncfsavxgybc/sql/e2c2db66-3ed9-4d6d-8fd0-af9053d2c6ec (the editor currently contains the final read-only verification query). Screenshot retained with this chat's deliverables.
- Matching application code: main `e1b45546e53d9cae45cc043cf5e328fbfdf3a1c7`; GitHub's Vercel status was success, “Deployment has completed,” at https://vercel.com/orbit-ai7/orbit-ai/2iA4hWuYaAdAvbqkVCrLc5qw6YSJ . No separate code deployment was run during this update.
- Rollback: retain the additive schema and any future folder data. Reverting to code that lists all projects as courses needs compatibility review. No destructive rollback or backup restoration was performed; this migration does not replace a database backup.
- Next: refresh the deployed application and complete authorized synthetic signed-in checks for folder creation, course membership, pin/recents, file uploads and chat navigation. No paid model call was performed or authorized by this migration task.
