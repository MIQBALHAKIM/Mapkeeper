# Mapkeeper

[Read the guide](https://miqbalhakim.github.io/Mapkeeper/) · [Source](https://github.com/MIQBALHAKIM/Mapkeeper)

## 60-second start

```bash
node scripts/mapkeeper.mjs init
node scripts/mapkeeper.mjs doctor
open project-map/obsidian-vault
```

Then, after changes:

```bash
node scripts/mapkeeper.mjs sync
node scripts/mapkeeper.mjs audit
```

No install step, no API key, no network access. Node 20+.

## What you get

```text
project-map/
├── graph.json                 # schema v2: nodes, edges, derivation, provenance
├── map-ledger.json            # coverage units + run history
├── architecture-overview.md   # human view
├── architecture-overview.json # machine view
├── architecture-overview.html # standalone, no CDN
├── sync-summary.md            # latest run, gaps, warnings, history
└── obsidian-vault/            # open directly in Obsidian
    ├── 00-Home.md
    ├── 01-Index.md
    ├── 02-LLM-Context.md      # ≤1500 tokens, the first file an agent reads
    └── 10-Architecture/ … 90-Meta/
```

Generated regions are wrapped in `<!-- mapkeeper:begin id=... -->` blocks. Text outside the blocks is yours and survives every run.

## Install as a skill

Agent-neutral (SKILL.md layout):

```bash
npx skills add https://github.com/MIQBALHAKIM/Mapkeeper --skill mapkeeper
```

Kilo, user-level:

```bash
cp -R . ~/.config/kilo/skills/mapkeeper
```

Kilo, project-level:

```bash
mkdir -p .kilo/skills
cp -R . .kilo/skills/mapkeeper
```

Other agents: copy the directory into the agent's skills folder; `SKILL.md` is the entry point and `references/` is progressive disclosure.

## Install as a spec-kit extension

```bash
specify extension add --dev "$(pwd)/spec-kit-extension"
```

Adds `/speckit-mapkeeper-init`, `/speckit-mapkeeper-sync`, `/speckit-mapkeeper-audit`, plus optional `after_tasks` and `after_implement` hooks. It reads `.specify/` and never writes to it.

## Prefer prompts?

`Mapkeeper_Prompt.md` is generated and deprecated. It is a bounded compatibility shim for environments with no CLI or skill. Regenerate with `npm run build:prompt`.

## Commands

| Command | Purpose |
| --- | --- |
| `init` | first map (graph, ledger, vault, exports, summary, context) |
| `sync` | incremental update of changed units only |
| `audit` | validate artifacts, report coverage and traceability gaps, exit 1 on failure |
| `full` | rebuild derived artifacts, keep human text |
| `export` | regenerate architecture docs and vault |
| `context` | regenerate `02-LLM-Context.md` only |
| `graph` | regenerate `graph.json` only |
| `specs` | ingest `.specify/` and report requirement coverage |
| `security <run>` | ingest a security-audit run directory |
| `query "<q>"` / `query path a b` / `query explain x` | delegate to graphify, else traverse the graph |
| `doctor` | checks: schemas, blocks, links, coverage, adapters |
| `migrate` | v1 `project-map/` → schema v2, with backup |

Legacy `MAPPER INIT|SYNC|AUDIT|FULL|EXPORT ONLY|CONTEXT ONLY|GRAPHIFY ONLY` verbs still work.

## Adapters

**Graphify** — detects `graphify` and `graphify-out/graph.json`, runs `graphify update` only when a cache exists and you allow it (`--run-tool`), projects nodes and relations 1:1, and never invents a relation. Without it, a deterministic file/import scan keeps the map useful and labels itself `llm-manual` or `graphify-fallback`.

**spec-kit** — reads `constitution.md`, `spec.md`, `plan.md`, `tasks.md`; creates requirement, task, goal, component, decision, and constraint nodes with stable ids (`FR-001`, `T012`); adds `satisfies_requirement` edges; reports requirements without tasks and tasks referencing missing files.

**security-audit** — reads `run-metadata.json`, `architecture.md`, and `findings.json`; preserves verdicts (`confirmed`, `needs_validation`, `rejected`), never assigns severity to `needs_validation`, never publishes rejected candidates, and never re-runs an audit.

## Validation

```bash
npm test                                   # schemas, adapters, managed blocks
npm run check                              # tests + generated files are current
node scripts/validate-graph.mjs project-map/graph.json
node scripts/validate-ledger.mjs project-map/map-ledger.json
node scripts/validate-context.mjs project-map/obsidian-vault/02-LLM-Context.md
node scripts/check-managed-blocks.mjs project-map
```

## Repository layout

```text
SKILL.md                 # agent entry point
Mapkeeper_Prompt.md         # generated legacy shim
index.html               # generated single-file guide
references/              # progressive disclosure for modes, adapters, schema, troubleshooting
schema/                  # JSON Schemas (draft 2020-12)
scripts/                 # zero-dependency CLI, validators, guide builder
spec-kit-extension/      # optional extension manifest and commands
tests/                   # node:test suites and fixtures
```

## Background

A living project map for any repository: a validated knowledge graph, a coverage ledger, an Obsidian vault, and architecture exports.

The original version was a 1,300-line prompt that asked an agent to produce JSON it could not validate and to call Graphify tools that did not exist. This version is a skill plus a zero-dependency CLI. Every artifact has a schema, the coverage claim is falsifiable, and Graphify, spec-kit, and security-audit are optional adapters rather than assumptions.

## Development

```bash
npm test
npm run build:guide
npm run build:prompt
npm run check
```

`npm run check` fails if `index.html` or `Mapkeeper_Prompt.md` is stale.

## License

Apache-2.0. See `NOTICE` for inspiration and attribution.

The process patterns (schema-validated artifacts, coverage ledger, independently verified records) are inspired by [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) and [github/spec-kit](https://github.com/github/spec-kit), both MIT. Graphify is an external optional tool, not bundled.