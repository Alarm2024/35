"use strict";

// Shared rule engine for gate.js and self-audit.js.
//
// Two gates, because one gate could not work:
//
//   preflight  — may we mint? Everything that must be true BEFORE a mint exists.
//                Empty mint/pool/position are expected here, not failures.
//   postflight — did we mint safely? Artifacts exist and the CHAIN agrees.
//                This is what must be CLEAN before any announcement.
//
// The old single gate required protocol.json.mint to be non-empty while RULES.md
// said mint may not happen until the gate passes, so it could never pass before a
// mint. An unsatisfiable rule is a rule that gets bypassed by hand.

const fs = require("fs");
const path = require("path");

const { isAddress } = require("./address");
const { toBaseUnits } = require("./amount");
const ledgerLib = require("./ledger");
const earnLib = require("./earn");

const ROOT = path.resolve(__dirname, "..", "..");

const PUBLIC_FIELDS = [
  "name",
  "symbol",
  "decimals",
  "issuanceMode",
  "jurisdiction",
  "mint",
  "squadsVault",
  "pool",
  "usdcMint",
];

const CONFIG_FIELDS = [
  "deskSigners",
  "controlledWallets",
  "position",
  "positionNftMint",
  "metadataUri",
  "rpcUrl",
  "memoProgram",
  "dammV2Program",
];

const DESK_PNL_FIELDS = ["realizedDeskPnl", "deskPnlReport", "realizedPnl"];
const NAV_FIELDS = ["nav", "navPerToken", "tokenNav"];

function createReporter() {
  const failures = [];
  return {
    failures,
    fail(reason) {
      failures.push(reason);
      console.error(`FAIL: ${reason}`);
    },
  };
}

function readJson(relativePath, report, root = ROOT) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    report.fail(`missing ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    report.fail(`invalid JSON in ${relativePath}: ${error.message}`);
    return null;
  }
}

function requireNonEmptyString(object, field, label, report) {
  if (!object || typeof object !== "object") return false;
  const value = object[field];
  if (typeof value !== "string" || value.trim() === "") {
    report.fail(`${label}.${field} is empty or unset`);
    return false;
  }
  return true;
}

function requireAddress(object, field, label, report) {
  if (!requireNonEmptyString(object, field, label, report)) return false;
  if (!isAddress(object[field])) {
    report.fail(`${label}.${field} is not a base58 Solana address: ${object[field]}`);
    return false;
  }
  return true;
}

function checkPublicProtocol(protocol, report, { requireMintArtifacts }) {
  if (!protocol) return;

  for (const field of PUBLIC_FIELDS) {
    if (!(field in protocol)) {
      report.fail(`protocol.json missing field: ${field}`);
    }
  }

  if (protocol.issuanceMode !== "earned") {
    report.fail("protocol.json issuanceMode must be earned");
  }

  requireNonEmptyString(protocol, "name", "protocol.json", report);
  requireNonEmptyString(protocol, "symbol", "protocol.json", report);
  requireNonEmptyString(protocol, "jurisdiction", "protocol.json", report);
  requireAddress(protocol, "squadsVault", "protocol.json", report);
  requireAddress(protocol, "usdcMint", "protocol.json", report);

  if (protocol.decimals !== 6) {
    report.fail("protocol.json decimals must be 6 (RULES.md: name 35, symbol 35, 6 decimals)");
  }

  if (requireMintArtifacts) {
    requireAddress(protocol, "mint", "protocol.json", report);
    requireAddress(protocol, "pool", "protocol.json", report);
  }
}

function checkOperatorConfig(configProtocol, report, { requireMintArtifacts }) {
  if (!configProtocol) return;

  for (const field of CONFIG_FIELDS) {
    if (!(field in configProtocol)) {
      report.fail(`config/protocol.json missing field: ${field}`);
    }
  }

  requireNonEmptyString(configProtocol, "rpcUrl", "config/protocol.json", report);
  requireNonEmptyString(configProtocol, "metadataUri", "config/protocol.json", report);
  requireAddress(configProtocol, "memoProgram", "config/protocol.json", report);
  requireAddress(configProtocol, "dammV2Program", "config/protocol.json", report);

  if (!Array.isArray(configProtocol.deskSigners) || configProtocol.deskSigners.length === 0) {
    report.fail("config/protocol.json deskSigners must be a non-empty array");
  } else {
    configProtocol.deskSigners.forEach((signer, index) => {
      if (!isAddress(signer)) {
        report.fail(`config/protocol.json deskSigners[${index}] is not a base58 Solana address`);
      }
    });
  }

  if (!Array.isArray(configProtocol.controlledWallets)) {
    report.fail("config/protocol.json controlledWallets must be an array");
  }

  if (requireMintArtifacts) {
    requireAddress(configProtocol, "position", "config/protocol.json", report);
    requireAddress(configProtocol, "positionNftMint", "config/protocol.json", report);
  }
}

// KILL_LIST 11 and 12: no bot hot key ever holds a privileged role, and a bot key
// is never the desk signer. controlledWallets is the bot/hot-key set.
function checkKeySeparation(protocol, configProtocol, report) {
  if (!configProtocol || !Array.isArray(configProtocol.controlledWallets)) return;

  const bots = new Set(configProtocol.controlledWallets.filter((wallet) => typeof wallet === "string"));
  if (bots.size === 0) return;

  const privileged = [
    ["protocol.json mint", protocol && protocol.mint],
    ["protocol.json pool", protocol && protocol.pool],
    ["protocol.json squadsVault", protocol && protocol.squadsVault],
    ["config/protocol.json position", configProtocol.position],
    ["config/protocol.json positionNftMint", configProtocol.positionNftMint],
  ];

  for (const [label, address] of privileged) {
    if (address && bots.has(address)) {
      report.fail(`${label} is a controlled bot wallet — KILL_LIST 11 forbids it holding a privileged role`);
    }
  }

  if (Array.isArray(configProtocol.deskSigners)) {
    for (const signer of configProtocol.deskSigners) {
      if (bots.has(signer)) {
        report.fail(`deskSigner ${signer} is a controlled bot wallet — KILL_LIST 12 forbids it`);
      }
    }
  }
}

// The supply cap is never invented. It is the ledger total (CONVERSION.md 1:1).
function checkLedgerAndEarn(report, root = ROOT) {
  const earnRead = earnLib.load(path.join(root, "config/earn.json"));
  if (!earnRead.ok) {
    report.fail(earnRead.error.replace(`${root}/`, ""));
  }

  const schedule = earnRead.schedule;
  if (schedule) {
    const verified = earnLib.verify(schedule);
    for (const error of verified.errors) {
      report.fail(`config/earn.json ${error}`);
    }

    const payable = Object.values(schedule.rules ?? {}).some((rule) => {
      try {
        return toBaseUnits(rule.credit) > 0n;
      } catch {
        return false;
      }
    });
    if (verified.ok && !payable) {
      report.fail("config/earn.json has no rule paying more than zero — the schedule is still a stub");
    }
  }

  const ledgerRead = ledgerLib.load(path.join(root, "config/ledger.json"));
  if (!ledgerRead.ok) {
    report.fail(ledgerRead.error.replace(`${root}/`, ""));
    return { total: null };
  }

  const verified = ledgerLib.verify(ledgerRead.ledger);
  for (const error of verified.errors) {
    report.fail(`config/ledger.json ${error}`);
  }

  if (!verified.ok) {
    return { total: null };
  }

  if (verified.entryCount === 0) {
    report.fail("config/ledger.json has no entries — supply cap would be zero, so there is nothing to mint");
    return { total: null };
  }

  // Every issued credit must trace to a published rule at the published rate.
  if (schedule && schedule.rules) {
    ledgerRead.ledger.entries.forEach((entry, index) => {
      const rule = earnLib.creditFor(schedule, entry.reason);
      if (!rule.ok) {
        report.fail(`config/ledger.json entries[${index}] ${rule.error}`);
        return;
      }
      if (rule.credit !== entry.credit) {
        report.fail(
          `config/ledger.json entries[${index}] credit ${entry.credit} does not match earn schedule rate ${rule.credit} for ${entry.reason}`
        );
      }
    });
  }

  return { total: verified.total };
}

// RULES.md: rent is paid from realized desk PnL. "Covers rent" is only a gate if
// the threshold is a number the machine can compare against.
function checkPnl(pnl, report) {
  if (!pnl) return;

  if (typeof pnl !== "object" || Array.isArray(pnl)) {
    report.fail("config/pnl.json must be an object");
    return;
  }

  for (const field of NAV_FIELDS) {
    if (field in pnl) {
      report.fail("config/pnl.json must use desk PnL report fields, not per-token NAV framing");
      break;
    }
  }

  const reportField = DESK_PNL_FIELDS.find((field) => field in pnl);
  if (!reportField) {
    report.fail(
      `config/pnl.json must include a desk PnL report field (${DESK_PNL_FIELDS.join(", ")})`
    );
    return;
  }

  const realized = Number(pnl[reportField]);
  const threshold = Number(pnl.rentThresholdSol);

  if (!Number.isFinite(threshold) || threshold <= 0) {
    report.fail(
      "config/pnl.json rentThresholdSol must be a positive number — an unquantified rent gate cannot be checked"
    );
    return;
  }

  if (!Number.isFinite(realized)) {
    report.fail(`config/pnl.json ${reportField} must be a number`);
    return;
  }

  if (realized < threshold) {
    report.fail(
      `realized desk PnL ${realized} does not cover rent threshold ${threshold} — RULES.md holds mint closed`
    );
  }
}

async function checkChain(protocol, configProtocol, expectedTotal, report, { rpcFactory }) {
  if (!protocol || !configProtocol || !configProtocol.rpcUrl) {
    report.fail("cannot run on-chain checks without config/protocol.json rpcUrl");
    return;
  }

  const rpc = require("./rpc");
  const call = (rpcFactory ?? rpc.rpcFactory)(configProtocol.rpcUrl);

  try {
    const mintState = await rpc.getMintState(call, protocol.mint);
    if (!mintState.ok) {
      report.fail(mintState.error);
    } else {
      // KILL_LIST 4: authorities must be null after mint, verified on chain.
      if (mintState.mintAuthority !== null) {
        report.fail(`on-chain mint authority is not null: ${mintState.mintAuthority} (KILL_LIST 4)`);
      }
      if (mintState.freezeAuthority !== null) {
        report.fail(`on-chain freeze authority is not null: ${mintState.freezeAuthority} (KILL_LIST 4)`);
      }
      if (mintState.decimals !== 6) {
        report.fail(`on-chain mint decimals is ${mintState.decimals}, expected 6`);
      }
      if (expectedTotal && String(mintState.supply) !== String(expectedTotal.units)) {
        report.fail(
          `on-chain supply ${mintState.supply} does not equal ledger total ${expectedTotal.units} (${expectedTotal.credit})`
        );
      }
    }

    const holder = await rpc.getNftHolder(call, configProtocol.positionNftMint);
    if (!holder.ok) {
      report.fail(holder.error);
    } else if (holder.owner !== protocol.squadsVault) {
      report.fail(
        `position NFT is held by ${holder.owner}, not the Squads vault ${protocol.squadsVault} (KILL_LIST 11)`
      );
    }

    const pool = await rpc.getAccountOwnerProgram(call, protocol.pool);
    if (!pool.ok) {
      report.fail(pool.error);
    } else if (pool.owner !== configProtocol.dammV2Program) {
      report.fail(
        `pool ${protocol.pool} is owned by program ${pool.owner}, not DAMM v2 ${configProtocol.dammV2Program}`
      );
    }
  } catch (error) {
    report.fail(`on-chain verification could not complete: ${error.message}`);
  }
}

async function run({ mode, offline = false, publicOnly = false, rpcFactory: injectedRpc, root = ROOT } = {}) {
  const report = createReporter();
  const requireMintArtifacts = mode === "postflight";

  const protocol = readJson("protocol.json", report, root);
  checkPublicProtocol(protocol, report, { requireMintArtifacts });

  if (publicOnly) {
    return { ok: report.failures.length === 0, failures: report.failures };
  }

  const configProtocol = readJson("config/protocol.json", report, root);
  const pnl = readJson("config/pnl.json", report, root);

  checkOperatorConfig(configProtocol, report, { requireMintArtifacts });
  checkKeySeparation(protocol, configProtocol, report);
  const { total } = checkLedgerAndEarn(report, root);
  checkPnl(pnl, report);

  if (requireMintArtifacts && !offline && report.failures.length === 0) {
    await checkChain(protocol, configProtocol, total, report, { rpcFactory: injectedRpc });
  } else if (requireMintArtifacts && !offline) {
    report.fail("skipping on-chain verification because local checks already failed");
  }

  return { ok: report.failures.length === 0, failures: report.failures, total };
}

module.exports = { ROOT, PUBLIC_FIELDS, CONFIG_FIELDS, run, readJson, createReporter };
