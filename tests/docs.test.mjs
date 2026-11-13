import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readText } from "../scripts/lib/fs-utils.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readText(path.join(ROOT, file), "");
const exists = (file) => fs.existsSync(path.join(ROOT, file));

test("SKILL.md is a router menu with three providers", () => {
  const skill = read("SKILL.md");
  assert.match(skill, /## Start here/);
  for (const choice of [
    "Map codebase",
    "Spec-driven work",
    "Security review",
    "Combine outputs",
    "Status & health",
  ]) {
    assert.match(skill, new RegExp(choice.replace("&", "&")), `missing menu choice: ${choice}`);
  }
  assert.match(skill, /Graphify/);
  assert.match(skill, /spec-kit/);
  assert.match(skill, /security-audit/);
  assert.match(skill, /Never reimplement a provider/);
  assert.match(skill, /handoff/i);
});

test("/mapkeeper command supports provider passthrough", () => {
  const command = read("command/mapkeeper.md");
  assert.match(command, /^---\n[\s\S]*?description:/);
  assert.match(command, /\$ARGUMENTS/);
  assert.match(command, /Start here/);
  for (const route of ["map", "spec", "security", "links", "status"]) {
    assert.match(command, new RegExp(route), `missing route: ${route}`);
  }
  assert.match(command, /do not read or execute the command template/i);
});

test("CLI exposes only status, links, and help", () => {
  const cli = read("scripts/mapkeeper.mjs");
  for (const command of ["status", "links", "help"]) {
    assert.match(cli, new RegExp(`case "${command}":`), `missing CLI command: ${command}`);
  }
  for (const removed of ["init", "sync", "audit", "full", "export", "context", "graph", "specs", "security", "migrate", "query"]) {
    assert.doesNotMatch(cli, new RegExp(`case "${removed}":`), `removed v2 command still present: ${removed}`);
  }
});

test("router references exist and v2 artifacts are gone", () => {
  for (const file of [
    "references/providers/graphify.md",
    "references/providers/speckit.md",
    "references/providers/security.md",
    "references/commands.md",
    "references/links.md",
    "references/status.md",
    "references/troubleshooting.md",
  ]) {
    assert.ok(exists(file), `missing reference: ${file}`);
  }
  for (const removed of ["schema", "spec-kit-extension", "Mapkeeper_Prompt.md", "examples"]) {
    assert.equal(exists(removed), false, `v2 asset still present: ${removed}`);
  }
});

test("package metadata describes v3", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.version, "3.0.0");
  assert.equal(pkg.bin.mapkeeper, "scripts/mapkeeper.mjs");
  assert.ok(pkg.files.includes("command/"));
  assert.ok(!pkg.files.includes("schema/"));
});