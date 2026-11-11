# Spec-kit adapter

Read-only integration with [github/spec-kit](https://github.com/github/spec-kit). Spec-kit is optional; Mapkeeper works without `.specify/`.

## Detection

1. `.specify/` exists → spec-kit project.
2. Active feature directory from `.specify/feature.json` (keys `feature_directory`, `feature_dir`, `directory`, `path`, `feature`); fall back to the newest `specs/*/` containing `spec.md`.
3. Read `.specify/memory/constitution.md` when present.

Never create, edit, or delete anything under `.specify/`. Mapkeeper only reads it.

## Artifact mapping

| Artifact | Node kind | Id |
| --- | --- | --- |
| `constitution.md` headings | `constraint` | `spec_<feature>_constraint_<slug>` |
| `spec.md` `FR-###`, `NFR-###`, `SR-###`, `CR-###` | `requirement` | `spec_<feature>_fr-001` |
| `spec.md` `### User Story N` | `goal` | `spec_<feature>_goal_N` |
| `plan.md` `###` headings under Project Structure | `component` | `spec_<feature>_component_<slug>` |
| `plan.md` `**Decision**:` lines | `decision` | `spec_<feature>_decision_<slug>` |
| `tasks.md` `- [ ] T###` | `task` | `spec_<feature>_t001` |

Edges:

| From | Relation | To | Evidence |
| --- | --- | --- | --- |
| task | `satisfies_requirement` | requirement mentioned in the task line | `tasks.md#T001` |
| task | `implements` | file path mentioned and existing | `tasks.md#T001` |

Every spec-kit node carries `derivation: "speckit"` and `spec_refs: ["<path>#<id>"]`. Source refs stay empty unless a task names a real file.

## Traceability report

`mapkeeper specs` and every `init|sync` write these gaps into `sync-summary.md` and `architecture-overview.md`:

1. Requirement with no task referencing it.
2. Task referencing a file path that does not exist.
3. Requirement with a task but no `implements` edge to code (when a file is named).
4. Checklist items left unchecked (reported, not enforced).

Gap text must name ids, not vague areas: `FR-002 has no task referencing it`.

## Requirement units

Each requirement also becomes a `map-ledger.json` unit:

```json
{
  "id": "req_001-auth_fr-001",
  "kind": "requirement",
  "scope": "specs/001-auth/spec.md#FR-001",
  "status": "mapped",
  "node_ids": ["spec_001-auth_fr-001"],
  "evidence": ["project-map/graph.json#nodes"]
}
```

`audit` fails when a requirement unit has no satisfying task or code edge. This is Mapkeeper's equivalent of `/speckit-analyze`, but evidence-based.

## Extension packaging

`spec-kit-extension/` is an optional installable extension:

```bash
specify extension add --dev /path/to/Mapkeeper/spec-kit-extension
```

Manifest highlights (`extension.yml`, schema_version `1.0`):

- id `mapkeeper`; commands `speckit.mapkeeper.init`, `speckit.mapkeeper.sync`, `speckit.mapkeeper.audit`; files in `commands/`.
- hooks `after_tasks` and `after_implement`, `optional: true`, so users opt in after `/speckit-tasks` and `/speckit-implement`.
- no `requires.tools`; graphify and security-audit stay optional.

The commands call the repository-local CLI (`node scripts/mapkeeper.mjs …`) when Mapkeeper is vendored, or instruct the agent to run the skill when it is installed globally. They never edit spec-kit artifacts.

## Failure handling

| Symptom | Behavior |
| --- | --- |
| `.specify/feature.json` invalid | fall back to newest `specs/*`, warn |
| No spec.md/plan.md/tasks.md | warn; no nodes invented |
| Duplicate requirement ids | first occurrence wins, warn |
| Task references a missing file | gap, not a node |
| `.specify/` unreadable | continue without spec-kit, record in warnings |