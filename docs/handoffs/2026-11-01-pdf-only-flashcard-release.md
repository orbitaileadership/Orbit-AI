# PDF-only flashcard release candidate

- Date / owner: November 1, 2026 / Codex
- Status: isolated release branch; awaiting review, signed-in visual validation, and explicit Production approval.
- Task: make the swipeable flip deck and short quiz launch available on the live site while keeping the PDF-only Production pin and leaving the 512 MiB infrastructure deferred.
- Repository / branch: `codex/pdf-only-flashcard-release`, based on `codex/pdf-only-production` at `bd15018`; backports `a7a13bf`, `8e39ced`, and the reviewed launch fix `1f8c8ab` as three commits.
- Merge conflict resolution: preserved the pinned branch's document attachment UI shape in `components/orbit-chat.tsx` while adding quiz reply tracking; retained both relevant current-state sections. A second-model review found that Orbit assigned an undefined reply ID from `meta`; the ID is now assigned at the later `reply` event. No large-file routes, worker, or migration 0026 were brought over.
- Checks: 203 focused synthetic tests across seven files, typecheck, lint, and the optimized webpack build passed. A broader run passed 846 of 856 tests; six local HTTP tests and one symlink test were blocked by sandbox permissions, one Excel test timed out under concurrent load, and three unchanged course/database fixture tests failed. The socket/symlink/Excel set passed 32 of 32 tests when rerun outside the sandbox. One unchanged course route fixture failure reproduced in isolation. Signed-in desktop/phone and live-provider checks remain pending.
- Database state: no migration included or applied. Production large-file Storage and worker remain deferred.
- Release state: not deployed. Merging the backport into the pinned Production branch would trigger a live deployment and needs a separate go/no-go decision.
- Known limits: existing completed text-only quiz turns cannot be turned into cards without generating the missing answers. Real provider output, mobile interactions, and PDF-only live compatibility still require verification.
- Rollback: redeploy the prior pinned branch commit `bd15018`; no schema rollback.
- Next action: finish local and Preview checks, review the backport, then request Production release approval with the tested PR.
