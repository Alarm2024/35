# Opening the 35 desk — step by step, at zero cost

**Written 2026-09-17.** Every claim here was checked against this repo, not remembered.

---

## The one thing to understand first

**Opening and minting are different events, and only one of them costs money.**

| | what it is | what it costs |
|---|---|---|
| **Open** | the desk publicly accepts work and records earned credits in a ledger | **$0** |
| **Issue a credit** | a desk signer lands one memo on Solana | **~$0.0005** each |
| **Mint** | the SPL token exists on chain, supply derived from the ledger | small, and **gated** |
| **Seed a pool** | 35/USDC becomes tradeable | **real capital** — the only large number |

The repo already says this, in `README.md`:

> *"Opening the desk needs none of that. It needs the earn schedule published
> (`EARN.md`), the ledger and issuer in place, and earned-only terms on the
> public page."*

So the answer to "can we open at zero cost" is **yes, and the design already
assumes it.** Nothing below asks you to spend anything to open.

---

## Where the desk actually stands

`node scripts/doctor.js` on 2026-09-17:

```
! Operator files copied              <- the only blocker
· Earn schedule is valid
· Owner confirmed the rates and the rent threshold
· At least one credit issued
· Realized PnL covers the rent threshold
· Mint created
· 35/USDC pool seeded and locked
```

Against the three things opening needs:

| needed to open | state |
|---|---|
| Earned-only terms on the public page | **done** — all six terms are on `index.html` |
| Earn schedule published | **done** — `EARN.md`, and now on the page itself |
| Ledger and issuer in place | **code done**, 107 tests pass; **config files do not exist** |

**One blocker: the four operator config files have never been created.** They are
gitignored by design, so they exist only on your box. Everything else that
opening requires is already built and tested.

---

## Step by step

### Step 1 — create the four config files · **$0** · 1 minute

They are gitignored, so this writes nothing to GitHub.

```bash
cd ~/35 && cp config/protocol.example.json config/protocol.json && cp config/pnl.example.json config/pnl.json && cp config/earn.example.json config/earn.json && cp config/ledger.example.json config/ledger.json && node scripts/doctor.js
```

The doctor will now say the next blocker is owner confirmation.

### Step 2 — set the rates you mean · **$0** · 1 minute

```bash
node scripts/confirm.js --session 1.000000 --report 2.000000 --rent 10
```

**Do not skip past what those numbers are.** They ship as *defaults*, and
`gate.js` refuses to pass while `ownerConfirmed` is false, specifically so a
default can never quietly become the live rate. Passing the numbers **is** the
confirmation — there is deliberately no flag that blesses whatever is in the
file.

Two decisions, both cheap now and expensive later:

- **`--session` and `--report` are a ratio, not a valuation.** There is no price
  and no cap, so the absolute scale is arbitrary. What matters is that a report
  is worth two sessions *at this desk*, and that the ratio stays stable once
  credits exist. If that is backwards for you, change it **now, before the first
  credit** — `EARN.md` says retroactive changes show up as gate failures, which
  is correct and also means you cannot quietly fix it later.
- **`--rent` is the realized-SOL figure mint is gated on.** `pnl.example.json`
  puts the reason plainly: *"a threshold decided when PnL is near it is a
  threshold that moves to meet the number."* Decide it while it is abstract.

### Step 3 — publish the page · **$0** · already hosted

The site is GitHub Pages on a domain you already own, so hosting is free and
stays free. Confirm it ships what it references:

```bash
node scripts/check-site.js
```

This now also verifies the page publishes every rate in `EARN.md` and links it.
Before that check existed the page told readers credit came from "work published
in the earn schedule" without publishing or linking the schedule — the rates
were in the repo and the page pointed at a GitHub org. `EARN.md` explains why
that gap matters: *"Publishing the rate first is what makes 'earned' a claim
rather than a mood."*

### Step 4 — rehearse the credit ceremony on devnet · **$0** · 20 minutes

**This is the zero-cost idea that matters most.** The whole issuance flow can be
run end to end without spending anything, because devnet SOL is free.

`config/protocol.json` carries `rpcUrl`. Point it at devnet, fund the signer from
the free faucet, and run a complete credit: preview → land → record → reconcile.

```bash
solana airdrop 1 <deskSigner> --url devnet
```

Then walk the real sequence:

```bash
node scripts/issue-credit.js --wallet <addr> --reason desk.session --week 2026-W38 --preview
# land that memo with the desk signer, then:
node scripts/issue-credit.js --wallet <addr> --reason desk.session --week 2026-W38 --source-sig <sig>
node scripts/reconcile.js
```

**Note the order, because it is not the obvious one.** The memo is landed
**first**; `sourceSig` is the signature of the transaction that carried it, so it
cannot be known before sending. A ledger written before landing cannot
reconcile. Rehearsing this on devnet is how you find that out for free instead of
on mainnet with a real wallet watching.

When the rehearsal reconciles, reset `rpcUrl` to mainnet and empty the devnet
ledger before the first real credit.

### Step 5 — open · **$0**

Nothing else is required. The desk is open when the terms, the schedule, and a
working issuer are public, and all three now are. Mail is already live
(`*@elghaly.dev` → inbox, send-as `wyndham35@elghaly.dev`).

---

## What the first real credit costs

A memo-only Solana transaction is **5,000 lamports** — the base signature fee,
no account creation, no rent.

```
5,000 lamports = 0.000005 SOL  ≈  $0.0005 at $99/SOL
```

So:

| credits | SOL | USD |
|---|---|---|
| 1 | 0.000005 | $0.0005 |
| 100 | 0.0005 | $0.05 |
| 2,000 | 0.01 | **~$1** |

**Funding the desk signer with 0.01 SOL covers two thousand credits.** That is
the entire operating cost of the desk until mint day, and it is the only money
that has to move to run this thing.

**Check the signer's balance before the first credit** — an unfunded signer
fails at land time, after you have already told someone they earned something:

```bash
solana balance 3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo
```

---

## Ideas that keep it at zero

1. **Open before issuing.** Opening and the first credit are separate events.
   The desk can be open, public and correct for weeks at literally $0, and the
   first half-a-tenth-of-a-cent is spent only when real work is done.
2. **Rehearse on devnet** (step 4). Free SOL, identical code path, and the one
   place the landing-order trap can bite you harmlessly.
3. **`--preview` is free.** It builds and prints the memo without writing to the
   ledger or the chain. Use it every time before landing.
4. **GitHub Pages, not a host.** Already the case. No server, no bill, and
   `check-site.js` guards against the deploy list drifting from the page.
5. **Do not mint to look real.** Mint is where cost begins, and `gate.js
   --preflight` already refuses until realized PnL covers your rent threshold.
   That gate is the thing standing between you and spending money the desks have
   not earned. Leave it alone.
6. **Do not seed a pool to look liquid.** `KILL_LIST.md` items 5–8 cover this
   better than I can: a thin book you trade yourself is worse than no book.

---

## What happens later, and why it is not now

Mint is gated on three things, all of which the repo enforces rather than
suggests:

1. `node scripts/gate.js --preflight` prints **PASS**
2. realized desk PnL covers `rentThresholdSol` in `config/pnl.json`
3. the owner says mint

Supply is **derived, never invented** — the credit ledger total at the snapshot
block, 1:1 at 6 decimals. That is why the ledger has to exist long before mint
day, and why opening first is not a delay but a prerequisite.

The costs, when they come:

| | approximate |
|---|---|
| mint account rent | ~0.0015 SOL |
| metadata | ~0.01 SOL |
| one token account per holder | ~0.002 SOL each |
| **35/USDC pool seeding** | **real capital — the only large number** |

Everything above the pool line is cents. The pool is the decision, and it is
correctly the last one.

---

## The honest part

Two things worth saying plainly, because a plan that only lists steps is not a
plan.

**The blocker is not technical.** Four `cp` commands and one `confirm.js` call
stand between this repo and an open desk. The code is written, 107 tests pass,
the site is live, the mail works, and the gates are correct. What is missing is
the decision embedded in step 2 — what a session is worth relative to a report,
and what realized PnL justifies a mint.

**Opening at zero cost is real, but "zero cost" is not the same as "zero
obligation."** The moment the desk is open, the earn schedule is a public
promise: a credit exists only for work in that table, at that rate, evidenced by
a signed memo anyone can check. `EARN.md` is right that publishing the rate is
what makes "earned" a claim rather than a mood. The cost of this desk was never
the SOL. It is that the rate has to stay honest once someone is counting on it.
