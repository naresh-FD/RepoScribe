// ─────────────────────────────────────────────────────────────────
// DocIR - Intermediate Representation
// This is the single contract between all parsers and renderers.
// Every parser MUST produce this. Every renderer MUST consume this.
// ─────────────────────────────────────────────────────────────────

/** Top-level document IR - the complete doc model for a project */
export interface DocIR {
  metadata: ProjectMetadata;
  modules: ModuleNode[];
  adrs: ADRNode[];
  changelog: ChangelogEntry[];
  readme: ReadmeNode | null;
}

/** Project-level metadata extracted from config + git */
export interface ProjectMetadata {
  name: string;
  version: string;
  description?: string;
  languages: SupportedLanguage[];
  repository?: string;
  generatedAt: string; // ISO 8601
  generatorVersion: string;
}

export type SupportedLanguage = "java" | "typescript" | "python";

// ─── Module (Class / File / Namespace) ──────────────────────────

/** A documentable unit: class, interface, module, namespace */
export interface ModuleNode {
  id: string; // Fully qualified name
  name: string; // Short name
  filePath: string; // Relative source path
  language: SupportedLanguage;
  kind: ModuleKind;
  description: string;
  tags: DocTag[];
  members: MemberNode[];
  dependencies: DependencyRef[];
  examples: CodeExample[];
  coverage: CoverageScore;
  decorators: DecoratorNode[];
  typeParameters: TypeParamNode[];
  extends?: string;
  implements?: string[];
  exports?: ExportInfo;
}

export type ModuleKind =
  | "class"
  | "interface"
  | "module"
  | "namespace"
  | "enum"
  | "type-alias"
  | "function";

// ─── Members (Methods / Properties / Fields) ───────────────────

/** Individual member within a module */
export interface MemberNode {
  name: string;
  kind: MemberKind;
  visibility: Visibility;
  isStatic: boolean;
  isAbstract: boolean;
  isAsync: boolean;
  signature: string; // Full type signature as string
  description: string;
  parameters: ParamNode[];
  returnType: TypeRef | null;
  throws: ThrowsNode[];
  tags: DocTag[];
  examples: CodeExample[];
  deprecated: DeprecationInfo | null;
  since?: string;
  overrides?: string; // Parent class member it overrides
  decorators: DecoratorNode[];
}

export type MemberKind =
  | "method"
  | "property"
  | "field"
  | "constructor"
  | "getter"
  | "setter"
  | "index-signature"
  | "enum-member";

export type Visibility = "public" | "protected" | "private" | "internal";

// ─── Parameters & Types ─────────────────────────────────────────

export interface ParamNode {
  name: string;
  type: TypeRef;
  description: string;
  isOptional: boolean;
  isRest: boolean;
  defaultValue?: string;
}

export interface TypeRef {
  raw: string; // Original type string: "Promise<User[]>"
  name: string; // Base type name: "Promise"
  typeArguments?: TypeRef[]; // Generic args: [{ name: "Array", ... }]
  isArray: boolean;
  isNullable: boolean;
  isUnion: boolean;
  unionMembers?: TypeRef[];
  link?: string; // Cross-reference to another ModuleNode.id
}

export interface TypeParamNode {
  name: string; // e.g., "T"
  constraint?: string; // e.g., "extends BaseEntity"
  default?: string;
}

// ─── Documentation Tags ─────────────────────────────────────────

export interface DocTag {
  tag: string; // e.g., "param", "returns", "throws", "see", "example"
  name?: string; // For @param: the parameter name
  type?: string; // For @param/@returns: the type
  description: string;
}

export interface ThrowsNode {
  type: string; // Exception/Error type
  description: string;
}

export interface DeprecationInfo {
  since?: string;
  message: string;
  replacement?: string;
}

export interface CodeExample {
  title?: string;
  language: string;
  code: string;
  description?: string;
}

export interface DecoratorNode {
  name: string;
  arguments: Record<string, unknown>;
  raw: string; // e.g., "@Controller('/api/users')"
}

export interface DependencyRef {
  name: string;
  source: string; // Import path
  kind: "import" | "injection" | "inheritance";
}

export interface ExportInfo {
  isDefault: boolean;
  isNamed: boolean;
  exportedName?: string;
}

// ─── Coverage ───────────────────────────────────────────────────

export interface CoverageScore {
  overall: number; // 0-100
  breakdown: {
    description: boolean;
    parameters: number; // % of params documented
    returnType: boolean;
    examples: boolean;
    throws: number; // % of thrown exceptions documented
    members: number; // % of public members documented
  };
  undocumented: string[]; // Names of undocumented members
}

// ─── Architecture Decision Records ──────────────────────────────

export interface ADRNode {
  id: string; // e.g., "ADR-001"
  title: string;
  status: ADRStatus;
  context: string;
  decision: string;
  consequences: string;
  date: string; // ISO 8601
  authors?: string[];
  supersededBy?: string;
  relatedTo?: string[];
  tags?: string[];
}

export type ADRStatus =
  | "proposed"
  | "accepted"
  | "deprecated"
  | "superseded"
  | "rejected";

// ─── Changelog ──────────────────────────────────────────────────

export interface ChangelogEntry {
  version: string;
  date: string; // ISO 8601
  description?: string;
  sections: ChangelogSections;
}

export interface ChangelogSections {
  added: string[];
  changed: string[];
  deprecated: string[];
  removed: string[];
  fixed: string[];
  security: string[];
}

// ─── README ─────────────────────────────────────────────────────

export interface ReadmeNode {
  title: string;
  description: string;
  badges: BadgeInfo[];
  installation?: string;
  quickStart?: string;
  apiSummary?: string; // Auto-generated from modules
  contributing?: string;
  license?: string;
  customSections: ReadmeSection[];
}

export interface BadgeInfo {
  label: string;
  value: string;
  color: string;
  url?: string;
}

export interface ReadmeSection {
  title: string;
  content: string;
  order: number;
}

// ─── Factory ────────────────────────────────────────────────────

/** Create an empty DocIR with sensible defaults */
export function createEmptyDocIR(
  metadata: Partial<ProjectMetadata> & { name: string }
): DocIR {
  return {
    metadata: {
      name: metadata.name,
      version: metadata.version ?? "0.0.0",
      description: metadata.description,
      languages: metadata.languages ?? [],
      repository: metadata.repository,
      generatedAt: new Date().toISOString(),
      generatorVersion: "1.0.0",
    },
    modules: [],
    adrs: [],
    changelog: [],
    readme: null,
  };
}

/** Create an empty coverage score */
export function createEmptyCoverage(): CoverageScore {
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
