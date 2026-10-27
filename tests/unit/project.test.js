import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PUBLIC = join(ROOT, "public");

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function filesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function versionsIn(text) {
  return [...new Set([...text.matchAll(/firebasejs\/(\d+\.\d+\.\d+)\//g)].map((match) => match[1]))];
}

const serviceWorker = read("public/sw.js");

function precachedFiles() {
  const match = serviceWorker.match(/const APP_FILES = \[([\s\S]*?)\];/);
  assert.ok(match, "sw.js lists APP_FILES");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

describe("Firebase SDK version", () => {
  const packageVersion = JSON.parse(read("package.json")).devDependencies.firebase;
  const sdkVersions = versionsIn(read("public/js/sdk.js"));

  test("sdk.js loads a single version", () => {
    assert.equal(sdkVersions.length, 1);
  });

  test("package.json, jsconfig.json and sw.js use the same version as sdk.js", () => {
    assert.equal(packageVersion, sdkVersions[0]);
    assert.deepEqual(versionsIn(read("jsconfig.json")), sdkVersions);
    assert.equal(serviceWorker.match(/const SDK_VERSION = "([^"]+)"/)?.[1], sdkVersions[0]);
  });
});

describe("offline app shell", () => {
  test("the service worker caches every app module, style and page", () => {
    const listed = new Set(precachedFiles());
    const appFiles = filesUnder(PUBLIC)
      .map((path) => relative(PUBLIC, path).split("\\").join("/"))
      .filter((path) => /\.(js|css|html|webmanifest|png|svg)$/.test(path) && !path.endsWith(".d.ts") && path !== "sw.js");
    for (const file of appFiles) assert.ok(listed.has(file), `sw.js precaches ${file}`);
  });

  test("every precached file exists", () => {
    for (const file of precachedFiles()) {
      if (file === "./") continue;
      assert.ok(existsSync(join(PUBLIC, file)), `${file} exists`);
    }
  });

  test("the manifest's icons exist and the page links the manifest", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest"));
    for (const icon of manifest.icons) assert.ok(existsSync(join(PUBLIC, icon.src)), `${icon.src} exists`);
    assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
    const html = read("public/index.html");
    assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
    assert.match(html, /src="js\/boot\.js"/);
  });
});
