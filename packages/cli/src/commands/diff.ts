import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import {
  computeAggregateCoverage,
  loadConfig,
  Orchestrator,
  type DocIR,
  type Logger,
  type MemberNode,
  type ModuleNode,
} from "@docgen/core";

const execFileAsync = promisify(execFile);

interface DiffOptions {
  base: string;
  json?: boolean;
  failOnBreaking?: boolean;
}

export interface DiffChange {
  type: "module" | "member";
  name: string;
  path?: string;
  module?: string;
  field?: "signature" | "parameters" | "returnType" | "visibility";
  before?: string;
  after?: string;
}

export interface DiffReport {
  base: string;
  current: string;
  changes: {
    added: DiffChange[];
    removed: DiffChange[];
    modified: DiffChange[];
  };
  coverageDelta: {
    before: number;
    after: number;
    delta: number;
    modules: Array<{
      module: string;
      before: number;
      after: number;
      delta: number;
    }>;
  };
  breaking: boolean;
}

const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  success() {},
};

/** Compare the current DocIR snapshot with a Git ref without changing the active checkout. */
export async function diffCommand(options: DiffOptions): Promise<void> {
  const workDir = process.cwd();
  let temporaryRoot: string | undefined;

  try {
    await git(["rev-parse", "--show-toplevel"], workDir);
    const current = (await git(["rev-parse", "HEAD"], workDir)).trim();
    const currentDocIR = await createSnapshot(workDir);

    temporaryRoot = await mkdtemp(path.join(tmpdir(), "docgen-diff-"));
    const archivePath = path.join(temporaryRoot, "base.tar");
    const basePath = path.join(temporaryRoot, "base");
    await mkdir(basePath);
    await git(["archive", "--format=tar", `--output=${archivePath}`, options.base], workDir);
    await execFileAsync("tar", ["-xf", archivePath, "-C", basePath], {
      cwd: workDir,
      windowsHide: true,
    });
    await symlink(
      path.join(workDir, "node_modules"),
      path.join(basePath, "node_modules"),
      process.platform === "win32" ? "junction" : "dir"
    );
    const baseDocIR = await createSnapshot(basePath);
    const report = buildDiffReport(options.base, current, baseDocIR, currentDocIR);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      outputHuman(report);
    }

    if (options.failOnBreaking && report.breaking) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`RepoScribe diff failed: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    if (temporaryRoot) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}

async function createSnapshot(workDir: string): Promise<DocIR> {
  const config = loadConfig(workDir);
  const orchestrator = new Orchestrator({ config, workDir, logger: silentLogger });
  const docir = await orchestrator.snapshot();
  return {
    ...docir,
    modules: docir.modules.map((module) => ({
      ...module,
      filePath: normalizeModulePath(module.filePath, workDir),
      members: module.members.map((member) => ({
        ...member,
        signature: normalizeTypeText(member.signature, workDir),
        parameters: member.parameters.map((parameter) => ({
          ...parameter,
          type: {
            ...parameter.type,
            raw: normalizeTypeText(parameter.type.raw, workDir),
          },
        })),
        returnType: member.returnType
          ? {
              ...member.returnType,
              raw: normalizeTypeText(member.returnType.raw, workDir),
            }
          : null,
      })),
    })),
  };
}

async function git(args: string[], cwd: string): Promise<string> {
  const result = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  return result.stdout;
}

/** Build the documented JSON diff schema from two DocIR snapshots. */
export function buildDiffReport(
  base: string,
  current: string,
  before: DocIR,
  after: DocIR
): DiffReport {
  const added: DiffChange[] = [];
  const removed: DiffChange[] = [];
  const modified: DiffChange[] = [];
  const beforeModules = new Map(before.modules.map((module) => [moduleKey(module), module]));
  const afterModules = new Map(after.modules.map((module) => [moduleKey(module), module]));

  for (const [id, module] of afterModules) {
    const previous = beforeModules.get(id);
    if (!previous) {
      added.push({ type: "module", name: module.name, path: module.filePath });
      continue;
    }
    diffMembers(previous, module, added, removed, modified);
  }

  for (const [id, module] of beforeModules) {
    if (!afterModules.has(id)) {
      removed.push({ type: "module", name: module.name, path: module.filePath });
    }
  }

  const beforeCoverage = computeAggregateCoverage(before.modules).overall;
  const afterCoverage = computeAggregateCoverage(after.modules).overall;
  const modules = sharedCoverageChanges(beforeModules, afterModules);
  const breaking =
    removed.some((change) => change.type === "module" || isPublicMemberChange(change, beforeModules)) ||
    modified.some((change) => isBreakingModification(change, beforeModules));

  return {
    base,
    current,
    changes: { added, removed, modified },
    coverageDelta: {
      before: beforeCoverage,
      after: afterCoverage,
      delta: afterCoverage - beforeCoverage,
      modules,
    },
    breaking,
  };
}

function diffMembers(
  before: ModuleNode,
  after: ModuleNode,
  added: DiffChange[],
  removed: DiffChange[],
  modified: DiffChange[]
): void {
  const previousMembers = new Map(before.members.map((member) => [memberKey(member), member]));
  const currentMembers = new Map(after.members.map((member) => [memberKey(member), member]));

  for (const [key, member] of currentMembers) {
    const previous = previousMembers.get(key);
    if (!previous) {
      added.push(memberChange(after, member));
      continue;
    }
    compareField("signature", previous.signature, member.signature);
    compareField("parameters", formatParameters(previous), formatParameters(member));
    compareField("returnType", previous.returnType?.raw ?? "", member.returnType?.raw ?? "");
    compareField("visibility", previous.visibility, member.visibility);

    function compareField(field: DiffChange["field"], oldValue: string, newValue: string): void {
      if (oldValue !== newValue) {
        modified.push({
          ...memberChange(after, member),
          field,
          before: oldValue,
          after: newValue,
        });
      }
    }
  }

  for (const [key, member] of previousMembers) {
    if (!currentMembers.has(key)) {
      removed.push(memberChange(before, member));
    }
  }
}

function memberKey(member: MemberNode): string {
  return `${member.kind}:${member.name}`;
}

function moduleKey(module: ModuleNode): string {
  return `${module.filePath.replace(/\\/g, "/")}:${module.kind}:${module.name}`;
}

function normalizeModulePath(filePath: string, workDir: string): string {
  const relative = path.isAbsolute(filePath)
    ? path.relative(workDir, filePath)
    : filePath;
  return path.normalize(relative);
}

function normalizeTypeText(value: string, workDir: string): string {
  const forwardRoot = workDir.replace(/\\/g, "/");
  return value
    .split(forwardRoot)
    .join("<root>")
    .replace(/import\("[A-Za-z]:\/[^"]+\/(packages|node_modules)\//g, 'import("<root>/$1/')
    .replace(/node_modules\/\.pnpm\/[^/]+\/node_modules\//g, "node_modules/");
}

function memberChange(module: ModuleNode, member: MemberNode): DiffChange {
  return {
    type: "member",
    name: `${module.name}.${member.name}`,
    module: module.name,
  };
}

function formatParameters(member: MemberNode): string {
  return `(${member.parameters
    .map((parameter) => `${parameter.name}${parameter.isOptional ? "?" : ""}: ${parameter.type.raw}`)
    .join(", ")})`;
}

function sharedCoverageChanges(
  before: Map<string, ModuleNode>,
  after: Map<string, ModuleNode>
): DiffReport["coverageDelta"]["modules"] {
  const changes: DiffReport["coverageDelta"]["modules"] = [];
  for (const [id, current] of after) {
    const previous = before.get(id);
    if (previous && previous.coverage.overall !== current.coverage.overall) {
      changes.push({
        module: current.name,
        before: previous.coverage.overall,
        after: current.coverage.overall,
        delta: current.coverage.overall - previous.coverage.overall,
      });
    }
  }
  return changes;
}

function isPublicMemberChange(
  change: DiffChange,
  modules: Map<string, ModuleNode>
): boolean {
  return Array.from(modules.values()).some(
    (module) =>
      module.name === change.module &&
      module.members.some(
        (member) =>
          `${module.name}.${member.name}` === change.name &&
          (member.visibility === "public" || member.visibility === "internal")
      )
  );
}

function isBreakingModification(
  change: DiffChange,
  modules: Map<string, ModuleNode>
): boolean {
  return (
    change.field !== "visibility" &&
    isPublicMemberChange(change, modules)
  ) || (
    change.field === "visibility" &&
    (change.before === "public" || change.before === "internal") &&
    change.after !== "public" &&
    change.after !== "internal"
  );
}

function outputHuman(report: DiffReport): void {
  console.log(`Documentation diff: ${report.base} -> ${report.current}`);
  printChanges("Added", report.changes.added);
  printChanges("Removed", report.changes.removed);
  printChanges("Changed", report.changes.modified);
  console.log(
    `Coverage: ${report.coverageDelta.before}% -> ${report.coverageDelta.after}% ` +
      `(${report.coverageDelta.delta >= 0 ? "+" : ""}${report.coverageDelta.delta}%)`
  );
  console.log(`Breaking changes: ${report.breaking ? "yes" : "no"}`);
}

function printChanges(label: string, changes: DiffChange[]): void {
  console.log(`\n${label} (${changes.length})`);
  for (const change of changes) {
    const detail = change.field
      ? ` [${change.field}: ${change.before} -> ${change.after}]`
      : "";
    console.log(`  ${change.type}: ${change.name}${detail}`);
  }
}
