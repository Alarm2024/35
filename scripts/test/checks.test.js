"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { run } = require("../lib/checks");

const VAULT = "GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ";
const SIGNER = "3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MEMO = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const DAMM = "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG";

const pad = (prefix) => prefix.padEnd(44, "1");
const MINT = pad("Mint");
const POOL = pad("Poo");
const NFT = pad("Nft");
const POSITION = pad("Posi");
const WALLET = pad("Wa11et");
const BOT = pad("Bot");
const TOKEN_ACCOUNT = pad("Tok");

// Builds a desk that is fully configured and should PASS, so each test can break
// exactly one thing and prove the gate catches that one thing.
function fixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gate-fixture-"));
  fs.mkdirSync(path.join(root, "config"));

  const files = {
    "protocol.json": {
      name: "35",
      symbol: "35",
      decimals: 6,
      issuanceMode: "earned",
      jurisdiction: "California",
      mint: MINT,
      squadsVault: VAULT,
      pool: POOL,
      usdcMint: USDC,
      ...overrides.protocol,
    },
    "config/protocol.json": {
      rpcUrl: "https://rpc.invalid",
      memoProgram: MEMO,
      dammV2Program: DAMM,
      deskSigners: [SIGNER],
      controlledWallets: [BOT],
      position: POSITION,
      positionNftMint: NFT,
      metadataUri: "https://35.elghaly.dev/metadata.json",
      ...overrides.config,
    },
    "config/pnl.json": {
      week: "2026-W37",
      realizedDeskPnl: 10,
      rentThresholdSol: 5,
      ...overrides.pnl,
    },
    "config/earn.json": {
      publishedAt: "2026-09-14",
      rules: { "desk.session": { credit: "1.500000", describes: "one completed desk session" } },
      ...overrides.earn,
    },
    "config/ledger.json": {
      version: 1,
      decimals: 6,
      entries: [
        {
          wallet: WALLET,
          credit: "1.500000",
          week: "2026-W37",
          sourceSig: "sig-a",
          issuedAt: "2026-09-14T00:00:00Z",
          reason: "desk.session",
        },
      ],
      ...overrides.ledger,
    },
  };

  for (const [relative, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, relative), JSON.stringify(body, null, 2));
  }

  return root;
}

// Stands in for mainnet. Returns a healthy post-mint chain unless overridden.
function fakeRpc(state = {}) {
  const accounts = {
    [MINT]: {
      owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      data: {
        parsed: {
          type: "mint",
          info: {
            mintAuthority: null,
            freezeAuthority: null,
            decimals: 6,
            supply: "1500000",
            ...state.mintInfo,
          },
        },
      },
    },
    [TOKEN_ACCOUNT]: {
      owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      data: { parsed: { type: "account", info: { owner: state.nftOwner ?? VAULT, tokenAmount: { amount: "1" } } } },
    },
    [POOL]: { owner: state.poolOwner ?? DAMM, data: { parsed: { type: "pool", info: {} } } },
  };

  return () => async (method, params) => {
    if (method === "getAccountInfo") return { value: accounts[params[0]] ?? null };
    if (method === "getTokenLargestAccounts") return { value: [{ address: TOKEN_ACCOUNT }] };
    throw new Error(`unexpected RPC method ${method}`);
  };
}

const failureText = (result) => result.failures.join("\n");

test("preflight passes on a fully configured pre-mint desk", async () => {
  const root = fixture({ protocol: { mint: "", pool: "" }, config: { position: "", positionNftMint: "" } });
  const result = await run({ mode: "preflight", root });
  assert.equal(result.ok, true, failureText(result));
  assert.equal(result.total.credit, "1.500000");
});

test("preflight does not require mint or pool — the old gate could never pass", async () => {
  const root = fixture({ protocol: { mint: "", pool: "" }, config: { position: "", positionNftMint: "" } });
  const result = await run({ mode: "preflight", root });
  assert.equal(failureText(result).includes("mint"), false);
  assert.equal(failureText(result).includes("pool"), false);
});

test("preflight fails when realized PnL does not cover the rent threshold", async () => {
  const root = fixture({ pnl: { realizedDeskPnl: 1, rentThresholdSol: 5 } });
  const result = await run({ mode: "preflight", root });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /does not cover rent threshold/);
});

test("preflight fails when the rent threshold is unset — an unquantified gate", async () => {
  const root = fixture({ pnl: { realizedDeskPnl: 100, rentThresholdSol: 0 } });
  const result = await run({ mode: "preflight", root });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /rentThresholdSol/);
});

test("preflight fails while the earn schedule is still a zero stub", async () => {
  const root = fixture({
    earn: { publishedAt: "2026-09-14", rules: { "desk.session": { credit: "0.000000", describes: "stub" } } },
    ledger: { version: 1, decimals: 6, entries: [] },
  });
  const result = await run({ mode: "preflight", root });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /still a stub/);
});

test("preflight fails when a ledger entry cites a reason not in the schedule", async () => {
  const root = fixture({
    ledger: {
      version: 1,
      decimals: 6,
      entries: [
        {
          wallet: WALLET,
          credit: "1.500000",
          week: "2026-W37",
          sourceSig: "sig-a",
          issuedAt: "2026-09-14T00:00:00Z",
          reason: "favours.owed",
        },
      ],
    },
  });
  const result = await run({ mode: "preflight", root });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /not in the earn schedule/);
});

test("preflight fails when a ledger entry pays off-schedule", async () => {
  const root = fixture({
    ledger: {
      version: 1,
      decimals: 6,
      entries: [
        {
          wallet: WALLET,
          credit: "99.000000",
          week: "2026-W37",
          sourceSig: "sig-a",
          issuedAt: "2026-09-14T00:00:00Z",
          reason: "desk.session",
        },
      ],
    },
  });
  const result = await run({ mode: "preflight", root });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /does not match earn schedule rate/);
});

test("preflight fails when a bot hot key holds a privileged role (KILL_LIST 11)", async () => {
  const root = fixture({ protocol: { squadsVault: BOT } });
  const result = await run({ mode: "preflight", root });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /KILL_LIST 11/);
});

test("preflight fails when a bot hot key is a desk signer (KILL_LIST 12)", async () => {
  const root = fixture({ config: { deskSigners: [BOT] } });
  const result = await run({ mode: "preflight", root });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /KILL_LIST 12/);
});

test("preflight fails when issuanceMode is flipped to deposit", async () => {
  const root = fixture({ protocol: { issuanceMode: "deposit" } });
  const result = await run({ mode: "preflight", root });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /issuanceMode must be earned/);
});

test("postflight passes when the chain agrees with the ledger", async () => {
  const root = fixture();
  const result = await run({ mode: "postflight", root, rpcFactory: fakeRpc() });
  assert.equal(result.ok, true, failureText(result));
});

test("postflight catches a live mint authority (KILL_LIST 4)", async () => {
  const root = fixture();
  const result = await run({
    mode: "postflight",
    root,
    rpcFactory: fakeRpc({ mintInfo: { mintAuthority: SIGNER } }),
  });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /mint authority is not null/);
});

test("postflight catches a live freeze authority (KILL_LIST 4)", async () => {
  const root = fixture();
  const result = await run({
    mode: "postflight",
    root,
    rpcFactory: fakeRpc({ mintInfo: { freezeAuthority: SIGNER } }),
  });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /freeze authority is not null/);
});

test("postflight catches on-chain supply that does not equal the ledger total", async () => {
  const root = fixture();
  const result = await run({
    mode: "postflight",
    root,
    rpcFactory: fakeRpc({ mintInfo: { supply: "999000000" } }),
  });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /does not equal ledger total/);
});

test("postflight catches a position NFT that is not on the Squads vault", async () => {
  const root = fixture();
  const result = await run({ mode: "postflight", root, rpcFactory: fakeRpc({ nftOwner: BOT }) });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /not the Squads vault/);
});

test("postflight catches a pool that is not a DAMM v2 account", async () => {
  const root = fixture();
  const result = await run({
    mode: "postflight",
    root,
    rpcFactory: fakeRpc({ poolOwner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }),
  });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /not DAMM v2/);
});

test("postflight requires mint and pool to exist", async () => {
  const root = fixture({ protocol: { mint: "", pool: "" } });
  const result = await run({ mode: "postflight", root, offline: true });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /mint is empty/);
});

test("postflight never reaches the chain when local checks already failed", async () => {
  const root = fixture({ pnl: { realizedDeskPnl: 0, rentThresholdSol: 5 } });
  const result = await run({
    mode: "postflight",
    root,
    rpcFactory: () => async () => {
      throw new Error("RPC must not be called");
    },
  });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /skipping on-chain verification/);
});

test("public-only mode ignores operator files so CI can run it", async () => {
  const root = fixture();
  fs.rmSync(path.join(root, "config"), { recursive: true, force: true });
  const result = await run({ mode: "postflight", publicOnly: true, root });
  assert.equal(result.ok, true, failureText(result));
});

test("public-only mode still catches a committed mint that is not a real address", async () => {
  const root = fixture({ protocol: { mint: "coming-soon" } });
  const result = await run({ mode: "postflight", publicOnly: true, root });
  assert.equal(result.ok, false);
  assert.match(failureText(result), /not a base58 Solana address/);
});

test("both modes fail closed when every operator file is missing", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gate-empty-"));
  fs.writeFileSync(path.join(root, "protocol.json"), JSON.stringify({}));
  for (const mode of ["preflight", "postflight"]) {
    const result = await run({ mode, root, offline: true });
    assert.equal(result.ok, false, `${mode} must fail closed`);
  }
});
