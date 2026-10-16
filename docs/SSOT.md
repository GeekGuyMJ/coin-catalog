# Single Source Of Truth for Shared Frontend Code

Created 2026-10-13 in response to GGMJ-181 (recurring regression pattern:
fixes shipped on public, then accidentally reverted on self-hosted, and
vice-versa, because the two trees drifted).

## The two live trees

| Tree                        | Where it's served from                                    | Repo root                |
|-----------------------------|-----------------------------------------------------------|--------------------------|
| Self-hosted (Matthew uses)  | http://coin-catalog.opaleye-bluegill.ts.net/              | /root/coin_catalog_v2/   |
| Public (GitHub Pages)       | https://geekguymj.github.io/coin-catalog/app/             | /root/coin-catalog-public/ |

Self-hosted serves `frontend/`. Public serves `app/`. **They MUST stay in sync**
for every file under `js/app_v2/`, `css/`, `sw.js`, and `index.html` — those
files are one logical app split across two repos.

## Authoritative source (per path)

There is exactly one editable copy of each shared file. Treat the other side
as read-only — it should only change via the sync mechanism (see below).

| Path (relative to repo)                  | Authoritative side     | Why                                                          |
|------------------------------------------|------------------------|--------------------------------------------------------------|
| `frontend/js/app_v2/*.js`                | coin_catalog_v2        | Matthew edits/tests on self-hosted. Public mirrors.          |
| `frontend/js/app_v2/api.js`              | coin_catalog_v2        | Sole exception: keep `assignImage = isSelfHosted` variance — see below. |
| `frontend/css/components.v2.css`         | coin_catalog_v2        | All theme/UI work happens against self-hosted.               |
| `frontend/sw.js`                         | coin_catalog_v2        | SW bump discipline (cache-first CSS) is set manually here.   |
| `frontend/index.html`                    | coin_catalog_v2        | Single-page shell.                                           |
| `app/js/app_v2/*.js`                     | mirrored from frontend | Public build is a stricter relative-path version of the same. |

### Per-coin images / data

The coin image pipeline (`/data/images/...`) is self-hosted only. The public
app calls `resolveImageUrl()` to translate root-absolute paths. That
translation is the ONLY intentional difference in shared JS — it lives behind
the `isSelfHosted` check, not in a separate file.

## The `assignImage` variance (documented exception)

`app/js/app_v2/api.js` in the public repo has:

```js
"assignImage = isSelfHosted"
```

That line is `public_only` in fixguard's fix-markers.json. It exists because
the public GitHub Pages build doesn't run the Flask API — calls that need
the backend stub into the local-only path. **Do not "sync" that away.**

## How to keep them in sync

1. **Edit in coin_catalog_v2.** Test against http://coin-catalog.opaleye-bluegill.ts.net/.
2. **Run fixguard** (`python3 fixguard/fixguard.py audit-live`) — must exit 0.
3. **Copy the edited file(s)** to `coin-catalog-public/app/` and adjust any
   root-absolute paths to relative (`/data/...` → `resolveImageUrl`, etc.).
4. **Bump BOTH SW caches** (`frontend/sw.js` CACHE and `app/sw.js` CACHE)
   plus the `?v=` query on the corresponding `<link>` in `index.html`.
   Update `sw_min` in fixguard/fix-markers.json if you bump past it.
5. **Bump BOTH fix-markers.json** if you add/replace a fix marker.
6. **Commit + push both repos** (pre-push hooks will cross-check — see below).

## Pre-push cross-repo sync check

`coin_catalog_v2/.git/hooks/pre-push` and
`coin-catalog-public/.git/hooks/pre-push` both call:

```
python3 fixguard/check-repo-sync.py
```

That check refuses a push if the two trees' shared files disagree at the
push-time HEAD. It only compares files listed under `shared` in
`fixguard/fix-markers.json`. To add a new shared file, add it to `shared` in
BOTH repos' fixguard/fix-markers.json in the same change.

## History close call

2026-10-12 — Min/Max Year pills were removed on public (commit 686ba90),
shipped, then the search.js image fix in self-hosted silently put them back
because self-hosted's search.js predated that fix. Fixguard's `absent`
rule now blocks the regression, but **the underlying drift between the two
trees is what allowed it**. This document plus the pre-push sync-check are
the structural fix (GGMJ-181).
