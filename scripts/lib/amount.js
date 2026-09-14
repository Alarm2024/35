"use strict";

// Fixed-point helpers for 35 credits.
// Credits are decimal strings with at most 6 fractional digits (see RULES.md).
// All arithmetic runs in integer base units so no float ever touches a supply number.

const DECIMALS = 6;

function toBaseUnits(credit, decimals = DECIMALS) {
  if (typeof credit !== "string" || !/^\d+(\.\d+)?$/.test(credit)) {
    throw new TypeError(`credit must be a non-negative decimal string, got ${JSON.stringify(credit)}`);
  }

  const [whole, fraction = ""] = credit.split(".");
  if (fraction.length > decimals) {
    throw new RangeError(`credit has more than ${decimals} fractional digits: ${credit}`);
  }

  return BigInt(whole + fraction.padEnd(decimals, "0"));
}

function fromBaseUnits(units, decimals = DECIMALS) {
  const value = BigInt(units);
  if (value < 0n) {
    throw new RangeError("base units must be non-negative");
  }

  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0");
  return `${whole}.${fraction}`;
}

function sumCredits(credits, decimals = DECIMALS) {
  const total = credits.reduce((acc, credit) => acc + toBaseUnits(credit, decimals), 0n);
  return { units: total, credit: fromBaseUnits(total, decimals) };
}

module.exports = { DECIMALS, toBaseUnits, fromBaseUnits, sumCredits };
