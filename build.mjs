import { mkdir, copyFile, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await esbuild.build({
  entryPoints: [
    path.join(__dirname, "src", "popup.js"),
    path.join(__dirname, "src", "background.js"),
  ],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome114"],
  outdir: distDir,
  sourcemap: false,
  logLevel: "info",
});

const popupHtml = await readFile(path.join(__dirname, "popup.html"), "utf8");
const distPopupHtml = popupHtml.replace("./dist/popup.js", "./popup.js");

await Promise.all([
  writeFile(path.join(distDir, "popup.html"), distPopupHtml),
  copyFile(
    path.join(__dirname, "manifest.json"),
    path.join(distDir, "manifest.json"),
  ),
  copyFile(
    path.join(distDir, "background.js"),
    path.join(__dirname, "background.js"),
  ),
]);

console.log("Built ThreadCount extension into dist/.");
