import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@docgen/core", async () => await import("../../core/src"));

// AUDIT-001 / RS-07: the parser caches parsed modules per file, keyed on modification time and size,
// so watch mode does not re-parse files that have not changed. `parseSourceFile` is the expensive step;
// spying on it shows exactly when a file is parsed and when it is served from the cache.

const langConfig = {
  name: "typescript",
  source: "src",
  include: ["**/*.ts"],
  exclude: [],
  parser: "@docgen/parser-typescript",
  options: {},
};

describe("TypeScriptParser module cache", () => {
  let dir: string;
  let a: string;
  let b: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-parser-cache-"));
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    a = path.join(dir, "src", "a.ts");
    b = path.join(dir, "src", "b.ts");
    fs.writeFileSync(a, "export function alpha() { return 1; }\n");
    fs.writeFileSync(b, "export function bravo() { return 2; }\n");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function newParser() {
    const { TypeScriptParser } = await import("./index");
    const spy = vi.spyOn(TypeScriptParser.prototype as never, "parseSourceFile");
    return { parser: new TypeScriptParser(), spy };
  }

  const names = (docir: { modules: Array<{ name: string }> }) => docir.modules.map((module) => module.name).sort();

  it("parses each file once, then serves unchanged files from the cache", async () => {
    const { parser, spy } = await newParser();

    const first = await parser.parse([a, b], langConfig);
    expect(spy).toHaveBeenCalledTimes(2);

    const second = await parser.parse([a, b], langConfig);
    expect(spy).toHaveBeenCalledTimes(2); // no further parsing
    expect(names(second)).toEqual(["alpha", "bravo"]);
    expect(second.modules).toEqual(first.modules);
  });

  it("re-parses only the file that changed and reports its new content", async () => {
    const { parser, spy } = await newParser();
    await parser.parse([a, b], langConfig);

    fs.writeFileSync(b, "export function bravoRenamed() { return 22; }\n");
    const docir = await parser.parse([a, b], langConfig);

    expect(spy).toHaveBeenCalledTimes(3); // a from cache, b parsed again
    expect(names(docir)).toEqual(["alpha", "bravoRenamed"]);
  });

  it("treats a changed modification time as a change even when the size is the same", async () => {
    const { parser, spy } = await newParser();
    await parser.parse([a], langConfig);

    fs.writeFileSync(a, "export function omega() { return 1; }\n"); // same length as before
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(a, later, later);
    const docir = await parser.parse([a], langConfig);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(names(docir)).toEqual(["omega"]);
  });

  it("forgets files that are no longer in the file list", async () => {
    const { parser, spy } = await newParser();
    await parser.parse([a, b], langConfig);
    await parser.parse([a], langConfig); // b leaves the list: its entry is evicted
    expect(spy).toHaveBeenCalledTimes(2);

    await parser.parse([a, b], langConfig); // b returns: parsed again, not served from a stale entry
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("hands out copies, so changing a result cannot corrupt the cache", async () => {
    const { parser } = await newParser();
    const first = await parser.parse([a], langConfig);
    first.modules[0].name = "tampered";

    const second = await parser.parse([a], langConfig);

    expect(names(second)).toEqual(["alpha"]);
  });
});
