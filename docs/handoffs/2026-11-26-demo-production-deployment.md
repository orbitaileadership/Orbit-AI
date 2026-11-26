# Orbit demo production deployment

- Date / owner: November 26, 2026 / Noah explicitly requested deployment to Vercel after the main merge remained pending approval.
- Status: deployed; public HTTP smoke verified. Signed-in live feature validation remains pending.
- Source: reviewed/tested commit `af68c1a249430c23c5b8612e8662fde55e675cc1`, branch `codex/demo-polish-followup`, [PR #89](https://github.com/orbitaileadership/Orbit-AI/pull/89). GitHub's separate required collaborator approval still blocks the main merge; auto-merge was enabled. No branch rules were changed or bypassed.
- Target: team `orbit-ai7` (`team_pH92HcnulyjKRZb4znO0TUnC`), project `orbit-ai` (`prj_lPAJsfCwkCsfdrimeVTCBKcT9vFb`), Production.
- Action: rebuilt existing exact-source Preview `dpl_7w9p1oxY5y9Ubpqg9Pp9Vi9AZZYs` as a Production deployment with `withLatestCommit:false`, preserving the reviewed source identity and using Production configuration.
- Result: deployment `dpl_2uKXWhGKwtqZBtXLKmsTWdD9gNkG`, [Vercel deployment](https://vercel.com/orbit-ai7/orbit-ai/2uKXWhGKwtqZBtXLKmsTWdD9gNkG), reported READY, Production, exact commit `af68c1a`, with no alias error. A fresh lookup of [the live domain](https://orbit-ai-sand.vercel.app) returned that deployment ID and SHA. Immutable hostname: `orbit-ok13vmhd8-orbit-ai7.vercel.app`.
- Verification: unauthenticated homepage and `/login` returned HTTP 200; `/api/orbit?conversationId=11111111-1111-4111-8111-111111111111` and `/api/usage` returned HTTP 401. Previous local, synthetic browser, independent review and passing GitHub Offline verification results are recorded in the demo handoff and PR. No paid model call was made.
- Database/environment: no migrations, Storage limits, credentials, OAuth account configuration or project protection settings were changed.
- Known limits: real signed-in uploads, image responses, quiz generation, large-folder ingestion and connected plugin execution were not verified by these public smoke checks. Existing 20 MiB document cap remains.
- Rollback: previous live Production deployment `dpl_8yEDF7EAG1uvyt73NPKn4Gqpeo9v` (`orbit-7bxj27yjw-orbit-ai7.vercel.app`, commit `0a70fd1cba381bbb5c6cb9b7d1cebfbd7dfa340e`) was captured before this release. A rollback/re-promotion is a separate authorized operation; no database rollback is needed for these code changes.
- Next: owner refreshes the live app and validates signed-in flows; an eligible collaborator approves PR #89 to reconcile main with the deployed source.
