# 35

Public desk page: https://35.elghaly.dev
Public record: https://github.com/Alarm2024/35

Earned-only. No purchase. No redeem. No outsider deposits. English only.

## Operator files (copy, then rename)

Real `config/protocol.json` and `config/pnl.json` are gitignored. Do not commit them.

```bash
cp config/protocol.example.json config/protocol.json
cp config/pnl.example.json config/pnl.json
cp config/earn.example.json  config/earn.json
cp config/ledger.example.json config/ledger.json
```

Then fill in `config/earn.json` rates and publish the same table in `EARN.md`, and set
`rentThresholdSol` in `config/pnl.json`. Both gates fail while either is a stub.

Fill those local copies yourself. Leave public `protocol.json` `mint`, `squadsVault`, and `pool` empty until gate is allowed to PASS.

Signing keys never live in this repo. Copy `.env.example` to `.env` and set `KEYPAIR_PATH` to an outside-repo file (e.g. `/home/ubuntu/.config/solana/35/deskSigner.json`). See `SECURITY.md`.

Key roles: `docs/WALLET_MAP.md`. Do not put bot hot keys on mint, freeze, LP, position NFT, or treasury.

## Locked (human, 2026-09-12)

| Field | Value |
|---|---|
| Site | https://35.elghaly.dev |
| Jurisdiction | California — 548 Market St, San Francisco, CA 94104 |
| 35 deskSigner | `3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo` |
| Squads vault | `GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ` |
| Squads treasury UI | https://app.squads.so/squads/GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ/treasury |
| Mail inbound | `*@elghaly.dev` → `wyndhamdesert@gmail.com` (live) |
| Mail outbound | Gmail send-as `wyndham35@elghaly.dev` (live) |

Still closed: no mint, no pool, no outsider deposits into Squads treasury. Next work is
desk, not token; mint only when `gate.js --preflight` passes, realized PnL covers the
rent threshold in `config/pnl.json`, and the owner says mint.

Opening the desk needs none of that. It needs the earn schedule published (`EARN.md`),
the ledger and issuer in place, and earned-only terms on the public page.

## Scripts

```bash
node scripts/doctor.js                  # where am I, and what is the next step?
node scripts/confirm.js --session 1.000000 --report 2.000000 --rent 10
                                        # state the rates and the rent gate (no editor)
node scripts/gate.js --preflight        # may we mint? run BEFORE minting
node scripts/gate.js --postflight       # did we mint safely? (default; hits RPC)
node scripts/gate.js --public-only      # public protocol.json only, for CI
node scripts/self-audit.js              # announcement gate: prints CLEAN: yes/no
node scripts/reconcile.js               # ledger vs memos actually on chain
node scripts/mint-plan.js               # the mint ceremony with real values, or why it is blocked
node scripts/scan-secrets.js            # no signing material in the repo
node --test scripts/test/*.test.js

# record one earned credit at the published rate, then land the memo
# Land the memo FIRST: sourceSig is the signature of the transaction that
# carried it, so it cannot be known before sending.
node scripts/issue-credit.js --wallet <addr> --reason desk.session --week 2026-W37 --preview
# ...land that memo with the desk signer, then record it:
node scripts/issue-credit.js --wallet <addr> --reason desk.session --week 2026-W37 --source-sig <signature>
```

Everything fails closed. `--preflight` is the gate that decides whether mint may happen;
`--postflight` and `self-audit` decide whether it may be announced. `self-audit` refuses to
print CLEAN if it never reached the chain.

The credit amount is not an argument to `issue-credit.js`. It comes from `config/earn.json`,
because a rate you can pass on the command line is a discretionary rate.

## Docs

- `EARN.md` — what earns a credit and at what rate (publish before opening the desk)
- `MINT.md` — the mint-day ceremony, in order
- `SECURITY.md` — keys outside repo; `KEYPAIR_PATH` from env only
- `RULES.md` `KILL_LIST.md` `CONVERSION.md`
- `docs/WALLET_MAP.md` — roles, locked deskSigner and Squads vault
- `docs/MAIL_35.md` — live catch-all to `wyndhamdesert@gmail.com`, send as `wyndham35@elghaly.dev`
- `docs/GITHUB_DOMAIN.md` — apex domain verify taps

Supply cap is derived, never invented: it is the credit ledger total at the snapshot
block, 1:1 with units at 6 decimals. See `CONVERSION.md`. It reads as unset today only
because no credits have been issued yet.
