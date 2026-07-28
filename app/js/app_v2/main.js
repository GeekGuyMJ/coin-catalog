
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

import { fetchSections, fetchInventory, fetchTypeConfigs, fetchSpotPrices, fetchWishlist } from './api.js';
import { initDb } from './db.js';
import {
    setSections, setInventory, setTypeConfigs, setSpotPrices, setLoading, setWishlist,
} from './state.js';
import { renderSections, updateStickyOffsets } from './catalog.js';
import { renderAlbumView } from './album.js';
import { initSearch } from './search.js';
import { showToast } from './notifications.js';
import { openSettingsModal, openHelpModal, openScrapMetalModal, openPaperCurrencyModal, openCollectablesModal, openVisibilityModal } from './modals.js';
import { openStoriesModal } from './stories.js';

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

// Helper function for timeout protection
function timeout(promise, timeoutMs, name) {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`TIMEOUT: ${name} fetch exceeded ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}

async function boot() {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    console.log('[boot] Starting...');
    setLoading(true);
    syncThemeSelector();
    // Set sticky header offsets after first layout — use rAF to ensure DOM is painted
    requestAnimationFrame(() => updateStickyOffsets());

    // CRITICAL: Global timeout to prevent infinite hanging
    let globalTimeoutId = setTimeout(() => {
        console.warn('[boot] GLOBAL TIMEOUT - forcing app to continue');
        setLoading(false);
        hideSplash();
        showToast('App initialization took too long - loading with limited functionality', 'error', 8000);
        
        // ESTABLISH MINIMAL FUNCTIONALITY AS FALLBACK
        setSections([]);
        setInventory({});
        setTypeConfigs({});
        setWishlist([]);
        console.log('[boot] Continued with empty data - app will show "no data" state');
        
    }, 15000); // 15 seconds max for entire boot sequence

    try {
        // Initialize the local database (seeds from coins.json if empty) - with timeout!
        console.log('[boot] Seeding database...');
        await timeout(initDb(), 15000, 'initDb');
        console.log('[boot] Database ready.');

        // Load sections, inventory, type configs, and wishlist in parallel with timeout protection
        console.log('[boot] Fetching data...');
        console.log('[boot] Starting fetchSections()...');
        const sectionsPromise = timeout(fetchSections(), 12000, 'sections').catch(e => { console.warn('[boot] sections failed:', e.message); return []; });
        console.log('[boot] Starting fetchInventory()...');
        const inventoryPromise = timeout(fetchInventory(), 12000, 'inventory').catch(e => { console.warn('[boot] inventory failed:', e.message); return {}; });
        console.log('[boot] Starting fetchTypeConfigs()...');
        const typeConfigsPromise = timeout(fetchTypeConfigs(), 8000, 'typeConfigs').catch(e => { console.warn('[boot] typeConfigs failed:', e.message); return {}; });
        console.log('[boot] Starting fetchWishlist()...');
        const wishlistPromise = timeout(fetchWishlist(), 6000, 'wishlist').catch(e => { console.warn('[boot] wishlist failed:', e.message); return []; });
        
        const [sections, inventory, typeConfigs, wishlist] = await Promise.all([
            sectionsPromise,
            inventoryPromise,
            typeConfigsPromise,
            wishlistPromise,
        ]);

        // If we got any data, use it
        console.log('[boot] Data received - raw:', { 
            sections: Array.isArray(sections) ? sections.slice(0,2) : sections,
            inventory: typeof inventory,
            inventoryKeys: Object.keys(inventory || {}).length,
            typeConfigs: typeof typeConfigs,
            typeConfigsKeys: Object.keys(typeConfigs || {}).length,
            wishlist: Array.isArray(wishlist) ? wishlist.slice(0,2) : wishlist
        });
        console.log('[boot] Data received.', { sectionsLength: sections?.length, inventoryLength: Object.keys(inventory || {}).length, typeConfigsKeys: Object.keys(typeConfigs || {}).length });
        if (sections || inventory || typeConfigs) {
            setSections(sections || []);
            setInventory(inventory || {});
            setTypeConfigs(typeConfigs || {});
            setWishlist(wishlist || []);
            showToast('App loaded successfully! Showing available data.', 'success', 3000);
        } else {
            // If no data received, show user-friendly message
            showToast('No data received - showing empty state', 'warning', 3000);
        }

        // Init dashboard
        import('./portfolio.js').then(m => m.initPortfolio());

        // Render the catalogue
        renderSections();
        initViewToggle();

        // Update completion badge
        updateCompletionBadge(sections);

    } catch (err) {
        console.error('[boot] Load failed:', err);
        showToast(`Failed to load app: ${err.message}. Showing empty state.`, 'error', 8000);
        
        // Establish minimal functionality as fallback
        setSections([]);
        setInventory({});
        setTypeConfigs({});
        setWishlist([]);
    } finally {
        // Always clear the global timeout
        clearTimeout(globalTimeoutId);
        
        // Always clear loading state
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
// Expose app version for About modal
window.APP_VERSION = "2.0.3-fix-input-clearing";

// Start the app
// ============================================================

document.addEventListener("DOMContentLoaded", boot);