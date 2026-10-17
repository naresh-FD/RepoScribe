import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adrCommand } from "./adr";

// AUDIT-001 / RS-14: the `adr` command had no tests. These pin what it does today.

describe("adrCommand", () => {
  let dir: string;
  let log: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "reposcribe-adr-"));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const decisions = () => path.join(dir, "docs", "decisions");
  const output = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((call) => call.join(" ")).join("\n");

  describe("new", () => {
    it("creates ADR-001 in docs/decisions with the title, status and today's date", async () => {
      await adrCommand("new", "Use PostgreSQL", { status: "proposed" });

      const files = fs.readdirSync(decisions());
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^ADR-001-use-postgresql/);
      const content = fs.readFileSync(path.join(decisions(), files[0]), "utf-8");
      expect(content).toContain("# ADR-001: Use PostgreSQL");
      expect(content).toMatch(/## Status\s+proposed/);
      expect(content).toMatch(/## Date\s+2026-03-04/);
      for (const heading of ["## Context", "## Decision", "## Consequences", "## Related"]) {
        expect(content).toContain(heading);
      }
      expect(output(log)).toContain("Created:");
    });

    it("uses the status it is given", async () => {
      await adrCommand("new", "Adopt React", { status: "accepted" });

      const [file] = fs.readdirSync(decisions());
      expect(fs.readFileSync(path.join(decisions(), file), "utf-8")).toMatch(/## Status\s+accepted/);
    });

    it("numbers the next ADR after the existing ones and builds a lowercase hyphenated file name", async () => {
      await adrCommand("new", "First", { status: "proposed" });
      await adrCommand("new", "Use PostgreSQL for data", { status: "proposed" });

      const files = fs.readdirSync(decisions()).sort();
      expect(files[1]).toMatch(/^ADR-002-use-postgresql-for-data/);
    });

    it("refuses to create an ADR without a title", async () => {
      await expect(adrCommand("new", undefined, { status: "proposed" })).rejects.toThrow("process.exit(1)");

      expect(output(error)).toContain("Title is required");
      expect(fs.existsSync(decisions())).toBe(false);
    });

    it("writes to adr.directory from .docgen.yaml when one is configured", async () => {
      fs.writeFileSync(
        path.join(dir, ".docgen.yaml"),
        [
          "project:",
          "  name: Demo",
          "languages:",
          "  - name: typescript",
          "    source: src",
          '    parser: "@docgen/parser-typescript"',
          "adr:",
          "  directory: records/adr",
          "",
        ].join("\n"),
      );

      await adrCommand("new", "Configured location", { status: "proposed" });

      expect(fs.readdirSync(path.join(dir, "records", "adr"))[0]).toMatch(/^ADR-001-configured-location/);
      expect(fs.existsSync(decisions())).toBe(false);
    });
  });

  describe("list", () => {
    it("explains how to create the first ADR when none exist", async () => {
      await adrCommand("list", undefined, { status: "proposed" });

      expect(output(log)).toContain("No ADRs found. Use 'docgen adr new <title>' to create one.");
    });

    it("lists each ADR with its status and title, sorted by file name, ignoring non-markdown files", async () => {
      await adrCommand("new", "Alpha", { status: "accepted" });
      await adrCommand("new", "Beta", { status: "proposed" });
      fs.writeFileSync(path.join(decisions(), "notes.txt"), "not an ADR");

      await adrCommand("list", undefined, { status: "proposed" });

      const text = output(log);
      expect(text).toContain("Architecture Decision Records (2):");
      expect(text.indexOf("ADR-001: Alpha")).toBeGreaterThan(-1);
      expect(text.indexOf("ADR-001: Alpha")).toBeLessThan(text.indexOf("ADR-002: Beta"));
      expect(text).toMatch(/accepted\s+# ADR-001: Alpha|accepted\s+ADR-001: Alpha/);
      expect(text).toMatch(/proposed\s+ADR-002: Beta/);
    });
  });

  describe("unsupported actions", () => {
    it("rejects `update`, which only the old help text advertised", async () => {
      await expect(adrCommand("update", undefined, { status: "proposed" })).rejects.toThrow("process.exit(1)");

      expect(output(error)).toContain("Unknown ADR action: update");
      expect(output(log)).toContain("Available actions: new, list");
    });
  });

  // The audit found that numbering used the file count, so gaps produced duplicate numbers.
  describe("numbering with gaps and other files", () => {
    const seed = (...names: string[]) => {
      fs.mkdirSync(decisions(), { recursive: true });
      for (const name of names) fs.writeFileSync(path.join(decisions(), name), `# ${name}\n`);
    };

    it("numbers after the highest existing number, not after the file count", async () => {
      seed("ADR-001-first.md", "ADR-003-third.md");

      await adrCommand("new", "Fourth", { status: "proposed" });

      expect(fs.readdirSync(decisions()).sort()).toEqual([
        "ADR-001-first.md",
        "ADR-003-third.md",
        "ADR-004-fourth.md",
      ]);
    });

    it("does not reuse a number after an earlier ADR was deleted", async () => {
      await adrCommand("new", "One", { status: "proposed" });
      await adrCommand("new", "Two", { status: "proposed" });
      fs.rmSync(path.join(decisions(), fs.readdirSync(decisions()).sort()[0]));

      await adrCommand("new", "Three", { status: "proposed" });

      expect(fs.readdirSync(decisions()).sort()).toEqual([
        expect.stringMatching(/^ADR-002-two/),
        expect.stringMatching(/^ADR-003-three/),
      ]);
    });

    it("keeps counting past three digits instead of truncating or repeating", async () => {
      seed("ADR-999-nine-nine-nine.md", "ADR-1000-one-thousand.md");

      await adrCommand("new", "Next", { status: "proposed" });

      expect(fs.readdirSync(decisions())).toContain("ADR-1001-next.md");
    });

    it("ignores files that are not numbered ADRs when choosing the number", async () => {
      seed("README.md", "ADR-template.md", "notes-2024.md", "ADR-002-real.md");

      await adrCommand("new", "After real", { status: "proposed" });

      expect(fs.readdirSync(decisions())).toContain("ADR-003-after-real.md");
      expect(fs.readdirSync(decisions())).toHaveLength(5);
    });

    it("starts at ADR-001 when the folder holds no numbered ADRs", async () => {
      seed("README.md");

      await adrCommand("new", "First", { status: "proposed" });

      expect(fs.readdirSync(decisions())).toContain("ADR-001-first.md");
    });

    it("never overwrites an existing file", async () => {
      seed("ADR-001-first.md");
      const before = fs.readFileSync(path.join(decisions(), "ADR-001-first.md"), "utf-8");

      await adrCommand("new", "First", { status: "proposed" });

      expect(fs.readFileSync(path.join(decisions(), "ADR-001-first.md"), "utf-8")).toBe(before);
      expect(fs.readdirSync(decisions())).toContain("ADR-002-first.md");
    });
  });
});
