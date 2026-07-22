
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

import { fetchSections, fetchInventory, fetchTypeConfigs, fetchSpotPrices, fetchWishlist } from './api.js?v=4';
import { initDb } from './db.js?v=4';
import {
    setSections, setInventory, setTypeConfigs, setSpotPrices, setLoading, setWishlist,
} from './state.js?v=4';
import { renderSections, updateStickyOffsets } from './catalog.js?v=4';
import { renderAlbumView } from './album.js?v=4';
import { initSearch } from './search.js?v=4';
import { showToast } from './notifications.js?v=4';
import { openSettingsModal, openHelpModal, openScrapMetalModal, openPaperCurrencyModal, openCollectablesModal, openVisibilityModal } from './modals.v2.js?v=4';
import { openStoriesModal } from './stories.js?v=4';
import { toggleInfoDropdown, closeInfoDropdown, openInfoSection } from './infoDropdown.js?v=4';
import { toggleSettingsDropdown, closeSettingsDropdown, openSettingsSection } from './settingsDropdown.js?v=8';
import { initWishlist, openWishlistPanel } from './wishlist.js?v=4';

export { showToast };

// Expose wishlist panel opener globally for portfolio card button
window.openWishlistPanel = openWishlistPanel;

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
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    if (localStorage.getItem('cc-expand-cards') === 'true') {
        document.body.classList.add('expand-cards');
    }
    console.log('[boot] Starting...');
    setLoading(true);
    syncThemeSelector();
    setupLogoZoomEngine();
    // Set sticky header offsets after first layout — use rAF to ensure DOM is painted
    requestAnimationFrame(() => updateStickyOffsets());

    try {
        // Initialize the local database (seeds from coins.json if empty)
        await initDb();

        // Load sections, inventory, type configs, and wishlist in parallel
        const [sections, inventory, typeConfigs, wishlist] = await Promise.all([
            fetchSections(),
            fetchInventory(),
            fetchTypeConfigs(),
            fetchWishlist(),
        ]);

        setSections(sections);
        setInventory(inventory);
        setTypeConfigs(typeConfigs);
        setWishlist(wishlist || []);

        // Initialize wishlist click delegation
        initWishlist();

        // Init dashboard
        import('./portfolio.js?v=8').then(m => m.initPortfolio());

        // Render the catalogue
        renderSections();
        initViewToggle();
        initLayoutToggle();

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
    requestAnimationFrame(() => updateStickyOffsets());
    window.addEventListener("resize", () => requestAnimationFrame(() => updateStickyOffsets()));

    // Restore saved scroll position
    const savedY = sessionStorage.getItem('cc-scroll-y');
    if (savedY !== null) {
        window.scrollTo(0, parseInt(savedY, 10));
    }

    // Save scroll position when user scrolls (throttled to once per 250ms)
    let _scrollSaveTimer = null;
    window.addEventListener('scroll', () => {
        if (_scrollSaveTimer) return;
        _scrollSaveTimer = setTimeout(() => {
            _scrollSaveTimer = null;
            const splash = document.getElementById('app-splash');
            if (!splash) {
                sessionStorage.setItem('cc-scroll-y', String(window.scrollY));
            }
        }, 250);
    }, { passive: true });
}

// ============================================================
// Splash screen
// ============================================================

function hideSplash() {
    const splash = document.getElementById('app-splash');
    if (!splash) return;
    splash.classList.add('hidden');

    const savedY = sessionStorage.getItem('cc-scroll-y');
    if (savedY !== null) {
        window.scrollTo(0, parseInt(savedY, 10));
    }

    setTimeout(() => {
        splash.remove();
        if (savedY !== null) {
            window.scrollTo(0, parseInt(savedY, 10));
        }
    }, 600);
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
        import('./catalog.js?v=4').then(m => m.renderSections());
    });

    albumBtn.addEventListener('click', () => {
        if (albumBtn.classList.contains('active')) return;
        albumBtn.classList.add('active');
        listBtn.classList.remove('active');
        const container = document.getElementById('catalog-container');
        if (container) container.classList.add('album-mode');
        import('./album.js?v=4').then(m => m.renderAlbumView(null));
    });
}

// ============================================================
// Layout Toggle — Dashboard Grid
// ============================================================

function initLayoutToggle() {
    const btn = document.getElementById('btn-layout');
    if (!btn) return;
    
    // Three modes: Grid (default auto-fill), Compact (2-col equal), List (single column)
    const layouts    = ['layout-grid', 'layout-compact', 'layout-list'];
    const layoutNames = ['Grid', 'Compact', 'List'];
    let currentIdx = parseInt(localStorage.getItem('cc-dashboard-layout') || '0', 10);
    if (isNaN(currentIdx) || currentIdx < 0 || currentIdx >= layouts.length) currentIdx = 0;

    const updateButtonLabel = () => {
        const span = btn.querySelector('span');
        if (span) span.textContent = layoutNames[currentIdx];
    };
    
    const applyLayout = () => {
        const grid = document.getElementById('dashboard-grid');
        if (!grid) return;
        grid.classList.remove(...layouts);
        grid.classList.add(layouts[currentIdx]);
        updateButtonLabel();
    };
    
    // Apply after grid is rendered
    setTimeout(applyLayout, 100);
    
    btn.addEventListener('click', () => {
        currentIdx = (currentIdx + 1) % layouts.length;
        localStorage.setItem('cc-dashboard-layout', currentIdx);
        applyLayout();
        import('./notifications.js?v=4').then(m => m.showToast(`Layout: ${layoutNames[currentIdx]}`, 'info', 1500));
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
// Logo Zoom Lightbox — click header coin to zoom
// ============================================================

function setupLogoZoomEngine() {
    const logo = document.getElementById('header-coin-img');
    if (!logo) return;

    let lightbox = document.getElementById('logo-zoom-lightbox');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'logo-zoom-lightbox';
        lightbox.className = 'logo-lightbox-overlay';
        lightbox.innerHTML = '<div class="lightbox-img-wrapper"><img src="" alt="Coin Preview"></div>';
        document.body.appendChild(lightbox);
    }

    logo.style.cursor = 'pointer';
    logo.addEventListener('click', (e) => {
        e.stopPropagation();
        lightbox.querySelector('img').src = logo.src;
        lightbox.classList.add('is-active');
    });

    // Click anywhere to dismiss
    lightbox.addEventListener('click', () => {
        lightbox.classList.remove('is-active');
    });
}

// ============================================================
// Expose app version for About modal
window.APP_VERSION = "2.1.0-features";

// Start the app
// ============================================================

// Module scripts are deferred; DOMContentLoaded may have already fired
console.log('[main.js] Module loaded, readyState:', document.readyState);
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    console.log('[main.js] DOMContentLoaded already fired, calling boot() directly');
    boot();
}