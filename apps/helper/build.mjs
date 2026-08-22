import { build } from "esbuild";

await build({
  entryPoints: ["src/sea-entry.ts"],
  outfile: "dist/sea-entry.cjs",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: false
});
