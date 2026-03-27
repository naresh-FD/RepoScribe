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
});
