# Task handoff — live chat PDF preview

- Date / owner: October 28, 2026 / Codex for Noah.
- Status: implemented locally; awaiting review and release.
- Task and acceptance criteria: A student can click an uploaded PDF in a provider chat and view it inside Orbit, including after the message is sent, without exposing another student's file.
- Repository / branch: `orbitaileadership/Orbit-AI`, `codex/live-pdf-preview`, based on live rollback `6d049b1`.
- What changed and why: The rollback build rendered PDF file chips as static text. Added a clickable chip, owner-checked PDF signed-URL route, and PDF.js canvas viewer. The fix uses only the existing `files` columns and original private Storage object.
- Important decisions: Noah chose to wait for the full 512 MiB rollout; this branch enables only existing-size PDF previews and leaves that release gate intact.
- Checks: Three synthetic route tests pass (owner, other user, non-PDF); targeted lint and TypeScript pass; `next build --webpack` passes. Default Turbopack build panicked while spawning the CSS processor in the local sandbox; webpack first hit sandbox `EPERM` on `.next`, then passed when rerun with filesystem permission. No signed-in browser preview was verified.
- Database state: no migration or shared database change.
- Release state: no Preview or Production deployment. Live site still shows the old static chip until a release is approved.
- Known limits: PDF preview only; Office rendition and 512 MiB support remain gated. Confirm actual signed-in PDF rendering on desktop and phone before calling it released.
- Rollback: re-promote existing `6d049b1` deployment if this isolated UI change causes a live regression.
- Next action: push/review this branch, obtain production release authorization, deploy from the rollback base, and verify a synthetic PDF on the live site.
