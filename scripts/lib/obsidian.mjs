import path from "node:path";
import { ensureDir, exists, listFiles, readText, replaceManagedBlock, today, writeText } from "./fs-utils.mjs";

export const KIND_FOLDERS = {
  component: "20-Components",
  module: "20-Components",
  service: "20-Components",
  feature: "20-Components",
  requirement: "30-Requirements",
  decision: "40-Decisions",
  task: "50-Tasks",
  milestone: "50-Tasks",
  risk: "60-Risks-Issues",
  issue: "60-Risks-Issues",
  finding: "60-Risks-Issues",
  trust_boundary: "60-Risks-Issues",
  control: "60-Risks-Issues",
  database: "70-Data",
  data_entity: "70-Data",
  api: "70-Data",
  workflow: "70-Data",
  document: "80-Resources",
  file: "80-Resources",
  dependency: "80-Resources",
  project: "90-Meta",
  goal: "90-Meta",
  stakeholder: "90-Meta",
  user_role: "90-Meta",
  constraint: "90-Meta",
  environment: "90-Meta",
  deployment_target: "90-Meta",
  test: "90-Meta",
  assumption: "90-Meta",
  deliverable: "90-Meta",
};

export function noteName(id) {
  return String(id).replace(/[:/\\]/g, "-");
}

export function vaultPaths(vaultDir) {
  return {
    home: path.join(vaultDir, "00-Home.md"),
    index: path.join(vaultDir, "01-Index.md"),
    context: path.join(vaultDir, "02-LLM-Context.md"),
    architecture: path.join(vaultDir, "10-Architecture", "overview.md"),
  };
}

export function writeVault({ vaultDir, graph, contextNote, gaps = [] }) {
  ensureDir(vaultDir);
  const paths = vaultPaths(vaultDir);
  const edgesByNode = new Map();
  for (const edge of graph.edges) {
    if (!edgesByNode.has(edge.source)) edgesByNode.set(edge.source, { out: [], in: [] });
    if (!edgesByNode.has(edge.target)) edgesByNode.set(edge.target, { out: [], in: [] });
    edgesByNode.get(edge.source).out.push(edge);
    edgesByNode.get(edge.target).in.push(edge);
  }
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const written = [];
  const kept = new Set();

  for (const node of graph.nodes) {
    const folder = KIND_FOLDERS[node.kind] || "80-Resources";
    const file = path.join(vaultDir, folder, `${noteName(node.id)}.md`);
    kept.add(path.resolve(file));
    const links = edgesByNode.get(node.id) || { out: [], in: [] };
    const frontmatter = yaml({
      id: node.id,
      kind: node.kind,
      label: node.label,
      status: node.status,
      phase: node.phase || "",
      confidence: node.confidence || "",
      derivation: node.derivation,
      severity: node.severity || "",
      verdict: node.verdict || "",
      managed_by: "mapkeeper",
      tags: node.tags || [],
      source_refs: node.source_refs || [],
      spec_refs: node.spec_refs || [],
      last_verified: node.last_verified ? `${node.last_verified.date} ${node.last_verified.revision}`.trim() : "",
    });

    let body = readText(file, "");
    if (!body) {
      body = `---\n${frontmatter}---\n\n# ${escapeText(node.label)}\n\n## Notes\n\n_Add human notes here; Mapkeeper never edits this section._\n`;
    } else {
      body = upsertFrontmatter(body, frontmatter, escapeText(node.label));
    }

    body = replaceManagedBlock(
      body,
      "summary",
      [
        node.summary ? escapeText(node.summary) : "_No summary recorded._",
        "",
        `- **Status:** ${node.status}`,
        node.severity ? `- **Severity:** ${node.severity}` : null,
        node.verdict ? `- **Verdict:** ${node.verdict}` : null,
        node.provenance?.source_file ? `- **Source:** \`${node.provenance.source_file}\`` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );

    body = replaceManagedBlock(
      body,
      "relationships",
      relationshipLines(links, nodeById),
    );

    const sourceList = [...(node.source_refs || []), ...(node.spec_refs || [])];
    body = replaceManagedBlock(
      body,
      "evidence",
      sourceList.length ? sourceList.map((ref) => `- \`${ref}\``).join("\n") : "_No source references._",
    );

    body = humanNotesLast(body);
    writeText(file, body);
    written.push(file);
  }

  // hub notes
  const home = composeHub(paths.home, "Project Home", [
    ["overview", homeOverview(graph)],
    ["components", homeComponents(graph)],
    ["risks", homeRisks(graph)],
    ["coverage", homeCoverage(graph, gaps)],
  ]);
  writeText(paths.home, home);

  const index = composeHub(paths.index, "Index", [["index", indexTable(graph)]]);
  writeText(paths.index, index);

  const architecture = composeHub(paths.architecture, "Architecture Overview", [
    ["summary", architectureSummary(graph)],
    ["diagram", architectureDiagram(graph)],
  ]);
  writeText(paths.architecture, architecture);

  if (contextNote) writeText(paths.context, contextNote);

  kept.add(path.resolve(paths.home));
  kept.add(path.resolve(paths.index));
  kept.add(path.resolve(paths.architecture));
  kept.add(path.resolve(paths.context));
  return { written, prunable: findPrunable(vaultDir, kept) };
}

function upsertFrontmatter(body, frontmatter, title) {
  const block = `---\n${frontmatter}---\n`;
  if (/^---\n[\s\S]*?\n---\n/.test(body)) {
    return body.replace(/^---\n[\s\S]*?\n---\n/, block);
  }
  return `${block}\n# ${title}\n\n${body}`;
}

function humanNotesLast(body) {
  const index = body.indexOf("\n## Notes");
  if (index < 0) return body;
  const head = body.slice(0, index).trimEnd();
  const notes = body.slice(index + 1).trimEnd();
  return `${head}\n\n${notes}\n`;
}

function composeHub(file, title, blocks) {
  const existing = readText(file, "");
  let content = existing;
  if (!content) {
    content = `# ${title}\n\n`;
  }
  for (const [id, body] of blocks) content = replaceManagedBlock(content, id, body);
  return upsertFrontmatter(content, yaml({ managed_by: "mapkeeper", title }), title);
}

function homeOverview(graph) {
  const project = graph.nodes.find((node) => node.kind === "project");
  const counts = graph.meta?.counts || {};
  return [
    `**Project:** ${project?.label || graph.meta?.project_name || "unknown"}`,
    `**Phase:** ${graph.meta?.phase || "DURING"} · **Mode:** ${graph.meta?.update_mode || "INIT"} · **Revision:** \`${graph.meta?.source_revision || "worktree"}\``,
    `**Generated:** ${graph.meta?.generated_at || ""} · **Derivation:** ${Object.entries(counts.by_derivation || {})
      .map(([key, value]) => `${key}=${value}`)
      .join(", ")}`,
    "",
    `Nodes: ${counts.nodes ?? graph.nodes.length} · Edges: ${counts.edges ?? graph.edges.length}`,
    "",
    `- [[01-Index|Full index]]`,
    `- [[02-LLM-Context|LLM context]]`,
    `- [[10-Architecture/overview|Architecture overview]]`,
  ].join("\n");
}

function homeComponents(graph) {
  const ranked = degreeRank(graph)
    .filter((node) => ["component", "module", "service", "feature"].includes(node.kind))
    .slice(0, 12);
  if (!ranked.length) return "_No component nodes recorded._";
  return ranked
    .map((node) => `- [[${noteName(node.id)}|${escapeText(node.label)}]] — ${node.status} (${node.derivation})`)
    .join("\n");
}

function homeRisks(graph) {
  const risky = graph.nodes.filter(
    (node) => node.kind === "finding" || node.kind === "risk" || node.kind === "issue",
  );
  if (!risky.length) return "_No risks or findings recorded._";
  return risky
    .slice(0, 15)
    .map((node) => {
      const tag = node.severity ? `[${node.severity}] ` : node.verdict === "needs_validation" ? "[needs validation] " : "";
      return `- ${tag}[[${noteName(node.id)}|${escapeText(node.label)}]]`;
    })
    .join("\n");
}

function homeCoverage(graph, gaps) {
  const coverage = graph.coverage || {};
  const lines = [
    `- Mapped: ${coverage.mapped ?? "?"}`,
    `- Stale: ${coverage.stale ?? "?"}`,
    `- Unmapped: ${coverage.unmapped ?? "?"}`,
    `- Out of scope: ${coverage.out_of_scope ?? "?"}`,
  ];
  if (gaps.length) {
    lines.push("", "**Gaps**", ...gaps.slice(0, 10).map((gap) => `- ${escapeText(gap)}`));
  }
  return lines.join("\n");
}

function indexTable(graph) {
  const groups = new Map();
  for (const node of graph.nodes) {
    if (!groups.has(node.kind)) groups.set(node.kind, []);
    groups.get(node.kind).push(node);
  }
  const lines = [];
  for (const kind of [...groups.keys()].sort()) {
    lines.push(`### ${kind}`, "");
    for (const node of groups.get(kind).sort((a, b) => a.label.localeCompare(b.label))) {
      lines.push(`- [[${noteName(node.id)}|${escapeText(node.label)}]] — ${node.status}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function architectureSummary(graph) {
  const counts = graph.meta?.counts || {};
  const topEdges = [...graph.edges]
    .filter((edge) => edge.relation !== "contains")
    .slice(0, 40)
    .map((edge) => `- \`${edge.source}\` ${edge.relation} \`${edge.target}\` (${edge.confidence})`);
  return [
    `Graph: ${counts.nodes ?? graph.nodes.length} nodes, ${counts.edges ?? graph.edges.length} edges.`,
    "",
    "### Key relationships",
    "",
    ...(topEdges.length ? topEdges : ["_No relationships recorded._"]),
  ].join("\n");
}

function architectureDiagram(graph) {
  const nodes = degreeRank(graph).slice(0, 30);
  const ids = new Set(nodes.map((node) => node.id));
  const label = (node) => `${mermaidId(node.id)}["${escapeMermaid(node.label)}"]`;
  const lines = ["```mermaid", "graph TD"];
  for (const node of nodes) lines.push(`  ${label(node)}`);
  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    if (edge.relation === "contains") continue;
    lines.push(`  ${mermaidId(edge.source)} -->|${edge.relation}| ${mermaidId(edge.target)}`);
  }
  lines.push("```");
  return lines.join("\n");
}

function relationshipLines(links, nodeById) {
  const lines = [];
  if (links.out.length) {
    lines.push("**Outgoing**", "");
    for (const edge of links.out.slice(0, 30)) {
      lines.push(`- ${edge.relation} → [[${noteName(edge.target)}|${escapeText(nodeById.get(edge.target)?.label || edge.target)}]]`);
    }
    lines.push("");
  }
  if (links.in.length) {
    lines.push("**Incoming**", "");
    for (const edge of links.in.slice(0, 30)) {
      lines.push(`- [[${noteName(edge.source)}|${escapeText(nodeById.get(edge.source)?.label || edge.source)}]] → ${edge.relation}`);
    }
  }
  return lines.length ? lines.join("\n").trim() : "_No relationships recorded._";
}

export function vaultLinkAudit(vaultDir) {
  if (!exists(vaultDir)) return { missing: [], notes: 0 };
  const files = listFiles(vaultDir, (file) => file.endsWith(".md"));
  const names = new Set(files.map((file) => path.basename(file, ".md")));
  const missing = new Set();
  for (const file of files) {
    const text = readText(file, "");
    for (const match of text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      const target = match[1].replace(/^\.\//, "");
      if (target.startsWith("http")) continue;
      if (!names.has(path.basename(target, ".md"))) missing.add(`${path.basename(file)} -> ${target}`);
    }
  }
  return { missing: [...missing], notes: files.length };
}

export function findPrunable(vaultDir, kept) {
  const out = [];
  for (const file of listFiles(vaultDir, (f) => f.endsWith(".md"))) {
    const abs = path.resolve(file);
    if (kept.has(abs)) continue;
    const text = readText(file, "");
    if (!/managed_by:\s*"?(?:mapkeeper|mapper)"?/.test(text)) continue;
    if (humanContent(text).length > 20) continue;
    out.push(file);
  }
  return out;
}

function humanContent(text) {
  const withoutBlocks = text.replace(/<!-- (?:mapkeeper|mapper):begin[\s\S]*?<!-- (?:mapkeeper|mapper):end[^>]*-->/g, "");
  const withoutFrontmatter = withoutBlocks.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const withoutHeadings = withoutFrontmatter.replace(/^#.*$/gm, "");
  const withoutPlaceholder = withoutHeadings.replace(/_.*?(?:mapper|mapkeeper) never edits this section\._/gi, "");
  return withoutPlaceholder.replace(/\s+/g, " ").trim();
}

function degreeRank(graph) {
  const degree = new Map(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }
  return [...graph.nodes].sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0));
}

function yaml(data) {
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === "" || value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${JSON.stringify(String(item))}`);
    } else if (typeof value === "object") {
      lines.push(`${key}:`);
      for (const [k, v] of Object.entries(value)) lines.push(`  ${k}: ${JSON.stringify(String(v))}`);
    } else {
      lines.push(`${key}: ${JSON.stringify(String(value))}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function escapeText(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function escapeMermaid(value) {
  return String(value || "").replace(/["\[\]{}()]/g, " ").slice(0, 60);
}

function mermaidId(id) {
  return `n_${String(id).replace(/[^A-Za-z0-9_]/g, "_")}`;
}