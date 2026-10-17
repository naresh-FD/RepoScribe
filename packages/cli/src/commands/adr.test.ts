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

  // Known gap found by the audit. `todo` keeps it visible without a red run.
  it.todo("numbers a new ADR after the highest existing number, not after the file count (ADR-001 and ADR-003 present creates a second ADR-003)");
});
