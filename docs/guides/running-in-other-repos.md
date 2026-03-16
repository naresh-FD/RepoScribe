# Using RepoScribe in Other Repositories

This guide shows the simplest way to use RepoScribe from another repository with one line in that repo's `package.json`.

## What You Add In The Target Repo

1. Install RepoScribe as a dev dependency.

```bash
npm install --save-dev file:../RepoScribe
```

You can also use a Git URL instead of `file:../RepoScribe` if you keep RepoScribe in Git.

2. Add one script in the target repo `package.json`.

```json
{
  "scripts": {
    "docs:generate": "reposcribe-docs"
  }
}
```

3. Add a `.docgen.yaml` in the target repo.

Example for a typical React app:

```yaml
project:
  name: my-app
  version: 1.0.0
  description: "Project documentation"

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
    includeSourceLinks: true
    collapsibleSections: true

  pdf:
    enabled: true
    engine: puppeteer
    outputDir: docs/pdf
    options:
      fileName: components.pdf

validation:
  coverage:
    threshold: 80
    enforce: false
  rules:
    require-description: warn
    require-param-docs: warn
    require-return-docs: off
    require-examples: off

adr:
  directory: docs/decisions

changelog:
  conventionalCommits: true
  groupBy: type
  outputFile: CHANGELOG.md
```

4. Run the script from the target repo.

```bash
npm run docs:generate
```

## What Happens When It Runs

- RepoScribe builds itself from its own package folder.
- RepoScribe reads `.docgen.yaml` from the repo where you run the command.
- Separate Markdown files are generated under `docs/components`.
- One combined PDF is generated under `docs/pdf`.

## Output Paths

- `docs/components/README.md`
- `docs/components/<language>/<component>.md`
- `docs/pdf/components.pdf`

## Direct CLI Option

If you want the lower-level CLI instead of the high-level generator script, use:

```json
{
  "scripts": {
    "docs:generate": "reposcribe-cli generate --format markdown pdf"
  }
}
```

That command still runs from the target repo and reads the target repo's `.docgen.yaml`.

## Notes

- RepoScribe follows the current working directory, so always run the command from the target repo root.
- If your code lives under `packages`, `app`, or another folder, change the `.docgen.yaml` `languages[].source` value to match.
- The current TypeScript parser documents exported classes, interfaces, enums, type aliases, functions, and exported function-style components.

## Spring Boot Starter Example

Use this shape when you are preparing a Java Spring Boot repository for upcoming Java parser support:

```yaml
project:
  name: spring-app
  version: 1.0.0
  description: "Spring Boot project documentation"

languages:
  - name: java
    source: src/main/java
    include:
      - "**/*.java"
    exclude:
      - "**/test/**"
      - "**/generated/**"
    parser: "@docgen/parser-java"

output:
  markdown:
    enabled: true
    outputDir: docs/components

  pdf:
    enabled: true
    outputDir: docs/pdf
    options:
      fileName: spring-boot-docs.pdf
```

Current status:

- React and TypeScript work today.
- Java Spring Boot is the target second path and the parser is still to be implemented.
