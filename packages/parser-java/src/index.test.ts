import * as path from "node:path";
import { DocGenConfigSchema, createSilentLogger, type PluginConfig } from "@docgen/core";
import { describe, expect, it } from "vitest";
import { JavaParser } from "./index";

/** A real, schema-validated config and a silent logger, so the tests need no type casts. */
function pluginConfig(workDir: string): PluginConfig {
  return {
    projectConfig: DocGenConfigSchema.parse({
      project: { name: "Demo" },
      languages: [{ name: "java", source: "src", parser: "@docgen/parser-java" }],
    }),
    workDir,
    options: {},
    logger: createSilentLogger(),
  };
}

describe("JavaParser", () => {
  it("parses plain Java types and Spring REST endpoint metadata", async () => {
    const fixtureRoot = path.join(process.cwd(), "src", "__fixtures__");
    const parser = new JavaParser();
    await parser.initialize(pluginConfig(fixtureRoot));

    const docir = await parser.parse(
      [
        path.join(fixtureRoot, "PlainUser.java"),
        path.join(fixtureRoot, "UserController.java"),
      ],
      {}
    );

    const plain = docir.modules.find((module) => module.name === "PlainUser");
    expect(plain).toEqual(
      expect.objectContaining({
        id: "com.example.model.PlainUser",
        kind: "class",
        description: "Represents an application user.",
      })
    );
    expect(plain?.members.find((member) => member.name === "getId")).toEqual(
      expect.objectContaining({
        visibility: "public",
        returnType: expect.objectContaining({ raw: "String" }),
        endpoint: undefined,
      })
    );

    const controller = docir.modules.find((module) => module.name === "UserController");
    expect(controller?.decorators.map((decorator) => decorator.name)).toEqual([
      "RestController",
      "RequestMapping",
    ]);
    expect(controller?.members.find((member) => member.name === "getUser")?.endpoint)
      .toMatchInlineSnapshot(`
        {
          "httpMethod": "GET",
          "path": "/api/users/{id}",
          "pathVariables": [
            {
              "name": "id",
              "required": true,
              "type": {
                "isArray": false,
                "isNullable": false,
                "isUnion": false,
                "name": "String",
                "raw": "String",
                "typeArguments": undefined,
              },
            },
          ],
          "queryParameters": [
            {
              "defaultValue": "false",
              "name": "verbose",
              "required": false,
              "type": {
                "isArray": false,
                "isNullable": false,
                "isUnion": false,
                "name": "boolean",
                "raw": "boolean",
                "typeArguments": undefined,
              },
            },
          ],
          "requestBody": null,
          "responseType": {
            "isArray": false,
            "isNullable": false,
            "isUnion": false,
            "name": "UserDto",
            "raw": "UserDto",
            "typeArguments": undefined,
          },
        }
      `);
    expect(controller?.members.find((member) => member.name === "create")?.endpoint)
      .toEqual(expect.objectContaining({
        httpMethod: "POST",
        path: "/api/users",
        requestBody: expect.objectContaining({ raw: "CreateUserRequest" }),
      }));
  });

  it("attaches Javadoc @param text to each parameter (AUDIT-001 / RS-05)", async () => {
    const fixtureRoot = path.join(process.cwd(), "src", "__fixtures__");
    const parser = new JavaParser();
    await parser.initialize(pluginConfig(fixtureRoot));

    const docir = await parser.parse([path.join(fixtureRoot, "DocumentedService.java")], {});
    const service = docir.modules.find((module) => module.name === "DocumentedService");
    const describe = (member: string) =>
      Object.fromEntries(
        (service?.members.find((candidate) => candidate.name === member)?.parameters ?? []).map((parameter) => [
          parameter.name,
          parameter.description,
        ])
      );

    expect(describe("add")).toEqual({ a: "the first addend", b: "the second addend - added to the first" });
    expect(describe("DocumentedService")).toEqual({ repository: "where the values are stored" });
    expect(describe("join")).toEqual({ parts: "the parts to join" });
    expect(describe("undocumented")).toEqual({ x: "" });
  });

  it("reports a varargs parameter under its own name and as an array of its element type", async () => {
    const fixtureRoot = path.join(process.cwd(), "src", "__fixtures__");
    const parser = new JavaParser();
    await parser.initialize(pluginConfig(fixtureRoot));

    const docir = await parser.parse([path.join(fixtureRoot, "DocumentedService.java")], {});
    const join = docir.modules[0]?.members.find((member) => member.name === "join");

    expect(join?.parameters).toHaveLength(1);
    expect(join?.parameters[0]).toMatchObject({
      name: "parts",
      isRest: true,
      type: { raw: "String[]", name: "String", isArray: true },
    });
  });

  it("keeps the @param tags on the member as well", async () => {
    const fixtureRoot = path.join(process.cwd(), "src", "__fixtures__");
    const parser = new JavaParser();
    await parser.initialize(pluginConfig(fixtureRoot));

    const docir = await parser.parse([path.join(fixtureRoot, "DocumentedService.java")], {});
    const add = docir.modules[0]?.members.find((member) => member.name === "add");

    expect(add?.tags.filter((tag) => tag.tag === "param").map((tag) => tag.name)).toEqual(["a", "b", "ghost"]);
    expect(add?.parameters.map((parameter) => parameter.name)).toEqual(["a", "b"]);
  });
});
