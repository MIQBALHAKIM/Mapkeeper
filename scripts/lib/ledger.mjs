import path from "node:path";
import { execFileSync } from "node:child_process";
import { exists, readJson, sanitizeId, sourceRevision, today, writeJson } from "./fs-utils.mjs";
import { listMappableFiles } from "./graphify.mjs";

export function loadLedger(file) {
  return exists(file) ? readJson(file) : null;
}

export function saveLedger(file, ledger) {
  writeJson(file, ledger);
}

export function seedLedger({ cwd = process.cwd(), revision = sourceRevision(cwd), existing = null } = {}) {
  const files = listMappableFiles(cwd);
  const scopes = new Map();
  for (const file of files) {
    if (!file.includes("/")) {
      scopes.set("<root>", "<root>");
      continue;
    }
    const top = file.split("/")[0];
    scopes.set(top, `${top}/**`);
  }
  const units = [];
  for (const [key, scope] of scopes) {
    const id = key === "<root>" ? "root" : `path_${sanitizeId(key)}`;
    const previous = existing?.units?.find((unit) => unit.id === id);
    units.push(
      previous || {
        id,
        kind: "path",
        scope,
        status: "unmapped",
        node_ids: [],
        evidence: [],
      },
    );
  }
  const kept = (existing?.units || []).filter(
    (unit) => unit.kind !== "path" && !units.some((u) => u.id === unit.id),
  );
  return {
    schema_version: 1,
    source_revision: revision,
    units: [...units, ...kept],
    runs: existing?.runs || [],
  };
}

export function changedFiles(cwd = process.cwd(), sinceRevision = null) {
  const files = new Set();
  let gitAvailable = false;
  try {
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    gitAvailable = true;
    for (const line of status.split("\n")) {
      const file = line.slice(3).trim();
      if (file) files.add(file.includes(" -> ") ? file.split(" -> ")[1] : file);
    }
  } catch {
    /* not a git repo: fall back to a full rescan */
    return listMappableFiles(cwd);
  }
  if (gitAvailable && sinceRevision && /^[0-9a-f]{4,40}/.test(sinceRevision)) {
    const base = sinceRevision.replace(/-dirty$/, "");
    try {
      const diff = execFileSync("git", ["diff", "--name-only", base, "--"], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of diff.split("\n")) if (line.trim()) files.add(line.trim());
    } catch {
      /* revision unknown, keep worktree status */
    }
  }
  return [...files].sort();
}

export function markChanged(ledger, files) {
  for (const unit of ledger.units) {
    if (unit.status === "out_of_scope") continue;
    if (files.some((file) => matchesScope(unit.scope, file))) unit.status = "stale";
  }
  return ledger;
}

export function applyCoverage(ledger, graph, revision, { graphRef = "project-map/graph.json" } = {}) {
  const nodeByRef = new Map();
  for (const node of graph.nodes) {
    for (const ref of node.source_refs || []) {
      const file = ref.split("#")[0].split(":")[0];
      if (!file) continue;
      if (!nodeByRef.has(file)) nodeByRef.set(file, new Set());
      nodeByRef.get(file).add(node.id);
    }
  }
  for (const unit of ledger.units) {
    if (unit.kind !== "path" || unit.status === "out_of_scope") continue;
    const ids = new Set();
    for (const [file, nodeIds] of nodeByRef) {
      if (!matchesScope(unit.scope, file)) continue;
      for (const id of nodeIds) ids.add(id);
    }
    if (ids.size) {
      unit.status = "mapped";
      unit.node_ids = [...ids].sort().slice(0, 100);
      unit.evidence = [`${graphRef}#nodes`];
      unit.last_verified_revision = revision;
      unit.last_verified_date = today();
    } else if (unit.status !== "stale") {
      unit.status = "unmapped";
      unit.node_ids = [];
      unit.evidence = [];
    }
  }
  ledger.source_revision = revision;
  return ledger;
}

export function upsertUnits(ledger, units) {
  for (const unit of units) {
    const index = ledger.units.findIndex((u) => u.id === unit.id);
    if (index >= 0) ledger.units[index] = { ...ledger.units[index], ...unit };
    else ledger.units.push(unit);
  }
  return ledger;
}

export function recordRun(ledger, { mode, revision, startedAt, counts = {}, artifacts = [] }) {
  ledger.runs = ledger.runs || [];
  ledger.runs.push({
    mode,
    revision,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    counts,
    artifacts,
  });
  if (ledger.runs.length > 50) ledger.runs = ledger.runs.slice(-50);
  return ledger;
}

export function coverageFromLedger(ledger) {
  const counts = { units_total: ledger.units.length, mapped: 0, stale: 0, unmapped: 0, out_of_scope: 0 };
  for (const unit of ledger.units) {
    counts[unit.status] = (counts[unit.status] || 0) + 1;
  }
  return counts;
}

export function auditLedger(ledger, { cwd = process.cwd(), graph = null } = {}) {
  const failures = [];
  const warnings = [];

  const files = listMappableFiles(cwd);
  const covered = new Set();
  for (const unit of ledger.units) {
    if (unit.status === "out_of_scope") continue;
    for (const file of files) if (matchesScope(unit.scope, file)) covered.add(file);
  }
  const hasRootUnit = ledger.units.some((unit) => unit.scope === "<root>" && unit.status !== "out_of_scope");
  const uncovered = files.filter((file) => !covered.has(file) && !(hasRootUnit && !file.includes("/")));
  if (uncovered.length) {
    warnings.push(`${uncovered.length} root files are not covered by a ledger unit`);
  }

  for (const unit of ledger.units) {
    if (unit.status === "unmapped" && unit.kind === "path") {
      warnings.push(`unit ${unit.id} (${unit.scope}) is unmapped`);
    }
    if (unit.status === "stale") warnings.push(`unit ${unit.id} (${unit.scope}) is stale`);
    if (unit.kind === "requirement" && unit.status !== "out_of_scope") {
      const hasTask = graph?.edges?.some(
        (edge) => edge.relation === "satisfies_requirement" && edge.target === unit.node_ids[0],
      );
      if (!hasTask) failures.push(`requirement unit ${unit.id} has no satisfying task or code edge`);
    }
  }

  const nodeIds = new Set((graph?.nodes || []).map((node) => node.id));
  for (const unit of ledger.units) {
    for (const id of unit.node_ids || []) {
      if (!nodeIds.has(id)) warnings.push(`unit ${unit.id} references missing node ${id}`);
    }
  }
  return { failures, warnings };
}

export function matchesScope(scope, file) {
  if (scope === "<root>") return !file.includes("/");
  if (scope.endsWith("/**")) return file === scope.slice(0, -3) || file.startsWith(`${scope.slice(0, -3)}/`);
  return file === scope;
}

export function relativeOut(cwd, file) {
  return path.relative(cwd, file).replace(/\\/g, "/");
}