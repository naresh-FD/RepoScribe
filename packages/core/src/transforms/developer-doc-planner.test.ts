import { describe, expect, it } from "vitest";
import { DocGenConfigSchema } from "../config/schema";
import {
  createDefaultSourceFacts,
  createEmptyCoverage,
  createEmptyDocIR,
  type ModuleNode,
} from "../docir/types";
import { buildDocumentationPlan } from "./developer-doc-planner";

function createModule(overrides: Partial<ModuleNode> & Pick<ModuleNode, "id" | "name" | "filePath">): ModuleNode {
  return {
    id: overrides.id,
    name: overrides.name,
    filePath: overrides.filePath,
    language: "typescript",
    kind: "function",
    description: overrides.description ?? "",
    tags: overrides.tags ?? [],
    members: overrides.members ?? [],
    dependencies: overrides.dependencies ?? [],
    examples: overrides.examples ?? [],
    coverage: overrides.coverage ?? createEmptyCoverage(),
    decorators: overrides.decorators ?? [],
    typeParameters: overrides.typeParameters ?? [],
    extends: overrides.extends,
    implements: overrides.implements,
    exports: overrides.exports ?? { isDefault: false, isNamed: true, exportedName: overrides.name },
    sourceFacts: overrides.sourceFacts ?? createDefaultSourceFacts(),
  };
}

describe("buildDocumentationPlan", () => {
  it("groups feature docs and filters trivial UI modules from standalone feature pages", () => {
    const docir = createEmptyDocIR({ name: "demo", languages: ["typescript"] });
    docir.modules = [
      createModule({
        id: "src.features.auth.LoginPage",
        name: "LoginPage",
        filePath: "src/features/auth/LoginPage.tsx",
        description: "Route entry for the auth flow.",
        sourceFacts: createDefaultSourceFacts({
          fileRole: "feature",
          featureKey: "auth",
          usesReactHooks: true,
        }),
      }),
      createModule({
        id: "src.features.auth.authService",
        name: "authService",
        filePath: "src/features/auth/authService.ts",
        description: "Handles login and token refresh.",
        sourceFacts: createDefaultSourceFacts({
          fileRole: "service",
          featureKey: "auth",
        }),
      }),
      createModule({
        id: "src.components.ui.Button",
        name: "Button",
        filePath: "src/components/ui/Button.tsx",
        description: "Simple button wrapper.",
        sourceFacts: createDefaultSourceFacts({
          fileRole: "ui-component",
          isTrivial: true,
        }),
      }),
    ];

    const config = DocGenConfigSchema.parse({
      project: { name: "demo" },
      languages: [
        {
          name: "typescript",
          source: "src",
          parser: "@docgen/parser-typescript",
        },
      ],
    });

    const plan = buildDocumentationPlan(docir, config, process.cwd());

    expect(plan.mode).toBe("developer");
    expect(plan.pages.features).toHaveLength(1);
    expect(plan.pages.features[0]?.featureKey).toBe("auth");
    expect(plan.pages.features[0]?.moduleIds).toContain("src.features.auth.LoginPage");
    expect(plan.pages.features[0]?.moduleIds).toContain("src.features.auth.authService");
    expect(plan.pages.features[0]?.moduleIds).not.toContain("src.components.ui.Button");

    const architectureSection = plan.pages.architecture.sections[0];
    expect(architectureSection?.heading).toBe("Architecture Diagram");
    expect(architectureSection?.codeBlocks[0]?.language).toBe("mermaid");
    expect(architectureSection?.codeBlocks[0]?.code).toContain("flowchart TB");
    expect(architectureSection?.codeBlocks[1]?.language).toBe("text");
    expect(architectureSection?.codeBlocks[1]?.code).toContain("[Project Entry]");
  });
});
