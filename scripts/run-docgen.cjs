#!/usr/bin/env node

const path = require("path");
const Module = require("module");

const packageRoot = path.resolve(__dirname, "..");
const workspaceAliases = new Map([
  ["@docgen/core", path.join(packageRoot, "packages", "core", "dist")],
  ["@docgen/cli", path.join(packageRoot, "packages", "cli", "dist")],
  ["@docgen/parser-typescript", path.join(packageRoot, "packages", "parser-typescript")],
  ["@docgen/renderer-markdown", path.join(packageRoot, "packages", "renderer-markdown")],
  ["@docgen/renderer-pdf", path.join(packageRoot, "packages", "renderer-pdf")],
]);

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  const alias = workspaceAliases.get(request);
  if (alias) {
    return originalResolveFilename.call(this, alias, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require(path.join(packageRoot, "packages", "cli", "dist", "index.js"));
