#!/usr/bin/env node
"use strict";

// Land one credit memo on chain with the desk signer. The step between
// `issue-credit.js --preview` and `issue-credit.js --source-sig`.
//
//   node scripts/land-memo.js --memo '35-credit:<wallet>:<credit>:<week>'
//   node scripts/land-memo.js --memo '...' --send
//
// Without --send it builds and signs and prints, and transmits nothing. That is
// the default because sending is the only irreversible act in this repo.
//
// WHY THIS EXISTS. The desk could preview a memo, record one and reconcile one,
// but not land one — the single step that makes a credit real. issue-credit.js
// ended with "land that exact string as an SPL Memo instruction" and no way to
// do it, because an earlier version printed a `solana transfer --with-memo`
// command that had never been run. Removing that was right; stopping there was
// not. The operator works from a phone over SSH, and "arrange the signing
// yourself" is not an instruction.
//
// The key is read from KEYPAIR_PATH at runtime (SECURITY.md), never from the
// repo, and its bytes never reach stdout.

const fs = require("fs");
const path = require("path");

const { parseMemo } = require("./lib/memo");
const { rpcFactory } = require("./lib/rpc");
const { ROOT, readJson, createReporter } = require("./lib/checks");
const txLib = require("./lib/tx");

// A 0-data system account must keep this much to stay rent-exempt. Spending
// below it does not fail the transaction — it silently makes the account
// collectable, which is a worse outcome than a refusal.
const RENT_EXEMPT_LAMPORTS = 890880;
const BASE_FEE_LAMPORTS = 5000;

const USAGE = `usage:
  land-memo.js --memo '<the exact string from issue-credit.js --preview>' [--send]

Without --send: builds, signs and prints. Nothing is transmitted.
With --send:    submits the transaction and prints its signature.

The signer is read from KEYPAIR_PATH (a solana-cli keypair JSON file).`;

function parseArgs(argv) {
  const args = { send: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--send") {
      args.send = true;
      continue;
    }
    if (!key.startsWith("--")) return { error: `unexpected argument: ${key}` };
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) return { error: `${key} needs a value` };
    args[key.slice(2)] = value;
    i += 1;
  }
  if (!args.memo) return { error: "missing --memo" };
  return { args };
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(`FAIL: ${parsed.error}\n\n${USAGE}`);
    process.exit(1);
  }
  const { args } = parsed;

  // The memo is re-parsed here rather than trusted from the caller. A memo
  // reconcile.js cannot read is a transaction fee spent on a row that will
  // never match the ledger.
  const memo = parseMemo(args.memo);
  if (!memo.ok) fail(`--memo is not a valid credit memo: ${memo.error}`);

  const report = createReporter();
  const config = readJson("config/protocol.json", report);
  if (!config) fail("config/protocol.json is missing — copy it from its .example.json first");
  if (!config.rpcUrl) fail("config/protocol.json rpcUrl is required");
  if (!config.memoProgram) fail("config/protocol.json memoProgram is required");

  const keypairPath = process.env.KEYPAIR_PATH;
  if (!keypairPath) {
    fail("KEYPAIR_PATH is not set — see SECURITY.md; it is read at runtime, never committed");
  }

  let raw;
  try {
    raw = fs.readFileSync(path.resolve(keypairPath), "utf8");
  } catch (error) {
    // The error code only, never the path: it can name a directory layout the
    // operator did not mean to put on screen.
    fail(`cannot read the keypair file: ${error.code || error.message}`);
  }

  const keypair = txLib.keypairFromFileBytes(raw);
  if (!keypair.ok) fail(keypair.error);

  const signers = Array.isArray(config.deskSigners) ? config.deskSigners : [];
  if (!signers.includes(keypair.address)) {
    fail(
      `signer ${keypair.address} is not in config/protocol.json deskSigners — ` +
        "reconcile.js only looks at allowlisted signers, so this memo would land and never be found"
    );
  }

  const call = rpcFactory(config.rpcUrl);

  const balance = await call("getBalance", [keypair.address, { commitment: "finalized" }]);
  const lamports = (balance && balance.value) || 0;
  const floor = RENT_EXEMPT_LAMPORTS + BASE_FEE_LAMPORTS;
  if (lamports < floor) {
    fail(
      `signer holds ${lamports} lamports; landing one memo needs ${BASE_FEE_LAMPORTS} on top of the ` +
        `${RENT_EXEMPT_LAMPORTS} rent-exempt floor (${floor}). Fund it before telling anyone they earned something.`
    );
  }

  const latest = await call("getLatestBlockhash", [{ commitment: "finalized" }]);
  const blockhash = latest && latest.value && latest.value.blockhash;
  if (!blockhash) fail("getLatestBlockhash returned no blockhash");

  const built = txLib.buildMemoMessage({
    payer: keypair.address,
    memoProgram: config.memoProgram,
    recentBlockhash: blockhash,
    memo: args.memo.trim(),
  });
  if (!built.ok) fail(built.error);

  const signed = txLib.signMessage(built.message, keypair.secret);

  console.log("");
  console.log(`  signer:   ${keypair.address}`);
  console.log(`  balance:  ${lamports} lamports`);
  console.log(`  memo:     ${args.memo.trim()}`);
  console.log(`  credit:   ${memo.credit} to ${memo.wallet} (${memo.week})`);
  console.log(`  fee:      ${BASE_FEE_LAMPORTS} lamports (one signature, no account created)`);

  if (!args.send) {
    console.log("");
    console.log("  BUILT AND SIGNED — nothing was transmitted.");
    console.log("  Re-run with --send to submit. A blockhash expires in about 60 seconds,");
    console.log("  so --send fetches a fresh one rather than reusing this build.");
    console.log("");
    return;
  }

  const signature = await call("sendTransaction", [
    signed.base64,
    { encoding: "base64", preflightCommitment: "finalized", maxRetries: 3 },
  ]);

  console.log("");
  console.log(`  LANDED: ${signature}`);
  console.log("");
  console.log("  Record it, then verify the ledger and the chain agree:");
  console.log("");
  console.log(`    node scripts/issue-credit.js --wallet ${memo.wallet} \\`);
  console.log(`      --reason REASON --week ${memo.week} --source-sig ${signature}`);
  console.log("    node scripts/reconcile.js");
  console.log("");
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
