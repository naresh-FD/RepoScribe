import * as path from "path";
import * as fg from "fast-glob";
import type { DocIR } from "./docir/types";
import { createEmptyDocIR } from "./docir/types";
import { validateDocIR, computeAggregateCoverage } from "./docir/validator";
import type { DocGenConfig, LanguageConfig } from "./config/schema";
import type {
  PluginConfig,
  Logger,
  OutputArtifact,
} from "./plugin/types";
import { loadPlugins, type PluginRegistry } from "./plugin/loader";
import { CoverageAnalyzer } from "./transforms/coverage-analyzer";
import { LinkResolver } from "./transforms/link-resolver";

// ─────────────────────────────────────────────────────────────────
// Orchestrator - Coordinates the full parse → transform → render pipeline
// ─────────────────────────────────────────────────────────────────

export interface OrchestratorOptions {
  config: DocGenConfig;
  workDir: string;
  logger: Logger;
  formats?: string[]; // If set, only these renderers run
}

export interface GenerateResult {
  docir: DocIR;
  artifacts: OutputArtifact[];
  coverage: {
    overall: number;
    threshold: number;
    passed: boolean;
  };
  duration: number; // milliseconds
}

export interface ValidateResult {
  coverage: {
    overall: number;
    threshold: number;
    passed: boolean;
    undocumented: string[];
  };
  violations: Array<{
    rule: string;
    level: "error" | "warn";
    module: string;
    message: string;
  }>;
  duration: number;
}

export class Orchestrator {
  private config: DocGenConfig;
  private workDir: string;
  private logger: Logger;
  private registry: PluginRegistry | null = null;

  constructor(options: OrchestratorOptions) {
    this.config = options.config;
    this.workDir = options.workDir;
    this.logger = options.logger;
  }

  /** Full pipeline: parse → transform → render */
  async generate(formats?: string[]): Promise<GenerateResult> {
    const start = Date.now();
    this.logger.info("Starting documentation generation...");

    // 1. Load plugins
    const registry = await this.loadAllPlugins();

    // 2. Parse all languages
    const docir = await this.parseAll(registry);

    // 3. Transform (coverage, links, etc.)
    const transformed = await this.transformAll(docir, registry);

    // 4. Validate the DocIR
    const validation = validateDocIR(transformed);
    if (!validation.valid) {
      this.logger.error("DocIR validation failed:");
      for (const err of validation.errors) {
        this.logger.error(`  ${err.path}: ${err.message}`);
      }
    }
    for (const warn of validation.warnings) {
      this.logger.warn(`  ${warn.path}: ${warn.message}`);
    }

    // 5. Render outputs
    const artifacts = await this.renderAll(transformed, registry, formats);

    // 6. Compute coverage
    const aggregateCoverage = computeAggregateCoverage(transformed.modules);
    const threshold = this.config.validation.coverage.threshold;

    const duration = Date.now() - start;
    this.logger.success(
      `Generation complete in ${duration}ms — ` +
        `${transformed.modules.length} modules, ` +
        `${artifacts.length} files generated, ` +
        `coverage: ${aggregateCoverage.overall}%`
    );

    return {
      docir: transformed,
      artifacts,
      coverage: {
        overall: aggregateCoverage.overall,
        threshold,
        passed: aggregateCoverage.overall >= threshold,
      },
      duration,
    };
  }

  /** Validate only — no rendering */
  async validate(): Promise<ValidateResult> {
    const start = Date.now();
    this.logger.info("Validating documentation coverage...");

    const registry = await this.loadAllPlugins();
    const docir = await this.parseAll(registry);
    const transformed = await this.transformAll(docir, registry);

    const aggregateCoverage = computeAggregateCoverage(transformed.modules);
    const threshold = this.config.validation.coverage.threshold;

    // Check validation rules
    const violations = this.checkValidationRules(transformed);

    const duration = Date.now() - start;
    return {
      coverage: {
        overall: aggregateCoverage.overall,
        threshold,
        passed: aggregateCoverage.overall >= threshold,
        undocumented: aggregateCoverage.undocumented,
      },
      violations,
      duration,
    };
  }

  // ─── Private Pipeline Stages ────────────────────────────────

  private async loadAllPlugins(): Promise<PluginRegistry> {
    if (this.registry) return this.registry;

    // Collect all plugin names from config
    const pluginNames = new Set<string>();

    // Add language parsers
    for (const lang of this.config.languages) {
      pluginNames.add(lang.parser);
    }

    // Add explicitly listed plugins
    for (const p of this.config.plugins) {
      pluginNames.add(p);
    }

    // Add renderers based on enabled outputs
    const outputMap: Record<string, string> = {
      markdown: "@docgen/renderer-markdown",
      html: "@docgen/renderer-html",
      pdf: "@docgen/renderer-pdf",
      confluence: "@docgen/renderer-confluence",
    };

    for (const [format, pkg] of Object.entries(outputMap)) {
      const outputConfig = this.config.output[format as keyof typeof this.config.output];
      if (outputConfig && "enabled" in outputConfig && outputConfig.enabled) {
        pluginNames.add(pkg);
      }
    }

    this.registry = await loadPlugins(Array.from(pluginNames), {
      workDir: this.workDir,
      logger: this.logger,
    });

    // Register built-in transformers
    const coverageAnalyzer = new CoverageAnalyzer();
    const linkResolver = new LinkResolver();

    const pluginConfig: PluginConfig = {
      projectConfig: this.config,
      workDir: this.workDir,
      options: {},
      logger: this.logger,
    };

    await coverageAnalyzer.initialize(pluginConfig);
    await linkResolver.initialize(pluginConfig);

    this.registry.transformers.push(coverageAnalyzer, linkResolver);
    this.registry.transformers.sort((a, b) => a.priority - b.priority);

    return this.registry;
  }

  private async parseAll(registry: PluginRegistry): Promise<DocIR> {
    const docir = createEmptyDocIR({
      name: this.config.project.name,
      version: this.config.project.version,
      description: this.config.project.description,
      languages: this.config.languages.map((l) => l.name),
      repository: this.config.project.repository,
    });

    for (const langConfig of this.config.languages) {
      const parser = registry.parsers.get(langConfig.name);
      if (!parser) {
        this.logger.warn(
          `No parser registered for "${langConfig.name}" — skipping.`
        );
        continue;
      }

      // Initialize parser
      await parser.initialize({
        projectConfig: this.config,
        workDir: this.workDir,
        options: langConfig.options,
        logger: this.logger,
      });

      // Resolve source files
      const files = await this.resolveFiles(langConfig);
      this.logger.info(
        `Parsing ${files.length} ${langConfig.name} files from ${langConfig.source}...`
      );

      // Parse
      const langDocIR = await parser.parse(files, langConfig);
      docir.modules.push(...langDocIR.modules);

      if (langDocIR.adrs.length) docir.adrs.push(...langDocIR.adrs);
      if (langDocIR.changelog.length) docir.changelog.push(...langDocIR.changelog);

      await parser.cleanup();
    }

    return docir;
  }

  private async transformAll(
    docir: DocIR,
    registry: PluginRegistry
  ): Promise<DocIR> {
    let current = docir;

    for (const transformer of registry.transformers) {
      this.logger.debug(`Running transformer: ${transformer.name}`);
      current = await transformer.transform(current);
    }

    return current;
  }

  private async renderAll(
    docir: DocIR,
    registry: PluginRegistry,
    formats?: string[]
  ): Promise<OutputArtifact[]> {
    const allArtifacts: OutputArtifact[] = [];

    for (const [format, renderer] of registry.renderers) {
      if (formats && !formats.includes(format)) continue;

      const outputConfig = this.config.output;
      this.logger.info(`Rendering ${format} output...`);

      await renderer.initialize({
        projectConfig: this.config,
        workDir: this.workDir,
        options: {},
        logger: this.logger,
      });

      const artifacts = await renderer.render(docir, outputConfig);
      allArtifacts.push(...artifacts);

      await renderer.cleanup();
      this.logger.success(`  ${format}: ${artifacts.length} files generated`);
    }

    return allArtifacts;
  }

  private async resolveFiles(langConfig: LanguageConfig): Promise<string[]> {
    const sourceDir = path.resolve(this.workDir, langConfig.source);
    const include = langConfig.include.map((p) => path.join(sourceDir, p));
    const ignore = langConfig.exclude.map((p) => path.join(sourceDir, p));

    return fg.sync(include, {
      ignore,
      absolute: true,
      onlyFiles: true,
    });
  }

  private checkValidationRules(docir: DocIR) {
    const violations: ValidateResult["violations"] = [];
    const rules = this.config.validation.rules;

    for (const mod of docir.modules) {
      if (rules["require-description"] !== "off" && !mod.description.trim()) {
        violations.push({
          rule: "require-description",
          level: rules["require-description"] as "error" | "warn",
          module: mod.id,
          message: `Module "${mod.name}" has no description.`,
        });
      }

      for (const member of mod.members) {
        if (member.visibility !== "public") continue;

        if (rules["require-description"] !== "off" && !member.description.trim()) {
          violations.push({
            rule: "require-description",
            level: rules["require-description"] as "error" | "warn",
            module: mod.id,
            message: `Member "${mod.name}.${member.name}" has no description.`,
          });
        }

        if (rules["require-param-docs"] !== "off") {
          const undocParams = member.parameters.filter(
            (p) => !p.description.trim()
          );
          for (const p of undocParams) {
            violations.push({
              rule: "require-param-docs",
              level: rules["require-param-docs"] as "error" | "warn",
              module: mod.id,
              message: `Parameter "${p.name}" in "${mod.name}.${member.name}" is undocumented.`,
            });
          }
        }

        if (rules["no-empty-descriptions"] !== "off") {
          if (member.description.trim() === "TODO" || member.description.trim() === "...") {
            violations.push({
              rule: "no-empty-descriptions",
              level: rules["no-empty-descriptions"] as "error" | "warn",
              module: mod.id,
              message: `"${mod.name}.${member.name}" has a placeholder description.`,
            });
          }
        }
      }
    }

    return violations;
  }
}
