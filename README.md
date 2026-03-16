# DocGen

**Universal multi-language documentation generator.**

One CLI. One config. All your languages.

## Features

- **Multi-language** — Java, TypeScript, Python from a single pipeline
- **Plugin architecture** — Parser, transformer, and renderer plugins
- **Multiple outputs** — Markdown, Docusaurus HTML, PDF, Confluence
- **CI-native** — Coverage gates, API diff, JSON output for pipelines
- **ADR management** — Scaffold and track Architecture Decision Records
- **Changelog generation** — From conventional commits

## Quick Start

```bash
# Generate per-component Markdown docs and a combined PDF
npm run docs:generate

# Check coverage (CI gate)
npx docgen validate --json
```

Generated output:

- `docs/components` - one Markdown file per exported module/component plus index files
- `docs/pdf/docgen-components.pdf` - combined PDF for the whole codebase

## Using in Other Repositories

See [Using DocGen in Other Repositories](docs/guides/running-in-other-repos.md) for a guide on how to integrate and use this local docgen instance in your other projects.

## Architecture

```
Source Code → [Parser Plugin] → DocIR → [Transforms] → [Renderer Plugin] → Output
                                  ↑
                        Language-agnostic
                       intermediate model
```

## Packages

| Package | Description |
|---------|-------------|
| `@docgen/core` | DocIR types, plugin system, orchestrator |
| `@docgen/cli` | Command-line interface |
| `@docgen/parser-typescript` | TypeScript/TSX parser (ts-morph) |
| `@docgen/renderer-markdown` | GitHub-flavored Markdown output |
| `@docgen/parser-java` | Java parser (tree-sitter WASM) — *planned* |
| `@docgen/parser-python` | Python parser (tree-sitter WASM) — *planned* |
| `@docgen/renderer-html` | Docusaurus static site — *planned* |
| `@docgen/renderer-pdf` | PDF output (Puppeteer) — *planned* |
| `@docgen/renderer-confluence` | Confluence sync — *planned* |

## Commands

```bash
docgen init                      # Interactive setup
docgen generate                  # Full pipeline
docgen generate --format md      # Specific format
docgen validate                  # Coverage check
docgen validate --json           # CI-friendly output
docgen diff                      # API surface diff
docgen diff --save               # Save snapshot
docgen adr new "Title"           # New ADR
docgen adr list                  # List ADRs
```

## Configuration

See `.docgen.yaml` for the full configuration schema.

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test
```

## License

MIT
