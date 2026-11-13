---
description: "Route to Graphify, spec-kit, or security-audit; show status and cross-links"
---

Invoke the `mapkeeper` skill and follow its `## Start here` menu.

Arguments: $ARGUMENTS

- **Empty** — inspect only `graphify-out/graph.json`, `.specify/`, and `.mapkeeper/state.json`.
  Present the five-choice menu with the recommended default first. Use the question/option
  tool if available; otherwise print the numbered menu and ask.
- **`map [args]`** — invoke the `graphify` skill with the remaining arguments.
- **`spec <action>`** — print the exact installed `/speckit.<action>` command (or `specify init`
  guidance). Do not read or execute the command template.
- **`security [guidance|audit|run <dir>]`** — invoke the security-audit skill for guidance or a
  full audit; `run` records an existing run for links. A full audit requires an explicit output
  directory outside the target.
- **`links [args]`** / **`status [args]`** / **`help`** — run the Mapkeeper CLI if available,
  otherwise follow `references/commands.md`.

Do not run a provider, scan the repository, or write artifacts before the user chooses.
Never reimplement Graphify, spec-kit, or security-audit. Finish with the skill's standard report.