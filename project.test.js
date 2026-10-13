// Checks that keep the web app, the offline cache and the Android package
// in step with each other.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const read = (file) => fs.readFileSync(file, "utf8");

test("version.js matches package.json", () => {
  const { version } = JSON.parse(read("package.json"));
  assert.match(read("version.js"), new RegExp(`APP_VERSION = "${version.replace(/\./g, "\\.")}"`));
});

test("every file the page loads is packaged and cached for offline use", () => {
  const html = read("index.html");
  const loaded = [...html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css|webmanifest))"/g)].map((m) => m[1]);
  assert.ok(loaded.length >= 8, "found the page's scripts and styles");
  const build = read("scripts/build-web.mjs");
  const sw = read("sw.js");
  for (const file of loaded) {
    if (file !== "version.js") assert.ok(build.includes(`"${file}"`), `${file} is copied by the build`);
    assert.ok(sw.includes(`"${file}"`), `${file} is cached by sw.js`);
  }
});
