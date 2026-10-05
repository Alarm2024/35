"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const checkSite = path.resolve(__dirname, "../check-site.js");
const workflow = path.resolve(__dirname, "../../.github/workflows/pages.yml");

function run(env) {
  return spawnSync(process.execPath, [checkSite], {
    encoding: "utf8",
    timeout: 20000,
    env: { ...process.env, ...env },
  });
}

// Run check-site against a mutated copy of pages.yml. The real workflow is only
// ever read, so tests that mutate it cannot see each other's edits, whatever
// order or concurrency the runner uses.
function runWithWorkflow(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-site-"));
  const copy = path.join(dir, "pages.yml");
  try {
    fs.writeFileSync(copy, mutate(fs.readFileSync(workflow, "utf8")));
    return run({ CHECK_SITE_WORKFLOW: copy });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("the site as committed is publishable", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SITE: ok/);
});

// This is the bug that actually shipped: metadata.json existed and was valid,
// index.html was valid, only the deploy list was wrong.
test("catches a runtime-fetched file the workflow does not publish", () => {
  const result = runWithWorkflow((original) => original.replace(" metadata.json", ""));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /metadata\.json is not copied/);
});

// The asset under test comes from the page itself. This test used to name
// IMG_5183.jpeg; the page stopped linking that file on 2026-09-20, so deleting
// its copy line broke nothing and the test failed on main every run since.
const pageHtml = fs.readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
const linkedAsset = [...pageHtml.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map((match) => match[1].replace(/^\//, ""))
  .find((ref) => /\.(svg|png|jpe?g|webp)$/.test(ref) && !/^(https?:|mailto:|#)/.test(ref));

test("catches a linked asset the workflow does not publish", () => {
  assert.ok(linkedAsset, "index.html links no local image to test with");
  const escaped = linkedAsset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const result = runWithWorkflow((original) => {
    const mutated = original
      .replace(new RegExp(`if \\[ -f ${escaped} \\][^\\n]*\\n`), "")
      .replace(new RegExp(` ${escaped}(?= )`), "");
    assert.notEqual(mutated, original, `could not remove ${linkedAsset} from pages.yml`);
    return mutated;
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(`${escaped}.*never copies it`));
});

test("the mutation tests never touch the real workflow", () => {
  const before = fs.readFileSync(workflow, "utf8");
  runWithWorkflow((original) => original.replace(" metadata.json", ""));
  runWithWorkflow((original) => original.replace(/cp index\.html/, "cp"));
  assert.equal(fs.readFileSync(workflow, "utf8"), before);
});

test("metadata.json names no mint, because none exists", () => {
  const metadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../metadata.json"), "utf8"));
  for (const forbidden of ["mint", "address", "mintAddress", "contract"]) {
    assert.equal(forbidden in metadata, false, `metadata.json must not carry ${forbidden}`);
  }
});

// Issue #40: the ledger block must not show a state the page cannot back up.
test("the ledger block's static fallback equals ledger-snapshot.json", () => {
  const root = path.resolve(__dirname, "../..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const snap = JSON.parse(fs.readFileSync(path.join(root, "ledger-snapshot.json"), "utf8"));
  assert.equal(snap.format, "35-ledger-snapshot/1");
  assert.match(snap.at, /^\d{4}-\d{2}-\d{2}T/);
  const cell = (key) => {
    const m = html.match(new RegExp(`data-snap="${key}">([^<]*)<`));
    assert.ok(m, `index.html has a data-snap="${key}" cell`);
    return m[1];
  };
  assert.equal(cell("onChain"), String(snap.onChain));
  assert.equal(cell("inLedger"), String(snap.inLedger));
  assert.equal(cell("missing"), String(snap.missing));
  assert.equal(cell("entries"), String(snap.entries));
  assert.equal(cell("total"), snap.total);
  const last = snap.byWeek[snap.byWeek.length - 1];
  assert.equal(cell("week"), last.week);
  assert.equal(cell("weekCredit"), last.credit);
  assert.equal(cell("status"), `${snap.status} on ${snap.at.slice(0, 10)}`);
  assert.ok(!/>RECONCILED</.test(html), "no undated, unconditional RECONCILED");
});

test("ui.js fills the ledger from the snapshot and says so when it cannot", () => {
  const ui = fs.readFileSync(path.resolve(__dirname, "../../ui.js"), "utf8");
  assert.match(ui, /fetch\("\/ledger-snapshot\.json"\)/);
  assert.match(ui, /snapshot unavailable/);
});

test("English page copy avoids the words the desk does not use", () => {
  const root = path.resolve(__dirname, "../..");
  const text = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/<[^>]+>/g, " ");
  for (const word of ["profit", "guaranteed", "audit", "launched", "trading"]) {
    assert.ok(!new RegExp(`\\b${word}\\b`, "i").test(text), `index.html says "${word}"`);
  }
});
