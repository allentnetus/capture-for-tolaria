import { cpSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL(".", import.meta.url));
const dist = process.env.CAPTURE_FOR_TOLARIA_EXTENSION_DIST
  ? resolve(process.env.CAPTURE_FOR_TOLARIA_EXTENSION_DIST)
  : join(root, "dist");
mkdirSync(dist, { recursive: true });

await Promise.all([
  build({
    entryPoints: [join(root, "src/background/main.ts")],
    outfile: join(dist, "background.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome120",
    sourcemap: true
  }),
  build({
    entryPoints: [join(root, "src/content/main.ts")],
    outfile: join(dist, "content.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome120",
    sourcemap: true
  }),
  build({
    entryPoints: [join(root, "src/popup/main.ts")],
    outfile: join(dist, "popup.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome120",
    sourcemap: true
  })
]);

cpSync(join(root, "manifest.json"), join(dist, "manifest.json"));
cpSync(join(root, "public"), dist, { recursive: true });
