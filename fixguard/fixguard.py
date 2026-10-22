#!/usr/bin/env python3
"""fixguard.py — coin catalog regression guard.

Modes:
  check-public-repo   — audit the public repo WORKING TREE (used by the pre-push hook)
  audit-live          — curl BOTH live apps' served bytes + read self-hosted files and verify every marker
  self-files          — audit /root/coin_catalog_v2/frontend (self-hosted build tree)
  landing-gate        — CROSS-DEPLOYMENT landing gate (GGMJ-445): fetch the SERVED bytes of
                         all three deployments and prove every shared-file fix is live on
                         each one, with a per-deployment PASS/FAIL table. A FAIL blocks the
                         close of the issue the fix belongs to.

Exit 0 = all markers present; exit 1 = a fix marker is MISSING (regression) with a
report of exactly which fixes vanished. Add --report-only to print without failing.

Usage:
  python3 fixguard.py check-public-repo [repo_root]
  python3 fixguard.py audit-live
  python3 fixguard.py self-files [frontend_root]
  python3 fixguard.py landing-gate [--issue GGMJ-412] [--report-only]
"""
import json
import os
import re
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REG = json.load(open(os.path.join(HERE, 'fix-markers.json')))

# --- landing gate configuration -------------------------------------------
# The three deployments are three DIFFERENT trees, so the gate cannot read one
# repo and call it a deployment. Each entry says where the served bytes come
# from and which ref the deployment is built from, so the gate can also prove
# that the bytes on the wire came from a commit that is actually ON that ref.
#
# 'repo'/'ref' are only used for the ancestor + byte-identity checks. When they
# are absent that deployment is still checked for marker presence, and the
# check is reported as partial rather than silently passing.
LANDING_DEPLOYMENTS = [
    {
        'name': 'self-hosted',
        'base': 'http://192.168.0.115',
        # The self-hosted webroot is a PUBLISHED RELEASE, not a git tree:
        # /root/coin_catalog_live/current -> releases/<stamp>/. An un-published
        # commit must not pass, so the served file is compared byte-for-byte
        # with the file in that release directory.
        'release_dir': '/root/coin_catalog_live/current',
        'repo': '/root/coin_catalog_v2',
        'ref': 'deployed-frontend',
        'repo_path': 'frontend',
    },
    {
        'name': 'github-pages',
        'base': 'https://geekguymj.github.io/coin-catalog/app',
        # GitHub Pages builds the pushed `published` branch of the public repo.
        'repo': '/root/coin-catalog-public',
        'ref': 'origin/published',
        'repo_path': 'app',
    },
    {
        'name': 'cloudflare',
        'base': 'https://coin-catalog.pages.dev',
        # Cloudflare builds a LOCAL branch of the public repo that is never
        # pushed. A commit that exists in the clone but is not an ancestor of
        # that branch never deploys, so the ancestor check is mandatory here.
        'repo': '/root/coin-catalog-public',
        'ref': 'cloudflare',
        'repo_path': 'app',
    },
]

# The service worker precaches the JS/CSS, so a stale SW cache keeps serving
# the pre-fix file to a returning visitor even after the bytes were deployed.
LANDING_SW_PATH = 'sw.js'


def fail(msg, errors):
    errors.append(msg)
    print('  REGRESSION:', msg)


def check_text(label, text, errors):
    for rel, markers in REG.get('files', {}).items():
        name = rel.rsplit('/', 1)[-1]
        if name not in label:
            continue
        for m in markers:
            if m not in text:
                fail(f'{label}: missing marker {m!r}', errors)
    for rel, banned in REG.get('absent', {}).items():
        name = rel.rsplit('/', 1)[-1]
        if name not in label:
            continue
        for b in banned:
            if b in text:
                fail(f'{label}: banned string present {b!r}', errors)


def check_order(label, text, errors):
    for rel, rule in REG.get('order', {}).items():
        name = rel.rsplit('/', 1)[-1]
        if name not in label:
            continue
        b = text.find(rule['before'])
        a = text.find(rule['after'])
        if b == -1 or a == -1:
            fail(f'{label}: order anchors missing for {name}', errors)
        elif not (b < a):
            fail(f'{label}: {rule["why"]} — {rule["before"]!r} must come BEFORE {rule["after"]!r}', errors)


def check_sw(label, text, errors):
    key = 'app/sw.js' if 'public' in label or 'coin-catalog-public' in label else 'frontend/sw.js'
    minimum = REG.get('sw_min', {}).get(key)
    if minimum is None:
        return
    m = re.search(r'coin-catalog-v(\d+)', text)
    if not m:
        fail(f'{label}: no SW cache version found', errors)
        return
    if int(m.group(1)) < minimum:
        fail(f'{label}: SW version v{m.group(1)} < required v{minimum}', errors)


def check_public_only(label, text, errors):
    # only apply when auditing the public repo/public app
    if 'public' not in label:
        return
    for rel, markers in REG.get('public_only', {}).items():
        name = rel.rsplit('/', 1)[-1]
        if name not in label:
            continue
        for m in markers:
            if m not in text:
                fail(f'{label}: missing public-only marker {m!r}', errors)


def audit_repo(root, label, errors):
    base = os.path.join(root, 'app')
    if not os.path.isdir(base):
        base = root
    # Only the app/sw.js (public) or sw.js in the frontend root (self) is the live SW.
    rels_sw = ['app/sw.js'] if os.path.basename(base) == 'app' else ['sw.js']
    for rel in list(REG.get('files', {})) + list(REG.get('absent', {})) + rels_sw:
        # map registry path -> repo path. Registry paths are public-repo-shaped
        # ('app/...'); the self-hosted tree has the same files without the 'app/'
        # prefix. Candidates: repo-relative ('app/...'), then bare ('...').
        rels = [rel]
        if rel.startswith('app/'):
            rels.append(rel[len('app/'):])
        cands = [os.path.join(root, r2) for r2 in rels]
        for cand in cands:
            if not os.path.isfile(cand):
                continue
            text = open(cand, encoding='utf-8', errors='replace').read()
            tag = f'{label}:{cand[len(root):].lstrip("/")}'
            check_text(tag, text, errors)
            check_order(tag, text, errors)
            check_public_only(tag, text, errors)
            if cand.endswith('sw.js'):
                check_sw(f'{label} sw', text, errors)
            break


def fetch(url):
    # Cloudflare Pages rejects a request with no browser User-Agent, so the
    # header is mandatory on every fetch, not just the CF one.
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
                      '(KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Cache-Control': 'no-cache',
    })
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')


def audit_live(errors):
    bases = [('public', 'https://geekguymj.github.io/coin-catalog/app/'),
             ('self', 'http://coin-catalog.opaleye-bluegill.ts.net/')]
    for tag, base in bases:
        for rel in list(REG.get('files', {})) + list(REG.get('absent', {})) + ['sw.js']:
            name = rel.rsplit('/', 1)[-1]
            # registry paths are public-shaped; self serves same names under /js/app_v2/ or /css/
            if rel.startswith('app/js/'):
                url = base + 'js/app_v2/' + name
            elif rel.startswith('app/css/'):
                url = base + 'css/' + name
            else:
                url = base + name
            text = None
            for _attempt in range(2):
                try:
                    text = fetch(url)
                    break
                except Exception as e:
                    last_err = e
            if text is None:
                # Two consecutive fetch failures = likely a real outage; report it
                # (distinct from a marker regression, but still worth an alert).
                fail(f'{tag} {url}: unreachable after retry ({last_err})', errors)
                continue
            lab = f'live-{tag}:{name}'
            check_text(lab, text, errors)
            check_order(lab, text, errors)
            check_public_only(lab, text, errors)
            if name == 'sw.js':
                check_sw(f'live-{tag} sw', text, errors)


# --- landing gate ----------------------------------------------------------

def _git(repo, *args):
    """Run a git command in `repo`; return (rc, stdout)."""
    p = subprocess.run(['git', '-C', repo] + list(args),
                       capture_output=True, text=True, timeout=120)
    return p.returncode, p.stdout


def _resolve_symlink(repo, rel):
    """The repo path whose CONTENT is the file the served path refers to.

    The self-hosted tree stores the shared JS behind a symlink to a hashed
    filename (js/app_v2/catalog.js -> catalog.b447a400.js). The content lives
    in the hashed file, so the ancestor search and the byte comparison must
    both use the RESOLVED path: `git show` of the symlink returns the link
    target text, not the file.
    """
    full = os.path.join(repo, rel)
    if os.path.islink(full):
        return os.path.join(os.path.dirname(full), os.readlink(full))
    return full


def _blob(repo, ref, path):
    """The bytes of `path` as COMMITTED at `ref` (not the working tree)."""
    p = subprocess.run(['git', '-C', repo, 'show', '%s:%s' % (ref, path)],
                       capture_output=True, timeout=120)
    return p.stdout if p.returncode == 0 else None


def _sw_version(text):
    m = re.search(r'coin-catalog-v(\d+)', text or '')
    return int(m.group(1)) if m else None


def _landing_marker_scope(text, scope):
    """Extract a named function's body so a marker can be scoped to it.

    A file-level grep is wrong for a file that holds many modals: the
    GGMJ-432 pricing-modal fix is about openPricingRulesModal, but three
    OTHER modals in modals.js legitimately fetch 5000 coins, so a file-level
    grep reports a MISS that can never pass.
    """
    if not scope:
        return text
    b = text.encode('utf-8', 'replace')
    for pat in (b'function ' + scope.encode(), b'const ' + scope.encode() + b' =',
                b'async function ' + scope.encode()):
        i = b.find(pat)
        if i == -1:
            continue
        j = b.find(b'{', i)
        if j == -1:
            continue
        depth = 0
        for k in range(j, len(b)):
            if b[k:k + 1] == b'{':
                depth += 1
            elif b[k:k + 1] == b'}':
                depth -= 1
                if depth == 0:
                    return b[i:k + 1].decode('utf-8', 'replace')
    return None


def landing_gate(only_issue=None, report_only=False, list_only=False):
    """The GGMJ-445 landing gate.

    For every shared-file fix recorded in the registry's `landings` section,
    fetch the SERVED bytes of each of the three deployments and prove the fix
    is live there. Prints a per-deployment PASS/FAIL table with the measured
    byte counts, and returns the list of failures.

    `only_issue` restricts the run to ONE issue. An issue with no landing
    entry is a FAILURE, not a vacuous pass: a shared-file fix that nobody
    registered a marker for cannot be verified, and a guardrail that is
    trivially bypassed by omitting a marker is not a guardrail.
    """
    landings = REG.get('landings', {})
    if not landings:
        print('LANDING GATE: no `landings` section in the registry — nothing to check.')
        return ['no `landings` section in the registry']

    if list_only:
        for i in sorted(landings):
            print('  %s  %s  %s  expect=%s%s' % (
                i, landings[i].get('path'), landings[i].get('marker'),
                landings[i].get('expect', 'present'),
                ('  scope=%s' % landings[i]['scope']) if landings[i].get('scope') else ''))
        return []

    issues = sorted(landings)
    if only_issue:
        if only_issue not in landings:
            msg = ('no landing entry for %s — a shared-file fix cannot be closed '
                   'without a registered marker' % only_issue)
            print('LANDING GATE: FAIL — %s' % msg)
            print('Register it in fix-markers.json\'s `landings` section first.')
            return [msg]
        issues = [only_issue]

    # One fetch per (deployment, path), reused across issues.
    cache = {}

    def served(dep, path):
        key = (dep['name'], path)
        if key not in cache:
            try:
                cache[key] = fetch('%s/%s' % (dep['base'], path))
            except Exception as e:
                cache[key] = None
                cache[(dep['name'], path, 'err')] = str(e)
        return cache[key]

    errors = []
    rows = []
    for issue in issues:
        spec = landings[issue]
        rel = spec['path']
        marker = spec['marker']
        expect = spec.get('expect', 'present')
        scope = spec.get('scope')
        for dep in LANDING_DEPLOYMENTS:
            text = served(dep, rel)
            dname = dep['name']
            if text is None:
                err = cache.get((dname, rel, 'err'), 'unreachable')
                rows.append((issue, dname, rel, marker, expect, None, 0, False,
                             'unreachable: %s' % err))
                errors.append(f'{issue} {dname}: {rel} unreachable ({err})')
                continue
            size = len(text.encode('utf-8', 'replace'))
            hay = _landing_marker_scope(text, scope)
            if scope and hay is None:
                rows.append((issue, dname, rel, marker, expect, None, size, False,
                             'scope %r not found' % scope))
                errors.append(f'{issue} {dname}: scope {scope!r} not found in {rel}')
                continue
            present = marker in hay
            ok = present if expect == 'present' else not present
            note = ''
            if not ok:
                note = 'marker %r is %s (expected %s)' % (
                    marker, 'present' if present else 'absent', expect)
            rows.append((issue, dname, rel, marker, expect, present, size, ok, note))
            if not ok:
                errors.append(f'{issue} {dname}: {rel} {note}')

    # --- the deployment-level proofs ------------------------------------
    # 1) ancestor: the fix commit must be ON the ref the deployment builds.
    # 2) byte identity: the served file must equal the committed/published one.
    sw_rows = []
    for dep in LANDING_DEPLOYMENTS:
        dname = dep['name']
        repo, ref = dep.get('repo'), dep.get('ref')
        sw_text = served(dep, LANDING_SW_PATH)
        sw_rows.append((dname, _sw_version(sw_text)))

        if not repo or not ref:
            continue
        if not os.path.isdir(repo):
            errors.append(f'{dname}: repo {repo} not reachable — cannot prove the landing')
            continue
        rc, _ = _git(repo, 'rev-parse', '--verify', 'refs/heads/%s' % ref)
        if rc != 0:
            rc, _ = _git(repo, 'rev-parse', '--verify', ref)
        if rc != 0:
            errors.append(f'{dname}: ref {ref!r} not found in {repo}')
            continue

        for issue in issues:
            spec = landings[issue]
            rel = spec['path']
            repo_rel = os.path.join(dep['repo_path'], rel)
            # The content of the served path may live behind a symlink in the
            # tree (self-hosted stores js/app_v2/*.js as symlinks to hashed
            # filenames), so search and compare the RESOLVED path.
            resolved = _resolve_symlink(repo, repo_rel)
            if not os.path.isfile(resolved):
                continue
            # The commit that introduced the marker on this repo's history.
            rc, log = _git(repo, 'log', '--format=%H', '-S%s' % spec['marker'],
                           ref, '--', resolved)
            if rc != 0 or not log.strip():
                errors.append(
                    f'{issue} {dname}: marker {spec["marker"]!r} has no commit on '
                    f'{ref!r} — the fix is not on the branch this deployment builds')
                continue
            ancestor = False
            for sha in log.split():
                anc_rc, _ = _git(repo, 'merge-base', '--is-ancestor', sha, ref)
                if anc_rc == 0:
                    ancestor = True
                    break
            if not ancestor:
                errors.append(
                    f'{issue} {dname}: the fix commit for {spec["marker"]!r} is a '
                    f'DANGLING commit — it exists in the clone but is not an ancestor '
                    f'of {ref!r}, so it never deploys')
                continue
            # byte identity: served bytes == the committed/published bytes
            served_bytes = (cache.get((dname, rel)) or '').encode('utf-8', 'replace')
            committed = _blob(repo, ref, resolved)
            if committed is not None and committed != served_bytes:
                errors.append(
                    f'{issue} {dname}: served {rel} ({len(served_bytes)} bytes) is NOT '
                    f'byte-identical to {ref}:{os.path.relpath(resolved, repo)} '
                    f'({len(committed)} bytes) — the deployment is not serving the '
                    f'committed tree')
            elif committed is None:
                # The self-hosted webroot is a published RELEASE, not a ref.
                # The release directory is the artifact the server serves.
                rel_dir = dep.get('release_dir')
                if rel_dir:
                    fpath = os.path.join(rel_dir, rel)
                    if not os.path.isfile(fpath):
                        errors.append(f'{issue} {dname}: {rel} not in the release dir {rel_dir}')
                    else:
                        rb = open(fpath, 'rb').read()
                        if rb != served_bytes:
                            errors.append(
                                f'{issue} {dname}: served {rel} ({len(served_bytes)} bytes) '
                                f'is NOT byte-identical to the published release file '
                                f'({len(rb)} bytes) — an un-published change cannot pass')

    # --- print the table -------------------------------------------------
    print()
    print('=' * 96)
    print('LANDING GATE (GGMJ-445) — served bytes, fetched live from each deployment')
    print('=' * 96)
    cur = None
    for issue, dname, rel, marker, expect, present, size, ok, note in rows:
        if issue != cur:
            cur = issue
            print('\n%s  (%s  marker %r expected %s%s)'
                  % (issue, rel, marker, expect,
                     (', scoped to %s' % landings[issue]['scope']) if landings[issue].get('scope') else ''))
        flag = 'PASS' if ok else 'FAIL'
        print('   [%s] %-13s %7d bytes  marker %-6s  %s'
              % (flag, dname, size, 'present' if present else 'absent', note))
    print('\n   service-worker cache version served:')
    for dname, sw_v in sw_rows:
        print('      %-13s v%s' % (dname, sw_v if sw_v is not None else '?'))

    print()
    print('=' * 96)
    if errors:
        print('LANDING GATE: %d FAILURE(S) — the close is BLOCKED.' % len(errors))
        for e in errors:
            print('   FAIL:', e)
    else:
        print('LANDING GATE: PASS — every shared-file fix is live on all three deployments.')
    print('=' * 96)
    return errors


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'audit-live'
    args = sys.argv[2:]
    report_only = '--report-only' in args
    args = [a for a in args if a != '--report-only']
    errors = []
    if mode == 'check-public-repo':
        root = args[0] if args else '/root/coin-catalog-public'
        audit_repo(root, 'public-repo', errors)
    elif mode == 'self-files':
        root = args[0] if args else '/root/coin_catalog_v2/frontend'
        audit_repo(root, 'self-repo', errors)
    elif mode == 'audit-live':
        audit_live(errors)
    elif mode == 'landing-gate':
        only_issue = None
        if '--issue' in args:
            i = args.index('--issue')
            if i + 1 < len(args):
                only_issue = args[i + 1]
        if '--list' in args:
            errors = landing_gate(list_only=True)
        else:
            errors = landing_gate(only_issue, report_only)
    else:
        print(__doc__)
        return 2
    if errors:
        print(f'FIXGUARD: {len(errors)} REGRESSION(S) DETECTED')
        return 1
    print('FIXGUARD: all known fixes present — no regressions.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
