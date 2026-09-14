"use strict";

// Shape-only validation for Solana addresses. This does not prove an account
// exists on chain — postflight RPC checks do that. It exists to stop typos and
// placeholder strings from reaching a mint transaction.

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isAddress(value) {
  return typeof value === "string" && BASE58.test(value);
}

function assertAddress(value, label) {
  if (!isAddress(value)) {
    return { ok: false, error: `${label} is not a base58 Solana address: ${JSON.stringify(value)}` };
  }
  return { ok: true };
}

module.exports = { BASE58, isAddress, assertAddress };
