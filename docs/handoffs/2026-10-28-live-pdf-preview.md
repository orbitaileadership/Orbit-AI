# Task handoff — live chat PDF preview

- Date / owner: October 28, 2026 / Codex for Noah.
- Status: PDF-only production deployment Ready; user PDF view check pending.
- Task and acceptance criteria: A student can click an uploaded PDF in a provider chat and view it inside Orbit, including after the message is sent, without exposing another student's file.
- Repository / branch: `orbitaileadership/Orbit-AI`, `codex/live-pdf-preview`, commit `6f6b8e7`, based on live rollback `6d049b1`.
- What changed and why: The rollback build rendered PDF file chips as static text. Added a clickable chip, owner-checked PDF signed-URL route, and PDF.js canvas viewer. The fix uses only the existing `files` columns and original private Storage object.
- Important decisions: Noah chose to wait for the full 512 MiB rollout; this branch enables only existing-size PDF previews and leaves that release gate intact.
- Checks: Three synthetic route tests pass (owner, other user, non-PDF); targeted lint and TypeScript pass; `next build --webpack` passes. Default Turbopack build panicked while spawning the CSS processor in the local sandbox; webpack first hit sandbox `EPERM` on `.next`, then passed when rerun with filesystem permission. No signed-in browser preview was verified.
- Database state: no migration or shared database change.
- Release state: Vercel production [D4YeXU7awtW7Tom8LcesUsPHf7V7](https://vercel.com/orbit-ai7/orbit-ai/D4YeXU7awtW7Tom8LcesUsPHf7V7) at `6f6b8e7` reported Ready and listed `orbit-ai-sand.vercel.app`. The live app rendered in an authenticated browser; the owner is checking an existing PDF attachment. No migration or Storage setting changed.
- Known limits: PDF preview only; Office rendition and 512 MiB support remain gated. Confirm actual signed-in PDF rendering on desktop and phone before calling it released.
- Rollback: re-promote existing `6d049b1` deployment if this isolated UI change causes a live regression.
- Next action: confirm PDF page rendering in a signed-in live chat. For the full 512 MiB release, provision an eligible Storage plan and hosted worker, audit/apply migration 0026, then perform signed-in staging and production checks. A new `main` deployment can supersede this isolated live build.
