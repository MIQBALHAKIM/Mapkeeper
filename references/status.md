# Status and state

`mapkeeper status` detects the three providers and records local provenance. It never runs a provider.

## State file

`.mapkeeper/state.json` is local. `.mapkeeper/.gitignore` contains `*` and `!.gitignore`, so state and reports stay out of version control. `--out` publishes a report explicitly.

```json
{
  "schema_version": 1,
  "observed_at": "ISO-8601",
  "source_revision": "abc123-dirty",
  "project_root": "/abs/path",
  "providers": {
    "graphify": {
      "skill": true,
      "skill_dir": null,
      "cli": true,
      "version": "0.9.0",
      "cache": "graphify-out/graph.json",
      "cache_mtime": "ISO-8601",
      "report": "graphify-out/GRAPH_REPORT.md",
      "obsidian": null
    },
    "speckit": {
      "cli": true,
      "version": "0.16.2",
      "initialized": true,
      "feature_dir": "specs/001-auth",
      "feature_mtime": "ISO-8601",
      "commands_dir": ".kilo/commands",
      "commands": ["speckit.specify", "speckit.plan", "speckit.tasks"],
      "hooks": false
    },
    "security": {
      "skill": true,
      "skill_dir": null,
      "last_run": "/abs/security-audit/app/run-1",
      "run_status": "complete",
      "findings": 4,
      "source_ref": "abc123",
      "run_id": "run-1"
    }
  },
  "legacy": { "project_map": false, "schema_version": null }
}
```

`skill_dir` is relative to the project when the skill is inside it, otherwise absolute. `last_run` is absolute and local only.

## Detection

- **Graphify:** skill directories, `graphify --version`, `graphify-out/` artifacts.
- **spec-kit:** `specify --version`, `.specify/`, active feature, installed `speckit.*.md` commands, extension hooks.
- **security-audit:** skill directories plus the last run recorded in state.
- **Legacy:** `project-map/graph.json` and its schema version.

Detection is presence-based. It does not validate provider content beyond what `status --check` explicitly parses.

## Staleness

Warnings only, never failures:

- security `source_ref` differs from the current revision;
- Graphify cache mtime is older than the latest commit;
- spec feature files are older than the latest commit.

Non-git directories report `worktree` and skip commit comparisons.

## Output

```bash
mapkeeper status            # human summary
mapkeeper status --json     # { state, checks: { failures, warnings } }
mapkeeper status --check    # exit 1 on unreadable/invalid present artifacts
```

`--check` failures are limited to broken present artifacts (invalid Graphify JSON, invalid `findings.json`). Missing providers and stale artifacts are warnings.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | success (warnings allowed) |
| 1 | `--check` failures |
| 2 | usage error |