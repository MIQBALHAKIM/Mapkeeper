# Links report

`mapkeeper links` reads native outputs and emits a cross-reference report. It does not create a graph or re-extract anything.

## Inputs

| Provider | Default | Override |
| --- | --- | --- |
| Graphify | `graphify-out/graph.json` | `--graph <path>` |
| spec-kit | active feature from `.specify/feature.json`, else newest `specs/*/spec.md` | edit `feature.json` |
| security-audit | last run in `.mapkeeper/state.json` | `--run <dir>`, `--no-security` |

Partial input is allowed. Missing providers are recorded in `inputs` and `warnings`; nothing is fabricated. If no input exists at all, the CLI exits `1` and writes no report.

## Link types

| Type | From → to | Evidence |
| --- | --- | --- |
| `finding_file` | finding fingerprint → file path, with matching Graphify node IDs | `findings.json#<fp>` |
| `finding_requirement` | finding fingerprint → requirement ID | `findings.json#<fp>` |
| `requirement_task` | requirement ID → task ID | `tasks.md#T###` |
| `task_file` | task ID → file path | `tasks.md#T###` |
| `requirement_file` | requirement ID → file path, derived through tasks | `tasks.md#T###` |

Rules:

- Files match by normalized relative path only; no fuzzy label matching.
- Requirement IDs normalize to `FR-001`, `NFR-001`, `SR-001`, `CR-001`.
- Rejected findings are counted but never linked. `needs_validation` findings are linked without severity.
- Graph node IDs are preserved verbatim; Mapkeeper invents none.
- Findings without a file, files without a Graphify node, unknown requirements, requirements without tasks, and missing task files are unresolved.

## Unresolved kinds

| Kind | Meaning |
| --- | --- |
| `finding_no_file` | finding has no file/location |
| `finding_no_graph_node` | file exists in the finding but no Graphify node matches |
| `finding_unknown_requirement` | finding references a requirement absent from the active spec |
| `requirement_no_task` | requirement has no task referencing it |
| `task_unknown_requirement` | task references an unknown requirement |
| `task_missing_file` | task mentions a file that does not exist |
| `invalid_graph` | Graphify cache exists but is not valid JSON |
| `invalid_findings` | security `findings.json` exists but is not valid JSON |

`--check` exits `1` when any unresolved item exists. Absent optional providers are warnings, not failures.

## Output

`.mapkeeper/links.json`:

```json
{
  "schema_version": 1,
  "generated_at": "2026-11-13T00:00:00.000Z",
  "source_revision": "abc123",
  "inputs": {
    "graphify": { "path": "graphify-out/graph.json", "present": true, "valid": true, "nodes": 120 },
    "speckit": { "present": true, "feature_dir": "specs/001-auth", "requirements": 8, "tasks": 12 },
    "security": { "present": true, "skipped": false, "run_id": "run-1", "findings": 4, "verdicts": { "confirmed": 3, "needs_validation": 1, "rejected": 1 } }
  },
  "links": [
    {
      "type": "finding_file",
      "from": "aaaa1111",
      "to": "src/auth/session.js",
      "graph_node_ids": ["src_auth_session"],
      "verdict": "confirmed",
      "severity": "medium",
      "evidence": "findings.json#aaaa1111"
    }
  ],
  "unresolved": [],
  "warnings": [],
  "counts": { "graph_nodes": 120, "requirements": 8, "tasks": 12, "findings": 4, "links": 1, "unresolved": 0, "links_by_type": { "finding_file": 1 } }
}
```

`.mapkeeper/links.md` is the human view. It contains only fingerprints, files, IDs, severities, and verdicts — no finding titles, descriptions, or absolute run paths. `--out <path>` writes the same Markdown to a shareable location.

## Freshness

Warnings are added when evidence exists:

- security `source_ref` differs from the current revision;
- Graphify cache mtime is older than the latest commit;
- spec feature files are older than the latest commit.

No freshness claim is made for non-git directories.