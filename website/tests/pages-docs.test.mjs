import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../pages-dist/", import.meta.url);

test("builds direct-entry files for every documentation route", async () => {
  const routes = [
    "getting-started",
    "generating-docs",
    "architecture",
    "configuration",
    "cli-reference",
    "plugin-development",
    "ci-cd",
    "roadmap",
    "troubleshooting",
  ];

  await Promise.all([
    access(new URL("index.html", outputRoot)),
    access(new URL("404.html", outputRoot)),
    access(new URL(".nojekyll", outputRoot)),
    ...routes.map((route) => access(new URL(`docs/${route}/index.html`, outputRoot))),
  ]);
});

test("ships the current and future phase roadmap in the browser bundle", async () => {
  const assetsRoot = new URL("assets/", outputRoot);
  const assets = await readdir(assetsRoot);
  const scripts = assets.filter((file) => file.endsWith(".js"));
  const bundle = (
    await Promise.all(scripts.map((file) => readFile(new URL(file, assetsRoot), "utf8")))
  ).join("\n");

  assert.match(bundle, /Roadmap & phases/);
  assert.match(bundle, /Current phase: v1\.1 foundation/);
  assert.match(bundle, /Phase 2: v1\.2 rich portable output/);
  assert.match(bundle, /Phase 5: v2\.0 team documentation platform/);
  assert.match(bundle, /Markdown \+ HTML \+ PDF/);
});
