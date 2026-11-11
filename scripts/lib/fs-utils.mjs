import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const BEGIN = (id) => `<!-- mapkeeper:begin id=${id} -->`;
export const END = (id) => `<!-- mapkeeper:end id=${id} -->`;

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function readText(file, fallback = null) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return fallback;
  }
}

export function writeText(file, value) {
  ensureDir(path.dirname(file));
  writeAtomic(file, value);
}

export function writeAtomic(file, value) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, value);
  fs.renameSync(tmp, file);
}

export function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

export function today() {
  return new Date().toISOString().slice(0, 10);
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
    }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return dirty ? `${rev}-dirty` : rev;
  } catch {
    return "worktree";
  }
}

export function trackedFiles(cwd = process.cwd()) {
  try {
    const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return walk(cwd);
  }
}

export function walk(dir, { ignore = ["node_modules", ".git", "graphify-out", "project-map"] } = {}) {
  const out = [];
  const visit = (rel) => {
    let entries;
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (ignore.includes(entry.name)) continue;
      if (entry.isDirectory()) visit(relPath);
      else if (entry.isFile()) out.push(relPath);
    }
  };
  visit("");
  return out.sort();
}

export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

export function sanitizeId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function managedBlock(id, body) {
  return `${BEGIN(id)}\n${body.replace(/\s+$/, "")}\n${END(id)}`;
}

const BLOCK_RE = (id) =>
  new RegExp(
    `<!-- mapkeeper:begin id=${escapeRe(id)} -->\\n([\\s\\S]*?)\\n<!-- mapkeeper:end id=${escapeRe(id)} -->`,
  );

const LEGACY_BLOCK_RE = (id) =>
  new RegExp(
    `<!-- mapper:begin id=${escapeRe(id)} -->\\n([\\s\\S]*?)\\n<!-- mapper:end id=${escapeRe(id)} -->`,
  );

export function hasManagedBlock(content, id) {
  return BLOCK_RE(id).test(content) || LEGACY_BLOCK_RE(id).test(content);
}

export function readManagedBlock(content, id) {
  const match = content.match(BLOCK_RE(id)) || content.match(LEGACY_BLOCK_RE(id));
  return match ? match[1] : null;
}

export function replaceManagedBlock(content, id, body) {
  const block = managedBlock(id, body);
  if (BLOCK_RE(id).test(content)) return content.replace(BLOCK_RE(id), block);
  if (LEGACY_BLOCK_RE(id).test(content)) return content.replace(LEGACY_BLOCK_RE(id), block);
  return `${content.replace(/\s+$/, "")}\n\n${block}\n`;
}

export function balanceErrors(content) {
  const errors = [];
  const open = [...content.matchAll(/<!-- (?:mapkeeper|mapper):begin id=([A-Za-z0-9_.:-]+) -->/g)].map((m) => m[1]);
  const close = [...content.matchAll(/<!-- (?:mapkeeper|mapper):end id=([A-Za-z0-9_.:-]+) -->/g)].map((m) => m[1]);
  const openSet = new Set(open);
  const closeSet = new Set(close);
  for (const id of openSet) if (!closeSet.has(id)) errors.push(`unclosed mapkeeper block "${id}"`);
  for (const id of closeSet) if (!openSet.has(id)) errors.push(`unopened mapkeeper block "${id}"`);
  if (open.length !== new Set(open).size) errors.push("duplicate mapkeeper:begin block ids");
  return errors;
}

export function listFiles(dir, filter = () => true) {
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
    .filter(filter)
    .sort();
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}