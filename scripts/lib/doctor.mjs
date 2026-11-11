import path from "node:path";
import { exists, estimateTokens, readText } from "./fs-utils.mjs";
import { validateGraphFile } from "../validate-graph.mjs";
import { validateLedgerData } from "../validate-ledger.mjs";
import { validateContextText } from "../validate-context.mjs";
import { checkManagedBlocks } from "../check-managed-blocks.mjs";
import { vaultLinkAudit } from "./obsidian.mjs";
import { detectGraphify } from "./graphify.mjs";
import { detectSpeckit } from "./speckit.mjs";
import { findSecuritySkill } from "./security.mjs";

export function runDoctor({ cwd = process.cwd(), outDir }) {
  const checks = [];
  const add = (id, status, detail) => checks.push({ id, status, detail });

  const major = Number(process.versions.node.split(".")[0]);
  add("node", major >= 20 ? "ok" : "fail", `node ${process.versions.node}`);

  const graphFile = path.join(outDir, "graph.json");
  if (!exists(graphFile)) {
    add("graph", "fail", `${rel(cwd, graphFile)} missing; run: node scripts/mapkeeper.mjs init`);
  } else {
    const errors = safe(() => validateGraphFile(graphFile));
    add("graph", errors.length ? "fail" : "ok", errors.length ? errors.slice(0, 3).join("; ") : "schema v2 valid");
  }

  const ledgerFile = path.join(outDir, "map-ledger.json");
  if (!exists(ledgerFile)) {
    add("ledger", "fail", `${rel(cwd, ledgerFile)} missing; run init or sync`);
  } else {
    const errors = safe(() => validateLedgerData(JSON.parse(readText(ledgerFile)), { baseDir: cwd }));
    add("ledger", errors.length ? "fail" : "ok", errors.length ? errors.slice(0, 3).join("; ") : "coverage ledger valid");
  }

  const contextFile = path.join(outDir, "obsidian-vault", "02-LLM-Context.md");
  if (!exists(contextFile)) {
    add("context", "fail", "02-LLM-Context.md missing");
  } else {
    const errors = validateContextText(readText(contextFile));
    add("context", errors.length ? "fail" : "ok", errors.length ? errors.slice(0, 2).join("; ") : `~${estimateTokens(readText(contextFile))} tokens`);
  }

  const blocks = checkManagedBlocks(outDir);
  add("blocks", blocks.errors.length ? "fail" : "ok", blocks.errors.length ? blocks.errors.slice(0, 3).join("; ") : `${blocks.files} files balanced`);

  const vault = path.join(outDir, "obsidian-vault");
  const links = vaultLinkAudit(vault);
  add("links", links.missing.length ? "warn" : "ok", links.missing.length ? `${links.missing.length} unresolved wikilinks (e.g. ${links.missing[0]})` : `${links.notes} notes, links resolve`);

  const graphify = detectGraphify({ cwd });
  add("graphify", graphify.available ? "ok" : "warn", graphify.available ? `${graphify.version || "installed"}${graphify.graph_path ? ", cache present" : ", no cache"}` : graphify.reason || "not available");

  const speckit = detectSpeckit(cwd);
  add("speckit", speckit.available ? "ok" : "warn", speckit.available ? `feature: ${speckit.feature_dir || "unresolved"}` : ".specify/ not found");

  const security = findSecuritySkill(cwd);
  add("security-skill", security ? "ok" : "warn", security ? rel(cwd, security) : "security-audit skill not installed (optional)");

  if (exists(ledgerFile)) {
    const ledger = JSON.parse(readText(ledgerFile));
    const stale = ledger.units.filter((unit) => unit.status === "stale").length;
    const unmapped = ledger.units.filter((unit) => unit.status === "unmapped").length;
    add("coverage", stale || unmapped ? "warn" : "ok", `${unmapped} unmapped, ${stale} stale, ${ledger.units.length} units`);
  }

  const artifacts = ["architecture-overview.md", "architecture-overview.json", "architecture-overview.html", "sync-summary.md"]
    .filter((name) => !exists(path.join(outDir, name)));
  add("artifacts", artifacts.length ? "fail" : "ok", artifacts.length ? `missing: ${artifacts.join(", ")}` : "exports present");

  return {
    ok: checks.every((check) => check.status !== "fail"),
    checks,
  };
}

function safe(fn) {
  try {
    return fn();
  } catch (error) {
    return [error.message];
  }
}

function rel(cwd, file) {
  const relative = path.relative(cwd, file).replace(/\\/g, "/");
  return relative.startsWith("..") ? file : relative || ".";
}