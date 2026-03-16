# RepoScribe

**Generate code documentation as separate Markdown files and one combined PDF.**

RepoScribe can be used:

- inside this repo with `npm run docs:generate`
- from another repo as a package with `"docs:generate": "reposcribe-docs"`

## What It Generates

- one Markdown file per exported module or component
- index pages for the generated docs
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

## React And Java Support

- React and TypeScript are supported today through `@docgen/parser-typescript`.
- Exported classes, interfaces, enums, functions, type aliases, and function-style components are included.
- Java is not fully supported yet because `@docgen/parser-java` is still planned.

## PDF With Images And Charts

The current built-in PDF renderer is text-first.

- Combined PDF generation works today.
- React and TypeScript projects work today.
- If you need screenshots, diagrams, and charts inside the final PDF, the next step is a richer HTML-to-PDF style renderer.

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
| `@docgen/parser-typescript` | TypeScript and TSX parser |
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
