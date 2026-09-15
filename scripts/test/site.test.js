"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const checkSite = path.resolve(__dirname, "../check-site.js");
const workflow = path.resolve(__dirname, "../../.github/workflows/pages.yml");

function run() {
  return spawnSync(process.execPath, [checkSite], { encoding: "utf8", timeout: 20000 });
}

test("the site as committed is publishable", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SITE: ok/);
});

// This is the bug that actually shipped: metadata.json existed and was valid,
// index.html was valid, only the deploy list was wrong.
test("catches a runtime-fetched file the workflow does not publish", () => {
  const original = fs.readFileSync(workflow, "utf8");
  try {
    fs.writeFileSync(workflow, original.replace(" metadata.json", ""));
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /metadata\.json is not copied/);
  } finally {
    fs.writeFileSync(workflow, original);
  }
});

test("catches a linked asset the workflow does not publish", () => {
  const original = fs.readFileSync(workflow, "utf8");
  try {
    fs.writeFileSync(workflow, original.replace(/if \[ -f IMG_5183\.jpeg \][^\n]*\n/, ""));
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /IMG_5183\.jpeg.*never copies it/);
  } finally {
    fs.writeFileSync(workflow, original);
  }
});

test("metadata.json names no mint, because none exists", () => {
  const metadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../metadata.json"), "utf8"));
  for (const forbidden of ["mint", "address", "mintAddress", "contract"]) {
    assert.equal(forbidden in metadata, false, `metadata.json must not carry ${forbidden}`);
  }
});
