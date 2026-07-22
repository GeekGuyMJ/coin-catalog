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
    getMainType, getSubType, isCompositionSub, isErrorVariety, getDateVariety,
    typeYearSpan, coinSortComparator, escHtml, placeholderCoinSvg, el, formatMintMark, isSpecialReverse,
} from './utils.js?v=4';

import {
    getSections, getCoinsForSection, setCoinsForSection,
    getTypeConfig,
} from './state.js?v=4';

import { fetchCoinsForSection, updateInventory, fetchInventory, fetchWishlist, addToWishlist, removeFromWishlist } from './api.js?v=4';
import { showToast } from './notifications.js?v=4';
import { openImageInteractionModal } from './images.js?v=4';
import { renderAlbumType, clearAlbumCache } from './album.js?v=4';
import { getInventoryEntries, getInventoryTotalQty, setInventoryEntries, getWishlist, setWishlist } from './state.js?v=4';

// --- Expanded State Preservation ---
const _expandedSections = new Set();
const _expandedTypes = new Set();
const _expandedCountries = new Set(['United States', 'Canada']); // Default US/Canada open

// --- View Mode ---
function isAlbumMode() {
    return _catalogViewMode === 'folder' || _catalogViewMode === 'album';
}

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
            if (sectionName && !_expandedSections.has(sectionName) && !sectionName.includes('Half Cent')) {
                expandSection(sectionName);
            }
        }
    }

    // Set variables for album mode
    const fc = localStorage.getItem('cc-folder-color') || 'green';
    const fcMap = {green:'#2d4a2d',blue:'#2d3a4a',red:'#4a2d2d',brown:'#4a3d2d',black:'#1a1a1a',purple:'#3d2d4a',gray:'#3a3a3a'};
    const ftMap = {green:'#c9a227',blue:'#7db3d8',red:'#e8a0a0',brown:'#d4a574',black:'#888888',purple:'#c9a0d4',gray:'#aaaaaa'};
    const fcVal = fcMap[fc] || fcMap.green;
    const ftVal = ftMap[fc] || ftMap.green;
    container.style.setProperty('--folder-color', fcVal);
    container.style.setProperty('--folder-header-text', ftVal);

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
        className: 'view-toggle-btn' + (currentMode === 'list' ? ' active' : ''),
        title: 'List view'
    }, '☰ List');

    const albumBtn = el('button', {
        className: 'view-toggle-btn' + (currentMode === 'folder' ? ' active' : ''),
        title: 'Album view'
    }, ' Album');

    listBtn.addEventListener('click', (e) => { e.stopPropagation(); setCatalogViewMode('list'); });
    albumBtn.addEventListener('click', (e) => { e.stopPropagation(); setCatalogViewMode('folder'); });
    viewToggle.append(listBtn, albumBtn);

    const chevron = el('span', { className: 'section-chevron' }, '▾');
    const dragHandle = el('span', { className: 'drag-handle', onclick: e => e.stopPropagation() }, '≡');
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
    const sectionId = 'section-' + sec.section.replace(/[^a-zA-Z0-9]/g, '');
    const card = el('div', {
        className: 'section-card',
        id: sectionId,
        dataset: { section: sec.section },
    });

    // Check initial visibility
    try {
        const vis = JSON.parse(localStorage.getItem('cc-card-visibility') || '{}');
        if (vis[sectionId] === false) card.style.display = 'none';
    } catch(e) {}

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
        if (sec.section) {
            // Use sample_type (a coin type name with images) not section name (which is never a type config key)
            const cfg = getTypeConfig(sec.sample_type) || getTypeConfig(sec.section) || {};
            const isMintSet = sec.section.includes('Mint Set') || sec.section.includes('Proof Set') || sec.section.includes('Special Mint');
            const pair = el('div', { className: 'coin-img-pair' });
            const hasObv = cfg?.obv_image;
            const hasRev = cfg?.rev_image;
            if (hasObv) {
                const img = el('img', { 
                    className: isMintSet ? 'coin-thumb obv mint-set-img' : 'coin-thumb obv', 
                    src: cfg.obv_image, 
                    alt: '', 
                    dataset: { action: 'view-img', type: sec.section, side: 'obv' } 
                });
                img.onerror = () => { img.src = placeholderCoinSvg(); img.classList.add('placeholder'); };
                pair.appendChild(img);
            } else {
                const ph = el('img', { 
                    className: isMintSet ? 'coin-thumb obv placeholder mint-set-img' : 'coin-thumb obv placeholder', 
                    src: placeholderCoinSvg(), 
                    alt: '', 
                    role: 'button', 
                    tabIndex: 0, 
                    dataset: { action: 'view-img', type: sec.section, side: 'obv' } 
                });
                ph.onerror = () => { ph.src = placeholderCoinSvg(); ph.classList.add('placeholder'); };
                pair.appendChild(ph);
            }
            if (hasRev) {
                const img = el('img', { 
                    className: isMintSet ? 'coin-thumb rev mint-set-img' : 'coin-thumb rev', 
                    src: cfg.rev_image, 
                    alt: '', 
                    dataset: { action: 'view-img', type: sec.section, side: 'rev' } 
                });
                img.onerror = () => { img.src = placeholderCoinSvg(); img.classList.add('placeholder'); };
                pair.appendChild(img);
            } else {
                const ph = el('img', { 
                    className: isMintSet ? 'coin-thumb rev placeholder mint-set-img' : 'coin-thumb rev placeholder', 
                    src: placeholderCoinSvg(), 
                    alt: '', 
                    role: 'button', 
                    tabIndex: 0, 
                    dataset: { action: 'view-img', type: sec.section, side: 'rev' } 
                });
                ph.onerror = () => { ph.src = placeholderCoinSvg(); ph.classList.add('placeholder'); };
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

    const dragHandle = el('span', {
        className: 'drag-handle',
        title: 'Drag to reorder',
        style: 'font-size:1.2rem; color:var(--color-text-muted); cursor:grab; user-select:none; margin-left:auto; padding:0 var(--space-2); display:flex; align-items:center; flex-shrink:0;',
        onclick: e => e.stopPropagation(),
    }, '≡');

    const chevron = el('span', { className: 'section-chevron', 'aria-hidden': 'true' }, '▾');

    header.append(left, dragHandle, chevron);

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
    const sectionId = 'section-' + sectionName.replace(/[^a-zA-Z0-9]/g, '');
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
    
    // Check initial visibility
    try {
        const vis = JSON.parse(localStorage.getItem('cc-card-visibility') || '{}');
        if (vis[typeId] === false) wrapper.style.display = 'none';
    } catch(e) {}

    // --- Header ---
    const header = el('div', {
        className: 'type-header',
        role: 'button',
        tabIndex: 0,
        'aria-expanded': 'false',
        dataset: { action: 'toggle-type', type: mainType },
    });

    const left = el('div', { className: 'type-header-left' });

    // Coin thumbnails
    const isMintSet = mainType.includes('Mint Set') || mainType.includes('Proof Set') || mainType.includes('Special Mint');
    const pair = el("div", { className: "coin-img-pair" });
    if (cfg.obv_image) {
        const imgObv = el("img", {
            className: isMintSet ? "coin-thumb obv mint-set-img" : "coin-thumb obv",
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
            className: isMintSet ? "coin-thumb obv placeholder mint-set-img" : "coin-thumb obv placeholder",
            src: placeholderCoinSvg(),
            alt: "Upload " + mainType + " obverse",
            role: "button",
            tabIndex: 0,
            dataset: { action: "view-img", type: mainType, side: "obv" },
        });
        pair.appendChild(placeholderObv);
    }
    if (cfg.rev_image) {
        const imgRev = el("img", {
            className: isMintSet ? "coin-thumb rev mint-set-img" : "coin-thumb rev",
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
            className: isMintSet ? "coin-thumb rev placeholder mint-set-img" : "coin-thumb rev placeholder",
            src: placeholderCoinSvg(),
            alt: "Upload " + mainType + " reverse",
            role: "button",
            tabIndex: 0,
            dataset: { action: "view-img", type: mainType, side: "rev" },
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

// Track slot counts in memory only (not localStorage) to avoid stale state
const _slotCounts = new Map();

function getSlotCount(coinId) {
    if (_slotCounts.has(coinId)) {
        return Math.min(_slotCounts.get(coinId), getInventoryTotalQty(coinId) || 0);
    }
    var qty = getInventoryTotalQty(coinId) || 0;
    if (qty === 0) return 0;
    var entries = getInventoryEntries(coinId) || [];
    return Math.max(1, Math.min(entries.length, qty));
}
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
 * Each count entry gets its own card with multi-photo strip, compact field grid, and notes.
 * Cards are hidden/shown via tab switching — only one instance visible at a time.
 */
function buildCoinSlots(coinId, activeIdx = 0) {
    var qty = getInventoryTotalQty(coinId) || 0;
    if (qty === 0) return "";
    var slotCount = getSlotCount(coinId);

    // Clamp activeIdx to slotCount range
    if (activeIdx >= slotCount) {
        activeIdx = Math.max(0, slotCount - 1);
    }

    var entries = getInventoryEntries(coinId) || [];
    var html = '<div class="coin-entries">';

    // Instance tab row
    if (qty > 0) {
        html += '<div class="coin-instance-tabs" role="tablist">';
        html += '<span class="coin-instance-tabs-label">Data Entries:</span>';
        for (var t = 0; t < slotCount; t++) {
            var isActive = t === activeIdx ? ' active' : '';
            html += '<button class="coin-instance-tab' + isActive + '" role="tab" data-action="switch-instance" data-instance-idx="' + t + '" aria-selected="' + (t === activeIdx ? 'true' : 'false') + '">Entry ' + (t + 1) + '</button>';
        }
        if (slotCount < qty) {
            html += '<button class="coin-instance-tab add-tab" role="tab" data-action="add-instance" data-coin-id="' + coinId + '" title="Add details for another coin">+</button>';
        }
        html += '</div>';
    }

    for (var i = 0; i < slotCount; i++) {
        var entry = entries[i] || {};
        var isVisible = i === activeIdx ? '' : ' style="display:none;"';
        html += '<div class="coin-entry-card' + (i === activeIdx ? ' is-active' : '') + '" data-instance-idx="' + i + '"' + isVisible + '>';
        // Header removed (tabs replace it above)
        if (slotCount > 1) {
            html += '<button class="coin-entry-remove" data-action="remove-slot" data-slot-idx="' + i + '">Remove</button>';
        }

        // Body: photo strip + fields side by side
        html += '<div class="coin-entry-body">';

        // Dynamic photo strip
        html += '<div class="coin-entry-photo-strip">';
        
        // Parse existing photos
        var photos = [];
        var personalPhotoStr = entry.personal_photo || '';
        if (personalPhotoStr) {
            photos = personalPhotoStr.split(';').filter(Boolean);
        } else {
            // Legacy fallback
            ['obv', 'rev', 'err'].forEach(function(k) {
                if (entry['photo_' + k + '_b64']) {
                    photos.push(entry['photo_' + k + '_b64']);
                }
            });
        }
        
        // Render existing photos
        for (var p = 0; p < photos.length; p++) {
            var existingPhoto = photos[p];
            if (existingPhoto && !existingPhoto.startsWith('data:') && !existingPhoto.startsWith('/')) {
                if (existingPhoto.startsWith('inv_')) {
                    existingPhoto = '/data/images/personal/' + existingPhoto;
                } else {
                    existingPhoto = '/data/images/types/' + existingPhoto;
                }
            }
            html += '<div class="coin-entry-photo-slot" data-photo-idx="' + p + '" data-slot-idx="' + i + '" style="position:relative;">';
            html += '<div class="coin-entry-photo-circle has-photo" style="cursor:pointer;">';
            html += '<img src="' + existingPhoto + '" alt="Photo" class="slot-photo-preview" data-action="slot-photo-preview" data-slot-idx="' + i + '" data-photo-idx="' + p + '">';
            html += '</div>';
            // Hidden change button to keep existing logic
            html += '<button style="display:none;" class="coin-entry-photo-btn" data-action="slot-photo" data-slot-idx="' + i + '" data-photo-idx="' + p + '">Change</button>';
            // Add a small X button in the top right corner of the slot
            html += '<button type="button" class="coin-entry-photo-remove-corner" data-action="slot-photo-remove" data-slot-idx="' + i + '" data-photo-idx="' + p + '" style="position:absolute; top:0; right:0; background:var(--color-danger); color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:10px; line-height:16px; text-align:center; padding:0; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.5); z-index:11;">✕</button>';
            html += '<span style="display:none;" class="slot-photo-name" data-slot-idx="' + i + '" data-photo-idx="' + p + '" data-photo-b64="' + photos[p] + '">✓</span>';
            html += '</div>';
        }
        
        // Render one empty photo spot at the end if we have less than 5 photos
        if (photos.length < 5) {
            html += '<div class="coin-entry-photo-slot" data-photo-idx="' + photos.length + '" data-slot-idx="' + i + '">';
            html += '<div class="coin-entry-photo-circle empty add-photo" data-action="slot-photo-empty" data-slot-idx="' + i + '" data-photo-idx="' + photos.length + '" style="cursor:pointer;">';
            html += '<span class="coin-placeholder-icon" style="font-size:24px;font-weight:700;color:var(--color-accent);">+</span>';
            html += '</div>';
            // Hidden add button to keep existing logic
            html += '<button style="display:none;" class="coin-entry-photo-btn" data-action="slot-photo" data-slot-idx="' + i + '" data-photo-idx="' + photos.length + '">Add</button>';
            html += '<span style="display:none;" class="slot-photo-name" data-slot-idx="' + i + '" data-photo-idx="' + photos.length + '"></span>';
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
    html += '</div>';
    return html;
}
function saveCoinSlots(coinId, panelEl, isAutosave = false) {
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
            coin_ref_id: coinId, quantity: entry.quantity || 1,
            grade: grade, purchase_price: price, current_value: value,
            date_acquired: date, notes: notes
        };
        if (entry.id) payload.id = entry.id;
        // Collect all dynamic photos
        var photos = [];
        var nameEls = card.querySelectorAll('.slot-photo-name');
        nameEls.forEach(function(el) {
            if (el.dataset.photoB64) {
                photos.push(el.dataset.photoB64);
            }
        });
        payload.personal_photos = photos;
        promises.push(updateInventory(coinId, payload));
    }
    return Promise.all(promises).then(function() {
        return fetchInventory();
    }).then(function(newInv) {
        return import('./state.js?v=4').then(function(m) {
            m.setInventory(newInv);
            window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId: coinId, reason: isAutosave } }));
            if (panelEl && panelEl.rebuildSlots && isAutosave === 'photo-update') {
                panelEl.rebuildSlots();
            }
        });
    });
}

// ============================================================
// Personal Slot Photo Helpers
// ============================================================

/**
 * Show a floating choice popover when clicking an empty personal photo slot.
 * Offers "Upload from Device" and "From Coin Bank".
 */
function showPhotoSlotChoice(btnEl, coinId, dp) {
    // Remove any existing popover
    var existing = document.querySelector('.photo-slot-choice');
    if (existing) existing.remove();

    var popover = document.createElement('div');
    popover.className = 'photo-slot-choice';
    var rect = btnEl.getBoundingClientRect();
    popover.style.cssText = 'position:fixed; z-index:11000; background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:4px; box-shadow:0 4px 16px rgba(0,0,0,0.5); display:flex; flex-direction:column; gap:2px;';
    popover.style.left = Math.min(rect.left, window.innerWidth - 210) + 'px';
    popover.style.top = (rect.bottom + 4) + 'px';

    var slotIdx = parseInt(btnEl.dataset.slotIdx, 10);
    var photoIdx = parseInt(btnEl.dataset.photoIdx, 10);

    var uploadBtn = document.createElement('button');
    uploadBtn.textContent = '\uD83D\uDCC1 Upload from Device';
    uploadBtn.style.cssText = 'padding:8px 16px; text-align:left; border:none; background:transparent; color:var(--color-text-main); border-radius:var(--radius-sm); cursor:pointer; font-size:14px; white-space:nowrap;';
    uploadBtn.onmouseenter = function() { uploadBtn.style.background = 'var(--color-accord-bg)'; };
    uploadBtn.onmouseleave = function() { uploadBtn.style.background = 'transparent'; };
    uploadBtn.onclick = function() {
        popover.remove();
        triggerSlotFileUpload(slotIdx, photoIdx, coinId, dp);
    };

    var bankBtn = document.createElement('button');
    bankBtn.textContent = '\uD83C\uDFE6 From Coin Bank';
    bankBtn.style.cssText = 'padding:8px 16px; text-align:left; border:none; background:transparent; color:var(--color-text-main); border-radius:var(--radius-sm); cursor:pointer; font-size:14px; white-space:nowrap;';
    bankBtn.onmouseenter = function() { bankBtn.style.background = 'var(--color-accord-bg)'; };
    bankBtn.onmouseleave = function() { bankBtn.style.background = 'transparent'; };
    bankBtn.onclick = function() {
        popover.remove();
        openSlotCoinBankPicker(slotIdx, photoIdx, coinId, dp);
    };

    popover.appendChild(uploadBtn);
    popover.appendChild(bankBtn);
    document.body.appendChild(popover);

    // Close on outside click
    setTimeout(function() {
        function closePopover(e) {
            if (popover && !popover.contains(e.target)) {
                popover.remove();
                document.removeEventListener('click', closePopover, true);
            }
        }
        document.addEventListener('click', closePopover, true);
    }, 0);
}

let _slotFileInput = null;
let _slotFileCtx = null;
function getSlotFileInput() {
    if (!_slotFileInput) {
        _slotFileInput = document.createElement('input');
        _slotFileInput.type = 'file';
        _slotFileInput.accept = 'image/*';
        _slotFileInput.style.display = 'none';
        document.body.appendChild(_slotFileInput);
        _slotFileInput.addEventListener('change', function(ev) {
            var file = ev.target.files[0];
            if (!file || !_slotFileCtx) return;
            ev.target.value = ''; // Reset for re-uploading same file
            var slotIdx = _slotFileCtx.slotIdx;
            var photoIdx = _slotFileCtx.photoIdx;
            var coinId = _slotFileCtx.coinId;
            var dp = _slotFileCtx.dp;
            
            var reader = new FileReader();
            reader.onload = function(re) {
                var img = new Image();
                img.onload = function() {
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
                    
                    var nameSel = '.slot-photo-name[data-slot-idx="' + slotIdx + '"][data-photo-idx="' + photoIdx + '"]';
                    var nameEl = dp.querySelector(nameSel);
                    if (nameEl) {
                        nameEl.textContent = '\u2713';
                        nameEl.dataset.photoB64 = b64;
                    }
                    
                    // Instantly update the UI so it doesn't show "?" while saving
                    var emptyCircle = dp.querySelector('.coin-entry-photo-circle[data-slot-idx="' + slotIdx + '"][data-photo-idx="' + photoIdx + '"]');
                    if (emptyCircle && emptyCircle.classList.contains('empty')) {
                        emptyCircle.removeAttribute('onclick');
                        emptyCircle.classList.remove('empty');
                        emptyCircle.classList.add('has-photo');
                        emptyCircle.innerHTML = '<img src="' + b64 + '" alt="Photo" class="slot-photo-preview" data-action="slot-photo-preview" data-slot-idx="' + slotIdx + '" data-photo-idx="' + photoIdx + '">';
                    } else {
                        var imgEl = emptyCircle ? emptyCircle.querySelector('img') : null;
                        if (imgEl) imgEl.src = b64;
                    }
                    
                    saveCoinSlots(coinId, dp, 'photo-update');
                };
                img.src = re.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    return _slotFileInput;
}

/**
 * Trigger the hidden file upload button for a personal photo slot.
 */
function triggerSlotFileUpload(slotIdx, photoIdx, coinId, dp) {
    _slotFileCtx = { slotIdx, photoIdx, coinId, dp };
    getSlotFileInput().click();
}

/**
 * Open a simple coin bank picker for personal slot photos.
 * Fetches bank images for the coin's type and lets the user pick one.
 */
function openSlotCoinBankPicker(slotIdx, photoIdx, coinId, dp) {
    import('./state.js?v=4').then(state => {
        let coin = null;
        for (const s of state.getSections()) {
            const coins = state.getCoinsForSection(s.section);
            if (coins) {
                coin = coins.find(c => c.id === coinId);
                if (coin) break;
            }
        }
        if (!coin) return;
        var coinType = coin.coin_type;
        if (!coinType) return;
        var mainType = getMainType(coinType);

    // Create picker modal overlay
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:12000; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:var(--space-4); max-width:500px; width:90%; max-height:80vh; overflow-y:auto; box-shadow:var(--shadow-xl);';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-3);';
    header.innerHTML = '<h3 style="margin:0;">Choose from Coin Bank</h3>';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.className = 'modal-close';
    closeBtn.style.cssText = 'background:none; border:none; color:var(--color-text-muted); font-size:1.2rem; cursor:pointer;';
    closeBtn.onclick = function() { overlay.remove(); };
    header.appendChild(closeBtn);
    box.appendChild(header);

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(100px,1fr)); gap:var(--space-2);';
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--color-text-muted);">Loading bank images...</div>';
    box.appendChild(grid);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function fetchBankImages(type) {
        return fetch('/api/coin_bank_images?coin_type=' + encodeURIComponent(type))
            .then(function(r) { return r.json(); });
    }
    fetchBankImages(coinType)
        .then(function(images) {
            if (!images || !images.length) {
                if (mainType !== coinType) {
                    return fetchBankImages(mainType);
                }
                return null;
            }
            return images;
        })
        .then(function(images) {
            if (!images || !images.length) {
                grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--color-text-muted);">No bank images found for this coin type.</div>';
                return;
            }

            grid.innerHTML = '';
            images.forEach(function(img) {
                var card = document.createElement('div');
                card.style.cssText = 'border:1px solid var(--color-border-light); border-radius:var(--radius-md); overflow:hidden; cursor:pointer; transition:transform 0.1s;';
                card.onmouseenter = function() { card.style.transform = 'scale(1.05)'; };
                card.onmouseleave = function() { card.style.transform = 'scale(1)'; };

                var imgEl = document.createElement('img');
                imgEl.src = img.filename;
                imgEl.style.cssText = 'width:100%; aspect-ratio:1; object-fit:cover; display:block;';
                card.appendChild(imgEl);

                var info = document.createElement('div');
                info.style.cssText = 'padding:4px; font-size:0.75rem; color:var(--color-text-muted); text-align:center;';
                info.textContent = (img.side || '') + ' - ' + (img.coin_type || '');
                card.appendChild(info);

                card.onclick = function() {
                    overlay.remove();
                    // Fetch the bank image as base64 and set as personal slot photo
                    fetch(img.filename)
                        .then(function(r) { return r.blob(); })
                        .then(function(blob) {
                            var reader = new FileReader();
                            reader.onload = function(e) {
                                var b64 = e.target.result;
                                // Set it on the slot
                                setSlotPhotoB64(slotIdx, photoIdx, coinId, dp, b64);
                            };
                            reader.readAsDataURL(blob);
                        })
                        .catch(function(err) {
                            console.warn('[catalog] Failed to fetch bank image:', err);
                            import('./notifications.js?v=4').then(function(m) { m.showToast('Failed to load bank image', 'error'); });
                        });
                };

                grid.appendChild(card);
            });
        })
        .catch(function(err) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--color-danger);">Error loading bank images.</div>';
            console.warn('[catalog] Coin bank fetch error:', err);
        });
    });
}

/**
 * Set a base64 image onto a personal photo slot and trigger save.
 */
export function setSlotPhotoB64(slotIdx, photoIdx, coinId, dp, b64) {
    var nameSel = '.slot-photo-name[data-slot-idx="' + slotIdx + '"][data-photo-idx="' + photoIdx + '"]';
    var nameEl = dp.querySelector(nameSel);
    if (nameEl) {
        nameEl.textContent = '\u2713';
        nameEl.dataset.photoB64 = b64;
    }

    // Update the UI: find the circle and set the image
    var slotDiv = dp.querySelector('.coin-entry-photo-slot[data-slot-idx="' + slotIdx + '"][data-photo-idx="' + photoIdx + '"]');
    if (slotDiv) {
        var circle = slotDiv.querySelector('.coin-entry-photo-circle');
        if (circle) {
            circle.classList.remove('empty');
            circle.classList.remove('add-photo');
            circle.classList.add('has-photo');
            circle.removeAttribute('data-action');
            circle.style.cursor = 'pointer';
            circle.innerHTML = '<img src="' + b64 + '" alt="Photo" class="slot-photo-preview" data-action="slot-photo-preview" data-slot-idx="' + slotIdx + '" data-photo-idx="' + photoIdx + '">';
        }
    }

    saveCoinSlots(coinId, dp, 'photo-update');
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
    var row = el("div", {className: "coin-row", dataset: {coinId: coin.id, coinType: coin.coin_type, section: coin.section}});
    row.appendChild(buildStepper(coin.id, totalQty));

    var thumbWrap = el("div", {className: "coin-row-thumb-wrap dual"});
    if (isSpecialReverse(coin.coin_type)) {
        thumbWrap.classList.add("show-rev");
    }
    
    var specificCfg = getTypeConfig(coin.coin_type);
    var mainCfg = getTypeConfig(getMainType(coin.coin_type));
    var obvSrc = coin.obv_image || (specificCfg && specificCfg.obv_image) || (mainCfg && mainCfg.obv_image) || null;
    var revSrc = coin.rev_image || (specificCfg && specificCfg.rev_image) || (mainCfg && mainCfg.rev_image) || null;
    if (obvSrc && !obvSrc.includes('?')) obvSrc += '?v=2';
    if (revSrc && !revSrc.includes('?')) revSrc += '?v=2';
    if (obvSrc) {
        var img = el("img", {className: "coin-row-thumb", src: obvSrc, alt: "", loading: "lazy", role: "button", tabIndex: 0, dataset: {action: "view-img", type: coin.coin_type, side: "obv", coinId: coin.id, year: coin.year || '', mintMark: coin.mint_mark || ''}});
        img.onerror = function() { img.src = placeholderCoinSvg(); img.classList.add("placeholder"); };
        thumbWrap.appendChild(img);
    } else {
        thumbWrap.appendChild(el("img", {className: "coin-row-thumb placeholder", src: placeholderCoinSvg(), alt: "", role: "button", tabIndex: 0, dataset: {action: "view-img", type: coin.coin_type, side: "obv"}}));
    }
    if (revSrc) {
        var img2 = el("img", {className: "coin-row-thumb", src: revSrc, alt: "", loading: "lazy", role: "button", tabIndex: 0, dataset: {action: "view-img", type: coin.coin_type, side: "rev", coinId: coin.id, year: coin.year || '', mintMark: coin.mint_mark || ''}});
        img2.onerror = function() { img2.src = placeholderCoinSvg(); img2.classList.add("placeholder"); };
        thumbWrap.appendChild(img2);
    } else {
        thumbWrap.appendChild(el("img", {className: "coin-row-thumb placeholder", src: placeholderCoinSvg(), alt: "", role: "button", tabIndex: 0, dataset: {action: "view-img", type: coin.coin_type, side: "rev"}}));
    }
    
    // Add mobile flip button if both obverse and reverse exist
    if (obvSrc && revSrc) {
        var flipBtn = el("button", {className: "mobile-flip-btn", title: "Show Reverse"}, "↺");
        flipBtn.onclick = function(e) {
            e.stopPropagation();
            thumbWrap.classList.toggle("show-rev");
        };
        thumbWrap.appendChild(flipBtn);
    }
    
    row.appendChild(thumbWrap);

    var info = el("div", {className: "coin-row-info"});
    var tl = el("span", {className: "coin-row-title"});
    var yr = coin.year === 1776 ? "1776-1976" : (coin.year || "\u2014");
    var fm = formatMintMark(coin);
    var mt = fm ? "-" + fm : "";
    var isPenny = coin.denomination === '1 Cent' || (coin.coin_type || '').toLowerCase().includes('cent');
    var labelParts = [];
    if (isPenny && coin.year === 1982) {
        var compositionSub = getSubType(coin.coin_type);
        if (compositionSub === 'Copper' || compositionSub === 'Zinc') {
            labelParts.push(compositionSub);
        }
    }
    var subType = getSubType(coin.coin_type);
    if (subType && !isCompositionSub(subType)) {
        var match = subType.match(/\(([^)]+)\)/);
        var designName = match ? match[1] : subType;
        if (designName.includes(' - ')) {
            var parts = designName.split(' - ');
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
    var dateVar = getDateVariety(coin.ref_notes);
    if (dateVar) {
        labelParts.push(dateVar);
    }
    var dateStr = labelParts.length > 0 ? ` (${labelParts.join(', ')})` : "";
    tl.appendChild(document.createTextNode(yr + mt + dateStr));
    if (coin.is_key_date) tl.append(" ", el("span", {className: "badge badge-key"}, "\u2b50 Key"));
    if (coin.is_proof) {
        tl.append(" ", el("span", {className: "badge badge-proof"}, "\uD83D\uDC8E Proof"));
        var isSilver = coin.metal && coin.metal.toLowerCase().includes('silver');
        if (isSilver) {
            tl.append(" ", el("span", {
                className: "badge badge-silver",
                style: "background: #e2e8f0; color: #1e293b; font-weight: 700;"
            }, "Silver"));
        }
    }
    if (coin.is_error || isErrorVariety(coin.coin_type, coin.ref_notes)) tl.append(" ", el("span", {className: "badge badge-error"}, "⚠ Error"));
    if (hasRefNotes) tl.append(" ", el("span", {className: "badge badge-historical"}, " Historical Note"));
    info.appendChild(tl);
    var sub = [];
    if (entries.length > 0) { var gr = entries.filter(function(e){return e.grade;}).map(function(e){return e.grade;}); if (gr.length > 0) sub.push(gr.join(", ")); }
    if (coin.mintage) sub.push("Mintage: " + coin.mintage.toLocaleString());
    if (sub.length) info.appendChild(el("span", {className: "coin-row-sub"}, sub.join(" · ")));
    row.appendChild(info);

    // Detail toggle button
    var detailBtn = el("span", {className: "coin-row-detail-toggle", role: "button", tabIndex: 0, dataset: {action: "toggle-detail"}}, "▼ Details");
    if (totalQty === 0) {
        detailBtn.style.display = "none";
    }
    row.appendChild(detailBtn);

    // Wishlist Heart Icon
    var wlItem = (getWishlist() || []).find(function(w){return w.coin_id===coin.id;});
    var wl = el("button", {
        className: "btn-wishlist-icon" + (wlItem ? " is-wishlist" : ""),
        title: (wlItem ? "Remove from" : "Add to") + " wishlist",
        dataset: { action: "add-wishlist", coinId: coin.id },
        style: "background:transparent; border:none; font-size:1.2rem; cursor:pointer; color:" + (wlItem ? "var(--color-danger)" : "var(--color-text-muted)") + "; transition:color 0.2s, transform 0.1s;"
    }, wlItem ? "♥" : "♡");
    
    // Hover effects for the heart
    wl.onmouseenter = function() {
        if (!this.classList.contains('is-wishlist')) this.style.color = "var(--color-text-main)";
        this.style.transform = "scale(1.1)";
    };
    wl.onmouseleave = function() {
        if (!this.classList.contains('is-wishlist')) this.style.color = "var(--color-text-muted)";
        this.style.transform = "scale(1)";
    };
    row.appendChild(wl);

    wrapper.appendChild(row);

    // Expandable detail panel — compact layout with inventory gate
    var dp = el("div", {className: "coin-detail-panel", dataset: {coinId: coin.id}});

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
        var activeTab = slotsDiv.querySelector('.coin-instance-tab.active');
        var activeIdx = activeTab ? parseInt(activeTab.dataset.instanceIdx, 10) : 0;
        slotsDiv.innerHTML = "";
        if (qty > 0) {
            slotsDiv.innerHTML = buildCoinSlots(coin.id, activeIdx);
        }
    }

    // Initial build
    rebuildSlots();
    dp.rebuildSlots = rebuildSlots;

    // Autosave on any input/change within the detail panel
    dp.addEventListener('change', function(e) {
        if (e.target.closest('.coin-entry-card') || e.target.closest('.coin-entries-wrap') || e.target.closest('.coin-entries')) {
            saveCoinSlots(coin.id, dp, true);
        }
    });
    dp.addEventListener('input', function(e) {
        if (e.target.closest('.slot-notes')) {
            // Debounce notes autosave
            clearTimeout(dp._notesTimeout);
            dp._notesTimeout = setTimeout(function() {
                saveCoinSlots(coin.id, dp, true);
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
            // Only rebuild slots (with photos) when inventory >= 1
            if (qty >= 1) {
                rebuildSlots();
            }
            // If qty is 0 and there's a historical note, auto-open it
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
                _slotCounts.set(coin.id, currentCount + 1);
                rebuildSlots();
            }
            return;
        }

        // Remove slot button — removes one slot's details
        var rmSlotBtn = e.target.closest('[data-action="remove-slot"]');
        if (rmSlotBtn) {
            e.stopPropagation();
            var rmIdx = parseInt(rmSlotBtn.dataset.slotIdx, 10);
            var rmEntries = getInventoryEntries(coin.id) || [];
            var deletedEntry = rmEntries[rmIdx];
            if (!deletedEntry) return;

            var currentSlots = getSlotCount(coin.id);
            var newCount = Math.max(0, currentSlots - 1);
            _slotCounts.set(coin.id, newCount);

            var promise = Promise.resolve();

            promise
                .then(function() {
                    if (deletedEntry.id) {
                        return fetch('/api/inventory/' + deletedEntry.id, { method: 'DELETE' });
                    }
                })
                .then(function() { return fetchInventory(); })
                .then(function(newInv) {
                    return import('./state.js?v=4').then(function(m) {
                        m.setInventory(newInv);
                        window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId: coin.id } }));
                        rebuildSlots();
                    });
                })
                .catch(function(err) {
                    console.error("Failed to remove slot details:", err);
                });
            return;
        }
        
        // Add new instance tab
        var addTabBtn = e.target.closest('[data-action="add-instance"]');
        if (addTabBtn) {
            e.stopPropagation();
            var cId = parseInt(addTabBtn.dataset.coinId, 10);
            var currentCount = getSlotCount(cId);
            var qty = getInventoryTotalQty(cId) || 0;
            if (currentCount < qty) {
                _slotCounts.set(cId, currentCount + 1);
                var entries = getInventoryEntries(cId) || [];
                
                // Decrement the quantity of an existing entry that has quantity > 1
                var sourceEntry = entries.find(e => (e.quantity || 1) > 1);
                if (sourceEntry) {
                    sourceEntry.quantity -= 1;
                } else if (entries[0]) {
                    entries[0].quantity = Math.max(1, (entries[0].quantity || 1) - 1);
                }
                
                // Ensure we have an in-memory entry for it
                if (entries.length < currentCount + 1) {
                    entries.push({ coin_ref_id: cId, quantity: 1 });
                }
                
                import('./state.js?v=4').then(m => {
                    m.setInventory(m.getInventory());
                    rebuildSlots();
                    
                    // Switch to the newly created tab automatically
                    setTimeout(() => {
                        var newTab = dp.querySelector('[data-action="switch-instance"][data-instance-idx="' + currentCount + '"]');
                        if (newTab) {
                            newTab.click();
                            // Save immediately to persist quantities and get a database ID for the new slot
                            saveCoinSlots(cId, dp, true);
                        }
                    }, 50);
                });
            }
            return;
        }

        // Switch instance tab
        var tabBtn = e.target.closest('[data-action="switch-instance"]');
        if (tabBtn) {
            e.stopPropagation();
            var tIdx = parseInt(tabBtn.dataset.instanceIdx, 10);
            // Update tab active states
            dp.querySelectorAll('.coin-instance-tab').forEach(function(t, ti) {
                t.classList.toggle('active', ti === tIdx);
                t.setAttribute('aria-selected', ti === tIdx ? 'true' : 'false');
            });
            // Show the selected card, hide others
            dp.querySelectorAll('.coin-entry-card').forEach(function(card) {
                var cardIdx = parseInt(card.dataset.instanceIdx, 10);
                card.style.display = cardIdx === tIdx ? '' : 'none';
                card.classList.toggle('is-active', cardIdx === tIdx);
            });
            return;
        }

        // Empty photo slot click — show choice popover (Upload or Coin Bank)
        var emptySlot = e.target.closest('[data-action="slot-photo-empty"]');
        if (emptySlot) {
            e.stopPropagation();
            showPhotoSlotChoice(emptySlot, coin.id, dp);
            return;
        }

        // Photo upload button
        var photoBtn = e.target.closest('[data-action="slot-photo"]');
        if (photoBtn) {
            e.stopPropagation();
            var pIdx = parseInt(photoBtn.dataset.slotIdx, 10);
            var photoIdx = parseInt(photoBtn.dataset.photoIdx, 10);
            triggerSlotFileUpload(pIdx, photoIdx, coin.id, dp);
            return;
        }

        // Photo preview click — openImageInteractionModal
        var photoCircle = e.target.closest('.coin-entry-photo-circle.has-photo');
        if (photoCircle) {
            e.stopPropagation();
            var imgEl = photoCircle.querySelector('img');
            var instanceCard = photoCircle.closest('.coin-entry-card');
            var instanceIdx = instanceCard ? parseInt(instanceCard.dataset.instanceIdx, 10) : 0;
            var panel = photoCircle.closest('.coin-detail-panel');
            var coinId = panel ? parseInt(panel.dataset.coinId, 10) : 0;
            var entries = getInventoryEntries(coinId) || [];
            var entry = entries[instanceIdx] || {};

            import('./state.js?v=4').then(state => {
                let coin = null;
                for (const s of state.getSections()) {
                    const coins = state.getCoinsForSection(s.section);
                    if (coins) {
                        coin = coins.find(c => c.id === coinId);
                        if (coin) break;
                    }
                }
                var coinType = coin ? coin.coin_type : '';
                import('./images.js?v=4').then(function(m) {
                    m.openImageInteractionModal(imgEl, coinType, 'personal', true, entry.id, coinId);
                });
            });
            return;
        }

        // Photo remove button
        var photoRmBtn = e.target.closest('[data-action="slot-photo-remove"]');
        if (photoRmBtn) {
            e.stopPropagation();
            var prIdx = parseInt(photoRmBtn.dataset.slotIdx, 10);
            var photoIdxRm = parseInt(photoRmBtn.dataset.photoIdx, 10);
            
            var nameEl2 = dp.querySelector('.slot-photo-name[data-slot-idx="' + prIdx + '"][data-photo-idx="' + photoIdxRm + '"]');
            if (nameEl2) {
                nameEl2.textContent = '';
                delete nameEl2.dataset.photoB64;
                // Delete from DOM entirely so saveCoinSlots won't see it
                nameEl2.remove();
            }
            saveCoinSlots(coin.id, dp, 'photo-update');
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
    root.style.setProperty("--header-height", "0px");

    // Measure and set country header heights on each country group
    document.querySelectorAll('.country-group').forEach(group => {
        const header = group.querySelector('.country-group-header');
        if (header) {
            group.style.setProperty('--my-country-header-height', header.offsetHeight + 'px');
        }
    });

    // Measure and set section header heights on each section card
    document.querySelectorAll('.section-card').forEach(card => {
        const header = card.querySelector('.section-header');
        if (header) {
            card.style.setProperty('--my-section-header-height', header.offsetHeight + 'px');
        }
    });
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
    switch (level) {
        case 'country': return 0;
        case 'section': {
            // Read from the first country-group's measured height
            const cg = document.querySelector('.country-group');
            if (cg) {
                const val = getComputedStyle(cg).getPropertyValue('--my-country-header-height');
                if (val) return parseInt(val) || 56;
            }
            return 56;
        }
        case 'type': {
            const cg = document.querySelector('.country-group');
            const sc = document.querySelector('.section-card');
            let countryH = 56, sectionH = 40;
            if (cg) {
                const v = getComputedStyle(cg).getPropertyValue('--my-country-header-height');
                if (v) countryH = parseInt(v) || 56;
            }
            if (sc) {
                const v = getComputedStyle(sc).getPropertyValue('--my-section-header-height');
                if (v) sectionH = parseInt(v) || 40;
            }
            return countryH + sectionH;
        }
    }
    return 0;
}

function initStickyHeaders() {
    if (_stickyRAF) { cancelAnimationFrame(_stickyRAF); _stickyRAF = null; }
    _stickyItems = [];

    // Use rAF to ensure browser has painted before measuring heights
    requestAnimationFrame(() => updateStickyOffsets());

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
            el.classList.add('is-stuck');
        } else {
            // Not stuck — use natural z-index
            el.style.zIndex = '';
            el.classList.remove('is-stuck');
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
        import('./images.js?v=4').then(m => {
            // Set coin metadata on the images module
            if (m.setCoinMeta) m.setCoinMeta(year ? parseInt(year) : null, mintMark || null);
            m.openImageInteractionModal(imgBtn, type, side, false, null, coinId);
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
        await toggleWishlist(parseInt(wlBtn.dataset.coinId, 10));
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
let _pendingStepperCoins = new Set();

async function handleStepperChange(coinId, delta) {
    if (_pendingStepperCoins.has(coinId)) return;
    _pendingStepperCoins.add(coinId);
    
    try {
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
        if (result && result.entry && result.entry.id) {
            targetEntry.id = result.entry.id;
        }
        
        window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId } }));
    } catch (err) {
        showToast(`Failed to save — ${err.message}`, 'error');
        // Rollback: restore the previous quantity display
        const totalQty = getInventoryTotalQty(coinId);
        updateStepperDisplay(coinId, totalQty);
    } finally {
        _pendingStepperCoins.delete(coinId);
    }
}
/**
 * Toggle wishlist status for a coin.
 * Checks current state from wishlist data, adds or removes accordingly.
 *
 * @param {number} coinId - The coin reference ID.
 */
async function toggleWishlist(coinId) {
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
            const isNowWishlist = !item;
            btn.classList.toggle("is-wishlist", isNowWishlist);
            btn.title = isNowWishlist ? "Remove from wishlist" : "Add to wishlist";
            if (btn.classList.contains('btn-wishlist-icon')) {
                btn.textContent = isNowWishlist ? "♥" : "♡";
                btn.style.color = isNowWishlist ? "var(--color-danger)" : "var(--color-text-muted)";
            } else {
                btn.classList.toggle("active", isNowWishlist);
            }
        });
    } catch (err) {
        showToast("Wishlist error: " + err.message, "error");
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
    // If reason is already provided, assume state was updated before dispatching.
    const stateMod = await import('./state.js?v=4');
    if (!e.detail || !e.detail.reason) {
        const newInv = await fetchInventory();
        stateMod.setInventory(newInv);
    }
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
        const detailBtn = row.querySelector('.coin-row-detail-toggle');
        if (detailBtn) {
            detailBtn.style.display = newQty > 0 ? '' : 'none';
            // Auto-close details panel if quantity drops to 0
            if (newQty === 0) {
                const wrapper = row.closest('.coin-row-wrapper');
                if (wrapper) {
                    const dp = wrapper.querySelector('.coin-detail-panel');
                    if (dp && dp.classList.contains('open')) {
                        dp.classList.remove('open');
                        detailBtn.textContent = "▼ Details";
                    }
                }
            }
        }
    });

    // Only rebuild slots if the affected coin's detail panel is open AND
    // the quantity actually changed (not on every autosave). This prevents
    // the textarea focus-steal bug where typing notes triggers a rebuild.
    if (affectedCoinId) {
        const newQty = stateMod.getInventoryTotalQty(affectedCoinId);
        updateStepperDisplay(affectedCoinId, newQty);

        document.querySelectorAll('.coin-row').forEach(row => {
            const cid = parseInt(row.dataset.coinId, 10);
            if (cid !== affectedCoinId) return;
            const wrapper = row.closest('.coin-row-wrapper');
            if (!wrapper) return;
            const dp = wrapper.querySelector('.coin-detail-panel');
            if (!dp) return;
            const isOpen = dp.classList.contains('open');
            if (!isOpen) return; // Don't touch closed panels

            const oldSlotCount = getSlotCount(cid);
            // Clamp slot count to new quantity
            if (oldSlotCount > newQty) {
                _slotCounts.set(cid, Math.max(0, newQty));
            }
            const newSlotCount = Math.min(oldSlotCount, newQty);

            // Only rebuild if slot count changed (not on photo updates — those preserve the slot DOM)
            const slotsDiv = wrapper.querySelector('.coin-slots-wrap');
            // Skip rebuild when reason is 'photo-update' (photo was already updated in DOM)
            if (slotsDiv && e.detail.reason !== 'photo-update') {
                var activeTab = slotsDiv.querySelector('.coin-instance-tab.active');
                var activeIdx = activeTab ? parseInt(activeTab.dataset.instanceIdx, 10) : 0;
                if (newQty > 0) {
                    slotsDiv.innerHTML = buildCoinSlots(cid, activeIdx);
                } else {
                    slotsDiv.innerHTML = '';
                }
            }
        });

        // Update details modal slots
        const modalEl = document.getElementById('modal-coin-detail-' + affectedCoinId);
        if (modalEl) {
            const slotsDiv = modalEl.querySelector('.coin-slots-wrap');
            if (slotsDiv) {
                const oldSlotCount = getSlotCount(affectedCoinId);
                if (oldSlotCount > newQty) {
                    _slotCounts.set(affectedCoinId, Math.max(0, newQty));
                }
                const newSlotCount = Math.min(oldSlotCount, newQty);

                // Skip rebuild when reason is 'photo-update' (photo DOM already updated)
                if (slotsDiv.innerHTML === '' || newQty > newSlotCount || e.detail.reason !== 'photo-update') {
                    if (newQty > 0) {
                        var activeTab = slotsDiv.querySelector('.coin-instance-tab.active');
                        var activeIdx = activeTab ? parseInt(activeTab.dataset.instanceIdx, 10) : 0;
                        slotsDiv.innerHTML = buildCoinSlots(affectedCoinId, activeIdx);
                    } else {
                        slotsDiv.innerHTML = '';
                    }
                }
            }
        }
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
    const stateMod2 = await import('./state.js?v=4');
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
    const containerEl = document.getElementById('catalog-container');
    if (!containerEl) return;
    if (mode === 'album' || mode === 'folder') {
            containerEl.classList.add('album-mode');
            clearAlbumCache();
        } else {
            containerEl.classList.remove('album-mode');
        }
        // Re-render sections — renderSections() already restores expanded sections
        // from _expandedSections set and re-renders type accordions.
        // After render, if in album mode, render album inline for expanded types.
        renderSections();
        // After DOM is rebuilt, render album inline for any expanded type sections
        if (mode === 'album' || mode === 'folder') {
            containerEl.querySelectorAll('.type-content.open').forEach(function(typeContent) {
            var typeWrapper = typeContent.closest('.type-wrapper');
            if (!typeWrapper) return;
            var sectionCard = typeWrapper.closest('.section-card');
            if (!sectionCard) return;
            var secName = sectionCard.dataset.section;
            var header = typeWrapper.querySelector('.type-header');
            var mainType = header ? (header.dataset.type || header.querySelector('.type-title')?.firstChild?.textContent?.trim() || '') : '';
            if (secName && mainType) {
                import('./album.js?v=4').then(m => {
                    if (m.renderAlbumType) m.renderAlbumType(secName, mainType, typeContent, header);
                });
            }
        });
    }
}

// ============================================================
// Drag-and-Drop Section Reordering
// ============================================================
function initSectionDragAndDrop() {
    const containerEl = document.getElementById('catalog-container');
    if (!containerEl) return;
    containerEl.addEventListener('dragstart', _dndOnDragStart);
    containerEl.addEventListener('dragover', _dndOnDragOver);
    containerEl.addEventListener('dragenter', e => e.preventDefault());
    containerEl.addEventListener('dragleave', _dndOnDragLeave);
    containerEl.addEventListener('drop', _dndOnDrop);
    containerEl.addEventListener('dragend', _dndOnDragEnd);
    document.querySelectorAll('.section-card').forEach(card => {
        const handle = card.querySelector('.drag-handle');
        if (handle) {
            handle.addEventListener('mouseenter', () => card.setAttribute('draggable', 'true'));
            handle.addEventListener('mouseleave', () => card.setAttribute('draggable', 'false'));
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

export function openCoinDetailModal(coinId) {
    import('./state.js?v=4').then(state => {
        let coin = null;
        for (const s of state.getSections()) {
            const coins = state.getCoinsForSection(s.section);
            if (coins) {
                coin = coins.find(c => c.id === coinId);
                if (coin) break;
            }
        }
        if (!coin) return;
        
        // build row to get dp
        const wrapper = buildCoinRow(coin);
        const dp = wrapper.querySelector('.coin-detail-panel');
        if (!dp) return;
        
        dp.style.display = 'block';
        dp.classList.add('open');
        // force rebuild slots so they show up
        if (dp.rebuildSlots) {
            dp.rebuildSlots();
        } else {
            const slotsDiv = dp.querySelector('.coin-slots-wrap');
            if (slotsDiv) {
                slotsDiv.innerHTML = buildCoinSlots(coinId);
            }
        }
        
        const modalWrap = el('div', { className: 'modal-coin-detail-wrap' });
        const totalQty = state.getInventoryTotalQty(coinId);

        const mainType = getMainType(coin.coin_type);
        const mainCfg = state.getTypeConfig(mainType) || {};
        const specificCfg = state.getTypeConfig(coin.coin_type) || {};
        
        let currentSide = localStorage.getItem(`cc-flipped-${coinId}`);
        if (!currentSide) {
            currentSide = isSpecialReverse(coin.coin_type) ? 'rev' : 'obv';
        }
        
        const getDisplayImgSrc = (side) => {
            const obv = specificCfg.obv_image || mainCfg.obv_image;
            const rev = specificCfg.rev_image || mainCfg.rev_image;
            let src = side === 'rev' ? (rev || obv) : (obv || rev);
            if (src && !src.includes('?')) src += '?v=2';
            return src;
        };
        
        const initialSrc = getDisplayImgSrc(currentSide);
        const imgContainer = el('div', {
            className: 'modal-detail-img-container',
            style: 'width: 48px; height: 48px; border-radius: 50%; overflow: hidden; border: 2px solid var(--color-border); background: var(--color-accord-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--shadow-sm); transition: border-color 0.15s ease;'
        });
        const imgEl = el('img', {
            src: initialSrc || placeholderCoinSvg(),
            style: 'width: 100%; height: 100%; object-fit: cover;'
        });
        imgEl.onerror = () => { imgEl.src = placeholderCoinSvg(); };
        imgContainer.appendChild(imgEl);
        
        imgContainer.onmouseenter = () => { imgContainer.style.borderColor = 'var(--color-accent)'; };
        imgContainer.onmouseleave = () => { imgContainer.style.borderColor = 'var(--color-border)'; };
        
        imgContainer.onclick = () => {
            let side = localStorage.getItem(`cc-flipped-${coinId}`);
            if (!side) side = isSpecialReverse(coin.coin_type) ? 'rev' : 'obv';
            import('./images.js?v=4').then(m => {
                m.openImageInteractionModal(imgEl, coin.coin_type, side, false, null, coinId);
            });
        };
        
        const flipBtn = el('button', {
            className: 'btn-secondary',
            style: 'padding: 4px 8px; font-size: 0.8rem; height: fit-content; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; border-radius: var(--radius-sm); margin-right: var(--space-2);'
        }, 'Flip ');
        flipBtn.onclick = () => {
            let oldSide = localStorage.getItem(`cc-flipped-${coinId}`);
            if (!oldSide) oldSide = isSpecialReverse(coin.coin_type) ? 'rev' : 'obv';
            const newSide = oldSide === 'rev' ? 'obv' : 'rev';
            localStorage.setItem(`cc-flipped-${coinId}`, newSide);
            imgEl.src = getDisplayImgSrc(newSide) || placeholderCoinSvg();
            showToast(`Flipped to ${newSide === 'obv' ? 'Obverse' : 'Reverse'}`, 'info');
            
            // Dispatch events to refresh the grid/album views
            window.dispatchEvent(new CustomEvent('cc-album-options-changed'));
            window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { reason: 'flip-image' } }));
        };
        
        const leftWrap = el('div', {
            style: 'display: flex; align-items: center; gap: var(--space-2);'
        },
            imgContainer,
            flipBtn,
            el('span', { style: 'font-weight: 600;' }, 'Total Owned Qty:')
        );
        
        const stepperContainer = el('div', {
            className: 'modal-stepper-container',
            style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:15px; padding:10px; background:var(--color-bg-body); border-radius:var(--radius-md); border:1px solid var(--color-border-light);'
        },
            leftWrap,
            buildStepper(coinId, totalQty)
        );
        
        modalWrap.appendChild(stepperContainer);
        modalWrap.appendChild(dp);
        
        // Attach click handler to modalWrap so modal buttons/steppers work
        modalWrap.addEventListener('click', handleCatalogClick);
        
        // Use standard modal wrapper
        import('./modals.js?v=4').then(modals => {
            modals.createModal('modal-coin-detail-' + coinId, 'Details: ' + (coin.year||'') + ' ' + coin.coin_type, modalWrap);
        });
    });
}
