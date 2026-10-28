# Validate large documents with local Supabase and Docker

This is isolated **local staging** with disposable synthetic data. The worker processes every queued file in the Supabase project named by its service-role key. Never point it at production.

## Prerequisites and isolation

Install WSL 2 and Docker Desktop with Linux containers. On Noah's Windows machine, WSL 2.7.14 and Docker Desktop 4.97.0 were verified October 27, 2026. Start Docker Desktop first.

Docker Desktop published local Supabase's API, database and mail ports on all interfaces despite the network's localhost binding option. Windows firewall rule **`Orbit AI local Supabase staging ports`** must remain enabled: inbound TCP 54321, 54322 and 54324, all profiles, **Block**. Check before starting:

```powershell
netsh advfirewall firewall show rule name="Orbit AI local Supabase staging ports"
```

The network and firewall together form the local isolation boundary. This was verified locally, but not from a second computer. If the rule is absent, restore it from an administrator PowerShell before starting Supabase: `New-NetFirewallRule -DisplayName "Orbit AI local Supabase staging ports" -Direction Inbound -Action Block -Profile Any -Protocol TCP -LocalPort 54321,54322,54324`. Do not disable the host firewall or use real student data.

## Prepare and start the stack

Run from the repository root:

```powershell
npm ci
node scripts/prepare-local-supabase.mjs
docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 orbit-local-only
npx supabase --workdir .local-supabase start --network-id orbit-local-only -x realtime,imgproxy,studio,edge-runtime,logflare,vector,supavisor,postgres-meta --yes
```

Create the network only once. If it already exists, verify its binding with `docker network inspect orbit-local-only`. The preparation script makes **ignored copies** of historical migrations with unique local versions. Old version prefixes `0013` and `0024` repeat, so starting Supabase directly from the tracked `supabase/` directory fails on its migration-version primary key. The script changes no tracked migration and no shared database. The generated project ID is `orbit-ai-large-file-local`.

`supabase/config.toml` sets the local global Storage limit to **512 MiB**; migration 0026 sets the `uploads` bucket to the same size. CLI start/status output contains local keys. Keep it out of screenshots, logs and commits. `.local-supabase/` and `.env.local` are ignored.

Confirm all migrations and Storage health:

```powershell
docker ps --format '{{.Names}} {{.Status}}'
docker exec supabase_db_orbit-ai-large-file-local psql -U postgres -d postgres -tAc 'select count(*) from supabase_migrations.schema_migrations'
```

The October 27 local run applied **28** migrations and verified the `uploads` bucket limit at **536870912 bytes**. Never apply the renumbered copies to a shared project.

## Run one worker job

```powershell
docker compose -f compose.document-worker.yml -f compose.document-worker.local.yml config --quiet
docker compose -f compose.document-worker.yml -f compose.document-worker.local.yml build document-worker
$localStatus = npx supabase --workdir .local-supabase status -o json 2>$null | ConvertFrom-Json
$env:SUPABASE_URL = 'http://supabase_kong_orbit-ai-large-file-local:8000'
$env:SUPABASE_SERVICE_ROLE_KEY = $localStatus.SERVICE_ROLE_KEY
docker compose -f compose.document-worker.yml -f compose.document-worker.local.yml run --rm document-worker
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
Remove-Variable localStatus
```

Do not print `$localStatus` or run `docker compose config` without `--quiet` after setting the key. The local override processes **one queue check** then exits. Queue a synthetic file through the local app, then rerun it. The worker joins `orbit-local-only` and uses Supabase's internal Docker hostname. The browser app uses `http://127.0.0.1:54321`. The image is non-root with LibreOffice and Poppler; Compose limits memory to 4 GiB, temporary space to 2 GiB, CPU to two cores and process count to 128.

For local Next, put the local API URL and publishable key in `.env.local`; put the local service-role key there **only for server-side code**. Never copy these keys into Vercel or production settings. For synthetic signup, set `SCHOOL_EMAILS_ONLY=off`, `WAITLIST_MODE=off`, and `LIVE_MODELS=off`. No paid provider calls are needed.

## Checks performed and limits

On October 27, this stack passed synthetic DOCX conversion to a private PDF and page indexing; a **20,971,521-byte** resumable text upload and indexing (**14,980** chunks); and an **exact 536,870,912-byte** resumable upload accepted by Storage. The worker's internal API connection returned 200. Synthetic users, file rows and objects were deleted after testing. A signed-in synthetic chat displayed the converted DOCX and a native two-page PDF in the in-app browser with working page navigation and Close after the PDF.js viewer change. Standard Chrome/Edge and phone-sized preview, interrupted TUS resume, large Office conversion load, cross-user denial and live-provider retrieval still need validation before release.

## Stop and troubleshoot

```powershell
npx supabase --workdir .local-supabase stop
```

- Docker engine unavailable: start Docker Desktop and wait for Linux engine health.
- Migration collision: rerun the preparation script and use `--workdir .local-supabase` on every Supabase CLI command.
- Upload rejected near 512 MiB: check the global Storage and `uploads` bucket limits.
- File stays queued: run another worker check; inspect status and attempts without logging document contents.
- Office preview differs from original: LibreOffice may alter proprietary effects or fonts. Keep the original downloadable.

See [the implementation plan](LARGE_FILE_PREVIEW_PLAN.md) and [local validation handoff](handoffs/2026-10-27-local-supabase-document-worker.md) for release gates and extraction bounds.
