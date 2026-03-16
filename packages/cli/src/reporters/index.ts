/**
 * Reporters
 *
 * Format pipeline output for different environments.
 */

import chalk from "chalk";
import { GenerateResult } from "@docgen/core";

export interface Reporter {
  report(result: GenerateResult): void;
}

/**
 * GitHub Actions reporter — outputs annotations
 */
export class GitHubActionsReporter implements Reporter {
  report(result: GenerateResult): void {
    // Output stats as step summary
    const summary = [
      "## DocGen Report",
      "",
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Modules | ${result.docir.modules.length} |`,
      `| Members | ${result.docir.modules.reduce((s, m) => s + m.members.length, 0)} |`,
      `| Coverage | ${result.coverage.overall}% |`,
      `| Files | ${result.artifacts.length} |`,
      `| Time | ${result.duration}ms |`,
    ].join("\n");

    // Write to step summary if available
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
      require("fs").appendFileSync(summaryFile, summary + "\n");
    }

    // Output errors as annotations
    // TODO: result.errors does not exist in GenerateResult, errors are handled during validation before generate.

    // Output warnings for low coverage modules
    for (const mod of result.docir.modules) {
      if (mod.coverage.overall < 50) {
        console.log(
          `::warning file=${mod.filePath}::Low doc coverage (${mod.coverage.overall}%) for ${mod.name}`
        );
      }
    }

    // Set output
    console.log(`::set-output name=coverage::${result.coverage.overall}`);
    console.log(`::set-output name=modules::${result.docir.modules.length}`);
  }
}

/**
 * JSON reporter for CI consumption
 */
export class JsonReporter implements Reporter {
  report(result: GenerateResult): void {
    console.log(
      JSON.stringify(
        {
          success: result.coverage.passed,
          stats: {
            duration: result.duration,
            modulesTotal: result.docir.modules.length,
            filesGenerated: result.artifacts.length,
          },
          errors: [], // Errors handled at validation/build time
          modules: result.docir.modules.map((m: any) => ({
            id: m.id,
            name: m.name,
            coverage: m.coverage.overall,
            undocumented: m.coverage.undocumented,
          })),
        },
        null,
        2
      )
    );
  }
}
