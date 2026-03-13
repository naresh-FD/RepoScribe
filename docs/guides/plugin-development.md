# Plugin Development Guide

This guide covers everything you need to build, test, and publish custom plugins for DocGen. It is based on the actual interfaces defined in `@docgen/core` and the patterns used by the built-in TypeScript parser, Markdown renderer, and built-in transformers.

---

## 1. Plugin Architecture Overview

DocGen uses a **plugin-based pipeline** with three stages:

```
Parse  ──►  Transform  ──►  Render
```

Each stage is handled by a dedicated plugin type:

| Plugin Type   | Responsibility                                      | Registry Key         |
|---------------|-----------------------------------------------------|----------------------|
| **Parser**    | Read source files and produce DocIR modules         | `parsers` (by language) |
| **Transformer** | Enrich or modify the DocIR between parse and render | `transformers` (sorted by priority) |
| **Renderer**  | Consume DocIR and produce output files              | `renderers` (by format) |

### The DocGenPlugin Base Interface

Every plugin must implement the `DocGenPlugin` base interface:

```typescript
interface DocGenPlugin {
  /** Unique plugin identifier (e.g., "@docgen/parser-typescript") */
  readonly name: string;
  /** SemVer version string */
  readonly version: string;
  /** Plugin category: "parser" | "transformer" | "renderer" */
  readonly type: PluginType;
  /** What this plugin handles (e.g., ["typescript", "tsx"]) */
  readonly supports: string[];

  /** Initialize with resolved configuration */
  initialize(config: PluginConfig): Promise<void>;
  /** Self-check: verify dependencies, permissions, etc. */
  validate(): Promise<PluginValidationResult>;
  /** Clean up resources */
  cleanup(): Promise<void>;
}
```

### Plugin Lifecycle

Every plugin goes through four phases in order:

1. **initialize(config)** -- receives the full project configuration, working directory, plugin-specific options, and a logger instance.
2. **validate()** -- performs a self-check (verifying dependencies exist, permissions are correct, required tools are installed, etc.). Returns `{ valid, errors, warnings }`.
3. **execute** -- the plugin performs its core work. The method name depends on the plugin type: `parse()` for parsers, `transform()` for transformers, `render()` for renderers.
4. **cleanup()** -- releases resources (AST projects, file handles, temporary files, etc.).

### Plugin Registry

The `PluginRegistry` holds all loaded plugins, organized by type:

```typescript
interface PluginRegistry {
  parsers: Map<string, ParserPlugin>;       // keyed by language name
  transformers: TransformerPlugin[];         // sorted by priority (ascending)
  renderers: Map<string, RendererPlugin>;    // keyed by output format
}
```

Parsers are looked up by language (e.g., `"typescript"`), renderers by format (e.g., `"markdown"`), and transformers run sequentially in priority order.

---

## 2. Plugin Types

### ParserPlugin

Parser plugins read source code files and produce DocIR module nodes.

```typescript
interface ParserPlugin extends DocGenPlugin {
  readonly type: "parser";
  readonly language: SupportedLanguage;

  /**
   * Parse source files and produce module nodes.
   * @param files - Array of absolute file paths (already filtered by include/exclude)
   * @param langConfig - Language-specific configuration from .docgen.yaml
   * @returns Partial DocIR with populated modules array
   */
  parse(files: string[], langConfig: LanguageConfig): Promise<DocIR>;
}
```

**Key details:**

- The `language` field must be one of the `SupportedLanguage` values (`"java"`, `"typescript"`, `"python"`).
- The `files` array is pre-filtered by the orchestrator based on the `include` and `exclude` glob patterns in the language config.
- The returned `DocIR` should contain the `modules` array populated with `ModuleNode` entries. It may also populate `adrs` and `changelog` if the parser discovers those.

### TransformerPlugin

Transformer plugins enrich or modify the DocIR between the parse and render stages.

```typescript
interface TransformerPlugin extends DocGenPlugin {
  readonly type: "transformer";
  /** Execution order (lower = earlier). Default: 100 */
  readonly priority: number;

  /**
   * Transform the DocIR in place or return a new one.
   * @param docir - Current state of the DocIR
   * @returns Modified DocIR
   */
  transform(docir: DocIR): Promise<DocIR>;
}
```

**Key details:**

- The `priority` field controls execution order. Lower values run first.
- Built-in transformers use these priorities:
  - `CoverageAnalyzer`: priority **50** (runs early so other transforms can use coverage data)
  - `LinkResolver`: priority **100** (runs after coverage is computed)
- Custom transformers can use any priority value. Use values below 50 to run before the built-in coverage analyzer, or values above 100 to run after all built-in transforms.

### RendererPlugin

Renderer plugins consume the fully transformed DocIR and produce output files.

```typescript
interface RendererPlugin extends DocGenPlugin {
  readonly type: "renderer";
  /** Output format identifier (e.g., "markdown", "html", "pdf") */
  readonly format: string;

  /**
   * Render the DocIR to output files.
   * @param docir - Fully transformed DocIR
   * @param outputConfig - Format-specific output configuration
   * @returns Array of generated output artifacts
   */
  render(docir: DocIR, outputConfig: OutputConfig): Promise<OutputArtifact[]>;
}
```

**OutputArtifact structure:**

```typescript
interface OutputArtifact {
  /** Relative path from output directory */
  filePath: string;
  /** File content (string for text, Buffer for binary) */
  content: string | Buffer;
  /** MIME type */
  mimeType: string;
  /** Size in bytes */
  size: number;
  /** Generation metadata */
  metadata: {
    generatedAt: string;
    sourceModules: string[];
    format: string;
  };
}
```

---

## 3. Plugin Lifecycle

The orchestrator manages the full lifecycle of every plugin. Here is the exact sequence, as implemented in the `Orchestrator` class:

### Initialization

```typescript
await plugin.initialize({
  projectConfig: config,   // Full resolved DocGenConfig
  workDir: "/repo/root",   // Absolute path to the repository root
  options: langConfig.options, // Plugin-specific options from .docgen.yaml
  logger: logger,           // Logger instance with debug/info/warn/error/success
});
```

The `PluginConfig` interface:

```typescript
interface PluginConfig {
  projectConfig: DocGenConfig;
  workDir: string;
  options: Record<string, unknown>;
  logger: Logger;
}
```

The `Logger` interface provides five methods:

```typescript
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  success(message: string, ...args: unknown[]): void;
}
```

### Validation

```typescript
const result = await plugin.validate();
// result: { valid: boolean, errors: string[], warnings: string[] }
```

Use this phase to check that required external tools are installed, permissions are correct, or configuration values are valid.

### Execution

The orchestrator calls the type-specific method:

- **Parsers:** `await parser.parse(files, langConfig)` -- called once per configured language.
- **Transformers:** `await transformer.transform(docir)` -- called in priority order, each receiving the output of the previous transformer.
- **Renderers:** `await renderer.render(docir, outputConfig)` -- called once per enabled output format.

### Cleanup

```typescript
await plugin.cleanup();
```

Called after execution completes. Release any held resources: AST projects, open file handles, temporary directories, network connections.

---

## 4. Step-by-Step: Building a Parser Plugin

This section walks through building a parser plugin, using the TypeScript parser as a reference for patterns.

### 4.1 Implement the ParserPlugin Interface

```typescript
import {
  ParserPlugin,
  PluginConfig,
  PluginValidationResult,
  DocIR,
  ModuleNode,
  createEmptyDocIR,
} from "@docgen/core";
import type { LanguageConfig } from "@docgen/core";

export class GoParser implements ParserPlugin {
  readonly name = "@myorg/parser-go";
  readonly version = "1.0.0";
  readonly type = "parser" as const;
  readonly language = "go" as any; // Custom language
  readonly supports = ["go", "golang"];

  private config: PluginConfig | null = null;

  async initialize(config: PluginConfig): Promise<void> {
    this.config = config;
    config.logger.info("Go parser initialized");
  }

  async validate(): Promise<PluginValidationResult> {
    // Check that the Go toolchain is available
    try {
      // ... check for `go` binary on PATH
      return { valid: true, errors: [], warnings: [] };
    } catch {
      return {
        valid: false,
        errors: ["Go toolchain not found. Install Go from https://go.dev"],
        warnings: [],
      };
    }
  }

  async cleanup(): Promise<void> {
    this.config = null;
  }

  async parse(files: string[], langConfig: LanguageConfig): Promise<DocIR> {
    // Implementation below...
  }
}

export default GoParser;
```

### 4.2 File Discovery Using fast-glob

The orchestrator provides pre-filtered file paths based on the `include`/`exclude` patterns from `.docgen.yaml`. However, if your parser needs additional file discovery (e.g., finding related test files), use `fast-glob`:

```typescript
import fg from "fast-glob";
import * as path from "path";

// Inside the parse() method:
const patterns = langConfig.include.map((p) =>
  path.join(langConfig.source, p)
);
const ignorePatterns = langConfig.exclude.map((p) =>
  path.join(langConfig.source, p)
);

const files = await fg(patterns, {
  ignore: ignorePatterns,
  absolute: true,
  onlyFiles: true,
});
```

### 4.3 AST Walking Strategy

The general strategy for any parser plugin:

1. Create or initialize a language-specific AST tool (e.g., `ts-morph` for TypeScript, `tree-sitter` for multi-language support).
2. Walk top-level declarations in each file.
3. For each declaration, extract: name, kind, description (from comments), members, parameters, return types, decorators, and generics.
4. Map everything into DocIR `ModuleNode` and `MemberNode` structures.

### 4.4 Mapping to DocIR ModuleNodes

Every parsed declaration becomes a `ModuleNode`:

```typescript
const moduleNode: ModuleNode = {
  id: "pkg/handler.RequestHandler",     // Fully qualified identifier
  name: "RequestHandler",               // Short name
  filePath: "pkg/handler/handler.go",   // Relative to source root
  language: "go",
  kind: "class",                        // "class" | "interface" | "enum" | etc.
  description: "Handles incoming HTTP requests.",
  tags: [],                             // Extracted doc tags
  members: [],                          // Methods, properties, fields
  dependencies: [],                     // Inheritance, imports, injections
  examples: [],                         // Code examples from doc comments
  coverage: createEmptyCoverage(),      // Populated later by CoverageAnalyzer
  decorators: [],                       // Annotations/decorators
  typeParameters: [],                   // Generic type parameters
  extends: "BaseHandler",              // Parent class/struct, if any
  implements: ["http.Handler"],         // Implemented interfaces
  exported: true,                       // Whether publicly exported
};
```

Each member (method, property, field) becomes a `MemberNode`:

```typescript
const memberNode: MemberNode = {
  name: "HandleRequest",
  kind: "method",
  visibility: "public",                 // "public" | "protected" | "private" | "internal"
  isStatic: false,
  isAsync: false,
  isAbstract: false,
  signature: "func (h *RequestHandler) HandleRequest(w http.ResponseWriter, r *http.Request) error",
  description: "Processes a single HTTP request.",
  parameters: [
    {
      name: "w",
      type: { name: "http.ResponseWriter", raw: "http.ResponseWriter" },
      description: "The response writer",
      isOptional: false,
      isRest: false,
    },
    {
      name: "r",
      type: { name: "*http.Request", raw: "*http.Request" },
      description: "The incoming request",
      isOptional: false,
      isRest: false,
    },
  ],
  returnType: { name: "error", raw: "error" },
  throws: [
    { type: "ErrTimeout", description: "When the request exceeds the deadline" },
  ],
  deprecated: null,
  tags: [],
  examples: [],
  decorators: [],
  lineNumber: 42,
};
```

### 4.5 Error Handling

Parser plugins should collect errors rather than throwing. Accumulate parse errors in an array and include them in the output. This allows the pipeline to continue and report all issues at once:

```typescript
async parse(files: string[], langConfig: LanguageConfig): Promise<DocIR> {
  const modules: ModuleNode[] = [];
  const errors: ParseError[] = [];

  for (const file of files) {
    try {
      const fileModules = this.parseFile(file);
      modules.push(...fileModules);
    } catch (err: any) {
      // Collect the error, do not throw
      errors.push({
        filePath: path.relative(langConfig.source, file),
        line: 0,
        column: 0,
        message: `Failed to parse: ${err.message}`,
        severity: "error",
      });
    }
  }

  // Return a DocIR with populated modules
  const docir = createEmptyDocIR({
    name: this.config!.projectConfig.project.name,
    version: this.config!.projectConfig.project.version,
    languages: [langConfig.name],
  });
  docir.modules = modules;

  return docir;
}
```

### 4.6 Full Working Example: Minimal Go Parser

```typescript
import * as path from "path";
import * as fs from "fs";
import fg from "fast-glob";
import {
  ParserPlugin,
  PluginConfig,
  PluginValidationResult,
  DocIR,
  ModuleNode,
  MemberNode,
  createEmptyDocIR,
  createEmptyCoverage,
} from "@docgen/core";
import type { LanguageConfig } from "@docgen/core";

export class GoParser implements ParserPlugin {
  readonly name = "@myorg/parser-go";
  readonly version = "0.1.0";
  readonly type = "parser" as const;
  readonly language = "go" as any;
  readonly supports = ["go"];

  private logger: PluginConfig["logger"] | null = null;

  async initialize(config: PluginConfig): Promise<void> {
    this.logger = config.logger;
  }

  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }

  async cleanup(): Promise<void> {
    this.logger = null;
  }

  async parse(files: string[], langConfig: LanguageConfig): Promise<DocIR> {
    const modules: ModuleNode[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const relativePath = path.relative(langConfig.source, file);

        // Extract exported functions (simplified regex-based approach)
        const funcRegex = /\/\/\s*(.*)\nfunc\s+(\w+)\((.*?)\)\s*(.*?)\s*\{/g;
        let match: RegExpExecArray | null;

        while ((match = funcRegex.exec(content)) !== null) {
          const [, comment, funcName, params, returnType] = match;

          if (funcName[0] !== funcName[0].toUpperCase()) continue; // Skip unexported

          const memberNode: MemberNode = {
            name: funcName,
            kind: "method",
            visibility: "public",
            isStatic: false,
            isAsync: false,
            isAbstract: false,
            signature: `func ${funcName}(${params}) ${returnType}`.trim(),
            description: comment?.trim() || "",
            parameters: params
              .split(",")
              .filter(Boolean)
              .map((p) => {
                const parts = p.trim().split(/\s+/);
                return {
                  name: parts[0],
                  type: { name: parts.slice(1).join(" "), raw: parts.slice(1).join(" ") },
                  description: "",
                  isOptional: false,
                  isRest: false,
                };
              }),
            returnType: returnType ? { name: returnType.trim(), raw: returnType.trim() } : null,
            throws: [],
            deprecated: null,
            tags: [],
            examples: [],
            decorators: [],
            lineNumber: content.substring(0, match.index).split("\n").length,
          };

          // Create a module per exported function
          modules.push({
            id: `${relativePath.replace(/\.go$/, "").replace(/[/\\]/g, ".")}.${funcName}`,
            name: funcName,
            filePath: relativePath,
            language: "go" as any,
            kind: "function",
            description: comment?.trim() || "",
            tags: [],
            members: [memberNode],
            dependencies: [],
            examples: [],
            coverage: createEmptyCoverage(),
            decorators: [],
            typeParameters: [],
            exported: true,
          });
        }
      } catch (err: any) {
        this.logger?.error(`Failed to parse ${file}: ${err.message}`);
      }
    }

    const docir = createEmptyDocIR({
      name: "go-project",
      version: "1.0.0",
      languages: ["go" as any],
    });
    docir.modules = modules;

    return docir;
  }
}

export default GoParser;
```

---

## 5. Step-by-Step: Building a Transformer Plugin

### 5.1 Implement TransformerPlugin with Priority

```typescript
import type {
  TransformerPlugin,
  PluginConfig,
  PluginValidationResult,
  DocIR,
} from "@docgen/core";

export class TodoExtractor implements TransformerPlugin {
  readonly name = "@myorg/transform-todo-extractor";
  readonly version = "1.0.0";
  readonly type = "transformer" as const;
  readonly supports = ["*"];
  readonly priority = 75; // After CoverageAnalyzer (50), before LinkResolver (100)

  async initialize(_config: PluginConfig): Promise<void> {}

  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }

  async cleanup(): Promise<void> {}

  async transform(docir: DocIR): Promise<DocIR> {
    // Implementation below...
  }
}

export default TodoExtractor;
```

### 5.2 DocIR Mutation Patterns

Transformers should treat the DocIR as **immutable** -- use spread operators to create new objects rather than modifying existing ones directly. This prevents unexpected side effects when multiple transformers operate in sequence:

```typescript
// GOOD: Immutable pattern using spread
const updatedModules = docir.modules.map((mod) => ({
  ...mod,
  tags: [...mod.tags, newTag],
  members: mod.members.map((member) => ({
    ...member,
    tags: [...member.tags, newTag],
  })),
}));

return { ...docir, modules: updatedModules };
```

```typescript
// AVOID: Direct mutation
docir.modules[0].tags.push(newTag); // Mutates in place
return docir;
```

### 5.3 Full Working Example: Todo Extractor Transform

This transformer scans all module and member descriptions for TODO/FIXME comments and adds structured tags:

```typescript
import type {
  TransformerPlugin,
  PluginConfig,
  PluginValidationResult,
  DocIR,
  DocTag,
  MemberNode,
  ModuleNode,
} from "@docgen/core";

export class TodoExtractor implements TransformerPlugin {
  readonly name = "@myorg/transform-todo-extractor";
  readonly version = "1.0.0";
  readonly type = "transformer" as const;
  readonly supports = ["*"];
  readonly priority = 75;

  private patterns = [
    { regex: /TODO[:\s]+(.+)/gi, tag: "todo" },
    { regex: /FIXME[:\s]+(.+)/gi, tag: "fixme" },
    { regex: /HACK[:\s]+(.+)/gi, tag: "hack" },
  ];

  async initialize(_config: PluginConfig): Promise<void> {}
  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }
  async cleanup(): Promise<void> {}

  async transform(docir: DocIR): Promise<DocIR> {
    const updatedModules = docir.modules.map((mod) =>
      this.processModule(mod)
    );

    return { ...docir, modules: updatedModules };
  }

  private processModule(mod: ModuleNode): ModuleNode {
    const moduleTags = this.extractTodos(mod.description);
    const updatedMembers = mod.members.map((member) =>
      this.processMember(member)
    );

    return {
      ...mod,
      tags: [...mod.tags, ...moduleTags],
      members: updatedMembers,
    };
  }

  private processMember(member: MemberNode): MemberNode {
    const memberTags = this.extractTodos(member.description);
    if (memberTags.length === 0) return member;

    return {
      ...member,
      tags: [...member.tags, ...memberTags],
    };
  }

  private extractTodos(text: string): DocTag[] {
    const tags: DocTag[] = [];

    for (const pattern of this.patterns) {
      let match: RegExpExecArray | null;
      // Reset regex state for each text
      pattern.regex.lastIndex = 0;

      while ((match = pattern.regex.exec(text)) !== null) {
        tags.push({
          name: pattern.tag,
          value: match[1].trim(),
          raw: match[0],
        });
      }
    }

    return tags;
  }
}

export default TodoExtractor;
```

---

## 6. Step-by-Step: Building a Renderer Plugin

### 6.1 Implement RendererPlugin with Format

```typescript
import type {
  RendererPlugin,
  PluginConfig,
  PluginValidationResult,
  DocIR,
  OutputConfig,
  OutputArtifact,
} from "@docgen/core";

export class JsonRenderer implements RendererPlugin {
  readonly name = "@myorg/renderer-json";
  readonly version = "1.0.0";
  readonly type = "renderer" as const;
  readonly format = "json";
  readonly supports = ["json"];

  private prettyPrint = true;

  async initialize(config: PluginConfig): Promise<void> {
    if (typeof config.options.prettyPrint === "boolean") {
      this.prettyPrint = config.options.prettyPrint;
    }
  }

  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }

  async cleanup(): Promise<void> {}

  async render(docir: DocIR, outputConfig: OutputConfig): Promise<OutputArtifact[]> {
    // Implementation below...
  }
}

export default JsonRenderer;
```

### 6.2 OutputArtifact Generation

Each artifact represents a single output file. Populate all metadata fields:

```typescript
function createArtifact(
  filePath: string,
  content: string,
  sourceModules: string[],
  format: string
): OutputArtifact {
  return {
    filePath,
    content,
    mimeType: "application/json",
    size: Buffer.byteLength(content, "utf-8"),
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceModules,
      format,
    },
  };
}
```

### 6.3 Full Working Example: JSON Renderer

```typescript
import type {
  RendererPlugin,
  PluginConfig,
  PluginValidationResult,
  DocIR,
  OutputConfig,
  OutputArtifact,
} from "@docgen/core";

export class JsonRenderer implements RendererPlugin {
  readonly name = "@myorg/renderer-json";
  readonly version = "1.0.0";
  readonly type = "renderer" as const;
  readonly format = "json";
  readonly supports = ["json"];

  private prettyPrint = true;
  private splitPerModule = false;

  async initialize(config: PluginConfig): Promise<void> {
    if (typeof config.options.prettyPrint === "boolean") {
      this.prettyPrint = config.options.prettyPrint;
    }
    if (typeof config.options.splitPerModule === "boolean") {
      this.splitPerModule = config.options.splitPerModule;
    }
  }

  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }

  async cleanup(): Promise<void> {}

  async render(docir: DocIR, _outputConfig: OutputConfig): Promise<OutputArtifact[]> {
    const artifacts: OutputArtifact[] = [];
    const indent = this.prettyPrint ? 2 : undefined;

    if (this.splitPerModule) {
      // One JSON file per module
      for (const mod of docir.modules) {
        const content = JSON.stringify(mod, null, indent);
        artifacts.push({
          filePath: `${mod.language}/${mod.name}.json`,
          content,
          mimeType: "application/json",
          size: Buffer.byteLength(content, "utf-8"),
          metadata: {
            generatedAt: new Date().toISOString(),
            sourceModules: [mod.id],
            format: "json",
          },
        });
      }

      // Index file
      const index = {
        metadata: docir.metadata,
        modules: docir.modules.map((m) => ({
          id: m.id,
          name: m.name,
          language: m.language,
          kind: m.kind,
          file: `${m.language}/${m.name}.json`,
        })),
      };
      const indexContent = JSON.stringify(index, null, indent);
      artifacts.push({
        filePath: "index.json",
        content: indexContent,
        mimeType: "application/json",
        size: Buffer.byteLength(indexContent, "utf-8"),
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceModules: docir.modules.map((m) => m.id),
          format: "json",
        },
      });
    } else {
      // Single combined JSON file
      const content = JSON.stringify(docir, null, indent);
      artifacts.push({
        filePath: "api-docs.json",
        content,
        mimeType: "application/json",
        size: Buffer.byteLength(content, "utf-8"),
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceModules: docir.modules.map((m) => m.id),
          format: "json",
        },
      });
    }

    return artifacts;
  }
}

export default JsonRenderer;
```

---

## 7. Plugin Registration and Resolution

### loadPlugins() Resolution Order

When the orchestrator calls `loadPlugins()`, each plugin name is resolved using three strategies in order:

**1. Relative or absolute file paths** -- if the plugin name starts with `.` or `/`:

```yaml
# .docgen.yaml
plugins:
  - ./my-plugins/custom-parser.js
  - /opt/docgen-plugins/my-renderer.js
```

The path is resolved relative to the working directory.

**2. npm package resolution** -- uses `require.resolve()` to find an installed npm package:

```yaml
plugins:
  - "@myorg/parser-go"
  - docgen-renderer-json
```

**3. Plugin directories search** -- if npm resolution fails and `pluginDirs` are configured, each directory is searched:

```typescript
// The loader iterates through pluginDirs and tries to find the plugin
for (const dir of options.pluginDirs) {
  const resolved = path.join(dir, pluginName);
  return loadPluginFromPath(resolved);
}
```

If all three strategies fail, a `PluginLoadError` is thrown with a message suggesting the user install the package.

### registerPlugin() Categorization

After a plugin is resolved and instantiated, `registerPlugin()` uses the type guards to categorize it:

- **Parser plugins** are stored in `registry.parsers` keyed by `plugin.language`. If a parser for the same language is already registered, it is replaced with a warning.
- **Transformer plugins** are pushed onto `registry.transformers`. After all plugins are loaded, transformers are sorted by `priority` (ascending).
- **Renderer plugins** are stored in `registry.renderers` keyed by `plugin.format`. If a renderer for the same format is already registered, it is replaced with a warning.

### Built-in Transformer Registration

The orchestrator automatically registers two built-in transformers after loading external plugins:

```typescript
const coverageAnalyzer = new CoverageAnalyzer();  // priority: 50
const linkResolver = new LinkResolver();           // priority: 100

await coverageAnalyzer.initialize(pluginConfig);
await linkResolver.initialize(pluginConfig);

registry.transformers.push(coverageAnalyzer, linkResolver);
registry.transformers.sort((a, b) => a.priority - b.priority);
```

This means your custom transformers will be interleaved with the built-ins based on their priority values.

---

## 8. Plugin Configuration

### Options from .docgen.yaml

Plugin-specific options are passed through the `PluginConfig.options` field during initialization. These come from the language config or plugin-specific sections in `.docgen.yaml`:

```yaml
# .docgen.yaml
languages:
  - name: typescript
    source: src
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    parser: "@docgen/parser-typescript"
    options:
      strict: true
      skipPrivate: true
      maxDepth: 5
```

Inside your plugin's `initialize()`:

```typescript
async initialize(config: PluginConfig): Promise<void> {
  const strict = config.options.strict as boolean ?? false;
  const skipPrivate = config.options.skipPrivate as boolean ?? false;
  const maxDepth = config.options.maxDepth as number ?? 10;

  this.strict = strict;
  this.skipPrivate = skipPrivate;
  this.maxDepth = maxDepth;
}
```

### Config Validation Pattern

Validate options early in `initialize()` or `validate()` and report problems clearly:

```typescript
async validate(): Promise<PluginValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (this.maxDepth < 1) {
    errors.push("maxDepth must be at least 1");
  }
  if (this.maxDepth > 50) {
    warnings.push("maxDepth > 50 may cause performance issues");
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

---

## 9. Type Guards

DocGen provides runtime type guards for safely narrowing plugin types. These are used internally by the plugin loader and can also be used in your own code when working with the `DocGenPlugin` base type:

### isParserPlugin()

```typescript
function isParserPlugin(plugin: DocGenPlugin): plugin is ParserPlugin {
  return plugin.type === "parser" && "parse" in plugin;
}
```

### isTransformerPlugin()

```typescript
function isTransformerPlugin(plugin: DocGenPlugin): plugin is TransformerPlugin {
  return plugin.type === "transformer" && "transform" in plugin;
}
```

### isRendererPlugin()

```typescript
function isRendererPlugin(plugin: DocGenPlugin): plugin is RendererPlugin {
  return plugin.type === "renderer" && "render" in plugin;
}
```

### isValidPlugin() Runtime Check

The loader uses `isValidPlugin()` to verify that an exported object conforms to the `DocGenPlugin` interface at runtime. This checks for the presence of all required fields and methods:

```typescript
function isValidPlugin(obj: unknown): obj is DocGenPlugin {
  if (!obj || typeof obj !== "object") return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    typeof p.version === "string" &&
    typeof p.type === "string" &&
    Array.isArray(p.supports) &&
    typeof p.initialize === "function" &&
    typeof p.validate === "function" &&
    typeof p.cleanup === "function"
  );
}
```

This means your plugin must have all six of these properties to be recognized:

| Property      | Type       | Purpose                         |
|---------------|------------|---------------------------------|
| `name`        | `string`   | Unique plugin identifier        |
| `version`     | `string`   | SemVer version                  |
| `type`        | `string`   | `"parser"`, `"transformer"`, or `"renderer"` |
| `supports`    | `string[]` | What the plugin handles         |
| `initialize`  | `function` | Configuration hook              |
| `validate`    | `function` | Self-check hook                 |
| `cleanup`     | `function` | Resource release hook           |

---

## 10. Plugin Testing

### Unit Testing with Mock DocIR

Create a minimal DocIR fixture and pass it through your plugin in isolation:

```typescript
import { createEmptyDocIR, createEmptyCoverage } from "@docgen/core";
import { TodoExtractor } from "../src/index";

describe("TodoExtractor", () => {
  let transformer: TodoExtractor;

  beforeEach(async () => {
    transformer = new TodoExtractor();
    await transformer.initialize({
      projectConfig: {} as any,
      workDir: "/tmp/test",
      options: {},
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        success: () => {},
      },
    });
  });

  afterEach(async () => {
    await transformer.cleanup();
  });

  it("should extract TODO tags from module descriptions", async () => {
    const docir = createEmptyDocIR({
      name: "test",
      version: "1.0.0",
      languages: ["typescript"],
    });

    docir.modules = [
      {
        id: "test.MyClass",
        name: "MyClass",
        filePath: "src/my-class.ts",
        language: "typescript",
        kind: "class",
        description: "A test class. TODO: add serialization support",
        tags: [],
        members: [],
        dependencies: [],
        examples: [],
        coverage: createEmptyCoverage(),
        decorators: [],
        typeParameters: [],
        exported: true,
      },
    ];

    const result = await transformer.transform(docir);

    expect(result.modules[0].tags).toContainEqual(
      expect.objectContaining({
        name: "todo",
        value: "add serialization support",
      })
    );
  });

  it("should not modify modules without TODOs", async () => {
    const docir = createEmptyDocIR({
      name: "test",
      version: "1.0.0",
      languages: ["typescript"],
    });

    docir.modules = [
      {
        id: "test.CleanClass",
        name: "CleanClass",
        filePath: "src/clean.ts",
        language: "typescript",
        kind: "class",
        description: "A perfectly documented class.",
        tags: [],
        members: [],
        dependencies: [],
        examples: [],
        coverage: createEmptyCoverage(),
        decorators: [],
        typeParameters: [],
        exported: true,
      },
    ];

    const result = await transformer.transform(docir);

    expect(result.modules[0].tags).toHaveLength(0);
  });
});
```

### Integration Testing Patterns

For integration tests, run the full pipeline with your plugin included:

```typescript
import { Orchestrator } from "@docgen/core";
import { loadConfig } from "@docgen/core";

describe("GoParser integration", () => {
  it("should parse Go files through the full pipeline", async () => {
    const config = await loadConfig("./fixtures/.docgen.yaml");
    const orchestrator = new Orchestrator({
      config,
      workDir: "./fixtures",
      logger: createTestLogger(),
    });

    const result = await orchestrator.generate(["markdown"]);

    expect(result.docir.modules.length).toBeGreaterThan(0);
    expect(result.artifacts.length).toBeGreaterThan(0);
    expect(result.coverage.overall).toBeGreaterThanOrEqual(0);
  });
});
```

For parser plugins specifically, test with real source files in a fixtures directory:

```
tests/
  fixtures/
    .docgen.yaml
    src/
      handler.go
      service.go
  parser.test.ts
  integration.test.ts
```

---

## 11. Error Handling

### PluginLoadError Class

When plugin loading fails, the loader wraps the original error in a `PluginLoadError`:

```typescript
class PluginLoadError extends Error {
  constructor(
    public readonly pluginName: string,
    public readonly cause: Error
  ) {
    super(`Failed to load plugin "${pluginName}": ${cause.message}`);
    this.name = "PluginLoadError";
  }
}
```

This error includes both the plugin name and the original cause, making it straightforward to diagnose loading failures.

### How Errors Propagate Through the Pipeline

The pipeline handles errors at each stage:

1. **Plugin loading** -- if any plugin fails to load, a `PluginLoadError` is thrown and the pipeline halts. The error message includes the plugin name and the resolution strategy that was tried.

2. **Parsing** -- errors within individual files should be collected (not thrown) by the parser plugin. The orchestrator logs warnings for languages that have no registered parser and skips them. Fatal parser errors (e.g., unable to create the AST project) will bubble up as unhandled exceptions.

3. **Transformation** -- transformer errors propagate immediately. If a transformer throws, the pipeline halts. Design your transformers to handle edge cases gracefully and log warnings rather than throwing.

4. **Validation** -- after transformation, the orchestrator validates the DocIR. Validation errors are logged but do not halt the pipeline.

5. **Rendering** -- renderer errors propagate immediately. Each renderer is initialized, executed, and cleaned up independently.

**Best practice for plugin authors:** Use the provided logger to report non-fatal issues. Only throw when the error is unrecoverable:

```typescript
// Non-fatal: log and continue
this.logger.warn(`Skipping malformed JSDoc in ${filePath}:${line}`);

// Fatal: throw with context
throw new Error(
  `Cannot parse ${filePath}: AST initialization failed. ` +
  `Ensure the file is valid ${this.language} syntax.`
);
```

---

## 12. Publishing

### Package Naming Conventions

Follow these naming conventions so that DocGen users can discover your plugins:

| Plugin Type   | Naming Pattern                           | Examples                              |
|---------------|------------------------------------------|---------------------------------------|
| Parser        | `@<scope>/parser-<language>`             | `@docgen/parser-typescript`, `@myorg/parser-go` |
| Transformer   | `@<scope>/transform-<name>`             | `@docgen/transform-coverage`, `@myorg/transform-todo-extractor` |
| Renderer      | `@<scope>/renderer-<format>`             | `@docgen/renderer-markdown`, `@myorg/renderer-json` |

For unscoped packages, use the prefix `docgen-`:

```
docgen-parser-rust
docgen-renderer-asciidoc
docgen-transform-metrics
```

### Required Exports

The plugin loader supports two export styles:

**Default export (recommended):**

```typescript
export class MyPlugin implements ParserPlugin { /* ... */ }
export default MyPlugin;
```

**Named class/object export:**

```typescript
// The loader tries `mod.default ?? mod`
// If the export is a class (function), it calls `new PluginClass()`
// If the export is an object, it validates it against isValidPlugin()

module.exports = class MyPlugin implements ParserPlugin { /* ... */ };
```

Both of the following patterns work:

```typescript
// Class export (instantiated with `new`)
export default class MyPlugin implements ParserPlugin { /* ... */ }

// Object export (used directly, must pass isValidPlugin() check)
export default {
  name: "@myorg/parser-go",
  version: "1.0.0",
  type: "parser" as const,
  supports: ["go"],
  language: "go",
  initialize: async () => {},
  validate: async () => ({ valid: true, errors: [], warnings: [] }),
  cleanup: async () => {},
  parse: async (files, langConfig) => { /* ... */ },
};
```

### package.json Setup

```json
{
  "name": "@myorg/parser-go",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["docgen", "docgen-plugin", "docgen-parser", "go"],
  "peerDependencies": {
    "@docgen/core": "^1.0.0"
  }
}
```

List `@docgen/core` as a peer dependency so that your plugin uses the same version of the core types as the host project. Include `"docgen-plugin"` in your keywords array to make your plugin discoverable.
