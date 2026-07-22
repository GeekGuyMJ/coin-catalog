/**
 * utils.js — Coin Catalog v2
 *
 * Pure utility functions shared across all modules.
 * No DOM access, no API calls, no side effects — just helpers.
 *
 * @module utils
 */

// ============================================================
// String / HTML helpers
// ============================================================

/**
 * Escape a string for safe insertion into HTML innerHTML.
 * Prevents XSS when displaying user-supplied or database content.
 *
 * @param {*} s - Value to escape.
 * @returns {string} HTML-escaped string.
 */
export function escHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Format a numeric dollar value for compact display.
 * < $1,000      → $X.XX
 * $1,000–$999K  → $X.XK
 * >= $1M        → $X.XM
 *
 * @param {number|string} val - Numeric value.
 * @returns {string} Formatted string.
 */
export function formatCurrency(val) {
    const v = parseFloat(val);
    if (!v || isNaN(v)) return '$0.00';
    if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 10_000)    return '$' + (v / 1_000).toFixed(1) + 'K';
    return '$' + v.toFixed(2);
}

/**
 * Format a number with comma thousands separators.
 *
 * @param {number|string} n - Number to format.
 * @returns {string} Formatted string (e.g. "1,234,567").
 */
export function formatNumber(n) {
    const v = parseInt(n, 10);
    return isNaN(v) ? '–' : v.toLocaleString();
}

// ============================================================
// Coin display helpers
// ============================================================

/**
 * Build a "(1909–1958)" date-span label from an array of coins.
 * Filters out anomalous years (0, 1776 Bicentennial placeholder).
 *
 * @param {Array<{year: number}>} coins - Array of coin objects.
 * @returns {string} Year span string, or '' if no valid years.
 */
export function typeYearSpan(coins) {
    const years = coins
        .map(c => c.year)
        .filter(y => y && y > 1700 && y !== 1776);
    if (!years.length) return '';
    const min = Math.min(...years);
    const max = Math.max(...years);
    return min === max ? ` (${min})` : ` (${min}–${max})`;
}

/**
 * Mint mark sort rank — keeps P/blank first, then D, S, O, CC, W.
 *
 * @param {string} mint - Mint mark string.
 * @returns {number} Sort rank (lower = earlier).
 */
const MINT_RANK = { P: 0, '': 0, D: 1, S: 2, O: 3, CC: 4, W: 5, C: 6, H: 7 };
export function mintRank(mint) {
    return MINT_RANK[mint] !== undefined ? MINT_RANK[mint] : 8;
}

/**
 * Sort year — maps 1776 (Bicentennial CSV placeholder) to 1976.
 *
 * @param {Object} coin - Coin object with .year.
 * @returns {number} Effective sort year.
 */
export function sortYear(coin) {
    return coin.year === 1776 ? 1976 : (coin.year || 9999);
}

/**
 * Compare two coins for standard catalogue sort order:
 * year → sub-type → mint mark.
 *
 * @param {Object} a - Coin object.
 * @param {Object} b - Coin object.
 * @returns {number} Standard comparator result.
 */
export function coinSortComparator(a, b) {
    const yearDiff = sortYear(a) - sortYear(b);
    if (yearDiff !== 0) return yearDiff;
    const subA = a.coin_type || '';
    const subB = b.coin_type || '';
    const subDiff = subA.localeCompare(subB);
    if (subDiff !== 0) return subDiff;
    return mintRank(a.mint_mark || '') - mintRank(b.mint_mark || '');
}

/**
 * Format mint mark for display. Removes 'P' from pennies prior to 2017.
 * @param {Object} coin 
 * @returns {string} Formatted mint mark
 */
export function formatMintMark(coin) {
    if (!coin.mint_mark) return '';
    // Special rule for US Pennies from Philadelphia
    if (coin.mint_mark === 'P' && coin.year !== 2017) {
        // If it's a penny (1 Cent)
        const typeStr = (coin.coin_type || '').toLowerCase();
        const denomStr = (coin.denomination || '').toLowerCase();
        if (denomStr === '1 cent' || typeStr.includes('cent')) {
            return '';
        }
    }
    return coin.mint_mark;
}

/**
 * Format a mintage count for compact display (e.g., 586.4M, 1.3B, 258K).
 *
 * @param {number|string} mintage - Numeric mintage count.
 * @returns {string} Compact formatted string.
 */
export function formatMintage(mintage) {
    const v = parseInt(mintage, 10);
    if (isNaN(v) || v <= 0) return '';
    if (v >= 1_000_000_000) {
        return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (v >= 1_000_000) {
        return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (v >= 1_000) {
        return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return v.toString();
}

// ============================================================
// Type grouping helpers
// ============================================================

/**
 * Find the index of a " - " separator that is NOT inside parentheses.
 * e.g. "Buffalo (Type I - Mound)" → -1  (dash is inside parens)
 *      "50 State Quarters - Alabama" → 18
 *
 * @param {string} str - Input string.
 * @returns {number} Index of separator, or -1.
 */
export function findSplitDash(str) {
    let depth = 0;
    for (let i = 0; i < str.length - 2; i++) {
        if (str[i] === '(') depth++;
        else if (str[i] === ')') depth--;
        else if (depth === 0 && str.substring(i, i + 3) === ' - ') return i;
    }
    return -1;
}

/**
 * Extract the "main type" from a full coin_type string.
 * "50 State Quarters - Alabama" → "50 State Quarters"
 * "Lincoln Wheat (VDB)"         → "Lincoln Wheat"
 * "Westward Journey Nickel"     → "Jefferson"  (special rule)
 *
 * @param {string} fullType - Full coin_type value.
 * @returns {string} Main type for accordion grouping.
 */
export function getMainType(fullType) {
    if (!fullType) return 'Unknown';
    if (fullType.startsWith('Westward Journey')) return 'Jefferson';
    const dashIdx = findSplitDash(fullType);
    if (dashIdx >= 0) return fullType.substring(0, dashIdx).trim();
    const parenStart = fullType.indexOf(' (');
    if (parenStart > 0) return fullType.substring(0, parenStart).trim();
    return fullType.trim();
}

/**
 * Extract the sub-type from a full coin_type string (part after " - ").
 *
 * @param {string} fullType - Full coin_type value.
 * @returns {string} Sub-type, or '' if none.
 */
export function getSubType(fullType) {
    if (!fullType) return '';
    const idx = findSplitDash(fullType);
    if (idx >= 0) return fullType.substring(idx + 3).trim();
    const parenMatch = fullType.match(/\((.*?)\)/);
    if (parenMatch) return parenMatch[1].trim();
    return '';
}

/**
 * Sub-types that represent metal composition changes — these should be
 * rendered as flat rows within the parent type, not as nested accordions.
 */
const COMPOSITION_SUBS = new Set([
    'Clad', 'Silver', 'Silver (40%)', 'Silver (90%)',
    'Silver (Proof)', 'Copper', 'Zinc',
]);

/**
 * Returns true if the sub-type is a metal composition variant
 * (should be flat-listed, not a nested accordion).
 *
 * @param {string} sub - Sub-type string.
 * @returns {boolean}
 */
export function isCompositionSub(sub) {
    if (!sub) return true;
    const base = sub.replace(/\s*\(.*\)$/, '');
    return COMPOSITION_SUBS.has(sub) || COMPOSITION_SUBS.has(base);
}

/**
 * Error/variety keywords used to classify coins as errors.
 */
const ERROR_KEYWORDS = [
    'doubled die', 'double die', 'error', 'no-s', 'no s proof',
    'overdate', 'repunched', 'rpm', 'wide am', 'close am',
    '3-legged', 'copper error', 'steel error', 'over mint',
];

/**
 * Returns true if a coin's type or notes indicate it's an error/variety.
 *
 * @param {string} coinType  - coin_type value.
 * @param {string} [refNotes] - ref_notes value.
 * @returns {boolean}
 */
export function isErrorVariety(coinType, refNotes) {
    if (!coinType && !refNotes) return false;
    const combined = `${coinType} ${refNotes || ''}`.toLowerCase();
    return ERROR_KEYWORDS.some(kw => combined.includes(kw));
}

/**
 * Returns true if a coin type typically has a special reverse design
 * that users are more interested in than the standard obverse.
 * 
 * @param {string} coinType
 * @returns {boolean}
 */
export function isSpecialReverse(coinType) {
    if (!coinType) return false;
    const lower = coinType.toLowerCase();
    if (lower.includes('state quarter')) return true;
    if (lower.includes('america the beautiful')) return true;
    if (lower.includes('dc & us territories')) return true;
    if (lower.includes('westward journey')) return true;
    if (lower.includes('presidential dollar')) return true;
    if (lower.includes('sacagawea dollar')) return true;
    if (lower.includes('native american dollar')) return true;
    if (lower.includes('innovation dollar')) return true;
    if (lower.includes('american women')) return true;
    if (lower.includes('first spouse')) return true;
    return false;
}

/**
 * Extract date variety (e.g., Small Date, Large Date) from ref_notes.
 * 
 * @param {string} refNotes - ref_notes value.
 * @returns {string} Short variety string (e.g., 'Sm Date', 'Lg Date'), or empty.
 */
export function getDateVariety(refNotes) {
    if (!refNotes) return '';
    const lower = refNotes.toLowerCase();
    if (lower.startsWith('small date')) return 'Sm Date';
    if (lower.startsWith('large date')) return 'Lg Date';
    if (lower.includes('small date')) return 'Sm Date';
    if (lower.includes('large date')) return 'Lg Date';
    return '';
}

// ============================================================
// Face value lookup
// ============================================================

const FACE_VALUE_MAP = {
    'half cent': 0.005,
    '1 cent':    0.01,
    '2 cents':   0.02,
    '3 cents':   0.03,
    'half dime': 0.05,
    '5 cents':   0.05,
    '10 cents':  0.10,
    '20 cents':  0.20,
    '25 cents':  0.25,
    '50 cents':  0.50,
    '$1':        1.00,
    'trade dollar': 1.00,
    '$2.50':     2.50,
    '$3 gold':   3.00,
    '$5':        5.00,
    '$5 gold':   5.00,
    '$10':       10.00,
    '$10 gold':  10.00,
    '$20':       20.00,
};

/**
 * Return the face value in dollars for a denomination string.
 *
 * @param {string} denom - Denomination string (e.g. "10 Cents").
 * @returns {number} Face value in dollars.
 */
export function getFaceValue(denom) {
    return FACE_VALUE_MAP[(denom || '').toLowerCase().trim()] || 0;
}

// ============================================================
// DOM helpers
// ============================================================

/**
 * Create a DOM element with optional properties and children.
 *
 * @param {string} tag - HTML tag name.
 * @param {Object} [props] - Properties / attributes / event listeners to set.
 * @param {...(Node|string)} children - Child nodes or text.
 * @returns {HTMLElement}
 *
 * @example
 * const div = el('div', { className: 'card' }, 'Hello');
 */
export function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, val] of Object.entries(props)) {
        if (key.startsWith('on') && typeof val === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (key === 'dataset') {
            Object.assign(node.dataset, val);
        } else if (key === 'style') {
            node.style.cssText = val;
        } else if (key in node) {
            node[key] = val;
        } else {
            node.setAttribute(key, val);
        }
    }
    for (const child of children) {
        if (child == null) continue;
        // Flatten arrays recursively
        const flatten = (c) => {
            if (c == null) return [];
            if (Array.isArray(c)) return c.flatMap(flatten);
            if (c instanceof Node) return [c];
            return [document.createTextNode(String(c))];
        };
        node.append(...flatten(child));
    }
    return node;
}

/**
 * Debounce a function: delay execution until *wait* ms have passed
 * without another call.
 *
 * @param {Function} fn   - Function to debounce.
 * @param {number}   wait - Delay in milliseconds.
 * @returns {Function} Debounced function.
 */
export function debounce(fn, wait) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

/**
 * Generate a short placeholder SVG for missing coin images.
 * Returns a data URI that can be used as an img src.
 *
 * @returns {string} data: URI for an SVG placeholder coin.
 */
export function placeholderCoinSvg() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="#3a3a3a" stroke="#666" stroke-width="3"/>
        <circle cx="50" cy="50" r="35" fill="none" stroke="#555" stroke-width="1.5"
                stroke-dasharray="5,4"/>
        <text x="50" y="57" font-family="sans-serif" font-size="22" fill="#888"
              text-anchor="middle" font-weight="bold">?</text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(svg);
}
