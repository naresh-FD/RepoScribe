import type { DocIR, TypeRef } from "../docir/types";
import type { TransformerPlugin, PluginConfig, PluginValidationResult } from "../plugin/types";

// ─────────────────────────────────────────────────────────────────
// Link Resolver - Resolves cross-references between modules
// ─────────────────────────────────────────────────────────────────

export class LinkResolver implements TransformerPlugin {
  readonly name = "@docgen/transform-link-resolver";
  readonly version = "1.0.0";
  readonly type = "transformer" as const;
  readonly supports = ["*"];
  readonly priority = 100;

  async initialize(_config: PluginConfig): Promise<void> {}
  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }
  async cleanup(): Promise<void> {}

  async transform(docir: DocIR): Promise<DocIR> {
    const moduleIndex = new Map<string, string>();
    for (const mod of docir.modules) {
      moduleIndex.set(mod.id, mod.id);
      moduleIndex.set(mod.name, mod.id);
    }

    const updatedModules = docir.modules.map((mod) => ({
      ...mod,
      members: mod.members.map((member) => ({
        ...member,
        returnType: member.returnType
          ? this.resolveTypeLinks(member.returnType, moduleIndex)
          : null,
        parameters: member.parameters.map((param) => ({
          ...param,
          type: this.resolveTypeLinks(param.type, moduleIndex),
        })),
      })),
    }));

    return { ...docir, modules: updatedModules };
  }

  private resolveTypeLinks(
    typeRef: TypeRef,
    moduleIndex: Map<string, string>
  ): TypeRef {
    const resolved = { ...typeRef };

    if (!resolved.link && moduleIndex.has(resolved.name)) {
      resolved.link = moduleIndex.get(resolved.name);
    }

    if (resolved.typeArguments) {
      resolved.typeArguments = resolved.typeArguments.map((arg) =>
        this.resolveTypeLinks(arg, moduleIndex)
      );
    }

    if (resolved.unionMembers) {
      resolved.unionMembers = resolved.unionMembers.map((member) =>
        this.resolveTypeLinks(member, moduleIndex)
      );
    }

    return resolved;
  }
}
