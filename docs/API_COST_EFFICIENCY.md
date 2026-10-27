# API cost efficiency — local implementation, October 27, 2026

## Scope and priority

P0 financial safeguard: at most 1% of the user's remaining rolling daily allowance may be **reserved and charged by the budget ledger for one logical request**, measured at its first reservation. The owner explicitly prioritized cost efficiency over response polish. No production migration, deployment, live model call or paid benchmark is part of this implementation.

## Current cost assessment and ranked opportunities

| Rank | Finding | Expected savings | Complexity / risk | Action |
|---|---|---|---|---|
| 1 | Ordinary chats started on expensive provider defaults and reserved 8,000 output tokens even for a short question. | High per new chat; synthetic estimates below. | Low code / medium answer-quality risk. | Implement cheaper visible defaults and 1,600 ordinary / 3,000 complex output caps. |
| 2 | Each summary, embedding, search, tool round, retry and Orbit phase had an individual reservation, but no shared per-question ceiling. | Prevents unbounded request cost; savings depend on traffic. | Medium code / high accounting risk. | Add an atomic ceiling inside the existing v3 reserve path; link all known phases. |
| 3 | Orbit can buy several votes before discovering the lead answer cannot fit the cap. | Avoids wasted votes on unaffordable turns. | Low code / low risk. | Reject when even the cheapest lead output plus all first votes cannot fit. |
| 4 | Repeated response guidance adds input tokens on every lead answer. | Current `main` already reduced this with its v5 prompt. | Low code / response-quality risk. | Retain v5, including its smaller spoken prompt; measure further edits before changing it. |
| 5 | Long chats can make a paid summary and embedding call before an answer. | Unknown until production usage is measured. | Medium / context-quality risk. | Both now share the cap; defer changes to context selection pending usage data. |
| 6 | A repeated initial chat POST could save the same question twice. | Unknown; depends on duplicate frequency. | Small code / low risk. | Implement a stable client turn ID and database conflict guard before any provider call. |

The existing implementation already trims history, reuses incremental summaries, extracts bounded file evidence, caches eligible provider prefixes, stores token/cost analytics, and reserves then reconciles each provider call. Those paths were retained. Explicit model choices are never rewritten; the cheaper model is shown as the selected default only for a new chat.

## Implementation

- Migration `0027_request_spend_limit.sql` stores a per-user, per-request ceiling, calculates it from `usage_windows` under the same user advisory lock as existing reservations, and sums ledger reservations/charges across the parent ID. Rejections return `request_limit` with remaining room. Legacy service-role reservation entry points lose direct execute permission. The service-only, content-free report counts requests, mean charge, near-cap requests, blocked attempts and after-settlement overruns. Migration 0026 on current `main` is a separate, unreleased large-file change; the request ceiling depends on 0025 and can be applied alone.
- Standard chat uses the saved user-message ID for search, summary, embedding, model rounds, tool continuation and retry. Orbit uses its saved user-message ID for votes, optional summary/specialist and lead. Browser Wolfram calls carry the owned message ID. Voice transcription, chat and cloud speech chunks carry one generated voice-turn ID. Other standalone routes default to their own server-generated call ID, so each remains capped.
- Each initial browser chat send now has a stable UUID used as its message ID. A duplicate POST conflicts on the message primary key and returns `duplicate_request` before reserving or calling a provider. Deliberate UI retries still reuse the saved message and its shared ceiling.
- The model picker selects Luna, Haiku 5.5, Gemini 2.5 Flash-Lite and Grok 4.3 for new chats. Existing saved selections remain. Google/xAI summaries use less expensive configured models. Short chat output is capped at 1,600 tokens; longer tasks at 3,000, and voice retains its 1,200-token cap. The server may reduce output further to fit the ceiling, with a 500-token minimum.
- Current `main` already has the v5 response contract, with a compact core for spoken replies. This branch leaves that contract intact. Additional prompt savings and answer quality need live measurement before changing the contract again.
- Orbit checks the available daily room before dispatching voters. The reservation function remains authoritative if concurrent spending changes that room.

## Reproducible before/after comparison

`benchmarks/cost-efficiency.test.ts` compares the October 26 defaults with the new defaults using the existing configured USD rates. The synthetic request has 2,000 input tokens and 1,000 output tokens; the reservation comparison uses the old 8,000-token output cap and new 1,600-token cap. These are **estimates, not measured provider savings**. Values are USD per request, with no cache discount:

The four newly selected model rates were spot-checked against the providers' public [OpenAI](https://developers.openai.com/api/docs/pricing), [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), [Google](https://ai.google.dev/gemini-api/docs/pricing) and [xAI](https://docs.x.ai/developers/models/grok-4.3) pricing pages on October 27. This is not a full catalog audit and does not verify account-specific pricing tiers or regional charges.

| App | Estimated token cost before → after | Estimated reservation before → after |
|---|---:|---:|
| OpenAI | $0.014000 → $0.000700 (95% lower) | $0.085750 → $0.001088 (98.7% lower) |
| Anthropic | $0.014000 → $0.000700 (95% lower) | $0.085750 → $0.001088 (98.7% lower) |
| Google | $0.005250 → $0.000600 (88.6% lower) | $0.031725 → $0.000870 (97.3% lower) |
| xAI | $0.010000 → $0.005000 (50% lower) | $0.052600 → $0.006875 (86.9% lower) |

No real before/after API cost or response-quality measurements exist yet. The existing admin reports can compare actual model, provider, operation, token and cache costs after release; the new request report needs migration 0027. Compare matched tasks and model selections, and track failures/truncations, before claiming realized savings.

## Validation and limits

Local PGlite tests cover snapshot arithmetic, shared calls, settlement release, duplicate rejection, user isolation, service-role bypass denial and admin-report access. Route tests cover chat (including the duplicate first-POST guard), Orbit's preflight, voice and analytics. Focused tests, typecheck, scoped lint and webpack production build passed. The full suite had 12 failures: 9 unchanged course/helper failures reproduced on the baseline, and 3 office/file timeouts under full-suite contention that passed when rerun alone. No live provider or shared database was touched.

The ceiling is exact for **budget commitments** made through `reserve_budget_v3`. Actual provider expense can exceed a reservation if a provider reports more billable units than the conservative estimate; the ledger preserves the true charge and the report flags an over-cap request. This means an absolute external-provider 1% guarantee is not yet demonstrated. Multimodal token counting, provider price changes and unreported usage need production reconciliation. Legacy clients that omit the new turn ID can still create duplicate initial questions; each receives its own cap. The older OpenAI optional-setting 400 retry remains inside one reservation and should be reviewed against provider billing rules.

At a synthetic CAD/USD rate of 1.25 and the configured CAD $20 monthly usage window, daily room starts near USD $0.533, making the 1% ceiling about USD $0.00533. A USD $0.008 forced web search and many explicit premium-model requests cannot fit; the server returns an explicit limit error. Orbit is usually unaffordable at this allowance and now rejects before its votes. This is the intended strict spending trade-off, but signed-in product behavior and minimum acceptable quality remain unverified.

## Rollout

Apply migration 0027 in the approved environment before deploying the application change. Confirm its grants, per-user isolation, concurrent reservation behavior, and service-only report against a staging database. Then run signed-in desktop and phone journeys and synthetic provider tasks under an explicitly approved cost budget. Revert the app commit to restore prior routing/output behavior; the additive ceiling table and report can remain dormant. Restoring old reservation entry points or removing the ceiling requires a separate, reviewed migration.
