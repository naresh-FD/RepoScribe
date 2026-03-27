import * as fs from "fs";
import * as path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@docgen/core", async () => await import("../../core/src"));

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("TypeScriptParser source facts", () => {
  it("classifies route, service, hook, and barrel modules", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(process.cwd(), ".tmp-parser-")
    );
    tempDirs.push(tempDir);

    fs.mkdirSync(path.join(tempDir, "src", "pages", "dashboard"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "src", "services"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "src", "hooks"), { recursive: true });

    fs.writeFileSync(
      path.join(tempDir, "src", "pages", "dashboard", "page.tsx"),
      [
        "import { useState } from 'react';",
        "export function DashboardPage() {",
        "  const [count] = useState(0);",
        "  return <div>{count}</div>;",
        "}",
      ].join("\n")
    );
    fs.writeFileSync(
      path.join(tempDir, "src", "services", "userService.ts"),
      "export function getUser() { return fetch('/api/user'); }"
    );
    fs.writeFileSync(
      path.join(tempDir, "src", "hooks", "useProfile.ts"),
      "export function useProfile() { return { name: 'demo' }; }"
    );
    fs.writeFileSync(
      path.join(tempDir, "src", "index.ts"),
      "export * from './services/userService';"
    );

    const { TypeScriptParser } = await import("./index");
    const parser = new TypeScriptParser();
    const docir = await parser.parse(
      [
        path.join(tempDir, "src", "pages", "dashboard", "page.tsx"),
        path.join(tempDir, "src", "services", "userService.ts"),
        path.join(tempDir, "src", "hooks", "useProfile.ts"),
        path.join(tempDir, "src", "index.ts"),
      ],
      {
        name: "typescript",
        source: "src",
        include: ["**/*.ts", "**/*.tsx"],
        exclude: [],
        parser: "@docgen/parser-typescript",
        options: {},
      }
    );

    const byName = new Map(docir.modules.map((module) => [module.name, module]));
    expect(byName.get("DashboardPage")?.sourceFacts.fileRole).toBe("route");
    expect(byName.get("DashboardPage")?.sourceFacts.usesReactHooks).toBe(true);
    expect(byName.get("getUser")?.sourceFacts.fileRole).toBe("service");
    expect(byName.get("useProfile")?.sourceFacts.fileRole).toBe("hook");
    expect(byName.get("index")?.sourceFacts.isReExportOnly).toBe(true);
  });
});
