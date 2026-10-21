# Architecture Note — Orbit AI

## Layers (keep them separate)
```
src/
  app/                 # Next.js routes and UI (chat, sign-in, usage, admin)
  components/          # UI components
  server/
    auth/              # session, school-email eligibility check
    chat/              # orchestration: load history → build context → reserve → call → reconcile → save
    providers/         # one adapter per provider + shared interface
      types.ts
      openai.ts  anthropic.ts  google.ts  xai.ts
    billing/           # reserve / reconcile / ledger / limits / kill switches
    storage/           # DB access (conversations, messages, ledger)
  config/
    models.ts          # model IDs, provider, context window, max output, prices, enabled flag
    economics.ts       # allowances, trial cap, rate limits, currency, PAYMENTS_ENABLED
```

## Provider-neutral message format
```ts
type Role = 'system' | 'user' | 'assistant';
interface Message {
  id: string; conversationId: string; seq: number;   // seq preserves order
  role: Role; content: string;                       // text only for launch
  modelId?: string;                                  // which model wrote an assistant message
  status: 'complete' | 'partial' | 'error';
  createdAt: string;
}
interface ProviderAdapter {
  id: 'openai' | 'anthropic' | 'google' | 'xai';
  toProviderRequest(history: Message[], model: ModelConfig, maxOutput: number): unknown;
  stream(req: unknown, signal: AbortSignal): AsyncIterable<{ delta?: string; usage?: Usage }>;
  normalizeUsage(raw: unknown): Usage;   // input, output, cached, reasoning tokens
  normalizeError(e: unknown): ProviderError; // timeout | rate_limit | auth | unavailable | unknown
}
```
Each adapter maps roles to its own API format. For example, Anthropic and Google take the system prompt separately, and Google calls the assistant role `model`. Replies from other models are passed as `assistant` turns, in order.

## Context policy
Walk history from newest to oldest and keep messages until we hit `min(model.contextWindow, budgetCap) - maxOutput - safetyMargin`. Always keep the system prompt and the newest user message. If older messages were dropped, set a flag so the UI can show "Older messages not included."

## Data model (Postgres, RLS on every table)
- `profiles(user_id, email, email_verified, plan, status)`
- `conversations(id, user_id, title, created_at, updated_at)`
- `messages(id, conversation_id, seq, role, content, model_id, status, created_at)`
- `budgets(user_id, period_start, allowance_cents, spent_cents, reserved_cents)`
- `ledger(id, user_id, request_id UNIQUE, model_id, reserved_cents, actual_cents, input_tokens, output_tokens, reasoning_tokens, cached_tokens, state, created_at)`. `state` is one of `reserved | settled | uncertain | released`.
- `settings(key, value)`: global spending stop, provider enabled flags
- `payment_events(event_id UNIQUE, ...)`: later, makes repeated events safe to process

Store money as integer micro-cents (or numeric) to avoid float rounding.

## Request flow (server only)
1. Auth: valid session, email verified, and the domain is a school (lib/auth/eligibility.ts).
2. Ownership: the conversation belongs to the user.
3. Gates: the global stop is off, the provider is enabled, the model is allowed for this plan, and the rate limit passes.
4. Build context (policy above). Estimate the cost upper bound: `input_tokens × in_price + maxOutput (incl. reasoning) × out_price`.
5. **Atomic reserve.** In one SQL statement or function:
   `UPDATE budgets SET reserved = reserved + :bound WHERE user_id=:u AND allowance - spent - reserved >= :bound RETURNING ...`
   If no row comes back, either lower `maxOutput` to fit or reject with a budget-pause message. Insert the ledger row with `state='reserved'` and an idempotent `request_id`.
6. Save the user message, then stream from the provider.
7. **Reconcile** with the usage the provider reports: move `reserved → spent` at the actual cost and release the rest.
   - Client disconnects: keep reading the provider stream on the server until it finishes, or charge the full reservation.
   - No usage reported or unknown outcome: mark `uncertain` and keep the full reservation charged until it's reviewed.
   - Retry: same `request_id`, so it can't be charged twice and can't create duplicate messages.
8. Save the assistant message with its `modelId` and `status`.

## Admin and operations
- Admin page (Jake): spend by user and model, total cost, error counts, the global stop toggle, provider toggles.
- Logs: request ID, user ID, model, tokens, cost, error code. **Never message content.**
- Backups: Supabase daily backups. Roll back a bad release with Vercel instant rollback.

## Security checklist
Keys only in server env. RLS plus server checks on every read and write. Exact domain match after normalization (lowercase, trim; reject unicode lookalikes). CSRF and auth on all mutation routes. Rate-limit OTP sends.

## Folder access (browser)
The student picks a folder with the browser's folder picker (File System Access API, Chrome/Edge on a computer) and
allows editing in the browser's prompt. The handle is remembered in IndexedDB; the browser may ask again next visit.
Chat requests send `folder: { name }`, and adapters pass the tools from `lib/folder/tools.ts` in each provider's
function-calling format. A round that ends in tool calls streams `tool_calls`; the browser runs them on the folder
(`lib/folder/browser-fs.ts`; changes need Apply unless "Don't ask for edits", deletes always ask; nothing extra is written
into the folder) and continues the same reply with `run: { replyId, steps }`. Every round is its own reserve → call → settle.

## Implemented phase-one update (October 13)
The older `src/` diagram above describes the original scaffold. Current code is under root `app/`, `lib/` and `config/`.
See [SMART_MEMORY_ANALYTICS.md](SMART_MEMORY_ANALYTICS.md) for the exact implementation and rollout.
Economic input targets are separate from provider windows (8k ordinary, 16k files/tools, controlled expansion capped at 24k estimated input); summaries and recent exchanges stay provider-neutral.
A saved conversation's provider field now identifies its sidebar/course home; model_id selects generation and may belong to another provider after an explicit model-picker choice.
USD actual provider costs live in `ledger.actual_usd_micros`; `actual_micros` retains legacy budget-charge semantics. Unknown outcomes have no known provider cost. Money units are integer millionths of currency units, not micro-cents.
New CAD trial budgets snapshot FX into USD credit counters and expire after their assigned trial. Paid subscriptions/renewals remain disabled.

## Automatic tool-context allocation (October 18, 2026)

Plugin/folder/Python continuations share the request's economic input ceiling with the newest user question, system instructions, tool schemas, images and reserved summary/retrieval space. The tool-evidence target is configured in `config/context.ts` (10k estimated tokens, reduced to the remaining allowance for larger prompts). The previous independent 150k-character run allowance is removed. Billable requests still use the original reserve/call/settle flow, selected provider, model output allowance, and 24k maximum input policy. This change adds no compaction model calls or automatic paid retries.

`lib/chat/tool-context.ts` measures the serialized call/result turns, including JSON escaping and provider metadata. It excerpts large results and intermediate assistant text to fit the calculated allowance. Calls/results stay paired and arguments/signatures remain unchanged. If even the framing does not fit, older complete rounds can be omitted with an explicit model notice; the latest round is retained or the request fails closed. The original browser-held steps and saved activity logs are not modified. A durable tool-log flag and streamed metadata disclose shortened source results beneath the answer, including after reopening the chat. Excerpts are not presented as whole-source coverage.

GitHub file reads now return numbered ranges (default 200 lines; maximum 400), bounded to 12k characters with a continuation cursor. The model can request later lines or the next character offset within an unusually long line without asking the student to split the task. Shared server enforcement also handles old clients returning 50k-character results and accumulated multi-tool rounds. Source sections remain untrusted data.

Limitations: input counting retains the existing conservative estimator, not exact provider tokenization. Extremely large fixed instructions, attachments, or tool arguments may still require rejection; arguments are never altered to make an unsafe request fit. Context excerpts can omit relevant evidence, so source/range notices instruct the model to read further sections and avoid claiming exhaustive coverage. Existing per-message tool-round and monetary limits remain authoritative. Staging must verify that actual models follow paging cursors and produce useful source-grounded answers; mock tests cannot establish that behavior.

Validation: 458 mocked/local-database tests across 59 files, lint and generated route types/TypeScript passed. Regression requests combine a ~30k-character user question with two/eight large GitHub results and complete within the existing input ceiling. Additional tests cover repeated rounds, escaped output, provider metadata/call pairing, mixed short errors and long results, disclosure persistence, absent optional activity storage, and complete long-line paging. Independent context/cost review found no remaining blockers after fixes. No live provider call, production database change, deployment or staging browser validation was performed; the branch is awaiting live GitHub validation before release.

### New organization release validation

The fix was ported as 09d876e onto orbitaileadership/Orbit-AI main 938904f, which is an older snapshot with unrelated Git history. Only the context fix was applied; shared-course/landing-page changes from the former repository were not imported. Validation on this base: 390 tests across 49 files, lint, clean generated type checks and the webpack production build passed. Stale generated route files from the former checkout were moved aside before the clean check; font downloads required normal network access. Independent integration review found no blockers.

Real GitHub reads against the new organization's pinned main recovered 105,852 characters/1,707 lines from app/chat/chat-app.tsx and 48,345 characters/534 lines from lib/plugins/catalog.ts without missing or repeated content. With a 30,464-character synthetic question, all four default model configurations stayed within the shared estimated request ceiling. These were real GitHub fetches with local budgeting, not live model calls.

The Vercel preview built successfully: https://orbit-ai-git-fix-github-context-budget-org-orbit-ai7.vercel.app . Its Vercel sign-in protection prevents the final signed-in browser/model check in the current session. Historical preview status: the signed-in check was pending. The user subsequently authorized pushing fad7980 to main; that push completed. Live signed-in model validation remains pending. Roll back the runtime change by reverting the fix commit.

### Complete legacy migration

The subsequent migration restores all source updates from legacy main b6cc5b1 and the final legacy context-fix branch 87479e3 onto the organization's existing main history. The original organization snapshot 938904f has the exact same tree as legacy b758dd6. A no-file-change merge links that matching baseline, followed by a normal three-way merge of the final legacy branch. The resulting runtime source, assets, tests and migration files match 87479e3 exactly; newer organization validation notes are retained. See REPOSITORY_MIGRATION.md for the completeness checks. The user confirmed both deployments use the same Supabase database; no shared database changes were executed by this source migration.

### Syllabus PDF imports

The Courses importer accepts text PDFs and scanned/mixed PDFs. After the existing access, file ownership and import-lease checks, `lib/courses/pdf.ts` downloads the owned PDF and sends all indexed visual pages (every page for a scanned PDF) through the existing provider PDF adapter. The accompanying source mapping preserves original page numbers. Visual evidence uses the owned syllabus file ID; text evidence retains chunk IDs. Confirmation accepts only IDs belonging to the import or the owned revision target's files. Students still review the draft before saving.

Text input has a 48k estimated-token ceiling (expanded from 8k), with up to 240 indexed chunks and an 8k-token output allowance. Visual input is bounded separately to 20 pages and 20 MB, with 2k estimated tokens per visual page included in the existing reserve/call/settle accounting and the model context ceiling. No pages are silently omitted, no automatic paid retries are added, and unreadable PDFs fail explicitly. Provider-reported usage determines settlement. Text-only imports do not send a PDF. No database migration is needed for this change.

Validation for the syllabus PDF fix: 480 tests across 63 files, lint, route type generation/TypeScript and the webpack production build passed. Synthetic tests cover scanned PDFs without text chunks, mixed-page ordering and page mapping, corrupt/missing/oversized documents, budget denial before provider dispatch, source review, confirmation, course status edits, and foreign owner/course rejection. Independent review found no remaining blockers. Real-model extraction quality and a signed-in browser upload still require live validation; no paid provider calls were performed. Rollback: revert the syllabus PDF fix commit; no schema change is involved.

The expanded syllabus limits retain the combined text + visual pages + output check against the configured model context and reserve the complete estimated cost before dispatch. Large syllabi can require more allowance; there is no truncation or automatic paid retry. Expanded-limit validation: 484 tests across 63 files, lint, production TypeScript compilation and webpack build passed. No live provider calls were made.

## Token usage dashboard

See [TOKEN_USAGE_ANALYTICS.md](TOKEN_USAGE_ANALYTICS.md) for the plan, definitions, metadata privacy contract, scope and rollout of the standard-chat token growth report (migration 0017). Existing finance/product reports and billing safeguards are preserved.
