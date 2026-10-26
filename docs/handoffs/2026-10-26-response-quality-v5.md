# Task handoff — compact shared response prompt v5

- Date / owner: October 26, 2026 / Orbit engineering
- Status: implemented locally; awaiting live provider and staging validation
- Task and acceptance criteria: Improve useful, honest answers across provider chats and Orbit while reducing repeated prompt context; keep study modes, files/citations, interactive visuals and billing controls intact.
- Repository / branch: `orbitaileadership/Orbit-AI`, `codex/chat-response-quality` from `origin/main` `347827e`.
- Working tree: task files modified; pre-existing untracked `.claude/` left untouched.
- What changed and why: `config/quality.ts` v5 condenses common response guidance and widget JSON instructions. `lib/chat/context.ts` excludes text-widget instructions from spoken calls. A synthetic unrequested-chart case was added to the quality corpus. No provider adapter, model ID, reasoning level, output cap, history or billing path changed.
- Prompt-size proxy: shared v4 text 4,772 characters / 1,595 conservative estimated tokens; v5 text 3,016 / 1,010; v5 voice core 1,352 / 455. These are not provider-reported usage or whole-request cost.
- Checks: focused chat/Orbit/widget/evaluation tests 151/151 passed; typecheck and changed-file lint passed; `git diff --check` passed. Webpack production build passed. The default Turbopack build stalled in optimization; an initial webpack run hit a sandbox `mkdir` denial, then passed after the directory was created. Full suite: 826 passed, 10 failed; one quality-case count assertion was fixed and retested. Other failures were in untouched local helper symlink/network restrictions and course/database tests.
- Database state: no migration or database access.
- Release state: not merged or deployed.
- Known risks: prompt behavior, widget validity rates, answer quality, provider-reported tokens and latency need blinded repeated live evaluation on all four providers; no claim of parity with native web apps. Full-suite baseline failures need triage separately.
- Rollback: revert the focused prompt/context/benchmark changes; v4 remains in Git history.
- Next action and owner: engineering runs approved synthetic paid evaluation and signed-in staging spot checks, then reviews quality/cost against v4 before any release decision.
- Authorization still needed: paid provider evaluation and production merge/deployment.
