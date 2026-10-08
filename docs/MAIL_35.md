# Mail lock — elghaly.dev

**Status:** set up (2026-09-12)

Inbound and outbound are separate. One MX family only.

Do not invent passwords. Do not touch the `35` CNAME that points at `alarm2024.github.io`. Do not add a second competing MX set.

## Lock

- **Inbound:** Cloudflare Email Routing to the owner's private inbox. The destination address is kept out of this repo.
- **Outbound primary:** Gmail **Send mail as** `wyndham35@elghaly.dev` from that same inbox
- Adding `35@`, `support@`, `info@`, or `admin@` as send-as aliases is ops (Gmail settings), not code.
- Site DNS stays:

```text
CNAME   35    alarm2024.github.io
```

Public site: https://35.elghaly.dev

## Inbound — Cloudflare Email Routing

1. Open [dash.cloudflare.com](https://dash.cloudflare.com) → zone `elghaly.dev`.
2. Email → Email Routing. Enable / Onboard Domain. Let Cloudflare add MX + SPF.
3. Destination addresses → Add the private inbox → confirm the mail Cloudflare sends to it.
4. Routing rules:
   - Set the routing rules in the dashboard so the addresses you use reach that inbox.
5. Send a test to `35@elghaly.dev` from a third account. It must land in that inbox.

Typical MX/TXT Cloudflare adds (dashboard wins if hostnames differ):

```text
MX   @    amir.mx.cloudflare.net     13
MX   @    isaac.mx.cloudflare.net    24
MX   @    linda.mx.cloudflare.net    86
TXT  @    v=spf1 include:_spf.mx.cloudflare.net ~all
```

DNS only. No orange cloud on MX/TXT.

## Outbound — Gmail Send mail as

Free path. No Workspace seat required.

1. Gmail (the private inbox) → Settings → See all settings → Accounts and Import → Send mail as → Add another email address.
2. Name: `35`. Address: `wyndham35@elghaly.dev`.
3. Treat as an alias. Gmail will send a confirmation to `wyndham35@elghaly.dev`.
4. That confirmation arrives in the same inbox through Email Routing. Open it and confirm.
5. SPF already includes Cloudflare if you only forward. If Gmail SMTP is used to send as the domain, add Gmail to SPF **by merging**, not replacing:

```text
v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all
```

Do not switch the zone to Google Workspace MX while Routing is the inbound path.

## Do not

- Add Google Workspace MX while Cloudflare Routing MX exists.
- Edit or delete `CNAME 35 → alarm2024.github.io`.
- Invent an App Password here. Gmail will prompt if it needs one.
