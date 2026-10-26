# Run the document worker locally on Windows

This guide is for **staging only**. The worker processes every queued file in the Supabase project it points to and uses that project's service-role key. Never point a local validation run at the production project.

## Prerequisites

1. Install [WSL 2 and Docker Desktop's WSL 2 backend](https://docs.docker.com/desktop/setup/install/windows-install/). Docker's current Windows requirements include WSL 2.1.5+, 8 GB of system RAM and hardware virtualization. Enabling WSL for the first time requires Windows administrator access and can require a restart. Docker Desktop does not need a separate Ubuntu distribution. On Noah's Windows machine, Docker Desktop 4.97.0 is installed and its installer enabled the required Windows features; **restart Windows before trying to start Docker Desktop**.
2. Create an [isolated Supabase staging/preview branch](https://supabase.com/docs/guides/deployment/branching) without production data. It needs its own URL and service-role key, migration `0026_large_files_previews.sql`, and a **global Storage file-size limit of at least 512 MiB**. The `uploads` bucket limit is set by the migration. [Supabase Free projects](https://supabase.com/docs/guides/storage/uploads/file-limits) cannot raise the global limit above 50 MB.
3. Point a Vercel preview deployment at that same staging branch for browser upload tests. Keep production environment variables separate.

## Verify Docker

From a fresh PowerShell window after Docker Desktop starts:

```powershell
wsl --version
docker version
docker compose version
```

Docker Desktop must use **Linux containers**. If `docker version` shows only a client, start Docker Desktop and wait for its engine.

## Build and validate one queued job

From the repository root:

```powershell
docker compose -f compose.document-worker.yml -f compose.document-worker.local.yml config --quiet
docker compose -f compose.document-worker.yml -f compose.document-worker.local.yml build document-worker
```

Use the **staging** branch URL. Enter its service-role key into the current PowerShell process without writing it to a repo file or terminal history:

```powershell
$env:SUPABASE_URL = Read-Host 'Staging Supabase URL'
$keyInput = Read-Host 'Staging service-role key' -AsSecureString
$env:SUPABASE_SERVICE_ROLE_KEY = [System.Net.NetworkCredential]::new('', $keyInput).Password
Remove-Variable keyInput
docker compose -f compose.document-worker.yml -f compose.document-worker.local.yml run --rm document-worker
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

The local override runs **one queue check**, then exits. Queue a synthetic PDF or Office file through the staging app before running it. A real large-file validation should check that the file moves from queued to ready, the Office preview opens within Orbit, and chat cites only relevant indexed passages. Run the command again for another job. The worker uses at most 4 GiB memory and a 2 GiB temporary filesystem through Compose; test with adequate free memory and disk.

Do not run `docker compose config` without `--quiet` after loading the key: it prints resolved environment values. The worker refuses to start without both staging values, but `build` and `config --quiet` work without secrets.

## Troubleshooting

- `wsl --status` says WSL is missing: install/enable WSL 2 from an **administrator** PowerShell and restart if Windows requests it.
- Docker reports that the daemon is unavailable: open Docker Desktop, select the WSL 2/Linux engine and wait for startup.
- Upload fails above 50 MB: check the staging project's plan and **global** Storage limit, then the `uploads` bucket limit.
- File stays queued: confirm the migration was applied to this staging branch, the correct branch URL/key were supplied, and run the one-job command again.
- Preview fails: inspect worker status without logging document contents. LibreOffice conversion can fail or change proprietary Office layout; the original remains downloadable.

See [the implementation plan](LARGE_FILE_PREVIEW_PLAN.md) and [handoff](handoffs/2026-10-26-large-file-preview.md) for the processing bounds and release gates.
