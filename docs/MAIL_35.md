# Mail: 35@elghaly.dev

Preferred path is a **forward**, not a new Workspace seat.

Do not invent passwords. Do not touch the `35` CNAME that points at `alarm2024.github.io`. Do not add a second competing MX set.

## Preferred — Cloudflare Email Routing

Forward `35@elghaly.dev` to an inbox that already works.

Use `wyndham35@elghaly.dev` as the destination **only if that address already receives mail**. If it does not exist, use a personal inbox you already control.

### Taps

1. Open [dash.cloudflare.com](https://dash.cloudflare.com) → zone `elghaly.dev`.
2. Email → Email Routing (or Compute → Email Service → Email Routing).
3. Enable / Onboard Domain. Let Cloudflare add MX + SPF. Do not type a password.
4. Destination addresses → Add → existing inbox → confirm the message Cloudflare sends.
5. Routing rules → Custom address:
   - Custom: `35`
   - Action: Send to an email
   - Destination: the confirmed inbox
6. Save. Send a test to `35@elghaly.dev` from a third account.

### Records Cloudflare should add (confirm, do not invent extras)

Typical set (dashboard wins if names differ):

```text
MX   @    amir.mx.cloudflare.net     13
MX   @    isaac.mx.cloudflare.net    24
MX   @    linda.mx.cloudflare.net    86
TXT  @    v=spf1 include:_spf.mx.cloudflare.net ~all
```

Newer onboard flows may use `route1.mx.cloudflare.net` / `route2` / `route3`. Use the Email Routing settings page.

If Google Workspace SPF already exists, merge. Do not replace:

```text
v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all
```

DNS only on MX/TXT. Leave the existing record alone:

```text
CNAME   35    alarm2024.github.io
```

## Workspace path — only if you want a real mailbox

1. Google Admin for `elghaly.dev`.
2. Directory → Users → Add user `35`. Google emails the password setup to you. Do not invent one.
3. Use **Google’s** MX/TXT as receiver. Do not keep Cloudflare Routing MX at the same time.

Pick one receiver. Never two MX families.
