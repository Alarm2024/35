# 35 — rules

## Issuance

- Mode is `earned`. Deposits are disabled.
- Nobody sends USDC or SOL to a 35 treasury in exchange for credits.
- A credit is created only when an allowlisted desk signer lands an on-chain Memo:

  `35-credit:<wallet>:<credit>:<week>`

- `credit` is a decimal string with at most 6 fractional digits.
- The same `sourceSig` cannot appear in two weeks.
- Supply cap at mint: **not set** (mint not open). Do not invent a number.
- Signer role is `35 deskSigner` in `docs/WALLET_MAP.md`. That key is not KEEP, not 350, not `cheap_*`.

## What 35 is not

- Not equity in any corporation.
- Not a SAFE, STAMP, note, or claim on any company.
- Not a promise of profit, buyback, or redemption.
- Not a deposit receipt.

## Mint

- Mint does not exist until `node scripts/gate.js` exits 0.
- Empty jurisdiction, mint, squadsVault, or pool in public `protocol.json` means BLOCK.
- Rent is paid from realized desk PnL recorded in `config/pnl.json`, not from outside capital labeled raise.
- Name `35`, symbol `35`, 6 decimals, standard SPL Token program.
- Mint authority and freeze authority are set to null in the same revocation transaction, then verified on-chain before any announcement.

## Pair

- Single pair after mint: `35/USDC` on Meteora DAMM v2.
- Liquidity is protocol-owned and permanently locked.
- Position NFT must sit on the Squads vault, not a personal key and not a bot hot key.
- No self-trading, wash loops, or painted candles.

## Keys

See `docs/WALLET_MAP.md`.
No bot hot key (KEEP, 350, cheap_*) ever holds mint, freeze, LP, position NFT, or treasury.

## Failure path

- If `gate.js` never PASSes, credits stay credits. They do not become cash.
- There is no redemption desk.
- There is no deadline that converts a non-mint into a refund, because nothing was deposited.

## Config layout

- Public fields live in `protocol.json` at the repo root: `name`, `symbol`, `decimals`, `issuanceMode`, `jurisdiction`, `mint`, `squadsVault`, `pool`, `usdcMint`.
- Private operator fields live in `config/protocol.json` (gitignored). Start from `config/protocol.example.json`.
- Desk PnL reports live in `config/pnl.json` (gitignored). Start from `config/pnl.example.json`. Desk PnL report language only. No per-token value.

## Jurisdiction

- Locked: California — 548 Market St, San Francisco, CA 94104.
- Public `protocol.json` field `jurisdiction` is `California`.
- Mint, pool, and supply cap remain closed regardless of jurisdiction naming.
- If that field is empty, no public announcement and `scripts/gate.js` stays BLOCK.
