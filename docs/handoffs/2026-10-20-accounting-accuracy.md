# Task handoff — Phase 1 accounting accuracy

- Date / owner: October 20, 2026; Codex implementation, Jake authorization, Noah engineering acceptance.
- Status: implemented; push/merge explicitly authorized; signed-in runtime validation remains pending.
- Task/acceptance: close ambiguous free outcomes, preserve unknown token fields, capture exact xAI expense, correct Sonnet cache pricing, guard Wolfram/evaluations, and make financial completeness visible while preserving existing budget policy.
- Repository / branch / commit: `orbitaileadership/Orbit-AI`, `fix/accounting-accuracy`, base `f562860bc70c83653adeb32f000c450c45a64e8e`. The implementation commit includes this handoff; branch/PR identifies the reviewed head.
- Working tree: implementation and documentation committed together; generated dependencies/build outputs ignored.
- Decisions/source: user approved Phase 1 implementation in the audit conversation. Original implementation approval excluded release; subsequent explicit push/merge authorization is recorded below. No paid calls or shared database changes are authorized. Account deletion retention policy and external billing integrations deferred.
- Details: [ACCOUNTING_ACCURACY.md](../ACCOUNTING_ACCURACY.md); shared budget wrapper, provider adapters, affected routes, new evaluation accounting helper, migration 0020 and regression tests.
- Checks: 572 synthetic tests in 77 files passed (`TMPDIR=/private/tmp`); typecheck, lint, production webpack build/TypeScript and diff checks passed. Independent GPT-6 Astra review findings corrected/re-reviewed; no unresolved blockers.
- Database: `0020_accounting_accuracy_report.sql` tested in local synthetic PGlite only; not applied to shared/staging/production databases. No historical ledger data changed.
- Release: current-main integration prepared for authorized merge; production deployment health must be checked separately. No shared database migration applied.
- Limits: signed-in phone/desktop flows, actual provider invoices, serverless termination and real multi-session database contention remain unverified. Media/search estimates are labelled; reservation estimates are not strict supplier bounds.
- Configuration: Wolfram needs verified per-request rate. Evaluations need existing dedicated tester enrollment/budget and explicit run cap. No accounts/credits provisioned.
- Rollback: revert application commit; additive read-only reporting RPC can remain or be restored from 0011 in an approved database operation. Preserve ledger/snapshots.
- Next: finish the explicitly authorized merge, then verify runtime health and obtain separate approval for shared database configuration/migration and any paid provider tests.

## Current-main integration and merge authorization

Jake explicitly requested "push and merge" on October 20. Remote main had been rewritten from the original base to `1404a267e3eb50f77d4a6cd49e74686c5cea5588`, retaining newer signup eligibility and an existing `0019_any_school.sql`. Only accounting commit `f8d2cdec1319c83fee0ba3413c9b64977fa06a3c` was transplanted onto current main; unrelated interface/model changes were not restored. The Sonnet cache-read rate was already correct on this target and remains unchanged. Reporting migration is renumbered 0020 to avoid collision; no shared migration is applied. Fresh validation and independent integration review precede a normal non-force merge push. GitHub connector PR creation remains unavailable (403); normal Git branch protections remain enforced.

Fresh current-main verification: 574 tests / 74 files passed; lint and production webpack build including TypeScript passed. Independent GPT-6 Astra integration review reports no blocker. Auth/signup/model catalog and unrelated UI remain unchanged from `1404a26`; reporting SQL is byte-identical to the reviewed version except its migration filename.
