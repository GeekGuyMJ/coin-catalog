/**
 * settingsDropdown.js - Coin Catalog v2
 * Settings button dropdown menu (replaces the full-screen Settings modal).
 * Clicking "Settings" opens a small popover with categorized settings options;
 * each option opens a clean, readable modal.
 */

import { el, escHtml } from './utils.js';
import { getSpotPrices } from './state.js';
import { setTheme, getCustomThemeName } from './themes.js';
import { isSelfHosted } from './env.js';
import { showToast } from './notifications.js';
import { createModal, closeModal, applyFolderColor, backupJSON, restoreZIP, restoreJSON, importCSV, dispatchSettingsChange } from './modals.js';
import { openTypeManager } from './typeManager.js';
import { openPricingRulesModal, openCompletionDashboard, filterMissingImages, openImageManager, openPrintChecklist, openCustomThemeDesigner, openResetDataModal, purgeInventory, saveCurrentImagesAsDefaults } from './modals.js';

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
  
 // Appearance
 {key: 'theme', label: 'Theme', section: 'appearance' },
 {key: 'folderColor', label: 'Album Folder Color', section: 'appearance' },
 {key: 'themeDesigner', label: 'Custom Theme Designer', section: 'appearance' },
 {key: 'cardVisibility', label: 'Dashboard Card Visibility', section: 'appearance' },
 
 // Accessibility
 {key: 'colorblind', label: 'Colorblind Assist', section: 'accessibility' },
 
 // Catalog
 {key: 'displayFilters', label: 'Display Filters', section: 'catalog' },
 {key: 'bullionVis', label: 'Bullion Metals Visibility', section: 'catalog' },
 {key: 'typeManager', label: 'Type & Image Manager', section: 'catalog' },

 // Data & Backup
 
 // Data & Backup
 {key: 'export', label: 'Export & Backup', section: 'data' },
 {key: 'import', label: 'Import & Restore', section: 'data' },
 
 // Cloud Sync
 {key: 'cloudSync', label: 'Cloud Sync', section: 'cloud' },
 
 // Advanced
 {key: 'pricingRules', label: 'Pricing Rules', section: 'advanced' },
 {key: 'completion', label: 'Completion Dashboard', section: 'advanced' },
 {key: 'imageManager', label: 'Coin Image Bank', section: 'advanced' },
 {key: 'printChecklist', label: 'Print Checklist', section: 'advanced' },
 {key: 'customCard', label: 'Custom Dashboard Card', section: 'advanced' },
 
 // Danger Zone
 {key: 'purgeInventory', label: 'Reset Data / Images', section: 'danger' },
 ];

 // Group by section
 const sections = {};
 items.forEach(it => {
 if (!sections[it.section]) sections[it.section] = [];
 sections[it.section].push(it);
 });

 const sectionOrder = ['general', 'appearance', 'accessibility', 'catalog', 'data', 'cloud', 'advanced', 'danger'];
 const sectionLabels = {
 general: 'General',
 appearance: 'Appearance',
 accessibility: 'Accessibility',
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
 const sectionHeader = el('div', { className: 'settings-menu-section' },
 el('span', { className: 'settings-menu-section-label' }, sectionLabels[sectionKey])
 );
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
 item.appendChild(el('span', { className: 'settings-menu-label' })); item.lastChild.textContent = _safeText(it.label);
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
 
 // Appearance
 case 'folderColor': showFolderColorModal(); break;
 case 'themeDesigner': openCustomThemeDesigner(1); break;
 case 'cardVisibility': showCardVisibilityModal(); break;
 
 // Accessibility
 case 'colorblind': showColorblindModal(); break;
 
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
    case 'typeManager': openTypeManager(); break;
 case 'imageManager': openImageManager(); break;
 case 'saveDefaults': saveCurrentImagesAsDefaults(); break;
 case 'printChecklist': openPrintChecklist(); break;
 case 'customCard': showCustomCardModal(); break;
 
 // Danger Zone
    /* 2026-10-01: went straight to purgeInventory(), which is a single
       yes/no and deletes inventory with no choice offered. But
       modals.js already has openResetDataModal() -- two options, each with
       its own two-step confirm:
           A) Factory Reset          full_reset  (data + images -> defaults)
           B) Clear Data, Keep Images data_only  (data gone, images kept)
       It was fully implemented and never called. Route the menu item at
       it instead. purgeInventory() stays exported for other callers. */
    case 'purgeInventory': openResetDataModal(); break;
 }
}

// ---------------------------------------------------------------------------
// Individual setting modals
// ---------------------------------------------------------------------------

function _safeText(val) {
 if (val == null) return '';
 return (val instanceof Node) ? (val.textContent || String(val)) : String(val);
}

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
 if (b.control && b.control.nodeType === 1) body.appendChild(b.control);
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
 { value: 'gold', label: 'Royal Gold' },
 { value: 'copper', label: 'Copper' },
 { value: 'ocean', label: 'Ocean' },
 { value: 'forest', label: 'Deep Forest' },
 { value: 'cyberpunk', label: 'Cyberpunk' },
 { value: 'neon', label: 'Neon' },
 { value: 'matrix', label: 'Matrix' },
 { value: 'violet', label: 'Violet' },
 { value: 'noir', label: 'Film Noir' },
 { value: 'light', label: 'Light' },
 { value: 'silver', label: 'Mint Treasury' },
 { value: 'paper', label: 'Aged Paper' },
 { value: 'custom1', label: getCustomThemeName(1) },
 { value: 'custom2', label: getCustomThemeName(2) },
 { value: 'custom3', label: getCustomThemeName(3) },
 ].map(o => el('option', { value: o.value, selected: o.value === currentTheme }, o.label)));
 
 const body = _sectionBody(
 'Color Theme',
 'Choose a color theme for the app. Custom themes can be created in the Theme Designer.',
 [{ control }]
 );
 createModal('modal-settings-theme', 'Color Theme', body, null);
}

// Colorblind Assist
function showColorblindModal() {
    const isOn = localStorage.getItem('cc-colorblind') === '1';
    const toggle = el('label', { className: 'settings-toggle-row', style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;' }, ...[
        el('span', {}, 'Colorblind Assist'),
        el('input', {
            type: 'checkbox',
            checked: isOn,
            onchange: (e) => {
                const on = e.target.checked;
                localStorage.setItem('cc-colorblind', on ? '1' : '0');
                applyColorblindAssist(on);
                dispatchSettingsChange('cc-colorblind', on);
            }
        })
    ]);
    const body = _sectionBody(
        'Colorblind Assist',
        'Recolor color-coded elements (badges, album folders, status markers) into a palette that stays distinguishable for red-green color vision deficiency (deuteranopia / protanopia). Key dates, proofs, and errors are also labeled with distinct icons and text, so you are never relying on hue alone.',
        [{ control: toggle }]
    );
    createModal('modal-settings-colorblind', 'Colorblind Assist', body, null);
}

// Apply or remove the colorblind assist body class
function applyColorblindAssist(on) {
    document.body.classList.toggle('cc-colorblind', !!on);
}
window.applyColorblindAssist = applyColorblindAssist;

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

// Card Visibility (GGMJ-431: dynamic 15-card list persisted in cc-card-visibility)
function showCardVisibilityModal() {
 const grid = document.getElementById('dashboard-grid');
 const seen = new Set();
 const cards = [];
 const addCard = (elCard) => {
  if (!elCard || !elCard.id || seen.has(elCard.id)) return;
  seen.add(elCard.id);
  const titleEl = elCard.querySelector('.card-title');
  const ariaEl = elCard.querySelector('[aria-label]');
  const srEl = elCard.querySelector('.sr-only');
  const rawTitle = (titleEl ? titleEl.textContent : '').replace(/\?$/, '').trim();
  const label = rawTitle
   || (ariaEl ? (ariaEl.getAttribute('aria-label') || '') : '').trim()
   || (srEl ? srEl.textContent : '').trim()
   || elCard.id.replace(/^card-/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  cards.push({ key: elCard.id, label });
 };
 const collect = () => {
  seen.clear();
  cards.length = 0;
  if (grid) grid.querySelectorAll('[id^=card-]').forEach(addCard);
  document.querySelectorAll('[id^=card-]').forEach(addCard);
 };
 collect();

 const readVis = () => {
  try {
   const v = JSON.parse(localStorage.getItem('cc-card-visibility') || '{}');
   return (v && typeof v === 'object') ? v : {};
  } catch (e) { return {}; }
 };
 let vis = readVis();

 const applyCardVisibility = (key, visible) => {
  document.querySelectorAll('#' + CSS.escape(key)).forEach(elCard => {
   elCard.style.display = visible ? '' : 'none';
  });
 };

 const buildControls = (list) => list.map(c => {
  const checked = vis[c.key] !== false;
  return el('div', { className: 'settings-toggle-row' }, [
   el('input', { type: 'checkbox', id: 'vis-' + c.key, checked, onchange: (e) => {
    const on = e.target.checked;
    if (on) delete vis[c.key]; else vis[c.key] = false;
    localStorage.setItem('cc-card-visibility', JSON.stringify(vis));
    applyCardVisibility(c.key, on);
    dispatchSettingsChange('cc-card-visibility', vis);
   }}),
   el('label', { for: 'vis-' + c.key }, c.label),
  ]);
 });

 const group = el('div', { className: 'settings-toggle-group' }, buildControls(cards));
 const body = _sectionBody(
  'Dashboard Card Visibility',
  'Show or hide entire dashboard cards.',
  [{ control: group }]
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
 
 let visMap = { gold: true, silver: true, platinum: true, palladium: true, copper: true };
 try {
 const raw = localStorage.getItem('cc-bullion-vis');
 if (raw) Object.assign(visMap, JSON.parse(raw));
 } catch (_) {}
 const controls = metals.map(m => {
 const per = localStorage.getItem(`cc-bullion-vis-${m.key}`);
 const checked = per !== null ? (per === 'true' || per === '1') : (visMap[m.key] !== false);
 return el('div', { className: 'settings-toggle-row' }, [
 el('input', { type: 'checkbox', id: `cc-bullion-vis-${m.key}`, checked, onchange: (e) => {
 visMap[m.key] = e.target.checked;
 localStorage.setItem(`cc-bullion-vis-${m.key}`, e.target.checked);
 localStorage.setItem('cc-bullion-vis', JSON.stringify(visMap));
 dispatchSettingsChange('cc-bullion-vis', visMap);
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
async function _exportCSVLocal() {
    try {
        const { db } = await import('./db.js');
        const inv = await db.user_inventory.toArray();
        const refs = await db.coins_reference.toArray();
        const refMap = {};
        refs.forEach(r => { refMap[r.id] = r; refMap[String(r.id)] = r; });
        const rows = [['Coin ID', 'Section', 'Denomination', 'Coin Type', 'Year', 'Mint Mark', 'Quantity', 'Grade', 'Purchase Price', 'Current Value', 'Notes']];
        inv.forEach(item => {
            const c = refMap[item.coin_ref_id] || {};
            rows.push([
                item.coin_ref_id || '',
                c.section || '',
                c.denomination || '',
                c.coin_type || '',
                c.year || '',
                c.mint_mark || '',
                item.quantity || 1,
                item.grade || '',
                item.purchase_price || '',
                item.current_value || '',
                (item.personal_notes || item.notes || '').replace(/\r?\n/g, ' ')
            ]);
        });
        const csvContent = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'coin_catalog_export_' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
        showToast('CSV exported successfully!', 'success');
    } catch (e) {
        showToast('CSV export failed: ' + e.message, 'error');
    }
}

function showExportModal() {
    const buttons = [];
    if (isSelfHosted) {
        buttons.push(el('button', { className: 'btn-primary', onclick: () => window.location.href = '/api/backup/zip' }, 'Download Full Backup (ZIP)'));
        buttons.push(el('button', { className: 'btn-secondary', onclick: () => window.location.href = '/api/backup/full' }, 'Export All (CSV)'));
        buttons.push(el('button', { className: 'btn-secondary', onclick: backupJSON }, 'Backup JSON'));
    } else {
        buttons.push(el('button', { className: 'btn-primary', onclick: backupJSON }, 'Download Full Backup (JSON)'));
        buttons.push(el('button', { className: 'btn-secondary', onclick: _exportCSVLocal }, 'Export All (CSV)'));
    }
    const control = el('div', { className: 'settings-action-group' }, buttons);
 
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
 
 const importButtons = [];
 if (isSelfHosted) {
   importButtons.push(el('button', { className: 'btn-primary', onclick: () => restoreZipInput.click() }, 'Restore Full Backup (ZIP)'));
   importButtons.push(el('button', { className: 'btn-secondary', onclick: () => restoreInput.click() }, 'Restore Backup (JSON)'));
 } else {
   importButtons.push(el('button', { className: 'btn-primary', onclick: () => restoreInput.click() }, 'Restore Full Backup (JSON)'));
 }
 importButtons.push(el('button', { className: 'btn-secondary', onclick: () => importInput.click() }, 'Import Inventory (CSV)'));
 const control = el('div', { className: 'settings-action-group' }, importButtons);
 
 const body = _sectionBody(
 'Import & Restore',
 'Restore from a previous backup or import CSV data.',
 [{ control }]
 );
 createModal('modal-settings-import', 'Import & Restore', body, null);
}

// Cloud Sync
export async function showCloudSyncModal() {
    const {
        getAllProviders, getCurrentProvider, setCurrentProvider,
        getProviderAuthState, setProviderAuthState,
        syncToCloud, syncFromCloud,
        isAutoBackupEnabled, setAutoBackupEnabled, getAutoBackupHours, setAutoBackupHours,
        authenticateGoogleDrive, authenticateOneDrive, authenticateDropbox,
        pickLocalBackupFileLocation
    } = await import('./sync.js');

    const providers = getAllProviders();
    // Default to localFile if no provider was ever selected so backup works out-of-the-box
    if (!getCurrentProvider() && providers.length > 0) {
        setCurrentProvider('localFile');
    }

    const render = () => {
        const panel = el('div');
        const currentProvider = getCurrentProvider();
        const currentProviderId = currentProvider ? currentProvider.id : 'localFile';

        const refreshCloudSyncPanel = () => {
            const modal = document.getElementById('modal-settings-cloud');
            if (!modal) return;
            const bc = modal.querySelector('.modal-body');
            if (bc) { bc.innerHTML = ''; bc.appendChild(render()); }
        };
        window.__refreshCloudSyncPanel = refreshCloudSyncPanel;

        // Provider Selection
        panel.appendChild(el('div', { className: 'settings-section' }, [
            el('h4', { className: 'settings-subhead' }, 'Backup Destination'),
            el('p', { className: 'settings-text' }, 'Choose how you want to back up, transfer, or sync your collection between Self-Hosted and Cloudflare.'),
            el('div', { style: 'display:flex; flex-direction:column; gap:8px;' },
                providers.map(p => {
                    const isSelected = p.id === currentProviderId;
                    return el('button', {
                        type: 'button',
                        style: `display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; border:2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border-light)'}; background:${isSelected ? 'color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-card))' : 'var(--color-bg-card)'}; color:var(--color-text-main); cursor:pointer; text-align:left; width:100%; font-size:0.86em;`,
                        onclick: () => {
                            setCurrentProvider(p.id);
                            refreshCloudSyncPanel();
                            try { window.dispatchEvent(new Event('backupSettingsChanged')); } catch (_) {}
                        }
                    }, [
                        el('span', { style: 'font-size:1.15em;' }, p.icon || '💾'),
                        el('span', { style: 'flex:1; font-weight:' + (isSelected ? '700' : '500') + ';' }, p.name),
                        isSelected ? el('span', { style: 'color:var(--color-accent); font-size:0.88em; font-weight:700;' }, '✓ Active') : null,
                    ]);
                })
            )
        ]));

        if (currentProviderId) {
            const provider = providers.find(p => p.id === currentProviderId) || providers[0];
            const authState = getProviderAuthState(currentProviderId);
            const currentOrigin = window.location.origin;
            const currentRedirectUri = window.location.href.split('?')[0].split('#')[0];

            const configChildren = [
                el('h4', { className: 'settings-subhead' }, `${provider.icon || ''} ${provider.name}`),
                el('p', { className: 'settings-text' }, _safeText(provider.description)),
            ];

            // Local Device File Provider UI (with remembered FileSystemFileHandle in IndexedDB)
            if (currentProviderId === 'localFile') {
                const rememberedName = (typeof getRememberedBackupFilename === 'function') ? getRememberedBackupFilename() : (authState.filename || '');
                configChildren.push(el('div', {
                    style: 'display:flex; flex-direction:column; gap:10px; padding:12px; border-radius:10px; background:var(--color-accord-bg); border:1px solid var(--color-border-light); margin-top:8px;'
                }, [
                    el('div', { style: 'font-size:0.83em; color:var(--color-text-main); line-height:1.45;' },
                        'Choose where your backup .json file is saved on your drive. Each app remembers its chosen file location for 1-click Back Up and Reload, or click Browse below to pick any .json backup file.'),
                    el('div', {
                        style: 'display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; padding:8px 10px; border-radius:8px; background:var(--color-bg-body); border:1px solid var(--color-border); font-size:0.82em;'
                    }, [
                        el('span', { style: 'color:var(--color-text-main); font-weight:600;' },
                            rememberedName
                                ? ('📍 Remembered File on This App: ' + rememberedName)
                                : '📍 No backup file chosen yet on this app — click Save or Browse below'),
                        el('button', {
                            type: 'button',
                            className: 'btn-secondary',
                            style: 'padding:4px 10px; font-size:0.78em;',
                            onclick: async () => {
                                await pickLocalBackupFileLocation(true);
                                refreshCloudSyncPanel();
                                try { window.dispatchEvent(new Event('backupSettingsChanged')); } catch (_) {}
                            }
                        }, rememberedName ? '📂 Change Save Location…' : '📂 Choose Save Location…'),
                    ]),
                    el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' }, [
                        el('button', {
                            type: 'button',
                            className: 'btn-primary',
                            style: 'flex:1; min-width:170px;',
                            onclick: async () => {
                                await pickLocalBackupFileLocation(false);
                                refreshCloudSyncPanel();
                                try { window.dispatchEvent(new Event('backupSettingsChanged')); } catch (_) {}
                            }
                        }, rememberedName ? ('💾 Back Up Now (' + rememberedName + ')') : '💾 Choose Location & Save Backup (.json)'),
                        rememberedName ? el('button', {
                            type: 'button',
                            className: 'btn-secondary',
                            style: 'flex:1; min-width:170px;',
                            onclick: async () => {
                                setCurrentProvider('localFile');
                                await syncFromCloud();
                            }
                        }, '🔄 Reload From ' + rememberedName) : null,
                    ]),
                    el('button', {
                        type: 'button',
                        className: 'btn-secondary',
                        style: 'width:100%; justify-content:center;',
                        onclick: async () => {
                            if (typeof pickAndRestoreLocalBackupFile === 'function') {
                                await pickAndRestoreLocalBackupFile();
                            }
                        }
                    }, '📂 Browse / Select a Backup .json File to Restore…'),
                ]));
            }

            // OAuth Sign-In for Google Drive & Dropbox (clean, no origin_mismatch helper box)
            if (currentProviderId === 'googleDrive' || currentProviderId === 'dropbox') {
                configChildren.push(el('div', { style: 'margin-bottom:12px; margin-top:8px;' }, [
                    el('button', {
                        type: 'button',
                        className: 'btn-primary',
                        style: 'width:100%;',
                        onclick: async () => {
                            const fn = provider.id === 'googleDrive' ? authenticateGoogleDrive : authenticateDropbox;
                            await fn();
                            refreshCloudSyncPanel();
                            try { window.dispatchEvent(new Event('backupSettingsChanged')); } catch (_) {}
                        }
                    }, authState.authenticated ? 'Re-authenticate with ' + provider.name : 'Sign in with ' + provider.name),
                ]));
            }

            if (currentProviderId === 'webdav') {
                configChildren.push(el('div', { style: 'display: flex; flex-direction: column; gap: 12px; margin-top:8px;' }, [
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
                ]));
            }

            panel.appendChild(el('div', { className: 'settings-section' }, configChildren));

            // Sync Actions — LocalFile & WebDAV always ready; OAuth after authentication
            const canSync = currentProviderId === 'localFile' || currentProviderId === 'webdav' || authState.authenticated;
            if (canSync) {
                panel.appendChild(el('div', { className: 'settings-section' }, [
                    el('h4', { className: 'settings-subhead' }, 'Automatic & Manual Sync'),
                    currentProviderId !== 'localFile' ? el('div', { className: 'settings-action-group', style: 'margin-bottom:12px;' }, [
                        el('button', { className: 'btn-primary', onclick: syncToCloud }, 'Backup to ' + provider.name),
                        el('button', { className: 'btn-secondary', onclick: syncFromCloud }, 'Restore from ' + provider.name),
                    ]) : null,
                    el('div', { className: 'form-group', style: 'margin-top:8px; border-top:1px solid var(--color-border-light); padding-top:12px;' }, ...[
                        el('div', { style: 'display:flex; align-items:center; gap:10px;' }, ...[
                            el('input', {
                                type: 'checkbox',
                                id: 'autobackup-toggle',
                                checked: isAutoBackupEnabled(),
                                onchange: (e) => {
                                    setAutoBackupEnabled(e.target.checked);
                                    refreshCloudSyncPanel();
                                    try { window.dispatchEvent(new Event('backupSettingsChanged')); } catch (e) {}
                                }
                            }),
                            el('label', { for: 'autobackup-toggle', style: 'flex:1; font-weight:600; cursor:pointer;' }, 'Automatic periodic backup'),
                        ]),
                        el('p', { className: 'settings-text', style: 'font-size:0.84em; margin-top:6px;' },
                            'Back up your collection to ' + provider.name + ' while the app is open once the interval below has elapsed.'),
                        el('div', { className: 'form-group', style: 'display:flex; align-items:center; gap:10px; margin-top:8px;' }, ...[
                            el('label', {}, 'Back up every'),
                            el('select', {
                                style: 'max-width:160px;',
                                onchange: (e) => {
                                    setAutoBackupHours(parseInt(e.target.value, 10));
                                    try { window.dispatchEvent(new Event('backupSettingsChanged')); } catch (e) {}
                                }
                            }, ...[
                                { v: 6, l: '6 hours' },
                                { v: 12, l: '12 hours' },
                                { v: 24, l: 'Daily (24 hours)' },
                                { v: 48, l: 'Every 2 days' },
                                { v: 72, l: 'Every 3 days' },
                                { v: 168, l: 'Weekly' },
                            ].map(o => el('option', { value: String(o.v), selected: getAutoBackupHours() === o.v }, o.l))),
                        ]),
                    ])
                ]));
            }
        }
        return panel;
    };

    const body = _sectionBody(
        'Backup & Cloud Sync',
        'Back up your collection to a local file or cloud storage.',
        [{ control: render() }]
    );
    createModal('modal-settings-cloud', 'Backup & Cloud Sync', body, null);
}

// ============================================================================
// Custom Dashboard Card Studio (Oct 29 v519 Overhaul)
// ============================================================================

export function showCustomCardModal(editCardId = null) {
    let customCards = [];
    try {
        customCards = JSON.parse(localStorage.getItem('cc-custom-cards') || '[]');
        if (!Array.isArray(customCards)) customCards = [];
    } catch (e) {
        customCards = [];
    }

    const editingCard = editCardId ? customCards.find(c => String(c.id) === String(editCardId)) : null;
    const sections = getSections() || [];

    const cardTypes = [
        { id: 'collection', label: '📦 Custom Collection / Vault Tracker (Interactive items + values)' },
        { id: 'goal',       label: '🎯 Set Completion / Stacking Goal (Live progress bar + target)' },
        { id: 'checklist',  label: '📝 Coin Show / Hunt Checklist & Budget (Interactive buy list)' },
        { id: 'metric',     label: '📊 Live Portfolio Metric / Ratio Spotlight' },
    ];

    const dataSources = [
        { id: 'goldSilverRatio', label: 'Live Gold-to-Silver Ratio (Au / Ag)' },
        { id: 'totalValue',      label: 'Total Portfolio Value ($)' },
        { id: 'totalMelt',       label: 'Total Melt Value ($)' },
        { id: 'collectibleValue',label: 'Collectible Premium ($)' },
        { id: 'goldMelt',        label: 'Gold Coins Melt ($)' },
        { id: 'silverMelt',      label: 'Silver Coins Melt ($)' },
        { id: 'rawBullion',      label: 'Raw Bullion Value ($)' },
        { id: 'bulkValue',       label: 'Bulk Coins Value ($)' },
        { id: 'paperValue',      label: 'Paper Currency Value ($)' },
        { id: 'coinCount',       label: 'Total Physical Coins Owned' },
        { id: 'completion',      label: 'Overall Catalog Completion (%)' },
        { id: 'custom',          label: 'Custom Text / Note' },
    ];

    const goalTargets = [
        { id: 'portfolioValue', label: 'Total Portfolio Dollar Target ($)' },
        { id: 'totalMelt',      label: 'Total Precious Metal Melt Target ($)' },
        { id: 'coinCount',      label: 'Total Owned Coins Target (Count)' },
        { id: 'completionPct',  label: 'Overall Catalog Completion Target (%)' },
        ...sections.map(s => ({
            id: 'section:' + s.section,
            label: 'Section Completion: ' + formatSectionWithCountry(s.section) + ` (${s.owned || 0}/${s.total || 0})`
        }))
    ];

    const displayStyles = [
        { id: 'bigNumber',  label: 'Big Hero Number + Subtitle' },
        { id: 'labelValue', label: 'Compact Stat Row' },
        { id: 'progress',   label: 'Progress Bar (0–100%)' },
        { id: 'trend',      label: 'Indicator Badge + Value' },
    ];

    const initialType = editingCard ? (editingCard.cardType || 'metric') : 'collection';

    // Existing cards list
    const existingListWrap = el('div', { className: 'custom-cards-list', style: 'display:flex; flex-direction:column; gap:6px; margin-bottom:14px;' });
    if (customCards.length > 0) {
        existingListWrap.appendChild(el('h4', { className: 'settings-subhead', style: 'margin:0 0 4px 0;' }, `Your Custom Dashboard Cards (${customCards.length})`));
        customCards.forEach((card, idx) => {
            const typeBadge = card.cardType === 'collection' ? '📦 Collection'
                : (card.cardType === 'goal' ? '🎯 Goal'
                : (card.cardType === 'checklist' ? '📝 Checklist' : '📊 Metric'));
            const itemRow = el('div', {
                className: 'custom-card-item',
                style: 'display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 12px; border-radius:8px; background:var(--color-accord-bg); border:1px solid var(--color-border-light);'
            }, [
                el('div', { className: 'custom-card-info', style: 'display:flex; flex-direction:column; gap:2px;' }, [
                    el('strong', { style: 'font-size:0.9rem; color:var(--color-text-main);' }, card.title),
                    el('span', { className: 'custom-card-meta', style: 'font-size:0.75rem; color:var(--color-text-muted);' },
                        `${typeBadge}${card.subtitle ? ' · ' + card.subtitle : ''}`),
                ]),
                el('div', { style: 'display:flex; gap:6px;' }, [
                    el('button', {
                        type: 'button',
                        className: 'btn-secondary btn-sm',
                        style: 'padding:4px 10px; font-size:0.76rem;',
                        onclick: () => {
                            closeModal('modal-custom-card');
                            showCustomCardModal(card.id);
                        }
                    }, 'Edit'),
                    el('button', {
                        type: 'button',
                        className: 'btn-danger btn-sm',
                        style: 'padding:4px 10px; font-size:0.76rem;',
                        onclick: () => {
                            customCards.splice(idx, 1);
                            localStorage.setItem('cc-custom-cards', JSON.stringify(customCards));
                            showToast('Custom card deleted', 'success');
                            closeModal('modal-custom-card');
                            showCustomCardModal();
                            import('./portfolio.js').then(function(m) {
                                if (m.renderDashboard) m.renderDashboard();
                            });
                        }
                    }, 'Delete'),
                ])
            ]);
            existingListWrap.appendChild(itemRow);
        });
    }

    const formWrap = el('div', { className: 'custom-card-form', style: 'display:flex; flex-direction:column; gap:10px;' });
    if (customCards.length > 0) {
        formWrap.appendChild(existingListWrap);
        formWrap.appendChild(el('hr', { style: 'border:none; border-top:1px solid var(--color-border-light); margin:4px 0;' }));
    }

    formWrap.appendChild(el('h4', { className: 'settings-subhead', style: 'margin:0;' },
        editingCard ? `Edit Card: ${editingCard.title}` : 'Create New Custom Dashboard Card'));

    // Card Type Selector
    const typeSelect = el('select', { id: 'custom-card-type', className: 'v1-select' },
        cardTypes.map(ct => el('option', { value: ct.id, selected: ct.id === initialType }, ct.label))
    );
    formWrap.appendChild(el('div', { className: 'form-group' }, [
        el('label', {}, 'Card Template'),
        typeSelect,
    ]));

    // Title & Subtitle
    const titleInput = el('input', {
        type: 'text',
        id: 'custom-card-title',
        className: 'v1-input',
        value: editingCard ? (editingCard.title || '') : '',
        placeholder: 'e.g., "PCGS Graded Slabs", "Morgan Dollar Goal", "Coin Show Buy List"',
        required: true,
    });
    formWrap.appendChild(el('div', { className: 'form-group' }, [
        el('label', {}, 'Card Title'),
        titleInput,
    ]));

    const subtitleInput = el('input', {
        type: 'text',
        id: 'custom-card-subtitle',
        className: 'v1-input',
        value: editingCard ? (editingCard.subtitle || '') : '',
        placeholder: 'Optional note or location (e.g., "Safe Deposit Box #2", "Fall Coin Expo")',
    });
    formWrap.appendChild(el('div', { className: 'form-group' }, [
        el('label', {}, 'Subtitle / Note (Optional)'),
        subtitleInput,
    ]));

    // Dynamic Type-Specific Fields Container
    const dynamicFields = el('div', { style: 'display:flex; flex-direction:column; gap:10px; padding:10px; border-radius:8px; background:var(--color-bg-body); border:1px solid var(--color-border-light);' });
    formWrap.appendChild(dynamicFields);

    function renderDynamicFields() {
        dynamicFields.innerHTML = '';
        const t = typeSelect.value;

        if (t === 'collection') {
            dynamicFields.appendChild(el('p', { style: 'margin:0; font-size:0.8rem; color:var(--color-text-muted); line-height:1.45;' },
                'Creates an interactive card on your dashboard where you can add, edit, and value individual items (slabs, world coins, tokens, stamps, watches, etc.) with an automatic total.'));
            const unitIn = el('input', {
                type: 'text',
                id: 'custom-card-unit-label',
                className: 'v1-input',
                value: (editingCard && editingCard.unitLabel) || 'Grade / Note',
                placeholder: 'e.g., Grade (MS-65), Location, or Purity',
            });
            dynamicFields.appendChild(el('div', { className: 'form-group', style: 'margin:0;' }, [
                el('label', {}, 'Secondary Field Label'),
                unitIn,
            ]));
        } else if (t === 'goal') {
            const goalSel = el('select', { id: 'custom-card-goal-metric', className: 'v1-select' },
                goalTargets.map(gt => el('option', {
                    value: gt.id,
                    selected: editingCard && editingCard.goalMetric === gt.id
                }, gt.label))
            );
            const targetIn = el('input', {
                type: 'number',
                step: 'any',
                id: 'custom-card-goal-target',
                className: 'v1-input',
                value: editingCard && editingCard.goalTarget != null ? editingCard.goalTarget : '100',
                placeholder: 'Target number (leave 0 for section full completion)',
            });
            dynamicFields.appendChild(el('div', { className: 'form-group', style: 'margin:0;' }, [
                el('label', {}, 'What to Track'),
                goalSel,
            ]));
            dynamicFields.appendChild(el('div', { className: 'form-group', style: 'margin:0;' }, [
                el('label', {}, 'Target Goal Amount (or 0 to use 100% of selected section)'),
                targetIn,
            ]));
        } else if (t === 'checklist') {
            const budgetIn = el('input', {
                type: 'number',
                step: '1',
                id: 'custom-card-budget',
                className: 'v1-input',
                value: editingCard && editingCard.budget != null ? editingCard.budget : '500',
                placeholder: 'e.g., 500.00 (0 for no budget limit)',
            });
            dynamicFields.appendChild(el('p', { style: 'margin:0; font-size:0.8rem; color:var(--color-text-muted); line-height:1.45;' },
                'Creates an interactive checklist on your dashboard for coin shows, dealer visits, or roll hunting, tracking your target prices and remaining budget live.'));
            dynamicFields.appendChild(el('div', { className: 'form-group', style: 'margin:0;' }, [
                el('label', {}, 'Show / Hunting Budget ($)'),
                budgetIn,
            ]));
        } else {
            // metric
            const srcSel = el('select', { id: 'custom-card-source', className: 'v1-select' },
                dataSources.map(ds => el('option', {
                    value: ds.id,
                    selected: editingCard && editingCard.dataSource === ds.id
                }, ds.label))
            );
            const styleSel = el('select', { id: 'custom-card-style', className: 'v1-select' },
                displayStyles.map(ds => el('option', {
                    value: ds.id,
                    selected: editingCard && editingCard.displayStyle === ds.id
                }, ds.label))
            );
            const customValGroup = el('div', {
                className: 'form-group',
                id: 'custom-card-custom-group',
                style: (editingCard && editingCard.dataSource === 'custom') ? 'margin:0; display:block;' : 'margin:0; display:none;'
            }, [
                el('label', {}, 'Custom Value / Text'),
                el('input', {
                    type: 'text',
                    id: 'custom-card-custom-value',
                    className: 'v1-input',
                    value: (editingCard && editingCard.customValue) || '',
                    placeholder: 'Enter custom text or number'
                })
            ]);
            srcSel.addEventListener('change', (e) => {
                customValGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
            });
            dynamicFields.appendChild(el('div', { className: 'form-group', style: 'margin:0;' }, [
                el('label', {}, 'Live Data Source'),
                srcSel,
            ]));
            dynamicFields.appendChild(el('div', { className: 'form-group', style: 'margin:0;' }, [
                el('label', {}, 'Display Style'),
                styleSel,
            ]));
            dynamicFields.appendChild(customValGroup);
        }
    }

    typeSelect.addEventListener('change', renderDynamicFields);
    renderDynamicFields();

    const modalId = 'modal-custom-card';
    const footer = el('div', { className: 'modal-footer' }, [
        el('button', { className: 'btn-secondary', onclick: () => closeModal(modalId) }, 'Cancel'),
        el('button', {
            className: 'btn-primary',
            onclick: () => {
                const title = titleInput.value.trim();
                if (!title) {
                    showToast('Please enter a card title', 'error');
                    return;
                }
                const cType = typeSelect.value;
                const subtitle = subtitleInput.value.trim();

                const cardObj = editingCard ? Object.assign({}, editingCard) : {
                    id: String(Date.now()),
                    items: [],
                    createdAt: new Date().toISOString(),
                };
                cardObj.title = title;
                cardObj.subtitle = subtitle;
                cardObj.cardType = cType;

                if (cType === 'collection') {
                    const uEl = document.getElementById('custom-card-unit-label');
                    cardObj.unitLabel = uEl ? uEl.value.trim() || 'Grade / Note' : 'Grade / Note';
                    if (!Array.isArray(cardObj.items)) cardObj.items = [];
                } else if (cType === 'goal') {
                    const gmEl = document.getElementById('custom-card-goal-metric');
                    const gtEl = document.getElementById('custom-card-goal-target');
                    cardObj.goalMetric = gmEl ? gmEl.value : 'portfolioValue';
                    cardObj.goalTarget = gtEl ? (parseFloat(gtEl.value) || 0) : 100;
                } else if (cType === 'checklist') {
                    const bEl = document.getElementById('custom-card-budget');
                    cardObj.budget = bEl ? (parseFloat(bEl.value) || 0) : 0;
                    if (!Array.isArray(cardObj.items)) cardObj.items = [];
                } else {
                    const srcEl = document.getElementById('custom-card-source');
                    const stEl = document.getElementById('custom-card-style');
                    const cvEl = document.getElementById('custom-card-custom-value');
                    cardObj.dataSource = srcEl ? srcEl.value : 'totalValue';
                    cardObj.displayStyle = stEl ? stEl.value : 'bigNumber';
                    cardObj.customValue = (cardObj.dataSource === 'custom' && cvEl) ? cvEl.value : null;
                }

                if (editingCard) {
                    const idx = customCards.findIndex(c => String(c.id) === String(editingCard.id));
                    if (idx !== -1) customCards[idx] = cardObj;
                } else {
                    customCards.push(cardObj);
                }

                localStorage.setItem('cc-custom-cards', JSON.stringify(customCards));
                showToast(editingCard ? 'Custom card updated!' : 'Custom card created!', 'success');
                closeModal(modalId);

                import('./portfolio.js').then(m => {
                    if (m.renderDashboard) m.renderDashboard();
                });
            }
        }, editingCard ? 'Save Changes' : 'Create Card'),
    ]);

    createModal(modalId, 'Custom Dashboard Card Studio', formWrap, footer);
}
window.showCustomCardModal = showCustomCardModal;
// Expose for HTML onclick handlers
window.toggleSettingsDropdown = toggleSettingsDropdown;
window.closeSettingsDropdown = closeSettingsDropdown;
window.openSettingsSection = openSettingsSection;


