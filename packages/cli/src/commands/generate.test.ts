import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerate = vi.fn();
const mockLoadConfig = vi.fn();
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
};
let capturedConfig: any;

vi.mock("@docgen/core", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  createConsoleLogger: () => mockLogger,
  Orchestrator: class {
    constructor(options: { config: unknown }) {
      capturedConfig = options.config;
    }

    async generate() {
      return mockGenerate();
    }
  },
}));

import { generateCommand } from "./generate";

describe("generateCommand", () => {
  beforeEach(() => {
    capturedConfig = null;
    mockLoadConfig.mockReset();
    mockGenerate.mockReset();
    mockLoadConfig.mockReturnValue({
      output: {
        markdown: { enabled: true, outputDir: "docs", includeSourceLinks: true, collapsibleSections: true },
        html: { enabled: false, outputDir: "docs-site" },
        pdf: { enabled: false, outputDir: "docs/pdf", options: {} },
        confluence: { enabled: false },
      },
      validation: { coverage: { enforce: false } },
      documentation: { mode: "developer" },
    });
    mockGenerate.mockResolvedValue({
      docir: { modules: [] },
      artifacts: [],
      coverage: { overall: 100, threshold: 80, passed: true },
      duration: 1,
    });
  });

  it("overrides configuration mode from the CLI option", async () => {
    await generateCommand({ mode: "exhaustive" });
    expect(capturedConfig.documentation.mode).toBe("exhaustive");
  });
});
