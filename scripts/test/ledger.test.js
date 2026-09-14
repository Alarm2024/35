"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { emptyLedger, verify, append, memoFor } = require("../lib/ledger");

const WALLET = "3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo";

function entry(overrides = {}) {
  return {
    wallet: WALLET,
    credit: "1.500000",
    week: "2026-W37",
    sourceSig: "sig-a",
    issuedAt: "2026-09-14T00:00:00Z",
    reason: "desk.session",
    ...overrides,
  };
}

test("an empty ledger is valid and totals zero", () => {
  const result = verify(emptyLedger());
  assert.equal(result.ok, true);
  assert.equal(result.total.credit, "0.000000");
});

test("appends and totals", () => {
  const one = append(emptyLedger(), entry());
  const two = append(one.ledger, entry({ sourceSig: "sig-b", credit: "0.500000" }));
  assert.equal(two.ok, true);
  assert.equal(two.total.credit, "2.000000");
});

test("rejects a duplicate sourceSig even across different weeks", () => {
  const one = append(emptyLedger(), entry());
  const two = append(one.ledger, entry({ week: "2026-W38" }));
  assert.equal(two.ok, false);
  assert.match(two.errors[0], /duplicate/);
});

test("rejects a wallet that is not a base58 address", () => {
  const result = append(emptyLedger(), entry({ wallet: "not-an-address" }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /base58/);
});

test("rejects a credit with more than 6 fractional digits", () => {
  const result = append(emptyLedger(), entry({ credit: "1.1234567" }));
  assert.equal(result.ok, false);
});

test("rejects missing fields", () => {
  for (const field of ["wallet", "credit", "week", "sourceSig", "issuedAt", "reason"]) {
    const broken = entry();
    delete broken[field];
    const result = append(emptyLedger(), broken);
    assert.equal(result.ok, false, `${field} should be required`);
  }
});

test("rejects a non-ISO issuedAt", () => {
  const result = append(emptyLedger(), entry({ issuedAt: "last tuesday" }));
  assert.equal(result.ok, false);
});

test("memo round-trips to the on-chain format", () => {
  assert.equal(memoFor(entry()), `35-credit:${WALLET}:1.500000:2026-W37`);
});

test("groups totals by week", () => {
  const one = append(emptyLedger(), entry());
  const two = append(one.ledger, entry({ sourceSig: "sig-b", week: "2026-W38", credit: "2.000000" }));
  const result = verify(two.ledger);
  assert.deepEqual(result.byWeek, [
    { week: "2026-W37", credit: "1.500000" },
    { week: "2026-W38", credit: "2.000000" },
  ]);
});

test("rejects a ledger with the wrong decimals", () => {
  const result = verify({ version: 1, decimals: 9, entries: [] });
  assert.equal(result.ok, false);
});
