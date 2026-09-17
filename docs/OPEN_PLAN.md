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

`node scripts/doctor.js` on the box, 2026-09-17, **after** the operator ran
steps 1 and 2 below:

```
✓ Operator files copied
✓ Earn schedule is valid
✓ Owner confirmed the rates and the rent threshold
! At least one credit issued        <- the only blocker
· Realized PnL covers the rent threshold
· Mint created
· 35/USDC pool seeded and locked
```

Against the three things opening needs:

| needed to open | state |
|---|---|
| Earned-only terms on the public page | **done** — all six terms are on `index.html` |
| Earn schedule published | **done** — `EARN.md`, and now on the page itself |
| Ledger and issuer in place | **done** — config written, rates confirmed `2026-09-17` |

**One blocker, and it is not a configuration problem: no credit has been issued
yet.** That is the desk's own work, not a missing file. Steps 1 and 2 are kept
below because they are the record of how the desk got here and what those
numbers mean — not because they are still to do. **Start at step 4.**

---

## Step by step

### Step 1 — create the four config files · **$0** · 1 minute · ✅ DONE

They are gitignored, so this writes nothing to GitHub.

**The `[ -f ... ] ||` guard is not decoration.** An earlier version of this line
was a plain `cp`, and `config/ledger.example.json` is `"entries": []` — so
running it a second time replaces the live ledger with an empty one while every
issued memo stays on chain forever. That happened on this desk on 2026-09-17:
three landed credits, zero ledger rows, `RECONCILED: no (3 mismatches)`. The
credits were recoverable because the chain is the record —
`node scripts/ledger-rebuild.js` reads them back — but nothing about the
instruction warned that it could destroy anything.

```bash
cd ~/35 && for f in protocol pnl earn ledger; do [ -f config/$f.json ] || cp config/$f.example.json config/$f.json; done && node scripts/doctor.js
```

The doctor will now say the next blocker is owner confirmation.

### Step 2 — set the rates you mean · **$0** · 1 minute · ✅ DONE

```bash
node scripts/confirm.js --session 1.000000 --report 2.000000 --rent 10
```

Run on 2026-09-17. `config/earn.json` now carries `ownerConfirmed: true` and
`publishedAt: 2026-09-17`, with `rentThresholdSol = 10`. `EARN.md` was updated
in the same pass so the published record no longer calls the rates provisional.

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

### Step 3 — publish the page · **$0** · already hosted · ✅ DONE

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

### Step 4 — the first credit · ~**$0.0005** · ← **YOU ARE HERE**

This is the only thing standing between the repo and an open desk.

**Placeholders in these commands are bare words on purpose.** A `<placeholder>`
pasted into bash is read as a redirect and fails with a shell error that has
nothing to do with this repo — that happened here, on this desk, with
`<your-wallet>`. Every command below is complete and runnable as written.

**1. Preview. Writes nothing, costs nothing, and prints the exact memo:**

```bash
cd ~/35 && node scripts/issue-credit.js --wallet 3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo --reason desk.session --week 2026-W38 --preview
```

**2. Land it.** The first form builds and signs and transmits nothing; the
second submits and prints the signature step 3 needs, which is why the order is
not the obvious one.

```bash
node scripts/land-memo.js --memo '35-credit:3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo:1.000000:2026-W38'
node scripts/land-memo.js --memo '35-credit:3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo:1.000000:2026-W38' --send
```

**Every `--send` is another credit.** A memo that lands is a credit by
`RULES.md`, so re-running this because the output scrolled away issues a second
one. Check what is already on chain before landing anything:
`node scripts/reconcile.js`.

**3. Record it**, substituting the signature the send returned for `SIGNATURE`:

```bash
node scripts/issue-credit.js --wallet 3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo --reason desk.session --week 2026-W38 --source-sig SIGNATURE
```

**4. Verify the ledger and the chain agree:**

```bash
node scripts/reconcile.js
```

**Landing first is not a style preference.** `reconcile.js` matches an entry's
`sourceSig` against the signature of the transaction that carried the memo, and
a transaction has no signature until it is sent. A ledger written before landing
**can never reconcile** — and that ledger is what becomes the supply cap at mint.

#### On rehearsing this on devnet first

The original version of this plan said to rehearse on devnet, where SOL is free.
That is still the better ceremony if it works, but **the devnet faucet
rate-limited this box on 2026-09-17**, so it is not reliably free in practice —
and a step that intermittently fails is worse guidance than none.

The mainnet alternative costs **$0.0005**. The wallet above holds about $1, which
is roughly 1,840 credits after the rent-exempt floor. `--preview` is free and
exact, so the thing devnet was protecting against — an unreadable or malformed
memo — is already caught for nothing before anything is sent.

If you do rehearse on devnet, point `rpcUrl` there, then reset it to mainnet and
empty the devnet ledger before the first real credit — a devnet signature will
not reconcile against mainnet.

### Step 5 — open · **$0**

Nothing else is required. The desk is open when the terms, the schedule, and a
working issuer are public, and all three now are. Mail is already live
(`*@elghaly.dev` → inbox, send-as `wyndham35@elghaly.dev`).

After the first credit reconciles, `node scripts/doctor.js` should show six of
seven stages green, with `Realized PnL covers the rent threshold` as the next
one — and that one is not opening, it is mint. **The desk is open before it is
reached.**

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
2. **Rehearse on devnet** when the faucet cooperates — identical code path, free
   SOL, and the one place the landing-order trap can bite you harmlessly. It
   rate-limited this box on 2026-09-17, so treat it as a bonus, not a gate: a
   mainnet credit is $0.0005 and `--preview` catches the same mistakes for $0.
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

**The blocker is not technical.** The code is written, 107 tests pass, the site
is live, the mail works, the gates are correct, the config exists and the rates
are confirmed. One memo stands between this repo and an open desk — and a memo
is a record of work someone actually did. That is the real remaining input, and
no script can supply it.

**Opening at zero cost is real, but "zero cost" is not the same as "zero
obligation."** The moment the desk is open, the earn schedule is a public
promise: a credit exists only for work in that table, at that rate, evidenced by
a signed memo anyone can check. `EARN.md` is right that publishing the rate is
what makes "earned" a claim rather than a mood. The cost of this desk was never
the SOL. It is that the rate has to stay honest once someone is counting on it.
