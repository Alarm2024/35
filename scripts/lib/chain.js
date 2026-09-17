"use strict";

// Read credit memos that desk signers actually landed.
//
// Extracted from reconcile.js so that reconcile and ledger-rebuild read the
// chain through the same code. Two readers that drift are worse than one
// reader that is wrong, because the disagreement is the thing nobody notices.

const { parseMemo } = require("./memo");

// spl-memo instructions come back from jsonParsed as
// { program: "spl-memo", parsed: "<text>" }.
function memosFrom(transaction) {
  const message = transaction && transaction.transaction && transaction.transaction.message;
  const instructions = (message && message.instructions) || [];
  const inner = ((transaction && transaction.meta && transaction.meta.innerInstructions) || []).flatMap(
    (group) => group.instructions || []
  );

  return instructions
    .concat(inner)
    .filter((instruction) => instruction.program === "spl-memo" && typeof instruction.parsed === "string")
    .map((instruction) => instruction.parsed);
}

/// Every valid credit memo landed by these signers, keyed by transaction
/// signature. `blockTime` is carried because it is the honest `issuedAt` for a
/// rebuilt ledger row — when the memo landed, not when someone re-recorded it.
/// Every instruction of a transaction, top level and inner.
function allInstructions(transaction) {
  const message = transaction && transaction.transaction && transaction.transaction.message;
  const top = (message && message.instructions) || [];
  const inner = ((transaction && transaction.meta && transaction.meta.innerInstructions) || []).flatMap(
    (group) => group.instructions || []
  );
  return top.concat(inner);
}

function programIdOfMemo(transaction, memo) {
  const hit = allInstructions(transaction).find(
    (instruction) => instruction.program === "spl-memo" && instruction.parsed === memo
  );
  return (hit && hit.programId) || null;
}

/// Why one signature did not yield a credit memo.
///
/// reconcile prints "in ledger but not found on chain" for anything it cannot
/// match, which reads as "that transaction does not exist". It is also what a
/// transaction that DOES exist looks like when its memo instruction was not
/// parsed as spl-memo — a different failure with a different fix, and on
/// 2026-09-17 that conflation cost an afternoon. This asks the one question
/// that separates them, and only on the failure path.
async function inspectSignature(call, signature) {
  const transaction = await call("getTransaction", [
    signature,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "finalized" },
  ]);
  if (!transaction) return { found: false };

  const instructions = allInstructions(transaction);
  return {
    found: true,
    err: (transaction.meta && transaction.meta.err) || null,
    programIds: [...new Set(instructions.map((i) => i.programId).filter(Boolean))],
    parsedMemos: instructions
      .filter((i) => i.program === "spl-memo" && typeof i.parsed === "string")
      .map((i) => i.parsed),
  };
}

async function scanSignerMemos(call, signers, limit) {
  const found = new Map();

  for (const signer of signers) {
    const signatures = await call("getSignaturesForAddress", [signer, { limit }]);
    for (const { signature, err } of signatures) {
      if (err) continue;
      const transaction = await call("getTransaction", [
        signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "finalized" },
      ]);
      const blockTime = transaction && transaction.blockTime;
      for (const memo of memosFrom(transaction)) {
        const parsed = parseMemo(memo);
        if (parsed.ok) {
          found.set(signature, {
            ...parsed,
            signature,
            signer,
            blockTime: blockTime ?? null,
            // Which program actually carried it. config/protocol.json declares a
            // memoProgram and nothing has ever checked that a landed memo used
            // it — a declared-but-unenforced field describes nothing.
            programId: programIdOfMemo(transaction, memo),
          });
        }
      }
    }
  }

  return found;
}

/// Group landed memos that claim the same wallet, credit and week.
///
/// RULES.md is chain-first: "a credit is created only when an allowlisted desk
/// signer lands an on-chain Memo". So two identical memos are two credits, not
/// one credit landed twice — which is the correct rule (the alternative lets an
/// operator decide which landings count) and also the surprising one. Nothing
/// here decides anything; it exists so a caller can say so out loud.
function duplicateGroups(memos) {
  const byKey = new Map();
  for (const memo of memos) {
    const key = `${memo.wallet}:${memo.credit}:${memo.week}`;
    byKey.set(key, (byKey.get(key) || []).concat([memo]));
  }
  return [...byKey.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, group }));
}

module.exports = { memosFrom, allInstructions, inspectSignature, scanSignerMemos, duplicateGroups };
