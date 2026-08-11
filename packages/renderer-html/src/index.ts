import * as path from "path";
import type {
  DocIR,
  DocumentationPage,
  DocumentationPlan,
  MemberNode,
  ModuleNode,
  OutputArtifact,
  PluginConfig,
  PluginValidationResult,
  RendererPlugin,
} from "@docgen/core";

interface SitePage {
  filePath: string;
  title: string;
  summary: string;
  sourcePaths: string[];
  sourceModules: string[];
  body: string;
}

interface SearchEntry {
  title: string;
  path: string;
  summary: string;
  text: string;
}

export class HtmlRenderer implements RendererPlugin {
  readonly name = "@docgen/renderer-html";
  readonly version = "1.1.0";
  readonly type = "renderer" as const;
  readonly format = "html";
  readonly supports = ["html", "static-site"];

  private mode: "developer" | "exhaustive" = "developer";
  private baseUrl = "/";
  private searchEnabled = true;
  private repository?: string;
  private sourceBranch = "main";

  async initialize(config: PluginConfig): Promise<void> {
    const html = config.projectConfig.output.html;
    this.mode = config.projectConfig.documentation.mode;
    this.baseUrl = normalizeBaseUrl(html.baseUrl);
    this.searchEnabled = html.search;
    this.repository = config.projectConfig.project.repository;
    this.sourceBranch = String(html.options.sourceBranch ?? "main");
  }

  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }

  async cleanup(): Promise<void> {}

  async render(docir: DocIR): Promise<OutputArtifact[]> {
    const pages = this.mode === "developer"
      ? this.createDeveloperPages(docir)
      : this.createExhaustivePages(docir);
    const searchEntries = pages.map((page) => this.createSearchEntry(page));
    const artifacts = pages.map((page) =>
      this.createArtifact(
        page.filePath,
        this.renderLayout(docir, page, pages),
        "text/html",
        page.sourceModules
      )
    );

    artifacts.push(
      this.createArtifact("assets/styles.css", STYLES, "text/css", []),
      this.createArtifact("assets/app.js", CLIENT_SCRIPT, "text/javascript", []),
      this.createArtifact(
        "search-index.json",
        JSON.stringify(searchEntries, null, 2) + "\n",
        "application/json",
        docir.modules.map((module) => module.id)
      )
    );
    return artifacts;
  }

  private createDeveloperPages(docir: DocIR): SitePage[] {
    const plan = docir.documentationPlan;
    if (!plan) {
      throw new Error("Developer HTML output requires a documentation plan.");
    }
    return collectPlanPages(plan).map((page) => ({
      filePath: toHtmlPath(page.filePath),
      title: page.title,
      summary: page.summary,
      sourcePaths: page.sourcePaths,
      sourceModules: page.moduleIds,
      body: this.renderPlanPage(page, plan),
    }));
  }

  private createExhaustivePages(docir: DocIR): SitePage[] {
    const pages: SitePage[] = [];
    const languages = new Map<string, ModuleNode[]>();
    for (const module of docir.modules) {
      const modules = languages.get(module.language) ?? [];
      modules.push(module);
      languages.set(module.language, modules);
    }

    pages.push({
      filePath: "index.html",
      title: `${docir.metadata.name} API`,
      summary: docir.metadata.description ?? "Generated API reference.",
      sourcePaths: [],
      sourceModules: docir.modules.map((module) => module.id),
      body: this.renderModuleIndex(docir.modules),
    });

    for (const [language, modules] of languages) {
      pages.push({
        filePath: `${language}/index.html`,
        title: `${displayLanguage(language)} API`,
        summary: `${modules.length} documented ${displayLanguage(language)} modules.`,
        sourcePaths: modules.map((module) => module.filePath),
        sourceModules: modules.map((module) => module.id),
        body: this.renderModuleIndex(modules),
      });
      for (const module of modules) {
        pages.push({
          filePath: `${language}/${safeFileName(module.name)}.html`,
          title: module.name,
          summary: module.description || `${module.kind} in ${module.filePath}`,
          sourcePaths: [module.filePath],
          sourceModules: [module.id],
          body: this.renderModule(module),
        });
      }
    }
    return pages;
  }

  private renderPlanPage(page: DocumentationPage, plan: DocumentationPlan): string {
    const sections = page.sections.map((section) => {
      const paragraphs = section.paragraphs.map((item) => `<p>${formatInline(item)}</p>`).join("");
      const bullets = section.bullets.length
        ? `<ul>${section.bullets.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ul>`
        : "";
      const table = section.table
        ? renderTable(section.table.headers, section.table.rows)
        : "";
      const code = section.codeBlocks
        .map(
          (block) =>
            `<pre><code class="language-${escapeAttribute(block.language)}">${escapeHtml(block.code)}</code></pre>`
        )
        .join("");
      return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs}${table}${bullets}${code}</section>`;
    }).join("");

    const map = page.filePath === "README.md"
      ? `<section><h2>Documentation map</h2><div class="card-grid">${collectPlanPages(plan)
          .filter((item) => item.filePath !== "README.md")
          .map(
            (item) =>
              `<a class="card" href="${this.siteUrl(toHtmlPath(item.filePath))}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.summary)}</span></a>`
          )
          .join("")}</div></section>`
      : "";
    const diagram = page.filePath === plan.pages.architecture.filePath
      ? this.renderArchitectureDiagram(plan)
      : "";
    return `${diagram}${sections}${map}`;
  }

  private renderArchitectureDiagram(plan: DocumentationPlan): string {
    const languageNodes = plan.project.techStack
      .filter((item) => /typescript|javascript|java|react|spring/i.test(item))
      .slice(0, 4);
    const sources = languageNodes.length ? languageNodes : ["Source code"];
    const lines = ["flowchart LR"];
    sources.forEach((source, index) => lines.push(`  source${index}[${mermaidText(source)}] --> docir[DocIR]`));
    lines.push("  docir --> markdown[Markdown]");
    lines.push("  docir --> html[HTML site]");
    lines.push("  docir --> pdf[PDF]");
    return `<section class="diagram"><h2>Documentation pipeline</h2><pre class="mermaid">${escapeHtml(lines.join("\n"))}</pre></section>`;
  }

  private renderModuleIndex(modules: ModuleNode[]): string {
    if (!modules.length) return '<p class="empty">No documentable modules were found.</p>';
    const cards = [...modules]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((module) => {
        const target = `${module.language}/${safeFileName(module.name)}.html`;
        return `<a class="card module-card" href="${this.siteUrl(target)}">
          <span class="eyebrow">${escapeHtml(module.language)} · ${escapeHtml(module.kind)}</span>
          <strong>${escapeHtml(module.name)}</strong>
          <span>${escapeHtml(module.description || module.filePath)}</span>
          <span class="coverage">${module.coverage.overall}% documented</span>
        </a>`;
      })
      .join("");
    return `<section><h2>Modules</h2><div class="card-grid">${cards}</div></section>`;
  }

  private renderModule(module: ModuleNode): string {
    const badges = `<div class="badges"><span>${escapeHtml(module.language)}</span><span>${escapeHtml(module.kind)}</span><span>${module.coverage.overall}% coverage</span></div>`;
    const members = module.members.filter((member) => member.visibility !== "private");
    const memberContent = members.length
      ? members.map((member) => this.renderMember(member)).join("")
      : '<p class="empty">No public members.</p>';
    const react = module.react?.component
      ? `<section><h2>Props</h2>${renderTable(
          ["Name", "Type", "Required", "Default", "Description"],
          module.react.component.props.map((prop) => [
            prop.name,
            prop.type.raw,
            prop.required ? "Yes" : "No",
            prop.defaultValue ?? "-",
            prop.description || "-",
          ])
        )}</section>`
      : "";
    return `${badges}<p class="lead">${escapeHtml(module.description || "No description provided.")}</p>${react}<section><h2>Members</h2>${memberContent}</section>`;
  }

  private renderMember(member: MemberNode): string {
    const deprecated = member.deprecated
      ? `<div class="notice">Deprecated: ${escapeHtml(member.deprecated.message)}</div>`
      : "";
    const endpoint = member.endpoint
      ? `<div class="endpoint"><span class="method">${member.endpoint.httpMethod}</span><code>${escapeHtml(member.endpoint.path)}</code><span>Returns ${escapeHtml(member.endpoint.responseType.raw)}</span></div>`
      : "";
    const parameters = member.parameters.length
      ? renderTable(
          ["Parameter", "Type", "Required", "Description"],
          member.parameters.map((parameter) => [
            parameter.name,
            parameter.type.raw,
            parameter.isOptional ? "No" : "Yes",
            parameter.description || "-",
          ])
        )
      : "";
    return `<article class="member" id="${slug(member.name)}"><h3>${escapeHtml(member.name)}</h3>${deprecated}${endpoint}<pre><code>${escapeHtml(member.signature)}</code></pre><p>${escapeHtml(member.description || "No description provided.")}</p>${parameters}</article>`;
  }

  private renderLayout(docir: DocIR, page: SitePage, pages: SitePage[]): string {
    const nav = pages
      .map(
        (item) =>
          `<a${item.filePath === page.filePath ? ' aria-current="page"' : ""} href="${this.siteUrl(item.filePath)}">${escapeHtml(item.title)}</a>`
      )
      .join("");
    const sourceLinks = page.sourcePaths.length
      ? `<div class="source-links">${page.sourcePaths.slice(0, 8).map((source) => this.renderSourceLink(source)).join("")}</div>`
      : "";
    const search = this.searchEnabled
      ? '<label class="search"><span>Search docs</span><input id="doc-search" type="search" placeholder="Search pages and symbols" autocomplete="off"><div id="search-results"></div></label>'
      : "";
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeAttribute(page.summary)}">
  <title>${escapeHtml(page.title)} · ${escapeHtml(docir.metadata.name)}</title>
  <link rel="stylesheet" href="${this.siteUrl("assets/styles.css")}">
</head>
<body data-base-url="${escapeAttribute(this.baseUrl)}">
  <a class="skip-link" href="#content">Skip to content</a>
  <header class="topbar"><a class="brand" href="${this.siteUrl("index.html")}"><span>RS</span>${escapeHtml(docir.metadata.name)}</a><button id="nav-toggle" aria-label="Toggle navigation">Menu</button></header>
  <div class="shell">
    <aside id="sidebar">${search}<nav aria-label="Documentation">${nav}</nav></aside>
    <main id="content"><div class="eyebrow">Generated documentation</div><h1>${escapeHtml(page.title)}</h1><p class="lead">${escapeHtml(page.summary)}</p>${sourceLinks}${page.body}<footer>Generated by RepoScribe ${escapeHtml(docir.metadata.generatorVersion)}</footer></main>
  </div>
  <script src="${this.siteUrl("assets/app.js")}" defer></script>
  <script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'; mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'strict' });</script>
</body>
</html>\n`;
  }

  private renderSourceLink(sourcePath: string): string {
    const label = escapeHtml(sourcePath.replace(/\\/g, "/"));
    if (!this.repository) return `<code>${label}</code>`;
    const repository = this.repository.replace(/\.git$/, "").replace(/\/$/, "");
    const href = `${repository}/blob/${encodeURIComponent(this.sourceBranch)}/${sourcePath.replace(/\\/g, "/")}`;
    return `<a href="${escapeAttribute(href)}" rel="noreferrer">${label}</a>`;
  }

  private createSearchEntry(page: SitePage): SearchEntry {
    return {
      title: page.title,
      path: page.filePath,
      summary: page.summary,
      text: stripTags(page.body).slice(0, 4000),
    };
  }

  private siteUrl(filePath: string): string {
    return `${this.baseUrl}${filePath.replace(/\\/g, "/")}`;
  }

  private createArtifact(
    filePath: string,
    content: string,
    mimeType: string,
    sourceModules: string[]
  ): OutputArtifact {
    return {
      filePath,
      content,
      mimeType,
      size: Buffer.byteLength(content),
      metadata: {
        generatedAt: new Date().toISOString(),
        sourceModules,
        format: "html",
      },
    };
  }
}

function collectPlanPages(plan: DocumentationPlan): DocumentationPage[] {
  return [
    plan.pages.readme,
    plan.pages.architecture,
    plan.pages.projectStructure,
    plan.pages.setup,
    ...plan.pages.features,
    plan.pages.api,
    plan.pages.components,
    plan.pages.state,
    plan.pages.testing,
    plan.pages.troubleshooting,
  ];
}

function toHtmlPath(filePath: string): string {
  if (/^(README|index)\.md$/i.test(filePath)) return "index.html";
  return filePath.replace(/\.md$/i, ".html").replace(/\\/g, "/");
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

function renderTable(headers: string[], rows: string[][]): string {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${formatInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function formatInline(value: string): string {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9_.-]+/gi, "-");
}

function slug(value: string): string {
  return safeFileName(value).toLowerCase();
}

function displayLanguage(value: string): string {
  return value === "typescript" ? "TypeScript" : value === "java" ? "Java" : value;
}

function mermaidText(value: string): string {
  return value.replace(/[\[\]{}()"']/g, "");
}

const CLIENT_SCRIPT = `(() => {
  const body = document.body;
  const base = body.dataset.baseUrl || '/';
  const input = document.getElementById('doc-search');
  const results = document.getElementById('search-results');
  let index;
  if (input && results) {
    input.addEventListener('input', async () => {
      const query = input.value.trim().toLowerCase();
      if (!query) { results.innerHTML = ''; return; }
      index ||= await fetch(base + 'search-index.json').then(response => response.json());
      const matches = index.filter(item => (item.title + ' ' + item.summary + ' ' + item.text).toLowerCase().includes(query)).slice(0, 8);
      results.innerHTML = matches.length ? matches.map(item => '<a href="' + base + item.path + '"><strong>' + escapeText(item.title) + '</strong><span>' + escapeText(item.summary) + '</span></a>').join('') : '<p>No results</p>';
    });
  }
  document.getElementById('nav-toggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('open'));
  function escapeText(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
})();\n`;

const STYLES = `:root{--ink:#172033;--muted:#61708a;--line:#dfe5ee;--paper:#fff;--wash:#f5f7fb;--brand:#5b4cf0;--accent:#13a38b;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--wash);line-height:1.6}*{box-sizing:border-box}body{margin:0}.skip-link{position:absolute;left:-9999px}.skip-link:focus{left:1rem;top:1rem;z-index:10;background:#fff;padding:.5rem}.topbar{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 1.25rem;background:#13182a;color:#fff;position:sticky;top:0;z-index:5}.brand{display:flex;gap:.65rem;align-items:center;color:#fff;text-decoration:none;font-weight:750}.brand span{display:grid;place-items:center;width:34px;height:34px;background:linear-gradient(135deg,var(--brand),var(--accent));border-radius:10px;font-size:.78rem}.topbar button{display:none;background:#fff1;border:1px solid #fff4;color:#fff;border-radius:8px;padding:.45rem .7rem}.shell{display:grid;grid-template-columns:290px minmax(0,1fr);max-width:1500px;margin:auto;min-height:calc(100vh - 64px)}aside{padding:1.4rem;border-right:1px solid var(--line);background:#fff}nav{display:flex;flex-direction:column;gap:.2rem;max-height:calc(100vh - 180px);overflow:auto}nav a{color:var(--muted);text-decoration:none;padding:.5rem .7rem;border-radius:8px;font-size:.9rem}nav a:hover,nav a[aria-current=page]{color:var(--brand);background:#f0efff}.search{display:block;position:relative;margin-bottom:1rem}.search>span{display:block;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700;margin-bottom:.35rem}.search input{width:100%;border:1px solid var(--line);border-radius:9px;padding:.65rem .75rem;font:inherit}#search-results{position:absolute;left:0;right:0;top:70px;background:#fff;border:1px solid var(--line);box-shadow:0 15px 35px #18213a22;border-radius:10px;overflow:hidden;z-index:4}#search-results:empty{display:none}#search-results a{display:flex;flex-direction:column;padding:.65rem .75rem;color:var(--ink);text-decoration:none;border-bottom:1px solid var(--line);font-size:.82rem}#search-results a span{color:var(--muted)}main{width:min(960px,100%);padding:3.5rem clamp(1.4rem,5vw,5rem);background:var(--paper);min-height:100%;box-shadow:0 0 60px #2633540c}h1{font-size:clamp(2.2rem,5vw,4rem);line-height:1.06;letter-spacing:-.045em;margin:.35rem 0 1rem}h2{font-size:1.55rem;margin:2.8rem 0 1rem}h3{font-size:1.15rem}.lead{font-size:1.12rem;color:var(--muted);max-width:72ch}.eyebrow{text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;font-weight:800;color:var(--brand)}.source-links{display:flex;flex-wrap:wrap;gap:.5rem;margin:1.2rem 0}.source-links a,.source-links>code{font-size:.78rem;color:var(--brand);background:#f0efff;padding:.35rem .55rem;border-radius:6px;text-decoration:none}.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}.card{display:flex;flex-direction:column;gap:.4rem;border:1px solid var(--line);border-radius:14px;padding:1.05rem;text-decoration:none;color:var(--ink);background:#fff;transition:.15s ease}.card:hover{border-color:#aaa2ff;transform:translateY(-2px);box-shadow:0 10px 25px #2c3a5b12}.card span{color:var(--muted);font-size:.88rem}.card .coverage{color:var(--accent);font-weight:700}.badges{display:flex;flex-wrap:wrap;gap:.45rem}.badges span,.method{background:#edf9f6;color:#087461;border-radius:999px;padding:.25rem .6rem;font-size:.78rem;font-weight:750}.member{border-top:1px solid var(--line);padding:1rem 0 1.4rem}.notice{border-left:4px solid #e39027;background:#fff6e8;padding:.7rem 1rem}.endpoint{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;background:#f4f8ff;border-radius:10px;padding:.75rem}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;padding:.65rem .8rem;border-bottom:1px solid var(--line);vertical-align:top}th{background:var(--wash);font-size:.75rem;text-transform:uppercase;letter-spacing:.04em}pre{background:#151b2d;color:#e8ecf5;padding:1rem;border-radius:11px;overflow:auto;font-size:.86rem}code{font-family:"SFMono-Regular",Consolas,monospace}.mermaid{background:#fff;color:var(--ink);border:1px solid var(--line)}.empty{color:var(--muted);font-style:italic}footer{border-top:1px solid var(--line);margin-top:4rem;padding-top:1.2rem;color:var(--muted);font-size:.8rem}@media(max-width:800px){.topbar button{display:block}.shell{display:block}aside{display:none;position:fixed;inset:64px 0 0 0;z-index:4;overflow:auto}aside.open{display:block}nav{max-height:none}main{padding-top:2.2rem}h1{font-size:2.5rem}}\n`;

export default HtmlRenderer;
