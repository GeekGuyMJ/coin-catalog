
/**
 * main.js — Coin Catalog v2
 *
 * Application entry point. Orchestrates the boot sequence:
 *  1. Apply saved theme
 *  2. Fetch sections + inventory + type configs in parallel
 *  3. Render section cards
 *  4. Hide splash screen
 *  5. Begin background spot price fetch
 *
 * @module main
 */

import { fetchSections, fetchInventory, fetchTypeConfigs, fetchSpotPrices } from './api.js';
import {
    setSections, setInventory, setTypeConfigs, setSpotPrices, setLoading,
} from './state.js';
import { renderSections } from './catalog.js';
import { renderAlbumView } from './album.js';
import { initSearch } from './search.js';
import { showToast } from './notifications.js';
import { openSettingsModal, openHelpModal, openStoriesModal, openScrapMetalModal, openPaperCurrencyModal, openCollectablesModal, openVisibilityModal } from './modals.js';

export { showToast };

// ============================================================
// Theme (sync selector with saved value — themes.js owns the logic)
// ============================================================

function syncThemeSelector() {
    const saved = localStorage.getItem('cc-theme') || 'dark';
    const sel = document.getElementById('theme-selector');
    if (sel) sel.value = saved;
}

// ============================================================
// Boot sequence
// ============================================================

async function boot() {
    console.log('[boot] Starting...');
    setLoading(true);
    syncThemeSelector();
    // Set sticky header offsets BEFORE rendering so CSS has correct values
    fixStickyHeaderOffsets();

    try {
        // Load sections, inventory, and type configs in parallel
        const [sections, inventory, typeConfigs] = await Promise.all([
            fetchSections(),
            fetchInventory(),
            fetchTypeConfigs(),
        ]);

        setSections(sections);
        setInventory(inventory);
        setTypeConfigs(typeConfigs);

        // Init dashboard
        import('./app_v2/portfolio.js').then(m => m.initPortfolio());

        // Render the catalogue
        renderSections();
        initViewToggle();

        // Update completion badge
        updateCompletionBadge(sections);

    } catch (err) {
        showToast(`Failed to load catalogue: ${err.message}`, 'error', 8000);
        console.error('[boot] Load failed:', err);
    } finally {
        setLoading(false);
        hideSplash();
        if (typeof window._markBootComplete === 'function') window._markBootComplete();
    }

    // Fetch spot prices in the background (non-blocking)
    fetchSpotPricesBackground();

    // Initialize search bar, filters, sort
    initSearch();

    // Fix sticky header offsets dynamically (mobile header height varies)
    fixStickyHeaderOffsets();
    window.addEventListener("resize", fixStickyHeaderOffsets);
}

/**
 * Measure the actual app-header height and set CSS custom properties
 * so sticky headers (country bar, type bar) position correctly.
 * This is needed because mobile header height varies with content wrapping.
 */
function fixStickyHeaderOffsets() {
    const isMobile = window.innerWidth <= 768;
    const countryH = document.querySelector('.country-group-header')?.offsetHeight || (isMobile ? 48 : 56);
    const sectionH = document.querySelector('.section-header')?.offsetHeight || (isMobile ? 40 : 48);
    document.documentElement.style.setProperty('--header-height', '0px');
    document.documentElement.style.setProperty('--country-bar-height', countryH + 'px');
    document.documentElement.style.setProperty('--section-header-height', sectionH + 'px');
    document.documentElement.style.setProperty('--section-bar-top', countryH + 'px');
    document.documentElement.style.setProperty('--type-bar-top', (countryH + sectionH) + 'px');
}

// ============================================================
// Splash screen
// ============================================================

function hideSplash() {
    const splash = document.getElementById('app-splash');
    if (!splash) return;
    splash.classList.add('hidden');
    setTimeout(() => splash.remove(), 600);
}

// ============================================================
// Completion badge
// ============================================================

function updateCompletionBadge(sections) {
    const total = sections.reduce((s, sec) => s + sec.total, 0);
    const owned = sections.reduce((s, sec) => s + sec.owned, 0);
    if (!total) return;

    const pct   = Math.round((owned / total) * 100);
    const badge = document.getElementById('completion-badge');
    if (!badge) return;

    badge.textContent = `${owned.toLocaleString()} / ${total.toLocaleString()} · ${pct}%`;
    badge.removeAttribute('hidden');
}

// ============================================================
// Spot prices (background, non-blocking)
// ============================================================

async function fetchSpotPricesBackground() {
    try {
        const prices = await fetchSpotPrices();
        setSpotPrices(prices);
    } catch {
        // Spot prices are optional — fail silently
    }
}

// ============================================================
// PWA install prompt
// ============================================================

let _installPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _installPrompt = e;
    const btn = document.getElementById('btn-install');
    if (btn) btn.style.display = 'inline-flex';
});

window.addEventListener('appinstalled', () => {
    _installPrompt = null;
    const btn = document.getElementById('btn-install');
    if (btn) btn.style.display = 'none';
});

window.triggerPWAInstall = async () => {
    if (!_installPrompt) return;
    _installPrompt.prompt();
    await _installPrompt.userChoice;
    _installPrompt = null;
    const btn = document.getElementById('btn-install');
    if (btn) btn.style.display = 'none';
};

// Modal functions are imported from modals.js above
// Expose to window for HTML onclick handlers (window._btnCall)
window.openSettingsModal    = openSettingsModal;
window.openHelpModal       = openHelpModal;
window.openStoriesModal    = openStoriesModal;
window.openVisibilityModal = openVisibilityModal;
window.openScrapMetalModal = openScrapMetalModal;
window.openPaperCurrencyModal = openPaperCurrencyModal;
window.openCollectablesModal  = openCollectablesModal;

// ============================================================
// View Toggle — List vs Album
// ============================================================

function initViewToggle() {
    const toggle = document.getElementById('view-toggle');
    if (!toggle) return;
    toggle.style.display = 'inline-flex';

    const listBtn = document.getElementById('view-list-btn');
    const albumBtn = document.getElementById('view-album-btn');

    listBtn.addEventListener('click', () => {
        if (listBtn.classList.contains('active')) return;
        listBtn.classList.add('active');
        albumBtn.classList.remove('active');
        const container = document.getElementById('catalog-container');
        if (container) container.classList.remove('album-mode');
        import('./catalog.js').then(m => m.renderSections());
    });

    albumBtn.addEventListener('click', () => {
        if (albumBtn.classList.contains('active')) return;
        albumBtn.classList.add('active');
        listBtn.classList.remove('active');
        const container = document.getElementById('catalog-container');
        if (container) container.classList.add('album-mode');
        import('./album.js').then(m => m.renderAlbumView(null));
    });
}

// ============================================================
// Splash control — defined here so it's always available
// ============================================================

if (typeof window._markBootComplete !== 'function') {
    window._markBootComplete = function() {
        window._bootComplete = true;
        var s = document.getElementById('app-splash');
        if (s) { s.style.display = 'none'; s.classList.add('hidden'); }
    };
}

// ============================================================
// Start the app
// ============================================================

document.addEventListener("DOMContentLoaded", boot);