/** 
 * COIN + COLLECTABLE CATALOG V2 - MODULE: MODALS.JS
 * Core Overlay Orchestration and Lifecycle Manager
 * 
 * Provides:
 *  - New orchestrator: registerModal, openModal, closeModal, dismissAllModals
 *  - Legacy stack-based API: openModalLegacy, closeModalLegacy, closeAllModals
 *  - All modal content functions: settings, help, export, stories, scrap, paper,
 *    collectables, pricing, completion, image manager, print checklist, theme designer
 * 
 * @module modals
 */

import { el, escHtml } from './utils.js';
import { showToast } from './notifications.js';
import { getSections, getInventory, getSpotPrices, purgeUserInventoryTables } from './state.js';
import { saveCustomTheme } from './themes.js';

// ============================================================
// NEW ORCHESTRATOR — used by cards.js, stories.js, info.js
// ============================================================

const activeModals = new Set();

function getBackdrop() {
    let backdrop = document.getElementById('modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'modal-backdrop';
        backdrop.className = 'modal-backdrop fade-out';
        backdrop.addEventListener('click', dismissAllModals);
        document.body.appendChild(backdrop);
    }
    return backdrop;
}

export function registerModal(modalId, element) {
    if (!element) return;
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-hidden', 'true');
    element.classList.add('modal-window-wrapper', 'is-dismissed');
}

export function openModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return console.error(`[modals] Target container #${modalId} not found.`);
    const backdrop = getBackdrop();
    backdrop.classList.remove('fade-out');
    backdrop.classList.add('fade-in');
    modalEl.classList.remove('is-dismissed');
    modalEl.setAttribute('aria-hidden', 'false');
    activeModals.add(modalId);
}

export function closeModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;
    modalEl.classList.add('is-dismissed');
    modalEl.setAttribute('aria-hidden', 'true');
    activeModals.delete(modalId);
    if (activeModals.size === 0) {
        const backdrop = getBackdrop();
        backdrop.classList.remove('fade-in');
        backdrop.classList.add('fade-out');
    }
}

export function dismissAllModals() {
    activeModals.forEach(modalId => closeModal(modalId));
}

// Global Keyboard Trap
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.keyCode === 27) {
        dismissAllModals();
        if (typeof closeAllModals === 'function') closeAllModals();
    }
});

// ============================================================
// LEGACY STACK-BASED API (used by images.js, inventory.js)
// ============================================================

let openModalsStack = [];

function updateBodyScrollLock() {
    if (openModalsStack.length > 0) {
        document.body.classList.add('modal-open');
    } else {
        document.body.classList.remove('modal-open');
    }
}

export function openModalLegacy(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) { console.error('[modals] Modal not found:', modalId); return; }
    if (openModalsStack.includes(modalId)) return;
    modal.classList.add('open');
    openModalsStack.push(modalId);
    updateBodyScrollLock();
}

export function closeModalLegacy(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('open');
    openModalsStack = openModalsStack.filter(id => id !== modalId);
    updateBodyScrollLock();
}

export function closeAllModals() {
    openModalsStack.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('open');
    });
    openModalsStack = [];
    updateBodyScrollLock();
}

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        closeModalLegacy(e.target.id);
    }
});

document.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'close-modal') {
        const modal = e.target.closest('.modal-overlay');
        if (modal) { closeModalLegacy(modal.id); }
    }
});

window.closeModals = closeAllModals;

// ============================================================
// SHARED MODAL HELPERS
// ============================================================

export function createModal(id, title, bodyContent, extra) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const overlay = el('div', {
        id, className: 'modal-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
    });
    const modalClass = (typeof extra === 'string' && !extra.includes('<') && !extra.appendChild)
        ? 'modal-box ' + extra.replace(/<[^>]*>/g, '') : 'modal-box';
    const box = el('div', { className: modalClass });
    const header = el('div', { className: 'modal-header' });
    header.appendChild(el('h2', { className: 'modal-title' }, title));
    header.appendChild(el('button', { className: 'modal-close', dataset: { action: 'close-modal' }, 'aria-label': 'Close' }, '\\u2715'));
    box.appendChild(header);
    const body = el('div', { className: 'modal-body' });
    if (typeof bodyContent === 'string') { body.innerHTML = bodyContent; } else if (bodyContent) { body.appendChild(bodyContent); }
    box.appendChild(body);
    if (extra && !(typeof extra === 'string' && !extra.includes('<') && !extra.appendChild)) {
        const footer = el('div', { className: 'modal-footer' });
        if (typeof extra === 'string') { footer.innerHTML = extra; } else { footer.appendChild(extra); }
        box.appendChild(footer);
    }
    overlay.appendChild(box);
    document.getElementById('modal-layer')?.appendChild(overlay);
    overlay.classList.add('open');
    document.body.classList.add('modal-open');
    if (!openModalsStack.includes(id)) { openModalsStack.push(id); }
    return overlay;
}

let cardVisibility = JSON.parse(localStorage.getItem('cc-card-visibility') || '{}');

function saveCardVisibility() {
    localStorage.setItem('cc-card-visibility', JSON.stringify(cardVisibility));
}

export function openVisibilityModal() {
    const modal = document.getElementById('visibility-modal');
    const list = document.getElementById('visibility-toggles');
    if (!modal || !list) return;
    list.innerHTML = '';

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

    // Get all sections from the DOM
    const sectionCards = document.querySelectorAll('.section-card');
    sectionCards.forEach(card => {
        const secName = card.dataset.section || card.querySelector('.section-title')?.textContent || 'Unknown';
        const secId = 'section-' + secName.replace(/[^a-zA-Z0-9]/g, '');
        const checked = cardVisibility[secId] !== false ? 'checked' : '';
        html += `<label style="display:flex;align-items:center;gap:8px;font-size:0.85em;cursor:pointer;padding:4px 0;">
            <input type="checkbox" data-vis-id="${secId}" ${checked} style="width:14px;height:14px;margin:0;flex-shrink:0;" onchange="toggleCoinSection('${secId}', this.checked)">
            <span>${secName}</span>
        </label>`;
    });
    html += '</div>';

    list.innerHTML = html;
    openModalLegacy('visibility-modal');
}

export function closeVisibilityModal() {
    closeModalLegacy('visibility-modal');
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
    // Show/hide the section card
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
};

// ============================================================
// PROFESSIONAL SETTINGS MODAL — Tabbed Interface
// ============================================================

export function openSettingsModal() {
    const currentTheme = localStorage.getItem('cc-theme') || 'dark';
    const currentFolderColor = localStorage.getItem('cc-folder-color') || 'green';
    const currentSort = localStorage.getItem('cc-sort') || 'default';
    const hideProofs = localStorage.getItem('cc-hide-proofs') === 'true';
    const hideErrors = localStorage.getItem('cc-hide-errors') === 'true';
    const keyDatesOnly = localStorage.getItem('cc-key-dates-only') === 'true';

    const body = el('div', { className: 'settings-modal-body' });

    // --- Tab Navigation ---
    const tabBar = el('div', { className: 'settings-tab-bar', role: 'tablist' });
    const tabs = [
        { id: 'tab-general', label: 'General', icon: '⚙' },
        { id: 'tab-appearance', label: 'Appearance', icon: '' },
        { id: 'tab-catalog', label: 'Catalog', icon: '' },
        { id: 'tab-data', label: 'Data & Backup', icon: '' },
        { id: 'tab-advanced', label: 'Advanced', icon: '' },
    ];
    const tabPanels = el('div', { className: 'settings-tab-panels' });

    tabs.forEach((tab, idx) => {
        const btn = el('button', {
            role: 'tab',
            id: tab.id,
            className: `settings-tab-btn ${idx === 0 ? 'active' : ''}`,
            'aria-controls': `${tab.id}-panel`,
            'aria-selected': idx === 0 ? 'true' : 'false',
            tabindex: idx === 0 ? '0' : '-1',
        }, `${tab.icon} ${tab.label}`);
        btn.addEventListener('click', () => switchSettingsTab(tab.id));
        tabBar.appendChild(btn);

        const panel = el('div', {
            role: 'tabpanel',
            id: `${tab.id}-panel`,
            className: `settings-tab-panel ${idx === 0 ? 'active' : ''}`,
            'aria-labelledby': tab.id,
            hidden: idx !== 0,
        });
        tabPanels.appendChild(panel);
    });

    body.appendChild(tabBar);
    body.appendChild(tabPanels);

    // --- Tab Content Builders ---
    function buildGeneralTab(panel) {
        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, ' General'),
            el('p', { className: 'settings-section-desc' }, 'Core application behavior and defaults.'),
            buildSettingRow('Default Sort Order', 'settings-sort', 'select', {
                options: [
                    { value: 'default', label: 'Default (Year → Mint)' },
                    { value: 'az', label: 'Alphabetical (A–Z)' },
                    { value: 'value-desc', label: 'Value (High → Low)' },
                    { value: 'completion', label: 'Completion %' },
                ],
                value: currentSort,
                onchange: (v) => { localStorage.setItem('cc-sort', v); dispatchSettingsChange('sort', v); },
            }),
            buildSettingRow('Theme', 'settings-theme', 'select', {
                options: [
                    { value: 'dark', label: 'Dark' }, { value: 'midnight', label: 'Midnight' },
                    { value: 'gold', label: 'Gold' }, { value: 'copper', label: 'Copper' },
                    { value: 'ocean', label: 'Ocean' }, { value: 'forest', label: 'Deep Forest' },
                    { value: 'cyberpunk', label: 'Cyberpunk' }, { value: 'neon', label: 'Neon' },
                    { value: 'matrix', label: 'Matrix' }, { value: 'light', label: 'Light' },
                    { value: 'silver', label: 'Silver' }, { value: 'paper', label: 'Aged Paper' },
                ],
                value: currentTheme,
                onchange: (v) => { localStorage.setItem('cc-theme', v); setTheme(v); },
            }),
        ]));
    }

    function buildAppearanceTab(panel) {
        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, ' Album Page Color'),
            el('p', { className: 'settings-section-desc' }, 'Background color for the album view folders.'),
            buildSettingRow('Folder Background', 'settings-folder-color', 'select', {
                options: [
                    { value: 'green', label: 'Green (Classic)' }, { value: 'blue', label: 'Blue' },
                    { value: 'brown', label: 'Brown' }, { value: 'black', label: 'Black' },
                    { value: 'purple', label: 'Purple' }, { value: 'red', label: 'Red' },
                    { value: 'gray', label: 'Gray' },
                ],
                value: currentFolderColor,
                onchange: (v) => applyFolderColor(v),
            }),
        ]));

        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, ' Custom Theme Designer'),
            el('p', { className: 'settings-section-desc' }, 'Create your own color scheme with live preview.'),
            el('button', { className: 'btn-primary', style: 'width:100%;', onclick: () => { closeModal('modal-settings'); setTimeout(() => openCustomThemeDesigner(1), 150); } },
                ' Open Custom Theme Designer'
            ),
        ]));

        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, '👁 Dashboard Card Visibility'),
            el('p', { className: 'settings-section-desc' }, 'Show or hide entire dashboard cards.'),
            ...buildCardVisibilityRows(),
        ]));
    }

    function buildCatalogTab(panel) {
        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, ' Display Filters'),
            el('p', { className: 'settings-section-desc' }, 'Control which coins appear in the catalog. Changes apply on next load.'),
            [
                { key: 'cc-hide-proofs', label: 'Hide proof coins', checked: hideProofs },
                { key: 'cc-hide-errors', label: 'Hide error/variety coins', checked: hideErrors },
                { key: 'cc-key-dates-only', label: 'Key dates only', checked: keyDatesOnly },
            ].map(f => buildToggleRow(f.label, f.key, f.checked)),
            el('p', { className: 'settings-section-desc' }, 'Show/hide metal rows in the Bullion Holdings card.'),
            buildBullionVisibilityRows()
        ]));
    }

    function buildDataTab(panel) {
        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, ' Export & Backup'),
            el('p', { className: 'settings-section-desc' }, 'Download your collection data for safekeeping or migration.'),
            buildActionRow([
                { label: ' Export CSV', onclick: () => window.location.href = '/api/backup/full', className: 'btn-secondary' },
                { label: ' Backup JSON', onclick: backupJSON, className: 'btn-secondary' },
            ]),
        ]));

        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, ' Import & Restore'),
            el('p', { className: 'settings-section-desc' }, 'Restore from a previous backup or import CSV data.'),
            buildActionRow([
                { label: ' Restore JSON', onclick: () => restoreInput.click(), className: 'btn-secondary' },
                { label: ' Import CSV', onclick: () => importInput.click(), className: 'btn-secondary' },
            ]),
            createHiddenFileInput('restoreInput', '.json', restoreJSON),
            createHiddenFileInput('importInput', '.csv', importCSV),
        ]));
    }

    function buildAdvancedTab(panel) {
        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, ' Advanced Tools'),
            el('p', { className: 'settings-section-desc' }, 'Power-user features for pricing, completion, and images.'),
            buildActionRow([
                { label: ' Edit Pricing Rules', onclick: () => { closeModal('modal-settings'); setTimeout(() => openPricingRulesModal(), 150); }, className: 'btn-secondary' },
                { label: ' View Completion Dashboard', onclick: () => { closeModal('modal-settings'); setTimeout(() => openCompletionDashboard(), 150); }, className: 'btn-secondary' },
                { label: ' Find Missing Images', onclick: () => { closeModal('modal-settings'); setTimeout(() => filterMissingImages(), 150); }, className: 'btn-secondary' },
                { label: ' Coin Image Bank', onclick: openImageManager, className: 'btn-secondary' },
                { label: ' Print Checklist', onclick: openPrintChecklist, className: 'btn-secondary' },
            ], true)
        ]));

        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, '⚠ Danger Zone'),
            el('p', { className: 'settings-section-desc' }, 'Irreversible actions. Use with caution.'),
            buildActionRow([
                { label: ' Purge All Inventory', onclick: purgeInventory, className: 'btn-danger' }
            ], true)
        ]));
    }

    // Initialize first tab
    buildGeneralTab(tabPanels.children[0]);
    buildAppearanceTab(tabPanels.children[1]);
    buildCatalogTab(tabPanels.children[2]);
    buildDataTab(tabPanels.children[3]);
    buildAdvancedTab(tabPanels.children[4]);

    // Footer
    const footer = el('div', { className: 'settings-footer' });
    footer.appendChild(el('span', { className: 'text-muted', style: 'font-size:0.75rem;' },
        'Filter and sort changes apply on next catalog load. Theme changes are instant.'
    ));

    createModal('modal-settings', '⚙ Settings', body, footer);
}

// --- Tab Switching ---
function switchSettingsTab(tabId) {
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        const isActive = btn.id === tabId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive);
        btn.tabIndex = isActive ? 0 : -1;
    });
    document.querySelectorAll('.settings-tab-panel').forEach(panel => {
        const isActive = panel.id === `${tabId}-panel`;
        panel.classList.toggle('active', isActive);
        panel.hidden = !isActive;
    });
}

// --- Helper Builders ---
function buildSettingRow(label, id, type, config) {
    const row = el('div', { className: 'settings-row' });
    row.appendChild(el('label', { htmlFor: id }, label));
    if (type === 'select') {
        const select = el('select', { id, className: 'form-input' });
        config.options.forEach(opt => {
            select.appendChild(el('option', { value: opt.value, selected: opt.value === config.value }, opt.label));
        });
        select.onchange = () => config.onchange(select.value);
        row.appendChild(select);
    }
    return row;
}

function buildToggleRow(label, key, checked) {
    const row = el('div', { className: 'settings-row' });
    const labelEl = el('label', { style: 'display:flex; align-items:center; gap:var(--space-2); cursor:pointer; flex:1;' });
    const cb = el('input', { type: 'checkbox', checked, style: 'width:18px; height:18px; flex-shrink:0;' });
    cb.onchange = () => {
        localStorage.setItem(key, cb.checked);
        dispatchSettingsChange(key, cb.checked);
        showToast(`${label} ${cb.checked ? 'enabled' : 'disabled'}`, 'info');
    };
    labelEl.appendChild(cb);
    labelEl.appendChild(document.createTextNode(label));
    row.appendChild(labelEl);
    return row;
}

function buildCardVisibilityRows() {
    const cards = [
        { id: 'card-portfolio', label: 'Portfolio Value', desc: 'Total portfolio, melt values, premium' },
        { id: 'card-spot', label: 'Live Spot Prices', desc: 'Gold, silver, copper, platinum, palladium' },
        { id: 'card-bullion', label: 'Bullion Holdings', desc: 'Metal weight entry and valuation' },
        { id: 'card-coinweight', label: 'Coins by Weight', desc: 'Bulk coin weight logging with value calc' },
        { id: 'card-history', label: 'Portfolio History', desc: 'Historical value chart' },
        { id: 'card-scrap', label: 'Scrap Metal', desc: 'Scrap metal entries and melt estimate' },
        { id: 'card-paper', label: 'Paper Currency', desc: 'Paper currency entries and value' },
        { id: 'card-search', label: 'Search Bar', desc: 'Full-text search and year filters' },
    ];
    return cards.map(card => {
        const row = el('div', { className: 'settings-row' });
        const label = el('label', { htmlFor: `vis-${card.id}`, style: 'display:flex; align-items:center; gap:var(--space-2); cursor:pointer; flex:1;' });
        const isChecked = cardVisibility[card.id] !== false;
        const cb = el('input', { type: 'checkbox', id: `vis-${card.id}`, checked: isChecked, style: 'width:18px; height:18px; flex-shrink:0;' });
        cb.onchange = () => {
            const elCard = document.getElementById(card.id);
            if (elCard) elCard.style.display = cb.checked ? '' : 'none';
            const grid = document.getElementById('dashboard-grid');
            if (grid) grid.querySelectorAll(`[data-card-id="${card.id}"]`).forEach(c => c.style.display = cb.checked ? '' : 'none');
            cardVisibility[card.id] = cb.checked;
            saveCardVisibility();
        };
        label.appendChild(cb);
        const textWrap = el('div', {});
        textWrap.appendChild(el('div', { style: 'font-weight:600; font-size:0.9rem;' }, card.label));
        textWrap.appendChild(el('div', { style: 'font-size:0.75rem; color:var(--color-text-muted);' }, card.desc));
        label.appendChild(textWrap);
        row.appendChild(label);
        return row;
    });
}

function buildBullionVisibilityRows() {
    var bullionVis = {};
    try { bullionVis = JSON.parse(localStorage.getItem('cc-bullion-vis') || '{}'); } catch(e) {}
    const metals = [
        { id: 'gold', label: '🥇 Gold' }, { id: 'silver', label: '🥈 Silver' },
        { id: 'copper', label: '🟤 Copper' }, { id: 'platinum', label: '⚪ Platinum' },
        { id: 'palladium', label: '⚪ Palladium' },
    ];
    return metals.map(function(m) {
        var row = el('div', { className: 'settings-row' });
        var labelEl = el('label', { style: 'display:flex;align-items:center;gap:var(--space-2);cursor:pointer;flex:1;' });
        var cb = el('input', { type: 'checkbox', checked: bullionVis[m.id] !== false, style: 'width:18px;height:18px;flex-shrink:0;' });
        cb.onchange = function() {
            bullionVis[m.id] = cb.checked;
            localStorage.setItem('cc-bullion-vis', JSON.stringify(bullionVis));
            dispatchSettingsChange('bullion-vis', JSON.stringify(bullionVis));
            showToast((cb.checked ? 'Showing' : 'Hiding') + ' ' + m.label + ' in spot/bullion cards', 'info');
        };
        labelEl.appendChild(cb);
        labelEl.appendChild(document.createTextNode(m.label));
        row.appendChild(labelEl);
        return row;
    });
}

function buildActionRow(actions, wrap = false) {
    const row = el('div', { className: 'settings-row', style: 'gap:var(--space-2); flex-wrap:wrap;' });
    actions.forEach(a => {
        const btn = el('button', { className: a.className || 'btn-secondary', onclick: a.onclick }, a.label);
        row.appendChild(btn);
    });
    if (wrap) row.style.width = '100%';
    return row;
}

function createHiddenFileInput(varName, accept, handler) {
    const input = el('input', { type: 'file', accept, style: 'display:none;', id: varName });
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            await handler(file);
            showToast('Operation successful', 'success');
        } catch (err) {
            showToast(`Failed: ${err.message}`, 'error');
        }
        input.value = '';
    };
    window[varName] = input;
    document.body.appendChild(input); // Keep reference
    return input;
}

async function backupJSON() {
    const resp = await fetch('/api/backup/full');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coin-catalog-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function restoreJSON(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    const resp = await fetch('/api/backup/restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    if (!resp.ok) throw new Error('Restore failed: ' + resp.statusText);
    showToast('Restore successful — refresh the page', 'success', 5000);
    setTimeout(() => location.reload(), 2000);
}

async function importCSV(file) {
    const text = await file.text();
    const resp = await fetch('/api/backup/import_csv', {
        method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text
    });
    if (!resp.ok) throw new Error('Import failed');
    showToast('CSV import started — check back in a moment', 'success', 5000);
}

async function purgeInventory() {
    if (!confirm('This will DELETE ALL inventory entries. This cannot be undone. Continue?')) return;
    if (!confirm('Last chance: Are you absolutely sure?')) return;
    await purgeUserInventoryTables();
    showToast('All inventory purged', 'success');
    location.reload();
}

function dispatchSettingsChange(key, value) {
    window.dispatchEvent(new CustomEvent('cc-settings-changed', { detail: { key, value } }));
}

function applyFolderColor(v) {
    localStorage.setItem('cc-folder-color', v);
    const fcMap = { green:'#2d4a2d', blue:'#2d3a4a', red:'#4a2d2d', brown:'#4a3d2d', black:'#1a1a1a', purple:'#3d2d4a', gray:'#3a3a3a' };
    const ftMap = { green:'#c9a227', blue:'#7db3d8', red:'#e8a0a0', brown:'#d4a574', black:'#888888', purple:'#c9a0d4', gray:'#aaaaaa' };
    const fcVal = fcMap[v] || fcMap.green;
    const ftVal = ftMap[v] || ftMap.green;
    document.querySelectorAll('.album-inline').forEach(a => {
        a.style.background = fcVal;
        a.style.setProperty('--folder-color', fcVal);
        a.style.setProperty('--folder-header-text', ftVal);
        a.style.setProperty('--folder-label', ftVal);
    });
    showToast('Album color updated', 'info');
}

// ============================================================
// INFO / HELP MODAL — Professional Interface
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

    const body = el('div', { className: 'info-modal-body' });

    // --- App info section ---
    const infoSection = el('div', { className: 'info-section' });
    infoSection.appendChild(el('h3', { className: 'info-section-title' }, 'ℹ About Coin Catalog v2'));
    const version = window.APP_VERSION || 'dev';
    infoSection.appendChild(el('p', { className: 'info-text' }, `Coin Catalog v2 — ${version}`));
    infoSection.appendChild(el('p', { className: 'info-text' }, 'A self-hosted coin collection tracker with live metal prices, album view, and inventory management.'));
    body.appendChild(infoSection);

    // --- Collection stats section ---
    const statsSection = el('div', { className: 'info-section' });
    statsSection.appendChild(el('h3', { className: 'info-section-title' }, ' Collection Stats'));
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
    if (prices.copper_lb) {
        statItems.push({ label: 'Copper', value: '$' + prices.copper_lb.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '/lb' });
    }
    if (prices.platinum_oz) {
        statItems.push({ label: 'Platinum', value: '$' + prices.platinum_oz.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '/oz' });
    }
    if (prices.palladium_oz) {
        statItems.push({ label: 'Palladium', value: '$' + prices.palladium_oz.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '/oz' });
    }

    statItems.forEach(item => {
        const card = el('div', { className: 'stat-card' });
        card.appendChild(el('div', { className: 'stat-value' }, item.value));
        card.appendChild(el('div', { className: 'stat-label' }, item.label));
        statsGrid.appendChild(card);
    });

    statsSection.appendChild(statsGrid);
    body.appendChild(statsSection);

    // --- Keyboard shortcuts section ---
    const shortcutSection = el('div', { className: 'info-section' });
    shortcutSection.appendChild(el('h3', { className: 'info-section-title' }, '⌨ Keyboard Shortcuts'));
    const shortcuts = [
        { key: 'Ctrl+F / Cmd+F', desc: 'Focus search bar' },
        { key: 'Escape', desc: 'Close modal / Clear search' },
        { key: 'Ctrl+Shift+R', desc: 'Hard refresh (clear cache)' },
        { key: 'F5', desc: 'Refresh page' },
        { key: 'Ctrl+Shift+C', desc: 'Open developer console' },
    ];
    const shortcutsList = el('div', { className: 'shortcuts-list' });
    shortcuts.forEach(s => {
        const row = el('div', { className: 'shortcut-row' });
        row.appendChild(el('kbd', { className: 'shortcut-key' }, s.key));
        row.appendChild(el('span', { className: 'shortcut-desc' }, s.desc));
        shortcutsList.appendChild(row);
    });
    shortcutSection.appendChild(shortcutsList);
    body.appendChild(shortcutSection);

    // --- Tips section ---
    const tipsSection = el('div', { className: 'info-section' });
    tipsSection.appendChild(el('h3', { className: 'info-section-title' }, ' Tips'));
    const tips = [
        'Click a coin hole in album view to add it to your inventory',
        'Right-click a coin for quick actions (edit, delete, view details)',
        'Use the search bar to filter by year, type, mint mark, or keywords',
        'Upload images at the type level (applies to all coins) or per-coin basis',
        'Check the dashboard for live metal prices and portfolio value',
        'Export your data regularly via Settings → Data & Backup',
        'Use custom themes to personalize the app appearance',
    ];
    const tipsList = el('ul', { className: 'tips-list' });
    tips.forEach(t => {
        tipsList.appendChild(el('li', {}, t));
    });
    tipsSection.appendChild(tipsList);
    body.appendChild(tipsSection);

    // --- Technical info section ---
    const techSection = el('div', { className: 'info-section' });
    techSection.appendChild(el('h3', { className: 'info-section-title' }, ' Technical Info'));
    const techGrid = el('div', { className: 'tech-grid' });
    const techItems = [
        { label: 'Framework', value: 'Vanilla JS + Web Components' },
        { label: 'Storage', value: 'LocalStorage + IndexedDB' },
        { label: 'API', value: 'RESTful (JSON)' },
        { label: 'PWA', value: 'Progressive Web App' },
        { label: 'Responsive', value: 'Mobile-first design' },
    ];
    techItems.forEach(item => {
        const card = el('div', { className: 'tech-card' });
        card.appendChild(el('div', { className: 'tech-value' }, item.value));
        card.appendChild(el('div', { className: 'tech-label' }, item.label));
        techGrid.appendChild(card);
    });
    techSection.appendChild(techGrid);
    body.appendChild(techSection);

    createModal('modal-help', 'ℹ Info & Help', body, null);
}
export function openScrapMetalModal() { openModal('modal-scrapmetalmodal'); }
export function openPaperCurrencyModal() { openModal('modal-papercurrencymodal'); }
export function openCollectablesModal() { openModal('modal-collectablesmodal'); }
