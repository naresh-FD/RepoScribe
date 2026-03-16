#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init";
import { generateCommand } from "./commands/generate";
import { validateCommand } from "./commands/validate";
import { adrCommand } from "./commands/adr";
import { diffCommand } from "./commands/diff";

const program = new Command();

program
  .name("docgen")
  .description("Documentation generator for React and Java Spring Boot projects")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize DocGen in the current project")
  .option("--force", "Overwrite existing .docgen.yaml", false)
  .action(initCommand);

program
  .command("generate")
  .description("Generate documentation from source code")
  .option("-f, --format <formats...>", "Output format(s): markdown, html, pdf, confluence")
  .option("-o, --output <dir>", "Override output directory")
  .option("--json", "Output result as JSON (for CI pipelines)")
  .option("-v, --verbose", "Enable verbose logging", false)
  .option("-w, --watch", "Watch for changes and regenerate", false)
  .action(generateCommand);

program
  .command("validate")
  .description("Validate documentation coverage without generating output")
  .option("--json", "Output result as JSON (for CI pipelines)")
  .option("--threshold <number>", "Override coverage threshold", parseInt)
  .option("-v, --verbose", "Enable verbose logging", false)
  .action(validateCommand);

program
  .command("diff")
  .description("Show documentation changes since last generation")
  .option("--base <ref>", "Git ref to compare against", "HEAD~1")
  .option("--json", "Output diff as JSON")
  .action(diffCommand);

program
  .command("adr")
  .description("Manage Architecture Decision Records")
  .argument("<action>", "Action: new, list, update")
  .argument("[title]", "ADR title (for 'new' action)")
  .option("-s, --status <status>", "ADR status", "proposed")
  .action(adrCommand);

program.parse();
