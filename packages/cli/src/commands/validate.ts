import {
  loadConfig,
  Orchestrator,
  createConsoleLogger,
  type ValidateResult,
} from "@docgen/core";

interface ValidateOptions {
  json?: boolean;
  threshold?: number;
  verbose?: boolean;
}

export async function validateCommand(options: ValidateOptions): Promise<void> {
  const workDir = process.cwd();
  const logger = createConsoleLogger(options.verbose);

  try {
    const config = loadConfig(workDir);

    // Override threshold if specified
    if (options.threshold !== undefined) {
      config.validation.coverage.threshold = options.threshold;
    }

    const orchestrator = new Orchestrator({
      config,
      workDir,
      logger,
    });

    const result = await orchestrator.validate();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      outputHumanValidation(result);
    }

    // Exit with appropriate code
    if (!result.coverage.passed || result.violations.some((v) => v.level === "error")) {
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

function outputHumanValidation(result: ValidateResult): void {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║    DocGen - Validation Report        ║");
  console.log("╚══════════════════════════════════════╝\n");

  console.log(`  Coverage:    ${result.coverage.overall}% (threshold: ${result.coverage.threshold}%)`);
  console.log(`  Status:      ${result.coverage.passed ? "✓ PASSED" : "✗ FAILED"}`);

  if (result.coverage.undocumented.length > 0) {
    console.log(`\n  Undocumented (${result.coverage.undocumented.length}):`);
    for (const item of result.coverage.undocumented.slice(0, 20)) {
      console.log(`    - ${item}`);
    }
    if (result.coverage.undocumented.length > 20) {
      console.log(`    ... and ${result.coverage.undocumented.length - 20} more`);
    }
  }

  const errors = result.violations.filter((v) => v.level === "error");
  const warnings = result.violations.filter((v) => v.level === "warn");

  if (errors.length > 0) {
    console.log(`\n  Errors (${errors.length}):`);
    for (const v of errors.slice(0, 10)) {
      console.log(`    ✗ [${v.rule}] ${v.message}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n  Warnings (${warnings.length}):`);
    for (const v of warnings.slice(0, 10)) {
      console.log(`    ⚠ [${v.rule}] ${v.message}`);
    }
  }

  console.log(`\n  Duration: ${result.duration}ms\n`);
}
