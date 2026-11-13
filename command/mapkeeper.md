---
description: "Map this repository — choose create, update, audit, export, integrations, or query"
---

Invoke the `mapkeeper` skill and follow its `## Start here` menu.

Arguments: $ARGUMENTS

- If `$ARGUMENTS` is not empty, skip the menu. Route the arguments to the matching mode
  (`/mapkeeper audit --soft`, `/mapkeeper query "where is auth?"`, `/mapkeeper help`) and run it.
- If empty, check once whether `project-map/graph.json` exists, then present the menu with the
  recommended default first: Create when absent, Update when present.
- Use the question/option tool if the agent has one; otherwise print the numbered menu and ask.
- Do not scan the repository, read references, or run a mode before the user chooses.
- Finish with the skill's standard report.