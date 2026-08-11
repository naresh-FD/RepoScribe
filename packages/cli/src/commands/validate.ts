import {
  loadConfig,
  Orchestrator,
  createConsoleLogger,
  createSilentLogger,
  type ValidateResult,
} from "@docgen/core";

interface ValidateOptions {
  json?: boolean;
  threshold?: number;
  verbose?: boolean;
}

export async function validateCommand(options: ValidateOptions): Promise<void> {
  const workDir = process.cwd();
  const logger = options.json ? createSilentLogger() : createConsoleLogger(options.verbose);

  try {
    const config = loadConfig(workDir);
    if (options.threshold !== undefined) {
      config.validation.coverage.threshold = options.threshold;
    }

    const result = await new Orchestrator({ config, workDir, logger }).validate();
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            ...result,
            coverage: {
              ...result.coverage,
              enforced: config.validation.coverage.enforce,
            },
          },
          null,
          2
        )
      );
    } else {
      outputHumanValidation(result);
    }

    const hasErrors = result.violations.some((violation) => violation.level === "error");
    if ((config.validation.coverage.enforce && !result.coverage.passed) || hasErrors) {
      process.exitCode = 1;
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

function outputHumanValidation(result: ValidateResult): void {
  console.log("\nRepoScribe - validation report\n");
  console.log(
    `  Coverage:    ${result.coverage.overall}% (threshold: ${result.coverage.threshold}%)`
  );
  console.log(`  Status:      ${result.coverage.passed ? "PASSED" : "FAILED"}`);

  if (result.coverage.undocumented.length > 0) {
    console.log(`\n  Undocumented (${result.coverage.undocumented.length}):`);
    for (const item of result.coverage.undocumented.slice(0, 20)) {
      console.log(`    - ${item}`);
    }
    if (result.coverage.undocumented.length > 20) {
      console.log(`    ... and ${result.coverage.undocumented.length - 20} more`);
    }
  }

  const errors = result.violations.filter((violation) => violation.level === "error");
  const warnings = result.violations.filter((violation) => violation.level === "warn");

  if (errors.length > 0) {
    console.log(`\n  Errors (${errors.length}):`);
    for (const violation of errors.slice(0, 10)) {
      console.log(`    ERROR [${violation.rule}] ${violation.message}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n  Warnings (${warnings.length}):`);
    for (const violation of warnings.slice(0, 10)) {
      console.log(`    WARN [${violation.rule}] ${violation.message}`);
    }
  }

  console.log(`\n  Duration: ${result.duration}ms\n`);
}
