# Task handoff — full 512 MiB release preparation

- Date / owner: October 28, 2026 / Codex for Noah.
- Status: preparing infrastructure; production full release blocked.
- Task and acceptance: deploy 512 MiB uploads, in-app PDF/Office previews, and bounded AI file reading to the live website with a hosted worker and correct production schema.
- Repository / branch: `orbitaileadership/Orbit-AI`, `codex/full-large-file-release`, based on `origin/main` at `5aa89f0`.
- What changed: added the [production rollout plan](../PRODUCTION_LARGE_FILE_ROLLOUT.md) and recorded the live infrastructure audit. No application or migration code changed.
- Important decisions: Noah explicitly requested the full release. The PDF-only production build at `6f6b8e7` stays live until the full release gates pass. Orbit customer payments stay disabled.
- Checks: read-only Supabase aggregate query: 33 file rows, zero path violations, zero unexpected statuses, one Office backfill candidate, zero large-file columns, no bucket-specific limit. Vercel showed the PDF-only production deployment Ready on the live domain. Local Docker evidence and remaining cloud gaps are in the linked feature plan.
- Database state: production project `rcfnptnaoncfsavxgybc` unchanged; migration 0026 not applied. Staging `bnuiajvlpnvnpvvbpfio` remains Free/50 MB.
- Release state: full feature not deployed; production still points to the PDF-only rollback-based build.
- Known risks: main already contains code incompatible with missing production columns. Future main deployments can displace the safe live build. Worker hosting, paid Storage plan and signed-in cloud validation are absent.
- Rollback/recovery: re-promote PDF-only deployment `D4YeXU7awtW7Tom8LcesUsPHf7V7`; preserve stored originals and additive schema if a later full release fails.
- Next action: obtain infrastructure budget/owner decision, provision eligible Storage and hosted worker, validate staging, then apply the production migration and deploy main in the plan's order.
- Authorization still needed: paid infrastructure purchase and host choice; automatic approval review rejected opening Supabase Pro upgrade because it interpreted the repository's Jake billing rule as applying to this action.
