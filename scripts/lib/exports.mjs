import path from "node:path";
import { ensureDir, estimateTokens, readText, replaceManagedBlock, today, writeText } from "./fs-utils.mjs";
import { noteName } from "./obsidian.mjs";

export function buildArchitecture({ graph, ledger, gaps = [], security = null }) {
  const nodes = graph.nodes;
  const byKind = (kind) => nodes.filter((node) => node.kind === kind);
  const coverage = graph.coverage || {};
  const findings = byKind("finding");
  const confirmed = findings.filter((node) => node.status === "confirmed");
  const needsValidation = findings.filter((node) => node.status === "needs_validation");
  const risks = [...byKind("risk"), ...byKind("issue")];
  const requirements = byKind("requirement");
  const tasks = byKind("task");
  const components = byKind("component").concat(byKind("module"), byKind("service"), byKind("feature"));
  const taskByRequirement = new Map();
  for (const edge of graph.edges) {
    if (edge.relation !== "satisfies_requirement") continue;
    if (!taskByRequirement.has(edge.target)) taskByRequirement.set(edge.target, []);
    taskByRequirement.get(edge.target).push(edge.source);
  }

  const requirementRows = requirements.map((req) => {
    const sources = taskByRequirement.get(req.id) || [];
    const code = graph.edges
      .filter((edge) => edge.target === req.id && edge.relation === "implements")
      .map((edge) => edge.source);
    return {
      requirement: req.label,
      id: req.id,
      status: req.status,
      tasks: sources.map((id) => nodes.find((n) => n.id === id)?.label || id),
      code,
      covered: sources.length + code.length > 0,
    };
  });

  return {
    schema_version: 1,
    project: graph.meta?.project_name || "unknown",
    phase: graph.meta?.phase || "DURING",
    revision: graph.meta?.source_revision || "worktree",
    generated_at: graph.meta?.generated_at || "",
    derivation: graph.meta?.graphify || { available: false },
    summary: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      components: components.length,
      requirements: requirements.length,
      tasks: tasks.length,
      findings_confirmed: confirmed.length,
      findings_needs_validation: needsValidation.length,
      risks: risks.length,
    },
    coverage,
    components: components
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((node) => ({ id: node.id, label: node.label, status: node.status, summary: node.summary })),
    requirements: requirementRows,
    findings: confirmed.map(findingRow),
    needs_validation: needsValidation.map(findingRow),
    security_run: security
      ? { run_id: security.run_id, counts: security.counts, stale: security.stale }
      : null,
    risks: risks.map((node) => ({ id: node.id, label: node.label, status: node.status })),
    decisions: byKind("decision").map((node) => ({ id: node.id, label: node.label })),
    dependencies: byKind("dependency").map((node) => ({ id: node.id, label: node.label, version: node.summary })),
    assumptions: graph.meta?.assumptions || [],
    unknowns: graph.meta?.unknowns || [],
    gaps,
    next_actions: nextActions(graph, ledger, gaps),
    notes: byKind("document").length,
  };
}

export function renderArchitectureMarkdown(arch) {
  const lines = [
    `# Architecture Overview — ${arch.project}`,
    "",
    `- **Phase:** ${arch.phase}`,
    `- **Revision:** \`${arch.revision}\``,
    `- **Generated:** ${arch.generated_at}`,
    `- **Graphify:** ${arch.derivation.available ? `available (${arch.derivation.version || "unknown version"})` : "not used"}`,
    "",
    "## Summary",
    "",
    `- Components: ${arch.summary.components}`,
    `- Requirements: ${arch.summary.requirements} (${arch.requirements.filter((r) => r.covered).length} covered)`,
    `- Tasks: ${arch.summary.tasks}`,
    `- Findings: ${arch.summary.findings_confirmed} confirmed, ${arch.summary.findings_needs_validation} needs validation`,
    `- Risks/issues: ${arch.summary.risks}`,
    "",
    "## Coverage",
    "",
    `| Mapped | Stale | Unmapped | Out of scope |`,
    `| --- | --- | --- | --- |`,
    `| ${arch.coverage.mapped ?? "?"} | ${arch.coverage.stale ?? "?"} | ${arch.coverage.unmapped ?? "?"} | ${arch.coverage.out_of_scope ?? "?"} |`,
    "",
    "## Components",
    "",
    arch.components.length ? "| Component | Status | Summary |" : "_No components recorded._",
    arch.components.length ? "| --- | --- | --- |" : "",
    ...arch.components.map((c) => `| [[${noteName(c.id)}\\|${esc(c.label)}]] | ${c.status} | ${esc(c.summary || "")} |`),
    "",
    "## Requirements traceability",
    "",
    arch.requirements.length ? "| Requirement | Status | Satisfied by |" : "_No requirements recorded._",
    arch.requirements.length ? "| --- | --- | --- |" : "",
    ...arch.requirements.map(
      (r) =>
        `| ${esc(r.requirement)} | ${r.status}${r.covered ? "" : " **(gap)**"} | ${esc([...r.tasks, ...r.code].join(", ") || "—")} |`,
    ),
    "",
    "## Security findings",
    "",
    "### Confirmed",
    "",
    ...(arch.findings.length
      ? ["| Severity | Finding | Location |", "| --- | --- | --- |", ...arch.findings.map(findingLine)]
      : ["_None._"]),
    "",
    "### Needs validation (no severity assigned)",
    "",
    ...(arch.needs_validation.length
      ? ["| Finding | Location |", "| --- | --- |", ...arch.needs_validation.map(validationLine)]
      : ["_None._"]),
    "",
    "## Risks and issues",
    "",
    ...(arch.risks.length ? arch.risks.map((r) => `- [[${noteName(r.id)}\\|${esc(r.label)}]] — ${r.status}`) : ["_None recorded._"]),
    "",
    "## Decisions",
    "",
    ...(arch.decisions.length ? arch.decisions.map((d) => `- [[${noteName(d.id)}\\|${esc(d.label)}]]`) : ["_None recorded._"]),
    "",
    "## Dependencies",
    "",
    ...(arch.dependencies.length
      ? arch.dependencies.map((d) => `- ${esc(d.label)} ${d.version ? `(\`${esc(d.version)}\`)` : ""}`)
      : ["_None recorded._"]),
    "",
    "## Assumptions and unknowns",
    "",
    ...(arch.assumptions.length ? arch.assumptions.map((a) => `- Assumption: ${esc(a)}`) : []),
    ...(arch.unknowns.length ? arch.unknowns.map((u) => `- Unknown: ${esc(u)}`) : []),
    ...(arch.assumptions.length || arch.unknowns.length ? [] : ["_None recorded._"]),
    "",
    "## Gaps",
    "",
    ...(arch.gaps.length ? arch.gaps.map((g) => `- ${esc(g)}`) : ["_None detected._"]),
    "",
    "## Recommended next actions",
    "",
    ...(arch.next_actions.length ? arch.next_actions.map((a) => `- ${esc(a)}`) : ["_None._"]),
  ];
  return `${lines.join("\n")}\n`;
}

export function renderArchitectureHtml(arch) {
  const md = renderArchitectureMarkdown(arch);
  const body = simpleMarkdownToHtml(md);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Architecture Overview — ${esc(arch.project)}</title>
<style>
:root{color-scheme:light dark;--bg:#f8fafc;--fg:#0f172a;--muted:#475569;--line:#cbd5e1;--card:#fff;--accent:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:#0b1120;--fg:#e2e8f0;--muted:#94a3b8;--line:#1e293b;--card:#111a2e;--accent:#60a5fa}}
*{box-sizing:border-box}body{margin:0;padding:2rem 1rem;background:var(--bg);color:var(--fg);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:60rem;margin:0 auto}
h1,h2,h3{line-height:1.25;margin:1.6em 0 .5em}h1{font-size:1.9rem}h2{font-size:1.3rem;border-bottom:1px solid var(--line);padding-bottom:.3rem}
table{width:100%;border-collapse:collapse;margin:.8rem 0;font-size:.92rem}
th,td{border:1px solid var(--line);padding:.45rem .6rem;text-align:left;vertical-align:top}
th{background:var(--card)}
code{background:var(--card);border:1px solid var(--line);border-radius:.3rem;padding:.05rem .3rem;font-size:.9em}
details{background:var(--card);border:1px solid var(--line);border-radius:.5rem;padding:.5rem .9rem;margin:.6rem 0}
summary{cursor:pointer;font-weight:600}
.lede{color:var(--muted)}
a{color:var(--accent)}
</style>
</head>
<body>
<main>
<p class="lede">Generated from project-map/graph.json — revision <code>${esc(arch.revision)}</code></p>
${body}
</main>
</body>
</html>
`;
}

export function writeArchitecture({ outDir, arch }) {
  ensureDir(outDir);
  writeText(path.join(outDir, "architecture-overview.md"), renderArchitectureMarkdown(arch));
  writeText(path.join(outDir, "architecture-overview.json"), `${JSON.stringify(arch, null, 2)}\n`);
  writeText(path.join(outDir, "architecture-overview.html"), renderArchitectureHtml(arch));
}

export function writeSyncSummary({ outDir, mode, graph, ledger, gaps, warnings, generation, artifacts }) {
  const file = path.join(outDir, "sync-summary.md");
  let content = readText(file, "");
  if (!content) {
    content = `# Sync Summary\n\nHuman notes can live outside the managed blocks.\n`;
  }
  const latest = [
    `## Latest run`,
    "",
    `- Date: ${today()}`,
    `- Mode: ${mode}`,
    `- Phase: ${graph.meta?.phase || "DURING"}`,
    `- Source revision: \`${graph.meta?.source_revision || "worktree"}\``,
    `- Generation: ${generation}`,
    `- Graphify: ${graph.meta?.graphify?.available ? `available (${graph.meta.graphify.version || "unknown"})` : "not used"}`,
    "",
    "### Coverage",
    "",
    `- Mapped: ${graph.coverage?.mapped ?? "?"} / ${graph.coverage?.units_total ?? "?"}`,
    `- Stale: ${graph.coverage?.stale ?? "?"}`,
    `- Unmapped: ${graph.coverage?.unmapped ?? "?"}`,
    `- Out of scope: ${graph.coverage?.out_of_scope ?? "?"}`,
    "",
    "### Artifacts",
    "",
    ...artifacts.map((artifact) => `- \`${artifact}\``),
    "",
    "### Gaps",
    "",
    ...(gaps.length ? gaps.slice(0, 25).map((gap) => `- ${gap}`) : ["_None detected._"]),
    "",
    "### Warnings",
    "",
    ...(warnings.length ? warnings.slice(0, 25).map((warning) => `- ${warning}`) : ["_None._"]),
  ].join("\n");

  const unverified = graph.nodes
    .filter((node) => node.provenance?.relation_source === "INFERRED" || node.derivation === "llm")
    .slice(0, 25)
    .map((node) => `- \`${node.id}\` (${node.kind}, ${node.confidence || "unrated"})`);
  const unverifiedBlock = unverified.length ? unverified.join("\n") : "_None._";

  const history = (ledger?.runs || [])
    .slice(-10)
    .reverse()
    .map(
      (run) =>
        `- ${run.started_at || run.revision} · ${run.mode} · \`${run.revision}\` · ${Object.entries(run.counts || {})
          .map(([key, value]) => `${key}=${value}`)
          .join(", ")}`,
    )
    .join("\n");

  content = replaceManagedBlock(content, "latest", latest);
  content = replaceManagedBlock(content, "unverified", unverifiedBlock);
  content = replaceManagedBlock(content, "history", history || "_No runs recorded._");
  writeText(file, content);
  return file;
}

export function syncSummaryTokens(file) {
  return estimateTokens(readText(file, ""));
}

function findingRow(finding) {
  return {
    id: finding.id,
    label: finding.label,
    severity: finding.severity || "",
    location: (finding.source_refs || [])[0] || finding.provenance?.source_file || "",
  };
}

function findingLine(finding) {
  return `| ${esc(finding.severity)} | [[${noteName(finding.id)}\\|${esc(finding.label)}]] | \`${esc(finding.location || "")}\` |`;
}

function validationLine(finding) {
  return `| [[${noteName(finding.id)}\\|${esc(finding.label)}]] | \`${esc(finding.location || "")}\` |`;
}

function nextActions(graph, ledger, gaps) {
  const actions = [];
  const unmapped = (ledger?.units || []).filter((unit) => unit.status === "unmapped");
  const stale = (ledger?.units || []).filter((unit) => unit.status === "stale");
  if (unmapped.length) actions.push(`Map ${unmapped.length} unmapped unit(s): ${unmapped.slice(0, 3).map((u) => u.id).join(", ")}`);
  if (stale.length) actions.push(`Refresh ${stale.length} stale unit(s): ${stale.slice(0, 3).map((u) => u.id).join(", ")}`);
  const openGaps = gaps.slice(0, 5);
  actions.push(...openGaps);
  const needing = graph.nodes.filter((node) => node.status === "needs_validation");
  if (needing.length) actions.push(`Resolve ${needing.length} security candidate(s) with verdict needs_validation`);
  return actions;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function simpleMarkdownToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let inTable = false;
  let list = null;
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("```")) {
      closeList();
      const lang = line.slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      out.push(`<pre><code class="lang-${esc(lang)}">${esc(code.join("\n"))}</code></pre>`);
      continue;
    }
    if (/^\|/.test(line)) {
      closeList();
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      if (/^\|?[\s:-]+\|/.test(line) && cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
      if (!inTable) {
        out.push("<table>");
        inTable = true;
        out.push(`<thead><tr>${cells.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>`);
      } else {
        out.push(`<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`);
      }
      const next = lines[i + 1] || "";
      if (!/^\|/.test(next) && inTable) {
        out.push("</tbody></table>");
        inTable = false;
      }
      continue;
    }
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length, 6);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  if (inTable) out.push("</tbody></table>");
  return out.join("\n");
}

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1");
}