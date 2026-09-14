#!/usr/bin/env node
"use strict";

// Usage:
//   node scripts/gate.js --preflight     may we mint? (run this BEFORE minting)
//   node scripts/gate.js --postflight    did we mint safely? (default, strictest)
//   node scripts/gate.js --public-only   public protocol.json fields only (CI)
//   node scripts/gate.js --offline       skip RPC calls in postflight
//
// Fail closed in every mode. Default stays postflight so a bare `gate.js` on an
// unconfigured desk still refuses.

const { run } = require("./lib/checks");

const USAGE = `usage: gate.js [--preflight|--postflight|--public-only] [--offline]`;

function parseArgs(argv) {
  const flags = new Set(argv);
  const unknown = argv.filter(
    (arg) => !["--preflight", "--postflight", "--public-only", "--offline", "--help", "-h"].includes(arg)
  );

  if (unknown.length > 0) {
    return { error: `unknown argument: ${unknown[0]}` };
  }

  if (flags.has("--help") || flags.has("-h")) {
    return { help: true };
  }

  if (flags.has("--preflight") && flags.has("--postflight")) {
    return { error: "--preflight and --postflight are mutually exclusive" };
  }

  return {
    mode: flags.has("--preflight") ? "preflight" : "postflight",
    publicOnly: flags.has("--public-only"),
    offline: flags.has("--offline"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

  if (args.error) {
    console.error(`FAIL: ${args.error}`);
    console.error(USAGE);
    process.exit(1);
  }

  const result = await run(args);

  if (!result.ok) {
    process.exit(1);
  }

  // public-only mode never reads the ledger, so there is no total to report.
  if (args.mode === "preflight" && result.total) {
    console.log(`supply cap at mint would be ${result.total.credit} (ledger total, not invented)`);
  }

  console.log("PASS");
  process.exit(0);
}

main().catch((error) => {
  console.error(`FAIL: gate crashed: ${error.message}`);
  process.exit(1);
});
