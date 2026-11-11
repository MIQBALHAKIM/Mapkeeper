#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readJson, readText, writeText } from "./lib/fs-utils.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "index.html");
const PROMPT = path.join(ROOT, "Mapkeeper_Prompt.md");
const VERSION = readJson(path.join(ROOT, "package.json")).version;

const SECTIONS = [
  ["overview", "SKILL.md", "Overview", "Overview"],
  ["install", "README.md", "Install", "Install"],
  ["commands", "references/commands.md", "Commands", "Commands"],
  ["contract", "references/contract.md", "Contract", "Contract"],
  ["modes", "references/modes.md", "Modes and phases", "Modes"],
  ["graphify", "references/graphify-adapter.md", "Graphify adapter", "Graphify"],
  ["schema", "references/schema.md", "Graph and ledger schema", "Schema"],
  ["obsidian", "references/obsidian.md", "Obsidian vault", "Vault"],
  ["exports", "references/architecture-exports.md", "Architecture exports", "Exports"],
  ["speckit", "references/speckit-adapter.md", "Spec-kit adapter", "Spec-kit"],
  ["security", "references/security-adapter.md", "Security-audit adapter", "Security"],
  ["troubleshooting", "references/troubleshooting.md", "Troubleshooting", "Troubleshooting"],
];

const check = process.argv.includes("--check");
const promptOnly = process.argv.includes("--prompt");

if (promptOnly) {
  const content = renderPromptShim();
  if (check) compare(PROMPT, content);
  else {
    writeText(PROMPT, content);
    console.log(`wrote ${path.relative(ROOT, PROMPT)}`);
  }
  process.exit(0);
}

function main() {
  const sections = SECTIONS.map(([id, file, title, nav]) => {
    const raw = readText(path.join(ROOT, file));
    if (raw === null) throw new Error(`missing source: ${file}`);
    return {
      id,
      nav,
      title,
      file,
      html: renderMarkdown(stripFrontmatter(raw), id),
    };
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Mapkeeper — a living project map: validated knowledge graph, coverage ledger, Obsidian vault, and architecture exports.">
<meta name="color-scheme" content="light dark">
<title>Mapkeeper — the living project map</title>
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site">
  <h1 class="wordmark"><a href="#top">Mapkeeper</a></h1>
  <span class="tagline">the living project map</span>
  <span class="meta">v${VERSION} · schema v2 · node ≥20</span>
</header>
<div class="wrap" id="top">
  <nav class="toc" aria-label="Contents">
    <p>Contents</p>
    <ol>
      ${sections.map((section) => `<li><a href="#${section.id}">${escape(section.nav)}</a></li>`).join("\n      ")}
      <li><a href="#prompt">Prompt</a></li>
    </ol>
  </nav>
  <main id="main">
    ${sections
      .map(
        (section) => `<section id="${section.id}">
  <div class="section-head">
    <h2>${escape(section.title)}</h2>
    <a class="source" href="${escape(section.file)}">source</a>
  </div>
  ${section.html}
</section>`,
      )
      .join("\n")}
    <section id="prompt">
      <div class="section-head">
        <h2>Legacy prompt</h2>
        <a class="source" href="Mapkeeper_Prompt.md">source</a>
      </div>
      <p><code>Mapkeeper_Prompt.md</code> is generated from these same files and kept for one deprecation cycle. The skill and CLI are authoritative.</p>
      <p><a href="Mapkeeper_Prompt.md">Open the generated prompt</a></p>
      <pre data-copy><code>You are Mapkeeper. Map the repository into project-map/ with the exact layout,
validate every artifact, and never claim a tool ran unless it did.

  node scripts/mapkeeper.mjs init
  node scripts/mapkeeper.mjs doctor
  node scripts/mapkeeper.mjs sync
  node scripts/mapkeeper.mjs audit</code></pre>
    </section>
  </main>
</div>
<footer>
  <div class="foot">
    <span>Generated from <code>SKILL.md</code> and <code>references/</code>. Edit those, then run <code>npm run build:guide</code>.</span>
    <span>Apache-2.0 · <a href="NOTICE">notice</a></span>
  </div>
</footer>
<script>${JS}</script>
</body>
</html>
`;

  if (check) compare(OUT, html);
  else {
    writeText(OUT, html);
    console.log(`wrote ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(1)} KB)`);
  }
}

function renderPromptShim() {
  const skill = stripFrontmatter(readText(path.join(ROOT, "SKILL.md")) || "");
  const body = skill
    .replace(/^# Mapkeeper\n+/, "")
    .replace(/\[`(references\/[^`]+)`\]/g, "`$1`")
    .replace(/\n## Read this first[\s\S]*?(?=\n## )/, "\n");
  return `# Mapkeeper_Prompt.md (generated, deprecated)

> This file is a compatibility shim. The maintained implementation is the
> \`mapkeeper\` skill plus the zero-dependency CLI in \`scripts/\`.
> Prefer: \`node scripts/mapkeeper.mjs init|sync|audit|export|doctor\`.
> Do not edit this file; regenerate with \`npm run build:prompt\`.

You are Mapkeeper. Follow the contract below and produce only validated artifacts.

## Output contract

\`\`\`text
project-map/
├── graph.json                 # schema v2, machine truth
├── map-ledger.json            # coverage units + run history
├── architecture-overview.md|.json|.html
├── sync-summary.md
└── obsidian-vault/
    ├── 00-Home.md
    ├── 01-Index.md
    ├── 02-LLM-Context.md      # <= 1500 tokens target, 2000 hard fail
    └── ...
\`\`\`

\`graphify-out/graph.json\` is a tool cache, never the graph of record. Do not write outside
\`project-map/\` except this file.

## Mandatory rules

1. Use stable ids matching \`^[A-Za-z0-9][A-Za-z0-9_.:-]*$\`; never rename an id because a label changed.
2. Every node needs \`source_refs\` or \`spec_refs\` unless it is inferred; inferred nodes need \`confidence\`.
3. Every generated Markdown region is wrapped in \`<!-- mapkeeper:begin id=... -->\` … \`<!-- mapkeeper:end id=... -->\`; never edit outside those markers.
4. Do not invent facts, relations, findings, severities, or tool runs. Skip and warn instead.
5. Never expose secrets; redact to \`<redacted>\` and record an unknown.
6. Validation failure must not overwrite a valid graph.

## Modes

\`init\` (no map) · \`sync\` (incremental) · \`audit\` (read-only validation and gaps) ·
\`full\` (rebuild) · \`export\` · \`context\` · \`graph\` · \`specs\` · \`security\` · \`doctor\`.

Legacy verbs \`MAPPER INIT|SYNC|AUDIT|FULL|EXPORT ONLY|CONTEXT ONLY|GRAPHIFY ONLY\` map to the same modes.

## Evidence rules

| Source | Required evidence |
| --- | --- |
| graphify | \`source_refs\` copied from \`source_file\`; ids preserved verbatim |
| spec-kit | \`spec_refs: ["<spec>#FR-001"]\`; requirement/task ids stable |
| security | \`source_refs: ["<file>:<line>"]\`; verdict preserved |
| model inference | \`confidence\` (low/medium/high), listed as unverified |

Never publish a rejected security candidate; never assign severity to \`needs_validation\`.

## Procedure

1. Resolve project root, phase, and mode.
2. Gather evidence: graphify cache or deterministic scan; \`.specify/\`; optional security run.
3. Project nodes and edges 1:1; tag \`derivation\` as graphify, speckit, security, llm.
4. Seed or update \`map-ledger.json\`; mark changed units stale; remap them.
5. Write \`graph.json\`, vault, exports, summary, context; validate everything.
6. Report mode, generation source, coverage, gaps, artifacts, next actions.

If the CLI or skill is unavailable, still produce the exact file layout and schema; run the validators mentally against the rules above.

${body.trim()}

## Validation checklist

- \`graph.json\` has unique ids, resolvable edges, correct counts.
- Every mapped ledger unit has a node id and evidence.
- \`02-LLM-Context.md\` is under budget and has valid frontmatter.
- Managed blocks are balanced; no rejected findings; no severity on needs_validation.

## Final response

Mode and phase · generation source · changes or findings · coverage counts · assumptions/unknowns · artifacts · next actions.
`;
}

function compare(file, expected) {
  const actual = readText(file, "");
  if (actual === expected) {
    console.log(`ok: ${path.relative(ROOT, file)} is current`);
    return;
  }
  console.error(`stale: ${path.relative(ROOT, file)} differs from generated output`);
  console.error("run: npm run build:guide && npm run build:prompt");
  process.exit(1);
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

function renderMarkdown(md, prefix) {
  const source = md.replace(/^\s*#\s+.*\n+/, "");
  const lines = source.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i += 1;
      out.push(`<pre data-copy><code class="lang-${escape(lang)}">${escape(code.join("\n"))}</code></pre>`);
      continue;
    }
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      out.push(renderTable(rows));
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 6);
      const text = heading[2];
      const id = `${prefix}-${slug(text)}`;
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i += 1;
      continue;
    }
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bullet) {
      const items = [];
      while (i < lines.length) {
        const match = lines[i].match(/^\s*[-*]\s+(.*)$/);
        if (!match) break;
        items.push(`<li>${inline(match[1])}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ordered) {
      const items = [];
      while (i < lines.length) {
        const match = lines[i].match(/^\s*\d+\.\s+(.*)$/);
        if (!match) break;
        items.push(`<li>${inline(match[1])}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const para = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\||\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
      para.push(lines[i++]);
    }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}

function renderTable(rows) {
  const cells = rows.map((row) => row.split("|").slice(1, -1).map((cell) => cell.trim()));
  if (cells.length > 1 && cells[1].every((cell) => /^:?-{2,}:?$/.test(cell))) {
    const head = cells[0].map((cell) => `<th>${inline(cell)}</th>`).join("");
    const body = cells
      .slice(2)
      .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
      .join("");
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }
  const body = cells.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("");
  return `<table><tbody>${body}</tbody></table>`;
}

function inline(text) {
  return escape(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${escape(href)}">${label}</a>`)
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1");
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function escape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CSS = `
:root{
  --paper:#fcfcfa;--ink:#161616;--muted:#6a6a66;--rule:#e5e3dc;
  --accent:#1c6b4e;--wash:#f3f2ed;
  --measure:44rem;--sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){
  :root{--paper:#0e100f;--ink:#e9e7e1;--muted:#9a9d96;--rule:#252925;
    --accent:#7fd3a8;--wash:#161a18;}
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:6rem}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.7 var(--sans);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:var(--accent);text-decoration:none;text-underline-offset:.18em}
a:hover{text-decoration:underline}
a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:.2rem}
.skip{position:absolute;left:-999px;top:0;background:var(--paper);color:var(--ink);padding:.6rem .9rem;border:1px solid var(--rule);z-index:99}
.skip:focus{left:1rem;top:1rem}
.site{position:sticky;top:0;z-index:20;display:flex;align-items:baseline;gap:.9rem;padding:.85rem clamp(1rem,4vw,2.2rem);border-bottom:1px solid var(--rule);background:var(--paper)}
.wordmark{font-size:1rem;font-weight:650;letter-spacing:-.01em;margin:0}
.wordmark a{color:var(--ink)}
.tagline{color:var(--muted);font-size:.85rem}
.meta{margin-left:auto;color:var(--muted);font-size:.72rem;letter-spacing:.02em;white-space:nowrap}
.wrap{display:grid;grid-template-columns:12.5rem minmax(0,1fr);gap:clamp(1.5rem,6vw,5rem);max-width:70rem;margin:0 auto;padding:2.8rem clamp(1rem,4vw,2.2rem) 4rem}
.toc{position:sticky;top:4.6rem;align-self:start;font-size:.85rem}
.toc p{margin:0 0 .6rem;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.toc ol{list-style:none;margin:0;padding:0;display:grid;gap:.1rem}
.toc a{display:block;padding:.34rem .55rem;border-left:2px solid transparent;color:var(--ink)}
.toc a:hover{color:var(--accent);border-left-color:var(--accent);text-decoration:none}
main{min-width:0;max-width:var(--measure)}
section{padding:2.6rem 0;border-top:1px solid var(--rule)}
section:first-of-type{border-top:0;padding-top:0}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin:0 0 1rem}
section h2{font-size:1.4rem;line-height:1.25;letter-spacing:-.015em;margin:0}
.source{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.source:hover{color:var(--accent)}
h3{font-size:1.08rem;line-height:1.35;margin:2rem 0 .45rem;letter-spacing:-.005em}
h4{font-size:.95rem;line-height:1.4;margin:1.5rem 0 .35rem}
p{margin:.75rem 0}
#overview > p:first-of-type{font-size:1.1rem;line-height:1.62;max-width:38rem}
ul,ol{margin:.6rem 0;padding-left:1.15rem}
li{margin:.18rem 0}
li>p{margin:.2rem 0}
code{font-family:var(--mono);font-size:.86em;background:var(--wash);padding:.08em .34em;border-radius:.25rem}
pre{position:relative;margin:1rem 0;padding:1rem 1.1rem;background:var(--wash);border:1px solid var(--rule);border-radius:.55rem;overflow-x:auto;font-size:.83rem;line-height:1.62}
pre code{background:none;padding:0;font-size:inherit;color:var(--ink)}
pre .copy{position:absolute;top:.45rem;right:.45rem;border:1px solid var(--rule);background:var(--paper);color:var(--muted);border-radius:.35rem;padding:.2rem .45rem;font:600 .68rem/1.4 var(--sans);letter-spacing:.04em;text-transform:uppercase;cursor:pointer;opacity:.85}
pre .copy:hover{color:var(--ink);border-color:var(--muted);opacity:1}
table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.9rem;display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}
thead th{font-size:.68rem;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:600;text-align:left;white-space:nowrap}
th,td{padding:.5rem .55rem;border-bottom:1px solid var(--rule);vertical-align:top}
tbody tr:last-child td{border-bottom:0}
strong{font-weight:650}
hr{border:0;border-top:1px solid var(--rule);margin:2rem 0}
footer{border-top:1px solid var(--rule);padding:1.4rem clamp(1rem,4vw,2.2rem) 3rem;color:var(--muted);font-size:.8rem}
.foot{max-width:70rem;margin:0 auto;display:flex;gap:1rem;justify-content:space-between;align-items:baseline;flex-wrap:wrap}
footer code{font-size:.9em;background:none;padding:0;color:var(--ink)}
@media (max-width:820px){
  html{scroll-padding-top:7rem}
  .site{padding:.7rem 1rem}
  .tagline,.meta{display:none}
  .wrap{display:block;padding:0 1rem 3rem;max-width:none}
  .toc{position:sticky;top:3.15rem;z-index:15;margin:0 -1rem 1.4rem;padding:.55rem 1rem;background:var(--paper);border-bottom:1px solid var(--rule);overflow-x:auto;scrollbar-width:none;font-size:.8rem}
  .toc::-webkit-scrollbar{display:none}
  .toc p{display:none}
  .toc ol{display:flex;gap:.4rem;white-space:nowrap;width:max-content}
  .toc a{padding:.4rem .7rem;border:1px solid var(--rule);border-radius:999px;line-height:1.2}
  .toc a:hover{border-color:var(--accent)}
  main{max-width:none}
  section{padding:2rem 0}
  section h2{font-size:1.25rem}
  #overview > p:first-of-type{font-size:1.02rem}
  pre{font-size:.78rem;padding:.9rem}
  th,td{padding:.45rem .5rem}
}
@media print{
  .site,.toc,.copy,.skip,footer{display:none}
  body{background:#fff;color:#000}
  .wrap{display:block;max-width:none;padding:0}
  main{max-width:none}
  section{break-inside:auto;padding:1.2rem 0;border-top:1px solid #ddd}
  pre{background:#f5f5f5;border:1px solid #ddd;white-space:pre-wrap}
  a{color:#000;text-decoration:underline}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
}
`;

const JS = `
(function(){
  document.querySelectorAll('pre[data-copy]').forEach(function(pre){
    var btn=document.createElement('button');
    btn.className='copy';btn.type='button';btn.textContent='copy';
    btn.setAttribute('aria-label','Copy code');
    btn.addEventListener('click',function(){
      var code=pre.querySelector('code');
      var text=code?code.textContent:'';
      var done=function(){btn.textContent='copied';setTimeout(function(){btn.textContent='copy'},1200);};
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done,function(){btn.textContent='failed';});
      } else {
        var range=document.createRange();range.selectNodeContents(code);
        var sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
        btn.textContent='selected';
      }
    });
    pre.appendChild(btn);
  });
})();
`;
main();
