import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyCoverage, createEmptyDocIR, type DocIR, type ModuleNode } from "@docgen/core";

// AUDIT-001 / RS-09: `repo-scribe diff --fail-on-breaking` is the CI gate for API compatibility, so its
// exit code must be exactly: 1 when the change is breaking and the flag is set, otherwise unchanged.
// Git, tar, the filesystem and the documentation snapshots are replaced so only the command's own
// decisions are under test; `buildDiffReport` itself is covered in diff.test.ts.

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  mkdtemp: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  symlink: vi.fn(),
  snapshots: new Map<string, unknown>(),
  snapshotted: [] as string[],
}));

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mocks.execFile(...args),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: (...args: unknown[]) => mocks.mkdir(...args),
  mkdtemp: (...args: unknown[]) => mocks.mkdtemp(...args),
  rm: (...args: unknown[]) => mocks.rm(...args),
  symlink: (...args: unknown[]) => mocks.symlink(...args),
}));

vi.mock("@docgen/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@docgen/core")>()),
  loadConfig: () => ({}),
  Orchestrator: class {
    constructor(private readonly options: { workDir: string }) {}

    async snapshot() {
      mocks.snapshotted.push(this.options.workDir);
      return mocks.snapshots.get(this.options.workDir === process.cwd() ? "current" : "base");
    }
  },
}));

import { diffCommand } from "./diff";

const TEMP_ROOT = "/tmp/docgen-diff-test";

describe("diffCommand exit code", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let savedExitCode: typeof process.exitCode;
  let failingCommand: string | undefined;

  beforeEach(() => {
    savedExitCode = process.exitCode;
    process.exitCode = undefined;
    failingCommand = undefined;
    mocks.snapshotted.length = 0;
    mocks.mkdtemp.mockReset().mockResolvedValue(TEMP_ROOT);
    mocks.mkdir.mockReset().mockResolvedValue(undefined);
    mocks.rm.mockReset().mockResolvedValue(undefined);
    mocks.symlink.mockReset().mockResolvedValue(undefined);
    mocks.execFile.mockReset().mockImplementation(
      (file: string, args: string[], _options: unknown, callback: (error: Error | null, result?: unknown) => void) => {
        const command = file === "git" ? `git ${args[0]}` : file;
        if (command === failingCommand) {
          callback(new Error(`${command} failed`));
          return;
        }
        const stdout = file === "git" && args[0] === "rev-parse" && args[1] === "HEAD" ? "abc123\n" : "";
        callback(null, { stdout, stderr: "" });
      }
    );
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  /** The base ref has module "Api"; the current tree does not, so the module removal is breaking. */
  function breakingChange(): void {
    mocks.snapshots.set("base", documentWith([moduleNode("api", "Api")]));
    mocks.snapshots.set("current", documentWith([]));
  }

  function noChange(): void {
    mocks.snapshots.set("base", documentWith([moduleNode("api", "Api")]));
    mocks.snapshots.set("current", documentWith([moduleNode("api", "Api")]));
  }

  const printedReport = (): { breaking: boolean; base: string; current: string } =>
    JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));

  it("exits 1 when the change is breaking and --fail-on-breaking is set", async () => {
    breakingChange();
    await diffCommand({ base: "main", json: true, failOnBreaking: true });

    expect(process.exitCode).toBe(1);
    expect(printedReport()).toMatchObject({ breaking: true, base: "main", current: "abc123" });
  });

  it("still reports a breaking change but leaves the exit code alone without the flag", async () => {
    breakingChange();
    await diffCommand({ base: "main", json: true });

    expect(process.exitCode).toBeUndefined();
    expect(printedReport().breaking).toBe(true);
  });

  it("does not fail a non-breaking change even when --fail-on-breaking is set", async () => {
    noChange();
    await diffCommand({ base: "main", json: true, failOnBreaking: true });

    expect(process.exitCode).toBeUndefined();
    expect(printedReport().breaking).toBe(false);
  });

  it("applies the same exit code in human-readable output", async () => {
    breakingChange();
    await diffCommand({ base: "main", failOnBreaking: true });

    expect(process.exitCode).toBe(1);
    expect(logSpy).toHaveBeenCalled();
  });

  it("compares the working tree with an archive of the requested ref, not by switching branches", async () => {
    noChange();
    await diffCommand({ base: "release/1.x", json: true });

    const gitCalls = mocks.execFile.mock.calls.filter(([file]) => file === "git").map(([, args]) => args as string[]);
    const archive = gitCalls.find((args) => args[0] === "archive");
    expect(archive).toContain("release/1.x");
    expect(gitCalls.some((args) => ["checkout", "switch", "reset", "stash"].includes(args[0]))).toBe(false);
    expect(mocks.snapshotted).toHaveLength(2);
  });

  it("exits 1 with a clear message and takes no snapshots when git fails", async () => {
    breakingChange();
    failingCommand = "git rev-parse";
    await diffCommand({ base: "main", json: true });

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("RepoScribe diff failed: git rev-parse failed");
    expect(mocks.snapshotted).toHaveLength(0);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("exits 1 when the base ref cannot be archived, and still removes the temporary directory", async () => {
    breakingChange();
    failingCommand = "git archive";
    await diffCommand({ base: "no-such-ref", json: true });

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("RepoScribe diff failed: git archive failed");
    expect(mocks.rm).toHaveBeenCalledWith(TEMP_ROOT, { recursive: true, force: true });
  });

  it("removes the temporary directory after a successful run", async () => {
    noChange();
    await diffCommand({ base: "main", json: true });

    expect(mocks.rm).toHaveBeenCalledTimes(1);
    expect(mocks.rm).toHaveBeenCalledWith(TEMP_ROOT, { recursive: true, force: true });
  });
});

function documentWith(modules: ModuleNode[]): DocIR {
  return { ...createEmptyDocIR({ name: "fixture" }), modules };
}

function moduleNode(id: string, name: string): ModuleNode {
  return {
    id,
    name,
    filePath: `src/${id}.ts`,
    language: "typescript",
    kind: "module",
    description: `${name} module`,
    tags: [],
    members: [],
    dependencies: [],
    examples: [],
    coverage: { ...createEmptyCoverage(), overall: 100 },
    decorators: [],
    typeParameters: [],
    sourceFacts: {} as ModuleNode["sourceFacts"],
  };
}
