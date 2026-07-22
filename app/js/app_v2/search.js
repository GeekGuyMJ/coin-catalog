/**
 * search.js — Coin Catalog v2
 *
 * Search, filter, and sort for the coin catalogue.
 * Provides real-time search across all coin fields, toggleable filter pills,
 * and sort mode switching.
 *
 * @module search
 */

import {
    getSearchQuery, setSearchQuery,
    getFilterMissingOnly, toggleFilterMissingOnly,
    getFilterHideProofs, toggleFilterHideProofs,
    getFilterHideErrors, toggleFilterHideErrors,
    getFilterKeyDatesOnly, toggleFilterKeyDatesOnly,
    getSortMode, setSortMode,
    getSections,
    getTypeConfig,
    getInventoryTotalQty,
    getMinYear, setMinYear,
    getMaxYear, setMaxYear,
    getWishlist,
} from './state.js?v=4';

import { fetchCoinsForSection } from './api.js?v=4';
import { renderSections } from './catalog.js?v=4';
import {
    getMainType, getSubType, isCompositionSub, getDateVariety, coinSortComparator, escHtml, placeholderCoinSvg,
} from './utils.js?v=4';
import { showToast } from './notifications.js?v=4';

// ============================================================
// Filter pill definitions
// ============================================================

const FILTERS = [
    { id: 'missing_only', label: 'Missing Only', getState: () => getFilterMissingOnly(), toggle: () => toggleFilterMissingOnly() },
    { id: 'hide_proofs',  label: 'Hide Proofs',  getState: () => getFilterHideProofs(),  toggle: () => toggleFilterHideProofs() },
    { id: 'hide_errors',  label: 'Hide Errors',  getState: () => getFilterHideErrors(),  toggle: () => toggleFilterHideErrors() },
    { id: 'key_dates',    label: 'Key Dates',    getState: () => getFilterKeyDatesOnly(), toggle: () => toggleFilterKeyDatesOnly() },
    { id: 'min_year',     label: 'Min Year',     getState: () => getMinYear(),           setState: (v) => setMinYear(v) },
    { id: 'max_year',     label: 'Max Year',     getState: () => getMaxYear(),           setState: (v) => setMaxYear(v) },
];

const SORT_MODES = [
    { value: 'default',    label: 'Default' },
    { value: 'az',         label: '\u2192 Z' },
    { value: 'value-desc', label: 'By Value' },
    { value: 'completion', label: 'By Completion' },
];

// ============================================================
// Init
// ============================================================

/**
 * Initialize search UI: wire up input, filter pills, sort dropdown.
 * Call from main.js after DOMContentLoaded.
 */
export function initSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;

    // Check initial search bar visibility
    try {
        const vis = JSON.parse(localStorage.getItem('cc-card-visibility') || '{}');
        const cardSearch = document.getElementById('card-search');
        if (cardSearch && vis['card-search'] === false) {
            cardSearch.style.display = 'none';
        }
    } catch(e) {}

    // --- Filter pills ---
    const pillsContainer = document.getElementById('filter-pills');
    if (pillsContainer) {
        pillsContainer.innerHTML = '';
        FILTERS.forEach(f => {
            const pill = document.createElement('span');
            pill.className = 'filter-pill' + (f.getState() ? ' active' : '');
            pill.textContent = f.label;
            pill.dataset.filterId = f.id;
            pill.setAttribute('role', 'button');
            pill.setAttribute('tabindex', '0');
            pill.addEventListener('click', () => {
                f.toggle();
                pill.classList.toggle('active');
                triggerSearch();
            });
            pillsContainer.appendChild(pill);
        });
    }

    // --- Sort dropdown ---
    const searchRow = input.closest('.search-row');
    if (searchRow && !document.getElementById('sort-selector')) {
        const sel = document.createElement('select');
        sel.id = 'sort-selector';
        sel.className = 'sort-select';
        sel.setAttribute('aria-label', 'Sort coins');
        SORT_MODES.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.value;
            opt.textContent = m.label;
            sel.appendChild(opt);
        });
        sel.value = getSortMode();
        sel.addEventListener('change', () => {
            setSortMode(sel.value);
            triggerSearch();
        });
        searchRow.appendChild(sel);
    }

    // --- Debounced search on input ---
    let debounceTimer = null;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            setSearchQuery(input.value.trim());
            triggerSearch();
        }, 300);
    });

    // --- Ctrl+F / Cmd+F ---
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            input.focus();
            input.select();
        }
    });

    // --- Escape clears ---
    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            input.value = '';
            setSearchQuery('');
            triggerSearch();
            input.blur();
        }
    });
}

// ============================================================
// Search execution
// ============================================================

/**
 * Execute a search with current state and render results.
 * Called when query, filters, or sort mode changes.
 */
export async function triggerSearch() {
    const q = getSearchQuery();
    const sortMode = getSortMode();
    const hasFilter = getFilterMissingOnly() || getFilterHideProofs()
        || getFilterHideErrors() || getFilterKeyDatesOnly()
        || getMinYear() !== null || getMaxYear() !== null;
    const isActive = !!q || hasFilter;

    const container = document.getElementById('catalog-container');
    if (!container) return;

    // No active search/filters — show full catalogue
    if (!isActive) {
        renderSections();
        return;
    }

    container.innerHTML = '<div class="section-loading">Searching\u2026</div>';

    try {
        let results;

        if (q) {
            // Backend search
            const params = new URLSearchParams();
            params.set('q', q);
            if (getFilterMissingOnly())  params.set('missing_only', '1');
            if (getFilterHideProofs())   params.set('hide_proofs', '1');
            if (getFilterHideErrors())   params.set('hide_errors', '1');
            if (getFilterKeyDatesOnly()) params.set('key_dates_only', '1');
            if (sortMode !== 'default')  params.set('sort', sortMode);
            const minYear = getMinYear();
            if (minYear !== null) params.set('min_year', minYear);
            const maxYear = getMaxYear();
            if (maxYear !== null) params.set('max_year', maxYear);

            const resp = await fetch('/api/coins?' + params.toString());
            results = await resp.json();
        } else {
            // Filters only — fetch all sections, filter client-side
            results = [];
            const sections = getSections();
            for (const sec of sections) {
                const coins = await fetchCoinsForSection(sec.section);
                results = results.concat(coins);
            }
            if (getFilterHideProofs())   results = results.filter(c => !c.is_proof);
            if (getFilterHideErrors())   results = results.filter(c => !c.is_error);
            if (getFilterKeyDatesOnly()) results = results.filter(c => c.is_key_date);

            // Apply sort mode client-side (mirrors backend behavior)
            if (sortMode === 'az') {
                results.sort((a, b) => {
                    const typeComp = (a.coin_type || '').localeCompare(b.coin_type || '');
                    if (typeComp !== 0) return typeComp;
                    return coinSortComparator(a, b);
                });
            } else if (sortMode === 'completion') {
                results.sort((a, b) => {
                    const aOwned = getInventoryTotalQty(a.id) > 0 ? 1 : 0;
                    const bOwned = getInventoryTotalQty(b.id) > 0 ? 1 : 0;
                    if (bOwned !== aOwned) return bOwned - aOwned;
                    return coinSortComparator(a, b);
                });
            } else {
                // Default: section then year/mint
                results.sort(coinSortComparator);
            }
        }

        renderSearchResults(container, results, q);
    } catch (err) {
        container.innerHTML = '<p class="text-muted" style="padding:2rem;text-align:center;">Search failed: '
            + escHtml(err.message) + '</p>';
        console.error('[search]', err);
    }
}

// ============================================================
// Results rendering
// ============================================================

/**
 * Render search results into the catalog container.
 * Groups results by section, then by type within each section.
 */
function renderSearchResults(container, results, query) {
    if (!results.length) {
        container.innerHTML = ''
            + '<div class="card" style="text-align:center;padding:3rem;">'
            + '<p style="font-size:1.2rem;margin-bottom:1rem;">No coins found</p>'
            + '<p class="text-muted">'
            + (query
                ? 'No results for &ldquo;' + escHtml(query) + '&rdquo;.'
                : 'No coins match the active filters.')
            + ' Try a different search term or adjust your filters.</p>'
            + '</div>';
        return;
    }

    // Group results by section
    const secMap = new Map();
    for (const coin of results) {
        const sec = coin.section || 'Other';
        if (!secMap.has(sec)) secMap.set(sec, []);
        secMap.get(sec).push(coin);
    }

    // Clear container and build fresh
    container.innerHTML = '';

    // --- Results header ---
    const header = document.createElement('div');
    header.className = 'search-results-header';
    header.innerHTML = ''
        + '<span class="search-results-count">'
        + results.length + ' result' + (results.length === 1 ? '' : 's')
        + (query ? ' for &ldquo;' + escHtml(query) + '&rdquo;' : '')
        + '</span>'
        + '<button class="btn-secondary" id="btn-clear-search" style="font-size:var(--font-size-xs);padding:4px 12px;">\u2715 Clear</button>';
    container.appendChild(header);

    document.getElementById('btn-clear-search')?.addEventListener('click', () => {
        const inp = document.getElementById('search-input');
        if (inp) inp.value = '';
        setSearchQuery('');
        renderSections();
    });

    // --- Section groups ---
    for (const [section, coins] of secMap.entries()) {
        const group = document.createElement('div');
        group.className = 'section-card search-section';

        const title = document.createElement('div');
        title.className = 'section-header';
        title.style.cssText = 'cursor:default;position:static;';
        title.innerHTML = '<span class="section-title" style="font-size:var(--font-size-sm);">'
            + escHtml(section)
            + ' <span class="count-badge">' + coins.length + '</span>'
            + '</span>';
        group.appendChild(title);

        const content = document.createElement('div');
        content.className = 'type-content';
        content.style.cssText = 'display:block;border-left:none;padding-left:0;';

        // Group by main type within this section
        const typeMap = new Map();
        for (const coin of coins) {
            const main = getMainType(coin.coin_type);
            if (!typeMap.has(main)) typeMap.set(main, []);
            typeMap.get(main).push(coin);
        }

        for (const [mainType, typeCoins] of typeMap.entries()) {
            const sorted = [...typeCoins].sort(coinSortComparator);
            for (const coin of sorted) {
                content.appendChild(buildSearchRow(coin, mainType));
            }
        }

        group.appendChild(content);
        container.appendChild(group);
    }
}

// ============================================================
// Coin row builder for search results
// ============================================================

/**
 * Build a single coin row element for search results.
 * @param {Object} coin
 * @param {string} mainType
 * @returns {HTMLElement}
 */
function buildSearchRow(coin, mainType) {
    const qty = getInventoryTotalQty(coin.id);
    const specificCfg = getTypeConfig(coin.coin_type);
    const cfg = specificCfg || getTypeConfig(getMainType(coin.coin_type)) || {};

    const row = document.createElement('div');
    row.className = 'coin-row';
    row.dataset.coinId = coin.id;
    row.dataset.coinType = coin.coin_type;
    row.dataset.section = coin.section || '';

    // --- Thumbnail ---
    const tw = document.createElement('div');
    tw.className = 'coin-row-thumb-wrap';
    const imgSrc = cfg.rev_image || cfg.obv_image || null;
    if (imgSrc) {
        const img = document.createElement('img');
        img.className = 'coin-row-thumb';
        img.src = imgSrc;
        img.alt = '';
        img.loading = 'lazy';
        img.dataset.action = 'view-img';
        img.dataset.type = coin.coin_type;
        img.dataset.side = cfg.rev_image ? 'rev' : 'obv';
        img.onerror = function () { this.src = placeholderCoinSvg(); };
        tw.appendChild(img);
    } else {
        const img = document.createElement('img');
        img.className = 'coin-row-thumb';
        img.src = placeholderCoinSvg();
        img.alt = '';
        tw.appendChild(img);
    }
    // Quantity badge (shown when > 1 copy owned, matching catalog.js)
    if (qty > 1) {
        const badge = document.createElement('span');
        badge.className = 'album-qty-badge';
        badge.textContent = `x${qty}`;
        tw.appendChild(badge);
    }
    row.appendChild(tw);

    // --- Info ---
    const info = document.createElement('div');
    info.className = 'coin-row-info';

    const yearStr = coin.year === 1776 ? '1776-1976' : (coin.year || '\u2014');
    const mintStr = coin.mint_mark ? '-' + coin.mint_mark : '';
    
    const isPenny = coin.denomination === '1 Cent' || (coin.coin_type || '').toLowerCase().includes('cent');
    const labelParts = [];
    if (isPenny && coin.year === 1982) {
        const subType = getSubType(coin.coin_type);
        if (subType === 'Copper' || subType === 'Zinc') {
            labelParts.push(subType);
        }
    }
    
    const subType = getSubType(coin.coin_type);
    if (subType && !isCompositionSub(subType)) {
        const match = subType.match(/\(([^)]+)\)/);
        let designName = match ? match[1] : subType;
        if (designName.includes(' - ')) {
            const parts = designName.split(' - ');
            designName = parts[parts.length - 1].trim();
        }
        if (coin.year && designName.startsWith(coin.year.toString())) {
            designName = designName.substring(coin.year.toString().length).trim();
            designName = designName.replace(/^[-,\s]+/, '');
        }
        if (designName && !isCompositionSub(designName) && !labelParts.includes(designName)) {
            labelParts.push(designName);
        }
    }
    
    const dateVar = getDateVariety(coin.ref_notes);
    if (dateVar) {
        labelParts.push(dateVar);
    }
    const designStr = labelParts.length > 0 ? ` (${labelParts.join(', ')})` : '';
    const titleText = mainType + ' ' + yearStr + mintStr + designStr;

    const titleLine = document.createElement('span');
    titleLine.className = 'coin-row-title';
    titleLine.textContent = titleText;
    if (coin.is_key_date) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-key';
        badge.textContent = '\u2b50 Key';
        titleLine.appendChild(document.createTextNode(' '));
        titleLine.appendChild(badge);
    }
    info.appendChild(titleLine);

    const sub = document.createElement('span');
    sub.className = 'coin-row-sub';
    sub.textContent = coin.denomination || '';
    if (coin.mintage) {
        sub.textContent += ' \u00b7 Mintage: ' + coin.mintage.toLocaleString();
    }
    info.appendChild(sub);
    row.appendChild(info);

    // --- Stepper ---
    const stepper = document.createElement('div');
    stepper.className = 'stepper';
    stepper.dataset.coinId = coin.id;
    stepper.innerHTML = ''
        + '<button class="stepper-btn" data-action="stepper-dec" data-coin-id="' + coin.id + '">\u2212</button>'
        + '<span class="stepper-value" style="color:' + (qty > 0 ? 'var(--color-accent)' : '') + '">' + qty + '</span>'
        + '<button class="stepper-btn" data-action="stepper-inc" data-coin-id="' + coin.id + '">+</button>';
    row.appendChild(stepper);

    // --- Wishlist ---
    const wlItem = (getWishlist() || []).find(w => w.coin_id === coin.id);
    const wl = document.createElement('button');
    wl.className = 'btn-wishlist' + (wlItem ? ' active is-wishlist' : '');
    wl.textContent = '\ud83c\udfaf';
    wl.title = wlItem ? 'Remove from wishlist' : 'Add to wishlist';
    wl.dataset.action = 'add-wishlist';
    wl.dataset.coinId = coin.id;
    row.appendChild(wl);

    return row;
}
