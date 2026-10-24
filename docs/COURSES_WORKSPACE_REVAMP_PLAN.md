# Courses Workspace revamp — implementation plan

Date: October 23, 2026 (Toronto). Owner: Jake (product), engineering acceptance with Noah. Status: approach approved by the user’s “go ahead”; local implementation complete, awaiting signed-in integration validation and release approval. Branch: plan/courses-workspace-revamp, base main 2cc360f. This plan supersedes the earlier Courses Hub interface direction where they differ. This records the approved scope; implementation evidence and limits are in handoffs/2026-10-23-courses-workspace-revamp.md.

## Outcome and scope

Course setup leads to a practical workspace with three primary tabs: **Dashboard**, **Sections**, **Quiz**. Dashboard includes a full calendar. Each graded event has a section with its resources and conversations. Quiz me creates a descriptively named, saved study chat in the course hierarchy and starts the chosen exercise through existing budgeted generation. Preserve existing courses, reviewed syllabus evidence, completed work, file IDs, ownership, provider selection and financial accounting. No paid call merely from opening a tab or choosing a date.

This is a substantial data/integration change. ENGINEERING_PROTOCOL.md section 5 requires approval of the approach for substantial/high-risk changes before implementation. Implementation approval will not authorize a shared migration, production release, actual invitations or paid validation calls.

## Verified foundations and gaps

| Requirement | Current implementation | Gap / reuse |
|---|---|---|
| Upload syllabus or manual creation | components/course-workspace.tsx; /api/courses, /import, /confirm; lib/courses/parse.ts | Reuse reviewed extraction/manual routes. New course entry must offer both equally clearly; New course currently defaults to import. |
| Dashboard and dates | components/course-hub.tsx has Home/My week, date groupings and task status; course-ui.tsx | No full calendar grid or persistent timed custom events. Consolidate overdue/today/upcoming/undated tasks with calendar navigation. |
| Graded sections | CourseItem kind assignment/exam; assignment-workspace.tsx and /api/courses/[id]/assignments/[itemId] | Existing per-item folder/resources/chat workspace can become Sections. Topics remain supporting content. Add explicit graded types without breaking historical kind/source mappings. |
| Resource management | course-file-browser.tsx, existing file upload/delete APIs; evidence.ts protection | Reuse library and source protection; distinguish course-wide resources from section uploads and reading status. |
| Resource-aware chat | lib/courses/context.ts, normal chat material retrieval, Orbit route | Folder + parent-course excerpts already retrieved. Current courseContext searches up to 5 chunks within roughly 1,600 tokens; own file/parent inventories are bounded. New uploads expand available sources, not guaranteed full-file recall. |
| Quiz | course-hub.tsx StudySetup prepares unsent prompts; lib/chat/quiz.ts, chat route and migration 0006 support normal-chat quiz_state; conversations already have mode | No section-specific MCQ/short-answer/flashcard launcher, saved chat on button press, structured export, or equivalent Orbit quiz handling. Reuse score/parser infrastructure; do not equate prompt setup with a working quiz feature. |
| Calendar connections | mail-calendar.ts and microsoft-actions.ts support reads and confirmed CRUD; plugin tools expose those actions | Browser-delegated tokens, primary-calendar limits, fixed read horizon and string results are not a Courses sync layer. No attendees/conference support in current event inputs. Extend adapters, not duplicate OAuth. |

Existing documentation calls the previous Courses Hub local-only, but code is already on main through PR 23. The new plan uses actual code as the baseline.

## 1. Setup and information architecture

- Add course opens two clear choices: Upload syllabus / Enter manually. Imported and manually entered course details use the existing review editor, with dates, times/timezone where actually known, graded-event type, weight and instructions.
- Preserve student review before an extracted syllabus creates/changes course records. Keep stable item IDs, completed status, existing folder associations and optimistic version checks during edits/revisions. Never infer an ambiguous date or year.
- Course navigation: Dashboard / Sections / Quiz. A secondary Resources area and Course settings retain the original syllabus, shared materials, course details and all conversations without filling the main navigation with overlapping tabs.
- Course > graded section > resources and chats. Quiz sessions appear in the same course hierarchy and the relevant section; show a parent-course conversation index that includes descendants.
- Use Orbit design tokens and accessible responsive layouts. Use Teams-style calendar interactions (date picker, Today, range controls, agenda/time grid), retaining Orbit branding rather than copying Microsoft assets.

## 2. Dashboard and calendar

Dashboard: actionable overdue, today/current and future deadlines; dates needing confirmation; quick status changes; next event; calendar preview and full-calendar button. Completed work remains accessible and is excluded from overdue counts.

Calendar: day/week/month/agenda views; Today, previous/next, arbitrary date navigation, course/calendar filters and visible timezone. Users can create, edit and delete their own events, set all-day or timed values, add notes/location and attach a meeting URL. Mobile defaults to an agenda with a clear date picker and can change views.

Keep two kinds of records clear:
- Graded deadlines are derived from course items. Editing a deadline updates that item through the versioned course path. Deleting an associated display must never silently erase the graded section or its resources; offer an explicit event visibility/removal choice with the impact stated.
- Custom events are persisted separately with owner, optional course/section link, title, start/end/all-day values, timezone, location/meeting URL and revision. Do not squeeze meeting data into assignment prose or create duplicate independent deadline records.

Proposed minimal schema: one owner-scoped course_calendar_events table for custom events, plus calendar_event_links only when provider reconciliation is added (provider/calendar/event IDs, source course item or custom event, version/ETag, sync status and deletion marker). Keep graded tasks in course_data. Validate item references and same-owner course links on the server; indexed range reads and RLS on all new records. Final migration number is selected from current main at implementation time; none is applied during planning.

Time tests must cover date-only values, exclusive all-day ends, leap years, IANA zones and DST gaps/overlaps. Unknown syllabus times remain all-day/date-only until reviewed. Never use a hosting-server timezone as the student's timezone.

## 3. Sections and sources

- Sections includes every graded event: assignments, quizzes, midterms, finals, labs, projects and presentations as appropriate. Preserve assignment/exam compatibility using a reviewed subtype or backward-compatible schema, rather than renaming/deleting existing items.
- Section header: title, due date/time, weight, status and instructions. Main content: organized resources first, then linked conversation(s), with a clear Resume chat / New chat action.
- Reuse the existing per-item folder on first upload/chat; viewing alone does not create database clutter. Support all provider choices and Orbit with accurate capability/availability disclosure.
- Reuse searchable grid/list file library, upload progress, partial failure recovery, source preview and add/remove actions. Show section-specific resources separately from course-wide resources; reuse course-wide files instead of copying them into every section. File duplication is not needed for shared context.
- Ready supplementary text becomes eligible for retrieval on the next sent question. Show processing/failed/scanned/unsupported states accurately. Add tests proving newly ready section material is retrieved and removed material is excluded. Never claim every page was sent, or uploads train the model.
- Distinguish removing a supplemental resource from deleting an original. Preserve the existing reviewed-syllabus/evidence retention guards and warn when a deletion affects other uses. Ownership and incomplete inventories fail closed.

## 4. Quiz me

- Choose a graded section, then Multiple choice / Short answer / Flashcards. Optional question count and focus can be bounded in config. Show selected resources and the chosen assistant; explain allowance use before the explicit Quiz me click.
- Clicking Quiz me creates a saved conversation linked to the section folder under its course, with a title such as BIO 1001 · Midterm 1 · MCQ · Oct 23. The title is deterministic app metadata, not another paid title-generation call. Then start the initial exercise through existing generation/streaming/accounting.
- New session creation is idempotent for a single launch ID; double-click, network retry, refresh or returning from chat must not create duplicate sessions or duplicate first-generation calls. Later clicks explicitly start a new session. Add a small owned course quiz launch route rather than silently relying on the normal first-message title.
- Reuse conversations.mode=quiz and quiz_state. Add bounded quiz configuration metadata only if needed. MCQ provides choices and waits for the response; short answer waits before feedback; flashcards reveal the reverse only on request. Distinguish model-assessed feedback from verified academic grading. Incomplete replies must not advance a session as if complete.
- Normal chat already consumes quiz markers; Orbit needs equivalent tested parsing/persistence if offered in this chooser. No fake scores or unsupported mode claimed. All voter/helper/answer operations retain their existing reservation and reconciliation behavior.
- Flashcard export uses validated structured question/answer data tied to the session, with TSV/text download for Anki and copy/import text for Quizlet. Do not parse arbitrary answer prose into a supposedly validated deck. Exports do not send private course files directly to either service or initiate paid generation again.

## 5. Calendar and study integrations

Google / Microsoft: extend existing delegated connectors with calendar selection, date-range pagination, structured event IDs, attendees and conference details. Read access is separate from incremental write consent. Request only the relevant calendar permissions. Teams meetings are created through supported Microsoft calendar accounts; unsupported account/tenant capabilities must be shown clearly. Existing meeting URLs can also be attached without generating a meeting.

Invitations: preview title, exact dates/timezone, selected organizer calendar, attendee addresses and notification impact before the user sends. Saving a private Orbit event alone sends no invitation. One organizer is authoritative; exporting the same meeting to another calendar must not invite attendees twice. Retrying a provider write must be idempotent; unknown outcomes require a read-back/status check, not blind replay. External calendar actions and granting OAuth access during validation require the user's action/authorization.

Start with explicit refresh and sync while the user is connected, using existing browser-held tokens. Show Last refreshed / Pending / Failed / Conflict. Do not label a copied event as continuously synced. Use provider IDs, ETags/revisions, deletion tombstones and paginated range reconciliation; never identify events only by title. Google sync tokens and Microsoft delta links are candidates for incremental refresh. Automatic background sync while the app is closed would need a separately reviewed server token-storage/refresh design; existing browser tokens do not establish that capability.

Apple Calendar: first supported bridge is an .ics export, and optionally a private revocable read-only subscription after its access design is approved. Apple subscriptions are not two-way editable calendars; label that restriction. Do not claim a generic Apple OAuth integration or collect Apple account passwords. True iCloud/CalDAV write sync needs separate feasibility and credential handling review.

Anki / Quizlet: deliver documented import-compatible exports, with explicit user initiation. Direct account linking/continuous deck sync is not assumed; investigate supported partner interfaces before promising it. A web import workflow is useful but must be labelled export/import rather than account sync.

## Delivery order and acceptance

1. Core workspace: setup choices, three-tab structure, dashboard + local calendar, graded sections/resources and named quiz sessions. New schema remains local until shared migration approval. Verify desktop and phone on synthetic data before proposing release.
2. Google/Outlook calendar UI, event CRUD and controlled invites/meetings; Apple export; validated flashcard exports. Existing integration setup/consent gates remain. Use mocked responses first, then approved controlled accounts; never invite real people as a test without authorization.
3. Continuous background reconciliation or direct study-app account sync only after capability, credential and access decisions are verified. These are dependencies, not hidden placeholders or completed features.

Core and supported integrations are parts of the requested revamp. Do not mark the entire request complete when only the layout or phase 1 is done. Track blocked external capabilities separately and report what actually works.

Acceptance tests:
- Existing course fixture with reviewed/completed items survives manual edits, syllabus revisions, navigation and new optional fields without ID/status/evidence/folder loss.
- Two users cannot read/write each other's events, folders, resources, quiz sessions or provider mapping records. Tampered IDs and stale version writes fail safely.
- Dashboard/date-grid agree for overdue/current/future/undated/completed data; edit/delete behavior preserves the graded section and distinguishes external versus local changes.
- Section upload/preview/remove handles partial failures and refresh; next chat uses owned newly ready passages within existing context caps, with no sibling-user source leakage.
- All three quiz formats create one named persistent session, start only on explicit click, reopen under the correct course, preserve scoring/flashcard state and settle every paid phase. Double-click/retry does not duplicate work; provider failure and exhausted budget remain clear.
- External calendar pagination, expired consent, unsupported Teams meetings, provider 429/5xx, ambiguous writes, duplicate invitations, DST, conflicts and revoked connections are exercised with mocks. Controlled live validation uses an owner-approved account and explicit invitation recipients.
- Anki/Quizlet exports preserve Unicode, tabs/newlines/escaping, titles and source references without executable HTML or unrelated private information. Apple export/subscription is labelled accurately and can be revoked if enabled.
- Run relevant integration and local database tests, lint/typecheck/build and complete desktop/phone keyboard/accessibility journeys. Required independent review covers auth, context and accounting before merge. Production migration/deployment and paid model tests remain separate approvals.

## Official integration references checked October 23

- Google event creation, attendees/conferences and permissions: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert ; notification behavior: https://developers.google.com/workspace/calendar/api/guides/create-events
- Google incremental sync: https://developers.google.com/workspace/calendar/api/guides/sync
- Microsoft event creation, delegated Calendars.ReadWrite and Teams example: https://learn.microsoft.com/en-us/graph/api/calendar-post-events?view=graph-rest-1.0
- Microsoft delta: https://learn.microsoft.com/en-us/graph/api/event-delta?view=graph-rest-1.0
- Apple subscriptions and edit restrictions: https://support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac ; https://support.apple.com/en-ca/guide/calendar/icl1033/mac
- Anki text import: https://docs.ankiweb.net/manual/importing/text-files
- Quizlet import: https://help.quizlet.com/hc/en-au/articles/360029977151-Creating-sets-by-importing-content

## Approval record

The user approved the architecture and delivery sequence with “go ahead”: build the complete core workflow first, extend supported Google/Microsoft connections and meetings using existing delegated auth, and clearly label Apple and study-app bridges as export/import until stronger integration access is verified. Implementation is now recorded in the implementation handoff. Migration 0022 remains local; production release, shared migration, paid calls and real invitations are not authorized by that implementation approval.
