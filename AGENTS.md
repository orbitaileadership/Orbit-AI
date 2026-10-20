# Orbit AI — workspace instructions

For Orbit engineering work, follow [docs/ENGINEERING_PROTOCOL.md](docs/ENGINEERING_PROTOCOL.md). Apply its intake, scope, validation, and reporting rules proportionally to the task.

## Start here

- Repository: https://github.com/orbitaileadership/Orbit-AI.
- Read `docs/PROJECT_INDEX.md` and `docs/CURRENT_STATE.md`, then only task-relevant code and documents. Do not preload the whole repository or historical transcript.
- Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/TASKS.md` when relevant to the task. Old checklists and feature notes are not evidence of current behavior.
- Historical technical details previously in this file are preserved in `docs/AGENT_FEATURE_REFERENCE.md`; load relevant sections as needed.
- Use `docs/PROJECT_WORKFLOW.md` for chat organization and handoffs. Save decisions and task outcomes in the repository, rather than relying on chat memory.

## Safeguards

- Secrets and provider API calls stay server-side. Never expose keys or log student message content. Use synthetic test accounts and data.
- Enforce verified school-email eligibility (lib/auth/eligibility.ts; sign-up also matches the picked school, config/institutions.ts), early-access/waitlist rules, ownership checks and RLS on the server.
- Every billable model call requires atomic reserve → call → reconcile, including retries and tool rounds. Preserve budget limits and failure handling.
- No silent provider substitution or history dropping. Preserve disclosed context handling, truthful citations and explicit incomplete-response states.
- Keep payments disabled until Jake explicitly approves complete billing rules and activation.
- Model IDs, pricing, allowances, limits and flags belong in the existing `config/` files. Reuse existing components and infrastructure.
- Preserve Orbit design tokens and branding; use `app/globals.css` and `components/brand.tsx` rather than arbitrary colors.
- Follow user-approved scope. Orbit Mode is an explicitly approved preview; read `docs/ORBIT_MODE.md` before changing its routing or collaboration.
- Before course import/context changes, read `docs/COURSE_WORKSPACE.md`; preserve source evidence, student review and concurrent edits.

## Work and verification

- One outcome per chat and focused branch. Preserve unrelated changes; use separate worktrees for concurrent edits.
- Inspect code before changing it; plan multi-file changes. Honor explicit planning/approval boundaries.
- Scale checks to risk using the engineering protocol. For application changes use relevant lint, typecheck, unit/integration and build checks; for user flows verify phone and desktop behavior. Documentation-only changes need link/path and diff checks.
- Get a second-model review before merging auth, context transfer, cost accounting or payment changes.
- Implementation permission does not itself authorize production merges/deployment, shared database migrations, paid live-provider tests or messages to others. Use the authorization already given for the current task; do not repeatedly ask.
- Report actual checks, limitations and the next action. Never claim deployment, live quality or launch readiness from local tests alone.
- Before closing, save a short `docs/handoffs/` entry using `TEMPLATE.md`; update current state and approved decisions when they change.

## Commands

Use scripts actually present in `package.json`: `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Check availability before claiming an end-to-end script exists. Live evaluations/provider checks cost money and require authorization.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
