# Conversion rule (one sentence)

1 credit = 1 unit of 35 at 6 decimals, earned only from signed desk-usage events, never purchased, never redeemable for cash or SOL/USDC, and converts 1:1 solely at a single mint event if and only if `scripts/gate.js` prints PASS.

Supply cap at that mint event: **the ledger total.** Because the rate is 1:1, the cap is
the sum of issued credits in `config/ledger.json` at the snapshot block — derived from
signed memos, never invented. `node scripts/gate.js --preflight` prints it, and
`node scripts/self-audit.js` refuses to report CLEAN unless on-chain supply equals it.

Build the ledger as you issue. Reconstructing a year of memos on mint day is how a
number gets invented.
