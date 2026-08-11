import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(siteRoot, "pages-dist");
const index = path.join(output, "index.html");
const slugs = [
  "getting-started",
  "generating-docs",
  "architecture",
  "configuration",
  "cli-reference",
  "plugin-development",
  "ci-cd",
  "troubleshooting",
];

await writeFile(path.join(output, ".nojekyll"), "");
await copyFile(index, path.join(output, "404.html"));

for (const slug of slugs) {
  const routeDir = path.join(output, "docs", slug);
  await mkdir(routeDir, { recursive: true });
  await copyFile(index, path.join(routeDir, "index.html"));
}
