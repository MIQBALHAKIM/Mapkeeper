# Modes, phases, and output budget

## Mode decision table

Pick the first match:

| Condition | Mode |
| --- | --- |
| `project-map/graph.json` missing | `INIT` |
| User asks for review / validation / consistency / gaps | `AUDIT` |
| User asks for full rebuild, handover, closure, or as-built export | `FULL` |
| Only exports are requested | `EXPORT` |
| Only the LLM context note is requested | `CONTEXT` |
| Only the graph is requested | `GRAPH` |
| `.specify/` changed and no code changed | `SPECS` |
| A security run directory is supplied | `SECURITY` |
| Anything else with an existing map | `SYNC` |

An explicit flag wins: `--mode init|sync|audit|full|export|context|graph|specs|security`.

## INIT

1. Resolve project name (arg → `package.json`/`pyproject.toml`/directory name).
2. Detect `.specify/` and an existing security run directory; ingest if present.
3. Detect graphify: binary on `PATH`, `graphify --version`, and `graphify-out/graph.json`. Run `graphify update` only when a cache already exists; never start a long extraction unasked.
4. Project whatever graph data exists into `project-map/graph.json`.
5. Seed `map-ledger.json` from tracked files, one unit per top-level tree plus root files.
6. Write the vault, architecture exports, sync summary, and context note.
7. Validate everything, then print the summary.

## SYNC (incremental)

1. Load ledger. Compute changed files from git (`git status --porcelain` plus the diff from `ledger.source_revision` when available).
2. Mark only affected units `stale`. Units whose scope did not match remain untouched.
3. Re-extract only stale units: graphify `--update` if a cache exists; otherwise rescan only those paths.
4. Merge: new extraction replaces nodes for the rescanned paths; spec-kit and security nodes are preserved until re-ingested.
5. Update the ledger and summary. Output only: changed units, added/removed/updated node ids, new gaps, warnings.

Never regenerate the whole vault. Rewrite only notes whose node ids changed or disappeared; delete notes for removed nodes only when they carry no human text outside managed blocks.

## AUDIT

Read-only with respect to the graph. Produce a report and set the exit code:

- Validate `graph.json`, `map-ledger.json`, `02-LLM-Context.md` budget, and managed blocks.
- Every tracked path must appear in the ledger as `mapped`, `unmapped`, or `out_of_scope`; a path missing from the ledger is a failure.
- Every `mapped` unit's evidence file must exist.
- Every requirement unit must have at least one `satisfies_requirement` edge or be reported missing coverage.
- Report stale units, orphaned Obsidian links, nodes without refs, and findings marked `stale`.
- Exit `0` when clean, `1` when any failure is found, `2` when inputs are missing. `--soft` forces exit 0 for exploratory use.

An audit never claims completeness beyond the ledger. State the coverage counts explicitly.

## FULL

Same pipeline as `INIT`, but discard cached derivations for graphify- and scan-derived nodes and rebuild them. Preserve human text, spec-kit nodes, and security nodes unless `--reset-specs` / `--reset-security` is given. Write `project-map/.backup-v1/` first when migrating a v1 tree.

## EXPORT

Regenerate `architecture-overview.{md,json,html}` and the vault from `graph.json`. Fail if the graph is missing or invalid. Never modify `graph.json`.

## CONTEXT

Regenerate `02-LLM-Context.md` only. Must satisfy the context schema and the token budget.

## GRAPH

Rebuild `graph.json` only. Includes spec-kit and security ingestion unless `--no-specs` / `--no-security` is set.

## SPECS

Ingest `.specify/` artifacts, merge into the graph, update requirement/task units, and write the traceability report.

## SECURITY

Ingest one security run directory. Never run the audit itself unless the user explicitly asked for an audit; in that case delegate to the installed `security-audit` skill and state its output directory.

## Phase handling

| Phase | Emphasis | Status vocabulary |
| --- | --- | --- |
| `BEFORE` | goals, scope, requirements, constraints, stakeholders, planned architecture | `planned`, `unknown` |
| `DURING` | implementation, decisions, task state, drift between docs and code | `implemented`, `planned`, `unknown` |
| `END` | as-built, deviations, debt, operational notes, handover | `implemented`, `deprecated`, `unknown` |

Never present planned work as implemented. Anything inferred rather than read is labeled.

## Token rules

The rules below are enforced or made mechanical, not requested:

1. `SYNC` prints only deltas (from the ledger diff).
2. `02-LLM-Context.md` is the first context source for later questions; `SKILL.md` says so and the validator enforces its size.
3. `query` delegates to `graphify query|path|explain`; the fallback traversal reads `graph.json` only, never the repository.
4. Under a low context budget, read `02-LLM-Context.md` and the affected node notes only.
5. No artifact is duplicated across files: contract text exists once, in `references/contract.md`.

## Final response format

1. Mode and phase.
2. Generation source: `graphify`, `graphify+llm`, `llm-manual`, `graphify-fallback`, plus spec-kit/security ingestion flags.
3. What changed (or audit findings).
4. Coverage: `mapped / stale / unmapped / out_of_scope`.
5. Assumptions and unknowns.
6. Artifacts written.
7. Risks and next actions.