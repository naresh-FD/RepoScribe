# Error Catalog

This document catalogs every error that DocGen can produce, organized by error class and subsystem. Each entry includes the error code, originating package, trigger condition, message template, severity, and guidance for resolution.

---

## Error Classes

### ConfigError (DOCGEN-1xxx)

Thrown by the configuration loader in `@docgen/core` when the `.docgen.yaml` file cannot be found, parsed, or validated.

#### DOCGEN-1001: No configuration file found

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-1001 |
| **Error class** | `ConfigError` |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/config/schema.ts` |
| **Function** | `loadConfig()` |
| **Condition** | `findConfigFile()` returns `null` -- none of `.docgen.yaml`, `.docgen.yml`, or `docgen.config.yaml` exist in the working directory or any ancestor directory. |
| **Message template** | `No configuration file found. Run "docgen init" to create one, or create .docgen.yaml manually.\nSearched: .docgen.yaml, .docgen.yml, docgen.config.yaml` |
| **Severity** | Fatal |
| **Fix** | Run `docgen init` to scaffold a default configuration file, or create `.docgen.yaml` manually in your project root. |

**Example scenario:**

```
$ cd /tmp/empty-project
$ docgen generate
ConfigError: No configuration file found. Run "docgen init" to create one, or create .docgen.yaml manually.
Searched: .docgen.yaml, .docgen.yml, docgen.config.yaml
```

---

#### DOCGEN-1002: Invalid YAML syntax

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-1002 |
| **Error class** | `ConfigError` |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/config/schema.ts` |
| **Function** | `loadConfig()` |
| **Condition** | `yaml.parse()` throws an exception because the configuration file contains malformed YAML. |
| **Message template** | `Invalid YAML in <configPath>: <parse error message>` |
| **Severity** | Fatal |
| **Fix** | Open the configuration file and correct the YAML syntax. Common issues include incorrect indentation, missing colons, or unquoted special characters. Use a YAML linter or validator to identify the exact problem. |

**Example scenario:**

```
$ docgen generate
ConfigError: Invalid YAML in /projects/myapp/.docgen.yaml: Unexpected token in YAML at line 5, column 3
```

---

#### DOCGEN-1003: Configuration validation failed

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-1003 |
| **Error class** | `ConfigError` |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/config/schema.ts` |
| **Function** | `loadConfig()` |
| **Condition** | `DocGenConfigSchema.safeParse()` fails -- the YAML is syntactically valid but does not conform to the Zod schema (e.g., missing required fields like `project.name`, empty `languages` array, invalid enum values). |
| **Message template** | `Configuration validation failed in <configPath>:\n  - <path>: <message>\n  - <path>: <message>` |
| **Severity** | Fatal |
| **Fix** | Review the listed validation issues. Each line shows the dotted path and what is wrong. Ensure all required fields are present (`project.name`, at least one entry in `languages` with `name`, `source`, and `parser`). Refer to the configuration reference for valid values. |

**Example scenario:**

```
$ docgen generate
ConfigError: Configuration validation failed in /projects/myapp/.docgen.yaml:
  - project.name: String must contain at least 1 character(s)
  - languages: Array must contain at least 1 element(s)
```

---

### PluginLoadError (DOCGEN-6xxx)

Thrown by the plugin loader in `@docgen/core` when a plugin cannot be resolved, loaded, or registered.

#### DOCGEN-6001: Failed to load plugin (general)

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-6001 |
| **Error class** | `PluginLoadError` |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/plugin/loader.ts` |
| **Function** | `loadPlugins()` |
| **Condition** | Any error is thrown during plugin resolution or registration. This is the outer catch that wraps the inner cause into a `PluginLoadError`. |
| **Message template** | `Failed to load plugin "<pluginName>": <cause.message>` |
| **Severity** | Fatal |
| **Fix** | Read the inner cause message. The plugin may not be installed, the path may be incorrect, the module may not export a valid plugin, or the plugin type may be unrecognized. See DOCGEN-6002 through DOCGEN-6004 for specific sub-causes. |

**Example scenario:**

```
$ docgen generate
PluginLoadError: Failed to load plugin "@docgen/parser-java": Cannot find module '@docgen/parser-java'
```

---

#### DOCGEN-6002: Plugin not found (resolution failed)

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-6002 |
| **Error class** | `Error` (wrapped by `PluginLoadError`) |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/plugin/loader.ts` |
| **Function** | `resolvePlugin()` |
| **Condition** | All three resolution strategies fail: (1) the plugin name is not a relative/absolute path, (2) `require.resolve()` for the npm package throws, and (3) none of the configured `pluginDirs` contain the plugin. |
| **Message template** | `Could not resolve plugin "<pluginName>". Ensure it is installed (npm install <pluginName>) or provide a valid path.` |
| **Severity** | Fatal |
| **Fix** | Install the plugin package (`npm install <pluginName>`) or verify the file path is correct if using a local plugin. If using `pluginDirs`, confirm the plugin exists in one of those directories. |

**Example scenario:**

```
$ docgen generate
PluginLoadError: Failed to load plugin "my-custom-renderer": Could not resolve plugin "my-custom-renderer". Ensure it is installed (npm install my-custom-renderer) or provide a valid path.
```

---

#### DOCGEN-6003: Module does not export a valid DocGenPlugin

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-6003 |
| **Error class** | `Error` (wrapped by `PluginLoadError`) |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/plugin/loader.ts` |
| **Function** | `loadPluginFromPath()` / `loadPluginFromPackage()` |
| **Condition** | The module is found and loaded, but its export is neither a constructor function that produces a valid plugin nor an object satisfying the `DocGenPlugin` interface (must have `name`, `version`, `type`, `supports`, `initialize`, `validate`, and `cleanup`). |
| **Message template (path)** | `Module at "<filePath>" does not export a valid DocGenPlugin.` |
| **Message template (package)** | `Package "<packageName>" does not export a valid DocGenPlugin.` |
| **Severity** | Fatal |
| **Fix** | Ensure the plugin module exports a class (as `default` or named export) whose instances implement the `DocGenPlugin` interface, or exports a plain object with the required properties: `name`, `version`, `type`, `supports`, `initialize()`, `validate()`, and `cleanup()`. |

**Example scenario:**

```
$ docgen generate
PluginLoadError: Failed to load plugin "./plugins/my-renderer": Module at "/projects/myapp/plugins/my-renderer" does not export a valid DocGenPlugin.
```

---

#### DOCGEN-6004: Unknown plugin type during registration

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-6004 |
| **Error class** | `Error` (wrapped by `PluginLoadError`) |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/plugin/loader.ts` |
| **Function** | `registerPlugin()` |
| **Condition** | The plugin loads successfully but its `type` property is not `"parser"`, `"transformer"`, or `"renderer"`, so the registry does not know where to place it. |
| **Message template** | `Unknown plugin type for "<plugin.name>".` |
| **Severity** | Fatal |
| **Fix** | Set the plugin's `type` property to one of: `"parser"`, `"transformer"`, or `"renderer"`. Also ensure the plugin implements the corresponding sub-interface (`ParserPlugin`, `TransformerPlugin`, or `RendererPlugin`). |

**Example scenario:**

```
$ docgen generate
PluginLoadError: Failed to load plugin "@my-org/docgen-analytics": Unknown plugin type for "@my-org/docgen-analytics".
```

---

### Parse Errors (DOCGEN-2xxx)

Produced by parser plugins (e.g., `@docgen/parser-typescript`) when individual source files fail to parse. These are collected into a `ParseError[]` array in the `ParserOutput` rather than thrown as exceptions, allowing the pipeline to continue processing remaining files.

#### DOCGEN-2001: Failed to parse source file

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-2001 |
| **Error class** | `ParseError` (data structure, not thrown) |
| **Package** | `@docgen/parser-typescript` |
| **File** | `packages/parser-typescript/src/index.ts` |
| **Function** | `TypeScriptParser.parse()` |
| **Condition** | `parseSourceFile()` throws an exception for a particular file. The error is caught and added to the `errors` array with the file path, position (line 0, column 0 for unlocatable errors), and the exception message. |
| **Message template** | `Failed to parse: <error.message>` |
| **Severity** | Error (non-fatal; other files continue to be parsed) |
| **Fix** | Check the reported file for syntax errors or unsupported TypeScript constructs. Ensure the file compiles with `tsc`. If the error is in generated code, add the file path to the `exclude` patterns in your language configuration. |

**ParseError structure:**

```typescript
interface ParseError {
  filePath: string;   // Relative path from sourceRoot
  line: number;       // Line number (0 if unknown)
  column: number;     // Column number (0 if unknown)
  message: string;    // Human-readable error description
  severity: string;   // "error" | "warning"
}
```

**Example scenario:**

```
docgen generate --verbose
  [info]  Parsing 42 typescript files from src...
  [error] Failed to parse src/legacy/broken-module.ts: Unexpected token at line 15
```

---

### Validation Errors (DOCGEN-3xxx)

Produced by the DocIR validator in `@docgen/core`. Schema validation errors (DOCGEN-3001) are returned as `ValidationError[]` objects. Semantic checks (DOCGEN-3002 through DOCGEN-3004) are returned as `ValidationWarning[]` objects.

#### DOCGEN-3001: DocIR schema validation failed (Zod)

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-3001 |
| **Error class** | `ValidationError` (data structure) |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/docir/validator.ts` |
| **Function** | `validateDocIR()` |
| **Condition** | `DocIRSchema.safeParse()` fails -- the assembled DocIR does not match the Zod schema. Each Zod issue is mapped to a `ValidationError` with `path`, `message`, and `code`. |
| **Message template** | `<path>: <Zod issue message>` |
| **Severity** | Error (logged by the orchestrator; generation continues but output may be incomplete) |
| **Fix** | This typically indicates a bug in a parser plugin producing malformed DocIR nodes. Check that all required fields are populated (e.g., `modules[].id`, `modules[].name`, `modules[].filePath`). If using a custom parser, validate its output against the DocIR schema. |

**Example scenario:**

```
  [error] DocIR validation failed:
  [error]   modules.0.name: String must contain at least 1 character(s)
  [error]   modules.0.coverage.overall: Number must be less than or equal to 100
```

---

#### DOCGEN-3002: Duplicate module ID

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-3002 |
| **Error class** | `ValidationWarning` (data structure) |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/docir/validator.ts` |
| **Function** | `validateDocIR()` |
| **Condition** | Two or more modules in the DocIR share the same `id` value. |
| **Message template** | `Duplicate module ID: <moduleId>` |
| **Severity** | Warning |
| **Fix** | Ensure all module IDs are unique across the project. Module IDs are typically derived from the file path and declaration name. If two files contain identically named classes, consider reorganizing or using namespace prefixes. |

**Example scenario:**

```
  [warn]  modules[utils.StringHelper]: Duplicate module ID: utils.StringHelper
```

---

#### DOCGEN-3003: Broken cross-reference

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-3003 |
| **Error class** | `ValidationWarning` (data structure) |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/docir/validator.ts` |
| **Function** | `validateDocIR()` |
| **Condition** | A member's `returnType.link` references a module ID that does not exist in the DocIR's `modules` array. |
| **Message template** | `Broken cross-reference: <returnType.link>` |
| **Severity** | Warning |
| **Fix** | The referenced type may come from an external dependency not included in the parse scope, or the source module may have been excluded. Either add the referenced module's source to the `include` patterns or remove the cross-reference link. |

**Example scenario:**

```
  [warn]  modules[api.UserController].members[getUser].returnType: Broken cross-reference: models.UserDTO
```

---

#### DOCGEN-3004: Duplicate ADR ID

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-3004 |
| **Error class** | `ValidationWarning` (data structure) |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/docir/validator.ts` |
| **Function** | `validateDocIR()` |
| **Condition** | Two or more ADR entries in the DocIR share the same `id` value. |
| **Message template** | `Duplicate ADR ID: <adrId>` |
| **Severity** | Warning |
| **Fix** | Rename one of the conflicting ADR files so that each has a unique ID. The ADR ID is typically derived from the filename (e.g., `ADR-001`). |

**Example scenario:**

```
  [warn]  adrs[ADR-003]: Duplicate ADR ID: ADR-003
```

---

### Validation Rule Violations (DOCGEN-3xxx continued)

Produced by the orchestrator's `checkValidationRules()` method when modules or members violate documentation quality rules configured in `.docgen.yaml` under `validation.rules`. Each violation includes the rule name, severity level (from config), module ID, and a descriptive message.

#### DOCGEN-3010: require-description violation

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-3010 |
| **Error class** | Violation object `{ rule, level, module, message }` |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/orchestrator.ts` |
| **Function** | `Orchestrator.checkValidationRules()` |
| **Condition** | The `require-description` rule is not `"off"`, and either a module or a public member has an empty `description` (after trimming whitespace). |
| **Message template (module)** | `Module "<moduleName>" has no description.` |
| **Message template (member)** | `Member "<moduleName>.<memberName>" has no description.` |
| **Severity** | Configurable (`"error"` or `"warn"`, default: `"warn"`) |
| **Fix** | Add a JSDoc/TSDoc comment with a description to the flagged module or member. For TypeScript, add a `/** ... */` comment above the declaration. |

**Example scenario:**

```
  [warn]  [require-description] Module "UserService" has no description.
  [warn]  [require-description] Member "UserService.findById" has no description.
```

---

#### DOCGEN-3011: require-param-docs violation

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-3011 |
| **Error class** | Violation object `{ rule, level, module, message }` |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/orchestrator.ts` |
| **Function** | `Orchestrator.checkValidationRules()` |
| **Condition** | The `require-param-docs` rule is not `"off"`, and a public member has one or more parameters whose `description` is empty (after trimming whitespace). One violation is emitted per undocumented parameter. |
| **Message template** | `Parameter "<paramName>" in "<moduleName>.<memberName>" is undocumented.` |
| **Severity** | Configurable (`"error"` or `"warn"`, default: `"warn"`) |
| **Fix** | Add a `@param` tag to the member's JSDoc/TSDoc comment for each flagged parameter. Example: `@param userId - The unique identifier of the user`. |

**Example scenario:**

```
  [warn]  [require-param-docs] Parameter "userId" in "UserService.findById" is undocumented.
  [warn]  [require-param-docs] Parameter "options" in "UserService.findById" is undocumented.
```

---

#### DOCGEN-3012: no-empty-descriptions violation

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-3012 |
| **Error class** | Violation object `{ rule, level, module, message }` |
| **Package** | `@docgen/core` |
| **File** | `packages/core/src/orchestrator.ts` |
| **Function** | `Orchestrator.checkValidationRules()` |
| **Condition** | The `no-empty-descriptions` rule is not `"off"`, and a public member's `description` (after trimming) is exactly `"TODO"` or `"..."`. |
| **Message template** | `"<moduleName>.<memberName>" has a placeholder description.` |
| **Severity** | Configurable (`"error"` or `"warn"`, default: `"warn"`) |
| **Fix** | Replace placeholder descriptions (`TODO`, `...`) with meaningful documentation that describes what the member does, its purpose, and any important behavior. |

**Example scenario:**

```
  [warn]  [no-empty-descriptions] "PaymentService.processRefund" has a placeholder description.
```

---

### CLI Errors (DOCGEN-5xxx)

These errors are produced by CLI command handlers in `@docgen/cli`. They result in `process.exit(1)` after printing an error message to stderr.

#### DOCGEN-5001: Config file already exists (init without --force)

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-5001 |
| **Error class** | Console error + `process.exit(1)` |
| **Package** | `@docgen/cli` |
| **File** | `packages/cli/src/commands/init.ts` |
| **Function** | `initCommand()` |
| **Condition** | `.docgen.yaml` already exists in the working directory and the `--force` flag was not provided. |
| **Message template** | `Error: .docgen.yaml already exists. Use --force to overwrite.` |
| **Severity** | Fatal (exits with code 1) |
| **Fix** | Either use `docgen init --force` to overwrite the existing configuration, or edit the existing `.docgen.yaml` directly. |

**Example scenario:**

```
$ docgen init
Error: .docgen.yaml already exists. Use --force to overwrite.
```

---

#### DOCGEN-5002: Coverage below threshold (generate with enforce)

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-5002 |
| **Error class** | `process.exit(1)` |
| **Package** | `@docgen/cli` |
| **File** | `packages/cli/src/commands/generate.ts` |
| **Function** | `generateCommand()` |
| **Condition** | `config.validation.coverage.enforce` is `true` and the computed coverage (`result.coverage.overall`) is below `config.validation.coverage.threshold`. Generation completes and files are written, but the process exits with a non-zero code. |
| **Message template** | (No dedicated message; the human-readable output shows `Status: FAILED` with the coverage percentage and threshold.) |
| **Severity** | Fatal (exits with code 1) |
| **Fix** | Either improve documentation coverage to meet the configured threshold, lower the threshold in `.docgen.yaml` under `validation.coverage.threshold`, or set `validation.coverage.enforce: false` to disable enforcement. |

**Example scenario:**

```
$ docgen generate
  Coverage:          52% (threshold: 80%)
  Status:            FAILED
$ echo $?
1
```

---

#### DOCGEN-5003: Coverage below threshold (validate)

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-5003 |
| **Error class** | `process.exit(1)` |
| **Package** | `@docgen/cli` |
| **File** | `packages/cli/src/commands/validate.ts` |
| **Function** | `validateCommand()` |
| **Condition** | `result.coverage.passed` is `false` -- the computed coverage is below the configured (or overridden via `--threshold`) threshold. |
| **Message template** | (No dedicated message; the validation report shows `Status: FAILED` with coverage details.) |
| **Severity** | Fatal (exits with code 1) |
| **Fix** | Add documentation to undocumented modules and members listed in the validation report. Alternatively, adjust the threshold with `--threshold <number>` or in `.docgen.yaml`. |

**Example scenario:**

```
$ docgen validate
  Coverage:    45% (threshold: 80%)
  Status:      FAILED

  Undocumented (12):
    - auth.AuthService.validateToken
    - auth.AuthService.refreshToken
    ...
$ echo $?
1
```

---

#### DOCGEN-5004: Validation rule violations at error level

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-5004 |
| **Error class** | `process.exit(1)` |
| **Package** | `@docgen/cli` |
| **File** | `packages/cli/src/commands/validate.ts` |
| **Function** | `validateCommand()` |
| **Condition** | One or more violations have `level: "error"` (as opposed to `"warn"`). The exit condition checks `result.violations.some((v) => v.level === "error")`. |
| **Message template** | (No dedicated message; violations are listed in the validation report under the "Errors" section.) |
| **Severity** | Fatal (exits with code 1) |
| **Fix** | Address the listed error-level violations by adding the required documentation. Alternatively, change the rule severity from `"error"` to `"warn"` or `"off"` in `.docgen.yaml` under `validation.rules`. |

**Example scenario:**

```
$ docgen validate
  Errors (3):
    [require-description] Module "InternalCache" has no description.
    [require-description] Member "InternalCache.evict" has no description.
    [require-param-docs] Parameter "key" in "InternalCache.get" is undocumented.
$ echo $?
1
```

---

#### DOCGEN-5005: Missing ADR title

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-5005 |
| **Error class** | Console error + `process.exit(1)` |
| **Package** | `@docgen/cli` |
| **File** | `packages/cli/src/commands/adr.ts` |
| **Function** | `createAdr()` (called from `adrCommand()` when action is `"new"`) |
| **Condition** | The `title` argument is `undefined` -- the user ran `docgen adr new` without providing a title string. |
| **Message template** | `Error: Title is required. Usage: docgen adr new <title>` |
| **Severity** | Fatal (exits with code 1) |
| **Fix** | Provide a title when creating a new ADR: `docgen adr new "Use PostgreSQL for primary data store"`. |

**Example scenario:**

```
$ docgen adr new
Error: Title is required. Usage: docgen adr new <title>
```

---

#### DOCGEN-5006: Unknown ADR action

| Field | Value |
|-------|-------|
| **Error code** | DOCGEN-5006 |
| **Error class** | Console error + `process.exit(1)` |
| **Package** | `@docgen/cli` |
| **File** | `packages/cli/src/commands/adr.ts` |
| **Function** | `adrCommand()` |
| **Condition** | The `action` argument does not match `"new"` or `"list"` -- the user provided an unrecognized subcommand. |
| **Message template** | `Unknown ADR action: <action>` |
| **Severity** | Fatal (exits with code 1) |
| **Fix** | Use one of the supported ADR actions: `new` (create a new ADR) or `list` (list existing ADRs). |

**Example scenario:**

```
$ docgen adr update
Unknown ADR action: update
Available actions: new, list
```

---

## Exit Codes

| Code | Meaning | Commands | Trigger |
|------|---------|----------|---------|
| 0 | Success | All commands | Command completed without errors or threshold failures |
| 1 | Error or validation failure | `init` | Config file already exists without `--force` |
| 1 | Error or validation failure | `generate` | Coverage below threshold (when `enforce: true`), or any unhandled exception |
| 1 | Error or validation failure | `validate` | Coverage below threshold, or any violation at `"error"` level |
| 1 | Error or validation failure | `adr` | Missing title for `new`, or unknown action |

---

## Error Propagation Flow

```
CLI Command
  |
  +--> loadConfig()
  |      +--> ConfigError (DOCGEN-1001, 1002, 1003)
  |
  +--> Orchestrator.generate() / validate()
         |
         +--> loadPlugins()
         |      +--> PluginLoadError (DOCGEN-6001)
         |             +--> resolvePlugin()    --> DOCGEN-6002
         |             +--> loadPluginFrom*()  --> DOCGEN-6003
         |             +--> registerPlugin()   --> DOCGEN-6004
         |
         +--> parser.parse()
         |      +--> ParseError[] (DOCGEN-2001) -- collected, not thrown
         |
         +--> validateDocIR()
         |      +--> ValidationError[] (DOCGEN-3001)   -- schema failures
         |      +--> ValidationWarning[] (DOCGEN-3002)  -- duplicate module ID
         |      +--> ValidationWarning[] (DOCGEN-3003)  -- broken cross-ref
         |      +--> ValidationWarning[] (DOCGEN-3004)  -- duplicate ADR ID
         |
         +--> checkValidationRules()
                +--> Violation[] (DOCGEN-3010, 3011, 3012)
```

---

## Quick Reference

| Code | Name | Package | Severity |
|------|------|---------|----------|
| DOCGEN-1001 | No configuration file found | `@docgen/core` | Fatal |
| DOCGEN-1002 | Invalid YAML syntax | `@docgen/core` | Fatal |
| DOCGEN-1003 | Configuration validation failed | `@docgen/core` | Fatal |
| DOCGEN-2001 | Failed to parse source file | `@docgen/parser-typescript` | Error |
| DOCGEN-3001 | DocIR schema validation failed | `@docgen/core` | Error |
| DOCGEN-3002 | Duplicate module ID | `@docgen/core` | Warning |
| DOCGEN-3003 | Broken cross-reference | `@docgen/core` | Warning |
| DOCGEN-3004 | Duplicate ADR ID | `@docgen/core` | Warning |
| DOCGEN-3010 | require-description violation | `@docgen/core` | Configurable |
| DOCGEN-3011 | require-param-docs violation | `@docgen/core` | Configurable |
| DOCGEN-3012 | no-empty-descriptions violation | `@docgen/core` | Configurable |
| DOCGEN-5001 | Config file already exists | `@docgen/cli` | Fatal |
| DOCGEN-5002 | Coverage below threshold (generate) | `@docgen/cli` | Fatal |
| DOCGEN-5003 | Coverage below threshold (validate) | `@docgen/cli` | Fatal |
| DOCGEN-5004 | Validation rule violations at error level | `@docgen/cli` | Fatal |
| DOCGEN-5005 | Missing ADR title | `@docgen/cli` | Fatal |
| DOCGEN-5006 | Unknown ADR action | `@docgen/cli` | Fatal |
