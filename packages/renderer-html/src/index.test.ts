import { describe, expect, it } from "vitest";
import {
  DocGenConfigSchema,
  createDefaultSourceFacts,
  createEmptyCoverage,
  createEmptyDocIR,
  type DocumentationPage,
  type DocumentationPlan,
  type ModuleNode,
} from "../../core/src";
import { HtmlRenderer } from "./index";

function page(filePath: string, title: string): DocumentationPage {
  return {
    filePath,
    title,
    summary: `${title} summary`,
    moduleIds: ["src.Widget"],
    sourcePaths: ["src/Widget.tsx"],
    sections: [{
      heading: "Overview",
      paragraphs: ["Use `Widget` to render the interface."],
      bullets: ["Responsive by default"],
      codeBlocks: [{ language: "tsx", code: "<Widget />" }],
    }],
  };
}

function plan(): DocumentationPlan {
  const architecture = page("architecture.md", "Architecture");
  return {
    mode: "developer",
    project: {
      name: "Demo",
      summary: "Demo app",
      sourceRoots: ["src"],
      techStack: ["React", "TypeScript"],
      setupSteps: [],
      importantScripts: [],
      envFiles: [],
      envVars: [],
    },
    pages: {
      readme: page("README.md", "Demo"),
      architecture,
      projectStructure: page("project-structure.md", "Project structure"),
      setup: page("setup.md", "Setup"),
      features: [{ ...page("features/widget.md", "Widget feature"), featureKey: "widget" }],
      api: page("api/services.md", "Services"),
      components: page("components/components.md", "Components"),
      state: page("state/state.md", "State"),
      testing: page("testing/testing.md", "Testing"),
      troubleshooting: page("troubleshooting.md", "Troubleshooting"),
    },
  };
}

function moduleNode(): ModuleNode {
  return {
    id: "src.Widget",
    name: "Widget",
    filePath: "src/Widget.tsx",
    language: "typescript",
    kind: "function",
    description: "A reusable widget.",
    tags: [],
    members: [],
    dependencies: [],
    examples: [],
    coverage: createEmptyCoverage(),
    decorators: [],
    typeParameters: [],
    sourceFacts: createDefaultSourceFacts({ fileRole: "component" }),
  };
}

describe("HtmlRenderer", () => {
  it("renders a searchable developer site with an architecture diagram", async () => {
    const config = DocGenConfigSchema.parse({
      project: { name: "Demo", repository: "https://github.com/example/demo" },
      languages: [{ name: "typescript", source: "src", parser: "@docgen/parser-typescript" }],
      output: { html: { enabled: true, baseUrl: "/demo/", search: true } },
    });
    const renderer = new HtmlRenderer();
    await renderer.initialize({ projectConfig: config, workDir: process.cwd(), options: {}, logger: console as any });
    const docir = createEmptyDocIR({ name: "Demo", languages: ["typescript"] });
    docir.modules = [moduleNode()];
    docir.documentationPlan = plan();

    const artifacts = await renderer.render(docir, config.output);
    expect(artifacts.map((artifact) => artifact.filePath)).toEqual(
      expect.arrayContaining(["index.html", "architecture.html", "assets/styles.css", "assets/app.js", "search-index.json"])
    );
    const architecture = String(artifacts.find((artifact) => artifact.filePath === "architecture.html")?.content);
    expect(architecture).toContain('class="mermaid"');
    expect(architecture).toContain('/demo/assets/styles.css');
    expect(architecture).toContain('github.com/example/demo/blob/main/src/Widget.tsx');
  });

  it("renders exhaustive module pages", async () => {
    const config = DocGenConfigSchema.parse({
      project: { name: "Demo" },
      languages: [{ name: "typescript", source: "src", parser: "@docgen/parser-typescript" }],
      output: { html: { enabled: true } },
      documentation: { mode: "exhaustive" },
    });
    const renderer = new HtmlRenderer();
    await renderer.initialize({ projectConfig: config, workDir: process.cwd(), options: {}, logger: console as any });
    const docir = createEmptyDocIR({ name: "Demo", languages: ["typescript"] });
    docir.modules = [moduleNode()];
    const artifacts = await renderer.render(docir, config.output);
    expect(artifacts.map((artifact) => artifact.filePath)).toContain("typescript/Widget.html");
  });
});
