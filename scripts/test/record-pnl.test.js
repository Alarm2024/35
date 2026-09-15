"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const recordPnl = path.resolve(__dirname, "../record-pnl.js");

function run(args = []) {
  return spawnSync(process.execPath, [recordPnl, ...args], { encoding: "utf8", timeout: 20000 });
}

test("requires both a figure and a week", () => {
  assert.match(run(["--week", "2026-W38"]).stderr, /missing --realized/);
  assert.match(run(["--realized", "3"]).stderr, /missing --week/);
});

test("rejects a non-numeric figure", () => {
  const result = run(["--realized", "abc", "--week", "2026-W38"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be a number/);
});

// A negative "gain" is a category error, and silently storing one would make the
// rent comparison meaningless.
test("rejects a negative figure", () => {
  const result = run(["--realized", "-3", "--week", "2026-W38"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot be negative/);
});

test("fails closed when config/pnl.json is absent", () => {
  const result = run(["--realized", "3", "--week", "2026-W38"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pnl\.example\.json first/);
});

// Moving the threshold to meet the number is the exact failure the gate exists
// to prevent, so this script must not be able to do it.
test("cannot touch the rent threshold or the owner confirmation", () => {
  const source = fs.readFileSync(recordPnl, "utf8");
  assert.equal(/pnl\.rentThresholdSol\s*=/.test(source), false);
  assert.equal(/pnl\.ownerConfirmed\s*=/.test(source), false);
});
