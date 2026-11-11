# Commands

Run from the repository root. The CLI is zero-dependency (`node >= 20`).

```bash
node scripts/mapkeeper.mjs <command> [options]
```

## Commands

| Command | Writes | Purpose |
| --- | --- | --- |
| `init` | everything | first map, or rebuild after a reset |
| `sync` | stale units + summary + context | incremental update |
| `audit` | summary only | validate and report gaps; exit 1 on failure |
| `full` | everything | rebuild derived artifacts, keep human text |
| `export` | architecture + vault | regenerate docs from an existing graph |
| `context` | `02-LLM-Context.md` | compact context only |
| `graph` | `graph.json` (+ ledger) | graph only |
| `specs` | spec nodes merged | ingest `.specify/` |
| `security <run>` | security nodes merged | ingest a security-audit run |
| `query "<q>"` | nothing | graphify query, else graph traversal |
| `query path <a> <b>` | nothing | shortest path |
| `query explain <node>` | nothing | dump one node |
| `doctor` | nothing | environment/artifact checks; `--migrate` upgrades v1 first |
| `migrate` | graph, ledger, exports, vault, summary | v1 → v2 with `project-map/.backup-v1/` backup |

## Options

| Flag | Default | Notes |
| --- | --- | --- |
| `--dir <path>` | cwd | project root |
| `--out <path>` | `project-map` | output directory |
| `--phase BEFORE\|DURING\|END` | previous or `DURING` | |
| `--name <project>` | package.json or dir | |
| `--graphify auto\|manual\|disabled` | `auto` | `manual`/`disabled` force the fallback |
| `--run-tool` | off | allow `graphify update` when a cache exists |
| `--security-run <dir>` | none | ingest this run |
| `--no-specs` | off | skip `.specify/` |
| `--budget <tokens>` | 1500 | context note target |
| `--prune` | off | delete orphaned mapkeeper-managed notes |
| `--soft` | off | audit exits 0 despite failures |
| `--strict` | off | non-zero exit on warnings |
| `--json` | off | machine-readable `doctor` output |
| `--debug` | off | stack traces |

## Legacy aliases

The old prompt verbs map to the same handlers:

```text
MAPPER INIT            → init
MAPPER SYNC            → sync
MAPPER AUDIT           → audit
MAPPER FULL            → full
MAPPER EXPORT ONLY     → export
MAPPER CONTEXT ONLY    → context
MAPPER GRAPHIFY ONLY   → graph
```

## Typical sequences

```bash
# first map, with graphify cache and a security run
node scripts/mapkeeper.mjs init --security-run ../audits/run-1

# after a code change
node scripts/mapkeeper.mjs sync

# before a release
node scripts/mapkeeper.mjs audit

# after /speckit-tasks
node scripts/mapkeeper.mjs specs

# from a security audit output directory
node scripts/mapkeeper.mjs security ~/security-audit-skill/app/run-2

# handover
node scripts/mapkeeper.mjs full --phase END
node scripts/mapkeeper.mjs export
```

## Spec-kit extension commands

After `specify extension add --dev spec-kit-extension`:

```text
/speckit-mapkeeper-init
/speckit-mapkeeper-sync
/speckit-mapkeeper-audit
```

Optional hooks: `after_tasks` and `after_implement` ask whether to sync the map.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | success |
| 1 | validation/audit failure or warnings under `--strict` |
| 2 | missing inputs or usage error |

## Environment

No secrets are read. The CLI never needs an API key. Graphify may use its own configuration; this tool only calls `graphify --version`, `graphify update`, and `graphify query|path|explain`.