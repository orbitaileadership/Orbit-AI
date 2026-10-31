# Task handoff — production database mismatch rollback

- Date / owner: October 28, 2026 / Noah
- Status: live PDF-only rollback verified; Production branch pinned to safe release branch
- Task and acceptance criteria: Restore file opening after a live `db_setup` report without applying the deferred 512 MiB production migration.
- Repository / branch: `codex/record-production-rollback` from `main` `2651848`; PR #39 was merged into main at that commit.
- Working tree: unrelated untracked `.claude/` left untouched.
- What changed and why: Vercel auto-deployed main after PR #39 merged. Main's file preview route selects `files.preview_path` and `files.preview_status`, absent in production. Re-promoted the previous PDF-only build, then set Vercel Production branch tracking to `codex/pdf-only-production` at `6f6b8e7` and created its Production deployment `CMgN1tAmieoCXo8PNwcjjjMqyTZN`.
- Important decisions and approval source: Noah chose to keep Supabase Free and defer the full 512 MiB infrastructure, then explicitly approved pinning Production to a PDF-only branch. No paid plan, migration, or worker was activated.
- Checks: Vercel showed branch tracking saved; the new deployment reported Ready at exact branch/commit and listed the live domain under Current Domains. A fresh authenticated live visit loaded saved chats and opened page 1 of an 18-page PDF. Fresh upload and other devices/providers were not tested. No live provider calls were made.
- Database state: production migration 0026 remains unapplied; schema and stored files were unchanged.
- Release state: live alias assigned to Production deployment `CMgN1tAmieoCXo8PNwcjjjMqyTZN` from the pinned PDF-only branch; main remains newer than the live build.
- Known risks: Production branch tracking now points at `codex/pdf-only-production`; a manual Vercel promotion or `--prod` deploy could still replace the live alias. PR Preview is not proof the production schema is ready.
- Rollback/recovery: Re-promote `CMgN1tAmieoCXo8PNwcjjjMqyTZN` if the live alias changes again before full release gates pass.
- Next action and owner: Noah tests the restored file action after refreshing an old tab. For the full release, verify Storage, migration 0026, hosted worker and staging before intentionally returning Production tracking to `main`.
- Authorization still needed: The full migration/Storage/worker rollout and later release require their corresponding owner approvals and validation.
