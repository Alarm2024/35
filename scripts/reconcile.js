#!/usr/bin/env node
"use strict";

// Compare the local ledger against memos actually landed on chain by the desk
// signers. Either side may be wrong; this says which.
//
//   node scripts/reconcile.js [--limit 1000]
//
// Run it after every issuance and before every preflight. At mint time the
// supply cap is the reconciled ledger total, which is why it must reconcile
// long before mint day rather than on it.

const path = require("path");

const ledgerLib = require("./lib/ledger");
const { scanSignerMemos, inspectSignature } = require("./lib/chain");
const { rpcFactory } = require("./lib/rpc");
const { ROOT, readJson, createReporter } = require("./lib/checks");
const receiptLib = require("./lib/receipt");

const LEDGER_PATH = path.join(ROOT, "config/ledger.json");

function parseLimit(argv) {
  const index = argv.indexOf("--limit");
  if (index === -1) return 1000;
  const value = Number(argv[index + 1]);
  if (!Number.isInteger(value) || value <= 0 || value > 1000) {
    console.error("FAIL: --limit must be an integer between 1 and 1000");
    process.exit(1);
  }
  return value;
}

async function main() {
  const report = createReporter();
  const limit = parseLimit(process.argv.slice(2));

  const config = readJson("config/protocol.json", report);
  if (!config || !config.rpcUrl) {
    console.error("FAIL: config/protocol.json rpcUrl is required to reconcile");
    process.exit(1);
  }

  const signers = Array.isArray(config.deskSigners) ? config.deskSigners : [];
  if (signers.length === 0) {
    console.error("FAIL: config/protocol.json deskSigners is empty — nothing to reconcile against");
    process.exit(1);
  }

  const read = ledgerLib.load(LEDGER_PATH);
  if (!read.ok) {
    console.error(`FAIL: ${read.error}`);
    process.exit(1);
  }

  const verified = ledgerLib.verify(read.ledger);
  if (!verified.ok) {
    for (const error of verified.errors) console.error(`FAIL: config/ledger.json ${error}`);
    process.exit(1);
  }

  const call = rpcFactory(config.rpcUrl);
  const onChain = await scanSignerMemos(call, signers, limit);

  // Report, never hide. A memo on an undeclared program still counted as a
  // credit before this line existed and still counts after it — silently
  // dropping it would shrink the supply cap, which is the one thing this file
  // exists to prevent. It is named so the operator can stop producing them.
  const offProgram = [...onChain.values()].filter(
    (memo) => memo.programId && memo.programId !== config.memoProgram
  );
  if (offProgram.length > 0) {
    console.error(
      `WARN: ${offProgram.length} memo(s) landed on a program other than the declared ${config.memoProgram}:`
    );
    for (const memo of offProgram) {
      console.error(`      ${memo.signature} -> ${memo.programId}`);
    }
    console.error("      They still count. Land with scripts/land-memo.js to stop adding more.");
  }

  const byLedgerSig = new Map(read.ledger.entries.map((entry) => [entry.sourceSig, entry]));
  let mismatches = 0;

  for (const [signature, credit] of onChain) {
    const entry = byLedgerSig.get(signature);
    if (!entry) {
      console.error(`FAIL: on chain but not in ledger: ${signature} -> ${credit.wallet} ${credit.credit} ${credit.week}`);
      mismatches += 1;
      continue;
    }
    if (entry.wallet !== credit.wallet || entry.credit !== credit.credit || entry.week !== credit.week) {
      console.error(
        `FAIL: ledger disagrees with chain for ${signature}: ledger ${entry.wallet}/${entry.credit}/${entry.week} vs chain ${credit.wallet}/${credit.credit}/${credit.week}`
      );
      mismatches += 1;
    }
  }

  for (const entry of read.ledger.entries) {
    if (!onChain.has(entry.sourceSig)) {
      // Ask what that signature actually is before calling it absent. "Not
      // found" and "found, but its memo was not parsed as spl-memo" are
      // different failures with different fixes, and printing the first for
      // the second sends the operator looking for a transaction that exists.
      const seen = await inspectSignature(call, entry.sourceSig);
      if (!seen.found) {
        console.error(
          `FAIL: no such transaction, or not yet finalized: ${entry.sourceSig}`
        );
      } else if (seen.err) {
        console.error(
          `FAIL: that transaction FAILED on chain, so nothing was landed: ${entry.sourceSig}`
        );
      } else if (seen.parsedMemos.length === 0) {
        console.error(
          `FAIL: transaction EXISTS but carries no memo the RPC parsed as spl-memo: ${entry.sourceSig}`
        );
        console.error(
          `      programs in it: ${seen.programIds.join(", ") || "(none reported)"}`
        );
        console.error(
          `      config/protocol.json declares memoProgram ${config.memoProgram}`
        );
        console.error(
          "      A memo landed on a program the RPC does not recognise is invisible"
        );
        console.error(
          "      to this check forever. Land with scripts/land-memo.js, which uses"
        );
        console.error("      the declared program.");
      } else {
        console.error(
          `FAIL: transaction exists and carries a memo, but not a valid 35-credit one: ${entry.sourceSig}`
        );
        for (const memo of seen.parsedMemos) console.error(`      memo: ${memo}`);
      }
      mismatches += 1;
    }
  }

  if (mismatches > 0) {
    console.error(`RECONCILED: no (${mismatches} mismatch${mismatches === 1 ? "" : "es"})`);
    // "on chain but not in ledger" on EVERY row is the signature of a wiped
    // ledger, not of a bad issuance: config/ledger.json is gitignored, and the
    // documented setup step used to be a plain `cp` of an empty example over
    // it. Saying so here is the difference between an alarm and a way out.
    if (onChain.size > 0 && read.ledger.entries.length === 0) {
      console.error("");
      console.error("Every memo on chain is missing locally and the ledger is empty.");
      console.error("That is what an overwritten config/ledger.json looks like — the");
      console.error("file is gitignored, so `cp config/ledger.example.json ...` a second");
      console.error("time replaces it with `entries: []`. The credits are not lost; they");
      console.error("are on chain. Read them back:");
      console.error("");
      console.error("  node scripts/ledger-rebuild.js");
      console.error("");
    }
    process.exit(1);
  }

  console.log(`entries:  ${verified.entryCount}`);
  console.log(`total:    ${verified.total.credit}`);
  console.log(`weeks:    ${verified.byWeek.map((w) => `${w.week}=${w.credit}`).join(" ") || "(none)"}`);

  // Note it locally so doctor stops warning about a ledger that was just
  // checked. Convenience only: nothing that gates the mint reads this.
  receiptLib.write(ROOT, read.ledger, verified.total.credit);

  if (verified.entryCount === 0) {
    console.log("");
    console.log("Note: an empty ledger reconciles trivially. This says nothing yet.");
  }

  console.log("RECONCILED: yes");
  process.exit(0);
}

main().catch((error) => {
  console.error(`FAIL: reconcile crashed: ${error.message}`);
  process.exit(1);
});
