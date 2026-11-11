import { estimateTokens, now, today } from "./fs-utils.mjs";
import { noteName } from "./obsidian.mjs";

export function buildContextNote({ graph, ledger, gaps = [], target = 1500, max = 2000 }) {
  const project = graph.meta?.project_name || "unknown";
  const phase = graph.meta?.phase || "DURING";
  const revision = graph.meta?.source_revision || "worktree";
  const nodes = graph.nodes;
  const goals = nodes.filter((node) => node.kind === "goal");
  const components = nodes.filter((node) => ["component", "module", "service", "feature"].includes(node.kind));
  const risks = nodes.filter((node) => node.kind === "risk" || node.kind === "issue");
  const findings = nodes.filter((node) => node.kind === "finding");
  const needsValidation = findings.filter((node) => node.status === "needs_validation");
  const confirmed = findings.filter((node) => node.status === "confirmed");
  const dependencies = nodes.filter((node) => node.kind === "dependency");
  const coverage = graph.coverage || {};
  const unmapped = (ledger?.units || []).filter((unit) => unit.status === "unmapped");
  const stale = (ledger?.units || []).filter((unit) => unit.status === "stale");
  const openRisks = risks.length + findings.length;

  const frontmatter = [
    "---",
    `project: ${JSON.stringify(project)}`,
    `phase: ${phase}`,
    `status: ${JSON.stringify(phase === "END" ? "handover" : "active")}`,
    `source_revision: ${JSON.stringify(revision)}`,
    `generated_at: ${JSON.stringify(now())}`,
    `budget_tokens: ${target}`,
    `open_risks: ${openRisks}`,
    `coverage_mapped: ${coverage.mapped ?? 0}`,
    `coverage_stale: ${coverage.stale ?? 0}`,
    `coverage_unmapped: ${coverage.unmapped ?? 0}`,
    "---",
  ];

  const header = [
    `# ${project} — LLM context`,
    "",
    `**Purpose.** ${goals[0]?.label || nodes.find((n) => n.kind === "project")?.summary || "Not recorded; infer from linked notes."}`,
    `**Phase.** ${phase} · **Revision.** \`${revision}\` · **Generated.** ${today()}`,
    `**Derivation.** graphify=${graph.meta?.graphify?.available ? "yes" : "no"} · nodes=${graph.nodes.length} · edges=${graph.edges.length}`,
    "",
    "**Key components.** " +
      (components.slice(0, 8).map((node) => `${node.label} (${node.status})`).join("; ") || "none recorded"),
    "",
    `**Dependencies.** ${dependencies.slice(0, 8).map((node) => `${node.label}${node.summary ? `@${node.summary}` : ""}`).join(", ") || "none recorded"}`,
    "",
    `**Coverage.** mapped ${coverage.mapped ?? 0}/${coverage.units_total ?? 0}, stale ${coverage.stale ?? 0}, unmapped ${coverage.unmapped ?? 0}`,
    "",
    "**Open risks.** " +
      ([...confirmed.map((n) => `${n.label} [${n.severity}]`), ...risks.map((n) => n.label), ...needsValidation.map((n) => `${n.label} [needs validation]`)].slice(0, 6).join("; ") ||
        "none recorded"),
    "",
    `**Next actions.** ${nextActions({ unmapped, stale, gaps, needsValidation }).slice(0, 4).join("; ") || "none"}`,
    "",
  ];

  const links = [
    "**Read next.**",
    "- [[00-Home|Home]]",
    "- [[10-Architecture/overview|Architecture overview]]",
    ...components.slice(0, 4).map((node) => `- [[${noteName(node.id)}|${node.label}]]`),
  ];

  const body = [...header, ...links].join("\n");
  const note = `${frontmatter.join("\n")}\n\n${body}\n`;

  if (estimateTokens(note) <= max) return note;

  // Trim: drop links, then reduce components, then drop risks detail.
  const trimmedComponents = components.slice(0, 4);
  const compact = [
    ...frontmatter,
    "",
    `# ${project} — LLM context`,
    "",
    `**Purpose.** ${goals[0]?.label || "Not recorded."}`,
    `**Phase.** ${phase} · **Revision.** \`${revision}\``,
    `**Components.** ${trimmedComponents.map((node) => `${node.label} (${node.status})`).join("; ") || "none"}`,
    `**Coverage.** mapped ${coverage.mapped ?? 0}/${coverage.units_total ?? 0}, unmapped ${coverage.unmapped ?? 0}`,
    `**Risks.** ${[...confirmed.map((n) => `${n.label} [${n.severity}]`), ...risks.map((n) => n.label)].slice(0, 4).join("; ") || "none"}`,
    `**Next.** ${nextActions({ unmapped, stale, gaps, needsValidation }).slice(0, 3).join("; ") || "none"}`,
    "",
    "- [[00-Home|Home]]",
  ].join("\n");
  return `${compact}\n`;
}

export function contextTokens(note) {
  return estimateTokens(note);
}

function nextActions({ unmapped, stale, gaps, needsValidation }) {
  const actions = [];
  if (unmapped.length) actions.push(`map ${unmapped.length} unmapped unit(s)`);
  if (stale.length) actions.push(`refresh ${stale.length} stale unit(s)`);
  if (needsValidation.length) actions.push(`resolve ${needsValidation.length} needs_validation finding(s)`);
  actions.push(...gaps.slice(0, 3));
  return actions;
}