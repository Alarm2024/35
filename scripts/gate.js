#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

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

const protocol = readJson("protocol.json");
const configProtocol = readJson("config/protocol.json");
const pnl = readJson("config/pnl.json");

const publicFields = [
  "name",
  "symbol",
  "decimals",
  "issuanceMode",
  "jurisdiction",
  "mint",
  "squadsVault",
  "pool",
  "usdcMint",
];

if (protocol) {
  for (const field of publicFields) {
    if (!(field in protocol)) {
      fail(`protocol.json missing field: ${field}`);
    }
  }

  if (protocol.issuanceMode !== "earned") {
    fail("protocol.json issuanceMode must be earned");
  }

  requireNonEmptyString(protocol, "name", "protocol.json");
  requireNonEmptyString(protocol, "symbol", "protocol.json");
  requireNonEmptyString(protocol, "jurisdiction", "protocol.json");
  requireNonEmptyString(protocol, "mint", "protocol.json");
  requireNonEmptyString(protocol, "squadsVault", "protocol.json");
  requireNonEmptyString(protocol, "pool", "protocol.json");
  requireNonEmptyString(protocol, "usdcMint", "protocol.json");

  if (typeof protocol.decimals !== "number" || !Number.isInteger(protocol.decimals)) {
    fail("protocol.json decimals must be an integer");
  }
}

if (configProtocol) {
  const configFields = [
    "deskSigners",
    "controlledWallets",
    "position",
    "positionNftMint",
    "metadataUri",
    "rpcUrl",
    "memoProgram",
    "dammV2Program",
  ];

  for (const field of configFields) {
    if (!(field in configProtocol)) {
      fail(`config/protocol.json missing field: ${field}`);
    }
  }

  requireNonEmptyString(configProtocol, "rpcUrl", "config/protocol.json");
  requireNonEmptyString(configProtocol, "memoProgram", "config/protocol.json");
  requireNonEmptyString(configProtocol, "dammV2Program", "config/protocol.json");
  requireNonEmptyString(configProtocol, "position", "config/protocol.json");
  requireNonEmptyString(configProtocol, "positionNftMint", "config/protocol.json");
  requireNonEmptyString(configProtocol, "metadataUri", "config/protocol.json");

  if (!Array.isArray(configProtocol.deskSigners) || configProtocol.deskSigners.length === 0) {
    fail("config/protocol.json deskSigners must be a non-empty array");
  }

  if (!Array.isArray(configProtocol.controlledWallets)) {
    fail("config/protocol.json controlledWallets must be an array");
  }
}

if (!pnl) {
  fail("config/pnl.json missing");
} else if (typeof pnl !== "object" || pnl === null) {
  fail("config/pnl.json must be an object");
}

if (failures.length > 0) {
  process.exit(1);
}

console.log("PASS");
process.exit(0);
