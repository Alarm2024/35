#!/usr/bin/env node
"use strict";

// Record one earned credit in the ledger.
//
// ORDER MATTERS. sourceSig is the signature of the transaction that carried the
// memo, and reconcile.js matches the ledger against chain by exactly that. A
// signature does not exist until the transaction is sent, so the memo is landed
// FIRST and recorded SECOND:
//
//   1. node scripts/issue-credit.js --wallet <addr> --reason desk.session \
//        --week 2026-W37 --preview          prints the memo, writes nothing
//   2. node scripts/land-memo.js --memo '<that memo>' --send
//                                            returns a signature
//   3. node scripts/issue-credit.js --wallet <addr> --reason desk.session \
//        --week 2026-W37 --source-sig <that signature>
//
// The credit amount is NOT an argument. It comes from config/earn.json, because
// a rate you can pass on the command line is a discretionary rate.
//
// This deliberately does not sign or send. Landing the memo is a separate,
// explicit act, in scripts/land-memo.js, with the desk signer loaded from
// KEYPAIR_PATH (SECURITY.md) — so the ledger writer never holds a key.

const path = require("path");

const ledgerLib = require("./lib/ledger");
const earnLib = require("./lib/earn");
const { isAddress } = require("./lib/address");
const { ROOT } = require("./lib/checks");

const LEDGER_PATH = path.join(ROOT, "config/ledger.json");
const EARN_PATH = path.join(ROOT, "config/earn.json");

const USAGE = `usage:
  issue-credit.js --wallet <addr> --reason <reason> --week <week> --preview
  issue-credit.js --wallet <addr> --reason <reason> --week <week> --source-sig <sig> [--dry-run]

--preview prints the memo to land and writes nothing. Land it, then re-run with
the resulting transaction signature as --source-sig.`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (key === "--preview") {
      args.preview = true;
      continue;
    }
    if (!key.startsWith("--")) {
      return { error: `unexpected argument: ${key}` };
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      return { error: `${key} needs a value` };
    }
    args[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    i += 1;
  }
  return args;
}

function die(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (args.error) die(`${args.error}\n${USAGE}`);

const required = args.preview
  ? ["wallet", "reason", "week"]
  : ["wallet", "reason", "week", "sourceSig"];

for (const field of required) {
  if (!args[field]) die(`missing --${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}\n\n${USAGE}`);
}

if (!isAddress(args.wallet)) die(`--wallet is not a base58 Solana address: ${args.wallet}`);

const earnRead = earnLib.load(EARN_PATH);
if (!earnRead.ok) die(`${earnRead.error}\nCopy config/earn.example.json and publish the same table in EARN.md.`);

const earnVerified = earnLib.verify(earnRead.schedule);
if (!earnVerified.ok) die(`config/earn.json is invalid:\n  ${earnVerified.errors.join("\n  ")}`);

const rule = earnLib.creditFor(earnRead.schedule, args.reason);
if (!rule.ok) die(rule.error);

const ledgerRead = ledgerLib.load(LEDGER_PATH);
const ledger = ledgerRead.ok ? ledgerRead.ledger : ledgerLib.emptyLedger();
if (!ledgerRead.ok && !ledgerRead.error.startsWith("missing")) die(ledgerRead.error);

const entry = {
  wallet: args.wallet,
  credit: rule.credit,
  week: args.week,
  sourceSig: args.sourceSig,
  issuedAt: new Date().toISOString(),
  reason: args.reason,
};

const memo = ledgerLib.memoFor(entry);

// Preview runs before any ledger mutation: its whole purpose is to hand over the
// memo string so it can be landed and a real signature obtained.
if (args.preview) {
  console.log("");
  console.log("PREVIEW — nothing written.");
  console.log("");
  console.log(`  memo to land:  ${memo}`);
  console.log(`  credit:        ${rule.credit} (${args.reason}, from the earn schedule)`);
  console.log("");
  console.log("Land it. Builds and signs and transmits NOTHING without --send:");
  console.log("");
  console.log(`  node scripts/land-memo.js --memo '${memo}'`);
  console.log(`  node scripts/land-memo.js --memo '${memo}' --send`);
  console.log("");
  console.log("--send prints the transaction signature. That signature is the sourceSig,");
  console.log("which is why the memo is landed FIRST: it does not exist until it is sent.");
  console.log("Record it, substituting that signature for SIGNATURE:");
  console.log("");
  console.log(`  node scripts/issue-credit.js --wallet ${args.wallet} --reason ${args.reason} \\`);
  console.log(`    --week ${args.week} --source-sig SIGNATURE`);
  console.log("  node scripts/reconcile.js");
  console.log("");
  process.exit(0);
}

const appended = ledgerLib.append(ledger, entry);
if (!appended.ok) die(`ledger would become invalid:\n  ${appended.errors.join("\n  ")}`);

if (args.dryRun) {
  console.log(`DRY RUN — nothing written`);
  console.log(`memo:   ${memo}`);
  console.log(`total:  ${appended.total.credit} (would be)`);
  process.exit(0);
}

ledgerLib.save(LEDGER_PATH, appended.ledger);

console.log(`recorded ${entry.credit} to ${entry.wallet} for ${entry.reason} (week ${entry.week})`);
console.log(`memo:   ${memo}`);
console.log(`total:  ${appended.total.credit}`);
console.log(``);
console.log(`Verify it against chain now: node scripts/reconcile.js`);
console.log(``);
console.log(`If that reports this sourceSig is not on chain, the memo was never`);
console.log(`landed or the signature is wrong. Fix it rather than leaving the two`);
console.log(`out of step: a ledger that does not reconcile cannot be a supply cap.`);
