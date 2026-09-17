"use strict";

// Minimal Solana JSON-RPC client over global fetch (Node 18+).
//
// Deliberately dependency-free: this repo is a public record of a closed desk,
// and a signing-adjacent audit path should not pull a package tree it cannot read.

// Retry only what a retry can fix.
//
// A timeout, a dropped socket, a 429 and a 5xx are all "ask again in a moment".
// A JSON-RPC error body and a 4xx are the server answering clearly; asking again
// just wastes the rate limit that caused the problem.
const RETRY_DELAYS_MS = [400, 1200, 3000];

function isRetryable(error) {
  if (!error) return false;
  if (error.retryableHttp) return true;
  // AbortError from the timeout below, and the TypeError global fetch throws
  // when the connection fails outright.
  return error.name === "AbortError" || error.name === "TimeoutError" || error.name === "TypeError";
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/// A JSON-RPC client that survives one slow answer.
///
/// `scanSignerMemos` issues one getTransaction per signature, sequentially. At
/// the default limit that is up to a thousand round trips against a public
/// endpoint, and before this every one of them was a single point of failure:
/// one 15s timeout aborted the whole run and printed
///
///   FAIL: ledger-rebuild crashed: This operation was aborted
///
/// which names neither the call that died nor anything to do about it. A
/// rebuild that reads the chain correctly is worth nothing if it cannot finish.
function rpcFactory(url, { timeoutMs = 15000, fetchImpl = globalThis.fetch, retries = RETRY_DELAYS_MS } = {}) {
  let id = 0;

  return async function call(method, params = []) {
    if (typeof fetchImpl !== "function") {
      throw new Error("no fetch implementation available for RPC");
    }

    let lastError;
    for (let attempt = 0; attempt <= retries.length; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = new Error(`RPC ${method} returned HTTP ${response.status}`);
          // 429 is the public endpoint asking for less; 5xx is it being unwell.
          error.retryableHttp = response.status === 429 || response.status >= 500;
          throw error;
        }

        const body = await response.json();
        if (body.error) {
          throw new Error(`RPC ${method} error: ${body.error.message ?? JSON.stringify(body.error)}`);
        }

        return body.result;
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === retries.length) break;
        await sleep(retries[attempt]);
      } finally {
        clearTimeout(timer);
      }
    }

    // Say which call died, how many times, and what the operator can change.
    // "This operation was aborted" is the AbortError's own message and belongs
    // to no particular request, which is exactly why it was useless.
    const attempts = retries.length + 1;
    const why = isRetryable(lastError)
      ? `gave up after ${attempts} attempts — ${lastError.name === "AbortError" ? `no answer within ${timeoutMs}ms` : lastError.message}`
      : lastError.message;
    const hint =
      "\n      The endpoint is config/protocol.json rpcUrl. A public endpoint rate-limits" +
      "\n      a long scan; lower --limit (it is one getTransaction per signature) or" +
      "\n      point rpcUrl at an endpoint with a key.";
    const failure = new Error(`RPC ${method} failed: ${why}${hint}`);
    failure.cause = lastError;
    throw failure;
  };
}

async function getParsedAccount(call, address) {
  const result = await call("getAccountInfo", [address, { encoding: "jsonParsed", commitment: "finalized" }]);
  return result ? result.value : null;
}

async function getMintState(call, mint) {
  const account = await getParsedAccount(call, mint);
  if (!account) {
    return { ok: false, error: `mint account ${mint} not found on chain` };
  }

  const parsed = account.data && account.data.parsed;
  if (!parsed || parsed.type !== "mint") {
    return { ok: false, error: `account ${mint} is not an SPL mint` };
  }

  const info = parsed.info;
  return {
    ok: true,
    owner: account.owner,
    mintAuthority: info.mintAuthority ?? null,
    freezeAuthority: info.freezeAuthority ?? null,
    decimals: info.decimals,
    supply: info.supply,
  };
}

// The position NFT must sit on the Squads vault, not a personal or bot key
// (RULES.md "Pair", KILL_LIST 11). Largest-account holder is the NFT holder.
async function getNftHolder(call, nftMint) {
  const largest = await call("getTokenLargestAccounts", [nftMint, { commitment: "finalized" }]);
  const top = largest && largest.value && largest.value[0];
  if (!top) {
    return { ok: false, error: `no token accounts found for ${nftMint}` };
  }

  const account = await getParsedAccount(call, top.address);
  const info = account && account.data && account.data.parsed && account.data.parsed.info;
  if (!info) {
    return { ok: false, error: `could not parse token account ${top.address}` };
  }

  return { ok: true, owner: info.owner, amount: info.tokenAmount && info.tokenAmount.amount };
}

async function getAccountOwnerProgram(call, address) {
  const account = await getParsedAccount(call, address);
  if (!account) {
    return { ok: false, error: `account ${address} not found on chain` };
  }
  return { ok: true, owner: account.owner };
}

module.exports = { rpcFactory, isRetryable, getParsedAccount, getMintState, getNftHolder, getAccountOwnerProgram };
