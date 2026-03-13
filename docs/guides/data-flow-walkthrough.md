# End-to-End Data Flow Walkthrough

This guide traces a single `docgen generate` invocation from CLI entry through final file output,
showing the exact data structures at every stage of the pipeline.

## Scenario

A TypeScript project with one file containing a class with 2 methods and JSDoc comments.

**Config:** markdown output enabled, coverage threshold 80%.

**Command:**

```bash
docgen generate
```

**Source file:** `src/auth-service.ts`

```typescript
/**
 * Manages user authentication and sessions.
 * @example
 * const auth = new AuthService(db);
 * await auth.login('user@example.com', 'pass');
 */
export class AuthService {
  /**
   * Authenticate a user with email and password.
   * @param email - User's email address
   * @param password - User's password
   * @returns Session token on success
   * @throws AuthError When credentials are invalid
   */
  async login(email: string, password: string): Promise<string> {
    // ...
  }

  /**
   * Invalidate the current session.
   * @param token - Active session token
   */
  async logout(token: string): Promise<void> {
    // ...
  }
}
```

**Config file:** `.docgen.yaml`

```yaml
project:
  name: my-auth-app
  version: "1.0.0"

languages:
  - name: typescript
    source: src
    include:
      - "**/*.ts"
    exclude:
      - "**/*.test.ts"
      - "**/node_modules/**"
    parser: "@docgen/parser-typescript"

output:
  markdown:
    enabled: true
    outputDir: docs/api

validation:
  coverage:
    threshold: 80
    enforce: false
  rules:
    require-description: warn
    require-param-docs: warn
```

---

## Step-by-Step Trace

### Step 1: CLI Parses Args

**Source:** `packages/cli/src/commands/generate.ts` lines 18--76

Commander.js calls `generateCommand(options)` after parsing process arguments.

```typescript
// The options object arrives as:
const options: GenerateOptions = {
  format: undefined,    // no --format flag
  output: undefined,    // no --output flag
  json: false,          // no --json flag
  verbose: false,       // no --verbose flag
  watch: false,         // no --watch flag
};
```

The function resolves `workDir` and creates a logger:

```typescript
const workDir = process.cwd();  // e.g. "/home/dev/my-auth-app"
const logger = createConsoleLogger(false);  // verbose=false
```

---

### Step 2: loadConfig()

**Source:** `packages/core/src/config/schema.ts` lines 134--172

`loadConfig(workDir)` is called. Internally it runs `findConfigFile(workDir)`:

1. **Search order** -- checks for these file names at `workDir`, then each parent directory up to the filesystem root:
   - `.docgen.yaml`
   - `.docgen.yml`
   - `docgen.config.yaml`

2. **YAML parsing** -- reads the found file with `yaml.parse()`.

3. **Zod validation** -- runs `DocGenConfigSchema.safeParse(parsed)`, which validates and applies defaults.

The returned `DocGenConfig` object (with Zod defaults filled in):

```typescript
const config: DocGenConfig = {
  project: {
    name: "my-auth-app",
    version: "1.0.0",
    description: undefined,
    repository: undefined,
  },
  languages: [
    {
      name: "typescript",
      source: "src",
      include: ["**/*.ts"],
      exclude: ["**/*.test.ts", "**/node_modules/**"],
      parser: "@docgen/parser-typescript",
      options: {},
    },
  ],
  output: {
    markdown: {
      enabled: true,
      outputDir: "docs/api",
      templates: undefined,
      filePerModule: true,
      tableOfContents: true,
      linkStyle: "relative",
    },
    html: {
      enabled: false,
      engine: "docusaurus",
      outputDir: "docs-site",
      theme: "@docgen/theme-default",
      sidebar: "auto",
      search: true,
      baseUrl: "/",
      options: {},
    },
    pdf: {
      enabled: false,
      engine: "puppeteer",
      outputDir: "docs/pdf",
      branding: { primaryColor: "#1B4F72" },
      options: {},
    },
    confluence: {
      enabled: false,
      labels: ["auto-generated"],
      incrementalSync: true,
      options: {},
    },
  },
  validation: {
    coverage: {
      threshold: 80,
      enforce: false,
      exclude: [],
    },
    rules: {
      "require-description": "warn",
      "require-param-docs": "warn",
      "require-return-docs": "off",
      "require-examples": "off",
      "require-since-tag": "off",
      "no-empty-descriptions": "warn",
    },
  },
  adr: {
    directory: "docs/decisions",
    idFormat: "ADR-{NNN}",
  },
  changelog: {
    conventionalCommits: true,
    groupBy: "type",
    outputFile: "CHANGELOG.md",
    includeCommitHash: false,
  },
  plugins: [],
};
```

---

### Step 3: Orchestrator Created

**Source:** `packages/core/src/orchestrator.ts` lines 54--64

```typescript
const orchestrator = new Orchestrator({
  config,       // DocGenConfig from step 2
  workDir,      // "/home/dev/my-auth-app"
  logger,       // console logger
});
```

The constructor stores these as private fields and sets `registry = null`.

---

### Step 4: orchestrator.generate() Called

**Source:** `packages/core/src/orchestrator.ts` lines 67--117

```typescript
const result = await orchestrator.generate(options.format);
// options.format is undefined, so all enabled renderers will run
```

Inside `generate()`:

```typescript
const start = Date.now();
this.logger.info("Starting documentation generation...");
```

The method then executes the pipeline stages in order: load plugins, parse, transform, validate, render, compute coverage.

---

### Step 5: loadAllPlugins()

**Source:** `packages/core/src/orchestrator.ts` lines 149--203, `packages/core/src/plugin/loader.ts` lines 38--64

The orchestrator collects plugin names from the config:

```typescript
const pluginNames = new Set<string>();

// From config.languages[].parser:
pluginNames.add("@docgen/parser-typescript");

// From config.plugins (empty array):
// nothing added

// From enabled output formats:
// config.output.markdown.enabled === true →
pluginNames.add("@docgen/renderer-markdown");
// html, pdf, confluence are all disabled → skipped
```

**Result:** `pluginNames = Set { "@docgen/parser-typescript", "@docgen/renderer-markdown" }`

`loadPlugins()` resolves each plugin:

1. **`@docgen/parser-typescript`** -- resolved via `require.resolve()` as an npm package, `new TypeScriptParser()` instantiated, registered into `registry.parsers.set("typescript", parser)`.

2. **`@docgen/renderer-markdown`** -- resolved via `require.resolve()`, `new MarkdownRenderer()` instantiated, registered into `registry.renderers.set("markdown", renderer)`.

The loader sorts transformers by priority (none from plugins in this case).

Back in the orchestrator, built-in transformers are created and registered:

```typescript
const coverageAnalyzer = new CoverageAnalyzer();  // priority: 50
const linkResolver = new LinkResolver();            // priority: 100

// Both initialized with PluginConfig
await coverageAnalyzer.initialize(pluginConfig);
await linkResolver.initialize(pluginConfig);

registry.transformers.push(coverageAnalyzer, linkResolver);
registry.transformers.sort((a, b) => a.priority - b.priority);
```

**Final PluginRegistry:**

```typescript
const registry: PluginRegistry = {
  parsers: Map {
    "typescript" => TypeScriptParser { ... }
  },
  transformers: [
    CoverageAnalyzer { name: "@docgen/transform-coverage", priority: 50 },
    LinkResolver { name: "@docgen/transform-link-resolver", priority: 100 },
  ],
  renderers: Map {
    "markdown" => MarkdownRenderer { ... }
  },
};
```

---

### Step 6: parseAll()

**Source:** `packages/core/src/orchestrator.ts` lines 205--248

Creates an empty DocIR skeleton:

```typescript
const docir = createEmptyDocIR({
  name: "my-auth-app",
  version: "1.0.0",
  description: undefined,
  languages: ["typescript"],
  repository: undefined,
});
```

This produces:

```json
{
  "metadata": {
    "name": "my-auth-app",
    "version": "1.0.0",
    "languages": ["typescript"],
    "generatedAt": "2026-03-11T10:30:00.000Z",
    "generatorVersion": "1.0.0"
  },
  "modules": [],
  "adrs": [],
  "changelog": [],
  "readme": null
}
```

For each language config (just `typescript`), the orchestrator:

1. Retrieves the parser from `registry.parsers.get("typescript")`.
2. Initializes it with a `PluginConfig`:
   ```typescript
   await parser.initialize({
     projectConfig: config,
     workDir: "/home/dev/my-auth-app",
     options: {},       // langConfig.options
     logger: logger,
   });
   ```
3. Resolves files via `resolveFiles(langConfig)`:
   ```typescript
   // sourceDir = "/home/dev/my-auth-app/src"
   // include patterns = ["/home/dev/my-auth-app/src/**/*.ts"]
   // ignore patterns = [
   //   "/home/dev/my-auth-app/src/**/*.test.ts",
   //   "/home/dev/my-auth-app/src/**/node_modules/**"
   // ]
   const files = fg.sync(include, { ignore, absolute: true, onlyFiles: true });
   // Result: ["/home/dev/my-auth-app/src/auth-service.ts"]
   ```
4. Calls `parser.parse(files, langConfig)` and pushes the returned modules into `docir.modules`.

---

### Step 7: TypeScriptParser.parse()

**Source:** `packages/parser-typescript/src/index.ts` lines 84--144

This is where the bulk of data extraction happens. Each sub-step is traced below.

#### 7a. Input

The parser receives the file list and language config. Internally it re-discovers files via fast-glob (belt-and-suspenders):

```typescript
const input: ParserInput = {
  sourceRoot: "src",
  include: ["**/*.ts"],
  exclude: ["**/*.test.ts", "**/node_modules/**"],
};
```

#### 7b. File Discovery

fast-glob produces:

```
["/home/dev/my-auth-app/src/auth-service.ts"]
```

#### 7c. findTsConfig()

Walks up from `src/` looking for `tsconfig.json` or `tsconfig.base.json`. Finds `"/home/dev/my-auth-app/tsconfig.json"`.

#### 7d. ts-morph Project Created

```typescript
this.project = new Project({
  tsConfigFilePath: "/home/dev/my-auth-app/tsconfig.json",
  skipAddingFilesFromTsConfig: true,
  compilerOptions: undefined,  // uses tsconfig's settings
});
```

#### 7e. Source Files Added

```typescript
for (const file of files) {
  this.project.addSourceFileAtPath(file);
  // adds: /home/dev/my-auth-app/src/auth-service.ts
}
```

#### 7f. parseSourceFile()

**Source:** lines 148--183

For `auth-service.ts`, the parser iterates over declarations in the file:

- `getClasses()` finds `AuthService` -- calls `parseClass()`
- `getInterfaces()` -- empty
- `getEnums()` -- empty
- `getTypeAliases()` -- empty
- `getFunctions()` -- empty

#### 7g. parseClass() Extracts ModuleNode

**Source:** lines 187--234

For `AuthService`:

```typescript
const name = cls.getName();                          // "AuthService"
const filePath = "auth-service.ts";                  // relative to sourceRoot
const id = this.buildId(filePath, name);             // "auth-service.AuthService"
const description = this.extractDescription(cls);    // "Manages user authentication and sessions."
const tags = this.extractTags(cls);                  // [{ name: "example", value: "const auth = ...", raw: "..." }]
const examples = this.extractExamples(cls);          // [{ title: "Example 1", language: "typescript", code: "const auth = ..." }]
const dependencies = this.extractDependencies(cls);  // []
const decorators = this.extractDecorators(cls);      // []
const generics = this.extractGenerics(cls);          // []
```

`buildId()` logic (line 757--762):
```typescript
// filePath = "auth-service.ts"
// remove extension: "auth-service"
// replace path separators with dots: "auth-service"
// append name: "auth-service.AuthService"
```

Then iterates members: constructors (none), methods (`login`, `logout`), properties (none), getters (none), setters (none).

#### 7h. parseMethod() Per Method -- MemberNode Creation

**Source:** lines 427--448

**For `login`:**

```typescript
const loginMember: MemberNode = {
  name: "login",
  kind: "method",
  visibility: "public",       // getScope() returns undefined → default "public"
  isStatic: false,
  isAsync: true,
  isAbstract: false,
  signature: "async login(email: string, password: string): Promise<string>",
  description: "Authenticate a user with email and password.",
  parameters: [/* see 7i below */],
  returnType: {/* see 7j below */},
  throws: [{ type: "AuthError", description: "When credentials are invalid" }],
  deprecated: null,
  since: undefined,
  examples: [],
  tags: [/* see 7i below */],
  decorators: [],
  overrides: undefined,
  lineNumber: 15,
};
```

**For `logout`:**

```typescript
const logoutMember: MemberNode = {
  name: "logout",
  kind: "method",
  visibility: "public",
  isStatic: false,
  isAsync: true,
  isAbstract: false,
  signature: "async logout(token: string): Promise<void>",
  description: "Invalidate the current session.",
  parameters: [/* see below */],
  returnType: {/* see below */},
  throws: [],
  deprecated: null,
  since: undefined,
  examples: [],
  tags: [{ name: "param", value: "token - Active session token", raw: "@param token - Active session token" }],
  decorators: [],
  overrides: undefined,
  lineNumber: 24,
};
```

#### 7i. extractDescription(), extractTags() -- JSDoc to DocTag Mapping

**Source:** lines 537--562

For the `login` method, `getJsDocs()` returns the JSDoc block. The parser processes it into:

```typescript
// extractDescription(loginMethod):
"Authenticate a user with email and password."

// extractTags(loginMethod):
[
  { name: "param",   value: "email - User's email address",       raw: "@param email - User's email address" },
  { name: "param",   value: "password - User's password",         raw: "@param password - User's password" },
  { name: "returns", value: "Session token on success",           raw: "@returns Session token on success" },
  { name: "throws",  value: "AuthError When credentials are invalid", raw: "@throws AuthError When credentials are invalid" },
]
```

**extractThrows()** (lines 570--581) filters for `@throws`/`@exception` tags and splits the value:

```typescript
[{ type: "AuthError", description: "When credentials are invalid" }]
```

**extractParameters()** (lines 629--637) and **getParamDescription()** (lines 640--656):

For each `ParameterDeclaration`, the parser finds the matching `@param` tag and strips the parameter name prefix:

```typescript
// login parameters:
[
  {
    name: "email",
    type: { name: "string", raw: "string", isArray: false, isOptional: false, isNullable: false, generics: [] },
    description: "User's email address",
    isOptional: false,
    isRest: false,
    defaultValue: undefined,
  },
  {
    name: "password",
    type: { name: "string", raw: "string", isArray: false, isOptional: false, isNullable: false, generics: [] },
    description: "User's password",
    isOptional: false,
    isRest: false,
    defaultValue: undefined,
  },
]

// logout parameters:
[
  {
    name: "token",
    type: { name: "string", raw: "string", isArray: false, isOptional: false, isNullable: false, generics: [] },
    description: "Active session token",
    isOptional: false,
    isRest: false,
    defaultValue: undefined,
  },
]
```

#### 7j. buildTypeRef() -- TypeRef Nodes

**Source:** lines 608--622

For `login`'s return type `Promise<string>`:

```typescript
{
  name: "Promise",
  raw: "Promise<string>",
  isArray: false,
  isOptional: false,
  isNullable: false,
  generics: [
    {
      name: "string",
      raw: "string",
      isArray: false,
      isOptional: false,
      isNullable: false,
      generics: [],
    }
  ],
}
```

For `logout`'s return type `Promise<void>`:

```typescript
{
  name: "Promise",
  raw: "Promise<void>",
  isArray: false,
  isOptional: false,
  isNullable: false,
  generics: [
    {
      name: "void",
      raw: "void",
      isArray: false,
      isOptional: false,
      isNullable: false,
      generics: [],
    }
  ],
}
```

#### 7k. ParserOutput Assembled

**Source:** lines 135--143

```typescript
const stats: ParseStats = {
  filesScanned: 1,
  filesParsed: 1,
  modulesFound: 1,
  membersFound: 2,          // login + logout
  parseTimeMs: 42,          // example timing
};

const output: ParserOutput = {
  modules: [authServiceModule],  // the single ModuleNode
  errors: [],
  stats: stats,
};
```

---

### Step 8: DocIR Validation

**Source:** `packages/core/src/docir/validator.ts` lines 236--294

After parsing, the orchestrator validates the assembled DocIR:

```typescript
const validation = validateDocIR(transformed);
```

`validateDocIR()` runs in two phases:

1. **Zod schema check** -- `DocIRSchema.safeParse(docir)` validates every field against the structural schema (lines 199--213). Each `ModuleNode`, `MemberNode`, `ParamNode`, `TypeRef`, `DocTag`, etc. is checked for required fields, correct types, and valid enum values.

2. **Semantic checks** (lines 253--293):
   - **Duplicate module IDs** -- iterates all modules, checks for duplicate `id` values. In our case there is only `"auth-service.AuthService"`, no duplicates.
   - **Broken cross-references** -- for each member's `returnType.link`, checks that the target module exists in the module ID set. No cross-references exist yet (links are resolved in the transform step).
   - **ADR ID uniqueness** -- no ADRs in this scenario.

**Result for our scenario:**

```typescript
{
  valid: true,
  errors: [],
  warnings: [],
}
```

---

### Step 9: transformAll()

**Source:** `packages/core/src/orchestrator.ts` lines 250--262

Transformers run in priority order. The orchestrator iterates the sorted transformer list and passes the DocIR through each one:

```typescript
for (const transformer of registry.transformers) {
  this.logger.debug(`Running transformer: ${transformer.name}`);
  current = await transformer.transform(current);
}
```

#### 9a. CoverageAnalyzer.transform() -- Priority 50

**Source:** `packages/core/src/transforms/coverage-analyzer.ts` lines 21--81

Runs `computeModuleCoverage()` for the `AuthService` module.

**Filter public members:**

```typescript
const publicMembers = mod.members.filter(
  (m) => m.visibility === "public" || m.visibility === "internal"
);
// Result: [login, logout] -- both are public
```

**Compute individual scores:**

| Score | Computation | Value |
|-------|-------------|-------|
| `description` | `"Manages user authentication and sessions.".trim().length > 0` | `true` |
| `members` | 2 of 2 public members have descriptions | `100` |
| `parameters` | 3 of 3 params across both methods have descriptions | `100` |
| `returnType` | `login` has `@returns` tag, 1/1 non-void methods documented > 50% | `true` |
| `examples` | Module has 1 example from `@example` tag | `true` |
| `throws` | `login` has 1 throws with description; 1/1 fully documented | `100` |

**Weighted overall calculation** (line 68--74):

```
overall = (description ? 20 : 0)   →  20
         + members * 0.3           →  100 * 0.3 = 30
         + parameters * 0.25       →  100 * 0.25 = 25
         + (returnType ? 15 : 0)   →  15
         + (examples ? 10 : 0)     →  10
         = 100
```

**Undocumented list:** Both members have descriptions, module has description. Result: `[]`

**CoverageScore after CoverageAnalyzer:**

```json
{
  "overall": 100,
  "breakdown": {
    "description": true,
    "parameters": 100,
    "returnType": true,
    "examples": true,
    "throws": 100,
    "members": 100
  },
  "undocumented": []
}
```

#### 9b. LinkResolver.transform() -- Priority 100

**Source:** `packages/core/src/transforms/link-resolver.ts` lines 21--43

**Build module index:**

```typescript
const moduleIndex = new Map<string, string>();
// From AuthService module:
moduleIndex.set("auth-service.AuthService", "auth-service.AuthService");  // id → id
moduleIndex.set("AuthService", "auth-service.AuthService");               // name → id
```

**Resolve type links** -- for each member's parameters and return types, checks if the type name exists in the module index:

- `login` return type `Promise` -- not in index, no link added.
  - Generic arg `string` -- not in index, no link added.
- `login` param `email: string` -- `string` not in index, no link.
- `login` param `password: string` -- same.
- `logout` return type `Promise<void>` -- same.
- `logout` param `token: string` -- same.

In this single-class scenario, no cross-reference links are resolved. If there were a `User` class in the project, a parameter typed `User` would get `link: "user.User"` added to its `TypeRef`.

---

### Step 10: renderAll()

**Source:** `packages/core/src/orchestrator.ts` lines 264--292, `packages/renderer-markdown/src/index.ts`

The orchestrator iterates registered renderers:

```typescript
for (const [format, renderer] of registry.renderers) {
  // format = "markdown", renderer = MarkdownRenderer
  await renderer.initialize({ projectConfig, workDir, options: {}, logger });
  const artifacts = await renderer.render(docir, outputConfig);
  // ...
  await renderer.cleanup();
}
```

The `MarkdownRenderer.render()` method (lines 50--135) generates these files:

#### 10a. renderIndex() -- `README.md`

**Source:** lines 139--210

Generates the top-level index with project name, description badges, an overview table, and a module listing grouped by language.

```markdown
# my-auth-app -- API Documentation

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Coverage](https://img.shields.io/badge/doc_coverage-100%25-brightgreen) ![Languages](https://img.shields.io/badge/languages-typescript-informational)

## Overview

| Metric | Value |
|--------|-------|
| **Modules** | 1 |
| **Members** | 2 |
| **Languages** | typescript |
| **Doc Coverage** | 100% |
| **Generated** | 3/11/2026 |

## API Reference

### TypeScript

| Module | Kind | Coverage | Description |
|--------|------|----------|-------------|
| [`AuthService`](./typescript/AuthService.md) | class | ![100%](https://img.shields.io/badge/coverage-100%25-brightgreen) | Manages user authentication and sessions. |

---
*Generated by [DocGen](https://github.com/docgen/docgen) v1.0.0*
```

#### 10b. renderLanguageIndex() -- `typescript/README.md`

**Source:** lines 212--241

```markdown
# TypeScript API Reference

[<- Back to Index](../README.md)

## Classes

| Name | Coverage | Description |
|------|----------|-------------|
| [`AuthService`](./AuthService.md) | ![100%](https://img.shields.io/badge/coverage-100%25-brightgreen) | Manages user authentication and sessions. |
```

#### 10c. renderModule() -- `typescript/AuthService.md`

**Source:** lines 246--360

Produces the per-module file with header, metadata badges, source link, description, member table of contents, detailed member documentation, and coverage report.

#### 10d. renderMember() Per Member

**Source:** lines 364--456

For each public/protected member, generates the signature block, parameter table, return type, throws section, and collapsible examples.

#### Generated File: `typescript/AuthService.md`

```markdown
# Class `AuthService`

[<- Back to TypeScript Index](./README.md)

![class](https://img.shields.io/badge/kind-class-blue) ![100%](https://img.shields.io/badge/coverage-100%25-brightgreen) ![exported](https://img.shields.io/badge/exported-yes-green)

**Source:** `auth-service.ts`

Manages user authentication and sessions.

## Members

| Name | Kind | Description |
|------|------|-------------|
| [`login`](#login) | method | Authenticate a user with email and password. |
| [`logout`](#logout) | method | Invalidate the current session. |

---

### *async* `login`

```typescript
async login(email: string, password: string): Promise<string>
```

Authenticate a user with email and password.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `email` | `string` | Yes | User's email address |
| `password` | `string` | Yes | User's password |

**Returns:** `Promise`
-- Session token on success

**Throws:**

- `AuthError` -- When credentials are invalid

### *async* `logout`

```typescript
async logout(token: string): Promise<void>
```

Invalidate the current session.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `token` | `string` | Yes | Active session token |

## Documentation Coverage

**Overall: 100%**

| Check | Status |
|-------|--------|
| Module description | Yes |
| Parameter docs | 100% |
| Return type docs | Yes |
| Throws docs | Yes |
| Examples | Yes |

## Examples

### Example 1

```typescript
const auth = new AuthService(db);
await auth.login('user@example.com', 'pass');
```
```

#### Files Written to Disk

The renderer returns an array of `OutputArtifact` objects. The CLI then writes each one:

```typescript
// In generateCommand(), lines 44-58:
for (const artifact of result.artifacts) {
  const outputDir = getOutputDir(config, artifact.metadata.format);
  // outputDir = "docs/api" (from config.output.markdown.outputDir)
  const fullPath = path.resolve(workDir, outputDir, artifact.filePath);
  // Creates directories and writes content
}
```

**Files created on disk:**

| File Path | Description |
|-----------|-------------|
| `docs/api/README.md` | Project index |
| `docs/api/typescript/README.md` | TypeScript language index |
| `docs/api/typescript/AuthService.md` | AuthService module documentation |

---

### Step 11: Result Assembly

**Source:** `packages/core/src/orchestrator.ts` lines 96--117, `packages/core/src/docir/validator.ts` lines 297--347

After rendering, the orchestrator computes aggregate coverage using `computeAggregateCoverage()`:

```typescript
const aggregateCoverage = computeAggregateCoverage(transformed.modules);
```

With one module scoring 100%, the aggregate is:

```typescript
{
  overall: 100,                     // average of all module scores
  breakdown: {
    description: true,              // >50% of modules have descriptions
    parameters: 100,                // average param coverage
    returnType: true,               // >50% of modules have return docs
    examples: true,                 // >50% of modules have examples
    throws: 0,                      // default from computeAggregateCoverage
    members: 100,                   // average member coverage
  },
  undocumented: [],                 // no undocumented items
}
```

The final `GenerateResult`:

```typescript
const result: GenerateResult = {
  docir: transformed,               // full DocIR with coverage scores and resolved links
  artifacts: [
    {
      filePath: "README.md",
      content: "# my-auth-app -- API Documentation\n...",
      mimeType: "text/markdown",
      size: 847,
      metadata: {
        generatedAt: "2026-03-11T10:30:00.042Z",
        sourceModules: ["auth-service.AuthService"],
        format: "markdown",
      },
    },
    {
      filePath: "typescript/README.md",
      content: "# TypeScript API Reference\n...",
      mimeType: "text/markdown",
      size: 312,
      metadata: {
        generatedAt: "2026-03-11T10:30:00.042Z",
        sourceModules: ["auth-service.AuthService"],
        format: "markdown",
      },
    },
    {
      filePath: "typescript/AuthService.md",
      content: "# Class `AuthService`\n...",
      mimeType: "text/markdown",
      size: 1893,
      metadata: {
        generatedAt: "2026-03-11T10:30:00.042Z",
        sourceModules: ["auth-service.AuthService"],
        format: "markdown",
      },
    },
  ],
  coverage: {
    overall: 100,
    threshold: 80,
    passed: true,                   // 100 >= 80
  },
  duration: 187,                    // milliseconds
};
```

---

### Step 12: CLI Outputs Result

**Source:** `packages/cli/src/commands/generate.ts` lines 60--76

Since `--json` was not passed, the CLI calls `outputHuman(result)`:

```typescript
function outputHuman(result: GenerateResult): void {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     DocGen - Generation Complete     ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log(`  Modules parsed:    ${result.docir.modules.length}`);
  console.log(`  Files generated:   ${result.artifacts.length}`);
  console.log(`  Coverage:          ${result.coverage.overall}% (threshold: ${result.coverage.threshold}%)`);
  console.log(`  Status:            ${result.coverage.passed ? "PASSED" : "FAILED"}`);
  console.log(`  Duration:          ${result.duration}ms\n`);
}
```

**Console output:**

```
  [info]  Starting documentation generation...
  [info]  Registered parser: @docgen/parser-typescript (typescript)
  [info]  Registered renderer: @docgen/renderer-markdown (markdown)
  [info]  Parsing 1 typescript files from src...
  [info]  Rendering markdown output...
  [ok]    markdown: 3 files generated
  [ok]    Generation complete in 187ms -- 1 modules, 3 files generated, coverage: 100%

╔══════════════════════════════════════╗
║     DocGen - Generation Complete     ║
╚══════════════════════════════════════╝

  Modules parsed:    1
  Files generated:   3
  Coverage:          100% (threshold: 80%)
  Status:            PASSED
  Duration:          187ms
```

Finally, since `config.validation.coverage.enforce` is `false`, the exit code check is skipped and the process exits normally with code `0`.

---

## Concrete Example -- Complete Data Structures

### Input TypeScript Source

```typescript
/**
 * Manages user authentication and sessions.
 * @example
 * const auth = new AuthService(db);
 * await auth.login('user@example.com', 'pass');
 */
export class AuthService {
  /**
   * Authenticate a user with email and password.
   * @param email - User's email address
   * @param password - User's password
   * @returns Session token on success
   * @throws AuthError When credentials are invalid
   */
  async login(email: string, password: string): Promise<string> {
    // ...
  }

  /**
   * Invalidate the current session.
   * @param token - Active session token
   */
  async logout(token: string): Promise<void> {
    // ...
  }
}
```

### DocIR JSON After Parsing (Before Transforms)

This is the state of the `DocIR` immediately after `parseAll()` returns, before any transformers have run. Coverage scores are all zeroed out (from `createEmptyCoverage()`).

```json
{
  "metadata": {
    "name": "my-auth-app",
    "version": "1.0.0",
    "languages": ["typescript"],
    "generatedAt": "2026-03-11T10:30:00.000Z",
    "generatorVersion": "1.0.0"
  },
  "modules": [
    {
      "id": "auth-service.AuthService",
      "name": "AuthService",
      "filePath": "auth-service.ts",
      "language": "typescript",
      "kind": "class",
      "description": "Manages user authentication and sessions.",
      "tags": [
        {
          "name": "example",
          "value": "const auth = new AuthService(db);\nawait auth.login('user@example.com', 'pass');",
          "raw": "@example\nconst auth = new AuthService(db);\nawait auth.login('user@example.com', 'pass');"
        }
      ],
      "members": [
        {
          "name": "login",
          "kind": "method",
          "visibility": "public",
          "isStatic": false,
          "isAsync": true,
          "isAbstract": false,
          "signature": "async login(email: string, password: string): Promise<string>",
          "description": "Authenticate a user with email and password.",
          "parameters": [
            {
              "name": "email",
              "type": {
                "name": "string",
                "raw": "string",
                "isArray": false,
                "isOptional": false,
                "isNullable": false,
                "generics": []
              },
              "description": "User's email address",
              "isOptional": false,
              "isRest": false
            },
            {
              "name": "password",
              "type": {
                "name": "string",
                "raw": "string",
                "isArray": false,
                "isOptional": false,
                "isNullable": false,
                "generics": []
              },
              "description": "User's password",
              "isOptional": false,
              "isRest": false
            }
          ],
          "returnType": {
            "name": "Promise",
            "raw": "Promise<string>",
            "isArray": false,
            "isOptional": false,
            "isNullable": false,
            "generics": [
              {
                "name": "string",
                "raw": "string",
                "isArray": false,
                "isOptional": false,
                "isNullable": false,
                "generics": []
              }
            ]
          },
          "throws": [
            {
              "type": "AuthError",
              "description": "When credentials are invalid"
            }
          ],
          "deprecated": null,
          "examples": [],
          "tags": [
            {
              "name": "param",
              "value": "email - User's email address",
              "raw": "@param email - User's email address"
            },
            {
              "name": "param",
              "value": "password - User's password",
              "raw": "@param password - User's password"
            },
            {
              "name": "returns",
              "value": "Session token on success",
              "raw": "@returns Session token on success"
            },
            {
              "name": "throws",
              "value": "AuthError When credentials are invalid",
              "raw": "@throws AuthError When credentials are invalid"
            }
          ],
          "decorators": [],
          "lineNumber": 15
        },
        {
          "name": "logout",
          "kind": "method",
          "visibility": "public",
          "isStatic": false,
          "isAsync": true,
          "isAbstract": false,
          "signature": "async logout(token: string): Promise<void>",
          "description": "Invalidate the current session.",
          "parameters": [
            {
              "name": "token",
              "type": {
                "name": "string",
                "raw": "string",
                "isArray": false,
                "isOptional": false,
                "isNullable": false,
                "generics": []
              },
              "description": "Active session token",
              "isOptional": false,
              "isRest": false
            }
          ],
          "returnType": {
            "name": "Promise",
            "raw": "Promise<void>",
            "isArray": false,
            "isOptional": false,
            "isNullable": false,
            "generics": [
              {
                "name": "void",
                "raw": "void",
                "isArray": false,
                "isOptional": false,
                "isNullable": false,
                "generics": []
              }
            ]
          },
          "throws": [],
          "deprecated": null,
          "examples": [],
          "tags": [
            {
              "name": "param",
              "value": "token - Active session token",
              "raw": "@param token - Active session token"
            }
          ],
          "decorators": [],
          "lineNumber": 24
        }
      ],
      "dependencies": [],
      "examples": [
        {
          "title": "Example 1",
          "language": "typescript",
          "code": "const auth = new AuthService(db);\nawait auth.login('user@example.com', 'pass');"
        }
      ],
      "coverage": {
        "overall": 0,
        "breakdown": {
          "description": false,
          "parameters": 0,
          "returnType": false,
          "examples": false,
          "throws": 0,
          "members": 0
        },
        "undocumented": []
      },
      "decorators": [],
      "generics": [],
      "exported": true
    }
  ],
  "adrs": [],
  "changelog": [],
  "readme": null
}
```

### DocIR JSON After Transforms (With Coverage Scores)

After `CoverageAnalyzer` (priority 50) and `LinkResolver` (priority 100) have run, the only change is the `coverage` field on the module. The `LinkResolver` found no cross-module type references to resolve in this single-class project.

```json
{
  "metadata": {
    "name": "my-auth-app",
    "version": "1.0.0",
    "languages": ["typescript"],
    "generatedAt": "2026-03-11T10:30:00.000Z",
    "generatorVersion": "1.0.0"
  },
  "modules": [
    {
      "id": "auth-service.AuthService",
      "name": "AuthService",
      "filePath": "auth-service.ts",
      "language": "typescript",
      "kind": "class",
      "description": "Manages user authentication and sessions.",
      "tags": [
        {
          "name": "example",
          "value": "const auth = new AuthService(db);\nawait auth.login('user@example.com', 'pass');",
          "raw": "@example\nconst auth = new AuthService(db);\nawait auth.login('user@example.com', 'pass');"
        }
      ],
      "members": [
        {
          "name": "login",
          "kind": "method",
          "visibility": "public",
          "isStatic": false,
          "isAsync": true,
          "isAbstract": false,
          "signature": "async login(email: string, password: string): Promise<string>",
          "description": "Authenticate a user with email and password.",
          "parameters": [
            {
              "name": "email",
              "type": {
                "name": "string",
                "raw": "string",
                "isArray": false,
                "isOptional": false,
                "isNullable": false,
                "generics": []
              },
              "description": "User's email address",
              "isOptional": false,
              "isRest": false
            },
            {
              "name": "password",
              "type": {
                "name": "string",
                "raw": "string",
                "isArray": false,
                "isOptional": false,
                "isNullable": false,
                "generics": []
              },
              "description": "User's password",
              "isOptional": false,
              "isRest": false
            }
          ],
          "returnType": {
            "name": "Promise",
            "raw": "Promise<string>",
            "isArray": false,
            "isOptional": false,
            "isNullable": false,
            "generics": [
              {
                "name": "string",
                "raw": "string",
                "isArray": false,
                "isOptional": false,
                "isNullable": false,
                "generics": []
              }
            ]
          },
          "throws": [
            {
              "type": "AuthError",
              "description": "When credentials are invalid"
            }
          ],
          "deprecated": null,
          "examples": [],
          "tags": [
            {
              "name": "param",
              "value": "email - User's email address",
              "raw": "@param email - User's email address"
            },
            {
              "name": "param",
              "value": "password - User's password",
              "raw": "@param password - User's password"
            },
            {
              "name": "returns",
              "value": "Session token on success",
              "raw": "@returns Session token on success"
            },
            {
              "name": "throws",
              "value": "AuthError When credentials are invalid",
              "raw": "@throws AuthError When credentials are invalid"
            }
          ],
          "decorators": [],
          "lineNumber": 15
        },
        {
          "name": "logout",
          "kind": "method",
          "visibility": "public",
          "isStatic": false,
          "isAsync": true,
          "isAbstract": false,
          "signature": "async logout(token: string): Promise<void>",
          "description": "Invalidate the current session.",
          "parameters": [
            {
              "name": "token",
              "type": {
                "name": "string",
                "raw": "string",
                "isArray": false,
                "isOptional": false,
                "isNullable": false,
                "generics": []
              },
              "description": "Active session token",
              "isOptional": false,
              "isRest": false
            }
          ],
          "returnType": {
            "name": "Promise",
            "raw": "Promise<void>",
            "isArray": false,
            "isOptional": false,
            "isNullable": false,
            "generics": [
              {
                "name": "void",
                "raw": "void",
                "isArray": false,
                "isOptional": false,
                "isNullable": false,
                "generics": []
              }
            ]
          },
          "throws": [],
          "deprecated": null,
          "examples": [],
          "tags": [
            {
              "name": "param",
              "value": "token - Active session token",
              "raw": "@param token - Active session token"
            }
          ],
          "decorators": [],
          "lineNumber": 24
        }
      ],
      "dependencies": [],
      "examples": [
        {
          "title": "Example 1",
          "language": "typescript",
          "code": "const auth = new AuthService(db);\nawait auth.login('user@example.com', 'pass');"
        }
      ],
      "coverage": {
        "overall": 100,
        "breakdown": {
          "description": true,
          "parameters": 100,
          "returnType": true,
          "examples": true,
          "throws": 100,
          "members": 100
        },
        "undocumented": []
      },
      "decorators": [],
      "generics": [],
      "exported": true
    }
  ],
  "adrs": [],
  "changelog": [],
  "readme": null
}
```

The key difference from the pre-transform state is the `coverage` object: `overall` went from `0` to `100`, all breakdown flags are now populated with real values instead of empty defaults.

### Generated Markdown Output

Three files are written to `docs/api/`:

**`docs/api/README.md`** -- project index with overview table, links to language sections.

**`docs/api/typescript/README.md`** -- TypeScript language index grouping modules by kind.

**`docs/api/typescript/AuthService.md`** -- full module documentation (shown in Step 10c above).

### Console Output

**Normal mode** (no `--json`):

```
  [info]  Starting documentation generation...
  [info]  Registered parser: @docgen/parser-typescript (typescript)
  [info]  Registered renderer: @docgen/renderer-markdown (markdown)
  [info]  Parsing 1 typescript files from src...
  [info]  Rendering markdown output...
  [ok]    markdown: 3 files generated
  [ok]    Generation complete in 187ms -- 1 modules, 3 files generated, coverage: 100%

╔══════════════════════════════════════╗
║     DocGen - Generation Complete     ║
╚══════════════════════════════════════╝

  Modules parsed:    1
  Files generated:   3
  Coverage:          100% (threshold: 80%)
  Status:            PASSED
  Duration:          187ms
```

**JSON mode** (`docgen generate --json`):

```json
{
  "success": true,
  "modules": 1,
  "artifacts": 3,
  "coverage": {
    "overall": 100,
    "threshold": 80,
    "passed": true
  },
  "duration": 187
}
```

**Exit code:** `0` (success). If `enforce` were `true` and coverage were below 80%, exit code would be `1`.

---

## Pipeline Summary Diagram

```
CLI (generate.ts)
  |
  v
loadConfig()  ───────────────────  .docgen.yaml  ───>  DocGenConfig
  |
  v
new Orchestrator({ config, workDir, logger })
  |
  v
orchestrator.generate()
  |
  ├─ 1. loadAllPlugins()  ──────>  PluginRegistry { parsers, transformers, renderers }
  |
  ├─ 2. parseAll()  ────────────>  DocIR { modules: [ModuleNode], coverage: zeros }
  |     └── TypeScriptParser.parse()
  |           ├── fast-glob  ─────>  file list
  |           ├── ts-morph   ─────>  AST
  |           ├── parseClass()  ──>  ModuleNode
  |           └── parseMethod() ──>  MemberNode[]
  |
  ├─ 3. validateDocIR()  ───────>  { valid, errors, warnings }
  |
  ├─ 4. transformAll()  ────────>  DocIR { coverage: computed, links: resolved }
  |     ├── CoverageAnalyzer (p50)   weighted scoring per module
  |     └── LinkResolver (p100)      type name → module ID cross-refs
  |
  ├─ 5. renderAll()  ──────────>  OutputArtifact[]
  |     └── MarkdownRenderer.render()
  |           ├── renderIndex()          ──>  README.md
  |           ├── renderLanguageIndex()  ──>  typescript/README.md
  |           └── renderModule()         ──>  typescript/AuthService.md
  |
  └─ 6. Result assembly  ─────>  GenerateResult { docir, artifacts, coverage, duration }
        |
        v
CLI writes files to disk, prints summary, exits
```
