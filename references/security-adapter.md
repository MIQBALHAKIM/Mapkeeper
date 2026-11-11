# Security-audit adapter

Read-only integration with [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill). Mapkeeper consumes finished audit artifacts; it does not reimplement the audit methodology.

## Locating the skill and a run

Skill search order (first hit wins):

```text
<project>/.kilo/skills/security-audit/SKILL.md
<project>/.agents/skills/security-audit/SKILL.md
<project>/.github/skills/security-audit/SKILL.md
<project>/.claude/skills/security-audit/SKILL.md
~/.config/kilo/skills/security-audit/SKILL.md
~/.agents/skills/security-audit/SKILL.md
~/.claude/skills/security-audit/SKILL.md
```

Run directory: supplied with `--security-run <dir>` (relative to the project) or as `mapkeeper security <dir>`. A run contains `run-metadata.json`, `architecture.md`, `coverage-ledger.json`, `findings.json`, `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`.

If the skill is not installed, print the install command and stop the audit path:

```bash
npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit
```

Never invent findings, severities, or trust boundaries when the skill or run is missing.

## Invoking an audit

Only when the user explicitly asks to audit or pen-test:

1. Confirm the target and an output directory **outside** the repository (the upstream default is `~/security-audit-skill/<repo>/run-<N>`).
2. Delegate: ask the installed `security-audit` skill to run its full-audit mode against the target.
3. Ingest the resulting run directory with `mapkeeper security <dir>`.

Do not run all six phases yourself, do not copy its `SKILL.md`/companion docs into this repository, and do not relax its sandbox requirements.

## Ingestion mapping

| Input | Mapkeeper output |
| --- | --- |
| `architecture.md` → `## Trust Boundaries` bullets | `trust_boundary` nodes `sec_<run>_tb_<slug>` |
| `findings.json` record `verdict: confirmed` | `finding` node, `status: confirmed`, `severity` from the record |
| `findings.json` record `verdict: needs_validation` | `finding` node, `status: needs_validation`, **no severity** |
| `findings.json` record `verdict: rejected` | counted only (`counts.rejected`), never published |
| record `file` + `line` | `source_refs: ["<file>:<line>"]` |
| record `trust_boundary` | edge `violates` → boundary node |
| record file matching a graph node | edge `affects` → that node |
| record `requirements: ["FR-001"]` | edge `affects` → the matching requirement node |
| `run-metadata.json` `source_ref` | `last_verified.revision`; stale marker when the repo moved |

Ids: `sec_<run-id>_<fingerprint>`; fingerprints are preserved verbatim when present. If a record has no fingerprint or id, hash a sanitized title.

Tolerated `findings.json` shapes: a top-level array, or an object with `findings`, `records`, `results`, or `items`. Unknown shapes produce a warning and zero nodes.

## Severity and verdict rules (non-negotiable)

- Severity exists only for `confirmed`. `needs_validation` has zero severity and is displayed in its own table.
- `rejected` never appears in `graph.json`, the vault, or the architecture export.
- A confirmed finding without a concrete file/line still publishes, but with `source_refs` pointing at `findings.json` and a warning.
- A finding whose run revision is older than a changed affected file is marked `provenance.stale_source: true` and reported in `sync-summary.md`.

## What Mapkeeper adds

- Traceability: findings tied to components and requirements.
- Coverage: a finding's file must also be mapped by a ledger unit; `audit` reports findings in unmapped paths.
- Handover: confirmed and needs-validation findings appear in the architecture overview and the vault, with their original evidence links.

## What Mapkeeper must not do

- Re-run exploit steps, reproduce candidates, or "verify" a finding itself.
- Merge `needs_validation` into confirmed lists to make a report look complete.
- Copy the upstream six-phase workflow, attack classes, or validators into this repository.
- Write into the audit run directory.