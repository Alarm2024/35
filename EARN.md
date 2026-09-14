# Earn schedule

`RULES.md` says what a credit looks like. This says what earns one.

A credit is created only by a desk signer landing `35-credit:<wallet>:<credit>:<week>`
for work that appears in the table below, at the rate in the table below. A reason
that is not in the table cannot be issued: `scripts/issue-credit.js` refuses it and
`scripts/gate.js --preflight` fails the ledger.

The machine-readable copy is `config/earn.json` (gitignored; start from
`config/earn.example.json`). This file and that file must agree.

## Rates

**Not yet published.** The example schedule ships with `0.000000` in every row and
`gate.js --preflight` fails while that is true, because a schedule that pays nothing
is a stub, not a schedule.

| Reason | Credit | What earns it |
|---|---|---|
| `desk.session` | _unset_ | FILL IN: one completed desk session |
| `desk.report` | _unset_ | FILL IN: one published desk report |

Add rows as the desk does more kinds of work. Do not remove a row that has already
issued credits — the ledger references it by name.

## Why this file exists

Earned-only issuance without a published rate is discretionary issuance. The token
is then worth whatever the operator says on any given week, and no holder can check
the work. Publishing the rate first is what makes "earned" a claim rather than a mood.

Changing a rate is allowed. Changing it retroactively is not: already-issued ledger
entries keep the rate they were issued at, and `gate.js` compares each entry against
the schedule, so a retroactive edit shows up as a gate failure rather than as a
silent rewrite.

## No purchase

Nothing here can be bought. No rate in this table is reachable by sending SOL or USDC
to any 35 address. See `RULES.md` and `KILL_LIST.md` item 1.
