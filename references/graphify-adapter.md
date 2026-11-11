# Graphify adapter

Graphify is an optional external tool. It is never required; Mapkeeper always has a deterministic fallback.

## Detection (honest, in this order)

1. `graphify --version` on `PATH` → record the version. A missing binary is not an error.
2. `graphify-out/graph.json` exists → a usable cache. Record `graph_path`.
3. `.specify/` and security runs are independent inputs; they do not imply graphify.

Set `meta.graphify` accordingly:

```json
{ "available": true, "version": "0.9.x", "graph_path": "graphify-out/graph.json", "used_cache": true }
```

`available` means graph data was consumed. `used_cache: false` means the CLI was invoked this run.

## Invocation rules

| Situation | Action |
| --- | --- |
| Cache exists, user passes `--run-tool` | Run `graphify update` in the project root, 10-minute timeout |
| Cache exists, no `--run-tool` | Consume the cache; note it in `sync-summary.md` |
| Cache exists, `init` mode | `graphify update` is allowed (default behavior) |
| No cache, binary present | Do **not** start a full extraction unprompted; use the fallback and say why |
| `--graphify manual` or `disabled` | Never invoke; use the deterministic fallback |
| Update fails | Keep the previous graph, record the exact stderr, continue with the fallback if no cache |

Never run `graphify` with `--mcp` automatically. MCP is for query-time delegation.

## Projection (graphify → graph.json)

Node mapping:

| graphify `file_type` | Mapkeeper `kind` |
| --- | --- |
| `code` | `file` |
| `document`, `paper`, `image` | `document` |
| `rationale` | `decision` |
| `concept` | `data_entity` |
| missing/unknown | `file` |

Preserve, verbatim:

- `id` (never rename, never add chunk suffixes)
- `label`
- `source_file` (relativized to the project root when it is absolute and inside it)
- `source_location`
- `community` (into `provenance.community` and `tags`)

Set `derivation: "graphify"`, `confidence: "high"` for code and `"medium"` otherwise, `status: "implemented"` for code and `"unknown"` otherwise, `provenance.relation_source: "EXTRACTED"`.

Edge mapping is 1:1 and only for these relations:

```text
calls, implements, references, cites,
conceptually_related_to, shares_data_with,
semantically_similar_to, rationale_for
```

If graphify emits any other relation, skip the edge and add a warning naming it. Never translate an unknown relation into `relates_to`.

Keep `confidence` and `confidence_score` unchanged. Hyperedges are not projected in v2; count them in the warning list if present.

## Deterministic fallback (`llm-manual` / `graphify-fallback`)

When no graph is available, the scan is intentionally simple and reproducible:

1. One `project` node (`project_root`) and one `file` node per tracked text file, ids `file_<sanitized-path-without-extension>`.
2. `component` nodes for top-level folders with 3+ files, edges `contains`.
3. Import edges `references` (`EXTRACTED`, score 1.0) resolved from relative JS/TS `import`/`require` and Python `import`/`from`. Unresolvable imports are dropped silently; cross-language edges are never created.
4. `dependency` nodes from `package.json` with `depends_on` edges from the project node.
5. Ignored: `project-map/`, `graphify-out/`, `node_modules/`, `.git/`, `.specify/`, lockfiles, binary/media files.

The fallback does not invent call graphs, services, or data flows. If the user needs those, they must install graphify or provide a graph.

## Incremental behavior

- `sync` without a cache rescans only changed files (git status plus the diff from `ledger.source_revision`).
- Units whose scope matched a changed file become `stale` before rescanning.
- Nodes whose `source_refs` point at a changed file are replaced; untouched nodes are kept.
- Non-git directories fall back to a full rescan; say so in the summary.

## Query delegation

`mapkeeper query "<question>"` runs `graphify query "<question>"` when both the binary and the cache exist. `mapkeeper query path a b` and `mapkeeper query explain node` delegate to the same CLI. On failure, Mapkeeper prints the graphify error and traverses `project-map/graph.json` instead — it never falls back to reading the repository.

## Failure modes to report, not hide

| Symptom | Message |
| --- | --- |
| binary absent | `graphify binary not found on PATH` |
| binary present, cache absent | `graphify binary present but graphify-out/graph.json is missing` |
| update timeout | `graphify update failed: <stderr>` |
| schema mismatch | `skipped graphify edge with unmapped relation "<x>"` |
| refused shrink | surface graphify's own refusal text; do not delete the existing graph |