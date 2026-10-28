# Task handoff — windowed PDF preview

- Date / owner: October 28, 2026 / Noah
- Status: released on pinned PDF-only Production branch; main backport awaiting review
- Task and acceptance criteria: Open an uploaded PDF in a centered window inside Orbit, preserving the original page layout and PDF navigation.
- Repository / branches: `codex/pdf-only-production` commit `d798f52`; backported to `codex/record-production-rollback` for main review.
- What changed and why: `components/document-preview.tsx` now presents a rounded, centered dialog with backdrop, filename, Download and Close. The existing PDF.js renderer still draws original PDF pages. Focus stays in the dialog, Escape closes it, and body scrolling is restored afterward.
- Important decisions and source: Noah confirmed PDF was the file type and requested an in-app window. The Free-plan and migration-0026 deferral remain in effect.
- Checks: targeted ESLint passed; production webpack build (including TypeScript) passed; sequential `npm run typecheck` passed. An earlier concurrent typecheck failed only because build and typegen both rewrote `.next/types` at the same time. Fresh signed-in live desktop visit opened a private 18-page PDF in the centered window, advanced to page 2, and closed with Escape. No new upload or provider call was made.
- Database state: production migration 0026 remains unapplied; no schema, Storage or worker change.
- Release state: Vercel Production deployment `2h7rndg4JfGEcBdjpDwr8NAk2DYM` reported Ready for `d798f52` from `codex/pdf-only-production` and listed `orbit-ai-sand.vercel.app` under Current Domains.
- Known risks or unverified behavior: Phone-sized layout could not be inspected in the available in-app browser; fresh uploads and non-PDF previews were not verified. Full-fidelity Office previews still require the deferred worker and migration.
- Rollback/recovery: Re-promote prior PDF-only Production deployment `CMgN1tAmieoCXo8PNwcjjjMqyTZN` at `6f6b8e7` if the windowed UI causes a regression. Keep Production branch tracking on the pinned PDF-only branch until the full rollout gates pass.
- Next action and owner: Review and merge the main backport when ready; Noah can refresh the live site to see the new window. Revisit paid Storage and worker setup at the scheduled reminder.
- Authorization still needed: Full 512 MiB release and restoring Production tracking to main require separate release approval and validation.
