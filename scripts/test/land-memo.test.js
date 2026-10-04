"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const { parseArgs } = require("../land-memo");
const { checkMemoFields } = require("../lib/ledger");
const { parseMemo } = require("../lib/memo");

const landMemo = path.resolve(__dirname, "../land-memo.js");
// A syntactically valid base58 address for tests (the system program id).
const WALLET = "11111111111111111111111111111111";

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [landMemo, ...args], {
    encoding: "utf8",
    timeout: 20000,
    env: { ...process.env, KEYPAIR_PATH: "", ...env },
  });
}

test("unknown flags stop the script instead of being ignored (issue #38)", () => {
  assert.match(parseArgs(["--memo", "x", "--dry-run"]).error, /unknown flag: --dry-run/);
  assert.match(parseArgs(["--memo", "x", "--sned"]).error, /unknown flag: --sned/);
  assert.match(parseArgs(["--mem", "x"]).error, /unknown flag: --mem/);
  assert.match(parseArgs(["--memo", "a", "--memo", "b"]).error, /given twice/);
  assert.deepEqual(parseArgs(["--memo", "x", "--send"]).args, { send: true, memo: "x" });
});

test("the CLI refuses an unknown flag before reading any key", () => {
  const r = runCli(["--memo", `35-credit:${WALLET}:1.500000:2026-W40`, "--dry-run"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unknown flag: --dry-run/);
});

test("a memo the ledger would reject is refused before signing (issue #37)", () => {
  // Parses as a memo (non-empty wallet and week) but the wallet is not an address.
  const r = runCli(["--memo", "35-credit:not-a-wallet:1.500000:2026-W40"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /would be rejected by the ledger: wallet is not a base58 Solana address/);
});

test("land-memo and the ledger share one memo check", () => {
  const good = parseMemo(`35-credit:${WALLET}:1.500000:2026-W40`);
  assert.equal(good.ok, true);
  assert.deepEqual(checkMemoFields(good), { fatal: null, errors: [] });
  const bad = parseMemo("35-credit:0OIl:1.5:2026-W40");
  assert.equal(bad.ok, true, "the memo parser alone accepts it");
  assert.match(checkMemoFields(bad).errors.join(" "), /not a base58 Solana address/);
});
