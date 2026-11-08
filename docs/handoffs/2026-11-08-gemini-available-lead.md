# Restore an available Gemini lead

- Owner/date: Noah, November 8, 2026; explicitly requested Gemini repair and deployment, prefers available lighter models or other providers over adding billing.
- Branch/base: `codex/gemini-available-lead` from pinned production `e70ad09a8ef5f75c6b7446126487af069ceea8bd`.
- Diagnosis: Google AI Studio shows Orbit AI's free-tier project has zero Gemini 3.1 Pro allowance. Gemini 3.8 Flash has nonzero allowance. Orbit's four ballots succeeded, then the selected Pro lead was rejected.
- Change: select `google-default` (Gemini 3.8 Flash) before voting; recognize its officially supported low/medium/high thinking settings. No runtime fallback, retry, key, billing, budget or shared database change. Actual model ID/pricing/display remain authoritative.
- Validation: the exact six source/test/doc files were tested in the isolated automatic-release worktree: 124 focused mocked routing/provider/config tests passed, scoped lint and typecheck passed, and offline webpack build passed. Independent gpt-6-astra review found no blocker in this change. Vercel build and signed-in live response still require observed release verification.
- Separate work: draft PR54 contains automatic-release infrastructure and full-suite baseline repairs. Its existing course-deletion database bug requires separate approval; this focused Gemini change does not depend on that migration or alter those paths. Known unrelated full-suite failures are documented in PR54; no test is suppressed here.
- Rollback: revert this focused release through a PR if required; this restores the old Pro selection and therefore its known zero-allowance failure. Prefer pausing affected testing over silently substituting models.
- Limits: Flash has finite quota; standalone Pro still cannot work without allowance. No claim of optimal routing or response quality from mocked tests.
