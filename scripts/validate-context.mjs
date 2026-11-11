#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readJson, readText, estimateTokens } from "./lib/fs-utils.mjs";
import { validate } from "./lib/schema.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_MAX_TOKENS = 2000;

export function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: null, body: text };
  const data = {};
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!pair) continue;
    let value = pair[2].trim();
    if (/^-?\d+$/.test(value)) value = Number(value);
    else value = value.replace(/^["']|["']$/g, "");
    data[pair[1]] = value;
  }
  return { data, body: text.slice(match[0].length) };
}

export function validateContextText(text, { maxTokens = DEFAULT_MAX_TOKENS } = {}) {
  const errors = [];
  const { data, body } = parseFrontmatter(text);
  if (!data) return ["missing YAML frontmatter"];
  errors.push(...validate(data, readJson(path.join(ROOT, "schema", "context.schema.json"))));

  const tokens = estimateTokens(text);
  if (tokens > maxTokens) {
    errors.push(`note is ~${tokens} tokens, budget is ${maxTokens}; move detail into linked notes`);
  }
  if (body.trim().length < 40) errors.push("body is empty or too short to be useful context");
  if (!/^#\s+/m.test(body)) errors.push("body needs a top-level heading");
  if (data.coverage && typeof data.coverage !== "object") {
    errors.push("coverage must be an object when present");
  }
  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const args = process.argv.slice(2);
  let maxTokens = DEFAULT_MAX_TOKENS;
  let file = "project-map/obsidian-vault/02-LLM-Context.md";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--max-tokens") {
      maxTokens = Number(args[++i]);
    } else if (!args[i].startsWith("--")) {
      file = args[i];
    }
  }
  const text = readText(file);
  if (!text) {
    console.error(`error: ${file} not found`);
    process.exit(2);
  }
  const errors = validateContextText(text, { maxTokens });
  if (errors.length) {
    console.error(`invalid context note: ${file}`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`ok: ${file} (~${estimateTokens(text)} tokens, budget ${maxTokens})`);
}