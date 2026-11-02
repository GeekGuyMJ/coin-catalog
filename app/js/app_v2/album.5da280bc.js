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
    getMainType, getSubType, isCompositionSub, isErrorVariety,
    typeYearSpan, coinSortComparator, escHtml, placeholderCoinSvg, el,
} from './utils.js';

import {
    getSections, getCoinsForSection, setCoinsForSection,
    getTypeConfig, getInventoryTotalQty, getInventoryEntries, setInventory,
} from './state.js';

import { fetchCoinsForSection, updateInventory, fetchInventory } from './api.js';
import { showToast } from './notifications.js';
import { openImageInteractionModal } from './images.js';

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

export function renderAlbumType(sectionName, typeName, contentEl, headerEl) {
    // Get coins for this section (from cache or state)
    let coins = _albumLoaded[sectionName] || getCoinsForSection(sectionName);
    if (!coins) return;

    // Find the type wrapper or create inline album in the type content
    let typeWrapper = contentEl?.closest?.('.type-wrapper');
    const gridArea = document.getElementById('album-grid-area');

    // Filter coins for this type
    const typeCoins = coins.filter(c => getMainType(c.coin_type) === typeName);
    if (!typeCoins.length) return;

    // Sort by year
    typeCoins.sort(coinSortComparator);

    const cfg = getTypeConfig(typeName) || {};

    // Build the album grid for this type
    const holesGrid = el('div', { className: 'album-holes-grid' });
    for (const coin of typeCoins) {
        const hole = buildCoinHole(coin, cfg);
        holesGrid.appendChild(hole);
    }

    // If in standalone album mode (gridArea exists), replace the entire grid area
    if (gridArea && !typeWrapper) {
        // Build full grid with all types for this section
        renderAlbumGrid(document.getElementById('catalog-container'), sectionName, coins);
        return;
    }

    // Inline mode: replace content in the type-wrapper
    if (typeWrapper) {
        let albumContent = typeWrapper.querySelector('.album-inline-content');
        if (!albumContent) {
            albumContent = el('div', { className: 'album-inline-content' });
            typeWrapper.appendChild(albumContent);
        }
        albumContent.innerHTML = '';
        albumContent.appendChild(holesGrid);
    }
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
    const gridArea = el('div', { className: 'album-grid-area', id: 'album-grid-area' });
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

    // Group coins by main type
    const typeMap = new Map();
    for (const coin of coins) {
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
            thumbWrap.appendChild(el('div', { className: 'album-type-thumb-placeholder' }, '?'));
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

    // The circular slot
    const slot = el('div', { className: 'album-hole-slot' });

    if (isOwned && typeCfg?.obv_image) {
        const img = el('img', {
            className: 'album-hole-img',
            src: typeCfg.obv_image,
            alt: `${coin.year} ${coin.coin_type}`,
            loading: 'lazy',
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

    hole.appendChild(slot);

    // Label below the hole — strip redundant year-range/era/composition labels.
    const label = el('div', { className: 'album-hole-label' });
    const yearText = coin.year === 1776 ? '1776-1976' : _yearAbbr(coin.year);
    const mintText = coin.mint_mark ? coin.mint_mark : '';
    label.textContent = `${yearText}${mintText}`;
    hole.appendChild(label);

    // Badges
    if (coin.is_key_date) {
        hole.appendChild(el('span', { className: 'album-hole-badge key' }, '⭐'));
    }
    if (coin.is_proof) {
        hole.appendChild(el('span', { className: 'album-hole-badge proof' }, '💎'));
    }
    if (coin.is_error || isErrorVariety(coin.coin_type, coin.ref_notes)) {
        hole.appendChild(el('span', { className: 'album-hole-badge error' }, '⚠'));
    }

    // Quantity badge
    if (qty > 1) {
        hole.appendChild(el('span', { className: 'album-hole-qty' }, `×${qty}`));
    }

    return hole;
}

// ============================================================
// Event delegation
// ============================================================

async function handleAlbumClick(e) {
    const target = e.target;

    // Image click → lightbox
    const imgBtn = target.closest('[data-action="view-img"]');
    if (imgBtn) {
        e.stopPropagation();
        const { type, side } = imgBtn.dataset;
        openImageInteractionModal(imgBtn, type, side, false);
        return;
    }

    // Coin hole click → toggle owned/missing (fill with coin image)
    const hole = target.closest('.album-hole');
    if (hole) {
        e.stopPropagation();
        const coinId = hole.dataset.coinId;
        if (coinId) {
            await toggleHoleOwnership(parseInt(coinId, 10));
        }
        return;
    }
}

/**
 * Update a single coin hole in place without full grid re-render.
 * Works for both inline (inside .type-wrapper) and standalone (#album-grid-area) modes.
 * Locks scroll position during update to prevent viewport jumps.
 *
 * @param {number} coinId - The coin reference ID
 * @param {number} newQty - New quantity (0 or positive)
 */
export function _ccUpdateHoleInPlace(coinId, newQty) {
    // Lock scroll position
    const scrollY = window.scrollY;
    const catalogContainer = document.getElementById('catalog-container');
    const catalogTop = catalogContainer ? catalogContainer.getBoundingClientRect().top : 0;

    // Find the hole element (works in both inline and standalone modes)
    const hole = document.querySelector(`.album-hole[data-coin-id="${coinId}"]`);
    if (!hole) return;

    const isOwned = newQty > 0;
    const slot = hole.querySelector('.album-hole-slot');
    const qtyBadge = hole.querySelector('.album-hole-qty');

    // Update ownership class
    hole.classList.toggle('owned', isOwned);
    hole.classList.toggle('missing', !isOwned);

    // Update slot content
    if (slot) {
        slot.innerHTML = '';
        if (isOwned) {
            // Get the type config for the image
            const coinType = hole.dataset.coinType;
            const cfg = getTypeConfig(coinType);
            if (cfg?.obv_image) {
                const img = el('img', {
                    className: 'album-hole-img',
                    src: cfg.obv_image,
                    alt: `${hole.querySelector('.album-hole-label')?.textContent || ''}`,
                    loading: 'lazy',
                });
                img.onerror = () => { img.src = placeholderCoinSvg(); };
                slot.appendChild(img);
            } else {
                slot.appendChild(el('div', { className: 'album-hole-filled' }, '●'));
            }
        } else {
            slot.appendChild(el('div', { className: 'album-hole-empty' }));
        }
    }

    // Update quantity badge
    if (newQty > 1) {
        if (qtyBadge) {
            qtyBadge.textContent = `×${newQty}`;
        } else {
            const newBadge = el('span', { className: 'album-hole-qty' }, `×${newQty}`);
            hole.appendChild(newBadge);
        }
    } else if (qtyBadge) {
        qtyBadge.remove();
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
 * Toggle a coin's ownership status.
 * If missing → mark as owned (fill hole with coin image).
 * If owned → mark as missing (empty the hole).
 */
async function toggleHoleOwnership(coinId) {
    const qty = getInventoryTotalQty(coinId);
    const newQty = qty > 0 ? 0 : 1;

    try {
        const result = await updateInventory(coinId, { quantity: newQty });
        
        // Refresh local inventory state so getInventoryTotalQty returns correct values
        try {
            const fresh = await fetchInventory();
            setInventory(fresh);
        } catch { /* non-critical */ }
        
        // Update the hole in place (preserves scroll, no full re-render)
        _ccUpdateHoleInPlace(coinId, newQty);
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
    if (coin.is_proof) parts.push('💎 Proof');
    if (coin.is_error) parts.push('⚠ Error/Variety');
    return parts.join(' · ');
}
