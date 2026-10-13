// Copies the web app into dist/ for packaging (Capacitor reads it from
// there), stamping the build number into version.js. GitHub Pages keeps
// serving the files from the repository root unchanged.
//
//   BUILD_NUMBER=12 node scripts/build-web.mjs   → version "1.0.0 (12)"
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const dist = new URL("dist/", root);
const files = [
  "index.html",
  "style.css",
  "app-core.js",
  "app-calc.js",
  "app-graph.js",
  "app-stat.js",
  "app-main.js",
  "calculator.js",
  "calculus.js",
  "graph.js",
  "stats.js",
  "manifest.webmanifest",
  "sw.js",
  "icons",
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
for (const file of files) cpSync(new URL(file, root), new URL(file, dist), { recursive: true });

const { version } = JSON.parse(readFileSync(new URL("package.json", root)));
const build = process.env.BUILD_NUMBER;
const label = build ? `${version} (${build})` : version;
writeFileSync(
  new URL("version.js", dist),
  `// Written by scripts/build-web.mjs.\nwindow.APP_VERSION = ${JSON.stringify(label)};\n`
);
console.log(`dist/ ready: version ${label}`);
