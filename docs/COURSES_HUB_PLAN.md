# Courses hub implementation — October 23, 2026

User direction: turn Courses into a centralized academic hub, inspired by the organization of Google Docs. The October 22 product memo supplies the phased academic-workspace direction. This cycle implements the core hub and existing workflows; advanced adaptive learning and integrations remain later phases.

## Audit and acceptance

Existing server flows already cover course creation, reviewed syllabus imports/revisions, optimistic edits, owned assignment folders, uploads and provider/Orbit chat launch. The UI spreads these across inconsistent lists, modal file management and prompt shortcuts. Notes lack direct removal; returning to an assignment after chat can leave its chat list stale. Study currently starts editable chat prompts, not an independent quiz engine.

Deliver one cohesive hub: home with updated courses and upcoming work; searchable/filterable course library with grid/list layouts; cross-course deadlines; course overview, assignments, materials (including folders), chats, study session setup and syllabus. Preserve student review, source evidence, record IDs, statuses, folder links and explicit unsent AI launches. Handle empty, loading, partial upload and error states. No AI call on navigation.

## Implementation and risk

- Keep course APIs, context retrieval and budget pipeline. Add presentation components around existing operations; reuse Orbit tokens, provider icons and file tiles.
- Refresh course details and assignment contents after returning from chat; prevent late responses from mixing courses. Uploads retain successful files when another fails. Deleting a material requires confirmation.
- Build a study setup that prepares a grounded, editable prompt for recall, guided practice or exam review. Describe retrieval limits truthfully; do not claim a new adaptive system or complete file access.
- Improve narrow-screen navigation, keyboard labels, focus, reduced-motion behavior and source-review presentation.
- No database migration is needed. Shared migration state and signed-in storage/provider behavior require authorized staging validation; local checks cannot establish those facts.

## Validation and delivery

Run lint, typecheck, relevant existing course/folder tests and production build. Exercise synthetic desktop/mobile hub navigation, search/filter/sort, assignment return, upload failure and review flows. Record exact limitations. Update course docs, approved decisions and handoff. Production merge/deployment remains a separate action.

## Shared file library refinement

The continued iteration unifies course materials and assignment files in one responsive component: grid/list views, natural filename sorting, file-type grouping and filters covering images/spreadsheets, filename search, upload progress, visible drop target, and accurate reading-status text. Assignment files precede chats. Reuse the current upload/delete routes and metadata; no context or billing behavior changes. Validation covers shared classification/sort/status functions and synthetic course/assignment journeys at desktop and 320px widths.

## Evidence retention

The new materials delete action requires protecting reviewed course sources. Course details label the current syllabus and files referenced by reviewed items as retained. File deletion resolves owned text chunks and direct visual file references across the owner's courses, rejects these sources, and stops when storage removal fails. Moving a retained source is also blocked. Chat deletion detaches course/folder attachments and reviewed sources; folder deletion detaches reviewed sources before its cascade. Destructive operations fail closed if exact counts reveal incomplete course/file inventories.

These are request-time guards, not transactional database guarantees against simultaneous reassignment or syllabus changes. Context selection and token budgets are unchanged. Independent `gpt-6-astra` review completed on October 23 after an earlier usage-limit failure. Four findings across two review rounds were fixed; final scoped re-review found no remaining blockers. Live RLS/FK/storage behavior and concurrent changes still require staging validation.
