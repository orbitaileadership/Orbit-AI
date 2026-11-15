# C7 checks — OFFLINE/MOCK

Commands ran in the dedicated `courses-canonical-20261114` worktree, Node24.21.0, with `LIVE_MODELS=off`. No credentials were read or supplied. `NEXT_TELEMETRY_DISABLED=1` was set for core/build checks. Final normalized logs are under `checks/`; [raw-log hashes](checks/raw-log-hashes.json) identify ignored originals. Log copies replace the local root with `<WORKTREE>` and trim trailing whitespace only.

| Command | Actual result |
| --- | --- |
| `git fetch --no-tags origin refs/heads/main:refs/remotes/origin/main refs/heads/courses:refs/remotes/origin/courses` | Exit0; both refs and local canonical HEAD were0a70fd1 before edits. |
| `npm ci --offline --ignore-scripts --no-audit --no-fund` | Failed ENOTCACHED for zwitch; no network fallback. No application repair. |
| Local `New-Item -ItemType Junction` for `node_modules` | Sandbox Access denied; authorized elevation succeeded, pointing to existing integration-courses dependencies. Both package locks have SHA256 D4D67502BD6C5F663D703F8EE3682963A1C1BE9FFB509F4D41599A0703A30AE4. No old controller invoked. |
| `node docs/feedback/courses-c7-20261115/student-public/evaluate.mjs --ref 0a70fd1cba381bbb5c6cb9b7d1cebfbd7dfa340e` | Expected exit1,9/15; six false accepts, two per format. Repeated after mechanical evaluator identifier correction with same counts. |
| `node docs/feedback/courses-c7-20261115/student-public/evaluate.mjs` | Exit0,15/15. Independent private evaluator27/27; reviewer reran it. |
| `node node_modules/vitest/vitest.mjs run lib/courses/quiz-output.test.ts --maxWorkers=1 --cache=false` | Exit0,21/21 on initial candidate. Reviewer then corrected the nonstudy chart test control from invalid1point to valid2points; final full suite covers that final file. |
| `npm run lint` | Initial public evaluator local variable `module` violated Next lint; renamed it `compiledModule` without changing criteria or loader behavior. Final exit0,0warnings. |
| `npm run typecheck` | Exit0 (Next typegen + tsc); final build also typechecked successfully. |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --cache=false` | Sandbox979/985, six helper failures caused only by EPERM symlink/EACCES local HTTP. Authorized local elevated rerun exit0:985/985,111files,109.44s. No source fix for sandbox limits. |
| `node --test scripts/feedback/*.test.mjs` | Exit0,64/64; controller test fixtures only, no old native loop resumed. |
| `node scripts/feedback/courses-c7/browser.mjs` | Sandbox Edge pipe failure; authorized elevated server+Edge run exit0. Final60journeys, candidate30/30, baseline12mismatches, six per-format localStorage/results checks,0pageerrors/nonlocalrequests/overflow. Browser/server closed in finally. Initial results retained separately; final run added explicit result displays and selected self-check assertions. |
| `npm run build -- --webpack` | Sandbox EPERM mkdir in own .next; authorized elevated rerun exit0. `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` used existing scripts/feedback/offline-fonts.cjs, public URL https://example.supabase.co and synthetic publishable key. Never deploy this validation output. |
| `git diff --check` | Passed during review; staged evidence checked before commit. |

The browser command sets `C7_PLAYWRIGHT_MODULE_DIR` to the current bundled local Node packages (located read-only through `load_workspace_dependencies`), uses installed headless Edge and serves only127.0.0.1:3147. Every nonlocal browser request is blocked. Window process shim, reduced motion and isolated browser contexts are validation configuration only. This is actual-component fixture testing, not a real website, signed-in generation, database/RLS execution or provider test.

Backend static review additionally notes existing unchecked final standard-chat writes, legacy/follow-up gate behavior and Orbit's separate completion/save semantics. Those are not fixed or promoted to durability evidence by this pure predicate change. All-call costs and real academic quality remain unscored.
