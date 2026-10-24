# Orbit AI — approved decisions register

Seeded from the conversation and existing engineering protocol on October 19, 2026. Jake/Noah should review before adopting. Add the exact issue/PR/chat reference as it becomes available. Proposed priorities belong in CURRENT_STATE until approved.

| Decision | Owner/source | Date/status |
|---|---|---|
| Use `orbitaileadership/Orbit-AI` as the primary repository; old repository is history | Jake's repository migration request; `docs/REPOSITORY_MIGRATION.md` | Confirmed in this chat |
| Preserve existing access, login, routing, auth and database behavior while simplifying landing/signup | Jake's approved landing requirements; `docs/PUBLIC_LANDING.md` | Confirmed; implementation restored by migration |
| Western uses account creation/verification; other Canadian institutions use waitlists; unlisted institutions can be entered manually | Jake's registration brief | Confirmed; retain server validation |
| Shared Courses and syllabus review are part of the product | Jake's approved scope; `docs/COURSE_WORKSPACE.md` | Confirmed |
| Accept scanned/mixed PDFs; do not silently skip pages or bypass budget/context limits | Jake's syllabus fixes; commits `1e49ef9`, `5dc555a` | Implemented and deployed; real quality validation pending |
| Analyze token growth using actual usage and clearly labeled prompt-size/workload estimates; keep content out of analytics | Jake's analytics request; `docs/TOKEN_USAGE_ANALYTICS.md` | `dcd0b6e` merged/deployed after explicit approval |
| Follow the shared engineering protocol across AI tools | Jake's protocol request; `AGENTS.md`, `CLAUDE.md`, `docs/ENGINEERING_PROTOCOL.md` | Existing shared instruction |
| Keep payment activation and final pricing/lifecycle subject to product approval | Existing engineering protocol and product documentation | No final payment approval recorded here |
| Production release/shared migrations/live paid tests require appropriate explicit authorization; implementation permission alone is insufficient | Existing protocol; production push was blocked until Jake approved | Apply per task; never infer blanket future approval |

New entry format: decision; owner; date; source/link; affected behavior; what it supersedes. Preserve changed decisions as superseded rather than keeping contradictory active instructions.

## October 23, 2026 — Rolling usage allowances

Noah requested a C$20 API allowance within the planned C$30 subscription price, converted to USD using the configured account exchange rate, shared across providers and models. He explicitly chose rolling **24 hours / 7 days / 30 days**: daily = monthly / 30; weekly = monthly × 7 / 30. Students see percentage remaining and colored bars in Settings → Usage; only authorized admins see monetary usage details. This supersedes the October 22 single-meter/no-weekly-limit presentation and student-facing allowance dollars. See [USAGE_WINDOWS_PLAN.md](USAGE_WINDOWS_PLAN.md).

Implementation caps existing entitlements and preserves trial expiry and smaller/lifetime allowances; it does not create paid entitlements or renew balances. Payments remain disabled. Shared migration and production rollout require separate authorization.

## October 23, 2026 — Centralized Courses Hub

Noah approved revamping Courses into a centralized academic hub inspired by Google Docs, using the supplied Courses Workspace memo and continuing implementation. The core hub organizes courses, upcoming work, materials, assignment folders, chats and study preparation. It supersedes the previous scattered course navigation while retaining existing course records, reviewed evidence and context limits. Study in this iteration prepares unsent chat prompts; advanced adaptive learning and external integrations remain later work. See `COURSES_HUB_PLAN.md`. Approval covers implementation; production release, shared migrations and paid provider checks still require their existing authorization.

## October 19, 2026 — Courses contain folders

Jake requested folders in the main sidebar, with pinned and recent folders. Folders group chats and files; courses can contain multiple folders, including assignment folders, and expose them through the course workspace. Implemented on `folders-course-navigation`; migration 0018 and deployment remain pending. Existing courses and their direct chat/file links are preserved.

## October 19, 2026 — Interface redesign and Orbit reprioritization

Jake requested (via Noah's session) that the four provider tabs match the look, motion and features of ChatGPT, Claude, Gemini and Grok; that Orbit Mode get a matching visual redesign; and that course folders and syllabus import work with every provider and Orbit. Approved approach: style-faithful recreation using Orbit's own assets (no copied logos, fonts or wordmarks); one themed shell refined in order ChatGPT, Claude, Gemini, Grok; analytics button visible only to emails in the server `ANALYTICS_ADMIN_EMAILS` allowlist (nteitleb@uwo.ca, jerlikhm@uwo.ca).

**Reprioritization (supersedes the "text-only first preview" limit in `docs/ORBIT_MODE.md`, pending implementation):** Orbit may be extended to files, images and tools. This is P2 work that touches billing and routing, so it requires a written plan, a second-model review, and preserved reserve → call → reconcile before merge. Phased order: admin button, provider re-skin, Orbit visual redesign and course/folder polish, then Orbit files/tools. Release and any live paid tests still need separate authorization.

## October 19, 2026 — Each app offers only its own models

Noah (engineering owner) decided that ChatGPT, Claude, Gemini and Grok each offer only their own provider's models; the model menu no longer lists other AIs, and the chat endpoint rejects a request whose model belongs to a different app than the chat (`homeProvider !== provider`). Chats saved earlier with another provider's model continue on that app's selected model, shown in the menu. Switching AIs now means switching apps (separate chats); Orbit remains the multi-AI mode.

**Supersedes:** same-chat switching *across providers* described as a P0 promise in `docs/ENGINEERING_PROTOCOL.md` §1/§3 and `docs/PRODUCT_SPEC.md`. Model switching within one provider's models is unchanged. Jake should confirm, and the spec/protocol wording should be updated if he agrees.

## October 20, 2026 — Any-email sign-up comes from main

The interim `OPEN_SIGNUP` switch on this branch was dropped when main was merged: main already accepts any verified email by default (`SCHOOL_EMAILS_ONLY=on` restricts to school addresses). Waitlist/early-access rules still decide app access.

## October 22, 2026 — Orbit Pro shown as "Coming soon" (C$30/month, C$20 of usage)

Noah relayed the plan: students pay C$30/month and get C$20 of AI usage per month (matches `config/economics.ts` and the `subscription_price_cad_micros` / `monthly_allowance_cad_micros` settings). Settings → Billing now describes this plan with a disabled "Coming soon" button and says paid plans aren't available. **Payments stay disabled** (`paymentsEnabled: false`); checkout, renewal, cancellation/refunds and the monthly reset still need Jake's explicit approval before any billing work. The usage meter (sidebar, Orbit, Settings → Usage) shows the real allowance from the budgets table: trial accounts show "Free trial" with the end time; there is no separate session or weekly limit.


## October 22–23, 2026 — Disclosed Google voting unavailability

Jake explicitly approved deployment of a three-provider vote when Google is unavailable, requested Google return automatically and required visible exclusion. PR 22 implemented the typed pre-stream 503 case; October 23's repeated-failure report and availability requirement extend that same disclosure policy to Google's verified voting deadline. Google is attempted on each new turn, never permanently disabled. Timeout adds no retry; an eligible 503 can still receive the one existing bounded retry. User cancellation, access/configuration gates and spending limits remain enforced. This supersedes all-four-or-fail only for those Google availability cases; it does not authorize invented ballots, hidden answer-model substitution or agent-initiated paid tests. See ORBIT_MODE.md and the October 23 timeout handoff.

## October 23, 2026 — Courses Workspace revamp approved

The user requested Dashboard / Sections / Quiz, a visual calendar and graded-event resources, then approved the written [revamp plan](COURSES_WORKSPACE_REVAMP_PLAN.md) with “go ahead.” This supersedes the earlier unsent Study setup and Overview/Assignments navigation. Reuse existing folders, evidence retention, eligibility/RLS and reserve → call → reconcile. Supported first integrations use explicit delegated Google/Microsoft refresh and reviewed writes/invitations; Apple uses `.ics` copies, Anki/Quizlet use validated export/import. Continuous background calendar sync, private subscriptions and direct study-app account sync require further design/access; they are not represented as implemented. Implementation permission does not authorize production deployment, shared migration 0022, paid model validation or real invitations.

## October 24, 2026 — Courses workspace simplification

Noah requested course-only navigation, equal-height Overdue/Today/Coming up panels, centered event dialogs, removal of promotional slogans and term filtering, one sidebar calendar entry, and section-scoped chats. The interface now uses **Graded Sections**; chat navigation and its AI picker appear inside a specific section. Name search and A–Z ordering replace term/recent sorting. Existing records remain intact; older chat projects without course metadata no longer appear as courses. This supersedes the course-level Chats/recent-chat presentation. Quiz configuration remains available through its existing dedicated workflow.
