"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const issueCredit = path.resolve(__dirname, "../issue-credit.js");
const WALLET = "GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ";

function run(args) {
  return spawnSync(process.execPath, [issueCredit, ...args], { encoding: "utf8", timeout: 20000 });
}

// sourceSig is the signature of the transaction carrying the memo, and
// reconcile.js matches on exactly that. A signature does not exist before the
// transaction is sent, so preview must not demand one.
test("preview does not require --source-sig", () => {
  const result = run(["--wallet", WALLET, "--reason", "desk.session", "--week", "2026-W38", "--preview"]);
  assert.equal(result.stderr.includes("missing --source-sig"), false);
});

test("recording still requires --source-sig", () => {
  const result = run(["--wallet", WALLET, "--reason", "desk.session", "--week", "2026-W38"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing --source-sig/);
});

test("usage documents the land-then-record order", () => {
  const result = run(["--wallet", WALLET, "--reason", "desk.session", "--week", "2026-W38"]);
  assert.match(result.stderr, /--preview/);
  assert.match(result.stderr, /Land it, then re-run/);
});

test("no unverified solana CLI command is printed anywhere", () => {
  const fs = require("fs");
  const source = fs.readFileSync(issueCredit, "utf8");
  assert.equal(source.includes("solana transfer"), false);
});

test("still refuses a wallet that is not a base58 address", () => {
  const result = run(["--wallet", "nope", "--reason", "desk.session", "--week", "2026-W38", "--preview"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /base58/);
});
