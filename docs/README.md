# DocGen — Documentation Hub

> Complete technical documentation for the DocGen universal documentation generator.

**Total:** 17 documents | 15,355+ lines | 100% source coverage

---

## Quick Navigation

### Inventory & Architecture
| Document | Description |
|----------|-------------|
| [Codebase Inventory](inventory/CODEBASE_INVENTORY.md) | Every exported symbol across all 22 source files |
| [Dependency Graph](architecture/dependency-graph.md) | Package and file-level import relationships with Mermaid diagrams |

### Package Technical References (Phase 1)
| Document | Package | Lines |
|----------|---------|-------|
| [Core](technical/core.md) | `@docgen/core` | 2,283 |
| [TypeScript Parser](technical/parser-typescript.md) | `@docgen/parser-typescript` | 1,301 |
| [Markdown Renderer](technical/renderer-markdown.md) | `@docgen/renderer-markdown` | 1,305 |
| [CLI](technical/cli.md) | `@docgen/cli` | 778 |

### Specifications & References (Phase 2)
| Document | Description |
|----------|-------------|
| [DocIR Specification](specifications/docir-spec.md) | Complete IR type reference with JSON examples |
| [Plugin Development Guide](guides/plugin-development.md) | Build parser, transformer, and renderer plugins |
| [Configuration Reference](reference/configuration.md) | Every `.docgen.yaml` field documented |

### Function-Level API Docs (Phase 3)
| Document | Coverage |
|----------|----------|
| [Core API](api/core-api.md) | All 11 exported functions, 6 class methods |
| [Parser API](api/parser-typescript-api.md) | 5 public + 24 private methods |
| [Renderer API](api/renderer-markdown-api.md) | 5 public + 14 private methods |
| [CLI API](api/cli-api.md) | 5 commands + 2 reporters |

### Guides & Cross-Cutting (Phase 4)
| Document | Description |
|----------|-------------|
| [Data Flow Walkthrough](guides/data-flow-walkthrough.md) | End-to-end trace with concrete JSON at every pipeline step |
| [CI/CD Integration](guides/ci-cd-integration.md) | GitHub Actions, GitLab CI, Jenkins, Azure DevOps configs |
| [Error Catalog](reference/error-catalog.md) | 17 error codes with triggers, messages, and fixes |

### Audit (Phase 6)
| Document | Description |
|----------|-------------|
| [Audit Report](AUDIT.md) | Cross-check: 100% source and symbol coverage verified |

---

## Directory Structure

```
docs/
├── README.md                          ← You are here
├── AUDIT.md                           ← Documentation audit report
├── inventory/
│   └── CODEBASE_INVENTORY.md          ← Complete symbol inventory
├── architecture/
│   └── dependency-graph.md            ← Import relationships + Mermaid
├── technical/
│   ├── core.md                        ← @docgen/core deep reference
│   ├── parser-typescript.md           ← @docgen/parser-typescript reference
│   ├── renderer-markdown.md           ← @docgen/renderer-markdown reference
│   └── cli.md                         ← @docgen/cli reference
├── specifications/
│   └── docir-spec.md                  ← DocIR type specification
├── api/
│   ├── core-api.md                    ← Function-level: core
│   ├── parser-typescript-api.md       ← Function-level: parser
│   ├── renderer-markdown-api.md       ← Function-level: renderer
│   └── cli-api.md                     ← Function-level: CLI
├── guides/
│   ├── plugin-development.md          ← Build custom plugins
│   ├── data-flow-walkthrough.md       ← End-to-end pipeline trace
│   └── ci-cd-integration.md           ← CI/CD setup guides
└── reference/
    ├── configuration.md               ← .docgen.yaml field reference
    └── error-catalog.md               ← All error codes + fixes
```
