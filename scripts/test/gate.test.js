"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const gate = path.resolve(__dirname, "../gate.js");

test("gate.js is fail-closed on empty operator files", () => {
  const result = spawnSync(process.execPath, [gate], {
    encoding: "utf8",
    timeout: 10000,
  });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout.includes("PASS"), false);
});
