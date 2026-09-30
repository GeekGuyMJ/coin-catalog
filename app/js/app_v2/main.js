
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
    getSections,
} from './state.js';
import { renderSections, updateStickyOffsets } from './catalog.js';
import { renderAlbumView } from './album.js';
import { initSearch } from './search.js';
import { showToast } from './notifications.js';
import { openSettingsModal, openHelpModal, openScrapMetalModal, openPaperCurrencyModal, openCollectablesModal, openVisibilityModal, openCustomThemeDesigner } from './modals.js';
import { openStoriesModal } from './stories.js';
import { toggleInfoDropdown, closeInfoDropdown, openInfoSection } from './infoDropdown.js';
import { toggleSettingsDropdown, closeSettingsDropdown, openSettingsSection, showCloudSyncModal } from './settingsDropdown.js';
import { handleOAuthCallback } from './sync.js';
import { initWishlist, openWishlistPanel } from './wishlist.js';

export { showToast };

import { initFirstLaunch } from './first_launch.js';

// Expose dropdown toggles globally for onclick handlers in index.html
window.toggleInfoDropdown = toggleInfoDropdown;
window.closeInfoDropdown = closeInfoDropdown;
window.toggleSettingsDropdown = toggleSettingsDropdown;
window.closeSettingsDropdown = closeSettingsDropdown;
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
// Theme Sync across devices via Tailscale MagicDNS
// ============================================================

function initThemeSync() {
    // Listen for storage changes from other tabs/windows
    window.addEventListener('storage', (e) => {
        if (e.key === 'cc-theme' && e.newValue !== e.oldValue) {
            console.log('[theme] Sync received from another device:', e.newValue);
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme !== e.newValue) {
                window.setTheme(e.newValue);
                const sel = document.getElementById('theme-selector');
                if (sel) sel.value = e.newValue;
            }
        }
    });
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

    // Handle OAuth provider redirects (Google/Dropbox/OneDrive) returning to the app
    try {
        const handled = await handleOAuthCallback();
        if (handled) {
            console.log('[boot] OAuth callback handled.');
            // Auto-open Cloud Sync so the user sees the authenticated provider + Backup/Restore buttons
            // (Dropbox/OneDrive use a full-page redirect, so the modal was closed on return).
            try { await showCloudSyncModal(); } catch (mErr) { console.warn('[boot] auto-open Cloud Sync failed:', mErr.message); }
        }
    } catch (e) {
        console.warn('[boot] OAuth callback handling failed:', e.message);
    }
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
        
    }, 60000); // 60 seconds max for entire boot sequence

    try {
        // Initialize the local database (seeds from coins.json if empty) - with timeout!
        console.log('[boot] Seeding database...');
        await timeout(initDb(), 45000, 'initDb');
        console.log('[boot] Database ready.');

        // Load sections, inventory, type configs, and wishlist in parallel with timeout protection
        console.log('[boot] Fetching data...');
        console.log('[boot] Starting fetchSections()...');
        const sectionsPromise = timeout(fetchSections(), 30000, 'sections').catch(e => { console.warn('[boot] sections failed:', e.message); return []; });
        console.log('[boot] Starting fetchInventory()...');
        const inventoryPromise = timeout(fetchInventory(), 30000, 'inventory').catch(e => { console.warn('[boot] inventory failed:', e.message); return {}; });
        console.log('[boot] Starting fetchTypeConfigs()...');
        const typeConfigsPromise = timeout(fetchTypeConfigs(), 20000, 'typeConfigs').catch(e => { console.warn('[boot] typeConfigs failed:', e.message); return {}; });
        console.log('[boot] Starting fetchWishlist()...');
        const wishlistPromise = timeout(fetchWishlist(), 15000, 'wishlist').catch(e => { console.warn('[boot] wishlist failed:', e.message); return []; });
        
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
            console.log('[main] About to call setSections with:', sections?.length, 'sections');
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
        initLayoutToggle();

        // Initialize logo zoom and theme sync
        setupLogoZoomEngine();
        initThemeSync();

        // Apply colorblind assist if enabled
        if (localStorage.getItem('cc-colorblind') === '1') {
            document.body.classList.add('cc-colorblind');
        }

        // Start the automatic cloud backup scheduler (silent if not enabled)
        import('./sync.js').then(m => m.startAutoBackupScheduler && m.startAutoBackupScheduler());

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
window.openCustomThemeDesigner = openCustomThemeDesigner;
window.openStoriesModal    = openStoriesModal;
window.openVisibilityModal = openVisibilityModal;
window.openScrapMetalModal = openScrapMetalModal;
window.openPaperCurrencyModal = openPaperCurrencyModal;
window.openCollectablesModal  = openCollectablesModal;

// ============================================================
// Header fit — hide the Install button FIRST when the nav row would
// horizontally overflow (so Layout/Info/Settings/Theme stay on one row).
// Hides Install → Layout → Info (Settings + Theme always kept).
// ============================================================
function fitHeader() {
    const header = document.getElementById('app-header');
    const inner = header && header.querySelector('.header-inner');
    const right = header && header.querySelector('.header-right');
    const left  = header && header.querySelector('.header-left');
    if (!header || !inner || !right || !left) return;

    const hideable = ['btn-install', 'btn-layout', 'btn-info'];
    const installVisible = !!window._installPrompt;

    // In the 2-row grid layout (≤768px) the nav sits on its own row, so there's no
    // horizontal collision with the logo/title — CSS handles compacting there.
    // Only run the hide logic in single-row (flex) mode.
    if (getComputedStyle(inner).display === 'grid') {
        for (const id of hideable) {
            const b = document.getElementById(id);
            if (!b) continue;
            if (id === 'btn-install') b.style.display = installVisible ? '' : 'none';
        }
        return;
    }

    // Reset to natural visibility (Install only if a PWA prompt is available).
    for (const id of hideable) {
        const b = document.getElementById(id);
        if (!b) continue;
        if (id === 'btn-install') b.style.display = installVisible ? '' : 'none';
        else b.style.display = '';
    }

    // Horizontal overflow test: do the left (logo+title) + right (nav) blocks
    // together exceed the inner header's available width? If so, hide extras.
    const overflowX = () => {
        const innerRect = inner.getBoundingClientRect();
        const leftRect  = left.getBoundingClientRect();
        // Sum the natural (un-wrapped) widths of the visible right children.
        const rightW = [...right.children]
            .filter(c => c.offsetParent !== null)
            .reduce((s, c) => s + c.getBoundingClientRect().width, 0);
        const gap = 16; // breathing room
        return (leftRect.width + rightW + gap) > innerRect.width;
    };

    let guard = 0;
    while (overflowX() && guard < hideable.length) {
        const id = hideable[guard++];
        const b = document.getElementById(id);
        if (!b) continue;
        if (id === 'btn-install' && !installVisible) continue; // already hidden
        if (b.style.display === 'none') continue;
        b.style.display = 'none';
    }
}

let _fitRAF = null;
function scheduleFitHeader() {
    if (_fitRAF) cancelAnimationFrame(_fitRAF);
    _fitRAF = requestAnimationFrame(() => { _fitRAF = null; fitHeader(); });
}
window.addEventListener('resize', () => {
    clearTimeout(window.__fitT);
    window.__fitT = setTimeout(fitHeader, 120);
});
window.addEventListener('load', scheduleFitHeader);
document.addEventListener('DOMContentLoaded', scheduleFitHeader);
const _hdrLogoEl = document.getElementById('header-coin-img');
if (_hdrLogoEl) { _hdrLogoEl.addEventListener('load', scheduleFitHeader); if (_hdrLogoEl.complete) scheduleFitHeader(); }
scheduleFitHeader();

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
// Layout Toggle — Dashboard Grid
// ============================================================

/* ================================================================
   Balanced layout: pack cards into rows of similar height.
                                          2026-09-30
   A fourth option on the dashboard layout button. Cards are grouped
   so a row's members are within BAL_TOLERANCE of each other in
   natural height, and each card gets an explicit column span so the
   row fills the width exactly. A card much taller than its
   neighbours ends up in a row by itself, which puts the wasted space
   in a row with one card rather than stretching three short cards.

   main.js is a MODULE, so these identifiers are not on window. Inside
   this module a bare reference resolves; a window. lookup would report
   the function missing while it works fine.

   Re-packing uses a MutationObserver on #app-main, a stable ancestor,
   because the grid element itself can be re-created. That one
   mechanism covers save, delete, toggle, filter and layout changes,
   so no render function needs patching -- renderDashboard is in fact
   a DIFFERENT function in three different modules.
   ================================================================ */
var BAL_TOLERANCE = 1.45;   // 1.0 = exact match, 1.45 = generous

function packBalancedRows() {
    var grid = document.getElementById('dashboard-grid');
    if (!grid || !grid.classList.contains('layout-balanced')) return;

    var cards = Array.prototype.slice.call(
        grid.querySelectorAll(':scope > .dashboard-card'));
    if (!cards.length) return;

    // A card measured while spanning 2 columns was NARROW and therefore
    // taller than it should be, so the previous pack must be undone
    // before measuring. Clear, force a reflow, then measure.
    cards.forEach(function (c) { c.style.gridColumn = ''; });
    cards.forEach(function (c) { c.style.alignSelf = 'start'; });
    void grid.offsetHeight;
    var heights = cards.map(function (c) { return c.getBoundingClientRect().height; });

    var cols = getComputedStyle(grid).gridTemplateColumns
                 .split(' ').filter(Boolean).length || 1;

    // Group into rows of similar height.
    //
    // A card much TALLER than the row so far starts a new row. The
    // first card always seeds its own row -- seeding curMax at 0 made
    // "h > curMax * tol" false for everything after a tall first card,
    // so the row never closed (measured: rowSizes [12]).
    var rows = [], cur = [], curMax = 0;
    for (var i = 0; i < cards.length; i++) {
        var h = heights[i];
        if (cur.length && h > curMax * BAL_TOLERANCE) {
            rows.push(cur);
            cur = [];
            curMax = 0;
        }
        cur.push(i);
        if (h > curMax) curMax = h;
    }
    if (cur.length) rows.push(cur);

    // Emit spans so each row fills the width exactly and never overflows.
    rows.forEach(function (row) {
        var k = row.length;
        if (k >= cols) {
            row.forEach(function (i) { cards[i].style.gridColumn = 'span 1'; });
            return;
        }
        var base = Math.floor(cols / k), extra = cols % k, used = 0;
        row.forEach(function (i, j) {
            var span = base + (j < extra ? 1 : 0);
            used += span;
            cards[i].style.gridColumn = 'span ' + span;
        });
        if (used < cols && row.length) {
            // integer division left a gap; give the slack to one card
            var last = row[row.length - 1];
            var have = parseInt((cards[last].style.gridColumn.match(/\d+/) || [1])[0], 10);
            cards[last].style.gridColumn = 'span ' + (have + (cols - used));
        }
    });

    cards.forEach(function (c) { c.style.alignSelf = ''; });
}

function scheduleBalancedPack() {
    var grid = document.getElementById('dashboard-grid');
    if (!grid || !grid.classList.contains('layout-balanced')) return;
    clearTimeout(scheduleBalancedPack._t);
    scheduleBalancedPack._t = setTimeout(function () {
        // two frames: one for layout, one for the spans to settle
        requestAnimationFrame(function () { requestAnimationFrame(packBalancedRows); });
    }, 80);
}

function initBalancedLayout() {
    var host = document.getElementById('app-main') || document.body;
    if (!host || host._balObserved) return;
    host._balObserved = true;
    new MutationObserver(scheduleBalancedPack).observe(host, {
        childList: true, subtree: true
    });
    // An observer only fires on a MUTATION, so the first pack has to be
    // asked for explicitly.
    scheduleBalancedPack();
}

/* Poll for the grid at module load rather than relying on applyLayout,
   whose call site was being missed (grid._balObserved was false in the
   browser even with the class correctly applied). */
function initBalancedWhenReady() {
    if (document.getElementById('dashboard-grid')) { initBalancedLayout(); return; }
    var tries = 0;
    var t = setInterval(function () {
        if (document.getElementById('dashboard-grid') || ++tries > 150) {
            clearInterval(t);
            initBalancedLayout();
        }
    }, 100);
}

function initLayoutToggle() {
    const btn = document.getElementById('btn-layout');
    if (!btn) return;
    
    // Three modes: Grid (default auto-fill), Compact (2-col equal), List (single column)
    // 2026-09-30: 'Balanced' packs rows by height so one tall card
    // does not stretch its neighbours. See packBalancedRows().
    const layouts    = ['layout-grid', 'layout-compact', 'layout-list',
                        'layout-balanced'];
    const layoutNames = ['Grid', 'Compact', 'List', 'Balanced'];
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
        initBalancedLayout();
        requestAnimationFrame(function () { requestAnimationFrame(packBalancedRows); });
    };
    
    // Apply after grid is rendered
    setTimeout(applyLayout, 100);

    // Re-pack on resize: the column count changes, and so does every
    // card's natural height, so a pack made at the old width is wrong.
    let _balT = null;
    window.addEventListener('resize', () => {
        clearTimeout(_balT);
        _balT = setTimeout(packBalancedRows, 180);
    });
    
    btn.addEventListener('click', () => {
        currentIdx = (currentIdx + 1) % layouts.length;
        localStorage.setItem('cc-dashboard-layout', currentIdx);
        applyLayout();
        import('./notifications.js').then(m => m.showToast(`Layout: ${layoutNames[currentIdx]}`, 'info', 1500));
    });
}

// ============================================================
// User Guide Modal — First-time user onboarding
// Initialize the first-launch popup + guided tour
initFirstLaunch();
initBalancedWhenReady();


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
window.APP_VERSION = "2.0";

// Start the app
// ============================================================

// NOTE: Module scripts are deferred - they execute AFTER DOM is parsed
// BUT BEFORE DOMContentLoaded fires. Call boot() directly.
boot();