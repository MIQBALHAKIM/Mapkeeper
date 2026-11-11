#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import {
  ensureDir,
  estimateTokens,
  exists,
  now,
  readJson,
  readText,
  sourceRevision,
  today,
  writeJson,
  writeText,
} from "./lib/fs-utils.mjs";
import {
  detectGraphify,
  finalizeGraph,
  loadGraphifyGraph,
  mergeGraph,
  projectGraphify,
  readPackageName,
  runGraphifyUpdate,
  scanSourceGraph,
} from "./lib/graphify.mjs";
import {
  applyCoverage,
  auditLedger,
  changedFiles,
  coverageFromLedger,
  loadLedger,
  markChanged,
  recordRun,
  saveLedger,
  seedLedger,
  upsertUnits,
} from "./lib/ledger.mjs";
import { ingestSpeckit } from "./lib/speckit.mjs";
import { ingestSecurity } from "./lib/security.mjs";
import { buildContextNote } from "./lib/context.mjs";
import { writeVault, vaultLinkAudit, vaultPaths } from "./lib/obsidian.mjs";
import { buildArchitecture, writeArchitecture, writeSyncSummary } from "./lib/exports.mjs";
import { runDoctor } from "./lib/doctor.mjs";
import { migrateGraph } from "./lib/migrate.mjs";
import { validateGraphData } from "./validate-graph.mjs";
import { validateLedgerData } from "./validate-ledger.mjs";
import { validateContextText } from "./validate-context.mjs";
import { checkManagedBlocks } from "./check-managed-blocks.mjs";

const ALIASES = {
  INIT: "init",
  SYNC: "sync",
  AUDIT: "audit",
  FULL: "full",
  "EXPORT ONLY": "export",
  "CONTEXT ONLY": "context",
  "GRAPHIFY ONLY": "graph",
};

main();

function main() {
  const argv = process.argv.slice(2);
  const { command, positional, flags } = parseArgs(argv);
  const cwd = path.resolve(flags.dir || process.cwd());
  const outDir = path.resolve(cwd, flags.out || "project-map");
  const opts = { cwd, outDir, flags, positional };

  try {
    switch (command) {
      case "init":
        return cmdBuild({ ...opts, mode: "INIT" });
      case "sync":
        return cmdBuild({ ...opts, mode: "SYNC" });
      case "full":
        return cmdBuild({ ...opts, mode: "FULL" });
      case "graph":
        return cmdBuild({ ...opts, mode: "GRAPH", graphOnly: true });
      case "specs":
        return cmdBuild({ ...opts, mode: "SPECS", specsOnly: true });
      case "security":
        return cmdSecurity(opts);
      case "export":
        return cmdExport(opts);
      case "context":
        return cmdContext(opts);
      case "audit":
        return cmdAudit(opts);
      case "doctor":
        return cmdDoctor(opts);
      case "migrate":
        return cmdMigrate(opts);
      case "query":
        return cmdQuery(opts);
      case "help":
      case "":
      case undefined:
        printHelp();
        return 0;
      default:
        console.error(`error: unknown command "${command}"`);
        printHelp();
        return 2;
    }
  } catch (error) {
    console.error(`error: ${error.message}`);
    if (flags.debug) console.error(error.stack);
    return 1;
  }
}

function parseArgs(argv) {
  if ((argv[0] || "").toUpperCase() === "MAPPER") argv = argv.slice(1);
  const first = argv[0] || "";
  let command = ALIASES[first.toUpperCase()] || first.toLowerCase();
  let start = 1;
  if (ALIASES[argv.slice(0, 2).join(" ").toUpperCase()]) {
    command = ALIASES[argv.slice(0, 2).join(" ").toUpperCase()];
    start = 2;
  }
  const flags = {};
  const positional = [];
  for (let i = start; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const [rawKey, inline] = arg.slice(2).split("=");
      const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (inline !== undefined) flags[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[key] = argv[++i];
      else flags[key] = true;
    } else {
      positional.push(arg);
    }
  }
  return { command, positional, flags };
}

function cmdBuild({ cwd, outDir, flags, mode, graphOnly = false, specsOnly = false }) {
  const startedAt = now();
  const revision = sourceRevision(cwd);
  const graphFile = path.join(outDir, "graph.json");
  const ledgerFile = path.join(outDir, "map-ledger.json");
  const existingGraph = exists(graphFile) ? safeJson(graphFile) : null;
  const existingLedger = loadLedger(ledgerFile);
  if (existingGraph && existingGraph.schema_version !== 2) {
    throw new Error("project-map/graph.json uses schema v1; run: node scripts/mapkeeper.mjs migrate");
  }
  const isSecurityMode = mode === "SECURITY";
  const lifecycleOnly = specsOnly || isSecurityMode;
  if ((specsOnly || isSecurityMode) && !existingGraph) throw new Error("no graph to merge into; run init first");

  const changed = mode === "SYNC" ? changedFiles(cwd, existingLedger?.source_revision) : null;
  const warnings = [];
  const phase = flags.phase || existingGraph?.meta?.phase || "DURING";
  const projectName = flags.name || existingGraph?.meta?.project_name || readPackageName(cwd);

  const graphifyMode = String(flags.graphify || "auto").toLowerCase();
  const graphify = lifecycleOnly
    ? { available: Boolean(existingGraph?.meta?.graphify?.available), version: existingGraph?.meta?.graphify?.version || null, reason: null }
    : detectGraphify({ cwd, mode: graphifyMode });
  let graphifyRaw = null;
  let fallbackReason = null;

  const cacheExists = !lifecycleOnly && exists(path.join(cwd, "graphify-out", "graph.json"));
  const shouldRunTool = !lifecycleOnly && graphify.available && cacheExists && (flags.runTool === true || mode === "INIT");
  if (shouldRunTool) {
    const result = runGraphifyUpdate({ cwd });
    if (!result.ok) {
      warnings.push(`graphify update failed: ${result.error}`);
      fallbackReason = result.error;
    }
  }
  if (!lifecycleOnly) {
    graphifyRaw = loadGraphifyGraph(cwd);
    if (graphifyRaw) graphify.available = true;
    else if (graphify.available) fallbackReason = "graphify binary present but graphify-out/graph.json is missing";
  }

  let incoming;
  if (lifecycleOnly) {
    incoming = { nodes: [], edges: [], warnings: [] };
  } else if (graphifyRaw) {
    incoming = projectGraphify(graphifyRaw, { cwd, phase });
  } else if (mode === "SYNC" && changed && changed.length === 0) {
    incoming = { nodes: [], edges: [], warnings: [] };
  } else {
    incoming = scanSourceGraph({
      cwd,
      phase,
      files: mode === "SYNC" && changed ? changed : null,
    });
    if (graphify.available) fallbackReason = fallbackReason || "graphify cache unavailable; used deterministic scan";
  }
  warnings.push(...(incoming.warnings || []));
  if (fallbackReason) warnings.push(fallbackReason);

  const ingestSpecs = !graphOnly && !isSecurityMode && flags.specs !== false && flags.noSpecs !== true;
  const securityRun = flags.securityRun || flags.security;
  if (securityRun && securityRun !== true && !exists(path.resolve(cwd, securityRun))) {
    throw new Error(
      `security run directory not found: ${securityRun}\n` +
        "produce one with the security-audit skill, or install it:\n" +
        "  npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit",
    );
  }
  const ingestSec = !graphOnly && Boolean(securityRun) && securityRun !== true;
  const stripDerivations = [];
  if (ingestSpecs) stripDerivations.push("speckit");
  if (ingestSec) stripDerivations.push("security");

  const spec = ingestSpecs
    ? ingestSpeckit({ cwd })
    : { available: false, nodes: [], edges: [], units: [], gaps: [], warnings: [] };
  warnings.push(...(spec.warnings || []));

  const strip = stripDerivations;
  let baseNodes;
  let baseEdges;
  if (lifecycleOnly) {
    baseNodes = (existingGraph?.nodes || []).filter((node) => !strip.includes(node.derivation));
    const ids = new Set(baseNodes.map((node) => node.id));
    baseEdges = (existingGraph?.edges || []).filter(
      (edge) => ids.has(edge.source) && ids.has(edge.target),
    );
  } else {
    const merged = mergeGraph(existingGraph, incoming, { changedFiles: changed, stripDerivations: strip });
    baseNodes = merged.nodes || [];
    baseEdges = merged.edges || [];
  }

  let nodes = dedupeById([...baseNodes, ...(spec.nodes || [])]);
  let edges = dedupeEdges([...baseEdges, ...(spec.edges || [])]);

  const security = ingestSec
    ? ingestSecurity({ cwd, runDir: securityRun, revision, graph: { nodes, edges } })
    : { available: false, nodes: [], edges: [], counts: {}, warnings: [] };
  warnings.push(...(security.warnings || []));
  nodes = dedupeById([...nodes, ...(security.nodes || [])]);
  edges = dedupeEdges([...edges, ...(security.edges || [])]);
  const nodeIds = new Set(nodes.map((node) => node.id));
  edges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target);

  // mergeGraph returns {nodes, edges} only; carry warnings separately
  const outRel = path.relative(cwd, outDir).replace(/\\/g, "/") || ".";
  const graphRef = `${outRel === "." ? "" : `${outRel}/`}graph.json`;
  let ledger = seedLedger({ cwd, revision, existing: existingLedger });
  if (mode === "SYNC" && changed) markChanged(ledger, changed);
  if (ingestSpecs && spec.units.length) {
    upsertUnits(ledger, spec.units);
    for (const unit of ledger.units) {
      if (unit.kind !== "requirement") continue;
      const node = nodes.find((candidate) => candidate.id === unit.node_ids[0]);
      if (node) {
        unit.status = "mapped";
        unit.evidence = [`${graphRef}#nodes`];
        unit.last_verified_revision = revision;
        unit.last_verified_date = today();
      }
    }
  }
  ledger = applyCoverage(ledger, { nodes }, revision, { graphRef });
  const coverage = coverageFromLedger(ledger);

  const generation = graphifyRaw
    ? spec.nodes.length || security.nodes.length
      ? "graphify+llm"
      : "graphify"
    : graphify.available
      ? "graphify-fallback"
      : "llm-manual";

  const graph = finalizeGraph({
    nodes,
    edges,
    meta: {
      project_name: projectName,
      phase,
      update_mode: ["INIT", "SYNC", "AUDIT", "FULL"].includes(mode) ? mode : "SYNC",
      generated_at: now(),
      source_revision: revision,
      graphify: lifecycleOnly
        ? existingGraph?.meta?.graphify || { available: false, version: null, graph_path: null }
        : {
            available: Boolean(graphifyRaw),
            version: graphify.version,
            graph_path: graphifyRaw ? "graphify-out/graph.json" : null,
            used_cache: Boolean(graphifyRaw && !shouldRunTool),
          },
      generator: generation,
      assumptions: existingGraph?.meta?.assumptions || [],
      unknowns: existingGraph?.meta?.unknowns || [],
    },
    coverage,
  });

  const errors = validateGraphData(graph);
  if (errors.length) {
    const candidate = path.join(outDir, ".cache", "graph.candidate.json");
    writeJson(candidate, graph);
    throw new Error(`graph validation failed (${errors.length} errors); candidate at ${path.relative(cwd, candidate)}\n  - ${errors.slice(0, 5).join("\n  - ")}`);
  }

  ensureDir(outDir);
  writeJson(graphFile, graph);

  if (graphOnly || specsOnly || mode === "GRAPH") {
    writeJson(ledgerFile, ledger);
    printGraphResult({ mode, graph, generation, warnings, graphFile, cwd });
    return 0;
  }

  const gaps = [...(spec.gaps || []), ...auditLedger(ledger, { cwd, graph }).warnings];
  const arch = buildArchitecture({ graph, ledger, gaps, security: ingestSec ? security : null });
  writeArchitecture({ outDir, arch });

  const contextNote = buildContextNote({ graph, ledger, gaps, target: Number(flags.budget || 1500) });
  const contextErrors = validateContextText(contextNote);
  if (contextErrors.length) throw new Error(`context note invalid: ${contextErrors.join("; ")}`);

  const vault = writeVault({ vaultDir: path.join(outDir, "obsidian-vault"), graph, contextNote, gaps });
  if (flags.prune === true && vault.prunable.length) {
    for (const file of vault.prunable) fs.rmSync(file, { force: true });
    warnings.push(`pruned ${vault.prunable.length} orphaned note(s)`);
  }

  const artifacts = [
    `${outRel === "." ? "" : `${outRel}/`}graph.json`,
    `${outRel === "." ? "" : `${outRel}/`}map-ledger.json`,
    `${outRel === "." ? "" : `${outRel}/`}architecture-overview.md`,
    `${outRel === "." ? "" : `${outRel}/`}architecture-overview.json`,
    `${outRel === "." ? "" : `${outRel}/`}architecture-overview.html`,
    `${outRel === "." ? "" : `${outRel}/`}sync-summary.md`,
    `${outRel === "." ? "" : `${outRel}/`}obsidian-vault/`,
  ];
  recordRun(ledger, { mode, revision, startedAt, counts: coverage, artifacts });
  saveLedger(ledgerFile, ledger);
  writeSyncSummary({ outDir, mode, graph, ledger, gaps, warnings, generation, artifacts });

  const ledgerErrors = validateLedgerData(ledger, { baseDir: cwd });
  if (ledgerErrors.length) throw new Error(`ledger validation failed: ${ledgerErrors.slice(0, 5).join("; ")}`);
  const blockErrors = checkManagedBlocks(outDir).errors;
  if (blockErrors.length) throw new Error(`managed blocks invalid: ${blockErrors.slice(0, 3).join("; ")}`);

  printBuildResult({ mode, graph, generation, coverage, gaps, warnings, cwd, outDir, contextNote });
  if (flags.strict === true && warnings.length) return 1;
  return 0;
}

function cmdExport({ cwd, outDir, flags }) {
  const graphFile = path.join(outDir, "graph.json");
  if (!exists(graphFile)) throw new Error("project-map/graph.json missing; run init first");
  const graph = readJson(graphFile);
  if (graph.schema_version !== 2) throw new Error("graph.json uses schema v1; run: node scripts/mapkeeper.mjs migrate");
  const errors = validateGraphData(graph);
  if (errors.length) throw new Error(`graph invalid: ${errors.slice(0, 3).join("; ")}`);
  const ledger = loadLedger(path.join(outDir, "map-ledger.json")) || { units: [], runs: [] };
  const gaps = auditLedger(ledger, { cwd, graph }).warnings;
  const arch = buildArchitecture({ graph, ledger, gaps });
  writeArchitecture({ outDir, arch });
  const contextNote = buildContextNote({ graph, ledger, gaps, target: Number(flags.budget || 1500) });
  writeVault({ vaultDir: path.join(outDir, "obsidian-vault"), graph, contextNote, gaps });
  console.log(`exported architecture overview and vault in ${path.relative(cwd, outDir)}`);
  return 0;
}

function cmdContext({ cwd, outDir, flags }) {
  const graph = readJson(path.join(outDir, "graph.json"));
  if (graph.schema_version !== 2) throw new Error("graph.json uses schema v1; run: node scripts/mapkeeper.mjs migrate");
  const ledger = loadLedger(path.join(outDir, "map-ledger.json")) || { units: [], runs: [] };
  const gaps = auditLedger(ledger, { cwd, graph }).warnings;
  const note = buildContextNote({ graph, ledger, gaps, target: Number(flags.budget || 1500) });
  const errors = validateContextText(note);
  if (errors.length) throw new Error(errors.join("; "));
  const file = vaultPaths(path.join(outDir, "obsidian-vault")).context;
  writeText(file, note);
  console.log(`wrote ${path.relative(cwd, file)} (~${estimateTokens(note)} tokens)`);
  return 0;
}

function cmdAudit({ cwd, outDir, flags }) {
  const graphFile = path.join(outDir, "graph.json");
  const ledgerFile = path.join(outDir, "map-ledger.json");
  if (!exists(graphFile) || !exists(ledgerFile)) {
    console.error("missing project-map/graph.json or map-ledger.json; run init first");
    return 2;
  }
  const graph = readJson(graphFile);
  const ledger = readJson(ledgerFile);
  const problems = [];

  const graphErrors = validateGraphData(graph);
  problems.push(...graphErrors.map((error) => `graph: ${error}`));
  const ledgerErrors = validateLedgerData(ledger, { baseDir: cwd });
  problems.push(...ledgerErrors.map((error) => `ledger: ${error}`));

  const contextFile = vaultPaths(path.join(outDir, "obsidian-vault")).context;
  if (exists(contextFile)) problems.push(...validateContextText(readText(contextFile)).map((error) => `context: ${error}`));
  else problems.push("context: 02-LLM-Context.md missing");

  problems.push(...checkManagedBlocks(outDir).errors.map((error) => `blocks: ${error}`));

  for (const name of ["architecture-overview.md", "architecture-overview.html", "sync-summary.md"]) {
    if (!exists(path.join(outDir, name))) problems.push(`artifacts: ${name} missing`);
  }
  const archJson = path.join(outDir, "architecture-overview.json");
  if (!exists(archJson)) {
    problems.push("artifacts: architecture-overview.json missing");
  } else {
    try {
      const arch = readJson(archJson);
      if (arch.summary?.nodes !== graph.nodes.length) {
        problems.push(`artifacts: architecture-overview.json was built from ${arch.summary?.nodes ?? "?"} nodes, graph has ${graph.nodes.length}; run export`);
      }
    } catch (error) {
      problems.push(`artifacts: architecture-overview.json unreadable (${error.message})`);
    }
  }

  const links = vaultLinks(outDir);
  problems.push(...links.map((link) => `wikilink: ${link}`));

  const audit = auditLedger(ledger, { cwd, graph });
  const failures = [...problems, ...audit.failures];
  const warnings = [...audit.warnings];
  const coverage = graph.coverage || coverageFromLedger(ledger);

  console.log(`audit: ${failures.length} failure(s), ${warnings.length} warning(s)`);
  for (const failure of failures.slice(0, 40)) console.log(`  FAIL ${failure}`);
  for (const warning of warnings.slice(0, 40)) console.log(`  WARN ${warning}`);
  console.log(
    `coverage: mapped ${coverage.mapped ?? 0}/${coverage.units_total ?? 0}, stale ${coverage.stale ?? 0}, unmapped ${coverage.unmapped ?? 0}, out_of_scope ${coverage.out_of_scope ?? 0}`,
  );

  recordRun(ledger, {
    mode: "AUDIT",
    revision: graph.meta?.source_revision || "worktree",
    startedAt: now(),
    counts: coverage,
    artifacts: [],
  });
  saveLedger(ledgerFile, ledger);
  writeSyncSummary({
    outDir,
    mode: "AUDIT",
    graph,
    ledger,
    gaps: [...failures, ...warnings],
    warnings,
    generation: "audit-only",
    artifacts: [],
  });

  if (failures.length && flags.soft !== true) return 1;
  return 0;
}

function cmdSecurity({ cwd, outDir, flags, positional }) {
  const runDir = flags.run || flags.securityRun || positional[0];
  if (!runDir) throw new Error(
    "usage: mapkeeper security <run-dir> (or --run <dir>)\n" +
      "A run directory comes from the security-audit skill. To run an audit, ask for one first; this CLI does not audit code.",
  );
  return cmdBuild({ cwd, outDir, flags: { ...flags, securityRun: runDir }, mode: "SECURITY" });
}

function cmdDoctor({ cwd, outDir, flags }) {
  if (flags.migrate === true) {
    const code = cmdMigrate({ cwd, outDir, flags });
    if (code !== 0) return code;
  }
  const result = runDoctor({ cwd, outDir });
  for (const check of result.checks) {
    const tag = check.status === "ok" ? "OK  " : check.status === "warn" ? "WARN" : "FAIL";
    console.log(`[${tag}] ${check.id}: ${check.detail}`);
  }
  if (flags.json === true) console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

function cmdMigrate({ cwd, outDir, flags }) {
  const graphFile = path.join(outDir, "graph.json");
  if (!exists(graphFile)) throw new Error("project-map/graph.json missing; nothing to migrate");
  const result = migrateGraph({ graphFile, outDir });
  if (!result.migrated) {
    console.log(`nothing to migrate: ${result.reason}`);
    return 0;
  }
  for (const warning of result.warnings || []) console.log(`WARN ${warning}`);
  console.log(`migrated ${path.relative(cwd, graphFile)} to schema v2 (backup: ${path.relative(cwd, path.join(outDir, ".backup-v1"))})`);

  const revision = sourceRevision(cwd);
  const graph = readJson(graphFile);
  const outRel = path.relative(cwd, outDir).replace(/\\/g, "/") || ".";
  const graphRef = `${outRel === "." ? "" : `${outRel}/`}graph.json`;
  const ledgerFile = path.join(outDir, "map-ledger.json");
  let ledger = loadLedger(ledgerFile) || seedLedger({ cwd, revision });
  ledger = applyCoverage(ledger, graph, revision, { graphRef });
  const gaps = auditLedger(ledger, { cwd, graph }).warnings;
  const arch = buildArchitecture({ graph, ledger, gaps });
  writeArchitecture({ outDir, arch });
  const contextNote = buildContextNote({ graph, ledger, gaps, target: Number(flags.budget || 1500) });
  writeVault({ vaultDir: path.join(outDir, "obsidian-vault"), graph, contextNote, gaps });
  recordRun(ledger, { mode: "FULL", revision, startedAt: now(), counts: graph.coverage || {}, artifacts: [`${graphRef}`] });
  saveLedger(ledgerFile, ledger);
  writeSyncSummary({
    outDir,
    mode: "FULL",
    graph,
    ledger,
    gaps,
    warnings: result.warnings || [],
    generation: "migrated",
    artifacts: [`${outRel}/graph.json`],
  });

  if (flags.export === true) return cmdExport({ cwd, outDir, flags });
  return 0;
}

function cmdQuery({ cwd, outDir, positional, flags }) {
  const sub = positional[0];
  if (!sub) throw new Error('usage: mapkeeper query "<question>" | mapkeeper query path <a> <b> | mapkeeper query explain <node>');

  if (sub === "path" || sub === "explain" || sub === "query") {
    const graphify = detectGraphify({ cwd });
    if (graphify.available && exists(path.join(cwd, "graphify-out", "graph.json"))) {
      const args = sub === "query" ? ["query", positional.slice(1).join(" ")] : [sub, ...positional.slice(1)];
      const out = execFileSync("graphify", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      process.stdout.write(out);
      return 0;
    }
    if (sub === "query") positional = positional.slice(1);
    if (sub === "path") return queryPath({ cwd, outDir, positional: positional.slice(1) });
    if (sub === "explain") return queryExplain({ cwd, outDir, positional: positional.slice(1) });
  }

  const question = positional.join(" ");
  const graphify = detectGraphify({ cwd });
  if (graphify.available && exists(path.join(cwd, "graphify-out", "graph.json"))) {
    try {
      const out = execFileSync("graphify", ["query", question], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      process.stdout.write(out);
      return 0;
    } catch (error) {
      console.error(`graphify query failed, falling back to project-map/graph.json: ${error.message}`);
    }
  }
  return queryGraph({ cwd, outDir, question, budget: Number(flags.budget || 1500) });
}

function queryGraph({ cwd, outDir, question, budget }) {
  const graph = readJson(path.join(outDir, "graph.json"));
  const tokens = tokenize(question);
  const matches = graph.nodes
    .map((node) => ({ node, score: scoreNode(node, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((entry) => entry.node);
  if (!matches.length) {
    console.log(`no nodes matched "${question}" in project-map/graph.json`);
    return 0;
  }
  const picked = new Set(matches.map((node) => node.id));
  const edges = graph.edges.filter((edge) => picked.has(edge.source) && picked.has(edge.target));
  const lines = [`# Query: ${question}`, "", "## Nodes", ""];
  let used = 0;
  for (const node of matches) {
    const line = `- ${node.id} (${node.kind}, ${node.status}) ${node.label}${node.summary ? `: ${node.summary}` : ""}`;
    used += estimateTokens(line);
    if (used > budget) break;
    lines.push(line);
  }
  if (edges.length) {
    lines.push("", "## Relationships", "");
    for (const edge of edges.slice(0, 30)) lines.push(`- ${edge.source} ${edge.relation} ${edge.target} (${edge.confidence})`);
  }
  console.log(lines.join("\n"));
  return 0;
}

function queryPath({ cwd, outDir, positional }) {
  const [from, to] = positional;
  if (!from || !to) throw new Error("usage: mapkeeper query path <from-id> <to-id>");
  const graph = readJson(path.join(outDir, "graph.json"));
  const adj = new Map();
  for (const edge of graph.edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source).push(edge);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.target).push({ source: edge.target, target: edge.source, relation: edge.relation });
  }
  const start = graph.nodes.find((node) => node.id === from || node.label.toLowerCase() === from.toLowerCase());
  const goal = graph.nodes.find((node) => node.id === to || node.label.toLowerCase() === to.toLowerCase());
  if (!start || !goal) throw new Error("could not resolve both endpoints");
  const queue = [[start.id]];
  const seen = new Set([start.id]);
  while (queue.length) {
    const pathIds = queue.shift();
    const last = pathIds[pathIds.length - 1];
    if (last === goal.id) {
      console.log(pathIds.join(" -> "));
      return 0;
    }
    for (const edge of adj.get(last) || []) {
      if (seen.has(edge.target)) continue;
      seen.add(edge.target);
      queue.push([...pathIds, edge.target]);
    }
  }
  console.log(`no path from ${start.id} to ${goal.id} in the projected graph`);
  return 1;
}

function queryExplain({ cwd, outDir, positional }) {
  const term = positional.join(" ");
  if (!term) throw new Error("usage: mapkeeper query explain <node>");
  const graph = readJson(path.join(outDir, "graph.json"));
  const node = graph.nodes.find((candidate) => candidate.id === term || candidate.label.toLowerCase() === term.toLowerCase());
  if (!node) {
    console.log(`node "${term}" not found`);
    return 1;
  }
  console.log(JSON.stringify(node, null, 2));
  return 0;
}

function vaultLinks(outDir) {
  return vaultLinkAudit(path.join(outDir, "obsidian-vault")).missing;
}

function printBuildResult({ mode, graph, generation, coverage, gaps, warnings, cwd, outDir, contextNote }) {
  console.log(`${mode.toLowerCase()}: ${path.relative(cwd, outDir) || "."} (revision ${graph.meta.source_revision})`);
  console.log(`  generation: ${generation}${graph.meta.graphify.available ? ` (graphify ${graph.meta.graphify.version || "installed"})` : ""}`);
  console.log(`  nodes: ${graph.nodes.length} · edges: ${graph.edges.length} · context: ~${estimateTokens(contextNote)} tokens`);
  console.log(
    `  coverage: mapped ${coverage.mapped}/${coverage.units_total}, stale ${coverage.stale}, unmapped ${coverage.unmapped}, out_of_scope ${coverage.out_of_scope}`,
  );
  if (gaps.length) {
    console.log(`  gaps: ${gaps.length}`);
    for (const gap of gaps.slice(0, 5)) console.log(`    - ${gap}`);
  }
  if (warnings.length) {
    console.log(`  warnings: ${warnings.length}`);
    for (const warning of warnings.slice(0, 5)) console.log(`    - ${warning}`);
  }
  for (const artifact of ["graph.json", "map-ledger.json", "architecture-overview.md", "architecture-overview.html", "sync-summary.md", "obsidian-vault/"]) {
    console.log(`  wrote ${path.relative(cwd, outDir)}/${artifact}`);
  }
}

function printGraphResult({ mode, graph, generation, warnings, graphFile, cwd }) {
  console.log(`${mode.toLowerCase()}: ${path.relative(cwd, graphFile)} (${graph.nodes.length} nodes, ${graph.edges.length} edges, ${generation})`);
  for (const warning of warnings.slice(0, 8)) console.log(`  warning: ${warning}`);
}

function printHelp() {
  console.log(`mapkeeper — living project map for any repository

Usage:
  node scripts/mapkeeper.mjs <command> [options]

Commands:
  init                 create the project map (graph, ledger, vault, exports)
  sync                 incrementally update changed units
  audit                validate artifacts and report coverage gaps
  full                 rebuild all derived artifacts
  export               regenerate architecture-overview.{md,json,html} and the vault
  context              regenerate 02-LLM-Context.md only
  graph                regenerate project-map/graph.json only
  specs                ingest .specify/ artifacts and merge traceability
  security <run-dir>   ingest a security-audit run directory
  query "<question>"   delegate to graphify query, else traverse graph.json
  query path <a> <b>   shortest path between two nodes
  query explain <node> dump one node
  doctor               environment and artifact checks
  migrate              migrate a v1 project-map tree to schema v2

Options:
  --dir <path>         project root (default: cwd)
  --out <path>         output directory (default: project-map)
  --phase BEFORE|DURING|END
  --name <project>
  --graphify auto|manual|disabled
  --run-tool           invoke "graphify update" when a cache exists
  --security-run <dir> ingest a security-audit output directory
  --no-specs           skip .specify/ ingestion
  --budget <tokens>    context note budget (default 1500)
  --prune              delete orphaned mapkeeper-managed notes
  --soft               audit exits 0 even with failures
  --strict             non-zero exit on warnings
  --json               machine-readable output (doctor)
  --debug              print stack traces

Legacy aliases: MAPPER INIT|SYNC|AUDIT|FULL|EXPORT ONLY|CONTEXT ONLY|GRAPHIFY ONLY`);
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((word) => word.length > 2);
}

function scoreNode(node, tokens) {
  const haystack = `${node.id} ${node.label} ${node.summary || ""} ${(node.tags || []).join(" ")}`.toLowerCase();
  return tokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
}

function safeJson(file) {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function dedupeById(nodes) {
  const map = new Map();
  for (const node of nodes) map.set(node.id, node);
  return [...map.values()];
}

function dedupeEdges(edges) {
  const map = new Map();
  for (const edge of edges) map.set(`${edge.source}|${edge.relation}|${edge.target}`, edge);
  return [...map.values()];
}