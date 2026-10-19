# Orbit AI — access and environments

Non-secret service map. Fill missing fields with the owner; do not add API keys, tokens, passwords, service-role keys, real student content or database exports.

| Service | Known reference | Owner / remaining setup |
|---|---|---|
| GitHub | https://github.com/orbitaileadership/Orbit-AI | Jake/Noah: confirm each person's access; use their own account |
| Vercel | Team `orbit-ai7`, project `orbit-ai` in the recorded deployment links | Noah: verify current production domain, production/preview branches, environment variables and rollback access |
| Supabase | Project ref `rcfnptnaoncfsavxgybc`, project `orbit-ai`, recorded region Canada Central | Noah: confirm dashboard access, backup/recovery approach and applied schema state; old/new app use same database |
| OpenAI / Anthropic / Google / xAI | Names/configuration in `.env.example` and `config/models.ts` | Noah: provision authorized access and spending controls; never share keys through chats/email |
| GitHub / Google / Microsoft and other OAuth integrations | `docs/INTEGRATIONS.md`, relevant auth/connector configuration | Noah: verify app ownership, redirect URLs and least-privilege settings for each environment |
| Admin analytics | `/admin/analytics`, server `ANALYTICS_ADMIN_EMAILS` allowlist | Noah: verify authorized staff identity and test access; do not put staff credentials here |
| Product/legal/design source documents | Register non-secret links in `PROJECT_INDEX.md` | Jake: supply approved versions and owner/date |

## Record before release

- Exact branch/commit and approved action.
- Production and preview URLs; known hosting protections.
- Database project reference and the evidence for each relevant applied migration.
- Test environment and synthetic test identities (identifiers only; no credentials).
- Checks run, who reviewed/approved, observed deployment status, rollback steps.

Secrets live in the approved service secret stores or ignored local development environment. `.env.example` documents required names only. A Git clone does not provide accounts, secrets, provider credits, OAuth approvals, or database contents.
