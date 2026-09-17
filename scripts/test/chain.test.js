"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const chain = require("../lib/chain");

const SIGNER = "3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo";
const WALLET = "3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo";

function memoTx(text, blockTime) {
  return {
    blockTime,
    transaction: { message: { instructions: [{ program: "spl-memo", parsed: text }] } },
  };
}

// A fake cluster: getSignaturesForAddress then getTransaction, the same two
// calls the real reader makes.
function fakeCall(rows) {
  return async function call(method, params) {
    if (method === "getSignaturesForAddress") {
      return rows.map(({ signature, err }) => ({ signature, err: err ?? null }));
    }
    if (method === "getTransaction") {
      const row = rows.find((r) => r.signature === params[0]);
      return row ? row.tx : null;
    }
    throw new Error(`unexpected RPC call ${method}`);
  };
}

test("memosFrom reads top-level and inner spl-memo instructions", () => {
  const tx = {
    transaction: { message: { instructions: [{ program: "spl-memo", parsed: "outer" }] } },
    meta: { innerInstructions: [{ instructions: [{ program: "spl-memo", parsed: "inner" }] }] },
  };
  assert.deepEqual(chain.memosFrom(tx), ["outer", "inner"]);
});

test("memosFrom ignores instructions that are not spl-memo", () => {
  const tx = {
    transaction: {
      message: {
        instructions: [
          { program: "system", parsed: { type: "transfer" } },
          { program: "spl-memo", parsed: "kept" },
          { program: "spl-memo" }, // parsed missing
        ],
      },
    },
  };
  assert.deepEqual(chain.memosFrom(tx), ["kept"]);
});

test("memosFrom survives a transaction with nothing in it", () => {
  assert.deepEqual(chain.memosFrom(null), []);
  assert.deepEqual(chain.memosFrom({}), []);
  assert.deepEqual(chain.memosFrom({ transaction: { message: {} } }), []);
});

test("scanSignerMemos keeps valid credit memos and their block time", async () => {
  const call = fakeCall([
    { signature: "sigA", tx: memoTx(`35-credit:${WALLET}:1.000000:2026-W38`, 1_700_000_000) },
    { signature: "sigB", tx: memoTx("hello, not a credit", 1_700_000_100) },
  ]);
  const found = await chain.scanSignerMemos(call, [SIGNER], 10);
  assert.equal(found.size, 1);
  const entry = found.get("sigA");
  assert.equal(entry.wallet, WALLET);
  assert.equal(entry.credit, "1.000000");
  assert.equal(entry.week, "2026-W38");
  assert.equal(entry.blockTime, 1_700_000_000);
  assert.equal(entry.signer, SIGNER);
});

test("scanSignerMemos skips failed transactions", async () => {
  // A transaction that errored did not land the memo, so counting it would
  // credit work against a transfer that never happened.
  const call = fakeCall([
    { signature: "sigA", err: { InstructionError: [0, "Custom"] }, tx: memoTx(`35-credit:${WALLET}:1.000000:2026-W38`, 1) },
  ]);
  assert.equal((await chain.scanSignerMemos(call, [SIGNER], 10)).size, 0);
});

test("scanSignerMemos tolerates a missing blockTime", async () => {
  const call = fakeCall([
    { signature: "sigA", tx: memoTx(`35-credit:${WALLET}:1.000000:2026-W38`, undefined) },
  ]);
  const found = await chain.scanSignerMemos(call, [SIGNER], 10);
  assert.equal(found.get("sigA").blockTime, null);
});

test("duplicateGroups finds memos claiming the same wallet, credit and week", () => {
  const memos = [
    { wallet: WALLET, credit: "1.000000", week: "2026-W38", signature: "a" },
    { wallet: WALLET, credit: "1.000000", week: "2026-W38", signature: "b" },
    { wallet: WALLET, credit: "1.000000", week: "2026-W38", signature: "c" },
    { wallet: WALLET, credit: "2.000000", week: "2026-W38", signature: "d" },
    { wallet: WALLET, credit: "1.000000", week: "2026-W39", signature: "e" },
  ];
  const groups = chain.duplicateGroups(memos);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].group.length, 3);
  assert.deepEqual(
    groups[0].group.map((m) => m.signature),
    ["a", "b", "c"]
  );
});

test("duplicateGroups reports nothing when every memo is distinct", () => {
  const memos = [
    { wallet: WALLET, credit: "1.000000", week: "2026-W38", signature: "a" },
    { wallet: WALLET, credit: "1.000000", week: "2026-W39", signature: "b" },
  ];
  assert.deepEqual(chain.duplicateGroups(memos), []);
});

// ── telling "absent" apart from "not parsed" ──────────────────────────────

test("inspectSignature reports a signature the cluster does not know", async () => {
  const call = async () => null;
  assert.deepEqual(await chain.inspectSignature(call, "nope"), { found: false });
});

test("inspectSignature names the programs of a transaction with no parsed memo", async () => {
  // What an unrecognised memo program looks like in jsonParsed: a programId
  // and base58 data, with no `parsed` field. The transaction EXISTS.
  const call = async () => ({
    transaction: {
      message: {
        instructions: [
          { programId: "Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH", data: "3Bxs4h24hBtQy9rw" },
        ],
      },
    },
  });
  const seen = await chain.inspectSignature(call, "sig");
  assert.equal(seen.found, true);
  assert.deepEqual(seen.parsedMemos, []);
  assert.deepEqual(seen.programIds, ["Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH"]);
});

test("inspectSignature surfaces an on-chain error", async () => {
  const call = async () => ({
    meta: { err: { InstructionError: [0, "Custom"] } },
    transaction: { message: { instructions: [] } },
  });
  assert.notEqual((await chain.inspectSignature(call, "sig")).err, null);
});

test("scanSignerMemos records which program carried each memo", async () => {
  const memo = `35-credit:${WALLET}:1.000000:2026-W38`;
  const call = fakeCall([
    {
      signature: "sigA",
      tx: {
        blockTime: 1,
        transaction: {
          message: {
            instructions: [
              { program: "spl-memo", programId: "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo", parsed: memo },
            ],
          },
        },
      },
    },
  ]);
  const found = await chain.scanSignerMemos(call, [SIGNER], 10);
  assert.equal(found.get("sigA").programId, "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo");
});

test("reconcile diagnoses the missing signature instead of calling it absent", () => {
  const source = fs.readFileSync(path.join(__dirname, "../reconcile.js"), "utf8");
  // The old single line read "in ledger but not found on chain", which is what
  // a transaction that exists ALSO produced when its memo was not parsed.
  assert.equal(source.includes("in ledger but not found on chain"), false);
  assert.ok(source.includes("no such transaction, or not yet finalized"));
  assert.ok(source.includes("transaction EXISTS but carries no memo"));
  assert.ok(source.includes("FAILED on chain"));
  assert.ok(source.includes("inspectSignature"));
});

test("an off-program memo is warned about, never dropped", () => {
  const source = fs.readFileSync(path.join(__dirname, "../reconcile.js"), "utf8");
  assert.ok(source.includes("They still count."));
  // Dropping it would shrink the supply cap, which is the one thing reconcile
  // exists to prevent — so the filter must feed a WARN, not the credit set.
  assert.equal(/onChain\.delete\(/.test(source), false);
  assert.ok(source.includes("WARN:"));
});

// ── the instruction that caused the loss ──────────────────────────────────

test("every documented copy of the ledger example is non-destructive", () => {
  const root = path.join(__dirname, "../..");
  // docs/OPEN_PLAN.md is where the operator actually read the instruction from,
  // so it is checked too — when it exists, since it arrives on its own branch.
  for (const file of ["README.md", "scripts/doctor.js", "docs/OPEN_PLAN.md"]) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    // An unguarded `cp` of an example onto a live config. `cp -n` is not the
    // fix either: coreutils 9.x prints "behavior of -n is non-portable and may
    // change in future" on every run, which teaches the operator to ignore
    // warnings from the setup step of all places.
    const unguarded = (text.match(/^.*cp\s+config\/\$?\w+\.example\.json.*$/gm) || []).filter(
      (line) => !line.includes("[ -f ")
    );
    assert.deepEqual(
      unguarded,
      [],
      `${file} still copies a config example without checking the target first; ` +
        `ledger.example.json is "entries": [] and would erase every issued credit`
    );
    assert.equal(/cp\s+-n\b/.test(text), false, `${file} uses cp -n, which warns on coreutils 9.x`);
  }
});

test("reconcile points at the rebuild when the ledger is empty and the chain is not", () => {
  const source = fs.readFileSync(path.join(__dirname, "../reconcile.js"), "utf8");
  assert.ok(source.includes("ledger-rebuild.js"));
  // Only for the wiped-ledger shape: an ordinary mismatch must not suggest it,
  // or "rebuild" becomes the reflex answer to a real disagreement.
  assert.ok(source.includes("read.ledger.entries.length === 0"));
});

test("ledger-rebuild never invents a wallet, credit, week or reason", () => {
  const source = fs.readFileSync(path.join(__dirname, "../ledger-rebuild.js"), "utf8");
  // wallet/credit/week are copied off the memo, never parsed from argv.
  assert.equal(/args\.(wallet|credit|week)\b/.test(source), false);
  // A reason is only accepted when the schedule agrees it pays that credit.
  assert.ok(source.includes("rule.credit !== memo.credit"));
  // A partial rebuild is refused rather than half-written.
  assert.ok(source.includes("refusing to write a partial rebuild"));
  // Duplicates are named before anything is written.
  assert.ok(source.includes("duplicateGroups"));
});
