"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseMemo, validateCredit, assertUniqueSourceSig } = require("../lib/memo");

test("parses a valid memo", () => {
  const out = parseMemo("35-credit:Abc111:1.500000:00");
  assert.equal(out.ok, true);
  assert.equal(out.wallet, "Abc111");
  assert.equal(out.credit, "1.500000");
  assert.equal(out.week, "00");
});

test("rejects missing prefix", () => {
  assert.equal(parseMemo("credit:x:1:00").ok, false);
});

test("rejects wrong arity", () => {
  assert.equal(parseMemo("35-credit:only-two:1").ok, false);
});

test("rejects empty wallet", () => {
  assert.equal(parseMemo("35-credit::1:00").ok, false);
});

test("accepts 6 fractional digits", () => {
  assert.equal(validateCredit("1.123456").ok, true);
});

test("rejects 7 fractional digits", () => {
  const out = validateCredit("1.1234567");
  assert.equal(out.ok, false);
});

test("rejects non-decimal credit", () => {
  assert.equal(validateCredit("-1").ok, false);
  assert.equal(validateCredit("1e2").ok, false);
  assert.equal(validateCredit("one").ok, false);
});

test("rejects duplicate sourceSig", () => {
  const seen = new Set();
  assert.equal(assertUniqueSourceSig(seen, "sig-a").ok, true);
  const second = assertUniqueSourceSig(seen, "sig-a");
  assert.equal(second.ok, false);
  assert.match(second.error, /duplicate/);
});

test("allows distinct sourceSigs", () => {
  const seen = new Set();
  assert.equal(assertUniqueSourceSig(seen, "sig-a").ok, true);
  assert.equal(assertUniqueSourceSig(seen, "sig-b").ok, true);
});
