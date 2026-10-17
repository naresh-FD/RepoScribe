import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@docgen/core", async () => await import("../../core/src"));

// Each parse builds a ts-morph project; the first one in a cold process is slow.
vi.setConfig({ testTimeout: 30_000 });

// AUDIT-001 follow-up: `@param name - text` tags did not reach ParamNode.description, so RepoScribe's own
// validation listed every documented parameter as undocumented. These tests pin the intended behaviour.

const langConfig = {
  name: "typescript",
  source: "src",
  include: ["**/*.ts"],
  exclude: [],
  parser: "@docgen/parser-typescript",
  options: {},
};

describe("TypeScriptParser @param descriptions", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-param-docs-"));
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function parameters(source: string, memberName: string): Promise<Record<string, string>> {
    const file = path.join(dir, "src", "sample.ts");
    fs.writeFileSync(file, source);
    const { TypeScriptParser } = await import("./index");
    const docir = await new TypeScriptParser().parse([file], langConfig);
    const members = docir.modules.flatMap((module) => module.members);
    const member = members.find((candidate) => candidate.name === memberName);
    if (!member) throw new Error(`member ${memberName} not found in ${members.map((m) => m.name).join(", ")}`);
    return Object.fromEntries(member.parameters.map((parameter) => [parameter.name, parameter.description]));
  }

  it("reads a description written with a hyphen after the name", async () => {
    const result = await parameters(
      ["/**", " * Add.", " * @param a - The first number.", " * @param b - The second number.", " */",
        "export function add(a: number, b: number): number { return a + b; }"].join("\n"),
      "add"
    );
    expect(result).toEqual({ a: "The first number.", b: "The second number." });
  });

  it("reads a description written without a hyphen", async () => {
    const result = await parameters(
      ["/**", " * Add.", " * @param a The first number.", " */", "export function add(a: number): number { return a; }"].join("\n"),
      "add"
    );
    expect(result).toEqual({ a: "The first number." });
  });

  it("ignores a {type} annotation in the tag", async () => {
    const result = await parameters(
      ["/**", " * Add.", " * @param {number} a - The first number.", " */", "export function add(a: number): number { return a; }"].join("\n"),
      "add"
    );
    expect(result).toEqual({ a: "The first number." });
  });

  it("gives each parameter its own text when names share a prefix", async () => {
    const result = await parameters(
      ["/**", " * Find.", " * @param idx - The index.", " * @param id - The identifier.", " */",
        "export function find(id: string, idx: number): string { return id + idx; }"].join("\n"),
      "find"
    );
    expect(result).toEqual({ id: "The identifier.", idx: "The index." });
  });

  it("leaves an undocumented parameter empty instead of borrowing another tag", async () => {
    const result = await parameters(
      ["/**", " * Add.", " * @param a - The first number.", " */",
        "export function add(a: number, b: number): number { return a + b; }"].join("\n"),
      "add"
    );
    expect(result).toEqual({ a: "The first number.", b: "" });
  });

  it("keeps a multi-line description together", async () => {
    const result = await parameters(
      ["/**", " * Add.", " * @param a - The first number,", " *   which may be negative.", " */",
        "export function add(a: number): number { return a; }"].join("\n"),
      "add"
    );
    expect(result.a).toContain("The first number,");
    expect(result.a).toContain("which may be negative.");
  });

  it("reads descriptions on arrow functions assigned to a const", async () => {
    const result = await parameters(
      ["/**", " * Double.", " * @param n - The number to double.", " */",
        "export const double = (n: number): number => n * 2;"].join("\n"),
      "double"
    );
    expect(result).toEqual({ n: "The number to double." });
  });

  it("reads descriptions on class methods", async () => {
    const result = await parameters(
      ["export class Calculator {", "  /**", "   * Add.", "   * @param a - Left side.", "   * @param b - Right side.", "   */",
        "  add(a: number, b: number): number { return a + b; }", "}"].join("\n"),
      "add"
    );
    expect(result).toEqual({ a: "Left side.", b: "Right side." });
  });
});
