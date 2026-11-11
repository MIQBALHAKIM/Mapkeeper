import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "../scripts/lib/fs-utils.mjs";
import { validateGraphData } from "../scripts/validate-graph.mjs";
import { validateLedgerData } from "../scripts/validate-ledger.mjs";
import { validateContextText } from "../scripts/validate-context.mjs";
import { balanceErrors, managedBlock, replaceManagedBlock, readManagedBlock } from "../scripts/lib/fs-utils.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(HERE, "fixtures", name);

test("valid graph passes", () => {
  assert.deepEqual(validateGraphData(readJson(fixture("graph.valid.json"))), []);
});

test("invalid graph fails for refs, duplicates, verdicts and counts", () => {
  const errors = validateGraphData(readJson(fixture("graph.invalid.json")));
  const text = errors.join("\n");
  assert.match(text, /missing source_refs/);
  assert.match(text, /duplicate node id/);
  assert.match(text, /rejected security candidates/);
  assert.match(text, /needs_validation must not carry severity/);
  assert.match(text, /unknown target/);
  assert.match(text, /counts\.nodes/);
});

test("valid ledger passes with evidence check", () => {
  const errors = validateLedgerData(readJson(fixture("ledger.valid.json")), {
    baseDir: path.join(HERE, "fixtures"),
  });
  assert.deepEqual(errors, []);
});

test("invalid ledger fails for missing evidence and duplicate ids", () => {
  const errors = validateLedgerData(readJson(fixture("ledger.invalid.json")), {
    baseDir: path.join(HERE, "fixtures"),
    checkEvidence: false,
  });
  const text = errors.join("\n");
  assert.match(text, /duplicate unit id/);
  assert.match(text, /mapped unit needs evidence/);
});

test("context note validates within budget", () => {
  assert.deepEqual(validateContextText(readText(fixture("context.valid.md"))), []);
});

test("context note fails without frontmatter and over budget", () => {
  assert.match(validateContextText(readText(fixture("context.invalid.md"))).join("\n"), /frontmatter/);
  const over = readText(fixture("context.valid.md")) + "\n" + "word ".repeat(3000);
  assert.match(validateContextText(over, { maxTokens: 500 }).join("\n"), /budget is 500/);
});

test("managed blocks round-trip and preserve human text", () => {
  const original = "# Home\n\nHand-written intro.\n";
  const withBlock = replaceManagedBlock(original, "summary", "generated one");
  assert.equal(hasBalanced(withBlock), true);
  assert.match(withBlock, /Hand-written intro/);
  assert.equal(readManagedBlock(withBlock, "summary"), "generated one");
  const updated = replaceManagedBlock(withBlock, "summary", "generated two");
  assert.match(updated, /generated two/);
  assert.doesNotMatch(updated, /generated one/);
  assert.equal(updated.match(/mapkeeper:begin/g).length, 1);
  assert.equal(hasBalanced(managedBlock("x", "body")), true);
});

test("unbalanced blocks are reported", () => {
  assert.match(balanceErrors("<!-- mapkeeper:begin id=a -->\nbody\n").join("\n"), /unclosed/);
  assert.match(balanceErrors("<!-- mapkeeper:end id=a -->\n").join("\n"), /unopened/);
});

test("legacy mapper blocks are read and migrated on write", () => {
  const legacy = "<!-- mapper:begin id=summary -->\nold body\n<!-- mapper:end id=summary -->\n";
  assert.equal(readManagedBlock(legacy, "summary"), "old body");
  assert.equal(balanceErrors(legacy).length, 0);
  const updated = replaceManagedBlock(legacy, "summary", "new body");
  assert.match(updated, /mapkeeper:begin id=summary/);
  assert.doesNotMatch(updated, /mapper:begin/);
  assert.equal(readManagedBlock(updated, "summary"), "new body");
});

function hasBalanced(text) {
  return balanceErrors(text).length === 0;
}