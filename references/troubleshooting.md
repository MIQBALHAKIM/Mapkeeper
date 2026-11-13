# Troubleshooting

## A provider is not detected

`status` prints hints; Mapkeeper never installs anything.

| Provider | Typical fix |
| --- | --- |
| Graphify | Install the `graphify` skill or CLI, then run `/graphify`; a cache alone still enables links |
| spec-kit | Install `specify`, run `specify init` for this project, then install the `/speckit.*` commands for your agent |
| security-audit | Install the `security-audit` skill; full audits need an output directory outside the target |

## spec-kit commands are missing

`status` reports “initialized but no `speckit.*` commands”. Initialize the project with `specify init` and select the current agent, or add the commands to `.kilo/commands/` (spec-kit's Kilo integration uses that directory). Mapkeeper will not recreate them.

## `/mapkeeper spec …` only prints a command

That is intentional. An agent cannot execute another slash command. Run the printed `/speckit.*` command, then return to `/mapkeeper links` or `status`.

## “no inputs found”

There is no `graphify-out/graph.json`, no `.specify/` feature, and no security run. Build a Graphify cache, initialize spec-kit, or pass `--run <dir>`. No report is written.

## Invalid Graphify cache

`status --check` fails and `links` adds `invalid_graph` when `graphify-out/graph.json` is not valid JSON. Re-run `/graphify --update`. Mapkeeper does not repair provider output.

## Invalid findings

`findings.json` exists but cannot be parsed. Use the security-audit skill's own validator and regenerate the run. Mapkeeper does not rewrite or re-validate a run.

## Links are missing

Check `unresolved` first:

- `finding_no_graph_node` — Graphify did not index that file; update the graph.
- `finding_unknown_requirement` — the finding references a requirement absent from the active feature.
- `requirement_no_task` — `tasks.md` does not mention the requirement.
- `task_missing_file` — the task references a path that does not exist.
- `task_unknown_requirement` — the task references an ID not in `spec.md`.

## Reports are stale

`links` warns when the security run revision, Graphify cache, or spec files predate the latest commit. Refresh the relevant provider. Warnings do not fail `--check`; only broken link targets do.

## Security findings are absent from a published report

Local reports include fingerprints, files, severities, and verdicts but never titles, descriptions, or absolute run paths. If security was skipped, check `--no-security` or whether a run is recorded.

## Legacy `project-map/` detected

v3 does not read or write v2 artifacts. They are inert history. Archive or delete them manually; `status` will keep warning until they are gone.

## `mapkeeper` command not found

Run the CLI from the skill checkout:

```bash
node scripts/mapkeeper.mjs status
```

or install the bin with `npm link` from the skill directory. The `/mapkeeper` slash command is separate: copy `command/mapkeeper.md` into `~/.config/kilo/command/` or `.kilo/command/`.

## The `/mapkeeper` command is missing from the palette

Kilo loads commands at session start. Start a new session or reload after installing `command/mapkeeper.md`.