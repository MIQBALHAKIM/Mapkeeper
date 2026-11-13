import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectLegacy, detectProviders } from "../scripts/lib/detect.mjs";
import { loadState, refreshState, statePath } from "../scripts/lib/state.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures");

function copyFixture(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mapkeeper-"));
  fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

test("detects graphify, spec-kit, and security-audit from native artifacts", () => {
  const cwd = path.join(FIXTURES, "router");
  const state = detectProviders({ cwd });
  assert.equal(state.providers.graphify.cache, "graphify-out/graph.json");
  assert.equal(state.providers.graphify.skill, true);
  assert.equal(state.providers.speckit.initialized, true);
  assert.equal(state.providers.speckit.feature_dir, "specs/001-auth");
  assert.equal(state.providers.speckit.commands_dir, ".kilo/commands");
  assert.deepEqual(state.providers.speckit.commands, ["speckit.plan", "speckit.specify"]);
  assert.equal(state.providers.security.skill, true);
  assert.equal(state.legacy.project_map, false);
});

test("records the last security run and its metadata", () => {
  const cwd = path.join(FIXTURES, "router");
  const state = detectProviders({ cwd, runDir: "runs/run-1" });
  assert.equal(state.providers.security.run_id, "run-1");
  assert.equal(state.providers.security.run_status, "complete");
  assert.equal(state.providers.security.findings, 4);
  assert.equal(state.providers.security.source_ref, "abc123");
});

test("detects a legacy project-map tree without failing", () => {
  const legacy = detectLegacy(path.join(FIXTURES, "legacy"));
  assert.deepEqual(legacy, { project_map: true, schema_version: 2 });
});

test("status writes local state with a self-ignoring .gitignore", () => {
  const cwd = copyFixture("router");
  const state = refreshState({ cwd, write: true });
  assert.ok(fs.existsSync(statePath(cwd)));
  assert.equal(fs.readFileSync(path.join(cwd, ".mapkeeper", ".gitignore"), "utf8"), "*\n!.gitignore\n");
  const saved = loadState(cwd);
  assert.equal(saved.schema_version, 1);
  assert.equal(saved.providers.speckit.feature_dir, "specs/001-auth");
  assert.ok(saved.observed_at);
});