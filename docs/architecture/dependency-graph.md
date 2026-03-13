# DocGen — Dependency Graph

> Analysis of all import relationships across the DocGen monorepo.

---

## 1. Package-Level Dependency Graph

```mermaid
graph TD
    CLI["@docgen/cli"]
    CORE["@docgen/core"]
    PARSER["@docgen/parser-typescript"]
    RENDERER["@docgen/renderer-markdown"]

    CLI -->|"workspace:*"| CORE
    PARSER -->|"workspace:*"| CORE
    RENDERER -->|"1.0.0"| CORE

    CLI -.->|"runtime via plugin loader"| PARSER
    CLI -.->|"runtime via plugin loader"| RENDERER

    style CORE fill:#2196F3,color:#fff
    style CLI fill:#4CAF50,color:#fff
    style PARSER fill:#FF9800,color:#fff
    style RENDERER fill:#9C27B0,color:#fff
```

**Key:** Solid arrows = compile-time dependency. Dashed arrows = runtime (dynamic plugin loading).

### Package Dependency Table

| Package | Depends On | Dependency Type |
|---------|-----------|-----------------|
| `@docgen/cli` | `@docgen/core` | Compile-time (workspace:*) |
| `@docgen/parser-typescript` | `@docgen/core` | Compile-time (workspace:*) |
| `@docgen/renderer-markdown` | `@docgen/core` | Compile-time (1.0.0) |
| `@docgen/core` | — | No internal dependencies |

### External Dependencies by Package

| Package | External Deps |
|---------|--------------|
| `@docgen/core` | zod, yaml, glob, chalk, fast-glob |
| `@docgen/cli` | commander, inquirer, chalk, ora |
| `@docgen/parser-typescript` | ts-morph |
| `@docgen/renderer-markdown` | (none beyond @docgen/core) |

---

## 2. File-Level Dependency Graph per Package

### @docgen/core — Internal Imports

```mermaid
graph TD
    subgraph "@docgen/core"
        INDEX["src/index.ts"]
        ORCH["src/orchestrator.ts"]
        DIR_TYPES["src/docir/types.ts"]
        DIR_VALID["src/docir/validator.ts"]
        DIR_IDX["src/docir/index.ts"]
        PLG_TYPES["src/plugin/types.ts"]
        PLG_LOADER["src/plugin/loader.ts"]
        PLG_IDX["src/plugin/index.ts"]
        CFG_SCHEMA["src/config/schema.ts"]
        CFG_IDX["src/config/index.ts"]
        TRF_COV["src/transforms/coverage-analyzer.ts"]
        TRF_LINK["src/transforms/link-resolver.ts"]
        TRF_IDX["src/transforms/index.ts"]
    end

    INDEX --> DIR_IDX
    INDEX --> PLG_IDX
    INDEX --> CFG_IDX
    INDEX --> TRF_IDX
    INDEX --> ORCH

    DIR_IDX --> DIR_TYPES
    DIR_IDX --> DIR_VALID

    DIR_VALID -->|"type-only"| DIR_TYPES

    PLG_IDX --> PLG_TYPES
    PLG_IDX --> PLG_LOADER

    PLG_TYPES -->|"type-only"| DIR_TYPES
    PLG_TYPES -->|"type-only"| CFG_SCHEMA
    PLG_LOADER --> PLG_TYPES

    CFG_IDX --> CFG_SCHEMA

    TRF_IDX --> TRF_COV
    TRF_IDX --> TRF_LINK
    TRF_COV -->|"type-only"| DIR_TYPES
    TRF_COV -->|"type-only"| PLG_TYPES
    TRF_LINK -->|"type-only"| DIR_TYPES
    TRF_LINK -->|"type-only"| PLG_TYPES

    ORCH --> DIR_TYPES
    ORCH --> DIR_VALID
    ORCH -->|"type-only"| CFG_SCHEMA
    ORCH -->|"type-only"| PLG_TYPES
    ORCH --> PLG_LOADER
    ORCH --> TRF_COV
    ORCH --> TRF_LINK
```

#### Detailed Import Edges — @docgen/core

| From | To | Imports | Type-Only? |
|------|-----|---------|------------|
| `orchestrator.ts` | `docir/types.ts` | `DocIR`, `createEmptyDocIR` | Mixed (type + runtime) |
| `orchestrator.ts` | `docir/validator.ts` | `validateDocIR`, `computeAggregateCoverage` | Runtime |
| `orchestrator.ts` | `config/schema.ts` | `DocGenConfig`, `LanguageConfig` | Type-only |
| `orchestrator.ts` | `plugin/types.ts` | `PluginConfig`, `Logger`, `OutputArtifact` | Type-only |
| `orchestrator.ts` | `plugin/loader.ts` | `loadPlugins`, `PluginRegistry` | Mixed |
| `orchestrator.ts` | `transforms/coverage-analyzer.ts` | `CoverageAnalyzer` | Runtime |
| `orchestrator.ts` | `transforms/link-resolver.ts` | `LinkResolver` | Runtime |
| `plugin/types.ts` | `docir/types.ts` | `DocIR`, `SupportedLanguage` | Type-only |
| `plugin/types.ts` | `config/schema.ts` | `DocGenConfig`, `LanguageConfig`, `OutputConfig` | Type-only |
| `plugin/loader.ts` | `plugin/types.ts` | `DocGenPlugin`, `ParserPlugin`, `RendererPlugin`, `TransformerPlugin`, `Logger`, `isParserPlugin`, `isRendererPlugin`, `isTransformerPlugin` | Mixed |
| `docir/validator.ts` | `docir/types.ts` | `DocIR`, `CoverageScore`, `ModuleNode` | Type-only |
| `transforms/coverage-analyzer.ts` | `docir/types.ts` | `DocIR`, `ModuleNode`, `MemberNode`, `CoverageScore` | Type-only |
| `transforms/coverage-analyzer.ts` | `plugin/types.ts` | `TransformerPlugin`, `PluginConfig`, `PluginValidationResult` | Type-only |
| `transforms/link-resolver.ts` | `docir/types.ts` | `DocIR`, `TypeRef` | Type-only |
| `transforms/link-resolver.ts` | `plugin/types.ts` | `TransformerPlugin`, `PluginConfig`, `PluginValidationResult` | Type-only |

### @docgen/cli — Internal Imports

```mermaid
graph TD
    subgraph "@docgen/cli"
        CLI_IDX["src/index.ts"]
        CMD_INIT["src/commands/init.ts"]
        CMD_GEN["src/commands/generate.ts"]
        CMD_VAL["src/commands/validate.ts"]
        CMD_DIFF["src/commands/diff.ts"]
        CMD_ADR["src/commands/adr.ts"]
        RPT_IDX["src/reporters/index.ts"]
    end

    CLI_IDX --> CMD_INIT
    CLI_IDX --> CMD_GEN
    CLI_IDX --> CMD_VAL
    CLI_IDX --> CMD_DIFF
    CLI_IDX --> CMD_ADR

    CMD_INIT -->|"@docgen/core"| CORE_EXT["@docgen/core"]
    CMD_GEN -->|"@docgen/core"| CORE_EXT
    CMD_VAL -->|"@docgen/core"| CORE_EXT
    CMD_ADR -->|"@docgen/core"| CORE_EXT
    RPT_IDX -->|"@docgen/core"| CORE_EXT
```

#### Detailed Import Edges — @docgen/cli

| From | To | Imports |
|------|-----|---------|
| `index.ts` | `commands/init.ts` | `initCommand` |
| `index.ts` | `commands/generate.ts` | `generateCommand` |
| `index.ts` | `commands/validate.ts` | `validateCommand` |
| `index.ts` | `commands/diff.ts` | `diffCommand` |
| `index.ts` | `commands/adr.ts` | `adrCommand` |
| `commands/init.ts` | `@docgen/core` | `generateDefaultConfig` |
| `commands/generate.ts` | `@docgen/core` | `loadConfig`, `Orchestrator`, `createConsoleLogger`, `GenerateResult` (type) |
| `commands/validate.ts` | `@docgen/core` | `loadConfig`, `Orchestrator`, `createConsoleLogger`, `ValidateResult` (type) |
| `commands/adr.ts` | `@docgen/core` | `loadConfig` |
| `reporters/index.ts` | `@docgen/core` | `PipelineResult` (type) |

### @docgen/parser-typescript — Imports

| From | To | Imports |
|------|-----|---------|
| `index.ts` | `@docgen/core` | `ParserPlugin`, `ParserInput`, `ParserOutput`, `ParseError`, `ParseStats`, `PluginManifest`, `PluginConfig`, `PluginValidationResult`, `ModuleNode`, `MemberNode`, `MemberKind`, `Visibility`, `ParamNode`, `TypeRef`, `ThrowsNode`, `DocTag`, `DecoratorNode`, `CodeExample`, `GenericParam`, `DependencyRef`, `createEmptyCoverage` |
| `index.ts` | `ts-morph` | `Project`, `SourceFile`, `ClassDeclaration`, `InterfaceDeclaration`, `FunctionDeclaration`, `EnumDeclaration`, `TypeAliasDeclaration`, `MethodDeclaration`, `PropertyDeclaration`, `ConstructorDeclaration`, `ParameterDeclaration`, `GetAccessorDeclaration`, `SetAccessorDeclaration`, `JSDoc`, `JSDocTag`, `Type`, `Scope`, `SyntaxKind`, `Node` |
| `index.ts` | `fast-glob` | default import `fg` |

### @docgen/renderer-markdown — Imports

| From | To | Imports |
|------|-----|---------|
| `index.ts` | `@docgen/core` | `RendererPlugin`, `RendererOutput`, `OutputFile`, `PluginManifest`, `PluginConfig`, `PluginValidationResult`, `DocIR`, `ModuleNode`, `MemberNode`, `CoverageScore` |

---

## 3. Circular Dependencies

**None detected.** The dependency graph is a clean DAG (directed acyclic graph):

```
@docgen/core ← @docgen/parser-typescript
@docgen/core ← @docgen/renderer-markdown
@docgen/core ← @docgen/cli
```

Within `@docgen/core`, all imports flow in one direction:
- `docir/types.ts` is the leaf (no internal imports)
- `docir/validator.ts` depends only on `docir/types.ts`
- `plugin/types.ts` depends on `docir/types.ts` and `config/schema.ts`
- `plugin/loader.ts` depends on `plugin/types.ts`
- `transforms/*` depend on `docir/types.ts` and `plugin/types.ts`
- `orchestrator.ts` depends on all submodules (top of the tree)
- `index.ts` re-exports everything

---

## 4. Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                       @docgen/cli                           │
│  ┌──────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ ┌─────┐     │
│  │ init │ │ generate │ │ validate │ │ diff │ │ adr │     │
│  └───┬──┘ └────┬─────┘ └────┬─────┘ └──┬───┘ └──┬──┘     │
│      └──────────┴────────────┴──────────┴────────┘         │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │      @docgen/core       │
              │  ┌───────────────────┐  │
              │  │   Orchestrator    │  │
              │  │ (parse→transform  │  │
              │  │    →render)       │  │
              │  └─────────┬────────┘  │
              │            │            │
              │  ┌─────────▼────────┐  │
              │  │ Plugin Registry  │  │
              │  │ (loader.ts)      │  │
              │  └─────────┬────────┘  │
              │            │            │
              │  ┌─────────▼────────┐  │
              │  │    DocIR Types   │  │
              │  │ (types.ts)       │  │
              │  └──────────────────┘  │
              │                        │
              │  ┌──────────────────┐  │
              │  │  Config Schema   │  │
              │  │ (schema.ts)      │  │
              │  └──────────────────┘  │
              │                        │
              │  ┌──────────────────┐  │
              │  │   Transforms     │  │
              │  │ • CoverageAnalyzer│ │
              │  │ • LinkResolver   │  │
              │  └──────────────────┘  │
              └───────┬────────┬───────┘
                      │        │
         ┌────────────▼─┐  ┌──▼────────────────┐
         │ @docgen/      │  │ @docgen/           │
         │ parser-       │  │ renderer-          │
         │ typescript    │  │ markdown           │
         │ (ts-morph)    │  │ (GFM output)       │
         └───────────────┘  └────────────────────┘
```
