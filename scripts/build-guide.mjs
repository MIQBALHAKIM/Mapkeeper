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
  { id: "overview", file: "SKILL.md", title: "Overview", nav: "Overview", group: "start" },
  { id: "install", file: "README.md", title: "Install", nav: "Install", group: "start" },
  { id: "commands", file: "references/commands.md", title: "Commands", nav: "Commands", group: "usage" },
  { id: "modes", file: "references/modes.md", title: "Modes and phases", nav: "Modes and phases", group: "usage" },
  { id: "contract", file: "references/contract.md", title: "Contract", nav: "Contract", group: "usage" },
  { id: "graphify", file: "references/graphify-adapter.md", title: "Graphify adapter", nav: "Graphify", group: "integrations", badge: "optional" },
  { id: "speckit", file: "references/speckit-adapter.md", title: "Spec-kit adapter", nav: "Spec-kit", group: "integrations", badge: "optional" },
  { id: "security", file: "references/security-adapter.md", title: "Security-audit adapter", nav: "Security audit", group: "integrations", badge: "optional" },
  { id: "schema", file: "references/schema.md", title: "Graph and ledger schema", nav: "Schema", group: "reference", badge: "v2" },
  { id: "obsidian", file: "references/obsidian.md", title: "Obsidian vault", nav: "Obsidian vault", group: "reference" },
  { id: "exports", file: "references/architecture-exports.md", title: "Architecture exports", nav: "Exports", group: "reference" },
  { id: "troubleshooting", file: "references/troubleshooting.md", title: "Troubleshooting", nav: "Troubleshooting", group: "reference" },
];

const GROUPS = [
  { id: "start", label: "Get started", lead: "overview" },
  { id: "usage", label: "Usage", lead: "commands" },
  { id: "integrations", label: "Integrations", lead: "graphify" },
  { id: "reference", label: "Reference", lead: "schema" },
  { id: "legacy", label: "Legacy", lead: "prompt" },
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
  const sections = SECTIONS.map((meta) => {
    const raw = readText(path.join(ROOT, meta.file));
    if (raw === null) throw new Error(`missing source: ${meta.file}`);
    return { ...meta, html: renderMarkdown(stripFrontmatter(raw), meta.id) };
  });

  sections.push({
    id: "prompt",
    file: "Mapkeeper_Prompt.md",
    title: "Legacy prompt",
    nav: "Prompt shim",
    group: "legacy",
    badge: "legacy",
    html: `<p><code>Mapkeeper_Prompt.md</code> is generated from these same files and kept for one deprecation cycle. The skill and CLI are authoritative.</p>
<p><a href="${BLOB}/Mapkeeper_Prompt.md" target="_blank" rel="noopener">Open the generated prompt on GitHub</a></p>
<pre data-copy><code>You are Mapkeeper. Map the repository into project-map/ with the exact layout,
validate every artifact, and never claim a tool ran unless it did.

  node scripts/mapkeeper.mjs init
  node scripts/mapkeeper.mjs doctor
  node scripts/mapkeeper.mjs sync
  node scripts/mapkeeper.mjs audit</code></pre>`,
  });

  const withSubs = sections.map((section) => ({
    ...section,
    subs: [...section.html.matchAll(/<h3 id="([^"]+)">([\s\S]*?)<\/h3>/g)].map((match) => ({
      id: match[1],
      label: plain(match[2]),
    })),
  }));

  const searchIndex = withSubs.flatMap((section) => [
    { label: section.title, section: section.title, href: `#${section.id}` },
    ...section.subs.map((sub) => ({ label: sub.label, section: section.title, href: `#${sub.id}` })),
  ]);

  const navGroups = GROUPS.map((group) => ({
    ...group,
    items: withSubs.filter((section) => section.group === group.id),
  })).filter((group) => group.items.length);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Mapkeeper — a living project map: validated knowledge graph, coverage ledger, Obsidian vault, and architecture exports.">
<meta name="color-scheme" content="light dark">
<title>Mapkeeper Docs — Codebase Mapping</title>
<style>${CSS}</style>
</head>
<body>
<header class="site-header">
  <div class="header-top">
    <a class="brand" href="#top" aria-label="Mapkeeper docs home">
      <span class="brand-mark" aria-hidden="true">M</span>
      <span class="brand-name">Mapkeeper</span>
      <span class="brand-docs">DOCS</span>
    </a>
    <div class="search-wrap" id="search-wrap">
      <label class="search" for="search">
        <span class="search-icon" aria-hidden="true">${ICON_SEARCH}</span>
        <input id="search" type="search" placeholder="Search" aria-label="Search documentation" autocomplete="off" spellcheck="false" aria-controls="search-panel" aria-expanded="false">
        <kbd class="search-kbd">⌘K</kbd>
      </label>
      <div class="search-panel" id="search-panel" hidden></div>
    </div>
    <div class="header-actions">
      <a class="header-link" href="${REPO}" target="_blank" rel="noopener">${ICON_GITHUB}<span>GitHub</span></a>
      <span class="version-badge">v${VERSION}</span>
    </div>
  </div>
  <nav class="topnav" aria-label="Primary">
    ${navGroups.map((group) => `<a class="topnav-link" data-group="${group.id}" href="#${group.lead}">${escape(group.label)}</a>`).join("\n    ")}
  </nav>
</header>

<div class="shell" id="top">
  <aside class="sidenav" aria-label="Documentation">
    ${navGroups
      .map(
        (group) => `<div class="nav-group">
      <p class="nav-label">${escape(group.label)}</p>
      ${group.items
        .map(
          (section) =>
            `<a class="nav-item" data-nav="${section.id}" href="#${section.id}"><span>${escape(section.nav)}</span>${section.badge ? `<span class="badge ${section.badge}">${section.badge}</span>` : ""}</a>`,
        )
        .join("\n      ")}
    </div>`,
      )
      .join("\n    ")}
  </aside>

  <main id="main">
    <h1 id="top-title">Mapkeeper</h1>
    <p class="lede">Documentation for the Mapkeeper skill and CLI. Build a living project map from repository evidence — graph, coverage ledger, vault, and exports.</p>

    <div class="callout">
      <p class="callout-label">${ICON_INFO} Skill + CLI</p>
      <p>No install step, no API key, no network access. Start with <code>node scripts/mapkeeper.mjs init</code>, then run <code>doctor</code> to validate the result.</p>
    </div>

    <details class="mobile-nav">
      <summary>On this page</summary>
      <div class="mobile-links">
        ${withSubs.map((section) => `<a href="#${section.id}">${escape(section.title)}</a>`).join("\n        ")}
      </div>
    </details>

    ${withSubs
      .map(
        (section) => `<section class="doc-section" id="${section.id}" data-group="${section.group}">
  <div class="section-head">
    <h2>${escape(section.title)}</h2>
    <a class="section-source" href="${BLOB}/${section.file}" target="_blank" rel="noopener" aria-label="View source for ${escape(section.title)}">Source</a>
  </div>
  ${section.html}
</section>`,
      )
      .join("\n")}

    <footer class="page-footer">
      <p>Generated from <code>SKILL.md</code> and <code>references/</code>. Edit those, then run <code>npm run build:guide</code>.</p>
      <p>Apache-2.0 · <a href="${REPO}" target="_blank" rel="noopener">GitHub</a> · <a href="${BLOB}/NOTICE" target="_blank" rel="noopener">Notice</a></p>
    </footer>
  </main>

  <aside class="toc" aria-label="On this page">
    <div class="toc-head">
      <button class="copy-page" id="copy-page" type="button">${ICON_COPY}<span>Copy page</span></button>
    </div>
    <nav class="toc-nav">
      ${withSubs
        .map(
          (section) => `<div class="toc-section">
        <a class="toc-link" data-toc="${section.id}" href="#${section.id}">${escape(section.title)}</a>
        ${section.subs.length ? `<div class="toc-sub">${section.subs.map((sub) => `<a href="#${sub.id}">${escape(sub.label)}</a>`).join("")}</div>` : ""}
      </div>`,
        )
        .join("\n      ")}
    </nav>
  </aside>
</div>

<script type="application/json" id="search-index">${JSON.stringify(searchIndex).replace(/</g, "\\u003c")}</script>
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

function plain(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
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

const ICON_SEARCH = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><path d="M8.5 3a5.5 5.5 0 1 1-3.89 9.39l-2.3 2.3-1.41-1.42 2.3-2.3A5.5 5.5 0 0 1 8.5 3Zm0 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" fill="currentColor"/></svg>`;
const ICON_GITHUB = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" fill="currentColor"/></svg>`;
const ICON_COPY = `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false"><path d="M7 2h7a2 2 0 0 1 2 2v7h-2V4H7V2Zm-3 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v9h7V7H4Z" fill="currentColor"/></svg>`;
const ICON_INFO = `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false"><path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm-1 4h2v6H9V8Zm0-3h2v2H9V5Z" fill="currentColor"/></svg>`;

const CSS = `
:root{
  --bg:#ffffff;--text:#111827;--body:#374151;--muted:#6b7280;--faint:#9ca3af;
  --border:#e5e7eb;--hover:#f9fafb;--active:#f3f4f6;
  --blue:#2563eb;--callout-bg:#eff6ff;--callout-border:#3b82f6;--callout-label:#1d4ed8;--callout-text:#1e3a8a;
  --green-bg:#dcfce7;--green:#166534;--blue-bg:#dbeafe;--blue-ink:#1d4ed8;--gray-bg:#f3f4f6;
  --code-bg:#f9fafb;--code-border:#e5e7eb;
  --header:3.5rem;--subnav:2.65rem;
  --sans:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
}
@media (prefers-color-scheme:dark){
  :root{
    --bg:#0b0d10;--text:#e5e7eb;--body:#cbd5e1;--muted:#94a3b8;--faint:#64748b;
    --border:#1f2937;--hover:#111827;--active:#1f2937;
    --blue:#60a5fa;--callout-bg:#172554;--callout-border:#3b82f6;--callout-label:#93c5fd;--callout-text:#dbeafe;
    --green-bg:#052e16;--green:#86efac;--blue-bg:#172554;--blue-ink:#93c5fd;--gray-bg:#1f2937;
    --code-bg:#0f1419;--code-border:#1f2937;
  }
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:calc(var(--header) + var(--subnav) + 1rem);overflow-x:clip}
body{margin:0;max-width:100%;overflow-x:clip;background:var(--bg);color:var(--body);font:16px/1.72 var(--sans);-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
a{color:var(--blue);text-decoration:none}
a:hover{text-decoration:underline}
a:focus-visible,button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
h1,h2,h3,h4{color:var(--text);letter-spacing:-.02em}
.skip{position:absolute;left:-999px;top:0;background:var(--bg);color:var(--text);padding:.6rem .9rem;border:1px solid var(--border);z-index:99}
.skip:focus{left:1rem;top:1rem}
.site-header{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid var(--border)}
.header-top{display:grid;grid-template-columns:1fr minmax(0,28rem) 1fr;align-items:center;gap:1.5rem;height:var(--header);padding:0 clamp(1rem,3vw,2rem)}
.brand{display:flex;align-items:center;gap:.55rem;min-width:0;color:var(--text)}
.brand:hover{text-decoration:none}
.brand-mark{display:grid;place-items:center;width:1.65rem;height:1.65rem;border-radius:5px;background:var(--text);color:var(--bg);font-size:.85rem;font-weight:800;flex:none}
.brand-name{font-size:1rem;font-weight:700;letter-spacing:-.015em;white-space:nowrap}
.brand-docs{font-size:.72rem;font-weight:600;letter-spacing:.1em;color:var(--faint);margin-left:.15rem}
.search-wrap{position:relative;width:100%}
.search{display:flex;align-items:center;gap:.5rem;height:2.25rem;padding:0 .7rem;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--muted);cursor:text}
.search:focus-within{border-color:var(--blue);box-shadow:0 0 0 3px color-mix(in srgb,var(--blue) 12%,transparent)}
.search-icon{display:grid;place-items:center;flex:none}
.search input{flex:1;min-width:0;border:0;background:transparent;color:var(--text);font:inherit;font-size:.875rem;outline:none;padding:0}
.search input::placeholder{color:var(--faint)}
.search input::-webkit-search-cancel-button{display:none}
.search-kbd{font:600 .68rem/1 var(--sans);color:var(--faint);border:1px solid var(--border);border-radius:4px;padding:.2rem .3rem;white-space:nowrap}
.search-panel{position:absolute;left:0;right:0;top:calc(100% + .4rem);background:var(--bg);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.12);max-height:22rem;overflow:auto;padding:.3rem;z-index:40}
.search-panel[hidden]{display:none}
.search-item{display:block;padding:.5rem .6rem;border-radius:6px;color:var(--text);font-size:.875rem;line-height:1.4}
.search-item:hover,.search-item.active{background:var(--hover);text-decoration:none}
.search-item small{display:block;color:var(--faint);font-size:.72rem;margin-top:.1rem}
.search-empty{padding:.7rem;color:var(--muted);font-size:.85rem}
.header-actions{display:flex;align-items:center;justify-content:flex-end;gap:.9rem}
.header-link{display:inline-flex;align-items:center;gap:.4rem;color:var(--muted);font-size:.84rem;font-weight:600}
.header-link:hover{color:var(--text);text-decoration:none}
.version-badge{font-size:.72rem;font-weight:600;color:var(--muted);border:1px solid var(--border);border-radius:999px;padding:.18rem .5rem;white-space:nowrap}
.topnav{display:flex;align-items:stretch;gap:1.6rem;height:var(--subnav);padding:0 clamp(1rem,3vw,2rem);border-top:1px solid var(--border);overflow-x:auto;scrollbar-width:none}
.topnav::-webkit-scrollbar{display:none}
.topnav-link{display:inline-flex;align-items:center;white-space:nowrap;color:var(--muted);font-size:.86rem;font-weight:500;border-bottom:2px solid transparent;padding:0 .05rem}
.topnav-link:hover{color:var(--text);text-decoration:none}
.topnav-link.active{color:var(--text);border-bottom-color:var(--text);font-weight:600}
.shell{display:grid;grid-template-columns:15rem minmax(0,48rem) 15rem;justify-content:space-between;gap:clamp(1.5rem,3vw,3rem);max-width:84rem;margin:0 auto;padding:2.4rem clamp(1rem,3vw,2rem) 4rem;align-items:start}
.sidenav{position:sticky;top:calc(var(--header) + var(--subnav) + 1.5rem);max-height:calc(100vh - var(--header) - var(--subnav) - 3rem);overflow:auto;padding-right:.25rem}
.nav-group{margin-bottom:1.7rem}
.nav-label{margin:0 0 .45rem;padding:0 .55rem;font-size:.68rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--faint)}
.nav-item{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.34rem .55rem;border-radius:6px;color:var(--muted);font-size:.875rem;line-height:1.35}
.nav-item:hover{background:var(--hover);color:var(--text);text-decoration:none}
.nav-item.active{background:var(--active);color:var(--text);font-weight:600}
.badge{font-size:.6rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:.1rem .3rem;border-radius:3px;line-height:1.3;white-space:nowrap}
.badge.optional{background:var(--green-bg);color:var(--green)}
.badge.v2{background:var(--blue-bg);color:var(--blue-ink)}
.badge.legacy{background:var(--gray-bg);color:var(--muted)}
main{min-width:0}
h1{font-size:clamp(2.1rem,4vw,2.75rem);line-height:1.12;font-weight:750;letter-spacing:-.03em;margin:.2rem 0 1rem}
.lede{margin:0 0 1.4rem;font-size:1.06rem;line-height:1.65;color:var(--body);max-width:46rem}
.callout{display:block;margin:0 0 2.2rem;padding:.9rem 1.15rem;background:var(--callout-bg);border-left:3px solid var(--callout-border);border-radius:0 6px 6px 0;color:var(--callout-text)}
.callout-label{display:flex;align-items:center;gap:.4rem;margin:0 0 .35rem;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--callout-label)}
.callout p{margin:.3rem 0;font-size:.94rem;line-height:1.6}
.callout code{background:transparent;padding:0;border:0;font-weight:600;color:inherit}
.mobile-nav{display:none;margin:0 0 1.6rem;border:1px solid var(--border);border-radius:8px;padding:.55rem .8rem}
.mobile-nav summary{cursor:pointer;font-size:.88rem;font-weight:600;color:var(--text)}
.mobile-links{display:grid;gap:.15rem;margin-top:.5rem}
.mobile-links a{padding:.3rem 0;font-size:.88rem;color:var(--muted)}
.mobile-links a:hover{color:var(--text)}
.doc-section{margin-top:3rem;scroll-margin-top:calc(var(--header) + var(--subnav) + 1.5rem)}
.doc-section:first-of-type{margin-top:0}
.section-head{display:flex;align-items:baseline;gap:1rem;justify-content:space-between}
.section-head h2{margin:0;font-size:1.7rem;line-height:1.25;font-weight:700;letter-spacing:-.02em}
.section-source{font-size:.72rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);white-space:nowrap;opacity:0;transition:opacity .15s}
.doc-section:hover .section-source,.section-source:focus{opacity:1}
.section-source:hover{color:var(--muted);text-decoration:none}
.doc-section > p:first-of-type{margin-top:.9rem}
h3{font-size:1.24rem;line-height:1.35;font-weight:650;margin:2.1rem 0 .55rem;scroll-margin-top:calc(var(--header) + var(--subnav) + 1.5rem)}
h4{font-size:1.02rem;line-height:1.4;font-weight:650;margin:1.6rem 0 .4rem}
p{margin:.8rem 0}
p,li,td,th{overflow-wrap:break-word}
.doc-section p,.doc-section li{max-width:47rem}
ul,ol{margin:.7rem 0;padding-left:1.35rem}
li{margin:.26rem 0}
li>p{margin:.2rem 0}
strong{font-weight:650;color:var(--text)}
code{font-family:var(--mono);font-size:.855em;background:var(--gray-bg);padding:.09em .34em;border-radius:4px;color:var(--text);overflow-wrap:anywhere}
pre{position:relative;max-width:100%;margin:1.15rem 0;padding:1rem 1.1rem;background:var(--code-bg);border:1px solid var(--code-border);border-radius:8px;overflow-x:auto;font-size:.84rem;line-height:1.65}
pre code{background:none;padding:0;color:var(--text);font-size:inherit;overflow-wrap:normal}
pre .copy{position:absolute;top:.5rem;right:.5rem;display:grid;place-items:center;width:1.8rem;height:1.8rem;border:1px solid var(--border);border-radius:5px;background:var(--bg);color:var(--muted);cursor:pointer;padding:0}
pre .copy:hover{color:var(--text);background:var(--hover)}
pre .copy::after{content:"Copy";position:absolute;top:-1.65rem;right:0;font:600 .65rem/1 var(--sans);background:var(--text);color:var(--bg);padding:.28rem .4rem;border-radius:4px;opacity:0;pointer-events:none;transition:opacity .12s;white-space:nowrap}
pre .copy:hover::after{opacity:1}
pre .copy.copied::after{content:"Copied";opacity:1}
.table-wrap{margin:1.15rem 0;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;min-width:32rem;border-collapse:collapse;font-size:.89rem}
thead th{text-align:left;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:.55rem .65rem;border-bottom:1px solid var(--border);background:var(--hover)}
tbody td{padding:.6rem .65rem;border-bottom:1px solid var(--border);vertical-align:top;color:var(--body)}
tbody tr:last-child td{border-bottom:0}
hr{border:0;border-top:1px solid var(--border);margin:2rem 0}
.page-footer{margin-top:3.5rem;padding-top:1.2rem;border-top:1px solid var(--border);color:var(--faint);font-size:.8rem}
.page-footer p{margin:.35rem 0}
.page-footer code{background:none;padding:0;color:var(--muted)}
.toc{position:sticky;top:calc(var(--header) + var(--subnav) + 1rem);max-height:calc(100vh - var(--header) - var(--subnav) - 2rem);overflow:auto;font-size:.86rem}
.toc-head{display:flex;justify-content:flex-start;margin:.15rem 0 1rem}
.copy-page{display:inline-flex;align-items:center;gap:.4rem;border:1px solid var(--border);background:var(--bg);color:var(--muted);border-radius:6px;padding:.4rem .6rem;font:600 .78rem/1.2 var(--sans);cursor:pointer}
.copy-page:hover{color:var(--text);background:var(--hover)}
.copy-page.copied{color:var(--green);border-color:var(--green)}
.toc-nav a{display:block;padding:.27rem 0;color:var(--muted);line-height:1.4}
.toc-nav a:hover{color:var(--text);text-decoration:none}
.toc-nav a.active{color:var(--text);font-weight:600}
.toc-section{margin-bottom:.45rem}
.toc-sub{margin:.1rem 0 .4rem .65rem;border-left:1px solid var(--border);padding-left:.65rem}
.toc-sub a{font-size:.82rem;color:var(--faint);padding:.18rem 0}
.toc-sub a:hover{color:var(--muted)}
@media (max-width:1180px){
  .shell{grid-template-columns:14rem minmax(0,1fr);justify-content:normal;max-width:70rem}
  .toc{display:none}
}
@media (max-width:960px){
  .header-top{grid-template-columns:1fr auto;gap:1rem}
  .search-wrap{display:none}
  .header-actions .header-link span{display:none}
  .shell{display:block;max-width:none;padding:1.5rem 1.15rem 3rem}
  .sidenav{display:none}
  .mobile-nav{display:block}
  .doc-section{margin-top:2.4rem}
  .section-source{opacity:1}
  h1{font-size:2.1rem}
  .section-head h2{font-size:1.45rem}
  .topnav{gap:1.2rem}
  .doc-section p,.doc-section li{max-width:none}
  table{min-width:0;font-size:.84rem;table-layout:fixed}
  .table-wrap{overflow-x:visible}
  .table-wrap code,.table-wrap th,.table-wrap td{overflow-wrap:anywhere}
}
@media print{
  .site-header,.sidenav,.toc,.mobile-nav,.copy,.section-source,.page-footer{display:none}
  body{background:#fff;color:#000}
  .shell{display:block;max-width:none;padding:0}
  .doc-section{margin-top:1.4rem}
  pre{background:#f5f5f5;border:1px solid #ddd;white-space:pre-wrap}
  a{color:#000;text-decoration:underline}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *{transition-duration:.001ms !important;animation-duration:.001ms !important}
}
`;

const JS = `
(function(){
  var indexEl=document.getElementById('search-index');
  var index=indexEl?JSON.parse(indexEl.textContent):[];
  var search=document.getElementById('search');
  var panel=document.getElementById('search-panel');
  var wrap=document.getElementById('search-wrap');
  var active=-1;

  function esc(value){
    return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function close(){
    if(panel){panel.hidden=true;panel.innerHTML='';}
    if(search) search.setAttribute('aria-expanded','false');
    active=-1;
  }

  function render(query){
    if(!panel) return;
    var q=query.trim().toLowerCase();
    if(!q){close();return;}
    var hits=index.filter(function(item){return item.label.toLowerCase().indexOf(q)>=0 || item.section.toLowerCase().indexOf(q)>=0;}).slice(0,9);
    panel.innerHTML=hits.length?hits.map(function(item,i){
      return '<a class="search-item'+(i===0?' active':'')+'" href="'+item.href+'"><span>'+esc(item.label)+'</span><small>'+esc(item.section)+'</small></a>';
    }).join(''):'<p class="search-empty">No matches</p>';
    panel.hidden=false;
    search.setAttribute('aria-expanded','true');
    active=hits.length?0:-1;
  }

  if(search){
    search.addEventListener('input',function(){render(search.value);});
    search.addEventListener('keydown',function(event){
      var items=[].slice.call(panel.querySelectorAll('.search-item'));
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        if(!items.length) return;
        event.preventDefault();
        active=(active+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
        items.forEach(function(item,i){item.classList.toggle('active',i===active);});
      } else if(event.key==='Enter'){
        if(active>=0&&items[active]){event.preventDefault();window.location.hash=items[active].getAttribute('href');close();search.blur();}
      } else if(event.key==='Escape'){
        close();search.blur();
      }
    });
    document.addEventListener('keydown',function(event){
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();search.focus();search.select();
      }
    });
    document.addEventListener('click',function(event){
      if(wrap&&!wrap.contains(event.target)) close();
    });
  }

  document.querySelectorAll('pre[data-copy]').forEach(function(pre){
    var btn=document.createElement('button');
    btn.className='copy';btn.type='button';btn.setAttribute('aria-label','Copy code');
    btn.innerHTML='<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M7 2h7a2 2 0 0 1 2 2v7h-2V4H7V2Zm-3 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v9h7V7H4Z" fill="currentColor"/></svg>';
    btn.addEventListener('click',function(){
      var code=pre.querySelector('code');
      var text=code?code.textContent:'';
      var done=function(){
        btn.classList.add('copied');
        setTimeout(function(){btn.classList.remove('copied');},1200);
      };
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done);
      } else {
        var range=document.createRange();range.selectNodeContents(code);
        var selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
        done();
      }
    });
    pre.appendChild(btn);
  });

  var copyPage=document.getElementById('copy-page');
  if(copyPage){
    copyPage.addEventListener('click',function(){
      var main=document.querySelector('main');
      var text=main?main.innerText:'';
      var done=function(){
        copyPage.classList.add('copied');
        var label=copyPage.querySelector('span');
        if(label){label.textContent='Copied';setTimeout(function(){label.textContent='Copy page';copyPage.classList.remove('copied');},1400);}
      };
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done);
      }
    });
  }

  var sections=[].slice.call(document.querySelectorAll('.doc-section'));
  var navLinks=[].slice.call(document.querySelectorAll('[data-nav]'));
  var topLinks=[].slice.call(document.querySelectorAll('[data-group]'));
  var tocLinks=[].slice.call(document.querySelectorAll('[data-toc]'));

  function setActive(section){
    if(!section) return;
    navLinks.forEach(function(link){link.classList.toggle('active',link.getAttribute('data-nav')===section.id);});
    tocLinks.forEach(function(link){link.classList.toggle('active',link.getAttribute('data-toc')===section.id);});
    var group=section.getAttribute('data-group')||'start';
    topLinks.forEach(function(link){link.classList.toggle('active',link.getAttribute('data-group')===group);});
  }

  if('IntersectionObserver' in window && sections.length){
    var observer=new IntersectionObserver(function(entries){
      var visible=entries.filter(function(entry){return entry.isIntersecting;});
      if(!visible.length) return;
      visible.sort(function(a,b){return a.boundingClientRect.top-b.boundingClientRect.top;});
      setActive(visible[0].target);
    },{rootMargin:'-20% 0px -65% 0px',threshold:0});
    sections.forEach(function(section){observer.observe(section);});
  }
})();
`;
main();
