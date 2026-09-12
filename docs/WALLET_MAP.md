# Wallet map

Roles only. Do not commit private keys or seed phrases. Signing key files live outside the repo — see `SECURITY.md`.

Hard rule: **no bot hot key ever holds mint, freeze, LP, position NFT, or treasury.**

`35 deskSigner` is not KEEP, not 350, not any `cheap_*` key.

| Role | Job | Address |
|---|---|---|
| KEEP hot | KEEP borrow / desk engine. Never mint, freeze, LP, NFT, treasury. | (operator local) |
| 350 hot | 350 engine. Never mint, freeze, LP, NFT, treasury. | (operator local) |
| cheap_* | Cheap-route / scout keys. Never mint, freeze, LP, NFT, treasury. | (operator local) |
| 35 deskSigner | Memo issuance only: `35-credit:<wallet>:<credit>:<week>`. Not a treasury. | `3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo` |
| Squads vault | Protocol treasury (multisig). No outsider deposits. Position NFT later. | `GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ` |

Squads treasury UI: https://app.squads.so/squads/GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ/treasury

Public site: https://35.elghaly.dev

## Still closed (public `protocol.json`)

- **Mint** — empty. No SPL mint exists.
- **Pool** — empty. No LP address.
- **Supply cap** — unset. Do not invent a number.
- **Outsider deposits** — nobody sends USDC or SOL to the Squads vault for credits.

Mint opens only when realized desk PnL covers rent **and** the owner explicitly authorizes mint. Next work is desk operations, not token launch.

## Local operator config

Copy the locked `35 deskSigner` pubkey above into local `config/protocol.json` `deskSigners`. Load the signing key via `KEYPAIR_PATH` in `.env` (path only — see `.env.example` and `SECURITY.md`). Public `protocol.json` `mint`, `squadsVault`, and `pool` stay empty until `gate.js` is allowed to PASS.
