# Phase 1 accounting accuracy

Approved in the Orbit AI audit conversation on October 20, 2026. Branch: `fix/accounting-accuracy`; base `f562860`. No payment activation, production migration, paid provider test, merge or deployment is authorized by this implementation.

## Contract

Keep atomic reserve → call → reconcile, user isolation and existing allowance policies. Close ambiguous failure releases; preserve unknown usage; capture xAI provider cost; correct Sonnet 5.5 cache pricing; require accounted Wolfram and evaluation dispatch; distinguish estimated, usage-priced and provider-reported expenses in administrator reporting. Validate locally with synthetic fixtures and obtain an independent second-model review.

## Accounting semantics

- `ledger.actual_micros` remains the allowance charge. `actual_usd_micros` remains the existing recorded expense field; historical rows are never rewritten. Existing fixed-price image/voice/search allowance policies remain intact.
- Settlement metadata records `costBasis`: `provider_reported`, `usage_priced`, `estimated`, `unknown`, or `unbilled`. Earlier rows without this provenance are reported as unclassified, never retroactively certified.
- For fixed-price xAI images, `metadata.providerCostUsdMicros` is separate provider expense evidence; migration 0019 uses it for expense reporting while preserving the original flat allowance charge. Raw `costInUsdTicks` is preserved. One USD micro equals 10,000 ticks; round up only at the existing integer-micro boundary. Exact xAI chat cost already fits the existing cost override path.
- Required missing/invalid input or output does not become measured zero. Missing cache/reasoning breakdowns remain null in SQL. Claude input without all disjoint cache buckets and Gemini output without a thought count are estimates, not measured totals. Legacy/inconsistent xAI output aggregates are explicitly estimated and excluded from measured output. Reported input remains available. Current token reports still require measured input and output together.
- Only explicit unstarted 401/403/404/429 rejections release. Generic transport, parse, timeout, 400/422 and server failures retain uncertainty. No paid retry is added. Speech drains independently of browser cancellation and settles after provider-body completion; host termination can still leave a held reservation.
- Sonnet 5.5 cache-read rate is $0.10/M tokens. New price snapshots include API model, currency and unit basis. Original snapshots remain untouched.

## Controlled configuration

Wolfram requires `WOLFRAM_APP_ID` and a positive integer `WOLFRAM_REQUEST_USD_MICROS` based on the actual account contract. No rate is invented; it is unavailable until configured. Every dispatch requires a user-bound reservation. Interpretation failures consume a configured estimated request charge; ambiguous failures remain uncertain. Shared public-tool identifiers are separate from server accounting imports.

Paid evaluation requires `EVAL_ACCOUNTING_USER_ID` for an existing dedicated `tester` enrollment and budget, plus positive integer `EVAL_MAX_COST_USD_MICROS`. It uses operation `evaluation`, an opaque run ID, the existing atomic budget/global stop and provider-disable controls, and a per-run cumulative sum of conservative reservation bounds. It never provisions accounts or credits and must never use a real student's account. Input bounds are heuristic, not a guarantee against supplier overages; actual reported costs still settle. These variables do not authorize running it.

## Reporting and rollout

Prepare/apply `0019_accounting_accuracy_report.sql` only in an explicitly approved environment after existing migrations through 0018. It replaces one service-only read function and changes no stored records, budget functions or policies. The application can run without it, but displays a completeness warning and withholds contribution. New metadata uses existing 0009 RPCs.

The financial view remains platform-wide; user/model filters still apply only to the standard-chat token panel. New reporting separates cost bases, shows unknown-only groups as unknown, and includes all-time unknown costs, held reservations and stale holds. Conversation spending is bounded to 200 ID-only rows. Platform token totals live in operational reporting, without broadening `operation=chat`.

Contribution is a recorded estimate pending external billing, not audited profit. It is suppressed when provenance/FX/cost completeness is missing. Hosting, support and other business expenses remain outside it. Current-budget availability subtracts spent and reserved; it is not scoped to the report window.

## Recorded local checks — October 20, 2026

- `env TMPDIR=/private/tmp npm test`: 572 tests / 77 files passed. Canonical macOS temp path avoids the existing local-helper symlink-path failure; no helper source changed.
- `npm run typecheck`: passed after review corrections; final webpack build also compiled TypeScript successfully.
- `npm run lint`: passed.
- `npm run build -- --webpack`: passed, 40 static pages generated; no deployment initiated.
- `git diff --check`: passed.
- Independent GPT-6 Astra review: findings fixed and re-reviewed; no unresolved blockers. The reviewer did not run the tests.

## Validation and limitations

Synthetic tests cover adapter usage, xAI ticks/image evidence, route failure classification, speech cancellation/body failure, Wolfram dispatch gates, evaluation configuration/caps, SQL expense-versus-charge, unknown-only groups, old reservations, immutable historic snapshots and RPC grants. PGlite queues calls on one connection: its exhaustion/idempotency checks do not prove concurrent transactions across sessions.

No production data or credentials were inspected. No live provider calls were run. Signed-in staging desktop/phone flows, serverless termination, true multi-session contention and provider billing reconciliation remain release acceptance work. Transcription duration, non-xAI image costs, speech and search still use explicitly labelled estimates; existing reservation estimates are not strict supplier-cost guarantees.

External billing integrations, scheduled reconciliation, historical correction of potentially mispriced rows and account-deletion retention policy are separate follow-up work. Do not mutate past ledger entries or change privacy retention rules in this patch. Deployment requires separate approval and an approved rollback record. Roll back the app commit to stop new metadata/guards; the read-only function can remain or be restored from 0011 in an approved database change.

Official verification: [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing), [xAI cost tracking](https://docs.x.ai/developers/cost-tracking). Rates checked October 20, 2026; account contracts and invoices still require verification.
