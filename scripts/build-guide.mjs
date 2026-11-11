#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readJson, readText, writeText } from "./lib/fs-utils.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "index.html");
const PROMPT = path.join(ROOT, "Mapkeeper_Prompt.md");
const VERSION = readJson(path.join(ROOT, "package.json")).version;
const REPO = "https://github.com/MIQBALHAKIM/Mapkeeper";
const BLOB = `${REPO}/blob/main`;

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
  const sections = SECTIONS.map(([id, file, title, nav], i) => {
    const raw = readText(path.join(ROOT, file));
    if (raw === null) throw new Error(`missing source: ${file}`);
    return {
      id,
      nav,
      title,
      file,
      index: String(i + 1).padStart(2, "0"),
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
<header class="appbar">
  <div class="brand">
    <span class="logo" aria-hidden="true">M</span>
    <div class="brand-text">
      <h1>Mapkeeper</h1>
      <p>the living project map</p>
    </div>
  </div>
  <a class="icon-btn ripple-target" href="${REPO}" target="_blank" rel="noopener" aria-label="Open Mapkeeper on GitHub">${ICON_GITHUB}</a>
</header>

<main id="main" class="page">
  <section class="hero">
    <div class="glow glow-a" aria-hidden="true"></div>
    <div class="glow glow-b" aria-hidden="true"></div>
    <svg class="hero-art" viewBox="0 0 440 340" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="1.5">
        <path d="M70 96 196 46 336 104 372 236 246 296 92 246Z"/>
        <path d="M196 46 246 296M70 96 336 104M92 246 372 236"/>
      </g>
      <g fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".26" stroke-width="1.5">
        <rect x="34" y="54" width="208" height="132" rx="26"/>
        <rect x="206" y="184" width="196" height="98" rx="24"/>
      </g>
      <g fill="currentColor" fill-opacity=".5">
        <circle cx="70" cy="96" r="6"/><circle cx="196" cy="46" r="6"/><circle cx="336" cy="104" r="6"/>
        <circle cx="372" cy="236" r="6"/><circle cx="246" cy="296" r="6"/><circle cx="92" cy="246" r="6"/>
      </g>
      <g stroke="currentColor" stroke-opacity=".26" stroke-width="2.5" stroke-linecap="round">
        <path d="M62 96h96M62 118h60M62 140h118"/>
        <path d="M232 224h124M232 246h88M232 268h136"/>
      </g>
      <g fill="currentColor" fill-opacity=".3">
        <rect x="264" y="62" width="54" height="8" rx="4"/>
        <rect x="264" y="80" width="86" height="8" rx="4"/>
        <rect x="264" y="98" width="40" height="8" rx="4"/>
      </g>
    </svg>
    <p class="eyebrow">Living project map · v${VERSION}</p>
    <h2>Map any repo.<br>Prove what is real.</h2>
    <p class="hero-copy">A validated knowledge graph, coverage ledger, Obsidian vault, and architecture exports — built from evidence, not guesses.</p>
    <div class="hero-actions">
      <a class="btn filled ripple-target" href="#install">Get started</a>
      <a class="btn tonal ripple-target" href="#overview">Browse docs</a>
    </div>
    <div class="facts" aria-label="At a glance">
      <span class="fact">Schema v2</span>
      <span class="fact">Zero dependencies</span>
      <span class="fact">Node ≥ 20</span>
    </div>
  </section>

  <nav class="chipbar" aria-label="Contents">
    <div class="chips">
      ${sections.map((section) => `<a class="chip ripple-target" href="#${section.id}">${escape(section.nav)}</a>`).join("\n      ")}
      <a class="chip ripple-target" href="#prompt">Prompt</a>
    </div>
  </nav>

  <div class="sections">
    ${sections
      .map(
        (section) => `<section id="${section.id}" class="card">
  <div class="section-head">
    <span class="index" aria-hidden="true">${section.index}</span>
    <h2>${escape(section.title)}</h2>
    <a class="source ripple-target" href="${BLOB}/${section.file}" target="_blank" rel="noopener">Source ${ICON_OPEN}</a>
  </div>
  ${section.html}
</section>`,
      )
      .join("\n")}

    <section id="prompt" class="card prompt-card">
      <div class="section-head">
        <span class="index" aria-hidden="true">13</span>
        <h2>Legacy prompt</h2>
        <a class="source ripple-target" href="${BLOB}/Mapkeeper_Prompt.md" target="_blank" rel="noopener">Source ${ICON_OPEN}</a>
      </div>
      <p><code>Mapkeeper_Prompt.md</code> is generated from these same files and kept for one deprecation cycle. The skill and CLI are authoritative.</p>
      <div class="hero-actions">
        <a class="btn tonal ripple-target" href="${BLOB}/Mapkeeper_Prompt.md" target="_blank" rel="noopener">Open the generated prompt</a>
      </div>
      <pre data-copy><code>You are Mapkeeper. Map the repository into project-map/ with the exact layout,
validate every artifact, and never claim a tool ran unless it did.

  node scripts/mapkeeper.mjs init
  node scripts/mapkeeper.mjs doctor
  node scripts/mapkeeper.mjs sync
  node scripts/mapkeeper.mjs audit</code></pre>
    </section>
  </div>
</main>

<button class="fab ripple-target" id="totop" aria-label="Back to top" hidden>${ICON_UP}</button>

<footer class="footer">
  <p>Generated from <code>SKILL.md</code> and <code>references/</code>. Edit those, then run <code>npm run build:guide</code>.</p>
  <p>Apache-2.0 · <a href="${REPO}" target="_blank" rel="noopener">GitHub</a> · <a href="${BLOB}/NOTICE" target="_blank" rel="noopener">Notice</a></p>
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
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  const body = cells.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("");
  return `<div class="table-wrap"><table><tbody>${body}</tbody></table></div>`;
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

const ICON_OPEN = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M14 3h7v7h-2V6.41l-8.29 8.3-1.42-1.42 8.3-8.29H14V3z" fill="currentColor"/><path d="M5 5h5v2H7v10h10v-3h2v5H5V5z" fill="currentColor"/></svg>`;
const ICON_GITHUB = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" fill="currentColor"/></svg>`;
const ICON_UP = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 5l7 7-1.41 1.41L13 8.83V20h-2V8.83l-4.59 4.58L5 12l7-7z" fill="currentColor"/></svg>`;

const CSS = `
:root{
  --primary:#4f378b;--on-primary:#ffffff;--primary-container:#eaddff;--on-primary-container:#21005d;
  --secondary-container:#e8def8;--on-secondary-container:#1d192b;
  --tertiary:#7d5260;--tertiary-container:#ffd8e4;--on-tertiary-container:#31111d;
  --surface:#fef7ff;--surface-container-lowest:#ffffff;--surface-container-low:#f7f2fa;
  --surface-container:#f3edf7;--surface-container-high:#ece6f0;
  --on-surface:#1d1b20;--on-surface-variant:#49454f;--outline:#79747e;--outline-variant:#cac4d0;
  --code-bg:#1d1b20;--code-fg:#f5eff7;--code-muted:#cfc6da;
  --sans:"Google Sans Text","Google Sans",Roboto,"Helvetica Neue",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
  --radius-xl:36px;--radius-lg:28px;--radius-md:20px;--radius-sm:14px;
  --appbar:4.25rem;--page:74rem;--read:46rem;
  --shadow-1:0 1px 2px rgba(29,27,32,.08),0 1px 3px 1px rgba(29,27,32,.06);
  --shadow-2:0 2px 6px rgba(29,27,32,.1),0 8px 24px rgba(29,27,32,.08);
}
@media (prefers-color-scheme:dark){
  :root{
    --primary:#d0bcff;--on-primary:#381e72;--primary-container:#4f378b;--on-primary-container:#eaddff;
    --secondary-container:#4a4458;--on-secondary-container:#e8def8;
    --tertiary:#efb8c8;--tertiary-container:#633b48;--on-tertiary-container:#ffd8e4;
    --surface:#141218;--surface-container-lowest:#0f0d13;--surface-container-low:#1d1b20;
    --surface-container:#211f26;--surface-container-high:#2b2930;
    --on-surface:#e6e0e9;--on-surface-variant:#cac4d0;--outline:#938f99;--outline-variant:#49454f;
    --code-bg:#0f0d13;--code-fg:#e6e0e9;--code-muted:#b9b1c6;
    --shadow-1:0 1px 2px rgba(0,0,0,.4),0 1px 3px 1px rgba(0,0,0,.25);
    --shadow-2:0 4px 12px rgba(0,0,0,.45),0 12px 32px rgba(0,0,0,.35);
  }
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:calc(var(--appbar) + 4.5rem);overflow-x:clip}
body{margin:0;max-width:100%;overflow-x:clip;background:var(--surface);color:var(--on-surface);font:16px/1.68 var(--sans);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;-webkit-text-size-adjust:100%}
a{color:var(--primary);text-decoration:none;text-underline-offset:.2em}
a:hover{text-decoration:underline}
a:focus-visible,button:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
h1,h2,h3,h4{letter-spacing:-.02em}
.skip{position:absolute;left:-999px;top:0;background:var(--primary-container);color:var(--on-primary-container);padding:.75rem 1rem;border-radius:0 0 var(--radius-sm) 0;z-index:100;font-weight:600}
.skip:focus{left:0}
.appbar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:1rem;min-height:var(--appbar);padding:.6rem clamp(1rem,3.5vw,2rem);background:var(--surface);background:color-mix(in srgb,var(--surface) 92%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--outline-variant)}
.brand{display:flex;align-items:center;gap:.8rem;min-width:0}
.logo{display:grid;place-items:center;width:2.6rem;height:2.6rem;border-radius:16px;background:linear-gradient(135deg,var(--primary),var(--tertiary));color:#fff;font-weight:800;font-size:1.1rem;letter-spacing:-.02em;box-shadow:var(--shadow-1);flex:none}
.brand-text{min-width:0}
.brand h1{margin:0;font-size:1.02rem;line-height:1.2;font-weight:650}
.brand p{margin:.1rem 0 0;color:var(--on-surface-variant);font-size:.76rem;line-height:1.2}
.icon-btn{display:grid;place-items:center;width:2.6rem;height:2.6rem;border-radius:50%;color:var(--on-surface-variant);margin-left:auto;position:relative;overflow:hidden}
.icon-btn:hover{background:var(--surface-container-high);color:var(--on-surface);text-decoration:none}
.page{max-width:var(--page);margin:0 auto;padding:1.2rem clamp(1rem,3.5vw,2rem) 3rem}
.hero{position:relative;overflow:hidden;border-radius:var(--radius-xl);padding:clamp(1.6rem,4.5vw,3.2rem);background:linear-gradient(135deg,#eaddff 0%,#f2e9ff 42%,#ffd8e4 100%);color:var(--on-primary-container);box-shadow:var(--shadow-2);isolation:isolate}
.glow{position:absolute;border-radius:50%;filter:blur(46px);opacity:.55;z-index:-1;pointer-events:none}
.glow-a{width:22rem;height:22rem;background:#b69dff;top:-9rem;right:-6rem}
.glow-b{width:16rem;height:16rem;background:#ffb1c8;bottom:-8rem;left:18%}
.hero-art{position:absolute;right:3%;top:50%;transform:translateY(-50%);width:min(32%,400px);height:auto;pointer-events:none;color:var(--on-primary-container);opacity:.9}
@media (max-width:1100px){.hero-art{display:none}}
.eyebrow{margin:0 0 .7rem;font-size:.72rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.72}
.hero h2{margin:0;font-size:clamp(2.1rem,6vw,3.6rem);line-height:1.03;font-weight:750;letter-spacing:-.045em;max-width:15ch;text-wrap:balance}
.hero-copy{margin:1rem 0 0;max-width:34rem;font-size:clamp(1rem,2.2vw,1.14rem);line-height:1.55;opacity:.86}
.hero-actions{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1.5rem}
.btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;gap:.45rem;min-height:2.9rem;padding:.6rem 1.35rem;border-radius:999px;font-size:.92rem;font-weight:650;line-height:1.2;transition:transform .18s cubic-bezier(.2,0,0,1),box-shadow .18s,background .18s}
.btn:hover{text-decoration:none;transform:translateY(-1px);box-shadow:var(--shadow-1)}
.btn:active{transform:scale(.97)}
.btn.filled{background:var(--primary);color:var(--on-primary)}
.btn.tonal{background:var(--secondary-container);color:var(--on-secondary-container)}
.facts{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:1.6rem}
.fact{padding:.34rem .72rem;border-radius:999px;background:rgba(255,255,255,.55);border:1px solid rgba(33,0,93,.14);font-size:.75rem;font-weight:600;letter-spacing:.01em;color:#2b0a5e}
@media (prefers-color-scheme:dark){
  .hero{background:linear-gradient(135deg,#2b2140 0%,#3a2430 55%,#1f2a3a 100%);color:#eaddff}
  .glow-a{background:#7a5af8}
  .glow-b{background:#e4698a}
  .fact{background:rgba(255,255,255,.1);border-color:rgba(234,221,255,.18);color:#eaddff}
}
.chipbar{position:sticky;top:var(--appbar);z-index:20;margin:.35rem calc(-1 * clamp(1rem,3.5vw,2rem)) 0;padding:.7rem clamp(1rem,3.5vw,2rem);background:var(--surface);background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(14px)}
.chips{display:flex;gap:.45rem;overflow-x:auto;scrollbar-width:none;white-space:nowrap;padding-bottom:.1rem}
.chips::-webkit-scrollbar{display:none}
.chip{position:relative;overflow:hidden;flex:none;padding:.52rem .95rem;border-radius:999px;border:1px solid var(--outline-variant);background:transparent;color:var(--on-surface-variant);font-size:.82rem;font-weight:600;line-height:1.2;transition:background .18s,color .18s,border-color .18s,transform .18s}
.chip:hover{background:var(--surface-container-high);color:var(--on-surface);text-decoration:none}
.chip.active{background:var(--secondary-container);border-color:transparent;color:var(--on-secondary-container)}
.chip:active{transform:scale(.97)}
.sections{display:grid;grid-template-columns:minmax(0,1fr);gap:1rem;margin-top:1rem}
.card{min-width:0;max-width:100%;background:var(--surface-container-low);border:1px solid var(--outline-variant);border-radius:var(--radius-lg);padding:clamp(1.25rem,3.2vw,2.2rem);box-shadow:var(--shadow-1);scroll-margin-top:calc(var(--appbar) + 4.5rem)}
.card:nth-child(4n+2){background:var(--surface-container)}
.section-head{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin-bottom:1.1rem}
.index{display:inline-grid;place-items:center;min-width:2.2rem;height:2.2rem;padding:0 .55rem;border-radius:999px;background:var(--primary-container);color:var(--on-primary-container);font-size:.78rem;font-weight:750;letter-spacing:.06em}
.section-head h2{margin:0;font-size:clamp(1.35rem,3vw,1.8rem);line-height:1.2;font-weight:700}
.source{display:inline-flex;align-items:center;gap:.35rem;margin-left:auto;padding:.42rem .85rem;border-radius:999px;border:1px solid var(--outline-variant);color:var(--primary);font-size:.76rem;font-weight:650;position:relative;overflow:hidden;transition:background .18s}
.source:hover{background:var(--primary-container);color:var(--on-primary-container);text-decoration:none}
.source svg{flex:none;opacity:.8}
.card > p:first-of-type{font-size:1.03rem;color:var(--on-surface)}
.card p,.card li{max-width:70ch}
.card p,.card li,.card td,.card th,.card h2,.card h3,.card h4{overflow-wrap:break-word}
.card code{overflow-wrap:anywhere}
.table-wrap code{overflow-wrap:normal}
h3{font-size:1.16rem;line-height:1.35;margin:1.9rem 0 .5rem;font-weight:700}
h4{font-size:1rem;line-height:1.4;margin:1.4rem 0 .35rem;font-weight:700}
p{margin:.75rem 0}
ul,ol{margin:.65rem 0;padding-left:1.2rem}
li{margin:.22rem 0}
li>p{margin:.2rem 0}
strong{font-weight:700}
code{font-family:var(--mono);font-size:.86em;background:var(--surface-container-high);padding:.1em .38em;border-radius:.45rem}
pre{position:relative;max-width:100%;margin:1.1rem 0;padding:1.1rem 1.2rem;background:var(--code-bg);color:var(--code-fg);border-radius:var(--radius-md);overflow-x:auto;font-size:.84rem;line-height:1.62;box-shadow:var(--shadow-1)}
pre code{background:none;padding:0;color:inherit;font-size:inherit}
pre .copy{position:absolute;top:.55rem;right:.55rem;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.1);color:#f3edf7;border-radius:999px;padding:.3rem .7rem;font:650 .7rem/1.2 var(--sans);letter-spacing:.03em;cursor:pointer;overflow:hidden;transition:background .15s}
pre .copy:hover{background:rgba(255,255,255,.2)}
.table-wrap{margin:1.1rem 0;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:var(--radius-sm)}
table{width:100%;min-width:34rem;border-collapse:collapse;font-size:.9rem}
thead th{text-align:left;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--on-surface-variant);font-weight:700;white-space:nowrap;background:var(--surface-container-high);padding:.6rem .7rem}
tbody td{padding:.62rem .7rem;border-top:1px solid var(--outline-variant);vertical-align:top}
tbody tr:last-child td{padding-bottom:.7rem}
hr{border:0;border-top:1px solid var(--outline-variant);margin:2rem 0}
.prompt-card{background:var(--tertiary-container);color:var(--on-tertiary-container);border-color:transparent}
.prompt-card .index{background:rgba(255,255,255,.55);color:var(--on-tertiary-container)}
.prompt-card .source{color:var(--on-tertiary-container);border-color:rgba(49,17,29,.22)}
.prompt-card .source:hover{background:rgba(255,255,255,.45)}
.prompt-card .btn.tonal{background:rgba(255,255,255,.55);color:var(--on-tertiary-container)}
.prompt-card > p:first-of-type{color:inherit}
.fab{position:fixed;right:1.1rem;bottom:1.1rem;z-index:40;display:grid;place-items:center;width:3.5rem;height:3.5rem;border:0;border-radius:20px;background:var(--primary-container);color:var(--on-primary-container);box-shadow:var(--shadow-2);cursor:pointer;overflow:hidden;transition:transform .18s,box-shadow .18s}
.fab:hover{transform:translateY(-2px)}
.fab:active{transform:scale(.94)}
.fab[hidden]{display:none}
.footer{max-width:var(--page);margin:0 auto;padding:1.2rem clamp(1rem,3.5vw,2rem) 4rem;color:var(--on-surface-variant);font-size:.8rem;text-align:center}
.footer p{margin:.3rem 0}
.footer code{background:none;padding:0;color:var(--on-surface)}
.ripple{position:absolute;border-radius:50%;background:currentColor;opacity:.24;transform:scale(0);pointer-events:none;animation:ripple .55s cubic-bezier(.2,0,0,1) forwards}
@keyframes ripple{to{transform:scale(1);opacity:0}}
@media (max-width:720px){
  :root{--appbar:3.9rem}
  .brand p{display:none}
  .hero{border-radius:var(--radius-lg);padding:1.35rem}
  .hero h2{max-width:none}
  .hero-copy{font-size:.98rem}
  .card{border-radius:24px;padding:1.15rem}
  .section-head{gap:.55rem}
  .index{min-width:2rem;height:2rem;font-size:.72rem}
  .source{margin-left:0;padding:.38rem .7rem}
  .chipbar{margin-left:-1rem;margin-right:-1rem;padding-left:1rem;padding-right:1rem}
  .page{padding-left:1rem;padding-right:1rem}
  pre{font-size:.78rem;padding:.95rem;border-radius:var(--radius-sm)}
  table{min-width:0;font-size:.84rem}
  .table-wrap{overflow-x:visible}
  .table-wrap code{overflow-wrap:anywhere}
  .fab{right:.9rem;bottom:.9rem}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *{animation-duration:.001ms !important;transition-duration:.001ms !important}
}
@media print{
  .appbar,.chipbar,.fab,.skip,.hero,.footer{display:none}
  body{background:#fff;color:#000}
  .page{max-width:none;padding:0}
  .card{border:0;box-shadow:none;border-radius:0;padding:1rem 0;background:#fff}
  pre{background:#f4f4f4;color:#111;box-shadow:none;white-space:pre-wrap}
  .source{display:none}
  a{color:#000;text-decoration:underline}
}
`;

const JS = `
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ripple(el){
    el.addEventListener('pointerdown',function(event){
      if(reduce) return;
      var rect=el.getBoundingClientRect();
      var size=Math.max(rect.width,rect.height);
      var span=document.createElement('span');
      span.className='ripple';
      span.style.width=size+'px';
      span.style.height=size+'px';
      span.style.left=(event.clientX-rect.left-size/2)+'px';
      span.style.top=(event.clientY-rect.top-size/2)+'px';
      el.appendChild(span);
      span.addEventListener('animationend',function(){span.remove();});
    });
  }

  document.querySelectorAll('.ripple-target').forEach(ripple);

  document.querySelectorAll('pre[data-copy]').forEach(function(pre){
    var btn=document.createElement('button');
    btn.className='copy';btn.type='button';btn.textContent='Copy';
    btn.setAttribute('aria-label','Copy code');
    ripple(btn);
    btn.addEventListener('click',function(){
      var code=pre.querySelector('code');
      var text=code?code.textContent:'';
      var done=function(){btn.textContent='Copied';setTimeout(function(){btn.textContent='Copy';},1200);};
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done,function(){btn.textContent='Failed';});
      } else {
        var range=document.createRange();range.selectNodeContents(code);
        var selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
        btn.textContent='Selected';
      }
    });
    pre.appendChild(btn);
  });

  var chips=[].slice.call(document.querySelectorAll('.chip'));
  var targets=chips.map(function(chip){return document.querySelector(chip.getAttribute('href'));}).filter(Boolean);
  if('IntersectionObserver' in window && targets.length){
    var spy=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        chips.forEach(function(chip){
          var active=chip.getAttribute('href')==='#'+entry.target.id;
          chip.classList.toggle('active',active);
          if(active){
            chip.setAttribute('aria-current','true');
            if(chip.parentElement.scrollWidth>chip.parentElement.clientWidth){
              var parent=chip.parentElement;
              parent.scrollTo({left:Math.max(0,chip.offsetLeft-parent.clientWidth/2+chip.clientWidth/2),behavior:reduce?'auto':'smooth'});
            }
          } else {
            chip.removeAttribute('aria-current');
          }
        });
      });
    },{rootMargin:'-35% 0px -55% 0px',threshold:0});
    targets.forEach(function(target){spy.observe(target);});
  }

  var fab=document.getElementById('totop');
  if(fab){
    var update=function(){fab.hidden=window.scrollY<640;};
    update();
    window.addEventListener('scroll',update,{passive:true});
    fab.addEventListener('click',function(){
      window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});
    });
  }
})();
`;
main();
