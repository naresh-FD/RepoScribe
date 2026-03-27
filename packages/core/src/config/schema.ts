import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

// ─────────────────────────────────────────────────────────────────
// .docgen.yaml Configuration Schema
// ─────────────────────────────────────────────────────────────────

const LanguageConfigSchema = z.object({
  name: z.enum(["java", "typescript", "python"]),
  source: z.string().min(1),
  include: z.array(z.string()).default(["**/*"]),
  exclude: z.array(z.string()).default([]),
  parser: z.string().min(1),
  options: z.record(z.unknown()).default({}),
});

const MarkdownOutputSchema = z.object({
  enabled: z.boolean().default(false),
  outputDir: z.string().default("docs/api"),
  templates: z.string().optional(),
  filePerModule: z.boolean().default(true),
  tableOfContents: z.boolean().default(true),
  linkStyle: z.enum(["relative", "absolute"]).default("relative"),
  includeSourceLinks: z.boolean().default(true),
  collapsibleSections: z.boolean().default(true),
});

const HtmlOutputSchema = z.object({
  enabled: z.boolean().default(false),
  engine: z.enum(["docusaurus", "custom"]).default("docusaurus"),
  outputDir: z.string().default("docs-site"),
  theme: z.string().default("@docgen/theme-default"),
  sidebar: z.enum(["auto", "manual"]).default("auto"),
  search: z.boolean().default(true),
  baseUrl: z.string().default("/"),
  options: z.record(z.unknown()).default({}),
});

const PdfOutputSchema = z.object({
  enabled: z.boolean().default(false),
  engine: z.enum(["puppeteer", "pandoc"]).default("puppeteer"),
  outputDir: z.string().default("docs/pdf"),
  branding: z
    .object({
      logo: z.string().optional(),
      primaryColor: z.string().default("#1B4F72"),
      companyName: z.string().optional(),
    })
    .default({}),
  options: z.record(z.unknown()).default({}),
});

const ConfluenceOutputSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().url().optional(),
  spaceKey: z.string().optional(),
  parentPageId: z.string().optional(),
  auth: z.string().optional(), // "env:VAR_NAME" or direct token
  labels: z.array(z.string()).default(["auto-generated"]),
  incrementalSync: z.boolean().default(true),
  options: z.record(z.unknown()).default({}),
});

const OutputConfigSchema = z.object({
  markdown: MarkdownOutputSchema.default({}),
  html: HtmlOutputSchema.default({}),
  pdf: PdfOutputSchema.default({}),
  confluence: ConfluenceOutputSchema.default({}),
});

const ValidationRuleLevel = z.enum(["error", "warn", "off"]);

const ValidationConfigSchema = z.object({
  coverage: z
    .object({
      threshold: z.number().min(0).max(100).default(80),
      enforce: z.boolean().default(false),
      exclude: z.array(z.string()).default([]),
    })
    .default({}),
  rules: z
    .object({
      "require-description": ValidationRuleLevel.default("warn"),
      "require-param-docs": ValidationRuleLevel.default("warn"),
      "require-return-docs": ValidationRuleLevel.default("off"),
      "require-examples": ValidationRuleLevel.default("off"),
      "require-since-tag": ValidationRuleLevel.default("off"),
      "no-empty-descriptions": ValidationRuleLevel.default("warn"),
    })
    .default({}),
});

const ADRConfigSchema = z.object({
  directory: z.string().default("docs/decisions"),
  template: z.string().optional(),
  idFormat: z.string().default("ADR-{NNN}"),
});

const ChangelogConfigSchema = z.object({
  conventionalCommits: z.boolean().default(true),
  groupBy: z.enum(["type", "scope", "component"]).default("type"),
  outputFile: z.string().default("CHANGELOG.md"),
  includeCommitHash: z.boolean().default(false),
});

const DocumentationConfigSchema = z.object({
  mode: z.enum(["developer", "exhaustive"]).default("developer"),
});

export const DocGenConfigSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    version: z.string().default("0.0.0"),
    description: z.string().optional(),
    repository: z.string().optional(),
  }),
  languages: z.array(LanguageConfigSchema).min(1),
  output: OutputConfigSchema.default({}),
  validation: ValidationConfigSchema.default({}),
  adr: ADRConfigSchema.default({}),
  changelog: ChangelogConfigSchema.default({}),
  documentation: DocumentationConfigSchema.default({}),
  plugins: z.array(z.string()).default([]),
});

// ─── Exported Types ─────────────────────────────────────────────

export type DocGenConfig = z.infer<typeof DocGenConfigSchema>;
export type LanguageConfig = z.infer<typeof LanguageConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
export type MarkdownOutput = z.infer<typeof MarkdownOutputSchema>;
export type HtmlOutput = z.infer<typeof HtmlOutputSchema>;
export type PdfOutput = z.infer<typeof PdfOutputSchema>;
export type ConfluenceOutput = z.infer<typeof ConfluenceOutputSchema>;
export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;
export type DocumentationConfig = z.infer<typeof DocumentationConfigSchema>;

// ─── Config Loader ──────────────────────────────────────────────

const CONFIG_FILE_NAMES = [".docgen.yaml", ".docgen.yml", "docgen.config.yaml"];

/**
 * Find and load .docgen.yaml from the given directory (or ancestors).
 * Validates against the schema and returns the typed config.
 */
export function loadConfig(workDir: string): DocGenConfig {
  const configPath = findConfigFile(workDir);
  if (!configPath) {
    throw new ConfigError(
      `No configuration file found. Run "docgen init" to create one, ` +
        `or create .docgen.yaml manually.\n` +
        `Searched: ${CONFIG_FILE_NAMES.join(", ")}`
    );
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  let parsed: unknown;

  try {
    parsed = yaml.parse(raw);
  } catch (err) {
    throw new ConfigError(
      `Invalid YAML in ${configPath}: ${(err as Error).message}`
    );
  }

  const result = DocGenConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new ConfigError(
      `Configuration validation failed in ${configPath}:\n${issues}`
    );
  }

  return result.data;
}

/** Walk up directories to find config file */
function findConfigFile(startDir: string): string | null {
  let currentDir = path.resolve(startDir);

  while (true) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const candidate = path.join(currentDir, fileName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // reached root
    currentDir = parentDir;
  }

  return null;
}

/** Generate a default .docgen.yaml for a new project */
export function generateDefaultConfig(options: {
  projectName: string;
  languages: Array<{ name: string; source: string }>;
}): string {
  const config: Record<string, unknown> = {
    project: {
      name: options.projectName,
      version: "1.0.0",
    },
    languages: options.languages.map((lang) => ({
      name: lang.name,
      source: lang.source,
      include:
        lang.name === "java"
          ? ["**/*.java"]
          : lang.name === "typescript"
            ? ["**/*.ts", "**/*.tsx"]
            : ["**/*.py"],
      exclude:
        lang.name === "java"
          ? ["**/test/**", "**/generated/**"]
          : lang.name === "typescript"
            ? ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"]
            : ["**/test_*", "**/__pycache__/**"],
      parser: `@docgen/parser-${lang.name}`,
    })),
    output: {
      markdown: {
        enabled: true,
        outputDir: "docs",
      },
      html: {
        enabled: false,
        engine: "docusaurus",
        outputDir: "docs-site",
      },
      pdf: {
        enabled: false,
      },
      confluence: {
        enabled: false,
      },
    },
    documentation: {
      mode: "developer",
    },
    validation: {
      coverage: {
        threshold: 80,
        enforce: false,
      },
      rules: {
        "require-description": "warn",
        "require-param-docs": "warn",
        "require-return-docs": "off",
        "require-examples": "off",
      },
    },
    adr: {
      directory: "docs/decisions",
    },
    changelog: {
      conventionalCommits: true,
      outputFile: "CHANGELOG.md",
    },
  };

  return yaml.stringify(config, { lineWidth: 100 });
}

// ─── Errors ─────────────────────────────────────────────────────

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
