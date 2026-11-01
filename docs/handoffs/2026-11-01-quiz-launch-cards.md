# Quiz launch cards — implementation handoff

- Date / owner: November 1, 2026 / Codex
- Status: implemented on focused branch; awaiting live visual validation and release decision.
- Task: A course flashcard launch displayed long generation instructions as a student message and could finish with a single text-only front. A valid launch must show a concise request and an interactive deck with the requested card count.
- Branch: `codex/quiz-launch-card-reliability` (based on `main` after PR #46).
- Changes: The course quiz API returns a short visible launch request. Regular provider and Orbit routes rebuild the complete generation rules from the owned course, section, and saved study configuration. A first-turn failure or retry retains these rules until a complete assistant answer exists. Only a validated widget with the requested count is accepted as the launched set; malformed output is saved as an error and can be retried. Provider usage still settles through the existing billing path.
- Decisions: The old text-only flow remains in the pinned PDF-only Production branch until separately released. No database or paid provider changes are required by this patch.
- Validation: 160 focused synthetic tests across five files passed, including rejected text-only and short sets, retries, cross-user ownership, and no-spend recovery failures. Typecheck and lint passed. The webpack production build passed outside the Windows sandbox; the in-sandbox webpack build hit `EPERM` during static-page output, and the Turbopack build could not reach Google Fonts. Second-model review found no remaining blockers after corrections. Signed-in desktop/phone and live-provider generation remain unverified.
- Known limits: Existing text-only completed sessions are not converted into cards because an answer side may be missing. A new quiz is needed to generate a full deck. Production deployment requires a backport or release branch compatible with the PDF-only pin.
- Rollback: Revert the focused change; no schema rollback.
- Next action: Finish checks and second-model review, then open a ready PR. Prepare an isolated PDF-only backport for separate Production approval.
