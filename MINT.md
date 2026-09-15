# Mint day

The ceremony, in order, with nothing improvised at the keyboard while a signing
key is loaded. Run `node scripts/mint-plan.js` first — it prints this with your
real values substituted, or tells you exactly why mint is still blocked.

Nothing in this file mints anything. It is the checklist for the human holding
the key.

## Before you start

Four conditions, all required, none sufficient alone:

1. `node scripts/gate.js --preflight` exits 0.
2. `node scripts/reconcile.js` prints `RECONCILED: yes` — the ledger matches
   the memos actually on chain.
3. Realized desk PnL covers `rentThresholdSol` in `config/pnl.json`.
4. The owner says mint. A passing gate is a permission, not an instruction.

If the ledger has no entries, supply is `0.000000` and there is nothing to
convert. Credits come first; the mint is the last step, not the first.

## Supply

Not a number anyone picks. `CONVERSION.md` puts credits 1:1 with units at 6
decimals, so:

    supply = sum of config/ledger.json entries at the snapshot block

`scripts/mint-plan.js` prints it in both decimal and base units. Use the base
units figure when checking on chain — `self-audit.js` compares against it and
refuses to report CLEAN if they differ.

## Steps

### 1. Create the mint

Six decimals, standard SPL Token program, mint authority on the desk signer
loaded from `KEYPAIR_PATH`. Never a bot hot key (KILL_LIST 11, 12).

### 2. Mint the ledger total to the Squads vault

Exactly the supply figure, once, to `squadsVault`. No rounding, no "spare"
allocation, no extra to a personal wallet.

### 3. Revoke mint and freeze authority

`RULES.md` requires both set to null **in the same revocation transaction**.

⚠️ **The stock `spl-token` CLI cannot do this.** Each `spl-token authorize`
call sends its own transaction, so the CLI path leaves a window where one
authority is already null and the other is still live. Meeting the rule as
written needs a transaction carrying two `SetAuthority` instructions —
`AuthorityType::MintTokens` → `None` and `AuthorityType::FreezeAccount` →
`None` — built and signed as one unit.

Two honest options, to settle **before** mint day, not during it:

- **Build the two-instruction transaction.** A small signing script, written
  and rehearsed against a throwaway mint first. This is the option that
  satisfies the rule.
- **Amend the rule** to permit two back-to-back transactions, and state which
  authority is revoked first and why that window is acceptable.

Do not discover this at the keyboard with a live mint authority. Whichever you
pick, `self-audit.js` verifies the end state on chain either way.

### 4. Record and verify

Put the mint address in public `protocol.json`, then:

    node scripts/self-audit.js

It checks the chain: both authorities null, decimals 6, supply equal to the
ledger total, position NFT on the Squads vault, pool owned by DAMM v2. It
refuses to print CLEAN if it never reached the chain, so never pass `--offline`
here.

### 5. Announce

Only after `CLEAN: yes`. KILL_LIST 10.

## After the mint

The pair is a separate act, not part of this ceremony: single `35/USDC` book on
Meteora DAMM v2, liquidity protocol-owned and permanently locked, position NFT
on the Squads vault. See `RULES.md` "Pair" and KILL_LIST 5 through 8.

## If something goes wrong

Stop announcing and run `node scripts/self-audit.js`. An un-revoked authority
is recoverable — revoke it. A minted supply that does not match the ledger is
not recoverable, which is why step 2 is exact and why reconcile runs first.
