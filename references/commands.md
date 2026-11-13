# Commands

Mapkeeper v3 has two surfaces: the `/mapkeeper` menu that routes to providers, and a small local CLI for status and links.

## `/mapkeeper` menu

| # | Choice | Routes to |
| --- | --- | --- |
| 1 | Map codebase | Graphify: build, update, query, open report |
| 2 | Spec-driven work | spec-kit: status, specify, plan, tasks, analyze, implement |
| 3 | Security review | security-audit: guidance, full audit, existing run |
| 4 | Combine outputs | `mapkeeper links` |
| 5 | Status & health | `mapkeeper status` |

With arguments, skip the menu:

| Input | Action |
| --- | --- |
| `/mapkeeper map [args]` | Invoke the Graphify skill unchanged |
| `/mapkeeper spec <action>` | Print the exact `/speckit.<action>` command |
| `/mapkeeper security [guidance\|audit\|run <dir>]` | Route to the security-audit skill |
| `/mapkeeper links [args]` | Generate the cross-reference report |
| `/mapkeeper status [args]` | Detect providers and artifacts |
| `/mapkeeper help` | Router reference |

The command lives at `~/.config/kilo/command/mapkeeper.md` (user) or `.kilo/command/mapkeeper.md` (project). It is plain Markdown with frontmatter.

## CLI

```bash
# from the skill checkout
node scripts/mapkeeper.mjs status
node scripts/mapkeeper.mjs links

# or after installing the bin
mapkeeper status
mapkeeper links
```

| Command | Purpose |
| --- | --- |
| `status` | Detect providers, versions, native artifacts, staleness, legacy maps |
| `links` | Cross-reference findings ↔ requirements ↔ tasks ↔ files ↔ Graphify nodes |
| `help` | CLI reference |

### `status`

```bash
mapkeeper status [--json] [--check] [--dir <path>] [--no-write]
```

- Refreshes `.mapkeeper/state.json` by default; `--no-write` keeps it read-only.
- `--check` exits `1` only when a present artifact is unreadable or invalid.
- Absent providers are warnings, not failures.

### `links`

```bash
mapkeeper links [--run <dir>] [--graph <path>] [--no-security]
                [--out <path>] [--json] [--check] [--dir <path>] [--no-write]
```

- `--run` records an existing security run (default: last recorded run).
- `--graph` overrides `graphify-out/graph.json`.
- `--no-security` omits findings from the report.
- `--out` publishes a shareable Markdown copy; local JSON and Markdown always go to `.mapkeeper/`.
- `--check` exits `1` when a linked target is missing or an input is malformed.

## Examples

```bash
# after Graphify builds a cache
mapkeeper status
mapkeeper links

# combine all three providers
mapkeeper links --run ~/security-audit-skill/app/run-2

# hand off a spec action (printed by /mapkeeper spec plan)
/speckit.plan

# publish a report for a PR
mapkeeper links --out docs/mapkeeper-links.md
```

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | success, including warnings and partial inputs |
| 1 | `--check` blocking gaps, no inputs, or a requested run is missing |
| 2 | usage error |

## Removed in v3

`init`, `sync`, `audit`, `full`, `export`, `context`, `graph`, `specs`, `security`, `migrate`, and `query` are owned by the providers. Use `/graphify`, `/speckit.*`, the security-audit skill, or `graphify query` directly. Legacy `MAPPER …` verbs are gone.