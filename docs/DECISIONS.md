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

## October 19, 2026 — Courses contain folders

Jake requested folders in the main sidebar, with pinned and recent folders. Folders group chats and files; courses can contain multiple folders, including assignment folders, and expose them through the course workspace. Implemented on `folders-course-navigation`; migration 0018 and deployment remain pending. Existing courses and their direct chat/file links are preserved.

## October 26, 2026 — approved subscription pricing

Jake approved in the pricing chat: all subscription prices CAD, all provider usage budgets USD; a seven-day trial with USD $3 total; student CAD $30/month and regular CAD $40/month; CAD $20 converted to USD in usage per month for both paid plans. Annual plans cost CAD $324/student or CAD $432/regular upfront (10% off) with identical monthly limits. Lower annual margins are accepted. Student is the primary marketed offer. Payments remain disabled pending lifecycle and release approval.
