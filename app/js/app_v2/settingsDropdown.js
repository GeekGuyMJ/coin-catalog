/**
 * settingsDropdown.js - Coin Catalog v2
 * Settings button dropdown menu (replaces the full-screen Settings modal).
 * Clicking "Settings" opens a small popover with categorized settings options;
 * each option opens a clean, readable modal.
 */

import { el, escHtml } from './utils.js?v=8';
import { getSpotPrices } from './state.js?v=8';
import { showToast } from './notifications.js?v=8';
import { createModal, closeModal, applyFolderColor, backupJSON, restoreZIP, restoreJSON, importCSV, dispatchSettingsChange } from './modals.v2.js?v=8';
import { openPricingRulesModal, openCompletionDashboard, filterMissingImages, openImageManager, openPrintChecklist, openCustomThemeDesigner, purgeInventory, saveCurrentImagesAsDefaults } from './modals.v2.js?v=8';

let _dropdownEl = null;

// ---------------------------------------------------------------------------
// Dropdown toggle
// ---------------------------------------------------------------------------
export function toggleSettingsDropdown(evt) {
 evt?.stopPropagation();
 const btn = document.getElementById('btn-settings');
 if (!btn) return;

 if (_dropdownEl && _dropdownEl.classList.contains('open')) {
 closeSettingsDropdown();
 return;
 }
 openSettingsDropdown(btn);
}

export function closeSettingsDropdown() {
 if (_dropdownEl) {
 _dropdownEl.classList.remove('open');
 _dropdownEl.remove();
 _dropdownEl = null;
 }
 const btn = document.getElementById('btn-settings');
 if (btn) btn.setAttribute('aria-expanded', 'false');
 document.removeEventListener('click', _outsideHandler, true);
 document.removeEventListener('keydown', _escHandler, true);
}

function _outsideHandler(e) {
 if (_dropdownEl && !_dropdownEl.contains(e.target) && e.target.id !== 'btn-settings') {
 closeSettingsDropdown();
 }
}

function _escHandler(e) {
 if (e.key === 'Escape') closeSettingsDropdown();
}

function openSettingsDropdown(btn) {
 closeSettingsDropdown();

 const items = [
 // General
 {key: 'sort', label: 'Default Sort Order', section: 'general' },
 {key: 'cardLayout', label: 'Card Layout', section: 'general' },
  
 // Appearance
 {key: 'theme', label: 'Theme', section: 'appearance' },
 {key: 'folderColor', label: 'Album Folder Color', section: 'appearance' },
 {key: 'themeDesigner', label: 'Custom Theme Designer', section: 'appearance' },
 {key: 'cardVisibility', label: 'Dashboard Card Visibility', section: 'appearance' },
 
 // Catalog
 {key: 'displayFilters', label: 'Display Filters', section: 'catalog' },
 {key: 'bullionVis', label: 'Bullion Metals Visibility', section: 'catalog' },
 
 // Data & Backup
 {key: 'export', label: 'Export & Backup', section: 'data' },
 {key: 'import', label: 'Import & Restore', section: 'data' },
 
 // Cloud Sync
 {key: 'cloudSync', label: 'Cloud Sync', section: 'cloud' },
 
 // Advanced
 {key: 'pricingRules', label: 'Pricing Rules', section: 'advanced' },
 {key: 'completion', label: 'Completion Dashboard', section: 'advanced' },
 {key: 'missingImages', label: 'Find Missing Images', section: 'advanced' },
 {key: 'imageManager', label: 'Coin Image Bank', section: 'advanced' },
 {key: 'printChecklist', label: 'Print Checklist', section: 'advanced' },
 {key: 'customCard', label: 'Custom Dashboard Card', section: 'advanced' },
 
 // Danger Zone
 {key: 'purgeInventory', label: 'Purge All Inventory', section: 'danger' },
 ];

 // Group by section
 const sections = {};
 items.forEach(it => {
 if (!sections[it.section]) sections[it.section] = [];
 sections[it.section].push(it);
 });

 const sectionOrder = ['general', 'appearance', 'catalog', 'data', 'cloud', 'advanced', 'danger'];
 const sectionLabels = {
 general: 'General',
 appearance: 'Appearance',
 catalog: 'Catalog',
 data: 'Data & Backup',
 cloud: 'Cloud Sync',
 advanced: 'Advanced',
 danger: 'Danger Zone',
 };

 const menu = el('div', { className: 'settings-menu', role: 'menu' });
 
 sectionOrder.forEach(sectionKey => {
 const sectionItems = sections[sectionKey];
 if (!sectionItems || !sectionItems.length) return;
 
 // Section header
 const sectionHeader = el('div', { className: 'settings-menu-section' }, [
 el('span', { className: 'settings-menu-section-label' }, sectionLabels[sectionKey]),
 ]);
 menu.appendChild(sectionHeader);
 
 // Section items
 sectionItems.forEach(it => {
 const item = el('button', {
 className: 'settings-menu-item',
 role: 'menuitem',
 type: 'button',
 onclick: () => { closeSettingsDropdown(); openSettingsSection(it.key); },
 });
 item.appendChild(el('span', { className: 'settings-menu-icon' }, it.icon));
 item.appendChild(el('span', { className: 'settings-menu-label' }, it.label));
 menu.appendChild(item);
 });
 });

 _dropdownEl = el('div', { className: 'settings-dropdown open', role: 'dialog', 'aria-label': 'Settings menu' }, menu);
 document.body.appendChild(_dropdownEl);

 // Position under the Settings button (clamped to viewport)
 const rect = btn.getBoundingClientRect();
 const ddW = 280;
 let left = rect.right - ddW + window.scrollX;
 if (left < 8) left = 8;
 const top = rect.bottom + 8 + window.scrollY;
 _dropdownEl.style.top = top + 'px';
 _dropdownEl.style.left = left + 'px';
 _dropdownEl.style.width = ddW + 'px';

 if (btn) btn.setAttribute('aria-expanded', 'true');

 document.addEventListener('click', _outsideHandler, true);
 document.addEventListener('keydown', _escHandler, true);
}

// ---------------------------------------------------------------------------
// Section handlers
// ---------------------------------------------------------------------------
export function openSettingsSection(key) {
 switch (key) {
 // General
 case 'sort': showSortModal(); break;
 case 'theme': showThemeModal(); break;
 case 'cardLayout': showCardLayoutModal(); break;
 
 // Appearance
 case 'folderColor': showFolderColorModal(); break;
 case 'themeDesigner': openCustomThemeDesigner(1); break;
 case 'cardVisibility': showCardVisibilityModal(); break;
 
 // Catalog
 case 'displayFilters': showDisplayFiltersModal(); break;
 case 'bullionVis': showBullionVisibilityModal(); break;
 
 // Data & Backup
 case 'export': showExportModal(); break;
 case 'import': showImportModal(); break;
 
 // Cloud Sync
 case 'cloudSync': showCloudSyncModal(); break;
 
 // Advanced
 case 'pricingRules': openPricingRulesModal(); break;
 case 'completion': openCompletionDashboard(); break;
 case 'missingImages': filterMissingImages(); break;
 case 'imageManager': openImageManager(); break;
 case 'saveDefaults': saveCurrentImagesAsDefaults(); break;
 case 'printChecklist': openPrintChecklist(); break;
 case 'customCard': showCustomCardModal(); break;
 
 // Danger Zone
 case 'purgeInventory': purgeInventory(); break;
 }
}

// ---------------------------------------------------------------------------
// Individual setting modals
// ---------------------------------------------------------------------------

function _sectionBody(title, intro, blocks) {
 const body = el('div', { className: 'settings-section-body' });
 if (intro) body.appendChild(el('p', { className: 'settings-intro' }, intro));
 blocks.forEach(b => {
 if (b.heading) body.appendChild(el('h4', { className: 'settings-subhead' }, b.heading));
 if (b.text) body.appendChild(el('p', { className: 'settings-text' }, b.text));
 if (b.list) {
 const ul = el('ul', { className: 'settings-list' });
 b.list.forEach(li => ul.appendChild(el('li', {}, li)));
 body.appendChild(ul);
 }
 if (b.control) body.appendChild(b.control);
 });
 return body;
}

// Sort Order
function showSortModal() {
 const currentSort = localStorage.getItem('cc-sort') || 'default';
 const control = el('select', { 
 id: 'settings-sort',
 className: 'settings-select',
 onchange: (e) => { 
 localStorage.setItem('cc-sort', e.target.value); 
 dispatchSettingsChange('sort', e.target.value);
 closeModal('modal-settings-sort');
 }
 }, [
 { value: 'default', label: 'Default (Year → Mint)' },
 { value: 'az', label: 'Alphabetical (A–Z)' },
 { value: 'value-desc', label: 'Value (High → Low)' },
 { value: 'completion', label: 'Completion %' },
 ].map(o => el('option', { value: o.value, selected: o.value === currentSort }, o.label)));
 
 const body = _sectionBody(
 'Default Sort Order',
 'Choose how coins are sorted by default in the catalog.',
 [{ control }]
 );
 createModal('modal-settings-sort', 'Default Sort Order', body, null);
}

// Theme
function showThemeModal() {
 const currentTheme = localStorage.getItem('cc-theme') || 'dark';
 const control = el('select', { 
 id: 'settings-theme',
 className: 'settings-select',
 onchange: (e) => { 
 localStorage.setItem('cc-theme', e.target.value); 
 setTheme(e.target.value);
 closeModal('modal-settings-theme');
 }
 }, [
 { value: 'dark', label: 'Dark' },
 { value: 'midnight', label: 'Midnight' },
 { value: 'gold', label: 'Gold' },
 { value: 'copper', label: 'Copper' },
 { value: 'ocean', label: 'Ocean' },
 { value: 'forest', label: 'Deep Forest' },
 { value: 'cyberpunk', label: 'Cyberpunk' },
 { value: 'neon', label: 'Neon' },
 { value: 'matrix', label: 'Matrix' },
 { value: 'light', label: 'Light' },
 { value: 'silver', label: 'Silver' },
 { value: 'paper', label: 'Aged Paper' },
 { value: 'custom1', label: 'Custom 1' },
 { value: 'custom2', label: 'Custom 2' },
 { value: 'custom3', label: 'Custom 3' },
 ].map(o => el('option', { value: o.value, selected: o.value === currentTheme }, o.label)));
 
 const body = _sectionBody(
 'Color Theme',
 'Choose a color theme for the app. Custom themes can be created in the Theme Designer.',
 [{ control }]
 );
 createModal('modal-settings-theme', 'Color Theme', body, null);
}

// Card Layout
function showCardLayoutModal() {
 const isExpand = localStorage.getItem('cc-expand-cards') === 'true';
 const control = el('select', { 
 id: 'settings-card-layout',
 className: 'settings-select',
 onchange: (e) => { 
 const isExpand = e.target.value === 'expand';
 localStorage.setItem('cc-expand-cards', isExpand); 
 dispatchSettingsChange('cc-expand-cards', isExpand);
 closeModal('modal-settings-card-layout');
 }
 }, [
 { value: 'normal', label: 'Normal (Fit Content)', selected: !isExpand },
 { value: 'expand', label: 'Auto-Expand (Fill Empty Space)', selected: isExpand },
 ].map(o => el('option', { value: o.value, selected: o.selected }, o.label)));
 
 const body = _sectionBody(
 'Card Layout',
 'Normal cards size to their content. Auto-expand stretches cards to fill available space.',
 [{ control }]
 );
 createModal('modal-settings-card-layout', 'Card Layout', body, null);
}

// Folder Color
function showFolderColorModal() {
 const currentFolderColor = localStorage.getItem('cc-folder-color') || 'green';
 const control = el('select', { 
 id: 'settings-folder-color',
 className: 'settings-select',
 onchange: (e) => applyFolderColor(e.target.value)
 }, [
 { value: 'green', label: 'Green' },
 { value: 'blue', label: 'Blue' },
 { value: 'brown', label: 'Brown' },
 { value: 'black', label: 'Black' },
 { value: 'purple', label: 'Purple' },
 { value: 'red', label: 'Red' },
 { value: 'gray', label: 'Gray' },
 ].map(o => el('option', { value: o.value, selected: o.value === currentFolderColor }, o.label)));
 
 const body = _sectionBody(
 'Album Folder Color',
 'Background color for the album view folders.',
 [{ control }]
 );
 createModal('modal-settings-folder-color', 'Album Folder Color', body, null);
}

// Card Visibility
function showCardVisibilityModal() {
 const cards = [
 {key: 'card-completion', label: 'Collection Completion' },
 {key: 'card-portfolio', label: 'Portfolio Overview' },
 {key: 'card-bullion', label: 'Bullion Holdings' },
 {key: 'card-coinweight', label: 'Bulk Coins' },
 {key: 'card-spot', label: 'Spot Prices' },
 {key: 'card-scrap', label: 'Scrap Metal' },
 {key: 'card-paper', label: 'Paper Currency' },
 {key: 'card-custom', label: 'Other Collectibles' },
 {key: 'card-wishlist', label: 'Wishlist' },
 ];
 
 const controls = cards.map(c => {
 const checked = localStorage.getItem(c.key) !== 'false';
 return el('div', { className: 'settings-toggle-row' }, [
 el('input', { type: 'checkbox', id: c.key, checked, onchange: (e) => {
 localStorage.setItem(c.key, e.target.checked);
 dispatchSettingsChange(c.key, e.target.checked);
 }}),
 el('label', { for: c.key }, c.label),
 ]);
 });
 
 const body = _sectionBody(
 'Dashboard Card Visibility',
 'Show or hide entire dashboard cards.',
 [{ control: el('div', { className: 'settings-toggle-group' }, controls) }]
 );
 createModal('modal-settings-card-visibility', 'Card Visibility', body, null);
}

// Display Filters
function showDisplayFiltersModal() {
 const hideProofs = localStorage.getItem('cc-hide-proofs') === 'true';
 const hideErrors = localStorage.getItem('cc-hide-errors') === 'true';
 const keyDatesOnly = localStorage.getItem('cc-key-dates-only') === 'true';
 
 const controls = [
 {key: 'cc-hide-proofs', label: 'Hide proof coins', checked: hideProofs },
 {key: 'cc-hide-errors', label: 'Hide error/variety coins', checked: hideErrors },
 {key: 'cc-key-dates-only', label: 'Key dates only', checked: keyDatesOnly },
 ].map(c => 
 el('div', { className: 'settings-toggle-row' }, [
 el('input', { type: 'checkbox', id: c.key, checked: c.checked, onchange: (e) => {
 localStorage.setItem(c.key, e.target.checked);
 dispatchSettingsChange(c.key, e.target.checked);
 }}),
 el('label', { for: c.key }, c.label),
 ])
 );
 
 const body = _sectionBody(
 'Display Filters',
 'Control which coins appear in the catalog. Changes apply on next load.',
 [{ control: el('div', { className: 'settings-toggle-group' }, controls) }]
 );
 createModal('modal-settings-display-filters', 'Display Filters', body, null);
}

// Bullion Visibility
function showBullionVisibilityModal() {
    const prices = getSpotPrices();
 const metals = [
 {key: 'gold', label: 'Gold', color: '#d4af37' },
 {key: 'silver', label: 'Silver', color: '#94a3b8' },
 {key: 'platinum', label: 'Platinum', color: '#38bdf8' },
 {key: 'palladium', label: 'Palladium', color: '#a78bfa' },
 {key: 'copper', label: 'Copper', color: '#b45309' },
 ];
 
 const controls = metals.map(m => {
 const checked = localStorage.getItem(`cc-bullion-vis-${m.key}`) !== 'false';
 return el('div', { className: 'settings-toggle-row' }, [
 el('input', { type: 'checkbox', id: `cc-bullion-vis-${m.key}`, checked, onchange: (e) => {
 localStorage.setItem(`cc-bullion-vis-${m.key}`, e.target.checked);
 dispatchSettingsChange('cc-bullion-vis', { [m.key]: e.target.checked });
 }}),
 el('label', { for: `cc-bullion-vis-${m.key}`, style: `color: ${m.color}; font-weight: 600;` }, m.label),
 ]);
 });
 
 const body = _sectionBody(
 'Bullion Metals Visibility',
 'Show/hide metal rows in the Bullion Holdings card.',
 [{ control: el('div', { className: 'settings-toggle-group' }, controls) }]
 );
 createModal('modal-settings-bullion-vis', 'Bullion Metals', body, null);
}

// Export
function showExportModal() {
    const control = el('div', { className: 'settings-action-group' }, [
 el('button', { className: 'btn-primary', onclick: () => window.location.href = '/api/backup/zip' }, 'Download Full Backup (ZIP)'),
 el('button', { className: 'btn-secondary', onclick: () => window.location.href = '/api/backup/full' }, 'Export All (CSV)'),
 el('button', { className: 'btn-secondary', onclick: backupJSON }, 'Backup JSON'),
 ]);
 
 const body = _sectionBody(
 'Export & Backup',
 'Download your collection data for safekeeping or migration.',
 [{ control }]
 );
 createModal('modal-settings-export', 'Export & Backup', body, null);
}

// Import
function showImportModal() {
    
    const createFileInput = (accept, handler) => {
 const input = document.createElement('input');
 input.type = 'file';
 input.accept = accept;
 input.style.display = 'none';
 input.onchange = (e) => handler(e.target.files[0]);
 document.body.appendChild(input);
 return input;
 };
 
 const restoreZipInput = createFileInput('.zip', restoreZIP);
 const restoreInput = createFileInput('.json', restoreJSON);
 const importInput = createFileInput('.csv', importCSV);
 
 const control = el('div', { className: 'settings-action-group' }, [
 el('button', { className: 'btn-primary', onclick: () => restoreZipInput.click() }, 'Restore Full Backup (ZIP)'),
 el('button', { className: 'btn-secondary', onclick: () => restoreInput.click() }, 'Restore JSON'),
 el('button', { className: 'btn-secondary', onclick: () => importInput.click() }, 'Import CSV'),
 ]);
 
 const body = _sectionBody(
 'Import & Restore',
 'Restore from a previous backup or import CSV data.',
 [{ control }]
 );
 createModal('modal-settings-import', 'Import & Restore', body, null);
}

// Cloud Sync
async function showCloudSyncModal() {
    const {
        getAllProviders, getCurrentProvider, setCurrentProvider,
        getProviderAuthState, setProviderAuthState,
        syncToCloud, syncFromCloud,
        authenticateGoogleDrive, authenticateOneDrive, authenticateDropbox
    } = await import('./sync.js?v=7');

    const providers = getAllProviders();

    const render = () => {
        const panel = el('div');
        const currentProvider = getCurrentProvider();
        const currentProviderId = currentProvider ? currentProvider.id : null;

        // Provider Selection
        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h4', { className: 'settings-subhead' }, 'Cloud Provider'),
            el('p', { className: 'settings-text' }, 'Choose a cloud provider to automatically backup and sync your collection data.'),
            el('div', { style: 'display:flex; flex-direction:column; gap:8px;' },
                providers.map(p => {
                    const isSelected = p.id === currentProviderId;
                    return el('button', {
                        style: `display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; border:2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border-light)'}; background:${isSelected ? 'var(--color-bg-active)' : 'var(--color-bg-card)'}; color:var(--color-text-main); cursor:pointer; text-align:left; width:100%; font-size:0.85em;`,
                        onclick: () => {
                            setCurrentProvider(p.id);
                            const body = document.getElementById('modal-settings-cloud');
                            if (body) {
                                const bc = body.querySelector('.modal-body');
                                if (bc) { bc.innerHTML = ''; bc.appendChild(render()); }
                            }
                        }
                    }, [
                        el('span', { style: 'flex:1; font-weight:' + (isSelected ? '700' : '400') + ';' }, p.name),
                        isSelected ? el('span', { style: 'color:var(--color-accent); font-size:0.9em;' }, '✓ Selected') : null,
                    ]);
                })
            )
        ]));

        if (currentProviderId) {
            const provider = providers.find(p => p.id === currentProviderId);
            const authState = getProviderAuthState(currentProviderId);

            panel.appendChild(el('div', { className: 'settings-section' }, [
                el('h4', { className: 'settings-subhead' }, `${provider.name} Configuration`),
                el('p', { className: 'settings-text' }, provider.description),

                currentProviderId === 'webdav' ? el('div', { style: 'display: flex; flex-direction: column; gap: 12px;' }, [
                    el('div', { className: 'form-group' }, [
                        el('label', {}, 'WebDAV Server URL'),
                        el('input', {
                            type: 'text',
                            value: authState.url || "",
                            placeholder: 'https://your-nextcloud.com/remote.php/dav/files/username/',
                            onchange: (e) => setProviderAuthState('webdav', { ...authState, url: e.target.value }),
                        })
                    ]),
                    el('div', { className: 'form-group' }, [
                        el('label', {}, 'Username'),
                        el('input', {
                            type: 'text',
                            value: authState.username || "",
                            onchange: (e) => setProviderAuthState('webdav', { ...authState, username: e.target.value }),
                        })
                    ]),
                    el('div', { className: 'form-group' }, [
                        el('label', {}, 'Password'),
                        el('input', {
                            type: 'password',
                            value: authState.password || "",
                            onchange: (e) => setProviderAuthState('webdav', { ...authState, password: e.target.value }),
                        })
                    ]),
                ]) : el('div', { style: 'padding: 12px; background: var(--color-bg); border-radius: 8px; color: var(--color-text-muted); font-size: var(--font-size-sm); text-align: center;' },
                    'This provider requires a backend server with OAuth support. Not available from this app. Use WebDAV instead — it works right now.'
                ),
            ]));

            // Sync Actions — only show for WebDAV (others don't actually work)
            if (currentProviderId === 'webdav') {
                panel.appendChild(el('div', { className: 'settings-section' }, [
                    el('h4', { className: 'settings-subhead' }, 'Sync Actions'),
                    el('p', { className: 'settings-text' }, 'Enter your server details above, then click Backup. This sends your full collection backup as a JSON file to the WebDAV server.'),
                    el('div', { className: 'settings-action-group' }, [
                        el('button', { className: 'btn-primary', onclick: syncToCloud }, 'Backup to WebDAV'),
                        el('button', { className: 'btn-secondary', onclick: syncFromCloud }, 'Restore from WebDAV'),
                    ])
                ]));
            }
        }
        return panel;
    };

    const body = _sectionBody(
        'Cloud Sync',
        'Configure cloud backup and sync settings.',
        [{ control: render() }]
    );
    createModal('modal-settings-cloud', 'Cloud Sync', body, null);
}

// Pricing Rules - already handled by openPricingRulesModal()

// Completion Dashboard - already handled by openCompletionDashboard()

// Purge Inventory - already handled by purgeInventory()

// ============================================================================
// Custom Dashboard Card Creator
// ============================================================================

function showCustomCardModal() {
    // Get existing custom cards
 let customCards = [];
 try {
 customCards = JSON.parse(localStorage.getItem('cc-custom-cards') || '[]');
 } catch (e) {
 customCards = [];
 }
 
 // Available data sources
 const dataSources = [
 { id: 'totalValue', label: 'Total Portfolio Value', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'totalMelt', label: 'Total Melt Value', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'collectibleValue', label: 'Collectible Premium', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'coinCount', label: 'Total Coins', formatter: v => v.toLocaleString() },
 { id: 'itemCount', label: 'Total Items', formatter: v => v.toLocaleString() },
 { id: 'completion', label: 'Completion %', formatter: v => v + '%' },
 { id: 'goldMelt', label: 'Gold Melt', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'silverMelt', label: 'Silver Melt', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'bulkValue', label: 'Bulk Coins Value', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'paperValue', label: 'Paper Currency Value', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'custom', label: 'Custom Text/Number', formatter: v => v },
 ];
 
 // Available display styles
 const displayStyles = [
 { id: 'bigNumber', label: 'Big Number (centered)' },
 { id: 'labelValue', label: 'Label + Value' },
 { id: 'progress', label: 'Progress Bar' },
 { id: 'trend', label: 'Trend Arrow + Value' },
 ];
 
 const body = el('div', { className: 'custom-card-form' }, [
 // List existing custom cards
 customCards.length > 0 ? el('div', { className: 'custom-cards-list' }, [
 el('h4', { className: 'settings-subhead' }, 'Your Custom Cards'),
 ...customCards.map((card, idx) => el('div', { className: 'custom-card-item' }, [
 el('div', { className: 'custom-card-info' }, [
 el('strong', {}, card.title),
 el('span', { className: 'custom-card-meta' }, `${card.dataSource} • ${card.displayStyle}`),
 ]),
 el('button', { 
 className: 'btn-danger btn-sm',
 onclick: () => {
 customCards.splice(idx, 1);
 localStorage.setItem('cc-custom-cards', JSON.stringify(customCards));
 showToast('Custom card deleted', 'success');
 closeModal('modal-custom-card');
 showCustomCardModal();
 }
 }, 'Delete'),
 ]))
 ]) : null,
 
 el('hr', { style: 'margin: 16px 0;' }),
 el('h4', { className: 'settings-subhead' }, 'Create New Custom Card'),
 
 // Title
 el('div', { className: 'form-group' }, [
 el('label', {}, 'Card Title'),
 el('input', { 
 type: 'text', 
 id: 'custom-card-title', 
 placeholder: 'e.g., "My Silver Stack"',
 required: true
 })
 ]),
 
 // Data Source
 el('div', { className: 'form-group' }, [
 el('label', {}, 'Data Source'),
 el('select', { id: 'custom-card-source' }, [
 ...dataSources.map(ds => el('option', { value: ds.id }, ds.label))
 ])
 ]),
 
 // Display Style
 el('div', { className: 'form-group' }, [
 el('label', {}, 'Display Style'),
 el('select', { id: 'custom-card-style' }, [
 ...displayStyles.map(ds => el('option', { value: ds.id }, ds.label))
 ])
 ]),
 
 // Optional: Custom value (for custom text/number)
 el('div', { className: 'form-group', id: 'custom-card-custom-group', style: 'display: none;' }, [
 el('label', {}, 'Custom Value'),
 el('input', { 
 type: 'text', 
 id: 'custom-card-custom-value', 
 placeholder: 'Enter custom text or number'
 })
 ]),
 
 // Optional: Background color
 el('div', { className: 'form-group' }, [
 el('label', {}, 'Background Color'),
 el('input', { 
 type: 'color', 
 id: 'custom-card-bg-color', 
 value: '#2d4a2d'
 })
 ]),
 
 // Optional: Text color
 el('div', { className: 'form-group' }, [
 el('label', {}, 'Text Color'),
 el('input', { 
 type: 'color', 
 id: 'custom-card-text-color', 
 value: '#ffffff'
 })
 ]),
 ]);
 
 const modalId = 'modal-custom-card';
 const footer = el('div', { className: 'modal-footer' }, [
 el('button', { className: 'btn-secondary', onclick: () => closeModal(modalId) }, 'Cancel'),
 el('button', { 
 className: 'btn-primary', 
 onclick: () => {
 const title = document.getElementById('custom-card-title').value.trim();
 const dataSource = document.getElementById('custom-card-source').value;
 const displayStyle = document.getElementById('custom-card-style').value;
 const customValue = document.getElementById('custom-card-custom-value').value;
 const bgColor = document.getElementById('custom-card-bg-color').value;
 const textColor = document.getElementById('custom-card-text-color').value;
 
 if (!title) {
 showToast('Please enter a card title', 'error');
 return;
 }
 
 const newCard = {
 id: Date.now().toString(),
 title,
 dataSource,
 displayStyle,
 customValue: dataSource === 'custom' ? customValue : null,
 bgColor,
 textColor,
 createdAt: new Date().toISOString()
 };
 
 customCards.push(newCard);
 localStorage.setItem('cc-custom-cards', JSON.stringify(customCards));
 showToast('Custom card created!', 'success');
 closeModal(modalId);
 
 // Refresh dashboard
 import('./portfolio.js').then(m => {
 if (m.renderDashboard) m.renderDashboard();
 });
 }
 }, 'Create Card'),
 ]);
 
 createModal(modalId, 'Custom Dashboard Card', body, footer);
 
 // Show/hide custom value field based on data source
 document.getElementById('custom-card-source').addEventListener('change', (e) => {
 const group = document.getElementById('custom-card-custom-group');
 group.style.display = e.target.value === 'custom' ? 'block' : 'none';
 });
}

function renderCustomCardsOnDashboard() {
 let customCards = [];
 try {
 customCards = JSON.parse(localStorage.getItem('cc-custom-cards') || '[]');
 } catch (e) {
 customCards = [];
 }
 
 if (customCards.length === 0) return;
 
 const dashboardGrid = document.getElementById('dashboard-grid');
 if (!dashboardGrid) return;
 
 // Import required functions
 import('./state.js?v=4').then(({ getPortfolioData, getSpotPrices }) => {
 const portfolio = getPortfolioData() || {};
 const prices = getSpotPrices() || {};
 
 customCards.forEach(card => {
 let value = 0;
 
 // Calculate value based on data source
 switch (card.dataSource) {
 case 'totalValue':
 value = portfolio.total_estimated_value || 0;
 break;
 case 'totalMelt':
 value = portfolio.total_melt || 0;
 break;
 case 'collectibleValue':
 value = portfolio.collectable_value || 0;
 break;
 case 'coinCount':
 value = portfolio.total_physical_coins || 0;
 break;
 case 'itemCount':
 value = portfolio.total_items || 0;
 break;
 case 'completion':
 // Calculate completion percentage
 // This would need section data
 value = 0;
 break;
 case 'goldMelt':
 value = portfolio.gold_coin_melt || 0;
 break;
 case 'silverMelt':
 value = portfolio.silver_coin_melt || 0;
 break;
 case 'bulkValue':
 value = portfolio.bulk_coins_value || 0;
 break;
 case 'paperValue':
 value = portfolio.paper_value || 0;
 break;
 case 'custom':
 value = card.customValue || 0;
 break;
 }
 
 // Find data source for formatter
 const dataSources = [
 { id: 'totalValue', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'totalMelt', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'collectibleValue', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'coinCount', formatter: v => v.toLocaleString() },
 { id: 'itemCount', formatter: v => v.toLocaleString() },
 { id: 'completion', formatter: v => v + '%' },
 { id: 'goldMelt', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'silverMelt', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'bulkValue', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'paperValue', formatter: v => '$' + v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
 { id: 'custom', formatter: v => v },
 ];
 
 const ds = dataSources.find(d => d.id === card.dataSource);
 const formattedValue = ds ? ds.formatter(value) : value;
 
 // Create card element
 const cardEl = document.createElement('div');
 cardEl.className = 'card dashboard-card custom-dashboard-card';
 cardEl.style.backgroundColor = card.bgColor;
 cardEl.style.color = card.textColor;
 cardEl.style.gridColumn = 'span 1';
 cardEl.innerHTML = `
 <div class="card-title">${card.title}</div>
 <div class="custom-card-value" style="font-size: 2rem; font-weight: 700; text-align: center; padding: 1rem;">
 ${formattedValue}
 </div>
 `;
 
 dashboardGrid.appendChild(cardEl);
 });
 });
}

// Expose for HTML onclick handlers
window.toggleSettingsDropdown = toggleSettingsDropdown;
window.closeSettingsDropdown = closeSettingsDropdown;
window.openSettingsSection = openSettingsSection;
