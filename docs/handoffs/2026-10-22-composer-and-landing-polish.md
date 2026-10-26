# Task handoff — composer model picker, chat menu, landing and sign-up polish

- Date / owner: Oct 22, 2026 / Noah (Claude Code session)
- Status: implemented, awaiting signed-in validation
- Branch: `claude/composer-polish`
- What changed:
  - Every app's model picker sits at the bottom right of the composer (ChatGPT's moved down from the top bar).
  - The chat header "Folder ▾" select and Orbit's header Analytics link are removed (admins still reach Analytics from the account menu). Chats move between folders from a new "⋯" menu on each sidebar chat (Rename, Move to folder, Delete).
  - Orbit answers gain Read aloud; Orbit questions gain Copy on hover.
  - The landing page has a drawn app preview, a school logo strip (with a non-affiliation note) and icon cards. Login/sign-up show the four AIs and school logos beside the form on computers. Sign-up picks the school from logo tiles instead of a select.
- Checks: lint, typecheck, webpack build, 608/608 tests. Browser check (synthetic harness): landing, sign-up picker, chat row menu, ChatGPT composer.
- Next: course workspace redesign, remaining per-app details (e.g. download on Orbit answers).
