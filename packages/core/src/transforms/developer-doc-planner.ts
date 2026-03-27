import * as fs from "fs";
import * as path from "path";
import type { DocGenConfig } from "../config/schema";
import type {
  DocIR,
  DocumentationPage,
  DocumentationPlan,
  DocumentationProjectContext,
  DocumentationScript,
  DocumentationSection,
  FeatureDocumentationPage,
  ModuleNode,
  SourceFileRole,
} from "../docir/types";
import type {
  PluginConfig,
  PluginValidationResult,
  TransformerPlugin,
} from "../plugin/types";

const SHARED_BUCKETS = new Set([
  "components",
  "component",
  "common",
  "shared",
  "ui",
  "hooks",
  "hook",
  "services",
  "service",
  "api",
  "state",
  "store",
  "stores",
  "context",
  "contexts",
  "utils",
  "util",
  "lib",
]);

const IMPORTANT_SCRIPT_HINTS = [
  "dev",
  "start",
  "build",
  "test",
  "lint",
  "docs:generate",
  "docs",
];

const CORE_DOC_PATHS = {
  readme: "README.md",
  architecture: "architecture.md",
  projectStructure: "project-structure.md",
  setup: "setup.md",
  api: path.join("api", "services.md"),
  components: path.join("components", "reusable-components.md"),
  state: path.join("state", "state-management.md"),
  testing: path.join("testing", "testing-guide.md"),
  troubleshooting: "troubleshooting.md",
} as const;

interface PackageJsonShape {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

interface ArchitectureDiagramNode {
  id: string;
  label: string;
}

interface ArchitectureDiagramContext {
  entryLabel: string;
  domainNodes: ArchitectureDiagramNode[];
  stateCount: number;
  serviceCount: number;
  componentCount: number;
  testSupportCount: number;
}

export class DeveloperDocumentationPlanner implements TransformerPlugin {
  readonly name = "@docgen/transform-developer-doc-planner";
  readonly version = "1.0.0";
  readonly type = "transformer" as const;
  readonly supports = ["*"];
  readonly priority = 150;

  private config: DocGenConfig | null = null;
  private workDir = process.cwd();

  async initialize(config: PluginConfig): Promise<void> {
    this.config = config.projectConfig;
    this.workDir = config.workDir;
  }

  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }

  async cleanup(): Promise<void> {}

  async transform(docir: DocIR): Promise<DocIR> {
    if (!this.config) {
      return docir;
    }

    return {
      ...docir,
      documentationPlan: buildDocumentationPlan(docir, this.config, this.workDir),
    };
  }
}

export function buildDocumentationPlan(
  docir: DocIR,
  config: DocGenConfig,
  workDir: string
): DocumentationPlan {
  const packageJson = readPackageJson(workDir);
  const project = buildProjectContext(docir, config, workDir, packageJson);
  const sortedModules = [...docir.modules].sort((left, right) =>
    left.filePath.localeCompare(right.filePath)
  );

  const featurePages = buildFeaturePages(sortedModules);
  const structureRows = buildStructureRows(sortedModules);
  const serviceModules = sortedModules.filter((module) =>
    module.sourceFacts.fileRole === "service" ||
    module.sourceFacts.usesServiceDependencies
  );
  const stateModules = sortedModules.filter((module) =>
    ["state", "context", "hook"].includes(module.sourceFacts.fileRole)
  );
  const componentModules = selectReusableComponents(sortedModules);
  const routeModules = sortedModules.filter(
    (module) => module.sourceFacts.fileRole === "route"
  );
  const architectureDiagram = createArchitectureDiagramContext(
    sortedModules,
    featurePages,
    routeModules,
    stateModules,
    serviceModules,
    componentModules
  );

  const readme = buildGuidePage({
    filePath: CORE_DOC_PATHS.readme,
    title: project.name,
    summary: project.summary,
    moduleIds: [],
    sourcePaths: project.sourceRoots,
    sections: [
      section(
        "What This Project Does",
        [project.summary],
        buildKeyFeatureBullets(sortedModules)
      ),
      section(
        "Tech Stack",
        [],
        project.techStack,
        {
          headers: ["Layer", "Details"],
          rows: buildTechStackRows(project.techStack),
        }
      ),
      section(
        "Quick Start",
        [],
        [],
        undefined,
        [{ language: "bash", code: project.setupSteps.join("\n") }]
      ),
      section(
        "Project Structure",
        [
          "This guide focuses on responsibility boundaries rather than listing every file."
        ],
        [],
        {
          headers: ["Path", "Responsibility"],
          rows: structureRows.slice(0, 8),
        }
      ),
      section(
        "Important Scripts",
        [],
        [],
        {
          headers: ["Script", "Command", "Purpose"],
          rows: project.importantScripts.map((script) => [
            script.name,
            script.command,
            script.description,
          ]),
        }
      ),
      section(
        "Deeper Docs",
        [],
        [
          "Architecture: `docs/architecture.md`",
          "Project structure rules: `docs/project-structure.md`",
          "Setup and troubleshooting: `docs/setup.md`, `docs/troubleshooting.md`",
          "Feature guides: `docs/features/*.md`",
        ]
      ),
    ],
  });

  const architecture = buildGuidePage({
    filePath: CORE_DOC_PATHS.architecture,
    title: "Architecture Overview",
    summary:
      "High-level data flow, boundaries, and module responsibilities for safe changes.",
    moduleIds: sortedModules.map((module) => module.id),
    sourcePaths: unique(sortedModules.map((module) => module.filePath)),
    sections: [
      section(
        "Architecture Diagram",
        [
          "This inferred diagram shows the main entry boundary, domain areas, and shared layers that new changes should flow through."
        ],
        [
          routeModules.length > 0
            ? "Start tracing behavior from route or app-shell modules, then follow the feature and shared-layer edges below."
            : "No route shell was detected, so the diagram starts from the inferred entry boundary and domain groups."
        ],
        undefined,
        [
          { language: "mermaid", code: buildArchitectureMermaid(architectureDiagram) },
          { language: "text", code: buildArchitectureAscii(architectureDiagram) },
        ]
      ),
      section(
        "App Shell",
        [
          routeModules.length > 0
            ? `Route entry points are concentrated in ${routeModules.length} route-oriented modules.`
            : "No dedicated route entry points were detected, so the application likely composes from feature or library modules."
        ],
        buildArchitectureShellBullets(sortedModules)
      ),
      section(
        "Data Flow",
        [],
        buildDataFlowBullets(sortedModules, serviceModules, stateModules)
      ),
      section("State Management", [], buildStateBullets(stateModules)),
      section("API Layer", [], buildServiceBullets(serviceModules)),
      section(
        "Business Logic Boundaries",
        [],
        buildBoundaryBullets(sortedModules)
      ),
    ],
  });

  const projectStructure = buildGuidePage({
    filePath: CORE_DOC_PATHS.projectStructure,
    title: "Project Structure Guide",
    summary:
      "Folder responsibilities and safety rules for adding or changing code without spreading business logic into the wrong layer.",
    moduleIds: sortedModules.map((module) => module.id),
    sourcePaths: unique(sortedModules.map((module) => module.filePath)),
    sections: [
      section(
        "Folder Responsibilities",
        [],
        [],
        {
          headers: ["Path", "Responsibility"],
          rows: structureRows,
        }
      ),
      section(
        "Safety Rules",
        [],
        [
          "Reusable components should stay presentation-focused and avoid direct business orchestration when possible.",
          "Services should isolate external I/O and data-fetching concerns.",
          "State and context modules should own cross-cutting state transitions and provider setup.",
          "Feature modules should compose components, hooks, and services rather than reimplement shared utilities.",
        ]
      ),
    ],
  });

  const setup = buildGuidePage({
    filePath: CORE_DOC_PATHS.setup,
    title: "Setup Guide",
    summary:
      "Everything needed to install, configure, run, and debug the project locally.",
    moduleIds: [],
    sourcePaths: project.envFiles,
    sections: [
      section(
        "Requirements",
        [],
        [
          project.nodeVersion
            ? `Node.js: ${project.nodeVersion}`
            : "Node.js: check the repo `package.json` or local toolchain requirements.",
          "Install dependencies before running build or test commands.",
        ]
      ),
      section(
        "Local Setup",
        [],
        [],
        undefined,
        [{ language: "bash", code: project.setupSteps.join("\n") }]
      ),
      section("Environment", [], buildEnvironmentBullets(project)),
      section("Common Issues", [], buildSetupIssueBullets(project, packageJson)),
    ],
  });

  const api = buildGuidePage({
    filePath: CORE_DOC_PATHS.api,
    title: "API and Service Layer",
    summary:
      "Service modules, data boundaries, and external interaction points that the rest of the codebase depends on.",
    moduleIds: serviceModules.map((module) => module.id),
    sourcePaths: serviceModules.map((module) => module.filePath),
    sections: [
      section(
        "Service Inventory",
        [],
        [],
        {
          headers: ["Module", "Role", "Path", "Notes"],
          rows: buildModuleRows(serviceModules, 16),
        }
      ),
      section(
        "Usage Guidance",
        [],
        [
          "Route and feature modules should consume services instead of embedding transport or persistence concerns inline.",
          "Prefer adding new service functions in the existing service boundary that already owns the external dependency.",
          "If a contract changes, update both the service documentation and the feature pages that depend on it.",
        ]
      ),
    ],
  });

  const components = buildGuidePage({
    filePath: CORE_DOC_PATHS.components,
    title: "Reusable Components",
    summary:
      "Shared or complex UI modules worth documenting for reuse and safe extension.",
    moduleIds: componentModules.map((module) => module.id),
    sourcePaths: componentModules.map((module) => module.filePath),
    sections: [
      section(
        "Component Catalog",
        [],
        [],
        {
          headers: ["Component", "Path", "Why It Matters"],
          rows: buildComponentRows(componentModules),
        }
      ),
      section("Behavior Notes", [], buildComponentBullets(componentModules)),
    ],
  });

  const state = buildGuidePage({
    filePath: CORE_DOC_PATHS.state,
    title: "State Management Guide",
    summary:
      "Where state lives, how updates propagate, and where shared providers or hooks are defined.",
    moduleIds: stateModules.map((module) => module.id),
    sourcePaths: stateModules.map((module) => module.filePath),
    sections: [
      section(
        "State Inventory",
        [],
        [],
        {
          headers: ["Module", "Role", "Path", "Description"],
          rows: buildModuleRows(stateModules, 16),
        }
      ),
      section("Update Flow", [], buildStateBullets(stateModules)),
    ],
  });

  const testing = buildGuidePage({
    filePath: CORE_DOC_PATHS.testing,
    title: "Testing Guide",
    summary:
      "How tests are organized, which commands matter, and where support utilities live.",
    moduleIds: [],
    sourcePaths: collectTestSupportPaths(sortedModules),
    sections: [
      section(
        "Run Tests",
        [],
        [],
        undefined,
        [
          {
            language: "bash",
            code: buildTestingCommands(project, packageJson).join("\n"),
          },
        ]
      ),
      section("Testing Layout", [], buildTestingBullets(sortedModules, packageJson)),
    ],
  });

  const troubleshooting = buildGuidePage({
    filePath: CORE_DOC_PATHS.troubleshooting,
    title: "Troubleshooting",
    summary:
      "High-probability issues and the quickest place to look before changing core logic.",
    moduleIds: [],
    sourcePaths: [],
    sections: [
      section(
        "Common Problems",
        [],
        buildTroubleshootingBullets(project, sortedModules, packageJson)
      ),
    ],
  });

  return {
    mode: config.documentation.mode,
    project,
    pages: {
      readme,
      architecture,
      projectStructure,
      setup,
      features: featurePages,
      api,
      components,
      state,
      testing,
      troubleshooting,
    },
  };
}

function buildProjectContext(
  docir: DocIR,
  config: DocGenConfig,
  workDir: string,
  packageJson: PackageJsonShape | null
): DocumentationProjectContext {
  const scripts = packageJson?.scripts ?? {};
  const importantScripts = Object.entries(scripts)
    .filter(([name]) =>
      IMPORTANT_SCRIPT_HINTS.some((hint) => name === hint || name.includes(hint))
    )
    .slice(0, 8)
    .map(([name, command]) => ({
      name,
      command,
      description: describeScript(name),
    }));

  const fallbackScripts =
    importantScripts.length > 0
      ? importantScripts
      : [
          script("install", "npm install", "Install project dependencies."),
          script("start", "npm start", "Start the project locally."),
          script("test", "npm test", "Run the test suite."),
        ];

  const envFiles = findEnvFiles(workDir);
  const envVars = unique(envFiles.flatMap((filePath) => readEnvVars(filePath))).slice(0, 12);
  const techStack = detectTechStack(packageJson, docir);
  const setupSteps = buildSetupSteps(packageJson);

  return {
    name: docir.metadata.name,
    summary:
      docir.metadata.description ||
      config.project.description ||
      "Developer-focused documentation generated from source structure and project metadata.",
    sourceRoots: config.languages.map((language) => language.source),
    techStack,
    setupSteps,
    importantScripts: fallbackScripts,
    envFiles: envFiles.map((filePath) => path.relative(workDir, filePath)),
    envVars,
    nodeVersion: packageJson?.engines?.node,
  };
}

function buildFeaturePages(modules: ModuleNode[]): FeatureDocumentationPage[] {
  const groups = new Map<string, ModuleNode[]>();

  for (const module of modules) {
    if (shouldSkipFromFeaturePages(module)) {
      continue;
    }

    const groupKey = getFeatureGroupKey(module);
    const existing = groups.get(groupKey) ?? [];
    existing.push(module);
    groups.set(groupKey, existing);
  }

  const pages: FeatureDocumentationPage[] = [];
  for (const [featureKey, groupModules] of [...groups.entries()].sort((left, right) =>
    left[0].localeCompare(right[0])
  )) {
    const selectedModules = groupModules.slice(0, 18);
    const sourcePaths = unique(selectedModules.map((module) => module.filePath));
    const sections: DocumentationSection[] = [
      section(
        "Purpose",
        [summarizeFeature(groupModules, featureKey)],
        summarizeDescriptions(groupModules)
      ),
      section(
        "Key Modules",
        [],
        [],
        {
          headers: ["Module", "Role", "Path", "Description"],
          rows: buildModuleRows(selectedModules, 12),
        }
      ),
      section("State Handling", [], buildStateBullets(groupModules)),
      section("API Interactions", [], buildServiceBullets(groupModules)),
      section("Important Flows", [], buildFeatureFlowBullets(groupModules)),
    ];

    if (groupModules.length > selectedModules.length) {
      sections.push(
        section(
          "Additional Modules",
          [],
          [
            `${groupModules.length - selectedModules.length} more modules belong to this feature group and are intentionally summarized rather than expanded into standalone pages.`,
          ]
        )
      );
    }

    pages.push({
      featureKey,
      filePath: path.join("features", `${featureKey}.md`),
      title: `${toTitle(featureKey)} Feature`,
      summary: summarizeFeature(groupModules, featureKey),
      moduleIds: groupModules.map((module) => module.id),
      sourcePaths,
      sections,
    });
  }

  return pages;
}

function buildGuidePage(page: DocumentationPage): DocumentationPage {
  return page;
}

function section(
  heading: string,
  paragraphs: string[] = [],
  bullets: string[] = [],
  table?: { headers: string[]; rows: string[][] },
  codeBlocks: Array<{ language: string; code: string }> = []
): DocumentationSection {
  return {
    heading,
    paragraphs,
    bullets,
    table,
    codeBlocks,
  };
}

function describeScript(name: string): string {
  if (name.includes("dev") || name.includes("start")) return "Start local development.";
  if (name.includes("build")) return "Produce a production build.";
  if (name.includes("test")) return "Run automated tests.";
  if (name.includes("lint")) return "Check code quality rules.";
  if (name.includes("docs")) return "Generate project documentation.";
  return "Project maintenance command.";
}

function detectTechStack(packageJson: PackageJsonShape | null, docir: DocIR): string[] {
  const dependencies = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  };

  const stack: string[] = ["TypeScript"];
  if ("react" in dependencies) stack.push("React");
  if ("next" in dependencies) stack.push("Next.js");
  if ("vite" in dependencies) stack.push("Vite");
  if ("react-router" in dependencies || "react-router-dom" in dependencies) {
    stack.push("React Router");
  }
  if ("redux" in dependencies || "@reduxjs/toolkit" in dependencies) {
    stack.push("Redux Toolkit");
  }
  if ("zustand" in dependencies) stack.push("Zustand");
  if ("@tanstack/react-query" in dependencies) stack.push("TanStack Query");
  if ("vitest" in dependencies) stack.push("Vitest");
  if ("jest" in dependencies || "ts-jest" in dependencies) stack.push("Jest");
  if (docir.modules.some((module) => module.sourceFacts.usesContext)) {
    stack.push("React Context");
  }

  return unique(stack);
}

function buildSetupSteps(packageJson: PackageJsonShape | null): string[] {
  const scripts = packageJson?.scripts ?? {};
  const runCommand =
    scripts.dev
      ? "npm run dev"
      : scripts.start
        ? "npm start"
        : scripts["docs:generate"]
          ? "npm run docs:generate"
          : "npm run build";

  return ["npm install", runCommand];
}

function findEnvFiles(workDir: string): string[] {
  try {
    return fs
      .readdirSync(workDir)
      .filter((entry) => entry.startsWith(".env") || entry.toLowerCase().includes("env"))
      .map((entry) => path.join(workDir, entry))
      .filter((filePath) => fs.statSync(filePath).isFile());
  } catch {
    return [];
  }
}

function readEnvVars(filePath: string): string[] {
  try {
    return fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split("=")[0]?.trim() ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readPackageJson(workDir: string): PackageJsonShape | null {
  const packageJsonPath = path.join(workDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as PackageJsonShape;
  } catch {
    return null;
  }
}

function buildArchitectureShellBullets(modules: ModuleNode[]): string[] {
  const routes = modules.filter((module) => module.sourceFacts.fileRole === "route");
  const features = modules.filter((module) => module.sourceFacts.fileRole === "feature");

  const bullets: string[] = [];
  if (routes.length > 0) {
    bullets.push(
      `Route-oriented entry points are defined in ${routes.length} modules, which is the safest place to trace top-level rendering and navigation behavior.`
    );
  }
  if (features.length > 0) {
    bullets.push(
      `${features.length} feature-oriented modules concentrate business-specific composition and should be preferred over spreading domain logic into shared folders.`
    );
  }
  if (bullets.length === 0) {
    bullets.push(
      "The codebase appears library- or utility-heavy, so architecture understanding starts with top-level domain folders and shared services rather than route shells."
    );
  }
  return bullets;
}

function createArchitectureDiagramContext(
  modules: ModuleNode[],
  featurePages: FeatureDocumentationPage[],
  routeModules: ModuleNode[],
  stateModules: ModuleNode[],
  serviceModules: ModuleNode[],
  componentModules: ModuleNode[]
): ArchitectureDiagramContext {
  const entryLabel = detectArchitectureEntryLabel(modules, routeModules);
  const domainNodes = buildArchitectureDomainNodes(featurePages, modules);
  const testSupportCount = modules.filter(
    (module) => module.sourceFacts.fileRole === "test-support"
  ).length;

  return {
    entryLabel,
    domainNodes,
    stateCount: stateModules.length,
    serviceCount: serviceModules.length,
    componentCount: componentModules.length,
    testSupportCount,
  };
}

function detectArchitectureEntryLabel(
  modules: ModuleNode[],
  routeModules: ModuleNode[]
): string {
  if (routeModules.length > 0) {
    return `Router / App Shell (${routeModules.length})`;
  }

  const entryCandidates = modules.filter((module) => {
    const normalized = normalizePath(module.filePath);
    return (
      normalized.endsWith("/cli.ts") ||
      normalized.endsWith("/cli.tsx") ||
      normalized.endsWith("/main.ts") ||
      normalized.endsWith("/main.tsx") ||
      normalized.endsWith("/index.tsx") ||
      normalized.endsWith("/app.tsx")
    );
  });

  if (entryCandidates.some((module) => normalizePath(module.filePath).endsWith("/cli.ts"))) {
    return "CLI / Entry";
  }
  if (entryCandidates.length > 0) {
    return `App Entry (${entryCandidates.length})`;
  }

  return "Project Entry";
}

function buildArchitectureDomainNodes(
  featurePages: FeatureDocumentationPage[],
  modules: ModuleNode[]
): ArchitectureDiagramNode[] {
  const pageNodes = [...featurePages]
    .sort((left, right) => right.moduleIds.length - left.moduleIds.length)
    .slice(0, 4)
    .map((page, index) => ({
      id: `domain${index + 1}`,
      label: `${page.title.replace(/\s+Feature$/, "")} (${page.moduleIds.length})`,
    }));

  if (pageNodes.length > 0) {
    return pageNodes;
  }

  const folderCounts = new Map<string, number>();
  for (const module of modules) {
    const folder = topLevelFolder(module.filePath);
    if (!folder || SHARED_BUCKETS.has(folder)) {
      continue;
    }
    folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
  }

  return [...folderCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([folder, count], index) => ({
      id: `domain${index + 1}`,
      label: `${toTitle(folder)} (${count})`,
    }));
}

function buildArchitectureMermaid(context: ArchitectureDiagramContext): string {
  const lines = ["flowchart TB", `  entry[\"${escapeMermaidLabel(context.entryLabel)}\"]`];

  for (const node of context.domainNodes) {
    lines.push(`  ${node.id}[\"${escapeMermaidLabel(node.label)}\"]`);
  }
  if (context.stateCount > 0) {
    lines.push(`  state[\"State / Context (${context.stateCount})\"]`);
  }
  if (context.serviceCount > 0) {
    lines.push(`  services[\"Services (${context.serviceCount})\"]`);
    lines.push(`  external[\"External I/O\"]`);
  }
  if (context.componentCount > 0) {
    lines.push(`  components[\"Shared UI (${context.componentCount})\"]`);
  }
  if (context.testSupportCount > 0) {
    lines.push(`  tests[\"Test Support (${context.testSupportCount})\"]`);
  }

  if (context.domainNodes.length > 0) {
    for (const node of context.domainNodes) {
      lines.push(`  entry --> ${node.id}`);
      if (context.stateCount > 0) {
        lines.push(`  ${node.id} --> state`);
      }
      if (context.serviceCount > 0) {
        lines.push(`  ${node.id} --> services`);
      }
      if (context.componentCount > 0) {
        lines.push(`  ${node.id} --> components`);
      }
    }
  } else {
    if (context.stateCount > 0) {
      lines.push("  entry --> state");
    }
    if (context.serviceCount > 0) {
      lines.push("  entry --> services");
    }
    if (context.componentCount > 0) {
      lines.push("  entry --> components");
    }
  }

  if (context.serviceCount > 0) {
    lines.push("  services --> external");
  }
  if (context.testSupportCount > 0) {
    lines.push(
      context.domainNodes.length > 0 ? `  tests -.-> ${context.domainNodes[0]?.id}` : "  tests -.-> entry"
    );
  }

  return lines.join("\n");
}

function buildArchitectureAscii(context: ArchitectureDiagramContext): string {
  const lines = [`[${context.entryLabel}]`];
  const domainTargets =
    context.domainNodes.length > 0
      ? context.domainNodes.map((node) => node.label)
      : ["Shared Project Modules"];

  for (const label of domainTargets) {
    lines.push(`  |---> [${label}]`);
    if (context.stateCount > 0) {
      lines.push(`  |      |---> [State / Context (${context.stateCount})]`);
    }
    if (context.serviceCount > 0) {
      lines.push(`  |      |---> [Services (${context.serviceCount})] ---> [External I/O]`);
    }
    if (context.componentCount > 0) {
      lines.push(`  |      \\---> [Shared UI (${context.componentCount})]`);
    }
  }

  if (context.testSupportCount > 0) {
    lines.push(`[Test Support (${context.testSupportCount})] - - -> [${domainTargets[0]}]`);
  }

  return lines.join("\n");
}

function escapeMermaidLabel(value: string): string {
  return value.replace(/"/g, '\\"');
}

function buildDataFlowBullets(
  modules: ModuleNode[],
  serviceModules: ModuleNode[],
  stateModules: ModuleNode[]
): string[] {
  const bullets: string[] = [];
  if (serviceModules.length > 0) {
    bullets.push(
      `External interactions are concentrated in ${serviceModules.length} service-oriented modules.`
    );
  }
  if (stateModules.length > 0) {
    bullets.push(
      `Shared state flows through ${stateModules.length} state, context, or hook modules before reaching reusable UI.`
    );
  }
  const hookDriven = modules.filter((module) => module.sourceFacts.usesReactHooks).length;
  if (hookDriven > 0) {
    bullets.push(
      `${hookDriven} modules use React hook patterns, so local state and derived values are often managed close to the component or feature layer.`
    );
  }
  if (bullets.length === 0) {
    bullets.push(
      "No obvious route, state, or service split was detected, so follow imports from top-level modules to understand data flow."
    );
  }
  return bullets;
}

function buildStateBullets(modules: ModuleNode[]): string[] {
  if (modules.length === 0) {
    return [
      "No dedicated state modules were detected. Shared state is likely lightweight or embedded directly in feature-level hooks/components.",
    ];
  }

  const bullets = modules.slice(0, 8).map((module) => {
    const role = module.sourceFacts.fileRole;
    return `${toTitle(module.name)} (${role}) lives in \`${module.filePath}\` and should remain the source of truth for that state boundary.`;
  });

  if (modules.length > 8) {
    bullets.push(
      `${modules.length - 8} additional state-related modules are summarized rather than expanded here.`
    );
  }
  return bullets;
}

function buildServiceBullets(modules: ModuleNode[]): string[] {
  const services = modules.filter((module) =>
    module.sourceFacts.fileRole === "service" || module.sourceFacts.usesServiceDependencies
  );

  if (services.length === 0) {
    return [
      "No dedicated service layer was detected. If external access is added, isolate it in a service or API folder before wiring it into features.",
    ];
  }

  return services.slice(0, 8).map((module) => {
    const description = firstSentence(module.description) || "Service boundary detected from imports or naming.";
    return `\`${module.filePath}\` owns ${description}`;
  });
}

function buildBoundaryBullets(modules: ModuleNode[]): string[] {
  const bullets: string[] = [];
  if (modules.some((module) => module.sourceFacts.fileRole === "ui-component")) {
    bullets.push("UI components should stay reusable and avoid embedding domain-specific side effects.");
  }
  if (modules.some((module) => module.sourceFacts.fileRole === "service")) {
    bullets.push("Service modules should remain the only place where remote calls or durable I/O details live.");
  }
  if (modules.some((module) => module.sourceFacts.fileRole === "feature")) {
    bullets.push("Feature modules should compose shared parts instead of duplicating shared hooks, components, or services.");
  }
  if (bullets.length === 0) {
    bullets.push("Preserve folder boundaries: shared utilities stay generic, and domain behavior stays close to the modules that own it.");
  }
  return bullets;
}

function buildKeyFeatureBullets(modules: ModuleNode[]): string[] {
  const counts = countBy(modules, (module) => module.sourceFacts.fileRole);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([role, count]) => `${count} ${role} module${count === 1 ? "" : "s"} detected in the current source set.`);
}

function buildTechStackRows(techStack: string[]): string[][] {
  return techStack.map((entry) => [entry, describeTech(entry)]);
}

function describeTech(entry: string): string {
  switch (entry) {
    case "React":
      return "Primary UI layer.";
    case "Next.js":
      return "Application shell and routing framework.";
    case "Vite":
      return "Development/build tooling.";
    case "React Router":
      return "Client-side routing.";
    case "Redux Toolkit":
      return "Centralized state management.";
    case "Zustand":
      return "Lightweight store-based state management.";
    case "TanStack Query":
      return "Server-state fetching and caching.";
    case "Vitest":
      return "Test runner.";
    case "Jest":
      return "Test runner.";
    case "React Context":
      return "Shared provider/state boundary.";
    default:
      return "Detected from project metadata.";
  }
}

function buildStructureRows(modules: ModuleNode[]): string[][] {
  const groups = new Map<string, string>();

  for (const module of modules) {
    const folder = topLevelFolder(module.filePath);
    if (!folder) {
      continue;
    }
    groups.set(folder, folderResponsibility(folder, module.sourceFacts.fileRole));
  }

  return [...groups.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([folder, responsibility]) => [folder, responsibility]);
}

function folderResponsibility(folder: string, role: SourceFileRole): string {
  switch (folder) {
    case "components":
      return "Reusable or feature-level UI modules. Keep business orchestration out unless the component is intentionally complex.";
    case "services":
    case "api":
      return "External I/O and service contracts.";
    case "hooks":
      return "Shared hook abstractions and local state orchestration.";
    case "contexts":
    case "context":
      return "Provider setup and shared state boundaries.";
    case "state":
    case "store":
      return "Shared stores and update flows.";
    case "features":
    case "modules":
      return "Domain-specific composition and business behavior.";
    case "utils":
    case "lib":
      return "Generic helpers that should stay dependency-light and domain-neutral.";
    default:
      return `Primary ${role} area inferred from the current code layout.`;
  }
}

function buildEnvironmentBullets(project: DocumentationProjectContext): string[] {
  const bullets: string[] = [];
  if (project.envFiles.length > 0) {
    bullets.push(`Environment templates detected: ${project.envFiles.map((entry) => `\`${entry}\``).join(", ")}.`);
  } else {
    bullets.push("No environment template files were detected at the repo root.");
  }
  if (project.envVars.length > 0) {
    bullets.push(`Likely environment variables: ${project.envVars.map((entry) => `\`${entry}\``).join(", ")}.`);
  } else {
    bullets.push("No explicit environment variable examples were detected.");
  }
  return bullets;
}

function buildSetupIssueBullets(
  project: DocumentationProjectContext,
  packageJson: PackageJsonShape | null
): string[] {
  const bullets: string[] = [];
  if (!project.nodeVersion) {
    bullets.push("If local setup fails, confirm the expected Node.js version because no engine constraint was detected.");
  }
  if (!packageJson?.scripts?.test) {
    bullets.push("There is no plain `npm test` script, so use the project-specific test command shown above.");
  }
  if (project.envFiles.length === 0) {
    bullets.push("If the app expects runtime configuration, add a checked-in `.env.example` so setup becomes discoverable.");
  }
  bullets.push("If generated docs look too noisy, use developer mode rather than exhaustive mode for day-to-day use.");
  return bullets;
}

function buildModuleRows(modules: ModuleNode[], maxRows: number): string[][] {
  if (modules.length === 0) {
    return [["-", "-", "-", "No matching modules detected."]];
  }

  return modules.slice(0, maxRows).map((module) => [
    module.name,
    module.sourceFacts.fileRole,
    module.filePath,
    firstSentence(module.description) || "No description provided.",
  ]);
}

function buildComponentRows(modules: ModuleNode[]): string[][] {
  if (modules.length === 0) {
    return [["-", "-", "-", "No reusable or complex components met the developer-doc threshold."]];
  }

  return modules.slice(0, 14).map((module) => [
    module.name,
    module.filePath,
    explainComponentImportance(module),
  ]);
}

function explainComponentImportance(module: ModuleNode): string {
  if (module.sourceFacts.fileRole === "ui-component") {
    return "Shared UI boundary reused across multiple features.";
  }
  if (module.sourceFacts.usesContext) {
    return "Touches provider or context-driven behavior.";
  }
  if (module.sourceFacts.usesServiceDependencies) {
    return "Combines UI with service interactions.";
  }
  if (module.sourceFacts.usesReactHooks) {
    return "Contains non-trivial component state or effect logic.";
  }
  return "Selected as a reusable or complex component.";
}

function buildComponentBullets(modules: ModuleNode[]): string[] {
  if (modules.length === 0) {
    return ["Trivial wrapper components are intentionally excluded from this guide."];
  }

  const bullets = modules.slice(0, 8).map((module) => {
    return `\`${module.filePath}\` should be changed carefully because ${explainComponentImportance(module).toLowerCase()}`;
  });

  bullets.push("Buttons, wrappers, and presentational pass-through components are intentionally omitted from standalone documentation.");
  return bullets;
}

function collectTestSupportPaths(modules: ModuleNode[]): string[] {
  return unique(
    modules
      .filter((module) => module.sourceFacts.fileRole === "test-support")
      .map((module) => module.filePath)
  );
}

function buildTestingCommands(
  project: DocumentationProjectContext,
  packageJson: PackageJsonShape | null
): string[] {
  const scripts = packageJson?.scripts ?? {};
  const commands = ["npm install"];
  if (scripts.test) {
    commands.push("npm test");
  } else if (scripts["test:coverage"]) {
    commands.push("npm run test:coverage");
  } else {
    commands.push(project.importantScripts.find((script) => script.name.includes("test"))?.command ?? "npm run test");
  }
  return commands;
}

function buildTestingBullets(
  modules: ModuleNode[],
  packageJson: PackageJsonShape | null
): string[] {
  const bullets: string[] = [];
  const testSupport = modules.filter((module) => module.sourceFacts.fileRole === "test-support");
  if (testSupport.length > 0) {
    bullets.push(`${testSupport.length} test-support modules or fixtures were detected and should be reused before adding new ad hoc test helpers.`);
  }
  if (packageJson?.scripts?.test) {
    bullets.push(`Primary test command: \`${packageJson.scripts.test}\`.`);
  }
  bullets.push("Keep mocking strategy close to the service or provider boundary instead of duplicating it per component test.");
  return bullets;
}

function buildTroubleshootingBullets(
  project: DocumentationProjectContext,
  modules: ModuleNode[],
  packageJson: PackageJsonShape | null
): string[] {
  const bullets = [
    "If docs explode into too many pages, confirm that developer mode is enabled and that exhaustive mode was not selected.",
  ];
  if (project.envFiles.length === 0) {
    bullets.push("If local startup is unclear, add an `.env.example` file so required configuration is discoverable.");
  }
  if (!packageJson?.scripts?.build) {
    bullets.push("No build script was detected, so local verification may rely on test or generate commands instead.");
  }
  if (modules.some((module) => module.sourceFacts.isReExportOnly)) {
    bullets.push("Barrel files are summarized in developer mode and should not drive documentation structure.");
  }
  if (modules.some((module) => module.sourceFacts.fileRole === "service")) {
    bullets.push("When runtime behavior breaks, inspect service boundaries first before patching feature components.");
  }
  return bullets;
}

function shouldSkipFromFeaturePages(module: ModuleNode): boolean {
  if (module.sourceFacts.isReExportOnly || module.sourceFacts.isTrivial) {
    return true;
  }

  return ["ui-component", "types", "test-support"].includes(module.sourceFacts.fileRole);
}

function getFeatureGroupKey(module: ModuleNode): string {
  if (module.sourceFacts.featureKey) {
    return module.sourceFacts.featureKey;
  }
  if (module.sourceFacts.routeKey) {
    return module.sourceFacts.routeKey;
  }

  const segments = normalizeSegments(module.filePath);
  for (const segment of segments) {
    if (!SHARED_BUCKETS.has(segment) && !isFileNameSegment(segment)) {
      return sanitizeKey(segment);
    }
  }

  return "core";
}

function summarizeFeature(modules: ModuleNode[], featureKey: string): string {
  const counts = countBy(modules, (module) => module.sourceFacts.fileRole);
  const dominantRoles = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([role, count]) => `${count} ${role}`)
    .join(", ");
  return `${toTitle(featureKey)} spans ${modules.length} modules${dominantRoles ? ` across ${dominantRoles}` : ""}.`;
}

function summarizeDescriptions(modules: ModuleNode[]): string[] {
  return unique(
    modules
      .map((module) => firstSentence(module.description))
      .filter((value): value is string => Boolean(value))
  ).slice(0, 4);
}

function buildFeatureFlowBullets(modules: ModuleNode[]): string[] {
  const flows: string[] = [];
  const hooks = modules.filter((module) => module.sourceFacts.fileRole === "hook");
  const services = modules.filter((module) => module.sourceFacts.fileRole === "service");
  const contexts = modules.filter((module) => module.sourceFacts.fileRole === "context");

  if (hooks.length > 0) {
    flows.push(`Hooks in this feature centralize behavior in ${hooks.length} module${hooks.length === 1 ? "" : "s"}.`);
  }
  if (services.length > 0) {
    flows.push(`Service access for this feature is concentrated in ${services.length} service module${services.length === 1 ? "" : "s"}.`);
  }
  if (contexts.length > 0) {
    flows.push(`Context or provider state is exposed through ${contexts.length} module${contexts.length === 1 ? "" : "s"}.`);
  }
  if (flows.length === 0) {
    flows.push("Most flow for this feature appears to be local to the modules listed above.");
  }
  return flows;
}

function selectReusableComponents(modules: ModuleNode[]): ModuleNode[] {
  return modules.filter((module) => {
    if (!["component", "ui-component", "route"].includes(module.sourceFacts.fileRole)) {
      return false;
    }
    if (module.sourceFacts.isReExportOnly || module.sourceFacts.isTrivial) {
      return false;
    }

    const normalizedPath = normalizePath(module.filePath);
    if (
      normalizedPath.includes("/components/ui/") ||
      normalizedPath.includes("/components/common/") ||
      normalizedPath.includes("/shared/components/")
    ) {
      return true;
    }

    return (
      module.sourceFacts.usesContext ||
      module.sourceFacts.usesServiceDependencies ||
      module.sourceFacts.usesReactHooks ||
      module.sourceFacts.fileRole === "route"
    );
  });
}

function topLevelFolder(filePath: string): string | null {
  const segments = normalizeSegments(filePath);
  return segments.length > 1 ? segments[0] : null;
}

function normalizeSegments(filePath: string): string[] {
  return normalizePath(filePath)
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function isFileNameSegment(segment: string): boolean {
  return segment.endsWith(".ts") || segment.endsWith(".tsx") || segment.endsWith(".js");
}

function sanitizeKey(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "core";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function firstSentence(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/(.+?[.!?])(\s|$)/);
  return match?.[1] ?? trimmed;
}

function toTitle(value: string): string {
  return value
    .split(/[-_/]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function countBy<T>(items: T[], getKey: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function script(name: string, command: string, description: string): DocumentationScript {
  return { name, command, description };
}
