import path from "node:path";
import { exists, listFiles, readJson, readText, sanitizeId, today } from "./fs-utils.mjs";

const SDD_SECTIONS = new Set([
  "summary",
  "technical context",
  "constitution check",
  "project structure",
  "complexity tracking",
  "implementation strategy",
  "phases",
  "dependencies",
  "notes",
  "assumptions",
]);

export function detectSpeckit(cwd = process.cwd()) {
  const dir = path.join(cwd, ".specify");
  return { available: exists(dir), dir: exists(dir) ? ".specify" : null, feature_dir: resolveFeatureDir(cwd) };
}

export function resolveFeatureDir(cwd) {
  const stateFile = path.join(cwd, ".specify", "feature.json");
  const candidates = [];
  if (exists(stateFile)) {
    try {
      const state = readJson(stateFile);
      for (const key of ["feature_directory", "feature_dir", "directory", "path", "feature"]) {
        if (typeof state[key] === "string") candidates.push(state[key]);
      }
    } catch {
      /* fall through */
    }
  }
  for (const candidate of candidates) {
    const rel = candidate.replace(/^\.\//, "").replace(/\/$/, "");
    if (exists(path.join(cwd, rel, "spec.md"))) return rel;
  }
  const specsDir = path.join(cwd, "specs");
  if (!exists(specsDir)) return null;
  const dirs = listFiles(specsDir, (file) => file.endsWith("spec.md"))
    .map((file) => path.dirname(file))
    .sort()
    .reverse();
  if (!dirs.length) return null;
  return path.relative(cwd, dirs[0]).replace(/\\/g, "/");
}

export function ingestSpeckit({ cwd = process.cwd(), featureDir = null, date = today() } = {}) {
  if (!exists(path.join(cwd, ".specify"))) {
    return { available: false, nodes: [], edges: [], units: [], gaps: [], warnings: [] };
  }
  const feature = featureDir || resolveFeatureDir(cwd);
  if (!feature) {
    return { available: true, nodes: [], edges: [], units: [], gaps: [], warnings: [".specify/ exists but no feature directory with spec.md was found"] };
  }
  const slug = sanitizeId(path.basename(feature));
  const nodes = [];
  const edges = [];
  const units = [];
  const gaps = [];
  const warnings = [];
  const ref = (file, anchor) => `${file}#${anchor}`;

  const specFile = `${feature}/spec.md`;
  const planFile = `${feature}/plan.md`;
  const tasksFile = `${feature}/tasks.md`;

  const spec = readText(path.join(cwd, specFile));
  const plan = readText(path.join(cwd, planFile));
  const tasks = readText(path.join(cwd, tasksFile));
  const constitution = readText(path.join(cwd, ".specify", "memory", "constitution.md"));

  const requirementIds = new Map();
  if (spec) {
    for (const [i, line] of spec.split("\n").entries()) {
      const match = line.match(/\b(FR|NFR|SR|CR)[-_]?(\d+)\b/);
      if (!match) continue;
      const key = `${match[1]}-${String(match[2]).padStart(3, "0")}`;
      if (requirementIds.has(key)) continue;
      const id = `spec_${slug}_${sanitizeId(key)}`;
      requirementIds.set(key, id);
      const label = cleanLine(line.replace(match[0], "").replace(/^[-*#\s:]+/, ""));
      nodes.push({
        id,
        kind: "requirement",
        label: `${key}: ${label || "requirement"}`.slice(0, 160),
        summary: label,
        status: "planned",
        phase: "BEFORE",
        confidence: "high",
        derivation: "speckit",
        provenance: { source_file: specFile, source_location: `L${i + 1}`, relation_source: "EXTRACTED" },
        spec_refs: [ref(specFile, key)],
        source_refs: [],
        tags: ["requirement", key.split("-")[0]],
      });
      units.push({
        id: `req_${slug}_${sanitizeId(key)}`,
        kind: "requirement",
        scope: ref(specFile, key),
        status: "unmapped",
        node_ids: [id],
        evidence: ["project-map/graph.json#nodes"],
        last_verified_revision: "",
        last_verified_date: date,
      });
    }

    for (const match of spec.matchAll(/^###\s+User Story\s+(\d+)\s*[-–—:]?\s*(.*)$/gm)) {
      const [, number, title] = match;
      const id = `spec_${slug}_goal_${number}`;
      nodes.push({
        id,
        kind: "goal",
        label: cleanLine(title) || `User Story ${number}`,
        summary: "",
        status: "planned",
        phase: "BEFORE",
        confidence: "high",
        derivation: "speckit",
        provenance: { source_file: specFile, relation_source: "EXTRACTED" },
        spec_refs: [ref(specFile, `US${number}`)],
        source_refs: [],
        tags: ["user-story"],
      });
    }

    // each requirement's first task-less state is resolved after tasks parse
  }

  const taskRefs = new Map();
  if (tasks) {
    for (const [i, line] of tasks.split("\n").entries()) {
      const match = line.match(/^\s*-\s*\[[ xX]\]\s*(T\d{2,})\b(.*)$/);
      if (!match) continue;
      const [, key, rest] = match;
      const id = `spec_${slug}_${sanitizeId(key)}`;
      const text = cleanLine(rest);
      nodes.push({
        id,
        kind: "task",
        label: `${key}: ${text}`.slice(0, 160),
        summary: text,
        status: /\[[xX]\]/.test(line) ? "implemented" : "planned",
        phase: "DURING",
        confidence: "high",
        derivation: "speckit",
        provenance: { source_file: tasksFile, source_location: `L${i + 1}`, relation_source: "EXTRACTED" },
        spec_refs: [ref(tasksFile, key)],
        source_refs: [],
        tags: ["task"],
      });
      const mentioned = new Set();
      for (const req of rest.matchAll(/\b(FR|NFR|SR|CR)[-_]?(\d+)\b/g)) {
        const reqKey = `${req[1]}-${String(req[2]).padStart(3, "0")}`;
        const reqId = requirementIds.get(reqKey);
        if (!reqId) continue;
        edges.push(specEdge(id, reqId, "satisfies_requirement", ref(tasksFile, key), date));
        mentioned.add(reqId);
      }
      taskRefs.set(key, { id, mentioned, line: i + 1 });
    }
  }

  for (const [key, nodeId] of requirementIds) {
    const covered = [...taskRefs.values()].some((task) => task.mentioned.has(nodeId));
    if (!covered) gaps.push(`${key} has no task referencing it`);
  }
  if (tasks) {
    const fileRefs = new Set();
    for (const match of tasks.matchAll(/(?:^|\s)((?:\.{0,2}\/)?[\w@./-]+\/[\w@./-]+\.[A-Za-z0-9]{1,8})\b/g)) {
      const file = match[1].replace(/^\.\//, "");
      if (/^https?:/.test(file) || file.startsWith("project-map/")) continue;
      fileRefs.add(file);
    }
    for (const file of fileRefs) {
      if (!exists(path.join(cwd, file))) gaps.push(`tasks.md references missing file ${file}`);
    }
  }

  if (plan) {
    let inStructure = false;
    for (const [i, line] of plan.split("\n").entries()) {
      const heading = line.match(/^(#{2,3})\s+(.*)$/);
      if (heading) {
        const title = cleanLine(heading[2]);
        inStructure = /project structure|architecture|components/i.test(title);
        if (heading[1] === "###" && inStructure && !SDD_SECTIONS.has(title.toLowerCase())) {
          const id = `spec_${slug}_component_${sanitizeId(title)}`;
          nodes.push({
            id,
            kind: "component",
            label: title,
            summary: "",
            status: "planned",
            phase: "BEFORE",
            confidence: "medium",
            derivation: "speckit",
            provenance: { source_file: planFile, source_location: `L${i + 1}`, relation_source: "EXTRACTED" },
            spec_refs: [ref(planFile, sanitizeId(title))],
            source_refs: [],
            tags: ["component"],
          });
        }
        continue;
      }
      const decision = line.match(/\*\*Decision\*\*\s*:\s*(.+)$/i);
      if (decision) {
        const id = `spec_${slug}_decision_${sanitizeId(cleanLine(decision[1]).slice(0, 40))}`;
        nodes.push({
          id,
          kind: "decision",
          label: cleanLine(decision[1]).slice(0, 120),
          summary: "",
          status: "implemented",
          phase: "DURING",
          confidence: "medium",
          derivation: "speckit",
          provenance: { source_file: planFile, source_location: `L${i + 1}`, relation_source: "EXTRACTED" },
          spec_refs: [ref(planFile, `L${i + 1}`)],
          source_refs: [],
          tags: ["decision"],
        });
      }
    }
  }

  if (constitution) {
    for (const [i, line] of constitution.split("\n").entries()) {
      const heading = line.match(/^#{2,3}\s+(.+)$/);
      if (!heading) continue;
      const title = cleanLine(heading[1]);
      if (/^(constitution|core principles|sections|versioning|governance)$/i.test(title)) continue;
      nodes.push({
        id: `spec_${slug}_constraint_${sanitizeId(title)}`,
        kind: "constraint",
        label: title,
        summary: "",
        status: "implemented",
        phase: "DURING",
        confidence: "high",
        derivation: "speckit",
        provenance: { source_file: ".specify/memory/constitution.md", source_location: `L${i + 1}`, relation_source: "EXTRACTED" },
        spec_refs: [ref(".specify/memory/constitution.md", sanitizeId(title))],
        source_refs: [],
        tags: ["constitution"],
      });
    }
  }

  if (!spec && !plan && !tasks) warnings.push(`feature directory ${feature} has no spec.md, plan.md, or tasks.md`);
  return { available: true, feature_dir: feature, nodes: dedupe(nodes), edges: dedupeEdges(edges), units, gaps, warnings };
}

function specEdge(source, target, relation, refFile, date) {
  return {
    source,
    target,
    relation,
    confidence: "EXTRACTED",
    confidence_score: 1,
    derivation: "speckit",
    summary: "",
    source_refs: [refFile],
    last_updated: date,
  };
}

function cleanLine(value) {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^\s*[-*]\s*/, "")
    .replace(/^\s*[:\-–—]\s*/, "")
    .trim();
}

function dedupe(nodes) {
  const map = new Map();
  for (const node of nodes) map.set(node.id, node);
  return [...map.values()];
}

function dedupeEdges(edges) {
  const map = new Map();
  for (const edge of edges) map.set(`${edge.source}|${edge.relation}|${edge.target}`, edge);
  return [...map.values()];
}