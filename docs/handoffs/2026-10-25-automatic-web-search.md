# Task handoff — automatic web search

- Date / owner: October 25, 2026 / Jake (product), Codex (implementation).
- Status: released; live provider and signed-in validation remain pending.
- Task / priority: P1 response quality. User requested tools and memory, then selected “Let the model search when needed.”
- Repository / branch / base: orbitaileadership/Orbit-AI, `feat/automatic-web-search`, base `f88a544`.
- Changes: model-directed Tavily search through the existing tool continuation and budget path; server-owned evidence, one idempotent search claim per question, saved citations and bounded prior-source numbering, cancellation/failure/storage checks. Rename existing toggle “Always search first.” Existing Python loop and window/summary/retrieval memory retained.
- Tests: final focused suite passed 173 checks / 11 files, including source-trust and stale borrowed-source regressions. Lint, TypeScript and production webpack build passed. Independent focused run passed 84 checks / 2 files. Diff whitespace checks passed.
- Independent review: gpt-6-astra identified cancellation/persistence failure paths, both fixed with regressions; suggested keeping untrusted-source instructions on the result round, also applied. No remaining actionable blockers reported; actual provider acceptance and signed-in behavior still need live validation.
- Details / limits: [AUTOMATIC_WEB_SEARCH.md](../AUTOMATIC_WEB_SEARCH.md). No paid provider/Tavily calls; real answer quality and signed-in desktop/phone journeys remain unverified. Query-privacy instruction is not a technical content guarantee.
- Database: no migration; existing web_results JSON stores evidence and cached failures.
- Release: Jake explicitly requested deployment after implementation. Main fast-forwarded to `cc16049233c91d2865411dc7c62df7552221e553`; Vercel production deployment https://vercel.com/orbit-ai7/orbit-ai/ANefBbQERj4RummayR14ksxCAKGJ transitioned from pending to success for that SHA. Public homepage returned 200; anonymous /api/usage returned 401 not_signed_in. No PR was created because the connector still returned 403. Normal Git push respected repository protections; no credentials were extracted.
- Rollback: revert feature commit; no data restoration.
- Next action: controlled signed-in tool journey and live answer-quality assessment.
