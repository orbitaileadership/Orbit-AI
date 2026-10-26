# Task handoff — Google voting timeout recovery

- Date / owner: October 23, 2026 Toronto; Codex for Jake.
- Status: released; owner live validation pending.
- Task / acceptance: P0 continuation of the approved Google fallback. A timed-out Google vote must permit three real valid ballots with visible Google exclusion; user cancellation, budget/reservation failure and other stop conditions must remain enforced. Every new turn attempts Google again.
- Repository / branch: orbitaileadership/Orbit-AI, fix/orbit-google-timeout; based on current main 2bbd61c including PR 23 Courses Hub, which is preserved.
- Evidence: production /api/orbit at October 23 22:39:32 Toronto finished after 31.34s; safe diagnostics show Google orbit_vote, unknown code, no HTTP status. This is consistent with the configured 30s helper deadline, not evidence of a global Google outage.
- What changed: lib/orbit/call.ts classifies the caller signal's actual TimeoutError safely after existing settlement; app/api/orbit/route.ts uses that Google-only deadline to enter the existing disclosed fallback, with no second attempt after timeout. Retry-delay timeout is also covered. Error wording no longer incorrectly insists four ballots were required.
- Financial/security: no new provider retry, model substitution, budget increase, user-access exception, migration or production data change. Reported usage settles; unknown usage retains its reservation. Google attempts still count against the helper cap; user abort wins over timeout fallback.
- Approval: owner reported repeat failure and requested continued Orbit availability; prior explicit deploy approval for this Google fallback remains the release context. No agent-initiated paid test approval is inferred.
- Checks: 690 tests / 83 files, lint and webpack production build including TypeScript passed. Independent review found two edge cases (unrelated provider-error race and undispatched retry bound); both corrected with regressions. Independent re-review found no remaining blockers. Disclosure UI is unchanged from PR 22’s desktop/375px phone verification; existing component tests pass.
- Release state: PR 24 merged as ab393aa3e366b0e219a20b2901876b1fdec2e7fa. Vercel production 8oE1285Quu4rRMEGDBoJeXDukA2o verified Ready, Latest, main and orbit-ai-sand.vercel.app at October 23 22:50 Toronto. Screenshot: /private/tmp/orbit-timeout-fix-deployed.png.
- Limitations: no system can guarantee an answer for all-provider outages or exhausted budgets. Non-Google voter, malformed-ballot, specialist and final-answer errors retain existing policy; no broader fallback is represented as implemented.
- Rollback: revert this focused release; no database rollback needed.
- Next: owner refreshes and validates a new live turn; no agent-paid test was run. Post-release documentation records the verified deployment; application code matches the released fix.
