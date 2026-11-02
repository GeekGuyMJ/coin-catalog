/**
 * catalog.js — Coin Catalog v2
 *
 * Renders the coin catalogue: section cards with lazy-loaded type accordions.
 * Uses event delegation — one listener per container, never per-row.
 *
 * Flow:
 *  1. renderSections() builds section cards from state.getSections()
 *  2. User clicks a section → expandSection() fetches coins via api.fetchCoinsForSection()
 *  3. renderTypeAccordions() groups coins by main type and renders rows
 *  4. Quantity stepper clicks bubble up to the container → handleStepperClick()
 *
 * @module catalog
 */

import {
    getMainType, getSubType, isCompositionSub, isErrorVariety,
    typeYearSpan, coinSortComparator, escHtml, placeholderCoinSvg, el,
} from './utils.js';

import { getSections, getCoinsForSection, setCoinsForSection,
    getTypeConfig,
} from './state.js';

import { ACCORDION_SCHEMA } from './cards.js';

import { fetchCoinsForSection, updateInventory, fetchInventory, fetchWishlist, addToWishlist, removeFromWishlist } from './api.js';
import { showToast } from './notifications.js';
import { openImageInteractionModal } from './images.js';
import { renderAlbumType, clearAlbumCache } from './album.js';
import { getInventoryEntries, getInventoryTotalQty, setInventoryEntries, getWishlist } from './state.js';

// Build a reverse map from coin main-type patterns to ACCORDION_SCHEMA subtype keys.
// This lets us tag DOM elements with data-coin-subtype so cards.js visibility toggles work.
let _subtypeKeyCache = null;
function _buildSubtypeKeyMap() {
    if (_subtypeKeyCache) return _subtypeKeyCache;
    const map = {};
    for (const series of Object.values(ACCORDION_SCHEMA)) {
        const titles = Object.values(series.subtypes);
        const keys = Object.keys(series.subtypes);
        for (let i = 0; i < titles.length; i++) {
            // Map the slugified full label to its key
            map[titles[i].toLowerCase().replace(/[^a-z0-9]+/g, '-')] = keys[i];
            // Also map the key itself (for direct lookups like "dime" → "dime")
            map[keys[i]] = keys[i];
        }
    }
    _subtypeKeyCache = map;
    return map;
}
/**
 * Map a coin's full coin_type string to the ACCORDION_SCHEMA subtype key.
 * Tries combined "SubType MainType" first, then just the "SubType" as fallback.
 */
function coinTypeToSubtypeKey(coinType) {
    if (!coinType) return '';
    const main = getMainType(coinType);
    const sub = getSubType(coinType);
    const map = _buildSubtypeKeyMap();

    // If no subtype, match by main type slug against schema keys directly
    if (!sub) {
        const mainSlug = main.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        // Direct key match (e.g. "dime" → "dime")
        if (map[mainSlug]) return map[mainSlug];
        // Check if any schema series key contains this main type
        for (const series of Object.values(ACCORDION_SCHEMA)) {
            for (const [key, label] of Object.entries(series.subtypes)) {
                if (label.toLowerCase().replace(/[^a-z0-9]+/g, '-') === mainSlug) return key;
            }
        }
        return '';
    }

    // Primary: combined "SubType MainType" → slug match
    const combined = (sub + ' ' + main).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (map[combined]) return map[combined];

    // Fallback: just the subType slug
    const subSlug = sub.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (map[subSlug]) return map[subSlug];

    // Last resort: match by main type only (for flat categories like "dime", "twenty-cent-piece")
    const mainSlug = main.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (map[mainSlug]) return map[mainSlug];

    return '';
}

const _expandedSections = new Set();
const _expandedTypes = new Set();
const _expandedCountries = new Set(['United States', 'Canada']);

// ============================================================
// Public entry point
// ============================================================

/**
 * Render all section cards into #catalog-container.
 * Called once after sections are loaded from the API.
 */
export function renderSections() {
    const container = document.getElementById('catalog-container');
    if (!container) return;
    container.innerHTML = '';

    const sections = getSections();
    if (!sections.length) {
        container.innerHTML = '<p class="text-muted text-center" style="padding:2rem">No coins found in the catalogue.</p>';
        return;
    }

    // Group sections by country
    const countryMap = new Map();
    sections.forEach(sec => {
        const country = getCountry(sec.section);
        if (!countryMap.has(country)) countryMap.set(country, []);
        countryMap.get(country).push(sec);
    });

    // Render country groups
    for (const [country, countrySections] of countryMap) {
        const group = buildCountryGroup(country, countrySections);
        container.appendChild(group);
    }
    
    // Now that everything is in the DOM, restore expanded sections
    initStickyHeaders();
    initSectionDragAndDrop();
    applySectionOrder();
    sections.forEach(sec => {
        if (_expandedSections.has(sec.section)) {
            expandSection(sec.section);
        }
    });

    // Auto-expand the first section of the first country group (usually US)
    // so the user sees coin content immediately on app load
    const firstCountryGroup = container.querySelector('.country-group');
    if (firstCountryGroup) {
        const firstSectionHeader = firstCountryGroup.querySelector('.section-header');
        if (firstSectionHeader) {
            const sectionName = firstSectionHeader.dataset.section;
            if (sectionName && !_expandedSections.has(sectionName)) {
                expandSection(sectionName);
            }
        }
    }

    // Single event listener for ALL stepper clicks across the entire catalogue
    // Guard against duplicate attachment (renderSections can be called on search/filter)
    if (!container.dataset.clickHandler) {
        container.addEventListener('click', handleCatalogClick);
        container.dataset.clickHandler = 'true';
    }
}

/**
 * Determine country from section name.
 */
function getCountry(sectionName) {
    if (sectionName.startsWith('US ')) return 'United States';
    if (sectionName.startsWith('Canadian ')) return 'Canada';
    if (sectionName.startsWith('UK ')) return 'United Kingdom';
    return 'Other';
}

/**
 * Build a top-level country group accordion.
 */
function buildCountryGroup(country, sections) {
    const groupId = 'group-' + country.replace(/\s+/g, '-').toLowerCase();
    const wrapper = el('div', { className: 'country-group', id: groupId });

    const total = sections.reduce((sum, s) => sum + s.total, 0);
    const owned = sections.reduce((sum, s) => sum + s.owned, 0);
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;

    const header = el('div', {
        className: 'country-group-header',
        role: 'button',
        tabIndex: 0,
        dataset: { action: 'toggle-country', country: country }
    });

    const left = el('div', { className: 'section-header-left' },
        el('span', { className: 'section-title', style: 'font-size: var(--font-size-xl);' }, country),
        el('span', {
            className: 'count-badge' + (owned === total ? ' complete' : owned > 0 ? ' owned' : ''),
            title: `${owned} of ${total} owned (${pct}%)`
        }, `${owned}/${total}`)
    );

    // List/Album toggle — only for US and Canadian coin groups
    const isGroupedCountry = country === 'United States' || country === 'Canada';
    const currentMode = getCatalogViewMode();
    const viewToggle = el('span', {
        className: 'folder-view-toggle',
        style: isGroupedCountry ? 'display:inline-flex' : 'display:none',
        onclick: 'event.stopPropagation()'
    });

    const listBtn = el('button', {
        id: 'view-list-btn',
        title: 'List view',
        style: 'border:none;border-radius:0;font-size:0.72em;padding:4px 10px;background:' + (currentMode === 'list' ? 'rgba(255,255,255,0.25)' : 'transparent') + ';color:inherit;cursor:pointer;'
    }, 'List');

    const albumBtn = el('button', {
        id: 'view-album-btn',
        title: 'Album view',
        style: 'border:none;border-radius:0;font-size:0.72em;padding:4px 10px;border-left:1px solid rgba(255,255,255,0.3);background:' + (currentMode === 'folder' ? 'rgba(255,255,255,0.25)' : 'transparent') + ';color:inherit;cursor:pointer;'
    }, 'Album');

    listBtn.addEventListener('click', (e) => { e.stopPropagation(); setCatalogViewMode('list'); });
    albumBtn.addEventListener('click', (e) => { e.stopPropagation(); setCatalogViewMode('folder'); });
    viewToggle.append(listBtn, albumBtn);

    const chevron = el('span', { className: 'section-chevron' }, '▾');
    const dragHandle = el('span', { className: 'drag-handle' }, '☰');
    header.append(left, viewToggle, dragHandle, chevron);

    const content = el('div', { className: 'country-group-content', id: groupId + '-content' });
    
    sections.forEach(sec => {
        const card = buildSectionCard(sec);
        content.appendChild(card);
    });

    // Restore expansion state
    if (_expandedCountries.has(country)) {
        content.classList.add('open');
        header.setAttribute('aria-expanded', 'true');
        chevron.style.transform = 'rotate(180deg)';
    }

    header.onclick = () => {
        const isOpen = content.classList.toggle('open');
        header.setAttribute('aria-expanded', String(isOpen));
        chevron.style.transform = isOpen ? 'rotate(180deg)' : '';
        if (isOpen) _expandedCountries.add(country);
        else _expandedCountries.delete(country);
    };

    wrapper.append(header, content);
    return wrapper;
}

// ============================================================
// Section card builder
// ============================================================

/**
 * Build a section card DOM element.
 *
 * @param {{section:string, total:number, owned:number}} sec
 * @returns {HTMLElement}
 */
function buildSectionCard(sec) {
    const sectionId = 'section-' + CSS.escape(sec.section);
    const card = el('div', {
        className: 'section-card',
        id: sectionId,
        dataset: { section: sec.section },
    });

    // Header (clickable, sticky)
    const header = el('div', {
        className: 'section-header',
        role: 'button',
        tabIndex: 0,
        'aria-expanded': 'false',
        'aria-controls': sectionId + '-content',
        dataset: { action: 'toggle-section', section: sec.section },
    });

    const left = el('div', { className: 'section-header-left' });
    
    // Add example images (always show, even if just placeholders)
    if (sec.sample_type) {
        const cfg = getTypeConfig(getMainType(sec.sample_type));
        const pair = el('div', { className: 'coin-img-pair' });
        const hasObv = cfg?.obv_image;
        const hasRev = cfg?.rev_image;
        if (hasObv) {
            const img = el('img', { className: 'coin-thumb obv', src: cfg.obv_image, alt: '', dataset: { action: 'view-img', type: sec.sample_type, side: 'obv' } });
            img.onerror = () => { img.src = placeholderCoinSvg(); img.classList.add('placeholder'); };
            pair.appendChild(img);
        } else {
            const ph = el('img', { className: 'coin-thumb obv placeholder', src: placeholderCoinSvg(), alt: '', role: 'button', tabIndex: 0, dataset: { action: 'view-img', type: sec.sample_type, side: 'obv' } });
            pair.appendChild(ph);
        }
        if (hasRev) {
            const img = el('img', { className: 'coin-thumb rev', src: cfg.rev_image, alt: '', dataset: { action: 'view-img', type: sec.sample_type, side: 'rev' } });
            img.onerror = () => { img.src = placeholderCoinSvg(); img.classList.add('placeholder'); };
            pair.appendChild(img);
        } else {
            const ph = el('img', { className: 'coin-thumb rev placeholder', src: placeholderCoinSvg(), alt: '', role: 'button', tabIndex: 0, dataset: { action: 'view-img', type: sec.sample_type, side: 'rev' } });
            pair.appendChild(ph);
        }
        left.appendChild(pair);
    }

    const pct = sec.total > 0 ? Math.round((sec.owned / sec.total) * 100) : 0;

    const title = el('span', { className: 'section-title' }, sec.section);

    const ownedBadge = el('span', {
        className: 'count-badge' + (sec.owned === sec.total ? ' complete' : sec.owned > 0 ? ' owned' : ''),
        title: `${sec.owned} of ${sec.total} owned (${pct}%)`,
    }, `${sec.owned}/${sec.total}`);

    left.append(title, ownedBadge);

    const chevron = el('span', { className: 'section-chevron', 'aria-hidden': 'true' }, '▾');

    header.append(left, chevron);

    // Content area (initially hidden)
    const content = el('div', {
        className: 'section-content',
        id: sectionId + '-content',
        role: 'region',
        'aria-label': sec.section,
    });

    card.append(header, content);

    // Keyboard: Enter/Space toggles section
    header.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            header.click();
        }
    });

    return card;
}

// ============================================================
// Section expand / collapse
// ============================================================

/**
 * Expand or collapse a section. On first expand, fetch coins from the API.
 *
 * @param {string} sectionName
 */
async function expandSection(sectionName) {
    const sectionId = 'section-' + CSS.escape(sectionName);
    const card = document.getElementById(sectionId);
    if (!card) return;

    const header  = card.querySelector('.section-header');
    const content = card.querySelector('.section-content');
    const isOpen  = content.classList.contains('open');

    if (isOpen) {
        content.classList.remove('open');
        header.setAttribute('aria-expanded', 'false');
        _expandedSections.delete(sectionName);
        return;
    }

    // Open the section
    content.classList.add('open');
    header.setAttribute('aria-expanded', 'true');
    _expandedSections.add(sectionName);

    // Already loaded?
    const cached = getCoinsForSection(sectionName);
    if (cached) {
        renderTypeAccordions(content, cached);
        return;
    }

    // Show loading spinner
    content.innerHTML = '<div class="section-loading">Loading coins…</div>';

    try {
        const coins = await fetchCoinsForSection(sectionName);
        setCoinsForSection(sectionName, coins);
        renderTypeAccordions(content, coins);
    } catch (err) {
        content.innerHTML = `<p class="text-muted" style="padding:1rem">
            Failed to load coins: ${escHtml(err.message)}
        </p>`;
    }
}

// ============================================================
// Type accordion renderer
// ============================================================

/**
 * Group coins by main type and render type accordions into a section content area.
 *
 * @param {HTMLElement} container - The section's content element.
 * @param {Array}       coins     - Coins for this section.
 */
function renderTypeAccordions(container, coins) {
    container.innerHTML = '';

    // Deduplicate by coin ID (outer join with inventory can produce duplicates)
    const seenIds = new Set();
    const uniqueCoins = [];
    for (const coin of coins) {
        if (!seenIds.has(coin.id)) {
            seenIds.add(coin.id);
            uniqueCoins.push(coin);
        }
    }

    // Group by main type
    const typeMap = new Map();
    for (const coin of uniqueCoins) {
        const main = getMainType(coin.coin_type);
        if (!typeMap.has(main)) typeMap.set(main, []);
        typeMap.get(main).push(coin);
    }

    // Sort type groups by their earliest coin year
    const sortedTypes = [...typeMap.entries()].sort((a, b) => {
        const minA = Math.min(...a[1].map(c => c.year === 1776 ? 1976 : c.year || 9999));
        const minB = Math.min(...b[1].map(c => c.year === 1776 ? 1976 : c.year || 9999));
        return minA - minB;
    });

    for (const [mainType, typeCoins] of sortedTypes) {
        const wrapper = buildTypeAccordion(mainType, typeCoins);
        container.appendChild(wrapper);
    }
}

// ============================================================
// Type accordion builder
// ============================================================

/**
 * Build a type accordion (header + coin rows).
 *
 * @param {string} mainType  - Display name for the type.
 * @param {Array}  typeCoins - All coins for this type.
 * @returns {HTMLElement}
 */
function buildTypeAccordion(mainType, typeCoins) {
    const typeId = 'type-' + mainType.replace(/[^a-zA-Z0-9]/g, '');
    const cfg = getTypeConfig(mainType) || {};

    const wrapper = el('div', { className: 'type-wrapper', id: typeId });

    // --- Header ---
    const header = el('div', {
        className: 'type-header',
        role: 'button',
        tabIndex: 0,
        'aria-expanded': 'false',
        dataset: { action: 'toggle-type' },
    });

    const left = el('div', { className: 'type-header-left' });

    // Coin thumbnails
    const pair = el("div", { className: "coin-img-pair" });
    if (cfg.obv_image) {
        const imgObv = el("img", {
            className: "coin-thumb obv",
            src: cfg.obv_image,
            alt: mainType + " obverse",
            loading: "lazy",
            role: "button",
            tabIndex: 0,
            dataset: { action: "view-img", type: mainType, side: "obv" },
        });
        imgObv.onerror = function() { imgObv.src = placeholderCoinSvg(); };
        pair.appendChild(imgObv);
    } else {
        const placeholderObv = el("img", {
            className: "coin-thumb obv placeholder",
            src: placeholderCoinSvg(),
            alt: "Upload " + mainType + " obverse",
            role: "button",
            tabIndex: 0,
            dataset: { action: "upload-img", type: mainType, side: "obv" },
        });
        pair.appendChild(placeholderObv);
    }
    if (cfg.rev_image) {
        const imgRev = el("img", {
            className: "coin-thumb rev",
            src: cfg.rev_image,
            alt: mainType + " reverse",
            loading: "lazy",
            role: "button",
            tabIndex: 0,
            dataset: { action: "view-img", type: mainType, side: "rev" },
        });
        imgRev.onerror = function() { imgRev.src = placeholderCoinSvg(); };
        pair.appendChild(imgRev);
    } else {
        const placeholderRev = el("img", {
            className: "coin-thumb rev placeholder",
            src: placeholderCoinSvg(),
            alt: "Upload " + mainType + " reverse",
            role: "button",
            tabIndex: 0,
            dataset: { action: "upload-img", type: mainType, side: "rev" },
        });
        pair.appendChild(placeholderRev);
    }
    left.appendChild(pair);

    // Title
    const ownedCount = typeCoins.filter(c => getInventoryTotalQty(c.id) > 0).length;
    const span = el('span', { className: 'type-title' },
        mainType,
        el('span', { className: 'type-year-span' }, typeYearSpan(typeCoins)),
    );
    const badge = el('span', {
        className: 'count-badge' + (ownedCount === typeCoins.length ? ' complete' : ownedCount > 0 ? ' owned' : ''),
    }, `${ownedCount}/${typeCoins.length}`);

    left.append(span, badge);
    header.append(left, el('span', { className: 'section-chevron', 'aria-hidden': 'true' }, '▾'));

    // --- Content (coin rows) ---
    const content = el('div', { className: 'type-content' });

    const sorted = [...typeCoins].sort(coinSortComparator);
    for (const coin of sorted) {
        content.appendChild(buildCoinRow(coin));
    }

    // Restore expanded state
    if (_expandedTypes.has(mainType)) {
        content.classList.add('open');
        header.setAttribute('aria-expanded', 'true');
        header.querySelector('.section-chevron').style.transform = 'rotate(180deg)';
    }

    // Toggle on click/keyboard
    header.addEventListener('click', async () => {
        const open = content.classList.toggle('open');
        header.setAttribute('aria-expanded', String(open));
        header.querySelector('.section-chevron').style.transform = open ? 'rotate(180deg)' : '';

        if (open) {
            _expandedTypes.add(mainType);
            // If in album mode, render album inline
            const mode = getCatalogViewMode();
            if (mode === 'album' || mode === 'folder') {
                // Get the section name from the parent section-card
                const sectionCard = wrapper.closest('.section-card');
                const secName = sectionCard?.dataset?.section || '';
                if (secName) {
                    await renderAlbumType(secName, mainType, content, header);
                }
            }
        } else {
            _expandedTypes.delete(mainType);
        }
    });
    header.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); header.click(); }
    });

    wrapper.append(header, content);
    return wrapper;
}

// ============================================================

// ============================================================
// V1-style coin detail slots (per-coin grade/price/value/date)
// ============================================================

var SLOT_GRADES = ['', 'PO-1', 'FR-2', 'AG-3', 'G-4', 'G-6', 'VG-8', 'VG-10', 'F-12', 'F-15', 'VF-20', 'VF-25', 'VF-30', 'VF-35', 'EF-40', 'EF-45', 'AU-50', 'AU-53', 'AU-55', 'AU-58', 'MS-60', 'MS-61', 'MS-62', 'MS-63', 'MS-64', 'MS-65', 'MS-66', 'MS-67', 'MS-68', 'MS-69', 'MS-70', 'PF-60', 'PF-65', 'PF-70', 'Proof'];

function getSlotCount(coinId) {
    var stored = parseInt(localStorage.getItem("slots_" + coinId));
    if (stored === null || isNaN(stored)) stored = 1;
    var qty = getInventoryTotalQty(coinId) || 0;
    if (qty === 0) return 0;
    return Math.min(Math.max(0, stored), qty);
}

// Grade option groups for select dropdown
var GRADE_GROUPS = [
    ['Poor to Good', [['P-1','P-1·Poor'],['FA-2','FA-2·Fair'],['AG-3','AG-3·About Good'],['G-4','G-4·Good'],['G-6','G-6·Good']]],
    ['Very Good to Fine', [['VG-8','VG-8·Very Good'],['VG-10','VG-10·Very Good'],['F-12','F-12·Fine'],['F-15','F-15·Fine']]],
    ['Very Fine to Extremely Fine', [['VF-20','VF-20·Very Fine'],['VF-25','VF-25·Very Fine'],['VF-30','VF-30·Very Fine'],['VF-35','VF-35·Very Fine'],['EF-40','EF-40·Extremely Fine'],['EF-45','EF-45·Extremely Fine']]],
    ['About Uncirculated', [['AU-50','AU-50·About Uncirculated'],['AU-55','AU-55·About Uncirculated'],['AU-58','AU-58·About Uncirculated']]],
    ['Mint State', [['MS-60','MS-60·Mint State'],['MS-61','MS-61·Mint State'],['MS-62','MS-62·Mint State'],['MS-63','MS-63·Choice Uncirculated'],['MS-64','MS-64·Choice Uncirculated'],['MS-65','MS-65·Gem Uncirculated'],['MS-66','MS-66·Gem Uncirculated'],['MS-67','MS-67·Superb Gem'],['MS-68','MS-68·Superb Gem'],['MS-69','MS-69·Near Perfect'],['MS-70','MS-70·Perfect Uncirculated']]],
    ['Proof', [['PR-60','PR-60·Proof'],['PR-63','PR-63·Choice Proof'],['PR-65','PR-65·Gem Proof'],['PR-67','PR-67·Superb Gem Proof'],['PR-69','PR-69·Near Perfect Proof'],['PR-70','PR-70·Perfect Proof']]],
    ['Other', [['BU','BU·Brilliant Uncirculated'],['Circulated','Circulated (ungraded)'],['Details','Details / Cleaned']]]
];

function buildGradeOptions(selectedGrade) {
    var h = '<option value=""' + ((selectedGrade||'')===''?' selected':'') + '>—</option>';
    GRADE_GROUPS.forEach(function(g) {
        h += '<optgroup label="' + g[0] + '">';
        g[1].forEach(function(opt) {
            var s = (selectedGrade||'')===opt[0]?' selected':'';
            h += '<option value="' + opt[0] + '"' + s + '>' + opt[1] + '</option>';
        });
        h += '</optgroup>';
    });
    return h;
}

/**
 * Build per-entry detail cards with instance tabs and encapsulated photos.
 * Each count entry gets its own card with multi-photo strip, compact 4-col field grid, and notes.
 * Cards are hidden/shown via tab switching — only one instance visible at a time.
 */
function buildCoinSlots(coinId) {
    var qty = getInventoryTotalQty(coinId) || 0;
    if (qty === 0) return "";
    var slotCount = getSlotCount(coinId);
    var entries = getInventoryEntries(coinId) || [];
    var html = '<div class="coin-entries">';

    // Instance tab row (only if > 1 slot)
    if (slotCount > 1) {
        html += '<div class="coin-instance-tabs" role="tablist">';
        for (var t = 0; t < slotCount; t++) {
            var isActive = t === 0 ? ' active' : '';
            html += '<button class="coin-instance-tab' + isActive + '" role="tab" data-action="switch-instance" data-instance-idx="' + t + '" aria-selected="' + (t === 0 ? 'true' : 'false') + '">Coin ' + (t + 1) + '</button>';
        }
        html += '</div>';
    }

    for (var i = 0; i < slotCount; i++) {
        var entry = entries[i] || {};
        var isVisible = i === 0 ? '' : ' style="display:none;"';
        html += '<div class="coin-entry-card' + (i === 0 ? ' is-active' : '') + '" data-instance-idx="' + i + '"' + isVisible + '>';
        // Header row
        html += '<div class="coin-entry-header">';
        html += '<span class="coin-entry-num">Coin #' + (i + 1) + '</span>';
        if (slotCount > 1) {
            html += '<button class="coin-entry-remove" data-action="remove-slot" data-slot-idx="' + i + '">Remove</button>';
        }
        html += '</div>';

        // Body: photo strip + fields side by side
        html += '<div class="coin-entry-body">';

        // Multi-photo strip (3 slots: Obv, Rev, Error)
        html += '<div class="coin-entry-photo-strip">';
        var photoLabels = ['Obv', 'Rev', 'Err'];
        var photoSlots = ['obv', 'rev', 'err'];
        for (var p = 0; p < 3; p++) {
            var pSlot = photoSlots[p];
            var pLabel = photoLabels[p];
            var existingPhoto = entry['photo_' + pSlot + '_b64'] || (p === 0 ? (entry.personal_photo || '') : '');
            html += '<div class="coin-entry-photo-slot" data-photo-slot="' + pSlot + '" data-slot-idx="' + i + '">';
            if (existingPhoto) {
                html += '<div class="coin-entry-photo-circle has-photo"><img src="' + existingPhoto + '" alt="' + pLabel + '" class="slot-photo-preview" data-action="slot-photo-preview" data-slot-idx="' + i + '" data-photo-slot="' + pSlot + '"></div>';
            } else {
                html += '<div class="coin-entry-photo-circle"><svg class="coin-entry-photo-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
            }
            html += '<button class="coin-entry-photo-btn" data-action="slot-photo" data-slot-idx="' + i + '" data-photo-slot="' + pSlot + '">' + pLabel + '</button>';
            html += '<span class="slot-photo-name" data-slot-idx="' + i + '" data-photo-slot="' + pSlot + '" data-photo-b64="' + existingPhoto + '">' + (existingPhoto ? '✓' : '') + '</span>';
            html += '</div>';
        }
        html += '</div>'; // end photo-strip

        // Compact 4-column fields grid
        html += '<div class="coin-entry-fields">';
        html += '<div class="coin-field"><label>Grade</label><select class="slot-grade" data-slot-idx="' + i + '">' + buildGradeOptions(entry.grade) + '</select></div>';
        html += '<div class="coin-field"><label>Price ($)</label><input type="number" class="slot-price" data-slot-idx="' + i + '" step="0.01" value="' + (entry.purchase_price || '') + '" placeholder="0.00"></div>';
        html += '<div class="coin-field"><label>Value ($)</label><input type="number" class="slot-value" data-slot-idx="' + i + '" step="0.01" value="' + (entry.current_value || '') + '" placeholder="0.00"></div>';
        html += '<div class="coin-field"><label>Date</label><input type="date" class="slot-date" data-slot-idx="' + i + '" value="' + (entry.date_acquired || '') + '"></div>';
        html += '</div>'; // end fields

        html += '</div>'; // end entry-body

        // Notes (full width below)
        html += '<div class="coin-entry-notes">';
        html += '<label>Notes</label>';
        html += '<textarea class="slot-notes" data-slot-idx="' + i + '" rows="2" placeholder="Where did you get it?">' + escHtml(entry.notes || '') + '</textarea>';
        html += '</div>';
        html += '</div>'; // end entry-card
    }
    if (slotCount < qty) {
        html += '<button class="coin-entry-add" data-action="add-slot">+ Add detail entry (' + slotCount + '/' + qty + ')</button>';
    }
    html += '</div>';
    return html;
}
function saveCoinSlots(coinId, panelEl) {
    var slotCount = getSlotCount(coinId);
    var entries = getInventoryEntries(coinId) || [];
    var promises = [];
    var root = panelEl || document;
    var entriesContainer = root.querySelector('.coin-entries');
    if (!entriesContainer) { return Promise.resolve(); }
    var cards = entriesContainer.querySelectorAll('.coin-entry-card');
    var photoSlotKeys = ['obv', 'rev', 'err'];
    var photoPayloadKeys = ['photo_obv_b64', 'photo_rev_b64', 'photo_err_b64'];
    for (var i = 0; i < slotCount; i++) {
        var entry = entries[i] || {};
        var card = cards[i];
        if (!card) continue;
        var grade = card.querySelector('.slot-grade') ? card.querySelector('.slot-grade').value : '';
        var price = card.querySelector('.slot-price') ? parseFloat(card.querySelector('.slot-price').value) || 0 : 0;
        var value = card.querySelector('.slot-value') ? parseFloat(card.querySelector('.slot-value').value) || 0 : 0;
        var date = card.querySelector('.slot-date') ? card.querySelector('.slot-date').value : '';
        var notes = card.querySelector('.slot-notes') ? card.querySelector('.slot-notes').value.trim() : '';
        var payload = {
            coin_ref_id: coinId, quantity: 1,
            grade: grade, purchase_price: price, current_value: value,
            date_acquired: date, notes: notes
        };
        if (entry.id) payload.id = entry.id;
        // Collect per-slot photos
        for (var p = 0; p < 3; p++) {
            var nameEl = card.querySelector('.slot-photo-name[data-photo-slot="' + photoSlotKeys[p] + '"]');
            if (nameEl && nameEl.dataset.photoB64) {
                payload[photoPayloadKeys[p]] = nameEl.dataset.photoB64;
            }
        }
        // Backwards compat: also set personal_photo to obv if present
        if (payload.photo_obv_b64 && !payload.personal_photo) {
            payload.personal_photo = payload.photo_obv_b64;
        }
        promises.push(updateInventory(coinId, payload));
    }
    return Promise.all(promises).then(function() {
        return fetchInventory();
    }).then(function() {
        window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId: coinId } }));
    });
}


// Coin row builder
// ============================================================

/**
 * Build a single coin row element.
 *
 * @param {Object} coin - Coin object from the API.
 * @returns {HTMLElement}
 */
function buildCoinRow(coin) {
    var entries = getInventoryEntries(coin.id) || [];
    var totalQty = getInventoryTotalQty(coin.id);
    var hasRefNotes = coin.ref_notes && coin.ref_notes.trim().length > 0;
    var wrapper = el("div", {className: "coin-row-wrapper"});
    var row = el("div", {className: "coin-row", dataset: {coinId: coin.id, coinType: coin.coin_type, section: coin.section, coinSubtype: coinTypeToSubtypeKey(coin.coin_type)}});
    row.appendChild(buildStepper(coin.id, totalQty));

    var thumbWrap = el("div", {className: "coin-row-thumb-wrap dual"});
    var cfg = getTypeConfig(getMainType(coin.coin_type));
    var obvSrc = coin.obv_image || (cfg ? cfg.obv_image : null);
    if (obvSrc) {
        var img = el("img", {className: "coin-row-thumb", src: obvSrc, alt: "", loading: "lazy", role: "button", tabIndex: 0, dataset: {action: "view-img", type: coin.coin_type, side: "obv", coinId: coin.id, year: coin.year || '', mintMark: coin.mint_mark || ''}});
        img.onerror = function() { img.src = placeholderCoinSvg(); img.classList.add("placeholder"); };
        thumbWrap.appendChild(img);
    } else {
        thumbWrap.appendChild(el("img", {className: "coin-row-thumb placeholder", src: placeholderCoinSvg(), alt: "", role: "button", tabIndex: 0, dataset: {action: "view-img", type: coin.coin_type, side: "obv"}}));
    }
    var revSrc = coin.rev_image || (cfg ? cfg.rev_image : null);
    if (revSrc) {
        var img2 = el("img", {className: "coin-row-thumb", src: revSrc, alt: "", loading: "lazy", role: "button", tabIndex: 0, dataset: {action: "view-img", type: coin.coin_type, side: "rev", coinId: coin.id, year: coin.year || '', mintMark: coin.mint_mark || ''}});
        img2.onerror = function() { img2.src = placeholderCoinSvg(); img2.classList.add("placeholder"); };
        thumbWrap.appendChild(img2);
    } else {
        thumbWrap.appendChild(el("img", {className: "coin-row-thumb placeholder", src: placeholderCoinSvg(), alt: "", role: "button", tabIndex: 0, dataset: {action: "view-img", type: coin.coin_type, side: "rev"}}));
    }
    row.appendChild(thumbWrap);

    var info = el("div", {className: "coin-row-info"});
    var tl = el("span", {className: "coin-row-title"});
    var yr = coin.year === 1776 ? "1776-1976" : (coin.year || "\u2014");
    var mt = coin.mint_mark ? "-" + coin.mint_mark : "";
    tl.appendChild(document.createTextNode(yr + mt));
    if (coin.is_key_date) tl.append(" ", el("span", {className: "badge badge-key"}, "\u2b50 Key"));
    if (coin.is_proof) tl.append(" ", el("span", {className: "badge badge-proof"}, "\uD83D\uDC8E Proof"));
    if (coin.is_error || isErrorVariety(coin.coin_type, coin.ref_notes)) tl.append(" ", el("span", {className: "badge badge-error"}, "⚠ Error"));
    if (hasRefNotes) tl.append(" ", el("span", {className: "badge badge-historical"}, "📜 Historical Note"));
    info.appendChild(tl);
    var sub = [];
    if (entries.length > 0) { var gr = entries.filter(function(e){return e.grade;}).map(function(e){return e.grade;}); if (gr.length > 0) sub.push(gr.join(", ")); }
    if (coin.mintage) sub.push("Mintage: " + coin.mintage.toLocaleString());
    if (sub.length) info.appendChild(el("span", {className: "coin-row-sub"}, sub.join(" · ")));
    row.appendChild(info);

    // Detail toggle button
    var detailBtn = el("span", {className: "coin-row-detail-toggle", role: "button", tabIndex: 0, dataset: {action: "toggle-detail"}}, "▼ Details");
    row.appendChild(detailBtn);

    var wlItem = (getWishlist() || []).find(function(w){return w.coin_id===coin.id;});
    var wl = el("button", {className: "btn-wishlist pill" + (wlItem?" is-wishlist":""), title: (wlItem?"Remove from":"Add to")+" wishlist", dataset: {action: "add-wishlist", coinId: coin.id}}, wlItem?"\u2764":"Wish List");
    row.appendChild(wl);
    wrapper.appendChild(row);

    // Expandable detail panel — compact layout with inventory gate
    var dp = el("div", {className: "coin-detail-panel"});

    // Reference notes section (compact, shown by default)
    var refToggle, rd;
    if (hasRefNotes) {
        refToggle = el("button", {
            className: "btn-link coin-ref-toggle",
            dataset: {action: "toggle-historical"},
        }, "\uD83D\uDCD6 Reference Notes");
        dp.appendChild(refToggle);
        rd = el("div", {className: "coin-detail-ref"});
        rd.appendChild(el("div", {className: "coin-detail-ref-body"}, coin.ref_notes));
        dp.appendChild(rd);
    }

    // Mintage line (single compact line)
    if (coin.mintage) {
        var mintageEl = el("div", {style: "padding:var(--space-1) var(--space-3);font-size:var(--font-size-sm);color:var(--color-text-muted);"},
            el("span", {style: "font-weight:600;color:var(--color-text-main);"}, "Mintage: "),
            coin.mintage.toLocaleString()
        );
        dp.appendChild(mintageEl);
    }

    // Slots wrapper (rebuildable) — photos are now INSIDE each slot card
    var slotsDiv = el("div", {className: "coin-slots-wrap"});
    dp.appendChild(slotsDiv);

    // Shared Notes
    var sharedNotesWrap = el("div", {style: "padding:var(--space-1) var(--space-3);"},
        el("div", {style: "display:flex;align-items:center;gap:var(--space-2);margin-bottom:2px;"},
            el("span", {style: "font-weight:600;font-size:var(--font-size-sm);color:var(--color-text-main);"}, "\u270F\uFE0F Shared Notes")
        ),
        el("textarea", {
            className: "shared-notes-input",
            rows: 2,
            placeholder: "Add shared notes for this coin...",
            style: "width:100%;background:var(--color-bg-input);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-1) var(--space-2);color:var(--color-text-main);font-size:var(--font-size-sm);resize:vertical;min-height:40px;box-sizing:border-box;"
        }, coin.shared_notes || "")
    );
    dp.appendChild(sharedNotesWrap);

    // No save button — autosave on input change

    // Function to rebuild slots content
    function rebuildSlots() {
        var qty = getInventoryTotalQty(coin.id);
        slotsDiv.innerHTML = "";
        if (qty > 0) {
            slotsDiv.innerHTML = buildCoinSlots(coin.id);
        }
    }

    // Initial build
    rebuildSlots();

    // Autosave on any input/change within the detail panel
    dp.addEventListener('change', function(e) {
        if (e.target.closest('.coin-entry-card') || e.target.closest('.coin-entries-wrap') || e.target.closest('.coin-entries')) {
            saveCoinSlots(coin.id, dp);
        }
    });
    dp.addEventListener('input', function(e) {
        if (e.target.closest('.slot-notes')) {
            // Debounce notes autosave
            clearTimeout(dp._notesTimeout);
            dp._notesTimeout = setTimeout(function() {
                saveCoinSlots(coin.id, dp);
            }, 800);
        }
    });

    // Track if user explicitly opened the historical note
    var histNoteWasOpen = false;

    // Toggle detail panel open/closed — INVENTORY GATE: only show slots when qty >= 1
    function toggleDetail(forceOpen) {
        var qty = getInventoryTotalQty(coin.id);
        var isOpen = forceOpen !== undefined ? forceOpen : !dp.classList.contains("open");
        if (isOpen) {
            dp.classList.add("open");
            detailBtn.textContent = "\u25b2 Less";
            row.classList.add("is-expanded");
            if (qty >= 1) {
                rebuildSlots();
            }
            if (qty === 0 && refToggle && rd) {
                rd.style.display = "block";
                refToggle.textContent = "\uD83D\uDCD6 Hide Notes";
                histNoteWasOpen = true;
                dp.dataset.histOpen = 'true';
            }
        } else {
            dp.classList.remove("open");
            detailBtn.textContent = "\u25bc Details";
            row.classList.remove("is-expanded");
        }
    }

    detailBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        toggleDetail();
    });

    row.addEventListener("click", function(e) {
        if (e.target.closest('[data-action="view-img"]') || e.target.closest("button") || e.target.closest(".stepper") || e.target.closest(".coin-row-thumb-wrap") || e.target.closest(".coin-row-detail-toggle") || e.target.closest('[data-action="toggle-historical"]') || e.target.closest(".coin-slots-wrap")) return;
        toggleDetail();
    });

    // Detail panel event delegation
    dp.addEventListener("click", function(e) {
        // Historical note toggle
        var histToggle = e.target.closest('[data-action="toggle-historical"]');
        if (histToggle) {
            e.stopPropagation();
            var refDiv = histToggle.nextElementSibling;
            if (refDiv && refDiv.classList.contains("coin-detail-ref")) {
                var isVisible = refDiv.style.display !== "none";
                refDiv.style.display = isVisible ? "none" : "block";
                histToggle.textContent = isVisible ? "\uD83D\uDCD6 Reference Notes" : "\uD83D\uDCD6 Hide Notes";
                // Track if user explicitly opened the note
                histNoteWasOpen = !isVisible;
                dp.dataset.histOpen = histNoteWasOpen ? 'true' : 'false';
            }
            return;
        }

        // Add slot button

        var addSlotBtn = e.target.closest('[data-action="add-slot"]');
        if (addSlotBtn) {
            e.stopPropagation();
            var currentCount = getSlotCount(coin.id);
            var maxQty = getInventoryTotalQty(coin.id) || 0;
            if (currentCount < maxQty) {
                localStorage.setItem("slots_" + coin.id, currentCount + 1);
                rebuildSlots();
            }
            return;
        }

        // Remove slot button — removes one slot's details
        var rmSlotBtn = e.target.closest('[data-action="remove-slot"]');
        if (rmSlotBtn) {
            e.stopPropagation();
            var rmIdx = parseInt(rmSlotBtn.dataset.slotIdx, 10);
            var currentSlots = getSlotCount(coin.id);
            var newCount = Math.max(0, currentSlots - 1);
            localStorage.setItem("slots_" + coin.id, newCount);
            // Remove the inventory entry for this slot
            var rmEntries = getInventoryEntries(coin.id) || [];
            if (rmEntries[rmIdx] && rmEntries[rmIdx].id) {
                // Delete this specific entry from the backend
                fetch('/api/inventory/' + rmEntries[rmIdx].id, { method: 'DELETE' })
                    .then(function() { return fetchInventory(); })
                    .then(function() {
                        window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId: coin.id } }));
                    });
            }
            rebuildSlots();
            return;
        }

        // Switch instance tab
        var tabBtn = e.target.closest('[data-action="switch-instance"]');
        if (tabBtn) {
            e.stopPropagation();
            var tIdx = parseInt(tabBtn.dataset.instanceIdx, 10);
            dp.querySelectorAll('.coin-instance-tab').forEach(function(t, ti) {
                t.classList.toggle('active', ti === tIdx);
                t.setAttribute('aria-selected', ti === tIdx ? 'true' : 'false');
            });
            dp.querySelectorAll('.coin-entry-card').forEach(function(card) {
                var cardIdx = parseInt(card.dataset.instanceIdx, 10);
                card.style.display = cardIdx === tIdx ? '' : 'none';
                card.classList.toggle('is-active', cardIdx === tIdx);
            });
            return;
        }

        // Photo upload button — supports data-photo-slot (obv, rev, err)
        var photoBtn = e.target.closest('[data-action="slot-photo"]');
        if (photoBtn) {
            e.stopPropagation();
            var pIdx = parseInt(photoBtn.dataset.slotIdx, 10);
            var pSlot = photoBtn.dataset.photoSlot || 'obv';
            var fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.addEventListener('change', function(ev) {
                var file = ev.target.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function(re) {
                    var img = new Image();
                    img.onload = function() {
                        // Canvas compression: max 300x300, keep aspect ratio
                        var MAX = 300;
                        var canvas = document.createElement('canvas');
                        var scale = Math.min(MAX / img.width, MAX / img.height, 1);
                        canvas.width = Math.round(img.width * scale);
                        canvas.height = Math.round(img.height * scale);
                        var ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#1a1a1a';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        var b64 = canvas.toDataURL('image/webp', 0.8);
                        // Store on the per-slot photo name element
                        var nameSel = '.slot-photo-name[data-slot-idx="' + pIdx + '"][data-photo-slot="' + pSlot + '"]';
                        var nameEl = dp.querySelector(nameSel);
                        if (nameEl) {
                            nameEl.textContent = '✓';
                            nameEl.dataset.photoB64 = b64;
                        }
                        // Update the thumbnail circle for this specific photo slot
                        var slotCircle = dp.querySelector('.coin-entry-photo-slot[data-slot-idx="' + pIdx + '"][data-photo-slot="' + pSlot + '"] .coin-entry-photo-circle');
                        if (slotCircle) {
                            slotCircle.classList.add('has-photo');
                            slotCircle.innerHTML = '<img src="' + b64 + '" class="slot-photo-preview" data-action="slot-photo-preview" data-slot-idx="' + pIdx + '" data-photo-slot="' + pSlot + '" alt="' + pSlot + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;cursor:pointer;" title="Click to zoom">';
                        }
                        // Change the label button to "Change"
                        var labelBtn = dp.querySelector('.coin-entry-photo-btn[data-slot-idx="' + pIdx + '"][data-photo-slot="' + pSlot + '"]');
                        if (labelBtn) labelBtn.textContent = 'Change';
                        // Add remove button for this slot if not present
                        var photoSlotEl = dp.querySelector('.coin-entry-photo-slot[data-slot-idx="' + pIdx + '"][data-photo-slot="' + pSlot + '"]');
                        if (photoSlotEl && !photoSlotEl.querySelector('.coin-entry-photo-remove')) {
                            var rmBtn = el('button', {type:'button', className:'coin-entry-photo-remove', dataset:{action:'slot-photo-remove','slot-idx':String(pIdx),'photo-slot':pSlot}}, '✕');
                            photoSlotEl.appendChild(rmBtn);
                        }
                        // Auto-save
                        saveCoinSlots(coin.id, dp);
                    };
                    img.src = re.target.result;
                };
                reader.readAsDataURL(file);
            });
            fileInput.click();
            return;
        }

        // Photo preview click — zoom
        var previewClick = e.target.closest('[data-action="slot-photo-preview"]');
        if (previewClick) {
            e.stopPropagation();
            var zoomOverlay = document.getElementById('coin-zoom-overlay');
            var zoomImg = document.getElementById('coin-zoom-img');
            if (zoomOverlay && zoomImg) {
                zoomImg.src = previewClick.src;
                zoomOverlay.style.display = 'flex';
            }
            return;
        }

        // Photo remove button — supports data-photo-slot
        var photoRmBtn = e.target.closest('[data-action="slot-photo-remove"]');
        if (photoRmBtn) {
            e.stopPropagation();
            var prIdx = parseInt(photoRmBtn.dataset.slotIdx, 10);
            var prSlot = photoRmBtn.dataset.photoSlot || 'obv';
            var nameEl2 = dp.querySelector('.slot-photo-name[data-slot-idx="' + prIdx + '"][data-photo-slot="' + prSlot + '"]');
            if (nameEl2) {
                nameEl2.textContent = '';
                delete nameEl2.dataset.photoB64;
            }
            var slotCircle2 = dp.querySelector('.coin-entry-photo-slot[data-slot-idx="' + prIdx + '"][data-photo-slot="' + prSlot + '"] .coin-entry-photo-circle');
            if (slotCircle2) {
                slotCircle2.classList.remove('has-photo');
                slotCircle2.innerHTML = '<svg class="coin-entry-photo-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
            }
            var labelBtn2 = dp.querySelector('.coin-entry-photo-btn[data-slot-idx="' + prIdx + '"][data-photo-slot="' + prSlot + '"]');
            if (labelBtn2) labelBtn2.textContent = prSlot.charAt(0).toUpperCase() + prSlot.slice(1);
            if (photoRmBtn.parentNode) photoRmBtn.remove();
            saveCoinSlots(coin.id, dp);
            return;
        }
    });

    wrapper.appendChild(dp);
    return wrapper;
}



/**
 * Build a +/− quantity stepper widget.
 *
 * @param {number} coinId
 * @param {number} qty    - Current quantity.
 * @returns {HTMLElement}
 */
function buildStepper(coinId, qty) {
    const wrap = el('div', { className: 'stepper', dataset: { coinId } });

    const dec = el('button', {
        className: 'stepper-btn',
        'aria-label': 'Remove one',
        dataset: { action: 'stepper-dec', coinId },
    }, '−');

    const val = el('span', { className: 'stepper-value', 'aria-live': 'polite' }, String(qty));
    val.style.color = qty > 0 ? 'var(--color-accent)' : '';

    const inc = el('button', {
        className: 'stepper-btn',
        'aria-label': 'Add one',
        dataset: { action: 'stepper-inc', coinId },
    }, '+');

    wrap.append(dec, val, inc);
    return wrap;
}

export function updateStickyOffsets() {
    const root = document.documentElement;
    const countryHeader = document.querySelector(".country-group-header");
    const sectionHeader = document.querySelector(".section-header");
    const appHeader = document.getElementById("app-header");

    const countryH = countryHeader ? countryHeader.offsetHeight : 56;
    const sectionH = sectionHeader ? sectionHeader.offsetHeight : 48;
    // Only include app-header height when it's actually sticky (mobile).
    // On desktop the header is static and must not affect sticky offsets.
    const headerH = (appHeader && getComputedStyle(appHeader).position === "sticky")
        ? appHeader.offsetHeight
        : 0;

    root.style.setProperty("--header-height", headerH + "px");
    root.style.setProperty("--country-bar-height", countryH + "px");
    root.style.setProperty("--section-header-height", sectionH + "px");
    root.style.setProperty("--section-bar-top", (headerH + countryH) + "px");
    root.style.setProperty("--type-bar-top", (headerH + countryH + sectionH) + "px");
}

// ============================================================
// Scroll-Driven Sticky Header Manager
// Uses CSS position: sticky for positioning.
// JS only manages z-index stacking order and re-collects headers after DOM changes.
// ============================================================

let _stickyItems = [];
let _stickyRAF = null;
let _stickyListenerAttached = false;

/**
 * Get the sticky top position for a given header level.
 */
function _stickyTopFor(level) {
    const root = getComputedStyle(document.documentElement);
    switch (level) {
        case 'country': return parseInt(root.getPropertyValue('--header-height')) || 60;
        case 'section': return parseInt(root.getPropertyValue('--section-bar-top')) || 116;
        case 'type':    return parseInt(root.getPropertyValue('--type-bar-top')) || 164;
    }
    return 0;
}

function initStickyHeaders() {
    if (_stickyRAF) { cancelAnimationFrame(_stickyRAF); _stickyRAF = null; }
    _stickyItems = [];

    updateStickyOffsets();

    document.querySelectorAll('.country-group-header, .section-header, .type-header').forEach(function (el) {
        var level = 'type';
        if (el.classList.contains('country-group-header')) level = 'country';
        else if (el.classList.contains('section-header')) level = 'section';

        _stickyItems.push({
            el: el,
            level: level,
        });
    });

    if (!_stickyItems.length) return;

    // Attach scroll listener to catalog-container once
    if (!_stickyListenerAttached) {
        _stickyListenerAttached = true;
        var container = document.getElementById('catalog-container');
        if (container) {
            container.addEventListener('scroll', function () {
                if (_stickyRAF) return;
                _stickyRAF = requestAnimationFrame(function () {
                    _stickyRAF = null;
                    _stickyOnScroll();
                });
            }, { passive: true });
        }
    }
}

/**
 * After DOM changes (expand/collapse), re-collect headers since new ones may exist.
 */
function _stickyRecalcAll() {
    _stickyItems = [];
    document.querySelectorAll('.country-group-header, .section-header, .type-header').forEach(function (el) {
        var level = 'type';
        if (el.classList.contains('country-group-header')) level = 'country';
        else if (el.classList.contains('section-header')) level = 'section';
        _stickyItems.push({ el: el, level: level });
    });
}

/**
 * Set z-index on all headers so stuck headers stack correctly:
 * country (150) > section (110) > type (95)
 * Headers that are "stuck" (their top is at or above their sticky threshold) get higher z-index.
 */
function _stickyOnScroll() {
    var container = document.getElementById('catalog-container');
    if (!container) return;

    var containerRect = container.getBoundingClientRect();

    _stickyItems.forEach(function (item) {
        var el = item.el;
        var level = item.level;
        if (!el || !el.parentNode) return;

        var stuckTop = _stickyTopFor(level);

        // Element's visual position relative to the container (not viewport)
        var currentTop = el.getBoundingClientRect().top - containerRect.top;

        // If the header is visually at or very near its stuck threshold, boost z-index
        var isNearStuck = Math.abs(currentTop - stuckTop) < 5;

        if (isNearStuck) {
            el.style.zIndex = level === 'country' ? '150' : level === 'section' ? '110' : '95';
        } else {
            // Not stuck — use natural z-index
            el.style.zIndex = '';
        }
    });
}

async function handleCatalogClick(e) {
    const target = e.target;

    // Image click (check BEFORE section toggle so img buttons inside headers work)
    const imgBtn = target.closest('[data-action="view-img"]');
    if (imgBtn) {
        e.stopPropagation();
        const { type, side, coinId } = imgBtn.dataset;
        // When coinId is present, this is a coin reference image (not inventory item)
        const isCoinRef = !!coinId;
        // Set coin metadata for proper image naming
        const { year, mintMark } = imgBtn.dataset;
        import('./images.js').then(m => {
            // Set coin metadata on the images module
            if (m.setCoinMeta) m.setCoinMeta(year ? parseInt(year) : null, mintMark || null);
            m.openImageInteractionModal(imgBtn, type, side, isCoinRef, coinId, false, null);
        });
        return;
    }

    // Section header toggle
    const sectionHeader = target.closest('[data-action="toggle-section"]');
    if (sectionHeader) {
        e.stopPropagation();
        await expandSection(sectionHeader.dataset.section);
        return;
    }

    // Stepper +
    const incBtn = target.closest('[data-action="stepper-inc"]');
    if (incBtn) {
        e.stopPropagation();
        await handleStepperChange(parseInt(incBtn.dataset.coinId, 10), +1);
        return;
    }

    // Stepper −
    const decBtn = target.closest('[data-action="stepper-dec"]');
    if (decBtn) {
        e.stopPropagation();
        await handleStepperChange(parseInt(decBtn.dataset.coinId, 10), -1);
        return;
    }

    // Wishlist click
    const wlBtn = target.closest('[data-action="add-wishlist"]');
    if (wlBtn) {
        e.stopPropagation();
        await toggleWishlist(wlBtn.dataset.coinId);
        return;
    }

    // Reference Link - show historical info in a modal
    const refLink = target.closest('[data-action="show-ref-notes"]');
    if (refLink) {
        e.stopPropagation();
        e.preventDefault();
        showHistoricalModal(refLink.dataset.notes);
        return;
    }

    // Row click - now handled by buildCoinRow inline toggle (no modal)
}

/**
 * Increment or decrement a coin's generic quantity.
 *
 * @param {number} coinId
 * @param {number} delta  - +1 or -1.
 */
async function handleStepperChange(coinId, delta) {
    // Lock scroll position
    const scrollY = window.scrollY;
    const catalogContainer = document.getElementById('catalog-container');
    const catalogTop = catalogContainer ? catalogContainer.getBoundingClientRect().top : 0;

    const entries = getInventoryEntries(coinId) || [];
    const totalQty = getInventoryTotalQty(coinId);
    
    // We cannot drop below 0
    if (delta < 0 && totalQty <= 0) return;

    // Determine WHICH entry to modify.
    // Prefer modifying a "generic" copy (no grade, no notes, no photo)
    let targetEntry = entries.find(e => !e.grade && !e.notes && !e.personal_photo);
    
    if (delta > 0) {
        // Increment
        if (targetEntry) {
            targetEntry.quantity += 1;
        } else {
            // No generic copy found, simulate a new one
            targetEntry = { coin_ref_id: coinId, quantity: 1 };
            entries.push(targetEntry);
        }
    } else {
        // Decrement
        if (!targetEntry) {
            // No generic copy, just decrement the last entry we have
            targetEntry = entries[entries.length - 1];
        }
        targetEntry.quantity -= 1;
    }

    const newTotalQty = totalQty + delta;
    updateStepperDisplay(coinId, newTotalQty);

    try {
        const payload = {
            id: targetEntry.id, // may be undefined for new entries
            coin_ref_id: coinId,
            quantity: targetEntry.quantity,
            grade: targetEntry.grade || '',
            purchase_price: targetEntry.purchase_price || 0,
            current_value: targetEntry.current_value || 0,
            date_acquired: targetEntry.date_acquired || '',
            notes: targetEntry.notes || ''
        };
        
        const result = await updateInventory(coinId, payload);
        
        // Update album holes in place if in album mode (avoids full re-render)
        const { _ccUpdateHoleInPlace } = await import('./album.js');
        _ccUpdateHoleInPlace(coinId, newTotalQty);
        
        // Dispatch event for other listeners
        window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId } }));
        
    } catch (err) {
        showToast(`Failed to save — ${err.message}`, 'error');
        // Rollback: restore the previous quantity display
        updateStepperDisplay(coinId, totalQty);
    }

    // Restore scroll position if shifted
    if (catalogContainer) {
        const newTop = catalogContainer.getBoundingClientRect().top;
        const delta = newTop - catalogTop;
        if (Math.abs(delta) > 0.5) {
            window.scrollBy(0, -delta);
        }
    } else if (Math.abs(window.scrollY - scrollY) > 0.5) {
        window.scrollTo(0, scrollY);
    }
}
/**
 * Toggle wishlist status for a coin.
 * Checks current state from wishlist data, adds or removes accordingly.
 *
 * @param {number} coinId - The coin reference ID.
 */
async function toggleWishlist(coinId) {
    // Lock scroll position
    const scrollY = window.scrollY;
    const catalogContainer = document.getElementById('catalog-container');
    const catalogTop = catalogContainer ? catalogContainer.getBoundingClientRect().top : 0;

    try {
        const wishlist = getWishlist();
        const item = wishlist.find(w => w.coin_id === coinId);
        if (item) {
            await removeFromWishlist(coinId);
            showToast("Removed from wishlist", "info");
        } else {
            await addToWishlist(coinId);
            showToast("Added to wishlist", "success");
        }
        // Refresh wishlist state from server
        try {
            const freshWl = await fetchWishlist();
            setWishlist(freshWl);
        } catch (e) { /* ignore refresh error */ }

        const sel = '[data-action="add-wishlist"][data-coin-id="' + coinId + '"]';
        document.querySelectorAll(sel).forEach(btn => {
            btn.classList.toggle("is-wishlist", !item);
            btn.title = item ? "Add to wishlist" : "Remove from wishlist";
        });
    } catch (err) {
        showToast("Wishlist error: " + err.message, "error");
    }

    // Restore scroll position if shifted
    if (catalogContainer) {
        const newTop = catalogContainer.getBoundingClientRect().top;
        const delta = newTop - catalogTop;
        if (Math.abs(delta) > 0.5) {
            window.scrollBy(0, -delta);
        }
    } else if (Math.abs(window.scrollY - scrollY) > 0.5) {
        window.scrollTo(0, scrollY);
    }
}




/**
 * Update stepper display elements in the DOM for a given coinId.
 * Finds ALL steppers with this coinId (there may be none if section is collapsed).
 *
 * @param {number} coinId
 * @param {number} qty
 */
function updateStepperDisplay(coinId, qty) {
    document.querySelectorAll(`.stepper[data-coin-id="${coinId}"] .stepper-value`)
        .forEach(el => {
            el.textContent = String(qty);
            el.style.color = qty > 0 ? 'var(--color-accent)' : '';
        });
}

// Listen for updates from the details modal
// Listen for inventory updates — update stepper displays without rebuilding DOM
window.addEventListener('cc-inventory-updated', async (e) => {
    const newInv = await fetchInventory();
    const stateMod = await import('./state.js');
    stateMod.setInventory(newInv);
    const affectedCoinId = e.detail && e.detail.coinId;
    
    // Update stepper displays for all coin rows
    document.querySelectorAll('.coin-row').forEach(row => {
        const cid = parseInt(row.dataset.coinId, 10);
        if (!cid) return;
        const newQty = stateMod.getInventoryTotalQty(cid);
        const valEl = row.querySelector('.stepper-value');
        if (valEl) {
            valEl.textContent = String(newQty);
            valEl.style.color = newQty > 0 ? 'var(--color-accent)' : '';
        }
    });

    // FIX: If the affected coin's detail panel is open, rebuild its slots
    if (affectedCoinId) {
        document.querySelectorAll('.coin-row').forEach(row => {
            const cid = parseInt(row.dataset.coinId, 10);
            if (cid !== affectedCoinId) return;
            const wrapper = row.closest('.coin-row-wrapper');
            if (!wrapper) return;
            const dp = wrapper.querySelector('.coin-detail-panel');
            const detailBtn = row.querySelector('.coin-row-detail-toggle');
            if (!dp) return;
            const isOpen = dp.classList.contains('open');
            const newQty = stateMod.getInventoryTotalQty(cid);
            // Rebuild slots
            const slotsDiv = wrapper.querySelector('.coin-slots-wrap');
            if (slotsDiv) {
                if (newQty > 0) {
                    slotsDiv.innerHTML = buildCoinSlots(cid);
                } else {
                    slotsDiv.innerHTML = '';
                }
            }
            // Only auto-expand if the panel was already open AND user had historical note open
            if (newQty > 0 && isOpen && dp.dataset.histOpen === 'true') {
                // Panel was already open, rebuild slots to show new coin slot
                if (slotsDiv) slotsDiv.innerHTML = buildCoinSlots(cid);
            }
        });
    }
});

// Listen for image updates (upload/delete) — re-render open sections to refresh images
window.addEventListener('cc-image-updated', async (e) => {
    try {
        const updatedConfigs = await fetchTypeConfigs();
        setTypeConfigs(updatedConfigs);
    } catch (cfgErr) {
        console.warn('[catalog] Could not refresh type configs:', cfgErr);
    }
    // Re-render all currently open sections (preserves accordion state)
    document.querySelectorAll('.section-content.open').forEach(content => {
        const card = content.closest('.section-card');
        if (!card) return;
        const sectionName = card.dataset.section;
        if (sectionName) {
            const cached = getCoinsForSection(sectionName);
            if (cached) {
                renderTypeAccordions(content, cached);
                    }
        }
    });
    // Update section/subsection badges with new owned counts
    const stateMod2 = await import('./state.js');
    document.querySelectorAll('.type-wrapper').forEach(wrapper => {
        const header = wrapper.querySelector('.type-header');
        const badge = header ? header.querySelector('.count-badge') : null;
        if (!badge) return;
        const rows = wrapper.querySelectorAll('.coin-row');
        let ownedCount = 0;
        rows.forEach(r => {
            const cid = parseInt(r.dataset.coinId, 10);
            if (cid && stateMod2.getInventoryTotalQty(cid) > 0) ownedCount++;
        });
        const total = rows.length;
        badge.textContent = ownedCount + '/' + total;
        badge.className = 'count-badge' + (ownedCount === total ? ' complete' : ownedCount > 0 ? ' owned' : '');
    });
});

// ============================================================
// Historical Info Modal
// ============================================================

function showHistoricalModal(notes) {
    // Remove any existing inline panel
    const existing = document.getElementById("historical-inline-panel");
    if (existing) existing.remove();

    const escaped = notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Create an inline bottom bar instead of a modal overlay
    const panel = document.createElement("div");
    panel.id = "historical-inline-panel";
    panel.className = "historical-inline-panel";
    panel.innerHTML = '<div class="historical-inline-header"><h3>Historical Info</h3><button class="historical-inline-close" aria-label="Close">&times;</button></div><div class="historical-inline-body"><p>' + escaped + '</p></div>';

    document.body.appendChild(panel);

    function close() { panel.remove(); }
    panel.querySelector(".historical-inline-close").addEventListener("click", close);
}

// ============================================================
// Catalog View Mode (List vs Album)
// ============================================================

let _catalogViewMode = localStorage.getItem('catalogViewMode') || 'list';

export function getCatalogViewMode() {
    return _catalogViewMode;
}

export async function setCatalogViewMode(mode) {
    _catalogViewMode = mode;
    localStorage.setItem('catalogViewMode', mode);
    const container = document.getElementById('catalog-container');
    if (!container) return;
    if (mode === 'album' || mode === 'folder') {
        container.classList.add('album-mode');
        clearAlbumCache();
    } else {
        container.classList.remove('album-mode');
    }
    // Re-render sections — renderSections() already restores expanded sections
    // from _expandedSections set and re-renders type accordions.
    // After render, if in album mode, render album inline for expanded types.
    renderSections();
    // After DOM is rebuilt, render album inline for any expanded type sections
    if (mode === 'album' || mode === 'folder') {
        container.querySelectorAll('.type-content.open').forEach(function(typeContent) {
            var typeWrapper = typeContent.closest('.type-wrapper');
            if (!typeWrapper) return;
            var sectionCard = typeWrapper.closest('.section-card');
            if (!sectionCard) return;
            var secName = sectionCard.dataset.section;
            var header = typeWrapper.querySelector('.type-header');
            var mainType = header ? header.querySelector('.type-title')?.textContent?.trim() : '';
            if (secName && mainType) {
                renderAlbumType(secName, mainType, typeContent, header);
            }
        });
    }
}

// ============================================================
// Drag-and-Drop Section Reordering
// ============================================================
function initSectionDragAndDrop() {
    const container = document.getElementById('catalog-container');
    if (!container) return;
    container.addEventListener('dragstart', _dndOnDragStart);
    container.addEventListener('dragover', _dndOnDragOver);
    container.addEventListener('dragenter', e => e.preventDefault());
    container.addEventListener('dragleave', _dndOnDragLeave);
    container.addEventListener('drop', _dndOnDrop);
    container.addEventListener('dragend', _dndOnDragEnd);
    document.querySelectorAll('.section-card').forEach(card => {
        const handle = card.querySelector('.drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', () => card.setAttribute('draggable', 'true'));
            handle.addEventListener('mouseup', () => card.removeAttribute('draggable'));
        }
    });
}

let _dndCard = null;

function _dndOnDragStart(e) {
    const card = e.target.closest('.section-card');
    if (!card) return;
    _dndCard = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.section || '');
}

function _dndOnDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('.section-card');
    if (card && card !== _dndCard) card.classList.add('drag-over');
}

function _dndOnDragLeave(e) {
    const card = e.target.closest('.section-card');
    if (card) card.classList.remove('drag-over');
}

function _dndOnDrop(e) {
    e.preventDefault();
    const target = e.target.closest('.section-card');
    if (!target || !_dndCard || target === _dndCard) return;
    const group = target.closest('.country-group-content');
    if (!group) return;
    const cards = [...group.querySelectorAll('.section-card')];
    const draggedIdx = cards.indexOf(_dndCard);
    const targetIdx = cards.indexOf(target);
    if (draggedIdx < targetIdx) {
        group.insertBefore(_dndCard, target.nextSibling);
    } else {
        group.insertBefore(_dndCard, target);
    }
    _persistSectionOrder();
    target.classList.remove('drag-over');
}

function _dndOnDragEnd() {
    document.querySelectorAll('.section-card').forEach(c => c.classList.remove('drag-over', 'dragging'));
    _dndCard = null;
}

function _persistSectionOrder() {
    try {
        const order = [];
        document.querySelectorAll('.country-group-content').forEach(group => {
            const country = group.previousElementSibling?.dataset?.country || '';
            group.querySelectorAll('.section-card').forEach(card => {
                order.push({ country, section: card.dataset.section });
            });
        });
        localStorage.setItem('cc-section-order', JSON.stringify(order));
    } catch (e) { console.warn('Failed to persist section order:', e); }
}

function applySectionOrder() {
    const saved = localStorage.getItem('cc-section-order');
    if (!saved) return;
    try {
        const order = JSON.parse(saved);
        const byCountry = {};
        order.forEach(({ country, section }) => {
            (byCountry[country] = byCountry[country] || []).push(section);
        });
        Object.entries(byCountry).forEach(([country, sections]) => {
            const header = document.querySelector(`.country-group-header[data-country="${country}"]`);
            if (!header) return;
            const content = header.nextElementSibling;
            if (!content) return;
            const cards = [...content.querySelectorAll('.section-card')];
            cards.sort((a, b) => sections.indexOf(a.dataset.section) - sections.indexOf(b.dataset.section));
            cards.forEach(card => content.appendChild(card));
        });
    } catch (e) { console.warn('Failed to apply section order:', e); }
}
