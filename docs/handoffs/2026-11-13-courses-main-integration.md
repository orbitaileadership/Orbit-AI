# Courses main-based integration - November 13, 2026

Status: isolated local candidate; release HOLD. This is not a merge, deployment, real-site acceptance or measured answer-quality result.

## Scope and provenance

Base: ec6522390484d11d70437320be7019d44cf1cf21 (main at preparation).
Branch: codex/integration-courses-20261113.

Only the application and unit-test diffs from these accepted local/mock candidates were applied, in order:
- C1 a678bd7173bf4f6f26d76562a1d40eb4a5d91f1c: short-answer retry and browser-local progress disclosure.
- C2 fbd2a270d24b542d7415ecbdb7c33937ffbe86dc: MCQ answer-key and storage disclosures.
- C3 4708e787053ea9f50510de17ab61932d61da4f90: eligible section selection and section-bound quiz launch identity.
- C4 c2cfdab09a04f0b0b5cb7508f68105fa367c2cc1: clear previous export cards before loading another session.
- C6 ee0de442b93ed0b3501327d781eee002cf9bf7d7: prefer validated visible flashcards over conflicting legacy export metadata, with eight unit cases.

All patches applied cleanly; C3/C4 modify separate portions of CourseQuiz. No manual conflict resolution, production ancestry, C5 failed candidate, private evaluator material, screenshots, browser harness, dependency change, provider/prompt change or database migration was included. Original branches/worktrees remain unchanged.

## Fresh combined checks

Run on the combined application/test contents represented by this commit:
- npm ci --offline --ignore-scripts --no-audit --no-fund: passed from cache; package manifests unchanged.
- git diff --check: passed.
- npm run lint: passed.
- npm run typecheck: passed.
- npm test -- --maxWorkers=1: 908 tests / 107 files passed, 154.96 seconds.
- npm run test:feedback: 64 passed, no controller invoked.
- npm run build -- --webpack: passed using a local mocked-font response fixture, LIVE_MODELS=off, telemetry disabled and synthetic public Supabase configuration. Validation-only output; never deploy this build.

No live-evaluation script or paid application call was invoked. No secret environment variable was supplied. This was not a network-guarded run. Raw local command logs remain ignored and are not part of this publication.

## Remaining gates

Fresh integrated desktop/phone browser acceptance has not run; historical component evidence is not promoted to acceptance of this combined candidate. Real academic answer quality and all-call cost remain unscored. Existing semantic/parser limits and old persisted metadata are unchanged.

Frontend remains sole shared release coordinator. Shared HOLD, failed-candidate holds, production target/deployed-SHA/rollback verification and exact-tested-candidate approval conditions remain unchanged. Recheck current main, integrate concurrent candidates serially, resolve any later conflicts, and rerun exact checks and required acceptance before any main merge or deployment. No remote push, authentication change, main/production branch write or deployment occurred during this preparation.
