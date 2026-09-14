#!/usr/bin/env node
"use strict";

const { scanRepo } = require("./lib/secrets");

const result = scanRepo();

for (const finding of result.findings) {
  console.error(`FAIL: ${finding}`);
}

if (!result.ok) {
  console.error("SECRETS: found");
  process.exit(1);
}

console.log("SECRETS: none");
process.exit(0);
