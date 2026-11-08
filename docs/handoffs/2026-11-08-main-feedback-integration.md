# Task handoff — sync reviewed feedback releases to main

- Date / owner: November 8, 2026 / Noah's requested main integration.
- Status: awaiting checked PR and merge.
- Task and acceptance criteria: merge the reviewed feedback changes already on `codex/pdf-only-production` into `main` before loop 8, preserving `main`'s independent work.
- Repository / branch: `orbitaileadership/Orbit-AI`; isolated `codex/main-sync-20261108` based on `main` and merged with `codex/pdf-only-production`.
- Working tree: isolated integration candidate; no changes to the original `main` worktree or active feedback runner.
- What changed and why: combined prior production fixes, feedback coordinator, archive/context handling, and approved migrations with the newer `main` document and course work. Resolved conflicts by retaining `main`'s independent document preview behavior and using the newer production feedback controller. Independent review found that the first Orbit UI resolution omitted the archive/restore controls; these were restored before publication. The full integration diff and PR are the review surface.
- Approval source: Noah's Working Chat request to merge these changes into `main` before loop 8. The earlier rule against merging into `main` is superseded for this integration.
- Checks: final lint, typecheck and offline webpack build passed; 64 feedback tests passed; 880 app tests passed with the local helper suite excluded; all 18 helper tests passed separately with the required local socket/symlink permissions. One earlier sandboxed build failed creating a generated `.next` directory; one final retry returned an oversized webpack stack, and the captured repeat passed. Independent second-model review found and verified the Orbit archive fix. No live provider calls were made for this integration.
- Database state: migrations 0027 and 0028 are included in the source merge; 0028 was previously approved, applied and verified on production. No migration was run during this integration. Migration 0026 remains in `main`; its production rollout is separate.
- Release state: `main` integration pending PR. Vercel still deploys `codex/pdf-only-production`; merging `main` alone does not update the live site.
- Known risks: `main` and the production branch had diverged, so merged application behavior needs CI and review. The continuous feedback run's immutable grant still targets the production branch.
- Rollback/recovery: revert the merge PR if integration fails; keep loop 8 paused and do not rewrite the old grant.
- Next action: finish offline build, review exact diff and CI, merge PR to `main` with expected head SHA; then align future automatic release policy and Vercel production target before resuming loop 8.
- Authorization still needed: none for the checked `main` merge. Any shared migration, billing, credential or budget change remains separately gated.
