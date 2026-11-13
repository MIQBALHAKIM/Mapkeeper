# Changelog

## 2.1.0 — 2026-11-13

### Added

- `/mapkeeper` command. Run without arguments to get a state-aware mode menu (create, update, audit, rebuild, export, import, ask/maintain); arguments bypass the menu (`/mapkeeper audit --soft`, `/mapkeeper query "…"`, `/mapkeeper help`).
- `command/mapkeeper.md` distribution file and install instructions for user-level (`~/.config/kilo/command/`) and project-level (`.kilo/command/`) use.
- Docs contract test covering the menu, the command, and CLI mode parity.

### Changed

- `SKILL.md` description now mentions the no-argument menu invocation.
- `npm test` runs every `tests/*.test.mjs` file.

## 2.0.0 — 2026-11-11

### Breaking

- The prompt-only interface is deprecated. `Mapkeeper_Prompt.md` is now a generated shim; the `mapkeeper` skill and `scripts/mapkeeper.mjs` are authoritative.
- `project-map/graphify-knowledge-graph.json` is replaced by `project-map/graph.json` with `schema_version: 2`. Run `node scripts/mapkeeper.mjs migrate` to upgrade an existing tree (a backup is written to `project-map/.backup-v1/`).
- The fictional `graphify_build`/`graphify_update` tool names are gone. Graphify is detected as the `graphify` CLI plus `graphify-out/graph.json`, or not at all.

### Added

- Zero-dependency CLI: `init`, `sync`, `audit`, `full`, `export`, `context`, `graph`, `specs`, `security`, `query`, `doctor`, `migrate`.
- JSON Schemas for the graph, ledger, and context note; validators for each; managed-block checker.
- `project-map/map-ledger.json` coverage ledger with per-unit evidence and run history; `audit` is now falsifiable and CI-friendly.
- Deterministic source scan (file/import/dependency graph) when Graphify is unavailable, labeled `graphify-fallback` or `llm-manual`.
- spec-kit adapter: requirement/task/goal/component/decision/constraint nodes, `satisfies_requirement` edges, traceability gaps, optional extension with `after_tasks` and `after_implement` hooks.
- security-audit adapter: trust boundaries, verdict-preserving findings, stale detection, rejected candidates excluded.
- Managed-block writes so human notes survive regeneration; `--prune` removes only empty mapkeeper-managed notes.
- `mapkeeper doctor`, `mapkeeper query` delegation, v1 migration with backup.
- Guide and prompt are generated from `SKILL.md` and `references/`; `npm run check` fails on drift.

### Changed

- Renamed from Project Mapper to **Mapkeeper**. Skill id is `mapkeeper`, the CLI is `scripts/mapkeeper.mjs`, and the generated prompt is `Mapkeeper_Prompt.md`. Managed regions are now `<!-- mapkeeper:begin/end -->`; existing `mapper:` blocks are read and rewritten in place on the next run.
- Contract, modes, schema, and troubleshooting each live in one file and are referenced, not restated.
- `02-LLM-Context.md` is budget-enforced (target 1500 tokens, hard fail 2000).
- Legacy `MAPPER INIT|SYNC|AUDIT|FULL|EXPORT ONLY|CONTEXT ONLY|GRAPHIFY ONLY` verbs map to the new commands.

### Removed

- The duplicated 1,300-line contract repetitions and the embedded prompt copy in `index.html`.