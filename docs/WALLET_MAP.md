# Wallet map

Roles only. Do not commit private keys or seed phrases.

Hard rule: **no bot hot key ever holds mint, freeze, LP, position NFT, or treasury.**

`35 deskSigner` is not KEEP, not 350, not any `cheap_*` key.

| Role | Job | Address |
|---|---|---|
| KEEP hot | KEEP borrow / desk engine. Never mint, freeze, LP, NFT, treasury. | |
| 350 hot | 350 engine. Never mint, freeze, LP, NFT, treasury. | |
| cheap_* | Cheap-route / scout keys. Never mint, freeze, LP, NFT, treasury. | |
| 35 deskSigner | Memo issuance only. Not a treasury. | `3BZGNtr7AQ5c6Rf7nUhunfvqooQAtb5Eaek9Hw1npbLo` |
| Squads | Multisig / treasury UI. LP NFT later. | `GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ` |

App: https://app.squads.so/squads/GMyuRJbwPTF5pEHvMCNJqujoLk8tZCdFY6i9feMoczcQ/treasury

Public `protocol.json` mint and pool stay empty. Gate stays BLOCK. Do not accept outsider deposits into this treasury.
