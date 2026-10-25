# Task handoff — larger standard-chat inputs

- Date / owner: October 25, 2026 / Jake (requested increase), Codex (implementation).
- Status: implemented; awaiting independent review and signed-in staging validation.
- Task and acceptance: permit a standard-chat prompt exceeding the previous 24k estimated token and 32k character limits without shortening it; retain combined-input/model-window rejection and monetary budget enforcement. P0 core chat reliability.
- Repository / branch: orbitaileadership/Orbit-AI, `fix/larger-chat-context`, based on main `e65d73a`. Changes committed on this branch; no unrelated edits.
- Change: 48k maximum combined estimated input; 144k character pasted-message guard configured centrally. Routine 8k/16k targets, tool evidence allowance, model output reservation, provider windows, summaries/retrieval, billing caps and reserve/reconcile unchanged. Dedicated multi-provider Orbit Mode limits are unchanged; reported error belongs to standard chat.
- Approval source: Jake requested “i want to increase contaxt limit”; 48k is the conservative implementation choice, bounded by existing model capacities. No production rollout or monetary cap increase authorized.
- Files: config/context.ts, app/api/chat/route.ts and tests, lib/chat/efficiency.test.ts, architecture/memory docs.
- Checks: lint, typecheck, production webpack build and diff whitespace checks passed. Full synthetic suite: 804 passed, 3 failed / 807 tests across 98 files. All chat/context checks passed, including five added route cases: large prompt preservation, 48k rejection, smaller model window rejection, character guard, and insufficient budget. Video boundary updated to new limit.
- Existing failures: course route compatibility test and two financial-database course-folder tests reproduce identically on unchanged main e65d73a (45 passed, 3 failed in those baseline files). Initial helper failures were macOS temporary-path aliasing; TMPDIR=/private/tmp resolves them. Build required network access for existing Google Fonts. No paid provider calls made.
- Database / release: no migrations or live data changes; not merged or deployed.
- Risks / validation: estimated tokens remain conservative, not exact provider counts. Larger requests consume more existing monetary allowance and can still be rejected for budget, capacity or combined input. Signed-in desktop/mobile and real provider behavior remain unverified. Second-model review required before merge by AGENTS.md.
- Rollback: revert this branch's change to restore 24k combined input and 32k pasted-message limits; no data migration.
- Next action: independent review and signed-in staging validation, then owner release approval. Production merge/deployment authorization remains required.
