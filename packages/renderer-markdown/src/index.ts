/**
 * Markdown Renderer Plugin
 *
 * Generates GitHub-flavored Markdown documentation from DocIR.
 * Produces one .md file per module plus an index file.
 */

import * as fs from "fs";
import * as path from "path";
import {
  RendererPlugin,
  RendererOutput,
  OutputFile,
  PluginManifest,
  PluginConfig,
  PluginValidationResult,
  DocIR,
  ModuleNode,
  MemberNode,
  CoverageScore,
} from "@docgen/core";

export class MarkdownRenderer implements RendererPlugin {
  readonly manifest: PluginManifest & { type: "renderer" } = {
    name: "@docgen/renderer-markdown",
    version: "1.0.0",
    type: "renderer",
    description: "Renders DocIR to GitHub-flavored Markdown files",
    supports: ["markdown", "md"],
  };

  private includeSourceLinks = true;
  private collapsibleSections = true;

  async initialize(config: PluginConfig): Promise<void> {
    if (typeof config.includeSourceLinks === "boolean") {
      this.includeSourceLinks = config.includeSourceLinks;
    }
    if (typeof config.collapsibleSections === "boolean") {
      this.collapsibleSections = config.collapsibleSections;
    }
  }

  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }

  async cleanup(): Promise<void> {}

  async render(ir: DocIR, outputDir: string): Promise<RendererOutput> {
    const startTime = Date.now();
    const files: OutputFile[] = [];

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    // Generate index file
    const indexContent = this.renderIndex(ir);
    const indexPath = path.join(outputDir, "README.md");
    fs.writeFileSync(indexPath, indexContent, "utf-8");
    files.push({
      path: "README.md",
      content: indexContent,
      encoding: "utf-8",
    });

    // Group modules by language
    const byLanguage = this.groupByLanguage(ir.modules);

    for (const [language, modules] of byLanguage) {
      const langDir = path.join(outputDir, language);
      fs.mkdirSync(langDir, { recursive: true });

      // Language index
      const langIndex = this.renderLanguageIndex(language, modules);
      const langIndexPath = path.join(langDir, "README.md");
      fs.writeFileSync(langIndexPath, langIndex, "utf-8");
      files.push({
        path: `${language}/README.md`,
        content: langIndex,
        encoding: "utf-8",
      });

      // Individual module docs
      for (const mod of modules) {
        const moduleContent = this.renderModule(mod);
        const fileName = `${mod.name}.md`;
        const modulePath = path.join(langDir, fileName);
        fs.writeFileSync(modulePath, moduleContent, "utf-8");
        files.push({
          path: `${language}/${fileName}`,
          content: moduleContent,
          encoding: "utf-8",
        });
      }
    }

    // Generate ADR docs if present
    if (ir.adrs.length > 0) {
      const adrDir = path.join(outputDir, "decisions");
      fs.mkdirSync(adrDir, { recursive: true });

      const adrIndex = this.renderADRIndex(ir.adrs);
      fs.writeFileSync(path.join(adrDir, "README.md"), adrIndex, "utf-8");
      files.push({ path: "decisions/README.md", content: adrIndex, encoding: "utf-8" });

      for (const adr of ir.adrs) {
        const adrContent = this.renderADR(adr);
        const adrPath = path.join(adrDir, `${adr.id}.md`);
        fs.writeFileSync(adrPath, adrContent, "utf-8");
        files.push({ path: `decisions/${adr.id}.md`, content: adrContent, encoding: "utf-8" });
      }
    }

    // Generate changelog if present
    if (ir.changelog.length > 0) {
      const changelogContent = this.renderChangelog(ir.changelog);
      fs.writeFileSync(path.join(outputDir, "CHANGELOG.md"), changelogContent, "utf-8");
      files.push({ path: "CHANGELOG.md", content: changelogContent, encoding: "utf-8" });
    }

    const totalSize = files.reduce(
      (sum, f) => sum + (typeof f.content === "string" ? Buffer.byteLength(f.content) : f.content.length),
      0
    );

    return {
      files,
      stats: {
        filesGenerated: files.length,
        totalSizeBytes: totalSize,
        renderTimeMs: Date.now() - startTime,
      },
    };
  }

  // ── Index Rendering ─────────────────────────────────────────

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
      ? Math.round(ir.modules.reduce((s, m) => s + m.coverage.total, 0) / ir.modules.length)
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
    lines.push(`| **Members** | ${ir.modules.reduce((s, m) => s + m.members.length, 0)} |`);
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
        const badge = this.coverageBadge(mod.coverage.total);
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
        const badge = this.coverageBadge(mod.coverage.total);
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
      `${this.coverageBadge(mod.coverage.total)} ` +
      (mod.exported ? `![exported](https://img.shields.io/badge/exported-yes-green)` : "")
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
    if (mod.generics.length > 0) {
      lines.push("**Type Parameters:**");
      lines.push("");
      for (const g of mod.generics) {
        const constraint = g.constraint ? ` extends \`${g.constraint.name}\`` : "";
        const def = g.default ? ` = \`${g.default.name}\`` : "";
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
      lines.push(`**Implements:** ${mod.implements.map((i) => `\`${i}\``).join(", ")}`);
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

    // Table of contents for members
    const publicMembers = mod.members.filter(
      (m) => m.visibility === "public" || m.visibility === "protected"
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
        (t) => t.name === "returns" || t.name === "return"
      );
      if (returnTag) {
        lines.push(`— ${returnTag.value}`);
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
      adr.authors.length > 0 ? `**Authors:** ${adr.authors.join(", ")}` : "",
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

    lines.push(`**Overall: ${coverage.total}%** ${this.coverageBar(coverage.total)}`);
    lines.push("");
    lines.push("| Check | Status |");
    lines.push("|-------|--------|");
    lines.push(`| Module description | ${b.hasDescription ? "✅" : "❌"} |`);
    lines.push(`| Parameter docs | ${b.paramsCovered >= 80 ? "✅" : b.paramsCovered >= 50 ? "⚠️" : "❌"} ${b.paramsCovered}% |`);
    lines.push(`| Return type docs | ${b.returnCovered ? "✅" : "❌"} |`);
    lines.push(`| Throws docs | ${b.throwsCovered ? "✅" : "❌"} |`);
    lines.push(`| Examples | ${b.hasExamples ? "✅" : "❌"} |`);
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
