@AGENTS.md

# Claude-specific notes

- Internal specs live outside the repo; `CLAUDE.local.md` (untracked) says where. Read the relevant spec before changing a feature.
- Read a file before editing it. Prefer `Edit` over rewriting.
- Before declaring a task done, run `bun run check && bun run typecheck && bun run test`, and for UI changes boot `bun run dev` and look at the page.
- User instructions override this file.
