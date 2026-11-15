# Courses C7 student fixtures — MOCK / PUBLIC

These are original synthetic undergraduate course notes and study requests, safe for optimizer training. No real student material, provider answers, credentials or held-out content appears here.

`sources-tasks.json` contains the explicit student task, source notes and independently computed answer key for three subjects. `training-cases.json` contains 15 fixed outputs: five per format. Each task requests exactly one set of exactly two items. A contextual nonstudy chart is explicitly allowed. Acceptance criteria come from those tasks, not from any candidate implementation.

Expected completion behavior:

| Output | MCQ | Short answer | Flashcards |
| --- | --- | --- | --- |
| One valid requested set | accept | accept | accept |
| Two copies of the requested set | reject | reject | reject |
| Requested set plus another study format | reject | reject | reject |
| Requested set plus a valid nonstudy chart | accept | accept | accept |
| One requested set in a JSON fence | accept after normalization | accept after normalization | accept after normalization |

## Offline baseline reproduction

Run from the canonical Courses worktree after the coordinator has made existing dependencies available. This script does not install packages, create tests, contact providers, start the site or access a database. It compiles the actual validator/schema/expressions in memory using the repository's existing TypeScript dependency. `--ref` reads the exact original source through `git show`, so the baseline remains reproducible after application edits.

```powershell
node docs/feedback/courses-c7-20261115/student-public/evaluate.mjs --ref 0a70fd1cba381bbb5c6cb9b7d1cebfbd7dfa340e
node docs/feedback/courses-c7-20261115/student-public/evaluate.mjs
```

An acceptance mismatch intentionally produces exit code 1. Public results include expected and actual values for each named case. The script accepts a separate `--cases` path for independent reviewer use; private-input runs print only aggregate counts.

Baseline source inspection: `lib/courses/quiz-output.ts` uses `bodies.some(...)`, which accepts as soon as any validated block has the requested type and length. It never checks for extra study widgets. For example, `public-circuits-duplicate` requests one two-question MCQ set about a 12 V / 6 ohm circuit; the supplied source establishes 2 A and 24 W. Its output has two individually valid copies of that two-question set. Expected: `false`. Actual baseline: `true` because the first set matches. The same failure occurs in all three study formats and with mixed study-format extras.

Executed on November 15, 2026 with `LIVE_MODELS=off`: [baseline-results.json](baseline-results.json) records 9/15 passes and six false-accept failures, two per format. All one-set, JSON normalization and nonstudy-chart controls pass. The baseline command exits 1 as intended. Only existing local dependencies were used. The independent ignored packet was also evaluated, with only aggregate summaries given to the coordinator and direct private access given to the reviewer.

Both regular-chat and Orbit completion gates call this shared function. This fixture measures completion validation only. It makes no claim about live model quality, signed-in rendering, C5 scoring or export behavior.

The Student Tester froze an independent ignored packet before application edits. The coordinator holds only its hash/count summary and should route private access directly to the independent reviewer. Do not copy private cases or their detailed results into training materials.
