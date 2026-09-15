"use strict";

// A local note of the last successful reconcile.
//
// doctor is offline and cannot know whether the ledger matches chain, so
// without this it must warn every time — including right after a clean
// reconcile, which trains the operator to ignore the warning.
//
// The receipt is a convenience, never evidence. It is gitignored, it proves
// nothing to anyone else, and nothing that gates the mint reads it:
// self-audit.js goes to the chain every time. If the ledger changes after a
// reconcile, the fingerprint stops matching and the warning comes back.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const RECEIPT_FILE = "config/reconciled.json";

// Fingerprint the facts reconcile actually checked, in a fixed order so the
// same ledger always hashes the same way.
function fingerprint(ledger) {
  const canonical = (ledger.entries ?? [])
    .map((entry) => [entry.sourceSig, entry.wallet, entry.credit, entry.week].join("|"))
    .sort()
    .join("\n");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function write(root, ledger, total) {
  const receipt = {
    at: new Date().toISOString(),
    entryCount: (ledger.entries ?? []).length,
    total,
    fingerprint: fingerprint(ledger),
    note: "Written by scripts/reconcile.js. Local convenience only — not evidence. self-audit.js always re-checks the chain.",
  };
  fs.writeFileSync(path.join(root, RECEIPT_FILE), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

// Returns the receipt only when it still describes this exact ledger.
function readIfCurrent(root, ledger) {
  const file = path.join(root, RECEIPT_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    const receipt = JSON.parse(fs.readFileSync(file, "utf8"));
    return receipt.fingerprint === fingerprint(ledger) ? receipt : null;
  } catch {
    return null;
  }
}

module.exports = { RECEIPT_FILE, fingerprint, write, readIfCurrent };
