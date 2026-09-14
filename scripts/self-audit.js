#!/usr/bin/env node
"use strict";

// Announcement gate. KILL_LIST 10: never announce a mint address this has not
// marked CLEAN. This runs the full postflight gate, including on-chain checks,
// then scans the repo for signing material before clearing an announcement.

const { run } = require("./lib/checks");
const { scanRepo } = require("./lib/secrets");

async function main() {
  const offline = process.argv.includes("--offline");
  const result = await run({ mode: "postflight", offline });

  const failures = result.failures.slice();

  const secrets = scanRepo();
  for (const finding of secrets.findings) {
    console.error(`FAIL: ${finding}`);
    failures.push(finding);
  }

  if (failures.length > 0) {
    console.error("CLEAN: no");
    process.exit(1);
  }

  if (offline) {
    console.error("FAIL: refusing to print CLEAN with --offline; on-chain state was never verified");
    console.error("CLEAN: no");
    process.exit(1);
  }

  console.log(`supply: ${result.total.credit} (ledger total, matched on chain)`);
  console.log("CLEAN: yes");
  process.exit(0);
}

main().catch((error) => {
  console.error(`FAIL: self-audit crashed: ${error.message}`);
  console.error("CLEAN: no");
  process.exit(1);
});
