#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readJson, readText } from "./lib/fs-utils.mjs";
import { validate } from "./lib/schema.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadSchema(name) {
  return readJson(path.join(ROOT, "schema", name));
}

export function validateGraphData(graph) {
  const errors = validate(graph, loadSchema("graph.schema.json"));
  if (errors.length) return errors;

  const ids = new Set();
  const nodes = new Map();
  for (const [i, node] of graph.nodes.entries()) {
    if (ids.has(node.id)) errors.push(`$.nodes[${i}]: duplicate node id "${node.id}"`);
    ids.add(node.id);
    nodes.set(node.id, node);

    const inferred = node.provenance?.relation_source === "INFERRED";
    const refs = [...(node.source_refs || []), ...(node.spec_refs || [])];
    if (!inferred && refs.length === 0) {
      errors.push(`$.nodes[${i}] (${node.id}): missing source_refs/spec_refs for a non-inferred node`);
    }
    if (inferred && !node.confidence) {
      errors.push(`$.nodes[${i}] (${node.id}): inferred node must carry confidence`);
    }
    if (node.verdict === "rejected") {
      errors.push(`$.nodes[${i}] (${node.id}): rejected security candidates must not be published`);
    }
    if (node.status === "needs_validation" && node.severity) {
      errors.push(`$.nodes[${i}] (${node.id}): needs_validation must not carry severity`);
    }
    if (node.severity && node.status !== "confirmed") {
      errors.push(`$.nodes[${i}] (${node.id}): severity requires status "confirmed"`);
    }
  }

  for (const [i, edge] of graph.edges.entries()) {
    if (!nodes.has(edge.source)) errors.push(`$.edges[${i}]: unknown source "${edge.source}"`);
    if (!nodes.has(edge.target)) errors.push(`$.edges[${i}]: unknown target "${edge.target}"`);
    if (edge.source === edge.target) errors.push(`$.edges[${i}]: self edge on "${edge.source}"`);
    if (edge.confidence !== "EXTRACTED" && typeof edge.confidence_score !== "number") {
      errors.push(`$.edges[${i}]: ${edge.confidence} edge needs confidence_score`);
    }
  }

  const counts = graph.meta?.counts || {};
  if (counts.nodes !== graph.nodes.length) {
    errors.push(`$.meta.counts.nodes=${counts.nodes} does not match ${graph.nodes.length} nodes`);
  }
  if (counts.edges !== graph.edges.length) {
    errors.push(`$.meta.counts.edges=${counts.edges} does not match ${graph.edges.length} edges`);
  }
  return errors;
}

export function validateGraphFile(file) {
  const graph = readJson(file);
  return validateGraphData(graph);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const file = process.argv[2] || "project-map/graph.json";
  if (!readText(file)) {
    console.error(`error: ${file} not found`);
    process.exit(2);
  }
  let errors;
  try {
    errors = validateGraphFile(file);
  } catch (error) {
    console.error(`error: ${file}: ${error.message}`);
    process.exit(2);
  }
  if (errors.length) {
    console.error(`invalid graph: ${file}`);
    for (const error of errors.slice(0, 50)) console.error(`  - ${error}`);
    if (errors.length > 50) console.error(`  ... ${errors.length - 50} more`);
    process.exit(1);
  }
  const graph = readJson(file);
  console.log(`ok: ${file} (${graph.nodes.length} nodes, ${graph.edges.length} edges)`);
}