import * as path from "path";
import * as fs from "fs";
import {
  loadConfig,
  Orchestrator,
  createConsoleLogger,
  createSilentLogger,
  type GenerateResult,
  type Logger,
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
  const logger = options.json ? createSilentLogger() : createConsoleLogger(options.verbose);

  try {
    const config = loadConfig(workDir);

    if (options.mode) {
      if (!['developer', 'exhaustive'].includes(options.mode)) {
        throw new Error(
          `Unsupported documentation mode "${options.mode}". Use "developer" or "exhaustive".`
        );
      }
      config.documentation.mode = options.mode as "developer" | "exhaustive";
    }

    enableRequestedFormats(config, options.format);

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

    if (options.watch && options.json) {
      throw new Error("--watch cannot be combined with --json.");
    }

    const orchestrator = new Orchestrator({ config, workDir, logger });
    const runGeneration = async (): Promise<GenerateResult> => {
      const result = await orchestrator.generate(options.format);
      writeArtifacts(workDir, config, result);
      return result;
    };

    const result = await runGeneration();

    if (options.json) {
      outputJson(result);
    } else {
      outputHuman(result);
    }

    if (config.validation.coverage.enforce && !result.coverage.passed) {
      process.exitCode = 1;
      if (!options.watch) return;
    }

    if (options.watch) {
      await watchAndRegenerate(config, workDir, logger, runGeneration);
    }
  } catch (err) {
    const message = (err as Error).message;
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: message }, null, 2));
    } else {
      logger.error(message);
      if (options.verbose) console.error(err);
    }
    process.exitCode = 1;
  }
}

function enableRequestedFormats(config: any, formats?: string[]): void {
  if (!formats) return;
  for (const format of formats) {
    if (!config.output[format]) {
      throw new Error(`Unsupported output format "${format}".`);
    }
    config.output[format].enabled = true;
  }
}

function writeArtifacts(workDir: string, config: any, result: GenerateResult): void {
  for (const artifact of result.artifacts) {
    const outputDir = getOutputDir(config, artifact.metadata.format);
    const fullPath = path.resolve(workDir, outputDir, artifact.filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (typeof artifact.content === "string") {
      fs.writeFileSync(fullPath, artifact.content, "utf-8");
    } else {
      fs.writeFileSync(fullPath, artifact.content);
    }
  }
}

async function watchAndRegenerate(
  config: any,
  workDir: string,
  logger: Logger,
  generate: () => Promise<GenerateResult>
): Promise<never> {
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let queued = false;

  const schedule = (changedPath: string): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void regenerate(changedPath), 200);
  };

  const regenerate = async (changedPath: string): Promise<void> => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    logger.info(`Change detected in ${changedPath}; regenerating...`);
    try {
      await generate();
    } catch (error) {
      logger.error((error as Error).message);
    } finally {
      running = false;
      if (queued) {
        queued = false;
        schedule("queued changes");
      }
    }
  };

  const watchers = config.languages.map((language: any) => {
    const source = path.resolve(workDir, language.source);
    return fs.watch(source, { recursive: true }, (_event, fileName) => {
      schedule(fileName?.toString() ?? language.source);
    });
  });

  logger.info(`Watching ${watchers.length} source root(s). Press Ctrl+C to stop.`);
  return new Promise<never>((_resolve, reject) => {
    for (const watcher of watchers) watcher.on("error", reject);
  });
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
        success: result.coverage.passed,
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
  console.log("\nRepoScribe - generation complete\n");
  console.log(`  Modules parsed:    ${result.docir.modules.length}`);
  console.log(`  Files generated:   ${result.artifacts.length}`);
  console.log(
    `  Coverage:          ${result.coverage.overall}% (threshold: ${result.coverage.threshold}%)`
  );
  console.log(`  Status:            ${result.coverage.passed ? "PASSED" : "FAILED"}`);
  console.log(`  Duration:          ${result.duration}ms\n`);
}
