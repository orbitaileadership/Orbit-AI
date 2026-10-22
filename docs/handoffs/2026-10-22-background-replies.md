# Task handoff — keep using Orbit while an answer runs

- Date / owner: Oct 22, 2026 / Noah (Claude Code session)
- Status: implemented, awaiting signed-in validation
- Branch: `claude/background-replies`
- What changed: a running answer no longer locks the app. Students can open other chats, other AI apps, Orbit, folders and Courses while it streams; the answer keeps arriving in its own chat. An orange pulsing dot marks the chat (sidebar) and its app (left rail / phone switcher) while it runs; a blue dot marks it when it finished while the student was elsewhere, cleared when they open it. Orbit now stays mounted after its first visit, so an Orbit answer keeps going when the student leaves Orbit, with the same dots on the Orbit tile.
- Deliberate limit: one answer at a time across the app (tool approvals and Stop are single-run). Other chats show "Another answer is still running…" and can type but not send until it finishes. Inside Orbit, switching between Orbit chats stays locked during a turn (the server allows one Orbit turn per student).
- A new chat that gets its saved id mid-answer only takes over the screen if the student is still looking at it.
- Checks: lint, typecheck, webpack build, 608/608 tests. Browser check with a synthetic slow stream: navigate to another chat and another app mid-answer (orange dots, placeholder), background finish (blue dots), reopen (full answer, dots cleared).
- Not verified: signed-in run with tool approvals (plugins/folder) while the student is on another screen; the approval card appears when they return to that chat.
