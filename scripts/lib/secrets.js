"use strict";

// Dependency-free signing-material scan.
//
// SECURITY.md says keys live outside the repo, but .gitignore is a net, not a
// control: an ignore rule does nothing if a key is force-added or pasted into a
// doc. This turns that policy into a check that CI and self-audit can run.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const SKIP_DIRS = new Set([".git", "node_modules", "_site"]);
const SKIP_FILES = new Set(["secrets.js", "secrets.test.js"]);
const BINARY_EXT = new Set([".jpeg", ".jpg", ".png", ".gif", ".webp", ".ico", ".pdf", ".woff", ".woff2"]);

const PATTERNS = [
  {
    name: "solana keypair byte array",
    // A 64-byte secret key serialized as JSON, the shape `solana-keygen` writes.
    test: (text) => /\[\s*(?:\d{1,3}\s*,\s*){63,}\d{1,3}\s*\]/.test(text),
  },
  {
    name: "PEM private key block",
    test: (text) => /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(text),
  },
  {
    name: "BIP39 seed phrase",
    // 12+ lowercase words on one line next to a seed/mnemonic label.
    test: (text) => /(?:seed|mnemonic|recovery)\s*(?:phrase)?\s*[:=]\s*(?:[a-z]+\s+){11,}[a-z]+/i.test(text),
  },
  {
    name: "populated KEYPAIR_PATH with inline key bytes",
    test: (text) => /KEYPAIR_PATH\s*=\s*\[/.test(text),
  },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), files);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;
      if (BINARY_EXT.has(path.extname(entry.name).toLowerCase())) continue;
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function scanRepo(root = ROOT) {
  const findings = [];

  for (const file of walk(root)) {
    const relative = path.relative(root, file);
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    for (const pattern of PATTERNS) {
      if (pattern.test(text)) {
        findings.push(`${relative} looks like it contains ${pattern.name} — see SECURITY.md, rotate and purge`);
      }
    }
  }

  return { ok: findings.length === 0, findings };
}

module.exports = { scanRepo, PATTERNS };
