# Daily, weekly and monthly usage limits

## Approved outcome

User request: C$30/month subscription price, C$20/month of API allowance converted to USD, daily allowance = monthly / 30, weekly = monthly × 7 / 30. Students see percentage limits in Settings → Usage; daily/weekly/monthly bars indicate remaining allowance with green, amber and red. Administrator monetary reporting remains available.

## Implementation

- User explicitly approved rolling 24-hour, 7-day and 30-day windows. Unused allowance does not accumulate. Usage ages out gradually; display the next eligible usage expiry, not a false full-reset time.
- C$20 conversion uses the configured CAD-per-USD rate, snapshotted for the account. The existing 1.38 seed is configuration, not a claim about today's FX market. Missing/invalid FX fails closed. C$30 price and payment activation remain separate.
- Enforce windows in the common service-only SQL reservation path reached by legacy, v2 and v3 callers, with the original implementation private. Lock request/user and the budget row before reading windows through reservation; settlement updates the same budget row before changing ledger charges. All billable providers/tools already use the common TypeScript reserve function; switch it to v3 without a fallback. Snapshot FX only on successful reservation after entitlement creation.
- Count every outstanding reservation in every window, including old unresolved calls. Settled/uncertain ledger charges count by request creation time inside each rolling window. Released calls count zero. Unknown costs retain conservative holds. No ledger history rewrite.
- These limits cap existing entitlements; trial expiry and smaller legacy/trial allowances still apply. This does not grant subscriptions, replenish lifetime budgets, implement renewals, or enable payments. Those require the separately approved subscription lifecycle.
- Usage API returns window percentages and status for presentation, with raw counters retained for existing internal model estimates. Monetary UI is server-authorized for analytics admins only; no client-supplied admin flag. Remove student-visible allowance dollars from shared meters and Settings/Billing descriptions.
- Add local migration only. Missing migration causes live calls/usage loading to fail closed. No shared migration, live provider request or deployment is authorized here.

## Validation and review

Validate boundary ratios, held/released/uncertain/settled calls, duplicate IDs, user isolation, FX behavior, rolling expiry, and service-only RPC permissions with synthetic SQL and route/unit checks. Inspect desktop/mobile meters, zero/low/exhausted/demo/error states, and admin/non-admin display. Obtain independent second-model review of accounting changes before merge. Record actual checks and rollout dependency in handoff.

Independent `gpt-6-astra` review completed. Fixed settlement synchronization, legacy reservation bypass, and rejected-attempt FX snapshot findings. Final static review found no remaining blockers. The budget row serializes settlement against window checks; the original reserve helper is private. Preserve `reserve_budget_internal` in future migrations: deleting it and rerunning 0023 could clone the wrapper recursively. Normal migration reruns preserve the original helper.

## Rollout

Migration `0023_usage_windows.sql` was applied and verified on production Supabase after Noah requested deployment. Originally numbered 0022, it was renumbered without SQL changes to avoid the concurrently released Courses migration. Do not reapply merely for renumbering. It protects older callers immediately as well. Do not deploy the new caller without the migration or remove the guarded SQL functions when reverting UI code. No subscription payments or balance grants are part of this migration.

Local validation and remaining staging checks are recorded in [the handoff](handoffs/2026-10-23-usage-windows.md). True multi-session PostgreSQL contention and signed-in staging behavior remain unverified; in-memory SQL checks are synthetic.
