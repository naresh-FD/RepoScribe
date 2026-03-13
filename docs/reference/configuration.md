# Configuration Reference -- .docgen.yaml

This is the exhaustive reference for every field in the DocGen configuration file.
The configuration is defined by the Zod schema `DocGenConfigSchema` in
`packages/core/src/config/schema.ts` and validated at load time.

---

## Quick Start

The smallest valid configuration requires only `project.name` and one entry in
`languages`:

```yaml
project:
  name: my-app

languages:
  - name: typescript
    source: src
    parser: "@docgen/parser-typescript"
```

All other sections (`output`, `validation`, `adr`, `changelog`, `plugins`) fall
back to their defaults when omitted.

---

## Full Annotated Example

```yaml
# ── Project Metadata ───────────────────────────────────────────
project:
  name: my-app                     # Required. Project identifier.
  version: 1.0.0                   # SemVer string. Default: "0.0.0"
  description: "My application"    # Optional free-text description.
  repository: "https://github.com/org/my-app" # Optional repo URL.

# ── Language Sources ───────────────────────────────────────────
languages:
  - name: typescript               # "java" | "typescript" | "python"
    source: src                    # Root directory to scan.
    include:                       # Glob patterns to include. Default: ["**/*"]
      - "**/*.ts"
      - "**/*.tsx"
    exclude:                       # Glob patterns to exclude. Default: []
      - "**/*.test.ts"
      - "**/*.spec.ts"
      - "**/node_modules/**"
    parser: "@docgen/parser-typescript"  # Parser plugin package name.
    options: {}                    # Extra options forwarded to the parser.

  - name: java
    source: src/main/java
    include: ["**/*.java"]
    exclude: ["**/test/**", "**/generated/**"]
    parser: "@docgen/parser-java"

  - name: python
    source: scripts
    include: ["**/*.py"]
    exclude: ["**/test_*", "**/__pycache__/**"]
    parser: "@docgen/parser-python"

# ── Output Targets ─────────────────────────────────────────────
output:
  markdown:
    enabled: true                  # Default: false
    outputDir: docs/api            # Default: "docs/api"
    templates: ./my-templates      # Optional path to custom Handlebars templates.
    filePerModule: true            # Default: true
    tableOfContents: true          # Default: true
    linkStyle: relative            # "relative" | "absolute". Default: "relative"

  html:
    enabled: true                  # Default: false
    engine: docusaurus             # "docusaurus" | "custom". Default: "docusaurus"
    outputDir: docs-site           # Default: "docs-site"
    theme: "@docgen/theme-default" # Default: "@docgen/theme-default"
    sidebar: auto                  # "auto" | "manual". Default: "auto"
    search: true                   # Default: true
    baseUrl: /                     # Default: "/"
    options: {}                    # Engine-specific options.

  pdf:
    enabled: false                 # Default: false
    engine: puppeteer              # "puppeteer" | "pandoc". Default: "puppeteer"
    outputDir: docs/pdf            # Default: "docs/pdf"
    branding:
      logo: ./assets/logo.png     # Optional path to logo image.
      primaryColor: "#1B4F72"     # Default: "#1B4F72"
      companyName: Acme Corp      # Optional company name for cover page.
    options: {}                    # Engine-specific options.

  confluence:
    enabled: false                 # Default: false
    baseUrl: https://your-org.atlassian.net  # Must be a valid URL.
    spaceKey: DOCS                 # Confluence space key.
    parentPageId: "123456"         # Page under which docs are published.
    auth: "env:CONFLUENCE_TOKEN"   # Token or "env:VAR_NAME" pattern.
    labels:                        # Default: ["auto-generated"]
      - auto-generated
      - api-docs
    incrementalSync: true          # Default: true
    options: {}                    # Additional Confluence API options.

# ── Validation ─────────────────────────────────────────────────
validation:
  coverage:
    threshold: 80                  # 0-100. Default: 80
    enforce: false                 # Default: false
    exclude:                       # Globs excluded from coverage. Default: []
      - "**/internal/**"
  rules:
    require-description: warn      # "error" | "warn" | "off". Default: "warn"
    require-param-docs: warn       # Default: "warn"
    require-return-docs: off       # Default: "off"
    require-examples: off          # Default: "off"
    require-since-tag: off         # Default: "off"
    no-empty-descriptions: warn    # Default: "warn"

# ── ADR (Architecture Decision Records) ───────────────────────
adr:
  directory: docs/decisions        # Default: "docs/decisions"
  template: ./adr-template.md     # Optional path to custom ADR template.
  idFormat: "ADR-{NNN}"           # Default: "ADR-{NNN}"

# ── Changelog ──────────────────────────────────────────────────
changelog:
  conventionalCommits: true        # Default: true
  groupBy: type                    # "type" | "scope" | "component". Default: "type"
  outputFile: CHANGELOG.md         # Default: "CHANGELOG.md"
  includeCommitHash: false         # Default: false

# ── Plugins ────────────────────────────────────────────────────
plugins:                           # Default: []
  - "@docgen/plugin-mermaid"
  - "@docgen/plugin-coverage-badge"
```

---

## Field-by-Field Reference

### `project`

Top-level metadata about the project being documented.

---

#### `project.name`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `project.name`                 |
| **Type**        | `string`                       |
| **Required**    | Yes                            |
| **Default**     | --                             |
| **Constraints** | Minimum length 1               |
| **Description** | Human-readable project name. Used as the title in generated documentation, PDF cover pages, and Confluence space headings. |
| **CLI commands**| `docgen init`, `docgen generate`, `docgen build` |
| **Related**     | `project.version`, `project.description` |

```yaml
project:
  name: my-app
```

---

#### `project.version`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `project.version`              |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `"0.0.0"`                      |
| **Constraints** | Any non-empty string (SemVer recommended) |
| **Description** | Project version stamped into generated docs headers and PDF cover pages. The changelog generator also reads this value. |
| **CLI commands**| `docgen generate`, `docgen changelog` |
| **Related**     | `project.name`, `changelog.outputFile` |

```yaml
project:
  version: "2.3.1"
```

---

#### `project.description`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `project.description`          |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `undefined`                    |
| **Description** | Short summary of the project. Appears in the generated docs landing page and HTML meta description tag. |
| **CLI commands**| `docgen generate`              |
| **Related**     | `project.name`                 |

```yaml
project:
  description: "E-commerce backend services"
```

---

#### `project.repository`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `project.repository`           |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `undefined`                    |
| **Description** | URL to the source repository. Used to generate "View Source" links in HTML and Markdown output. |
| **CLI commands**| `docgen generate`              |
| **Related**     | `output.markdown.linkStyle`    |

```yaml
project:
  repository: "https://github.com/org/my-app"
```

---

### `languages`

An array of language source definitions. **At least one entry is required.**
Each entry tells DocGen where to find source files, which globs to include or
exclude, and which parser plugin to use.

---

#### `languages[].name`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `languages[].name`             |
| **Type**        | `enum`                         |
| **Required**    | Yes                            |
| **Valid values** | `"java"`, `"typescript"`, `"python"` |
| **Description** | Language identifier. Determines default include/exclude patterns generated by `docgen init` and selects language-specific analysis features. |
| **CLI commands**| `docgen init`, `docgen parse`  |
| **Related**     | `languages[].parser`, `languages[].source` |

```yaml
languages:
  - name: typescript
```

---

#### `languages[].source`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `languages[].source`           |
| **Type**        | `string`                       |
| **Required**    | Yes                            |
| **Constraints** | Minimum length 1               |
| **Description** | Root directory (relative to config file) that contains source files for this language. The parser scans this directory tree. |
| **CLI commands**| `docgen parse`, `docgen generate` |
| **Related**     | `languages[].include`, `languages[].exclude` |

```yaml
languages:
  - name: java
    source: src/main/java
```

---

#### `languages[].include`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `languages[].include`          |
| **Type**        | `string[]`                     |
| **Required**    | No                             |
| **Default**     | `["**/*"]`                     |
| **Description** | Glob patterns matched against file paths under `source`. Only files matching at least one pattern are parsed. |
| **CLI commands**| `docgen parse`                 |
| **Related**     | `languages[].exclude`, `languages[].source` |

Default include patterns generated by `docgen init`:

| Language    | Default includes               |
|-------------|---------------------------------|
| Java        | `["**/*.java"]`                |
| TypeScript  | `["**/*.ts", "**/*.tsx"]`      |
| Python      | `["**/*.py"]`                  |

```yaml
languages:
  - name: typescript
    source: src
    include:
      - "**/*.ts"
      - "**/*.tsx"
```

---

#### `languages[].exclude`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `languages[].exclude`          |
| **Type**        | `string[]`                     |
| **Required**    | No                             |
| **Default**     | `[]`                           |
| **Description** | Glob patterns for files to skip. Exclusions are applied after inclusions. |
| **CLI commands**| `docgen parse`                 |
| **Related**     | `languages[].include`, `validation.coverage.exclude` |

Default exclude patterns generated by `docgen init`:

| Language    | Default excludes                                          |
|-------------|-----------------------------------------------------------|
| Java        | `["**/test/**", "**/generated/**"]`                      |
| TypeScript  | `["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"]` |
| Python      | `["**/test_*", "**/__pycache__/**"]`                     |

```yaml
languages:
  - name: java
    source: src/main/java
    exclude:
      - "**/test/**"
      - "**/generated/**"
```

---

#### `languages[].parser`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `languages[].parser`           |
| **Type**        | `string`                       |
| **Required**    | Yes                            |
| **Constraints** | Minimum length 1               |
| **Description** | NPM package name of the parser plugin for this language. The plugin must be installed in the project or globally. |
| **CLI commands**| `docgen parse`                 |
| **Related**     | `languages[].name`, `plugins`  |

Built-in parsers:

| Language    | Parser package                 |
|-------------|--------------------------------|
| Java        | `@docgen/parser-java`         |
| TypeScript  | `@docgen/parser-typescript`   |
| Python      | `@docgen/parser-python`       |

```yaml
languages:
  - name: python
    source: src
    parser: "@docgen/parser-python"
```

---

#### `languages[].options`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `languages[].options`          |
| **Type**        | `Record<string, unknown>`      |
| **Required**    | No                             |
| **Default**     | `{}`                           |
| **Description** | Arbitrary key-value map forwarded to the parser plugin. Contents are plugin-specific. |
| **CLI commands**| `docgen parse`                 |
| **Related**     | `languages[].parser`           |

```yaml
languages:
  - name: typescript
    source: src
    parser: "@docgen/parser-typescript"
    options:
      tsConfigPath: ./tsconfig.json
      includePrivate: false
```

---

### `output`

Controls where and how documentation is rendered. Contains four sub-sections:
`markdown`, `html`, `pdf`, and `confluence`. All sub-sections default to an
empty object (all fields take their individual defaults) when omitted.

---

### `output.markdown`

Markdown file generation settings.

---

#### `output.markdown.enabled`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.markdown.enabled`      |
| **Type**        | `boolean`                      |
| **Required**    | No                             |
| **Default**     | `false`                        |
| **Description** | When `true`, the `docgen generate` command writes Markdown files. |
| **CLI commands**| `docgen generate`              |
| **Related**     | `output.markdown.outputDir`    |

```yaml
output:
  markdown:
    enabled: true
```

---

#### `output.markdown.outputDir`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.markdown.outputDir`    |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `"docs/api"`                   |
| **Description** | Directory (relative to project root) where Markdown files are written. Created automatically if it does not exist. |
| **CLI commands**| `docgen generate`              |
| **Related**     | `output.markdown.enabled`, `output.markdown.filePerModule` |

```yaml
output:
  markdown:
    outputDir: docs/api
```

---

#### `output.markdown.templates`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.markdown.templates`    |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `undefined`                    |
| **Description** | Path to a directory of custom Handlebars templates that override the built-in Markdown templates. |
| **CLI commands**| `docgen generate`              |
| **Related**     | `output.markdown.filePerModule` |

```yaml
output:
  markdown:
    templates: ./my-templates
```

---

#### `output.markdown.filePerModule`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.markdown.filePerModule`|
| **Type**        | `boolean`                      |
| **Required**    | No                             |
| **Default**     | `true`                         |
| **Description** | When `true`, each module or class gets its own Markdown file. When `false`, all documentation is combined into a single file. |
| **CLI commands**| `docgen generate`              |
| **Related**     | `output.markdown.outputDir`, `output.markdown.tableOfContents` |

```yaml
output:
  markdown:
    filePerModule: false
```

---

#### `output.markdown.tableOfContents`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.markdown.tableOfContents` |
| **Type**        | `boolean`                      |
| **Required**    | No                             |
| **Default**     | `true`                         |
| **Description** | When `true`, a table of contents is inserted at the top of each generated Markdown file. |
| **CLI commands**| `docgen generate`              |
| **Related**     | `output.markdown.filePerModule` |

```yaml
output:
  markdown:
    tableOfContents: false
```

---

#### `output.markdown.linkStyle`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.markdown.linkStyle`    |
| **Type**        | `enum`                         |
| **Required**    | No                             |
| **Default**     | `"relative"`                   |
| **Valid values** | `"relative"`, `"absolute"`    |
| **Description** | Controls how cross-references between Markdown files are linked. `"relative"` produces paths like `../module/Class.md`; `"absolute"` uses the full path from the output root. |
| **CLI commands**| `docgen generate`              |
| **Related**     | `project.repository`, `output.markdown.outputDir` |

```yaml
output:
  markdown:
    linkStyle: absolute
```

---

### `output.html`

Static HTML site generation settings.

---

#### `output.html.enabled`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.html.enabled`          |
| **Type**        | `boolean`                      |
| **Required**    | No                             |
| **Default**     | `false`                        |
| **Description** | When `true`, the `docgen build` command produces a static HTML documentation site. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.html.engine`, `output.html.outputDir` |

```yaml
output:
  html:
    enabled: true
```

---

#### `output.html.engine`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.html.engine`           |
| **Type**        | `enum`                         |
| **Required**    | No                             |
| **Default**     | `"docusaurus"`                 |
| **Valid values** | `"docusaurus"`, `"custom"`    |
| **Description** | Static site generator engine. `"docusaurus"` uses Docusaurus v3; `"custom"` delegates to the template directory and engine-specific `options`. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.html.theme`, `output.html.options` |

```yaml
output:
  html:
    engine: custom
```

---

#### `output.html.outputDir`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.html.outputDir`        |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `"docs-site"`                  |
| **Description** | Directory where the built HTML site is written. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.html.enabled`          |

```yaml
output:
  html:
    outputDir: build/docs
```

---

#### `output.html.theme`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.html.theme`            |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `"@docgen/theme-default"`      |
| **Description** | NPM package name or local path of the theme used for the HTML site. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.html.engine`, `plugins` |

```yaml
output:
  html:
    theme: "@docgen/theme-dark"
```

---

#### `output.html.sidebar`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.html.sidebar`          |
| **Type**        | `enum`                         |
| **Required**    | No                             |
| **Default**     | `"auto"`                       |
| **Valid values** | `"auto"`, `"manual"`          |
| **Description** | `"auto"` generates the sidebar navigation tree from the parsed module hierarchy. `"manual"` expects a user-provided sidebar configuration file. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.html.engine`           |

```yaml
output:
  html:
    sidebar: manual
```

---

#### `output.html.search`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.html.search`           |
| **Type**        | `boolean`                      |
| **Required**    | No                             |
| **Default**     | `true`                         |
| **Description** | Enables client-side full-text search in the generated HTML site. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.html.engine`           |

```yaml
output:
  html:
    search: false
```

---

#### `output.html.baseUrl`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.html.baseUrl`          |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `"/"`                          |
| **Description** | Base URL path for the HTML site. Set to a subdirectory (e.g. `"/docs/"`) when the site is not hosted at the domain root. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.html.outputDir`        |

```yaml
output:
  html:
    baseUrl: /docs/
```

---

#### `output.html.options`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.html.options`          |
| **Type**        | `Record<string, unknown>`      |
| **Required**    | No                             |
| **Default**     | `{}`                           |
| **Description** | Engine-specific configuration passed through to the HTML builder. Keys depend on the `engine` value. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.html.engine`           |

```yaml
output:
  html:
    engine: docusaurus
    options:
      editUrl: "https://github.com/org/my-app/edit/main/"
      showLastUpdateTime: true
```

---

### `output.pdf`

PDF generation settings.

---

#### `output.pdf.enabled`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.pdf.enabled`           |
| **Type**        | `boolean`                      |
| **Required**    | No                             |
| **Default**     | `false`                        |
| **Description** | When `true`, the `docgen build` command additionally generates a PDF document. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.pdf.engine`, `output.pdf.outputDir` |

```yaml
output:
  pdf:
    enabled: true
```

---

#### `output.pdf.engine`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.pdf.engine`            |
| **Type**        | `enum`                         |
| **Required**    | No                             |
| **Default**     | `"puppeteer"`                  |
| **Valid values** | `"puppeteer"`, `"pandoc"`     |
| **Description** | Rendering engine for PDF generation. `"puppeteer"` uses headless Chrome; `"pandoc"` uses Pandoc with LaTeX. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.pdf.branding`, `output.pdf.options` |

```yaml
output:
  pdf:
    engine: pandoc
```

---

#### `output.pdf.outputDir`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.pdf.outputDir`         |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `"docs/pdf"`                   |
| **Description** | Directory where the generated PDF file is written. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.pdf.enabled`           |

```yaml
output:
  pdf:
    outputDir: dist/pdf
```

---

#### `output.pdf.branding.logo`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.pdf.branding.logo`     |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `undefined`                    |
| **Description** | Path to a logo image displayed on the PDF cover page. Supports PNG, JPEG, and SVG. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.pdf.branding.primaryColor`, `output.pdf.branding.companyName` |

```yaml
output:
  pdf:
    branding:
      logo: ./assets/logo.png
```

---

#### `output.pdf.branding.primaryColor`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.pdf.branding.primaryColor` |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `"#1B4F72"`                    |
| **Description** | CSS color value used for headings, borders, and accent elements in the generated PDF. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.pdf.branding.logo`, `output.pdf.branding.companyName` |

```yaml
output:
  pdf:
    branding:
      primaryColor: "#2E86C1"
```

---

#### `output.pdf.branding.companyName`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.pdf.branding.companyName` |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `undefined`                    |
| **Description** | Company or organization name displayed on the PDF cover page and footer. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.pdf.branding.logo`, `output.pdf.branding.primaryColor` |

```yaml
output:
  pdf:
    branding:
      companyName: "Acme Corp"
```

---

#### `output.pdf.options`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.pdf.options`           |
| **Type**        | `Record<string, unknown>`      |
| **Required**    | No                             |
| **Default**     | `{}`                           |
| **Description** | Engine-specific configuration. For `puppeteer`: page margins, header/footer templates. For `pandoc`: LaTeX variables, paper size, fonts. |
| **CLI commands**| `docgen build`                 |
| **Related**     | `output.pdf.engine`            |

```yaml
output:
  pdf:
    engine: puppeteer
    options:
      format: A4
      margin:
        top: "20mm"
        bottom: "20mm"
```

---

### `output.confluence`

Atlassian Confluence publishing settings.

---

#### `output.confluence.enabled`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.confluence.enabled`    |
| **Type**        | `boolean`                      |
| **Required**    | No                             |
| **Default**     | `false`                        |
| **Description** | When `true`, the `docgen publish` command pushes documentation pages to Confluence. |
| **CLI commands**| `docgen publish`               |
| **Related**     | `output.confluence.baseUrl`, `output.confluence.spaceKey` |

```yaml
output:
  confluence:
    enabled: true
```

---

#### `output.confluence.baseUrl`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.confluence.baseUrl`    |
| **Type**        | `string` (URL)                 |
| **Required**    | No (but required when `enabled` is `true`) |
| **Default**     | `undefined`                    |
| **Constraints** | Must be a valid URL            |
| **Description** | Base URL of the Confluence instance (e.g. `https://your-org.atlassian.net`). |
| **CLI commands**| `docgen publish`               |
| **Related**     | `output.confluence.spaceKey`, `output.confluence.auth` |

```yaml
output:
  confluence:
    baseUrl: https://your-org.atlassian.net
```

---

#### `output.confluence.spaceKey`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.confluence.spaceKey`   |
| **Type**        | `string`                       |
| **Required**    | No (but required when `enabled` is `true`) |
| **Default**     | `undefined`                    |
| **Description** | Confluence space key where pages are created or updated. |
| **CLI commands**| `docgen publish`               |
| **Related**     | `output.confluence.baseUrl`, `output.confluence.parentPageId` |

```yaml
output:
  confluence:
    spaceKey: DOCS
```

---

#### `output.confluence.parentPageId`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.confluence.parentPageId` |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `undefined`                    |
| **Description** | ID of the parent Confluence page. Generated docs are created as children of this page. If omitted, pages are created at the space root. |
| **CLI commands**| `docgen publish`               |
| **Related**     | `output.confluence.spaceKey`   |

```yaml
output:
  confluence:
    parentPageId: "123456789"
```

---

#### `output.confluence.auth`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.confluence.auth`       |
| **Type**        | `string`                       |
| **Required**    | No (but required when `enabled` is `true`) |
| **Default**     | `undefined`                    |
| **Description** | Authentication token for the Confluence API. Supports the `"env:VAR_NAME"` pattern to read the token from an environment variable at runtime (see [Environment Variable Interpolation](#environment-variable-interpolation)). |
| **CLI commands**| `docgen publish`               |
| **Related**     | `output.confluence.baseUrl`    |

```yaml
output:
  confluence:
    auth: "env:CONFLUENCE_TOKEN"
```

---

#### `output.confluence.labels`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.confluence.labels`     |
| **Type**        | `string[]`                     |
| **Required**    | No                             |
| **Default**     | `["auto-generated"]`           |
| **Description** | Confluence labels applied to every published page. Useful for filtering auto-generated content. |
| **CLI commands**| `docgen publish`               |
| **Related**     | `output.confluence.spaceKey`   |

```yaml
output:
  confluence:
    labels:
      - auto-generated
      - api-docs
      - v2
```

---

#### `output.confluence.incrementalSync`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.confluence.incrementalSync` |
| **Type**        | `boolean`                      |
| **Required**    | No                             |
| **Default**     | `true`                         |
| **Description** | When `true`, only pages whose content has changed since the last publish are updated. When `false`, all pages are overwritten on every run. |
| **CLI commands**| `docgen publish`               |
| **Related**     | `output.confluence.enabled`    |

```yaml
output:
  confluence:
    incrementalSync: false
```

---

#### `output.confluence.options`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `output.confluence.options`    |
| **Type**        | `Record<string, unknown>`      |
| **Required**    | No                             |
| **Default**     | `{}`                           |
| **Description** | Additional Confluence API options, such as custom macros or page properties. |
| **CLI commands**| `docgen publish`               |
| **Related**     | `output.confluence.baseUrl`    |

```yaml
output:
  confluence:
    options:
      notifyWatchers: false
```

---

### `validation`

Documentation quality and coverage enforcement settings.

---

#### `validation.coverage.threshold`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `validation.coverage.threshold`|
| **Type**        | `number`                       |
| **Required**    | No                             |
| **Default**     | `80`                           |
| **Valid range**  | `0` -- `100`                  |
| **Description** | Minimum percentage of public API symbols that must have documentation comments. Reported by `docgen validate`. |
| **CLI commands**| `docgen validate`              |
| **Related**     | `validation.coverage.enforce`, `validation.coverage.exclude` |

```yaml
validation:
  coverage:
    threshold: 90
```

---

#### `validation.coverage.enforce`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `validation.coverage.enforce`  |
| **Type**        | `boolean`                      |
| **Required**    | No                             |
| **Default**     | `false`                        |
| **Description** | When `true`, `docgen validate` exits with a non-zero code if coverage falls below `threshold`. Useful for CI pipelines. |
| **CLI commands**| `docgen validate`              |
| **Related**     | `validation.coverage.threshold` |

```yaml
validation:
  coverage:
    enforce: true
```

---

#### `validation.coverage.exclude`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `validation.coverage.exclude`  |
| **Type**        | `string[]`                     |
| **Required**    | No                             |
| **Default**     | `[]`                           |
| **Description** | Glob patterns for files excluded from the coverage calculation. Use this for internal helpers that do not need public documentation. |
| **CLI commands**| `docgen validate`              |
| **Related**     | `validation.coverage.threshold`, `languages[].exclude` |

```yaml
validation:
  coverage:
    exclude:
      - "**/internal/**"
      - "**/generated/**"
```

---

#### `validation.rules.require-description`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `validation.rules.require-description` |
| **Type**        | `enum`                         |
| **Required**    | No                             |
| **Default**     | `"warn"`                       |
| **Valid values** | `"error"`, `"warn"`, `"off"` |
| **Description** | Checks that every public symbol has a non-empty description. `"error"` fails the build; `"warn"` prints a warning; `"off"` disables the rule. |
| **CLI commands**| `docgen validate`              |
| **Related**     | `validation.rules.no-empty-descriptions` |

```yaml
validation:
  rules:
    require-description: error
```

---

#### `validation.rules.require-param-docs`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `validation.rules.require-param-docs` |
| **Type**        | `enum`                         |
| **Required**    | No                             |
| **Default**     | `"warn"`                       |
| **Valid values** | `"error"`, `"warn"`, `"off"` |
| **Description** | Checks that every function/method parameter has a `@param` tag with a description. |
| **CLI commands**| `docgen validate`              |
| **Related**     | `validation.rules.require-return-docs` |

```yaml
validation:
  rules:
    require-param-docs: error
```

---

#### `validation.rules.require-return-docs`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `validation.rules.require-return-docs` |
| **Type**        | `enum`                         |
| **Required**    | No                             |
| **Default**     | `"off"`                        |
| **Valid values** | `"error"`, `"warn"`, `"off"` |
| **Description** | Checks that every non-void function/method has a `@returns` tag. |
| **CLI commands**| `docgen validate`              |
| **Related**     | `validation.rules.require-param-docs` |

```yaml
validation:
  rules:
    require-return-docs: warn
```

---

#### `validation.rules.require-examples`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `validation.rules.require-examples` |
| **Type**        | `enum`                         |
| **Required**    | No                             |
| **Default**     | `"off"`                        |
| **Valid values** | `"error"`, `"warn"`, `"off"` |
| **Description** | Checks that every public symbol includes at least one `@example` block. |
| **CLI commands**| `docgen validate`              |
| **Related**     | `validation.rules.require-description` |

```yaml
validation:
  rules:
    require-examples: warn
```

---

#### `validation.rules.require-since-tag`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `validation.rules.require-since-tag` |
| **Type**        | `enum`                         |
| **Required**    | No                             |
| **Default**     | `"off"`                        |
| **Valid values** | `"error"`, `"warn"`, `"off"` |
| **Description** | Checks that every public symbol includes a `@since` tag indicating when it was introduced. |
| **CLI commands**| `docgen validate`              |
| **Related**     | `project.version`              |

```yaml
validation:
  rules:
    require-since-tag: warn
```

---

#### `validation.rules.no-empty-descriptions`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `validation.rules.no-empty-descriptions` |
| **Type**        | `enum`                         |
| **Required**    | No                             |
| **Default**     | `"warn"`                       |
| **Valid values** | `"error"`, `"warn"`, `"off"` |
| **Description** | Flags documentation comments that exist but contain only whitespace or placeholder text. |
| **CLI commands**| `docgen validate`              |
| **Related**     | `validation.rules.require-description` |

```yaml
validation:
  rules:
    no-empty-descriptions: error
```

---

### `adr`

Architecture Decision Record management settings.

---

#### `adr.directory`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `adr.directory`                |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `"docs/decisions"`             |
| **Description** | Directory where ADR files are stored and read from. |
| **CLI commands**| `docgen adr new`, `docgen adr list` |
| **Related**     | `adr.template`, `adr.idFormat` |

```yaml
adr:
  directory: docs/architecture/decisions
```

---

#### `adr.template`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `adr.template`                 |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `undefined` (uses built-in template) |
| **Description** | Path to a custom Markdown template for new ADRs. The template can use `{ID}`, `{TITLE}`, and `{DATE}` placeholders. |
| **CLI commands**| `docgen adr new`               |
| **Related**     | `adr.directory`, `adr.idFormat` |

```yaml
adr:
  template: ./templates/adr-template.md
```

---

#### `adr.idFormat`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `adr.idFormat`                 |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `"ADR-{NNN}"`                  |
| **Description** | Format string for ADR identifiers. `{NNN}` is replaced with a zero-padded sequence number. |
| **CLI commands**| `docgen adr new`               |
| **Related**     | `adr.directory`                |

```yaml
adr:
  idFormat: "ARCH-{NNN}"
```

---

### `changelog`

Changelog generation settings, driven by git history.

---

#### `changelog.conventionalCommits`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `changelog.conventionalCommits`|
| **Type**        | `boolean`                      |
| **Required**    | No                             |
| **Default**     | `true`                         |
| **Description** | When `true`, only commits following the [Conventional Commits](https://www.conventionalcommits.org/) specification (`feat:`, `fix:`, `chore:`, etc.) are included. When `false`, all commits are included. |
| **CLI commands**| `docgen changelog`             |
| **Related**     | `changelog.groupBy`            |

```yaml
changelog:
  conventionalCommits: false
```

---

#### `changelog.groupBy`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `changelog.groupBy`            |
| **Type**        | `enum`                         |
| **Required**    | No                             |
| **Default**     | `"type"`                       |
| **Valid values** | `"type"`, `"scope"`, `"component"` |
| **Description** | How changelog entries are grouped. `"type"` groups by commit type (Features, Bug Fixes, etc.); `"scope"` groups by the scope field; `"component"` groups by the affected component/package. |
| **CLI commands**| `docgen changelog`             |
| **Related**     | `changelog.conventionalCommits` |

```yaml
changelog:
  groupBy: scope
```

---

#### `changelog.outputFile`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `changelog.outputFile`         |
| **Type**        | `string`                       |
| **Required**    | No                             |
| **Default**     | `"CHANGELOG.md"`               |
| **Description** | File path (relative to project root) where the generated changelog is written. |
| **CLI commands**| `docgen changelog`             |
| **Related**     | `project.version`              |

```yaml
changelog:
  outputFile: docs/CHANGELOG.md
```

---

#### `changelog.includeCommitHash`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `changelog.includeCommitHash`  |
| **Type**        | `boolean`                      |
| **Required**    | No                             |
| **Default**     | `false`                        |
| **Description** | When `true`, each changelog entry includes the abbreviated commit hash with a link to the repository. Requires `project.repository` to generate clickable links. |
| **CLI commands**| `docgen changelog`             |
| **Related**     | `project.repository`, `changelog.conventionalCommits` |

```yaml
changelog:
  includeCommitHash: true
```

---

### `plugins`

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Full path**   | `plugins`                      |
| **Type**        | `string[]`                     |
| **Required**    | No                             |
| **Default**     | `[]`                           |
| **Description** | List of additional plugin package names to load at startup. Plugins can provide custom parsers, output renderers, validation rules, or theme extensions. Each entry is resolved as an NPM package name. |
| **CLI commands**| All commands (plugins are loaded during config initialization) |
| **Related**     | `languages[].parser`, `output.html.theme` |

```yaml
plugins:
  - "@docgen/plugin-mermaid"
  - "@docgen/plugin-coverage-badge"
  - "./local-plugins/my-custom-plugin"
```

---

## Config Loading

DocGen resolves configuration through the `loadConfig(workDir)` function
exported from `packages/core/src/config/schema.ts`. The process has four
stages:

### 1. File Discovery

The loader searches for a configuration file using these names, in order:

1. `.docgen.yaml`
2. `.docgen.yml`
3. `docgen.config.yaml`

Starting from `workDir`, the loader checks each candidate filename. If none is
found, it moves to the parent directory and repeats. This directory walk-up
continues until the filesystem root is reached (the `findConfigFile` function).

### 2. YAML Parsing

The file contents are read as UTF-8 and parsed with the `yaml` package
(`yaml.parse()`). If the file contains invalid YAML syntax, a `ConfigError` is
thrown with the parse error message.

### 3. Schema Validation

The parsed object is validated against `DocGenConfigSchema` using Zod's
`safeParse()`. If validation fails, a `ConfigError` is thrown listing every
issue with its dotted path and message. For example:

```
Configuration validation failed in /app/.docgen.yaml:
  - project.name: String must contain at least 1 character(s)
  - languages: Array must contain at least 1 element(s)
```

### 4. Default Application

Zod automatically applies default values for any omitted optional fields during
parsing. The returned object is fully typed as `DocGenConfig` with all defaults
populated.

### Error Handling

All configuration errors are instances of `ConfigError` (extends `Error` with
`name: "ConfigError"`). Three failure modes:

| Failure              | Error Message Pattern                                     |
|----------------------|-----------------------------------------------------------|
| File not found       | `No configuration file found. Run "docgen init"...`       |
| Invalid YAML         | `Invalid YAML in <path>: <parse error>`                   |
| Validation failure   | `Configuration validation failed in <path>:\n  - ...`     |

---

## Config Generation

The `generateDefaultConfig()` function produces a valid `.docgen.yaml` string
for new projects. It is called by the `docgen init` CLI command.

### Function Signature

```typescript
generateDefaultConfig(options: {
  projectName: string;
  languages: Array<{ name: string; source: string }>;
}): string
```

### Language Detection

During `docgen init`, the CLI inspects the working directory to auto-detect
languages. The generated config includes language-specific defaults:

| Language    | Default `include`              | Default `exclude`                                         | Default `parser`               |
|-------------|--------------------------------|-----------------------------------------------------------|--------------------------------|
| Java        | `["**/*.java"]`               | `["**/test/**", "**/generated/**"]`                      | `@docgen/parser-java`         |
| TypeScript  | `["**/*.ts", "**/*.tsx"]`     | `["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"]` | `@docgen/parser-typescript`   |
| Python      | `["**/*.py"]`                 | `["**/test_*", "**/__pycache__/**"]`                     | `@docgen/parser-python`       |

### Generated Output Defaults

The generated config enables Markdown output by default and leaves HTML, PDF,
and Confluence disabled:

```yaml
output:
  markdown:
    enabled: true
    outputDir: docs/api
  html:
    enabled: false
    engine: docusaurus
    outputDir: docs-site
  pdf:
    enabled: false
  confluence:
    enabled: false
```

### Serialization

The final YAML string is produced by `yaml.stringify()` with a line width of
100 characters.

---

## Environment Variable Interpolation

DocGen supports reading sensitive values from environment variables at runtime
using the `env:` prefix pattern.

### Syntax

```
env:VARIABLE_NAME
```

### Supported Fields

Currently, environment variable interpolation is used in:

- `output.confluence.auth` -- to avoid storing API tokens in version-controlled
  config files.

### Example

```yaml
output:
  confluence:
    enabled: true
    baseUrl: https://your-org.atlassian.net
    spaceKey: DOCS
    auth: "env:CONFLUENCE_TOKEN"
```

At runtime, DocGen reads the value of the `CONFLUENCE_TOKEN` environment
variable and uses it as the authentication bearer token for the Confluence API.

### Best Practices

- Always use `env:` for secrets. Never commit plaintext tokens to `.docgen.yaml`.
- Set the variable in your CI environment or a local `.env` file (not
  committed to version control).
- The prefix is the literal string `env:` followed by the variable name with no
  spaces.
