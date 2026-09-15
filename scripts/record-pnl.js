#!/usr/bin/env node
"use strict";

// Record realized desk PnL.
//
//   node scripts/record-pnl.js --realized 3.5 --week 2026-W38
//
// RULES.md: realized desk PnL only, never invented profit, and rent is paid
// from it rather than from outside capital. This writes the figure and nothing
// else — it will not touch rentThresholdSol or ownerConfirmed, because those
// are decisions, not measurements, and moving a threshold to meet a number is
// the failure this whole gate exists to prevent.
//
// Exists for the same reason confirm.js does: the alternative is hand-editing
// JSON, and this desk is operated from a phone.

const fs = require("fs");
const path = require("path");

const { ROOT } = require("./lib/checks");

const PNL_PATH = path.join(ROOT, "config/pnl.json");
const USAGE = `usage: record-pnl.js --realized <sol> --week <week>

  --realized  realized desk PnL in SOL, as actually booked
  --week      the week this figure covers, e.g. 2026-W38

This records a measurement. It does not change the rent threshold or the
owner confirmation — use confirm.js for those.`;

function die(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i += 1) {
  const key = argv[i];
  if (!key.startsWith("--")) die(`unexpected argument: ${key}\n\n${USAGE}`);
  const value = argv[i + 1];
  if (value === undefined || value.startsWith("--")) die(`${key} needs a value\n\n${USAGE}`);
  args[key.slice(2)] = value;
  i += 1;
}

for (const required of ["realized", "week"]) {
  if (!args[required]) die(`missing --${required}\n\n${USAGE}`);
}

const realized = Number(args.realized);
if (!Number.isFinite(realized)) die(`--realized must be a number, got ${JSON.stringify(args.realized)}`);
if (realized < 0) die("--realized cannot be negative; a loss is recorded as 0 realized, not as a negative gain");

if (!fs.existsSync(PNL_PATH)) {
  die("missing config/pnl.json — copy it from config/pnl.example.json first, then re-run");
}

const pnl = JSON.parse(fs.readFileSync(PNL_PATH, "utf8"));
const before = pnl.realizedDeskPnl;
const threshold = Number(pnl.rentThresholdSol);

pnl.realizedDeskPnl = realized;
pnl.week = args.week;

fs.writeFileSync(PNL_PATH, `${JSON.stringify(pnl, null, 2)}\n`);

console.log("");
console.log("Recorded.");
console.log("");
console.log(`  realizedDeskPnl   ${before}  ->  ${realized}`);
console.log(`  week              ${args.week}`);
console.log(`  rentThresholdSol  ${threshold} (unchanged)`);
console.log("");

if (!Number.isFinite(threshold) || threshold <= 0) {
  console.log("rentThresholdSol is not set. Run confirm.js before this gate can mean anything.");
} else if (realized >= threshold) {
  console.log(`This clears the rent threshold (${realized} >= ${threshold}).`);
  console.log("");
  console.log("That unlocks the gate. It does not authorise a mint: RULES.md still");
  console.log("requires the owner to say mint, and self-audit.js still has to reach");
  console.log("the chain before anything is announced.");
} else {
  const remaining = Math.round((threshold - realized) * 1e6) / 1e6;
  console.log(`Still ${remaining} SOL short of the ${threshold} threshold. Mint stays closed.`);
}

console.log("");
console.log("Next:  node scripts/doctor.js");
console.log("");
