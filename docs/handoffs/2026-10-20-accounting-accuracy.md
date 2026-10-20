# Task handoff — Phase 1 accounting accuracy

- Date / owner: October 20, 2026; Codex implementation, Jake authorization, Noah engineering acceptance.
- Status: implemented; awaiting signed-in staging validation and release approval.
- Task/acceptance: close ambiguous free outcomes, preserve unknown token fields, capture exact xAI expense, correct Sonnet cache pricing, guard Wolfram/evaluations, and make financial completeness visible while preserving existing budget policy.
- Repository / branch / commit: `orbitaileadership/Orbit-AI`, `fix/accounting-accuracy`, base `f562860bc70c83653adeb32f000c450c45a64e8e`. The implementation commit includes this handoff; branch/PR identifies the reviewed head.
- Working tree: implementation and documentation committed together; generated dependencies/build outputs ignored.
- Decisions/source: user approved Phase 1 implementation in the audit conversation. No paid calls, production changes, merge or deployment approved. Account deletion retention policy and external billing integrations deferred.
- Details: [ACCOUNTING_ACCURACY.md](../ACCOUNTING_ACCURACY.md); shared budget wrapper, provider adapters, affected routes, new evaluation accounting helper, migration 0019 and regression tests.
- Checks: 572 synthetic tests in 77 files passed (`TMPDIR=/private/tmp`); typecheck, lint, production webpack build/TypeScript and diff checks passed. Independent GPT-6 Astra review findings corrected/re-reviewed; no unresolved blockers.
- Database: `0019_accounting_accuracy_report.sql` tested in local synthetic PGlite only; not applied to shared/staging/production databases. No historical ledger data changed.
- Release: not merged or deployed by this task; prepare draft PR for owner review.
- Limits: signed-in phone/desktop flows, actual provider invoices, serverless termination and real multi-session database contention remain unverified. Media/search estimates are labelled; reservation estimates are not strict supplier bounds.
- Configuration: Wolfram needs verified per-request rate. Evaluations need existing dedicated tester enrollment/budget and explicit run cap. No accounts/credits provisioned.
- Rollback: revert application commit; additive read-only reporting RPC can remain or be restored from 0011 in an approved database operation. Preserve ledger/snapshots.
- Next: Noah/Jake review PR, approve staging configuration/migration, perform synthetic signed-in validation, then separately approve merge/release. Paid provider tests require explicit approval.
