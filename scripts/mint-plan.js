#!/usr/bin/env node
"use strict";

// Print the mint ceremony with real values substituted, or say exactly why it
// cannot happen yet.
//
//   node scripts/mint-plan.js
//
// This never signs, sends, or mints. It reads the ledger and config and turns
// them into the exact parameters mint day needs, so the ceremony is copy-paste
// rather than improvisation at the keyboard with a live key loaded.
//
// The supply figure comes from the ledger and nowhere else (CONVERSION.md).

const path = require("path");

const { run, ROOT, readJson, createReporter } = require("./lib/checks");
const ledgerLib = require("./lib/ledger");

function heading(text) {
  console.log(`\n${text}\n${"-".repeat(text.length)}`);
}

async function main() {
  const preflight = await run({ mode: "preflight" });

  if (!preflight.ok) {
    console.error("");
    console.error("MINT: blocked");
    console.error("");
    console.error("The failures above are the whole list. Clear them, re-run, and this");
    console.error("prints the ceremony. RULES.md also requires the owner to say mint;");
    console.error("a passing gate is necessary, never sufficient.");
    process.exit(1);
  }

  const report = createReporter();
  const protocol = readJson("protocol.json", report);
  const config = readJson("config/protocol.json", report);
  const read = ledgerLib.load(path.join(ROOT, "config/ledger.json"));
  const verified = ledgerLib.verify(read.ledger);

  heading("Supply (derived from the ledger, not chosen)");
  console.log(`entries:      ${verified.entryCount}`);
  console.log(`supply:       ${verified.total.credit}`);
  console.log(`base units:   ${verified.total.units}`);
  console.log(`decimals:     6`);
  console.log(`by week:      ${verified.byWeek.map((w) => `${w.week}=${w.credit}`).join(" ")}`);

  heading("Ceremony");
  console.log(`1. Create the mint with 6 decimals, mint authority = desk signer.`);
  console.log(`     spl-token create-token --decimals 6 --fee-payer "$KEYPAIR_PATH"`);
  console.log(``);
  console.log(`2. Mint exactly ${verified.total.credit} to the Squads vault and no more.`);
  console.log(`     spl-token create-account <MINT> --owner ${protocol.squadsVault}`);
  console.log(`     spl-token mint <MINT> ${verified.total.credit} --recipient-owner ${protocol.squadsVault}`);
  console.log(``);
  console.log(`3. Revoke BOTH authorities in ONE transaction (RULES.md), then stop.`);
  console.log(`     See MINT.md — the stock spl-token CLI sends one authorize per`);
  console.log(`     transaction, so this step needs a two-instruction transaction.`);
  console.log(``);
  console.log(`4. Record the mint address in protocol.json, then verify on chain:`);
  console.log(`     node scripts/self-audit.js`);
  console.log(``);
  console.log(`5. Announce ONLY after that prints CLEAN: yes (KILL_LIST 10).`);

  heading("Values the ceremony needs");
  console.log(`squadsVault:    ${protocol.squadsVault}`);
  console.log(`usdcMint:       ${protocol.usdcMint}`);
  console.log(`metadataUri:    ${config.metadataUri}`);
  console.log(`dammV2Program:  ${config.dammV2Program}`);
  console.log(`jurisdiction:   ${protocol.jurisdiction}`);

  console.log(`\nMINT: ready for the owner's decision`);
  console.log(`This printed a plan. It minted nothing and signed nothing.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(`FAIL: mint-plan crashed: ${error.message}`);
  process.exit(1);
});
