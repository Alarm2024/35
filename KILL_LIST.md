# Kill list

Do not do these. If any item happens, stop announcing and run `node scripts/self-audit.js`.

Roles: `docs/WALLET_MAP.md`. Examples: `config/protocol.example.json`, `config/pnl.example.json`.

1. Accept SOL/USDC from third parties in exchange for 35-credit.
2. Hold third-party funds on a single key.
3. Mint before `node scripts/gate.js` prints PASS.
4. Leave mint authority or freeze authority non-null after mint.
5. Seed `35/SOL` as the primary book.
6. Seed a book thin enough that a 0.1 SOL clip moves double-digit percents, then trade it yourself.
7. Wash, self-cross, or paint candles to attract Jito bots.
8. Pay DexScreener/Jupiter boosts before organic flow.
9. Link 35 to any equity claim or SAFE.
10. Announce a mint address that `node scripts/self-audit.js` has not marked CLEAN.
11. Let KEEP / 350 / cheap_* / any bot hot wallet own mint, freeze, LP, position NFT, treasury, or >1% of supply after distribution.
12. Use KEEP, 350, or cheap_* as `35 deskSigner`.
13. Change `issuanceMode` to `deposit` without written legal review in the named jurisdiction.
14. Publish a per-token value. Desk PnL reports only.
15. Touch the `35` CNAME or add a second MX family.
