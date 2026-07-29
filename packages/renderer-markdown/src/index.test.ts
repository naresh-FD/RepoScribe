import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../dist/index.js";
import {
  DocGenConfigSchema,
  createDefaultSourceFacts,
  createEmptyCoverage,
  createEmptyDocIR,
  type DocumentationPage,
  type DocumentationPlan,
  type ModuleNode,
} from "../../core/src";

function createModule(): ModuleNode {
  return {
    id: "src.features.auth.LoginPage",
    name: "LoginPage",
    filePath: "src/features/auth/LoginPage.tsx",
    language: "typescript",
    kind: "function",
    description: "Route entry for the auth feature.",
    tags: [],
    members: [],
    dependencies: [],
    examples: [],
    coverage: createEmptyCoverage(),
    decorators: [],
    typeParameters: [],
    exports: { isDefault: false, isNamed: true, exportedName: "LoginPage" },
    sourceFacts: createDefaultSourceFacts({ fileRole: "feature", featureKey: "auth" }),
  };
}

function createPage(filePath: string, title: string): DocumentationPage {
  return {
    filePath,
    title,
    summary: `${title} summary`,
    moduleIds: ["src.features.auth.LoginPage"],
    sourcePaths: ["src/features/auth/LoginPage.tsx"],
    sections: [
      {
        heading: "Overview",
        paragraphs: ["Overview paragraph"],
        bullets: ["Key point"],
        codeBlocks: [],
      },
    ],
  };
}

function createPlan(): DocumentationPlan {
  return {
    mode: "developer",
    project: {
      name: "demo",
      summary: "Demo project",
      sourceRoots: ["src"],
      techStack: ["React", "TypeScript"],
      setupSteps: ["npm install", "npm run dev"],
      importantScripts: [],
      envFiles: [],
      envVars: [],
    },
    pages: {
      readme: createPage("README.md", "Demo"),
      architecture: createPage("architecture.md", "Architecture Overview"),
      projectStructure: createPage("project-structure.md", "Project Structure Guide"),
      setup: createPage("setup.md", "Setup Guide"),
      features: [
        {
          ...createPage("features/auth.md", "Auth Feature"),
          featureKey: "auth",
        },
      ],
      api: createPage("api/services.md", "API and Service Layer"),
      components: createPage("components/reusable-components.md", "Reusable Components"),
      state: createPage("state/state-management.md", "State Management Guide"),
      testing: createPage("testing/testing-guide.md", "Testing Guide"),
      troubleshooting: createPage("troubleshooting.md", "Troubleshooting"),
    },
  };
}

describe("MarkdownRenderer", () => {
  it("renders curated developer docs from the documentation plan", async () => {
    const renderer = new MarkdownRenderer();
    const config = DocGenConfigSchema.parse({
      project: { name: "demo" },
      languages: [{ name: "typescript", source: "src", parser: "@docgen/parser-typescript" }],
    });
    await renderer.initialize({
      projectConfig: config,
      workDir: process.cwd(),
      options: {},
      logger: console as any,
    });

    const docir = createEmptyDocIR({ name: "demo", languages: ["typescript"] });
    docir.modules = [createModule()];
    docir.documentationPlan = createPlan();

    const artifacts = await renderer.render(docir, config.output);
    const filePaths = artifacts.map((artifact) => artifact.filePath);

    expect(filePaths).toContain("README.md");
    expect(filePaths).toContain("architecture.md");
    expect(filePaths).toContain("features/auth.md");
    expect(filePaths).toContain("api/services.md");
    expect(artifacts.find((artifact) => artifact.filePath === "README.md")?.content).toContain(
      "Documentation Map"
    );
  });

  it("keeps exhaustive output as per-module markdown", async () => {
    const renderer = new MarkdownRenderer();
    const config = DocGenConfigSchema.parse({
      project: { name: "demo" },
      languages: [{ name: "typescript", source: "src", parser: "@docgen/parser-typescript" }],
      documentation: { mode: "exhaustive" },
    });
    await renderer.initialize({
      projectConfig: config,
      workDir: process.cwd(),
      options: {},
      logger: console as any,
    });

    const docir = createEmptyDocIR({ name: "demo", languages: ["typescript"] });
    docir.modules = [createModule()];

    const artifacts = await renderer.render(docir, config.output);
    expect(artifacts.map((artifact) => artifact.filePath)).toContain("typescript/LoginPage.md");
  });

  it("renders React props and hook sections", async () => {
    const renderer = new MarkdownRenderer();
    const config = DocGenConfigSchema.parse({
      project: { name: "demo" },
      languages: [{ name: "typescript", source: "src", parser: "@docgen/parser-typescript" }],
      documentation: { mode: "exhaustive" },
    });
    await renderer.initialize({
      projectConfig: config,
      workDir: process.cwd(),
      options: {},
      logger: console as any,
    });

    const module = createModule();
    module.react = {
      component: {
        componentType: "function",
        propsType: "LoginProps",
        props: [{
          name: "label",
          type: {
            raw: "string",
            name: "string",
            isArray: false,
            isNullable: false,
            isUnion: false,
          },
          required: true,
          defaultValue: '"Sign in"',
          description: "Button label.",
        }],
        state: [],
      },
      hook: {
        dependencies: ["useState"],
        returnShape: "tuple",
        tupleElements: [{
          raw: "boolean",
          name: "boolean",
          isArray: false,
          isNullable: false,
          isUnion: false,
        }],
      },
    };
    const docir = createEmptyDocIR({ name: "demo", languages: ["typescript"] });
    docir.modules = [module];

    const artifacts = await renderer.render(docir, config.output);
    const content = String(
      artifacts.find((artifact) => artifact.filePath === "typescript/LoginPage.md")?.content
    );
    expect(
      content
        .split("\n")
        .filter((line) =>
          line.includes("Props") ||
          line.includes("label") ||
          line.includes("Hook Signature") ||
          line.includes("Hook dependencies") ||
          line.includes("Tuple elements")
        )
    ).toMatchInlineSnapshot(`
      [
        "## Props",
        "**Props type:** \`LoginProps\`",
        "| \`label\` | \`string\` | Yes | \`"Sign in"\` | Button label. |",
        "## Hook Signature",
        "**Tuple elements:** \`0: boolean\`",
        "**Hook dependencies:** \`useState\`",
      ]
    `);
  });

  it("renders Spring endpoints as endpoint tables", async () => {
    const renderer = new MarkdownRenderer();
    const config = DocGenConfigSchema.parse({
      project: { name: "demo" },
      languages: [{ name: "java", source: "src", parser: "@docgen/parser-java" }],
      documentation: { mode: "exhaustive" },
    });
    await renderer.initialize({
      projectConfig: config,
      workDir: process.cwd(),
      options: {},
      logger: console as any,
    });
    const module = createModule();
    module.language = "java";
    module.name = "UserController";
    module.id = "com.example.UserController";
    module.members = [{
      name: "getUser",
      kind: "method",
      visibility: "public",
      isStatic: false,
      isAbstract: false,
      isAsync: false,
      signature: "public UserDto getUser(String id)",
      description: "Finds a user.",
      parameters: [],
      returnType: null,
      throws: [],
      tags: [],
      examples: [],
      deprecated: null,
      decorators: [],
      endpoint: {
        httpMethod: "GET",
        path: "/api/users/{id}",
        pathVariables: [{
          name: "id",
          type: { raw: "String", name: "String", isArray: false, isNullable: false, isUnion: false },
          required: true,
        }],
        queryParameters: [],
        requestBody: null,
        responseType: {
          raw: "UserDto",
          name: "UserDto",
          isArray: false,
          isNullable: false,
          isUnion: false,
        },
      },
    }];
    const docir = createEmptyDocIR({ name: "demo", languages: ["java"] });
    docir.modules = [module];

    const artifact = (await renderer.render(docir, config.output))
      .find((item) => item.filePath === "java/UserController.md");
    expect(
      String(artifact?.content)
        .split("\n")
        .filter((line) =>
          line.includes("REST Endpoint") ||
          line.startsWith("| Method") ||
          line.startsWith("| GET")
        )
    ).toMatchInlineSnapshot(`
      [
        "**REST Endpoint:**",
        "| Method | Path | Path variables | Query parameters | Request body | Response |",
        "| GET | \`/api/users/{id}\` | \`id: String\` | — | — | \`UserDto\` |",
      ]
    `);
  });
});
