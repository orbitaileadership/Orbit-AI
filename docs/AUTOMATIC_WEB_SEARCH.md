# Model-directed web search

## User outcome and scope

Standard provider chats can request a public-web search when they need current facts or external evidence. Search is offered only with a configured Tavily key and live selected provider; it is unavailable in course-only and voice tool conversations. The existing toggle is now labelled **Always search first**: enabled retains the previous up-front search; disabled lets the model decide. This does not change Orbit Mode, whose preview still excludes search tools.

Python function calling already exists through `run_python`, a browser worker, and the normal chat continuation. Long-chat memory already uses a bounded recent window, incremental summaries and consent-gated retrieval. Those implementations are retained; no replacement framework or provider-specific compaction is added.

## Execution

1. Offer `web_search` with a concise public query, instructing the model to omit private student content.
2. Model emits the function call through its existing provider adapter. The browser queues a continuation; it never supplies authoritative search evidence or receives a Tavily key.
3. The authenticated chat route validates the call and existing conversation/reply ownership, checks the course/voice restrictions and claims the existing budget reservation.
4. Search executes server-side with cancellation and a 20-second deadline. Results or failure are saved on the originating user message. The server replaces any browser-supplied search result before building tool history.
5. Resume the selected model with untrusted evidence and [W#] source identifiers. Existing response completion, budget reconciliation and citation saving remain in effect.

One search is allowed per question, including explicit up-front search. A deterministic per-user/per-message ledger ID prevents concurrent or replayed calls from buying another search. Failed attempts retain the existing conservative uncertain-cost settlement and are cached. A storage failure stops before another model call and asks for a new message; cancellation stops before summary/retrieval/answer calls. A duplicate in-flight or already-attempted claim returns a clear 409 rather than repeating the external request.

The latest prior search-sized source set may be reused for follow-ups. A fresh model-requested search appends its results so an earlier [W1] in this answer cannot be reassigned to a different URL. Earlier sources are dated separately; reused history is capped at the configured result count. The shared request context ceiling still applies.

## Validation and limitations

Synthetic tests cover tool availability, real route/adapter assembly, server evidence replacement, citation identity, saved results, declined/duplicate reservations, repeated continuations, cancellation, storage failure, query validation and search failure. Python and memory regressions are included. These are mocked provider/network checks, not measured live search relevance or answer-quality improvement.

Live model selection of tools, signed-in desktop/phone behavior, real Tavily configuration and search quality still need controlled staging validation. Query privacy is instructed in the tool and system prompt, not guaranteed by a content classifier. Search plus an additional model continuation consumes the student's existing allowance; no cap is increased. No deep-research or multi-query refinement loop is introduced.

Rollback: revert this change. Existing web_results JSON and explicit searches remain compatible; no migration is required.
