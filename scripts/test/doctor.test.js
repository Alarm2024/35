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

// A green tick next to "credit issued" only means the ledger says so. doctor is
// offline by design, so it must not let that read as chain agreement.
test("doctor warns that recorded credits are not verified against chain", () => {
  const fs = require("fs");
  const os = require("os");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-ledger-"));
  fs.mkdirSync(path.join(root, "config"));
  fs.writeFileSync(
    path.join(root, "config/ledger.json"),
    JSON.stringify({
      version: 1,
      decimals: 6,
      entries: [
        {
          wallet: "GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ",
          credit: "1.000000",
          week: "2026-W38",
          sourceSig: "NOT_A_REAL_SIGNATURE",
          issuedAt: "2026-09-15T00:00:00Z",
          reason: "desk.session",
        },
      ],
    })
  );

  const result = spawnSync(process.execPath, [doctor], {
    encoding: "utf8",
    timeout: 20000,
    env: { ...process.env, DESK_ROOT: root },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /RECORDED, NOT VERIFIED/);
  assert.match(result.stdout, /supply cap built on nothing/);
  assert.match(result.stdout, /node scripts\/reconcile\.js/);
});

test("doctor shows no such warning when the ledger is empty", () => {
  const result = runDoctor();
  assert.equal(result.stdout.includes("RECORDED, NOT VERIFIED"), false);
});
