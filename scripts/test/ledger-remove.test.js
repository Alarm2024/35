"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const remove = path.resolve(__dirname, "../ledger-remove.js");

function run(args = []) {
  return spawnSync(process.execPath, [remove, ...args], { encoding: "utf8", timeout: 20000 });
}

test("requires --source-sig", () => {
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing --source-sig/);
});

test("rejects unknown arguments rather than ignoring them", () => {
  const result = run(["--all"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unexpected argument/);
});

test("fails closed when there is no ledger", () => {
  const result = run(["--source-sig", "anything"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing .*config\/ledger\.json/);
});
