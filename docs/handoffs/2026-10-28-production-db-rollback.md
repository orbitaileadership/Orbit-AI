# Task handoff — production database mismatch rollback

- Date / owner: October 28, 2026 / Noah
- Status: live PDF-only rollback verified; repeat-deployment risk remains
- Task and acceptance criteria: Restore file opening after a live `db_setup` report without applying the deferred 512 MiB production migration.
- Repository / branch: `codex/record-production-rollback` from `main` `2651848`; PR #39 was merged into main at that commit.
- Working tree: unrelated untracked `.claude/` left untouched.
- What changed and why: Vercel auto-deployed main after PR #39 merged. Main's file preview route selects `files.preview_path` and `files.preview_status`, absent in production. Re-promoted Production deployment `D4YeXU7awtW7Tom8LcesUsPHf7V7` at `6f6b8e7` to `orbit-ai-sand.vercel.app`.
- Important decisions and approval source: Noah chose to keep Supabase Free and defer the full 512 MiB infrastructure; the earlier production rollback authorization remains applicable. No paid plan, migration, or worker was activated.
- Checks: Vercel showed the old deployment Ready and the live domain under Current Domains. A fresh authenticated live visit loaded saved chats and opened page 1 of an 18-page PDF. Fresh upload and other devices/providers were not tested. No live provider calls were made.
- Database state: production migration 0026 remains unapplied; schema and stored files were unchanged.
- Release state: live alias restored to the PDF-only build; main remains newer than the live build.
- Known risks: Vercel Production branch tracking still points at `main`; another merge may auto-deploy schema-dependent code. PR Preview is not proof the production schema is ready.
- Rollback/recovery: Re-promote `D4YeXU7awtW7Tom8LcesUsPHf7V7` if the live alias changes again before full release gates pass.
- Next action and owner: Noah decides whether to pin Production to a dedicated PDF-only release branch until the paid Storage/worker release is approved. If approved, verify branch tracking and live alias. Keep this documentation branch unmerged while `main` auto-deploys.
- Authorization still needed: A production branch-tracking change or the full migration/Storage/worker rollout needs its corresponding owner approval and release validation.
