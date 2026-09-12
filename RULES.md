# 35 — rules

## Issuance

- Mode is `earned`. Deposits are disabled.
- Nobody sends USDC or SOL to a 35 treasury in exchange for credits.
- A credit is created only when an allowlisted desk signer lands an on-chain Memo:

  `35-credit:<wallet>:<credit>:<week>`

- `credit` is a decimal string with at most 6 fractional digits.
- The same `sourceSig` cannot appear in two weeks.

## What 35 is not

- Not equity in any corporation.
- Not a SAFE, STAMP, note, or claim on ElGhaly.
- Not a promise of profit, buyback, or redemption.
- Not a deposit receipt.

## Mint

- Mint does not exist until `node scripts/gate.js` exits 0.
- Rent is paid from realized desk PnL recorded in `config/pnl.json`, not from outside capital labeled “raise.”
- Name `35`, symbol `35`, 6 decimals, standard SPL Token program.
- Mint authority and freeze authority are set to null in the same revocation transaction, then verified on-chain before any announcement.

## Pair

- Single pair after mint: `35/USDC` on Meteora DAMM v2.
- Liquidity is protocol-owned and permanently locked.
- Position NFT must sit on the Squads vault, not a personal key.
- No self-trading, wash loops, or painted candles. Searchers that see a puppet book harvest the puppeteer.

## Failure path

- If `gate.js` never PASSes, credits stay credits. They do not become cash.
- There is no redemption desk.
- There is no deadline that converts a non-mint into a refund, because nothing was deposited.

## Config layout

- Public fields live in `protocol.json` at the repo root (published to Pages): `name`, `symbol`, `decimals`, `issuanceMode`, `jurisdiction`, `mint`, `squadsVault`, `pool`, `usdcMint`.
- Private operator fields live in `config/protocol.json` (gitignored, never deployed): `deskSigners`, `controlledWallets`, `position`, `positionNftMint`, `metadataUri`, `rpcUrl`, `memoProgram`, `dammV2Program`.
- Desk PnL reports live in `config/pnl.json` (gitignored, never deployed). Use desk PnL report language only; do not publish per-token NAV figures.

## Jurisdiction

- Operators name a jurisdiction in `protocol.json` before week 1 is published.
- If that field is empty, no public announcement.
