"use strict";

const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");

const base58 = require("../lib/base58");
const tx = require("../lib/tx");

// ── base58 ────────────────────────────────────────────────────────────────

test("base58 round-trips real Solana addresses", () => {
  const known = [
    "11111111111111111111111111111111", // system program — all zero bytes
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "So11111111111111111111111111111111111111112",
    "3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo",
  ];
  for (const address of known) {
    const decoded = base58.decode(address);
    assert.equal(decoded.ok, true, address);
    assert.equal(decoded.bytes.length, 32, `${address} decodes to 32 bytes`);
    assert.equal(base58.encode(decoded.bytes), address);
  }
});

// Both directions had an off-by-one on all-zero input: the accumulator is
// seeded with 0, which prints as a leading '1' that does not belong. The
// System Program id is the vector that catches it — 32 characters, not 33.
test("base58 does not add a digit for all-zero input", () => {
  assert.equal(base58.encode(Buffer.alloc(32)), "1".repeat(32));
  assert.equal(base58.decode("1".repeat(32)).bytes.length, 32);
  assert.equal(base58.encode(Buffer.alloc(0)), "");
  assert.equal(base58.encode(Buffer.from([0])), "1");
  assert.equal(base58.encode(Buffer.from([0, 0, 1])), "112");
});

test("base58 survives a leading-zero sweep and random payloads", () => {
  for (let zeros = 0; zeros <= 34; zeros += 1) {
    const bytes = Buffer.concat([Buffer.alloc(zeros), Buffer.from([7])]);
    assert.ok(base58.decode(base58.encode(bytes)).bytes.equals(bytes), `zeros=${zeros}`);
  }
  for (let i = 0; i < 500; i += 1) {
    const bytes = crypto.randomBytes(1 + (i % 40));
    assert.ok(base58.decode(base58.encode(bytes)).bytes.equals(bytes));
  }
});

test("base58 refuses characters outside the alphabet", () => {
  for (const bad of ["hello0world", "abcOdef", "I", "l", "+/="]) {
    assert.equal(base58.decode(bad).ok, false, bad);
  }
});

// ── compact-u16 ───────────────────────────────────────────────────────────

test("compact-u16 matches the shortvec encoding", () => {
  const cases = [
    [0, "00"],
    [1, "01"],
    [127, "7f"],
    [128, "8001"],
    [255, "ff01"],
    [16384, "808001"],
    [65535, "ffff03"],
  ];
  for (const [value, hex] of cases) {
    assert.equal(tx.encodeCompactU16(value).toString("hex"), hex, `${value}`);
  }
  assert.throws(() => tx.encodeCompactU16(65536));
  assert.throws(() => tx.encodeCompactU16(-1));
});

// ── the golden vector ─────────────────────────────────────────────────────
//
// Produced by solana-sdk 2.3.1, not by this file: a throwaway Rust test built
// the same memo transaction with `Transaction::new_signed_with_payer` and
// printed its bincode bytes. If the serializer here drifts, these fail — which
// is the point, since this repo cannot reach a cluster to find out the other
// way.
const SEED = Buffer.alloc(32, 7);
const ORACLE_ADDRESS = "GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB";
const ORACLE_BLOCKHASH = "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi";
const ORACLE_MEMO = "35-credit:3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo:1.000000:2026-W38";
const ORACLE_SIGNATURE =
  "GgpXkKpe8kcTBfJNMX3ZyPbh7W6RvzQZ3uaLoyU6L6G3WHSDc4yPjjkU4GRgbTuGjqLPwdG5tcm5xNjZ8GdDSAu";
const ORACLE_MESSAGE_HEX =
  "01000102ea4a6c63e29c520abef5507b132ec5f9954776aebebe7b92421eea691446d22c" +
  "054a535a992921064d24e87160da387c7c35b5ddbc92bb81e41fa8404105448d01010101" +
  "010101010101010101010101010101010101010101010101010101010101004833352d63" +
  "72656469743a33425a474e74723741513563365266376e5568756e6676716f6f51417462" +
  "354561656b394877316e70624c6f3a312e3030303030303a323032362d573338";

function oracleKeypairFile() {
  const secret = crypto.createPrivateKey({
    key: Buffer.concat([tx.PKCS8_ED25519_PREFIX, SEED]),
    format: "der",
    type: "pkcs8",
  });
  const spki = crypto.createPublicKey(secret).export({ format: "der", type: "spki" });
  const pub = Buffer.from(spki.subarray(spki.length - 32));
  return JSON.stringify([...SEED, ...pub]);
}

test("a keypair file yields the address solana-sdk derives from the same seed", () => {
  const loaded = tx.keypairFromFileBytes(oracleKeypairFile());
  assert.equal(loaded.ok, true, loaded.error);
  assert.equal(loaded.address, ORACLE_ADDRESS);
});

test("the serialized message is byte-identical to solana-sdk", () => {
  const built = tx.buildMemoMessage({
    payer: ORACLE_ADDRESS,
    memoProgram: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    recentBlockhash: ORACLE_BLOCKHASH,
    memo: ORACLE_MEMO,
  });
  assert.equal(built.ok, true, built.error);
  assert.equal(built.message.toString("hex"), ORACLE_MESSAGE_HEX);
});

test("the signature and wire transaction are byte-identical to solana-sdk", () => {
  const loaded = tx.keypairFromFileBytes(oracleKeypairFile());
  const built = tx.buildMemoMessage({
    payer: ORACLE_ADDRESS,
    memoProgram: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    recentBlockhash: ORACLE_BLOCKHASH,
    memo: ORACLE_MEMO,
  });
  const signed = tx.signMessage(built.message, loaded.secret);
  assert.equal(signed.signature, ORACLE_SIGNATURE);
  // The wire form is compact-u16(1) + 64-byte signature + message.
  assert.equal(signed.wire.length, 1 + 64 + built.message.length);
  assert.equal(signed.wire.subarray(65).toString("hex"), ORACLE_MESSAGE_HEX);
});

test("the signature verifies against the public key", () => {
  const loaded = tx.keypairFromFileBytes(oracleKeypairFile());
  const built = tx.buildMemoMessage({
    payer: ORACLE_ADDRESS,
    memoProgram: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    recentBlockhash: ORACLE_BLOCKHASH,
    memo: ORACLE_MEMO,
  });
  const signed = tx.signMessage(built.message, loaded.secret);
  const spki = crypto.createPublicKey(loaded.secret);
  assert.equal(crypto.verify(null, built.message, spki, signed.wire.subarray(1, 65)), true);
  // A message that differs by one byte must not verify.
  const tampered = Buffer.from(built.message);
  tampered[tampered.length - 1] ^= 0x01;
  assert.equal(crypto.verify(null, tampered, spki, signed.wire.subarray(1, 65)), false);
});

// ── refusals ──────────────────────────────────────────────────────────────

test("a keypair file whose public half does not match its secret half is refused", () => {
  const good = JSON.parse(oracleKeypairFile());
  const forged = [...good];
  forged[63] ^= 0x01;
  const loaded = tx.keypairFromFileBytes(JSON.stringify(forged));
  assert.equal(loaded.ok, false);
  assert.match(loaded.error, /public half/);
});

test("a malformed keypair file is refused rather than guessed at", () => {
  assert.match(tx.keypairFromFileBytes("not json").error, /not JSON/);
  assert.match(tx.keypairFromFileBytes("[1,2,3]").error, /64 bytes/);
  assert.match(tx.keypairFromFileBytes(JSON.stringify(new Array(64).fill(999))).error, /not a byte/);
  assert.match(tx.keypairFromFileBytes(JSON.stringify({ a: 1 })).error, /64 bytes/);
});

test("a key that is not 32 bytes is refused before anything is signed", () => {
  const short = tx.buildMemoMessage({
    payer: "1111", // valid base58, wrong length
    memoProgram: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    recentBlockhash: ORACLE_BLOCKHASH,
    memo: ORACLE_MEMO,
  });
  assert.equal(short.ok, false);
  assert.match(short.error, /expected 32/);
});

test("the land script never prints the key and refuses an unparseable memo", () => {
  const source = require("fs").readFileSync(require("path").join(__dirname, "../land-memo.js"), "utf8");
  // The secret is a KeyObject and is never stringified, and the path is never
  // echoed — an error there would put the operator's directory layout on a
  // screenshot.
  assert.equal(/console\.log\([^)]*keypair\.secret/.test(source), false);
  assert.equal(/console\.log\([^)]*keypairPath/.test(source), false);
  assert.equal(/console\.error\([^)]*keypairPath/.test(source), false);
  // Sending must be opt-in: the default path returns before sendTransaction.
  assert.ok(source.includes("if (!args.send)"));
  assert.ok(source.includes("parseMemo"));
  // The signer has to be allowlisted, or reconcile.js will never see the memo.
  assert.ok(source.includes("deskSigners"));
});
