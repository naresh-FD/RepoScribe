# PDF Generation With Images And Charts

This guide explains how to use RepoScribe for PDF documentation when your project includes screenshots, diagrams, or charts.

## Current Status

- React and TypeScript projects are supported today through `@docgen/parser-typescript`.
- RepoScribe is currently focused on React and Java Spring Boot projects.
- The current built-in PDF renderer produces text-first PDFs.
- Java Spring Boot parsing is the next supported track, but it is not implemented yet end to end.
- Images and charts can already live beside your generated Markdown docs, but rendering them inside the combined PDF will need a richer PDF or HTML renderer.

## React Projects

For React projects, use a `.docgen.yaml` like this:

```yaml
project:
  name: react-app
  version: 1.0.0

languages:
  - name: typescript
    source: src
    include:
      - "**/*.ts"
      - "**/*.tsx"
    exclude:
      - "**/*.test.ts"
      - "**/*.spec.ts"
      - "**/*.d.ts"
      - "**/node_modules/**"
      - "**/dist/**"
    parser: "@docgen/parser-typescript"

output:
  markdown:
    enabled: true
    outputDir: docs/components

  pdf:
    enabled: true
    outputDir: docs/pdf
    options:
      fileName: react-docs.pdf
```

Then run:

```bash
npm run docs:generate
```

Recommended asset layout:

```text
docs/
  assets/
    architecture.png
    charts/
      revenue-trend.png
      latency.png
  components/
  pdf/
```

Recommended usage:

- Keep screenshots and charts in `docs/assets`.
- Reference those images from hand-written Markdown pages such as architecture notes or overview docs.
- Use generated component docs for API and component reference.
- Use the combined PDF for text-first documentation until image embedding is added to the renderer.

## Java Projects

Java is not ready in the current RepoScribe package because `@docgen/parser-java` is still planned and not implemented here yet.

What you can do today:

- Keep the same Markdown and PDF output structure.
- Add manual Markdown docs for architecture, flow diagrams, and charts.
- Add a Java parser plugin later when that package is implemented.

Example future-facing config:

```yaml
languages:
  - name: java
    source: src/main/java
    include:
      - "**/*.java"
    exclude:
      - "**/test/**"
      - "**/generated/**"
    parser: "@docgen/parser-java"
```

## Images And Charts In PDFs

If you need charts and images rendered inside the final PDF itself, the recommended next step is:

1. Generate Markdown as RepoScribe does today.
2. Convert Markdown to HTML with image support.
3. Render HTML to PDF with a browser-based engine.

That path is a better fit for:

- React design system screenshots
- Mermaid exports
- Architecture diagrams
- KPI charts
- Java service topology diagrams

## Recommended Approach Today

- Use RepoScribe now for separate Markdown docs and a combined text PDF.
- Store images and charts under `docs/assets`.
- Add manual Markdown pages for image-heavy sections.
- If you want, extend the PDF renderer next to support embedded images and chart pages.
