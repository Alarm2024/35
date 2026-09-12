#!/usr/bin/env node
/**
 * gate.js — FAIL CLOSED.
 * Read-only. No mint, transfer, or signing.
 * Default exit is 1. Exit 0 only if every check below passes.
 */
"use strict";

const fs = require("fs");
const path = require("path");

process.exitCode = 1;

const root = path.resolve(__dirname, "..");
const publicPath = path.join(root, "protocol.json");
const privatePath = path.join(root, "config", "protocol.json");
const pnlPath = path.join(root, "config", "pnl.json");

function fail(reason) {
  process.stdout.write("BLOCK\n" + reason + "\n");
  process.exit(1);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    fail("cannot read " + file + ": " + err.message);
  }
}

if (!fs.existsSync(publicPath)) fail("missing protocol.json");
const pub = readJson(publicPath);

if (pub.issuanceMode !== "earned") fail("issuanceMode must be earned");
if (pub.deskSigners || pub.controlledWallets || pub.rpcUrl) {
  fail("public protocol.json still contains private fields; split incomplete");
}
if (typeof pub.jurisdiction !== "string" || pub.jurisdiction.trim() === "") {
  fail("jurisdiction empty — no PASS until operators name one in protocol.json");
}
if (pub.mint) fail("mint already set; gate is pre-mint only");

if (!fs.existsSync(privatePath)) {
  fail("missing config/protocol.json (copy config/protocol.example.json locally)");
}
const priv = readJson(privatePath);
if (!Array.isArray(priv.deskSigners) || priv.deskSigners.length === 0) {
  fail("config/protocol.json deskSigners empty");
}

if (!fs.existsSync(pnlPath)) {
  fail("missing config/pnl.json — no realized desk PnL on file");
}
const pnl = readJson(pnlPath);
const profit = Number(pnl.profitSol);
if (!Number.isFinite(profit) || profit <= 0) {
  fail("profitSol is not a positive realized number");
}

const RENT_SOL_FLOOR = 0.05;
if (profit < RENT_SOL_FLOOR) {
  fail("profitSol " + profit + " < rent floor " + RENT_SOL_FLOOR);
}

process.stdout.write("PASS\n");
process.exitCode = 0;
process.exit(0);
