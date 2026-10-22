/**
 * env.js — Coin Catalog v2 — Shared environment detection.
 *
 * Single source of truth for self-hosted detection across all modules.
 * Import this instead of inline hostname checks.
 */

export function isSelfHosted() {
    const h = (typeof location !== 'undefined' && location.hostname) || '';
    return h.endsWith('.ts.net') ||
           h.startsWith('192.168.') ||
           h.startsWith('10.') ||
           /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h) ||
           h === 'localhost' ||
           h === '127.0.0.1';
}
