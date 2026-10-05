"use strict";

// The credit ledger is the only place a supply number may come from.
//
// CONVERSION.md: 1 credit = 1 unit of 35 at 6 decimals. Therefore the supply cap
// at mint is not a number anyone invents — it is the sum of issued credits in
// this ledger at the snapshot block. Build it before mint day, not on it.

const fs = require("fs");
const path = require("path");

const { parseMemo, PREFIX } = require("./memo");
const { isAddress } = require("./address");
const { DECIMALS, sumCredits, toBaseUnits, fromBaseUnits } = require("./amount");

const LEDGER_VERSION = 1;

function emptyLedger() {
  return { version: LEDGER_VERSION, decimals: DECIMALS, entries: [] };
}

function memoFor(entry) {
  return `${PREFIX}${entry.wallet}:${entry.credit}:${entry.week}`;
}

/**
 * The per-entry memo checks the ledger applies: the memo round-trips through
 * the memo format, the credit is already normalized, and the wallet is a real
 * base58 Solana address. Returns { fatal } when the memo cannot be read at all.
 */
function checkMemoFields(fields) {
  const parsed = parseMemo(memoFor(fields));
  if (!parsed.ok) {
    return { fatal: `does not round-trip through the memo format: ${parsed.error}`, errors: [] };
  }
  const errors = [];
  if (parsed.credit !== fields.credit) {
    errors.push(`credit is not normalized: ${fields.credit}`);
  }
  if (!isAddress(fields.wallet)) {
    errors.push(`wallet is not a base58 Solana address: ${fields.wallet}`);
  }
  return { fatal: null, errors };
}

function load(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) {
    return { ok: false, error: `missing ${ledgerPath}`, ledger: null };
  }
  try {
    return { ok: true, ledger: JSON.parse(fs.readFileSync(ledgerPath, "utf8")) };
  } catch (error) {
    return { ok: false, error: `invalid JSON in ${ledgerPath}: ${error.message}`, ledger: null };
  }
}

// Full-ledger integrity pass. Every rule in RULES.md "Issuance" is checked here
// so that gate.js and reconcile.js cannot disagree about what a valid ledger is.
function verify(ledger) {
  const errors = [];

  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) {
    return { ok: false, errors: ["ledger must be an object"], total: null, byWeek: null };
  }

  if (ledger.version !== LEDGER_VERSION) {
    errors.push(`ledger version must be ${LEDGER_VERSION}, got ${JSON.stringify(ledger.version)}`);
  }

  if (ledger.decimals !== DECIMALS) {
    errors.push(`ledger decimals must be ${DECIMALS}, got ${JSON.stringify(ledger.decimals)}`);
  }

  if (!Array.isArray(ledger.entries)) {
    return { ok: false, errors: errors.concat("ledger entries must be an array"), total: null, byWeek: null };
  }

  const seenSigs = new Set();
  const byWeek = new Map();
  const credits = [];

  ledger.entries.forEach((entry, index) => {
    const at = `entries[${index}]`;

    if (!entry || typeof entry !== "object") {
      errors.push(`${at} must be an object`);
      return;
    }

    for (const field of ["wallet", "credit", "week", "sourceSig", "issuedAt", "reason"]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        errors.push(`${at}.${field} is empty or unset`);
        return;
      }
    }

    // The memo is the on-chain artifact; rebuild and re-parse it so the ledger
    // can never drift from what a desk signer actually landed. land-memo.js runs
    // the same check before it signs, so nothing lands that this would reject.
    const memoErrors = checkMemoFields(entry);
    if (memoErrors.fatal) {
      errors.push(`${at} ${memoErrors.fatal}`);
      return;
    }
    for (const e of memoErrors.errors) errors.push(`${at}.${e}`);

    // RULES.md: the same sourceSig cannot appear in two weeks. Global uniqueness
    // is the stricter form and implies it.
    if (seenSigs.has(entry.sourceSig)) {
      errors.push(`${at}.sourceSig is a duplicate: ${entry.sourceSig}`);
    }
    seenSigs.add(entry.sourceSig);

    if (Number.isNaN(Date.parse(entry.issuedAt))) {
      errors.push(`${at}.issuedAt is not an ISO timestamp: ${entry.issuedAt}`);
    }

    credits.push(entry.credit);
    byWeek.set(entry.week, (byWeek.get(entry.week) ?? 0n) + toBaseUnits(entry.credit));
  });

  if (errors.length > 0) {
    return { ok: false, errors, total: null, byWeek: null };
  }

  const total = sumCredits(credits);
  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([week, units]) => ({ week, credit: fromBaseUnits(units) }));

  return { ok: true, errors: [], total, byWeek: weeks, entryCount: ledger.entries.length, sigs: seenSigs };
}

function append(ledger, entry) {
  const next = { ...ledger, entries: ledger.entries.concat([entry]) };
  const check = verify(next);
  if (!check.ok) {
    return { ok: false, errors: check.errors, ledger: null };
  }
  return { ok: true, errors: [], ledger: next, total: check.total };
}

function save(ledgerPath, ledger) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
}

module.exports = { LEDGER_VERSION, emptyLedger, memoFor, load, verify, append, save,
  checkMemoFields,
};
