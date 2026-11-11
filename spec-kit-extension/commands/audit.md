---
description: "Validate the map and report coverage and traceability gaps"
---

# Audit the project map

User input: $ARGUMENTS

1. Run:

```bash
node .specify/extensions/mapkeeper/scripts/mapkeeper.mjs audit $ARGUMENTS
```

2. Interpret the exit code: `0` clean, `1` failures, `2` missing inputs.
3. Report:
   - coverage counts (mapped / stale / unmapped / out_of_scope);
   - requirements with no satisfying task or code edge;
   - units whose evidence files are missing;
   - unresolved wikilinks and managed-block errors;
   - stale security findings.
4. Do not modify `graph.json` during an audit. Propose `sync` or `specs` as the fix.

This is read-only with respect to code and specs. It writes only the audit summary.