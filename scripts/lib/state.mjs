import path from "node:path";
import { ensureDir, exists, readJsonSafe, writeJson, writeText } from "./fs-utils.mjs";
import { detectProviders } from "./detect.mjs";

const IGNORE = "*\n!.gitignore\n";

export function stateDir(cwd) {
  return path.join(cwd, ".mapkeeper");
}

export function statePath(cwd) {
  return path.join(stateDir(cwd), "state.json");
}

export function loadState(cwd) {
  return readJsonSafe(statePath(cwd));
}

export function saveState(cwd, state) {
  const dir = stateDir(cwd);
  ensureDir(dir);
  const ignore = path.join(dir, ".gitignore");
  if (!exists(ignore)) writeText(ignore, IGNORE);
  writeJson(statePath(cwd), state);
}

export function refreshState({ cwd, previous = null, runDir = null, write = true }) {
  const state = detectProviders({ cwd, previous, runDir });
  if (write) saveState(cwd, state);
  return state;
}