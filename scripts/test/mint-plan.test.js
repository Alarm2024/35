"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const mintPlan = path.resolve(__dirname, "../mint-plan.js");

function runCli(args = []) {
  return spawnSync(process.execPath, [mintPlan, ...args], { encoding: "utf8", timeout: 20000 });
}

test("mint-plan is fail-closed with no operator config", () => {
  const result = runCli();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MINT: blocked/);
});

test("mint-plan never claims readiness while blocked", () => {
  const result = runCli();
  assert.equal(result.stdout.includes("ready for the owner"), false);
});

test("mint-plan says a passing gate is not sufficient", () => {
  const result = runCli();
  assert.match(result.stderr, /necessary, never sufficient/);
});
