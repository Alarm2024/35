"use strict";

const PREFIX = "35-credit:";
const MAX_FRACTION_DIGITS = 6;

function parseMemo(text) {
  if (typeof text !== "string") {
    return { ok: false, error: "memo must be a string" };
  }
  const raw = text.trim();
  if (!raw.startsWith(PREFIX)) {
    return { ok: false, error: "memo must start with 35-credit:" };
  }
  const rest = raw.slice(PREFIX.length);
  const parts = rest.split(":");
  if (parts.length !== 3) {
    return { ok: false, error: "memo must be 35-credit:<wallet>:<credit>:<week>" };
  }
  const [wallet, credit, week] = parts;
  if (!wallet) return { ok: false, error: "wallet empty" };
  if (!week) return { ok: false, error: "week empty" };
  const creditCheck = validateCredit(credit);
  if (!creditCheck.ok) return creditCheck;
  return { ok: true, wallet, credit: creditCheck.normalized, week };
}

function validateCredit(credit) {
  if (typeof credit !== "string" || credit.trim() === "") {
    return { ok: false, error: "credit empty" };
  }
  if (!/^\d+(\.\d+)?$/.test(credit)) {
    return { ok: false, error: "credit must be a non-negative decimal string" };
  }
  const frac = credit.includes(".") ? credit.split(".")[1] : "";
  if (frac.length > MAX_FRACTION_DIGITS) {
    return { ok: false, error: "credit has more than 6 fractional digits" };
  }
  return { ok: true, normalized: credit };
}

function assertUniqueSourceSig(seen, sourceSig) {
  if (typeof sourceSig !== "string" || sourceSig.trim() === "") {
    return { ok: false, error: "sourceSig empty" };
  }
  if (seen.has(sourceSig)) {
    return { ok: false, error: "duplicate sourceSig" };
  }
  seen.add(sourceSig);
  return { ok: true };
}

module.exports = {
  PREFIX,
  MAX_FRACTION_DIGITS,
  parseMemo,
  validateCredit,
  assertUniqueSourceSig,
};
