import * as path from "path";
import type {
  DocGenPlugin,
  ParserPlugin,
  RendererPlugin,
  TransformerPlugin,
  Logger,
} from "./types";
import { isParserPlugin, isRendererPlugin, isTransformerPlugin } from "./types";

// ─────────────────────────────────────────────────────────────────
// Plugin Loader - Dynamic resolution and instantiation of plugins
// ─────────────────────────────────────────────────────────────────

export interface PluginRegistry {
  parsers: Map<string, ParserPlugin>;
  transformers: TransformerPlugin[];
  renderers: Map<string, RendererPlugin>;
}

export interface PluginLoaderOptions {
  /** Additional directories to search for plugins */
  pluginDirs?: string[];
  /** Working directory for relative resolution */
  workDir: string;
  /** Logger */
  logger: Logger;
}

/**
 * Load and register all plugins based on configuration.
 *
 * Plugin resolution order:
 * 1. Built-in plugins (e.g., @docgen/parser-typescript)
 * 2. Locally installed npm packages
 * 3. Relative file paths
 */
export async function loadPlugins(
  pluginNames: string[],
  options: PluginLoaderOptions
): Promise<PluginRegistry> {
  const registry: PluginRegistry = {
    parsers: new Map(),
    transformers: [],
    renderers: new Map(),
  };

  for (const pluginName of pluginNames) {
    try {
      const plugin = await resolvePlugin(pluginName, options);
      registerPlugin(plugin, registry, options.logger);
    } catch (err) {
      options.logger.error(
        `Failed to load plugin "${pluginName}": ${(err as Error).message}`
      );
      throw new PluginLoadError(pluginName, err as Error);
    }
  }

  // Sort transformers by priority
  registry.transformers.sort((a, b) => a.priority - b.priority);

  return registry;
}

/** Resolve a plugin by name, path, or package */
async function resolvePlugin(
  pluginName: string,
  options: PluginLoaderOptions
): Promise<DocGenPlugin> {
  // Strategy 1: Relative or absolute file path
  if (pluginName.startsWith(".") || pluginName.startsWith("/")) {
    const resolved = path.resolve(options.workDir, pluginName);
    return loadPluginFromPath(resolved);
  }

  // Strategy 2: npm package resolution
  try {
    return loadPluginFromPackage(pluginName, options.workDir);
  } catch {
    // Strategy 3: local workspace package resolution for the monorepo
    if (pluginName.startsWith("@docgen/")) {
      try {
        const workspacePath = path.join(
          options.workDir,
          "packages",
          pluginName.replace("@docgen/", "")
        );
        return loadPluginFromPath(workspacePath);
      } catch {
        // Fall through to custom plugin directories below
      }
    }

    // Strategy 4: Look in plugin directories
    if (options.pluginDirs) {
      for (const dir of options.pluginDirs) {
        try {
          const resolved = path.join(dir, pluginName);
          return loadPluginFromPath(resolved);
        } catch {
          continue;
        }
      }
    }
  }

  throw new Error(
    `Could not resolve plugin "${pluginName}". ` +
      `Ensure it is installed (npm install ${pluginName}) or provide a valid path.`
  );
}

/** Load a plugin from a file path */
async function loadPluginFromPath(filePath: string): Promise<DocGenPlugin> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(filePath);
  const PluginClass = mod.default ?? mod;

  if (typeof PluginClass === "function") {
    return new PluginClass();
  }

  // Allow direct object exports
  if (isValidPlugin(PluginClass)) {
    return PluginClass;
  }

  throw new Error(`Module at "${filePath}" does not export a valid DocGenPlugin.`);
}

/** Load a plugin from an npm package */
function loadPluginFromPackage(
  packageName: string,
  workDir: string
): DocGenPlugin {
  const resolvedPath = require.resolve(packageName, { paths: [workDir] });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(resolvedPath);
  const PluginClass = mod.default ?? mod;

  if (typeof PluginClass === "function") {
    return new PluginClass();
  }

  if (isValidPlugin(PluginClass)) {
    return PluginClass;
  }

  throw new Error(
    `Package "${packageName}" does not export a valid DocGenPlugin.`
  );
}

/** Register a plugin in the appropriate registry slot */
function registerPlugin(
  plugin: DocGenPlugin,
  registry: PluginRegistry,
  logger: Logger
): void {
  if (isParserPlugin(plugin)) {
    if (registry.parsers.has(plugin.language)) {
      logger.warn(
        `Parser for "${plugin.language}" already registered. ` +
          `Replacing with "${plugin.name}".`
      );
    }
    registry.parsers.set(plugin.language, plugin);
    logger.info(`Registered parser: ${plugin.name} (${plugin.language})`);
  } else if (isTransformerPlugin(plugin)) {
    registry.transformers.push(plugin);
    logger.info(
      `Registered transformer: ${plugin.name} (priority: ${plugin.priority})`
    );
  } else if (isRendererPlugin(plugin)) {
    if (registry.renderers.has(plugin.format)) {
      logger.warn(
        `Renderer for "${plugin.format}" already registered. ` +
          `Replacing with "${plugin.name}".`
      );
    }
    registry.renderers.set(plugin.format, plugin);
    logger.info(`Registered renderer: ${plugin.name} (${plugin.format})`);
  } else {
    throw new Error(`Unknown plugin type for "${plugin.name}".`);
  }
}

/** Runtime check for plugin interface compliance */
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

// ─── Errors ─────────────────────────────────────────────────────

export class PluginLoadError extends Error {
  constructor(
    public readonly pluginName: string,
    public readonly cause: Error
  ) {
    super(`Failed to load plugin "${pluginName}": ${cause.message}`);
    this.name = "PluginLoadError";
  }
}
