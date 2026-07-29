import { describe, expect, it } from "vitest";
import { createEmptyCoverage, createEmptyDocIR, type DocIR, type MemberNode, type ModuleNode } from "@docgen/core";
import { buildDiffReport } from "./diff";

describe("buildDiffReport", () => {
  it("reports added, removed, and public signature changes", () => {
    const before = documentWith([
      moduleNode("api", "Api", [
        member("removed", "(value: string): string", "string"),
        member("changed", "(value: string): string", "string"),
      ], 80),
    ]);
    const after = documentWith([
      moduleNode("api", "Api", [
        member("changed", "(value: number): string", "string", "number"),
        member("added", "(): void", "void"),
      ], 90),
      moduleNode("extra", "Extra", [], 100),
    ]);

    const report = buildDiffReport("main", "abc123", before, after);

    expect(report.changes.added.map((change) => change.name)).toEqual([
      "Api.added",
      "Extra",
    ]);
    expect(report.changes.removed.map((change) => change.name)).toEqual([
      "Api.removed",
    ]);
    expect(report.changes.modified).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Api.changed", field: "signature" }),
        expect.objectContaining({ name: "Api.changed", field: "parameters" }),
      ])
    );
    expect(report.coverageDelta.modules).toEqual([
      { module: "Api", before: 80, after: 90, delta: 10 },
    ]);
    expect(report.breaking).toBe(true);
  });
});

function documentWith(modules: ModuleNode[]): DocIR {
  return { ...createEmptyDocIR({ name: "fixture" }), modules };
}

function moduleNode(
  id: string,
  name: string,
  members: MemberNode[],
  coverage: number
): ModuleNode {
  return {
    id,
    name,
    filePath: `src/${id}.ts`,
    language: "typescript",
    kind: "module",
    description: `${name} module`,
    tags: [],
    members,
    dependencies: [],
    examples: [],
    coverage: { ...createEmptyCoverage(), overall: coverage },
    decorators: [],
    typeParameters: [],
    sourceFacts: {} as ModuleNode["sourceFacts"],
  };
}

function member(
  name: string,
  signature: string,
  returnType: string,
  parameterType = "string"
): MemberNode {
  return {
    name,
    kind: "method",
    visibility: "public",
    isStatic: false,
    isAbstract: false,
    isAsync: false,
    signature,
    description: `${name} description`,
    parameters: signature.startsWith("()")
      ? []
      : [{
          name: "value",
          type: { raw: parameterType, name: parameterType },
          description: "A value.",
          isOptional: false,
          isRest: false,
        }],
    returnType: { raw: returnType, name: returnType },
    throws: [],
    tags: [],
    examples: [],
  };
}
