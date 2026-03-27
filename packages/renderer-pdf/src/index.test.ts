import { describe, expect, it } from "vitest";
import { PdfRenderer } from "../dist/index.js";
import {
  DocGenConfigSchema,
  createEmptyDocIR,
  type DocumentationPlan,
} from "../../core/src";

function createPlan(): DocumentationPlan {
  const page = (filePath: string, title: string) => ({
    filePath,
    title,
    summary: `${title} summary`,
    moduleIds: [],
    sourcePaths: [],
    sections: [
      {
        heading: "Overview",
        paragraphs: [`${title} details`],
        bullets: [],
        codeBlocks: [],
      },
    ],
  });

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
      readme: page("README.md", "Demo"),
      architecture: page("architecture.md", "Architecture Overview"),
      projectStructure: page("project-structure.md", "Project Structure Guide"),
      setup: page("setup.md", "Setup Guide"),
      features: [{ ...page("features/auth.md", "Auth Feature"), featureKey: "auth" }],
      api: page("api/services.md", "API and Service Layer"),
      components: page("components/reusable-components.md", "Reusable Components"),
      state: page("state/state-management.md", "State Management Guide"),
      testing: page("testing/testing-guide.md", "Testing Guide"),
      troubleshooting: page("troubleshooting.md", "Troubleshooting"),
    },
  };
}

describe("PdfRenderer", () => {
  it("renders a styled developer guide with toc links", async () => {
    const renderer = new PdfRenderer();
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
    docir.documentationPlan = createPlan();

    const [artifact] = await renderer.render(docir, config.output as any);
    const pdfText = artifact.content.toString("utf8");

    expect(artifact.mimeType).toBe("application/pdf");
    expect(pdfText.startsWith("%PDF")).toBe(true);
    expect(pdfText).toContain("Table of Contents");
    expect(pdfText).toContain("/Subtype /Link");
    expect(pdfText).toContain("Overview");
    expect(pdfText).toContain("Architecture Overview");
    expect(pdfText).toContain("Troubleshooting");
  });
});
