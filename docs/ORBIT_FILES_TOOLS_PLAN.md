# Plan — Orbit with files, images and tools (P2, awaiting approval)

Status: **plan only; no code written.** Authorized in principle by Jake's request (recorded in `DECISIONS.md`, Oct 19, 2026). Billing/routing change: needs approval of this approach, then a second-model review before merge.

## Problem / outcome
Orbit is text-only (`docs/ORBIT_MODE.md`). Students want to attach syllabus/PDFs/images and use course folders with Orbit as with any single provider.

## What exists
Orbit route (`app/api/orbit/route.ts`) votes with four cheap models, adds one optional specialist, then streams the lead. Course/folder *text* excerpts already enter via `courseContext`. Normal chat has the file pipeline (`lib/files/`), attachment handling and tool loop (`app/api/chat/route.ts`, `lib/chat/`).

## Smallest viable change (recommended order)
1. **Files as text/OCR first.** Reuse the existing owned-file extraction. Attached files become bounded excerpts in the same shared context budget (`ORBIT.inputTokens`), shown to voters and the lead, with the existing "goes to all four providers" disclosure updated to list the filenames. Fail closed if too large. No raw bytes to voters.
2. **Images/PDF pages only to the lead,** and only if the lead model supports them; voters get a text description request avoided (no extra paid call): voters see "image attached" metadata. If the lead cannot take images, say so and stop; **no silent provider substitution**.
3. **Tools only for the lead,** reusing the normal chat tool loop (web search, plugins, code). Every tool round is its own reserve → call → reconcile with `orbit_answer` operations. Specialist and voters get no tools. Hard cap on rounds from `config/orbit.ts`.

Alternative (smaller): ship step 1 only and keep 2–3 deferred.

## Likely files
`app/api/orbit/route.ts`, `lib/orbit/*`, `config/orbit.ts` (new limits/flags), `components/orbit-chat.tsx` (attach button, chips), tests alongside; docs `ORBIT_MODE.md`, `CURRENT_STATE.md`. Migration only if attachments need an Orbit link column (check first; reuse existing message/file links).

## Risks
- Cost: bigger prompts multiply across four voters; helper cap (US$0.15/turn) must include attachment tokens, or voters get excerpts only.
- Privacy: file text now goes to all four vendors; needs explicit per-turn disclosure.
- Tool loops extend the lead call; client disconnect handling must still settle usage.
- Eligibility, ownership/RLS checks on file IDs (another user's file must be rejected).

## Acceptance
Attach a synthetic syllabus in Orbit: voters get bounded excerpts, lead answers with filename citations; over-limit file fails closed; another user's file ID is rejected; each call settles; flag-off returns the existing disabled response; phone and desktop checked.

## Validation
Mocked-provider route tests (ownership, caps, budget between phases, terminal signals), `npm run lint/typecheck/test/build`, synthetic desktop+375px check. Live-provider quality/cost runs need Jake's authorization. Second-model review before merge.

## Decisions needed from Jake/Noah
Approve step order (1 only, or 1–3); approve the extra disclosure text; confirm tools may run only for the lead.
