# Task handoff — rolling usage limits

- Date / owner: October 23, 2026 / Codex for Noah.
- Status: implemented locally; awaiting authorized database rollout and staging validation.
- Acceptance criteria: shared daily/weekly/monthly cost limits; C$20 monthly converted to USD; ratios 1/30 and 7/30; percentage-only student presentation with colored remaining bars; admin costs retained.
- Repository / branch: `orbitaileadership/Orbit-AI`, `codex/usage-windows`, based on Courses Hub commit `8e8d730`. No new commit/PR/push.
- Working tree: uncommitted usage changes in config/economics, billing helper/parser, usage API, chat estimates, Settings/shared meter, migration 0023, associated tests and documentation. Preexisting `.claude/launch.json` preserved.
- Changes: enforce all windows under the shared budget lock across legacy/v2/v3 callers; account for outstanding holds and settled/uncertain charges; snapshot FX on successful reservation. Usage UI includes partial recovery times, remaining percentages, retry/refresh, trial expiry and exhausted-entitlement explanations.
- Decisions / source: Noah's usage-limit request and explicit async answer choosing rolling 24 hours / 7 days / 30 days. Existing entitlements remain authoritative; no paid enrollment or replenishment. See [plan](../USAGE_WINDOWS_PLAN.md) and [decisions](../DECISIONS.md).
- Relevant files: `supabase/migrations/0023_usage_windows.sql`, `lib/billing/budget.ts`, `lib/billing/usage-windows.ts`, `app/api/usage/route.ts`, `components/usage-meter.tsx`, `components/settings-dialog.tsx`.
- Checks: `npm test` passed 668 tests / 86 files; `npm run lint`, `npm run typecheck`, and `npm run build -- --webpack` passed. Focused SQL/API/billing/render suite passed 59 tests / 9 files. Synthetic Playwright checks rendered the actual Settings component at desktop 1440px and phone 390px, with dark/reduced-motion, student/admin, Billing, expired allowance and error/retry states. No student allowance dollars; C$30 subscription price retained. No real accounts or paid providers used. `git diff --check` passed.
- Independent review: `gpt-6-astra` identified settlement synchronization, old-entrypoint bypass and rejected-attempt FX snapshot issues; corrected and re-reviewed with no remaining blockers. Review was static, not live database execution.
- Database: migration 0023 local only; no shared target changed. Apply before the new v3 caller. Existing migration prerequisites must already be present. Old callers become guarded when 0023 is applied.
- Release: not deployed. Usage-limit changes not pushed.
- Limitations: true multi-session PostgreSQL concurrency, signed-in staging and real-provider behavior unverified. PGlite executes local SQL checks and does not prove multi-connection contention. FX uses configured account rate; seed 1.38 is not a verified current market quote. C$20 rolling cap does not renew legacy lifetime budgets. Raw legacy API counters remain for internal answer estimates; student presentation uses percentages.
- Recovery: UI can revert independently while keeping guarded reservation SQL; preserve ledger and FX snapshots. Preserve the private `reserve_budget_internal` function: deleting it before rerunning 0023 could clone the wrapper recursively. Do not undo budget protections via old RPCs.
- Next action / owner: Noah/Jake authorize shared migration and staging rollout when ready; verify all three windows, low-budget request handling and concurrent reservation/settlement there before production merge.
- Authorization still needed: shared migration, production merge/deployment and any paid provider validation. Payments stay disabled.

## Authorized release update

Noah requested deployment and signed into the service dashboards. The usage migration was applied transactionally to production Supabase `rcfnptnaoncfsavxgybc` and verified: v3 exists, base reservation guard present, RLS enabled, student v3/anonymous windows access denied, service v3 allowed, private helper denied. Read-only empty synthetic scope returned caps 483091 / 3381642 / 14492753 USD micros at configured FX 1.38. No user balances or ledger history were rewritten. Migration was renumbered from 0022 to 0023 after the concurrent Courses calendar migration took 0022; SQL contents are unchanged and must not be applied again solely for renumbering.

Release PR: https://github.com/orbitaileadership/Orbit-AI/pull/27. Current main's Orbit timeout and Courses calendar/quiz changes are preserved. App production rollout is pending final merged build and PR merge. Earlier local-only/authorization-pending statements describe the pre-release checkpoint; this update supersedes them for database and release authorization. Payments and paid provider validation remain disabled/unperformed.

## Production confirmation — October 23, 2026, 11:59 PM Toronto

- PR #27 merged as `78fad083ceaa7710c705179ecaaa3a91eb3e3303` after final preview `JANyBsKgSeS2N14hKs5SX3hnTVHs` succeeded. Final combined local webpack build including TypeScript passed with current Courses/Orbit releases preserved. Earlier 668-test evidence predates those integrations; full combined suite was not rerun in the release turn.
- Vercel deployment `FTSyYHFncLMhe8L6XSro99sZXNZM` verified **Ready**, **Production**, `main`, exact merge commit, and assigned `orbit-ai-sand.vercel.app`.
- Public HTTP smoke checks: `/` 200 HTML; unauthenticated `/api/usage` 401 JSON. No signed-in or paid-provider request was made. Those live flows remain unverified.
- Proof: `C:/Users/noaht/.codex/visualizations/2026/10/21/01a15bc4-2038-7cc0-b86f-d464954db2de/usage-production-ready.png` and `usage-migration-verified.png` in the same directory.
- Database migration 0023 already applied/verified as described above. Payments remain disabled. Production application rollback can use Vercel's prior deployment while retaining additive schema and reservation guards.
- Next: owner verifies Settings → Usage in their signed-in account. Release documentation saved locally after production confirmation; no additional runtime changes.
