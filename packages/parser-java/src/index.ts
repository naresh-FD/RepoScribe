import * as fs from "node:fs";
import * as path from "node:path";
import Parser = require("web-tree-sitter");
import {
  createDefaultSourceFacts,
  createEmptyCoverage,
  createEmptyDocIR,
  type DecoratorNode,
  type DocIR,
  type DocTag,
  type EndpointInfo,
  type EndpointParameter,
  type MemberNode,
  type ModuleNode,
  type ParamNode,
  type ParserPlugin,
  type PluginConfig,
  type PluginValidationResult,
  type ReactProp,
  type ThrowsNode,
  type TypeRef,
  type Visibility,
} from "@docgen/core";

type SyntaxNode = Parser.SyntaxNode;

const TYPE_DECLARATIONS = new Set([
  "class_declaration",
  "interface_declaration",
  "enum_declaration",
]);
const STEREOTYPES = new Set([
  "RestController",
  "Controller",
  "Service",
  "Repository",
  "Component",
]);

export class JavaParser implements ParserPlugin {
  readonly name = "@docgen/parser-java";
  readonly version = "1.1.0";
  readonly type = "parser" as const;
  readonly language = "java" as const;
  readonly supports = ["java"];

  private parser: Parser | null = null;
  private workDir = process.cwd();

  async initialize(config: PluginConfig): Promise<void> {
    this.workDir = config.workDir;
    if (!this.parser) {
      await Parser.init();
      const wasmPath = require.resolve("tree-sitter-wasms/out/tree-sitter-java.wasm");
      const language = await Parser.Language.load(wasmPath);
      this.parser = new Parser();
      this.parser.setLanguage(language);
    }
  }

  async validate(): Promise<PluginValidationResult> {
    return { valid: true, errors: [], warnings: [] };
  }

  async cleanup(): Promise<void> {}

  async parse(files: string[], _langConfig: unknown): Promise<DocIR> {
    if (!this.parser) {
      await this.initialize({
        projectConfig: {} as PluginConfig["projectConfig"],
        workDir: this.workDir,
        options: {},
        logger: console as unknown as PluginConfig["logger"],
      });
    }

    const modules: ModuleNode[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const tree = this.parser!.parse(source);
      if (!tree) continue;
      const packageName = this.extractPackage(tree.rootNode);
      const imports = tree.rootNode.namedChildren
        .filter((node) => node.type === "import_declaration")
        .map((node) => node.text.replace(/^import\s+|;$/g, "").trim());
      for (const declaration of tree.rootNode.namedChildren.filter((node) =>
        TYPE_DECLARATIONS.has(node.type)
      )) {
        modules.push(
          this.parseTypeDeclaration(
            declaration,
            path.relative(this.workDir, file),
            packageName,
            imports
          )
        );
      }
      tree.delete();
    }

    const docir = createEmptyDocIR({
      name: "unnamed",
      version: "0.0.0",
      languages: ["java"],
    });
    docir.modules = modules;
    return docir;
  }

  private parseTypeDeclaration(
    node: SyntaxNode,
    filePath: string,
    packageName: string,
    imports: string[]
  ): ModuleNode {
    const name = node.childForFieldName("name")?.text ?? "Anonymous";
    const annotations = this.extractAnnotations(node);
    const body = node.childForFieldName("body");
    const classPrefix = this.mappingPath(annotations);
    const members = body
      ? body.namedChildren
          .filter((child) =>
            ["method_declaration", "constructor_declaration", "field_declaration", "enum_constant"].includes(child.type)
          )
          .flatMap((child) => this.parseMember(child, classPrefix))
      : [];
    const superclass = node.childForFieldName("superclass")?.text.replace(/^extends\s+/, "");
    const interfaces = (node.childForFieldName("interfaces")?.text
      .replace(/^(?:implements|extends)\s+/, "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)) ?? [];
    const stereotype = annotations.find((annotation) => STEREOTYPES.has(annotation.name))?.name;

    return {
      id: packageName ? `${packageName}.${name}` : name,
      name,
      filePath,
      language: "java",
      kind:
        node.type === "interface_declaration"
          ? "interface"
          : node.type === "enum_declaration"
            ? "enum"
            : "class",
      description: this.javadoc(node).description,
      tags: this.javadoc(node).tags,
      members,
      dependencies: [
        ...imports.map((source) => ({
          name: source.split(".").pop() ?? source,
          source,
          kind: "import" as const,
        })),
        ...(superclass
          ? [{ name: superclass, source: superclass, kind: "inheritance" as const }]
          : []),
      ],
      examples: [],
      coverage: createEmptyCoverage(),
      decorators: annotations,
      typeParameters: this.parseTypeParameters(node),
      extends: superclass,
      implements: interfaces.length ? interfaces : undefined,
      exports: { isDefault: false, isNamed: true, exportedName: name },
      sourceFacts: createDefaultSourceFacts({
        fileRole:
          stereotype === "Service" || stereotype === "Repository"
            ? "service"
            : stereotype === "RestController" || stereotype === "Controller"
              ? "route"
              : "unknown",
        usesServiceDependencies: stereotype === "Service" || stereotype === "Repository",
      }),
    };
  }

  private parseMember(node: SyntaxNode, classPrefix: string): MemberNode[] {
    if (node.type === "field_declaration") {
      const type = this.typeRef(node.childForFieldName("type")?.text ?? "Object");
      return node.namedChildren
        .filter((child) => child.type === "variable_declarator")
        .map((declaration) => ({
          ...this.memberBase(node),
          name: declaration.childForFieldName("name")?.text ?? declaration.text,
          kind: "field" as const,
          signature: node.text.replace(/;$/, ""),
          parameters: [],
          returnType: type,
        }));
    }
    if (node.type === "enum_constant") {
      return [{
        ...this.memberBase(node),
        name: node.childForFieldName("name")?.text ?? node.text,
        kind: "enum-member",
        signature: node.text,
        parameters: [],
        returnType: null,
      }];
    }

    const isConstructor = node.type === "constructor_declaration";
    const name = node.childForFieldName("name")?.text ?? (isConstructor ? "constructor" : "anonymous");
    const parameters = this.parseParameters(node.childForFieldName("parameters"));
    const returnType = isConstructor
      ? null
      : this.typeRef(node.childForFieldName("type")?.text ?? "void");
    const annotations = this.extractAnnotations(node);
    return [{
      ...this.memberBase(node),
      name,
      kind: isConstructor ? "constructor" : "method",
      isAbstract: !node.childForFieldName("body"),
      signature: this.compactSignature(node),
      parameters,
      returnType,
      decorators: annotations,
      endpoint: isConstructor
        ? undefined
        : this.extractEndpoint(annotations, parameters, returnType!, classPrefix),
    }];
  }

  private memberBase(node: SyntaxNode): Omit<MemberNode, "name" | "kind" | "signature" | "parameters" | "returnType"> {
    const docs = this.javadoc(node);
    const modifiers = this.modifierText(node);
    return {
      visibility: this.visibility(modifiers),
      isStatic: /\bstatic\b/.test(modifiers),
      isAbstract: /\babstract\b/.test(modifiers),
      isAsync: false,
      description: docs.description,
      throws: docs.throws,
      tags: docs.tags,
      examples: [],
      deprecated: docs.deprecated
        ? { message: docs.deprecated, since: docs.since }
        : null,
      since: docs.since,
      decorators: this.extractAnnotations(node),
    };
  }

  private parseParameters(parametersNode: SyntaxNode | null): ParamNode[] {
    if (!parametersNode) return [];
    return parametersNode.namedChildren
      .filter((node) => node.type === "formal_parameter" || node.type === "spread_parameter")
      .map((node) => {
        const name = node.childForFieldName("name")?.text ?? "arg";
        const docs = this.javadoc(node.parent ?? node);
        return {
          name,
          type: this.typeRef(node.childForFieldName("type")?.text ?? "Object"),
          description:
            docs.tags.find((tag) => tag.tag === "param" && tag.name === name)?.description ?? "",
          isOptional: false,
          isRest: node.type === "spread_parameter",
        };
      });
  }

  private extractEndpoint(
    annotations: DecoratorNode[],
    parameters: ParamNode[],
    returnType: TypeRef,
    classPrefix: string
  ): EndpointInfo | undefined {
    const mapping = annotations.find((annotation) =>
      /^(?:Get|Post|Put|Delete|Patch|Request)Mapping$/.test(annotation.name)
    );
    if (!mapping) return undefined;
    const methodMap: Record<string, EndpointInfo["httpMethod"]> = {
      GetMapping: "GET",
      PostMapping: "POST",
      PutMapping: "PUT",
      DeleteMapping: "DELETE",
      PatchMapping: "PATCH",
      RequestMapping: this.requestMappingMethod(mapping.raw),
    };
    const pathVariables: EndpointParameter[] = [];
    const queryParameters: EndpointParameter[] = [];
    let requestBody: TypeRef | null = null;
    const parameterNodes = this.findParameterNodes(mapping, parameters);
    for (const { parameter, annotations: parameterAnnotations } of parameterNodes) {
      const pathVariable = parameterAnnotations.find((item) => item.name === "PathVariable");
      const requestParam = parameterAnnotations.find((item) => item.name === "RequestParam");
      if (pathVariable) {
        pathVariables.push({
          name: this.annotationName(pathVariable.raw) ?? parameter.name,
          type: parameter.type,
          required: true,
        });
      } else if (requestParam) {
        const defaultValue = this.annotationAttribute(requestParam.raw, "defaultValue");
        queryParameters.push({
          name: this.annotationName(requestParam.raw) ?? parameter.name,
          type: parameter.type,
          required: this.annotationAttribute(requestParam.raw, "required") !== "false" && !defaultValue,
          defaultValue,
        });
      } else if (parameterAnnotations.some((item) => item.name === "RequestBody")) {
        requestBody = parameter.type;
      }
    }
    return {
      httpMethod: methodMap[mapping.name] ?? "ANY",
      path: this.joinRoutes(classPrefix, this.mappingPath([mapping])),
      pathVariables,
      queryParameters,
      requestBody,
      responseType: this.unwrapResponseEntity(returnType),
    };
  }

  private findParameterNodes(
    mapping: DecoratorNode,
    parameters: ParamNode[]
  ): Array<{ parameter: ParamNode; annotations: DecoratorNode[] }> {
    const methodNode = (mapping as DecoratorNode & { __node?: SyntaxNode }).__node?.parent?.parent;
    const parameterList = methodNode?.childForFieldName("parameters");
    return parameters.map((parameter, index) => ({
      parameter,
      annotations: parameterList?.namedChildren[index]
        ? this.extractAnnotations(parameterList.namedChildren[index])
        : [],
    }));
  }

  private extractAnnotations(node: SyntaxNode): DecoratorNode[] {
    const modifiers = node.namedChildren.find((child) => child.type === "modifiers");
    if (!modifiers) return [];
    return modifiers.namedChildren
      .filter((child) => child.type.includes("annotation"))
      .map((annotation) => {
        const name = annotation.namedChildren[0]?.text.split(".").pop() ?? annotation.text.replace(/^@/, "");
        const result: DecoratorNode & { __node?: SyntaxNode } = {
          name,
          arguments: {},
          raw: annotation.text,
        };
        Object.defineProperty(result, "__node", { value: annotation, enumerable: false });
        return result;
      });
  }

  private javadoc(node: SyntaxNode): {
    description: string;
    tags: DocTag[];
    throws: ThrowsNode[];
    since?: string;
    deprecated?: string;
  } {
    const previous = node.previousNamedSibling;
    if (!previous || previous.type !== "block_comment" || !previous.text.startsWith("/**")) {
      return { description: "", tags: [], throws: [] };
    }
    const lines = previous.text
      .replace(/^\/\*\*|\*\/$/g, "")
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\*\s?/, "").trim());
    const description: string[] = [];
    const tags: DocTag[] = [];
    const throws: ThrowsNode[] = [];
    let since: string | undefined;
    let deprecated: string | undefined;
    for (const line of lines) {
      const match = line.match(/^@(\w+)\s*(.*)$/);
      if (!match) {
        if (line) description.push(line);
        continue;
      }
      const [, tag, value] = match;
      if (tag === "param") {
        const [, name = "", text = ""] = value.match(/^(\S+)\s*(.*)$/) ?? [];
        tags.push({ tag, name, description: text.replace(/^-\s*/, "") });
      } else if (tag === "return") {
        tags.push({ tag: "returns", description: value });
      } else if (tag === "throws" || tag === "exception") {
        const [, type = "Exception", text = ""] = value.match(/^(\S+)\s*(.*)$/) ?? [];
        throws.push({ type, description: text.replace(/^-\s*/, "") });
        tags.push({ tag: "throws", name: type, description: text.replace(/^-\s*/, "") });
      } else {
        tags.push({ tag, description: value });
        if (tag === "since") since = value;
        if (tag === "deprecated") deprecated = value || "Deprecated";
      }
    }
    return { description: description.join(" "), tags, throws, since, deprecated };
  }

  private parseTypeParameters(node: SyntaxNode): Array<{ name: string; constraint?: string }> {
    const typeParameters = node.childForFieldName("type_parameters");
    if (!typeParameters) return [];
    return typeParameters.namedChildren.map((parameter) => ({
      name: parameter.childForFieldName("name")?.text ?? parameter.text.split(/\s/)[0],
      constraint: parameter.text.includes("extends")
        ? parameter.text.replace(/^\w+\s+/, "")
        : undefined,
    }));
  }

  private typeRef(raw: string): TypeRef {
    const normalized = raw.trim();
    const base = normalized.replace(/\[\]$/, "").split(/[<\s|?]/)[0] || normalized;
    const generic = normalized.match(/^[^<]+<(.+)>$/);
    return {
      raw: normalized,
      name: base,
      typeArguments: generic ? this.splitGeneric(generic[1]).map((value) => this.typeRef(value)) : undefined,
      isArray: normalized.endsWith("[]"),
      isNullable: false,
      isUnion: false,
    };
  }

  private unwrapResponseEntity(type: TypeRef): TypeRef {
    return type.name.endsWith("ResponseEntity") && type.typeArguments?.[0]
      ? type.typeArguments[0]
      : type;
  }

  private splitGeneric(value: string): string[] {
    const result: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < value.length; index += 1) {
      if (value[index] === "<") depth += 1;
      if (value[index] === ">") depth -= 1;
      if (value[index] === "," && depth === 0) {
        result.push(value.slice(start, index).trim());
        start = index + 1;
      }
    }
    result.push(value.slice(start).trim());
    return result;
  }

  private extractPackage(root: SyntaxNode): string {
    return root.namedChildren
      .find((node) => node.type === "package_declaration")
      ?.text.replace(/^package\s+|;$/g, "")
      .trim() ?? "";
  }

  private modifierText(node: SyntaxNode): string {
    return node.namedChildren.find((child) => child.type === "modifiers")?.text ?? "";
  }

  private visibility(modifiers: string): Visibility {
    if (/\bprivate\b/.test(modifiers)) return "private";
    if (/\bprotected\b/.test(modifiers)) return "protected";
    if (/\bpublic\b/.test(modifiers)) return "public";
    return "internal";
  }

  private compactSignature(node: SyntaxNode): string {
    const body = node.childForFieldName("body");
    return node.text.slice(0, body ? body.startIndex - node.startIndex : undefined).trim();
  }

  private mappingPath(annotations: DecoratorNode[]): string {
    const mapping = annotations.find((annotation) => /Mapping$/.test(annotation.name));
    if (!mapping) return "";
    return this.annotationAttribute(mapping.raw, "path") ??
      this.annotationAttribute(mapping.raw, "value") ??
      mapping.raw.match(/@\w+Mapping\s*\(\s*"([^"]+)"/)?.[1] ??
      "";
  }

  private requestMappingMethod(raw: string): EndpointInfo["httpMethod"] {
    const match = raw.match(/RequestMethod\.(GET|POST|PUT|DELETE|PATCH)/);
    return (match?.[1] as EndpointInfo["httpMethod"]) ?? "ANY";
  }

  private annotationName(raw: string): string | undefined {
    return this.annotationAttribute(raw, "name") ??
      this.annotationAttribute(raw, "value") ??
      raw.match(/@\w+\s*\(\s*"([^"]+)"/)?.[1];
  }

  private annotationAttribute(raw: string, name: string): string | undefined {
    const quoted = raw.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`));
    if (quoted) return quoted[1];
    return raw.match(new RegExp(`${name}\\s*=\\s*([^,)]+)`))?.[1]?.trim();
  }

  private joinRoutes(prefix: string, route: string): string {
    const joined = `/${prefix}/${route}`.replace(/\/+/g, "/");
    return joined.length > 1 ? joined.replace(/\/$/, "") : joined;
  }
}

export default JavaParser;
