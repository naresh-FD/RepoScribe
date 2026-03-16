import {
  type DocIR,
  type ModuleNode,
  type OutputArtifact,
  type PluginConfig,
  type PluginValidationResult,
  type RendererPlugin,
} from "@docgen/core";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT_MARGIN = 48;
const TOP_MARGIN = 790;
const BOTTOM_MARGIN = 48;
const LINE_HEIGHT = 14;
const MAX_LINE_LENGTH = 92;

export class PdfRenderer implements RendererPlugin {
  readonly name = "@docgen/renderer-pdf";
  readonly version = "1.0.0";
  readonly type = "renderer" as const;
  readonly format = "pdf";
  readonly supports = ["pdf"];

  private fileName = "documentation.pdf";

  async initialize(config: PluginConfig): Promise<void> {
    const configuredFileName = config.projectConfig.output.pdf.options?.fileName;
    if (typeof configuredFileName === "string" && configuredFileName.trim()) {
      this.fileName = configuredFileName.trim();
    }
  }

  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }

  async cleanup(): Promise<void> {}

  async render(docir: DocIR): Promise<OutputArtifact[]> {
    const lines = this.buildDocumentLines(docir);
    const pdfBuffer = buildPdf(lines);

    return [
      {
        filePath: this.fileName,
        content: pdfBuffer,
        mimeType: "application/pdf",
        size: pdfBuffer.length,
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceModules: docir.modules.map((module) => module.id),
          format: "pdf",
        },
      },
    ];
  }

  private buildDocumentLines(docir: DocIR): string[] {
    const lines: string[] = [
      `${docir.metadata.name} Documentation`,
      `Version: ${docir.metadata.version}`,
      `Generated: ${new Date(docir.metadata.generatedAt).toLocaleString("en-IN")}`,
      "",
    ];

    if (docir.metadata.description) {
      lines.push(docir.metadata.description);
      lines.push("");
    }

    lines.push(`Modules documented: ${docir.modules.length}`);
    lines.push("");

    for (const module of docir.modules) {
      lines.push(...this.renderModule(module));
    }

    if (docir.adrs.length > 0) {
      lines.push("Architecture Decisions");
      lines.push("");
      for (const adr of docir.adrs) {
        lines.push(`${adr.id}: ${adr.title} (${adr.status})`);
      }
      lines.push("");
    }

    if (docir.changelog.length > 0) {
      lines.push("Changelog");
      lines.push("");
      for (const entry of docir.changelog) {
        lines.push(`${entry.version} - ${entry.date}`);
      }
    }

    return lines;
  }

  private renderModule(module: ModuleNode): string[] {
    const lines: string[] = [
      `${module.name} (${module.kind})`,
      `Source: ${module.filePath}`,
    ];

    if (module.description) {
      lines.push(module.description);
    }

    if (module.members.length > 0) {
      lines.push("Members:");
      for (const member of module.members) {
        lines.push(`- ${member.name} [${member.kind}]`);
        lines.push(`  Signature: ${member.signature}`);

        if (member.description) {
          lines.push(`  ${member.description}`);
        }

        if (member.parameters.length > 0) {
          lines.push("  Parameters:");
          for (const parameter of member.parameters) {
            const required = parameter.isOptional ? "optional" : "required";
            const description = parameter.description || "No description";
            lines.push(
              `    - ${parameter.name}: ${parameter.type.name} (${required}) - ${description}`
            );
          }
        }

        if (member.returnType && member.returnType.name !== "void") {
          lines.push(`  Returns: ${member.returnType.name}`);
        }
      }
    }

    lines.push("");
    return lines;
  }
}

function buildPdf(lines: string[]): Buffer {
  const wrappedLines = wrapLines(lines, MAX_LINE_LENGTH);
  const linesPerPage = Math.floor((TOP_MARGIN - BOTTOM_MARGIN) / LINE_HEIGHT);
  const pages = chunk(wrappedLines, linesPerPage);

  const objects: string[] = [];
  const objectIds: number[] = [];

  const addObject = (value: string): number => {
    objects.push(value);
    const id = objects.length;
    objectIds.push(id);
    return id;
  };

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageEntries: Array<{ pageId: number; contentId: number }> = [];

  for (const pageLines of pages) {
    const stream = createContentStream(pageLines);
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`
    );
    const pageId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageEntries.push({ pageId, contentId });
  }

  const pagesId = addObject(
    `<< /Type /Pages /Count ${pageEntries.length} /Kids [${pageEntries
      .map((entry) => `${entry.pageId} 0 R`)
      .join(" ")}] >>`
  );

  for (const entry of pageEntries) {
    objects[entry.pageId - 1] = objects[entry.pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }

  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function createContentStream(lines: string[]): string {
  const commands = [
    "BT",
    `/F1 10 Tf`,
    `${LINE_HEIGHT} TL`,
    `${LEFT_MARGIN} ${TOP_MARGIN} Td`,
  ];

  lines.forEach((line, index) => {
    const escapedLine = escapePdfText(line);
    commands.push(`(${escapedLine}) Tj`);
    if (index < lines.length - 1) {
      commands.push("T*");
    }
  });

  commands.push("ET");
  return commands.join("\n");
}

function wrapLines(lines: string[], maxLength: number): string[] {
  const wrapped: string[] = [];

  for (const line of lines) {
    const normalized = normalizeText(line);
    if (!normalized) {
      wrapped.push("");
      continue;
    }

    let remaining = normalized;
    while (remaining.length > maxLength) {
      const slice = remaining.slice(0, maxLength + 1);
      const breakIndex = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("/"));

      if (breakIndex <= 0) {
        wrapped.push(remaining.slice(0, maxLength));
        remaining = remaining.slice(maxLength);
      } else {
        wrapped.push(remaining.slice(0, breakIndex).trimEnd());
        remaining = remaining.slice(breakIndex + 1).trimStart();
      }
    }

    wrapped.push(remaining);
  }

  return wrapped;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [[]];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\t/g, "  ")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trimEnd();
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export default PdfRenderer;
