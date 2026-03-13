import type { DocIR, SupportedLanguage } from "../docir/types";
import type { DocGenConfig, LanguageConfig, OutputConfig } from "../config/schema";

// ─────────────────────────────────────────────────────────────────
// Plugin System - All plugins implement this contract
// ─────────────────────────────────────────────────────────────────

export type PluginType = "parser" | "transformer" | "renderer";

/** Base interface all plugins must implement */
export interface DocGenPlugin {
  /** Unique plugin identifier (e.g., "@docgen/parser-typescript") */
  readonly name: string;
  /** SemVer version string */
  readonly version: string;
  /** Plugin category */
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

/** Configuration passed to plugins during initialization */
export interface PluginConfig {
  /** Full resolved project config */
  projectConfig: DocGenConfig;
  /** Working directory (repo root) */
  workDir: string;
  /** Plugin-specific options from .docgen.yaml */
  options: Record<string, unknown>;
  /** Logger instance */
  logger: Logger;
}

export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Parser Plugin ──────────────────────────────────────────────

/** Parser plugins read source code and produce DocIR modules */
export interface ParserPlugin extends DocGenPlugin {
  readonly type: "parser";
  readonly language: SupportedLanguage;

  /**
   * Parse source files and produce module nodes.
   * @param files - Array of file paths (already filtered by include/exclude)
   * @param langConfig - Language-specific configuration
   * @returns Partial DocIR with populated modules array
   */
  parse(files: string[], langConfig: LanguageConfig): Promise<DocIR>;
}

/** Type guard for parser plugins */
export function isParserPlugin(plugin: DocGenPlugin): plugin is ParserPlugin {
  return plugin.type === "parser" && "parse" in plugin;
}

// ─── Transformer Plugin ─────────────────────────────────────────

/** Transformer plugins enrich/modify the DocIR between parse and render */
export interface TransformerPlugin extends DocGenPlugin {
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

/** Type guard for transformer plugins */
export function isTransformerPlugin(
  plugin: DocGenPlugin
): plugin is TransformerPlugin {
  return plugin.type === "transformer" && "transform" in plugin;
}

// ─── Renderer Plugin ────────────────────────────────────────────

/** Renderer plugins consume DocIR and produce output files */
export interface RendererPlugin extends DocGenPlugin {
  readonly type: "renderer";
  /** Output format identifier (e.g., "markdown", "html", "pdf") */
  readonly format: string;

  /**
   * Render the DocIR to output files.
   * @param docir - Fully transformed DocIR
   * @param outputConfig - Format-specific output configuration
   * @returns Array of generated file paths
   */
  render(docir: DocIR, outputConfig: OutputConfig): Promise<OutputArtifact[]>;
}

/** Type guard for renderer plugins */
export function isRendererPlugin(
  plugin: DocGenPlugin
): plugin is RendererPlugin {
  return plugin.type === "renderer" && "render" in plugin;
}

/** Represents a generated output file */
export interface OutputArtifact {
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

// ─── Logger ─────────────────────────────────────────────────────

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  success(message: string, ...args: unknown[]): void;
}

/** Console-based logger with color support */
export function createConsoleLogger(verbose = false): Logger {
  return {
    debug: (msg, ...args) => {
      if (verbose) console.log(`  [debug] ${msg}`, ...args);
    },
    info: (msg, ...args) => console.log(`  [info]  ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`  [warn]  ${msg}`, ...args),
    error: (msg, ...args) => console.error(`  [error] ${msg}`, ...args),
    success: (msg, ...args) => console.log(`  [ok]    ${msg}`, ...args),
  };
}
