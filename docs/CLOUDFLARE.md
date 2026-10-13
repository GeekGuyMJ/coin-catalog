# Cloudflare Pages — coin-catalog

Production URL: https://coin-catalog.pages.dev/
Project: coin-catalog
Account: 398d9050e25c160d7afdf317aaf54736

## Deploy model

Cloudflare Pages serves directly from a wrangler upload. It is NOT git-connected
to the published branch. "Builds & deployments" settings in the dashboard
(production branch, build command, output directory, auto-deploy) do not apply —
there is no Cloudflare-side build. The deploy is a file push from LXC 115.

Source bundle: /root/cf-deploy/app on LXC 115.
Upload tool: wrangler 4.83.0 (already installed on LXC 115).

## Why it was stuck at v210 (GGMJ-188)

/root/cf-deploy/app had not been re-synced from /root/coin-catalog-public/app
since v210. Each wrangler deploy simply re-uploaded the same stale tree, so the
live SW stayed at v210 while GitHub Pages moved on. The fix is to refresh the
bundle from the public tree before every deploy:

    pct exec 115 -- rsync -a --exclude=.git /root/coin-catalog-public/app/ /root/cf-deploy/app/

The public tree's index.html already derives APP_BASE correctly for a
root-path host, so a plain rsync works. Do NOT copy /root/coin_catalog_v2/frontend
into /root/cf-deploy — that is the self-hosted tree with absolute paths.

## Deploy command (from proxmox host)

    pct exec 115 -- sh -c "cd /root/cf-deploy && \
      CLOUDFLARE_API_TOKEN=$(cat /root/.cf_token) CLOUDFLARE_ACCOUNT_ID=398d9050e25c160d7afdf317aaf54736 \
      wrangler pages deploy app --project-name coin-catalog --branch main --commit-dirty=true"

Credential: /root/.cf_token on LXC 115 (mode 600). If missing, recover it from
/root/.gemini/antigravity-ide/brain/*/.system_generated/logs/transcript.jsonl
(grep for CLOUDFLARE_API_TOKEN=cfut_...) and rewrite the file, mode 600.
Never print the token.

Wrangler only uploads files whose bytes changed.

## Verify

    curl -s -A "Mozilla/5.0" https://coin-catalog.pages.dev/sw.js | grep -o 'coin-catalog-v[0-9]*'

Should match the version in /root/coin-catalog-public/app/sw.js. Cloudflare
403s plain scripted GETs without a browser User-Agent — always pass one.

If Cloudflare's edge lags, poll the per-deployment hash URL printed by
wrangler (https://<hash>.coin-catalog.pages.dev) — that resolves to the new
bundle immediately while the friendly URL catches up.

## Definition-of-done checklist after each deploy

- [ ] sw.js on coin-catalog.pages.dev matches the public tree version.
- [ ] Default 2026-10-09 card order renders on the dashboard (open a fresh
      browser session, not a cached tab).
- [ ] A trivial edit + rsync + wrangler deploy reflects within ~60s end-to-end.
