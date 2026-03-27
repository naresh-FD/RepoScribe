import * as path from "path";
import * as fs from "fs";
import {
  loadConfig,
  Orchestrator,
  createConsoleLogger,
  type GenerateResult,
} from "@docgen/core";

interface GenerateOptions {
  format?: string[];
  output?: string;
  mode?: string;
  json?: boolean;
  verbose?: boolean;
  watch?: boolean;
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  const workDir = process.cwd();
  const logger = createConsoleLogger(options.verbose);

  try {
    const config = loadConfig(workDir);

    if (options.mode) {
      if (!["developer", "exhaustive"].includes(options.mode)) {
        throw new Error(`Unsupported documentation mode "${options.mode}". Use "developer" or "exhaustive".`);
      }
      config.documentation.mode = options.mode as "developer" | "exhaustive";
    }

    // Override output directory if specified
    if (options.output) {
      if (config.output.markdown.enabled) {
        config.output.markdown.outputDir = path.join(options.output, "markdown");
      }
      if (config.output.html.enabled) {
        config.output.html.outputDir = path.join(options.output, "html");
      }
      if (config.output.pdf.enabled) {
        config.output.pdf.outputDir = path.join(options.output, "pdf");
      }
    }

    const orchestrator = new Orchestrator({
      config,
      workDir,
      logger,
    });

    const result = await orchestrator.generate(options.format);

    // Write artifacts to disk
    for (const artifact of result.artifacts) {
      const outputDir = getOutputDir(config, artifact.metadata.format);
      const fullPath = path.resolve(workDir, outputDir, artifact.filePath);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (typeof artifact.content === "string") {
        fs.writeFileSync(fullPath, artifact.content, "utf-8");
      } else {
        fs.writeFileSync(fullPath, artifact.content);
      }
    }

    if (options.json) {
      outputJson(result);
    } else {
      outputHuman(result);
    }

    // Exit with appropriate code
    if (config.validation.coverage.enforce && !result.coverage.passed) {
      process.exit(1);
    }
  } catch (err) {
    logger.error((err as Error).message);
    if (options.verbose) {
      console.error(err);
    }
    process.exit(1);
  }
}

function getOutputDir(config: any, format: string): string {
  switch (format) {
    case "markdown":
      return config.output.markdown.outputDir;
    case "html":
      return config.output.html.outputDir;
    case "pdf":
      return config.output.pdf.outputDir;
    default:
      return "docs";
  }
}

function outputJson(result: GenerateResult): void {
  console.log(
    JSON.stringify(
      {
        success: true,
        modules: result.docir.modules.length,
        artifacts: result.artifacts.length,
        coverage: result.coverage,
        duration: result.duration,
      },
      null,
      2
    )
  );
}

function outputHuman(result: GenerateResult): void {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     DocGen - Generation Complete     ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log(`  Modules parsed:    ${result.docir.modules.length}`);
  console.log(`  Files generated:   ${result.artifacts.length}`);
  console.log(`  Coverage:          ${result.coverage.overall}% (threshold: ${result.coverage.threshold}%)`);
  console.log(`  Status:            ${result.coverage.passed ? "✓ PASSED" : "✗ FAILED"}`);
  console.log(`  Duration:          ${result.duration}ms\n`);
}
