# 35 — rules

## Issuance

- Mode is `earned`. Deposits are disabled.
- Nobody sends USDC or SOL to a 35 treasury in exchange for credits.
- A credit is created only when an allowlisted desk signer lands an on-chain Memo:

  `35-credit:<wallet>:<credit>:<week>`

- `credit` is a decimal string with at most 6 fractional digits.
- The same `sourceSig` cannot appear in two weeks.
- `sourceSig` is the signature of the transaction that carried the memo, so the
  memo is landed first and recorded second. `scripts/issue-credit.js --preview`
  prints the memo without writing; the ledger entry is made afterwards with the
  resulting signature. A ledger written before landing cannot reconcile.
- Supply cap at mint: **derived, never invented.** It is the sum of issued credits in
  `config/ledger.json` at the snapshot block, which is 1:1 with units at 6 decimals
  (`CONVERSION.md`). This is why the ledger must exist long before mint day.
- What earns a credit, and at what rate, is published in `EARN.md` and enforced from
  `config/earn.json`. A reason that is not in the schedule cannot be issued.
- Signer role is `35 deskSigner` in `docs/WALLET_MAP.md`. That key is not KEEP, not 350, not `cheap_*`.

## What 35 is not

- Not equity in any corporation.
- Not a SAFE, STAMP, note, or claim on any company.
- Not a promise of profit, buyback, or redemption.
- Not a deposit receipt.

## Mint

Two gates, because one gate could not work. The old single gate required
`protocol.json.mint` to be non-empty *and* forbade minting until it passed, so it
could never pass before a mint. An unsatisfiable rule gets bypassed by hand.

- **Before minting:** `node scripts/gate.js --preflight` must exit 0. Empty mint and
  pool are expected here. It checks jurisdiction, desk signers, key separation, the
  published earn schedule, the credit ledger, and realized PnL against the rent
  threshold.
- **After minting, before any announcement:** `node scripts/self-audit.js` must print
  `CLEAN: yes`. It runs `gate.js --postflight`, which verifies on chain that mint and
  freeze authority are null, that supply equals the ledger total, that the position NFT
  sits on the Squads vault, and that the pool is a DAMM v2 account.
- Empty jurisdiction or squadsVault in public `protocol.json` means BLOCK at both gates.
- Mint requires preflight PASS **and** the owner explicitly saying mint. The gate is a
  necessary condition, never a sufficient one.
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

- Operator files are gitignored. Start each from its `.example.json`:
  `config/protocol.json`, `config/pnl.json`, `config/earn.json`, `config/ledger.json`.
- `config/ledger.json` is append-only via `scripts/issue-credit.js`. Do not hand-edit it.
- `config/pnl.json` must set `rentThresholdSol`. A rent gate you hold in your head is
  not a gate the machine can check.
- Public fields live in `protocol.json` at the repo root: `name`, `symbol`, `decimals`, `issuanceMode`, `jurisdiction`, `mint`, `squadsVault`, `pool`, `usdcMint`.
- Private operator fields live in `config/protocol.json` (gitignored). Start from `config/protocol.example.json`.
- Desk PnL reports live in `config/pnl.json` (gitignored). Start from `config/pnl.example.json`. Desk PnL report language only. No per-token value.

## Jurisdiction

- Locked: California.
- Public `protocol.json` field `jurisdiction` currently reads `California`.
  It must be non-empty at both gates.
- It names the state only. It carried a street address — 548 Market St — that
  nobody had verified as a mailbox we can receive at, so it named a place we
  could not stand behind. A jurisdiction is a legal venue, not a postal drop;
  the state alone is the part that is true and the part the gate needs.
- Mint, pool, and supply cap remain closed regardless of jurisdiction naming.
- If that field is empty, no public announcement and `scripts/gate.js` stays BLOCK.
