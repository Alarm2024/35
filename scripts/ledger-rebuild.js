#!/usr/bin/env node
"use strict";

// Rebuild ledger rows for credit memos that are on chain and missing locally.
//
//   node scripts/ledger-rebuild.js            proposes rows, writes nothing
//   node scripts/ledger-rebuild.js --write    appends them
//
// WHY THIS EXISTS. config/ledger.json is gitignored, so it lives only on the
// box — and the documented setup step is
//
//   cp config/ledger.example.json config/ledger.json
//
// which overwrites it with `"entries": []`. Run that a second time, after any
// credit has been issued, and every row is gone while every memo stays on
// chain forever. reconcile.js then reports "on chain but not in ledger" and
// the desk cannot reconcile, which is the correct alarm and not a fix.
//
// The chain is the record, so recovery is real rather than guesswork: wallet,
// credit and week come from the memo itself and are never invented here.
//
// WHAT IT CANNOT RECOVER. The memo is 35-credit:<wallet>:<credit>:<week> and
// carries no reason. The reason is inferred only when exactly one rule in the
// earn schedule has that credit; otherwise it must be supplied explicitly, per
// signature. Guessing a reason would put a rate in the ledger that the schedule
// does not support, which is the one thing EARN.md exists to prevent.

const path = require("path");

const ledgerLib = require("./lib/ledger");
const earnLib = require("./lib/earn");
const { scanSignerMemos, duplicateGroups } = require("./lib/chain");
const { rpcFactory } = require("./lib/rpc");
const { ROOT, readJson, createReporter } = require("./lib/checks");

const LEDGER_PATH = path.join(ROOT, "config/ledger.json");
const EARN_PATH = path.join(ROOT, "config/earn.json");

const USAGE = `usage:
  ledger-rebuild.js [--limit 1000] [--reason-for <sig>=<reason>]... [--write]

Without --write nothing is saved. --reason-for may be repeated, and is required
for any memo whose credit matches more than one rule in the earn schedule.`;

function parseArgs(argv) {
  const args = { write: false, limit: 1000, reasonFor: new Map() };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--write") {
      args.write = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) return { error: `${key} needs a value` };
    if (key === "--limit") {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0 || n > 1000) return { error: "--limit must be 1..1000" };
      args.limit = n;
    } else if (key === "--reason-for") {
      const at = value.indexOf("=");
      if (at <= 0) return { error: `--reason-for wants <sig>=<reason>, got ${value}` };
      args.reasonFor.set(value.slice(0, at), value.slice(at + 1));
    } else {
      return { error: `unexpected argument: ${key}` };
    }
    i += 1;
  }
  return { args };
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

/// Reasons in the schedule that pay exactly this credit.
function reasonsPaying(schedule, credit) {
  return Object.keys(schedule.rules || {}).filter((reason) => {
    const rule = earnLib.creditFor(schedule, reason);
    return rule.ok && rule.credit === credit;
  });
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(`FAIL: ${parsed.error}\n\n${USAGE}`);
    process.exit(1);
  }
  const { args } = parsed;

  const report = createReporter();
  const config = readJson("config/protocol.json", report);
  if (!config || !config.rpcUrl) fail("config/protocol.json rpcUrl is required");
  const signers = Array.isArray(config.deskSigners) ? config.deskSigners : [];
  if (signers.length === 0) fail("config/protocol.json deskSigners is empty — nothing to scan");

  const earn = earnLib.load(EARN_PATH);
  if (!earn.ok) fail(`config/earn.json ${earn.error}`);

  const read = ledgerLib.load(LEDGER_PATH);
  if (!read.ok) fail(read.error);

  const call = rpcFactory(config.rpcUrl);
  const onChain = await scanSignerMemos(call, signers, args.limit);

  const known = new Set(read.ledger.entries.map((entry) => entry.sourceSig));
  const missing = [...onChain.values()].filter((memo) => !known.has(memo.signature));

  console.log("");
  console.log(`  on chain:        ${onChain.size}`);
  console.log(`  already in the ledger: ${onChain.size - missing.length}`);
  console.log(`  missing:         ${missing.length}`);

  if (missing.length === 0) {
    console.log("");
    console.log("  Nothing to rebuild. Run: node scripts/reconcile.js");
    console.log("");
    return;
  }

  // Say this before anything is written, because it changes the supply cap.
  const dupes = duplicateGroups(missing);
  if (dupes.length > 0) {
    console.log("");
    console.log("  ⚠ IDENTICAL MEMOS — READ THIS BEFORE --write");
    for (const { key, group } of dupes) {
      console.log(`    ${group.length}x ${key}`);
      for (const memo of group) console.log(`       ${memo.signature}`);
    }
    console.log("");
    console.log("    RULES.md: a credit is created when a desk signer LANDS a memo.");
    console.log("    So these are that many separate credits, not one landed twice,");
    console.log("    and rebuilding them raises the supply cap by all of them.");
    console.log("    That rule is deliberate — the alternative lets the operator");
    console.log("    choose which landings count, which is discretionary issuance.");
    console.log("    If that is not what the work earned, decide it in the open");
    console.log("    (EARN.md / RULES.md) rather than by omitting rows here.");
  }

  const proposed = [];
  const blocked = [];
  for (const memo of missing) {
    const explicit = args.reasonFor.get(memo.signature);
    const candidates = reasonsPaying(earn.schedule, memo.credit);
    let reason = explicit;
    if (!reason) {
      if (candidates.length === 1) {
        reason = candidates[0];
      } else {
        blocked.push({ memo, candidates });
        continue;
      }
    }
    const rule = earnLib.creditFor(earn.schedule, reason);
    if (!rule.ok) {
      blocked.push({ memo, candidates, error: `reason ${reason} is not in the earn schedule` });
      continue;
    }
    if (rule.credit !== memo.credit) {
      blocked.push({
        memo,
        candidates,
        error: `reason ${reason} pays ${rule.credit}, but the memo landed ${memo.credit}`,
      });
      continue;
    }
    proposed.push({
      wallet: memo.wallet,
      credit: memo.credit,
      week: memo.week,
      sourceSig: memo.signature,
      // When the memo landed, not when it was re-recorded. The chain knows.
      issuedAt: memo.blockTime
        ? new Date(memo.blockTime * 1000).toISOString()
        : new Date().toISOString(),
      reason,
    });
  }

  console.log("");
  for (const entry of proposed) {
    console.log(`  + ${entry.credit}  ${entry.wallet}  ${entry.week}  ${entry.reason}`);
    console.log(`      ${entry.sourceSig}`);
  }

  if (blocked.length > 0) {
    console.log("");
    console.log("  NEEDS A REASON — the memo format does not carry one:");
    for (const { memo, candidates, error } of blocked) {
      const why = error || (candidates.length === 0
        ? `no rule in the earn schedule pays ${memo.credit}`
        : `${candidates.length} rules pay ${memo.credit}: ${candidates.join(", ")}`);
      console.log(`    ${memo.signature}`);
      console.log(`      ${memo.credit} ${memo.wallet} ${memo.week} — ${why}`);
      console.log(`      --reason-for ${memo.signature}=<reason>`);
    }
  }

  if (!args.write) {
    console.log("");
    console.log("  NOTHING WRITTEN. Re-run with --write once the rows above are right.");
    console.log("");
    return;
  }

  if (blocked.length > 0) {
    fail("refusing to write a partial rebuild — resolve every reason above first");
  }

  let ledger = read.ledger;
  for (const entry of proposed) {
    const appended = ledgerLib.append(ledger, entry);
    if (!appended.ok) fail(`ledger would become invalid:\n  ${appended.errors.join("\n  ")}`);
    ledger = appended.ledger;
  }

  const verified = ledgerLib.verify(ledger);
  if (!verified.ok) fail(`rebuilt ledger does not verify:\n  ${verified.errors.join("\n  ")}`);

  ledgerLib.save(LEDGER_PATH, ledger);
  console.log("");
  console.log(`  WROTE ${proposed.length} entr${proposed.length === 1 ? "y" : "ies"}`);
  console.log(`  entries: ${verified.entryCount}   total: ${verified.total.credit}`);
  console.log("");
  console.log("  Now prove it against the chain: node scripts/reconcile.js");
  console.log("");
}

main().catch((error) => {
  console.error(`FAIL: ledger-rebuild crashed: ${error.message}`);
  process.exit(1);
});
