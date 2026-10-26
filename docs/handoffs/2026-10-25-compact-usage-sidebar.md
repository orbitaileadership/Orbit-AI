# Task handoff — compact sidebar usage access

- Date / owner: October 25, 2026 / Jake requested, Codex implemented.
- Status: implemented locally; not deployed.
- Task and acceptance: reclaim sidebar space occupied by the full usage card. Keep detailed limits reachable in Settings from regular chat and Orbit mode, including on phones.
- Repository / branch: orbitaileadership/Orbit-AI, fix/compact-sidebar-usage; based on current main b218287. No changes to synced sources.
- Change: replace the tall sidebar meters with a shared 44px-high Usage & limits shortcut. It opens Settings → Usage directly and closes the phone sidebar. Detailed daily/weekly/monthly meters remain in the existing Settings page; budget explanation moved there. Removed unused Orbit-only usage fetch/state. Existing standard-chat low-balance warnings remain.
- Scope: presentation/navigation only; no allowance, enforcement, model, provider or database changes.
- Approval: Jake requested minimizing the usage icon/panel and moving details into Settings. This request does not authorize deployment of this change.
- Files: app/chat/chat-app.tsx, components/orbit-chat.tsx, components/settings-dialog.tsx, components/usage-meter.tsx.
- Checks: lint/typecheck passed. Existing usage component/API suite: 12 tests passed across 3 files. Synthetic browser preview at desktop and 375px phone size verified regular-chat and Orbit shortcuts open Settings Usage, detailed meters display, and phone menus close. Temporary preview used synthetic data only and was removed before final build. Production webpack build passed, including TypeScript and static generation. First build hit a transient invalid package read in shared dependencies; rerun using existing orbit-ai dependency copy succeeded. Diff whitespace check passed.
- Database / release: no migrations, no live data changes, no paid provider calls; not pushed, merged or deployed.
- Known limitations: browser checks use synthetic API data, not signed-in live accounts. Per-model approximate-answer count is removed from the sidebar along with the expanded card; current low-balance estimate warnings remain.
- Rollback: revert this UI commit; no database recovery needed.
- Next action / owner: Jake reviews the compact design; deployment requires separate authorization.
