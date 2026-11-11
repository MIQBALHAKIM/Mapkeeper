# Contract: paths, artifacts, and write rules

This file is the single source of truth for what Mapkeeper writes. `SKILL.md`, `Mapkeeper_Prompt.md`, and the HTML guide are generated from or must agree with this file.

## Output layout (inside the user's repository)

```text
your-project/
├── Mapkeeper_Prompt.md              # optional legacy shim, generated, deprecated
└── project-map/
    ├── graph.json                # schema v2 projection: machine truth
    ├── map-ledger.json           # coverage units + run history
    ├── architecture-overview.md
    ├── architecture-overview.json
    ├── architecture-overview.html
    ├── sync-summary.md
    └── obsidian-vault/
        ├── 00-Home.md
        ├── 01-Index.md
        ├── 02-LLM-Context.md
        ├── 10-Architecture/
        └── <kind folders>/
```

`.DS_Store`, `graphify-out/`, and `project-map/.cache/` are never mapped.

## Mandatory rules

1. `project-map/` is the only output directory. Do not use `docs/project-map/`, `.project-map/`, `knowledge/`, `architecture-map/`, or `maps/`.
2. `project-map/graph.json` is the only graph of record. `graphify-out/graph.json` is a tool cache; it is never edited by hand and never committed as truth.
3. `project-map/map-ledger.json` is the coverage record. A run that does not update it has not been audited.
4. Never place generated artifacts outside `project-map/`, except the optional `Mapkeeper_Prompt.md` shim and the repository's own docs.
5. Never write into `.specify/` or into a security audit run directory. Both are read-only inputs.
6. Never expose secrets, tokens, credentials, connection strings, or private keys in any artifact. Redact to `<redacted>` and add an `unknown` entry explaining what was removed.

## Write rules (bind to these, not to prose)

Every generated Markdown region is wrapped in a managed block:

```markdown
<!-- mapkeeper:begin id=<stable-id> -->
generated content
<!-- mapkeeper:end id=<stable-id> -->
```

- Writers replace **only** the block body. Text outside blocks is human-owned and must survive every run.
- A missing block is appended; an existing block is replaced; a new file is created with a heading, then the block.
- `scripts/check-managed-blocks.mjs` fails on an unclosed or duplicate block id.
- Per-node notes carry YAML frontmatter that is regenerated on every run. Human notes go under a `## Notes` heading outside managed blocks.

`02-LLM-Context.md` is fully generated and budget-enforced: target ≤ 1,500 tokens, hard fail > 2,000 (`scripts/validate-context.mjs`).

## Evidence rules

| Situation | Required evidence |
| --- | --- |
| Node derived from graphify | `source_refs: ["<file>#<loc>"]` or `source_refs: ["<file>"]` copied from `source_file` |
| Node derived from spec-kit | `spec_refs: ["<spec path>#<FR/T/US id>"]` |
| Node derived from a security run | `source_refs: ["<file>:<line>"]` and `verdict` |
| Node inferred by the model | `confidence` (low/medium/high) and listed under *Unverified* in `sync-summary.md` |
| Edge | `source`, `target`, `relation`, `confidence`; `confidence_score` is required unless `EXTRACTED` |

Ids are stable. Never rename an id because a label changed. Ids must match `^[A-Za-z0-9][A-Za-z0-9_.:-]*$`. Namespaced prefixes: `spec_<feature>_...` for spec-kit, `sec_<run>_...` for security, `decision_adr_...` for decisions.

## Mode contract

| Mode | Writes | Reads |
| --- | --- | --- |
| `INIT` | graph, ledger, vault, exports, summary, context | source tree, graphify, `.specify/`, optional security run |
| `SYNC` | only stale/mapped units + summary + context | changed files plus prior ledger |
| `AUDIT` | summary findings only; no graph regeneration | graph, ledger, source tree |
| `FULL` | everything, rebuilt | full source tree |
| `EXPORT` | architecture exports + vault | existing graph |
| `CONTEXT` | `02-LLM-Context.md` | existing graph + ledger |
| `GRAPH` | graph.json | graphify cache or source scan |
| `SPECS` | spec nodes merge | `.specify/` |
| `SECURITY` | security nodes merge | a security run directory |

## Failure rules

- A tool is never reported as used unless it ran and its output parsed. Record `meta.graphify.available` honestly.
- Graphify unavailable → deterministic source scan (files + import edges) + spec/security ingestion. Mark `derivation: "llm"` only for model-authored content.
- Graphify failed mid-run → keep the previous graph, add a `sync-summary.md` warning with the exact error, and exit non-zero in `--strict` mode.
- Validation failure → do not overwrite the previous valid graph; write to `project-map/.cache/graph.candidate.json`, report the error, exit 1.