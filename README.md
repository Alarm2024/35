# 35

Public desk page: https://35.elghaly.dev
Public record: https://github.com/Alarm2024/35

Earned-only. No purchase. No redeem. No outsider deposits. English only.

## Operator files (copy, then rename)

Real `config/protocol.json` and `config/pnl.json` are gitignored. Do not commit them.

```bash
cp config/protocol.example.json config/protocol.json
cp config/pnl.example.json config/pnl.json
```

Fill those local copies yourself. Leave public `protocol.json` `mint`, `squadsVault`, and `pool` empty until gate is allowed to PASS.

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

Still closed: no mint, no pool, no supply cap, no outsider deposits into Squads treasury. Next work is desk, not token; mint only when realized PnL covers rent and the owner says mint.

## Scripts

```bash
node scripts/gate.js
node scripts/self-audit.js
node --test scripts/test/*.test.js
```

Both gate and self-audit fail closed. Empty jurisdiction / mint / squadsVault / pool means BLOCK.

## Docs

- `RULES.md` `KILL_LIST.md` `CONVERSION.md`
- `docs/WALLET_MAP.md` — roles, locked deskSigner and Squads vault
- `docs/MAIL_35.md` — live catch-all to `wyndhamdesert@gmail.com`, send as `wyndham35@elghaly.dev`
- `docs/GITHUB_DOMAIN.md` — apex domain verify taps

Supply cap is not set (mint not open). Do not invent a number.
