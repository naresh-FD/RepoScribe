import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(siteRoot, "pages"),
  base: "/RepoScribe/",
  publicDir: path.join(siteRoot, "public"),
  plugins: [react()],
  resolve: {
    alias: {
      "next/link": path.join(siteRoot, "pages", "next-link.tsx"),
    },
  },
  css: {
    postcss: path.join(siteRoot, "postcss.config.mjs"),
  },
  build: {
    outDir: path.join(siteRoot, "pages-dist"),
    emptyOutDir: true,
  },
});
