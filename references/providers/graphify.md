# Graphify provider

Graphify owns the codebase graph. Mapkeeper only detects it, hands off, and reads its native JSON for links.

## Detection

- Skill: `graphify` under `.kilo/skills`, `.agents/skills`, `.claude/skills`, `.github/skills`, or the matching global skill dirs.
- CLI: `graphify --version`.
- Cache: `graphify-out/graph.json`; report `graphify-out/GRAPH_REPORT.md`; vault `graphify-out/obsidian/`.

State records `skill`, `skill_dir`, `cli`, `version`, `cache`, `cache_mtime`, `report`, `obsidian`.

## Handoff

Invoke the `graphify` skill with the user's arguments. Do not reconstruct its commands.

| Intent | Handoff |
| --- | --- |
| Build | `/graphify` (or `/graphify <path>`) |
| Update | `/graphify <path> --update` — prefer when a cache exists |
| Query | `/graphify query "<question>"` (`--dfs`, `--budget` optional) |
| Path / explanation | `/graphify` skill's `path`/`explain` modes |
| Obsidian | `/graphify <path> --obsidian` (graphify owns the vault) |
| Graph database export | `/graphify <path> --neo4j` or `--falkordb` |
| Agent access | `/graphify <path> --mcp` |

## Rules

- Never project Graphify nodes into a Mapkeeper graph.
- Never write an Obsidian vault, HTML view, or architecture export for Graphify.
- Never run a full build without an explicit request; `--update` is the default suggestion when `graphify-out/graph.json` exists.
- Never claim Graphify ran unless its output parsed.
- If the skill is missing but a cache exists, links can still read the cache; print the install hint for build/query operations.

## Links input

`graphify-out/graph.json` nodes with `id` and `source_file`. Mapkeeper maps normalized relative file paths to node IDs for `finding_file` links. It does not use labels, communities, or inferred edges.