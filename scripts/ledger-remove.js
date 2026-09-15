#!/usr/bin/env node
"use strict";

// Remove one ledger entry by sourceSig.
//
//   node scripts/ledger-remove.js --source-sig <sig>
//   node scripts/ledger-remove.js --source-sig <sig> --dry-run
//
// For an entry that was recorded but never landed on chain — a wrong signature,
// a memo that failed to send, a test row. reconcile.js is what tells you an
// entry is in that state.
//
// This is NOT a way to take back credit that was genuinely earned and landed.
// The ledger is the supply cap; removing a real entry silently reduces what
// holders are owed. If the memo is on chain, the entry stays.
//
// It exists because the alternative is hand-editing JSON, which validates
// nothing and reports nothing.

const path = require("path");

const ledgerLib = require("./lib/ledger");
const { ROOT } = require("./lib/checks");

const LEDGER_PATH = path.join(ROOT, "config/ledger.json");
const USAGE = "usage: ledger-remove.js --source-sig <sig> [--dry-run]";

function die(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--dry-run") {
    args.dryRun = true;
    continue;
  }
  if (argv[i] !== "--source-sig") die(`unexpected argument: ${argv[i]}\n\n${USAGE}`);
  const value = argv[i + 1];
  if (value === undefined || value.startsWith("--")) die(`--source-sig needs a value\n\n${USAGE}`);
  args.sourceSig = value;
  i += 1;
}

if (!args.sourceSig) die(`missing --source-sig\n\n${USAGE}`);

const read = ledgerLib.load(LEDGER_PATH);
if (!read.ok) die(read.error);

const before = ledgerLib.verify(read.ledger);
if (!before.ok) {
  die(`config/ledger.json is already invalid, fix that first:\n  ${before.errors.join("\n  ")}`);
}

const match = read.ledger.entries.find((entry) => entry.sourceSig === args.sourceSig);
if (!match) {
  die(
    `no entry with sourceSig ${args.sourceSig}\n` +
      `  the ledger holds ${before.entryCount} entr${before.entryCount === 1 ? "y" : "ies"}: ` +
      read.ledger.entries.map((entry) => entry.sourceSig).join(", ")
  );
}

const next = { ...read.ledger, entries: read.ledger.entries.filter((entry) => entry.sourceSig !== args.sourceSig) };
const after = ledgerLib.verify(next);
if (!after.ok) die(`removal would leave an invalid ledger:\n  ${after.errors.join("\n  ")}`);

console.log("");
console.log(args.dryRun ? "DRY RUN — nothing written." : "Removed.");
console.log("");
console.log(`  entry:   ${match.credit} to ${match.wallet} (${match.reason}, week ${match.week})`);
console.log(`  sig:     ${match.sourceSig}`);
console.log(`  supply:  ${before.total.credit}  ->  ${after.total.credit}`);
console.log("");

if (args.dryRun) {
  console.log("Re-run without --dry-run to apply.");
  console.log("");
  process.exit(0);
}

ledgerLib.save(LEDGER_PATH, next);

console.log("Only remove entries that never landed on chain. If that memo is on");
console.log("chain, this just made the ledger disagree with it — put the entry back");
console.log("with issue-credit.js and its real signature.");
console.log("");
console.log("Check the two agree now:  node scripts/reconcile.js");
console.log("");
