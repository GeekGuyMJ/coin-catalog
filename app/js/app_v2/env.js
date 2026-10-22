/**
 * env.js — Coin Catalog v2 — SHARED environment detection.
 *
 * SINGLE SOURCE OF TRUTH for "is this the self-hosted deployment?".
 * api.js, catalog.js and db.js all import isSelfHosted from here, so the
 * three files can no longer drift apart (GGMJ-388, 2026-10-21).
 *
 * Before this module each file had its OWN rule:
 *   api.js     -> only the literal 'opaleye-bluegill.ts.net' and '192.168.0.115'
 *   catalog.js -> any '*.ts.net' or '192.168.*'
 *   db.js      -> any '*.ts.net' or '192.168.*'
 * so a Tailscale short alias ('coin-catalog'), a 10.x / 172.16-31.x LAN
 * address or 127.0.0.1 was classified differently by different modules on
 * the same page. The rule now lives here, once.
 *
 * A host counts as self-hosted when it is:
 *   - a Tailscale MagicDNS FQDN        (....ts.net)
 *   - a short MagicDNS / LAN name       (a single-label host name)
 *   - a private LAN address             (192.168.*, 10.*, 172.16-31.*)
 *   - the loopback interface            (localhost, 127.0.0.1)
 *
 * The static deployments (GitHub Pages, Cloudflare Pages) are reached by
 * public host names, so they match none of these and keep using the
 * local/IndexedDB branch.
 */

export function isSelfHostedHost(hostname) {
    const h = String(hostname || '').trim().toLowerCase();
    if (!h) return false;
    if (h.endsWith('.ts.net')) return true;                        // MagicDNS FQDN
    if (h === 'localhost' || h === '127.0.0.1') return true;       // loopback
    if (h.startsWith('192.168.')) return true;                     // LAN
    if (h.startsWith('10.')) return true;                          // LAN
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;      // LAN
    if (h.indexOf('.') === -1) return true;                        // short alias
    return false;
}

export const isSelfHosted = isSelfHostedHost(
    (typeof location !== 'undefined' && location.hostname) || ''
);
