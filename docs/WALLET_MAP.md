# Wallet map

Roles only. Address fields stay empty until operators fill a **local** copy. Do not commit live keys.

Hard rule: **no bot hot key ever holds mint, freeze, LP, position NFT, or treasury.**

`35 deskSigner` is not KEEP, not 350, not any `cheap_*` key.

| Role | Job | Address |
|---|---|---|
| KEEP hot | KEEP borrow / desk engine. Never mint, freeze, LP, NFT, treasury. | |
| 350 hot | 350 engine. Never mint, freeze, LP, NFT, treasury. | |
| cheap_* | Cheap-route / scout keys. Never mint, freeze, LP, NFT, treasury. | |
| 35 deskSigner | Memo issuance only: `35-credit:<wallet>:<credit>:<week>`. Not a treasury. | |
| Squads vault | Treasury later. Position NFT later. Multisig only. | |

Fill order (human): Squads vault first, then 35 deskSigner pubkey into local `config/protocol.json` `deskSigners`. Public `protocol.json` `squadsVault` stays empty until gate is allowed to see it.
