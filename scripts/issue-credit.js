#!/usr/bin/env node
"use strict";

// Record one earned credit in the ledger and print the memo to land on chain.
//
//   node scripts/issue-credit.js --wallet <addr> --reason desk.session \
//     --week 2026-W37 --source-sig <signature>
//
// The credit amount is NOT an argument. It comes from config/earn.json, because
// a rate you can pass on the command line is a discretionary rate.
//
// This deliberately does not sign or send. Landing the memo is a separate,
// explicit act with the desk signer loaded from KEYPAIR_PATH (SECURITY.md).

const path = require("path");

const ledgerLib = require("./lib/ledger");
const earnLib = require("./lib/earn");
const { isAddress } = require("./lib/address");
const { ROOT } = require("./lib/checks");

const LEDGER_PATH = path.join(ROOT, "config/ledger.json");
const EARN_PATH = path.join(ROOT, "config/earn.json");

const USAGE = `usage: issue-credit.js --wallet <addr> --reason <reason> --week <week> --source-sig <sig> [--dry-run]`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--dry-run") {
      args.dryRun = true;
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

for (const required of ["wallet", "reason", "week", "sourceSig"]) {
  if (!args[required]) die(`missing --${required.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}\n${USAGE}`);
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

const appended = ledgerLib.append(ledger, entry);
if (!appended.ok) die(`ledger would become invalid:\n  ${appended.errors.join("\n  ")}`);

const memo = ledgerLib.memoFor(entry);

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
console.log(`Land it with the desk signer, then run: node scripts/reconcile.js`);
console.log(`  solana transfer --from "$KEYPAIR_PATH" <self> 0 --with-memo '${memo}'`);
