# Orbit AI — project workflow

## Local setup

Open this repository folder as the primary Codex project folder. The parent ChatGPT mirror and its read-only `sources/` folder are references, not the engineering root. Each collaborator uses their own clone and service accounts; GitHub is the shared source of truth.

Codex discovers root `AGENTS.md`; Claude Code reads `CLAUDE.md`. If using project instructions, paste the text in `PROJECT_INSTRUCTIONS.txt`. Keep service secrets in approved secret stores or ignored local environment files.

## Chats

Keep one pinned control-room chat for priorities and links. Start a fresh chat for each bounded outcome, named `PLAN — outcome`, `FIX — outcome`, `BUILD — outcome`, `REVIEW — outcome` or `RELEASE — outcome`. Link the relevant handoff and ask the agent to start with PROJECT_INDEX and CURRENT_STATE. Do not paste the entire historical transcript.

Use one branch per outcome and separate worktrees for concurrent editing. A fresh chat reduces accumulated context; archiving does not increase account usage limits.

## Finish and archive

1. Record results, exact branch/commit, checks, release state, unresolved risks and next action using `handoffs/TEMPLATE.md`.
2. Update CURRENT_STATE when verified shared state changes; update DECISIONS when an approved lasting decision changes.
3. Commit relevant work and share the branch through the approved review process.
4. Archive completed chats after their durable handoff is saved. Keep unresolved work visible. Do not archive other people's active work automatically.

## Sources and maintenance

PROJECT_INDEX maps task-specific source files. Keep the entire repository and migrations available; read only relevant files per task. Do not copy credentials, real student content or database exports into chats, handoffs or emailed kits. Record missing external approvals and service links in the index/access map instead of inventing them.

The historical handoff is a curated record, not proof of current deployment or a replacement for code and service checks. Review external requirements and environment access with their owners.
