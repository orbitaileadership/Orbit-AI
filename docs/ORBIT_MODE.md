# Orbit mode — bounded four-provider routing preview

Jake authorized Orbit mode on October 15, including four independent votes per prompt, one lead answer, and at most one specialist when collaboration is requested. This supersedes the older launch exclusion for smart model routing. Natan's main-review fixes remain a separate workstream.

## Product behavior

Orbit appears beside ChatGPT, Claude, Gemini and Grok on desktop and phone. It has separate saved conversations and Orbit's own visual interface. Each turn displays the selected lead and ballots, including a tied-vote disclosure and optional specialist. The original four single-provider experiences remain available.

This first preview supports **text conversations**. Files, course attachments, web browsing, voice and execution tools are intentionally unavailable in its composer. Normal chats retain those workflows. An Orbit selection sends the question and a bounded recent context to all four providers; students see this disclosure before sending. Selecting an individual AI does not automatically convert an Orbit conversation into a normal chat.

1. Authenticate using the existing verified-domain/waitlist guard and RLS client.
2. Require every configured provider to be enabled and present. A missing key in live mode stops the turn; it does not become a demo ballot.
3. Acquire a service-role-only, five-minute per-student lease. Concurrent Orbit turns return a busy response. Expired leases recover from terminated processes.
4. Save the latest question, load the newest bounded history, and select economic context. Latest questions are explicitly appended rather than discovered in an ascending capped read.
5. Collect independent votes, checking Google first on every turn and then calling the other three concurrently with the available candidate set. Each nominates another provider and optionally requests a distinct specialist. Strict server parsing rejects self-votes, invalid providers, malformed ballots and incomplete streams. No malformed-ballot repair call is added. For a Google HTTP 503 before any stream/usage, one bounded, disclosed retry of that same vote is permitted; see the October 22 recovery note below.
6. Use plurality for the lead. Ties use deterministic SHA-256 ordering seeded by the saved message ID, with no extra model call. This is an administrative tie-break, not evidence that one tied model is better.
7. At least three collaboration requests add one specialist. Specialist nominations determine that provider among non-lead providers, using the same stable ordering for ties. Its bounded contribution is untrusted analysis for the lead, not evidence or instructions.
8. The lead streams one coherent answer. There is no recursive debate or unlimited agent loop. Normally all four ballots must succeed. Under the October 22 owner-approved Google-503 policy below, three valid ballots may proceed with an explicit saved Google exclusion; Google is excluded from lead and specialist selection too. A failed specialist still stops the turn rather than silently presenting a solo answer.
9. Persist the real author model and structured routing metadata with the assistant message. Only complete final answers may save new memories through the existing consent-protected helper. Private specialist prose is ephemeral and is not copied into analytics.

## Context and memory

`config/orbit.ts` controls models and limits. Generation is capped at 8,000 estimated input tokens per phase, with separate space for system instructions, opted-in preferences/memories, summary and specialist output. A too-large phase fails closed. Current token estimation is heuristic, not a strict supplier-cost guarantee.

The active window starts from the latest 100 completed messages. Older context may be omitted or partially summarized, and the UI explicitly says so. The existing incremental summarizer can fold dropped rows when the fetched history covers the conversation; it does not pretend a legacy backlog beyond that window is complete. Reopened Orbit chats show the latest 100 saved messages. Full historical browsing/backfill is future work. Full conversation records remain stored unless deleted. Semantic retrieval is not added to Orbit in this preview.

Durable profile preferences and relevant opted-in saved memories are available to the lead. Routing voters and the specialist receive selected recent conversation text. An existing summary is sent to the final lead, not represented as full history. None of this transfers provider-private reasoning or caches.

## Cost and failure contract

Every dispatched voter, specialist and lead call uses its own atomic reserve → call → settle path, with operations `orbit_vote`, `orbit_specialist`, `orbit_answer`. Summary charges retain `summary`. Pricing snapshots use the actual configured model. Known usage settles to the calculated cost; ambiguous dispatched outcomes remain uncertain; an explicit non-started client rejection can release its reservation. Output without a normal terminal completion is rejected and never becomes a valid ballot or specialist contribution.

Solo: four voting calls plus one answer. Collaboration: four voting calls, one specialist, one answer. A long chat may also incur a summary call. Default helper reservation estimates (votes plus specialist, excluding summaries and the lead) are capped at US$0.15 per turn. The cap is checked before each helper stage; prices, output caps, input limits and the feature flag are config. Actual costs may exceed estimates; all reported actual usage is still settled.

There is **no all-or-nothing prepaid bundle**. If a later step cannot reserve budget, earlier completed calls remain charged. The UI explains this. Avoid promising that a failed turn is free. The existing usage panel reflects aggregate remaining credit, including all phases; the staff ledger contains the separate operation labels. Existing per-model “typical chat answer” estimates do not yet describe total Orbit-turn expense.

Stop aborts voting/specialist work via the request signal. Once the final answer has been dispatched, the server keeps reading to settle usage and save the result even if the browser disconnects. A student may need to reopen the chat to see that result. No provider substitution occurs on failure. Incomplete final answers remain partial and do not save AI memories. A process killed by hosting can leave a conservative reserved balance; existing operational reconciliation remains necessary.

## Rollout

- Apply migrations 0001–0013 as required by current main, then **0014_orbit_mode.sql**. It adds a conversation flag, message routing metadata and the service-role lease functions. No provider enum changes or balance resets.
- The conversation list now separates Orbit from ordinary OpenAI chats. Deploy the migration before code that queries the new column. Main's ordinary chat endpoint rejects Orbit conversations so that it cannot bypass voting.
- `ORBIT_MODE_ENABLED=on` explicitly enables POST. Leave it off until staging checks pass. The tab remains visible as a preview with a clear disabled response.
- With `LIVE_MODELS` off, enabled Orbit simulates ballots and a demo answer without provider calls. Simulated votes are labelled and do not claim to classify the prompt.
- With `LIVE_MODELS=on`, all four API keys are required and every phase rechecks the provider's disable switch. No key, prompt or response text is logged by Orbit.
- Verify grants, lease recovery, budget exhaustion between phases, phone width and real provider model/finish semantics with synthetic accounts before rollout. No live model or production database deployment is part of this implementation.
- Natan's existing logging/deletion/voice fixes remain necessary for the wider app. Orbit text deletion reuses the conversation DELETE route; its new metadata is removed with messages, and Orbit does not create storage objects.

## Evaluation before claiming a moat

Voting can be wrong, providers can share biases, and the no-self-vote constraint can even exclude the strongest choice for a voter. Candidate descriptions are unverified routing hints, not benchmark-based expertise labels. Cheapest configured voters are used to bound overhead; the lead/specialist use configured answer candidates. No claim of optimal routing or superior accuracy has been validated.

Use identical synthetic tasks and blind scoring to compare: each individual default model, Orbit solo routing, and Orbit collaboration. Record task quality, corrections preserved, error rate, total per-task cost (all phases), time to first answer and p95 end-to-end latency. Include simple tasks where routing overhead is hard to justify, mixed-discipline work, writing, mathematics and adversarial attempts to force self-votes or collaboration. Measure the incremental value of the specialist. Establish release thresholds before observing results.

Defensibility would come from measured routing performance, a useful study workflow, and a permission-respecting feedback/evaluation loop. Four votes alone are reproducible by competitors. Do not put private conversations in analytics to build evaluation data; use synthetic tasks or separately consented contributions with a clear policy.

## Validation

Routine tests use mocked providers and synthetic users. Routing tests cover no-self-votes, quorum, plurality, ties and collaboration limits. Paid-call tests cover reservations, disabled providers, terminal signals and ambiguous failures. Endpoint tests cover access, flag/key gates, ownership, leases, demo labelling, four-vote failure, solo output and bounded collaboration. Local database tests verify migration compatibility, lease isolation and grants. Production build and browser layout checks are separate from evidence of live model quality.

## Implementation checks (October 15)

- Full mocked/local-database suite: 337 tests passed across 45 files.
- Lint, generated route types and TypeScript passed.
- Production webpack build passed (`npm run build -- --webpack`); default Turbopack not checked in this linked-dependency worktree.
- Empty-state layout inspected on desktop and at 375 × 812; this was a temporary unauthenticated layout harness, not a signed-in end-to-end test. Harness removed before production build.
- Repository-required independent review completed; provider recheck and shared helper estimation findings fixed and covered by regression tests. Reviewer found no remaining blockers in the updated code.
- Refreshed main remains b1e3659, the base of this branch. Live provider quality, deployed migration/grants and real billing still require staging verification. No production merge, migration or paid API call was performed.

## Attached document excerpts (October 19, 2026, step 1 of `ORBIT_FILES_TOOLS_PLAN.md`)

Orbit accepts up to `ORBIT.maxAttachments` (3) of the student's own ready text documents per message (`attachmentIds` on POST). `lib/orbit/attachments.ts` checks ownership (user_id, unused: no course or chat link), rejects images, failed and scanned files rather than partly sending them, retrieves relevant passages (`search_chunks`; opening passages for generic questions) and caps them at `ORBIT.attachmentTokens` (2,000) in total. The excerpt block joins the course block, so voters, the specialist and the lead all see the same bounded, labelled-untrusted text; the existing helper-reservation cap and the 8k input cap still apply and fail closed. Files are then linked to the conversation and the user message records `attachment_ids`. Only the current turn's attachments are used; they are not re-sent on later turns. Images, scanned PDFs and tools remain unavailable (plan steps 2–3). No new migration. Status: implemented locally with mocked tests; second-model review and signed-in/live validation pending.

Review fixes (same day, after an independent Opus review): attachments are validated and size-checked before any conversation or message is saved; files are linked to the chat only after a complete answer, so a failed turn leaves them reusable and the composer restores the chips; excerpts sit inside an `<attached_files>` block with closing-tag stripping, and the specialist prompt now puts its instructions first. Known remaining gaps: no component test for the attach UI, no RLS test for `search_chunks`, rejected/removed uploads stay as unattached files, reload does not show which files a message used, phone layout of the composer footer unchecked, and the lead may still hit the context cap after paid voting on very large prompts (pre-existing).

## Google availability recovery — October 22–23, 2026

Production diagnostics confirmed `google-default` returns HTTP 503 (`unavailable`) during `orbit_vote`; the other three providers complete their calls. Google describes 503 as temporary overload or service unavailability ([official errors](https://ai.google.dev/gemini-api/docs/generate-content/api-errors)). This observation does not establish a platform-wide outage or that a different Google model is available.

Jake approved deployment and requested automatic Google return plus explicit nonparticipation disclosure. This supersedes the earlier all-four-or-fail rule **only** for Google's typed, pre-stream HTTP 503 with no usage. Google is attempted first on every turn and retried once after one second with the original 30-second deadline and cancellation signal. If both attempts return that 503, the remaining three voters receive a candidate list excluding Google and run concurrently. All three must return valid ballots; Google cannot be the lead or specialist. Missing keys, administrative disable switches, malformed ballots, partial streams and other errors do not trigger this fallback. No vote is invented or reassigned, and no completed other-provider ballot needs to be repeated.

The decision's optional `unavailableProviders` metadata records Google’s exclusion; the UI displays it during voting and on the saved answer, with the real ballot denominator (3 rather than 4). New decisions use `orbit-v2`; historical v1 records remain readable. There is no sticky down flag, cooldown, background probe or manual re-enable requirement. Every new turn retries Google's normal vote, so four-provider participation returns on the next turn where that vote succeeds; this is not a promise to detect recovery in the middle of a completed turn or instant global health monitoring.

The retry's reservation estimate is included in the existing helper cap before dispatch (including any later specialist). Each attempt separately reserves and settles through `orbitCall`, rechecking user budget and provider disable state. An ambiguous first attempt remains uncertain; it is not refunded, rewritten or treated as free. A retry may therefore use additional allowance even if it fails. No automatic retry of summaries, specialists or final answers is added. Local implementation and synthetic tests do not prove Google has recovered. The owner approved this release; live paid tests still require their applicable approval.


### October 23 timeout correction

PR 22 deployed the 503 fallback. The owner's next production attempts instead stalled on Google for the 30-second helper deadline. Vercel recorded an untyped Google failure after 31.34 seconds, without an HTTP status. The previous 503-only policy did not cover this case.

The same explicit three-provider fallback now also applies when Google's own voting deadline expires, including during the existing retry delay. No retry is dispatched after a timeout. Timeout classification comes from the caller's aborted signal with a TimeoutError reason, not private exception messages. A user cancellation always stops the request; budget, reservation, configuration and other provider errors still stop as before. The existing Google attempt remains settled from reported usage or uncertain without usage, and counts toward the helper cap. Remaining voters receive fresh helper deadlines; Google is attempted normally again on the next turn. No further paid calls, higher caps, persistent disable flag, database edits or invented votes are added by this correction.

The owner requested that Orbit remain available after reporting the repeated failure; this is a continuation of the approved disclosed Google fallback. This does not guarantee responses during all-provider failures, exhausted budgets, invalid ballots or a failed final answer. Broader cross-provider failover would need its own truthful decision and author metadata.

## Lead thinking selection — October 24, 2026 (local, not deployed)

Orbit's composer now offers Low / Medium / High thinking immediately left of Send, matching the other apps' bottom-right model-control position. New UI turns default to Medium. The choice stays while Orbit remains mounted and is locked while loading/running; reloading starts at Medium. Only the lead's final answer receives it. Voting, summaries and specialist contributions retain their existing settings and caps. Saved answer decisions record the selected level; historical decisions and callers omitting the field retain provider defaults. No migration is required.

`config/thinking.ts` contains the levels/default and explicit supported candidate API IDs. The route rejects invalid values before acquiring the user lease or making paid calls; a changed unsupported candidate fails before voting. Provider payloads use OpenAI `reasoning.effort`, Anthropic `output_config.effort`, Gemini `generationConfig.thinkingConfig.thinkingLevel` and xAI Chat Completions `reasoning_effort`. Explicit choices never trigger a silent plain-request fallback. Higher effort may use more of the existing total output cap and allowance, or produce a partial answer if the cap is exhausted; no new cap, price or paid call is added. Reserve → call → reconcile remains unchanged.

Official references checked October 24: [OpenAI reasoning](https://developers.openai.com/api/docs/guides/reasoning), [Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort), [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking), [xAI reasoning](https://docs.x.ai/developers/model-capabilities/text/reasoning). These establish request controls, not live account availability or measured quality. No paid calls were made.
