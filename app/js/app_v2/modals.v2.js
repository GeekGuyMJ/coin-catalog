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

import { el, escHtml } from './utils.js?v=4';
import { showToast } from './notifications.js?v=4';
import { getSections, getInventory, getSpotPrices, purgeUserInventoryTables, getTypeConfig } from './state.js?v=4';
import { saveCustomTheme } from './themes.js?v=4';

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
    // Remove the modal element after a brief delay for animation
    setTimeout(function() {
        if (modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
    }, 200);
    if (activeModals.size === 0) {
        const backdrop = getBackdrop();
        backdrop.classList.remove('fade-in');
        backdrop.classList.add('fade-out');
        // Remove backdrop after animation
        setTimeout(function() {
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        }, 300);
        document.body.classList.remove('modal-open');
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
    
    // Ensure modal appears on top of any already open modals
    const baseZ = 10000;
    modal.style.zIndex = baseZ + (openModalsStack.length * 10);
    
    modal.classList.add('open');
    openModalsStack.push(modalId);
    updateBodyScrollLock();
}

export function closeModalLegacy(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.zIndex = '';
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
    header.appendChild(el('button', { className: 'modal-close', dataset: { action: 'close-modal' }, 'aria-label': 'Close' }, '\u2715'));
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
    
    const baseZ = 10000;
    overlay.style.zIndex = baseZ + (openModalsStack.length * 10);
    
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
        { id: 'tab-general', label: 'General' },
        { id: 'tab-appearance', label: 'Appearance' },
        { id: 'tab-catalog', label: 'Catalog' },
        { id: 'tab-data', label: 'Data & Backup' },
        { id: 'tab-cloud', label: 'Cloud Sync' },
        { id: 'tab-advanced', label: 'Advanced' },
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
        }, tab.label);
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
            el('h3', { className: 'settings-section-title' }, 'General'),
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
                    { value: 'custom1', label: 'Custom 1' },
                    { value: 'custom2', label: 'Custom 2' },
                    { value: 'custom3', label: 'Custom 3' }
                ],
                value: currentTheme,
                onchange: (v) => { localStorage.setItem('cc-theme', v); setTheme(v); },
            }),
            buildSettingRow('Card Layout', 'settings-card-layout', 'select', {
                options: [
                    { value: 'normal', label: 'Normal (Fit Content)' },
                    { value: 'expand', label: 'Auto-Expand (Fill Empty Space)' }
                ],
                value: localStorage.getItem('cc-expand-cards') === 'true' ? 'expand' : 'normal',
                onchange: (v) => { 
                    const isExpand = v === 'expand';
                    localStorage.setItem('cc-expand-cards', isExpand); 
                    dispatchSettingsChange('cc-expand-cards', isExpand);
                },
            }),
        ]));
    }

    function buildAppearanceTab(panel) {
        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, 'Album Page Color'),
            el('p', { className: 'settings-section-desc' }, 'Background color for the album view folders.'),
            buildSettingRow('Folder Background', 'settings-folder-color', 'select', {
                options: [
                    { value: 'green', label: 'Green' }, { value: 'blue', label: 'Blue' },
                    { value: 'brown', label: 'Brown' }, { value: 'black', label: 'Black' },
                    { value: 'purple', label: 'Purple' }, { value: 'red', label: 'Red' },
                    { value: 'gray', label: 'Gray' },
                ],
                value: currentFolderColor,
                onchange: (v) => applyFolderColor(v),
            }),
        ]));

        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('p', { className: 'settings-section-desc' }, 'Create your own color scheme with live preview.'),
            el('button', { className: 'btn-primary', style: 'width:100%;', onclick: () => { closeModal('modal-settings'); setTimeout(() => openCustomThemeDesigner(1), 150); } },
                'Open Theme Designer'
            ),
        ]));

        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, 'Dashboard Card Visibility'),
            el('p', { className: 'settings-section-desc' }, 'Show or hide entire dashboard cards.'),
            ...buildCardVisibilityRows(),
        ]));
    }

    function buildCatalogTab(panel) {
        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, 'Display Filters'),
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
            el('h3', { className: 'settings-section-title' }, 'Export & Backup'),
            el('p', { className: 'settings-section-desc' }, 'Download your collection data for safekeeping or migration.'),
            buildActionRow([
                { label: 'Download Full Backup (ZIP)', onclick: () => window.location.href = '/api/backup/zip', className: 'btn-primary' },
                { label: 'Export All (CSV)', onclick: () => window.location.href = '/api/backup/full', className: 'btn-secondary' },
                { label: 'Backup JSON', onclick: backupJSON, className: 'btn-secondary' },
            ]),
        ]));

        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, 'Import & Restore'),
            el('p', { className: 'settings-section-desc' }, 'Restore from a previous backup or import CSV data.'),
            buildActionRow([
                { label: 'Restore Full Backup (ZIP)', onclick: () => restoreZipInput.click(), className: 'btn-primary' },
                { label: 'Restore JSON', onclick: () => restoreInput.click(), className: 'btn-secondary' },
                { label: 'Import CSV', onclick: () => importInput.click(), className: 'btn-secondary' },
            ]),
            createHiddenFileInput('restoreZipInput', '.zip', restoreZIP),
            createHiddenFileInput('restoreInput', '.json', restoreJSON),
            createHiddenFileInput('importInput', '.csv', importCSV),
        ]));
    }

        async function buildCloudTab(panel) {
            // Import sync functions dynamically
            const { getAllProviders, getCurrentProvider, setCurrentProvider, 
                    getProviderAuthState, setProviderAuthState,
                    syncToCloud, syncFromCloud,
                    authenticateGoogleDrive, authenticateOneDrive, authenticateDropbox } = await import('./sync.js?v=7');

            const providers = getAllProviders();
            const currentProvider = getCurrentProvider();
            const currentProviderId = currentProvider ? currentProvider.id : null;

            panel.appendChild(el('div', { className: 'settings-section' }, [
                el('h3', { className: 'settings-section-title' }, 'Cloud Backup & Sync'),
                el('p', { className: 'settings-section-desc' }, 'Choose a cloud provider to automatically backup and sync your collection data.'),

                // Provider Selection
                buildSettingRow('Cloud Provider', 'settings-cloud-provider', 'select', {
                    options: [
                        { value: '', label: '— Select a provider —' },
                        ...providers.map(p => ({ value: p.id, label: `${p.icon} ${p.name}` }))
                    ],
                    value: currentProviderId || '',
                    onchange: async (providerId) => {
                        setCurrentProvider(providerId);
                        // Rebuild the tab to show provider-specific settings
                        const cloudPanel = document.getElementById('tab-cloud-panel');
                        if (cloudPanel) {
                            cloudPanel.innerHTML = '';
                            buildCloudTab(cloudPanel);
                        }
                    },
                }),
            ]));

            if (currentProviderId) {
                const provider = providers.find(p => p.id === currentProviderId);
                const authState = getProviderAuthState(currentProviderId);
                const isAuthenticated = authState.authenticated === true;

                // Provider info & auth
                panel.appendChild(el('div', { className: 'settings-section' }, [
                    el('h3', { className: 'settings-section-title' }, `${provider.icon} ${provider.name} Configuration`),
                    el('p', { className: 'settings-section-desc' }, provider.description),

                    provider.requiresAuth ? el('div', { style: 'margin-bottom: 12px; padding: 12px; background: var(--color-bg); border-radius: 8px;' }, [
                        isAuthenticated 
                            ? el('div', { className: 'success-message', style: 'color: var(--color-success); font-weight: 600;' }, '✓ Authenticated')
                            : el('div', { className: 'warning-message', style: 'color: var(--color-warning); font-weight: 600;' }, '⚠ Not authenticated'),
                        el('button', {
                            className: isAuthenticated ? 'btn-secondary' : 'btn-primary',
                            style: 'width: 100%; margin-top: 8px;',
                            onclick: async () => {
                                let result = false;
                                switch (currentProviderId) {
                                    case 'googleDrive': result = await authenticateGoogleDrive(); break;
                                    case 'oneDrive': result = await authenticateOneDrive(); break;
                                    case 'dropbox': result = await authenticateDropbox(); break;
                                    case 'webdav': 
                                        // WebDAV just needs URL/credentials saved below
                                        showToast('Enter WebDAV URL and credentials below', 'info');
                                        return;
                                }
                                if (result) {
                                    setProviderAuthState(currentProviderId, { authenticated: true });
                                    // Rebuild to show authenticated state
                                    const cloudPanel = document.getElementById('tab-cloud-panel');
                                    if (cloudPanel) {
                                        cloudPanel.innerHTML = '';
                                        buildCloudTab(cloudPanel);
                                    }
                                }
                            }
                        }, isAuthenticated ? 'Re-authenticate' : `Sign in to ${provider.name}`),
                    ]) : null,

                    // WebDAV config fields
                    currentProviderId === 'webdav' ? el('div', { style: 'display: flex; flex-direction: column; gap: 12px;' }, [
                        buildSettingRow('WebDAV Server URL', 'settings-webdav-url', 'text', {
                            value: authState.url || '',
                            placeholder: 'https://your-nextcloud.com/remote.php/dav/files/username/',
                            onchange: (v) => setProviderAuthState('webdav', { ...authState, url: v }),
                        }),
                        buildSettingRow('Username', 'settings-webdav-user', 'text', {
                            value: authState.username || '',
                            onchange: (v) => setProviderAuthState('webdav', { ...authState, username: v }),
                        }),
                        buildSettingRow('Password', 'settings-webdav-pass', 'password', {
                            value: authState.password || '',
                            onchange: (v) => setProviderAuthState('webdav', { ...authState, password: v }),
                        }),
                    ]) : null,
                ]));

                // Sync Actions
                panel.appendChild(el('div', { className: 'settings-section' }, [
                    el('h3', { className: 'settings-section-title' }, 'Sync Actions'),
                    el('p', { className: 'settings-section-desc' }, 'Manually trigger backup or restore.'),
                    buildActionRow([
                        { label: `Backup to ${provider.name}`, onclick: syncToCloud, className: 'btn-primary' },
                        { label: `Restore from ${provider.name}`, onclick: syncFromCloud, className: 'btn-secondary' },
                    ]),
                ]));
            }
        }


    function buildAdvancedTab(panel) {
        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, 'Advanced Tools'),
            el('p', { className: 'settings-section-desc' }, 'Power-user features for pricing, completion, and images.'),
            buildActionRow([
                { label: 'Edit Pricing Rules', onclick: () => { closeModal('modal-settings'); setTimeout(() => openPricingRulesModal(), 150); }, className: 'btn-secondary' },
                { label: 'View Completion Dashboard', onclick: () => { closeModal('modal-settings'); setTimeout(() => openCompletionDashboard(), 150); }, className: 'btn-secondary' },
                { label: 'Find Missing Images', onclick: () => { closeModal('modal-settings'); setTimeout(() => filterMissingImages(), 150); }, className: 'btn-secondary' },
                { label: 'Coin Image Bank', onclick: openImageManager, className: 'btn-secondary' },
                { label: 'Print Checklist', onclick: openPrintChecklist, className: 'btn-secondary' },
            ], true)
        ]));

        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h3', { className: 'settings-section-title' }, 'Danger Zone'),
            el('p', { className: 'settings-section-desc' }, 'Irreversible actions. Use with caution.'),
            buildActionRow([
                { label: 'Purge All Inventory', onclick: purgeInventory, className: 'btn-danger' }
            ], true)
        ]));
    }

    // Initialize first tab
    buildGeneralTab(tabPanels.children[0]);
    buildAppearanceTab(tabPanels.children[1]);
    buildCatalogTab(tabPanels.children[2]);
    buildDataTab(tabPanels.children[3]);
    buildCloudTab(tabPanels.children[4]);
    buildAdvancedTab(tabPanels.children[5]);

    // Footer
    const footer = el('div', { className: 'settings-footer' });
    footer.appendChild(el('span', { className: 'text-muted', style: 'font-size:0.75rem;' },
        'Filter and sort changes apply on next catalog load. Theme changes are instant.'
    ));

    createModal('modal-settings', 'Settings', body, footer);
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
        { id: 'card-completion', label: 'Collection Completion', desc: 'Progress towards completing your sets' },
        { id: 'card-bullion', label: 'Bullion Holdings', desc: 'Metal weight entry and valuation' },
        { id: 'card-coinweight', label: 'Bulk Coins', desc: 'Unsorted coins by weight (wheat cents, etc.)' },
        { id: 'card-scrap', label: 'Scrap Metal', desc: 'Scrap metal entries and melt estimate' },
        { id: 'card-paper', label: 'Paper Currency', desc: 'Paper currency entries and value' },
        { id: 'card-custom', label: 'Custom Categories', desc: 'Other collectables and categories' },
        { id: 'card-wishlist', label: 'Wishlist', desc: 'Display target grade, price, notes, and acquired state' },
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
            if (grid) {
                const cInGrid = grid.querySelector(`#${card.id}`);
                if (cInGrid) cInGrid.style.display = cb.checked ? '' : 'none';
            }
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
    const bullionVis = JSON.parse(localStorage.getItem('cc-bullion-vis') || '{}');
    const metals = [
        { id: 'gold', label: 'Gold' }, { id: 'silver', label: 'Silver' },
        { id: 'copper', label: 'Copper' }, { id: 'platinum', label: 'Platinum' },
        { id: 'palladium', label: 'Palladium' },
    ];
    return metals.map(m => {
        const row = el('div', { className: 'settings-row' });
        const labelEl = el('label', { style: 'display:flex;align-items:center;gap:var(--space-2);cursor:pointer;flex:1;' });
        const cb = el('input', { type: 'checkbox', checked: bullionVis[m.id] !== false, style: 'width:18px;height:18px;flex-shrink:0;' });
        cb.onchange = () => {
            bullionVis[m.id] = cb.checked;
            localStorage.setItem('cc-bullion-vis', JSON.stringify(bullionVis));
            dispatchSettingsChange('cc-bullion-vis', bullionVis);
            showToast(`${m.label} visibility updated`, 'info');
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

export async function backupJSON() {
    const resp = await fetch('/api/backup/full');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coin-catalog-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function restoreZIP(file) {
    if (!confirm('This will overwrite your entire database and all uploaded images. Are you sure you want to proceed?')) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    showToast('Restoring backup... Please wait.', 'info');
    const resp = await fetch('/api/backup/zip_restore', {
        method: 'POST', body: formData
    });
    
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({error: resp.statusText}));
        throw new Error(err.error || 'Restore failed');
    }
    
    showToast('Restore successful — reloading page', 'success', 5000);
    setTimeout(() => location.reload(), 2000);
}

export async function restoreJSON(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    const resp = await fetch('/api/backup/restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    if (!resp.ok) throw new Error('Restore failed: ' + resp.statusText);
    showToast('Restore successful — refresh the page', 'success', 5000);
    setTimeout(() => location.reload(), 2000);
}

export async function importCSV(file) {
    const text = await file.text();
    const resp = await fetch('/api/backup/import_csv', {
        method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text
    });
    if (!resp.ok) throw new Error('Import failed');
    showToast('CSV import started — check back in a moment', 'success', 5000);
}

export async function purgeInventory() {
    if (!confirm('This will DELETE ALL inventory entries. This cannot be undone. Continue?')) return;
    if (!confirm('Last chance: Are you absolutely sure?')) return;
    await purgeUserInventoryTables();
    showToast('All inventory purged', 'success');
    location.reload();
}

export function dispatchSettingsChange(key, value) {
    window.dispatchEvent(new CustomEvent('cc-settings-changed', { detail: { key, value } }));
    if (key === 'cc-expand-cards') {
        if (value) document.body.classList.add('expand-cards');
        else document.body.classList.remove('expand-cards');
    }
}

export function applyFolderColor(v) {
    localStorage.setItem('cc-folder-color', v);
    const fcMap = { green:'#2d4a2d', blue:'#2d3a4a', red:'#4a2d2d', brown:'#4a3d2d', black:'#1a1a1a', purple:'#3d2d4a', gray:'#3a3a3a' };
    const ftMap = { green:'#c9a227', blue:'#7db3d8', red:'#e8a0a0', brown:'#d4a574', black:'#888888', purple:'#c9a0d4', gray:'#aaaaaa' };
    const fcVal = fcMap[v] || fcMap.green;
    const ftVal = ftMap[v] || ftMap.green;
    document.documentElement.style.setProperty('--folder-color', fcVal);
    document.documentElement.style.setProperty('--folder-header-text', ftVal);
    document.documentElement.style.setProperty('--folder-label', ftVal);
    
    document.querySelectorAll('.album-inline, #album-grid-area').forEach(a => {
        a.style.background = fcVal;
    });
    document.querySelectorAll('.type-header-title').forEach(t => {
        t.style.background = fcVal;
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
    infoSection.appendChild(el('h3', { className: 'info-section-title' }, 'About Coin Catalog v2'));
    const version = window.APP_VERSION || 'dev';
    infoSection.appendChild(el('p', { className: 'info-text' }, `Coin Catalog v2 — ${version}`));
    infoSection.appendChild(el('p', { className: 'info-text' }, 'A self-hosted coin collection tracker with live metal prices, album view, and inventory management.'));
    body.appendChild(infoSection);

    // --- Collection stats section ---
    const statsSection = el('div', { className: 'info-section' });
    statsSection.appendChild(el('h3', { className: 'info-section-title' }, 'Collection Stats'));
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
    shortcutSection.appendChild(el('h3', { className: 'info-section-title' }, 'Keyboard Shortcuts'));
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

    // --- Stories ---
    const storiesSection = el('div', { className: 'info-section' });
    storiesSection.appendChild(el('h3', { className: 'info-section-title' }, 'Stories and Tips'));
    storiesSection.appendChild(el('p', { className: 'info-text' }, 'Explore famous coin stories and collecting tips.'));
    const btnStories = el('button', { className: 'btn-primary', style: 'width:100%;margin-bottom:8px;', onclick: () => { closeModalLegacy('modal-help'); import('./stories.js?v=4').then(m => m.openStoriesModal()); } }, 'Read Stories and Tips');
    storiesSection.appendChild(btnStories);
    body.appendChild(storiesSection);

    // --- Tips section ---
    const tipsSection = el('div', { className: 'info-section' });
    tipsSection.appendChild(el('h3', { className: 'info-section-title' }, 'Tips'));
    const tips = [
        'Click a coin hole in album view to add it to your inventory',
        'Right-click a coin for quick actions (edit, delete, view details)',
        'Use the search bar to filter by year, type, mint mark, or keywords',
        'Upload images at the type level (applies to all coins) or per-coin basis',
        'Check the dashboard for live metal prices and portfolio value',
        'Record precious metals like broken jewelry or loose silver on your dashboard',
        'Export your data regularly via Settings → Data & Backup',
        'Use custom themes to personalize the app appearance',
    ];
    const tipsList = el('ul', { className: 'tips-list' });
    tips.forEach(t => {
        tipsList.appendChild(el('li', {}, t));
    });
    tipsSection.appendChild(tipsList);
    body.appendChild(tipsSection);

    // --- Value Logic section ---
    const valueSection = el('div', { className: 'info-section' });
    valueSection.appendChild(el('h3', { className: 'info-section-title' }, 'Portfolio Value Logic'));
    
    const valueDesc = el('div', { className: 'info-text', style: 'font-size: 0.9rem; display: flex; flex-direction: column; gap: 8px;' });
    
    valueDesc.appendChild(el('p', {}, 'The app uses a strict "waterfall" logic to determine the value of every coin in your portfolio:'));
    
    const stepsList = el('ol', { style: 'margin-left: 20px; list-style-type: decimal; gap: 6px; display: flex; flex-direction: column;' });
    
    const li1 = el('li'); li1.innerHTML = '<strong>Melt Value:</strong> Calculated automatically using live spot prices, the coin\'s exact weight, and its metal composition.'; stepsList.appendChild(li1);
    const li2 = el('li'); li2.innerHTML = '<strong>Collectable Value:</strong> Derived from a priority hierarchy. It looks for a Custom "Current Value", then "Purchase Price", then your global Pricing Rules, and finally falls back to standard catalog defaults. The coin\'s Face Value acts as an absolute floor.'; stepsList.appendChild(li2);
    const li3 = el('li'); li3.innerHTML = '<strong>Final Value:</strong> The app takes the <em>higher</em> of the Melt Value or the Collectable Value.'; stepsList.appendChild(li3);
    const li4 = el('li'); li4.innerHTML = '<strong>Portfolio Categorization:</strong> To prevent double-counting, the final value is placed into exactly <em>one</em> portfolio bucket (e.g., if a silver coin is worth more as a collectable than its silver weight, its value goes entirely to "Collectable Premium" and is excluded from "Silver Coins Melt").'; stepsList.appendChild(li4);
    
    valueDesc.appendChild(stepsList);
    valueSection.appendChild(valueDesc);
    body.appendChild(valueSection);

    createModal('modal-help', 'Info & Help', body, null);
}

// ============================================================
// IMAGE MANAGER — Settings → Advanced Tab
// ============================================================

export function openImageManager() {
    const body = el('div', { style: 'display:flex; flex-direction:column; gap:12px; max-height:85vh; overflow-y:auto;' });
    
    // Header with search and view toggle
    const headerRow = el('div', { style: 'display:flex;gap:12px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--color-border-light);padding-bottom:12px;' });
    
    // Search input
    const searchIn = el('input', { 
        type: 'text', 
        placeholder: 'Search coin images by name, year, country...', 
        style: 'flex:1;min-width:200px;padding:8px 12px;border:1px solid var(--color-border-light);border-radius:6px;background:var(--color-input-bg);color:var(--color-text-main);font-size:0.9em;' 
    });
    headerRow.appendChild(searchIn);
    
    // View toggle
    const viewToggle = el('div', { style: 'display:flex;gap:4px;background:var(--color-accord-bg);border-radius:6px;padding:2px;' });
    let currentView = 'gallery';
    const galleryBtn = el('button', { className: 'btn-secondary', style: 'font-size:0.8em;padding:4px 10px;background:none;border:none;color:var(--color-text-main);', onclick: () => { currentView = 'gallery'; galleryBtn.classList.add('active'); listBtn.classList.remove('active'); renderGallery(); } }, '📷 Gallery');
    const listBtn = el('button', { className: 'btn-secondary', style: 'font-size:0.8em;padding:4px 10px;background:none;border:none;color:var(--color-text-muted);', onclick: () => { currentView = 'list'; listBtn.classList.add('active'); galleryBtn.classList.remove('active'); renderList(); } }, '📋 List');
    galleryBtn.classList.add('active');
    viewToggle.appendChild(galleryBtn);
    viewToggle.appendChild(listBtn);
    headerRow.appendChild(viewToggle);
    
    // Stats
    const statsEl = el('span', { className: 'dashboard-detail', style: 'margin-left:auto;font-size:0.85em;color:var(--color-text-muted);' }, 'Loading...');
    headerRow.appendChild(statsEl);
    
    body.appendChild(headerRow);
    
    // Main content area
    const contentDiv = el('div', { style: 'flex:1;overflow-y:auto;min-height:300px;' });
    body.appendChild(contentDiv);
    
    // Fetch all coins with images
    function loadCoinData() {
        statsEl.textContent = 'Loading coin data...';
        fetch('/api/coins?limit=10000').then(function(r){return r.json();}).then(function(data){
            var coins = data.coins || data || [];
            statsEl.textContent = coins.length + ' total coins';
            
            // Show unique images from type configs — one card per type+side, not per coin
            var seenTypes = {};
            coins.forEach(function(c) {
                var cfg = getTypeConfig ? getTypeConfig(c.coin_type) : null;
                if (cfg && cfg.obv_image && !seenTypes[c.coin_type + '_obv']) {
                    seenTypes[c.coin_type + '_obv'] = true;
                    c._hasObv = true; c._obvSrc = cfg.obv_image;
                }
                if (cfg && cfg.rev_image && !seenTypes[c.coin_type + '_rev']) {
                    seenTypes[c.coin_type + '_rev'] = true;
                    c._hasRev = true; c._revSrc = cfg.rev_image;
                }
            });
            var uniqueCount = Object.keys(seenTypes).length;
            statsEl.textContent = uniqueCount + ' unique images';
            // Filter coins to only those that contribute a unique image
            coins = coins.filter(function(c){ return c._hasObv || c._hasRev; });
            renderGallery();
            
            function renderGallery() {
                contentDiv.innerHTML = '';
                var grid = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;' });
                
                var filtered = coins.filter(function(c) {
                    var q = searchIn.value.toLowerCase();
                    if (!q) return true;
                    return (c.name || '').toLowerCase().includes(q) || 
                           (c.year || '').toLowerCase().includes(q) || 
                           (c.country || '').toLowerCase().includes(q) ||
                           (c.denomination || '').toLowerCase().includes(q);
                });
                
                if (filtered.length === 0) {
                    contentDiv.appendChild(el('div', { style: 'text-align:center;padding:40px;color:var(--color-text-muted);' }, 'No coins match your search'));
                    return;
                }
                
                filtered.forEach(function(coin) {
                    var card = el('div', { style: 'border:1px solid var(--color-border-light);border-radius:8px;overflow:hidden;background:var(--color-card-bg);transition:transform 0.15s,box-shadow 0.15s;', onmouseover: "this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'", onmouseout: "this.style.transform='none';this.style.boxShadow='none'" });
                    
                    // Image area
                    var imgArea = el('div', { style: 'aspect-ratio:1/1;background:var(--color-accord-bg);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;' });
                    
                    if (coin._hasObv && coin._obvSrc) {
                        var obvImg = el('img', { src: coin._obvSrc, style: 'max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;', onerror: function(){this.style.display='none'; this.parentNode.innerHTML='<span style="font-size:2.5em;color:var(--color-text-muted);opacity:0.3;">⊘</span>';} });
                        imgArea.appendChild(obvImg);
                    } else if (coin._hasRev && coin._revSrc) {
                        var revImg = el('img', { src: coin._revSrc, style: 'max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;', onerror: function(){this.style.display='none'; this.parentNode.innerHTML='<span style="font-size:2.5em;color:var(--color-text-muted);opacity:0.3;">⊘</span>';} });
                        imgArea.appendChild(revImg);
                    } else {
                        imgArea.appendChild(el('span', { style: 'font-size:2.5em;color:var(--color-text-muted);opacity:0.3;' }, '⊘'));
                    }
                    
                    card.appendChild(imgArea);
                    
                    // Info
                    var info = el('div', { style: 'padding:8px;display:flex;flex-direction:column;gap:2px;' });
                    info.appendChild(el('div', { style: 'font-weight:600;font-size:0.85em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' }, coin.name || 'Unnamed'));
                    info.appendChild(el('div', { style: 'font-size:0.7em;color:var(--color-text-muted);' }, (coin.country || '') + ' ' + (coin.year || '') + ' ' + (coin.denomination || '')));
                    info.appendChild(el('div', { style: 'font-size:0.65em;color:var(--color-text-muted);display:flex;gap:8px;', innerHTML: (coin._hasObv ? '<span style="color:var(--color-success)">●</span> Obv' : '<span style="color:var(--color-danger)">○</span> Obv') + ' | ' + (coin._hasRev ? '<span style="color:var(--color-success)">●</span> Rev' : '<span style="color:var(--color-danger)">○</span> Rev') }));
                    
                    card.appendChild(info);
                    
                    // Actions row
                    var actions = el('div', { style: 'display:flex;gap:4px;padding:0 8px 8px;border-top:1px solid var(--color-border-light);' });
                    
                    var uploadBtn = el('button', { className: 'btn-secondary', style: 'flex:1;font-size:0.7em;padding:4px;', title: 'Upload image', onclick: function(e) { e.stopPropagation(); openImageUploadModal(coin.id); } }, '📤');
                    actions.appendChild(uploadBtn);
                    
                    if (coin.hasObv || coin.hasRev) {
                        var removeBtn = el('button', { className: 'btn-danger', style: 'flex:1;font-size:0.7em;padding:4px;', title: 'Remove image', onclick: function(e) { e.stopPropagation(); if(confirm('Remove this coin image?')) removeCoinImage(coin.id); } }, '🗑');
                        actions.appendChild(removeBtn);
                    }
                    
                    card.appendChild(actions);
                    
                    // Click to navigate
                    card.onclick = function() {
                        window.dispatchEvent(new CustomEvent('cc-navigate-coin', { detail: { id: coin.id } }));
                        closeModal('modal-image-manager');
                    };
                    
                    grid.appendChild(card);
                });
                
                contentDiv.appendChild(grid);
            }
            
            function renderList() {
                contentDiv.innerHTML = '';
                var table = el('div', { style: 'display:flex;flex-direction:column;' });
                
                // Header
                var header = el('div', { style: 'display:grid;grid-template-columns:40px 1fr 100px 80px 80px 80px 120px;gap:8px;padding:8px;background:var(--color-accord-bg);font-weight:600;font-size:0.75em;color:var(--color-text-muted);border-radius:6px 6px 0 0;' });
                ['', 'Coin', 'Country', 'Year', 'Denom', 'Obv', 'Rev', 'Actions'].forEach(function(h) {
                    header.appendChild(el('div', {}, h));
                });
                table.appendChild(header);
                
                var filtered = coins.filter(function(c) {
                    var q = searchIn.value.toLowerCase();
                    if (!q) return true;
                    return (c.name || '').toLowerCase().includes(q) || 
                           (c.year || '').toLowerCase().includes(q) || 
                           (c.country || '').toLowerCase().includes(q) ||
                           (c.denomination || '').toLowerCase().includes(q);
                });
                
                filtered.forEach(function(coin) {
                    var row = el('div', { style: 'display:grid;grid-template-columns:40px 1fr 100px 80px 80px 80px 120px;gap:8px;padding:8px;border-bottom:1px solid var(--color-border-light);align-items:center;font-size:0.8em;', onmouseover: "this.style.background='var(--color-accord-bg)'", onmouseout: "this.style.background='transparent'" });
                    
                    // Thumbnail
                    var thumb = el('div', { style: 'width:36px;height:36px;border-radius:4px;background:var(--color-accord-bg);display:flex;align-items:center;justify-content:center;overflow:hidden;' });
                    if (coin._hasObv) {
                        thumb.appendChild(el('img', { src: coin._obvSrc, style: 'width:100%;height:100%;object-fit:cover;', onerror: function(){this.style.display='none';} }));
                    } else if (coin._hasRev) {
                        thumb.appendChild(el('img', { src: coin._revSrc, style: 'width:100%;height:100%;object-fit:cover;', onerror: function(){this.style.display='none';} }));
                    } else {
                        thumb.appendChild(el('span', { style: 'font-size:0.8em;color:var(--color-text-muted);' }, '⚠'));
                    }
                    row.appendChild(thumb);
                    
                    // Name
                    var nameDiv = el('div', { style: 'font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;', onclick: function() { window.dispatchEvent(new CustomEvent('cc-navigate-coin', { detail: { id: coin.id } })); closeModal('modal-image-manager'); } }, coin.name || 'Unnamed');
                    row.appendChild(nameDiv);
                    
                    // Country
                    row.appendChild(el('div', { style: 'color:var(--color-text-muted);' }, coin.country || ''));
                    // Year
                    row.appendChild(el('div', { style: 'text-align:center;color:var(--color-text-muted);' }, coin.year || ''));
                    // Denom
                    row.appendChild(el('div', { style: 'text-align:center;color:var(--color-text-muted);' }, coin.denomination || ''));
                    // Obv
                    row.appendChild(el('div', { style: 'text-align:center;', innerHTML: coin.hasObv ? '<span style="color:var(--color-success)">✓</span>' : '<span style="color:var(--color-danger)">✗</span>' }));
                    // Rev
                    row.appendChild(el('div', { style: 'text-align:center;', innerHTML: coin.hasRev ? '<span style="color:var(--color-success)">✓</span>' : '<span style="color:var(--color-danger)">✗</span>' }));
                    
                    // Actions
                    var actions = el('div', { style: 'display:flex;gap:4px;' });
                    var uploadBtn = el('button', { className: 'btn-secondary', style: 'font-size:0.65em;padding:2px 8px;', onclick: function(e) { e.stopPropagation(); openImageUploadModal(coin.id); } }, '📤');
                    actions.appendChild(uploadBtn);
                    if (coin.hasObv || coin.hasRev) {
                        var removeBtn = el('button', { className: 'btn-danger', style: 'font-size:0.65em;padding:2px 8px;', onclick: function(e) { e.stopPropagation(); if(confirm('Remove this coin image?')) removeCoinImage(coin.id); } }, '🗑');
                        actions.appendChild(removeBtn);
                    }
                    row.appendChild(actions);
                    
                    table.appendChild(row);
                });
                
                if (filtered.length === 0) {
                    table.appendChild(el('div', { style: 'text-align:center;padding:40px;color:var(--color-text-muted);' }, 'No coins match your search'));
                }
                
                contentDiv.appendChild(table);
            }
            
            // Search handler
            searchIn.oninput = function() {
                if (currentView === 'gallery') renderGallery();
                else renderList();
            };
        });
    }
    
    function removeCoinImage(coinId) {
        // API: DELETE /api/coins/:id/image/:type
        fetch('/api/coins/' + coinId + '/image/obv', { method: 'DELETE' }).then(function() {
            showToast('Image removed', 'success');
            loadCoinData();
        }).catch(function() { showToast('Failed to remove', 'error'); });
    }
    
    loadCoinData();
    
    // Footer
    var footer = el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--color-border-light);' });
    var closeBtn = el('button', { className: 'btn-secondary' }, 'Close');
    closeBtn.onclick = () => closeModal('modal-image-manager');
    footer.appendChild(closeBtn);
    
    createModal('modal-image-manager', 'Coin Image Bank', body, footer, { maxWidth: '95vw', maxHeight: '95vh' });
    openModal('modal-image-manager');
}

// ============================================================
// PRINT CHECKLIST — Settings → Advanced Tab
// ============================================================

export function openPrintChecklist() {
    const sections = getSections();
    const inventory = getInventory();
    
    const body = el('div', { style: 'display:flex; flex-direction:column; gap:12px;' });
    
    const info = el('div', { style: 'font-size:0.85rem; color:var(--color-text-muted);' },
        'Print a checklist of coins you still need. Select sections to include.'
    );
    body.appendChild(info);
    
    const checklist = el('div', { style: 'max-height:400px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;' });
    
    // Sort sections: US first (small→large), Canada second, then others
    var sectionOrder = {
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
        'US Gold — Circulation': 113,
        'US Bullion — Silver': 114,
        'US Bullion — Gold': 115,
        'US Bullion — Platinum & Palladium': 116,
        'US Commemoratives': 117,
        'US Mint Sets & Proof Sets': 118,
        'Canadian Coinage — Cent': 201,
        'Canadian Coinage — Five Cent': 202,
        'Canadian Coinage — Ten Cent': 203,
        'Canadian Coinage — Twenty-Five Cent': 204,
        'Canadian Coinage — Fifty Cent': 205,
        'Canadian Coinage — Dollar': 206,
        'Canadian Coinage — Two Dollar': 207,
    };
    sections.sort(function(a, b) {
        var oA = sectionOrder[a.section] || 999;
        var oB = sectionOrder[b.section] || 999;
        if (oA !== oB) return oA - oB;
        return a.section.localeCompare(b.section);
    });
    
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
    const printBtn = el('button', { className: 'btn-primary' }, 'Print');
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
    
    createModal('modal-print-checklist', 'Print Checklist', body, footer);
    openModal('modal-print-checklist');
}

// ============================================================
// PRICING RULES MODAL
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
                    var fv = parseFloat(c.face_value);
                    if (isNaN(fv)) fv = parseFloat(c.denomination);
                    if (isNaN(fv)) fv = 0;
                    typeMap[ct] = {section: c.section || 'Other', face: fv};
                }
            });

            var bySection = {};
            Object.keys(typeMap).forEach(function(ct) {
                var sec = typeMap[ct].section;
                if (!bySection[sec]) bySection[sec] = [];
                bySection[sec].push(ct);
            });

            var standardOrder = ['US Coins', 'Canadian Coins', 'UK Coins', 'Euro Coins', 'Bullion', 'Scrap', 'Paper Currency'];
            var secNames = Object.keys(bySection).sort(function(a, b) {
                // Map section names to their broader category for ordering
                function sectionRank(s) {
                    if (/^US\b/.test(s)) return 0;
                    if (/^Canadian\b/.test(s)) return 1;
                    if (/^UK\b/.test(s)) return 2;
                    if (/^Euro\b/.test(s)) return 3;
                    if (/Bullion/.test(s)) return 4;
                    if (/Scrap/.test(s)) return 5;
                    if (/Paper/.test(s)) return 6;
                    return 999;
                }
                var ra = sectionRank(a), rb = sectionRank(b);
                if (ra !== rb) return ra - rb;
                return a.localeCompare(b);
            });

            secNames.forEach(function(sec) {
                var secDiv = el('details', { style: 'margin-bottom:16px; border:1px solid var(--color-border-light); border-radius:var(--radius-base); background:var(--color-bg-card);' });
                var summary = el('summary', { style: 'font-size:0.85em;font-weight:700;color:var(--color-accent);text-transform:uppercase;letter-spacing:0.06em; cursor:pointer; outline:none; user-select:none; padding:10px 12px; margin:0;' }, sec);
                secDiv.appendChild(summary);
                var contentDiv = el('div', { style: 'padding: 0 12px 12px 12px;' });

                // sort types by denomination value (small to large)
                var types = bySection[sec].sort(function(a, b) {
                    var valA = typeMap[a].face;
                    var valB = typeMap[b].face;
                    if (valA !== valB) return valA - valB;
                    return a.localeCompare(b);
                });
                
                types.forEach(function(ct) {
                    var rule = rules[ct] || {};
                    var basePrice = rule.base_price != null ? rule.base_price : '';
                    var keyPrice = rule.key_price != null ? rule.key_price : '';

                    var row = el('div', { style: 'display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--color-border-light);' });
                    row.appendChild(el('span', { style: 'flex:1;font-size:0.82em;padding-right:8px;' }, ct));

                    var baseInput = el('input', { type:'number', step:'0.5', value: basePrice, placeholder:'Base $', style:'width:70px;padding:4px;font-size:0.75em;border-radius:4px;border:1px solid var(--color-border);background:var(--color-bg-body);color:var(--color-text-main);' });
                    var keyInput = el('input', { type:'number', step:'1.0', value: keyPrice, placeholder:'Key $', style:'width:70px;padding:4px;font-size:0.75em;border-radius:4px;border:1px solid var(--color-border);background:var(--color-bg-body);color:var(--color-text-main);' });
                    var saveBtn = el('button', { className: 'btn-secondary', style: 'font-size:0.75em;padding:4px 8px;' }, 'Save');

                    baseInput.addEventListener('change', function(){ saveRule(ct, 'base_price', baseInput); });
                    keyInput.addEventListener('change', function(){ saveRule(ct, 'key_price', keyInput); });
                    saveBtn.onclick = function() {
                        // Visual feedback - disable and show saving state
                        var origText = saveBtn.textContent;
                        saveBtn.disabled = true;
                        saveBtn.textContent = 'Saving...';
                        saveRule(ct, 'base_price', baseInput);
                        saveRule(ct, 'key_price', keyInput);
                        setTimeout(function() {
                            saveBtn.textContent = '✓ Saved';
                            saveBtn.style.color = 'var(--color-success)';
                            setTimeout(function() {
                                saveBtn.disabled = false;
                                saveBtn.textContent = origText;
                                saveBtn.style.color = '';
                            }, 1200);
                        }, 400);
                    };

                    row.appendChild(baseInput);
                    row.appendChild(keyInput);
                    row.appendChild(saveBtn);
                    contentDiv.appendChild(row);
                });
                secDiv.appendChild(contentDiv);
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
// COMPLETION DASHBOARD
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

        // Sort sections: US first (small→large), Canada second, then others
        var sectionOrder = {
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
            'US Gold — Circulation': 113,
            'US Bullion — Silver': 114,
            'US Bullion — Gold': 115,
            'US Bullion — Platinum & Palladium': 116,
            'US Commemoratives': 117,
            'US Mint Sets & Proof Sets': 118,
            'Canadian Coinage — Cent': 201,
            'Canadian Coinage — Five Cent': 202,
            'Canadian Coinage — Ten Cent': 203,
            'Canadian Coinage — Twenty-Five Cent': 204,
            'Canadian Coinage — Fifty Cent': 205,
            'Canadian Coinage — Dollar': 206,
            'Canadian Coinage — Two Dollar': 207,
        };
        sections.sort(function(a, b) {
            var oA = sectionOrder[a.section] || 999;
            var oB = sectionOrder[b.section] || 999;
            if (oA !== oB) return oA - oB;
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
// FILTER MISSING IMAGES
// ============================================================

export function filterMissingImages() {
    window.dispatchEvent(new CustomEvent('cc-filter-missing-images'));
    showToast('Finding coins missing images...', 'info');

    fetch('/api/coins?limit=5000').then(function(r){return r.json();}).then(function(data){
        var coins = data.coins || data || [];
        var missing = 0, total = coins.length;

        var promises = coins.slice(0, 200).map(function(c) {
            return fetch('/api/coins/' + c.id).then(function(r){return r.json();}).then(function(d){
                if (!d.obv_image && !d.rev_image) missing++;
            }).catch(function(){});
        });

        Promise.all(promises).then(function(){
            var body = el('div', { style: 'display:flex;flex-direction:column;gap:16px;max-height:70vh;overflow-y:auto;' });
            
            // Stats header
            var statsDiv = el('div', { style: 'text-align:center;padding:12px;background:var(--color-accord-bg);border-radius:8px;' });
            var pct = total > 0 ? ((total - missing) / total * 100).toFixed(0) + '%' : 'N/A';
            statsDiv.appendChild(el('h3', { style: 'margin-bottom:8px;' }, 'Image Coverage'));
            statsDiv.appendChild(el('div', { style: 'font-size:2em;font-weight:700;color:var(--color-accent);' }, pct));
            statsDiv.appendChild(el('p', { style: 'color:var(--color-text-muted);margin-top:4px;' }, (total - missing) + ' of ' + total + ' coins have reference images'));
            statsDiv.appendChild(el('p', { style: 'color:var(--color-text-muted);font-size:0.85em;' }, missing + ' coins still need images'));
            body.appendChild(statsDiv);

            // Show Missing button + list container
            var actionsDiv = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;' });
            
            var showMissingBtn = el('button', { className: 'btn-primary' }, 'Show Missing Coins');
            showMissingBtn.onclick = function() {
                showMissingBtn.disabled = true;
                showMissingBtn.textContent = 'Loading...';
                fetch('/api/coins?limit=5000').then(function(r){return r.json();}).then(function(data){
                    var coins = data.coins || data || [];
                    var missingCoins = [];
                    var checked = 0;
                    
                    // Check all coins (or first 500 for performance)
                    var toCheck = coins.slice(0, 500);
                    var checkPromises = toCheck.map(function(c) {
                        return fetch('/api/coins/' + c.id).then(function(r){return r.json();}).then(function(d){
                            if (!d.obv_image && !d.rev_image) missingCoins.push(d);
                        }).catch(function(){}).finally(function(){
                            checked++;
                        });
                    });
                    
                    Promise.all(checkPromises).then(function(){
                        showMissingBtn.style.display = 'none';
                        
                        if (missingCoins.length === 0) {
                            body.appendChild(el('p', { style: 'text-align:center;color:var(--color-success);' }, 'All checked coins have images!'));
                            return;
                        }
                        
                        var listDiv = el('div', { style: 'max-height:400px;overflow-y:auto;border:1px solid var(--color-border-light);border-radius:8px;padding:8px;' });
                        listDiv.appendChild(el('h4', { style: 'margin:0 0 8px;padding-bottom:8px;border-bottom:1px solid var(--color-border-light);' }, missingCoins.length + ' coins missing images (first 500 checked):'));
                        
                        missingCoins.forEach(function(coin) {
                            var item = el('div', { style: 'display:flex;align-items:center;gap:12px;padding:8px;border-radius:6px;cursor:pointer;', onmouseover: "this.style.background='var(--color-accord-bg)'", onmouseout: "this.style.background='transparent'" });
                            item.onclick = function() {
                                window.dispatchEvent(new CustomEvent('cc-navigate-coin', { detail: { id: coin.id } }));
                                closeModal('modal-image-coverage');
                            };
                            
                            var thumb = el('div', { style: 'width:40px;height:40px;border-radius:4px;background:var(--color-accord-bg);display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:0.7em;text-align:center;', title: 'No image' }, '⚠');
                            item.appendChild(thumb);
                            
                            var info = el('div', { style: 'flex:1;min-width:0;' });
                            info.appendChild(el('div', { style: 'font-weight:600;font-size:0.9em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' }, coin.name || 'Unnamed'));
                            info.appendChild(el('div', { style: 'font-size:0.75em;color:var(--color-text-muted);' }, (coin.denomination || '') + ' | ' + (coin.country || '') + ' | ' + (coin.year || '')));
                            item.appendChild(info);
                            
                            var addBtn = el('button', { className: 'btn-secondary', style: 'font-size:0.75em;padding:4px 10px;white-space:nowrap;' }, 'Add Image');
                            addBtn.onclick = function(e) {
                                e.stopPropagation();
                                // Open image upload for this coin
                                closeModal('modal-image-coverage');
                                openImageUploadModal(coin.id);
                            };
                            item.appendChild(addBtn);
                            
                            listDiv.appendChild(item);
                        });
                        
                        body.appendChild(listDiv);
                    });
                });
            };
            actionsDiv.appendChild(showMissingBtn);
            body.appendChild(actionsDiv);

            if (typeof createModal === 'function') {
                createModal('modal-image-coverage', 'Image Coverage', body, null);
            }
            openModal('modal-image-coverage');
        });
    });
}

// Helper to open image upload for a specific coin
function openImageUploadModal(coinId) {
    var body = el('div', { style: 'display:flex;flex-direction:column;gap:16px;' });
    body.appendChild(el('h4', { style: 'margin:0;' }, 'Upload Images for Coin ID: ' + coinId));
    
    var dropZone = el('div', { style: 'border:2px dashed var(--color-border-light);border-radius:8px;padding:24px;text-align:center;cursor:pointer;', ondragover: "event.preventDefault(); this.style.borderColor='var(--color-accent)'", ondragleave: "this.style.borderColor='var(--color-border-light)'", ondrop: function(e) { e.preventDefault(); this.style.borderColor='var(--color-border-light)'; handleFileUpload(e.dataTransfer.files[0], 'obv', coinId); } });
    dropZone.appendChild(el('p', { style: 'margin:0 0 8px;' }, 'Drag & drop or click to select obverse image'));
    dropZone.appendChild(el('p', { style: 'font-size:0.85em;color:var(--color-text-muted);' }, 'PNG, JPG, WebP — will be auto-cropped to circle'));
    dropZone.onclick = function() { var inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=function(){handleFileUpload(inp.files[0], 'obv', coinId)}; inp.click(); };
    
    var dropZone2 = el('div', { style: 'border:2px dashed var(--color-border-light);border-radius:8px;padding:24px;text-align:center;cursor:pointer;', ondragover: "event.preventDefault(); this.style.borderColor='var(--color-accent)'", ondragleave: "this.style.borderColor='var(--color-border-light)'", ondrop: function(e) { e.preventDefault(); this.style.borderColor='var(--color-border-light)'; handleFileUpload(e.dataTransfer.files[0], 'rev', coinId); } });
    dropZone2.appendChild(el('p', { style: 'margin:0 0 8px;' }, 'Drag & drop or click to select reverse image'));
    dropZone2.appendChild(el('p', { style: 'font-size:0.85em;color:var(--color-text-muted);' }, 'PNG, JPG, WebP — will be auto-cropped to circle'));
    dropZone2.onclick = function() { var inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=function(){handleFileUpload(inp.files[0], 'rev', coinId)}; inp.click(); };
    
    body.appendChild(dropZone);
    body.appendChild(dropZone2);
    
    var footer = el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;' });
    var closeBtn = el('button', { className: 'btn-secondary' }, 'Cancel');
    closeBtn.onclick = function() { closeModal('modal-image-upload'); };
    footer.appendChild(closeBtn);
    
    createModal('modal-image-upload', 'Add Coin Images', body, footer);
    openModal('modal-image-upload');
    
    function handleFileUpload(file, type, cid) {
        if (!file) return;
        var formData = new FormData();
        formData.append('coin_id', cid);
        formData.append('type', type);
        formData.append('image', file);
        
        showToast('Uploading ' + type + ' image...', 'info');
        fetch('/api/upload', { method: 'POST', body: formData }).then(function(r) { return r.json(); }).then(function(res) {
            if (res.ok) {
                showToast(type.charAt(0).toUpperCase() + type.slice(1) + ' image uploaded!', 'success');
                setTimeout(function() { location.reload(); }, 800);
            } else {
                showToast('Upload failed: ' + (res.error || 'unknown'), 'error');
            }
        }).catch(function() { showToast('Upload failed', 'error'); });
    }
}

export function openScrapMetalModal() { openModal('modal-scrapmetalmodal'); }
export function openPaperCurrencyModal() { openModal('modal-papercurrencymodal'); }
export function openCollectablesModal() { openModal('modal-collectablesmodal'); }


export function openCustomThemeDesigner(slot) {
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

    // Slot-aware CSS variable key conversion for custom themes
function keyToCssVar(key, slot) {
    // Themes use --custom1-bg-body, --custom2-bg-body, etc.
    return '--custom' + (slot || '') + '-' + key.replace('color-', '');
}

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
            style: 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);',
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
            style: 'width:100%;height:200px;border-radius:8px;position:relative;cursor:crosshair;margin-bottom:8px;border:1px solid var(--color-border);overflow:hidden;background:linear-gradient(to right, #fff, hsl(' + Math.round(hsv.h * 360) + ',100%,50%));',
        });
        var sbOverlay = el('div', { style: 'position:absolute;top:0;left:0;right:0;bottom:0;border-radius:8px;background:linear-gradient(to top, #000, transparent);' });
        sbArea.appendChild(sbOverlay);

        // SB cursor
        var sbCursor = el('div', {
            id: 'cp-sb-cursor',
            style: 'position:absolute;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5);pointer-events:none;',
        });
        // Position cursor after sbArea is in DOM (use requestAnimationFrame)
        requestAnimationFrame(function() {
            var rect = sbArea.getBoundingClientRect();
            sbCursor.style.left = (hsv.s * rect.width) + 'px';
            sbCursor.style.top = ((1 - hsv.v) * rect.height) + 'px';
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

        // Eyedropper button (uses EyeDropper API)
        if (window.EyeDropper) {
            var eyedropperRow = el('div', { style: 'margin-bottom:12px;display:flex;gap:8px;align-items:center;' });
            var eyedropperBtn = el('button', {
                className: 'btn-secondary',
                style: 'flex:1;padding:10px;font-size:0.85em;',
            }, ' Pick Color from Screen');
            eyedropperBtn.onclick = async function() {
                try {
                    var eyeDropper = new EyeDropper();
                    var result = await eyeDropper.open();
                    var hex = result.sRGBHex;
                    hexInput.value = hex;
                    previewBox.style.background = hex;
                    var nrgb = hexToRgb(hex);
                    var nhsv = rgbToHsv(nrgb.r, nrgb.g, nrgb.b);
                    hueSlider.value = Math.round(nhsv.h * 360);
                    // Update SB area background
                    sbArea.style.background = 'linear-gradient(to right, #fff, hsl(' + Math.round(nhsv.h * 360) + ',100%,50%))';
                    // Update cursor position
                    var rect = sbArea.getBoundingClientRect();
                    sbCursor.style.left = (nhsv.s * rect.width) + 'px';
                    sbCursor.style.top = ((1 - nhsv.v) * rect.height) + 'px';
                    sbPickerUpdate(nhsv.s, nhsv.v, Math.round(nhsv.h * 360));
                } catch (err) {
                    // User cancelled or API not supported
                    if (err.name !== 'AbortError') {
                        console.warn('EyeDropper failed:', err);
                    }
                }
            };
            eyedropperRow.appendChild(eyedropperBtn);
            pickerBox.insertBefore(eyedropperRow, hueRow);
        }

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
                                    var rect = sbArea.getBoundingClientRect();
                                    sbCursor.style.left = (nhsv.s * rect.width) + 'px';
                                    sbCursor.style.top = ((1 - nhsv.v) * rect.height) + 'px';
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

            // Live preview: update the theme panel input and trigger preview
            var inp = document.querySelector('#cte-panel-' + pickerState.slot + ' input[data-key=\"' + pickerState.field + '\"]');
            if (inp) {
                inp.value = hex;
                inp.dispatchEvent(new Event('input'));
            }
        }

        // SB area mouse/touch handling
        sbArea.addEventListener('mousedown', startSB);
        sbArea.addEventListener('touchstart', startSB, { passive: false });
        function startSB(e) {
            e.preventDefault();
            document.body.classList.add('cc-color-dragging');
            updateSB(e);
            document.addEventListener('mousemove', updateSB);
            document.addEventListener('touchmove', updateSB, { passive: false });
            document.addEventListener('mouseup', endSB);
            document.addEventListener('touchend', endSB);
        }
        function endSB() {
            document.body.classList.remove('cc-color-dragging');
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
            
            // Raw values for color calculation (0 to 1)
            var x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            var y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
            
            // Clamped pixels for cursor visual so it doesn't overflow
            var px = Math.max(6, Math.min(rect.width - 6, clientX - rect.left));
            var py = Math.max(6, Math.min(rect.height - 6, clientY - rect.top));
            
            sbCursor.style.left = px + 'px';
            sbCursor.style.top = py + 'px';
            sbPickerUpdate(x, 1 - y, parseInt(hueSlider.value));
        }

        // Hue slider handler
        hueSlider.addEventListener('mousedown', function() { document.body.classList.add('cc-color-dragging'); });
        hueSlider.addEventListener('touchstart', function() { document.body.classList.add('cc-color-dragging'); }, { passive: true });
        hueSlider.addEventListener('mouseup', function() { document.body.classList.remove('cc-color-dragging'); });
        hueSlider.addEventListener('touchend', function() { document.body.classList.remove('cc-color-dragging'); });
        hueSlider.addEventListener('change', function() { document.body.classList.remove('cc-color-dragging'); });

        hueSlider.addEventListener('input', function() {
            var hue = parseInt(this.value);
            sbArea.style.background = 'linear-gradient(to right, #fff, hsl(' + hue + ',100%,50%))';
            var rect = sbArea.getBoundingClientRect();
            var sat = parseFloat(sbCursor.style.left) / rect.width || 0;
            var val = 1 - (parseFloat(sbCursor.style.top) / rect.height || 0);
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
                var rect = sbArea.getBoundingClientRect();
                sbCursor.style.left = (nhsv.s * rect.width) + 'px';
                sbCursor.style.top = ((1 - nhsv.v) * rect.height) + 'px';
                sbArea.style.background = 'linear-gradient(to right, #fff, hsl(' + Math.round(nhsv.h * 360) + ',100%,50%))';
                pickerState.currentHex = hex;

                // Live preview
                var inp = document.querySelector('#cte-panel-' + pickerState.slot + ' input[data-key=\"' + pickerState.field + '\"]');
                if (inp) {
                    inp.value = hex;
                    inp.dispatchEvent(new Event('input'));
                }
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
            
            // A hidden input stores the actual hex value so querySelectorAll can find it
            const inp = el('input', {
                type: 'hidden',
                value: savedColors[f.key] || f.default,
            });
            inp.setAttribute('data-key', f.key);
            
            // The button acts as the visual color block
            const btn = el('button', {
                type: 'button',
                style: 'width:100%;height:28px;border-radius:4px;border:1px solid var(--color-border);cursor:pointer;background:' + (savedColors[f.key] || f.default) + ';',
            });
            
            // Click handler: open custom color picker
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                activeSlot = slot;
                updateActiveSlotBorder();
                openColorPicker(slot, f.key, inp.value);
            });

            // When our custom picker updates the hidden input, update the button background
            inp.addEventListener('input', function() {
                btn.style.background = this.value;
                updateSlotFromInputs(slot);
                if (f.key === 'color-accent') swatch.style.background = this.value;
                hint.textContent = 'Previewing...';
            });

            label.appendChild(inp);
            label.appendChild(btn);
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
            root.style.setProperty(keyToCssVar(k, slotNum), colors[k]);
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
            root.style.setProperty(keyToCssVar(k, slotNum), colors[k]);
        }
        document.body.setAttribute('data-theme', 'custom' + slotNum);
        var sel = document.getElementById('theme-selector');
        if (sel) sel.value = 'custom' + slotNum;
        localStorage.setItem('cc-theme', 'custom' + slotNum);
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

    createModal('modal-custom-designer', 'Theme Designer', body, null);
    activeSlot = slot;
    updateActiveSlotBorder();
}


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