#!/usr/bin/env node
"use strict";

// Set the earn rates and the rent threshold, and record that the owner meant them.
//
//   node scripts/confirm.js --session 1.000000 --report 2.000000 --rent 10
//
// The numbers are required arguments on purpose. Passing them IS the
// confirmation: there is no flag that just flips ownerConfirmed on whatever
// defaults happen to be sitting in the file, because that would let a default
// become the live rate without anyone stating it.
//
// Exists because editing JSON by hand over SSH from a phone is a bad way to
// make a decision that governs issuance.

const fs = require("fs");
const path = require("path");

const { ROOT } = require("./lib/checks");
const { validateCredit } = require("./lib/memo");

const USAGE = `usage: confirm.js --session <credit> --report <credit> --rent <sol>

  --session  credit earned by one completed desk session
  --report   credit earned by one published desk report
  --rent     realized SOL the desk must clear before mint is allowed

example:
  node scripts/confirm.js --session 1.000000 --report 2.000000 --rent 10`;

function die(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) die(`unexpected argument: ${key}\n\n${USAGE}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) die(`${key} needs a value\n\n${USAGE}`);
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

for (const required of ["session", "report", "rent"]) {
  if (!args[required]) die(`missing --${required}\n\n${USAGE}`);
}

for (const [flag, value] of [["session", args.session], ["report", args.report]]) {
  const check = validateCredit(value);
  if (!check.ok) die(`--${flag} is not a valid credit: ${check.error}`);
}

const rent = Number(args.rent);
if (!Number.isFinite(rent) || rent <= 0) die("--rent must be a positive number of SOL");

const earnPath = path.join(ROOT, "config/earn.json");
const pnlPath = path.join(ROOT, "config/pnl.json");

for (const [label, file] of [["config/earn.json", earnPath], ["config/pnl.json", pnlPath]]) {
  if (!fs.existsSync(file)) {
    die(`missing ${label} — copy it from its .example.json first, then re-run`);
  }
}

const earn = JSON.parse(fs.readFileSync(earnPath, "utf8"));
const pnl = JSON.parse(fs.readFileSync(pnlPath, "utf8"));

if (!earn.rules || !earn.rules["desk.session"] || !earn.rules["desk.report"]) {
  die("config/earn.json is missing the desk.session or desk.report rule");
}

const before = {
  session: earn.rules["desk.session"].credit,
  report: earn.rules["desk.report"].credit,
  rent: pnl.rentThresholdSol,
};

earn.rules["desk.session"].credit = args.session;
earn.rules["desk.report"].credit = args.report;
earn.publishedAt = new Date().toISOString().slice(0, 10);
earn.ownerConfirmed = true;

pnl.rentThresholdSol = rent;
pnl.ownerConfirmed = true;

fs.writeFileSync(earnPath, `${JSON.stringify(earn, null, 2)}\n`);
fs.writeFileSync(pnlPath, `${JSON.stringify(pnl, null, 2)}\n`);

console.log("");
console.log("Confirmed and written.");
console.log("");
console.log(`  desk.session      ${before.session}  ->  ${args.session}`);
console.log(`  desk.report       ${before.report}  ->  ${args.report}`);
console.log(`  rentThresholdSol  ${before.rent}  ->  ${rent}`);
console.log(`  published         ${earn.publishedAt}`);
console.log("");
console.log("These are now the live rates for this desk. Changing them later is");
console.log("fine; changing them retroactively is not — the gate compares every");
console.log("ledger entry against the schedule, so past credits keep their rate.");
console.log("");
console.log("Update the table in EARN.md to match, so the published record and the");
console.log("machine-readable file agree.");
console.log("");
console.log("Next:  node scripts/doctor.js");
console.log("");
