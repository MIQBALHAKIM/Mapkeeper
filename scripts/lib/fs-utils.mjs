import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

export function readText(file, fallback = null) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return fallback;
  }
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function readJsonSafe(file) {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

export function writeText(file, value) {
  ensureDir(path.dirname(file));
  writeAtomic(file, value);
}

export function writeJson(file, value) {
  writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeAtomic(file, value) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, value);
  fs.renameSync(tmp, file);
}

export function now() {
  return new Date().toISOString();
}

export function sourceRevision(cwd = process.cwd()) {
  try {
    const rev = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 8000,
    }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 8000,
    }).trim();
    return dirty ? `${rev}-dirty` : rev;
  } catch {
    return "worktree";
  }
}

export function latestCommitTime(cwd = process.cwd()) {
  try {
    const seconds = Number(
      execFileSync("git", ["log", "-1", "--format=%ct"], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 8000,
      }).trim(),
    );
    return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
  } catch {
    return null;
  }
}

export function mtimeIso(file) {
  try {
    return fs.statSync(file).mtime.toISOString();
  } catch {
    return null;
  }
}

export function normalizePath(file, cwd = process.cwd()) {
  if (!file) return null;
  let value = String(file).replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (path.isAbsolute(value)) {
    const relative = path.relative(cwd, value).replace(/\\/g, "/");
    if (!relative.startsWith("..")) value = relative;
  }
  return value || null;
}

export function relativePath(cwd, file) {
  return path.relative(cwd, file).replace(/\\/g, "/");
}

export function isDirectory(file) {
  try {
    return fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}