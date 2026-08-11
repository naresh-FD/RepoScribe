#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(repositoryRoot, "fixtures", "e2e");
const generatedRoot = path.join(fixtureRoot, "generated");
const runner = path.join(repositoryRoot, "scripts", "run-docgen.cjs");

rmSync(generatedRoot, { recursive: true, force: true });

try {
  const result = spawnSync(
    process.execPath,
    [runner, "generate", "--format", "html", "--json"],
    { cwd: fixtureRoot, encoding: "utf8", windowsHide: true }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "RepoScribe exited without output.");
  }

  const report = JSON.parse(result.stdout);
  const requiredFiles = [
    "html/index.html",
    "html/architecture.html",
    "html/assets/styles.css",
    "html/assets/app.js",
    "html/search-index.json",
  ];
  for (const relativePath of requiredFiles) {
    const target = path.join(generatedRoot, relativePath);
    if (!existsSync(target)) throw new Error(`Missing generated artifact: ${relativePath}`);
  }

  const architecture = readFileSync(path.join(generatedRoot, "html", "architecture.html"), "utf8");
  if (!architecture.includes('class="mermaid"')) {
    throw new Error("Architecture output does not contain a Mermaid diagram.");
  }
  if (report.modules < 3) {
    throw new Error(`Expected React and Java modules, received ${report.modules}.`);
  }

  console.log(`E2E generation passed: ${report.modules} modules, ${report.artifacts} HTML artifacts.`);
} finally {
  rmSync(generatedRoot, { recursive: true, force: true });
}
