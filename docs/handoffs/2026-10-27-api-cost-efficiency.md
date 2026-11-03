# Task handoff — API cost efficiency

- Date / owner: November 2, 2026 / Codex implementation for Orbit AI
- Status: integrated with the pinned PDF-only production line; awaiting independent financial review, Vercel access and production release
- Task and acceptance criteria: shared 1% per-request ceiling, cheaper default inference, controlled output, preserved reserve → call → reconcile and existing model choice.
- Repository / branch: `orbitaileadership/Orbit-AI`, `feat/request-cost-ceiling-prod` based on `codex/pdf-only-production`; local working tree, no PR yet.
- What changed and why: see [API_COST_EFFICIENCY.md](../API_COST_EFFICIENCY.md) for the assessment, code paths, synthetic cost table and limitations.
- Database state: migration `0027_request_spend_limit.sql` was applied to isolated Supabase staging `bnuiajvlpnvnpvvbpfio` and verified for RLS, service-only execution and legacy-v2 denial. It has **not** been applied to production `rcfnptnaoncfsavxgybc`. Current `main` has a separate, unreleased 0026 large-file migration; do not apply that as part of this cost release.
- Release state: not deployed. No provider calls or paid tests.
- Checks on pinned PDF-only branch: focused synthetic routes/accounting/analytics/benchmark tests passed (173 / 8 files). Full run: 848 passed, 9 failed, 5 skipped / 104 files; the nine failures are in unchanged course/helper tests and match the earlier baseline failures. Typecheck, full lint and webpack production build passed. Staging migration applied and grants/RLS verified. Signed-in desktop/phone and live provider quality remain unverified.
- Known risks: actual provider cost may exceed a reservation; legacy clients without turn IDs can duplicate initial POSTs; Orbit and fixed-price web search often cannot fit a 1% daily cap. Live answer quality and cross-provider behavior remain unverified.
- Rollback: revert application changes; additive table/report may remain unused. Permission restoration requires a reviewed migration.
- Next action: obtain required second-model cost-accounting review, restore Vercel team access, validate a preview against staging, then apply only migration 0027 to production and release the reviewed pinned-branch build. Product owner authorized deployment on November 2; no paid provider test was authorized.
