"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { scanRepo } = require("../lib/secrets");

function tmpTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "secret-scan-"));
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), body);
  }
  return root;
}

test("the repo itself contains no signing material", () => {
  assert.equal(scanRepo().ok, true);
});

test("detects a solana keypair byte array", () => {
  const bytes = JSON.stringify(Array.from({ length: 64 }, (_, i) => i % 256));
  const result = scanRepo(tmpTree({ "config/leak.json": bytes }));
  assert.equal(result.ok, false);
  assert.match(result.findings[0], /keypair byte array/);
});

test("detects a PEM private key", () => {
  const result = scanRepo(tmpTree({ "notes.md": "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----" }));
  assert.equal(result.ok, false);
  assert.match(result.findings[0], /PEM private key/);
});

test("detects a pasted seed phrase", () => {
  const words = "abandon ability able about above absent absorb abstract absurd abuse access accident";
  const result = scanRepo(tmpTree({ "doc.md": `seed phrase: ${words}` }));
  assert.equal(result.ok, false);
  assert.match(result.findings[0], /seed phrase/i);
});

test("does not flag a KEYPAIR_PATH that is only a path", () => {
  const result = scanRepo(tmpTree({ ".env.example": "KEYPAIR_PATH=/home/op/.config/solana/35/deskSigner.json" }));
  assert.equal(result.ok, true);
});

test("flags KEYPAIR_PATH holding inline key bytes", () => {
  const result = scanRepo(tmpTree({ ".env": "KEYPAIR_PATH=[1,2,3]" }));
  assert.equal(result.ok, false);
});
