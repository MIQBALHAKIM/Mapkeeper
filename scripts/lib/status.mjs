import path from "node:path";
import { exists, latestCommitTime, readJsonSafe } from "./fs-utils.mjs";

export function buildStatus({ cwd, state }) {
  const failures = [];
  const warnings = [];
  const providers = state.providers || {};
  const graphify = providers.graphify || {};
  const speckit = providers.speckit || {};
  const security = providers.security || {};

  if (!graphify.skill && !graphify.cli && !graphify.cache) {
    warnings.push("Graphify not detected (skill, CLI, or cache)");
  }
  if (graphify.cache) {
    const cache = readJsonSafe(path.join(cwd, graphify.cache));
    if (!cache) failures.push(`graphify cache is not valid JSON: ${graphify.cache}`);
  }

  if (!speckit.cli && !speckit.initialized) {
    warnings.push("spec-kit not detected (CLI and .specify/)");
  }
  if (speckit.initialized && !speckit.commands.length) {
    warnings.push("spec-kit is initialized but no speckit.* commands are installed");
  }
  if (speckit.initialized && !speckit.feature_dir) {
    warnings.push("spec-kit is initialized but no active feature with spec.md was found");
  }
  if (speckit.feature_dir && !exists(path.join(cwd, speckit.feature_dir, "tasks.md"))) {
    warnings.push(`spec-kit feature ${speckit.feature_dir} has no tasks.md`);
  }

  if (!security.skill) warnings.push("security-audit skill not detected");
  if (security.last_run) {
    if (!exists(security.last_run)) {
      warnings.push(`recorded security run is missing: ${security.last_run}`);
    } else {
      const findingsFile = path.join(security.last_run, "findings.json");
      if (!exists(findingsFile)) {
        warnings.push("security run has no findings.json");
      } else if (!readJsonSafe(findingsFile)) {
        failures.push("security findings.json is not valid JSON");
      }
      if (!exists(path.join(security.last_run, "run-metadata.json"))) {
        warnings.push("security run has no run-metadata.json");
      }
    }
  }

  const commitTime = latestCommitTime(cwd);
  if (graphify.cache_mtime && commitTime && graphify.cache_mtime < commitTime) {
    warnings.push("graphify cache is older than the latest commit");
  }
  if (speckit.feature_mtime && commitTime && speckit.feature_mtime < commitTime) {
    warnings.push("spec-kit feature files are older than the latest commit");
  }
  if (security.source_ref && state.source_revision !== "worktree") {
    const left = String(security.source_ref).replace(/-dirty$/, "");
    const right = String(state.source_revision).replace(/-dirty$/, "");
    if (!left.startsWith(right) && !right.startsWith(left)) {
      warnings.push(`security run was produced from ${security.source_ref}, current revision is ${state.source_revision}`);
    }
  }

  if (state.legacy?.project_map) {
    warnings.push(
      `legacy project-map/ detected (schema ${state.legacy.schema_version ?? "unknown"}); Mapkeeper v3 does not write it`,
    );
  }

  const human = [
    `Mapkeeper status — revision ${state.source_revision || "worktree"}`,
    "",
    `Graphify    ${providerLine([
      ["skill", graphify.skill ? "yes" : "no"],
      ["cli", graphify.version || (graphify.cli ? "installed" : "no")],
      ["cache", graphify.cache || "none"],
      ["report", graphify.report || "none"],
    ])}`,
    `spec-kit    ${providerLine([
      ["cli", speckit.version || (speckit.cli ? "installed" : "no")],
      ["initialized", speckit.initialized ? "yes" : "no"],
      ["feature", speckit.feature_dir || "none"],
      ["commands", speckit.commands_dir ? `${speckit.commands_dir} (${speckit.commands.length})` : "none"],
    ])}`,
    `security    ${providerLine([
      ["skill", security.skill ? "yes" : "no"],
      ["run", security.run_id || "none"],
      ["status", security.run_status || "unknown"],
      ["findings", String(security.findings || 0)],
    ])}`,
  ];

  if (state.legacy?.project_map) human.push("Legacy      project-map/ detected (read-only)");
  if (warnings.length) human.push("", "Warnings", ...warnings.map((warning) => `- ${warning}`));
  if (failures.length) human.push("", "Failures", ...failures.map((failure) => `- ${failure}`));

  return { human: human.join("\n"), failures, warnings };
}

function providerLine(parts) {
  return parts.map(([key, value]) => `${key}: ${value}`).join(" · ");
}