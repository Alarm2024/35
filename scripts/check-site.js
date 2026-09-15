#!/usr/bin/env node
"use strict";

// Does the published site actually ship everything the page asks for?
//
//   node scripts/check-site.js
//
// metadata.json existed in the repo while pages.yml never copied it, so the URL
// the mint would have pointed at was a 404. Nothing caught that: the file was
// valid, the page was valid, only the deploy list was wrong. This checks the
// join between them.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const failures = [];

function fail(reason) {
  failures.push(reason);
  console.error(`FAIL: ${reason}`);
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/pages.yml"), "utf8");

// Local assets the page depends on: not external, not mail, not in-page.
const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((ref) => !/^(https?:|mailto:|#|\/$)/.test(ref))
  .map((ref) => ref.replace(/^\//, ""))
  .filter((ref) => ref !== "");

const unique = [...new Set(references)];

for (const ref of unique) {
  if (!fs.existsSync(path.join(ROOT, ref))) {
    fail(`index.html references ${ref}, which does not exist in the repo`);
    continue;
  }
  if (!workflow.includes(ref)) {
    fail(`index.html references ${ref}, but .github/workflows/pages.yml never copies it — it would 404`);
  }
}

// The page fetches these at runtime rather than linking them, so the regex above
// cannot see them. They still have to ship.
for (const runtimeFetch of ["protocol.json", "metadata.json"]) {
  if (!fs.existsSync(path.join(ROOT, runtimeFetch))) {
    fail(`${runtimeFetch} is missing from the repo`);
    continue;
  }
  if (!workflow.includes(runtimeFetch)) {
    fail(`${runtimeFetch} is not copied by .github/workflows/pages.yml — it would 404`);
  }
}

// metadata.json describes a token that does not exist yet. It must not imply one.
try {
  const metadata = JSON.parse(fs.readFileSync(path.join(ROOT, "metadata.json"), "utf8"));
  for (const forbidden of ["mint", "address", "mintAddress", "contract"]) {
    if (forbidden in metadata) {
      fail(`metadata.json carries a ${forbidden} field — no mint exists, so it must not name one`);
    }
  }
  for (const required of ["name", "symbol", "description"]) {
    if (typeof metadata[required] !== "string" || metadata[required].trim() === "") {
      fail(`metadata.json ${required} is empty or unset`);
    }
  }
} catch (error) {
  fail(`metadata.json is not valid JSON: ${error.message}`);
}

// The public record must not advertise a mint or pool before one is audited.
try {
  const protocol = JSON.parse(fs.readFileSync(path.join(ROOT, "protocol.json"), "utf8"));
  for (const field of ["mint", "pool"]) {
    const value = protocol[field];
    if (typeof value === "string" && value.trim() !== "" && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
      fail(`protocol.json ${field} is set but is not a base58 address: ${value}`);
    }
  }
} catch (error) {
  fail(`protocol.json is not valid JSON: ${error.message}`);
}

if (failures.length > 0) {
  console.error("SITE: broken");
  process.exit(1);
}

console.log(`checked ${unique.length} linked asset(s) plus protocol.json and metadata.json`);
console.log("SITE: ok");
process.exit(0);
