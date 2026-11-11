import fs from "node:fs";
import path from "node:path";
import { ensureDir, exists, readJson, today, writeJson } from "./fs-utils.mjs";

const KINDS = new Set([
  "project", "goal", "requirement", "stakeholder", "user_role", "feature", "task", "milestone",
  "component", "module", "service", "file", "folder", "api", "database", "data_entity", "workflow",
  "decision", "risk", "issue", "assumption", "dependency", "deployment_target", "environment",
  "test", "document", "constraint", "deliverable",
]);

const RELATIONS = new Set([
  "depends_on", "implements", "relates_to", "produces", "consumes", "manages", "decides", "blocks",
  "supports", "documents", "tests", "deploys_to", "risks_affect", "satisfies_requirement",
]);

export function migrateGraph({ graphFile, outDir }) {
  const legacy = readJson(graphFile);
  if (legacy.schema_version === 2) return { migrated: false, reason: "already schema v2" };

  const backupDir = path.join(outDir, ".backup-v1");
  ensureDir(backupDir);
  for (const name of ["graph.json", "architecture-overview.md", "architecture-overview.json", "architecture-overview.html", "sync-summary.md"]) {
    const src = path.join(outDir, name);
    if (exists(src)) fs.cpSync(src, path.join(backupDir, name));
  }

  const warnings = [];
  const nodes = (legacy.nodes || []).map((node, index) => {
    const kind = KINDS.has(node.type) ? node.type : node.type === "user" ? "stakeholder" : "component";
    const refs = Array.isArray(node.source_refs) ? node.source_refs : [];
    return {
      id: node.id || `migrated_node_${index}`,
      kind,
      label: node.name || node.label || node.id || `node_${index}`,
      summary: node.summary || "",
      status: ["planned", "implemented", "unknown", "deprecated"].includes(node.status) ? node.status : "unknown",
      phase: ["BEFORE", "DURING", "END"].includes(node.phase) ? node.phase : legacy.meta?.phase || "DURING",
      confidence: ["low", "medium", "high"].includes(node.confidence) ? node.confidence : "medium",
      derivation: /tool/.test(legacy.meta?.generator || "") ? "graphify" : "llm",
      provenance: { source_file: refs[0] || null, source_location: null, relation_source: refs.length ? "EXTRACTED" : "INFERRED" },
      spec_refs: [],
      source_refs: refs,
      tags: Array.isArray(node.tags) ? node.tags : [],
      last_verified: { revision: legacy.meta?.source_revision || "unknown", date: node.last_updated || today() },
    };
  });

  const edges = [];
  for (const edge of legacy.edges || []) {
    const relation = RELATIONS.has(edge.relationship_type) ? edge.relationship_type : null;
    if (!relation) {
      warnings.push(`skipped legacy edge ${edge.source} -> ${edge.target} with relation ${edge.relationship_type}`);
      continue;
    }
    edges.push({
      source: edge.source,
      target: edge.target,
      relation,
      confidence: edge.confidence === "high" ? "EXTRACTED" : edge.confidence === "medium" ? "INFERRED" : "AMBIGUOUS",
      confidence_score: edge.confidence === "high" ? 1 : edge.confidence === "medium" ? 0.85 : 0.25,
      derivation: "llm",
      summary: edge.summary || "",
      source_refs: Array.isArray(edge.source_refs) ? edge.source_refs : [],
      last_updated: edge.last_updated || today(),
    });
  }

  const migrated = {
    schema_version: 2,
    meta: {
      project_name: legacy.meta?.project_name || "unknown",
      phase: legacy.meta?.phase || "DURING",
      update_mode: "FULL",
      generated_at: new Date().toISOString(),
      source_revision: legacy.meta?.source_revision || "migrated",
      graphify: { available: /tool/.test(legacy.meta?.generator || ""), version: null, graph_path: null },
      counts: { nodes: nodes.length, edges: edges.length, by_derivation: countBy(nodes) },
      assumptions: legacy.meta?.assumptions || [],
      unknowns: legacy.meta?.unknowns || [],
      migrated_from: "schema-v1",
    },
    nodes,
    edges,
    hyperedges: [],
    coverage: { units_total: 0, mapped: 0, stale: 0, unmapped: 0, out_of_scope: 0 },
  };
  writeJson(graphFile, migrated);
  return { migrated: true, warnings, backupDir };
}

function countBy(nodes) {
  const out = {};
  for (const node of nodes) out[node.derivation] = (out[node.derivation] || 0) + 1;
  return out;
}