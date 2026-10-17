import { describe, expect, it } from "vitest";
import { DocGenConfigSchema } from "./config/schema";
import { createSilentLogger } from "./plugin/types";
import { Orchestrator } from "./orchestrator";

// AUDIT-001 / RS-15: the config schema and the CLI accept a Confluence output, but RepoScribe has no
// Confluence renderer. Enabling it must fail with a clear message, not a hint to install a package
// that does not exist.

function configWith(output: Record<string, unknown>) {
  return DocGenConfigSchema.parse({
    project: { name: "Demo" },
    languages: [{ name: "typescript", source: "src", parser: "@docgen/parser-typescript" }],
    output,
  });
}

describe("outputs that have no renderer", () => {
  it("rejects an enabled Confluence output with a clear message", async () => {
    const orchestrator = new Orchestrator({
      config: configWith({ confluence: { enabled: true } }),
      workDir: process.cwd(),
      logger: createSilentLogger(),
    });

    await expect(orchestrator.generate()).rejects.toThrow(/Confluence output is not available/);
    await expect(orchestrator.generate()).rejects.toThrow(/output\.confluence\.enabled/);
  });

  it("does not suggest installing a package that does not exist", async () => {
    const orchestrator = new Orchestrator({
      config: configWith({ confluence: { enabled: true } }),
      workDir: process.cwd(),
      logger: createSilentLogger(),
    });

    const error = await orchestrator.generate().then(
      () => undefined,
      (caught: unknown) => caught as Error,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).not.toMatch(/npm install/);
    expect(error?.message).not.toMatch(/renderer-confluence/);
  });

  it("applies to snapshot and validate too, since they load the same plugins", async () => {
    const orchestrator = new Orchestrator({
      config: configWith({ confluence: { enabled: true } }),
      workDir: process.cwd(),
      logger: createSilentLogger(),
    });

    await expect(orchestrator.snapshot()).rejects.toThrow(/Confluence output is not available/);
    await expect(orchestrator.validate()).rejects.toThrow(/Confluence output is not available/);
  });
});
