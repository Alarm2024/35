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

test("gate.js prints SKIPPED, not a bare PASS, for a postflight it did not run (issue #39)", () => {
  const { verdict } = require("../gate");
  assert.equal(verdict({ ok: true, skipped: [] }), "PASS");
  const line = verdict({ ok: true, skipped: ["on-chain postflight (--offline): mint authority"] });
  assert.notEqual(line.trim(), "PASS");
  assert.match(line, /^PASS \(local checks only\)$/m);
  assert.match(line, /^SKIPPED: on-chain postflight \(--offline\)/m);
});

test("checks.run reports the on-chain postflight as skipped under --offline", async () => {
  const { run } = require("../lib/checks");
  const offline = await run({ mode: "postflight", offline: true });
  assert.equal(offline.skipped.length, 1);
  assert.match(offline.skipped[0], /on-chain postflight/);
  const pre = await run({ mode: "preflight", offline: true });
  assert.deepEqual(pre.skipped, [], "preflight has no chain step to skip");
});
