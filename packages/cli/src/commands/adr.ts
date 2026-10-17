import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "@docgen/core";

interface AdrOptions {
  status: string;
}

export async function adrCommand(
  action: string,
  title: string | undefined,
  options: AdrOptions
): Promise<void> {
  const workDir = process.cwd();

  let adrDir: string;
  try {
    const config = loadConfig(workDir);
    adrDir = path.resolve(workDir, config.adr.directory);
  } catch {
    adrDir = path.resolve(workDir, "docs/decisions");
  }

  switch (action) {
    case "new":
      return createAdr(adrDir, title, options.status);
    case "list":
      return listAdrs(adrDir);
    default:
      console.error(`Unknown ADR action: ${action}`);
      console.log("Available actions: new, list");
      process.exit(1);
  }
}

/**
 * Choose the number for a new ADR: one more than the highest `ADR-<n>` file name.
 * Counting files would reuse a number after a deletion or a gap, and files that
 * are not numbered ADRs (a README, a template) must not affect the result.
 *
 * @param fileNames - Names of the files in the ADR directory.
 * @returns The number to give the next ADR; 1 when there are no numbered ADRs.
 */
export function nextAdrNumber(fileNames: string[]): number {
  let highest = 0;
  for (const name of fileNames) {
    const match = /^ADR-(\d+)/.exec(name);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

function createAdr(
  adrDir: string,
  title: string | undefined,
  status: string
): void {
  if (!title) {
    console.error("Error: Title is required. Usage: docgen adr new <title>");
    process.exit(1);
  }

  if (!fs.existsSync(adrDir)) {
    fs.mkdirSync(adrDir, { recursive: true });
  }

  const id = `ADR-${String(nextAdrNumber(fs.readdirSync(adrDir))).padStart(3, "0")}`;
  const fileName = `${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
  const filePath = path.join(adrDir, fileName);

  const content = `# ${id}: ${title}

## Status

${status}

## Date

${new Date().toISOString().split("T")[0]}

## Context

<!-- What is the issue that we're seeing that is motivating this decision or change? -->

## Decision

<!-- What is the change that we're proposing and/or doing? -->

## Consequences

<!-- What becomes easier or more difficult to do because of this change? -->

## Related

<!-- Links to related ADRs, issues, or documents -->
`;

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`Created: ${filePath}`);
}

function listAdrs(adrDir: string): void {
  if (!fs.existsSync(adrDir)) {
    console.log("No ADRs found. Use 'docgen adr new <title>' to create one.");
    return;
  }

  const files = fs.readdirSync(adrDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  if (files.length === 0) {
    console.log("No ADRs found.");
    return;
  }

  console.log(`\nArchitecture Decision Records (${files.length}):\n`);
  for (const file of files) {
    const content = fs.readFileSync(path.join(adrDir, file), "utf-8");
    const titleMatch = content.match(/^# (.+)$/m);
    const statusMatch = content.match(/^## Status\s+(\w+)/m);
    const title = titleMatch ? titleMatch[1] : file;
    const status = statusMatch ? statusMatch[1] : "unknown";
    console.log(`  ${status.padEnd(12)} ${title}`);
  }
  console.log();
}
