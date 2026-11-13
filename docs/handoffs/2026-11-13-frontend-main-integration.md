# Frontend integration candidate - November 13, 2026

Status: local validated candidate only; shared release HOLD remains. No push, merge, deployment, live website request or paid model call performed.

Base: ec6522390484d11d70437320be7019d44cf1cf21 (main). Application/test commit: 1ad2b857a99b8f4b2ecbaf5085e87e8a946b402e. Branch: codex/integration-frontend-20261113.

Included only independent frontend changes: F03 attachment status and accessibility (871542dec4a27a8b057a1f7d518575232c014647); F05 unique Gemini pending SVG gradients (c449de45b168b5d4a2c2e697bc8726b141e5a7ac); F06 read-aloud asynchronous ownership/cancellation (ff8c946631aa3c92838b2669d66061ba13ce50c3). Copied only the three application files and two existing public unit-test files onto main, with no production ancestry or historical evidence packets.

Explicit exclusions: failed/frozen F02 and F04, F07 preparation-only work, all evaluator/held-out packs, old controllers, unrelated changes. Original branches/worktrees preserved.

Executed on the exact combined application/test content: npm ci --offline --ignore-scripts --no-audit --no-fund (666 packages); npm run lint PASS; npm run typecheck PASS; npm test -- --maxWorkers=2 PASS (919 tests, 109 files); npm run test:feedback PASS (64 tests); npm run build -- --webpack PASS (43 static pages); git diff --check PASS. Live models disabled. Build used synthetic public Supabase values and an existing local-font fixture; the build output is validation-only and must not be deployed. An early parallel build was deliberately interrupted before completion to avoid overlapping .next writes; only the later sequential complete build is counted.

Limits: no new combined desktop/phone browser acceptance, real audio, assistive-technology or live provider validation. Historical independent component mock acceptance is not acceptance of this combined candidate. Actual answer quality and cost are unscored. Final documentation-only handoff adds no application changes.

Release conditions remain: Frontend sole coordinator, shared lock, current target/deployed SHA/rollback verification, sequential integration with other streams, exact final-head CI, applicable independent review and owner approval. Browser publication creates a different commit; verify identical file bytes/tree and run checks on that published head. No source candidate here clears the shared HOLD.
