import { Buffer } from "node:buffer";
import {
  type DocIR,
  type DocumentationCodeBlock,
  type DocumentationPage,
  type DocumentationPlan,
  type DocumentationSection,
  type DocumentationTable,
  type OutputArtifact,
  type PluginConfig,
  type PluginValidationResult,
  type RendererPlugin,
} from "@docgen/core";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT_MARGIN = 54;
const RIGHT_MARGIN = 54;
const BODY_TOP = 722;
const BODY_BOTTOM = 72;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
const PARAGRAPH_FONT_SIZE = 10.5;
const BODY_LINE_HEIGHT = 15;
const SMALL_FONT_SIZE = 8.5;
const SECTION_HEADING_SIZE = 15;
const PAGE_TITLE_SIZE = 22;
const COVER_TITLE_SIZE = 26;
const CODE_FONT_SIZE = 8.5;
const CODE_LINE_HEIGHT = 12;
const TABLE_FONT_SIZE = 8.5;
const TABLE_LINE_HEIGHT = 12;
const TOC_FONT_SIZE = 10;
const TOC_INDENT = 18;
const TOC_ENTRY_HEIGHT = 16;
const BORDER_RADIUS_NOTE = 0;

const COLORS = {
  page: [1, 1, 1] as const,
  ink: [0.11, 0.14, 0.19] as const,
  muted: [0.39, 0.44, 0.52] as const,
  accent: [0.15, 0.47, 0.86] as const,
  accentLight: [0.93, 0.96, 1] as const,
  line: [0.82, 0.87, 0.93] as const,
  codeBg: [0.11, 0.13, 0.18] as const,
  codeInk: [0.95, 0.97, 1] as const,
  tableHeader: [0.95, 0.97, 1] as const,
  tableAlt: [0.985, 0.99, 1] as const,
} as const;

type FontId = "F1" | "F2" | "F3";

type PageKind = "cover" | "toc" | "content" | "reference";

interface PdfDestination {
  pageIndex: number;
  x: number;
  y: number;
}

interface PdfAnnotationDraft {
  rect: [number, number, number, number];
  destinationKey: string;
}

interface PdfPageDraft {
  kind: PageKind;
  headerTitle: string;
  commands: string[];
  annotations: PdfAnnotationDraft[];
}

interface AnchorRecord {
  pageIndex: number;
  x: number;
  y: number;
}

interface TocEntry {
  label: string;
  level: 0 | 1;
  destinationKey: string;
}

interface LayoutResult {
  pages: PdfPageDraft[];
  anchors: Record<string, AnchorRecord>;
  tocEntries: TocEntry[];
}

interface FlowState {
  page: PdfPageDraft;
  y: number;
  pageIndex: number;
}

export class PdfRenderer implements RendererPlugin {
  readonly name = "@docgen/renderer-pdf";
  readonly version = "1.0.0";
  readonly type = "renderer" as const;
  readonly format = "pdf";
  readonly supports = ["pdf"];

  private fileName = "documentation.pdf";
  private mode: "developer" | "exhaustive" = "developer";

  async initialize(config: PluginConfig): Promise<void> {
    this.mode = config.projectConfig.documentation.mode;
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
    const pages =
      this.mode === "developer" && docir.documentationPlan
        ? buildDeveloperPages(docir, docir.documentationPlan)
        : buildExhaustivePages(docir);

    const pdfBuffer = buildPdf(pages, docir.metadata.name);
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
}

function buildDeveloperPages(docir: DocIR, plan: DocumentationPlan): PdfPageDraft[] {
  const docs = [
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

  const bodyLayout = layoutDocumentationBody(docs);
  const tocPageCount = estimateTocPageCount(bodyLayout.tocEntries.length);
  const anchorOffset = 1 + tocPageCount;
  const shiftedAnchors = shiftAnchors(bodyLayout.anchors, anchorOffset);
  const totalPages = 1 + tocPageCount + bodyLayout.pages.length;

  const cover = buildCoverPage(docir, plan, docs.length, totalPages);
  const tocPages = buildTocPages(plan, bodyLayout.tocEntries, shiftedAnchors, totalPages);

  return [cover, ...tocPages, ...bodyLayout.pages];
}

function buildExhaustivePages(docir: DocIR): PdfPageDraft[] {
  const lines = [
    docir.metadata.description || "Generated reference documentation.",
    "",
    `Modules: ${docir.modules.length}`,
    `Generated: ${docir.metadata.generatedAt}`,
    "",
    ...docir.modules.flatMap((module) => [
      `${module.name} (${module.kind})`,
      `Path: ${module.filePath}`,
      `Coverage: ${module.coverage.overall}%`,
      module.description ? `Summary: ${firstSentence(module.description)}` : "Summary: No description provided.",
      "",
    ]),
  ];

  const pages: PdfPageDraft[] = [];
  let state = createFlowState("Reference", "reference", pages);
  drawPageTitle(state.page, "Reference", "Exhaustive module-oriented output.", state.y);
  state.y -= 74;

  for (const paragraph of lines) {
    const wrapped = wrapText(paragraph, CONTENT_WIDTH, PARAGRAPH_FONT_SIZE);
    const needed = Math.max(BODY_LINE_HEIGHT, wrapped.length * BODY_LINE_HEIGHT) + 6;
    state = ensureSpace(state, pages, needed, "Reference", "reference");
    drawWrappedText(state.page, wrapped, LEFT_MARGIN, state.y, "F1", PARAGRAPH_FONT_SIZE, COLORS.ink, BODY_LINE_HEIGHT);
    state.y -= needed;
  }

  pages.push(state.page);
  return pages;
}

function layoutDocumentationBody(docs: DocumentationPage[]): LayoutResult {
  const pages: PdfPageDraft[] = [];
  const anchors: Record<string, AnchorRecord> = {};
  const tocEntries: TocEntry[] = [];

  for (const doc of docs) {
    let state = createFlowState(doc.title, "content", pages);
    const pageKey = makePageAnchorKey(doc);
    anchors[pageKey] = { pageIndex: state.pageIndex, x: LEFT_MARGIN, y: state.y };
    tocEntries.push({ label: doc.title, level: 0, destinationKey: pageKey });

    drawPageTitle(state.page, doc.title, doc.summary, state.y);
    state.y -= 76;

    if (doc.sourcePaths.length > 0) {
      state = renderRelevantPathsCard(state, pages, doc.title, doc.sourcePaths);
    }

    for (const section of doc.sections) {
      const sectionKey = makeSectionAnchorKey(doc, section);
      tocEntries.push({ label: section.heading, level: 1, destinationKey: sectionKey });
      state = ensureSpace(state, pages, 44, doc.title, "content");
      anchors[sectionKey] = { pageIndex: state.pageIndex, x: LEFT_MARGIN, y: state.y };
      drawSectionHeading(state.page, section.heading, state.y);
      state.y -= 34;
      state = renderSection(state, pages, doc.title, section);
      state.y -= 12;
    }

    pages.push(state.page);
  }

  return { pages, anchors, tocEntries };
}

function buildCoverPage(
  docir: DocIR,
  plan: DocumentationPlan,
  docCount: number,
  totalPages: number
): PdfPageDraft {
  const page = createPage("cover", `${docir.metadata.name} Developer Guide`);

  drawRect(page, 28, 28, PAGE_WIDTH - 56, PAGE_HEIGHT - 56, COLORS.page, COLORS.line, 1);
  drawRect(page, 40, PAGE_HEIGHT - 186, PAGE_WIDTH - 80, 118, COLORS.accentLight);
  drawText(page, "F2", COVER_TITLE_SIZE, LEFT_MARGIN, PAGE_HEIGHT - 118, `${docir.metadata.name} Developer Guide`, COLORS.ink);
  drawText(page, "F1", 11, LEFT_MARGIN, PAGE_HEIGHT - 146, normalizePdfText(docir.metadata.description || plan.project.summary), COLORS.muted);

  const metaY = PAGE_HEIGHT - 220;
  drawLabelValue(page, LEFT_MARGIN, metaY, "Generated", new Date(docir.metadata.generatedAt).toLocaleDateString("en-IN"));
  drawLabelValue(page, LEFT_MARGIN + 170, metaY, "Mode", plan.mode);
  drawLabelValue(page, LEFT_MARGIN + 280, metaY, "Pages", String(totalPages));
  drawLabelValue(page, LEFT_MARGIN, metaY - 28, "Modules", String(docir.modules.length));
  drawLabelValue(page, LEFT_MARGIN + 170, metaY - 28, "Guides", String(docCount));
  drawLabelValue(page, LEFT_MARGIN + 280, metaY - 28, "Node", plan.project.nodeVersion ?? "project-specific");

  drawSectionRule(page, LEFT_MARGIN, PAGE_HEIGHT - 286, CONTENT_WIDTH);
  drawText(page, "F2", 12.5, LEFT_MARGIN, PAGE_HEIGHT - 314, "What’s Inside", COLORS.ink);

  const bullets = [
    "Layered project overview and setup guidance.",
    "Architecture, feature, service, state, and testing sections.",
    "A linked table of contents that jumps into each major section.",
  ];

  let y = PAGE_HEIGHT - 338;
  for (const bullet of bullets) {
    drawBulletLine(page, bullet, LEFT_MARGIN, y, PARAGRAPH_FONT_SIZE, COLORS.ink);
    y -= 20;
  }

  drawRect(page, LEFT_MARGIN, 120, CONTENT_WIDTH, 78, COLORS.codeBg);
  drawText(page, "F2", 11, LEFT_MARGIN + 16, 174, "Quick Start", COLORS.codeInk);
  let quickY = 154;
  for (const step of plan.project.setupSteps.slice(0, 4)) {
    drawText(page, "F3", CODE_FONT_SIZE, LEFT_MARGIN + 16, quickY, normalizePdfText(step), COLORS.codeInk);
    quickY -= 14;
  }

  drawText(page, "F1", 9, LEFT_MARGIN, 66, "Generated by RepoScribe", COLORS.muted);
  return page;
}

function buildTocPages(
  plan: DocumentationPlan,
  entries: TocEntry[],
  anchors: Record<string, AnchorRecord>,
  totalPages: number
): PdfPageDraft[] {
  const pages: PdfPageDraft[] = [];
  let page = createPage("toc", "Table of Contents");
  let y = BODY_TOP;

  drawText(page, "F2", PAGE_TITLE_SIZE, LEFT_MARGIN, y, "Table of Contents", COLORS.ink);
  y -= 22;
  drawText(
    page,
    "F1",
    10,
    LEFT_MARGIN,
    y,
    "Use these links to jump to each guide and section in the PDF.",
    COLORS.muted
  );
  y -= 26;
  drawRect(page, LEFT_MARGIN, y - 12, CONTENT_WIDTH, 1, COLORS.line);
  y -= 18;

  for (const entry of entries) {
    if (y < BODY_BOTTOM + 28) {
      pages.push(page);
      page = createPage("toc", "Table of Contents");
      y = BODY_TOP;
      drawText(page, "F2", PAGE_TITLE_SIZE, LEFT_MARGIN, y, "Table of Contents", COLORS.ink);
      y -= 40;
    }

    const anchor = anchors[entry.destinationKey];
    const pageNumber = anchor ? anchor.pageIndex + 1 : 0;
    const labelX = LEFT_MARGIN + entry.level * TOC_INDENT;
    const labelColor = entry.level === 0 ? COLORS.ink : COLORS.accent;
    const font = entry.level === 0 ? "F2" : "F1";
    const labelSize = entry.level === 0 ? TOC_FONT_SIZE : 9.5;
    const labelText = normalizePdfText(entry.label);

    drawText(page, font, labelSize, labelX, y, labelText, labelColor);
    drawText(page, "F1", 9, PAGE_WIDTH - RIGHT_MARGIN - 12, y, String(pageNumber), COLORS.muted, "right");
    drawLine(page, labelX, y - 3, PAGE_WIDTH - RIGHT_MARGIN - 24, y - 3, COLORS.line, 0.6, [2, 3]);

    if (anchor) {
      page.annotations.push({
        rect: [labelX, y - 3, PAGE_WIDTH - RIGHT_MARGIN, y + TOC_ENTRY_HEIGHT - 4],
        destinationKey: entry.destinationKey,
      });
    }

    y -= TOC_ENTRY_HEIGHT;
  }

  drawText(
    page,
    "F1",
    8.5,
    LEFT_MARGIN,
    38,
    `${plan.project.name} developer guide`,
    COLORS.muted
  );
  pages.push(page);
  return pages;
}

function renderSection(
  state: FlowState,
  pages: PdfPageDraft[],
  docTitle: string,
  section: DocumentationSection
): FlowState {
  let next = state;

  for (const paragraph of section.paragraphs) {
    next = renderParagraph(next, pages, docTitle, paragraph);
    next.y -= 4;
  }

  if (section.bullets.length > 0) {
    next = renderBulletList(next, pages, docTitle, section.bullets);
    next.y -= 4;
  }

  for (const block of section.codeBlocks) {
    next = renderCodeBlock(next, pages, docTitle, block);
    next.y -= 8;
  }

  if (section.table) {
    next = renderTable(next, pages, docTitle, section.table);
    next.y -= 8;
  }

  return next;
}

function renderParagraph(
  state: FlowState,
  pages: PdfPageDraft[],
  docTitle: string,
  text: string
): FlowState {
  const lines = wrapText(text, CONTENT_WIDTH, PARAGRAPH_FONT_SIZE);
  const height = lines.length * BODY_LINE_HEIGHT + 8;
  const next = ensureSpace(state, pages, height, docTitle, "content");
  drawWrappedText(next.page, lines, LEFT_MARGIN, next.y, "F1", PARAGRAPH_FONT_SIZE, COLORS.ink, BODY_LINE_HEIGHT);
  next.y -= height;
  return next;
}

function renderBulletList(
  state: FlowState,
  pages: PdfPageDraft[],
  docTitle: string,
  bullets: string[]
): FlowState {
  let next = state;
  for (const bullet of bullets) {
    const lines = wrapText(bullet, CONTENT_WIDTH - 18, PARAGRAPH_FONT_SIZE);
    const height = Math.max(18, lines.length * BODY_LINE_HEIGHT) + 2;
    next = ensureSpace(next, pages, height, docTitle, "content");
    drawBulletLine(next.page, bullet, LEFT_MARGIN, next.y, PARAGRAPH_FONT_SIZE, COLORS.ink);
    next.y -= height;
  }
  return next;
}

function renderCodeBlock(
  state: FlowState,
  pages: PdfPageDraft[],
  docTitle: string,
  block: DocumentationCodeBlock
): FlowState {
  const lines = block.code.split(/\r?\n/).map((line) => normalizePdfText(line));
  const chunkSize = 18;
  let next = state;

  for (let index = 0; index < lines.length; index += chunkSize) {
    const chunk = lines.slice(index, index + chunkSize);
    const height = 28 + chunk.length * CODE_LINE_HEIGHT + 16;
    next = ensureSpace(next, pages, height, docTitle, "content");

    const blockY = next.y;
    drawRect(next.page, LEFT_MARGIN, blockY - height + 10, CONTENT_WIDTH, height, COLORS.codeBg);
    drawText(
      next.page,
      "F2",
      9,
      LEFT_MARGIN + 14,
      blockY - 14,
      normalizePdfText(block.language.toUpperCase()),
      COLORS.codeInk
    );

    let lineY = blockY - 32;
    for (const line of chunk) {
      drawText(next.page, "F3", CODE_FONT_SIZE, LEFT_MARGIN + 14, lineY, line, COLORS.codeInk);
      lineY -= CODE_LINE_HEIGHT;
    }

    next.y -= height + 6;
  }

  return next;
}

function renderTable(
  state: FlowState,
  pages: PdfPageDraft[],
  docTitle: string,
  table: DocumentationTable
): FlowState {
  let next = state;
  const rows = [table.headers, ...table.rows];
  const columnCount = Math.max(1, table.headers.length);
  const columnWidth = CONTENT_WIDTH / columnCount;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const wrappedCells = row.map((cell) => wrapText(cell, columnWidth - 10, TABLE_FONT_SIZE));
    const rowLineCount = Math.max(...wrappedCells.map((cellLines) => Math.max(cellLines.length, 1)));
    const rowHeight = rowLineCount * TABLE_LINE_HEIGHT + 12;

    next = ensureSpace(next, pages, docTitle === "" ? rowHeight : rowHeight + 2, docTitle, "content");

    const rowBottom = next.y - rowHeight + 6;
    const fillColor =
      rowIndex === 0 ? COLORS.tableHeader : rowIndex % 2 === 0 ? COLORS.tableAlt : COLORS.page;
    drawRect(next.page, LEFT_MARGIN, rowBottom, CONTENT_WIDTH, rowHeight, fillColor, COLORS.line, 0.7);

    for (let columnIndex = 1; columnIndex < columnCount; columnIndex += 1) {
      const x = LEFT_MARGIN + columnIndex * columnWidth;
      drawLine(next.page, x, rowBottom, x, rowBottom + rowHeight, COLORS.line, 0.7);
    }

    row.forEach((cell, columnIndex) => {
      const cellLines = wrappedCells[columnIndex] ?? [normalizePdfText(cell)];
      let cellY = next.y - 12;
      for (const line of cellLines) {
        drawText(
          next.page,
          rowIndex === 0 ? "F2" : "F1",
          TABLE_FONT_SIZE,
          LEFT_MARGIN + columnIndex * columnWidth + 6,
          cellY,
          line,
          rowIndex === 0 ? COLORS.ink : COLORS.ink
        );
        cellY -= TABLE_LINE_HEIGHT;
      }
    });

    next.y -= rowHeight + 4;
  }

  return next;
}

function renderRelevantPathsCard(
  state: FlowState,
  pages: PdfPageDraft[],
  docTitle: string,
  sourcePaths: string[]
): FlowState {
  const preview = sourcePaths.slice(0, 6).map((value) => normalizePdfText(value.replace(/\\/g, "/")));
  const overflow = sourcePaths.length - preview.length;
  const previewLines = preview.flatMap((value) => wrapText(value, CONTENT_WIDTH - 26, 9.5));
  const lines = overflow > 0 ? [...previewLines, `+ ${overflow} more paths` ] : previewLines;
  const height = 28 + lines.length * 12 + 16;
  const next = ensureSpace(state, pages, height, docTitle, "content");

  drawRect(next.page, LEFT_MARGIN, next.y - height + 10, CONTENT_WIDTH, height, COLORS.accentLight, COLORS.line, 0.8);
  drawText(next.page, "F2", 10, LEFT_MARGIN + 14, next.y - 14, "Relevant Paths", COLORS.ink);
  let lineY = next.y - 32;
  for (const line of lines) {
    drawText(next.page, "F1", 9.5, LEFT_MARGIN + 14, lineY, line, COLORS.muted);
    lineY -= 12;
  }
  next.y -= height + 10;
  return next;
}

function createFlowState(headerTitle: string, kind: PageKind, pages: PdfPageDraft[]): FlowState {
  return {
    page: createPage(kind, headerTitle),
    y: BODY_TOP,
    pageIndex: pages.length,
  };
}

function ensureSpace(
  state: FlowState,
  pages: PdfPageDraft[],
  neededHeight: number,
  headerTitle: string,
  kind: PageKind
): FlowState {
  if (state.y - neededHeight >= BODY_BOTTOM) {
    return state;
  }

  pages.push(state.page);
  return {
    page: createPage(kind, headerTitle),
    y: BODY_TOP,
    pageIndex: pages.length,
  };
}

function createPage(kind: PageKind, headerTitle: string): PdfPageDraft {
  return {
    kind,
    headerTitle,
    commands: [],
    annotations: [],
  };
}

function buildPdf(pages: PdfPageDraft[], docTitle: string): Buffer {
  const objects: string[] = [];
  const addObject = (value: string): number => {
    objects.push(value);
    return objects.length;
  };

  const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const monoFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  const contentIds = pages.map((page, index) => {
    const stream = buildPageStream(page, index + 1, pages.length, docTitle);
    return addObject(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
  });

  const pageIds = pages.map((page, index) =>
    addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R /F3 ${monoFontId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`
    )
  );

  const annotationIdsByPage = pages.map((page) =>
    page.annotations.map((annotation) => {
      const destination = buildDestinationFromKey(annotation.destinationKey);
      if (!destination) {
        return null;
      }
      const destinationPageId = pageIds[destination.pageIndex];
      return addObject(
        `<< /Type /Annot /Subtype /Link /Rect [${annotation.rect[0]} ${annotation.rect[1]} ${annotation.rect[2]} ${annotation.rect[3]}] /Border [0 0 0] /A << /S /GoTo /D [${destinationPageId} 0 R /XYZ ${destination.x} ${destination.y} null] >> >>`
      );
    }).filter((value): value is number => value !== null)
  );

  pageIds.forEach((pageId, index) => {
    const annotations = annotationIdsByPage[index] ?? [];
    if (annotations.length > 0) {
      objects[pageId - 1] = objects[pageId - 1].replace(
        ">>",
        ` /Annots [${annotations.map((annotationId) => `${annotationId} 0 R`).join(" ")}] >>`
      );
    }
  });

  const kids = pageIds.map((pageId) => `${pageId} 0 R`).join(" ");
  const pagesId = addObject(`<< /Type /Pages /Count ${pageIds.length} /Kids [${kids}] >>`);
  pageIds.forEach((pageId) => {
    objects[pageId - 1] = objects[pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  });

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

function buildDestinationFromKey(key: string): PdfDestination | null {
  const registry = (globalThis as typeof globalThis & { __reposcribePdfAnchors?: Record<string, AnchorRecord> }).__reposcribePdfAnchors;
  const anchor = registry?.[key];
  if (!anchor) {
    return null;
  }
  return { pageIndex: anchor.pageIndex, x: anchor.x, y: anchor.y };
}

function buildPageStream(page: PdfPageDraft, pageNumber: number, totalPages: number, docTitle: string): string {
  const commands: string[] = [];
  commands.push("q");
  commands.push(colorFill(COLORS.page));
  commands.push(`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`);
  commands.push(colorStroke(COLORS.line));
  commands.push("0.8 w");
  commands.push(`22 22 ${PAGE_WIDTH - 44} ${PAGE_HEIGHT - 44} re S`);
  commands.push(colorFill(COLORS.accent));
  commands.push(`22 ${PAGE_HEIGHT - 30} ${PAGE_WIDTH - 44} 8 re f`);
  commands.push("Q");

  if (page.kind !== "cover") {
    drawTextCommands(commands, "F1", SMALL_FONT_SIZE, LEFT_MARGIN, PAGE_HEIGHT - 46, docTitle, COLORS.muted);
    drawTextCommands(commands, "F2", 9.5, LEFT_MARGIN, PAGE_HEIGHT - 62, page.headerTitle, COLORS.ink);
    drawLineCommands(commands, LEFT_MARGIN, PAGE_HEIGHT - 72, PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 72, COLORS.line, 0.8);
  }

  commands.push(...page.commands);

  if (page.kind !== "cover") {
    drawLineCommands(commands, LEFT_MARGIN, 48, PAGE_WIDTH - RIGHT_MARGIN, 48, COLORS.line, 0.8);
    drawTextCommands(commands, "F1", SMALL_FONT_SIZE, LEFT_MARGIN, 34, `${pageNumber}`, COLORS.muted);
    drawTextCommands(commands, "F1", SMALL_FONT_SIZE, PAGE_WIDTH - RIGHT_MARGIN, 34, `${pageNumber} / ${totalPages}`, COLORS.muted, "right");
  }

  return commands.join("\n");
}

function drawPageTitle(page: PdfPageDraft, title: string, summary: string, y: number): void {
  drawText(page, "F2", PAGE_TITLE_SIZE, LEFT_MARGIN, y, normalizePdfText(title), COLORS.ink);
  drawLine(page, LEFT_MARGIN, y - 10, PAGE_WIDTH - RIGHT_MARGIN, y - 10, COLORS.accent, 1.2);

  const summaryLines = wrapText(summary, CONTENT_WIDTH, 11);
  drawWrappedText(page, summaryLines, LEFT_MARGIN, y - 28, "F1", 11, COLORS.muted, 16);
}

function drawSectionHeading(page: PdfPageDraft, heading: string, y: number): void {
  drawText(page, "F2", SECTION_HEADING_SIZE, LEFT_MARGIN, y, normalizePdfText(heading), COLORS.ink);
  drawRect(page, LEFT_MARGIN, y - 10, 140, 2, COLORS.accent);
}

function drawLabelValue(page: PdfPageDraft, x: number, y: number, label: string, value: string): void {
  drawText(page, "F1", 8.5, x, y, normalizePdfText(label.toUpperCase()), COLORS.muted);
  drawText(page, "F2", 11, x, y - 14, normalizePdfText(value), COLORS.ink);
}

function drawSectionRule(page: PdfPageDraft, x: number, y: number, width: number): void {
  drawLine(page, x, y, x + width, y, COLORS.line, 0.8);
}

function drawBulletLine(
  page: PdfPageDraft,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: readonly [number, number, number]
): void {
  drawText(page, "F2", fontSize, x, y, "•", COLORS.accent);
  const lines = wrapText(text, CONTENT_WIDTH - 18, fontSize);
  drawWrappedText(page, lines, x + 14, y, "F1", fontSize, color, BODY_LINE_HEIGHT);
}

function drawWrappedText(
  page: PdfPageDraft,
  lines: string[],
  x: number,
  y: number,
  font: FontId,
  size: number,
  color: readonly [number, number, number],
  lineHeight: number,
  align: "left" | "right" = "left"
): void {
  let currentY = y;
  for (const line of lines) {
    drawText(page, font, size, x, currentY, line, color, align);
    currentY -= lineHeight;
  }
}

function drawText(
  page: PdfPageDraft,
  font: FontId,
  size: number,
  x: number,
  y: number,
  text: string,
  color: readonly [number, number, number],
  align: "left" | "right" = "left"
): void {
  const safeText = normalizePdfText(text);
  const tx = align === "right" ? x - estimateTextWidth(safeText, size) : x;
  page.commands.push("q");
  page.commands.push(colorFill(color));
  page.commands.push("BT");
  page.commands.push(`/${font} ${size} Tf`);
  page.commands.push(`1 0 0 1 ${round(tx)} ${round(y)} Tm`);
  page.commands.push(`(${escapePdfText(safeText)}) Tj`);
  page.commands.push("ET");
  page.commands.push("Q");
}

function drawRect(
  page: PdfPageDraft,
  x: number,
  y: number,
  width: number,
  height: number,
  fill?: readonly [number, number, number],
  stroke?: readonly [number, number, number],
  lineWidth = 0.8
): void {
  page.commands.push("q");
  if (fill) page.commands.push(colorFill(fill));
  if (stroke) page.commands.push(colorStroke(stroke));
  page.commands.push(`${lineWidth} w`);
  page.commands.push(`${round(x)} ${round(y)} ${round(width)} ${round(height)} re`);
  if (fill && stroke) {
    page.commands.push("B");
  } else if (fill) {
    page.commands.push("f");
  } else {
    page.commands.push("S");
  }
  page.commands.push("Q");
}

function drawLine(
  page: PdfPageDraft,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: readonly [number, number, number],
  width: number,
  dash?: [number, number]
): void {
  page.commands.push("q");
  page.commands.push(colorStroke(color));
  page.commands.push(`${width} w`);
  if (dash) {
    page.commands.push(`[${dash[0]} ${dash[1]}] 0 d`);
  }
  page.commands.push(`${round(x1)} ${round(y1)} m ${round(x2)} ${round(y2)} l S`);
  page.commands.push("Q");
}

function drawTextCommands(
  commands: string[],
  font: FontId,
  size: number,
  x: number,
  y: number,
  text: string,
  color: readonly [number, number, number],
  align: "left" | "right" = "left"
): void {
  const safeText = normalizePdfText(text);
  const tx = align === "right" ? x - estimateTextWidth(safeText, size) : x;
  commands.push("q");
  commands.push(colorFill(color));
  commands.push("BT");
  commands.push(`/${font} ${size} Tf`);
  commands.push(`1 0 0 1 ${round(tx)} ${round(y)} Tm`);
  commands.push(`(${escapePdfText(safeText)}) Tj`);
  commands.push("ET");
  commands.push("Q");
}

function drawLineCommands(
  commands: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: readonly [number, number, number],
  width: number,
  dash?: [number, number]
): void {
  commands.push("q");
  commands.push(colorStroke(color));
  commands.push(`${width} w`);
  if (dash) {
    commands.push(`[${dash[0]} ${dash[1]}] 0 d`);
  }
  commands.push(`${round(x1)} ${round(y1)} m ${round(x2)} ${round(y2)} l S`);
  commands.push("Q");
}

function estimateTocPageCount(entryCount: number): number {
  const firstPageCapacity = Math.max(1, Math.floor((BODY_TOP - 120 - BODY_BOTTOM) / TOC_ENTRY_HEIGHT));
  const followPageCapacity = Math.max(1, Math.floor((BODY_TOP - 80 - BODY_BOTTOM) / TOC_ENTRY_HEIGHT));
  if (entryCount <= firstPageCapacity) {
    return 1;
  }
  return 1 + Math.ceil((entryCount - firstPageCapacity) / followPageCapacity);
}

function shiftAnchors(
  anchors: Record<string, AnchorRecord>,
  offset: number
): Record<string, AnchorRecord> {
  const shifted: Record<string, AnchorRecord> = {};
  for (const [key, value] of Object.entries(anchors)) {
    shifted[key] = { ...value, pageIndex: value.pageIndex + offset };
  }
  (globalThis as typeof globalThis & { __reposcribePdfAnchors?: Record<string, AnchorRecord> }).__reposcribePdfAnchors = shifted;
  return shifted;
}

function makePageAnchorKey(page: DocumentationPage): string {
  return `page:${page.filePath}`;
}

function makeSectionAnchorKey(page: DocumentationPage, section: DocumentationSection): string {
  return `section:${page.filePath}#${slugify(section.heading)}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function wrapText(value: string, width: number, fontSize: number): string[] {
  const text = normalizePdfText(value);
  if (!text) {
    return [""];
  }

  const words = text.split(/\s+/).filter(Boolean);
  const maxChars = Math.max(12, Math.floor(width / (fontSize * 0.53)));
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    if (word.length > maxChars) {
      lines.push(word.slice(0, maxChars));
      current = word.slice(maxChars);
    } else {
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function normalizePdfText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\t/g, "  ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/•/g, "*")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trimEnd();
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.53;
}

function colorFill(color: readonly [number, number, number]): string {
  return `${color[0]} ${color[1]} ${color[2]} rg`;
}

function colorStroke(color: readonly [number, number, number]): string {
  return `${color[0]} ${color[1]} ${color[2]} RG`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function firstSentence(value: string): string {
  const normalized = normalizePdfText(value);
  const match = normalized.match(/(.+?[.!?])(\s|$)/);
  return match?.[1] ?? normalized;
}

export default PdfRenderer;
