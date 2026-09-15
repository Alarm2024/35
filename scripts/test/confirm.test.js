"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const confirm = path.resolve(__dirname, "../confirm.js");

function runConfirm(args = []) {
  return spawnSync(process.execPath, [confirm, ...args], { encoding: "utf8", timeout: 20000 });
}

test("confirm requires all three numbers — there is no bare flip flag", () => {
  for (const args of [[], ["--session", "1.000000"], ["--session", "1.000000", "--report", "2.000000"]]) {
    const result = runConfirm(args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing --/);
  }
});

test("confirm rejects a credit with more than 6 fractional digits", () => {
  const result = runConfirm(["--session", "1.1234567", "--report", "2", "--rent", "10"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fractional digits/);
});

test("confirm rejects a non-positive rent threshold", () => {
  for (const rent of ["0", "-5", "abc"]) {
    const result = runConfirm(["--session", "1.000000", "--report", "2.000000", "--rent", rent]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /positive number of SOL/);
  }
});

test("confirm refuses when the operator files are absent", () => {
  const result = runConfirm(["--session", "1.000000", "--report", "2.000000", "--rent", "10"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /example\.json first/);
});
