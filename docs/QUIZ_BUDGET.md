# Budgeted multiple-choice quizzes

User-approved October 27, 2026: cost takes priority over answer quality; the **entire quiz**, not each question, shares a ceiling of 1% of the full rolling daily allowance. Default: 10 multiple-choice questions, honoring an explicitly requested count or alternate format.

## Local implementation

- `config/quiz.ts`, `lib/quiz/`, `/api/quiz`, and `components/budget-quiz.tsx` implement new MCQ sessions. Standard text chat recognizes explicit quiz requests and Quiz Me mode; Course Quiz opens the same runner for MCQs. The runner shows its model and editable topic/count before any paid call. Course launch defaults to a configured inexpensive single-provider model, including when launched from Orbit; the model is explicitly shown before Start, with no hidden four-provider vote or provider substitution.
- Generate question 1 first, then generate the remaining questions in one background batch while question 1 is displayed. This avoids repeating course context and grading prompts for each answer. A very fast student can still reach a loading state; zero latency is not guaranteed. The prefetched batch does not adapt to the student's later mistakes.
- Correct answers/explanations remain in the private database. Answer submission grades against the saved key without another model call. Only the current question and feedback for submitted answers reach the browser. Submitted answers are immutable and duplicate submissions do not increase the score.
- Migration `0027_budget_quizzes.sql` freezes `floor(daily_limit_micros / 100)` at session creation. Two deterministic phase IDs, atomic phase claims, per-user locking, and an aggregate ledger check enforce the combined reservation ceiling. Calls reserve, dispatch, and settle separately through the existing accounting system. Held and uncertain costs count; no automatic paid retries occur. Provider disable/rate/global/trial/rolling-budget guards remain active.
- Preflight checks both calls before spending. No assumed cache discount; reserve UTF-8 byte input ceilings plus envelope overhead, the existing pricing safety margin, and bounded output including reasoning. Actual provider usage is settled honestly; a reported overrun or incomplete/unknown result blocks further generation. Like existing provider accounting, these are configured-rate bounds, not a guarantee against provider misbilling or changed pricing.
- Selected owned course excerpts are obtained through the existing session-bound course-context function, with its source/disclosure limits. Generic quizzes use the entered topic; chat history, pending attachments, memory, search, and tools are not silently included. This is disclosed before Start.
- Sessions survive refresh, and reopening does not regenerate completed phases. Expired server invocations fail visibly while unresolved ledger reservations stay held. Sessions can be reopened from Saved quizzes in the runner; they are separate from historical chat-based quizzes.

## Scope and release gates

This change covers **new MCQ sessions**. Explicit short-answer/flashcard requests, voice quizzes, historical chat-based quizzes, ordinary chat, Orbit voting, and other paid operations keep their existing paths and limits. The original broader request to cap every prompt is **not implemented globally** by this branch; do not present this MCQ ceiling as universal enforcement.

Status: local implementation awaiting independent financial/context review and signed-in desktop/phone validation. No browser was used, per the user's instruction. No paid provider call, production schema change, merge, push, or deployment was performed. Migration 0027 must be separately approved/applied before release. Validate actual structured-output completion and latency with cheap models before promising reliability or measured savings.

Rollback: revert the application changes; leave the private table and ledger evidence in place. Do not delete ledger records or refund unknown outcomes automatically.
