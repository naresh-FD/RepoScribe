/**
 * Markdown Renderer Plugin
 *
 * Generates GitHub-flavored Markdown documentation from DocIR.
 * Produces one .md file per module plus an index file.
 */

import {
  RendererPlugin,
  OutputArtifact,
  PluginConfig,
  PluginValidationResult,
  DocIR,
  DocumentationPage,
  DocumentationPlan,
  ModuleNode,
  MemberNode,
  CoverageScore,
} from "@docgen/core";

export class MarkdownRenderer implements RendererPlugin {
  readonly name = "@docgen/renderer-markdown";
  readonly version = "1.1.0";
  readonly type = "renderer" as const;
  readonly format = "markdown";
  readonly supports = ["markdown", "md"];

  private includeSourceLinks = true;
  private collapsibleSections = true;
  private mode: "developer" | "exhaustive" = "developer";

  async initialize(config: PluginConfig): Promise<void> {
    this.mode = config.projectConfig.documentation.mode;

    const markdownConfig = config.projectConfig.output.markdown;
    if (typeof markdownConfig.includeSourceLinks === "boolean") {
      this.includeSourceLinks = markdownConfig.includeSourceLinks;
    }
    if (typeof markdownConfig.collapsibleSections === "boolean") {
      this.collapsibleSections = markdownConfig.collapsibleSections;
    }
  }

  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }

  async cleanup(): Promise<void> {}

  async render(docir: DocIR, outputConfig: any): Promise<OutputArtifact[]> {
    if (this.mode === "developer") {
      return this.renderDeveloper(docir);
    }

    return this.renderExhaustive(docir);
  }

  private renderExhaustive(docir: DocIR): OutputArtifact[] {
    const files: OutputArtifact[] = [];

    // Generate index file
    const indexContent = this.renderIndex(docir);
    files.push(this.createArtifact("README.md", indexContent, []));

    // Group modules by language
    const byLanguage = this.groupByLanguage(docir.modules);

    for (const [language, modules] of byLanguage) {
      // Language index
      const langIndex = this.renderLanguageIndex(language, modules);
      files.push(this.createArtifact(`${language}/README.md`, langIndex, []));

      // Individual module docs
      for (const mod of modules) {
        const moduleContent = this.renderModule(mod);
        const fileName = `${mod.name}.md`;
        files.push(this.createArtifact(`${language}/${fileName}`, moduleContent, [mod.id]));
      }
    }

    // Generate ADR docs if present
    if (docir.adrs.length > 0) {
      const adrIndex = this.renderADRIndex(docir.adrs);
      files.push(this.createArtifact("decisions/README.md", adrIndex, []));

      for (const adr of docir.adrs) {
        const adrContent = this.renderADR(adr);
        files.push(this.createArtifact(`decisions/${adr.id}.md`, adrContent, []));
      }
    }

    // Generate changelog if present
    if (docir.changelog.length > 0) {
      const changelogContent = this.renderChangelog(docir.changelog);
      files.push(this.createArtifact("CHANGELOG.md", changelogContent, []));
    }

    return files;
  }

  private renderDeveloper(docir: DocIR): OutputArtifact[] {
    const plan = docir.documentationPlan;
    if (!plan) {
      throw new Error("Developer documentation mode requires a documentation plan.");
    }

    const pages = [
      plan.pages.readme,
      plan.pages.architecture,
      plan.pages.projectStructure,
      plan.pages.setup,
      ...plan.pages.features,
      plan.pages.api,
      plan.pages.components,
      plan.pages.state,
      plan.pages.testing,
      plan.pages.troubleshooting,
    ];

    return pages.map((page) =>
      this.createArtifact(page.filePath, this.renderPlanPage(page, plan), page.moduleIds)
    );
  }

  private renderPlanPage(page: DocumentationPage, plan: DocumentationPlan): string {
    const lines: string[] = [`# ${page.title}`, "", page.summary, ""];

    if (page.sourcePaths.length > 0) {
      lines.push(
        `**Relevant paths:** ${page.sourcePaths
          .map((sourcePath) => `\`${this.normalizeDisplayPath(sourcePath)}\``)
          .join(", ")}`
      );
      lines.push("");
    }

    for (const section of page.sections) {
      lines.push(`## ${section.heading}`);
      lines.push("");

      for (const paragraph of section.paragraphs) {
        lines.push(paragraph);
        lines.push("");
      }

      if (section.table) {
        lines.push(`| ${section.table.headers.join(" | ")} |`);
        lines.push(`| ${section.table.headers.map(() => "---").join(" | ")} |`);
        for (const row of section.table.rows) {
          lines.push(`| ${row.join(" | ")} |`);
        }
        lines.push("");
      }

      for (const bullet of section.bullets) {
        lines.push(`- ${bullet}`);
      }
      if (section.bullets.length > 0) {
        lines.push("");
      }

      for (const block of section.codeBlocks) {
        lines.push(`\`\`\`${block.language}`);
        lines.push(block.code);
        lines.push("```");
        lines.push("");
      }
    }

    if (page.filePath === "README.md") {
      lines.push("## Documentation Map");
      lines.push("");
      lines.push(`- Architecture: \`${this.normalizeDisplayPath(plan.pages.architecture.filePath)}\``);
      lines.push(`- Project structure: \`${this.normalizeDisplayPath(plan.pages.projectStructure.filePath)}\``);
      lines.push(`- Setup: \`${this.normalizeDisplayPath(plan.pages.setup.filePath)}\``);
      lines.push(`- Services: \`${this.normalizeDisplayPath(plan.pages.api.filePath)}\``);
      lines.push(`- Components: \`${this.normalizeDisplayPath(plan.pages.components.filePath)}\``);
      lines.push(`- State: \`${this.normalizeDisplayPath(plan.pages.state.filePath)}\``);
      lines.push(`- Testing: \`${this.normalizeDisplayPath(plan.pages.testing.filePath)}\``);
      lines.push(`- Troubleshooting: \`${this.normalizeDisplayPath(plan.pages.troubleshooting.filePath)}\``);
      if (plan.pages.features.length > 0) {
        lines.push("- Features: `docs/features/*.md`");
      }
      lines.push("");
    }

    return lines.join("\n").trimEnd() + "\n";
  }

  private createArtifact(
    filePath: string,
    content: string,
    sourceModules: string[]
  ): OutputArtifact {
    return {
      filePath,
      content,
      mimeType: "text/markdown",
      size: Buffer.byteLength(content),
      metadata: {
        generatedAt: new Date().toISOString(),
        sourceModules,
        format: "markdown",
      },
    };
  }

  // ── Index Rendering ─────────────────────────────────────────

  private normalizeDisplayPath(filePath: string): string {
    return filePath.replace(/\\/g, "/");
  }

  private renderIndex(ir: DocIR): string {
    const lines: string[] = [];
    const { metadata } = ir;

    lines.push(`# ${metadata.name} — API Documentation`);
    lines.push("");
    if (metadata.description) {
      lines.push(`> ${metadata.description}`);
      lines.push("");
    }

    // Badges
    const avgCoverage = ir.modules.length > 0
      ? Math.round(
          ir.modules.reduce((s: number, m: ModuleNode) => s + m.coverage.overall, 0) /
            ir.modules.length
        )
      : 0;
    const coverageColor = avgCoverage >= 80 ? "brightgreen" : avgCoverage >= 60 ? "yellow" : "red";

    lines.push(
      `![Version](https://img.shields.io/badge/version-${metadata.version}-blue) ` +
      `![Coverage](https://img.shields.io/badge/doc_coverage-${avgCoverage}%25-${coverageColor}) ` +
      `![Languages](https://img.shields.io/badge/languages-${metadata.languages.join("%20|%20")}-informational)`
    );
    lines.push("");

    // Quick stats
    lines.push("## Overview");
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| **Modules** | ${ir.modules.length} |`);
    lines.push(
      `| **Members** | ${ir.modules.reduce((s: number, m: ModuleNode) => s + m.members.length, 0)} |`
    );
    lines.push(`| **Languages** | ${metadata.languages.join(", ")} |`);
    lines.push(`| **Doc Coverage** | ${avgCoverage}% |`);
    lines.push(`| **Generated** | ${new Date(metadata.generatedAt).toLocaleDateString()} |`);
    lines.push("");

    // Language sections
    const byLanguage = this.groupByLanguage(ir.modules);
    lines.push("## API Reference");
    lines.push("");
    for (const [lang, modules] of byLanguage) {
      lines.push(`### ${this.formatLanguageName(lang)}`);
      lines.push("");
      lines.push(`| Module | Kind | Coverage | Description |`);
      lines.push(`|--------|------|----------|-------------|`);
      for (const mod of modules) {
        const badge = this.coverageBadge(mod.coverage.overall);
        const desc = mod.description.split("\n")[0].substring(0, 80);
        lines.push(`| [\`${mod.name}\`](./${lang}/${mod.name}.md) | ${mod.kind} | ${badge} | ${desc} |`);
      }
      lines.push("");
    }

    // ADRs link
    if (ir.adrs.length > 0) {
      lines.push(`## [Architecture Decisions](./decisions/README.md)`);
      lines.push("");
      lines.push(`${ir.adrs.length} decision records documented.`);
      lines.push("");
    }

    // Changelog link
    if (ir.changelog.length > 0) {
      lines.push(`## [Changelog](./CHANGELOG.md)`);
      lines.push("");
    }

    lines.push("---");
    lines.push(`*Generated by [DocGen](https://github.com/docgen/docgen) v${metadata.version}*`);

    return lines.join("\n");
  }

  private renderLanguageIndex(language: string, modules: ModuleNode[]): string {
    const lines: string[] = [];

    lines.push(`# ${this.formatLanguageName(language)} API Reference`);
    lines.push("");
    lines.push(`[← Back to Index](../README.md)`);
    lines.push("");

    // Group by kind
    const byKind = new Map<string, ModuleNode[]>();
    for (const mod of modules) {
      const group = byKind.get(mod.kind) || [];
      group.push(mod);
      byKind.set(mod.kind, group);
    }

    for (const [kind, mods] of byKind) {
      lines.push(`## ${this.pluralize(kind)}`);
      lines.push("");
      lines.push("| Name | Coverage | Description |");
      lines.push("|------|----------|-------------|");
      for (const mod of mods) {
        const badge = this.coverageBadge(mod.coverage.overall);
        const desc = mod.description.split("\n")[0].substring(0, 100);
        lines.push(`| [\`${mod.name}\`](./${mod.name}.md) | ${badge} | ${desc} |`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  // ── Module Rendering ────────────────────────────────────────

  private renderModule(mod: ModuleNode): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${mod.kind === "interface" ? "Interface" : mod.kind === "enum" ? "Enum" : "Class"} \`${mod.name}\``);
    lines.push("");
    lines.push(`[← Back to ${this.formatLanguageName(mod.language)} Index](./README.md)`);
    lines.push("");

    // Metadata badges
    lines.push(
      `![${mod.kind}](https://img.shields.io/badge/kind-${mod.kind}-blue) ` +
      `${this.coverageBadge(mod.coverage.overall)} ` +
      (mod.exports?.isNamed || mod.exports?.isDefault ? `![exported](https://img.shields.io/badge/exported-yes-green)` : "")
    );
    lines.push("");

    // Source link
    if (this.includeSourceLinks) {
      lines.push(`**Source:** \`${mod.filePath}\``);
      lines.push("");
    }

    // Description
    if (mod.description) {
      lines.push(mod.description);
      lines.push("");
    }

    // Generics
    if (mod.typeParameters.length > 0) {
      lines.push("**Type Parameters:**");
      lines.push("");
      for (const g of mod.typeParameters) {
        const constraint = g.constraint ? ` extends \`${g.constraint}\`` : "";
        const def = g.default ? ` = \`${g.default}\`` : "";
        lines.push(`- \`${g.name}\`${constraint}${def}`);
      }
      lines.push("");
    }

    // Inheritance
    if (mod.extends) {
      lines.push(`**Extends:** \`${mod.extends}\``);
      lines.push("");
    }
    if (mod.implements && mod.implements.length > 0) {
      lines.push(`**Implements:** ${mod.implements.map((i: string) => `\`${i}\``).join(", ")}`);
      lines.push("");
    }

    // Decorators
    if (mod.decorators.length > 0) {
      lines.push("**Decorators:**");
      lines.push("");
      for (const d of mod.decorators) {
        lines.push(`- \`${d.raw}\``);
      }
      lines.push("");
    }

    if (mod.react?.component) {
      const component = mod.react.component;
      lines.push("## Props");
      lines.push("");
      if (component.propsType) {
        lines.push(`**Props type:** \`${component.propsType}\``);
        lines.push("");
      }
      lines.push("| Prop | Type | Required | Default | Description |");
      lines.push("|------|------|----------|---------|-------------|");
      for (const prop of component.props) {
        lines.push(
          `| \`${prop.name}\` | \`${prop.type.raw}\` | ${prop.required ? "Yes" : "No"} | ` +
          `${prop.defaultValue ? `\`${prop.defaultValue}\`` : "—"} | ${prop.description || "—"} |`
        );
      }
      if (component.props.length === 0) {
        lines.push("| — | — | — | — | No props |");
      }
      lines.push("");

      if (component.componentType === "class" && component.stateType) {
        lines.push("## State");
        lines.push("");
        lines.push(`**State type:** \`${component.stateType}\``);
        lines.push("");
        lines.push("| Field | Type | Description |");
        lines.push("|-------|------|-------------|");
        for (const field of component.state) {
          lines.push(`| \`${field.name}\` | \`${field.type.raw}\` | ${field.description || "—"} |`);
        }
        lines.push("");
      }
    }

    if (mod.react?.hook) {
      lines.push("## Hook Signature");
      lines.push("");
      lines.push(`**Return shape:** ${mod.react.hook.returnShape}`);
      lines.push("");
      if (mod.react.hook.tupleElements) {
        lines.push(
          `**Tuple elements:** ${mod.react.hook.tupleElements
            .map((type, index) => `\`${index}: ${type.raw}\``)
            .join(", ")}`
        );
        lines.push("");
      }
      lines.push(
        `**Hook dependencies:** ${
          mod.react.hook.dependencies.length
            ? mod.react.hook.dependencies.map((dependency) => `\`${dependency}\``).join(", ")
            : "None"
        }`
      );
      lines.push("");
    }

    // Table of contents for members
    const publicMembers = mod.members.filter(
      (m: MemberNode) => m.visibility === "public" || m.visibility === "protected"
    );

    if (publicMembers.length > 0) {
      lines.push("## Members");
      lines.push("");
      lines.push("| Name | Kind | Description |");
      lines.push("|------|------|-------------|");
      for (const member of publicMembers) {
        const anchor = member.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
        const desc = member.description.split("\n")[0].substring(0, 80);
        const deprecated = member.deprecated ? " ⚠️" : "";
        lines.push(`| [\`${member.name}\`](#${anchor})${deprecated} | ${member.kind} | ${desc} |`);
      }
      lines.push("");

      // Detailed member sections
      lines.push("---");
      lines.push("");
      for (const member of publicMembers) {
        lines.push(...this.renderMember(member));
        lines.push("");
      }
    }

    // Coverage report
    lines.push("## Documentation Coverage");
    lines.push("");
    lines.push(...this.renderCoverageReport(mod.coverage));

    // Examples
    if (mod.examples.length > 0) {
      lines.push("## Examples");
      lines.push("");
      for (const example of mod.examples) {
        if (example.title) {
          lines.push(`### ${example.title}`);
          lines.push("");
        }
        if (example.description) {
          lines.push(example.description);
          lines.push("");
        }
        lines.push(`\`\`\`${example.language}`);
        lines.push(example.code);
        lines.push("```");
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  // ── Member Rendering ────────────────────────────────────────

  private renderMember(member: MemberNode): string[] {
    const lines: string[] = [];

    // Header
    const modifiers: string[] = [];
    if (member.isStatic) modifiers.push("static");
    if (member.isAsync) modifiers.push("async");
    if (member.isAbstract) modifiers.push("abstract");
    if (member.visibility !== "public") modifiers.push(member.visibility);

    const prefix = modifiers.length > 0 ? `*${modifiers.join(" ")}* ` : "";
    lines.push(`### ${prefix}\`${member.name}\``);
    lines.push("");

    // Deprecation warning
    if (member.deprecated) {
      lines.push(`> ⚠️ **Deprecated:** ${member.deprecated.message}`);
      if (member.deprecated.replacement) {
        lines.push(`> Use \`${member.deprecated.replacement}\` instead.`);
      }
      lines.push("");
    }

    if (member.endpoint) {
      if (member.description) {
        lines.push(member.description);
        lines.push("");
      }
      lines.push("**REST Endpoint:**");
      lines.push("");
      lines.push("| Method | Path | Path variables | Query parameters | Request body | Response |");
      lines.push("|--------|------|----------------|------------------|--------------|----------|");
      const pathVariables = member.endpoint.pathVariables.length
        ? member.endpoint.pathVariables
            .map((parameter) => `\`${parameter.name}: ${parameter.type.raw}\``)
            .join("<br>")
        : "—";
      const queryParameters = member.endpoint.queryParameters.length
        ? member.endpoint.queryParameters
            .map((parameter) => {
              const optional = parameter.required ? "" : " (optional)";
              const defaultValue = parameter.defaultValue
                ? `, default: ${parameter.defaultValue}`
                : "";
              return `\`${parameter.name}: ${parameter.type.raw}\`${optional}${defaultValue}`;
            })
            .join("<br>")
        : "—";
      lines.push(
        `| ${member.endpoint.httpMethod} | \`${member.endpoint.path}\` | ${pathVariables} | ` +
        `${queryParameters} | ${
          member.endpoint.requestBody ? `\`${member.endpoint.requestBody.raw}\`` : "—"
        } | \`${member.endpoint.responseType.raw}\` |`
      );
      lines.push("");
      return lines;
    }

    // Signature
    lines.push("```typescript");
    lines.push(member.signature);
    lines.push("```");
    lines.push("");

    // Description
    if (member.description) {
      lines.push(member.description);
      lines.push("");
    }

    // Parameters
    if (member.parameters.length > 0) {
      lines.push("**Parameters:**");
      lines.push("");
      lines.push("| Name | Type | Required | Description |");
      lines.push("|------|------|----------|-------------|");
      for (const param of member.parameters) {
        const required = param.isOptional ? "No" : "Yes";
        const type = `\`${param.type.name}\``;
        const desc = param.description || (param.defaultValue ? `Default: \`${param.defaultValue}\`` : "—");
        lines.push(`| \`${param.name}\` | ${type} | ${required} | ${desc} |`);
      }
      lines.push("");
    }

    // Return type
    if (member.returnType && member.returnType.name !== "void") {
      lines.push(`**Returns:** \`${member.returnType.name}\``);
      const returnTag = member.tags.find(
        (t: MemberNode["tags"][number]) => t.tag === "returns" || t.tag === "return"
      );
      if (returnTag) {
        lines.push(`— ${returnTag.description}`);
      }
      lines.push("");
    }

    // Throws
    if (member.throws.length > 0) {
      lines.push("**Throws:**");
      lines.push("");
      for (const t of member.throws) {
        lines.push(`- \`${t.type}\` — ${t.description}`);
      }
      lines.push("");
    }

    // Examples
    if (member.examples.length > 0) {
      if (this.collapsibleSections) {
        lines.push("<details>");
        lines.push("<summary>Examples</summary>");
        lines.push("");
      }
      for (const example of member.examples) {
        lines.push(`\`\`\`${example.language}`);
        lines.push(example.code);
        lines.push("```");
        lines.push("");
      }
      if (this.collapsibleSections) {
        lines.push("</details>");
        lines.push("");
      }
    }

    return lines;
  }

  // ── ADR Rendering ───────────────────────────────────────────

  private renderADRIndex(adrs: DocIR["adrs"]): string {
    const lines: string[] = [];
    lines.push("# Architecture Decision Records");
    lines.push("");
    lines.push("[← Back to Index](../README.md)");
    lines.push("");
    lines.push("| ID | Title | Status | Date |");
    lines.push("|----|-------|--------|------|");
    for (const adr of adrs) {
      const statusEmoji = { accepted: "✅", proposed: "📋", deprecated: "⚠️", superseded: "🔄", rejected: "❌" }[adr.status] || "";
      lines.push(`| [${adr.id}](./${adr.id}.md) | ${adr.title} | ${statusEmoji} ${adr.status} | ${adr.date} |`);
    }
    return lines.join("\n");
  }

  private renderADR(adr: DocIR["adrs"][0]): string {
    return [
      `# ${adr.id}: ${adr.title}`,
      "",
      `**Status:** ${adr.status}  `,
      `**Date:** ${adr.date}  `,
      adr.authors ? `**Authors:** ${adr.authors.join(", ")}` : "",
      "",
      "## Context",
      "", adr.context, "",
      "## Decision",
      "", adr.decision, "",
      "## Consequences",
      "", adr.consequences, "",
    ].filter((l) => l !== undefined).join("\n");
  }

  // ── Changelog Rendering ─────────────────────────────────────

  private renderChangelog(entries: DocIR["changelog"]): string {
    const lines: string[] = ["# Changelog", ""];

    for (const entry of entries) {
      lines.push(`## [${entry.version}] — ${entry.date}`);
      lines.push("");

      const sections = [
        { key: "added" as const, title: "Added" },
        { key: "changed" as const, title: "Changed" },
        { key: "deprecated" as const, title: "Deprecated" },
        { key: "removed" as const, title: "Removed" },
        { key: "fixed" as const, title: "Fixed" },
        { key: "security" as const, title: "Security" },
      ];

      for (const { key, title } of sections) {
        if (entry.sections[key].length > 0) {
          lines.push(`### ${title}`);
          lines.push("");
          for (const item of entry.sections[key]) {
            lines.push(`- ${item}`);
          }
          lines.push("");
        }
      }
    }

    return lines.join("\n");
  }

  // ── Coverage Rendering ──────────────────────────────────────

  private renderCoverageReport(coverage: CoverageScore): string[] {
    const lines: string[] = [];
    const b = coverage.breakdown;

    lines.push(`**Overall: ${coverage.overall}%** ${this.coverageBar(coverage.overall)}`);
    lines.push("");
    lines.push("| Check | Status |");
    lines.push("|-------|--------|");
    lines.push(`| Module description | ${b.description ? "✅" : "❌"} |`);
    lines.push(`| Parameter docs | ${b.parameters >= 80 ? "✅" : b.parameters >= 50 ? "⚠️" : "❌"} ${b.parameters}% |`);
    lines.push(`| Return type docs | ${b.returnType ? "✅" : "❌"} |`);
    lines.push(`| Throws docs | ${b.throws >= 80 ? "✅" : b.throws >= 50 ? "⚠️" : "❌"} ${b.throws}% |`);
    lines.push(`| Examples | ${b.examples ? "✅" : "❌"} |`);
    lines.push("");

    if (coverage.undocumented.length > 0) {
      lines.push("**Undocumented:**");
      lines.push("");
      for (const name of coverage.undocumented) {
        lines.push(`- \`${name}\``);
      }
      lines.push("");
    }

    return lines;
  }

  // ── Helpers ─────────────────────────────────────────────────

  private groupByLanguage(modules: ModuleNode[]): Map<string, ModuleNode[]> {
    const map = new Map<string, ModuleNode[]>();
    for (const mod of modules) {
      const group = map.get(mod.language) || [];
      group.push(mod);
      map.set(mod.language, group);
    }
    return map;
  }

  private formatLanguageName(lang: string): string {
    const names: Record<string, string> = {
      java: "Java",
      typescript: "TypeScript",
      python: "Python",
    };
    return names[lang] || lang;
  }

  private pluralize(kind: string): string {
    const plurals: Record<string, string> = {
      class: "Classes",
      "abstract-class": "Abstract Classes",
      interface: "Interfaces",
      enum: "Enums",
      module: "Modules",
      namespace: "Namespaces",
      function: "Functions",
      "type-alias": "Type Aliases",
    };
    return plurals[kind] || `${kind}s`;
  }

  private coverageBadge(score: number): string {
    if (score >= 80) return `![${score}%](https://img.shields.io/badge/coverage-${score}%25-brightgreen)`;
    if (score >= 60) return `![${score}%](https://img.shields.io/badge/coverage-${score}%25-yellow)`;
    return `![${score}%](https://img.shields.io/badge/coverage-${score}%25-red)`;
  }

  private coverageBar(score: number): string {
    const filled = Math.round(score / 10);
    const empty = 10 - filled;
    return `${"█".repeat(filled)}${"░".repeat(empty)}`;
  }
}

export default MarkdownRenderer;

