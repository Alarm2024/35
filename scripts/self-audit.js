#!/usr/bin/env node
/**
 * self-audit.js — FAIL CLOSED. Read-only.
 * No mint, transfer, or signing dependencies.
 * Default exit is 1. Exit 0 only after on-chain CLEAN checks against a published mint.
 */
"use strict";

const fs = require("fs");
const path = require("path");

process.exitCode = 1;

const root = path.resolve(__dirname, "..");
const publicPath = path.join(root, "protocol.json");
const privatePath = path.join(root, "config", "protocol.json");

function fail(reason) {
  process.stdout.write("# 35 self-audit\n\nSTATUS: FAIL\n\n" + reason + "\n");
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

if (!pub.mint) {
  fail("mint unpublished — cannot audit. Default FAIL CLOSED.");
}

if (pub.issuanceMode !== "earned") fail("issuanceMode is not earned");

const priv = fs.existsSync(privatePath) ? readJson(privatePath) : {};
const rpc = priv.rpcUrl || "https://api.mainnet-beta.solana.com";

function b58decode(s) {
  const a = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let bytes = [0];
  for (const c of s) {
    const v = a.indexOf(c);
    if (v < 0) throw new Error("bad base58");
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 255;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 255);
      carry >>= 8;
    }
  }
  let zeros = 0;
  for (const c of s) {
    if (c === "1") zeros++;
    else break;
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[out.length - 1 - i] = bytes[i];
  return out;
}

async function getAccount(pubkey) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getAccountInfo",
    params: [pubkey, { encoding: "base64" }],
  };
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("rpc http " + res.status);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "rpc error");
  return json.result && json.result.value;
}

(async () => {
  let acct;
  try {
    acct = await getAccount(pub.mint);
  } catch (err) {
    fail("rpc read failed: " + err.message);
  }
  if (!acct) fail("mint account missing on chain");

  let raw;
  try {
    raw = Buffer.from(acct.data[0], "base64");
  } catch (err) {
    fail("mint data decode failed");
  }
  if (raw.length < 82) fail("mint account too short to be SPL mint");

  const mintAuthOption = raw[0];
  const freezeAuthOption = raw[46];
  if (mintAuthOption !== 0) fail("mint authority is not null");
  if (freezeAuthOption !== 0) fail("freeze authority is not null");

  const lines = [
    "# 35 self-audit",
    "",
    "STATUS: FAIL",
    "",
    "Authorities revoked: yes",
    "LP lock / holder concentration / metadata mutability: not proven in this scaffold.",
    "Refusing CLEAN until lock proof and holder scan are implemented.",
    "",
    "Default remains FAIL CLOSED.",
  ];
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(1);
})().catch((err) => fail(String(err && err.message ? err.message : err)));
