# Student Tester handoff — Courses C7 / MOCK

- Date / role: November 15, 2026; independent Student Tester.
- Status: baseline investigation complete; awaiting candidate and independent review.
- Baseline: `0a70fd1cba381bbb5c6cb9b7d1cebfbd7dfa340e` in the canonical Courses worktree.
- Contract: a requested single set must have the selected format and exact count; extra interactive study sets must fail; supporting nonstudy widgets are permitted by these synthetic tasks.
- Artifacts: original public source/task/answer keys, 15 public training outputs, read-only evaluator, exact baseline results and reproduction instructions in this directory.
- Confirmed defect: a matching requested study widget makes the baseline accept additional same-format or cross-format study widgets. Public baseline is 9/15 pass and six false accepts, evenly across MCQ, short answer and flashcards.
- Private separation: independent 27-case MOCK packet frozen before application edits, ignored by Git, with hash recorded directly to coordinator/reviewer. Private questions, answers, outputs and failure details are absent from public artifacts. Only reviewer receives direct private access.
- Checks: actual offline validator evaluation against the exact baseline, public fixture JSON parsing, evaluator syntax check, Git ignore verification and freeze hash verification. No app/source/tests changed by Student Tester; no dependency installation, site/database/live provider interaction, sends, branch operations or pushes.
- Limitations: local completion-validator behavior only; no live quality, UI, C5 scoring or export claim.
- Next action / owner: optimizers may use only public artifacts; reviewer independently evaluates the frozen private packet against the final candidate and reports privacy-safe results.
