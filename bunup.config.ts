import { defineConfig } from "bunup";

export default defineConfig({
  entry: "./src/index.ts",
  outDir: "./dist",
  format: "esm",
  target: "node",
  dts: true,
  minify: true,
  external: ["cheerio"],
});
