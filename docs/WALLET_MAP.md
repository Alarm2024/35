# Wallet map

<<<<<<< HEAD
Roles only. Do not commit private keys or seed phrases.

Hard rule: **no bot hot key ever holds mint, freeze, LP, position NFT, or treasury.**
=======
Locked operator roles (2026-09-12). **No bot hot key ever holds mint, freeze, LP, position NFT, or treasury.**
>>>>>>> b643af6 (docs: lock human fields for site, jurisdiction, wallets, and mail)

`35 deskSigner` is not KEEP, not 350, not any `cheap_*` key.

| Role | Job | Address |
|---|---|---|
<<<<<<< HEAD
| KEEP hot | KEEP borrow / desk engine. Never mint, freeze, LP, NFT, treasury. | |
| 350 hot | 350 engine. Never mint, freeze, LP, NFT, treasury. | |
| cheap_* | Cheap-route / scout keys. Never mint, freeze, LP, NFT, treasury. | |
| 35 deskSigner | Memo issuance only. Not a treasury. | `3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo` |
| Squads | Multisig / treasury UI. LP NFT later. | `GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ` |

App: https://app.squads.so/squads/GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ/treasury

Public `protocol.json` mint and pool stay empty. Gate stays BLOCK. Do not accept outsider deposits into this treasury.
=======
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

Copy the locked `35 deskSigner` pubkey above into local `config/protocol.json` `deskSigners`. Public `protocol.json` `mint`, `squadsVault`, and `pool` stay empty until `gate.js` is allowed to PASS.
>>>>>>> b643af6 (docs: lock human fields for site, jurisdiction, wallets, and mail)
