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
  FunctionExpression,
  EnumDeclaration,
  TypeAliasDeclaration,
  MethodDeclaration,
  PropertyDeclaration,
  ConstructorDeclaration,
  ParameterDeclaration,
  GetAccessorDeclaration,
  SetAccessorDeclaration,
  VariableDeclaration,
  ArrowFunction,
  JSDoc,
  JSDocTag,
  Type,
  Scope,
  SyntaxKind,
  Node,
} from "ts-morph";

import {
  ParserPlugin,
  PluginConfig,
  PluginValidationResult,
  ModuleNode,
  ModuleKind,
  MemberNode,
  MemberKind,
  Visibility,
  ParamNode,
  TypeRef,
  ThrowsNode,
  DocTag,
  DecoratorNode,
  CodeExample,
  TypeParamNode,
  DependencyRef,
  DocIR,
  createEmptyDocIR,
  createEmptyCoverage,
  createDefaultSourceFacts,
  SourceFacts,
} from "@docgen/core";

export class TypeScriptParser implements ParserPlugin {
  readonly name = "@docgen/parser-typescript";
  readonly version = "1.0.0";
  readonly type = "parser" as const;
  readonly language = "typescript" as const;
  readonly supports = ["typescript", "tsx", "ts"];

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

  async parse(files: string[], langConfig: any): Promise<DocIR> {
    const startTime = Date.now();
    const modules: ModuleNode[] = [];

    // Create ts-morph project
    const tsConfigPath = this.findTsConfig(process.cwd()); // Will use correct workDir conceptually
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
        // Here we assume the source root can be passed statically, 
        // normally we would resolve the best common prefix
        const fileModules = this.parseSourceFile(sourceFile, process.cwd());
        modules.push(...fileModules);
      } catch (err: any) {
        console.error(`Failed to parse ${sourceFile.getFilePath()}: ${err.message}`);
      }
    }

    const docir = createEmptyDocIR({
        name: "unnamed",
        version: "0.0.0",
        languages: ["typescript"]
    });
    docir.modules = modules;
    return docir;
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

    for (const declarations of sourceFile.getExportedDeclarations().values()) {
      for (const declaration of declarations) {
        if (!Node.isVariableDeclaration(declaration)) {
          continue;
        }

        const module = this.parseExportedVariable(declaration, filePath);
        if (module) {
          modules.push(module);
        }
      }
    }

    if (modules.length === 0 && this.isReExportOnlyFile(sourceFile)) {
      modules.push(this.parseReExportModule(sourceFile, filePath));
    }

    return modules;
  }

  // ── Class Parsing ───────────────────────────────────────────

  private parseClass(cls: ClassDeclaration, filePath: string): ModuleNode {
    const name = cls.getName() || "AnonymousClass";
    const members: MemberNode[] = [];
    const dependencies = this.extractDependencies(cls);

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
      kind: "class",
      description: this.extractDescription(cls),
      tags: this.extractTags(cls),
      members,
      dependencies,
      examples: this.extractExamples(cls),
      coverage: createEmptyCoverage(),
      decorators: this.extractDecorators(cls),
      typeParameters: this.extractGenerics(cls),
      extends: cls.getExtends()?.getText(),
      implements: cls.getImplements().map((i) => i.getText()),
      exports: { isDefault: cls.isDefaultExport(), isNamed: cls.isExported() },
      sourceFacts: this.buildSourceFacts(cls.getSourceFile(), filePath, {
        kind: "class",
        name,
        isTypeOnly: false,
        members,
        dependencies,
      }),
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
      typeParameters: this.extractGenerics(iface),
      extends: iface.getExtends().length > 0
        ? iface.getExtends().map(e => e.getText()).join(", ")
        : undefined,
      implements: [],
      exports: { isDefault: iface.isDefaultExport(), isNamed: iface.isExported() },
      sourceFacts: this.buildSourceFacts(iface.getSourceFile(), filePath, {
        kind: "interface",
        name,
        isTypeOnly: true,
        members,
      }),
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
      typeParameters: [],
      exports: { isDefault: enumDecl.isDefaultExport(), isNamed: enumDecl.isExported() },
      sourceFacts: this.buildSourceFacts(enumDecl.getSourceFile(), filePath, {
        kind: "enum",
        name,
        isTypeOnly: false,
        members,
      }),
    };
  }

  // ── Type Alias Parsing ──────────────────────────────────────

  private parseTypeAlias(
    typeAlias: TypeAliasDeclaration,
    filePath: string
  ): ModuleNode {
    const name = typeAlias.getName();
    return {
      id: this.buildId(filePath, name),
      name,
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
      typeParameters: this.extractGenerics(typeAlias),
      exports: { isDefault: typeAlias.isDefaultExport(), isNamed: typeAlias.isExported() },
      sourceFacts: this.buildSourceFacts(typeAlias.getSourceFile(), filePath, {
        kind: "type-alias",
        name,
        isTypeOnly: true,
        members: [],
      }),
    };
  }

  // ── Function Parsing ────────────────────────────────────────

  private parseFunction(
    func: FunctionDeclaration,
    filePath: string
  ): ModuleNode {
    const name = func.getName() || "anonymous";
    const members: MemberNode[] = [
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
      },
    ];
    return {
      id: this.buildId(filePath, name),
      name,
      filePath,
      language: "typescript",
      kind: "function",
      description: this.extractDescription(func),
      tags: this.extractTags(func),
      members,
      dependencies: [],
      examples: this.extractExamples(func),
      coverage: createEmptyCoverage(),
      decorators: [],
      typeParameters: this.extractGenerics(func),
      exports: { isDefault: func.isDefaultExport(), isNamed: func.isExported() },
      sourceFacts: this.buildSourceFacts(func.getSourceFile(), filePath, {
        kind: "function",
        name,
        isTypeOnly: false,
        members,
      }),
    };
  }

  private parseExportedVariable(
    declaration: VariableDeclaration,
    filePath: string
  ): ModuleNode | null {
    const initializer = declaration.getInitializer();
    if (
      !initializer ||
      (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer))
    ) {
      return null;
    }

    const docNode = declaration.getVariableStatement() ?? declaration;
    const name = declaration.getName();
    const members: MemberNode[] = [
      {
        name,
        kind: "method",
        visibility: "public",
        isStatic: false,
        isAsync: initializer.isAsync(),
        isAbstract: false,
        signature: this.buildVariableFunctionSignature(declaration, initializer),
        description: this.extractDescription(docNode),
        parameters: this.extractParameters(initializer.getParameters()),
        returnType: this.buildTypeRef(initializer.getReturnType()),
        throws: this.extractThrows(docNode),
        deprecated: this.extractDeprecation(docNode),
        since: this.extractTagValue(docNode, "since"),
        examples: this.extractExamples(docNode),
        tags: this.extractTags(docNode),
        decorators: [],
      },
    ];

    return {
      id: this.buildId(filePath, name),
      name,
      filePath,
      language: "typescript",
      kind: "function",
      description: this.extractDescription(docNode),
      tags: this.extractTags(docNode),
      members,
      dependencies: [],
      examples: this.extractExamples(docNode),
      coverage: createEmptyCoverage(),
      decorators: [],
      typeParameters: this.extractGenerics(initializer),
      exports: {
        isDefault: declaration.getVariableStatement()?.isDefaultExport() ?? false,
        isNamed: true,
        exportedName: name,
      },
      sourceFacts: this.buildSourceFacts(declaration.getSourceFile(), filePath, {
        kind: "function",
        name,
        isTypeOnly: false,
        members,
      }),
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
          tag: tag.getTagName(),
          description: tag.getCommentText()?.trim() || "",
          raw: tag.getText(),
        } as any);
      }
    }

    return tags;
  }

  private extractTagValue(node: Node, tagName: string): string | undefined {
    const tags = this.extractTags(node);
    const tag = tags.find((t) => t.tag === tagName);
    return tag?.description;
  }

  private extractThrows(node: Node): ThrowsNode[] {
    const tags = this.extractTags(node);
    return tags
      .filter((t) => t.tag === "throws" || t.tag === "exception")
      .map((t) => {
        const parts = t.description.split(/\s+/);
        return {
          type: parts[0] || "Error",
          description: parts.slice(1).join(" "),
        };
      });
  }

  private extractDeprecation(node: Node) {
    const tags = this.extractTags(node);
    const tag = tags.find((t) => t.tag === "deprecated");
    if (!tag) return null;
    return {
      message: tag.description || "Deprecated",
      since: this.extractTagValue(node, "since"),
      replacement: undefined,
    };
  }

  private extractExamples(node: Node): CodeExample[] {
    const tags = this.extractTags(node);
    return tags
      .filter((t) => t.tag === "example")
      .map((t, i) => ({
        title: `Example ${i + 1}`,
        language: "typescript",
        code: t.description,
        description: undefined,
      }));
  }

  // ── Type Building ───────────────────────────────────────────

  private buildTypeRef(type: Type): TypeRef {
    const text = type.getText();
    const isArray = type.isArray();
    const isNullable = type.isNullable() || type.isUndefined();
    const isUnion = type.isUnion();

    return {
      name: this.simplifyTypeName(text),
      raw: text,
      isArray,
      isNullable,
      isUnion,
      typeArguments: type.getTypeArguments().map((t) => this.buildTypeRef(t)),
      unionMembers: isUnion ? type.getUnionTypes().map((t) => this.buildTypeRef(t)) : undefined,
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
      (t) => t.tag === "param" && t.description.startsWith(param.getName())
    );

    if (paramTag) {
      // Strip the param name from the value
      return paramTag.description.replace(new RegExp(`^${param.getName()}\\s*-?\\s*`), "");
    }

    return "";
  }

  // ── Generics ────────────────────────────────────────────────

  private extractGenerics(node: Node): TypeParamNode[] {
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
        ? this.simplifyTypeName(tp.getConstraint().getType().getText())
        : undefined,
      default: tp.getDefault()
        ? this.simplifyTypeName(tp.getDefault().getType().getText())
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

  private parseReExportModule(sourceFile: SourceFile, filePath: string): ModuleNode {
    const name = path.basename(filePath).replace(/\.(ts|tsx)$/, "") || "index";
    const description =
      sourceFile
        .getExportDeclarations()
        .map((declaration) => declaration.getModuleSpecifierValue())
        .filter(Boolean)
        .map((target) => `Re-exports from ${target}.`)
        .join(" ") || "Barrel module that re-exports symbols.";

    return {
      id: this.buildId(filePath, name),
      name,
      filePath,
      language: "typescript",
      kind: "module",
      description,
      tags: [],
      members: [],
      dependencies: sourceFile.getExportDeclarations().map((declaration) => ({
        name: declaration.getNamedExports().map((spec) => spec.getName()).join(", ") || "*",
        source: declaration.getModuleSpecifierValue() ?? "re-export",
        kind: "import",
      })),
      examples: [],
      coverage: createEmptyCoverage(),
      decorators: [],
      typeParameters: [],
      exports: {
        isDefault: false,
        isNamed: true,
        exportedName: name,
      },
      sourceFacts: this.buildSourceFacts(sourceFile, filePath, {
        kind: "module",
        name,
        isTypeOnly: false,
        isReExportOnly: true,
        members: [],
      }),
    };
  }

  private buildSourceFacts(
    sourceFile: SourceFile,
    filePath: string,
    options: {
      kind: ModuleKind;
      name: string;
      isTypeOnly: boolean;
      isReExportOnly?: boolean;
      members: MemberNode[];
      dependencies?: DependencyRef[];
    }
  ): SourceFacts {
    const usesReactHooks = this.fileUsesReactHooks(sourceFile, options.name);
    const usesContext = this.fileUsesContext(sourceFile);
    const usesServiceDependencies = this.fileUsesServiceDependencies(
      sourceFile,
      options.dependencies ?? []
    );
    const featureKey = this.detectFeatureKey(filePath);
    const routeKey = this.detectRouteKey(filePath);
    const isReExportOnly = options.isReExportOnly ?? this.isReExportOnlyFile(sourceFile);
    const fileRole = this.detectFileRole(
      sourceFile,
      filePath,
      options.kind,
      options.name,
      options.isTypeOnly,
      usesReactHooks,
      usesContext,
      usesServiceDependencies,
      isReExportOnly
    );

    return createDefaultSourceFacts({
      fileRole,
      featureKey,
      routeKey,
      isTypeOnly: options.isTypeOnly,
      isReExportOnly,
      isTrivial: this.isTrivialModule(
        fileRole,
        options.kind,
        options.name,
        options.members,
        usesReactHooks,
        usesContext,
        usesServiceDependencies
      ),
      usesReactHooks,
      usesContext,
      usesServiceDependencies,
    });
  }

  private detectFileRole(
    sourceFile: SourceFile,
    filePath: string,
    kind: ModuleKind,
    name: string,
    isTypeOnly: boolean,
    usesReactHooks: boolean,
    usesContext: boolean,
    usesServiceDependencies: boolean,
    isReExportOnly: boolean
  ): SourceFacts["fileRole"] {
    const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();
    const baseName = path.basename(normalizedPath);

    if (
      normalizedPath.includes("/__tests__/") ||
      normalizedPath.includes("/fixtures/") ||
      /\.test\./.test(normalizedPath) ||
      /\.spec\./.test(normalizedPath)
    ) {
      return "test-support";
    }

    if (isReExportOnly) {
      return "unknown";
    }

    if (isTypeOnly && (normalizedPath.includes("/types/") || baseName.includes("types"))) {
      return "types";
    }

    if (this.detectRouteKey(filePath)) {
      return "route";
    }

    if (normalizedPath.includes("/features/") || normalizedPath.includes("/modules/")) {
      return "feature";
    }

    if (
      normalizedPath.includes("/services/") ||
      normalizedPath.includes("/api/") ||
      /service|client|api/.test(name.toLowerCase())
    ) {
      return "service";
    }

    if (
      normalizedPath.includes("/contexts/") ||
      normalizedPath.includes("/context/") ||
      usesContext ||
      /context|provider/.test(name.toLowerCase())
    ) {
      return "context";
    }

    if (
      normalizedPath.includes("/state/") ||
      normalizedPath.includes("/store/") ||
      normalizedPath.includes("/stores/")
    ) {
      return "state";
    }

    if (normalizedPath.includes("/hooks/") || /^use[A-Z]/.test(name)) {
      return "hook";
    }

    if (this.isComponentLike(sourceFile, filePath, kind, name)) {
      if (
        normalizedPath.includes("/components/ui/") ||
        normalizedPath.includes("/components/common/") ||
        normalizedPath.includes("/shared/components/")
      ) {
        return "ui-component";
      }
      return "component";
    }

    if (isTypeOnly) {
      return "types";
    }

    if (normalizedPath.includes("/utils/") || normalizedPath.includes("/lib/")) {
      return "util";
    }

    if (usesServiceDependencies) {
      return "service";
    }

    return "unknown";
  }

  private detectFeatureKey(filePath: string): string | undefined {
    const normalized = filePath.replace(/\\/g, "/");
    const featureMatch = normalized.match(/(?:^|\/)(?:features|modules)\/([^/]+)/i);
    if (featureMatch?.[1]) {
      return this.sanitizeKey(featureMatch[1]);
    }

    const segments = normalized.split("/").filter(Boolean);
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]!;
      const lower = segment.toLowerCase();
      if (
        [
          "src",
          "app",
          "pages",
          "routes",
          "components",
          "services",
          "hooks",
          "contexts",
          "context",
          "state",
          "store",
          "stores",
          "utils",
          "lib",
        ].includes(lower)
      ) {
        continue;
      }
      return this.sanitizeKey(segment);
    }

    return undefined;
  }

  private detectRouteKey(filePath: string): string | undefined {
    const normalized = filePath.replace(/\\/g, "/");
    const routeMatch = normalized.match(/(?:^|\/)(?:pages|routes|app)\/([^/.]+)/i);
    if (routeMatch?.[1]) {
      const raw = routeMatch[1]!.replace(/[\[\]()]/g, "");
      return this.sanitizeKey(raw || "root");
    }

    const baseName = path.basename(normalized, path.extname(normalized)).toLowerCase();
    if (["page", "layout", "route", "loading", "error", "not-found"].includes(baseName)) {
      const parent = path.basename(path.dirname(normalized));
      return this.sanitizeKey(parent || "root");
    }

    return undefined;
  }

  private fileUsesReactHooks(sourceFile: SourceFile, name: string): boolean {
    if (/^use[A-Z]/.test(name)) {
      return true;
    }

    const text = sourceFile.getFullText();
    if (
      /\buse(State|Effect|Memo|Callback|Reducer|Context|Ref|ImperativeHandle|Transition|DeferredValue)\b/.test(
        text
      )
    ) {
      return true;
    }

    return sourceFile
      .getImportDeclarations()
      .some((declaration) =>
        declaration.getNamedImports().some((spec) => spec.getName().startsWith("use"))
      );
  }

  private fileUsesContext(sourceFile: SourceFile): boolean {
    const text = sourceFile.getFullText();
    return /\b(createContext|useContext|Provider)\b/.test(text);
  }

  private fileUsesServiceDependencies(
    sourceFile: SourceFile,
    dependencies: DependencyRef[]
  ): boolean {
    if (dependencies.some((dependency) => /service|client|api/i.test(dependency.name))) {
      return true;
    }

    return sourceFile
      .getImportDeclarations()
      .some((declaration) =>
        /service|client|api/i.test(declaration.getModuleSpecifierValue() ?? "")
      );
  }

  private isComponentLike(
    sourceFile: SourceFile,
    filePath: string,
    kind: ModuleKind,
    name: string
  ): boolean {
    if (kind !== "function" && kind !== "class") {
      return false;
    }

    const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();
    if (!filePath.endsWith(".tsx") && !normalizedPath.includes("/components/")) {
      return false;
    }

    if (!/^[A-Z]/.test(name)) {
      return false;
    }

    const text = sourceFile.getFullText();
    return /<[\w.-]+/.test(text) || /React\.createElement/.test(text);
  }

  private isReExportOnlyFile(sourceFile: SourceFile): boolean {
    const statements = sourceFile.getStatements();
    const hasReExports = sourceFile.getExportDeclarations().length > 0;
    if (!hasReExports) {
      return false;
    }

    return statements.every((statement) =>
      Node.isImportDeclaration(statement) || Node.isExportDeclaration(statement)
    );
  }

  private isTrivialModule(
    fileRole: SourceFacts["fileRole"],
    kind: ModuleKind,
    name: string,
    members: MemberNode[],
    usesReactHooks: boolean,
    usesContext: boolean,
    usesServiceDependencies: boolean
  ): boolean {
    const memberCount = members.length;
    if (fileRole === "test-support") {
      return true;
    }

    if (fileRole === "types") {
      return memberCount <= 3;
    }

    if (fileRole === "ui-component") {
      return !usesReactHooks && !usesContext && !usesServiceDependencies && memberCount <= 1;
    }

    if (kind === "function" && !usesReactHooks && !usesContext && !usesServiceDependencies) {
      return memberCount <= 1 && !/^use[A-Z]/.test(name);
    }

    return false;
  }

  private sanitizeKey(value: string): string {
    return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "core";
  }

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

  private buildVariableFunctionSignature(
    declaration: VariableDeclaration,
    initializer: ArrowFunction | FunctionExpression
  ): string {
    const params = initializer
      .getParameters()
      .map((p) => p.getText())
      .join(", ");
    const returnType = this.simplifyTypeName(initializer.getReturnType().getText());
    const async = initializer.isAsync() ? "async " : "";
    return `${async}const ${declaration.getName()} = (${params}): ${returnType}`;
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
