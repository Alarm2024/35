"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { toBaseUnits, fromBaseUnits, sumCredits } = require("../lib/amount");

test("converts credits to base units at 6 decimals", () => {
  assert.equal(toBaseUnits("1"), 1000000n);
  assert.equal(toBaseUnits("1.5"), 1500000n);
  assert.equal(toBaseUnits("0.000001"), 1n);
  assert.equal(toBaseUnits("0"), 0n);
});

test("round-trips through base units", () => {
  assert.equal(fromBaseUnits(toBaseUnits("12.345678")), "12.345678");
  assert.equal(fromBaseUnits(toBaseUnits("0.1")), "0.100000");
});

test("rejects more than 6 fractional digits", () => {
  assert.throws(() => toBaseUnits("1.1234567"), RangeError);
});

test("rejects non-decimal input", () => {
  assert.throws(() => toBaseUnits("-1"), TypeError);
  assert.throws(() => toBaseUnits("1e6"), TypeError);
  assert.throws(() => toBaseUnits(1.5), TypeError);
});

test("sums without float error", () => {
  const many = Array.from({ length: 10 }, () => "0.1");
  assert.equal(sumCredits(many).credit, "1.000000");
  assert.equal(sumCredits(["0.000001", "0.000002"]).credit, "0.000003");
});

test("sums large ledgers exactly", () => {
  const entries = Array.from({ length: 1000 }, () => "999999.999999");
  assert.equal(sumCredits(entries).units, 999999999999n * 1000n);
});
