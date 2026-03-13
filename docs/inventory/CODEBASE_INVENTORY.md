# DocGen — Codebase Inventory

> Generated inventory of every exported symbol across all packages in the DocGen monorepo.

---

## Summary

| Metric | Count |
|--------|-------|
| **Packages** | 4 |
| **TypeScript Files** | 22 |
| **Total Lines** | ~3,840 |
| **Exported Interfaces** | 28 |
| **Exported Types / Aliases** | 9 |
| **Exported Classes** | 6 |
| **Exported Functions** | 9 |
| **Exported Constants** | 3 |

---

## Package: `@docgen/core` (v1.0.0)

**Description:** Core engine for DocGen — DocIR types, plugin system, and orchestrator
**Entry Point:** `dist/index.js`
**Dependencies:** zod ^3.23.0, yaml ^2.4.0, glob ^10.3.0, chalk ^4.1.2, fast-glob ^3.3.0
**Source Files:** 13

### File: `src/docir/types.ts` (289 lines)

| Export | Kind | Details |
|--------|------|---------|
| `DocIR` | Interface | Top-level IR. Fields: `metadata`, `modules`, `adrs`, `changelog`, `readme` |
| `ProjectMetadata` | Interface | Fields: `name`, `version`, `description?`, `languages`, `repository?`, `generatedAt`, `generatorVersion` |
| `SupportedLanguage` | Type Alias | `"java" \| "typescript" \| "python"` |
| `ModuleNode` | Interface | Fields: `id`, `name`, `filePath`, `language`, `kind`, `description`, `tags`, `members`, `dependencies`, `examples`, `coverage`, `decorators`, `typeParameters`, `extends?`, `implements?`, `exports?` |
| `ModuleKind` | Type Alias | `"class" \| "interface" \| "module" \| "namespace" \| "enum" \| "type-alias" \| "function"` |
| `MemberNode` | Interface | Fields: `name`, `kind`, `visibility`, `isStatic`, `isAbstract`, `isAsync`, `signature`, `description`, `parameters`, `returnType`, `throws`, `tags`, `examples`, `deprecated`, `since?`, `overrides?`, `decorators` |
| `MemberKind` | Type Alias | `"method" \| "property" \| "field" \| "constructor" \| "getter" \| "setter" \| "index-signature" \| "enum-member"` |
| `Visibility` | Type Alias | `"public" \| "protected" \| "private" \| "internal"` |
| `ParamNode` | Interface | Fields: `name`, `type`, `description`, `isOptional`, `isRest`, `defaultValue?` |
| `TypeRef` | Interface | Fields: `raw`, `name`, `typeArguments?`, `isArray`, `isNullable`, `isUnion`, `unionMembers?`, `link?` |
| `TypeParamNode` | Interface | Fields: `name`, `constraint?`, `default?` |
| `DocTag` | Interface | Fields: `tag`, `name?`, `type?`, `description` |
| `ThrowsNode` | Interface | Fields: `type`, `description` |
| `DeprecationInfo` | Interface | Fields: `since?`, `message`, `replacement?` |
| `CodeExample` | Interface | Fields: `title?`, `language`, `code`, `description?` |
| `DecoratorNode` | Interface | Fields: `name`, `arguments`, `raw` |
| `DependencyRef` | Interface | Fields: `name`, `source`, `kind` (`"import" \| "injection" \| "inheritance"`) |
| `ExportInfo` | Interface | Fields: `isDefault`, `isNamed`, `exportedName?` |
| `CoverageScore` | Interface | Fields: `overall`, `breakdown` (description, parameters, returnType, examples, throws, members), `undocumented` |
| `ADRNode` | Interface | Fields: `id`, `title`, `status`, `context`, `decision`, `consequences`, `date`, `authors?`, `supersededBy?`, `relatedTo?`, `tags?` |
| `ADRStatus` | Type Alias | `"proposed" \| "accepted" \| "deprecated" \| "superseded" \| "rejected"` |
| `ChangelogEntry` | Interface | Fields: `version`, `date`, `description?`, `sections` |
| `ChangelogSections` | Interface | Fields: `added`, `changed`, `deprecated`, `removed`, `fixed`, `security` |
| `ReadmeNode` | Interface | Fields: `title`, `description`, `badges`, `installation?`, `quickStart?`, `apiSummary?`, `contributing?`, `license?`, `customSections` |
| `BadgeInfo` | Interface | Fields: `label`, `value`, `color`, `url?` |
| `ReadmeSection` | Interface | Fields: `title`, `content`, `order` |
| `createEmptyDocIR()` | Function | `(metadata: Partial<ProjectMetadata> & { name: string }) => DocIR` |
| `createEmptyCoverage()` | Function | `() => CoverageScore` |

### File: `src/docir/validator.ts` (348 lines)

| Export | Kind | Details |
|--------|------|---------|
| `DocIRSchema` | Constant (Zod) | Full Zod schema validating the entire DocIR structure |
| `ValidationResult` | Interface | Fields: `valid`, `errors`, `warnings` |
| `ValidationError` | Interface | Fields: `path`, `message`, `code` |
| `ValidationWarning` | Interface | Fields: `path`, `message`, `suggestion?` |
| `validateDocIR()` | Function | `(docir: unknown) => ValidationResult` — schema + semantic validation |
| `computeAggregateCoverage()` | Function | `(modules: ModuleNode[]) => CoverageScore` — averaged coverage |

### File: `src/docir/index.ts` (2 lines)

Re-exports all from `./types` and `./validator`.

### File: `src/plugin/types.ts` (155 lines)

| Export | Kind | Details |
|--------|------|---------|
| `PluginType` | Type Alias | `"parser" \| "transformer" \| "renderer"` |
| `DocGenPlugin` | Interface | Base plugin. Props: `name`, `version`, `type`, `supports`. Methods: `initialize()`, `validate()`, `cleanup()` |
| `PluginConfig` | Interface | Fields: `projectConfig`, `workDir`, `options`, `logger` |
| `PluginValidationResult` | Interface | Fields: `valid`, `errors`, `warnings` |
| `ParserPlugin` | Interface (extends DocGenPlugin) | `type: "parser"`, `language: SupportedLanguage`, `parse(files, langConfig): Promise<DocIR>` |
| `isParserPlugin()` | Function | Type guard: `(plugin: DocGenPlugin) => plugin is ParserPlugin` |
| `TransformerPlugin` | Interface (extends DocGenPlugin) | `type: "transformer"`, `priority: number`, `transform(docir): Promise<DocIR>` |
| `isTransformerPlugin()` | Function | Type guard: `(plugin: DocGenPlugin) => plugin is TransformerPlugin` |
| `RendererPlugin` | Interface (extends DocGenPlugin) | `type: "renderer"`, `format: string`, `render(docir, outputConfig): Promise<OutputArtifact[]>` |
| `isRendererPlugin()` | Function | Type guard: `(plugin: DocGenPlugin) => plugin is RendererPlugin` |
| `OutputArtifact` | Interface | Fields: `filePath`, `content`, `mimeType`, `size`, `metadata` |
| `Logger` | Interface | Methods: `debug()`, `info()`, `warn()`, `error()`, `success()` |
| `createConsoleLogger()` | Function | `(verbose?: boolean) => Logger` |

### File: `src/plugin/loader.ts` (201 lines)

| Export | Kind | Details |
|--------|------|---------|
| `PluginRegistry` | Interface | Fields: `parsers: Map<string, ParserPlugin>`, `transformers: TransformerPlugin[]`, `renderers: Map<string, RendererPlugin>` |
| `PluginLoaderOptions` | Interface | Fields: `pluginDirs?`, `workDir`, `logger` |
| `loadPlugins()` | Function | `(pluginNames: string[], options: PluginLoaderOptions) => Promise<PluginRegistry>` |
| `PluginLoadError` | Class (extends Error) | Constructor: `(pluginName: string, cause: Error)`. Props: `pluginName`, `cause` |

### File: `src/plugin/index.ts` (2 lines)

Re-exports all from `./types` and `./loader`.

### File: `src/config/schema.ts` (270 lines)

| Export | Kind | Details |
|--------|------|---------|
| `DocGenConfigSchema` | Constant (Zod) | Full Zod schema for `.docgen.yaml` |
| `DocGenConfig` | Type (inferred) | Inferred from `DocGenConfigSchema` |
| `LanguageConfig` | Type (inferred) | Language-specific config section |
| `OutputConfig` | Type (inferred) | Output format config section |
| `MarkdownOutput` | Type (inferred) | Markdown output options |
| `HtmlOutput` | Type (inferred) | HTML output options |
| `PdfOutput` | Type (inferred) | PDF output options |
| `ConfluenceOutput` | Type (inferred) | Confluence output options |
| `ValidationConfig` | Type (inferred) | Validation rules config |
| `loadConfig()` | Function | `(workDir: string) => DocGenConfig` — finds and parses `.docgen.yaml` |
| `generateDefaultConfig()` | Function | `(options: { projectName, languages }) => string` — generates YAML string |
| `ConfigError` | Class (extends Error) | Constructor: `(message: string)` |

### File: `src/config/index.ts` (1 line)

Re-exports all from `./schema`.

### File: `src/transforms/coverage-analyzer.ts` (137 lines)

| Export | Kind | Details |
|--------|------|---------|
| `CoverageAnalyzer` | Class (implements TransformerPlugin) | Priority: 50. Methods: `transform(docir)`, private: `computeModuleCoverage()`, `computeParamCoverage()`, `computeReturnCoverage()`, `computeThrowsCoverage()`, `computeMemberCoverage()` |

#### `CoverageAnalyzer` — Public Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `initialize()` | `(config: PluginConfig) => Promise<void>` | No-op |
| `validate()` | `() => Promise<PluginValidationResult>` | Always returns valid |
| `cleanup()` | `() => Promise<void>` | No-op |
| `transform()` | `(docir: DocIR) => Promise<DocIR>` | Computes coverage scores for all modules |

### File: `src/transforms/link-resolver.ts` (70 lines)

| Export | Kind | Details |
|--------|------|---------|
| `LinkResolver` | Class (implements TransformerPlugin) | Priority: 100. Methods: `transform(docir)`, private: `resolveTypeLinks()` |

#### `LinkResolver` — Public Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `initialize()` | `(config: PluginConfig) => Promise<void>` | No-op |
| `validate()` | `() => Promise<PluginValidationResult>` | Always returns valid |
| `cleanup()` | `() => Promise<void>` | No-op |
| `transform()` | `(docir: DocIR) => Promise<DocIR>` | Resolves cross-references between module types |

### File: `src/transforms/index.ts` (2 lines)

Re-exports `CoverageAnalyzer` and `LinkResolver`.

### File: `src/orchestrator.ts` (362 lines)

| Export | Kind | Details |
|--------|------|---------|
| `OrchestratorOptions` | Interface | Fields: `config`, `workDir`, `logger`, `formats?` |
| `GenerateResult` | Interface | Fields: `docir`, `artifacts`, `coverage` (overall, threshold, passed), `duration` |
| `ValidateResult` | Interface | Fields: `coverage` (overall, threshold, passed, undocumented), `violations`, `duration` |
| `Orchestrator` | Class | Constructor: `(options: OrchestratorOptions)`. Methods: `generate(formats?)`, `validate()` |

#### `Orchestrator` — Public Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `generate()` | `(formats?: string[]) => Promise<GenerateResult>` | Full pipeline: parse → transform → render |
| `validate()` | `() => Promise<ValidateResult>` | Parse + transform only, returns coverage/violations |

#### `Orchestrator` — Private Methods

| Method | Signature |
|--------|-----------|
| `loadAllPlugins()` | `() => Promise<PluginRegistry>` |
| `parseAll()` | `(registry: PluginRegistry) => Promise<DocIR>` |
| `transformAll()` | `(docir: DocIR, registry: PluginRegistry) => Promise<DocIR>` |
| `renderAll()` | `(docir: DocIR, registry: PluginRegistry, formats?: string[]) => Promise<OutputArtifact[]>` |
| `resolveFiles()` | `(langConfig: LanguageConfig) => Promise<string[]>` |
| `checkValidationRules()` | `(docir: DocIR) => ValidateResult["violations"]` |

### File: `src/index.ts` (16 lines)

Re-exports all from `./docir`, `./plugin`, `./config`, `./transforms`, and named exports from `./orchestrator`.

---

## Package: `@docgen/parser-typescript` (v1.0.0)

**Description:** TypeScript/TSX parser plugin for DocGen
**Entry Point:** `dist/index.js`
**Dependencies:** @docgen/core workspace:*, ts-morph ^22.0.0
**Source Files:** 1

### File: `src/index.ts` (806 lines)

| Export | Kind | Details |
|--------|------|---------|
| `TypeScriptParser` | Class (implements ParserPlugin) | Main parser class |
| `default` | Default Export | `TypeScriptParser` |

#### `TypeScriptParser` — Public API

| Member | Kind | Signature |
|--------|------|-----------|
| `manifest` | Property (readonly) | `PluginManifest & { type: "parser" }` — name: `@docgen/parser-typescript`, supports: `["typescript", "tsx", "ts"]` |
| `initialize()` | Method | `(config: PluginConfig) => Promise<void>` — No-op (project created per-parse) |
| `validate()` | Method | `() => Promise<PluginValidationResult>` — Always valid |
| `cleanup()` | Method | `() => Promise<void>` — Nullifies project |
| `parse()` | Method | `(input: ParserInput) => Promise<ParserOutput>` — Main entry point |

#### `TypeScriptParser` — Private Methods (24 total)

| Method | Purpose |
|--------|---------|
| `parseSourceFile()` | File-level orchestration — dispatches to class/interface/enum/type/function parsers |
| `parseClass()` | Extracts class declaration → ModuleNode (constructors, methods, properties, accessors) |
| `parseInterface()` | Extracts interface declaration → ModuleNode |
| `parseEnum()` | Extracts enum declaration → ModuleNode with enum-member MemberNodes |
| `parseTypeAlias()` | Extracts type alias → ModuleNode |
| `parseFunction()` | Extracts standalone exported function → ModuleNode with single method member |
| `parseMethod()` | MethodDeclaration → MemberNode |
| `parseProperty()` | PropertyDeclaration → MemberNode |
| `parseConstructor()` | ConstructorDeclaration → MemberNode |
| `parseAccessor()` | GetAccessor/SetAccessor → MemberNode |
| `getJsDocs()` | Retrieves JSDoc nodes from any AST node |
| `extractDescription()` | Extracts JSDoc description text |
| `extractTags()` | Extracts all JSDoc tags as DocTag[] |
| `extractTagValue()` | Gets single tag value by name |
| `extractThrows()` | Extracts @throws/@exception tags → ThrowsNode[] |
| `extractDeprecation()` | Extracts @deprecated tag → DeprecationInfo |
| `extractExamples()` | Extracts @example tags → CodeExample[] |
| `buildTypeRef()` | ts-morph Type → TypeRef node |
| `simplifyTypeName()` | Strips import() paths from type names |
| `extractParameters()` | ParameterDeclaration[] → ParamNode[] |
| `getParamDescription()` | Matches @param JSDoc tag to parameter by name |
| `extractGenerics()` | Extracts generic type parameters |
| `extractDecorators()` | Extracts decorator metadata |
| `extractDependencies()` | Extracts inheritance, implements, and DI dependencies |
| `getVisibility()` | Maps ts-morph Scope to Visibility |
| `buildId()` | Constructs fully qualified module ID from file path + name |
| `buildMethodSignature()` | Constructs human-readable method signature string |
| `buildFunctionSignature()` | Constructs human-readable function signature string |
| `findTsConfig()` | Walks directory tree to find tsconfig.json |

---

## Package: `@docgen/renderer-markdown` (v1.0.0)

**Description:** Markdown renderer plugin for DocGen
**Entry Point:** `dist/index.js`
**Dependencies:** @docgen/core 1.0.0
**Source Files:** 1

### File: `src/index.ts` (603 lines)

| Export | Kind | Details |
|--------|------|---------|
| `MarkdownRenderer` | Class (implements RendererPlugin) | Main renderer class |
| `default` | Default Export | `MarkdownRenderer` |

#### `MarkdownRenderer` — Public API

| Member | Kind | Signature |
|--------|------|-----------|
| `manifest` | Property (readonly) | `PluginManifest & { type: "renderer" }` — name: `@docgen/renderer-markdown`, supports: `["markdown", "md"]` |
| `initialize()` | Method | `(config: PluginConfig) => Promise<void>` — Reads `includeSourceLinks` and `collapsibleSections` options |
| `validate()` | Method | `() => Promise<PluginValidationResult>` — Always valid |
| `cleanup()` | Method | `() => Promise<void>` — No-op |
| `render()` | Method | `(ir: DocIR, outputDir: string) => Promise<RendererOutput>` — Main entry point |

#### `MarkdownRenderer` — Private Methods (14 total)

| Method | Purpose |
|--------|---------|
| `renderIndex()` | Generates main README.md with badges, stats, and module table |
| `renderLanguageIndex()` | Per-language index grouped by module kind |
| `renderModule()` | Full module page: header, badges, generics, inheritance, members TOC, detailed members, coverage |
| `renderMember()` | Individual member: signature, params table, returns, throws, collapsible examples |
| `renderADRIndex()` | ADR listing table with status emoji and links |
| `renderADR()` | Individual ADR page: status, context, decision, consequences |
| `renderChangelog()` | Keep a Changelog format with sectioned entries |
| `renderCoverageReport()` | Coverage breakdown table with check marks and progress bar |
| `groupByLanguage()` | Groups ModuleNode[] by language |
| `formatLanguageName()` | Maps language codes to display names |
| `pluralize()` | Maps ModuleKind to plural display names |
| `coverageBadge()` | Generates shields.io badge markdown for coverage score |
| `coverageBar()` | Generates ASCII progress bar (block characters) |

---

## Package: `@docgen/cli` (v1.0.0)

**Description:** CLI interface for DocGen documentation generator
**Entry Point:** `dist/index.js`
**Binary:** `docgen` → `dist/index.js`
**Dependencies:** @docgen/core workspace:*, commander ^12.0.0, inquirer ^9.2.0, chalk ^4.1.2, ora ^5.4.1
**Source Files:** 7

### File: `src/index.ts` (57 lines)

| Export | Kind | Details |
|--------|------|---------|
| (CLI setup) | Commander.js | Registers 5 commands: `init`, `generate`, `validate`, `diff`, `adr` |

#### CLI Commands

| Command | Options | Description |
|---------|---------|-------------|
| `docgen init` | `--force` | Initialize `.docgen.yaml` in current project |
| `docgen generate` | `-f, --format`, `-o, --output`, `--json`, `-v, --verbose`, `-w, --watch` | Generate documentation from source code |
| `docgen validate` | `--json`, `--threshold <number>`, `-v, --verbose` | Validate documentation coverage |
| `docgen diff` | `--base <ref>`, `--json` | Show documentation changes since last generation |
| `docgen adr <action> [title]` | `-s, --status` | Manage Architecture Decision Records |

### File: `src/commands/init.ts` (116 lines)

| Export | Kind | Details |
|--------|------|---------|
| `initCommand()` | Function | `(options: InitOptions) => Promise<void>` |

Internal functions: `detectLanguages()`, `hasFilesWithExtension()`

### File: `src/commands/generate.ts` (118 lines)

| Export | Kind | Details |
|--------|------|---------|
| `generateCommand()` | Function | `(options: GenerateOptions) => Promise<void>` |

Internal functions: `getOutputDir()`, `outputJson()`, `outputHuman()`

### File: `src/commands/validate.ts` (90 lines)

| Export | Kind | Details |
|--------|------|---------|
| `validateCommand()` | Function | `(options: ValidateOptions) => Promise<void>` |

Internal function: `outputHumanValidation()`

### File: `src/commands/diff.ts` (17 lines)

| Export | Kind | Details |
|--------|------|---------|
| `diffCommand()` | Function | `(options: DiffOptions) => Promise<void>` — Stub (Phase 2 implementation) |

### File: `src/commands/adr.ts` (114 lines)

| Export | Kind | Details |
|--------|------|---------|
| `adrCommand()` | Function | `(action: string, title: string \| undefined, options: AdrOptions) => Promise<void>` |

Internal functions: `createAdr()`, `listAdrs()`

### File: `src/reporters/index.ts` (82 lines)

| Export | Kind | Details |
|--------|------|---------|
| `Reporter` | Interface | Method: `report(result: PipelineResult): void` |
| `GitHubActionsReporter` | Class (implements Reporter) | Outputs GitHub Actions annotations, step summary, and output variables |
| `JsonReporter` | Class (implements Reporter) | Outputs pipeline results as structured JSON |

---

## Totals

| Category | Count |
|----------|-------|
| Interfaces | 28 |
| Type Aliases | 9 |
| Classes | 6 (`Orchestrator`, `CoverageAnalyzer`, `LinkResolver`, `TypeScriptParser`, `MarkdownRenderer`, `PluginLoadError`, `ConfigError`, `GitHubActionsReporter`, `JsonReporter`) |
| Exported Functions | 9 (`createEmptyDocIR`, `createEmptyCoverage`, `validateDocIR`, `computeAggregateCoverage`, `isParserPlugin`, `isTransformerPlugin`, `isRendererPlugin`, `createConsoleLogger`, `loadPlugins`, `loadConfig`, `generateDefaultConfig`) |
| Zod Schemas | 2 (`DocIRSchema`, `DocGenConfigSchema`) |
| CLI Commands | 5 (`init`, `generate`, `validate`, `diff`, `adr`) |
| Total Public Methods | 30 |
| Total Private Methods | 44 |
| Total Source Lines | ~3,840 |
