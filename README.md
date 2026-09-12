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

Fill those local copies yourself. Leave public `protocol.json` address fields empty until operators are ready.

## Scripts

```bash
node scripts/gate.js
node scripts/self-audit.js
node --test scripts/test/*.test.js
```

Both gate and self-audit fail closed. Empty config means BLOCK / FAIL.

## Docs

- `RULES.md` `KILL_LIST.md` `CONVERSION.md`
- `docs/MAIL_35.md` — `35@elghaly.dev`
- `docs/GITHUB_DOMAIN.md` — apex domain verify taps

Supply cap is `TODO_HUMAN`. Do not invent a number.
