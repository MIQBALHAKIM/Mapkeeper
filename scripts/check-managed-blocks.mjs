#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { balanceErrors, listFiles, readText, exists } from "./lib/fs-utils.mjs";

export function checkManagedBlocks(root) {
  if (!exists(root)) return { files: 0, errors: [] };
  const files = listFiles(root, (file) => file.endsWith(".md"));
  const errors = [];
  for (const file of files) {
    const text = readText(file, "");
    for (const error of balanceErrors(text)) {
      errors.push(`${path.relative(process.cwd(), file)}: ${error}`);
    }
  }
  return { files: files.length, errors };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const root = process.argv[2] || "project-map";
  const { files, errors } = checkManagedBlocks(root);
  if (errors.length) {
    console.error("unbalanced mapkeeper blocks:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`ok: ${files} markdown files, managed blocks balanced`);
}