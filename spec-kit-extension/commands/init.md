---
description: "Create or rebuild the project map for this repository"
---

# Map the project

User input: $ARGUMENTS

1. Resolve the installation directory: `.specify/extensions/mapkeeper/` when installed, otherwise the mapkeeper skill or repository checkout.
2. Run the Mapkeeper CLI from the project root:

```bash
node .specify/extensions/mapkeeper/scripts/mapkeeper.mjs init --phase DURING $ARGUMENTS
```

If that path does not exist, use the mapkeeper skill's `init` mode instead.

3. Read `project-map/sync-summary.md` and report:
   - mode and generation source (`graphify`, `graphify+llm`, `llm-manual`, `graphify-fallback`);
   - node and edge counts, coverage counts;
   - the spec traceability gaps (requirements without tasks, tasks referencing missing files);
   - artifacts written.

Do not edit `.specify/` artifacts. Do not claim graphify ran unless `meta.graphify.available` is true in `project-map/graph.json`.