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
import { isSelfHosted } from './env.js';
import { isPWAInstallAllowed, APP_VERSION } from './env.js';
import { initDb } from './db.js';
import {
    setSections, setInventory, setTypeConfigs, setSpotPrices, setLoading, setWishlist,
    getSections,
} from './state.js';
import { renderSections, updateStickyOffsets } from './catalog.js';
import { renderAlbumView } from './album.js';
import { initSearch } from './search.js';
import { initPortfolio, renderDashboard, prewarmPortfolioData } from './portfolio.js';
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
        // V530: Guarantee Dashboard Cards mount FIRST at the top of the viewport (scrollY = 0)
        // on every deployment (Self-Hosted & Cloudflare) BEFORE the search bar or coin list can render!
        const searchCardEl = document.getElementById('card-search');
        const catalogContainerEl = document.getElementById('catalog-container');
        const isSearchHiddenByUser = (() => {
            try {
                const vis = JSON.parse(localStorage.getItem('cc-card-visibility') || '{}');
                return vis['card-search'] === false;
            } catch (_) { return false; }
        })();
        try {
            sessionStorage.removeItem('cc-scroll-y');
            document.documentElement.style.overflowAnchor = 'none';
            if (document.body) document.body.style.overflowAnchor = 'none';
            if (searchCardEl) searchCardEl.style.display = 'none';
            if (catalogContainerEl) catalogContainerEl.style.display = 'none';
            window.scrollTo(0, 0);
        } catch (_) {}

        initLayoutToggle();

        // 1. Mount all 15 Dashboard Cards synchronously right now (t = 0ms) using cached/seeded state
        //    and start async portfolio + spot price refreshes in parallel.
        try {
            renderDashboard();
            prewarmPortfolioData();
            initPortfolio();
        } catch (syncDashErr) {
            console.warn('[boot] synchronous dashboard mount warning:', syncDashErr);
        }
        const spotPrebootPromise = fetchSpotPricesBackground(1800);

        // 2. On Self-Hosted, SQLite is the source of truth so do NOT block boot on IndexedDB seeding;
        //    on Cloudflare (static mode), do NOT block boot on IndexedDB seeding either — the 5,622-coin
        //    seed exceeds the 15s splash watchdog. Run initDb in background so dashboard renders first.
        console.log('[boot] Seeding database...');
        if (isSelfHosted) {
            timeout(initDb(), 45000, 'initDb').catch(e => console.warn('[boot] background initDb note:', e.message));
        } else {
            timeout(initDb(), 45000, 'initDb').catch(e => console.warn('[boot] background initDb note:', e.message));
        }
        console.log('[boot] Database ready (background seeding started).');

        // 3. Fetch dashboard state (inventory, typeConfigs, wishlist) and sections in parallel.
        console.log('[boot] Fetching data...');
        const sectionsPromise = timeout(fetchSections(), 30000, 'sections').catch(e => { console.warn('[boot] sections failed:', e.message); return []; });
        const inventoryPromise = timeout(fetchInventory(), 15000, 'inventory').catch(e => { console.warn('[boot] inventory failed:', e.message); return {}; });
        const typeConfigsPromise = timeout(fetchTypeConfigs(), 15000, 'typeConfigs').catch(e => { console.warn('[boot] typeConfigs failed:', e.message); return {}; });
        const wishlistPromise = timeout(fetchWishlist(), 10000, 'wishlist').catch(e => { console.warn('[boot] wishlist failed:', e.message); return []; });

        const [inventory, typeConfigs, wishlist] = await Promise.all([
            inventoryPromise,
            typeConfigsPromise,
            wishlistPromise,
        ]);

        setInventory(inventory || {});
        setTypeConfigs(typeConfigs || {});
        setWishlist(wishlist || []);

        // Wait briefly (up to 1.8s) for live spot prices & portfolio summary, then ensure Dashboard Cards are painted.
        await spotPrebootPromise;
        try {
            await timeout(initPortfolio(), 2500, 'initPortfolio');
        } catch (_) {}
        renderDashboard();

        // 4. Reveal the Dashboard Cards at the very top FIRST (while #card-search and #catalog-container
        //    are still display:none so the viewport is 100% locked to the top cards!).
        window.scrollTo(0, 0);
        setLoading(false);
        hideSplash();

        // Give the browser one frame to paint the Dashboard Cards at the top of the screen,
        // then unhide #card-search and #catalog-container underneath without moving scrollY!
        await new Promise(r => requestAnimationFrame(r));
        if (searchCardEl) searchCardEl.style.display = isSearchHiddenByUser ? 'none' : '';
        if (catalogContainerEl) catalogContainerEl.style.display = '';
        window.scrollTo(0, 0);

        // 2. Now await sectionsPromise and render the Coin Catalog underneath while keeping viewport at top
        const sections = await sectionsPromise;
        console.log('[boot] Data received.', { sectionsLength: sections?.length, inventoryLength: Object.keys(inventory || {}).length, typeConfigsKeys: Object.keys(typeConfigs || {}).length });
        if (sections || inventory || typeConfigs) {
            console.log('[main] About to call setSections with:', sections?.length, 'sections');
            setSections(sections || []);
            showToast('App loaded successfully! Showing available data.', 'success', 3000);
        } else {
            showToast('No data received - showing empty state', 'warning', 3000);
        }

        await new Promise(r => requestAnimationFrame(r));
        renderSections();
        initViewToggle();
        if (window.scrollY > 0) window.scrollTo(0, 0);

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
        
        // Even on error, show the UI so user can see error state
        if (searchCardEl) searchCardEl.style.display = '';
        if (catalogContainerEl) catalogContainerEl.style.display = '';

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

    // Fetch spot prices during boot, with a short cap. The dashboard was
    // already rendered from empty state, so a slow fetch used to leave the
    // Live Spot Prices card blank until something else re-rendered it
    // (2026-09-26). Awaiting with a timeout fixes the common case; on
    // timeout the card shows its Loading rows and the 60s poll still fills
    // it, so this stays non-fatal.
    await fetchSpotPricesBackground(4000);

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

async function fetchSpotPricesBackground(capMs) {
    // The cap decides only whether BOOT WAITS -- it must never discard the
    // result. A plain Promise.race with a rejecting timeout orphaned the
    // in-flight request, so a fetch slower than the cap left the Live Spot
    // Prices card on "Loading..." forever (2026-09-26).
    let request;
    try {
        request = fetchSpotPrices();
    } catch (e) {
        console.debug('[spot] could not start fetch:', e.message);
        return null;
    }
    // A late arrival still counts, so always attach a handler.
    request.then(
        v => { setSpotPrices(v); },
        e => { console.debug('[spot] fetch failed:', e && e.message); }
    );
    if (!capMs) return request;
    const raced = await Promise.race([
        request.then(v => ({ ok: true, v }), e => ({ ok: false, e })),
        new Promise(r => setTimeout(() => r({ ok: false, timeout: true }), capMs)),
    ]);
    if (raced.ok) return raced.v;
    // Timed out: the handler above will still setSpotPrices when it lands.
    return null;
}

// ============================================================
// PWA install prompt
// ============================================================

let _installPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
    if (!isPWAInstallAllowed) {
        e.preventDefault();
        _installPrompt = null;
    } else {
        e.preventDefault();
        _installPrompt = e;
    }
    const btn = document.getElementById('btn-install');
    if (btn) btn.style.display = isPWAInstallAllowed ? 'inline-flex' : 'none';
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
}

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

    // Null guard: these buttons may not exist on all deployments (e.g., Cloudflare Pages)
    if (!listBtn || !albumBtn) {
        console.debug('[initViewToggle] view list/album buttons not found; skipping');
        return;
    }

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
        import('./notifications.js').then(m => m.showToast(`Layout: ${layoutNames[currentIdx]}`, 'info', 1500));
    });
}

// ============================================================
// User Guide Modal — First-time user onboarding
// Initialize the first-launch popup + guided tour
initFirstLaunch();


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