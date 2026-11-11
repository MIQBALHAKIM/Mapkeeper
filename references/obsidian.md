# Obsidian vault

The vault is a normal Obsidian vault: open `project-map/obsidian-vault/` directly.

## Layout

```text
obsidian-vault/
├── 00-Home.md                 # generated hubs (managed blocks)
├── 01-Index.md                # every node grouped by kind
├── 02-LLM-Context.md          # ≤1500 tokens, regenerated whole
├── 10-Architecture/overview.md
├── 20-Components/             # component, module, service, feature
├── 30-Requirements/
├── 40-Decisions/
├── 50-Tasks/                  # task, milestone
├── 60-Risks-Issues/           # risk, issue, finding, trust_boundary, control
├── 70-Data/                   # database, data_entity, api, workflow
├── 80-Resources/              # file, document, dependency
└── 90-Meta/                   # project, goal, stakeholder, constraint, ...
```

## Note contract

Filename = node id with `:` and `/` replaced by `-`. Wikilinks therefore resolve without aliases: `[[file_src_auth_session]]`.

Each node note is:

```markdown
---
id: "file_src_auth_session"
kind: "file"
label: "session.js"
status: "implemented"
phase: "DURING"
confidence: "high"
derivation: "graphify"
severity: "high"          # confirmed findings only
verdict: "confirmed"      # findings only
managed_by: "mapkeeper"
tags: ["security"]
source_refs: ["src/auth/session.js"]
spec_refs: []
last_verified: "2026-11-11 abc123"
---

# session.js

<!-- mapkeeper:begin id=summary -->
...
<!-- mapkeeper:end id=summary -->

<!-- mapkeeper:begin id=relationships -->
**Outgoing**
- affects → [[file_src_index|index.js]]
<!-- mapkeeper:end id=relationships -->

<!-- mapkeeper:begin id=evidence -->
- `src/auth/session.js`
<!-- mapkeeper:end id=evidence -->

## Notes

_Add human notes here; Mapkeeper never edits this section._
```

Rules:

- Managed blocks are replaced on every run; text outside them, including `## Notes`, is preserved.
- Mapkeeper keeps `## Notes` as the last section so generated content never buries human writing.
- Never delete a note with human notes. `--prune` only removes mapkeeper-managed notes whose outside-block content is empty.
- Frontmatter is regenerated; do not store human data there (put it in `## Notes`).

## Hub notes

- `00-Home.md`: overview, key components, risks/findings, coverage counts. Blocks: `overview`, `components`, `risks`, `coverage`.
- `01-Index.md`: block `index`, grouped by kind with status.
- `10-Architecture/overview.md`: blocks `summary`, `diagram` (Mermaid, top 30 nodes, `contains` edges omitted).

Add human sections freely outside blocks. Do not rename block ids; the writer will append duplicates.

## Context note

`02-LLM-Context.md` is fully generated and budget-enforced. It is the first file any later agent should read. If it exceeds the budget, move detail into a component note and link it — do not trim the frontmatter.

## Orphan and link hygiene

- `mapkeeper doctor` reports unresolved wikilinks and coverage gaps.
- Deleting a node from the graph does not delete its note immediately; run `init|sync --prune` to remove orphaned mapkeeper-managed notes.
- Never point wikilinks at files outside the vault.
- For large vaults, keep node notes short; the graph is the index, notes are for humans.