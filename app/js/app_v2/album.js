/**
 * album.js — Coin Catalog v2 — Whitman Album Grid View
 *
 * Renders coins as a grid of "coin holes" — a visual representation of
 * physical album pages. Each cell shows:
 *   - A circular coin slot with the type image (if owned) or empty slot
 *   - Year + mint mark label
 *   - Subtle background tint for owned vs missing
 *
 * The album view is toggled via a button in the header and replaces the
 * standard list view inside #catalog-container.
 *
 * Layout:
 *   - Left sidebar: vertical accordion of sections grouped by country
 *   - Main area: coin grid with type headers (sticky)
 *   - Clicking a hole toggles owned/missing (fills with coin image)
 *
 * @module album
 */

import {
    getMainType, getSubType, isCompositionSub, isErrorVariety, getDateVariety,
    typeYearSpan, coinSortComparator, escHtml, placeholderCoinSvg, el, formatMintMark,
    formatMintage, isSpecialReverse
} from './utils.js?v=4';

import {
    getSections, getCoinsForSection, setCoinsForSection,
    getTypeConfig, getInventoryTotalQty, getInventoryEntries, setInventory,
    setTypeConfigs,
} from './state.js?v=4';

import { fetchCoinsForSection, updateInventory, fetchInventory, fetchTypeConfigs } from './api.js?v=4';
import { showToast } from './notifications.js?v=4';
import { openImageInteractionModal } from './images.js?v=4';

// --- View state ---
let _albumSections = new Set();       // sections expanded in album view
let _albumLoaded = {};                // section → coins cache (mirrors state)
let _activeSection = null;            // currently displayed section
let _expandedCountries = new Set();   // expanded country groups in sidebar

// ============================================================
// Public entry point
// ============================================================

/**
 * Render the album view for a given section.
 * Called when the user clicks a section header in album mode.
 *
 * @param {string} sectionName
 */
export function clearAlbumCache() {
    _albumLoaded = {};
}

function filterAlbumCoins(coins) {
    const includeProofs = localStorage.getItem('cc-album-include-proofs') !== 'false';
    const includeErrors = localStorage.getItem('cc-album-include-errors') !== 'false';
    const includeRare = localStorage.getItem('cc-album-include-rare') !== 'false';

    return coins.filter(coin => {
        if (coin.is_key_date) return true; // Key dates always bypass all exclusions!
        if (!includeProofs && coin.is_proof) return false;
        if (!includeErrors && (coin.is_error || isErrorVariety(coin.coin_type, coin.ref_notes))) return false;
        const isSuperRare = coin.mintage && coin.mintage > 0 && coin.mintage < 1000;
        if (!includeRare && isSuperRare) return false;
        return true;
    });
}

export async function renderAlbumType(sectionName, typeName, container, header) {
    // Clear cache for this type to force re-render
    if (_albumLoaded[sectionName]) {
        delete _albumLoaded[sectionName][typeName];
    }
    
    if (!container) return;
    container.innerHTML = '<div class="section-loading">Loading album...</div>';

    let coins = _albumLoaded[sectionName];
    if (!coins) {
        coins = await fetchCoinsForSection(sectionName);
        _albumLoaded[sectionName] = coins;
    }

    const filtered = filterAlbumCoins(coins);
    const typeCoins = filtered.filter(c => getMainType(c.coin_type) === typeName);
    const sorted = [...typeCoins].sort(coinSortComparator);

    container.classList.add('album-grid-container');
    container.classList.add('album-inline');
    
    // Set folder color dynamically
    const fc = localStorage.getItem('cc-folder-color') || 'green';
    const fcMap = {green:'#2d4a2d',blue:'#2d3a4a',red:'#4a2d2d',brown:'#4a3d2d',black:'#1a1a1a',purple:'#3d2d4a',gray:'#3a3a3a'};
    const ftMap = {green:'#c9a227',blue:'#7db3d8',red:'#e8a0a0',brown:'#d4a574',black:'#888888',purple:'#c9a0d4',gray:'#aaaaaa'};
    const fcVal = fcMap[fc] || fcMap.green;
    const ftVal = ftMap[fc] || ftMap.green;
    container.style.background = 'var(--folder-color)';
    document.documentElement.style.setProperty('--folder-color', fcVal);
    document.documentElement.style.setProperty('--folder-header-text', ftVal);
    document.documentElement.style.setProperty('--folder-label', ftVal);

    const grid = el('div', { className: 'album-holes-grid inline-album-grid' });
    const cfg = getTypeConfig(typeName) || {};

    // Obv Example
    const obvHole = el('div', { className: 'album-hole owned example-hole' });
    const obvSlot = el('div', { className: 'album-hole-slot' });
    if (cfg.obv_image) {
        obvSlot.appendChild(el('img', { className: 'album-hole-img', src: cfg.obv_image, dataset: { action: 'view-img', type: typeName, side: 'obv' } }));
    } else {
        obvSlot.appendChild(el('img', { className: 'album-hole-img', src: placeholderCoinSvg(), style: 'cursor:pointer; opacity: 0.5;', dataset: { action: 'view-img', type: typeName, side: 'obv' } }));
    }
    obvHole.appendChild(obvSlot);
    obvHole.appendChild(el('div', { className: 'album-hole-label', style: 'color: #fbbf24;' }, el('div', {}, 'OBV')));
    grid.appendChild(obvHole);

    // Rev Example
    const revHole = el('div', { className: 'album-hole owned example-hole' });
    const revSlot = el('div', { className: 'album-hole-slot' });
    if (cfg.rev_image) {
        revSlot.appendChild(el('img', { className: 'album-hole-img', src: cfg.rev_image, dataset: { action: 'view-img', type: typeName, side: 'rev' } }));
    } else {
        revSlot.appendChild(el('img', { className: 'album-hole-img', src: placeholderCoinSvg(), style: 'cursor:pointer; opacity: 0.5;', dataset: { action: 'view-img', type: typeName, side: 'rev' } }));
    }
    revHole.appendChild(revSlot);
    revHole.appendChild(el('div', { className: 'album-hole-label', style: 'color: #fbbf24;' }, el('div', {}, 'REV')));
    grid.appendChild(revHole);

    for (const coin of sorted) {
        const hole = buildCoinHole(coin, cfg);
        grid.appendChild(hole);
    }

    container.innerHTML = '';
    
    // Filter Bar
    const filterWrap = el('div', { style: 'padding: 10px 20px;' });
    const filterInput = el('input', { type: 'text', placeholder: 'Filter by year or mint...', style: 'width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 20px; color: white;' });
    filterInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        grid.querySelectorAll('.album-hole:not(.example-hole)').forEach(h => {
            const lbl = h.querySelector('.album-hole-label').textContent.toLowerCase();
            h.style.display = lbl.includes(term) ? '' : 'none';
        });
    });
    filterWrap.appendChild(filterInput);
    container.appendChild(filterWrap);
    
    // Type Title Bar
    const titleBar = el('div', { className: 'album-inline-title', style: 'padding: 10px 20px; font-weight: bold; color: #fbbf24; border-left: 3px solid #fbbf24; margin: 10px 20px; font-size: 1.1em;' }, typeName);
    container.appendChild(titleBar);
    container.appendChild(grid);
    
    grid.addEventListener('click', handleAlbumClick);
}

export async function renderAlbumView(sectionName) {
    const container = document.getElementById('catalog-container');
    if (!container) return;

    // If clicking the same section, toggle collapse
    if (_activeSection === sectionName && _albumSections.has(sectionName)) {
        _albumSections.delete(sectionName);
        _activeSection = null;
        renderAlbumLayout(container);
        return;
    }

    _activeSection = sectionName;
    _albumSections.add(sectionName);

    // Build the sidebar + grid area
    renderAlbumLayout(container);

    // Load coins if needed
    let coins = _albumLoaded[sectionName] || getCoinsForSection(sectionName);
    if (!coins) {
        try {
            const gridArea = container.querySelector('#album-grid-area');
            if (gridArea) gridArea.innerHTML = '<div class="section-loading">Loading coins…</div>';
            coins = await fetchCoinsForSection(sectionName);
            setCoinsForSection(sectionName, coins);
            _albumLoaded[sectionName] = coins;
        } catch (err) {
            const gridArea = container.querySelector('#album-grid-area');
            if (gridArea) gridArea.innerHTML = `<p class="text-muted" style="padding:1rem">
                Failed to load coins: ${escHtml(err.message)}
            </p>`;
            return;
        }
    }

    renderAlbumGrid(container, sectionName, coins);
}

/**
 * Render the album layout: sidebar with accordion sections + main grid area.
 */
function renderAlbumLayout(container) {
    const sections = getSections();
    if (!sections.length) {
        container.innerHTML = '<p class="text-muted text-center" style="padding:2rem">No coins found.</p>';
        return;
    }

    // Group by country
    const countryMap = new Map();
    sections.forEach(sec => {
        const country = _getCountry(sec.section);
        if (!countryMap.has(country)) countryMap.set(country, []);
        countryMap.get(country).push(sec);
    });

    const wrapper = el('div', { className: 'album-layout' });

    // --- Sidebar: vertical accordion ---
    const sidebar = el('div', { className: 'album-sidebar' });

    // --- Back to List View Button ---
    const listBtnWrapper = el('div', { style: 'padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);' });
    const listBtn = el('button', { className: 'btn-secondary', style: 'width: 100%;' }, ' Switch to List View');
    listBtn.onclick = () => {
        import('./catalog.js?v=4').then(m => m.setCatalogViewMode('list'));
    };
    listBtnWrapper.appendChild(listBtn);
    sidebar.appendChild(listBtnWrapper);

    for (const [country, countrySections] of countryMap) {
        const isExpanded = _expandedCountries.has(country);

        // Country header (sticky accordion toggle)
        const countryHeader = el('div', {
            className: 'album-country-header' + (isExpanded ? ' expanded' : ''),
            role: 'button',
            tabIndex: 0,
        });
        countryHeader.innerHTML = `<span class="album-country-name">${escHtml(country)}</span><span class="album-country-chevron">${isExpanded ? '▾' : '▸'}</span>`;
        countryHeader.onclick = () => {
            if (_expandedCountries.has(country)) {
                _expandedCountries.delete(country);
            } else {
                _expandedCountries.add(country);
            }
            renderAlbumLayout(container);
            // Re-render grid if active section is in this country
            if (_activeSection) {
                const activeCountry = _getCountry(_activeSection);
                if (activeCountry === country) {
                    const coins = _albumLoaded[_activeSection] || getCoinsForSection(_activeSection);
                    if (coins) renderAlbumGrid(container, _activeSection, coins);
                }
            }
        };
        sidebar.appendChild(countryHeader);

        // Section list (shown when country is expanded)
        if (isExpanded) {
            const sectionList = el('div', { className: 'album-section-list' });
            for (const sec of countrySections) {
                const isActive = _activeSection === sec.section;
                const item = el('div', {
                    className: 'album-section-item' + (isActive ? ' active' : ''),
                    dataset: { section: sec.section },
                    title: sec.section,
                }, sec.section.replace(/^(US |Canadian |UK )/, ''));
                item.onclick = () => renderAlbumView(sec.section);
                sectionList.appendChild(item);
            }
            sidebar.appendChild(sectionList);
        }
    }

    wrapper.appendChild(sidebar);

    // --- Main grid area ---
    const gridArea = el('div', { className: 'album-grid-area album-inline', id: 'album-grid-area' });
    
    // Set folder color dynamically
    const fc = localStorage.getItem('cc-folder-color') || 'green';
    const fcMap = {green:'#2d4a2d',blue:'#2d3a4a',red:'#4a2d2d',brown:'#4a3d2d',black:'#1a1a1a',purple:'#3d2d4a',gray:'#3a3a3a'};
    const ftMap = {green:'#c9a227',blue:'#7db3d8',red:'#e8a0a0',brown:'#d4a574',black:'#888888',purple:'#c9a0d4',gray:'#aaaaaa'};
    const fcVal = fcMap[fc] || fcMap.green;
    const ftVal = ftMap[fc] || ftMap.green;
    document.documentElement.style.setProperty('--folder-color', fcVal);
    document.documentElement.style.setProperty('--folder-header-text', ftVal);
    document.documentElement.style.setProperty('--folder-label', ftVal);
    gridArea.style.background = 'var(--folder-color)';
    
    wrapper.appendChild(gridArea);

    container.innerHTML = '';
    container.appendChild(wrapper);

    // If a section is active, render its grid
    if (_activeSection) {
        const coins = _albumLoaded[_activeSection] || getCoinsForSection(_activeSection);
        if (coins) {
            renderAlbumGrid(container, _activeSection, coins);
        }
    } else {
        gridArea.innerHTML = '<div class="album-placeholder">← Select a section to view the album</div>';
    }
}

/**
 * Render the coin grid for a section.
 */
function renderAlbumGrid(container, sectionName, coins) {
    const gridArea = container.querySelector('#album-grid-area');
    if (!gridArea) return;

    const filtered = filterAlbumCoins(coins);

    // Group coins by main type
    const typeMap = new Map();
    for (const coin of filtered) {
        const main = getMainType(coin.coin_type);
        if (!typeMap.has(main)) typeMap.set(main, []);
        typeMap.get(main).push(coin);
    }

    // Sort types by earliest year
    const sortedTypes = [...typeMap.entries()].sort((a, b) => {
        const minA = Math.min(...a[1].map(c => c.year === 1776 ? 1976 : c.year || 9999));
        const minB = Math.min(...b[1].map(c => c.year === 1776 ? 1976 : c.year || 9999));
        return minA - minB;
    });

    const grid = el('div', { className: 'album-grid' });

    for (const [mainType, typeCoins] of sortedTypes) {
        const cfg = getTypeConfig(mainType) || {};
        const sorted = [...typeCoins].sort(coinSortComparator);

        // Type header row (full width, sticky) — NO completion pill
        const typeHeader = el('div', { className: 'album-type-header' });

        // Type thumbnail
        const thumbWrap = el('div', { className: 'album-type-thumb' });
        if (cfg.obv_image) {
            const img = el('img', {
                src: cfg.obv_image,
                alt: mainType,
                loading: 'lazy',
                dataset: { action: 'view-img', type: mainType, side: 'obv' },
            });
            img.onerror = () => { img.src = placeholderCoinSvg(); };
            thumbWrap.appendChild(img);
        } else {
            thumbWrap.appendChild(el('img', { className: 'album-type-thumb-placeholder', src: placeholderCoinSvg(), alt: '?', style: 'cursor:pointer;', dataset: { action: 'view-img', type: mainType, side: 'obv' } }));
        }
        typeHeader.appendChild(thumbWrap);

        // Type title + year span
        const titleWrap = el('div', { className: 'album-type-title-wrap' });
        titleWrap.appendChild(el('span', { className: 'album-type-title' }, mainType));
        titleWrap.appendChild(el('span', { className: 'album-type-year' }, typeYearSpan(sorted)));
        typeHeader.appendChild(titleWrap);

        grid.appendChild(typeHeader);

        // Coin hole grid
        const holesGrid = el('div', { className: 'album-holes-grid' });

        for (const coin of sorted) {
            const hole = buildCoinHole(coin, cfg);
            holesGrid.appendChild(hole);
        }

        grid.appendChild(holesGrid);
    }

    gridArea.innerHTML = '';
    gridArea.appendChild(grid);

    // Single event delegation on the grid
    grid.addEventListener('click', handleAlbumClick);
}

/**
 * Build a single coin hole element.
 */
function buildCoinHole(coin, typeCfg) {
    const qty = getInventoryTotalQty(coin.id);
    const isOwned = qty > 0;

    const hole = el('div', {
        className: 'album-hole' + (isOwned ? ' owned' : ' missing'),
        dataset: { coinId: coin.id, coinType: coin.coin_type, section: coin.section },
        title: _coinTooltip(coin, qty),
    });

    // The slot wrapper to contain the slot circle and absolutely positioned badges
    const slotWrapper = el('div', { className: 'album-hole-slot-wrapper', style: 'position: relative; display: inline-flex; justify-content: center;' });

    // The circular slot
    const slot = el('div', { className: 'album-hole-slot' });

    const flipState = localStorage.getItem(`cc-flipped-${coin.id}`) || 'obv';
    const specificCfg = getTypeConfig(coin.coin_type);
    const mainCfg = typeCfg || getTypeConfig(getMainType(coin.coin_type)) || {};
    const isSpecial = isSpecialReverse(mainCfg?.coin_type || coin.coin_type);
    let displaySide = flipState === 'rev' ? 'rev' : 'obv';
    // If special reverse, the default view is the reverse. Flipping it would show the obverse.
    if (isSpecial) {
        displaySide = flipState === 'rev' ? 'obv' : 'rev';
    }
    
    const obvImg = (specificCfg && specificCfg.obv_image) || mainCfg.obv_image;
    const revImg = (specificCfg && specificCfg.rev_image) || mainCfg.rev_image;
    let displayImg = displaySide === 'rev' ? (revImg || obvImg) : (obvImg || revImg);
    if (displayImg && !displayImg.includes('?')) {
        displayImg += '?v=2';
    }

    if (isOwned && displayImg) {
        const img = el('img', {
            className: 'album-hole-img',
            src: displayImg,
            alt: `${coin.year} ${coin.coin_type}`,
            loading: 'lazy'
            // NOTE: no data-action="view-img" here — clicks on owned holes open detail modal, not image lightbox
        });
        img.onerror = () => { img.src = placeholderCoinSvg(); };
        slot.appendChild(img);
    } else if (isOwned) {
        // Owned but no image — show a filled circle
        slot.appendChild(el('div', { className: 'album-hole-filled' }, '●'));
    } else {
        // Missing — empty slot, NO year number
        slot.appendChild(el('div', { className: 'album-hole-empty' }));
    }

    slotWrapper.appendChild(slot);

    // Badges
    const showMultiplier = localStorage.getItem('cc-album-show-multiplier') !== 'false';
    const showKeyDates = true; // Key dates always show
    const showErrors = localStorage.getItem('cc-album-show-errors') !== 'false';
    const showProofs = localStorage.getItem('cc-album-show-proofs') !== 'false';
    const showRare = localStorage.getItem('cc-album-show-rare') !== 'false';

    if (showKeyDates && coin.is_key_date) {
        slotWrapper.appendChild(el('span', { className: 'album-hole-badge key', title: 'Key Date' }, '⭐'));
    }
    if (showProofs && coin.is_proof) {
        slotWrapper.appendChild(el('span', { className: 'album-hole-badge proof', title: 'Proof' }, ''));
    }
    if (showErrors && (coin.is_error || isErrorVariety(coin.coin_type, coin.ref_notes))) {
        slotWrapper.appendChild(el('span', { className: 'album-hole-badge error', title: 'Error/Variety' }, '⚠'));
    }
    const isSuperRare = coin.mintage && coin.mintage > 0 && coin.mintage < 1000;
    if (showRare && isSuperRare) {
        slotWrapper.appendChild(el('span', { className: 'album-hole-badge rare', title: `Super Rare (Mintage: ${coin.mintage})` }, ''));
    }

    // Quantity badge
    if (showMultiplier && qty > 1) {
        slotWrapper.appendChild(el('span', { className: 'album-hole-qty' }, `×${qty}`));
    }

    hole.appendChild(slotWrapper);

    // Label below the hole
    const label = el('div', { className: 'album-hole-label' });
    // Silver proof label badge — placed in label area so it doesn't overlap the coin
    const isSilverProof = showProofs && coin.is_proof && coin.metal && coin.metal.toLowerCase().includes('silver');
    const yearText = coin.year === 1776 ? '76-76' : _yearAbbr(coin.year);
    const mintText = formatMintMark(coin);
    const mintageText = coin.mintage ? ` (${formatMintage(coin.mintage)})` : '';
    label.textContent = `${yearText}${mintText}${mintageText}`;
    let subType = getSubType(coin.coin_type);
    const isPenny = coin.denomination === '1 Cent' || (coin.coin_type || '').toLowerCase().includes('cent');
    if (isPenny && coin.year !== 1982 && (subType === 'Copper' || subType === 'Zinc')) {
        subType = '';
    }
    const dateVar = getDateVariety(coin.ref_notes);
    if (dateVar) subType = subType ? `${subType}, ${dateVar}` : dateVar;
    if (subType) {
        label.appendChild(el('div', { style: 'font-size: 0.8em; font-style: italic; opacity: 0.9;' }, subType));
    }
    // Silver proof indicator below the label text — not overlapping the coin
    if (isSilverProof) {
        label.appendChild(el('span', {
            className: 'album-label-silver-badge',
            title: 'Silver Proof'
        }, 'Ag'));
    }
    hole.appendChild(label);

    // Dynamic tooltip — re-read qty at hover time so 'Owned/Not in collection' is always current
    hole.addEventListener('mouseenter', () => {
        const liveQty = getInventoryTotalQty(coin.id);
        hole.setAttribute('title', _coinTooltip(coin, liveQty));
    });

    return hole;
}

// ============================================================
// Event delegation
// ============================================================

async function handleAlbumClick(e) {
    const target = e.target;

    // Example-hole image click (OBV/REV headers) → lightbox
    const imgBtn = target.closest('[data-action="view-img"]');
    if (imgBtn) {
        // Only open lightbox for example holes (type header images), not coin holes
        const parentHole = imgBtn.closest('.album-hole');
        if (!parentHole || parentHole.classList.contains('example-hole')) {
            e.stopPropagation();
            const { type, side } = imgBtn.dataset;
            openImageInteractionModal(imgBtn, type, side, false);
            return;
        }
    }

    // Coin hole click → open details (if owned) or add to collection
    const hole = target.closest('.album-hole');
    if (hole && !hole.classList.contains('example-hole')) {
        e.stopPropagation();
        const coinId = hole.dataset.coinId;
        if (coinId) {
            await toggleHoleOwnership(parseInt(coinId, 10), hole);
        }
        return;
    }
}

/**
 * Toggle a coin's ownership status.
 */
async function toggleHoleOwnership(coinId, holeElement) {
    const qty = getInventoryTotalQty(coinId);
    
    // If ALREADY owned, open the details modal
    if (qty > 0) {
        if (window.openCoinDetailModal) {
            window.openCoinDetailModal(coinId);
        } else {
            import('./catalog.js?v=4').then(m => {
                if (m.openCoinDetailModal) m.openCoinDetailModal(coinId);
            });
        }
        return;
    }

    const newQty = 1;

    try {
        const result = await updateInventory(coinId, { quantity: newQty });
        
        // Refresh local inventory state
        try {
            const fresh = await fetchInventory();
            setInventory(fresh);
        } catch { /* non-critical */ }
        
        // Visually update just the specific hole
        const isOwned = newQty > 0;
        holeElement.className = 'album-hole' + (isOwned ? ' owned' : ' missing');
        
        // Update the slot internals
        const slot = holeElement.querySelector('.album-hole-slot');
        if (slot) {
            slot.innerHTML = '';
            // Try to get image from config
            const coinType = holeElement.dataset.coinType;
            const specificCfg = getTypeConfig(coinType);
            const mainCfg = getTypeConfig(getMainType(coinType)) || {};
            
            const flipState = localStorage.getItem(`cc-flipped-${coinId}`) || 'obv';
            const isSpecial = isSpecialReverse(mainCfg.coin_type || coinType);
            let displaySide = flipState === 'rev' ? 'rev' : 'obv';
            if (isSpecial) {
                displaySide = flipState === 'rev' ? 'obv' : 'rev';
            }
            
            const obvImg = (specificCfg && specificCfg.obv_image) || mainCfg.obv_image;
            const revImg = (specificCfg && specificCfg.rev_image) || mainCfg.rev_image;
            let displayImg = displaySide === 'rev' ? (revImg || obvImg) : (obvImg || revImg);
            if (displayImg && !displayImg.includes('?')) {
                displayImg += '?v=2';
            }

            if (isOwned && displayImg) {
                const img = el('img', { className: 'album-hole-img', src: displayImg });
                // NO data-action="view-img" — clicking an owned coin opens details modal, not image lightbox
                img.onerror = () => { img.src = placeholderCoinSvg(); };
                slot.appendChild(img);
            } else if (isOwned) {
                slot.appendChild(el('div', { className: 'album-hole-filled' }, '●'));
            } else {
                // Removed — show clean empty hole, not placeholder
                slot.innerHTML = '';
                slot.appendChild(el('div', { className: 'album-hole-empty' }));
            }
        }
    } catch (err) {
        showToast(`Failed to update: ${err.message}`, 'error');
    }
}

// ============================================================
// Helpers
// ============================================================

function _getCountry(sectionName) {
    if (sectionName.startsWith('US ')) return 'United States';
    if (sectionName.startsWith('Canadian ')) return 'Canada';
    if (sectionName.startsWith('UK ')) return 'United Kingdom';
    return 'Other';
}

function _yearAbbr(year) {
    if (!year) return '—';
    if (year === 1776) return '1776-1976';
    return String(year);
}

function _coinTooltip(coin, qty) {
    const parts = [`${coin.year || '—'} ${coin.coin_type || ''}`];
    if (coin.mint_mark) parts.push(`Mint: ${coin.mint_mark}`);
    if (coin.mintage) parts.push(`Mintage: ${coin.mintage.toLocaleString()}`);
    if (qty > 0) parts.push(`Owned: ${qty}`);
    else parts.push('Not in collection');
    if (coin.is_key_date) parts.push('⭐ Key Date');
    if (coin.is_proof) {
        const isSilverProof = coin.metal && coin.metal.toLowerCase().includes('silver');
        parts.push(' Proof' + (isSilverProof ? ' · Ag Silver' : ''));
    }
    if (coin.is_error) parts.push('⚠ Error/Variety');
    return parts.join(' · ');
}

// ============================================================
// Dynamic updates — keep album grid in sync with inventory/image changes
// ============================================================

window.addEventListener('cc-inventory-updated', async () => {
    // Preserve scroll position to prevent page jump
    const scrollY = window.scrollY;

    if (_activeContainer && _activeSection) {
        await renderAlbum(_activeSection);
    }

    // Refresh album grids that are currently visible (inline album mode)
    try {
        const fresh = await fetchInventory();
        setInventory(fresh);
    } catch { /* non-critical */ }

    // Re-render all currently open inline album grids
    const inlinePromises = Array.from(document.querySelectorAll('.type-content.open.album-inline')).map(async (container) => {
        const typeWrapper = container.closest('.type-wrapper');
        if (!typeWrapper) return;
        const sectionCard = typeWrapper.closest('.section-card');
        if (!sectionCard) return;
        const secName = sectionCard.dataset.section;
        const header = typeWrapper.querySelector('.type-header');
        const mainType = header ? (header.dataset.type || header.querySelector('.type-title')?.firstChild?.textContent?.trim() || '') : '';
        if (secName && mainType) {
            // Clear the cache so we get fresh data
            if (_albumLoaded[secName]) delete _albumLoaded[secName][mainType];
            await renderAlbumType(secName, mainType, container, header);
        }
    });
    
    await Promise.all(inlinePromises);

    // Also update the standalone album grid area if visible
    const gridArea = document.getElementById('album-grid-area');
    if (gridArea && _activeSection) {
        const coins = _albumLoaded[_activeSection] || getCoinsForSection(_activeSection);
        if (coins) {
            const container = gridArea.closest('.album-layout')?.parentElement;
            if (container) renderAlbumGrid(container, _activeSection, coins);
        }
    }
    
    window.scrollTo(0, scrollY);
});

window.addEventListener('cc-image-updated', async () => {
    // Refresh type configs so new images are picked up
    try {
        const updatedConfigs = await fetchTypeConfigs();
        setTypeConfigs(updatedConfigs);
    } catch { /* non-critical */ }

    // Re-render visible inline album grids
    document.querySelectorAll('.type-content.open.album-inline').forEach(async (container) => {
        const typeWrapper = container.closest('.type-wrapper');
        if (!typeWrapper) return;
        const sectionCard = typeWrapper.closest('.section-card');
        if (!sectionCard) return;
        const secName = sectionCard.dataset.section;
        const header = typeWrapper.querySelector('.type-header');
        const mainType = header ? (header.dataset.type || header.querySelector('.type-title')?.firstChild?.textContent?.trim() || '') : '';
        if (secName && mainType) {
            if (_albumLoaded[secName]) delete _albumLoaded[secName][mainType];
            await renderAlbumType(secName, mainType, container, header);
        }
    });

    // Standalone album grid
    const gridArea = document.getElementById('album-grid-area');
    if (gridArea && _activeSection) {
        // Clear cache to pick up new images
        delete _albumLoaded[_activeSection];
        try {
            const coins = await fetchCoinsForSection(_activeSection);
            _albumLoaded[_activeSection] = coins;
            const container = gridArea.closest('.album-layout')?.parentElement;
            if (container) renderAlbumGrid(container, _activeSection, coins);
        } catch { /* non-critical */ }
    }
});

window.addEventListener('cc-album-options-changed', () => {
    // Re-render standalone album grid if visible
    const gridArea = document.getElementById('album-grid-area');
    if (gridArea && _activeSection) {
        const coins = _albumLoaded[_activeSection] || getCoinsForSection(_activeSection);
        if (coins) {
            const container = gridArea.closest('.album-layout')?.parentElement;
            if (container) renderAlbumGrid(container, _activeSection, coins);
        }
    }
    // Also re-render inline album grids
    document.querySelectorAll('.type-content.open.album-inline').forEach(async (container) => {
        const typeWrapper = container.closest('.type-wrapper');
        if (!typeWrapper) return;
        const sectionCard = typeWrapper.closest('.section-card');
        if (!sectionCard) return;
        const secName = sectionCard.dataset.section;
        const header = typeWrapper.querySelector('.type-header');
        const mainType = header ? (header.dataset.type || header.querySelector('.type-title')?.firstChild?.textContent?.trim() || '') : '';
        if (secName && mainType) {
            if (_albumLoaded[secName]) delete _albumLoaded[secName][mainType];
            await renderAlbumType(secName, mainType, container, header);
        }
    });
});
