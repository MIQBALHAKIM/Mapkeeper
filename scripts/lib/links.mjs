import path from "node:path";
import {
  ensureDir,
  exists,
  latestCommitTime,
  mtimeIso,
  normalizePath,
  now,
  readJson,
  readJsonSafe,
  readText,
  sourceRevision,
  writeJson,
  writeText,
} from "./fs-utils.mjs";
import { normalizedFile, normalizeFindings, resolveFeatureDir } from "./detect.mjs";

const REQUIREMENT_RE = /\b(FR|NFR|SR|CR)[-_]?\s?(\d+)\b/g;
const PATH_EXTENSIONS =
  /\.(?:js|mjs|cjs|jsx|tsx?|py|go|rs|java|kt|kts|rb|php|cs|swift|md|json|ya?ml|toml|ini|env|sql|html|css|scss|sh|ps1)$/i;

export function buildLinks({ cwd, graphPath = null, runDir = null, includeSecurity = true }) {
  const revision = sourceRevision(cwd);
  const commitTime = latestCommitTime(cwd);
  const graph = loadGraph(cwd, graphPath);
  const spec = parseSpec(cwd);
  const security = includeSecurity
    ? loadSecurity(cwd, runDir)
    : { present: false, skipped: true, findings: [], verdicts: {}, warnings: [] };

  const links = [];
  const unresolved = [];
  const warnings = [...graph.warnings, ...spec.warnings, ...security.warnings];

  if (graph.present && !graph.valid) {
    unresolved.push({ kind: "invalid_graph", id: graph.path, blocking: true });
  }
  if (security.present && security.invalid) {
    unresolved.push({ kind: "invalid_findings", id: security.run_id || security.path || "findings.json", blocking: true });
  }

  if (security.present) {
    for (const finding of security.findings) {
      if (!finding.file) {
        unresolved.push({ kind: "finding_no_file", id: finding.id, blocking: true });
      }
      if (finding.file) {
        const nodeIds = graph.nodeByFile.get(finding.file) || [];
        links.push({
          type: "finding_file",
          from: finding.id,
          to: finding.file,
          graph_node_ids: nodeIds,
          verdict: finding.verdict,
          severity: finding.severity,
          evidence: `findings.json#${finding.id}`,
        });
        if (graph.present && graph.valid && nodeIds.length === 0) {
          unresolved.push({
            kind: "finding_no_graph_node",
            id: finding.id,
            file: finding.file,
            blocking: true,
          });
        }
      }
      for (const requirement of finding.requirements) {
        if (spec.requirements.has(requirement)) {
          links.push({
            type: "finding_requirement",
            from: finding.id,
            to: requirement,
            verdict: finding.verdict,
            severity: finding.severity,
            evidence: `findings.json#${finding.id}`,
          });
        } else if (spec.present) {
          unresolved.push({
            kind: "finding_unknown_requirement",
            id: finding.id,
            requirement,
            blocking: true,
          });
        }
      }
    }
  }

  if (spec.present) {
    const tasksByRequirement = new Map();
    for (const task of spec.tasks) {
      for (const requirement of task.requirements) {
        if (spec.requirements.has(requirement)) {
          links.push({
            type: "requirement_task",
            from: requirement,
            to: task.id,
            evidence: `tasks.md#${task.id}`,
          });
          if (!tasksByRequirement.has(requirement)) tasksByRequirement.set(requirement, []);
          tasksByRequirement.get(requirement).push(task);
        } else {
          unresolved.push({
            kind: "task_unknown_requirement",
            id: task.id,
            requirement,
            blocking: true,
          });
        }
      }
      for (const file of task.files) {
        links.push({
          type: "task_file",
          from: task.id,
          to: file,
          evidence: `tasks.md#${task.id}`,
        });
        if (!exists(path.join(cwd, file))) {
          unresolved.push({ kind: "task_missing_file", id: task.id, file, blocking: true });
        }
      }
    }

    for (const requirement of spec.requirements.keys()) {
      const tasks = tasksByRequirement.get(requirement) || [];
      if (!tasks.length) {
        unresolved.push({ kind: "requirement_no_task", id: requirement, blocking: true });
      }
      const files = new Set();
      for (const task of tasks) for (const file of task.files) files.add(file);
      for (const file of files) {
        links.push({
          type: "requirement_file",
          from: requirement,
          to: file,
          evidence: `tasks.md#${tasks.find((task) => task.files.has(file))?.id || "unknown"}`,
        });
      }
    }
  }

  if (security.present && security.source_ref && revision !== "worktree") {
    if (!sameRevision(security.source_ref, revision)) {
      warnings.push(
        `security run ${security.run_id || ""} was produced from ${security.source_ref}, current revision is ${revision}`,
      );
    }
  }
  if (graph.present && graph.mtime && commitTime && graph.mtime < commitTime) {
    warnings.push("graphify cache is older than the latest commit");
  }
  if (spec.present && spec.feature_mtime && commitTime && spec.feature_mtime < commitTime) {
    warnings.push("spec-kit feature files are older than the latest commit");
  }

  const uniqueLinks = dedupeLinks(links);
  const report = {
    schema_version: 1,
    generated_at: now(),
    source_revision: revision,
    inputs: {
      graphify: {
        path: graph.path,
        present: graph.present,
        valid: graph.valid,
        nodes: graph.nodes,
      },
      speckit: {
        present: spec.present,
        feature_dir: spec.feature_dir,
        requirements: spec.requirements.size,
        tasks: spec.tasks.length,
      },
      security: {
        present: security.present,
        skipped: Boolean(security.skipped),
        run_id: security.run_id || null,
        findings: security.findings.length,
        verdicts: security.verdicts,
      },
    },
    links: uniqueLinks,
    unresolved: sortUnresolved(unresolved),
    warnings,
    counts: {
      graph_nodes: graph.nodes,
      requirements: spec.requirements.size,
      tasks: spec.tasks.length,
      findings: security.findings.length,
      links: uniqueLinks.length,
      unresolved: unresolved.length,
      links_by_type: countByType(uniqueLinks),
    },
  };
  return report;
}

export function renderLinksMarkdown(report) {
  const lines = [
    "# Mapkeeper links",
    "",
    `Generated ${report.generated_at} from revision \`${report.source_revision}\`.`,
    "Local report: no finding titles, descriptions, or absolute run paths.",
    "",
    "## Inputs",
    "",
    "| Provider | Present | Details |",
    "| --- | --- | --- |",
    inputRow("Graphify", report.inputs.graphify, (input) =>
      input.present ? `${input.nodes} nodes (${input.valid ? "valid" : "invalid"})` : "not found",
    ),
    inputRow("spec-kit", report.inputs.speckit, (input) =>
      input.present
        ? `${input.feature_dir || "no feature"} · ${input.requirements} requirements · ${input.tasks} tasks`
        : "not found",
    ),
    inputRow("security-audit", report.inputs.security, (input) =>
      input.present
        ? `${input.run_id || "run"} · ${input.findings} findings · ${verdictSummary(input.verdicts)}`
        : input.skipped
          ? "skipped"
          : "no run",
    ),
    "",
    "## Summary",
    "",
    `- Links: ${report.counts.links}`,
    `- Unresolved: ${report.counts.unresolved}`,
    `- Graph nodes: ${report.counts.graph_nodes}`,
    `- Requirements: ${report.counts.requirements}`,
    `- Tasks: ${report.counts.tasks}`,
    `- Findings: ${report.counts.findings}`,
  ];

  const findingFiles = report.links.filter((link) => link.type === "finding_file");
  lines.push("", "## Findings to files", "");
  if (findingFiles.length) {
    lines.push("| Finding | Verdict | Severity | File | Graph nodes |", "| --- | --- | --- | --- | --- |");
    for (const link of findingFiles) {
      lines.push(
        `| \`${cell(link.from)}\` | ${cell(link.verdict)} | ${cell(link.severity || "—")} | \`${cell(link.to)}\` | ${cell(link.graph_node_ids.join(", ") || "—")} |`,
      );
    }
  } else {
    lines.push("_None._");
  }

  const findingRequirements = report.links.filter((link) => link.type === "finding_requirement");
  lines.push("", "## Findings to requirements", "");
  if (findingRequirements.length) {
    lines.push("| Finding | Requirement |", "| --- | --- |");
    for (const link of findingRequirements) {
      lines.push(`| \`${cell(link.from)}\` | \`${cell(link.to)}\` |`);
    }
  } else {
    lines.push("_None._");
  }

  const requirementTasks = report.links.filter((link) => link.type === "requirement_task");
  lines.push("", "## Requirements to tasks", "");
  if (requirementTasks.length) {
    lines.push("| Requirement | Task |", "| --- | --- |");
    for (const link of requirementTasks) {
      lines.push(`| \`${cell(link.from)}\` | \`${cell(link.to)}\` |`);
    }
  } else {
    lines.push("_None._");
  }

  const taskFiles = report.links.filter((link) => link.type === "task_file");
  lines.push("", "## Tasks to files", "");
  if (taskFiles.length) {
    lines.push("| Task | File |", "| --- | --- |");
    for (const link of taskFiles) {
      lines.push(`| \`${cell(link.from)}\` | \`${cell(link.to)}\` |`);
    }
  } else {
    lines.push("_None._");
  }

  const requirementFiles = report.links.filter((link) => link.type === "requirement_file");
  lines.push("", "## Requirements to files", "");
  if (requirementFiles.length) {
    lines.push("| Requirement | File |", "| --- | --- |");
    for (const link of requirementFiles) {
      lines.push(`| \`${cell(link.from)}\` | \`${cell(link.to)}\` |`);
    }
  } else {
    lines.push("_None._");
  }

  lines.push("", "## Unresolved", "");
  if (report.unresolved.length) {
    lines.push("| Kind | ID | Detail |", "| --- | --- | --- |");
    for (const item of report.unresolved) {
      const detail = [item.file, item.requirement].filter(Boolean).join(" · ");
      lines.push(`| ${cell(item.kind)} | \`${cell(item.id)}\` | ${cell(detail || "—")} |`);
    }
  } else {
    lines.push("_None._");
  }

  lines.push("", "## Warnings", "");
  if (report.warnings.length) {
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  } else {
    lines.push("_None._");
  }

  return `${lines.join("\n")}\n`;
}

export function writeLinks({ cwd, report, out = null }) {
  const dir = path.join(cwd, ".mapkeeper");
  ensureDir(dir);
  const ignore = path.join(dir, ".gitignore");
  if (!exists(ignore)) writeText(ignore, "*\n!.gitignore\n");
  const jsonFile = path.join(dir, "links.json");
  const mdFile = path.join(dir, "links.md");
  writeJson(jsonFile, report);
  writeText(mdFile, renderLinksMarkdown(report));
  let outFile = null;
  if (out) {
    outFile = path.resolve(cwd, out);
    writeText(outFile, renderLinksMarkdown(report));
  }
  return { json: jsonFile, md: mdFile, out: outFile };
}

export function linksBlocking(report) {
  return report.unresolved.some((item) => item.blocking !== false);
}

function loadGraph(cwd, graphPath) {
  const rel = graphPath ? normalizePath(graphPath, cwd) : "graphify-out/graph.json";
  const file = path.resolve(cwd, rel);
  if (!exists(file)) {
    return { present: false, path: rel, nodes: 0, nodeByFile: new Map(), mtime: null, valid: true, warnings: [] };
  }
  try {
    const graph = readJson(file);
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const nodeByFile = new Map();
    for (const node of nodes) {
      const source = normalizedFile(node.source_file, cwd);
      if (!source || !node.id) continue;
      if (!nodeByFile.has(source)) nodeByFile.set(source, []);
      nodeByFile.get(source).push(String(node.id));
    }
    return {
      present: true,
      path: rel,
      nodes: nodes.length,
      nodeByFile,
      mtime: mtimeIso(file),
      valid: true,
      warnings: [],
    };
  } catch (error) {
    return {
      present: true,
      path: rel,
      nodes: 0,
      nodeByFile: new Map(),
      mtime: mtimeIso(file),
      valid: false,
      warnings: [`graphify cache is not valid JSON: ${error.message}`],
    };
  }
}

function parseSpec(cwd) {
  const featureDir = resolveFeatureDir(cwd);
  if (!featureDir) {
    return {
      present: false,
      feature_dir: null,
      requirements: new Map(),
      tasks: [],
      feature_mtime: null,
      warnings: ["spec-kit feature not found"],
    };
  }
  const specFile = path.join(cwd, featureDir, "spec.md");
  const tasksFile = path.join(cwd, featureDir, "tasks.md");
  const specText = readText(specFile, "");
  const tasksText = readText(tasksFile, "");
  const requirements = new Map();
  const tasks = [];
  const warnings = [];
  const mtimes = [specFile, tasksFile, path.join(cwd, featureDir, "plan.md")]
    .filter((file) => exists(file))
    .map(mtimeIso)
    .filter(Boolean)
    .sort();

  for (const line of specText.split("\n")) {
    for (const match of line.matchAll(REQUIREMENT_RE)) {
      const id = normalizeRequirement(match[1], match[2]);
      if (!requirements.has(id)) requirements.set(id, { id });
    }
  }

  for (const line of tasksText.split("\n")) {
    const match = line.match(/^\s*-\s*\[[ xX]\]\s*(T\d{2,})\b(.*)$/);
    if (!match) continue;
    const requirementsForTask = new Set();
    for (const requirement of match[2].matchAll(REQUIREMENT_RE)) {
      requirementsForTask.add(normalizeRequirement(requirement[1], requirement[2]));
    }
    tasks.push({
      id: match[1],
      requirements: requirementsForTask,
      files: new Set(fileMentions(match[2], cwd)),
    });
  }

  if (!specText) warnings.push(`spec.md not readable in ${featureDir}`);
  if (!tasksText) warnings.push(`tasks.md not readable in ${featureDir}`);

  return {
    present: true,
    feature_dir: featureDir,
    requirements,
    tasks,
    feature_mtime: mtimes.length ? mtimes[mtimes.length - 1] : null,
    warnings,
  };
}

function loadSecurity(cwd, runDir) {
  if (!runDir) {
    return { present: false, skipped: false, findings: [], verdicts: {}, warnings: [] };
  }
  const dir = path.resolve(cwd, runDir);
  if (!exists(dir)) {
    return {
      present: false,
      skipped: false,
      findings: [],
      verdicts: {},
      warnings: [`security run not found: ${runDir}`],
    };
  }
  const meta = readJsonSafe(path.join(dir, "run-metadata.json"));
  const findingsFile = path.join(dir, "findings.json");
  const findingsData = readJsonSafe(findingsFile);
  const records = normalizeFindings(findingsData);
  const verdicts = { confirmed: 0, needs_validation: 0, rejected: 0 };
  const findings = [];
  const warnings = [];
  const invalid = findingsData === null && exists(findingsFile);

  if (findingsData === null) warnings.push("findings.json is missing or unreadable");

  records.forEach((record, index) => {
    const verdict = normalizeVerdict(record.verdict || record.status);
    if (verdict === "rejected") {
      verdicts.rejected += 1;
      return;
    }
    if (verdict !== "confirmed" && verdict !== "needs_validation") {
      warnings.push(`finding ${index + 1} has an unknown verdict; treated as needs_validation`);
    }
    const normalizedVerdict = verdict === "confirmed" ? "confirmed" : "needs_validation";
    verdicts[normalizedVerdict] += 1;
    const id = String(record.fingerprint || record.id || record.candidate_id || `finding_${index + 1}`);
    const file = normalizedFile(
      record.file || record.path || record.source_file || record.location?.file,
      cwd,
    );
    findings.push({
      id,
      file,
      requirements: requirementsForFinding(record),
      verdict: normalizedVerdict,
      severity: normalizedVerdict === "confirmed" ? normalizeSeverity(record.severity) : null,
    });
  });

  return {
    present: true,
    skipped: false,
    invalid,
    path: runDir,
    run_id: meta?.run_id || path.basename(dir),
    run_status: meta?.run_status || null,
    source_ref:
      typeof meta?.source_ref === "string" ? meta.source_ref : meta?.source_ref?.commit || null,
    findings,
    verdicts,
    warnings,
  };
}

function requirementsForFinding(record) {
  const values = [];
  for (const key of ["requirements", "requirement_ids", "spec_refs"]) {
    if (Array.isArray(record[key])) values.push(...record[key]);
  }
  const out = new Set();
  for (const value of values) {
    for (const match of String(value).matchAll(REQUIREMENT_RE)) {
      out.add(normalizeRequirement(match[1], match[2]));
    }
  }
  return [...out].sort();
}

function fileMentions(text, cwd) {
  const tokens = new Set();
  for (const match of text.matchAll(/`([^`]+)`/g)) tokens.add(match[1]);
  for (const match of text.matchAll(/(?:^|\s)((?:\.{0,2}\/)?[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,8})/g)) {
    tokens.add(match[1]);
  }
  for (const match of text.matchAll(new RegExp(`(?<![A-Za-z0-9_./-])([A-Za-z0-9_.-]+${PATH_EXTENSIONS.source})(?![A-Za-z0-9_.-])`, "gi"))) {
    tokens.add(match[1]);
  }
  const files = new Set();
  for (const token of tokens) {
    const clean = token
      .replace(/^[("'`]+/, "")
      .replace(/#.*$/, "")
      .replace(/:\d+$/, "")
      .replace(/[)"'`,.;:]+$/, "")
      .replace(/^\.\//, "");
    if (!clean || /^https?:/.test(clean) || clean.startsWith("#")) continue;
    if (/^(specs|\.specify|project-map|\.mapkeeper|graphify-out)\//.test(clean)) continue;
    if (!clean.includes("/") && !PATH_EXTENSIONS.test(clean)) continue;
    const normalized = normalizePath(clean, cwd);
    if (normalized) files.add(normalized);
  }
  return [...files].sort();
}

function normalizeRequirement(prefix, number) {
  return `${prefix}-${String(number).padStart(3, "0")}`;
}

function normalizeVerdict(value) {
  const verdict = String(value || "").toLowerCase();
  if (verdict === "confirmed" || verdict === "needs_validation" || verdict === "rejected") return verdict;
  if (["valid", "verified"].includes(verdict)) return "confirmed";
  if (["invalid", "false_positive", "disproved"].includes(verdict)) return "rejected";
  return verdict || "needs_validation";
}

function normalizeSeverity(value) {
  const severity = String(value || "").toLowerCase();
  return ["critical", "high", "medium", "low", "informational"].includes(severity)
    ? severity
    : "informational";
}

function sameRevision(left, right) {
  const cleanLeft = String(left).replace(/-dirty$/, "");
  const cleanRight = String(right).replace(/-dirty$/, "");
  return cleanLeft.startsWith(cleanRight) || cleanRight.startsWith(cleanLeft);
}

function dedupeLinks(links) {
  const seen = new Map();
  for (const link of links) {
    seen.set(`${link.type}|${link.from}|${link.to}`, link);
  }
  return [...seen.values()].sort(
    (a, b) => a.type.localeCompare(b.type) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
  );
}

function sortUnresolved(items) {
  return [...items].sort(
    (a, b) => a.kind.localeCompare(b.kind) || String(a.id).localeCompare(String(b.id)),
  );
}

function countByType(links) {
  const counts = {};
  for (const link of links) counts[link.type] = (counts[link.type] || 0) + 1;
  return counts;
}

function inputRow(provider, input, detail) {
  return `| ${provider} | ${input.present ? "yes" : "no"} | ${cell(detail(input))} |`;
}

function verdictSummary(verdicts) {
  return `confirmed ${verdicts.confirmed || 0}, needs_validation ${verdicts.needs_validation || 0}, rejected ${verdicts.rejected || 0}`;
}

function cell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}