import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  exists,
  readJson,
  readText,
  sanitizeId,
  today,
  trackedFiles,
} from "./fs-utils.mjs";

export const GRAPHIFY_RELATIONS = new Set([
  "calls",
  "implements",
  "references",
  "cites",
  "conceptually_related_to",
  "shares_data_with",
  "semantically_similar_to",
  "rationale_for",
]);

const FILE_TYPE_KIND = {
  code: "file",
  document: "document",
  paper: "document",
  image: "document",
  rationale: "decision",
  concept: "data_entity",
};

export function detectGraphify({ cwd = process.cwd(), mode = "auto" } = {}) {
  const result = { available: false, version: null, graph_path: null, reason: null };
  if (mode === "disabled" || mode === "manual") {
    result.reason = `graphify disabled by --graphify=${mode}`;
    return result;
  }
  try {
    const version = execFileSync("graphify", ["--version"], {
      cwd,
      encoding: "utf8",
      timeout: 8000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    result.available = true;
    result.version = version.split("\n")[0];
  } catch {
    result.reason = "graphify binary not found on PATH";
  }
  const cache = path.join(cwd, "graphify-out", "graph.json");
  if (exists(cache)) result.graph_path = "graphify-out/graph.json";
  return result;
}

export function runGraphifyUpdate({ cwd = process.cwd(), timeout = 600000 } = {}) {
  try {
    execFileSync("graphify", ["update"], {
      cwd,
      encoding: "utf8",
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error.stderr?.toString().trim() || error.message };
  }
}

export function loadGraphifyGraph(cwd = process.cwd()) {
  const file = path.join(cwd, "graphify-out", "graph.json");
  if (!exists(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

export function projectGraphify(raw, { cwd = process.cwd(), phase = "DURING", date = today() } = {}) {
  const warnings = [];
  const nodes = [];
  const edges = [];
  const seen = new Set();

  for (const node of raw.nodes || []) {
    const id = String(node.id || "").trim();
    if (!id) {
      warnings.push("skipped graphify node without id");
      continue;
    }
    if (seen.has(id)) {
      warnings.push(`duplicate graphify node id ${id}`);
      continue;
    }
    seen.add(id);
    const sourceFile = normalizePath(node.source_file, cwd);
    const kind = FILE_TYPE_KIND[node.file_type] || "file";
    nodes.push({
      id,
      kind,
      label: node.label || id,
      summary: node.summary || "",
      status: kind === "file" ? "implemented" : "unknown",
      phase,
      confidence: node.confidence || (node.file_type === "code" ? "high" : "medium"),
      derivation: "graphify",
      provenance: {
        source_file: sourceFile,
        source_location: node.source_location || null,
        relation_source: "EXTRACTED",
        graphify_file_type: node.file_type || null,
        community: node.community ?? null,
      },
      spec_refs: [],
      source_refs: sourceFile ? [sourceFile] : [],
      tags: [node.file_type, node.community != null ? `community:${node.community}` : null].filter(Boolean),
      last_verified: { revision: "", date },
    });
  }

  for (const edge of raw.edges || []) {
    if (!seen.has(edge.source) || !seen.has(edge.target)) {
      warnings.push(`skipped graphify edge with unknown endpoint ${edge.source} -> ${edge.target}`);
      continue;
    }
    if (!GRAPHIFY_RELATIONS.has(edge.relation)) {
      warnings.push(`skipped graphify edge with unmapped relation "${edge.relation}"`);
      continue;
    }
    edges.push({
      source: edge.source,
      target: edge.target,
      relation: edge.relation,
      confidence: edge.confidence || "INFERRED",
      confidence_score: typeof edge.confidence_score === "number" ? edge.confidence_score : 0.75,
      derivation: "graphify",
      summary: edge.summary || "",
      source_refs: edge.source_file ? [normalizePath(edge.source_file, cwd)] : [],
      last_updated: date,
    });
  }

  return { nodes, edges, warnings };
}

export function scanSourceGraph({ cwd = process.cwd(), phase = "DURING", date = today(), files = null } = {}) {
  const tracked = files || trackedFiles(cwd);
  const sourceFiles = tracked.filter((file) => !isIgnored(file));
  const nodes = [];
  const edges = [];
  const warnings = [];
  const byKey = new Map();

  nodes.push({
    id: "project_root",
    kind: "project",
    label: path.basename(path.resolve(cwd)),
    summary: "Deterministic source scan; graphify was unavailable or disabled.",
    status: "implemented",
    phase,
    confidence: "high",
    derivation: "llm",
    provenance: { source_file: null, relation_source: "EXTRACTED" },
    source_refs: ["."],
    tags: ["scan"],
  });

  for (const file of sourceFiles) {
    const id = `file_${sanitizeId(stripExt(file))}`;
    const key = stripExt(file);
    byKey.set(key, id);
    nodes.push({
      id,
      kind: "file",
      label: path.basename(file),
      summary: "",
      status: "implemented",
      phase,
      confidence: "high",
      derivation: "llm",
      provenance: { source_file: file, relation_source: "EXTRACTED" },
      source_refs: [file],
      tags: [path.extname(file).slice(1) || "file", file.split("/")[0]],
      last_verified: { revision: "", date },
    });
    edges.push(edge("project_root", id, "contains", "EXTRACTED", 1, file, date));
  }

  // folder components
  const folders = new Map();
  for (const file of sourceFiles) {
    const parts = file.split("/");
    if (parts.length < 2) continue;
    const folder = parts[0];
    folders.set(folder, (folders.get(folder) || 0) + 1);
  }
  for (const [folder, count] of folders) {
    if (count < 3) continue;
    const id = `component_${sanitizeId(folder)}`;
    nodes.push({
      id,
      kind: "component",
      label: folder,
      summary: `${count} files`,
      status: "implemented",
      phase,
      confidence: "high",
      derivation: "llm",
      provenance: { source_file: null, relation_source: "EXTRACTED" },
      source_refs: [`${folder}/`],
      tags: ["folder"],
    });
    edges.push(edge("project_root", id, "contains", "EXTRACTED", 1, `${folder}/`, date));
  }

  const importEdges = scanImports(cwd, sourceFiles, byKey, date);
  edges.push(...importEdges.edges);
  warnings.push(...importEdges.warnings);

  const deps = dependencyNodes(cwd, date);
  nodes.push(...deps.nodes);
  edges.push(...deps.edges);

  return { nodes, edges, warnings };
}

function scanImports(cwd, files, byKey, date) {
  const edges = [];
  const warnings = [];
  const code = files.filter((file) => /\.(m?[jt]sx?|cjs|py)$/.test(file));

  for (const file of code) {
    const text = readText(path.join(cwd, file), "");
    if (!text) continue;
    const sourceId = `file_${sanitizeId(stripExt(file))}`;
    const specs = [];

    if (/\.(m?[jt]sx?|cjs)$/.test(file)) {
      for (const match of text.matchAll(/(?:from\s*|require\s*\(\s*|import\s*\(\s*)["'`]([^"'`]+)["'`]/g)) {
        specs.push(match[1]);
      }
    } else {
      for (const match of text.matchAll(/^\s*(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))/gm)) {
        specs.push(match[1] || match[2]);
      }
    }

    for (const spec of specs) {
      const target = resolveImport(file, spec, byKey);
      if (!target) continue;
      edges.push(edge(sourceId, target, "references", "EXTRACTED", 1, file, date));
    }
  }

  return { edges, warnings };
}

function resolveImport(fromFile, spec, byKey) {
  if (spec.startsWith(".")) {
    const base = stripExt(
      path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec)),
    );
    return byKey.get(base) || byKey.get(`${base}/index`) || null;
  }
  if (spec.startsWith("/")) return null;
  const dotted = spec.replace(/\./g, "/");
  return byKey.get(dotted) || null;
}

function dependencyNodes(cwd, date) {
  const nodes = [];
  const edges = [];
  const pkgFile = path.join(cwd, "package.json");
  const pkg = exists(pkgFile) ? readJson(pkgFile) : null;
  if (pkg) {
    const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const [name, version] of Object.entries(all)) {
      const id = `dependency_${sanitizeId(name)}`;
      nodes.push({
        id,
        kind: "dependency",
        label: name,
        summary: String(version),
        status: "implemented",
        confidence: "high",
        derivation: "llm",
        provenance: { source_file: "package.json", relation_source: "EXTRACTED" },
        source_refs: ["package.json"],
        tags: ["npm"],
      });
      edges.push(edge("project_root", id, "depends_on", "EXTRACTED", 1, "package.json", date));
    }
  }
  return { nodes, edges };
}

export function mergeGraph(existing, incoming, { changedFiles = null, stripDerivations = ["speckit", "security"] } = {}) {
  if (!existing) return incoming;
  const lifecycle = (existing.nodes || []).filter((node) => !stripDerivations.includes(node.derivation) && node.derivation !== "graphify" && node.derivation !== "llm");
  const keptGraph = (existing.nodes || []).filter((node) => {
    if (stripDerivations.includes(node.derivation)) return false;
    if (!changedFiles) return false;
    const refs = node.source_refs || [];
    return !refs.some((ref) => changedFiles.some((file) => sameScope(ref, file)));
  });
  const nodes = dedupeById([...lifecycle, ...keptGraph, ...incoming.nodes]);

  const lifecycleIds = new Set(lifecycle.map((node) => node.id));
  const existingEdges = (existing.edges || []).filter((edge) => {
    const src = existing.nodes.find((n) => n.id === edge.source);
    if (src && stripDerivations.includes(src.derivation)) return false;
    if (lifecycleIds.has(edge.source)) return true;
    if (!changedFiles) return false;
    const refs = edge.source_refs || [];
    return !refs.some((ref) => changedFiles.some((file) => sameScope(ref, file)));
  });
  const edges = dedupeEdges([...existingEdges, ...incoming.edges]);

  return {
    nodes,
    edges,
    warnings: incoming.warnings || [],
  };
}

function sameScope(ref, file) {
  const clean = ref.split("#")[0];
  if (clean === file) return true;
  if (clean.endsWith("/")) return file.startsWith(clean);
  return false;
}

export function finalizeGraph({ nodes, edges, meta, coverage }) {
  const byDerivation = {};
  for (const node of nodes) byDerivation[node.derivation] = (byDerivation[node.derivation] || 0) + 1;
  return {
    schema_version: 2,
    meta: {
      ...meta,
      counts: { nodes: nodes.length, edges: edges.length, by_derivation: byDerivation },
    },
    nodes,
    edges,
    hyperedges: [],
    coverage,
  };
}

function edge(source, target, relation, confidence, score, ref, date) {
  return {
    source,
    target,
    relation,
    confidence,
    confidence_score: score,
    derivation: "llm",
    summary: "",
    source_refs: ref ? [ref] : [],
    last_updated: date,
  };
}

function dedupeById(nodes) {
  const seen = new Map();
  for (const node of nodes) seen.set(node.id, node);
  return [...seen.values()];
}

function dedupeEdges(edges) {
  const seen = new Map();
  for (const e of edges) seen.set(`${e.source}|${e.relation}|${e.target}`, e);
  return [...seen.values()];
}

function normalizePath(file, cwd) {
  if (!file) return null;
  if (!path.isAbsolute(file)) return file.replace(/\\/g, "/");
  const rel = path.relative(cwd, file).replace(/\\/g, "/");
  return rel.startsWith("..") ? file.replace(/\\/g, "/") : rel;
}

function stripExt(file) {
  return file.replace(/\.(m?[jt]sx?|cjs|py|go|rs|java|kt|rb|php|cs|swift|md|txt|json|ya?ml|html|css|scss|sh|ps1)$/i, "");
}

function isIgnored(file) {
  return (
    file.startsWith("project-map/") ||
    file.startsWith("graphify-out/") ||
    file.startsWith(".git/") ||
    file.startsWith("node_modules/") ||
    file.startsWith(".specify/") ||
    file === ".DS_Store" ||
    file.endsWith(".DS_Store") ||
    /(^|\/)(package-lock\.json|bun\.lock|yarn\.lock|pnpm-lock\.yaml)$/.test(file) ||
    /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|mp4|mp3|woff2?|ttf|eot|so|dylib|dll|exe|bin)$/i.test(file)
  );
}

export function listMappableFiles(cwd) {
  return trackedFiles(cwd).filter((file) => !isIgnored(file));
}

export function readPackageName(cwd) {
  const pkg = path.join(cwd, "package.json");
  if (exists(pkg)) {
    try {
      return readJson(pkg).name || null;
    } catch {
      return null;
    }
  }
  const specPath = path.join(cwd, ".specify", "feature.json");
  if (exists(specPath)) {
    try {
      const data = readJson(specPath);
      if (data.project_name) return data.project_name;
    } catch {
      /* ignore */
    }
  }
  return path.basename(cwd);
}

export function shaOfFile(cwd, file) {
  return `${file}`;
}

export function refreshLastVerified(graph, revision) {
  const date = today();
  for (const node of graph.nodes) {
    if (node.derivation === "graphify" || node.derivation === "llm") {
      node.last_verified = { revision, date };
    }
  }
  for (const edge of graph.edges) edge.last_updated = date;
  return graph;
}