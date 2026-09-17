"use strict";

// Base58 (Bitcoin alphabet), encode and decode.
//
// Dependency-free like the rest of scripts/lib: this repo is a public record of
// a closed desk, and a signing path should not pull a package tree nobody in
// the audit can read. The algorithm is the plain big-integer-in-base-256 to
// base-58 conversion, with leading zero bytes mapped to leading '1's.

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

function encode(bytes) {
  const input = Buffer.from(bytes);
  if (input.length === 0) return "";

  let zeros = 0;
  while (zeros < input.length && input[zeros] === 0) zeros += 1;

  // Repeated division of the whole number by 58, most significant digit last.
  const digits = [0];
  for (let i = zeros; i < input.length; i += 1) {
    let carry = input[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  // digits is little-endian, so its tail holds the LEADING output digits. The
  // seed value 0 survives there when the input is all zeros, which would print
  // one '1' too many — the System Program id is 32 characters, not 33.
  let top = digits.length - 1;
  while (top > 0 && digits[top] === 0) top -= 1;
  if (digits[top] === 0) top = -1;

  let out = "1".repeat(zeros);
  for (let i = top; i >= 0; i -= 1) out += ALPHABET[digits[i]];
  return out;
}

function decode(text) {
  if (typeof text !== "string") {
    return { ok: false, error: "base58 input is not a string" };
  }
  if (text.length === 0) return { ok: true, bytes: Buffer.alloc(0) };

  let zeros = 0;
  while (zeros < text.length && text[zeros] === "1") zeros += 1;

  const bytes = [0];
  for (let i = zeros; i < text.length; i += 1) {
    const value = INDEX.get(text[i]);
    if (value === undefined) {
      return { ok: false, error: `not base58: ${JSON.stringify(text[i])} at index ${i}` };
    }
    let carry = value;
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Same off-by-one as encode, mirrored: `bytes` is seeded with 0 and is
  // little-endian, so a leading '1'-only string would decode one byte too long.
  let top = bytes.length - 1;
  while (top > 0 && bytes[top] === 0) top -= 1;
  const body = bytes[top] === 0 ? [] : bytes.slice(0, top + 1).reverse();

  return { ok: true, bytes: Buffer.concat([Buffer.alloc(zeros), Buffer.from(body)]) };
}

module.exports = { ALPHABET, encode, decode };
