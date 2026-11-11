#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readJson, readText, exists } from "./lib/fs-utils.mjs";
import { validate } from "./lib/schema.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function validateLedgerData(ledger, { baseDir = process.cwd(), checkEvidence = true } = {}) {
  const schema = readJson(path.join(ROOT, "schema", "ledger.schema.json"));
  const errors = validate(ledger, schema);
  if (errors.length) return errors;

  const ids = new Set();
  for (const [i, unit] of ledger.units.entries()) {
    if (ids.has(unit.id)) errors.push(`$.units[${i}]: duplicate unit id "${unit.id}"`);
    ids.add(unit.id);
    if (unit.status === "mapped" && unit.node_ids.length === 0) {
      errors.push(`$.units[${i}] (${unit.id}): mapped unit needs at least one node id`);
    }
    if (unit.status === "mapped" && (unit.evidence || []).length === 0) {
      errors.push(`$.units[${i}] (${unit.id}): mapped unit needs evidence`);
    }
    if (checkEvidence) {
      for (const ref of unit.evidence || []) {
        const file = ref.split("#")[0];
        if (file && !exists(path.resolve(baseDir, file))) {
          errors.push(`$.units[${i}] (${unit.id}): evidence file missing: ${file}`);
        }
      }
    }
  }
  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const file = process.argv[2] || "project-map/map-ledger.json";
  if (!readText(file)) {
    console.error(`error: ${file} not found`);
    process.exit(2);
  }
  let ledger;
  let errors;
  try {
    ledger = readJson(file);
    errors = validateLedgerData(ledger, { baseDir: path.dirname(path.dirname(path.resolve(file))) });
  } catch (error) {
    console.error(`error: ${file}: ${error.message}`);
    process.exit(2);
  }
  if (errors.length) {
    console.error(`invalid ledger: ${file}`);
    for (const error of errors.slice(0, 50)) console.error(`  - ${error}`);
    process.exit(1);
  }
  const counts = ledger.units.reduce((acc, u) => ((acc[u.status] = (acc[u.status] || 0) + 1), acc), {});
  console.log(
    `ok: ${file} (${ledger.units.length} units: ${Object.entries(counts)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ") || "empty"})`,
  );
}