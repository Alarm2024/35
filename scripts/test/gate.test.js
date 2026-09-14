"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const gate = path.resolve(__dirname, "../gate.js");
const selfAudit = path.resolve(__dirname, "../self-audit.js");

function runCli(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 20000 });
}

test("gate.js is fail-closed on empty operator files", () => {
  const result = runCli(gate);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout.includes("PASS"), false);
});

test("gate.js --preflight is fail-closed on empty operator files", () => {
  const result = runCli(gate, ["--preflight"]);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout.includes("PASS"), false);
});

test("gate.js --public-only passes on this repo's public fields", () => {
  const result = runCli(gate, ["--public-only", "--preflight"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS/);
});

test("gate.js rejects unknown arguments instead of ignoring them", () => {
  const result = runCli(gate, ["--yolo"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown argument/);
});

test("gate.js rejects contradictory modes", () => {
  const result = runCli(gate, ["--preflight", "--postflight"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mutually exclusive/);
});

test("self-audit.js is fail-closed and prints CLEAN: no", () => {
  const result = runCli(selfAudit, ["--offline"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CLEAN: no/);
});

test("self-audit.js refuses to print CLEAN without on-chain verification", () => {
  const result = runCli(selfAudit, ["--offline"]);
  assert.equal(result.stdout.includes("CLEAN: yes"), false);
});
