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
const { parseMemo } = require("./lib/memo");
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

// spl-memo instructions come back from jsonParsed as { program: "spl-memo", parsed: "<text>" }.
function memosFrom(transaction) {
  const message = transaction && transaction.transaction && transaction.transaction.message;
  const instructions = (message && message.instructions) || [];
  const inner = ((transaction && transaction.meta && transaction.meta.innerInstructions) || []).flatMap(
    (group) => group.instructions || []
  );

  return instructions
    .concat(inner)
    .filter((instruction) => instruction.program === "spl-memo" && typeof instruction.parsed === "string")
    .map((instruction) => instruction.parsed);
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
  const onChain = new Map();

  for (const signer of signers) {
    const signatures = await call("getSignaturesForAddress", [signer, { limit }]);
    for (const { signature, err } of signatures) {
      if (err) continue;
      const transaction = await call("getTransaction", [
        signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "finalized" },
      ]);
      for (const memo of memosFrom(transaction)) {
        const parsed = parseMemo(memo);
        if (parsed.ok) {
          onChain.set(signature, { ...parsed, signature, signer });
        }
      }
    }
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
      console.error(
        `FAIL: in ledger but not found on chain within the last ${limit} signatures: ${entry.sourceSig}`
      );
      mismatches += 1;
    }
  }

  if (mismatches > 0) {
    console.error(`RECONCILED: no (${mismatches} mismatch${mismatches === 1 ? "" : "es"})`);
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
