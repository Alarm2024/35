"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { verify, creditFor } = require("../lib/earn");

const schedule = {
  publishedAt: "2026-09-14",
  rules: { "desk.session": { credit: "1.500000", describes: "one completed desk session" } },
};

test("accepts a published schedule", () => {
  assert.equal(verify(schedule).ok, true);
});

test("rejects a schedule with no publish date", () => {
  assert.equal(verify({ ...schedule, publishedAt: "" }).ok, false);
});

test("rejects a schedule with no rules", () => {
  const result = verify({ publishedAt: "2026-09-14", rules: {} });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /nothing can be earned/);
});

test("rejects an undescribed rule — an unexplained rule is discretionary", () => {
  const result = verify({ publishedAt: "x", rules: { a: { credit: "1", describes: "" } } });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /discretionary/);
});

test("rejects a rule whose credit is not a valid decimal string", () => {
  assert.equal(verify({ publishedAt: "x", rules: { a: { credit: "1.1234567", describes: "y" } } }).ok, false);
  assert.equal(verify({ publishedAt: "x", rules: { a: { credit: -1, describes: "y" } } }).ok, false);
});

test("looks up a rate by reason", () => {
  assert.equal(creditFor(schedule, "desk.session").credit, "1.500000");
});

test("refuses a reason that is not published", () => {
  const result = creditFor(schedule, "favours.owed");
  assert.equal(result.ok, false);
  assert.match(result.error, /not in the earn schedule/);
});
