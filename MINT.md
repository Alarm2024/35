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

**The desk already owns the tool for this: Squads.** A Squads v4 vault
transaction stores a message of instructions and executes them atomically by
CPI — all of them, in one Solana transaction, when they fit. Two
`SetAuthority` instructions fit with room to spare.

So the rule is satisfiable with no custom signing code and no new dependency:

1. At step 1, create the mint with **mint and freeze authority on the Squads
   vault** (`GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ`), not on a personal
   or hot key. This is what KILL_LIST 11 wants anyway.
2. Propose **one** vault transaction carrying both instructions:
   - `SetAuthority(mint, AuthorityType::MintTokens, None)`
   - `SetAuthority(mint, AuthorityType::FreezeAccount, None)`
3. Approve and execute it. Both authorities go null together or neither does.

This is better than a bespoke script: it is atomic by construction, it is
reviewable before execution, and the revocation is recorded in the multisig
rather than in one operator's shell history.

### If you revoke outside Squads anyway

Then two transactions is the reality, and the order matters. **Revoke
`MintTokens` first, `FreezeAccount` second.**

Both windows are bad, but they are not equally bad. A live mint authority in
the gap means supply can be inflated, which permanently destroys the one
guarantee 35 rests on — that supply equals the ledger. A live freeze authority
in the gap is serious but does not break that arithmetic, and it stays
revocable afterwards. Close the irreversible hole first.

Either way, stopping halfway and announcing is the actual failure mode.
`self-audit.js` verifies the end state on chain and refuses CLEAN while either
authority is non-null, so the audit catches a half-finished revocation — but
only if you run it before you speak.

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
