import * as fs from "fs";
import * as path from "path";
import { generateDefaultConfig } from "@docgen/core";

interface InitOptions {
  force: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const workDir = process.cwd();
  const configPath = path.join(workDir, ".docgen.yaml");

  if (fs.existsSync(configPath) && !options.force) {
    console.error("Error: .docgen.yaml already exists. Use --force to overwrite.");
    process.exit(1);
  }

  // Auto-detect supported project types
  const detected = detectLanguages(workDir);

  if (detected.length === 0) {
    console.warn("Warning: No React/TypeScript or Java/Spring Boot sources detected. Creating a React-oriented starter config.");
    detected.push({ name: "typescript", source: "src" });
  }

  console.log(`Detected languages: ${detected.map((d) => d.name).join(", ")}`);

  // Generate project name from directory
  const projectName = path.basename(workDir);

  const configYaml = generateDefaultConfig({
    projectName,
    languages: detected,
  });

  fs.writeFileSync(configPath, configYaml, "utf-8");
  console.log(`\nCreated .docgen.yaml with ${detected.length} language(s) configured.`);
  console.log("\nNext steps:");
  console.log("  1. Review .docgen.yaml and adjust paths/settings");
  console.log("  2. Run: docgen validate     (check doc coverage)");
  console.log("  3. Run: docgen generate     (generate documentation)");
}

function detectLanguages(
  workDir: string
): Array<{ name: string; source: string }> {
  const languages: Array<{ name: string; source: string }> = [];

  // Check for Java
  const javaDirs = ["src/main/java", "src"];
  for (const dir of javaDirs) {
    const fullPath = path.join(workDir, dir);
    if (fs.existsSync(fullPath) && hasFilesWithExtension(fullPath, ".java")) {
      languages.push({ name: "java", source: dir });
      break;
    }
  }

  // Check for React/TypeScript sources
  const tsDirs = ["src", "lib", "packages"];
  for (const dir of tsDirs) {
    const fullPath = path.join(workDir, dir);
    if (
      fs.existsSync(fullPath) &&
      (hasFilesWithExtension(fullPath, ".ts") ||
        hasFilesWithExtension(fullPath, ".tsx"))
    ) {
      languages.push({ name: "typescript", source: dir });
      break;
    }
  }

  // Check for tsconfig.json as a fallback
  if (
    !languages.some((l) => l.name === "typescript") &&
    fs.existsSync(path.join(workDir, "tsconfig.json"))
  ) {
    languages.push({ name: "typescript", source: "src" });
  }

  return languages;
}

function hasFilesWithExtension(dir: string, ext: string, depth = 3): boolean {
  if (depth <= 0) return false;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(ext)) return true;
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        if (hasFilesWithExtension(path.join(dir, entry.name), ext, depth - 1)) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}
