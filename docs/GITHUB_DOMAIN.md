# GitHub domain verify — elghaly.dev

Document only. Do not paste the TXT value into Cloudflare from this repo. Copy it from GitHub at the moment you verify.

This is for the **apex** `elghaly.dev` organization/user domain check. The site itself already uses the subdomain CNAME:

```text
35.elghaly.dev    CNAME    alarm2024.github.io
```

Do not edit that CNAME while verifying.

## Taps

1. Open [github.com/settings/pages](https://github.com/settings/pages) while logged in as `Alarm2024`.
2. Under **Verified domains** / **Add a domain**, enter `elghaly.dev`.
3. GitHub shows a TXT record. Copy the **name** and **value** verbatim. Do not retype.
4. In Cloudflare → `elghaly.dev` → DNS → Add record:
   - Type: `TXT`
   - Name: exactly what GitHub printed (often `_github-pages-challenge-Alarm2024` or similar)
   - Content: exactly what GitHub printed
   - Proxy: DNS only
5. Wait one to five minutes.
6. Back on GitHub Pages settings, click **Verify**.
7. Do not delete the challenge TXT until GitHub says the domain is verified.

If GitHub instead asks to verify from [github.com/Alarm2024/35/settings/pages](https://github.com/Alarm2024/35/settings/pages) under Custom domain, that check is for `35.elghaly.dev` and is already green when DNS check successful is showing.
