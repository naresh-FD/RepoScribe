/**
 * TypeScript Parser Plugin
 *
 * Uses ts-morph to parse TypeScript/TSX source files and extract
 * documentation into DocIR ModuleNodes. Handles:
 *  - Classes, interfaces, enums, type aliases, functions
 *  - JSDoc/TSDoc comments
 *  - Decorators and annotations
 *  - Generic type parameters
 *  - Import/export analysis
 */

import * as path from "path";
import fg from "fast-glob";
import {
  Project,
  SourceFile,
  ClassDeclaration,
  InterfaceDeclaration,
  FunctionDeclaration,
  EnumDeclaration,
  TypeAliasDeclaration,
  MethodDeclaration,
  PropertyDeclaration,
  ConstructorDeclaration,
  ParameterDeclaration,
  GetAccessorDeclaration,
  SetAccessorDeclaration,
  JSDoc,
  JSDocTag,
  Type,
  Scope,
  SyntaxKind,
  Node,
} from "ts-morph";

import {
  ParserPlugin,
  ParserInput,
  ParserOutput,
  ParseError,
  ParseStats,
  PluginManifest,
  PluginConfig,
  PluginValidationResult,
  ModuleNode,
  MemberNode,
  MemberKind,
  Visibility,
  ParamNode,
  TypeRef,
  ThrowsNode,
  DocTag,
  DecoratorNode,
  CodeExample,
  GenericParam,
  DependencyRef,
  createEmptyCoverage,
} from "@docgen/core";

export class TypeScriptParser implements ParserPlugin {
  readonly manifest: PluginManifest & { type: "parser" } = {
    name: "@docgen/parser-typescript",
    version: "1.0.0",
    type: "parser",
    description: "Parses TypeScript/TSX files using ts-morph",
    supports: ["typescript", "tsx", "ts"],
  };

  private project: Project | null = null;

  async initialize(_config: PluginConfig): Promise<void> {
    // Project is created per-parse call with the right tsconfig
  }

  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }

  async cleanup(): Promise<void> {
    this.project = null;
  }

  async parse(input: ParserInput): Promise<ParserOutput> {
    const startTime = Date.now();
    const errors: ParseError[] = [];
    const modules: ModuleNode[] = [];

    // Discover files
    const patterns = input.include.map((p) =>
      path.join(input.sourceRoot, p)
    );
    const ignorePatterns = input.exclude.map((p) =>
      path.join(input.sourceRoot, p)
    );

    const files = await fg(patterns, {
      ignore: ignorePatterns,
      absolute: true,
      onlyFiles: true,
    });

    // Create ts-morph project
    const tsConfigPath = this.findTsConfig(input.sourceRoot);
    this.project = new Project({
      tsConfigFilePath: tsConfigPath || undefined,
      skipAddingFilesFromTsConfig: true,
      compilerOptions: tsConfigPath
        ? undefined
        : { strict: true, target: 99, module: 99 },
    });

    // Add source files
    for (const file of files) {
      this.project.addSourceFileAtPath(file);
    }

    // Parse each file
    const sourceFiles = this.project.getSourceFiles();
    for (const sourceFile of sourceFiles) {
      try {
        const fileModules = this.parseSourceFile(sourceFile, input.sourceRoot);
        modules.push(...fileModules);
      } catch (err: any) {
        errors.push({
          filePath: path.relative(input.sourceRoot, sourceFile.getFilePath()),
          line: 0,
          column: 0,
          message: `Failed to parse: ${err.message}`,
          severity: "error",
        });
      }
    }

    const stats: ParseStats = {
      filesScanned: files.length,
      filesParsed: sourceFiles.length,
      modulesFound: modules.length,
      membersFound: modules.reduce((sum, m) => sum + m.members.length, 0),
      parseTimeMs: Date.now() - startTime,
    };

    return { modules, errors, stats };
  }

  // ── File-Level Parsing ──────────────────────────────────────

  private parseSourceFile(
    sourceFile: SourceFile,
    sourceRoot: string
  ): ModuleNode[] {
    const modules: ModuleNode[] = [];
    const filePath = path.relative(sourceRoot, sourceFile.getFilePath());

    // Parse classes
    for (const cls of sourceFile.getClasses()) {
      modules.push(this.parseClass(cls, filePath));
    }

    // Parse interfaces
    for (const iface of sourceFile.getInterfaces()) {
      modules.push(this.parseInterface(iface, filePath));
    }

    // Parse enums
    for (const enumDecl of sourceFile.getEnums()) {
      modules.push(this.parseEnum(enumDecl, filePath));
    }

    // Parse type aliases
    for (const typeAlias of sourceFile.getTypeAliases()) {
      modules.push(this.parseTypeAlias(typeAlias, filePath));
    }

    // Parse standalone exported functions
    for (const func of sourceFile.getFunctions()) {
      if (func.isExported()) {
        modules.push(this.parseFunction(func, filePath));
      }
    }

    return modules;
  }

  // ── Class Parsing ───────────────────────────────────────────

  private parseClass(cls: ClassDeclaration, filePath: string): ModuleNode {
    const name = cls.getName() || "AnonymousClass";
    const members: MemberNode[] = [];

    // Constructors
    for (const ctor of cls.getConstructors()) {
      members.push(this.parseConstructor(ctor));
    }

    // Methods
    for (const method of cls.getMethods()) {
      members.push(this.parseMethod(method));
    }

    // Properties
    for (const prop of cls.getProperties()) {
      members.push(this.parseProperty(prop));
    }

    // Getters
    for (const getter of cls.getGetAccessors()) {
      members.push(this.parseAccessor(getter, "getter"));
    }

    // Setters
    for (const setter of cls.getSetAccessors()) {
      members.push(this.parseAccessor(setter, "setter"));
    }

    return {
      id: this.buildId(filePath, name),
      name,
      filePath,
      language: "typescript",
      kind: cls.isAbstract() ? "abstract-class" : "class",
      description: this.extractDescription(cls),
      tags: this.extractTags(cls),
      members,
      dependencies: this.extractDependencies(cls),
      examples: this.extractExamples(cls),
      coverage: createEmptyCoverage(),
      decorators: this.extractDecorators(cls),
      generics: this.extractGenerics(cls),
      extends: cls.getExtends()?.getText(),
      implements: cls.getImplements().map((i) => i.getText()),
      exported: cls.isExported(),
    };
  }

  // ── Interface Parsing ───────────────────────────────────────

  private parseInterface(
    iface: InterfaceDeclaration,
    filePath: string
  ): ModuleNode {
    const name = iface.getName();
    const members: MemberNode[] = [];

    for (const method of iface.getMethods()) {
      members.push({
        name: method.getName(),
        kind: "method",
        visibility: "public",
        isStatic: false,
        isAsync: false,
        isAbstract: false,
        signature: method.getText(),
        description: this.extractDescription(method),
        parameters: this.extractParameters(method.getParameters()),
        returnType: this.buildTypeRef(method.getReturnType()),
        throws: [],
        deprecated: null,
        since: undefined,
        examples: [],
        tags: this.extractTags(method),
        decorators: [],
        lineNumber: method.getStartLineNumber(),
      });
    }

    for (const prop of iface.getProperties()) {
      members.push({
        name: prop.getName(),
        kind: "property",
        visibility: "public",
        isStatic: false,
        isAsync: false,
        isAbstract: false,
        signature: prop.getText(),
        description: this.extractDescription(prop),
        parameters: [],
        returnType: prop.getType()
          ? this.buildTypeRef(prop.getType())
          : null,
        throws: [],
        deprecated: null,
        since: undefined,
        examples: [],
        tags: this.extractTags(prop),
        decorators: [],
        lineNumber: prop.getStartLineNumber(),
      });
    }

    return {
      id: this.buildId(filePath, name),
      name,
      filePath,
      language: "typescript",
      kind: "interface",
      description: this.extractDescription(iface),
      tags: this.extractTags(iface),
      members,
      dependencies: [],
      examples: this.extractExamples(iface),
      coverage: createEmptyCoverage(),
      decorators: [],
      generics: this.extractGenerics(iface),
      extends: iface.getExtends().length > 0
        ? iface.getExtends().map(e => e.getText()).join(", ")
        : undefined,
      implements: [],
      exported: iface.isExported(),
    };
  }

  // ── Enum Parsing ────────────────────────────────────────────

  private parseEnum(
    enumDecl: EnumDeclaration,
    filePath: string
  ): ModuleNode {
    const name = enumDecl.getName();
    const members: MemberNode[] = enumDecl.getMembers().map((m) => ({
      name: m.getName(),
      kind: "enum-member" as MemberKind,
      visibility: "public" as Visibility,
      isStatic: true,
      isAsync: false,
      isAbstract: false,
      signature: m.getText(),
      description: this.extractDescription(m),
      parameters: [],
      returnType: null,
      throws: [],
      deprecated: null,
      examples: [],
      tags: [],
      decorators: [],
      lineNumber: m.getStartLineNumber(),
    }));

    return {
      id: this.buildId(filePath, name),
      name,
      filePath,
      language: "typescript",
      kind: "enum",
      description: this.extractDescription(enumDecl),
      tags: this.extractTags(enumDecl),
      members,
      dependencies: [],
      examples: [],
      coverage: createEmptyCoverage(),
      decorators: [],
      generics: [],
      exported: enumDecl.isExported(),
    };
  }

  // ── Type Alias Parsing ──────────────────────────────────────

  private parseTypeAlias(
    typeAlias: TypeAliasDeclaration,
    filePath: string
  ): ModuleNode {
    return {
      id: this.buildId(filePath, typeAlias.getName()),
      name: typeAlias.getName(),
      filePath,
      language: "typescript",
      kind: "type-alias",
      description: this.extractDescription(typeAlias),
      tags: this.extractTags(typeAlias),
      members: [],
      dependencies: [],
      examples: this.extractExamples(typeAlias),
      coverage: createEmptyCoverage(),
      decorators: [],
      generics: this.extractGenerics(typeAlias),
      exported: typeAlias.isExported(),
    };
  }

  // ── Function Parsing ────────────────────────────────────────

  private parseFunction(
    func: FunctionDeclaration,
    filePath: string
  ): ModuleNode {
    const name = func.getName() || "anonymous";
    return {
      id: this.buildId(filePath, name),
      name,
      filePath,
      language: "typescript",
      kind: "function",
      description: this.extractDescription(func),
      tags: this.extractTags(func),
      members: [
        {
          name,
          kind: "method",
          visibility: "public",
          isStatic: false,
          isAsync: func.isAsync(),
          isAbstract: false,
          signature: this.buildFunctionSignature(func),
          description: this.extractDescription(func),
          parameters: this.extractParameters(func.getParameters()),
          returnType: this.buildTypeRef(func.getReturnType()),
          throws: this.extractThrows(func),
          deprecated: null,
          examples: this.extractExamples(func),
          tags: this.extractTags(func),
          decorators: [],
          lineNumber: func.getStartLineNumber(),
        },
      ],
      dependencies: [],
      examples: this.extractExamples(func),
      coverage: createEmptyCoverage(),
      decorators: [],
      generics: this.extractGenerics(func),
      exported: func.isExported(),
    };
  }

  // ── Member Parsing ──────────────────────────────────────────

  private parseMethod(method: MethodDeclaration): MemberNode {
    return {
      name: method.getName(),
      kind: "method",
      visibility: this.getVisibility(method),
      isStatic: method.isStatic(),
      isAsync: method.isAsync(),
      isAbstract: method.isAbstract(),
      signature: this.buildMethodSignature(method),
      description: this.extractDescription(method),
      parameters: this.extractParameters(method.getParameters()),
      returnType: this.buildTypeRef(method.getReturnType()),
      throws: this.extractThrows(method),
      deprecated: this.extractDeprecation(method),
      since: this.extractTagValue(method, "since"),
      examples: this.extractExamples(method),
      tags: this.extractTags(method),
      decorators: this.extractDecorators(method),
      overrides: method.hasOverrideKeyword() ? "parent" : undefined,
      lineNumber: method.getStartLineNumber(),
    };
  }

  private parseProperty(prop: PropertyDeclaration): MemberNode {
    return {
      name: prop.getName(),
      kind: "property",
      visibility: this.getVisibility(prop),
      isStatic: prop.isStatic(),
      isAsync: false,
      isAbstract: prop.isAbstract(),
      signature: prop.getText(),
      description: this.extractDescription(prop),
      parameters: [],
      returnType: this.buildTypeRef(prop.getType()),
      throws: [],
      deprecated: this.extractDeprecation(prop),
      since: this.extractTagValue(prop, "since"),
      examples: [],
      tags: this.extractTags(prop),
      decorators: this.extractDecorators(prop),
      lineNumber: prop.getStartLineNumber(),
    };
  }

  private parseConstructor(ctor: ConstructorDeclaration): MemberNode {
    return {
      name: "constructor",
      kind: "constructor",
      visibility: this.getVisibility(ctor),
      isStatic: false,
      isAsync: false,
      isAbstract: false,
      signature: `constructor(${ctor
        .getParameters()
        .map((p) => p.getText())
        .join(", ")})`,
      description: this.extractDescription(ctor),
      parameters: this.extractParameters(ctor.getParameters()),
      returnType: null,
      throws: [],
      deprecated: null,
      examples: [],
      tags: this.extractTags(ctor),
      decorators: [],
      lineNumber: ctor.getStartLineNumber(),
    };
  }

  private parseAccessor(
    accessor: GetAccessorDeclaration | SetAccessorDeclaration,
    kind: "getter" | "setter"
  ): MemberNode {
    return {
      name: accessor.getName(),
      kind,
      visibility: this.getVisibility(accessor),
      isStatic: accessor.isStatic(),
      isAsync: false,
      isAbstract: accessor.isAbstract(),
      signature: accessor.getText().split("{")[0].trim(),
      description: this.extractDescription(accessor),
      parameters:
        kind === "setter"
          ? this.extractParameters(
              (accessor as SetAccessorDeclaration).getParameters()
            )
          : [],
      returnType:
        kind === "getter"
          ? this.buildTypeRef(accessor.getType())
          : null,
      throws: [],
      deprecated: this.extractDeprecation(accessor),
      examples: [],
      tags: this.extractTags(accessor),
      decorators: this.extractDecorators(accessor),
      lineNumber: accessor.getStartLineNumber(),
    };
  }

  // ── JSDoc Extraction ────────────────────────────────────────

  private getJsDocs(node: Node): JSDoc[] {
    if ("getJsDocs" in node && typeof (node as any).getJsDocs === "function") {
      return (node as any).getJsDocs() as JSDoc[];
    }
    return [];
  }

  private extractDescription(node: Node): string {
    const docs = this.getJsDocs(node);
    if (docs.length === 0) return "";

    return docs
      .map((doc) => doc.getDescription().trim())
      .filter(Boolean)
      .join("\n\n");
  }

  private extractTags(node: Node): DocTag[] {
    const docs = this.getJsDocs(node);
    const tags: DocTag[] = [];

    for (const doc of docs) {
      for (const tag of doc.getTags()) {
        tags.push({
          name: tag.getTagName(),
          value: tag.getCommentText()?.trim() || "",
          raw: tag.getText(),
        });
      }
    }

    return tags;
  }

  private extractTagValue(node: Node, tagName: string): string | undefined {
    const tags = this.extractTags(node);
    const tag = tags.find((t) => t.name === tagName);
    return tag?.value;
  }

  private extractThrows(node: Node): ThrowsNode[] {
    const tags = this.extractTags(node);
    return tags
      .filter((t) => t.name === "throws" || t.name === "exception")
      .map((t) => {
        const parts = t.value.split(/\s+/);
        return {
          type: parts[0] || "Error",
          description: parts.slice(1).join(" "),
        };
      });
  }

  private extractDeprecation(node: Node) {
    const tags = this.extractTags(node);
    const tag = tags.find((t) => t.name === "deprecated");
    if (!tag) return null;
    return {
      message: tag.value || "Deprecated",
      since: this.extractTagValue(node, "since"),
      replacement: undefined,
    };
  }

  private extractExamples(node: Node): CodeExample[] {
    const tags = this.extractTags(node);
    return tags
      .filter((t) => t.name === "example")
      .map((t, i) => ({
        title: `Example ${i + 1}`,
        language: "typescript",
        code: t.value,
        description: undefined,
      }));
  }

  // ── Type Building ───────────────────────────────────────────

  private buildTypeRef(type: Type): TypeRef {
    const text = type.getText();
    const isArray = type.isArray();
    const isNullable =
      type.isNullable() || type.isUndefined();

    return {
      name: this.simplifyTypeName(text),
      raw: text,
      isArray,
      isOptional: false,
      isNullable,
      generics: type.getTypeArguments().map((t) => this.buildTypeRef(t)),
    };
  }

  private simplifyTypeName(text: string): string {
    // Remove import() paths: import("./path").Type → Type
    return text.replace(/import\([^)]+\)\./g, "");
  }

  private extractParameters(params: ParameterDeclaration[]): ParamNode[] {
    return params.map((p) => ({
      name: p.getName(),
      type: this.buildTypeRef(p.getType()),
      description: this.getParamDescription(p),
      isOptional: p.isOptional(),
      isRest: p.isRestParameter(),
      defaultValue: p.getInitializer()?.getText(),
    }));
  }

  private getParamDescription(param: ParameterDeclaration): string {
    // Walk up to the function/method and find matching @param tag
    const parent = param.getParent();
    if (!parent) return "";

    const tags = this.extractTags(parent);
    const paramTag = tags.find(
      (t) => t.name === "param" && t.value.startsWith(param.getName())
    );

    if (paramTag) {
      // Strip the param name from the value
      return paramTag.value.replace(new RegExp(`^${param.getName()}\\s*-?\\s*`), "");
    }

    return "";
  }

  // ── Generics ────────────────────────────────────────────────

  private extractGenerics(node: Node): GenericParam[] {
    if (
      !("getTypeParameters" in node) ||
      typeof (node as any).getTypeParameters !== "function"
    ) {
      return [];
    }

    const typeParams = (node as any).getTypeParameters() as any[];
    return typeParams.map((tp: any) => ({
      name: tp.getName(),
      constraint: tp.getConstraint()
        ? this.buildTypeRef(tp.getConstraint().getType())
        : undefined,
      default: tp.getDefault()
        ? this.buildTypeRef(tp.getDefault().getType())
        : undefined,
    }));
  }

  // ── Decorators ──────────────────────────────────────────────

  private extractDecorators(node: Node): DecoratorNode[] {
    if (
      !("getDecorators" in node) ||
      typeof (node as any).getDecorators !== "function"
    ) {
      return [];
    }

    return (node as any).getDecorators().map((d: any) => {
      const args: Record<string, string> = {};
      const callArgs = d.getArguments?.() || [];
      callArgs.forEach((arg: any, i: number) => {
        args[`arg${i}`] = arg.getText();
      });

      return {
        name: d.getName(),
        arguments: args,
        raw: d.getText(),
      };
    });
  }

  // ── Dependencies ────────────────────────────────────────────

  private extractDependencies(cls: ClassDeclaration): DependencyRef[] {
    const deps: DependencyRef[] = [];
    const sourceFile = cls.getSourceFile();

    // Inheritance
    const ext = cls.getExtends();
    if (ext) {
      deps.push({
        name: ext.getText(),
        source: "extends",
        kind: "inheritance",
      });
    }

    for (const impl of cls.getImplements()) {
      deps.push({
        name: impl.getText(),
        source: "implements",
        kind: "inheritance",
      });
    }

    // Constructor injection (common in Angular/NestJS)
    for (const ctor of cls.getConstructors()) {
      for (const param of ctor.getParameters()) {
        if (param.getScope() !== undefined) {
          // Has visibility modifier → likely DI
          deps.push({
            name: param.getType().getText(),
            source: param.getName(),
            kind: "injection",
          });
        }
      }
    }

    return deps;
  }

  // ── Helpers ─────────────────────────────────────────────────

  private getVisibility(node: any): Visibility {
    if (typeof node.getScope === "function") {
      const scope = node.getScope();
      if (scope === Scope.Protected) return "protected";
      if (scope === Scope.Private) return "private";
    }
    return "public";
  }

  private buildId(filePath: string, name: string): string {
    const modulePath = filePath
      .replace(/\.(ts|tsx)$/, "")
      .replace(/[/\\]/g, ".");
    return `${modulePath}.${name}`;
  }

  private buildMethodSignature(method: MethodDeclaration): string {
    const params = method
      .getParameters()
      .map((p) => p.getText())
      .join(", ");
    const returnType = method.getReturnType().getText();
    const async = method.isAsync() ? "async " : "";
    const staticMod = method.isStatic() ? "static " : "";
    return `${staticMod}${async}${method.getName()}(${params}): ${this.simplifyTypeName(returnType)}`;
  }

  private buildFunctionSignature(func: FunctionDeclaration): string {
    const params = func
      .getParameters()
      .map((p) => p.getText())
      .join(", ");
    const returnType = func.getReturnType().getText();
    const async = func.isAsync() ? "async " : "";
    return `${async}function ${func.getName() || "anonymous"}(${params}): ${this.simplifyTypeName(returnType)}`;
  }

  private findTsConfig(sourceRoot: string): string | null {
    const candidates = ["tsconfig.json", "tsconfig.base.json"];
    let dir = path.resolve(sourceRoot);
    const root = path.parse(dir).root;

    while (dir !== root) {
      for (const name of candidates) {
        const candidate = path.join(dir, name);
        try {
          require("fs").accessSync(candidate);
          return candidate;
        } catch {}
      }
      dir = path.dirname(dir);
    }

    return null;
  }
}

export default TypeScriptParser;
