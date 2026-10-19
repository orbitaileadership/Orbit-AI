# Token usage and chat growth

## Plan and scope

Jake requested a cleaner view of token consumption as prompts and chats become longer. This P1 usage-visibility task reuses the existing ledger, exact provider usage, admin allowlist, and metadata JSON. Noah owns engineering acceptance; Jake owns the usefulness of the metrics.

1. Record content-free measurements for each standard chat call: original user-message ID, estimated prompt/retained-history/system/tool/visual tokens, files/tools flags, and initial/retry/tool phase.
2. Add a service-role-only aggregate function (migration 0017) that reads ledger counts and message IDs/sequence numbers. No message content is selected by the report.
3. Lead the admin dashboard with token totals, per-question growth, prompt-size/workload comparisons, per-user usage, and date/model/user filters. Keep prior financial/product reporting in a secondary disclosure.
4. Validate grouping, missing measurements, filters, permissions and privacy with synthetic SQL/route tests; verify the page at desktop and 375px widths.

No new AI calls, analytics vendor, content store, or change to billing rules is introduced. The only billing change is additional numeric/boolean metadata in the existing reservation. Files affected are the chat route, billing metadata type, `lib/analytics/`, the dashboard/API, the token dashboard component, migration 0017 and tests.

## Definitions and interpretation

- Scope is **standard chat calls** (`operation=chat`), including retries and tool continuations. Orbit vote/specialist/answer, summaries, retrieval, syllabus imports, voice synthesis and other operations remain in the existing operational cost tables. The new section labels this boundary explicitly.
- Actual input/output/cache totals use settled calls with both input and output reported. Missing usage is unknown, never an inferred zero. Output already includes reasoning; cached input is a subset of input. Cache share uses only calls with cache reporting.
- A question is the original stored user-message ID. Retried answers and tool continuations add calls and token consumption to that question, rather than creating extra questions.
- Chat depth is the ordinal of that user message among the saved text user messages in that conversation, calculated in PostgreSQL. Bins are 1, 2–5, 6–10, 11–20 and 21+. Deleting/importing messages can affect the current ordinal.
- Growth and complexity comparisons include a question only when every linked standard-chat call is inside the date/model scope and has reported usage. Partial chains are counted and excluded. Window/model totals still show every selected call with known usage. This avoids presenting a filtered fragment as a complete question.
- Complexity is an observable proxy: estimated prompt text <=256, 257–1024 or >1024 tokens, crossed with files/tools availability. It is **not semantic difficulty**. Enabled tools need not have been invoked. Prompt/history estimates are the largest observed value per question across retries/rounds; aggregate charts use actual provider tokens. These estimates are not a provider tokenizer or an exact allocation of billed tokens.
- Averages and 95th percentiles are per question (sum of its calls), with question/call/chat sample counts. Differences across buckets are associations, not controlled causal experiments. Filter by model and user to reduce confounding; sparse samples remain visible.
- Older calls retain total usage but lack new prompt measurements. No historical content is scanned to backfill complexity. IDs only appear in the per-user table, limited to the 200 highest-input users; totals include everyone. A user-ID filter can inspect other users.

## Privacy, access and rollout

The server derives every field; client-supplied analytics fields are ignored. Measurement metadata contains no prompts, responses, file names, URLs, titles, or email addresses. The new report joins message IDs only when user and conversation match. Existing verified app access plus `ANALYTICS_ADMIN_EMAILS` guards the page and API; the RPC revokes execution from PUBLIC/anon/authenticated and grants only service_role. The JSON API is private/no-store.

Apply `supabase/migrations/0017_token_usage_report.sql` before release to enable the new aggregate. It adds/replaces one read-only function and changes no tables, stored messages, budgets, RLS policies, or financial RPCs. Without it the new panel displays an unavailable message and the old reports continue to load. Measurements begin on deployed new calls, so initial growth/complexity panels can be empty.

Rollback the application commit to restore the prior dashboard and stop collecting the new metadata. The additive function and existing ledger metadata may remain safely unused; no data rewrite is required. No production migration, release, or live-model validation is implied by local test results.

## Validation and database rollout record

499 tests across 66 files passed, along with lint and the production webpack build/TypeScript compilation. Tests cover server-derived metadata, same-question retries, retained-history measurement, filters, real PostgreSQL grouping, unknown usage, date/model-split chains, missing migration behavior, admin denial, direct RPC permission denial, and content exclusion. Independent second-model review found no remaining blockers after the partial-chain correction.

The dashboard was rendered with synthetic data at desktop and 375px phone width. The page stays within the viewport; wide tables scroll inside their panels. This is layout validation, not a signed-in production journey. No live AI calls or real student prompts were used.

Migration 0017 was applied to the existing shared Orbit AI Supabase database on October 19, 2026. Live function-body MD5 8c02b547953fcf8853934efebac89f00 matches the tested migration. Anonymous/authenticated execution is denied, service-role execution is granted, and a synthetic empty-scope report smoke test passed. Only the additive function/grants were changed.
