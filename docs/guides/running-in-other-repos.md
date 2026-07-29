# Using RepoScribe in Other Repositories

This guide installs DocGen in a pnpm project and exposes it through ordinary
`package.json` scripts. No global install or manually-created symlink is required.

## Recommended: GitHub Dev Dependency

Pin DocGen as a development dependency. A commit SHA or release tag is preferable to a
moving branch for reproducible CI builds; `main` is shown here for teams that want the
latest version.

```json
{
  "devDependencies": {
    "docgen": "github:naresh-FD/RepoScribe#main"
  },
  "scripts": {
    "docs": "docgen generate",
    "docs:validate": "docgen validate --json",
    "docs:init": "docgen init",
    "docs:diff": "docgen diff --base main --json"
  }
}
```

For pnpm 10 and later, allow DocGen's source build in `pnpm-workspace.yaml`:

```yaml
onlyBuiltDependencies:
  - docgen
```

```bash
pnpm install
pnpm run docs
```

DocGen is a source-based Git dependency and its `prepare` script compiles the workspace
packages during installation. pnpm 10 and later do not run dependency build scripts
unless the package is explicitly allowed. The `onlyBuiltDependencies` entry above
allows only DocGen's build.

The installed package supplies the `docgen` executable in the host project's
`node_modules/.bin`. pnpm scripts add that directory to `PATH`, so all four scripts work
without `pnpm link`.

## Alternatives and pnpm Trade-offs

### Local path link

Use this while developing DocGen and the host side by side:

```json
{
  "devDependencies": {
    "docgen": "link:../RepoScribe"
  }
}
```

Run `pnpm --dir ../RepoScribe install && pnpm --dir ../RepoScribe build` once after
cloning DocGen, then run the host scripts normally. `link:` points at the existing
directory, so pnpm does not install or build DocGen for the host. That makes changes
immediately visible but means the link is machine-specific and unsuitable for CI.

Avoid a global `pnpm link`: pnpm's strict, symlinked `node_modules` layout can leave
linked packages resolving peers or workspace packages from the wrong project. A
declarative `link:` dependency is reproducible within a local checkout, but DocGen's
workspace packages must still be installed and built in the DocGen repository.

### Direct `pnpm dlx` / `npx`

For a one-off command, a Git ref can be invoked without saving a dependency:

```bash
pnpm dlx github:naresh-FD/RepoScribe#main docgen generate
```

This is intentionally not the default. It resolves and may download the package on each
uncached run, is harder to pin consistently across scripts, and is subject to the same
pnpm dependency-build approval for this source-based package. `npx` also uses npm's
resolver rather than the host's pnpm lockfile.

### Why the Git dependency is the default

The Git dependency is recorded in the host lockfile, installs its own dependency graph,
and exposes a project-local binary. It therefore avoids the strict-resolution and peer
dependency ambiguity common with links. DocGen does not currently declare peer
dependencies. Its internal workspace dependencies are resolved and built inside the Git
package during `prepare`; consumers should not add `workspace:` references to the host,
because that protocol only resolves packages in the host workspace.

## Configure DocGen

Add a `.docgen.yaml` in the target repo.

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

Run `pnpm run docs` from the target repository.

## What Happens When It Runs

- RepoScribe builds itself from its own package folder.
- RepoScribe reads `.docgen.yaml` from the repo where you run the command.
- Separate Markdown files are generated under `docs/components`.
- One combined PDF is generated under `docs/pdf`.

## Output Paths

- `docs/components/README.md`
- `docs/components/<language>/<component>.md`
- `docs/pdf/components.pdf`

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

- React and TypeScript work through `@docgen/parser-typescript`.
- Java and Spring Boot work through `@docgen/parser-java`.
