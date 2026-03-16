# RepoScribe

**Generate code documentation as separate Markdown files and one combined PDF for React and Java Spring Boot projects.**

RepoScribe is now focused on two project types:

- React and TypeScript projects
- Java Spring Boot projects

Current implementation status:

- React and TypeScript support is available today.
- Java Spring Boot is the next supported path and is being prepared in the repo direction and config/docs.

## What It Generates

- one Markdown file per exported module or component
- generated index pages for the documentation set
- one combined PDF for the full codebase

Default output:

- `docs/components`
- `docs/pdf/docgen-components.pdf`

## Quick Start In This Repo

```bash
npm install
npm run docs:generate
```

RepoScribe reads [`.docgen.yaml`](F:/RepoScribe/.docgen.yaml) and writes generated docs into this repo's `docs` folder.

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

- exported React function-style components
- exported functions
- classes and interfaces
- enums and type aliases
- separate Markdown docs
- combined PDF output

## Java Spring Boot Support

Java Spring Boot is the target second supported path.

Phase 1 in this branch updates:

- repo scope and messaging
- default config examples
- integration docs
- CLI initialization defaults

Parser and Spring Boot-specific rendering are still to be implemented.

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
