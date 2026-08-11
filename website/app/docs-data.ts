export type CodeSample = {
  label?: string;
  language: string;
  value: string;
};

export type DocSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: { title: string; text: string }[];
  code?: CodeSample;
  note?: { label: string; text: string; tone?: "warm" | "cool" };
  table?: { headers: string[]; rows: string[][] };
};

export type DocPage = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  readTime: string;
  sections: DocSection[];
};

export const navGroups = [
  {
    title: "Start here",
    items: [
      { slug: "getting-started", title: "Getting started" },
      { slug: "generating-docs", title: "Generating docs" },
    ],
  },
  {
    title: "Core concepts",
    items: [
      { slug: "architecture", title: "How RepoScribe works" },
      { slug: "configuration", title: "Configuration" },
      { slug: "cli-reference", title: "CLI reference" },
    ],
  },
  {
    title: "Extend & ship",
    items: [
      { slug: "plugin-development", title: "Plugin development" },
      { slug: "ci-cd", title: "CI/CD integration" },
      { slug: "roadmap", title: "Roadmap & phases" },
      { slug: "troubleshooting", title: "Troubleshooting" },
    ],
  },
];

export const docPages: DocPage[] = [
  {
    slug: "getting-started",
    category: "Start here",
    title: "Getting started",
    summary:
      "Install RepoScribe, add one configuration file, and generate your first developer guide.",
    readTime: "5 min read",
    sections: [
      {
        id: "requirements",
        title: "Before you begin",
        paragraphs: [
          "RepoScribe runs on Node.js 20 or newer. It currently understands React and TypeScript projects, plus Java and Spring Boot codebases.",
        ],
        table: {
          headers: ["Project", "Parser", "What it recognizes"],
          rows: [
            ["React / TypeScript", "@docgen/parser-typescript", "Components, functions, classes, types, and services"],
            ["Java / Spring Boot", "@docgen/parser-java", "Classes, interfaces, enums, Javadocs, stereotypes, and REST mappings"],
          ],
        },
      },
      {
        id: "install",
        title: "Install in your repository",
        paragraphs: [
          "During local development, install RepoScribe from this workspace as a development dependency. Once published, the same workflow works with the package name from your registry.",
        ],
        code: {
          language: "bash",
          label: "Terminal",
          value: "npm install --save-dev file:../RepoScribe",
        },
      },
      {
        id: "add-script",
        title: "Add a generation command",
        paragraphs: [
          "Give the team a stable command to run locally and in CI by adding RepoScribe to package.json.",
        ],
        code: {
          language: "json",
          label: "package.json",
          value: `{
  "scripts": {
    "docs:generate": "reposcribe-docs"
  }
}`,
        },
      },
      {
        id: "configure",
        title: "Create .docgen.yaml",
        paragraphs: [
          "The smallest useful configuration names the project, points to its source, and chooses a parser. Output and validation settings have safe defaults.",
        ],
        code: {
          language: "yaml",
          label: ".docgen.yaml",
          value: `project:
  name: my-app

languages:
  - name: typescript
    source: src
    include: ["**/*.ts", "**/*.tsx"]
    exclude: ["**/*.test.ts", "**/node_modules/**"]
    parser: "@docgen/parser-typescript"

output:
  markdown:
    enabled: true
    outputDir: docs/generated`,
        },
      },
      {
        id: "generate",
        title: "Generate your docs",
        steps: [
          { title: "Run the command", text: "Execute npm run docs:generate from the target repository." },
          { title: "Review the guide", text: "Open docs/generated/README.md and follow the links into architecture, features, APIs, and setup." },
          { title: "Commit intentionally", text: "Keep generated docs in version control when reviewable diffs are part of your team workflow." },
        ],
        code: {
          language: "bash",
          label: "Terminal",
          value: "npm run docs:generate",
        },
        note: {
          label: "Tip",
          text: "This repository writes generated output to docs/generated so it never collides with the hand-written product docs under docs/.",
        },
      },
    ],
  },
  {
    slug: "generating-docs",
    category: "Start here",
    title: "Generating documentation",
    summary:
      "Choose a documentation mode, output format, and generation workflow that fits your team.",
    readTime: "6 min read",
    sections: [
      {
        id: "developer-mode",
        title: "Developer mode",
        paragraphs: [
          "Developer mode is the default. It plans a compact, layered documentation set for engineers who need to understand and change the system—not a file-by-file code dump.",
        ],
        bullets: [
          "A documentation hub and architecture overview",
          "Project structure and local setup",
          "Feature-oriented pages",
          "Combined service, component, and state references",
          "Testing and troubleshooting guides",
          "One combined PDF guide when PDF output is enabled",
        ],
        code: {
          language: "bash",
          label: "Terminal",
          value: "reposcribe-cli generate --mode developer --format markdown pdf",
        },
      },
      {
        id: "exhaustive-mode",
        title: "Exhaustive mode",
        paragraphs: [
          "Use exhaustive mode when you need symbol-by-symbol output for audits, migrations, or deep API inspection. It favors completeness over a compact reading experience.",
        ],
        code: {
          language: "bash",
          label: "Terminal",
          value: "reposcribe-cli generate --mode exhaustive --format markdown pdf",
        },
        note: {
          label: "Choose intentionally",
          text: "Start with developer mode for day-to-day onboarding. Reach for exhaustive mode when the job specifically depends on export-level coverage.",
          tone: "cool",
        },
      },
      {
        id: "outputs",
        title: "Output formats",
        table: {
          headers: ["Format", "Best for", "Current behavior"],
          rows: [
            ["Markdown", "Repositories, reviews, and searchable knowledge", "Structured GFM files with cross-links"],
            ["HTML", "Documentation portals and GitHub Pages", "Responsive static site with search, source links, and diagrams"],
            ["PDF", "Offline reading and a single shareable artifact", "One combined, text-first developer guide"],
          ],
        },
        paragraphs: [
          "The current PDF renderer is text-first. Combined PDFs work today; embedded screenshots, charts, and richer page composition require a future HTML-to-PDF renderer.",
        ],
      },
      {
        id: "pipeline",
        title: "What happens during generation",
        steps: [
          { title: "Parse", text: "A language plugin reads source files and normalizes symbols into DocIR." },
          { title: "Transform", text: "RepoScribe resolves links, analyzes documentation coverage, and plans the developer-facing information architecture." },
          { title: "Render", text: "One or more renderer plugins turn DocIR into Markdown, HTML, and PDF artifacts." },
          { title: "Validate", text: "Configured coverage rules report missing descriptions, parameters, returns, and examples." },
        ],
      },
    ],
  },
  {
    slug: "architecture",
    category: "Core concepts",
    title: "How RepoScribe works",
    summary:
      "Follow source code through the parser, DocIR, transformation pipeline, and renderers.",
    readTime: "8 min read",
    sections: [
      {
        id: "overview",
        title: "A plugin-first pipeline",
        paragraphs: [
          "RepoScribe separates language knowledge from documentation planning and output formatting. The core orchestrator coordinates each stage while plugins do the project-specific work.",
        ],
        code: {
          language: "text",
          label: "Pipeline",
          value: `Source files
    ↓
Parser plugin → DocIR → Transforms → Renderer plugins
                               ↙              ↘
                         Markdown             PDF`,
        },
      },
      {
        id: "packages",
        title: "Workspace packages",
        table: {
          headers: ["Package", "Responsibility"],
          rows: [
            ["@docgen/core", "Configuration, DocIR types, plugin loading, transforms, and orchestration"],
            ["@docgen/cli", "init, generate, validate, diff, and ADR commands"],
            ["@docgen/parser-typescript", "React-aware TypeScript and TSX parsing with ts-morph"],
            ["@docgen/parser-java", "Java and Spring metadata parsing with tree-sitter WASM"],
            ["@docgen/renderer-markdown", "GitHub-flavored Markdown output"],
            ["@docgen/renderer-html", "Responsive static site, client-side search, and Mermaid diagrams"],
            ["@docgen/renderer-pdf", "One combined PDF developer guide"],
          ],
        },
      },
      {
        id: "docir",
        title: "DocIR: the shared language",
        paragraphs: [
          "DocIR is the stable intermediate representation between parsers and renderers. It records project metadata, modules, members, parameters, types, examples, ADRs, changelog entries, and coverage signals.",
          "Because renderers consume DocIR instead of source code directly, a new language parser automatically gains access to every compatible renderer.",
        ],
        code: {
          language: "json",
          label: "Simplified DocIR",
          value: `{
  "metadata": { "name": "my-app", "languages": ["typescript"] },
  "modules": [
    { "id": "src/user-service", "kind": "service", "members": [] }
  ],
  "adrs": [],
  "changelog": []
}`,
        },
      },
      {
        id: "dependency-direction",
        title: "Dependency direction",
        paragraphs: [
          "The internal package graph is acyclic. Parsers, renderers, and the CLI depend on core; core does not depend on any concrete parser or renderer. Runtime plugin loading connects them without reversing that dependency.",
        ],
        note: {
          label: "Design payoff",
          text: "Acyclic package boundaries keep plugin development isolated and make individual packages easier to test.",
          tone: "cool",
        },
      },
    ],
  },
  {
    slug: "configuration",
    category: "Core concepts",
    title: "Configuration reference",
    summary:
      "Control project metadata, source discovery, output formats, validation, ADRs, and changelogs.",
    readTime: "10 min read",
    sections: [
      {
        id: "minimal",
        title: "Minimal configuration",
        paragraphs: [
          "Only a project name and one language entry are required. Every other section falls back to defaults.",
        ],
        code: {
          language: "yaml",
          label: ".docgen.yaml",
          value: `project:
  name: my-app

languages:
  - name: typescript
    source: src
    parser: "@docgen/parser-typescript"`,
        },
      },
      {
        id: "languages",
        title: "Language sources",
        paragraphs: [
          "Each language entry describes where to scan, which files to include, what to ignore, and which parser plugin to load.",
        ],
        table: {
          headers: ["Field", "Type", "Purpose"],
          rows: [
            ["name", "java | typescript | python", "Identifies the source language"],
            ["source", "string", "Root directory to scan"],
            ["include", "string[]", "Glob patterns to include; defaults to every file"],
            ["exclude", "string[]", "Tests, generated files, and other paths to skip"],
            ["parser", "string", "Parser plugin package name"],
            ["options", "object", "Parser-specific settings"],
          ],
        },
      },
      {
        id: "output",
        title: "Output",
        code: {
          language: "yaml",
          label: ".docgen.yaml",
          value: `output:
  markdown:
    enabled: true
    outputDir: docs/generated
    includeSourceLinks: true
    collapsibleSections: true

  pdf:
    enabled: true
    engine: puppeteer
    outputDir: docs/pdf
    options:
      fileName: developer-guide.pdf`,
        },
        paragraphs: [
          "Markdown can be emitted as linked repository files. PDF output combines the developer guide into one portable document.",
        ],
      },
      {
        id: "validation",
        title: "Coverage and validation",
        paragraphs: [
          "Coverage rules can warn or fail when public APIs are missing descriptions, parameter docs, return docs, or examples. Set enforce to true when the threshold should block generation or CI.",
        ],
        code: {
          language: "yaml",
          label: ".docgen.yaml",
          value: `validation:
  coverage:
    threshold: 80
    enforce: false
    exclude: ["**/internal/**"]
  rules:
    require-description: warn
    require-param-docs: warn
    require-return-docs: off
    require-examples: off`,
        },
      },
      {
        id: "project-features",
        title: "ADRs and changelogs",
        table: {
          headers: ["Section", "Useful fields"],
          rows: [
            ["adr", "directory, template, idFormat"],
            ["changelog", "conventionalCommits, groupBy, outputFile, includeCommitHash"],
          ],
        },
        note: {
          label: "Validation",
          text: "The configuration is checked with a Zod schema at load time, so invalid values fail early with a targeted error.",
        },
      },
    ],
  },
  {
    slug: "cli-reference",
    category: "Core concepts",
    title: "CLI reference",
    summary:
      "Use RepoScribe from local scripts, terminals, and automated pipelines.",
    readTime: "7 min read",
    sections: [
      {
        id: "generate",
        title: "generate",
        paragraphs: [
          "Parse configured source code, run the transformation pipeline, and write selected documentation formats.",
        ],
        code: {
          language: "bash",
          label: "Usage",
          value: `reposcribe-cli generate [options]

# Compact developer guide in Markdown and PDF
reposcribe-cli generate --mode developer --format markdown pdf

# Symbol-level, searchable HTML reference
reposcribe-cli generate --mode exhaustive --format html

# Regenerate after source changes
reposcribe-cli generate --watch --format markdown html`,
        },
        table: {
          headers: ["Option", "Meaning"],
          rows: [
            ["--mode developer", "Layered, task-oriented documentation (default)"],
            ["--mode exhaustive", "Module and symbol-level reference output"],
            ["--format markdown html pdf", "One or more requested renderers"],
            ["--watch", "Regenerate after debounced source-file changes"],
          ],
        },
      },
      {
        id: "package-binaries",
        title: "Package binaries",
        table: {
          headers: ["Binary", "Use"],
          rows: [
            ["reposcribe-docs", "Generate from the repository's .docgen.yaml using a package script"],
            ["reposcribe-cli", "Access the complete command interface"],
            ["docgen", "Compatibility alias for the CLI"],
          ],
        },
      },
      {
        id: "workspace-commands",
        title: "Developing RepoScribe itself",
        code: {
          language: "bash",
          label: "Terminal",
          value: `pnpm install
pnpm build
pnpm test
pnpm docs:generate`,
        },
        bullets: [
          "build compiles every workspace package through Turbo",
          "test runs package-level Vitest suites",
          "docs:generate regenerates this repository's own documentation",
        ],
      },
      {
        id: "other-commands",
        title: "Additional commands",
        paragraphs: [
          "The CLI package also contains init, validate, diff, and adr commands. They cover starter configuration, DocIR and coverage validation, documentation changes, and architecture decision records.",
        ],
        note: {
          label: "Automation",
          text: "Prefer a package.json script in shared repositories. It gives local development and CI the exact same entry point.",
          tone: "cool",
        },
      },
    ],
  },
  {
    slug: "plugin-development",
    category: "Extend & ship",
    title: "Plugin development",
    summary:
      "Add a source language, transformation, or output format without changing the core pipeline.",
    readTime: "9 min read",
    sections: [
      {
        id: "plugin-types",
        title: "Choose a plugin type",
        table: {
          headers: ["Type", "Receives", "Produces"],
          rows: [
            ["Parser", "Source files and language config", "DocIR modules and parse diagnostics"],
            ["Transformer", "DocIR", "Enriched or reorganized DocIR"],
            ["Renderer", "DocIR and output config", "Markdown, PDF, or another artifact set"],
          ],
        },
      },
      {
        id: "manifest",
        title: "Define a manifest",
        paragraphs: [
          "Every plugin publishes identity and capability metadata. The loader uses the manifest and runtime type guards to place it in the correct registry.",
        ],
        code: {
          language: "typescript",
          label: "src/index.ts",
          value: `import type { ParserPlugin, PluginManifest } from "@docgen/core";

const manifest: PluginManifest = {
  name: "@acme/parser-kotlin",
  version: "1.0.0",
  type: "parser",
  supportedLanguages: ["kotlin"]
};

export const kotlinParser: ParserPlugin = {
  manifest,
  async parse(input) {
    return { modules: [], errors: [], stats: { files: 0 } };
  }
};`,
        },
      },
      {
        id: "parser-contract",
        title: "Honor the DocIR contract",
        bullets: [
          "Use stable module IDs so cross-links survive regeneration",
          "Preserve source locations when available",
          "Normalize language-specific types into TypeRef values",
          "Return diagnostics instead of silently dropping unreadable source",
          "Populate coverage details so validation remains meaningful",
        ],
        note: {
          label: "Compatibility",
          text: "DocIR decouples parsers and renderers. If your parser produces valid DocIR, it can use the existing Markdown, HTML, and PDF renderers immediately.",
        },
      },
      {
        id: "testing",
        title: "Test with representative fixtures",
        paragraphs: [
          "Keep small source fixtures beside the plugin tests. Cover ordinary declarations, framework metadata, undocumented members, syntax errors, and empty projects.",
        ],
        code: {
          language: "bash",
          label: "Terminal",
          value: "pnpm --filter @acme/parser-kotlin test",
        },
      },
    ],
  },
  {
    slug: "ci-cd",
    category: "Extend & ship",
    title: "CI/CD integration",
    summary:
      "Regenerate documentation in continuous integration and keep changes reviewable.",
    readTime: "6 min read",
    sections: [
      {
        id: "recommended-workflow",
        title: "Recommended workflow",
        steps: [
          { title: "Install deterministically", text: "Use pnpm install --frozen-lockfile so workspace dependencies resolve consistently." },
          { title: "Build RepoScribe", text: "Compile workspace packages before invoking the local binary when using a file dependency." },
          { title: "Generate docs", text: "Run the same docs:generate script developers use locally." },
          { title: "Check the diff", text: "Fail the job when generated documentation no longer matches the committed source." },
        ],
      },
      {
        id: "github-actions",
        title: "GitHub Actions",
        code: {
          language: "yaml",
          label: ".github/workflows/docs.yml",
          value: `name: Verify documentation

on:
  pull_request:
  push:
    branches: [main]

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.9.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
      - run: pnpm test:e2e
      - run: pnpm docs:generate
      - run: git diff --exit-code -- docs`,
        },
      },
      {
        id: "validation-policy",
        title: "Decide what blocks a change",
        table: {
          headers: ["Policy", "Use when"],
          rows: [
            ["Diff only", "Generated docs are committed and must stay current"],
            ["Coverage warnings", "The team is improving documentation incrementally"],
            ["Enforced threshold", "Public API documentation is a release requirement"],
          ],
        },
        note: {
          label: "Practical start",
          text: "Begin with a non-blocking 80% coverage target, then enable enforcement after the baseline is clean.",
          tone: "cool",
        },
      },
    ],
  },
  {
    slug: "roadmap",
    category: "Extend & ship",
    title: "Roadmap & phases",
    summary:
      "See what RepoScribe v1.1 delivers now and how the product advances toward richer output, a public ecosystem, and team-scale documentation.",
    readTime: "8 min read",
    sections: [
      {
        id: "current-phase",
        title: "Current phase: v1.1 foundation — delivered",
        paragraphs: [
          "RepoScribe is now in its v1.1 foundation phase. The core product is no longer limited to Markdown and a text-first PDF: it also produces a responsive static HTML documentation site and supports a dependable local and CI workflow.",
          "The existing @docgen package identifiers remain as compatibility names while the user-facing product, CLI, generated metadata, and release version are aligned around RepoScribe v1.1.0.",
        ],
        table: {
          headers: ["Area", "Delivered in v1.1"],
          rows: [
            ["Output", "Markdown, searchable static HTML, and combined PDF"],
            ["HTML experience", "Responsive navigation, client-side search, source links, and Mermaid architecture diagrams"],
            ["Developer loop", "Debounced watch mode, requested-format activation, and incremental TypeScript parser caching"],
            ["Change safety", "DocIR API diffing, breaking-change exit codes, deterministic pnpm CI, and machine-readable validation"],
            ["Quality", "React and Spring Boot end-to-end fixture plus package-level parser, renderer, core, and CLI tests"],
          ],
        },
        note: {
          label: "Current baseline",
          text: "Documentation coverage is 35% against an 80% target. It is reported as advisory until the baseline is intentionally raised and enforcement is enabled.",
          tone: "cool",
        },
      },
      {
        id: "phase-2",
        title: "Phase 2: v1.2 rich portable output — next",
        paragraphs: [
          "The next phase makes the polished HTML experience portable into the combined PDF and strengthens visual parity across every output format.",
        ],
        bullets: [
          "Use the HTML presentation pipeline as the browser-based PDF source",
          "Embed screenshots, diagrams, charts, local assets, and full Unicode text",
          "Add syntax highlighting and print-aware page headers, footers, and table-of-contents links",
          "Introduce golden visual tests for representative React and Spring Boot guides",
          "Keep Markdown lightweight and review-friendly while preserving equivalent content",
        ],
        note: {
          label: "Exit criterion",
          text: "A single DocIR snapshot produces Markdown, HTML, and PDF guides with matching content, working links, and diagrams that survive print output.",
        },
      },
      {
        id: "phase-3",
        title: "Phase 3: v1.3 ecosystem and releases",
        paragraphs: [
          "Once output parity is stable, RepoScribe can become a conventional installable tool instead of depending on a local workspace checkout.",
        ],
        bullets: [
          "Publish versioned packages under consistent @reposcribe names with compatibility guidance",
          "Automate changelogs, release notes, package provenance, and semantic version checks",
          "Version the DocIR schema and provide explicit compatibility and migration rules",
          "Ship a parser and renderer plugin scaffold with tested examples",
          "Run published-package smoke tests against sample React and Spring Boot repositories",
        ],
        note: {
          label: "Exit criterion",
          text: "A new project installs RepoScribe from a registry, initializes configuration, and generates all supported formats without cloning this repository.",
          tone: "cool",
        },
      },
      {
        id: "phase-4",
        title: "Phase 4: v1.4 language expansion and quality",
        paragraphs: [
          "Language coverage expands only after the plugin contract and release pipeline are stable, keeping new parsers from multiplying maintenance risk.",
        ],
        bullets: [
          "Add a Python parser focused on typed applications and popular web frameworks",
          "Improve framework discovery and generated starter configuration",
          "Track parser performance budgets and documentation quality by ecosystem",
          "Add fixtures for monorepos, mixed-language services, and larger public API surfaces",
          "Offer opt-in generated summaries while keeping extracted facts traceable to source",
        ],
      },
      {
        id: "phase-5",
        title: "Phase 5: v2.0 team documentation platform",
        paragraphs: [
          "The longer-term phase turns generation into a team workflow spanning pull requests, releases, and multiple repositories.",
        ],
        bullets: [
          "Create documentation previews for pull requests and versioned release snapshots",
          "Add cross-repository navigation and reusable organization-level themes",
          "Support remote incremental caches for large workspaces",
          "Provide hosted search and optional usage analytics with clear privacy controls",
          "Expose policy controls for breaking API changes and documentation coverage trends",
        ],
      },
      {
        id: "graduation",
        title: "How a phase graduates",
        steps: [
          { title: "Prove correctness", text: "Builds, package tests, and representative end-to-end fixtures must pass deterministically." },
          { title: "Prove the workflow", text: "The feature must work from the CLI, configuration, CI, and generated documentation—not only through an internal API." },
          { title: "Document the contract", text: "User behavior, configuration, compatibility, limitations, and migration notes must be reflected in the webdocs." },
          { title: "Ship deliberately", text: "Only then is the version tagged, published, and treated as the baseline for the next phase." },
        ],
      },
    ],
  },
  {
    slug: "troubleshooting",
    category: "Extend & ship",
    title: "Troubleshooting",
    summary:
      "Resolve the most common setup, parsing, output, and coverage problems.",
    readTime: "7 min read",
    sections: [
      {
        id: "no-files",
        title: "No source files were found",
        paragraphs: [
          "The language source path is resolved from the repository containing .docgen.yaml. Check that source points to the correct directory and that include and exclude globs do not cancel each other out.",
        ],
        code: {
          language: "yaml",
          label: "Check these fields",
          value: `languages:
  - name: typescript
    source: src
    include: ["**/*.ts", "**/*.tsx"]
    exclude: ["**/*.test.ts", "**/dist/**"]`,
        },
      },
      {
        id: "plugin-load",
        title: "A parser or renderer cannot be loaded",
        bullets: [
          "Build the RepoScribe workspace before generating from a local file dependency",
          "Confirm the plugin package is installed in the target repository",
          "Match the parser name in .docgen.yaml exactly",
          "Use Node.js 20 or newer",
        ],
      },
      {
        id: "docs-collision",
        title: "Generated files overwrite hand-written docs",
        paragraphs: [
          "Point Markdown output at a dedicated directory such as docs/generated. Keep editorial product documentation outside that path.",
        ],
        code: {
          language: "yaml",
          label: ".docgen.yaml",
          value: `output:
  markdown:
    enabled: true
    outputDir: docs/generated`,
        },
      },
      {
        id: "coverage",
        title: "Coverage is lower than expected",
        paragraphs: [
          "RepoScribe scores descriptions, member documentation, parameters, return types, and examples. Start by adding meaningful descriptions to public modules and members; then fill parameter and return details.",
        ],
        note: {
          label: "Threshold behavior",
          text: "With enforce set to false, coverage findings are advisory. Set enforce to true only when you want the configured threshold to block the workflow.",
          tone: "cool",
        },
      },
      {
        id: "pdf",
        title: "The PDF is missing images or charts",
        paragraphs: [
          "The current PDF renderer is intentionally text-first. It supports one combined developer guide, but rich screenshots, diagrams, and charts are not embedded yet.",
        ],
      },
    ],
  },
];

export function getDocPage(slug: string) {
  return docPages.find((page) => page.slug === slug);
}
