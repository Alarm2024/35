"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const receiptLib = require("../lib/receipt");
const doctor = path.resolve(__dirname, "../doctor.js");

const ENTRY = {
  wallet: "GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ",
  credit: "1.000000",
  week: "2026-W38",
  sourceSig: "REAL_SIG",
  issuedAt: "2026-09-15T00:00:00Z",
  reason: "desk.session",
};

function deskWith(entries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "receipt-"));
  fs.mkdirSync(path.join(root, "config"));
  fs.writeFileSync(
    path.join(root, "config/ledger.json"),
    JSON.stringify({ version: 1, decimals: 6, entries })
  );
  return root;
}

function runDoctor(root) {
  return spawnSync(process.execPath, [doctor], {
    encoding: "utf8",
    timeout: 20000,
    env: { ...process.env, DESK_ROOT: root },
  });
}

test("fingerprint is stable regardless of entry order", () => {
  const a = { entries: [ENTRY, { ...ENTRY, sourceSig: "B" }] };
  const b = { entries: [{ ...ENTRY, sourceSig: "B" }, ENTRY] };
  assert.equal(receiptLib.fingerprint(a), receiptLib.fingerprint(b));
});

test("fingerprint changes when a credit changes", () => {
  const before = receiptLib.fingerprint({ entries: [ENTRY] });
  const after = receiptLib.fingerprint({ entries: [{ ...ENTRY, credit: "2.000000" }] });
  assert.notEqual(before, after);
});

test("a receipt is only honoured for the exact ledger it described", () => {
  const ledger = { entries: [ENTRY] };
  const root = deskWith([ENTRY]);
  receiptLib.write(root, ledger, "1.000000");

  assert.notEqual(receiptLib.readIfCurrent(root, ledger), null);

  // One more credit issued since: the earlier check no longer covers it.
  const changed = { entries: [ENTRY, { ...ENTRY, sourceSig: "LATER" }] };
  assert.equal(receiptLib.readIfCurrent(root, changed), null);
});

test("doctor reports verification when the receipt matches", () => {
  const root = deskWith([ENTRY]);
  receiptLib.write(root, { entries: [ENTRY] }, "1.000000");
  const result = runDoctor(root);
  assert.match(result.stdout, /verified against chain at/);
  assert.equal(result.stdout.includes("RECORDED, NOT VERIFIED"), false);
});

test("doctor warns again once the ledger changes after verification", () => {
  const root = deskWith([ENTRY]);
  receiptLib.write(root, { entries: [ENTRY] }, "1.000000");
  fs.writeFileSync(
    path.join(root, "config/ledger.json"),
    JSON.stringify({ version: 1, decimals: 6, entries: [ENTRY, { ...ENTRY, sourceSig: "LATER" }] })
  );
  const result = runDoctor(root);
  assert.match(result.stdout, /RECORDED, NOT VERIFIED/);
});

test("a forged receipt cannot reach anything that gates the mint", () => {
  const checks = fs.readFileSync(path.resolve(__dirname, "../lib/checks.js"), "utf8");
  const selfAudit = fs.readFileSync(path.resolve(__dirname, "../self-audit.js"), "utf8");
  assert.equal(checks.includes("receipt"), false);
  assert.equal(selfAudit.includes("receipt"), false);
});
