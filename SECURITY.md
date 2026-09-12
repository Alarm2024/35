# Security — signing keys

This repo is a **closed desk** public record. It must never contain Solana keypair JSON, seed phrases, PEM files, or any other signing material.

## Where keys live

Operator signing keys belong **outside** the repository:

- Preferred: `~/.config/solana/35/deskSigner.json` (or your OS user config tree)
- Alternative (server): `/etc/ocean-drop/keys/` when deployed that way

Do **not** place keys under `src/`, `config/`, Docker build context, CI artifacts, logs, or chat paste.

## How processes should load keys

1. Read **`KEYPAIR_PATH`** from the environment (see `.env.example`).
2. Resolve and open that path at runtime only.
3. Never embed key bytes, base58 secret arrays, or file contents in repo files, examples, or docs.

Public addresses documented in `docs/WALLET_MAP.md` and `README.md` are **pubkeys only** — not key files.

## Git hygiene

`.gitignore` blocks common key filenames and directories (`keypairs/`, `secrets/`, `*keypair*.json`, `deskSigner.json`, etc.). Ignores are a safety net, not permission to commit secrets.

If a key was ever committed: rotate it, purge history, and treat the old pubkey as burned.

## Closed desk fence

No mint, no pool, no supply cap, no outsider deposits. Hardening keys does not change that fence.
