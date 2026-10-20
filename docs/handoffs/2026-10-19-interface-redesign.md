# Task handoff — interface redesign phases 1–3, Orbit files/tools plan

- Date / owner: Oct 19, 2026 / Noah (Claude Code session)
- Status: phases 1–3 awaiting validation; phase 4 planned (`docs/ORBIT_FILES_TOOLS_PLAN.md`)
- Repository / branch: `claude/orbit-ai-interface-redesign-cb3420`, 3 local commits, not pushed
- What changed: admin-only Analytics link (account menu and Orbit header; server-decided from `ANALYTICS_ADMIN_EMAILS`); per-provider wait indicators and message entrance motion; Orbit live vote panel; decision recorded in `DECISIONS.md`.
- Checks: typecheck, eslint on touched files, webpack build pass. `npm test`: 510 pass, 3 fail in files untouched here (Windows symlink EPERM in helper test; retrieval and Wolfram tests, likely local env vars). Not browser-checked at phone/desktop; no signed-in or live-provider test.
- Known gaps: provider look is style-faithful from existing themes, not compared pixel-by-pixel with the live apps; set `ANALYTICS_ADMIN_EMAILS=nteitleb@uwo.ca,jerlikhm@uwo.ca` in Vercel or the button never appears.
- Next: visual review of each provider on desktop and 375px; approve phase 4 plan. Authorization needed for merge/deploy.

- Update: Orbit step 1 (file excerpts, `lib/orbit/attachments.ts`, route, composer attach button) implemented; typecheck, lint, webpack build and 39 Orbit tests pass; same 3 unrelated suite failures. Awaiting second-model review and signed-in synthetic check.

## Update — design pass (Opus session)

- Provider skins: per-app composer placeholders ("Ask anything", "How can I help you today?", "Ask Gemini", "What do you want to know?"), list headings (Chats / Recents / Recent / History), ChatGPT's model picker moved to the top bar, Claude's orange "New chat" circle, per-app sidebar titles. Shared `components/app-rail.tsx` replaces two hand-built rails and adds the account menu (and Settings) to Orbit.
- Orbit redesign: `components/orbit-hero.tsx` (four app logos orbiting a glowing core, faster while voting), gradient greeting, floating composer, starter chips, "Answered by X · n of 4 votes" chip that expands into the ballot, vote panel shown in place of the pending answer, copy action.
- Courses workspace: full-height shell, Chat/Courses pill switch, drag-and-drop syllabus zone, "Ask with" logo picker (Orbit + four apps), underline tabs, course cards with open-task counts. No import/review/confirm logic changed.
- Phone fixes: header switcher fits 375 px (Export moves to per-answer menu on phones; model name hidden), unique SVG gradient ids so the Orbit icon renders on phones.
- Checks: lint, typecheck, webpack build pass; tests 521 pass / same 3 unrelated failures. Visual check used a temporary unauthenticated harness with synthetic data (removed before commit) at 1440×900 light/dark and 375×812; not a signed-in or live-provider test.

## Update — model menus and Claude models (second-model review done)

- Added Claude Haiku 5.5, Fable 5.1, Sonnet 5, Opus 5, Fable 5, Opus 4.8/4.7/4.6, Sonnet 4.6 to `config/models.ts` (ids/prices from Anthropic's model reference, cached Oct 6 2026). Defaults unchanged. Menus show each app's own models; other providers sit under "Other AIs".
- Independent review (Sonnet subagent, read-only) confirmed all new ids/prices and unchanged defaults; budget checks are not bypassed; refusals map to "blocked", not complete.
- Fixed from review: Sonnet 5.5 cache-read price 0.1 → 0.2 (pre-existing under-billing of cache reads); number-key model pick ignores Ctrl/Cmd/Alt.
- Behaviour change: Claude conversation summaries now use the cheapest Claude model, Haiku 5.5 (was Haiku 4.5); prompts stay far below its 100k price tier.
- Open (needs staging with live keys, not verified): Fable 5/5.1 always think; the adapter does not return thinking blocks in tool loops, which may 400 on the second tool step (same open question for Opus 5.5/Sonnet 5.5 adaptive thinking); thinking counts against the 8k max_tokens, so long answers may end incomplete; Fable is unavailable to zero-data-retention orgs; worst-case Fable reserve ≈ US$0.75 per call. Fable pricing/exposure is a product call for Jake.

## Update — all practical models per app (second-model review done)

- Added to `config/models.ts` with ids/prices from the official pages (fetched Oct 19 2026): 21 more OpenAI models (GPT-6 Sol, GPT-5.6 Sol/Terra/Luna, GPT-5.5, 5.4 + mini/nano, 5.2, 5.1, 5 + mini/nano, o3, o4-mini, o3-mini, GPT-4.1 + mini/nano, GPT-4o + mini), 6 more Gemini (4 Argon, 3.6 Flash, 3.5/3.1/2.5 Flash-Lite, 3 Flash preview, 2.5 Pro/Flash), 6 more Grok (4.6, 4.5, 4.3, 4.20 reasoning/non-reasoning, Build 0.1). Left out on cost/API grounds: OpenAI pro models, o1/o1-pro/o3-pro, legacy completions, specialty endpoints; Grok multi-agent.
- Menu layout per app via `MENU_MAIN`; summaries pinned via `SUMMARY_MODEL` (unchanged models); low-budget "cheaper model" banner limited to main models.
- Independent review (Sonnet subagent) matched every id/price against the fetched tables; defaults unchanged.
- **Dated price changes to apply:** Gemini 4 Argon → $4/$20 (cache $0.20) on Dec 1 2026; Gemini 3.8/3.6 Flash double on Jan 1 2027. Until updated, those rows would under-bill.
- Not verified live: each new model actually answering through its adapter (some older OpenAI/Gemini models may reject optional settings; adapters retry without them).

## Update — assignment workspaces (approved by Noah; second-model review done)

- Assignment page = Drive-style workspace: chats (any AI/Orbit), assignment files, course files. Details in `docs/COURSE_WORKSPACE.md` (Assignment workspaces).
- Context change: assignment-folder chats also see the parent course's details, syllabus and notes. Review found no cross-student path; fixed: stale-screen status edit dropping the link (UI + server carry-over), untrusted names moved inside the JSON fence, folder files searched first, labelled file index, remove-button focus/tablet visibility.
- Open: signed-in staging check (upload into a new assignment folder, chat in each AI and Orbit cites the instructions and the syllabus); creating a folder bumps the course version, so a syllabus revision open in another tab may need re-confirming (existing concurrent-edit behaviour).

## Update — plugins and skills

- Every plugin and skill has an icon of what it does (own drawings on an app-hinting colour; no company logos). Student-written skills get an icon guessed from their name.
- Plugins whose sign-in isn't configured show "Coming soon" instead of installing into a broken state; admins see the missing setting. Setup checklist added to `docs/INTEGRATIONS.md`.
- Test isolation: three tests failed only because this machine's shell has real `WOLFRAM_APP_ID`, `SMART_MEMORY_ENABLED`/`OPENAI_API_KEY` set (one made a live Wolfram call) or lacks Windows symlink rights. Tests now ignore the real environment and use a junction on Windows. Full suite: 537/537.
- Not verified: live sign-in for any provider (keys aren't set locally); production env presence is unknown from here.
