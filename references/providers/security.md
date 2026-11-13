# security-audit provider

security-audit owns audit methodology, sandbox rules, candidate validation, and reports. Mapkeeper routes to it and reads a finished run for links. It never runs phases itself.

## Detection

- Skill: `security-audit` under project or global skill dirs.
- Last run: recorded in `.mapkeeper/state.json`; otherwise pass `--run <dir>`.
- Run artifacts: `run-metadata.json`, `findings.json`, `coverage-ledger.json`, `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`, `architecture.md`.

State records `skill`, `skill_dir`, `last_run`, `run_status`, `findings`, `source_ref`, `run_id`.

## Modes

| Choice | Behavior |
| --- | --- |
| Guidance (default) | Invoke the skill for a focused question or review. No run directory required. |
| Full audit | Only on an explicit request. Ask for an output directory **outside** the target, profile, and budget, then invoke the skill. Its sandbox and validation rules are authoritative. |
| Existing run | Record the directory for links with `mapkeeper links --run <dir>`; do not re-audit. |

Never auto-run a full audit from the menu, and never relax the skill's execution policy.

## Rules

- Never ingest findings into a graph, re-validate candidates, or rewrite a run directory.
- Never publish `rejected` candidates or assign severity to `needs_validation`.
- Never copy finding titles or descriptions into link reports; reports use fingerprints, files, requirement IDs, severities, and verdicts.
- Validation stays in the provider: use its `validate-findings.cjs` and `validate-coverage-ledger.cjs` if validation is requested.

## Links input

`findings.json` records with `fingerprint`/`id`, `verdict`, `file`/`path`, `requirements` (or `requirement_ids`/`spec_refs`), and `severity`. Tolerated shapes: an array, or an object with `findings`, `records`, `results`, or `items`. Rejected records are counted but not linked.