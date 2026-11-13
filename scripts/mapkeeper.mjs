#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { exists } from "./lib/fs-utils.mjs";
import { buildLinks, linksBlocking, writeLinks } from "./lib/links.mjs";
import { buildStatus } from "./lib/status.mjs";
import { loadState, refreshState } from "./lib/state.mjs";

function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const cwd = path.resolve(flags.dir || process.cwd());

  switch (command) {
    case "status":
      return commandStatus(cwd, flags);
    case "links":
      return commandLinks(cwd, flags);
    case "help":
    case "":
    case undefined:
      printHelp();
      return 0;
    default:
      console.error(`error: unknown command "${command}"`);
      console.error("Mapkeeper v3 is a router. Use `mapkeeper status`, `mapkeeper links`, or /mapkeeper.");
      printHelp();
      return 2;
  }
}

function commandStatus(cwd, flags) {
  const previous = loadState(cwd);
  const state = refreshState({ cwd, previous, write: flags.noWrite !== true });
  const result = buildStatus({ cwd, state });
  if (flags.json === true) {
    console.log(JSON.stringify({ state, checks: { failures: result.failures, warnings: result.warnings } }, null, 2));
  } else {
    console.log(result.human);
  }
  return flags.check === true && result.failures.length ? 1 : 0;
}

function commandLinks(cwd, flags) {
  const previous = loadState(cwd);
  const runInput = flags.run ? path.resolve(cwd, flags.run) : null;
  if (runInput && !exists(runInput)) {
    console.error(`error: security run directory not found: ${flags.run}`);
    return 1;
  }

  const state = refreshState({
    cwd,
    previous,
    runDir: runInput,
    write: flags.noWrite !== true,
  });

  const runDir = flags.noSecurity === true ? null : runInput || state.providers.security.last_run;
  const report = buildLinks({
    cwd,
    graphPath: flags.graph || null,
    runDir,
    includeSecurity: flags.noSecurity !== true,
  });

  const inputCount = [
    report.inputs.graphify.present,
    report.inputs.speckit.present,
    report.inputs.security.present,
  ].filter(Boolean).length;

  if (!inputCount) {
    console.error("error: no inputs found (graphify cache, spec-kit feature, or security run).");
    console.error("Run Graphify, initialize spec-kit, or pass --run <security-run-dir>, then retry.");
    return 1;
  }

  const written = writeLinks({ cwd, report, out: flags.out || null });
  if (flags.json === true) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `inputs: graphify ${report.inputs.graphify.present ? `${report.inputs.graphify.nodes} nodes` : "absent"} · ` +
        `spec-kit ${report.inputs.speckit.present ? `${report.inputs.speckit.feature_dir} (${report.inputs.speckit.requirements} req, ${report.inputs.speckit.tasks} tasks)` : "absent"} · ` +
        `security ${report.inputs.security.present ? `${report.inputs.security.run_id} (${report.inputs.security.findings} findings)` : report.inputs.security.skipped ? "skipped" : "absent"}`,
    );
    console.log(
      `links: ${report.counts.links} · unresolved: ${report.counts.unresolved} · graph nodes: ${report.counts.graph_nodes}`,
    );
    if (report.counts.unresolved) {
      for (const item of report.unresolved.slice(0, 12)) {
        const detail = [item.file, item.requirement].filter(Boolean).join(" · ");
        console.log(`  - ${item.kind}: ${item.id}${detail ? ` (${detail})` : ""}`);
      }
      if (report.unresolved.length > 12) console.log(`  … ${report.unresolved.length - 12} more`);
    }
    for (const warning of report.warnings) console.log(`  warning: ${warning}`);
    console.log(`wrote ${path.relative(cwd, written.json)} and ${path.relative(cwd, written.md)}`);
    if (written.out) console.log(`published ${path.relative(cwd, written.out)}`);
  }

  return flags.check === true && linksBlocking(report) ? 1 : 0;
}

function parseArgs(argv) {
  const command = argv[0] || "help";
  const flags = {};
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inline] = arg.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (inline !== undefined) flags[key] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[key] = argv[++i];
    else flags[key] = true;
  }
  return { command, flags };
}

function printHelp() {
  console.log(`mapkeeper — router for Graphify, spec-kit, and security-audit

Usage:
  mapkeeper status [--json] [--check] [--dir <path>] [--no-write]
  mapkeeper links  [--run <dir>] [--graph <path>] [--no-security] [--out <path>]
                   [--json] [--check] [--dir <path>] [--no-write]
  mapkeeper help

Commands:
  status    detect providers, versions, native artifacts, staleness, and legacy maps
  links     cross-reference findings ↔ requirements ↔ tasks ↔ files ↔ Graphify nodes
  help      show this reference

Mapkeeper does not build graphs, run audits, or execute spec-kit commands. Use /mapkeeper
to route to the native provider, and /graphify, /speckit.*, or the security-audit skill.

Local output:
  .mapkeeper/state.json     provider provenance (gitignored by .mapkeeper/.gitignore)
  .mapkeeper/links.{json,md} cross-reference report
  --out <path>              publish a shareable Markdown copy

Exit codes:
  0  success (or warnings only)
  1  --check found blocking gaps, no inputs, or a requested run is missing
  2  usage error

Flags:
  --dir <path>      project root (default: cwd)
  --graph <path>    Graphify graph.json (default: graphify-out/graph.json)
  --run <dir>       security-audit run directory (default: last recorded run)
  --no-security     omit security findings from links
  --no-write        do not refresh .mapkeeper/state.json
  --check           non-zero exit when blocking gaps or failures exist
  --json            machine-readable output
  --out <path>      write a shareable Markdown copy`);
}

process.exitCode = main();