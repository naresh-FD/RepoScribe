import type { DocIR, ModuleNode, MemberNode, CoverageScore } from "../docir/types";
import type { TransformerPlugin, PluginConfig, PluginValidationResult } from "../plugin/types";

// ─────────────────────────────────────────────────────────────────
// Coverage Analyzer - Computes documentation completeness scores
// ─────────────────────────────────────────────────────────────────

export class CoverageAnalyzer implements TransformerPlugin {
  readonly name = "@docgen/transform-coverage";
  readonly version = "1.0.0";
  readonly type = "transformer" as const;
  readonly supports = ["*"];
  readonly priority = 50; // Run early — others may need coverage data

  async initialize(_config: PluginConfig): Promise<void> {}
  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }
  async cleanup(): Promise<void> {}

  async transform(docir: DocIR): Promise<DocIR> {
    const updatedModules = docir.modules.map((mod) => ({
      ...mod,
      coverage: this.computeModuleCoverage(mod),
    }));

    return { ...docir, modules: updatedModules };
  }

  private computeModuleCoverage(mod: ModuleNode): CoverageScore {
    const publicMembers = mod.members.filter(
      (m) => m.visibility === "public" || m.visibility === "internal"
    );

    if (publicMembers.length === 0) {
      return {
        overall: mod.description ? 100 : 0,
        breakdown: {
          description: !!mod.description,
          parameters: 100,
          returnType: true,
          examples: mod.examples.length > 0,
          throws: 100,
          members: 100,
        },
        undocumented: mod.description ? [] : [mod.name],
      };
    }

    const scores = {
      description: mod.description.trim().length > 0,
      parameters: this.computeParamCoverage(publicMembers),
      returnType: this.computeReturnCoverage(publicMembers),
      examples: mod.examples.length > 0 || publicMembers.some((m) => m.examples.length > 0),
      throws: this.computeThrowsCoverage(publicMembers),
      members: this.computeMemberCoverage(publicMembers),
    };

    const undocumented = publicMembers
      .filter((m) => !m.description.trim())
      .map((m) => m.name);

    if (!mod.description.trim()) {
      undocumented.unshift(mod.name);
    }

    // Weighted average: description (20%), members (30%), params (25%), returns (15%), examples (10%)
    const overall = Math.round(
      (scores.description ? 20 : 0) +
        scores.members * 0.3 +
        scores.parameters * 0.25 +
        (scores.returnType ? 15 : 0) +
        (scores.examples ? 10 : 0)
    );

    return {
      overall: Math.min(100, overall),
      breakdown: scores,
      undocumented,
    };
  }

  private computeParamCoverage(members: MemberNode[]): number {
    const methodsWithParams = members.filter(
      (m) => m.kind === "method" && m.parameters.length > 0
    );
    if (methodsWithParams.length === 0) return 100;

    const totalParams = methodsWithParams.reduce(
      (sum, m) => sum + m.parameters.length,
      0
    );
    const documentedParams = methodsWithParams.reduce(
      (sum, m) => sum + m.parameters.filter((p) => p.description.trim()).length,
      0
    );

    return Math.round((documentedParams / totalParams) * 100);
  }

  private computeReturnCoverage(members: MemberNode[]): boolean {
    const methodsWithReturn = members.filter(
      (m) =>
        m.kind === "method" &&
        m.returnType &&
        m.returnType.raw !== "void" &&
        m.returnType.raw !== "undefined"
    );
    if (methodsWithReturn.length === 0) return true;

    const documented = methodsWithReturn.filter((m) =>
      m.tags.some((t) => t.tag === "returns" || t.tag === "return")
    );

    return documented.length / methodsWithReturn.length > 0.5;
  }

  private computeThrowsCoverage(members: MemberNode[]): number {
    const methodsWithThrows = members.filter(
      (m) => m.throws.length > 0
    );
    if (methodsWithThrows.length === 0) return 100;

    const documented = methodsWithThrows.filter((m) =>
      m.throws.every((t) => t.description.trim().length > 0)
    );

    return Math.round((documented.length / methodsWithThrows.length) * 100);
  }

  private computeMemberCoverage(members: MemberNode[]): number {
    if (members.length === 0) return 100;
    const documented = members.filter((m) => m.description.trim().length > 0);
    return Math.round((documented.length / members.length) * 100);
  }
}
