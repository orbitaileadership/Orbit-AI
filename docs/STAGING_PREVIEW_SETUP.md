# Isolated preview database setup

Status: staging schema and branch-scoped Vercel variables configured October 27, 2026; Preview login verified; signed-in app validation pending.

Before this setup, the `codex/large-file-preview` Vercel deployment had no Supabase variables in its Preview environment and `/login` returned an internal server error. The approved fix is a separate Supabase **Free** project. Do not point the preview at production project `rcfnptnaoncfsavxgybc` or copy production keys or student data.

## Setup sequence

1. Create `orbit-ai-staging` in the Orbit AI organization. The project owner enters and stores its new database password. The project was created as ref `bnuiajvlpnvnpvvbpfio` in West US (Oregon) and then renamed to distinguish it from the live project. It contains only schema and synthetic test data.
2. Apply the repository's 28 SQL migrations in filename order to the empty staging database. The tracked `0013` and `0024` version prefixes repeat, so a CLI migration bundle needs unique *staging-only* versions. Record the applied count and verify the required tables, RLS policies, and `uploads` bucket. Do not apply the renumbered bundle to production.
3. Supabase Free Storage has a 50 MB global file limit. For staging only, change the final `0026_large_files_previews.sql` bucket update from `536870912` to at most `52428800` bytes in a disposable copy. Keep the tracked 512 MiB migration and local Docker validation intact. This cloud preview cannot validate 512 MiB uploads.
4. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY` from the **staging** project to Vercel **Preview** branch scope only. Do not expose the secret key in the browser bundle or commit it. Before synthetic chat tests, verify paid provider calls are disabled. Redeploy the exact branch commit after the variables are set.
5. Verify `/login` loads, create a synthetic verified account, confirm a course/chat read does not return `db_setup`, and preview a small synthetic PDF. Check one desktop and one phone-sized journey. Remove test content after verification.

## Applied state

The 28 migration files were run in lexical filename order in the staging SQL Editor; each returned success. The final bucket limit statement was changed in memory to `52428800` bytes for this project only. A read-only catalog query confirmed `projects`, `conversations`, `files`, `file_chunks`, `conversations.section_folder_id`, and `files.preview_path`; another confirmed the private `uploads` bucket limit is `52428800` and RLS is enabled on `public.files`. The tracked migrations were not edited. SQL Editor execution does not establish a CLI migration-history record; reconcile that before later `db push` operations.

Vercel variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` were saved as Config, and `SUPABASE_SECRET_KEY` as Secret. Each is scoped only to Preview branch `codex/large-file-preview`. No key value is recorded in the repository. The existing Production variables were left unchanged.

A branch push created Ready Preview deployment `HoRxABjXbWtLAb2zt1A3pv49Tovx` at commit `7959b539542768c1cca9631cab93b05e72cfcd2b`. The [branch Preview login](https://orbit-ai-git-codex-large-file-preview-orbit-ai7.vercel.app/login) rendered successfully, and an unauthenticated `/api/conversations` request returned `not_signed_in`. Supabase staging Auth Site URL is the exact branch Preview origin, and its only additional redirect URL is that origin's `/auth/callback`. A synthetic account was auto-confirmed in staging without sending email; the dashboard still showed no sign-in at the last check. Course/chat read, small PDF upload and phone-sized view remain to be checked. The test password is not stored here.

Staging Supabase sends its default **confirmation link** email. Orbit's sign-up screen asks for a numeric code, so a staging tester must open the email link, then return to `/login` and sign in. The default email template cannot be edited in this project without configuring custom SMTP. This is a staging onboarding mismatch and does not establish the production email-template behavior.

The first synthetic Preview login returned `invalid_credentials`. Staging Auth logs recorded `/token` 400 with the Preview origin as referer, confirming that the attempt reached the isolated project. The account's `last_sign_in_at` stayed null. A second test-account form was opened and dismissed without submission. Signed-in course/chat/PDF checks remain unverified.

## Release boundary

This setup is for a Vercel Preview and synthetic data. The 512 MiB upload and Office conversion path still depends on the local Docker worker and local Supabase limit. Production schema, production environment variables, payments, and provider credentials were not changed. The production Vercel deployment was separately rolled back to the pre–large-file commit `6d049b1` after Noah approved it.

If a step fails, stop before connecting Vercel to an incomplete staging schema. Keep the Preview variables pointing only to the isolated project and report the specific migration or route failure.
