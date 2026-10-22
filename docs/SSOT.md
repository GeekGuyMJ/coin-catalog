# Single Source Of Truth for Shared Frontend Code

Created 2026-10-13 in response to GGMJ-181 (recurring regression pattern:
fixes shipped on public, then accidentally reverted on self-hosted, and
vice-versa, because the two trees drifted).

## The two live trees

| Tree                        | Where it's served from                                    | Repo root                |
|-----------------------------|-----------------------------------------------------------|--------------------------|
| Self-hosted (Matthew uses)  | http://coin-catalog.opaleye-bluegill.ts.net/              | /root/coin_catalog_v2/   |
| Public (GitHub Pages)       | https://geekguymj.github.io/coin-catalog/app/             | /root/coin-catalog-public/ |

### The self-hosted SERVED tree is a release, not the repo (GGMJ-398, 2026-10-21)

Since GGMJ-398 the live webroot is NO LONGER the git working tree of
`/root/coin_catalog_v2`. It is a published release directory:

    nginx root  ->  /srv/live/current  ->  /root/coin_catalog_live/releases/<UTC stamp>

`/root/coin_catalog_live/current` is a symlink to the active release; releases are
independent copies (no `--link-dest`), so editing a file inside a release can never
reach a newer one. The `coin_web_v2` container bind-mounts `/root/coin_catalog_live`
(read-write) and **no longer mounts `frontend/`** — the container config and the repo
are no longer the same thing.

**Consequences — read this before deploying:**

- The repo is the SOURCE tree. `/root/coin_catalog_v2/frontend` is what gets published,
  not what gets served. Do not edit the live tree; it is replaced on every publish.
- Publish with `scripts/deploy_live_frontend.sh` (add `--src <dir>` to publish a
  different tree, `--status` to show the live release, `--rollback` to swap back).
  The script builds the candidate release, verifies it, and only then flips the symlink.
- A `git checkout`, `git reset --hard`, or branch switch in the repo no longer changes
  the live site. That was the point of GGMJ-398 — but it also means an UNCOMMITTED
  fix in the repo will be silently dropped by the next publish, because the publish
  copies the WORKING TREE but the next clean checkout restores `HEAD`. Commit fixes
  to the branch you intend to publish from.
- A file that exists only in the working tree (or only in an untracked hashed module
  plus a symlink) is at risk. Commit BOTH the new hashed file and the symlink.

Self-hosted publishes `frontend/` (as a release, see above). Public serves `app/`.
**They MUST stay in sync**
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

## Landing gate (required before closing a shared-file issue)

**A shared-file fix is not shipped until it is live on ALL THREE
deployments, and no issue that touches a shared file may be closed until that
has been MEASURED on the served bytes.**

Three deployments, three separate trees:

| deployment | served from | built from |
|---|---|---|
| self-hosted | `http://192.168.0.115` | `/root/coin_catalog_v2` @ `deployed-frontend`, published to `/root/coin_catalog_live/current` (a release directory) |
| GitHub Pages | `https://geekguymj.github.io/coin-catalog/app` | `/root/coin-catalog-public` @ `published` (pushed) |
| Cloudflare Pages | `https://coin-catalog.pages.dev` | `/root/coin-catalog-public` @ `cloudflare` (LOCAL branch, never pushed) |

A commit that exists in a clone is a CLAIM. `git log --all` finds commits that
are on no branch any deployment builds from - a dangling commit looks merged
and never deploys. That is how GGMJ-412 stayed broken on Cloudflare while
`git log --all` showed the fix.

### The check

```sh
python3 /root/fixguard/fixguard.py landing-gate            # all shared-file fixes
python3 /root/fixguard/fixguard.py landing-gate --issue GGMJ-412
```

It fetches the SERVED bytes of each deployment over the wire and checks, per
issue, three things per deployment:

1. **the marker** - read from the bytes the server actually serves;
2. **the ancestor check** - the fix commit must be an ancestor of the ref that
   deployment is built from, so a dangling commit cannot pass;
3. **byte identity** - the served file must equal the committed file, and on
   self-hosted the file in the published release directory, so an un-published
   commit cannot pass.

A FAIL blocks the close. The per-issue markers live in `fix-markers.json`'s
`landings` section, so the marker set is reviewable data rather than a list
inside a script.

### Closing an issue

Use the closer, which runs the gate and refuses to close when it fails:

```sh
python3 scripts/close_issue.py GGMJ-412 --run-id <run-id>
```

The close comment carries the gate's per-deployment table with the measured
byte counts, so the record shows the measurement rather than an assertion.

### Markers that must be scoped

A marker is a string in a file, and a file can hold many features. A
file-level marker for a fix that only applies to ONE function reports a MISS
forever, and an always-FAIL row teaches the reader to discount the whole
table. GGMJ-432 is the example: `modals.js` holds many modals and three
OTHER modals in it legitimately fetch 5000 coins, so the pricing-modal fix is
scoped to `openPricingRulesModal`:

```json
"GGMJ-432": {
  "path": "js/app_v2/modals.js",
  "marker": "limit=5000",
  "expect": "absent",
  "scope": "openPricingRulesModal"
}
```

A scoped marker whose scope cannot be found FAILS the gate - a marker that
cannot be located must not pass silently.
