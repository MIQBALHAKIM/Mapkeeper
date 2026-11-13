# spec-kit provider

spec-kit owns specifications, plans, tasks, and its command workflow. Mapkeeper detects it, shows feature state, and hands off the exact slash command.

## Detection

- CLI: `specify` on `PATH`; version when `specify --version` works.
- Project: `.specify/`; active feature from `.specify/feature.json` (`feature_directory`, `feature_dir`, `directory`, `path`, `feature`) or the newest `specs/*/spec.md`.
- Commands: `speckit.*.md` in the first matching directory:
  `.kilo/commands`, `.kilo/command`, `.claude/commands`, `.github/prompts`, `.cursor/commands`,
  `.windsurf/workflows`, `.opencode/command`, `.gemini/commands`, `.codex/prompts`, `.qwen/commands`.
- Hooks: `.specify/extensions.yml`.

State records `cli`, `version`, `initialized`, `feature_dir`, `feature_mtime`, `commands_dir`, `commands`, `hooks`.

## Handoff

Print the exact command; do not read or execute the command template.

| Action | Command |
| --- | --- |
| Specify | `/speckit.specify <description>` |
| Clarify | `/speckit.clarify` |
| Plan | `/speckit.plan` |
| Tasks | `/speckit.tasks` |
| Analyze | `/speckit.analyze` |
| Checklist | `/speckit.checklist` |
| Implement | `/speckit.implement` |
| Constitution | `/speckit.constitution` |
| Converge | `/speckit.converge` |
| Tasks to issues | `/speckit.taskstoissues` |

If the commands are not installed, print the project setup hint (`specify init` with the host agent, then `specify extension add …` when needed) and stop. If `specify` is missing but commands exist, hand off the commands and note the CLI is unavailable.

## Rules

- Never modify `.specify/`, `specs/`, or spec-kit extensions.
- Never model requirements/tasks as a graph.
- Mapkeeper reads `spec.md` and `tasks.md` only to extract IDs and file mentions for links and status counts, not to re-run `/speckit.analyze`.

## Links input

- `spec.md`: `FR-###`, `NFR-###`, `SR-###`, `CR-###` requirement IDs.
- `tasks.md`: `- [ ] T### …` lines, referenced requirement IDs, and mentioned file paths.
- File mentions are normalized relative paths; `specs/`, `.specify/`, `project-map/`, `.mapkeeper/`, and `graphify-out/` are ignored.