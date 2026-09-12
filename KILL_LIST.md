# Kill list

Do not do these. If any item happens, stop announcing and run `scripts/self-audit.js`.

1. Accept SOL/USDC from third parties in exchange for 35-credit.
2. Hold third-party funds on a single key.
3. Mint before `gate.js` PASSes.
4. Leave mint authority or freeze authority non-null after mint.
5. Seed `35/SOL` as the primary book.
6. Seed a book thin enough that a 0.1 SOL clip moves double-digit percents, then trade it yourself.
7. Wash, self-cross, or paint candles to attract Jito bots.
8. Pay DexScreener/Jupiter boosts before organic flow.
9. Link 35 to ElGhaly equity or the SAFE.
10. Announce a mint address that `self-audit.js` has not marked CLEAN.
11. Let a personal hot wallet own LP, mint, or >1% of supply after distribution.
12. Change `issuanceMode` to `deposit` without written legal review in the named jurisdiction.
