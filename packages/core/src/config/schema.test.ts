import { describe, expect, it } from "vitest";
import { DocGenConfigSchema, generateDefaultConfig } from "./schema";

describe("DocGenConfigSchema", () => {
  it("defaults documentation mode to developer", () => {
    const result = DocGenConfigSchema.parse({
      project: { name: "demo" },
      languages: [
        {
          name: "typescript",
          source: "src",
          parser: "@docgen/parser-typescript",
        },
      ],
    });

    expect(result.documentation.mode).toBe("developer");
  });

  it("writes developer-mode defaults in generated config", () => {
    const config = generateDefaultConfig({
      projectName: "demo",
      languages: [{ name: "typescript", source: "src" }],
    });

    expect(config).toContain("outputDir: docs");
    expect(config).toContain("documentation:");
    expect(config).toContain("mode: developer");
  });
});
