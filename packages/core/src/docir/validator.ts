import { z } from "zod";
import type { DocIR, CoverageScore, ModuleNode } from "./types";

// ─── Zod Schemas for Runtime Validation ─────────────────────────

const TypeRefSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    raw: z.string(),
    name: z.string(),
    typeArguments: z.array(TypeRefSchema).optional(),
    isArray: z.boolean(),
    isNullable: z.boolean(),
    isUnion: z.boolean(),
    unionMembers: z.array(TypeRefSchema).optional(),
    link: z.string().optional(),
  })
);

const ParamNodeSchema = z.object({
  name: z.string().min(1),
  type: TypeRefSchema,
  description: z.string(),
  isOptional: z.boolean(),
  isRest: z.boolean(),
  defaultValue: z.string().optional(),
});

const DocTagSchema = z.object({
  tag: z.string().min(1),
  name: z.string().optional(),
  type: z.string().optional(),
  description: z.string(),
});

const ThrowsNodeSchema = z.object({
  type: z.string(),
  description: z.string(),
});

const CodeExampleSchema = z.object({
  title: z.string().optional(),
  language: z.string(),
  code: z.string(),
  description: z.string().optional(),
});

const DecoratorNodeSchema = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()),
  raw: z.string(),
});

const CoverageScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  breakdown: z.object({
    description: z.boolean(),
    parameters: z.number().min(0).max(100),
    returnType: z.boolean(),
    examples: z.boolean(),
    throws: z.number().min(0).max(100),
    members: z.number().min(0).max(100),
  }),
  undocumented: z.array(z.string()),
});

const MemberNodeSchema = z.object({
  name: z.string().min(1),
  kind: z.enum([
    "method",
    "property",
    "field",
    "constructor",
    "getter",
    "setter",
    "index-signature",
    "enum-member",
  ]),
  visibility: z.enum(["public", "protected", "private", "internal"]),
  isStatic: z.boolean(),
  isAbstract: z.boolean(),
  isAsync: z.boolean(),
  signature: z.string(),
  description: z.string(),
  parameters: z.array(ParamNodeSchema),
  returnType: TypeRefSchema.nullable(),
  throws: z.array(ThrowsNodeSchema),
  tags: z.array(DocTagSchema),
  examples: z.array(CodeExampleSchema),
  deprecated: z
    .object({
      since: z.string().optional(),
      message: z.string(),
      replacement: z.string().optional(),
    })
    .nullable(),
  since: z.string().optional(),
  overrides: z.string().optional(),
  decorators: z.array(DecoratorNodeSchema),
});

const ModuleNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  filePath: z.string().min(1),
  language: z.enum(["java", "typescript", "python"]),
  kind: z.enum([
    "class",
    "interface",
    "module",
    "namespace",
    "enum",
    "type-alias",
    "function",
  ]),
  description: z.string(),
  tags: z.array(DocTagSchema),
  members: z.array(MemberNodeSchema),
  dependencies: z.array(
    z.object({
      name: z.string(),
      source: z.string(),
      kind: z.enum(["import", "injection", "inheritance"]),
    })
  ),
  examples: z.array(CodeExampleSchema),
  coverage: CoverageScoreSchema,
  decorators: z.array(DecoratorNodeSchema),
  typeParameters: z.array(
    z.object({
      name: z.string(),
      constraint: z.string().optional(),
      default: z.string().optional(),
    })
  ),
  extends: z.string().optional(),
  implements: z.array(z.string()).optional(),
  exports: z
    .object({
      isDefault: z.boolean(),
      isNamed: z.boolean(),
      exportedName: z.string().optional(),
    })
    .optional(),
});

const ADRNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["proposed", "accepted", "deprecated", "superseded", "rejected"]),
  context: z.string(),
  decision: z.string(),
  consequences: z.string(),
  date: z.string(),
  authors: z.array(z.string()).optional(),
  supersededBy: z.string().optional(),
  relatedTo: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

const ChangelogEntrySchema = z.object({
  version: z.string(),
  date: z.string(),
  description: z.string().optional(),
  sections: z.object({
    added: z.array(z.string()),
    changed: z.array(z.string()),
    deprecated: z.array(z.string()),
    removed: z.array(z.string()),
    fixed: z.array(z.string()),
    security: z.array(z.string()),
  }),
});

const ReadmeNodeSchema = z.object({
  title: z.string(),
  description: z.string(),
  badges: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      color: z.string(),
      url: z.string().optional(),
    })
  ),
  installation: z.string().optional(),
  quickStart: z.string().optional(),
  apiSummary: z.string().optional(),
  contributing: z.string().optional(),
  license: z.string().optional(),
  customSections: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      order: z.number(),
    })
  ),
});

export const DocIRSchema = z.object({
  metadata: z.object({
    name: z.string().min(1),
    version: z.string(),
    description: z.string().optional(),
    languages: z.array(z.enum(["java", "typescript", "python"])),
    repository: z.string().optional(),
    generatedAt: z.string(),
    generatorVersion: z.string(),
  }),
  modules: z.array(ModuleNodeSchema),
  adrs: z.array(ADRNodeSchema),
  changelog: z.array(ChangelogEntrySchema),
  readme: ReadmeNodeSchema.nullable(),
});

// ─── Validation Functions ───────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

/** Validate a DocIR instance against the schema */
export function validateDocIR(docir: unknown): ValidationResult {
  const result = DocIRSchema.safeParse(docir);
  const warnings: ValidationWarning[] = [];

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
      warnings,
    };
  }

  // Additional semantic validations
  const docir_ = result.data as DocIR;

  // Check for duplicate module IDs
  const moduleIds = new Set<string>();
  for (const mod of docir_.modules) {
    if (moduleIds.has(mod.id)) {
      warnings.push({
        path: `modules[${mod.id}]`,
        message: `Duplicate module ID: ${mod.id}`,
        suggestion: "Ensure all module IDs are unique across the project.",
      });
    }
    moduleIds.add(mod.id);
  }

  // Check for broken cross-references
  for (const mod of docir_.modules) {
    for (const member of mod.members) {
      if (member.returnType?.link && !moduleIds.has(member.returnType.link)) {
        warnings.push({
          path: `modules[${mod.id}].members[${member.name}].returnType`,
          message: `Broken cross-reference: ${member.returnType.link}`,
          suggestion: "Referenced module does not exist in DocIR.",
        });
      }
    }
  }

  // Check for ADR ID uniqueness
  const adrIds = new Set<string>();
  for (const adr of docir_.adrs) {
    if (adrIds.has(adr.id)) {
      warnings.push({
        path: `adrs[${adr.id}]`,
        message: `Duplicate ADR ID: ${adr.id}`,
      });
    }
    adrIds.add(adr.id);
  }

  return { valid: true, errors: [], warnings };
}

/** Compute aggregate coverage score for all modules */
export function computeAggregateCoverage(modules: ModuleNode[]): CoverageScore {
  if (modules.length === 0) {
    return {
      overall: 0,
      breakdown: {
        description: false,
        parameters: 0,
        returnType: false,
        examples: false,
        throws: 0,
        members: 0,
      },
      undocumented: [],
    };
  }

  const totalOverall =
    modules.reduce((sum, m) => sum + m.coverage.overall, 0) / modules.length;
  const totalParams =
    modules.reduce((sum, m) => sum + m.coverage.breakdown.parameters, 0) /
    modules.length;
  const totalMembers =
    modules.reduce((sum, m) => sum + m.coverage.breakdown.members, 0) /
    modules.length;

  const allUndocumented = modules.flatMap((m) =>
    m.coverage.undocumented.map((u) => `${m.id}.${u}`)
  );

  return {
    overall: Math.round(totalOverall),
    breakdown: {
      description:
        modules.filter((m) => m.coverage.breakdown.description).length /
          modules.length >
        0.5,
      parameters: Math.round(totalParams),
      returnType:
        modules.filter((m) => m.coverage.breakdown.returnType).length /
          modules.length >
        0.5,
      examples:
        modules.filter((m) => m.coverage.breakdown.examples).length /
          modules.length >
        0.5,
      throws: 0,
      members: Math.round(totalMembers),
    },
    undocumented: allUndocumented,
  };
}
