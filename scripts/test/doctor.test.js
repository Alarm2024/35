"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const doctor = path.resolve(__dirname, "../doctor.js");

function runDoctor() {
  return spawnSync(process.execPath, [doctor], { encoding: "utf8", timeout: 20000 });
}

test("doctor runs and exits 0 even with no operator config", () => {
  const result = runDoctor();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /35 desk status/);
});

test("doctor names exactly one next step", () => {
  const result = runDoctor();
  const nextHeadings = result.stdout.match(/^NEXT$/gm) || [];
  assert.equal(nextHeadings.length, 1);
});

test("doctor points at the copy step when config is absent", () => {
  const result = runDoctor();
  assert.match(result.stdout, /Copy the four templates/);
});

test("doctor is honest about what it cannot see", () => {
  const result = runDoctor();
  assert.match(result.stdout, /cannot see/);
  assert.match(result.stdout, /reconcile\.js/);
  assert.match(result.stdout, /self-audit\.js/);
});

test("doctor never claims the desk is ready while blocked", () => {
  const result = runDoctor();
  assert.equal(result.stdout.includes("Every local stage is done"), false);
});
