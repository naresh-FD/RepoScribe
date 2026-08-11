# RepoScribe

**Generate layered developer documentation for React and TypeScript projects, with exhaustive reference output available when you need it.**

RepoScribe is now focused on two project types:

- React and TypeScript projects
- Java Spring Boot projects

## Web Documentation

Browse the full guides and reference at
[naresh-FD.github.io/RepoScribe](https://naresh-FD.github.io/RepoScribe/).

Current implementation status:

- React and TypeScript support is available through the React-aware TypeScript parser.
- Java and Spring Boot support is available through the tree-sitter Java WASM parser.

## What It Generates

Default `developer` mode produces a tight documentation set instead of one file per export:

- `docs/README.md`
- `docs/architecture.md`
- `docs/project-structure.md`
- `docs/setup.md`
- `docs/features/*.md`
- `docs/api/services.md`
- `docs/components/reusable-components.md`
- `docs/state/state-management.md`
- `docs/testing/testing-guide.md`
- `docs/troubleshooting.md`
- one combined PDF guide under `docs/pdf`

When you need symbol-by-symbol output, run exhaustive mode:

```bash
reposcribe-cli generate --mode exhaustive --format markdown pdf
```

## Quick Start In This Repo

```bash
npm install
npm run docs:generate
```

RepoScribe reads [`.docgen.yaml`](F:/RepoScribe/.docgen.yaml). This repository keeps its generated output under `docs/generated` so it does not collide with the hand-written product docs already stored under `docs/`.

## Use In Another Repo

1. Install RepoScribe as a dev dependency.

```bash
npm install --save-dev file:../RepoScribe
```

2. Add one line in the target repo `package.json`.

```json
{
  "scripts": {
    "docs:generate": "reposcribe-docs"
  }
}
```

3. Add a `.docgen.yaml` in the target repo.

4. Run:

```bash
npm run docs:generate
```

Guides:

- [Using RepoScribe in Other Repositories](F:/RepoScribe/docs/guides/running-in-other-repos.md)
- [PDF Generation With Images And Charts](F:/RepoScribe/docs/guides/pdf-images-and-charts.md)

## React Support

Supported today through `@docgen/parser-typescript`:

- developer-first layered docs for React and TypeScript repos
- feature grouping and selective component/service/state docs
- exhaustive per-module Markdown output behind `--mode exhaustive`
- combined PDF output that mirrors developer mode

## Java Spring Boot Support

Java and Spring Boot are supported through `@docgen/parser-java`. The parser documents
plain Java classes, interfaces, enums, methods, fields, constructors, Javadocs, Spring
stereotypes, and REST mapping metadata. Markdown output renders controller methods as
endpoint tables.

## PDF With Images And Charts

The current PDF renderer is text-first.

- Combined PDF generation works today.
- React projects work today.
- For screenshots, diagrams, and charts inside the final PDF, the next step is a richer HTML-to-PDF renderer.

See:

- [PDF Generation With Images And Charts](F:/RepoScribe/docs/guides/pdf-images-and-charts.md)

## Main Commands

```bash
npm run docs:generate
npm run build
npm run test
```

Package binaries:

```bash
reposcribe-docs
reposcribe-cli generate --format markdown pdf
```

## Packages

| Package | Description |
|---------|-------------|
| `@docgen/core` | DocIR types, plugin system, orchestrator |
| `@docgen/cli` | Command-line interface |
| `@docgen/parser-typescript` | TypeScript and TSX parser for React-style projects |
| `@docgen/parser-java` | Java and Spring Boot parser using the Java tree-sitter WASM grammar |
| `@docgen/renderer-markdown` | Markdown renderer |
| `@docgen/renderer-pdf` | Combined PDF renderer |

## Development

```bash
npm install
npm run build
npm run docs:generate
```

## License

MIT
