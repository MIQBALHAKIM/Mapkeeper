import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectProviders } from "../scripts/lib/detect.mjs";
import { buildStatus } from "../scripts/lib/status.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures");

function copyFixture(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mapkeeper-status-"));
  fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

test("healthy provider fixture has no check failures", () => {
  const cwd = path.join(FIXTURES, "router");
  const state = detectProviders({ cwd, runDir: "runs/run-1" });
  const result = buildStatus({ cwd, state });
  assert.deepEqual(result.failures, []);
  assert.match(result.human, /Mapkeeper status/);
  assert.match(result.human, /Graphify/);
  assert.match(result.human, /spec-kit/);
  assert.match(result.human, /security/);
});

test("invalid graph and findings are check failures", () => {
  const cwd = copyFixture("router");
  fs.writeFileSync(path.join(cwd, "graphify-out", "graph.json"), "{ bad");
  fs.writeFileSync(path.join(cwd, "runs", "run-1", "findings.json"), "{ bad");
  const state = detectProviders({ cwd, runDir: "runs/run-1" });
  const result = buildStatus({ cwd, state });
  assert.equal(result.failures.length, 2);
  assert.match(result.failures.join("\n"), /graphify cache/);
  assert.match(result.failures.join("\n"), /findings.json/);
});

test("legacy project-map is a warning, not a failure", () => {
  const cwd = path.join(FIXTURES, "legacy");
  const state = detectProviders({ cwd });
  const result = buildStatus({ cwd, state });
  assert.deepEqual(result.failures, []);
  assert.match(result.warnings.join("\n"), /legacy project-map/);
});