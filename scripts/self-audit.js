#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const failures = [];

function fail(reason) {
  failures.push(reason);
  console.error(`FAIL: ${reason}`);
}

function readJson(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`missing ${relativePath}`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    fail(`invalid JSON in ${relativePath}: ${error.message}`);
    return null;
  }
}

function requireNonEmptyString(object, field, label) {
  if (!object || typeof object !== "object") {
    return;
  }

  const value = object[field];
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label}.${field} is empty or unset`);
  }
}

const gate = spawnSync(process.execPath, [path.join(__dirname, "gate.js")], {
  cwd: ROOT,
  encoding: "utf8",
});

if (gate.status !== 0) {
  fail("scripts/gate.js did not PASS");
  if (gate.stdout) {
    process.stdout.write(gate.stdout);
  }
  if (gate.stderr) {
    process.stderr.write(gate.stderr);
  }
}

const protocol = readJson("protocol.json");
const configProtocol = readJson("config/protocol.json");
const pnl = readJson("config/pnl.json");

if (protocol && configProtocol && protocol.mint && configProtocol.controlledWallets) {
  if (Array.isArray(configProtocol.controlledWallets) && configProtocol.controlledWallets.includes(protocol.mint)) {
    fail("mint must not appear in config/protocol.json controlledWallets");
  }
}

if (pnl) {
  if ("nav" in pnl || "navPerToken" in pnl || "tokenNav" in pnl) {
    fail("config/pnl.json must use desk PnL report fields, not per-token NAV framing");
  }

  const deskReportFields = ["realizedDeskPnl", "deskPnlReport", "realizedPnl"];
  const hasDeskReportField = deskReportFields.some((field) => field in pnl);
  if (!hasDeskReportField) {
    fail("config/pnl.json must include a desk PnL report field (realizedDeskPnl, deskPnlReport, or realizedPnl)");
  }
}

if (protocol) {
  requireNonEmptyString(protocol, "jurisdiction", "protocol.json");
}

if (failures.length > 0) {
  console.error("CLEAN: no");
  process.exit(1);
}

console.log("CLEAN: yes");
process.exit(0);
