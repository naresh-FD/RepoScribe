/**
 * Reporters
 *
 * Format pipeline output for different environments.
 */

import chalk from "chalk";
import { PipelineResult } from "@docgen/core";

export interface Reporter {
  report(result: PipelineResult): void;
}

/**
 * GitHub Actions reporter — outputs annotations
 */
export class GitHubActionsReporter implements Reporter {
  report(result: PipelineResult): void {
    // Output stats as step summary
    const summary = [
      "## DocGen Report",
      "",
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Modules | ${result.stats.modulesTotal} |`,
      `| Members | ${result.stats.membersTotal} |`,
      `| Coverage | ${result.stats.coverageAverage}% |`,
      `| Files | ${result.stats.filesGenerated} |`,
      `| Time | ${result.stats.totalTimeMs}ms |`,
    ].join("\n");

    // Write to step summary if available
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
      require("fs").appendFileSync(summaryFile, summary + "\n");
    }

    // Output errors as annotations
    for (const err of result.errors) {
      console.log(`::error title=DocGen ${err.phase}::${err.message}`);
    }

    // Output warnings for low coverage modules
    for (const mod of result.ir.modules) {
      if (mod.coverage.total < 50) {
        console.log(
          `::warning file=${mod.filePath}::Low doc coverage (${mod.coverage.total}%) for ${mod.name}`
        );
      }
    }

    // Set output
    console.log(`::set-output name=coverage::${result.stats.coverageAverage}`);
    console.log(`::set-output name=modules::${result.stats.modulesTotal}`);
  }
}

/**
 * JSON reporter for CI consumption
 */
export class JsonReporter implements Reporter {
  report(result: PipelineResult): void {
    console.log(
      JSON.stringify(
        {
          success: result.success,
          stats: result.stats,
          errors: result.errors,
          modules: result.ir.modules.map((m) => ({
            id: m.id,
            name: m.name,
            coverage: m.coverage.total,
            undocumented: m.coverage.undocumented,
          })),
        },
        null,
        2
      )
    );
  }
}
