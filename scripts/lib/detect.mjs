import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  exists,
  mtimeIso,
  normalizePath,
  now,
  readJsonSafe,
  relativePath,
  sourceRevision,
} from "./fs-utils.mjs";

const PROJECT_SKILL_DIRS = [
  [".kilo", "skills"],
  [".agents", "skills"],
  [".claude", "skills"],
  [".github", "skills"],
];

const GLOBAL_SKILL_DIRS = [
  [".config", "kilo", "skills"],
  [".agents", "skills"],
  [".claude", "skills"],
];

export const SPEC_COMMAND_DIRS = [
  ".kilo/commands",
  ".kilo/command",
  ".claude/commands",
  ".github/prompts",
  ".cursor/commands",
  ".windsurf/workflows",
  ".opencode/command",
  ".gemini/commands",
  ".codex/prompts",
  ".qwen/commands",
];

export function detectProviders({ cwd = process.cwd(), previous = null, runDir = null } = {}) {
  return {
    schema_version: 1,
    observed_at: now(),
    source_revision: sourceRevision(cwd),
    project_root: cwd,
    providers: {
      graphify: detectGraphify(cwd),
      speckit: detectSpeckit(cwd),
      security: detectSecurity(cwd, runDir || previous?.providers?.security?.last_run || null),
    },
    legacy: detectLegacy(cwd),
  };
}

export function detectGraphify(cwd) {
  const skillDir = findSkill(cwd, "graphify");
  const cli = commandInfo("graphify", ["--version"]);
  const cacheRel = "graphify-out/graph.json";
  const cacheAbs = path.join(cwd, cacheRel);
  const cachePresent = exists(cacheAbs);
  const reportAbs = path.join(cwd, "graphify-out", "GRAPH_REPORT.md");
  const obsidianAbs = path.join(cwd, "graphify-out", "obsidian");

  return {
    skill: Boolean(skillDir),
    skill_dir: skillDir ? displayPath(cwd, skillDir) : null,
    cli: cli.available,
    version: cli.version,
    cache: cachePresent ? cacheRel : null,
    cache_mtime: cachePresent ? mtimeIso(cacheAbs) : null,
    report: exists(reportAbs) ? "graphify-out/GRAPH_REPORT.md" : null,
    obsidian: exists(obsidianAbs) ? "graphify-out/obsidian" : null,
  };
}

export function detectSpeckit(cwd) {
  const cli = commandInfo("specify", ["--version"]);
  const initialized = exists(path.join(cwd, ".specify"));
  const featureDir = resolveFeatureDir(cwd);
  const commandInfoResult = findSpecCommands(cwd);
  const hooks = exists(path.join(cwd, ".specify", "extensions.yml"));
  const featureFiles = ["spec.md", "plan.md", "tasks.md"]
    .map((name) => (featureDir ? path.join(cwd, featureDir, name) : null))
    .filter((file) => file && exists(file));
  const mtimes = featureFiles.map(mtimeIso).filter(Boolean).sort();

  return {
    cli: cli.available,
    version: cli.version,
    initialized,
    feature_dir: featureDir,
    feature_mtime: mtimes.length ? mtimes[mtimes.length - 1] : null,
    commands_dir: commandInfoResult.dir,
    commands: commandInfoResult.commands,
    hooks,
  };
}

export function detectSecurity(cwd, lastRun) {
  const skillDir = findSkill(cwd, "security-audit");
  const runDir = lastRun ? path.resolve(cwd, lastRun) : null;
  const result = {
    skill: Boolean(skillDir),
    skill_dir: skillDir ? displayPath(cwd, skillDir) : null,
    last_run: runDir,
    run_status: null,
    findings: 0,
    source_ref: null,
    run_id: null,
  };
  if (!runDir || !exists(runDir)) return result;

  const meta = readJsonSafe(path.join(runDir, "run-metadata.json"));
  const findings = readJsonSafe(path.join(runDir, "findings.json"));
  const records = normalizeFindings(findings);
  result.run_id = meta?.run_id || path.basename(runDir);
  result.run_status = meta?.run_status || null;
  result.source_ref =
    typeof meta?.source_ref === "string" ? meta.source_ref : meta?.source_ref?.commit || null;
  result.findings = records.filter(
    (record) => String(record.verdict || record.status || "").toLowerCase() !== "rejected",
  ).length;
  return result;
}

export function detectLegacy(cwd) {
  const graph = path.join(cwd, "project-map", "graph.json");
  if (!exists(graph)) return { project_map: false, schema_version: null };
  const data = readJsonSafe(graph);
  return { project_map: true, schema_version: data?.schema_version ?? null };
}

export function resolveFeatureDir(cwd) {
  const stateFile = path.join(cwd, ".specify", "feature.json");
  if (exists(stateFile)) {
    const state = readJsonSafe(stateFile);
    for (const key of ["feature_directory", "feature_dir", "directory", "path", "feature"]) {
      if (typeof state?.[key] !== "string") continue;
      const rel = state[key].replace(/^\.\//, "").replace(/\/$/, "");
      if (exists(path.join(cwd, rel, "spec.md"))) return rel;
    }
  }
  const specsDir = path.join(cwd, "specs");
  if (!exists(specsDir)) return null;
  let entries = [];
  try {
    entries = fs
      .readdirSync(specsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => exists(path.join(specsDir, name, "spec.md")))
      .sort()
      .reverse();
  } catch {
    return null;
  }
  return entries.length ? `specs/${entries[0]}` : null;
}

export function findSkill(cwd, name) {
  for (const parts of PROJECT_SKILL_DIRS) {
    const dir = path.join(cwd, ...parts, name);
    if (exists(path.join(dir, "SKILL.md"))) return dir;
  }
  for (const parts of GLOBAL_SKILL_DIRS) {
    const dir = path.join(os.homedir(), ...parts, name);
    if (exists(path.join(dir, "SKILL.md"))) return dir;
  }
  return null;
}

export function findSpecCommands(cwd) {
  for (const rel of SPEC_COMMAND_DIRS) {
    const dir = path.join(cwd, rel);
    if (!exists(dir)) continue;
    let commands = [];
    try {
      commands = fs
        .readdirSync(dir)
        .filter((file) => file.startsWith("speckit.") && file.endsWith(".md"))
        .map((file) => file.slice(0, -3))
        .sort();
    } catch {
      continue;
    }
    if (commands.length) return { dir: rel, commands };
  }
  return { dir: null, commands: [] };
}

export function normalizeFindings(data) {
  if (Array.isArray(data)) return data;
  for (const key of ["findings", "records", "results", "items"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

export function specCommandName(action) {
  return `speckit.${action}`;
}

export function normalizedFile(file, cwd) {
  return normalizePath(file, cwd);
}

function displayPath(cwd, file) {
  const rel = relativePath(cwd, file);
  return rel.startsWith("..") ? file : rel;
}

function commandInfo(bin, args) {
  const result = spawnSync(bin, args, { encoding: "utf8", timeout: 8000 });
  if (result.error) {
    return { available: result.error.code !== "ENOENT", version: null };
  }
  const version = result.status === 0 ? extractVersion((result.stdout || "").trim().split("\n")[0]) : null;
  return { available: true, version };
}

function extractVersion(line) {
  if (!line) return null;
  const match = line.match(/\d+\.\d+(?:[.\w-]*)/);
  return match ? match[0] : line;
}