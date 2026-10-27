# Orbit AI — start here

Workspace index installed October 19, 2026. Keep this map current.

Repository: https://github.com/orbitaileadership/Orbit-AI. Pull current work; this file is a map, not a replacement for code inspection.

## Read first

1. `AGENTS.md` and `docs/ENGINEERING_PROTOCOL.md`: applicable instructions and safeguards.
2. `docs/CURRENT_STATE.md`: latest verified state, gaps and next checks.
3. The task's handoff and the relevant sources below. Follow any additional reading requirements in existing instructions.

Approved requirements describe intended behavior. Current code and tests establish implemented behavior. Flag conflicts instead of silently treating either as proof that the other is correct.

## Task-specific sources

| Task | Read when relevant |
|---|---|
| Product priorities / launch | `docs/PRODUCT_SPEC.md`, `docs/CURRENT_STATE.md`, `docs/DECISIONS.md`; reconcile historical `docs/TASKS.md` with evidence |
| Chat / context / usage limits | `app/api/chat/route.ts`, `lib/chat/`, `config/context.ts`, `config/models.ts`, `docs/ARCHITECTURE.md`, `docs/SMART_MEMORY_ANALYTICS.md` |
| Authentication / access | `lib/auth/`, `lib/api.ts`, `app/login/`, `app/signup/`, `app/auth/`, `proxy.ts`, relevant route tests, Supabase policies |
| Financial controls | `lib/billing/`, `config/economics.ts`, `config/models.ts`, migrations `0001`/`0009`, `test/financial-database.test.ts` |
| Analytics | `docs/TOKEN_USAGE_ANALYTICS.md`, `lib/analytics/`, `app/admin/analytics/`, `app/api/admin/analytics/`, `components/analytics-token-usage.tsx`, migrations `0009`/`0011`/`0017` |
| Courses / syllabus | `docs/COURSE_WORKSPACE.md`, current syllabus sections in `docs/ARCHITECTURE.md`, `lib/courses/`, `lib/files/`, `app/api/courses/`, `components/course-workspace.tsx`, `config/courses.ts`, migration `0015` |
| Landing / registration | `docs/PUBLIC_LANDING.md`, `config/institutions.ts`, `config/public-site.ts`, landing/signup components and routes, migration `0016` |
| Orbit Mode | `docs/ORBIT_MODE.md`, `lib/orbit/`, `app/api/orbit/`, `components/orbit-chat.tsx`, `config/orbit.ts`, migration `0014` |
| Plugins / integrations | `docs/INTEGRATIONS.md`, `lib/plugins/`, `lib/connectors/`, auth/OAuth routes and relevant tests |
| Response quality | `docs/RESPONSE_QUALITY.md`, `config/quality.ts`, `benchmarks/`, provider adapters and tests |
| Branding / interface | `app/globals.css`, `components/brand.tsx`, `config/themes.ts`, `public/brand/`, `public/providers/`, `public/institutions/`, `docs/INSTITUTION_ASSETS.json` |
| Deployment / schema | `docs/ACCESS_AND_ENVIRONMENTS.md`, actual deployment/schema records, `.env.example`, `package.json`, ALL `supabase/migrations/`; old `docs/SETUP.md` needs reconciliation |
| Local large-document worker | `docs/LOCAL_DOCUMENT_WORKER.md`, `docs/LARGE_FILE_PREVIEW_PLAN.md`, `compose.document-worker.yml`, migration `0026` |
| Repository history | `docs/REPOSITORY_MIGRATION.md`, `docs/JAKE_MERGE_FIXES.md`, Git history, linked issues/PRs; old repo is reference only |

## Workspace workflow

See `PROJECT_WORKFLOW.md` for focused chats, branches and archive steps. `AGENT_FEATURE_REFERENCE.md` preserves older detailed feature notes; read only relevant sections.

## Maintain these small files

- `CURRENT_STATE.md`: update after verified changes; keep current facts and a short next-action list.
- `DECISIONS.md`: record approved lasting decisions, owner/date/source, and superseded decisions.
- `ACCESS_AND_ENVIRONMENTS.md`: non-secret service locations, owners, environments and access gaps.
- `handoffs/`: one dated summary per task. Old summaries are history, loaded only when needed.

## External source register

| Source | Location / owner | Status |
|---|---|---|
| Approved product/pricing briefs outside this chat | Jake to add exact location and latest approved date | Not supplied in this kit; do not invent final pricing |
| Legal/contact/public affiliation approvals | Jake/Noah to register exact approved versions | Needs confirmation |
| Vercel deployment records | Add non-secret dashboard URL in access map | Not included in a Git clone |
| Supabase applied-schema history and policies | Noah to maintain access and applied-migration record | File presence alone is insufficient |
| GitHub issues / PRs | New repository's Issues / Pull requests | Link relevant item in each handoff |
| Historical engineering conversation | `handoffs/2026-10-19-history.md` summarizes the known outcomes | Full transcript is optional private reference, not required context |

Do not upload every source to every chat. Keep the full repository available and let each task read what it needs. Synced `sources/` folders are read-only reference material.
