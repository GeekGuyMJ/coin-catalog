/**
 * modals.js — Coin Catalog v2 — Settings, Info, and Visibility Modals
 *
 * Replaces the stub toasts in main.js with fully functional modals:
 * - Settings: theme, folder color, card visibility, filters, sort, data management
 * - Info: app version, stats, keyboard shortcuts, about
 * - Visibility: toggle dashboard cards on/off
 *
 * @module modals
 */

import { el, escHtml } from './utils.js';
import { showToast } from './notifications.js';
import { getSections, getInventory, getSpotPrices } from './state.js';
import { saveCustomTheme } from './themes.js';

// ============================================================
// Shared modal helpers
// ============================================================

export function createModal(id, title, bodyContent, extra) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const overlay = el('div', {
        id,
        className: 'modal-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title,
    });

    const modalClass = (typeof extra === 'string' && !extra.includes('<') && !extra.appendChild)
            ? 'modal-box ' + extra.replace(/<[^>]*>/g, '')
            : 'modal-box';
        const box = el('div', { className: modalClass });

    const header = el('div', { className: 'modal-header' });
    header.appendChild(el('h2', { className: 'modal-title' }, title));
    header.appendChild(el('button', {
        className: 'modal-close',
        dataset: { action: 'close-modal' },
        'aria-label': 'Close',
    }, '✕'));
    box.appendChild(header);

    const body = el('div', { className: 'modal-body' });
    if (typeof bodyContent === 'string') {
        body.innerHTML = bodyContent;
    } else if (bodyContent) {
        body.appendChild(bodyContent);
    }
    box.appendChild(body);

    if (extra && !(typeof extra === 'string' && !extra.includes('<') && !extra.appendChild)) {
        const footer = el('div', { className: 'modal-footer' });
        if (typeof extra === 'string') {
            footer.innerHTML = extra;
        } else {
            footer.appendChild(extra);
        }
        box.appendChild(footer);
    }

    overlay.appendChild(box);
    document.getElementById('modal-layer')?.appendChild(overlay);
    overlay.classList.add('open');
    document.body.classList.add('modal-open');

    // Track in stack so Escape key / closeModal / overlay-click all work
    if (!openModalsStack.includes(id)) {
        openModalsStack.push(id);
    }

    return overlay;
}


// ============================================================
// SETTINGS MODAL
// ============================================================
// Card Visibility Modal
// ============================================================

let cardVisibility = JSON.parse(localStorage.getItem('cc-card-visibility') || '{}');

function saveCardVisibility() {
    localStorage.setItem('cc-card-visibility', JSON.stringify(cardVisibility));
}

export function openVisibilityModal() {
    // --- Section 1: Dashboard Widgets ---
    let html = '<h3 style="margin:0 0 10px 0;font-size:1em;color:var(--color-accent);text-transform:uppercase;letter-spacing:0.05em;">Dashboard Widgets</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px;">';

    const dashboardCardIds = ['card-portfolio', 'card-spot', 'card-bullion', 'card-history', 'card-scrap', 'card-paper'];
    const dashboardCardNames = {
        'card-portfolio': 'Portfolio Value',
        'card-spot':     'Spot Prices',
        'card-bullion':  'Bullion Holdings',
        'card-history':  'Portfolio History',
        'card-scrap':    'Scrap Metal',
        'card-paper':    'Paper Currency',
    };

    dashboardCardIds.forEach(id => {
        if (id === 'card-search') return;
        const name = dashboardCardNames[id] || id;
        const checked = cardVisibility[id] !== false ? 'checked' : '';
        html += `<label style="display:flex;align-items:center;gap:8px;font-size:0.9em;cursor:pointer;padding:4px 0;">
            <input type="checkbox" data-vis-id="${id}" ${checked} style="width:16px;height:16px;margin:0;flex-shrink:0;" onchange="toggleDashboardCard('${id}', this.checked)">
            <span>${name}</span>
        </label>`;
    });
    html += '</div>';

    // --- Section 2: Coin Category Visibility ---
    html += '<hr style="border:none;border-top:1px solid var(--color-border-light);margin:0 0 16px 0;">';
    html += '<h3 style="margin:0 0 10px 0;font-size:1em;color:var(--color-accent);text-transform:uppercase;letter-spacing:0.05em;">Coin Categories</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start;">';

    // Get sections from state instead of DOM to get sub-sections
    const sections = getSections() || [];
    sections.forEach(sec => {
        const secName = sec.section || 'Unknown';
        const secId = 'section-' + secName.replace(/[^a-zA-Z0-9]/g, '');
        const secChecked = cardVisibility[secId] !== false ? 'checked' : '';
        
        // Add Section
        html += `<div style="display:flex; flex-direction:column; gap:2px; margin-bottom:8px;">`;
        html += `<div style="display:flex;align-items:center;gap:4px;">`;
        
        // Toggle button (only if it has types)
        if (sec.types && sec.types.length > 0) {
            html += `<button type="button" onclick="const p = this.parentElement.nextElementSibling; if(p.style.display==='none'){p.style.display='flex';this.textContent='▼';}else{p.style.display='none';this.textContent='►';}" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:0.7em;padding:4px;width:20px;text-align:center;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;" aria-label="Toggle sub-sections">►</button>`;
        } else {
            html += `<span style="width:20px;flex-shrink:0;"></span>`;
        }

        html += `<label style="display:flex;align-items:center;gap:8px;font-size:0.85em;cursor:pointer;padding:4px 0;flex:1;">
            <input type="checkbox" data-vis-id="${secId}" ${secChecked} style="width:14px;height:14px;margin:0;flex-shrink:0;" onchange="toggleCoinSection('${secId}', this.checked)">
            <span style="font-weight:600;">${secName}</span>
        </label>`;
        html += `</div>`;
        
        // Add Sub-sections (Types) container
        html += `<div style="display:none; flex-direction:column; gap:2px;">`;
        if (sec.types && sec.types.length > 0) {
            sec.types.forEach(mainType => {
                const typeId = 'type-' + mainType.replace(/[^a-zA-Z0-9]/g, '');
                const typeChecked = cardVisibility[typeId] !== false ? 'checked' : '';
                html += `<label style="display:flex;align-items:center;gap:8px;font-size:0.8em;cursor:pointer;padding:2px 0;margin-left:28px;color:var(--color-text-muted);">
                    <input type="checkbox" data-vis-id="${typeId}" ${typeChecked} style="width:12px;height:12px;margin:0;flex-shrink:0;" onchange="toggleCoinSection('${typeId}', this.checked)">
                    <span>${mainType}</span>
                </label>`;
            });
        }
        html += `</div>`;
        html += `</div>`;
    });
    html += '</div>';

    const body = document.createElement('div');
    body.innerHTML = html;
    createModal('modal-visibility', '👁 Dashboard & Categories', body, null);
}

export function closeVisibilityModal() {
    closeModal('modal-visibility');
}

// Global toggle functions
window.toggleDashboardCard = function(id, visible) {
    cardVisibility[id] = visible;
    saveCardVisibility();
    // Show/hide the actual card in #dashboard-grid
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
    // Also hide from dashboard-grid children by data-card-id
    const grid = document.getElementById('dashboard-grid');
    if (grid) {
        grid.querySelectorAll(`[data-card-id="${id}"]`).forEach(c => {
            c.style.display = visible ? '' : 'none';
        });
    }
};

window.toggleCoinSection = function(id, visible) {
    cardVisibility[id] = visible;
    saveCardVisibility();
    
    // First try direct ID
    let el = document.getElementById(id);
    if (el) {
        el.style.display = visible ? '' : 'none';
    } else {
        // Show/hide the section card by dataset if ID had CSS.escape issues
        const cards = document.querySelectorAll('.section-card');
        cards.forEach(card => {
            const secName = card.dataset.section;
            if (secName) {
                const escaped = secName.replace(/[^a-zA-Z0-9]/g, '');
                if ('section-' + escaped === id) {
                    card.style.display = visible ? '' : 'none';
                }
            }
        });
    }
};

// ============================================================

export function openSettingsModal() {
    const currentTheme = localStorage.getItem('cc-theme') || 'dark';
    const currentFolderColor = localStorage.getItem('cc-folder-color') || 'green';
    const currentSort = localStorage.getItem('cc-sort') || 'default';
    const hideProofs = localStorage.getItem('cc-hide-proofs') === 'true';
    const hideErrors = localStorage.getItem('cc-hide-errors') === 'true';
    const keyDatesOnly = localStorage.getItem('cc-key-dates-only') === 'true';

    const body = el('div', { style: 'display:flex; flex-direction:column; gap:var(--space-4);' });

    // --- Theme ---
    const themeSection = el('div', { className: 'settings-section' });
    themeSection.appendChild(el('h3', { className: 'settings-section-title' }, '\uD83C\uDFA8 Theme'));
    const themeBtn = el('button', { className: 'btn-secondary', style: 'width:100%;' }, '\uD83C\uDFA8 Open Custom Theme Designer');
    themeBtn.onclick = function() { closeModal('modal-settings'); setTimeout(function() { openCustomThemeDesigner(1); }, 150); };
    themeSection.appendChild(themeBtn);
    themeSection.appendChild(el('p', { style: 'font-size:0.75em;color:var(--color-text-muted);margin-top:6px;' }, 'All built-in themes are in the header dropdown. Use the designer to create your own.'));
    body.appendChild(themeSection);

        // --- Folder color section ---
    const colorSection = el('div', { className: 'settings-section' });
    colorSection.appendChild(el('h3', { className: 'settings-section-title' }, ' Album Page Color'));
    const colorRow = el('div', { className: 'settings-row' });
    colorRow.appendChild(el('label', { htmlFor: 'settings-folder-color' }, 'Background'));
    const colorSelect = el('select', { id: 'settings-folder-color' });
    [
        { value: 'green', label: 'Green (Classic)' },
        { value: 'blue', label: 'Blue' },
        { value: 'brown', label: 'Brown' },
        { value: 'black', label: 'Black' },
        { value: 'purple', label: 'Purple' },
        { value: 'red', label: 'Red' },
        { value: 'gray', label: 'Gray' },
    ].forEach(c => {
        const opt = el('option', { value: c.value }, c.label);
        if (c.value === currentFolderColor) opt.selected = true;
        colorSelect.appendChild(opt);
    });
    colorSelect.onchange = () => {
        localStorage.setItem('cc-folder-color', colorSelect.value);
            var fcMap = {green:'#2d4a2d',blue:'#2d3a4a',red:'#4a2d2d',brown:'#4a3d2d',black:'#1a1a1a',purple:'#3d2d4a',gray:'#3a3a3a'};
            var ftMap = {green:'#c9a227',blue:'#7db3d8',red:'#e8a0a0',brown:'#d4a574',black:'#888888',purple:'#c9a0d4',gray:'#aaaaaa'};
            var fcVal = fcMap[colorSelect.value] || fcMap.green;
            var ftVal = ftMap[colorSelect.value] || ftMap.green;
            document.documentElement.style.setProperty('--folder-color', fcVal);
            document.documentElement.style.setProperty('--folder-header-text', ftVal);
            document.documentElement.style.setProperty('--folder-label', ftVal);
            
            document.querySelectorAll('.album-inline, .album-grid-container').forEach(function(a) {
                a.style.background = 'var(--folder-color)';
            });
        showToast('Album color updated — switch to album view to see', 'info');
    };
    colorRow.appendChild(colorSelect);
    colorSection.appendChild(colorRow);
    body.appendChild(colorSection);

    // --- Filters section ---
    const filterSection = el('div', { className: 'settings-section' });
    filterSection.appendChild(el('h3', { className: 'settings-section-title' }, ' Filters'));

    const filters = [
        { id: 'settings-hide-proofs', label: 'Hide proof coins', key: 'cc-hide-proofs', checked: hideProofs },
        { id: 'settings-hide-errors', label: 'Hide error/variety coins', key: 'cc-hide-errors', checked: hideErrors },
        { id: 'settings-key-dates', label: 'Key dates only', key: 'cc-key-dates-only', checked: keyDatesOnly },
    ];

    filters.forEach(f => {
        const row = el('div', { className: 'settings-row' });
        const label = el('label', { htmlFor: f.id, style: 'display:flex; align-items:center; gap:var(--space-2); cursor:pointer;' });
        const cb = el('input', { type: 'checkbox', id: f.id, checked: f.checked });
        cb.onchange = () => {
            localStorage.setItem(f.key, cb.checked);
            showToast('Filter updated — refresh to apply', 'info');
            // Dispatch event so catalog can react
            window.dispatchEvent(new CustomEvent('cc-settings-changed', { detail: { key: f.key, value: cb.checked } }));
        };
        label.appendChild(cb);
        label.appendChild(document.createTextNode(f.label));
        row.appendChild(label);
        filterSection.appendChild(row);
    });
    body.appendChild(filterSection);

    // --- Album Options section ---
    const albumOptionsSection = el('div', { className: 'settings-section' });
    albumOptionsSection.appendChild(el('h3', { className: 'settings-section-title' }, ' Album View Options'));

    // Category 1: Holes to Include
    albumOptionsSection.appendChild(el('h4', { style: 'font-size:0.85rem; margin:var(--space-2) 0 var(--space-1) 0; color:var(--color-accent); font-weight:600;' }, 'Holes to Include:'));
    const inclusionOptions = [
        { id: 'settings-album-inc-proofs', label: 'Include proof coins', key: 'cc-album-include-proofs', checked: localStorage.getItem('cc-album-include-proofs') !== 'false' },
        { id: 'settings-album-inc-errors', label: 'Include error/variety coins', key: 'cc-album-include-errors', checked: localStorage.getItem('cc-album-include-errors') !== 'false' },
        { id: 'settings-album-inc-rare', label: 'Include super rare coins (<1000 mintage)', key: 'cc-album-include-rare', checked: localStorage.getItem('cc-album-include-rare') !== 'false' },
    ];
    inclusionOptions.forEach(opt => {
        const row = el('div', { className: 'settings-row' });
        const label = el('label', { htmlFor: opt.id, style: 'display:flex; align-items:center; gap:var(--space-2); cursor:pointer; font-size:0.85rem;' });
        const cb = el('input', { type: 'checkbox', id: opt.id, checked: opt.checked });
        cb.onchange = () => {
            localStorage.setItem(opt.key, cb.checked);
            showToast('Album configuration updated', 'info');
            window.dispatchEvent(new CustomEvent('cc-album-options-changed', { detail: { key: opt.key, value: cb.checked } }));
        };
        label.appendChild(cb);
        label.appendChild(document.createTextNode(opt.label));
        row.appendChild(label);
        albumOptionsSection.appendChild(row);
    });

    // Category 2: Badges & Indicators to Show
    albumOptionsSection.appendChild(el('h4', { style: 'font-size:0.85rem; margin:var(--space-3) 0 var(--space-1) 0; color:var(--color-accent); font-weight:600;' }, 'Badges & Indicators to Show:'));
    const badgeOptions = [
        { id: 'settings-album-show-multiplier', label: 'Show quantity multiplier (e.g. ×2)', key: 'cc-album-show-multiplier', checked: localStorage.getItem('cc-album-show-multiplier') !== 'false' },
        { id: 'settings-album-show-errors', label: 'Show error/variety badge (⚠)', key: 'cc-album-show-errors', checked: localStorage.getItem('cc-album-show-errors') !== 'false' },
        { id: 'settings-album-show-proofs', label: 'Show proof coins badge ()', key: 'cc-album-show-proofs', checked: localStorage.getItem('cc-album-show-proofs') !== 'false' },
        { id: 'settings-album-show-rare', label: 'Show super rare coins badge ()', key: 'cc-album-show-rare', checked: localStorage.getItem('cc-album-show-rare') !== 'false' },
    ];
    badgeOptions.forEach(opt => {
        const row = el('div', { className: 'settings-row' });
        const label = el('label', { htmlFor: opt.id, style: 'display:flex; align-items:center; gap:var(--space-2); cursor:pointer; font-size:0.85rem;' });
        const cb = el('input', { type: 'checkbox', id: opt.id, checked: opt.checked });
        cb.onchange = () => {
            localStorage.setItem(opt.key, cb.checked);
            showToast('Album configuration updated', 'info');
            window.dispatchEvent(new CustomEvent('cc-album-options-changed', { detail: { key: opt.key, value: cb.checked } }));
        };
        label.appendChild(cb);
        label.appendChild(document.createTextNode(opt.label));
        row.appendChild(label);
        albumOptionsSection.appendChild(row);
    });

    body.appendChild(albumOptionsSection);

    // --- Sort section ---
    const sortSection = el('div', { className: 'settings-section' });
    sortSection.appendChild(el('h3', { className: 'settings-section-title' }, ' Sort Order'));
    const sortRow = el('div', { className: 'settings-row' });
    sortRow.appendChild(el('label', { htmlFor: 'settings-sort' }, 'Default sort'));
    const sortSelect = el('select', { id: 'settings-sort' });
    [
        { value: 'default', label: 'Default (Year → Mint)' },
        { value: 'az', label: 'Alphabetical' },
        { value: 'value-desc', label: 'Value (High → Low)' },
        { value: 'completion', label: 'Completion' },
    ].forEach(s => {
        const opt = el('option', { value: s.value }, s.label);
        if (s.value === currentSort) opt.selected = true;
        sortSelect.appendChild(opt);
    });
    sortSelect.onchange = () => {
        localStorage.setItem('cc-sort', sortSelect.value);
        showToast('Sort order updated', 'info');
        window.dispatchEvent(new CustomEvent('cc-settings-changed', { detail: { key: 'sort', value: sortSelect.value } }));
    };
    sortRow.appendChild(sortSelect);
    sortSection.appendChild(sortRow);
    body.appendChild(sortSection);

    // --- Bullion Metal Visibility (V1 feature) ---
    const bullionSection = el('div', { className: 'settings-section' });
    bullionSection.appendChild(el('h3', { className: 'settings-section-title' }, 'Bullion Metals'));
    const bullionToggles = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:4px;' });
    var bullionMetals = [
        {id:'gold',label:'Gold'},
        {id:'silver',label:'Silver'},
        {id:'copper',label:'Copper'},
        {id:'platinum',label:'Platinum'},
        {id:'palladium',label:'Palladium'}
    ];
    var bullionVis = JSON.parse(localStorage.getItem('cc-bullion-vis') || '{}');
    bullionMetals.forEach(function(m) {
        var row = el('div', { style:'display:flex;align-items:center;gap:6px;font-size:0.85em;' });
        var cb = el('input', { type:'checkbox', checked: bullionVis[m.id] !== false });
        cb.onchange = function() {
            bullionVis[m.id] = this.checked;
            localStorage.setItem('cc-bullion-vis', JSON.stringify(bullionVis));
            window.dispatchEvent(new CustomEvent('cc-bullion-visibility-changed'));
        };
        row.appendChild(cb);
        row.appendChild(document.createTextNode(m.label));
        bullionToggles.appendChild(row);
    });
    bullionSection.appendChild(bullionToggles);
    body.appendChild(bullionSection);

    // --- Card Visibility section ---
    const visSection = el('div', { className: 'settings-section' });
    visSection.appendChild(el('h3', { className: 'settings-section-title' }, '👁 Card Visibility'));
    const visCards = [
        { id: 'card-dashboard', label: 'Dashboard Cards', desc: 'Portfolio, spot prices, completion' },
        { id: 'card-search', label: 'Search Bar', desc: 'Full-text search and filters' },
    ];
    visCards.forEach(card => {
        const row = el('div', { className: 'settings-row' });
        const label = el('label', { htmlFor: 'vis-' + card.id, style: 'display:flex; align-items:center; gap:var(--space-2); cursor:pointer; flex:1;' });
        const cb = el('input', { type: 'checkbox', id: 'vis-' + card.id, checked: localStorage.getItem('vis-' + card.id) !== 'false' });
        cb.onchange = () => {
            const elCard = document.getElementById(card.id);
            if (elCard) elCard.style.display = cb.checked ? '' : 'none';
            localStorage.setItem('vis-' + card.id, cb.checked);
        };
        label.appendChild(cb);
        const textWrap = el('div', {});
        textWrap.appendChild(el('div', { style: 'font-weight:600; font-size:0.9rem;' }, card.label));
        textWrap.appendChild(el('div', { style: 'font-size:0.75rem; color:var(--color-text-muted);' }, card.desc));
        label.appendChild(textWrap);
        row.appendChild(label);
        visSection.appendChild(row);
    });
    body.appendChild(visSection);

    // --- Export & Backup section ---
    const exportSection = el('div', { className: 'settings-section' });
    exportSection.appendChild(el('h3', { className: 'settings-section-title' }, ' Export & Backup'));
    const exportBtn = el('button', { className: 'btn-secondary', style: 'width:100%;' }, ' Export & Backup');
    exportBtn.onclick = function() {
        closeModal('modal-settings');
        setTimeout(function() { openExportModal(); }, 150);
    };
    exportSection.appendChild(exportBtn);
    exportSection.appendChild(el('p', { style: 'font-size:0.75em;color:var(--color-text-muted);margin-top:6px;' }, 'Export CSV, backup/restore JSON, and import data.'));
    body.appendChild(exportSection);

    // --- Pricing Rules section (V1 feature) ---
    const pricingSection = el('div', { className: 'settings-section' });
    pricingSection.appendChild(el('h3', { className: 'settings-section-title' }, 'Pricing Rules'));
    const pricingBtn = el('button', { className: 'btn-secondary', style: 'width:100%;' }, 'Edit Pricing Rules');
    pricingBtn.onclick = function() {
        closeModal('modal-settings');
        setTimeout(function() { openPricingRulesModal(); }, 150);
    };
    pricingSection.appendChild(pricingBtn);
    pricingSection.appendChild(el('p', { style: 'font-size:0.75em;color:var(--color-text-muted);margin-top:6px;' }, 'Set base and key-date prices for each coin type.'));
    body.appendChild(pricingSection);

    // --- Completion Dashboard (V1 feature) ---
    const compSection = el('div', { className: 'settings-section' });
    compSection.appendChild(el('h3', { className: 'settings-section-title' }, 'Collection Stats'));
    const compBtn = el('button', { className: 'btn-secondary', style: 'width:100%;' }, 'View Completion Dashboard');
    compBtn.onclick = function() {
        closeModal('modal-settings');
        setTimeout(function() { openCompletionDashboard(); }, 150);
    };
    compSection.appendChild(compBtn);
    compSection.appendChild(el('p', { style: 'font-size:0.75em;color:var(--color-text-muted);margin-top:6px;' }, 'Detailed breakdown by section and coin type.'));
    body.appendChild(compSection);

    // --- Image Filter (V1 feature) ---
    const imgFilterSection = el('div', { className: 'settings-section' });
    imgFilterSection.appendChild(el('h3', { className: 'settings-section-title' }, 'Image Tools'));
    const missingImgBtn = el('button', { className: 'btn-secondary', style: 'width:100%;' }, 'Find Coins Missing Images');
    missingImgBtn.onclick = function() {
        closeModal('modal-settings');
        setTimeout(function() { filterMissingImages(); }, 150);
    };
    imgFilterSection.appendChild(missingImgBtn);
    imgFilterSection.appendChild(el('p', { style: 'font-size:0.75em;color:var(--color-text-muted);margin-top:6px;' }, 'Filter catalog to show only coins without reference images.'));
    body.appendChild(imgFilterSection);

    // --- Dashboard & Cards section ---
    const customCardSection = el('div', { className: 'settings-section' });
    customCardSection.appendChild(el('h3', { className: 'settings-section-title' }, ' Dashboard Custom Cards'));
    const customCardBtn = el('button', { className: 'btn-secondary', style: 'width:100%;' }, ' Custom Card Maker');
    customCardBtn.onclick = function() {
        closeModal('modal-settings');
        setTimeout(function() { openCollectablesModal(); }, 150);
    };
    customCardSection.appendChild(customCardBtn);
    customCardSection.appendChild(el('p', { style: 'font-size:0.75em;color:var(--color-text-muted);margin-top:6px;' }, 'Create custom trackers (e.g., Stamps, Watches) for your dashboard.'));
    body.appendChild(customCardSection);

    // --- Data Management section ---
    const wipeSection = el('div', { className: 'settings-section' });
    wipeSection.appendChild(el('h3', { className: 'settings-section-title' }, '⚠ Data Management'));
    // === Reset Data (keep images) ===
    const resetDataBtn = el('button', {
        className: 'btn-danger',
        style: 'width:100%; margin-bottom:8px; background: var(--color-danger); color: white;'
    }, 'Reset Data (Keep Images)');
    resetDataBtn.onclick = function() {
        if (confirm('Reset your inventory, scrap, wishlist, and portfolio? Your coin images and settings will be preserved.')) {
            if (confirm('This cannot be undone. Proceed?')) {
                fetch('/api/wipe_all_data', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({keep_images: true})
                }).then(function() {
                    localStorage.clear();
                    window.location.reload();
                }).catch(function(err) {
                    alert('Reset failed: ' + err);
                });
            }
        }
    };
    wipeSection.appendChild(resetDataBtn);

    // === Full Factory Reset (wipe everything) ===
    const fullResetBtn = el('button', {
        className: 'btn-danger',
        style: 'width:100%; background: var(--color-danger); color: white;'
    }, 'Full Factory Reset (Wipe Everything)');
    fullResetBtn.onclick = function() {
        if (confirm('FULL FACTORY RESET: This will delete EVERYTHING - inventory, images, settings, and configurations! All coins will show as uncollected.')) {
            if (confirm('FINAL WARNING: This CANNOT be undone.')) {
                localStorage.clear();
                fetch('/api/wipe_all_data', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({keep_images: false})
                }).then(function() {
                    window.location.reload();
                }).catch(function(err) {
                    alert('Full reset failed: ' + err);
                    window.location.reload();
                });
            }
        }
    };
    wipeSection.appendChild(fullResetBtn);

    // Description
    wipeSection.appendChild(el('p', { style: 'font-size:0.75em;color:var(--color-text-muted);margin-top:6px;' },
        '"Reset Data" keeps your coin images and settings. "Full Factory Reset" wipes everything.'));
    body.appendChild(wipeSection);

    const footer = el('div', { className: 'settings-footer' });
    footer.appendChild(el('span', { className: 'text-muted', style: 'font-size:0.75rem;' },
        'Changes to filters and sort apply on next catalog load.'
    ));

    createModal('modal-settings', '⚙ Settings', body, footer);
}

// ============================================================
// INFO / HELP MODAL
// ============================================================

export function openHelpModal() {
    const sections = getSections();
    const inventory = getInventory();
    const prices = getSpotPrices();

    const totalCoins = sections.reduce((s, sec) => s + sec.total, 0);
    const ownedCoins = sections.reduce((s, sec) => s + sec.owned, 0);
    const pct = totalCoins > 0 ? Math.round((ownedCoins / totalCoins) * 100) : 0;
    const invEntries = Object.values(inventory).flat();
    const totalInvItems = invEntries.reduce((s, e) => s + (e.quantity || 0), 0);

    const body = el('div', { style: 'display:flex; flex-direction:column; gap:var(--space-4);' });

    // --- App info ---
    const infoSection = el('div', { className: 'settings-section' });
    infoSection.appendChild(el('h3', { className: 'settings-section-title' }, 'ℹ About'));
    const version = window.APP_VERSION || 'dev';
    infoSection.appendChild(el('p', { className: 'text-muted', style: 'font-size:0.85rem;' },
        'Coin Catalog v2 — ' + version
    ));
    infoSection.appendChild(el('p', { className: 'text-muted', style: 'font-size:0.85rem;' },
        'A self-hosted coin collection tracker with live metal prices, album view, and inventory management.'
    ));
    body.appendChild(infoSection);

    // --- Collection stats ---
    const statsSection = el('div', { className: 'settings-section' });
    statsSection.appendChild(el('h3', { className: 'settings-section-title' }, ' Collection Stats'));

    const statsGrid = el('div', { className: 'stats-grid' });

    const statItems = [
        { label: 'Total Types', value: totalCoins.toLocaleString() },
        { label: 'Owned', value: ownedCoins.toLocaleString() },
        { label: 'Completion', value: pct + '%' },
        { label: 'Total Items', value: totalInvItems.toLocaleString() },
        { label: 'Sections', value: sections.length.toString() },
    ];

    if (prices.gold_oz) {
        statItems.push({ label: 'Gold', value: '$' + prices.gold_oz.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '/oz' });
    }
    if (prices.silver_oz) {
        statItems.push({ label: 'Silver', value: '$' + prices.silver_oz.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '/oz' });
    }

    statItems.forEach(item => {
        const card = el('div', { className: 'stat-card' });
        card.appendChild(el('div', { className: 'stat-value' }, item.value));
        card.appendChild(el('div', { className: 'stat-label' }, item.label));
        statsGrid.appendChild(card);
    });

    statsSection.appendChild(statsGrid);
    body.appendChild(statsSection);

    // --- Keyboard shortcuts ---
    const shortcutSection = el('div', { className: 'settings-section' });
    shortcutSection.appendChild(el('h3', { className: 'settings-section-title' }, '⌨ Keyboard Shortcuts'));

    const shortcuts = [
        { key: 'Ctrl+F / Cmd+F', desc: 'Focus search bar' },
        { key: 'Escape', desc: 'Close modal / Clear search' },
        { key: 'Ctrl+Shift+R', desc: 'Hard refresh (clear cache)' },
    ];

    shortcuts.forEach(s => {
        const row = el('div', { className: 'shortcut-row' });
        row.appendChild(el('kbd', { className: 'shortcut-key' }, s.key));
        row.appendChild(el('span', { className: 'shortcut-desc' }, s.desc));
        shortcutSection.appendChild(row);
    });
    body.appendChild(shortcutSection);

    // --- Tips ---
    const tipsSection = el('div', { className: 'settings-section' });
    tipsSection.appendChild(el('h3', { className: 'settings-section-title' }, 'Tips'));
    const tips = [
        'Click a coin hole in album view to add it to your inventory',
        'Right-click a coin for quick actions',
        'Use the search bar to filter by year, type, or mint mark',
        'Upload images at the type level (applies to all coins of that type) or per-coin',
        'Check the dashboard for live metal prices and portfolio value',
    ];
    const tipsList = el('ul', { style: 'font-size:0.85rem; color:var(--color-text-muted); padding-left:1.2rem; display:flex; flex-direction:column; gap:var(--space-1);' });
    tips.forEach(t => {
        tipsList.appendChild(el('li', {}, t));
    });
    tipsSection.appendChild(tipsList);
    body.appendChild(tipsSection);

    // --- Stories ---
    const storiesSection = el('div', { className: 'settings-section' });
    storiesSection.appendChild(el('h3', { className: 'settings-section-title' }, 'Coin Stories'));
    storiesSection.appendChild(el('p', { className: 'settings-section-desc' }, 'Read interesting historical stories about coins.'));
    const storiesBtn = el('button', { className: 'btn-secondary', style: 'width:100%;' }, 'Open Stories');
    storiesBtn.addEventListener('click', () => {
        closeModal('modal-help');
        import('./stories.js').then(m => m.openStoryModal());
    });
    storiesSection.appendChild(storiesBtn);
    body.appendChild(storiesSection);

    createModal('modal-help', 'Info & Help', body, null);
}

// ============================================================


// ============================================================
// Close handler
// ============================================================

document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-action="close-modal"]');
    if (closeBtn) {
        const modal = closeBtn.closest('.modal-overlay');
        if (modal) {
            // Use closeModal() so the openModalsStack stays in sync
            closeModal(modal.id);
        }
    }
});

// ============================================================
// Legacy modal API (used by images.js, inventory.js)
// ============================================================

let openModalsStack = [];

function updateBodyScrollLock() {
    if (openModalsStack.length > 0) {
        document.body.classList.add('modal-open');
    } else {
        document.body.classList.remove('modal-open');
    }
}

export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) { console.error('[modals] Modal not found:', modalId); return; }
    if (openModalsStack.includes(modalId)) return;
    // Save scroll position before opening modal
    if (openModalsStack.length === 0) {
        modal._savedScrollY = window.scrollY;
    }
    modal.classList.add('open');
    openModalsStack.push(modalId);
    updateBodyScrollLock();
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('open');
    openModalsStack = openModalsStack.filter(id => id !== modalId);
    updateBodyScrollLock();
    // Restore scroll position after closing modal
    if (openModalsStack.length === 0 && modal._savedScrollY !== undefined) {
        window.scrollTo(0, modal._savedScrollY);
    }
}

export function closeAllModals() {
    openModalsStack.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('open');
    });
    openModalsStack = [];
    updateBodyScrollLock();
}

// Global event listeners for legacy modal support
window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && openModalsStack.length > 0) {
        const topId = openModalsStack[openModalsStack.length - 1];
        closeModal(topId);
    }
});

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal(e.target.id);
    }
});

window.closeModals = closeAllModals;

// ============================================================
// CUSTOM THEME DESIGNER
// ============================================================


// Theme contrast validation
function _hex2rgb(h) { if (!h || h.length < 7) return [128,128,128]; return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
function _tL(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function _gL(h) { var c = _hex2rgb(h); return 0.2126*_tL(c[0]) + 0.7152*_tL(c[1]) + 0.0722*_tL(c[2]); }
function _cR(c1, c2) { var l1 = _gL(c1), l2 = _gL(c2); return (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05); }
function validateThemeContrast(colors) {
    var iss = [];
    [['color-text-main','color-bg-card','Text/Card'],['color-text-main','color-bg-body','Text/Page'],['color-accent','color-accent-text','Accent/BtnText'],['color-header-text','color-header-bg','Hdr/HdrBG']].forEach(function(p) {
        if (colors[p[0]] && colors[p[1]] && _cR(colors[p[0]], colors[p[1]]) < 3) iss.push(p[2]);
    });
    return iss;
}

function openCustomThemeDesigner(slot) {
    const COLOR_FIELDS = [
        { key: 'color-bg-body',      label: 'Page Background',     default: '#121212' },
        { key: 'color-bg-card',      label: 'Card Background',     default: '#1e1e1e' },
        { key: 'color-text-main',    label: 'Main Text',           default: '#f8f9fa' },
        { key: 'color-text-muted',   label: 'Secondary Text',      default: '#adb5bd' },
        { key: 'color-accent',       label: 'Accent & Buttons',    default: '#60a5fa' },
        { key: 'color-accent-text',  label: 'Button Text',         default: '#ffffff' },
        { key: 'color-border',       label: 'Border Color',        default: '#495057' },
        { key: 'color-border-light', label: 'Divider',             default: '#343a40' },
        { key: 'color-accord-bg',    label: 'Row / Section BG',    default: '#2b3035' },
        { key: 'color-header-bg',    label: 'Header Bar',          default: '#000000' },
        { key: 'color-header-text',  label: 'Header Text',         default: '#f8f9fa' },
        { key: 'color-finance-bg',   label: 'Settings Panel BG',   default: '#212529' },
    ];

    function keyToCssVar(key) { return '--custom-' + key.replace('color-', ''); }

    // Active slot tracking
    var activeSlot = slot;

    function updateActiveSlotBorder() {
        [1,2,3].forEach(function(s) {
            var p = document.getElementById('cte-panel-' + s);
            if (p) p.style.borderColor = (s === activeSlot) ? 'var(--color-accent)' : 'transparent';
        });
    }

    // Color picker state
    var pickerState = { slot: null, field: null };

    function openColorPicker(slotNum, fieldKey, currentColor) {
        pickerState = { slot: slotNum, field: fieldKey };
        var existing = document.getElementById('color-picker-modal');
        if (existing) existing.remove();

        // Parse current color to HSV for the picker
        var rgb = hexToRgb(currentColor);
        var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

        var pickerOverlay = el('div', {
            id: 'color-picker-modal',
            style: 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);',
        });

        var pickerBox = el('div', {
            style: 'background:var(--color-bg-card);border-radius:12px 12px 0 0;padding:16px;width:100%;max-width:400px;border:1px solid var(--color-border);',
        });

        // Title
        var titleRow = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;' });
        titleRow.appendChild(el('strong', { style: 'color:var(--color-text-main);font-size:0.9em;' }, 'Select Color'));
        var closeBtn = el('button', { style: 'background:none;border:none;color:var(--color-text-muted);font-size:1.2em;cursor:pointer;' }, '\u2715');
        closeBtn.onclick = function() { pickerOverlay.remove(); };
        titleRow.appendChild(closeBtn);
        pickerBox.appendChild(titleRow);

        // Color preview + hex input
        var previewRow = el('div', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:12px;' });
        var previewBox = el('div', { style: 'width:48px;height:48px;border-radius:8px;border:2px solid var(--color-border);background:' + currentColor + ';' });
        var hexInput = el('input', { type: 'text', value: currentColor, style: 'flex:1;padding:8px;border-radius:6px;border:1px solid var(--color-border);background:var(--color-bg-body);color:var(--color-text-main);font-size:0.9em;font-family:monospace;' });
        previewRow.appendChild(previewBox);
        previewRow.appendChild(hexInput);
        pickerBox.appendChild(previewRow);

        // Saturation/Brightness area
        var sbArea = el('div', {
            id: 'cp-sb-area',
            style: 'width:100%;height:200px;border-radius:8px;position:relative;cursor:crosshair;margin-bottom:8px;border:1px solid var(--color-border);background:linear-gradient(to right, #fff, hsl(' + Math.round(hsv.h * 360) + ',100%,50%));',
        });
        var sbOverlay = el('div', { style: 'position:absolute;top:0;left:0;right:0;bottom:0;border-radius:8px;background:linear-gradient(to top, #000, transparent);' });
        sbArea.appendChild(sbOverlay);

        // SB cursor
        var sbCursor = el('div', {
            id: 'cp-sb-cursor',
            style: 'position:absolute;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5);pointer-events:none;top:' + ((1 - hsv.v) * 196) + 'px;left:' + (hsv.s * 196) + 'px;',
        });
        sbArea.appendChild(sbCursor);
        pickerBox.appendChild(sbArea);

        // Hue slider
        var hueRow = el('div', { style: 'margin-bottom:12px;' });
        var hueSlider = el('input', {
            type: 'range', min: '0', max: '360', value: Math.round(hsv.h * 360),
            style: 'width:100%;height:24px;border-radius:12px;appearance:none;background:linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);cursor:pointer;',
        });
        hueRow.appendChild(hueSlider);
        pickerBox.appendChild(hueRow);

        // Recent colors
        var recentColors = JSON.parse(localStorage.getItem('cc-recent-colors') || '[]');
        if (recentColors.length > 0) {
            var recentRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;' });
            recentRow.appendChild(el('span', { style: 'font-size:0.7em;color:var(--color-text-muted);margin-right:4px;' }, 'Recent:'));
            recentColors.slice(0, 10).forEach(function(rc) {
                var rcBox = el('div', {
                    style: 'width:24px;height:24px;border-radius:4px;border:1px solid var(--color-border);background:' + rc + ';cursor:pointer;',
                    title: rc,
                });
                rcBox.onclick = function() {
                    hexInput.value = rc;
                    previewBox.style.background = rc;
                    var nrgb = hexToRgb(rc);
                    var nhsv = rgbToHsv(nrgb.r, nrgb.g, nrgb.b);
                    hueSlider.value = Math.round(nhsv.h * 360);
                    sbCursor.style.left = (nhsv.s * 196) + 'px';
                    sbCursor.style.top = ((1 - nhsv.v) * 196) + 'px';
                    sbArea.style.background = 'linear-gradient(to right, #fff, hsl(' + Math.round(nhsv.h * 360) + ',100%,50%))';
                    sbPickerUpdate(nhsv.s, nhsv.v, Math.round(nhsv.h * 360));
                };
                recentRow.appendChild(rcBox);
            });
            pickerBox.appendChild(recentRow);
        }

        // Update function for SB picker
        function sbPickerUpdate(sat, val, hue) {
            var hex = hsvToHex(hue / 360, sat, val);
            hexInput.value = hex;
            previewBox.style.background = hex;
            pickerState.currentHex = hex;
        }

        // SB area mouse/touch handling
        sbArea.addEventListener('mousedown', startSB);
        sbArea.addEventListener('touchstart', startSB, { passive: false });
        function startSB(e) {
            e.preventDefault();
            updateSB(e);
            document.addEventListener('mousemove', updateSB);
            document.addEventListener('touchmove', updateSB, { passive: false });
            document.addEventListener('mouseup', endSB);
            document.addEventListener('touchend', endSB);
        }
        function endSB() {
            document.removeEventListener('mousemove', updateSB);
            document.removeEventListener('touchmove', updateSB);
            document.removeEventListener('mouseup', endSB);
            document.removeEventListener('touchend', endSB);
        }
        function updateSB(e) {
            e.preventDefault();
            var rect = sbArea.getBoundingClientRect();
            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var clientY = e.touches ? e.touches[0].clientY : e.clientY;
            var x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            var y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
            sbCursor.style.left = (x * 196) + 'px';
            sbCursor.style.top = (y * 196) + 'px';
            sbPickerUpdate(x, 1 - y, parseInt(hueSlider.value));
        }

        // Hue slider handler
        hueSlider.addEventListener('input', function() {
            var hue = parseInt(this.value);
            sbArea.style.background = 'linear-gradient(to right, #fff, hsl(' + hue + ',100%,50%))';
            var sat = parseFloat(sbCursor.style.left) / 196 || 0;
            var val = 1 - (parseFloat(sbCursor.style.top) / 196 || 0);
            sbPickerUpdate(sat, val, hue);
        });

        // Hex input handler
        hexInput.addEventListener('input', function() {
            var hex = this.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                previewBox.style.background = hex;
                var nrgb = hexToRgb(hex);
                var nhsv = rgbToHsv(nrgb.r, nrgb.g, nrgb.b);
                hueSlider.value = Math.round(nhsv.h * 360);
                sbArea.style.background = 'linear-gradient(to right, #fff, hsl(' + Math.round(nhsv.h * 360) + ',100%,50%))';
                sbCursor.style.left = (nhsv.s * 196) + 'px';
                sbCursor.style.top = ((1 - nhsv.v) * 196) + 'px';
                pickerState.currentHex = hex;
            }
        });

        // Action buttons
        var actionRow = el('div', { style: 'display:flex;gap:8px;margin-top:12px;' });
        var cancelBtn = el('button', { className: 'btn-secondary', style: 'flex:1;padding:10px;font-size:0.85em;' }, 'Cancel');
        cancelBtn.onclick = function() { pickerOverlay.remove(); };
        var setBtn = el('button', { className: 'btn-primary', style: 'flex:1;padding:10px;font-size:0.85em;' }, 'Set Color');
        setBtn.onclick = function() {
            var hex = pickerState.currentHex || currentColor;
            // Save to recent colors
            var rc = JSON.parse(localStorage.getItem('cc-recent-colors') || '[]');
            rc = rc.filter(function(c) { return c !== hex; });
            rc.unshift(hex);
            rc = rc.slice(0, 15);
            localStorage.setItem('cc-recent-colors', JSON.stringify(rc));

            // Update the input in the theme panel
            var inp = document.querySelector('#cte-panel-' + pickerState.slot + ' input[data-key="' + pickerState.field + '"]');
            if (inp) {
                inp.value = hex;
                inp.dispatchEvent(new Event('input'));
            }
            pickerOverlay.remove();
        };
        actionRow.appendChild(cancelBtn);
        actionRow.appendChild(setBtn);
        pickerBox.appendChild(actionRow);

        pickerOverlay.appendChild(pickerBox);
        document.body.appendChild(pickerOverlay);
    }

    function buildSlotPanel(slot) {
        const savedColors = JSON.parse(localStorage.getItem('cc-custom-theme-' + slot) || '{}');
        const accentColor = savedColors['color-accent'] || '#60a5fa';

        const panel = el('div', {
            id: 'cte-panel-' + slot,
            style: 'background:var(--color-bg-card);border-radius:8px;padding:12px;border:2px solid ' + (slot === activeSlot ? 'var(--color-accent)' : 'transparent') + ';transition:border-color 0.2s;',
        });

        // Make entire panel clickable to activate it
        panel.addEventListener('click', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'LABEL') return;
            activeSlot = slot;
            updateActiveSlotBorder();
            livePreviewSlot(slot);
        });

        const header = el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;' });
        const left = el('div', { style: 'display:flex;align-items:center;gap:8px;' });
        const swatch = el('span', { style: 'display:inline-block;width:14px;height:14px;border-radius:50%;background:' + accentColor + ';border:2px solid var(--color-border);' });
        left.appendChild(swatch);
        left.appendChild(el('strong', { style: 'font-size:0.95em;' }, 'My Theme ' + slot));
        header.appendChild(left);
        const hint = el('span', { style: 'font-size:0.78em;color:var(--color-accent);' });
        header.appendChild(hint);
        panel.appendChild(header);

        // Color picker grid
        const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;' });
        COLOR_FIELDS.forEach(f => {
            const label = el('label', { style: 'display:flex;flex-direction:column;gap:2px;font-size:0.72em;color:var(--color-text-muted);' });
            label.appendChild(document.createTextNode(f.label));
            const inp = el('input', {
                type: 'color',
                value: savedColors[f.key] || f.default,
                style: 'width:100%;height:28px;padding:1px;border-radius:4px;border:1px solid var(--color-border);cursor:pointer;background:none;',
            });
            // Store key for collection
            inp.setAttribute('data-key', f.key);

            // Click handler: open custom color picker
            inp.addEventListener('click', function(e) {
                e.preventDefault();
                activeSlot = slot;
                updateActiveSlotBorder();
                openColorPicker(slot, f.key, this.value);
            });

            // Still allow direct input changes for keyboard users
            inp.addEventListener('input', function() {
                updateSlotFromInputs(slot);
                if (f.key === 'color-accent') swatch.style.background = this.value;
                hint.textContent = 'Previewing...';
            });

            label.appendChild(inp);
            grid.appendChild(label);
        });
        panel.appendChild(grid);

        // Save button
        const saveBtn = el('button', { className: 'btn-primary', style: 'margin-top:12px;width:100%;padding:8px;font-size:0.85em;' }, '\uD83D\uDCBE Save Theme ' + slot);
        saveBtn.onclick = function(e) {
            e.stopPropagation();
            saveSlotTheme(slot);
            activeSlot = slot;
            updateActiveSlotBorder();
            hint.textContent = '\u2713 Saved';
            setTimeout(function() { hint.textContent = ''; }, 2000);
        };
        panel.appendChild(saveBtn);

        return panel;
    }

    function updateSlotFromInputs(slotNum) {
        var panel = document.getElementById('cte-panel-' + slotNum);
        if (!panel) return;
        var colors = {};
        panel.querySelectorAll('input[type=color]').forEach(function(pi) {
            var key = pi.getAttribute('data-key');
            if (key) colors[key] = pi.value;
        });
        var root = document.documentElement;
        for (var k in colors) {
            root.style.setProperty(keyToCssVar(k), colors[k]);
        }
        document.body.setAttribute('data-theme', 'custom' + slotNum);
    }

    function livePreviewSlot(slotNum) {
        updateSlotFromInputs(slotNum);
    }

    function saveSlotTheme(slotNum) {
        var panel = document.getElementById('cte-panel-' + slotNum);
        if (!panel) return;
        var colors = {};
        panel.querySelectorAll('input[type=color]').forEach(function(pi) {
            var key = pi.getAttribute('data-key');
            if (key) colors[key] = pi.value;
        });
        var cIssues = validateThemeContrast(colors);
        if (cIssues.length > 0) {
            if (!confirm('Low contrast: ' + cIssues.join(', ') + '. Save anyway?')) return;
        }
        localStorage.setItem('cc-custom-theme-' + slotNum, JSON.stringify(colors));
        var root = document.documentElement;
        for (var k in colors) {
            root.style.setProperty(keyToCssVar(k), colors[k]);
        }
        document.body.setAttribute('data-theme', 'custom' + slotNum);
        var sel = document.getElementById('theme-selector');
        if (sel) sel.value = 'custom' + slotNum;
        showToast('Theme ' + slotNum + ' saved!', 'success');
    }

    // Build body
    const body = el('div', { style: 'display:flex;flex-direction:column;gap:12px;max-height:65vh;overflow-y:auto;padding-right:4px;' });
    body.appendChild(el('p', { style: 'font-size:0.82em;color:var(--color-text-muted);margin:0 0 4px 0;' }, 'Design up to 3 personal color schemes. Pick colors and preview live.'));
    body.appendChild(buildSlotPanel(1));
    body.appendChild(buildSlotPanel(2));
    body.appendChild(buildSlotPanel(3));

    var existing = document.getElementById('modal-custom-designer');
    if (existing) existing.remove();

    createModal('modal-custom-designer', '\uD83D\uDCA1 Custom Theme Designer', body, null);
    activeSlot = slot;
    updateActiveSlotBorder();
}

// Color conversion helpers
function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16) };
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r,g,b), min = Math.min(r,g,b);
    var h, s, v = max;
    var d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) { h = 0; }
    else {
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h, s: s, v: v };
}

function hsvToHex(h, s, v) {
    var r, g, b;
    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    switch(i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    r = Math.round(r * 255).toString(16).padStart(2, '0');
    g = Math.round(g * 255).toString(16).padStart(2, '0');
    b = Math.round(b * 255).toString(16).padStart(2, '0');
    return '#' + r + g + b;
}




// ============================================================
// IMAGE MANAGER
// ============================================================

function openImageManager() {
    const body = el('div', { style: 'display:flex; flex-direction:column; gap:12px;' });
    
    // Stats
    const statsRow = el('div', { style: 'display:flex; gap:16px; flex-wrap:wrap;' });
    const coinCount = document.querySelectorAll('[data-action="view-img"]').length;
    statsRow.appendChild(el('div', { className: 'dashboard-detail' }, ' ' + coinCount + ' coin images in catalog'));
    body.appendChild(statsRow);
    
    // Bulk actions
    const actionsRow = el('div', { className: 'settings-row', style: 'gap:8px; flex-wrap:wrap;' });
    
    const clearCacheBtn = el('button', { className: 'btn-secondary' }, '🧹 Clear Image Cache');
    clearCacheBtn.onclick = () => {
        if (confirm('Clear all cached images? They will re-download on next view.')) {
            // Force cache bust by reloading
            showToast('Image cache cleared', 'success');
            setTimeout(() => location.reload(), 500);
        }
    };
    actionsRow.appendChild(clearCacheBtn);
    
    const verifyBtn = el('button', { className: 'btn-secondary' }, ' Verify Images');
    verifyBtn.onclick = () => {
        const imgs = document.querySelectorAll('.coin-row-thumb, .coin-thumb');
        let loaded = 0, failed = 0;
        imgs.forEach(img => {
            if (img.complete && img.naturalWidth > 0) loaded++;
            else if (img.complete) failed++;
        });
        showToast(loaded + ' images loaded, ' + failed + ' failed', 'info', 5000);
    };
    actionsRow.appendChild(verifyBtn);
    
    body.appendChild(actionsRow);
    
    const footer = el('div', { style: 'display:flex; gap:8px; justify-content:flex-end;' });
    const closeBtn = el('button', { className: 'btn-secondary' }, 'Close');
    closeBtn.onclick = () => closeModal('modal-image-manager');
    footer.appendChild(closeBtn);
    
    createModal('modal-image-manager', ' Coin Image Bank', body, footer);
    openModal('modal-image-manager');
}

// ============================================================
// PRINT CHECKLIST
// ============================================================

function openPrintChecklist() {
    const sections = getSections();
    const inventory = getInventory();
    
    const body = el('div', { style: 'display:flex; flex-direction:column; gap:12px;' });
    
    const info = el('div', { style: 'font-size:0.85rem; color:var(--color-text-muted);' },
        'Print a checklist of coins you still need. Select sections to include.'
    );
    body.appendChild(info);
    
    const checklist = el('div', { style: 'max-height:400px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;' });
    
    sections.forEach(sec => {
        const row = el('div', { style: 'display:flex; align-items:center; gap:8px; padding:4px 8px; border-radius:4px; background:var(--color-bg-card);' });
        const cb = el('input', { type: 'checkbox', checked: true, 'data-section': sec.section });
        const missing = sec.total - sec.owned;
        const label = el('span', { style: 'font-size:0.85rem;' }, sec.section + ' (' + missing + ' missing)');
        row.appendChild(cb);
        row.appendChild(label);
        checklist.appendChild(row);
    });
    body.appendChild(checklist);
    
    const footer = el('div', { style: 'display:flex; gap:8px; justify-content:flex-end;' });
    const printBtn = el('button', { className: 'btn-primary' }, ' Print');
    printBtn.onclick = () => {
        const selected = Array.from(checklist.querySelectorAll('input:checked')).map(cb => cb.dataset.section);
        if (!selected.length) { showToast('Select at least one section', 'warning'); return; }
        
        const printWindow = window.open('', '_blank');
        let html = '<html><head><title>Coin Checklist</title><style>body{font-family:sans-serif;padding:20px;}h1{font-size:1.2rem;}ul{list-style:none;padding:0;}li{padding:2px 0;font-size:0.85rem;}</style></head><body>';
        html += '<h1>Coin Checklist — Missing Coins</h1>';
        selected.forEach(secName => {
            const sec = sections.find(s => s.section === secName);
            if (!sec) return;
            html += '<h2>' + secName + ' (' + (sec.total - sec.owned) + ' missing)</h2><ul>';
            html += '<li>☐ (Check off as you collect)</li>';
            html += '</ul>';
        });
        html += '</body></html>';
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    };
    footer.appendChild(printBtn);
    const cancelBtn = el('button', { className: 'btn-secondary' }, 'Cancel');
    cancelBtn.onclick = () => closeModal('modal-print-checklist');
    footer.appendChild(cancelBtn);
    
    createModal('modal-print-checklist', ' Print Checklist', body, footer);
    openModal('modal-print-checklist');
}

// ============================================================
// STORIES MODAL
// ============================================================

export async function openStoriesModal() {
    // Fetch stories data
    let stories = [];
    let categories = ['All'];
    try {
        const resp = await fetch('data/stories.json');
        const data = await resp.json();
        stories = data.stories || [];
        categories = data.categories || ['All'];
    } catch (err) {
        console.warn('[stories] Failed to load stories:', err);
    }

    let activeCategory = 'All';
    let searchQuery = '';

    const body = el('div', { style: 'display:flex; flex-direction:column; gap:var(--space-3);' });

    // --- Search bar ---
    const searchWrap = el('div', { style:'position:relative;' });
    const searchInput = el('input', {
        type: 'text',
        placeholder: 'Search stories...',
        style: 'width:100%; padding:var(--space-2) var(--space-3); padding-right:2.5rem; border-radius:var(--radius-md); border:1px solid var(--color-border); background:var(--color-accord-bg); color:var(--color-text-main); font-size:var(--font-size-sm);'
    });
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim().toLowerCase();
        renderStoryList();
    });
    const clearBtn = el('button', {
        style: 'position:absolute;right:var(--space-1);top:50%;transform:translateY(-50%);background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:1rem;display:none;',
        textContent: '✕'
    });
    clearBtn.addEventListener('click', () => { searchInput.value = ''; searchQuery = ''; renderStoryList(); clearBtn.style.display = 'none'; });
    searchInput.addEventListener('input', () => { clearBtn.style.display = searchInput.value ? '' : 'none'; });
    searchWrap.append(searchInput, clearBtn);
    body.appendChild(searchWrap);

    // --- Category filter pills ---
    const catWrap = el('div', { style:'display:flex;gap:var(--space-1);flex-wrap:wrap;' });
    categories.forEach(cat => {
        const pill = el('button', {
            className: 'filter-pill' + (cat === activeCategory ? ' active' : ''),
            textContent: cat,
            style: cat === activeCategory ? 'background:var(--color-accent);color:var(--color-accent-text);' : ''
        });
        pill.addEventListener('click', () => {
            activeCategory = cat;
            catWrap.querySelectorAll('.filter-pill').forEach(p => {
                p.classList.remove('active');
                p.style.background = '';
                p.style.color = '';
            });
            pill.classList.add('active');
            pill.style.background = 'var(--color-accent)';
            pill.style.color = 'var(--color-accent-text)';
            renderStoryList();
        });
        catWrap.appendChild(pill);
    });
    body.appendChild(catWrap);

    // --- Story list container ---
    const listWrap = el('div', { style:'display:flex;flex-direction:column;gap:var(--space-2);max-height:50vh;overflow-y:auto;' });

    function renderStoryList() {
        listWrap.innerHTML = '';
        const filtered = stories.filter(s => {
            const matchCat = activeCategory === 'All' || s.category === activeCategory;
            const matchSearch = !searchQuery ||
                s.title.toLowerCase().includes(searchQuery) ||
                s.summary.toLowerCase().includes(searchQuery) ||
                s.category.toLowerCase().includes(searchQuery);
            return matchCat && matchSearch;
        });

        if (!filtered.length) {
            listWrap.appendChild(el('div', { className:'text-muted', style:'padding:var(--space-4);text-align:center;' }, 'No stories found.'));
            return;
        }

        filtered.forEach(story => {
            const card = el('div', { style:'background:var(--color-accord-bg);border:1px solid var(--color-border-light);border-radius:var(--radius-md);padding:var(--space-3);cursor:pointer;transition:border-color var(--transition-fast);' });
            card.addEventListener('mouseenter', () => card.style.borderColor = 'var(--color-accent)');
            card.addEventListener('mouseleave', () => card.style.borderColor = '');

            const titleRow = el('div', { style:'display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-2);' });
            titleRow.appendChild(el('h4', { style:'font-size:var(--font-size-sm);font-weight:700;color:var(--color-text-main);margin:0;flex:1;' }, story.title));
            titleRow.appendChild(el('span', { className:'count-badge', style:'font-size:0.65rem;flex-shrink:0;' }, story.category));
            card.appendChild(titleRow);

            card.appendChild(el('p', { style:'font-size:var(--color-text-muted);font-size:0.8rem;margin-top:var(--space-1);color:var(--color-text-muted);line-height:1.4;' }, story.summary));

            card.addEventListener('click', () => {
                showStoryDetail(story);
            });

            listWrap.appendChild(card);
        });
    }

    body.appendChild(listWrap);
    renderStoryList();

    function showStoryDetail(story) {
        // Replace modal content with full story
        const modal = document.getElementById('modal-stories');
        if (!modal) return;
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = '';
        modalBody.style.maxHeight = '70vh';
        modalBody.style.overflowY = 'auto';

        modalBody.appendChild(el('span', { className:'count-badge', style:'display:inline-block;margin-bottom:var(--space-2);' }, story.category));
        modalBody.appendChild(el('h3', { style:'font-size:var(--font-size-lg);font-weight:700;color:var(--color-text-main);margin-bottom:var(--space-3);' }, story.title));
        var storyP = el('p', { style:'font-size:var(--font-size-base);line-height:1.7;color:var(--color-text-main);white-space:pre-wrap;' }); storyP.innerHTML = story.content; modalBody.appendChild(storyP);

        const backBtn = el('button', { className:'btn-secondary', style:'margin-top:var(--space-3);' }, '← Back to stories');
        backBtn.addEventListener('click', () => {
            // Close and reopen to reset
            closeModal('modal-stories');
            setTimeout(() => openStoriesModal(), 50);
        });
        modalBody.appendChild(backBtn);
    }

    createModal('modal-stories', '📖 Coin Stories', body, null);
}

// =========================================================================
// Scrap Metal Modal
// =========================================================================

export function openScrapMetalModal() {
    const body = el('div', { className: 'form' });

    // List existing items
    const listDiv = el('div', { id: 'scrap-list', style: 'margin-bottom:12px;' });
    const items = getScrapMetal();
    const prices = getSpotPrices();
    if (!items.length) {
        listDiv.appendChild(el('p', { className: 'text-muted' }, 'No scrap metal entries yet. Add items below.'));
    } else {
        items.forEach(item => {
            const spot = prices[(item.metal_type||'').toLowerCase()+'_oz'] || prices[(item.metal_type||'').toLowerCase()+'_lb'] || 0;
            const meltVal = item.weight_grams ? (item.weight_grams / 31.1035) * (item.purity || 1) * spot : 0;
            const row = el('div', { className: 'inventory-item', style: 'display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--color-border);' });
            var info = item.name + ' (' + item.metal_type + ', ' + (item.weight_grams||0).toFixed(1) + 'g @ ' + ((item.purity||0)*100).toFixed(0) + '%)';
            if (meltVal > 0) info += ' ~$' + meltVal.toFixed(2);
            row.appendChild(el('span', { style: 'flex:1;' }, info));
            const delBtn = el('button', { className: 'btn-danger btn-sm', 'data-action': 'delete', 'data-type': 'scrap', 'data-id': item.id }, '\u2715');
            row.appendChild(delBtn);
            listDiv.appendChild(row);
        });
    }
    body.appendChild(listDiv);

    // Add form (V1 style with purity presets and unit conversion)
    const nameInput = el('input', { className: 'form-input', placeholder: 'Item name (e.g. Silver Ring)', 'data-field': 'scrap-name' });

    const metalSelect = el('select', { className: 'form-input', 'data-field': 'scrap-metal' });
    [{v:'silver',l:'Silver'},{v:'gold',l:'Gold'},{v:'copper',l:'Copper'},{v:'platinum',l:'Platinum'},{v:'palladium',l:'Palladium'}].forEach(m => {
        metalSelect.appendChild(el('option', { value: m.v }, m.l));
    });

    // Purity presets (V1 style)
    const puritySelect = el('select', { className: 'form-input', 'data-field': 'scrap-purity' });
    const purityPresets = {
        gold: [{v:0.417,l:'10k (41.7%)'},{v:0.583,l:'14k (58.3%)'},{v:0.750,l:'18k (75.0%)'},{v:0.916,l:'22k (91.6%)'},{v:0.999,l:'24k (99.9%)'}],
        silver: [{v:0.925,l:'Sterling (92.5%)'},{v:0.900,l:'Coin Silver (90%)'},{v:0.999,l:'Fine Silver (99.9%)'}],
        copper: [{v:1.0,l:'Pure (100%)'}],
        platinum: [{v:0.900,l:'90%'},{v:0.950,l:'95%'},{v:0.999,l:'99.9%'}],
        palladium: [{v:0.900,l:'90%'},{v:0.950,l:'95%'},{v:0.999,l:'99.9%'}],
    };
    function updatePurityOptions() {
        var metal = metalSelect.value;
        puritySelect.innerHTML = '';
        (purityPresets[metal] || [{v:1.0,l:'Pure'}]).forEach(p => {
            puritySelect.appendChild(el('option', { value: p.v }, p.l));
        });
    }
    metalSelect.addEventListener('change', updatePurityOptions);
    updatePurityOptions();

    // Weight with unit conversion (V1 style)
    const weightRow = el('div', { style: 'display:flex;gap:4px;' });
    const weightInput = el('input', { className: 'form-input', type: 'number', step: '0.01', placeholder: 'Weight', 'data-field': 'scrap-weight', style: 'flex:1;' });
    const unitSelect = el('select', { className: 'form-input', 'data-field': 'scrap-unit', style: 'width:80px;' });
    [{v:'grams',l:'grams'},{v:'ozt',l:'troy oz'},{v:'oz',l:'oz'},{v:'lbs',l:'lbs'}].forEach(u => {
        unitSelect.appendChild(el('option', { value: u.v }, u.l));
    });
    weightRow.appendChild(weightInput);
    weightRow.appendChild(unitSelect);

    // Live melt value estimate
    const meltEstimate = el('div', { style: 'font-size:0.75em;color:var(--color-text-muted);margin:4px 0;' });
    function updateMeltEstimate() {
        var w = parseFloat(weightInput.value) || 0;
        var unit = unitSelect.value;
        var metal = metalSelect.value;
        var purity = parseFloat(puritySelect.value) || 1;
        // Convert to grams
        var grams = w;
        if (unit === 'ozt') grams = w * 31.1035;
        else if (unit === 'oz') grams = w * 28.3495;
        else if (unit === 'lbs') grams = w * 453.592;
        var spot = prices[metal+'_oz'] || 0;
        if (metal === 'copper') spot = (prices.copper_lb || 0) * 14.5833;
        var meltVal = (grams / 31.1035) * purity * spot;
        meltEstimate.textContent = meltVal > 0 ? 'Est. melt value: $' + meltVal.toFixed(2) : '';
    }
    weightInput.addEventListener('input', updateMeltEstimate);
    unitSelect.addEventListener('change', updateMeltEstimate);
    metalSelect.addEventListener('change', updateMeltEstimate);
    puritySelect.addEventListener('change', updateMeltEstimate);

    const notesInput = el('input', { className: 'form-input', placeholder: 'Notes (optional)', 'data-field': 'scrap-notes' });
    const addBtn = el('button', { className: 'btn-primary', style: 'width:100%;margin-top:8px;', 'data-action': 'add-scrap' }, '+ Add Scrap Metal');

    body.append(nameInput, metalSelect, puritySelect, weightRow, meltEstimate, notesInput, addBtn);

    if (typeof createModal === 'function') {
        createModal('modal-scrap', 'Scrap Metal', body, null);
    }
    openModal('modal-scrap');
}


// =========================================================================
// Paper Currency Modal
// =========================================================================

export function openPaperCurrencyModal() {
    const body = el('div', { className: 'form' });

    const listDiv = el('div', { id: 'paper-list', style: 'margin-bottom:12px;' });
    const items = getPaperCurrency();
    if (!items.length) {
        listDiv.appendChild(el('p', { className: 'text-muted' }, 'No paper currency entries yet.'));
    } else {
        items.forEach(item => {
            const row = el('div', { className: 'inventory-item', style: 'display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--color-border);' });
            const label = '$' + item.denomination + ' (' + item.series_year + ') ' + item.condition;
            row.appendChild(el('span', { style: 'flex:1;' }, label));
            const delBtn = el('button', { className: 'btn-danger btn-sm', 'data-action': 'delete', 'data-type': 'paper', 'data-id': item.id }, '✕');
            row.appendChild(delBtn);
            listDiv.appendChild(row);
        });
    }
    body.appendChild(listDiv);

    const denomInput = el('input', { className: 'form-input', type: 'number', step: '0.01', placeholder: 'Denomination (e.g. 20)', 'data-field': 'paper-denom' });
    const yearInput = el('input', { className: 'form-input', placeholder: 'Series Year (e.g. 2017)', 'data-field': 'paper-year' });
    const serialInput = el('input', { className: 'form-input', placeholder: 'Serial Number', 'data-field': 'paper-serial' });
    const condSelect = el('select', { className: 'form-input', 'data-field': 'paper-cond' });
    ['Poor', 'Fair', 'Good', 'Very Good', 'Fine', 'Very Fine', 'Extremely Fine', 'AU', 'UNC'].forEach(c => {
        condSelect.appendChild(el('option', { value: c }, c));
    });
    const valueInput = el('input', { className: 'form-input', type: 'number', step: '0.01', placeholder: 'Estimated Value ($)', 'data-field': 'paper-value' });

    const addBtn = el('button', { className: 'btn-primary', style: 'width:100%;margin-top:8px;', 'data-action': 'add-paper' }, '+ Add Currency');
    body.append(denomInput, yearInput, serialInput, condSelect, valueInput, addBtn);

    if (typeof createModal === 'function') {
        createModal('modal-paper', ' Paper Currency', body, null);
    }
    openModal('modal-paper');
}

// =========================================================================
// Other Collectables Modal
// =========================================================================

export function openCollectablesModal() {
    const body = el('div', { className: 'form' });

    // Category selector
    const catRow = el('div', { style: 'display:flex;gap:8px;margin-bottom:12px;align-items:flex-end;' });
    const catSelect = el('select', { className: 'form-input', 'data-field': 'collect-cat' });
    catSelect.appendChild(el('option', { value: '' }, '-- Select Category --'));
    getCustomCategories().forEach(c => {
        catSelect.appendChild(el('option', { value: c.name }, c.name));
    });
    const newCatInput = el('input', { className: 'form-input', placeholder: 'New category name', style: 'flex:1;', 'data-field': 'collect-newcat' });
    const newCatBtn = el('button', { className: 'btn-secondary btn-sm', 'data-action': 'add-category' }, '+');
    catRow.append(catSelect, newCatInput, newCatBtn);
    body.appendChild(catRow);

    // Items list
    const listDiv = el('div', { id: 'collect-list', style: 'margin-bottom:12px;max-height:200px;overflow-y:auto;' });
    const items = getOtherCollectables();
    if (!items.length) {
        listDiv.appendChild(el('p', { className: 'text-muted' }, 'No collectable items yet.'));
    } else {
        items.forEach(item => {
            const row = el('div', { className: 'inventory-item', style: 'display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--color-border);' });
            row.appendChild(el('span', { style: 'flex:1;' }, '[' + item.category_name + '] ' + item.name + ' (x' + item.quantity + ')'));
            const delBtn = el('button', { className: 'btn-danger btn-sm', 'data-action': 'delete', 'data-type': 'collect', 'data-id': item.id }, '✕');
            row.appendChild(delBtn);
            listDiv.appendChild(row);
        });
    }
    body.appendChild(listDiv);

    // Add item form
    const itemName = el('input', { className: 'form-input', placeholder: 'Item name', 'data-field': 'collect-name' });
    const itemQty = el('input', { className: 'form-input', type: 'number', value: '1', min: '1', placeholder: 'Qty', 'data-field': 'collect-qty' });
    const itemValue = el('input', { className: 'form-input', type: 'number', step: '0.01', placeholder: 'Est. Value ($)', 'data-field': 'collect-value' });
    const itemNotes = el('input', { className: 'form-input', placeholder: 'Notes (optional)', 'data-field': 'collect-notes' });

    const addBtn = el('button', { className: 'btn-primary', style: 'width:100%;margin-top:8px;', 'data-action': 'add-collect' }, '+ Add Item');
    body.append(itemName, itemQty, itemValue, itemNotes, addBtn);

    if (typeof createModal === 'function') {
        createModal('modal-collect', ' Other Collectables', body, null);
    }
    openModal('modal-collect');
}

// =========================================================================
// Event handlers for new Phase 6 modals
// =========================================================================

var _saving = false;
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    // --- Scrap Metal ---
    if (action === 'add-scrap') {
        if (_saving) return;
        _saving = true;
        const data = {
            name: document.querySelector('[data-field=scrap-name]')?.value || '',
            metal_type: document.querySelector('[data-field=scrap-metal]')?.value || 'silver',
            purity: parseFloat(document.querySelector('[data-field=scrap-purity]')?.value) || 1.0,
            weight_grams: parseFloat(document.querySelector('[data-field=scrap-weight]')?.value) || 0,
            notes: document.querySelector('[data-field=scrap-notes]')?.value || '',
        };
        _saving = false;
        if (!data.name) return showToast('Name is required', 'error');
        if (typeof addScrapMetal === 'function') {
            await addScrapMetal(data);
            const items = typeof fetchScrapMetal === 'function' ? await fetchScrapMetal() : [];
            if (typeof setScrapMetal === 'function') setScrapMetal(items);
            showToast('Scrap metal added', 'success');
            closeModal('modal-scrap');
            setTimeout(() => openScrapMetalModal(), 100);
        }
    }

    if (action === 'delete' && btn.dataset.type === 'scrap') {
        const id = parseInt(btn.dataset.id);
        if (typeof deleteScrapMetal === 'function') {
            await deleteScrapMetal(id);
            const items = typeof fetchScrapMetal === 'function' ? await fetchScrapMetal() : [];
            if (typeof setScrapMetal === 'function') setScrapMetal(items);
            showToast('Deleted', 'info');
            closeModal('modal-scrap');
            setTimeout(() => openScrapMetalModal(), 100);
        }
    }

    // --- Paper Currency ---
    if (action === 'add-paper') {
        if (_saving) return;
        _saving = true;
        const data = {
            denomination: parseFloat(document.querySelector('[data-field=paper-denom]')?.value) || 0,
            series_year: document.querySelector('[data-field=paper-year]')?.value || '',
            serial_number: document.querySelector('[data-field=paper-serial]')?.value || '',
            condition: document.querySelector('[data-field=paper-cond]')?.value || 'UNC',
            value: parseFloat(document.querySelector('[data-field=paper-value]')?.value) || 0,
        };
        _saving = false;
        if (!data.denomination) return showToast('Denomination is required', 'error');
        if (typeof addPaperCurrency === 'function') {
            await addPaperCurrency(data);
            const items = typeof fetchPaperCurrency === 'function' ? await fetchPaperCurrency() : [];
            if (typeof setPaperCurrency === 'function') setPaperCurrency(items);
            showToast('Currency added', 'success');
            closeModal('modal-paper');
            setTimeout(() => openPaperCurrencyModal(), 100);
        }
    }

    if (action === 'delete' && btn.dataset.type === 'paper') {
        const id = parseInt(btn.dataset.id);
        if (typeof deletePaperCurrency === 'function') {
            await deletePaperCurrency(id);
            const items = typeof fetchPaperCurrency === 'function' ? await fetchPaperCurrency() : [];
            if (typeof setPaperCurrency === 'function') setPaperCurrency(items);
            showToast('Deleted', 'info');
            closeModal('modal-paper');
            setTimeout(() => openPaperCurrencyModal(), 100);
        }
    }

    // --- Custom Categories ---
    if (action === 'add-category') {
        const name = document.querySelector('[data-field=collect-newcat]')?.value?.trim();
        _saving = false;
        if (!name) return showToast('Category name is required', 'error');
        if (typeof addCustomCategory === 'function') {
            await addCustomCategory(name);
            const cats = typeof fetchCustomCategories === 'function' ? await fetchCustomCategories() : [];
            if (typeof setCustomCategories === 'function') setCustomCategories(cats);
            showToast('Category added', 'success');
            closeModal('modal-collect');
            setTimeout(() => openCollectablesModal(), 100);
        }
    }

    // --- Other Collectables ---
    if (action === 'add-collect') {
        if (_saving) return;
        _saving = true;
        const catSelect = document.querySelector('[data-field=collect-cat]');
        const categoryName = catSelect?.value || '';
        if (!categoryName) return showToast('Select a category', 'error');
        const data = {
            category_name: categoryName,
            name: document.querySelector('[data-field=collect-name]')?.value || '',
            quantity: parseInt(document.querySelector('[data-field=collect-qty]')?.value) || 1,
            estimated_value: parseFloat(document.querySelector('[data-field=collect-value]')?.value) || 0,
            notes: document.querySelector('[data-field=collect-notes]')?.value || '',
        };
        _saving = false;
        if (!data.name) return showToast('Item name is required', 'error');
        if (typeof addOtherCollectable === 'function') {
            await addOtherCollectable(data);
            const items = typeof fetchOtherCollectables === 'function' ? await fetchOtherCollectables() : [];
            if (typeof setOtherCollectables === 'function') setOtherCollectables(items);
            showToast('Item added', 'success');
            closeModal('modal-collect');
            setTimeout(() => openCollectablesModal(), 100);
        }
    }

    if (action === 'delete' && btn.dataset.type === 'collect') {
        const id = parseInt(btn.dataset.id);
        if (typeof deleteOtherCollectable === 'function') {
            await deleteOtherCollectable(id);
            const items = typeof fetchOtherCollectables === 'function' ? await fetchOtherCollectables() : [];
            if (typeof setOtherCollectables === 'function') setOtherCollectables(items);
            showToast('Deleted', 'info');
            closeModal('modal-collect');
            setTimeout(() => openCollectablesModal(), 100);
        }
    }
});


// ============================================================
// PRICING RULES MODAL (V1 feature)
// ============================================================

export function openPricingRulesModal() {
    var body = el('div', { style: 'display:flex;flex-direction:column;gap:12px;' });

    var info = el('div', { style: 'font-size:0.85rem;color:var(--color-text-muted);margin-bottom:8px;' },
        'Set base price (for regular coins) and key-date price (for scarcer dates). These values are used for portfolio estimates.'
    );
    body.appendChild(info);

    var rules = {};
    fetch('/api/pricing_rules').then(function(r){return r.json();}).then(function(data){
        rules = data || {};
        renderRules();
    }).catch(function(){ renderRules(); });

    function renderRules() {
        body.innerHTML = '';
        body.appendChild(info);

        fetch('/api/coins?limit=5000').then(function(r){return r.json();}).then(function(data){
            var coins = data.coins || data || [];
            var typeMap = {};
            coins.forEach(function(c) {
                var ct = c.coin_type || c.type || '';
                if (!typeMap[ct]) {
                    typeMap[ct] = {section: c.section || 'Other', denom: c.denomination || ''};
                }
            });

            var bySection = {};
            Object.keys(typeMap).forEach(function(ct) {
                var sec = typeMap[ct].section;
                if (!bySection[sec]) bySection[sec] = [];
                bySection[sec].push(ct);
            });

            var secNames = Object.keys(bySection).sort();

            secNames.forEach(function(sec) {
                var secDiv = el('div', { style: 'margin-bottom:16px;' });
                secDiv.appendChild(el('h4', { style: 'font-size:0.85em;font-weight:700;color:var(--color-accent);text-transform:uppercase;letter-spacing:0.06em;padding:4px 0 6px 0;border-bottom:2px solid var(--color-accent);margin-bottom:8px;' }, sec));

                var types = bySection[sec].sort();
                types.forEach(function(ct) {
                    var rule = rules[ct] || {};
                    var basePrice = rule.base_price != null ? rule.base_price : '';
                    var keyPrice = rule.key_price != null ? rule.key_price : '';

                    var row = el('div', { style: 'display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--color-border-light);' });
                    row.appendChild(el('span', { style: 'flex:1;font-size:0.82em;padding-right:8px;' }, ct));

                    var baseInput = el('input', { type:'number', step:'0.5', value: basePrice, placeholder:'Base $', style:'width:70px;padding:4px;font-size:0.75em;border-radius:4px;border:1px solid var(--color-border);background:var(--color-bg-body);color:var(--color-text-main);' });
                    var keyInput = el('input', { type:'number', step:'1.0', value: keyPrice, placeholder:'Key $', style:'width:70px;padding:4px;font-size:0.75em;border-radius:4px;border:1px solid var(--color-border);background:var(--color-bg-body);color:var(--color-text-main);' });

                    baseInput.addEventListener('change', function(){ saveRule(ct, 'base_price', baseInput); });
                    keyInput.addEventListener('change', function(){ saveRule(ct, 'key_price', keyInput); });

                    row.appendChild(baseInput);
                    row.appendChild(keyInput);
                    secDiv.appendChild(row);
                });
                body.appendChild(secDiv);
            });
        });
    }

    function saveRule(coinType, field, input) {
        var val = parseFloat(input.value) || 0;
        var data = { coin_type: coinType };
        data[field] = val;
        fetch('/api/pricing_rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(function(r){ return r.json(); }).then(function(){
            showToast('Pricing rule saved', 'success');
        }).catch(function(){
            showToast('Failed to save pricing rule', 'error');
        });
    }

    if (typeof createModal === 'function') {
        createModal('modal-pricing-rules', 'Pricing Rules', body, null);
    }
}

// ============================================================
// COMPLETION DASHBOARD (V1 feature)
// ============================================================

export function openCompletionDashboard() {
    var sections = getSections();

    var body = el('div', { style: 'display:flex;flex-direction:column;gap:12px;' });

    var statsDiv = el('div', { style: 'max-height:60vh;overflow-y:auto;' });
    body.appendChild(statsDiv);

    renderDashboard();

    function renderDashboard() {
        statsDiv.innerHTML = '';

        var totalTypes = 0, ownedTypes = 0;
        sections.forEach(function(sec) {
            totalTypes += sec.total || 0;
            ownedTypes += sec.owned || 0;
        });

        var pct = totalTypes > 0 ? (ownedTypes / totalTypes * 100) : 0;

        var overall = el('div', { style: 'margin-bottom:16px;' });
        overall.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;' },
            el('b', { style: 'font-size:1.05em;' }, 'Overall Collection'),
            el('span', { style: 'color:var(--color-accent);font-size:1.1em;font-weight:700;' }, pct.toFixed(1) + '%')
        ));
        var pw = el('div', { style: 'height:8px;background:var(--color-bg-body);border-radius:4px;overflow:hidden;' });
        var pb = el('div', { style: 'height:100%;width:' + pct + '%;background:var(--color-accent);border-radius:4px;transition:width 0.3s;' });
        pw.appendChild(pb);
        overall.appendChild(pw);
        overall.appendChild(el('div', { style: 'display:flex;justify-content:space-between;font-size:0.8em;color:var(--color-text-muted);margin-top:4px;' },
            el('span', {}, ownedTypes.toLocaleString() + ' / ' + totalTypes.toLocaleString() + ' types owned'),
            el('span', {}, (totalTypes - ownedTypes).toLocaleString() + ' still needed')
        ));
        statsDiv.appendChild(overall);

        var hr = el('hr', { style: 'border:none;border-top:1px solid var(--color-border-light);margin:12px 0;' });
        statsDiv.appendChild(hr);

        // Custom sort: US first (small→large), Canada second, then others
        var sectionOrder = {
            // US Coinage — small to large denominations
            'US Coinage — Half Cent': 101,
            'US Coinage — Large & Small Cent': 102,
            'US Coinage — Two Cent': 103,
            'US Coinage — Three Cent': 104,
            'US Coinage — Half Dime': 105,
            'US Coinage — Five Cent Nickel': 106,
            'US Coinage — Dime': 107,
            'US Coinage — Twenty Cent': 108,
            'US Coinage — Quarter Dollar': 109,
            'US Coinage — Half Dollar': 110,
            'US Coinage — Dollar': 111,
            'US Coinage — Trade Dollar': 112,
            // US Gold
            'US Gold — Circulation': 113,
            // US Bullion
            'US Bullion — Silver': 114,
            'US Bullion — Gold': 115,
            'US Bullion — Platinum & Palladium': 116,
            // US other
            'US Commemoratives': 117,
            'US Mint Sets & Proof Sets': 118,
            // Canadian Coinage — small to large
            'Canadian Coinage — Cent': 201,
            'Canadian Coinage — Five Cent': 202,
            'Canadian Coinage — Ten Cent': 203,
            'Canadian Coinage — Twenty-Five Cent': 204,
            'Canadian Coinage — Fifty Cent': 205,
            'Canadian Coinage — Dollar': 206,
            'Canadian Coinage — Two Dollar': 207,
        };
        sections.sort(function(a, b) {
            var orderA = sectionOrder[a.section] || 999;
            var orderB = sectionOrder[b.section] || 999;
            // Unknown sections go after known ones, sorted alphabetically
            if (orderA !== orderB) return orderA - orderB;
            return a.section.localeCompare(b.section);
        });

        sections.forEach(function(sec) {
            var sPctVal = sec.total > 0 ? (sec.owned / sec.total * 100) : 0;
            var secDiv = el('div', { style: 'margin-bottom:12px;' });

            var header = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;' });
            header.appendChild(el('span', { style: 'font-weight:600;font-size:0.9em;' }, sec.section));
            var pctColor = sPctVal >= 100 ? '#27ae60' : sPctVal >= 50 ? 'var(--color-accent)' : 'var(--color-text-muted)';
            header.appendChild(el('span', { style: 'color:' + pctColor + ';font-weight:600;' }, sPctVal.toFixed(1) + '% (' + sec.owned + '/' + sec.total + ')'));
            secDiv.appendChild(header);

            var spw = el('div', { style: 'height:6px;background:var(--color-bg-body);border-radius:3px;overflow:hidden;margin-top:4px;' });
            var spb = el('div', { style: 'height:100%;width:' + sPctVal + '%;background:' + pctColor + ';border-radius:3px;' });
            spw.appendChild(spb);
            secDiv.appendChild(spw);

            statsDiv.appendChild(secDiv);
        });
    }

    if (typeof createModal === 'function') {
        createModal('modal-completion-dashboard', 'Collection Completion', body, null);
    }
}

// ============================================================
// FILTER MISSING IMAGES (V1 feature)
// ============================================================

export function filterMissingImages() {
    window.dispatchEvent(new CustomEvent('cc-filter-missing-images'));
    showToast('Filtering: coins missing images...', 'info');

    fetch('/api/coins?limit=5000').then(function(r){return r.json();}).then(function(data){
        var coins = data.coins || data || [];
        var missing = 0, total = coins.length;

        var promises = coins.slice(0, 200).map(function(c) {
            return fetch('/api/coins/' + c.id).then(function(r){return r.json();}).then(function(d){
                if (!d.obv_image && !d.rev_image) missing++;
            }).catch(function(){});
        });

        Promise.all(promises).then(function(){
            var body = el('div', { style: 'text-align:center;padding:20px;' });
            body.appendChild(el('h3', { style: 'margin-bottom:12px;' }, 'Image Coverage'));
            body.appendChild(el('div', { style: 'font-size:2em;font-weight:700;color:var(--color-accent);' }, total > 0 ? ((total - missing) / total * 100).toFixed(0) + '%' : 'N/A'));
            body.appendChild(el('p', { style: 'color:var(--color-text-muted);margin-top:8px;' }, (total - missing) + ' of ' + total + ' coins have reference images'));
            body.appendChild(el('p', { style: 'color:var(--color-text-muted);font-size:0.85em;' }, missing + ' coins still need images'));

            if (typeof createModal === 'function') {
                createModal('modal-image-coverage', 'Image Coverage', body, null);
            }
        });
    });
}

// ============================================================
// EXPORT & BACKUP MODAL
// ============================================================

/**
 * openExportModal — Dedicated dashboard for all export/import operations.
 *
 * Features:
 *  1. Export CSV       — streams full catalog as CSV via API
 *  2. Download Template — generates a blank CSV template client-side
 *  3. Backup JSON      — downloads full database backup as JSON
 *  4. Restore JSON     — uploads a JSON backup to restore
 *  5. Import CSV       — uploads a CSV file to import coins
 *
 * All scroll/overflow is contained within the modal body.
 * No global html/body overflow properties are modified.
 */
export function openExportModal() {
    const sections = getSections();
    const inventory = getInventory();

    // Compute stats for display
    const totalTypes = sections.reduce((s, sec) => s + (sec.total || 0), 0);
    const ownedTypes = sections.reduce((s, sec) => s + (sec.owned || 0), 0);
    const invEntries = Object.values(inventory).flat();
    const totalInvItems = invEntries.reduce((s, e) => s + (e.quantity || 0), 0);

    const body = el('div', { style: 'display:flex; flex-direction:column; gap:var(--space-4);' });

    // --- Stats summary ---
    const statsSection = el('div', { className: 'export-section' });
    statsSection.appendChild(el('h4', {}, ' Collection Summary'));
    const statsGrid = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:6px;' });
    [
        { label: 'Coin Types', value: totalTypes.toLocaleString() },
        { label: 'Owned', value: ownedTypes.toLocaleString() },
        { label: 'Inventory Items', value: totalInvItems.toLocaleString() },
        { label: 'Sections', value: sections.length.toString() },
    ].forEach(item => {
        const cell = el('div', { style: 'background:var(--color-accord-bg);border-radius:var(--radius-sm);padding:6px 10px;' });
        cell.appendChild(el('div', { style: 'font-size:0.72em;color:var(--color-text-muted);' }, item.label));
        cell.appendChild(el('div', { style: 'font-weight:700;font-size:0.95em;color:var(--color-text-main);' }, item.value));
        statsGrid.appendChild(cell);
    });
    statsSection.appendChild(statsGrid);
    body.appendChild(statsSection);

    // --- Export section ---
    const exportCsvSection = el('div', { className: 'export-section' });
    exportCsvSection.appendChild(el('h4', {}, ' Export Data'));
    const exportRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;' });

    // Export CSV button
    const exportCsvBtn = el('button', { className: 'btn-primary', style: 'flex:1;min-width:140px;' }, ' Export CSV');
    exportCsvBtn.onclick = async () => {
        exportCsvBtn.disabled = true;
        exportCsvBtn.textContent = '⏳ Exporting...';
        try {
            const resp = await fetch('/api/backup/csv');
            if (!resp.ok) throw new Error('Export failed: ' + resp.statusText);
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'coin-catalog-export-' + new Date().toISOString().slice(0, 10) + '.csv';
            a.click();
            URL.revokeObjectURL(url);
            showToast('CSV exported successfully', 'success');
        } catch (err) {
            // Fallback: try /api/backup/full as CSV
            try {
                const resp2 = await fetch('/api/backup/full');
                const text = await resp2.text();
                // Check if it's JSON (the full backup endpoint returns JSON)
                try { JSON.parse(text); } catch { /* not JSON, treat as CSV */ }
                const blob = new Blob([text], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'coin-catalog-export-' + new Date().toISOString().slice(0, 10) + '.csv';
                a.click();
                URL.revokeObjectURL(url);
                showToast('CSV exported successfully', 'success');
            } catch (err2) {
                showToast('Export failed: ' + err.message, 'error');
            }
        }
        exportCsvBtn.disabled = false;
        exportCsvBtn.textContent = ' Export CSV';
    };
    exportRow.appendChild(exportCsvBtn);

    // Download Blank CSV Template button (frontend-only, Option B)
    const templateBtn = el('button', { className: 'btn-secondary', style: 'flex:1;min-width:140px;' }, '📄 Blank CSV Template');
    templateBtn.onclick = () => {
        const headers = [
            'id', 'country', 'section', 'type', 'year', 'mintmark',
            'grade', 'purchase_price', 'current_value', 'notes',
            'is_error', 'is_proof', 'has_photo'
        ];
        // Build CSV content with header row + 2 example rows
        const exampleRow1 = ['', 'US', 'Lincoln Cents', 'Wheat Reverse', '1943', 'D', 'AU', '0.50', '2.00', 'Steel cent', 'false', 'false', 'false'];
        const exampleRow2 = ['', 'US', 'Lincoln Cents', 'Memorial Reverse', '1972', '', 'MS-65', '0.05', '1.50', 'Doubled die obverse', 'true', 'false', 'false'];
        const csvContent = [
            headers.join(','),
            exampleRow1.join(','),
            exampleRow2.join(',')
        ].join('\n') + '\n';

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'coin-catalog-template.csv';
        a.click();
        URL.revokeObjectURL(url);
        showToast('CSV template downloaded', 'success');
    };
    exportRow.appendChild(templateBtn);

    exportCsvSection.appendChild(exportRow);
    body.appendChild(exportCsvSection);

    // --- Backup / Restore section ---
    const backupSection = el('div', { className: 'export-section' });
    backupSection.appendChild(el('h4', {}, ' Backup & Restore'));
    const backupRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;' });

    // Backup JSON
    const backupBtn = el('button', { className: 'btn-secondary', style: 'flex:1;min-width:120px;' }, ' Backup JSON');
    backupBtn.onclick = async () => {
        backupBtn.disabled = true;
        backupBtn.textContent = '⏳ Backing up...';
        try {
            const resp = await fetch('/api/backup/full');
            if (!resp.ok) throw new Error('Backup failed: ' + resp.statusText);
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'coin-catalog-backup-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            showToast('Backup downloaded', 'success');
        } catch (err) {
            showToast('Backup failed: ' + err.message, 'error');
        }
        backupBtn.disabled = false;
        backupBtn.textContent = ' Backup JSON';
    };
    backupRow.appendChild(backupBtn);

    // Restore JSON
    const restoreLabel = el('label', { className: 'btn-secondary', style: 'flex:1;min-width:120px;cursor:pointer;text-align:center;' }, ' Restore JSON');
    const restoreInput = el('input', { type: 'file', accept: '.json', style: 'display:none;' });
    restoreInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const resp = await fetch('/api/backup/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!resp.ok) throw new Error('Restore failed: ' + resp.statusText);
            showToast('Restore successful — refresh the page', 'success', 5000);
            setTimeout(() => location.reload(), 2000);
        } catch (err) {
            showToast('Restore failed: ' + err.message, 'error');
        }
        restoreInput.value = '';
    };
    restoreLabel.appendChild(restoreInput);
    restoreLabel.onclick = () => restoreInput.click();
    backupRow.appendChild(restoreLabel);

    backupSection.appendChild(backupRow);
    body.appendChild(backupSection);

    // --- Import section ---
    const importSection = el('div', { className: 'export-section' });
    importSection.appendChild(el('h4', {}, ' Import'));
    const importRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;' });

    // Import CSV
    const importBtn = el('button', { className: 'btn-secondary', style: 'flex:1;min-width:120px;' }, ' Import CSV');
    importBtn.onclick = async () => {
        const input = el('input', { type: 'file', accept: '.csv', style: 'display:none;' });
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const resp = await fetch('/api/backup/import_csv', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/csv' },
                    body: text
                });
                if (!resp.ok) throw new Error('Import failed');
                showToast('CSV import started — check back in a moment', 'success', 5000);
            } catch (err) {
                showToast('Import failed: ' + err.message, 'error');
            }
        };
        input.click();
    };
    importRow.appendChild(importBtn);

    // Coin Image Bank (kept for convenience)
    const imgMgrBtn = el('button', { className: 'btn-secondary', style: 'flex:1;min-width:120px;' }, ' Coin Image Bank');
    imgMgrBtn.onclick = () => {
        closeModal('modal-export');
        setTimeout(() => openImageManager(), 150);
    };
    importRow.appendChild(imgMgrBtn);

    // Print Checklist (kept for convenience)
    const printBtn = el('button', { className: 'btn-secondary', style: 'flex:1;min-width:120px;' }, ' Print Checklist');
    printBtn.onclick = () => {
        closeModal('modal-export');
        setTimeout(() => openPrintChecklist(), 150);
    };
    importRow.appendChild(printBtn);

    importSection.appendChild(importRow);
    body.appendChild(importSection);

    // --- Footer ---
    const footer = el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:4px;' });
    const closeBtn = el('button', { className: 'btn-secondary' }, 'Close');
    closeBtn.onclick = () => closeModal('modal-export');
    footer.appendChild(closeBtn);

    createModal('modal-export', ' Export & Backup', body, footer);
}

