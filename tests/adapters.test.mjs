import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "../scripts/lib/fs-utils.mjs";
import { mergeGraph, projectGraphify, scanSourceGraph } from "../scripts/lib/graphify.mjs";
import { ingestSpeckit } from "../scripts/lib/speckit.mjs";
import { ingestSecurity } from "../scripts/lib/security.mjs";
import { buildContextNote } from "../scripts/lib/context.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = (...parts) => path.join(HERE, "fixtures", ...parts);

test("deterministic scan creates file nodes and resolves relative imports", () => {
  const graph = scanSourceGraph({ cwd: fixture("scan") });
  const ids = graph.nodes.map((node) => node.id);
  assert.ok(ids.includes("file_src_index"));
  assert.ok(ids.includes("file_src_auth_session"));
  assert.ok(ids.includes("dependency_express"));
  const edge = graph.edges.find(
    (candidate) => candidate.source === "file_src_index" && candidate.target === "file_src_auth_session",
  );
  assert.equal(edge.relation, "references");
  assert.equal(edge.confidence, "EXTRACTED");
});

test("graphify projection preserves ids and rejects unknown relations", () => {
  const raw = readJson(fixture("graphify.raw.json"));
  const projected = projectGraphify(raw, { cwd: "/repo" });
  assert.equal(projected.nodes.length, 2);
  assert.deepEqual(projected.nodes.map((node) => node.id).sort(), ["docs_design", "src_auth_session_validatetoken"]);
  assert.equal(projected.nodes[0].derivation, "graphify");
  assert.equal(projected.edges.length, 1);
  assert.equal(projected.edges[0].relation, "conceptually_related_to");
  assert.match(projected.warnings.join("\n"), /unmapped relation "teleports_to"/);
});

test("spec-kit ingestion produces traceable requirements, tasks and gaps", () => {
  const cwd = fixture("speckit");
  const result = ingestSpeckit({ cwd });
  assert.equal(result.feature_dir, "specs/001-demo");
  const ids = result.nodes.map((node) => node.id);
  assert.ok(ids.includes("spec_001-demo_fr-001"));
  assert.ok(ids.includes("spec_001-demo_t001"));
  assert.ok(ids.includes("spec_001-demo_goal_1"));
  assert.ok(ids.includes("spec_001-demo_constraint_security_first"));

  const edge = result.edges.find(
    (edge) => edge.source === "spec_001-demo_t001" && edge.target === "spec_001-demo_fr-001",
  );
  assert.equal(edge.relation, "satisfies_requirement");
  assert.equal(edge.confidence, "EXTRACTED");
  assert.match(result.gaps.join("\n"), /FR-002 has no task/);
  assert.match(result.gaps.join("\n"), /missing file src\/auth.md/);

  const requirementUnit = result.units.find((unit) => unit.id === "req_001-demo_fr-001");
  assert.equal(requirementUnit.kind, "requirement");
  assert.deepEqual(requirementUnit.node_ids, ["spec_001-demo_fr-001"]);
});

test("security ingestion keeps verdict semantics and drops rejected candidates", () => {
  const result = ingestSecurity({ cwd: fixture("security"), runDir: ".", revision: "abc123" });
  const findings = result.nodes.filter((node) => node.kind === "finding");
  assert.equal(findings.length, 2);
  const confirmed = findings.find((node) => node.verdict === "confirmed");
  const needsValidation = findings.find((node) => node.verdict === "needs_validation");
  assert.equal(confirmed.severity, "high");
  assert.equal(confirmed.status, "confirmed");
  assert.equal(needsValidation.status, "needs_validation");
  assert.equal(needsValidation.severity, undefined);
  assert.equal(result.counts.rejected, 1);
  assert.equal(result.nodes.filter((node) => node.kind === "trust_boundary").length, 2);
  assert.equal(result.stale, false);
});

test("mergeGraph retains lifecycle nodes and their edges across sync", () => {
  const existing = {
    nodes: [
      { id: "sec_f1", kind: "finding", label: "F", status: "confirmed", derivation: "security", source_refs: ["a.md"], severity: "low" },
      { id: "spec_fr", kind: "requirement", label: "FR", status: "planned", derivation: "speckit", spec_refs: ["s.md#FR-1"] },
      { id: "file_a", kind: "file", label: "a", status: "implemented", derivation: "llm", source_refs: ["a.md"] },
    ],
    edges: [
      { source: "sec_f1", target: "file_a", relation: "affects", confidence: "EXTRACTED", confidence_score: 1, derivation: "security", source_refs: ["a.md"] },
      { source: "file_a", target: "spec_fr", relation: "references", confidence: "EXTRACTED", confidence_score: 1, derivation: "llm", source_refs: ["a.md"] },
    ],
  };
  const rescanned = {
    nodes: [{ id: "file_a", kind: "file", label: "a", status: "implemented", derivation: "llm", source_refs: ["a.md"] }],
    edges: [],
  };
  const kept = mergeGraph(existing, rescanned, { changedFiles: ["a.md"], stripDerivations: [] });
  assert.ok(kept.nodes.some((node) => node.id === "sec_f1"));
  assert.ok(kept.edges.some((edge) => edge.source === "sec_f1"));
  assert.ok(kept.nodes.some((node) => node.id === "file_a"));

  const stripped = mergeGraph(existing, rescanned, { changedFiles: ["a.md"], stripDerivations: ["security"] });
  assert.ok(!stripped.nodes.some((node) => node.id === "sec_f1"));
  assert.ok(!stripped.edges.some((edge) => edge.source === "sec_f1"));
});

test("context note stays within budget and carries required frontmatter", () => {
  const graph = {
    meta: { project_name: "demo", phase: "DURING", source_revision: "abc123", generated_at: "2026-01-01", graphify: { available: false } },
    nodes: [
      { id: "g", kind: "goal", label: "Ship it", status: "planned", derivation: "speckit" },
      { id: "c", kind: "component", label: "API", status: "implemented", derivation: "graphify", summary: "x".repeat(2000) },
    ],
    edges: [],
    coverage: { units_total: 1, mapped: 1, stale: 0, unmapped: 0, out_of_scope: 0 },
  };
  const note = buildContextNote({ graph, ledger: { units: [] }, target: 1500, max: 400 });
  assert.ok(note.length / 4 <= 400);
  assert.match(note, /budget_tokens: 1500/);
  assert.match(note, /project: "demo"/);
});