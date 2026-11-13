---
name: mapkeeper
description: "Route work to Graphify, spec-kit, and security-audit without reimplementing them. Use for mapping a codebase, spec-driven development, security review handoff, provider status, or a cross-reference report linking findings, requirements, tasks, files, and Graphify nodes. Also triggers when the user runs /mapkeeper with no arguments to choose a provider."
---

# Mapkeeper

Mapkeeper is a router and cross-reference layer. Graphify owns the graph, spec-kit owns the specs, and security-audit owns the audit. Mapkeeper detects them, hands off, records local provenance, and links their native outputs.

**Never reimplement a provider.** No graph projection, vault, architecture export, coverage ledger, findings ingestion, or spec execution.

## Start here

**Only show this menu when the invocation has no task or arguments, for example `/mapkeeper`.
If the user already asked for something, skip the menu and act.**

Check once, without scanning the repo:

- `graphify-out/graph.json` — Graphify cache present?
- `.specify/` — spec-kit initialized?
- `.mapkeeper/state.json` — last recorded security run?
- `project-map/graph.json` — legacy v2 map?

Recommend **Update** when a Graphify cache exists, **Build** when it does not, and surface a recorded security run.

| # | Choice | Provider | What happens |
| --- | --- | --- | --- |
| 1 | Map codebase | Graphify | Build, update, query, or open the native report |
| 2 | Spec-driven work | spec-kit | Show feature state, then hand off the exact `/speckit.*` command |
| 3 | Security review | security-audit | Guidance, full audit, or use an existing run |
| 4 | Combine outputs | Mapkeeper | Generate or publish the cross-reference link report |
| 5 | Status & health | Mapkeeper | Detect providers, versions, artifacts, staleness, legacy maps |

Submenus:

- **1 Map codebase** → Build (`/graphify`), Update (`/graphify --update`), Query (`/graphify query "<question>"`), Open `graphify-out/GRAPH_REPORT.md` or the HTML view.
- **2 Spec-driven work** → Status, Specify, Plan, Tasks, Analyze, Implement. Print the exact command from the detected command dir (`/speckit.specify …`, `/speckit.plan`, …). If no commands are installed, print `specify init` guidance and stop.
- **3 Security review** → Guidance (default), Full audit (requires an explicit output directory outside the target and confirmation), or Use an existing run (record its path for links).
- **4 Combine outputs** → Generate links, show unresolved gaps, publish with `--out <path>`.
- **5 Status & health** → `mapkeeper status`, `--json`, `--check`, legacy warning.

## Provider handoffs

| Intent | Detect | Handoff | Owned artifacts |
| --- | --- | --- | --- |
| Map or query the codebase | Graphify skill, `graphify` CLI, `graphify-out/graph.json` | Invoke the `graphify` skill with the user's arguments | `graphify-out/{graph.json,GRAPH_REPORT.md,graph.html}`, optional obsidian dir |
| Specify / plan / tasks / analyze | `specify` CLI, `.specify/`, `speckit.*.md` in `.kilo/commands`, `.kilo/command`, `.claude/commands`, `.github/prompts`, etc. | Print the exact `/speckit.*` command; never execute the template | `.specify/`, `specs/<feature>/{spec,plan,tasks}.md` |
| Security review | security-audit skill, run directory | Invoke the skill; guidance vs full audit is the user's choice | `run-metadata.json`, `findings.json`, `coverage-ledger.json`, `REPORT.md` |

If a provider is missing, print its install/setup hint and continue with the others. Never install or modify a provider.

## Rules

- A provider is never reported as used unless it ran and its output parsed.
- Never build a full Graphify graph or run a security audit without an explicit request. Prefer `--update` when a cache exists.
- Spec-kit is handoff-only. Do not read and execute `speckit.*.md` inside a Mapkeeper turn.
- Never publish a security candidate with verdict `rejected`, and never add severity to `needs_validation`.
- Local artifacts only:
  - `.mapkeeper/state.json` — provider paths, versions, revisions, last run
  - `.mapkeeper/links.{json,md}` — optional cross-reference report
- Do not write `project-map/` or any `graphify-out/`/`.specify/` content.
- Legacy `project-map/` trees are read-only history; report them, never rewrite them.
- Link reports contain fingerprints, file paths, requirement/task IDs, severities, and verdicts only — no finding titles, descriptions, or absolute run paths.

## Status

```bash
mapkeeper status [--json] [--check]
```

If the `mapkeeper` bin is not installed, run the CLI from the skill checkout: `node scripts/mapkeeper.mjs status`.

Detects providers, versions, native artifact paths, staleness, and legacy maps. `--check` exits non-zero only when a present artifact is unreadable or invalid.

## Links

```bash
mapkeeper links [--run <dir>] [--graph <path>] [--no-security] [--out <path>] [--check]
```

If the bin is unavailable, use `node scripts/mapkeeper.mjs links` from the skill checkout.

Reads native outputs only:

| Link | From → to |
| --- | --- |
| `finding_file` | finding fingerprint → file path, with matching Graphify node IDs |
| `finding_requirement` | finding fingerprint → `FR-###` / `NFR-###` |
| `requirement_task` | requirement → task |
| `task_file` | task → file |
| `requirement_file` | requirement → file (derived through tasks) |

Partial inputs are allowed; missing providers are reported, never invented. `--check` exits non-zero when a real link target is missing (file, node, requirement, task), not when an optional provider is absent.

## References

| Need | Read |
| --- | --- |
| Graphify handoff and artifacts | `references/providers/graphify.md` |
| spec-kit detection and command handoff | `references/providers/speckit.md` |
| security-audit modes and runs | `references/providers/security.md` |
| Router and CLI surface | `references/commands.md` |
| Link types and report schema | `references/links.md` |
| State and exit codes | `references/status.md` |
| Missing tools and broken inputs | `references/troubleshooting.md` |

## Final response

1. Provider routed to (or handoff command printed).
2. What ran, what was only read, and what was skipped.
3. Native artifacts and local `.mapkeeper/` updates.
4. Gaps, warnings, and the next command.