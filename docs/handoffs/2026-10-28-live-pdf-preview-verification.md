# Task handoff — live PDF preview verification

- Date / owner: October 28, 2026 / Noah
- Status: live PDF preview verified in one ChatGPT browser journey; full 512 MiB release deferred
- Task and acceptance criteria: Diagnose a reported inert PDF click on the live site; verify a saved PDF opens and paints inside Orbit.
- Repository / branch: `codex/full-large-file-release` (documentation follow-up); live build remains `6f6b8e7` from `codex/live-pdf-preview`.
- Working tree: unrelated untracked `.claude/` left untouched.
- What changed and why: No application code changed. The open live tab had old JavaScript from before the PDF-preview deployment. Reloading showed `Preview <filename>` on saved PDF chips; clicking opened the in-app viewer. The accessibility tree showed page 1 of 18 and a screenshot visibly confirmed the page canvas.
- Important decisions and source: Noah chose to keep Supabase Free and requested a one-week reminder before reconsidering paid Storage and a hosted worker.
- Checks: Vercel deployment `D4YeXU7awtW7Tom8LcesUsPHf7V7` showed Ready, Production, exact commit `6f6b8e7`, and `orbit-ai-sand.vercel.app` among current domains. Authenticated live browser reload and PDF click succeeded. No provider calls, uploads, migrations, or new application tests were performed.
- Database state: production migration 0026 remains unapplied; Supabase Free remains in use.
- Release state: PDF-only preview is live; full 512 MiB upload/Office preview is not released.
- Known risks: Other provider chats, devices, and older open tabs have not been rechecked. Existing tabs may need a reload to load the deployed client code.
- Rollback/recovery: Production remains on its PDF-only rollback-based build; full release requires the ordered gates in `docs/PRODUCTION_LARGE_FILE_ROLLOUT.md`.
- Next action and owner: Noah can reload an old tab and click the PDF name. Revisit paid infrastructure when the one-week reminder arrives.
- Authorization still needed: Any paid plan, hosted worker, production schema migration, or full-feature deployment requires its normal owner/release approvals.
