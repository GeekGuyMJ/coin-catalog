#!/usr/bin/env python3
"""fixguard.py — coin catalog regression guard.

Modes:
  check-public-repo   — audit the public repo WORKING TREE (used by the pre-push hook)
  audit-live          — curl BOTH live apps' served bytes + read self-hosted files and verify every marker
  self-files          — audit /root/coin_catalog_v2/frontend (self-hosted build tree)

Exit 0 = all markers present; exit 1 = a fix marker is MISSING (regression) with a
report of exactly which fixes vanished. Add --report-only to print without failing.

Usage:
  python3 fixguard.py check-public-repo [repo_root]
  python3 fixguard.py audit-live
  python3 fixguard.py self-files [frontend_root]
"""
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REG = json.load(open(os.path.join(HERE, 'fix-markers.json')))


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
    req = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
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
            try:
                text = fetch(url)
            except Exception as e:
                fail(f'{tag} {url}: fetch failed {e}', errors)
                continue
            lab = f'live-{tag}:{name}'
            check_text(lab, text, errors)
            check_order(lab, text, errors)
            check_public_only(lab, text, errors)
            if name == 'sw.js':
                check_sw(f'live-{tag} sw', text, errors)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'audit-live'
    errors = []
    if mode == 'check-public-repo':
        root = sys.argv[2] if len(sys.argv) > 2 else '/root/coin-catalog-public'
        audit_repo(root, 'public-repo', errors)
    elif mode == 'self-files':
        root = sys.argv[2] if len(sys.argv) > 2 else '/root/coin_catalog_v2/frontend'
        audit_repo(root, 'self-repo', errors)
    elif mode == 'audit-live':
        audit_live(errors)
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
