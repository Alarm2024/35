"use strict";

// Minimal Solana JSON-RPC client over global fetch (Node 18+).
//
// Deliberately dependency-free: this repo is a public record of a closed desk,
// and a signing-adjacent audit path should not pull a package tree it cannot read.

function rpcFactory(url, { timeoutMs = 15000, fetchImpl = globalThis.fetch } = {}) {
  let id = 0;

  return async function call(method, params = []) {
    if (typeof fetchImpl !== "function") {
      throw new Error("no fetch implementation available for RPC");
    }

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
        throw new Error(`RPC ${method} returned HTTP ${response.status}`);
      }

      const body = await response.json();
      if (body.error) {
        throw new Error(`RPC ${method} error: ${body.error.message ?? JSON.stringify(body.error)}`);
      }

      return body.result;
    } finally {
      clearTimeout(timer);
    }
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

module.exports = { rpcFactory, getParsedAccount, getMintState, getNftHolder, getAccountOwnerProgram };
