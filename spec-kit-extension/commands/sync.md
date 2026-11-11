---
description: "Incrementally sync the project map after spec or code changes"
---

# Sync the project map

User input: $ARGUMENTS

1. Run:

```bash
node .specify/extensions/mapkeeper/scripts/mapkeeper.mjs sync $ARGUMENTS
```

2. If there is no map yet, run `init` instead.
3. Report only deltas: changed units, added/updated/removed nodes, new gaps, warnings. Do not paste the full graph.
4. If a requirement lost its satisfying task, call that out explicitly.

Never write into `.specify/`. Never regenerate the whole vault for a one-file change.