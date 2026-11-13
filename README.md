# Mapkeeper

[Read the guide](https://miqbalhakim.github.io/Mapkeeper/) · [Source](https://github.com/MIQBALHAKIM/Mapkeeper)

Mapkeeper is a router for three providers:

- **Graphify** — codebase knowledge graph, queries, reports
- **spec-kit** — specifications, plans, tasks, and their command workflow
- **security-audit** — sandboxed security reviews and findings

Each provider already does its job well. Mapkeeper does not rebuild a graph, vault, coverage ledger, or audit. It detects the providers, hands off to their native skills and commands, records local provenance, and links their outputs when asked.

## Requirements

- Node.js 20+ for the local CLI (`status`, `links`).
- Any subset of the three providers. None is a hard dependency.
- Optional: Kilo for the `/mapkeeper` slash command and skill invocation.

## Install

### Skill

Agent-neutral:

```bash
npx skills add https://github.com/MIQBALHAKIM/Mapkeeper --skill mapkeeper
```

Kilo, user-level:

```bash
mkdir -p ~/.config/kilo/skills/mapkeeper
cp -R ./* ~/.config/kilo/skills/mapkeeper/
```

Kilo, project-level:

```bash
mkdir -p .kilo/skills/mapkeeper
cp -R ./* .kilo/skills/mapkeeper/
```

### `/mapkeeper` command

```bash
mkdir -p ~/.config/kilo/command
cp command/mapkeeper.md ~/.config/kilo/command/mapkeeper.md
```

Or project-local: copy it to `.kilo/command/mapkeeper.md`.

### CLI

```bash
npm link            # installs the `mapkeeper` bin
mapkeeper status
```

Without linking:

```bash
node scripts/mapkeeper.mjs status
node scripts/mapkeeper.mjs links
```

## `/mapkeeper` menu

| # | Choice | Provider |
| --- | --- | --- |
| 1 | Map codebase | Graphify (build, update, query) |
| 2 | Spec-driven work | spec-kit (handoff to `/speckit.*`) |
| 3 | Security review | security-audit (guidance, full audit, existing run) |
| 4 | Combine outputs | `mapkeeper links` |
| 5 | Status & health | `mapkeeper status` |

Arguments skip the menu:

```text
/mapkeeper map --update
/mapkeeper spec plan
/mapkeeper security
/mapkeeper links --run ~/security-audit-skill/app/run-2
/mapkeeper status --check
```

## What Mapkeeper owns

| Owns | Does not own |
| --- | --- |
| Provider detection and routing | Graph construction or projection |
| `.mapkeeper/state.json` provenance | Obsidian vaults or architecture exports |
| Opt-in cross-link reports | Coverage ledgers or findings ingestion |
| Status, staleness, legacy warnings | Running audits, builds, or spec commands |

## Status

```bash
mapkeeper status
```

```text
Mapkeeper status — revision 4f2a1c-dirty

Graphify    skill: yes · cli: 0.9.0 · cache: graphify-out/graph.json · report: graphify-out/GRAPH_REPORT.md
spec-kit    cli: 0.16.2 · initialized: yes · feature: specs/001-auth · commands: .kilo/commands (9)
security    skill: yes · run: run-2 · status: complete · findings: 4
```

`mapkeeper status --check` exits non-zero only when a present artifact is unreadable or invalid. Missing providers are warnings.

## Links

`mapkeeper links` reads native outputs and produces `.mapkeeper/links.{json,md}`:

| Link | From → to |
| --- | --- |
| `finding_file` | finding fingerprint → file, with matching Graphify node IDs |
| `finding_requirement` | finding → requirement |
| `requirement_task` | requirement → task |
| `task_file` | task → file |
| `requirement_file` | requirement → file (derived through tasks) |

```bash
mapkeeper links
mapkeeper links --run ~/security-audit-skill/app/run-2
mapkeeper links --check
mapkeeper links --out docs/mapkeeper-links.md
```

Reports contain fingerprints, file paths, requirement/task IDs, severities, and verdicts — no finding titles, descriptions, or absolute run paths. Rejected findings are never linked; `needs_validation` findings keep their verdict and carry no severity.

## Local artifacts

```text
.mapkeeper/
├── .gitignore       # "*" + "!.gitignore" — the directory stays local
├── state.json       # provider paths, versions, revisions, last run
└── links.{json,md}  # optional cross-reference report
```

Nothing else is written. Mapkeeper never modifies `graphify-out/`, `.specify/`, a security run directory, or a legacy `project-map/`.

## Providers

| Provider | Owns | Mapkeeper hands off |
| --- | --- | --- |
| [Graphify](https://github.com/MIQBALHAKIM/Mapkeeper/blob/main/references/providers/graphify.md) | `graphify-out/graph.json`, `GRAPH_REPORT.md`, HTML, obsidian, query/path/explain, MCP | Invoke the `graphify` skill |
| [spec-kit](https://github.com/github/spec-kit) | `.specify/`, `specs/<feature>/`, `/speckit.*` commands, hooks | Print the exact `/speckit.*` command |
| [security-audit](https://github.com/cloudflare/security-audit-skill) | run metadata, `findings.json`, `coverage-ledger.json`, reports | Invoke the skill; audit mode requires an explicit external output directory |

If a provider is missing, Mapkeeper prints its setup hint and continues with the others.

## Legacy v2

v3 is a clean break. `project-map/`, graph/ledger schemas, the Obsidian writer, architecture exports, `Mapkeeper_Prompt.md`, and the spec-kit extension are gone. Existing `project-map/` directories are left untouched and reported as legacy by `status`.

## Repository layout

```text
SKILL.md                # router entry point
command/mapkeeper.md    # /mapkeeper slash command
index.html              # generated guide
references/             # provider handoffs, links, status, troubleshooting
scripts/                # status/links CLI
tests/                  # router tests and fixtures
```

## Development

```bash
npm test
npm run build:guide
npm run check
```

## License

Apache-2.0. Graphify, spec-kit, and security-audit are external projects with their own licenses; none is bundled. See `NOTICE`.