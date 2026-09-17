#!/usr/bin/env node
"use strict";

// Where is the desk, and what is the single next thing to do?
//
//   node scripts/doctor.js
//
// The gate says what is wrong. This says where you are in the sequence and
// what to do next, which is a different question and the one asked more often.
//
// Read-only. Touches no chain, signs nothing, writes nothing.

const fs = require("fs");
const path = require("path");

const { ROOT: REPO_ROOT } = require("./lib/checks");

// DESK_ROOT lets the tests point this at a fixture desk. Read-only either way:
// nothing here writes, signs, or reaches the network.
const ROOT = process.env.DESK_ROOT || REPO_ROOT;
const ledgerLib = require("./lib/ledger");
const earnLib = require("./lib/earn");
const receiptLib = require("./lib/receipt");

const DONE = "✓";
const TODO = "·";
const WARN = "!";

function readJson(relative) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
  } catch {
    return null;
  }
}

const protocol = readJson("protocol.json");
const config = readJson("config/protocol.json");
const pnl = readJson("config/pnl.json");
const earn = readJson("config/earn.json");
const ledgerRead = ledgerLib.load(path.join(ROOT, "config/ledger.json"));
const ledger = ledgerRead.ok ? ledgerRead.ledger : null;
const ledgerCheck = ledger ? ledgerLib.verify(ledger) : null;

const filesPresent = Boolean(config && pnl && earn && ledger);
const confirmed = Boolean(earn && earn.ownerConfirmed === true && pnl && pnl.ownerConfirmed === true);
const scheduleOk = Boolean(earn && earnLib.verify(earn).ok);
const creditsIssued = Boolean(ledgerCheck && ledgerCheck.ok && ledgerCheck.entryCount > 0);
const rentCovered = Boolean(
  pnl &&
    Number(pnl.rentThresholdSol) > 0 &&
    Number(pnl.realizedDeskPnl ?? pnl.realizedPnl ?? pnl.deskPnlReport) >= Number(pnl.rentThresholdSol)
);
const mintExists = Boolean(protocol && protocol.mint && protocol.mint.trim() !== "");
const poolExists = Boolean(protocol && protocol.pool && protocol.pool.trim() !== "");

const stages = [
  {
    ok: filesPresent,
    label: "Operator files copied",
    next: [
      "Copy the four templates, then re-run this:",
      "  for f in protocol pnl earn ledger; do",
      "    [ -f config/$f.json ] || cp config/$f.example.json config/$f.json",
      "  done",
      "",
      "  The guard matters. ledger.example.json is \"entries\": [], so copying over",
      "  an existing config/ledger.json erases every issued credit while the memos",
      "  stay on chain forever. If that already happened, the credits are not lost:",
      "  node scripts/ledger-rebuild.js",
    ],
  },
  {
    ok: scheduleOk,
    label: "Earn schedule is valid",
    next: ["config/earn.json is malformed. Run: node scripts/gate.js --preflight"],
  },
  {
    ok: confirmed,
    label: "Owner confirmed the rates and the rent threshold",
    next: [
      "The rates and rentThresholdSol ship as DEFAULTS. Read EARN.md, then state",
      "the numbers you mean — passing them is the confirmation:",
      "",
      "  node scripts/confirm.js --session 1.000000 --report 2.000000 --rent 10",
      "",
      "Change any of those three to what you actually intend. No editor needed.",
    ],
  },
  {
    ok: creditsIssued,
    label: "At least one credit issued",
    next: [
      "This is the desk's work, not a config problem. Supply is the ledger",
      "total, so with an empty ledger a mint would create nothing.",
      "",
      "Land the memo FIRST: sourceSig is the signature of the transaction",
      "that carried it, and that does not exist until it is sent.",
      "",
      "  1. node scripts/issue-credit.js --wallet <addr> --reason desk.session \\",
      "       --week <week> --preview",
      "  2. land that memo with the desk signer",
      "  3. re-run with --source-sig <signature of that transaction>",
      "  4. node scripts/reconcile.js",
    ],
  },
  {
    ok: rentCovered,
    label: "Realized PnL covers the rent threshold",
    next: [
      "Run the desk. This one is earned, not configured — no command makes",
      "PnL appear. When there is a real figure to book, record it with:",
      "",
      "  node scripts/record-pnl.js --realized <sol> --week <week>",
      "",
      "That writes the measurement only. It will not move rentThresholdSol.",
    ],
  },
  {
    ok: mintExists,
    label: "Mint created",
    next: [
      "Preflight should pass now. Check, then read MINT.md end to end:",
      "  node scripts/mint-plan.js",
      "",
      "Settle the authority revocation BEFORE mint day (MINT.md step 3).",
    ],
  },
  {
    ok: poolExists,
    label: "35/USDC pool seeded and locked",
    next: [
      "After the mint is CLEAN. See RULES.md 'Pair' and KILL_LIST 5-8.",
      "  node scripts/self-audit.js",
    ],
  },
];

console.log("");
console.log("35 desk status");
console.log("==============");
console.log("");

let firstBlocked = null;
for (const stage of stages) {
  if (stage.ok) {
    console.log(`  ${DONE} ${stage.label}`);
  } else {
    console.log(`  ${firstBlocked ? TODO : WARN} ${stage.label}`);
    if (!firstBlocked) firstBlocked = stage;
  }
}

if (creditsIssued) {
  console.log("");
  const plural = ledgerCheck.entryCount === 1 ? "entry" : "entries";
  console.log(`  ledger: ${ledgerCheck.entryCount} ${plural}, supply would be ${ledgerCheck.total.credit}`);
  const receipt = receiptLib.readIfCurrent(ROOT, ledger);
  console.log("");
  if (receipt) {
    console.log(`  ${DONE} verified against chain at ${receipt.at}`);
    console.log("    (this exact ledger; any change to it invalidates the check)");
  } else {
    console.log(`  ${WARN} RECORDED, NOT VERIFIED. Nothing here proves those memos are`);
    console.log("    on chain. A ledger entry whose sourceSig is not a real transaction");
    console.log("    signature is a supply cap built on nothing. Check it now:");
    console.log("");
    console.log("      node scripts/reconcile.js");
  }
}

console.log("");

if (!firstBlocked) {
  console.log("Every local stage is done. The chain is the remaining authority:");
  console.log("  node scripts/self-audit.js    (must print CLEAN: yes before announcing)");
  console.log("");
  process.exit(0);
}

console.log("NEXT");
console.log("----");
for (const line of firstBlocked.next) {
  console.log(line ? `  ${line}` : "");
}
console.log("");
const verifiedNow = ledger && receiptLib.readIfCurrent(ROOT, ledger);
if (verifiedNow) {
  console.log("Still unseen from here: the mint's real on-chain authorities");
  console.log("(node scripts/self-audit.js). That one needs the network.");
} else {
  console.log("Things this cannot see: whether memos actually landed on chain");
  console.log("(node scripts/reconcile.js) and the mint's real authorities");
  console.log("(node scripts/self-audit.js). Both need the network.");
}
console.log("");
process.exit(0);
