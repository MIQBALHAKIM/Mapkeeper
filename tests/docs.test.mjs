import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readText } from "../scripts/lib/fs-utils.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readText(path.join(ROOT, file), "");

const MODES = ["init", "sync", "audit", "full", "export", "context", "graph", "specs", "security", "doctor", "migrate", "query"];

test("SKILL.md exposes the no-argument Start here menu", () => {
  const skill = read("SKILL.md");
  assert.match(skill, /## Start here/);
  assert.match(skill, /Only show this menu when the invocation has no task or arguments/);
  assert.match(skill, /Recommend \*\*Create\*\* when it is absent/);
  assert.match(skill, /5 Export docs/);
  assert.match(skill, /6 Import context/);
  assert.match(skill, /7 Ask or maintain/);
  for (const mode of MODES) {
    assert.match(skill, new RegExp(`\\b${mode}\\b`), `SKILL.md menu is missing ${mode}`);
  }
});

test("/mapkeeper command routes arguments and defers to the SKILL menu", () => {
  const command = read("command/mapkeeper.md");
  assert.match(command, /^---\n[\s\S]*?description:/);
  assert.match(command, /\$ARGUMENTS/);
  assert.match(command, /Start here/);
  assert.match(command, /skip the menu/i);
  assert.match(command, /question/);
});

test("every menu mode exists in the CLI switch", () => {
  const cli = read("scripts/mapkeeper.mjs");
  for (const mode of MODES) {
    assert.match(cli, new RegExp(`case "${mode}":`), `CLI is missing mode ${mode}`);
  }
});

test("command reference documents the menu and install path", () => {
  const commands = read("references/commands.md");
  assert.match(commands, /## Menu \(`\/mapkeeper`\)/);
  assert.match(commands, /~\/\.config\/kilo\/command\/mapkeeper\.md/);
  assert.match(commands, /state-aware/);
});