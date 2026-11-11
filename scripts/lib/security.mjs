import os from "node:os";
import path from "node:path";
import { exists, readJson, readText, sanitizeId, today } from "./fs-utils.mjs";

const CANDIDATE_DIRS = [
  [".kilo", "skills", "security-audit"],
  [".agents", "skills", "security-audit"],
  [".github", "skills", "security-audit"],
  [".claude", "skills", "security-audit"],
];

const GLOBAL_DIRS = [
  [".config", "kilo", "skills", "security-audit"],
  [".agents", "skills", "security-audit"],
  [".claude", "skills", "security-audit"],
];

export function findSecuritySkill(cwd = process.cwd()) {
  for (const parts of CANDIDATE_DIRS) {
    const dir = path.join(cwd, ...parts);
    if (exists(path.join(dir, "SKILL.md"))) return dir;
  }
  for (const parts of GLOBAL_DIRS) {
    const dir = path.join(os.homedir(), ...parts);
    if (exists(path.join(dir, "SKILL.md"))) return dir;
  }
  return null;
}

export function ingestSecurity({ cwd = process.cwd(), runDir, date = today(), revision = null, graph = null } = {}) {
  if (!runDir) {
    return { available: false, nodes: [], edges: [], counts: {}, warnings: ["no security run directory supplied"] };
  }
  const dir = path.isAbsolute(runDir) ? runDir : path.join(cwd, runDir);
  if (!exists(dir)) {
    return { available: false, nodes: [], edges: [], counts: {}, warnings: [`security run directory not found: ${runDir}`] };
  }

  const warnings = [];
  const nodes = [];
  const edges = [];
  const meta = readJsonSafe(path.join(dir, "run-metadata.json"));
  const runId = sanitizeId(meta?.run_id || path.basename(dir) || "run");
  const findings = normalizeFindings(readJsonSafe(path.join(dir, "findings.json")), warnings);
  const boundaries = parseTrustBoundaries(readText(path.join(dir, "architecture.md"), ""));
  const counts = { confirmed: 0, needs_validation: 0, rejected: 0, skipped: 0 };
  const sourceRevision = meta?.source_ref?.commit || meta?.source_ref || null;
  const stale = Boolean(revision && revision !== "worktree" && sourceRevision && !String(sourceRevision).startsWith(revision));
  const refIndex = buildRefIndex(graph);

  const boundaryIds = new Map();
  for (const title of boundaries) {
    const id = `sec_${runId}_tb_${sanitizeId(title)}`;
    boundaryIds.set(title.toLowerCase(), id);
    boundaryIds.set(sanitizeId(title), id);
    nodes.push({
      id,
      kind: "trust_boundary",
      label: title,
      summary: "Trust boundary from security reconnaissance.",
      status: "implemented",
      phase: "DURING",
      confidence: "medium",
      derivation: "security",
      provenance: { source_file: `${runDir}/architecture.md`, relation_source: "EXTRACTED" },
      source_refs: [`${runDir}/architecture.md`],
      tags: ["security", "trust-boundary"],
    });
  }

  for (const record of findings) {
    const verdict = normalizeVerdict(record);
    if (!verdict) {
      counts.skipped += 1;
      continue;
    }
    if (verdict === "rejected") {
      counts.rejected += 1;
      continue;
    }
    counts[verdict] += 1;
    const key = record.fingerprint || record.id || record.candidate_id || sanitizeId(record.title || "finding");
    const id = `sec_${runId}_${sanitizeId(key)}`;
    const file = record.file || record.path || record.source_file || record.location?.file || null;
    const line = record.line || record.start_line || record.location?.line || null;
    const findingNode = {
      id,
      kind: "finding",
      label: truncate(record.title || record.name || record.summary || key, 140),
      summary: truncate(record.description || record.impact || "", 800),
      status: verdict,
      verdict,
      phase: "DURING",
      confidence: verdict === "confirmed" ? "high" : "medium",
      derivation: "security",
      provenance: {
        source_file: file,
        source_location: line ? `L${line}` : null,
        relation_source: verdict === "confirmed" ? "EXTRACTED" : "INFERRED",
        run_dir: runDir,
        stale_source: stale,
      },
      source_refs: file ? [`${file}${line ? `:${line}` : ""}`] : [`${runDir}/findings.json`],
      tags: ["security", verdict, ...(record.attack_class ? [String(record.attack_class)] : [])],
      last_verified: { revision: sourceRevision || "", date },
    };
    if (verdict === "confirmed") findingNode.severity = normalizeSeverity(record.severity);
    nodes.push(findingNode);

    if (file) {
      const target = findNodeByRef(refIndex, file);
      if (target) edges.push(secEdge(id, target, "affects", `${runDir}/findings.json`, date));
      else warnings.push(`finding ${id}: no graph node matches ${file}; skipping affects edge`);
    }
    const boundary = record.trust_boundary || record.boundary;
    if (boundary && boundaryIds.get(String(boundary).toLowerCase())) {
      edges.push(secEdge(id, boundaryIds.get(String(boundary).toLowerCase()), "violates", `${runDir}/findings.json`, date));
    }
    for (const ref of record.requirements || []) {
      const reqId = findNodeByRef(refIndex, ref) || findNodeByRef(refIndex, `#${ref}`);
      if (reqId) edges.push(secEdge(id, reqId, "affects", `${runDir}/findings.json`, date));
      else warnings.push(`finding ${id}: no graph node matches requirement ${ref}`);
    }
  }

  if (stale) {
    warnings.push(`security run ${runId} was produced from ${sourceRevision}, current revision is ${revision}; findings are marked stale`);
  }
  return { available: true, run_id: runId, source_revision: sourceRevision, stale, nodes, edges, counts, warnings };
}

function normalizeFindings(data, warnings) {
  if (!data) {
    warnings.push("findings.json missing or unreadable");
    return [];
  }
  if (Array.isArray(data)) return data;
  for (const key of ["findings", "records", "results", "items"]) {
    if (Array.isArray(data[key])) return data[key];
  }
  warnings.push("findings.json shape is not recognized; expected an array or a findings/records key");
  return [];
}

function normalizeVerdict(record) {
  const raw = String(record.verdict || record.status || "").toLowerCase();
  if (["confirmed", "needs_validation", "rejected"].includes(raw)) return raw;
  if (["valid", "verified"].includes(raw)) return "confirmed";
  if (["invalid", "false_positive", "disproved"].includes(raw)) return "rejected";
  if (raw) return "needs_validation";
  return null;
}

function normalizeSeverity(value) {
  const raw = String(value || "").toLowerCase();
  return ["critical", "high", "medium", "low", "informational"].includes(raw) ? raw : "informational";
}

function parseTrustBoundaries(text) {
  if (!text) return [];
  const titles = [];
  let inSection = false;
  for (const line of text.split("\n")) {
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const title = heading[2].trim();
      inSection = /trust\s+boundar/i.test(title);
      continue;
    }
    if (!inSection) continue;
    const bullet = line.match(/^\s*[-*]\s+(?:\*\*)?([^:*]{3,80})/);
    if (bullet) titles.push(bullet[1].trim());
  }
  if (titles.length) return [...new Set(titles)];
  for (const line of text.split("\n")) {
    const match = line.match(/trust\s+boundary\s*[:\-]\s*(.+)$/i);
    if (match) titles.push(match[1].trim());
  }
  return [...new Set(titles)];
}

function buildRefIndex(graph) {
  const index = new Map();
  for (const node of graph?.nodes || []) {
    for (const ref of [...(node.source_refs || []), ...(node.spec_refs || [])]) {
      if (!index.has(ref)) index.set(ref, node.id);
      const file = ref.split("#")[0];
      if (!index.has(file)) index.set(file, node.id);
    }
  }
  return index;
}

function findNodeByRef(index, ref) {
  if (!ref) return null;
  const clean = String(ref).replace(/^\.\//, "");
  if (index.has(clean)) return index.get(clean);
  const file = clean.split("#")[0].split(":")[0];
  if (index.has(file)) return index.get(file);
  for (const [key, id] of index) {
    if (key.endsWith(`#${clean}`) || key.endsWith(`/${clean}`)) return id;
  }
  return null;
}

function secEdge(source, target, relation, refFile, date) {
  return {
    source,
    target,
    relation,
    confidence: "EXTRACTED",
    confidence_score: 1,
    derivation: "security",
    summary: "",
    source_refs: [refFile],
    last_updated: date,
  };
}

function readJsonSafe(file) {
  if (!exists(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function truncate(value, limit) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}