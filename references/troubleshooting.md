# Troubleshooting

Start here:

```bash
node scripts/mapkeeper.mjs doctor
```

| Check | Meaning | Fix |
| --- | --- | --- |
| `graph` fail | `graph.json` missing or schema-invalid | run `init`, or fix the reported field |
| `ledger` fail | a mapped unit lost its evidence, or ids collide | run `sync`; set a unit `out_of_scope` if it should not be mapped |
| `context` fail | frontmatter invalid or over 2000 tokens | shorten the body; move detail to node notes |
| `blocks` fail | unclosed/duplicate managed block | restore the matching `<!-- mapkeeper:end id=... -->` |
| `links` warn | a wikilink points at a missing note | run `export`; check for a renamed id |
| `graphify` warn | binary or cache absent | optional: install graphify, or accept the deterministic scan |
| `speckit` warn | no `.specify/` | optional: only needed for spec traceability |
| `security-skill` warn | no installed skill | optional; `npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit` |
| `coverage` warn | stale/unmapped units | `sync`, or mark intentional exclusions `out_of_scope` |
| `artifacts` fail | an export is missing | `export` |

## "graph validation failed"

The previous valid `graph.json` is untouched; the rejected candidate is at `project-map/.cache/graph.candidate.json`.

1. Read the first five errors — they are path-addressed (`$.nodes[12].id`).
2. Common causes: duplicate id; inferred node without `confidence`; edge pointing at a missing node; `severity` on a `needs_validation` finding; counts out of date.
3. Fix the input (usually an ingestion bug), rerun. Do not hand-edit `graph.json` to silence the validator.

## Context note is over budget

`02-LLM-Context.md` is meant to be a pointer file. Move detail into component/requirement notes and link them:

```markdown
- [[20-Components/component_api|API]]
```

Then `mapkeeper context` regenerates it. Never raise the budget to hide bloat; the hard limit is 2000 tokens.

## Units are unmapped

- A new directory appeared: `sync` reseeds path units automatically.
- The files are binary/lockfiles: they are ignored by design; they should not be units.
- The area is intentionally out of scope: set the unit to `out_of_scope` with a one-line reason in `sync-summary.md` human text. Do not delete the unit; `audit` treats a missing path as a failure.

## Graphify says "no cache"

`graphify` binary present but no `graphify-out/graph.json`. Options:

1. Accept `graphify-fallback` (file/import graph) and say so.
2. Run graphify yourself, then `mapkeeper graph`.
3. Run `mapkeeper init --run-tool` if you want Mapkeeper to call `graphify update` (only with an existing cache).

Never claim graphify was used when only the fallback ran.

## A spec requirement has no task

This is a real finding, not a Mapkeeper bug. Fix the spec/tasks, or accept the gap in the summary. `audit` exits 1 until a `satisfies_requirement` edge exists.

## Security findings are stale

The run's `source_ref` no longer matches the repository and an affected file changed. Re-run the audit, or accept `stale_source: true` knowingly. Never upgrade `needs_validation` to `confirmed` by hand.

## Non-git directory

`source_revision` is `worktree`; `sync` cannot diff, so it rescans all files and marks every path unit `stale` before remapping. That is expected. Reports will show the coverage after remap, not a delta.

## Migrating an old map

```bash
node scripts/mapkeeper.mjs migrate
node scripts/mapkeeper.mjs doctor
```

`migrate` copies the five artifacts into `project-map/.backup-v1/`, maps legacy `type`/`relationship_type`, skips unknown relations with warnings, writes schema v2, seeds the ledger, and regenerates the vault and exports. `doctor --migrate` does the same when a v1 tree is detected. Old `Mapkeeper_Prompt.md` users: the prompt is a deprecated wrapper over this skill; keep it if you like, but the CLI is authoritative.

## Notes were deleted unexpectedly

Only `--prune` deletes notes, and only mapkeeper-managed notes whose content outside managed blocks is empty. If human notes were lost, restore from version control; Mapkeeper never writes outside blocks.

## Nothing happens on `sync`

No changed files and no stale units. Check `--dir` points at the repository root, and that files are tracked (or the directory is not a git repo — then a full rescan runs).