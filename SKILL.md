---
name: mapkeeper
description: "Build and maintain a living project map for any repository: a validated knowledge graph, a coverage ledger, an Obsidian vault, and architecture exports. Use when asked to map a project, generate or sync architecture docs, audit code-versus-documentation drift, ingest spec-kit specs, turn security findings into a project map, or answer questions from an existing project-map/ or graphify-out/."
---

# Mapkeeper

Turn any repository into a living, validated project map. The map is a projection of evidence, not a novel.

## Read this first

Before writing any artifact, read `references/contract.md`. It is the only place that defines paths, managed blocks, evidence rules, and failure behavior. Do not restate its rules from memory.

Then read the one reference for the work at hand:

| Need | Read |
| --- | --- |
| Modes, phases, token/output discipline | `references/modes.md` |
| Graphify detection, projection, fallback | `references/graphify-adapter.md` |
| Graph and ledger fields | `references/schema.md` |
| Vault layout and note format | `references/obsidian.md` |
| Markdown/JSON/HTML exports | `references/architecture-exports.md` |
| Spec-kit specs, plans, tasks, traceability | `references/speckit-adapter.md` |
| Security audit findings ingestion | `references/security-adapter.md` |
| Commands, flags, legacy aliases | `references/commands.md` |
| Broken run, failed validation, migration | `references/troubleshooting.md` |

## Output contract (short form)

```text
project-map/
├── graph.json                 # schema v2, machine truth
├── map-ledger.json            # coverage units + run history
├── architecture-overview.md|.json|.html
├── sync-summary.md
└── obsidian-vault/
    ├── 00-Home.md
    ├── 01-Index.md
    ├── 02-LLM-Context.md      # ≤ 1500 tokens target, 2000 hard fail
    └── ...
```

`graphify-out/graph.json` is a tool cache. `project-map/graph.json` is the graph of record. Never place artifacts outside `project-map/` except the optional legacy `Mapkeeper_Prompt.md`.

## Choose the mode

| Situation | Mode |
| --- | --- |
| No `project-map/graph.json` | `init` |
| Existing map, user describes a change | `sync` |
| Review / consistency / gaps requested | `audit` |
| Full rebuild, handover, as-built | `full` |
| Only docs requested | `export` |
| Only the compact context note requested | `context` |
| Only the graph requested | `graph` |
| `.specify/` changed | `specs` |
| A security run directory is supplied | `security` |

An explicit `--mode` or a legacy verb wins.

## Procedure

1. **Resolve the project**: `--dir` (default cwd), project name from `--name`, then `package.json`, then the directory name.
2. **Gather evidence**: graphify cache or deterministic scan; `.specify/` if present; a security run if supplied.
3. **Project, never invent**: map graphify nodes and relations 1:1, keep ids stable, tag `derivation` (`graphify`, `speckit`, `security`, `llm`). A skipped relation is a warning, not a guess.
4. **Write through the CLI**, not by hand:
   ```bash
   node scripts/mapkeeper.mjs init|sync|audit|export|context|graph|specs|security|doctor|query|migrate
   ```
   The CLI owns validation, managed blocks, the vault, exports, and the ledger. Hand-writing `graph.json` is a last resort and must still pass `scripts/validate-graph.mjs`.
5. **Report**: mode, generation source, changed units, coverage counts, assumptions/unknowns, artifacts, next actions.

## Non-negotiables

- A tool is never reported as used unless it ran and its output parsed. If graphify is missing, say `graphify-fallback` or `llm-manual`.
- Every non-inferred node needs `source_refs` or `spec_refs`. Inferred nodes need `confidence` and appear under *Unverified* in `sync-summary.md`.
- Validation failure must not overwrite the previous good graph. The CLI writes the candidate to `project-map/.cache/graph.candidate.json` and exits non-zero.
- Never write into `.specify/`, a security run directory, or a human-owned region of a vault note.
- Never publish a security candidate whose verdict is `rejected`, and never assign severity to `needs_validation`.
- Redact secrets to `<redacted>` and add an `unknowns` entry describing what was removed.

## Adapters (optional, read-only)

**Graphify**: detect the `graphify` binary and `graphify-out/graph.json`. Run `graphify update` only when a cache exists and the user allows it (`--run-tool`); otherwise consume the cache. `mapkeeper query` delegates to `graphify query|path|explain`.

**Spec-kit**: detect `.specify/`; ingest `constitution.md`, `spec.md`, `plan.md`, `tasks.md`. Requirements get ids from `FR-###`/`US#`; tasks from `T###`; edges `satisfies_requirement`. Report requirements with no task and tasks referencing missing files. Never edit spec-kit artifacts.

**Security audit**: locate an installed `security-audit` skill and a run directory containing `run-metadata.json`, `architecture.md`, `findings.json`. Preserve verdicts; trust boundaries become nodes; findings link to files, boundaries, and requirements. Never run an audit implicitly.

## Answering questions from the map

1. Read `project-map/obsidian-vault/02-LLM-Context.md` first.
2. If the question is about structure, use `mapkeeper query` (or `graphify query`) before reading source.
3. Open only the node notes linked from the answer.

## Validation

```bash
node scripts/validate-graph.mjs project-map/graph.json
node scripts/validate-ledger.mjs project-map/map-ledger.json
node scripts/validate-context.mjs project-map/obsidian-vault/02-LLM-Context.md
node scripts/check-managed-blocks.mjs project-map
node scripts/mapkeeper.mjs doctor
```

An `audit` exits non-zero when artifacts are invalid, a tracked path is absent from the ledger, a mapped unit's evidence is missing, or a requirement has no satisfying edge. Never claim full coverage without stating the ledger counts.

## Final response

1. Mode and phase.
2. Generation source (`graphify`, `graphify+llm`, `llm-manual`, `graphify-fallback`).
3. What changed or what the audit found.
4. Coverage: mapped / stale / unmapped / out_of_scope.
5. Assumptions and unknowns.
6. Artifacts written.
7. Risks and next actions.