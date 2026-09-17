"use strict";

// Build and sign a memo-only Solana transaction, with no dependencies.
//
// The desk could preview a memo, record one, and reconcile one — but not LAND
// one, which is the single step that makes a credit real. `issue-credit.js`
// said "land that exact string as an SPL Memo instruction" and stopped, because
// an earlier version of this repo printed a `solana transfer --with-memo`
// command that was never verified against a real CLI. Printing a command that
// does not work is worse than printing none; so is printing none at all when
// the operator is on a phone.
//
// Everything here is the legacy (v0-prefixed-free) wire format, written out by
// hand. The byte layout is pinned by golden vectors in scripts/test, generated
// from solana-sdk 2.3.1 rather than from this file, so a mistake here shows up
// as a test failure rather than as a transaction the cluster rejects.

const crypto = require("node:crypto");
const base58 = require("./base58");

// An Ed25519 seed becomes a PKCS#8 key by prefixing this fixed DER header.
// node:crypto has no raw-seed import, and this is the whole of the difference.
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

const SIGNATURE_LEN = 64;
const PUBKEY_LEN = 32;

// Solana's compact-u16: 7 bits per byte, low bits first, high bit continues.
function encodeCompactU16(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error(`compact-u16 out of range: ${value}`);
  }
  const out = [];
  let rest = value;
  for (;;) {
    if (rest < 0x80) {
      out.push(rest);
      break;
    }
    out.push((rest & 0x7f) | 0x80);
    rest >>= 7;
  }
  return Buffer.from(out);
}

/// Read a solana-cli keypair file: a JSON array of 64 bytes, seed then pubkey.
function keypairFromFileBytes(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, error: `keypair file is not JSON: ${error.message}` };
  }
  if (!Array.isArray(parsed) || parsed.length !== 64) {
    return {
      ok: false,
      error: `keypair file must be a JSON array of 64 bytes, got ${
        Array.isArray(parsed) ? `${parsed.length} entries` : typeof parsed
      }`,
    };
  }
  if (!parsed.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    return { ok: false, error: "keypair file contains a value that is not a byte" };
  }

  const bytes = Buffer.from(parsed);
  const seed = bytes.subarray(0, 32);
  const claimed = bytes.subarray(32);

  const secret = crypto.createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
  const spki = crypto.createPublicKey(secret).export({ format: "der", type: "spki" });
  const derived = Buffer.from(spki.subarray(spki.length - PUBKEY_LEN));

  // The stored half is not trusted: a file whose tail does not match the seed
  // would sign correctly and be attributed to the wrong address, which is the
  // one error that cannot be found by reading the ledger afterwards.
  if (!derived.equals(claimed)) {
    return {
      ok: false,
      error: "keypair file is inconsistent: its public half is not the public key of its secret half",
    };
  }

  return { ok: true, secret, publicKey: derived, address: base58.encode(derived) };
}

/// Serialize the message of a memo-only transaction.
///
/// Accounts are exactly [fee payer, memo program]: the memo carries no signer
/// accounts of its own, matching `spl_memo::build_memo(memo, &[])`. The payer
/// is the only signature, and the memo program is read-only and unsigned.
function buildMemoMessage({ payer, memoProgram, recentBlockhash, memo }) {
  const payerKey = base58.decode(payer);
  if (!payerKey.ok) return { ok: false, error: `payer: ${payerKey.error}` };
  const programKey = base58.decode(memoProgram);
  if (!programKey.ok) return { ok: false, error: `memoProgram: ${programKey.error}` };
  const blockhash = base58.decode(recentBlockhash);
  if (!blockhash.ok) return { ok: false, error: `recentBlockhash: ${blockhash.error}` };

  for (const [label, key] of [
    ["payer", payerKey.bytes],
    ["memoProgram", programKey.bytes],
    ["recentBlockhash", blockhash.bytes],
  ]) {
    if (key.length !== PUBKEY_LEN) {
      return { ok: false, error: `${label} decodes to ${key.length} bytes, expected ${PUBKEY_LEN}` };
    }
  }

  const data = Buffer.from(memo, "utf8");

  const message = Buffer.concat([
    // header: 1 required signature, 0 readonly signed, 1 readonly unsigned
    Buffer.from([1, 0, 1]),
    encodeCompactU16(2),
    payerKey.bytes,
    programKey.bytes,
    blockhash.bytes,
    encodeCompactU16(1),
    Buffer.from([1]), // programIdIndex -> the memo program
    encodeCompactU16(0), // no instruction accounts
    encodeCompactU16(data.length),
    data,
  ]);

  return { ok: true, message };
}

/// Sign a serialized message and return the base64 wire transaction.
function signMessage(message, secret) {
  const signature = crypto.sign(null, message, secret);
  if (signature.length !== SIGNATURE_LEN) {
    throw new Error(`ed25519 signature is ${signature.length} bytes, expected ${SIGNATURE_LEN}`);
  }
  const wire = Buffer.concat([encodeCompactU16(1), signature, message]);
  return { signature: base58.encode(signature), wire, base64: wire.toString("base64") };
}

module.exports = {
  PKCS8_ED25519_PREFIX,
  SIGNATURE_LEN,
  PUBKEY_LEN,
  encodeCompactU16,
  keypairFromFileBytes,
  buildMemoMessage,
  signMessage,
};
