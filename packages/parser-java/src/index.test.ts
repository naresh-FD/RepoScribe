import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { JavaParser } from "./index";

describe("JavaParser", () => {
  it("parses plain Java types and Spring REST endpoint metadata", async () => {
    const fixtureRoot = path.join(process.cwd(), "src", "__fixtures__");
    const parser = new JavaParser();
    await parser.initialize({
      projectConfig: {} as any,
      workDir: fixtureRoot,
      options: {},
      logger: console as any,
    });

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
});
