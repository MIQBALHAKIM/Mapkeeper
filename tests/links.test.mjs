import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLinks, linksBlocking, renderLinksMarkdown, writeLinks } from "../scripts/lib/links.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures");

function copyFixture(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mapkeeper-links-"));
  fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

test("links findings, requirements, tasks, files, and graph nodes", () => {
  const cwd = path.join(FIXTURES, "router");
  const report = buildLinks({ cwd, runDir: "runs/run-1" });

  assert.equal(report.schema_version, 1);
  assert.equal(report.inputs.graphify.present, true);
  assert.equal(report.inputs.graphify.nodes, 2);
  assert.equal(report.inputs.speckit.feature_dir, "specs/001-auth");
  assert.equal(report.inputs.speckit.requirements, 3);
  assert.equal(report.inputs.speckit.tasks, 2);
  assert.equal(report.inputs.security.run_id, "run-1");
  assert.equal(report.inputs.security.findings, 4);
  assert.deepEqual(report.inputs.security.verdicts, {
    confirmed: 3,
    needs_validation: 1,
    rejected: 1,
  });

  assert.equal(report.counts.links, 11);
  assert.equal(report.counts.unresolved, 5);

  const findingFile = report.links.find((link) => link.type === "finding_file" && link.from === "fp1");
  assert.equal(findingFile.to, "src/auth/session.js");
  assert.deepEqual(findingFile.graph_node_ids, ["src_auth_session"]);
  assert.equal(findingFile.severity, "high");

  const needsValidation = report.links.find((link) => link.type === "finding_file" && link.from === "fp2");
  assert.equal(needsValidation.verdict, "needs_validation");
  assert.equal(needsValidation.severity, null);

  assert.ok(!report.links.some((link) => link.from === "fp3"), "rejected finding must not be linked");
  assert.ok(report.links.some((link) => link.type === "finding_requirement" && link.from === "fp1" && link.to === "FR-001"));
  assert.ok(report.links.some((link) => link.type === "requirement_task" && link.from === "FR-001" && link.to === "T001"));
  assert.ok(report.links.some((link) => link.type === "task_file" && link.from === "T001" && link.to === "src/auth/session.js"));
  assert.ok(report.links.some((link) => link.type === "requirement_file" && link.from === "FR-001" && link.to === "src/auth/session.js"));

  const kinds = report.unresolved.map((item) => item.kind);
  assert.ok(kinds.includes("finding_no_file"));
  assert.ok(kinds.includes("finding_no_graph_node"));
  assert.ok(kinds.includes("finding_unknown_requirement"));
  assert.ok(kinds.includes("requirement_no_task"));
  assert.ok(kinds.includes("task_missing_file"));
  assert.equal(linksBlocking(report), true);
});

test("partial links skip security without inventing results", () => {
  const report = buildLinks({
    cwd: path.join(FIXTURES, "router"),
    runDir: "runs/run-1",
    includeSecurity: false,
  });
  assert.equal(report.inputs.security.present, false);
  assert.equal(report.inputs.security.skipped, true);
  assert.equal(report.counts.findings, 0);
  assert.equal(report.counts.links, 6);
  assert.equal(report.counts.unresolved, 2);
});

test("malformed graph is reported as blocking", () => {
  const cwd = copyFixture("router");
  fs.writeFileSync(path.join(cwd, "graphify-out", "graph.json"), "{ not json");
  const report = buildLinks({ cwd, runDir: "runs/run-1" });
  assert.equal(report.inputs.graphify.valid, false);
  assert.ok(report.unresolved.some((item) => item.kind === "invalid_graph"));
  assert.equal(linksBlocking(report), true);
});

test("markdown is redacted and local files are written", () => {
  const cwd = copyFixture("router");
  const report = buildLinks({ cwd, runDir: "runs/run-1" });
  const markdown = renderLinksMarkdown(report);
  assert.match(markdown, /# Mapkeeper links/);
  assert.match(markdown, /fp1/);
  assert.doesNotMatch(markdown, /SQL injection/);
  assert.doesNotMatch(markdown, /Secret path/);
  assert.doesNotMatch(markdown, new RegExp(cwd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const written = writeLinks({ cwd, report, out: "published-links.md" });
  assert.ok(fs.existsSync(written.json));
  assert.ok(fs.existsSync(written.md));
  assert.ok(fs.existsSync(path.join(cwd, "published-links.md")));
  assert.equal(fs.readFileSync(path.join(cwd, ".mapkeeper", ".gitignore"), "utf8"), "*\n!.gitignore\n");
});