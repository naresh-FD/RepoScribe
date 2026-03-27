#!/usr/bin/env node

import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = process.cwd();

cleanOutput(path.join(targetRoot, "docs", "generated"));
cleanOutput(path.join(targetRoot, "docs", "pdf"));

run("npm", ["run", "build"], packageRoot);
run(
  "node",
  [path.join(packageRoot, "scripts", "run-docgen.cjs"), "generate", "--format", "markdown", "pdf"],
  targetRoot
);

function cleanOutput(target) {
  rmSync(target, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

