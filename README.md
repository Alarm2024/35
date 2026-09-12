# 35

Public desk page: `https://35.elghaly.dev`
Public record: `https://github.com/Alarm2024/35`

Earned-only. No purchase. No redeem. No outsider deposits.

## Layout

| Path | Role |
|---|---|
| `index.html` | Public page |
| `protocol.json` | Public fields only |
| `config/protocol.example.json` | Shape for gitignored `config/protocol.json` |
| `config/pnl.example.json` | Shape for gitignored `config/pnl.json` (desk PnL report) |
| `scripts/gate.js` | Pre-mint gate, fail closed |
| `scripts/self-audit.js` | Post-mint audit, fail closed |
| `RULES.md` / `KILL_LIST.md` / `CONVERSION.md` | Policy |

## Gate

```
node scripts/gate.js
```

Exits 1 unless every check passes. Do not mint on BLOCK.

## Status

Pre-mint. Public addresses stay empty until operators fill them after the config split is merged.
