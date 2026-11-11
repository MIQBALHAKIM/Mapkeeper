# Graph and ledger schema (v2)

Machine-readable sources: `schema/graph.schema.json`, `schema/ledger.schema.json`, `schema/context.schema.json`. Validators: `scripts/validate-*.mjs`. If prose and schema disagree, the schema wins.

## graph.json

```json
{
  "schema_version": 2,
  "meta": {
    "project_name": "string",
    "phase": "BEFORE | DURING | END",
    "update_mode": "INIT | SYNC | AUDIT | FULL",
    "generated_at": "ISO-8601",
    "source_revision": "git sha, sha-dirty, worktree, or migrated",
    "graphify": { "available": false, "version": null, "graph_path": null, "used_cache": false },
    "generator": "graphify | graphify+llm | llm-manual | graphify-fallback",
    "counts": { "nodes": 0, "edges": 0, "by_derivation": {} },
    "assumptions": [],
    "unknowns": []
  },
  "nodes": [],
  "edges": [],
  "hyperedges": [],
  "coverage": { "units_total": 0, "mapped": 0, "stale": 0, "unmapped": 0, "out_of_scope": 0 }
}
```

## Node

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | `^[A-Za-z0-9][A-Za-z0-9_.:-]*$`, stable forever, unique |
| `kind` | yes | one of the 31 kinds in the schema (component, requirement, finding, trust_boundary, …) |
| `label` | yes | human name, ≤ 160 chars in practice |
| `status` | yes | `planned`, `implemented`, `unknown`, `deprecated`, `confirmed`, `needs_validation` |
| `derivation` | yes | `graphify`, `speckit`, `security`, `llm`, `merged` |
| `summary` | no | one or two sentences, no secrets |
| `phase` | no | `BEFORE`, `DURING`, `END` |
| `confidence` | no | `low`, `medium`, `high`; required for inferred nodes |
| `provenance` | no | `{source_file, source_location, relation_source: EXTRACTED|INFERRED|AMBIGUOUS, run_dir?, community?}` |
| `spec_refs` | no | `path/to/spec.md#FR-001` |
| `source_refs` | no | `path#L10`, `path:42` |
| `tags` | no | free-form |
| `severity` | only confirmed findings | `critical`, `high`, `medium`, `low`, `informational` |
| `verdict` | findings | `confirmed`, `needs_validation` (never `rejected`) |
| `last_verified` | no | `{revision, date}` |

Rules enforced by `validate-graph.mjs`:

1. Node ids are unique.
2. A node whose `provenance.relation_source` is not `INFERRED` needs `source_refs` or `spec_refs`.
3. An inferred node needs `confidence`.
4. `verdict: "rejected"` must never appear.
5. `status: "needs_validation"` must not carry `severity`; `severity` requires `status: "confirmed"`.
6. Edge endpoints exist and are not self-edges.
7. `meta.counts.nodes/edges` equal array lengths.

## Edge

```json
{
  "source": "node-id",
  "target": "node-id",
  "relation": "calls | implements | references | cites | conceptually_related_to | shares_data_with | semantically_similar_to | rationale_for | depends_on | produces | consumes | manages | decides | blocks | supports | documents | tests | deploys_to | satisfies_requirement | affects | violates | mitigated_by | relates_to | contains",
  "confidence": "EXTRACTED | INFERRED | AMBIGUOUS",
  "confidence_score": 1.0,
  "derivation": "graphify | speckit | security | llm | merged",
  "source_refs": ["path#L10"],
  "last_updated": "YYYY-MM-DD"
}
```

`confidence_score` is required unless `EXTRACTED`. Never invent a relation: skip the edge and warn.

## Id rules

| Source | Pattern | Example |
| --- | --- | --- |
| graphify | verbatim from graphify | `src_auth_session_validatetoken` |
| deterministic scan | `file_<sanitized path without extension>` | `file_src_auth_session` |
| spec-kit | `spec_<feature>_<artifact>` | `spec_001-auth_fr-001`, `spec_001-auth_t001` |
| security | `sec_<run>_<fingerprint>` | `sec_run-1_aaaa1111` |
| trust boundary | `sec_<run>_tb_<slug>` | `sec_run-1_tb_http_edge_to_app` |
| decision | `decision_adr_<n>` | `decision_adr_0001` |

## map-ledger.json

```json
{
  "schema_version": 1,
  "source_revision": "abc123",
  "units": [
    {
      "id": "path_src",
      "kind": "path | requirement | component",
      "scope": "src/**  |  <root>  |  specs/x/spec.md#FR-001",
      "status": "mapped | stale | unmapped | out_of_scope",
      "node_ids": ["file_src_index"],
      "evidence": ["project-map/graph.json#nodes"],
      "last_verified_revision": "abc123",
      "last_verified_date": "YYYY-MM-DD"
    }
  ],
  "runs": [
    {
      "mode": "INIT",
      "revision": "abc123",
      "started_at": "ISO-8601",
      "finished_at": "ISO-8601",
      "counts": { "mapped": 4 },
      "artifacts": ["project-map/graph.json"]
    }
  ]
}
```

Unit semantics:

- `path` units come from tracked files, grouped by top-level tree plus one `<root>` unit.
- `requirement` units come from spec-kit ids and must have a `satisfies_requirement` edge to be considered covered.
- `mapped` requires at least one node id and non-empty evidence.
- `out_of_scope` is an explicit human decision, never an automatic escape for unsupported files.
- `runs` keeps the last 50 entries and drives the `sync-summary.md` history block.

## context note

`project-map/obsidian-vault/02-LLM-Context.md` frontmatter must include `project`, `phase`, `status`, `source_revision`, `generated_at`, `budget_tokens` (100–2000). Body: one top-level heading, ≤ 2000 tokens by `chars/4`, target 1500. Detail belongs in linked notes, not here.