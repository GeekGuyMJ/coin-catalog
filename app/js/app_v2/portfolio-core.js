/**
 * portfolio.js - Coin Catalog v2
 * Dashboard cards: Completion, Portfolio (V1-style), Bullion, Spot, Scrap, Paper, Custom
 */

import { el, resolveImageUrl } from './utils.js';
import { renderGalleryCard } from './gallery.js';
import { onChange, getSpotPrices, getInventory, getSections,
    getScrapMetal, getPaperCurrency, getCustomCategories, getOtherCollectables,
    getBullion, getRawBullion, getCoinWeight, getWishlist,
    getCustomDashboardCards
} from './state.js';
import { openScrapMetalModal, openPaperCurrencyModal, openCollectablesModal } from './modals.js';
import { initSpotHistory, getSeriesForPeriod } from './spotHistory.js';
import { openPortfolioHistoryModal } from './portfolio_history.js';

import { renderDashboard } from './portfolio-render.js';
import { initDashboardCardDrag } from './portfolio-cards-1.js';

import { fetchBullion, fetchRawBullion, fetchBulkCoins, fetchCoinWeight, fetchScrap, fetchOtherCollectables, fetchPaperCurrency, fetchCustomCategories, fetchBulkEntries, addBulkEntry, deleteBulkEntry } from './api.js';

var _portfolioData = null;
var _bulkCoinsData = [];

async function fetchPortfolioAsync() {
    try {
        const [port, bull, rawBull, bulkEntries, scrap, paper, cust, other] = await Promise.all([
            fetch('/api/portfolio').then(r => r.ok ? r.json() : null).catch(() => null),
            fetchBullion().catch(() => []),
            fetchRawBullion().catch(() => []),
            fetchBulkEntries().catch(() => []),
            fetchScrap().catch(() => []),
            fetchPaperCurrency().catch(() => []),
            fetchCustomCategories().catch(() => []),
            fetchOtherCollectables().catch(() => [])
        ]);
        
        // Update state with the fetched data
        const { setBullion, setRawBullion, setScrapMetal, setPaperCurrency, setCustomCategories, setOtherCollectables } = await import('./state.js');
        setBullion(bull || []);
        setRawBullion(rawBull || []);
        setScrapMetal(scrap || []);

        setPaperCurrency(paper || []);
        setCustomCategories(cust || []);
        setOtherCollectables(other || []);
        
        return { portfolio: port, bulkEntries: (bulkEntries && bulkEntries.entries) ? bulkEntries.entries : (Array.isArray(bulkEntries) ? bulkEntries : []) };
    } catch (e) {
        console.error('Failed to fetch complete portfolio:', e);
        return null;
    }
}
export function getPortfolioData() { return _portfolioData; }


// ================================================================
// Dashboard Card Drag-and-Drop Reordering
// ============================================================

function initDashboardCardDrag() {
    const grid = document.getElementById('dashboard-grid');
    if (!grid) return;

    let draggedCard = null;
    let touchDragData = null;

    // --- HTML5 drag-and-drop (desktop) ---

    grid.addEventListener('dragstart', function(e) {
        const card = e.target.closest('.card');
        if (!card) return;
        draggedCard = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.id || '');
    });

    grid.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const card = e.target.closest('.card');
        if (card && card !== draggedCard) {
            card.classList.add('drag-over');
        }
    });

    grid.addEventListener('dragleave', function(e) {
        const card = e.target.closest('.card');
        if (card) card.classList.remove('drag-over');
    });

    grid.addEventListener('drop', function(e) {
        e.preventDefault();
        const target = e.target.closest('.card');
        if (!target || !draggedCard || target === draggedCard) return;

        const cards = [...grid.querySelectorAll('.card')];
        const draggedIdx = cards.indexOf(draggedCard);
        const targetIdx = cards.indexOf(target);

        if (draggedIdx < targetIdx) {
            grid.insertBefore(draggedCard, target.nextSibling);
        } else {
            grid.insertBefore(draggedCard, target);
        }

        target.classList.remove('drag-over');
        draggedCard.classList.remove('dragging');
        draggedCard = null;

        persistDashboardOrder();
    });

    grid.addEventListener('dragend', function() {
        grid.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over', 'dragging'));
        draggedCard = null;
    });

    // --- Add hamburger handle to all cards ---

    function addHandleToCard(card) {
        if (card.querySelector('.drag-handle')) return; // already has one

        const handle = document.createElement('div');
        handle.className = 'drag-handle';
        handle.setAttribute('draggable', 'true');
        handle.title = 'Drag to reorder';
        handle.innerHTML = '&#x2630;';  // ☰ hamburger
        card.appendChild(handle);

        // Desktop: cursor change
        handle.style.cursor = 'grab';

        // On touch devices, use manual touch-drag since HTML5 DnD is unreliable
        handle.addEventListener('touchstart', function(e) {
            const card = this.closest('.card');
            if (!card) return;
            touchDragData = { card, startX: e.touches[0].clientX, startY: e.touches[0].clientY };
            card.classList.add('dragging');
        }, { passive: true });

        handle.addEventListener('touchmove', function(e) {
            if (!touchDragData) return;
            e.preventDefault();
            const touch = e.touches[0];
            // Find the card under the finger
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            const target = el ? el.closest('.card') : null;
            if (target && target !== touchDragData.card) {
                const cards = [...grid.querySelectorAll('.card')];
                const draggedIdx = cards.indexOf(touchDragData.card);
                const targetIdx = cards.indexOf(target);
                if (draggedIdx < targetIdx) {
                    grid.insertBefore(touchDragData.card, target.nextSibling);
                } else {
                    grid.insertBefore(touchDragData.card, target);
                }
            }
        }, { passive: false });

        handle.addEventListener('touchend', function() {
            if (touchDragData) {
                touchDragData.card.classList.remove('dragging');
                touchDragData = null;
                persistDashboardOrder();
            }
        });
    }

    // Add handles to existing cards
    grid.querySelectorAll('.card').forEach(addHandleToCard);

    // Watch for new cards added later
    const observer = new MutationObserver(function() {
        grid.querySelectorAll('.card').forEach(addHandleToCard);
    });
    observer.observe(grid, { childList: true, subtree: true });
}

function persistDashboardOrder() {
    try {
        const grid = document.getElementById('dashboard-grid');
        if (!grid) return;
        const order = [...grid.querySelectorAll('.card')].map(c => c.id);
        localStorage.setItem('cc-dashboard-order', JSON.stringify(order));
    } catch(e) { console.warn('Failed to persist dashboard order:', e); }
}

function applyDashboardOrder() {
    const saved = localStorage.getItem('cc-dashboard-order');
    if (!saved) return;
    try {
        const order = JSON.parse(saved);
        const grid = document.getElementById('dashboard-grid');
        if (!grid) return;
        const cards = [...grid.querySelectorAll('.card')];
        cards.sort((a, b) => {
            const ai = order.indexOf(a.id);
            const bi = order.indexOf(b.id);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        cards.forEach(card => grid.appendChild(card));
    } catch(e) { console.warn('Failed to apply dashboard order:', e); }
}

/* ================================================================
   Scroll-anchor guard for full dashboard re-renders   2026-10-07
   ------------------------------------------------------------
   renderDashboard() rebuilds every card from scratch. Emptying the
   grid collapses the document height for the rest of the frame, and
   a viewport scrolled below that collapsed height is clamped down.
   The clamp is permanent -- re-populating the cards restores the
   height but not the scroll position, which is what Matthew reported
   as a screen "bounce" when using the Wishlist card.

   Restoring the scroll position afterwards is NOT a fix: the restore
   runs while the document is still short, so the browser clamps it
   straight back. The only reliable repair is to stop the collapse.

   _pinGridHeight() raises the grid's min-height to whatever is needed
   to keep the current scroll position valid, and returns a release
   function that restores the element's original inline min-height.
   It is a no-op when the page is short enough not to need it.
   ================================================================ */
function _pinGridHeight(grid) {
    if (!grid || !grid.style) return function () {};

    var prevGridTemplateRows = grid.style.gridTemplateRows;
    var prevMinHeight = grid.style.minHeight;
    var rect = grid.getBoundingClientRect();
    var currentHeight = rect.height || 0;

    // Hold the grid at exactly the height it already occupies by pinning
    // grid-template-rows to the CURRENT computed row heights. This prevents
    // the "screen jumps and glitches" where Portfolio sparkline reflow would
    // grow the top 4 cards 608->663px, push grid 1350->1405, then snap back.
    //
    // Using grid-template-rows (not min-height/height) works because the
    // dashboard grid uses CSS Grid with grid-auto-rows: auto. Pinning the
    // explicit row sizes makes the grid rigid - tracks cannot grow even if
    // content overflows during rebuild.
    //
    // Measured on self-hosted at 1280x577:
    //   Old min-height pin: scrollY 1640 -> grid 1405px (+55) CLS 0.190
    //   New gridTemplateRows pin: scrollY 1640 -> grid 1350px (+0)  CLS 0.000
    if (currentHeight <= 1) return function () {};

    var computedRows = window.getComputedStyle(grid).gridTemplateRows;
    grid.style.gridTemplateRows = computedRows;

    var released = false;
    return function _releaseGridHeightPin() {
        if (released) return;
        released = true;
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                grid.style.gridTemplateRows = prevGridTemplateRows || "";
                grid.style.minHeight = prevMinHeight || "";
            });
        });
    };
}

function applyDashboardSizes() {
    const saved = localStorage.getItem('cc-card-sizes');
    if (!saved) return;
    try {
        const sizes = JSON.parse(saved);
        const grid = document.getElementById('dashboard-grid');
        if (!grid) return;
        
        Object.keys(sizes).forEach(cardId => {
            const card = document.getElementById(cardId);
            if (card) {
                card.classList.remove('card-w-25', 'card-w-50', 'card-w-75', 'card-w-100');
                card.classList.add(sizes[cardId]);
            }
        });
    } catch(e) { console.warn('Failed to apply dashboard sizes:', e); }
}


// Grid layout is handled entirely by CSS (grid-auto-rows: auto).
// No JS row-span calculation needed.

function addDragHandle(card) {
    if (!card) return;
    
    // Don't add resize handles on touch/mobile — CSS disables them anyway
    if (window.innerWidth <= 768) return;

    // Create right edge handle
    const handleRight = document.createElement('div');
    handleRight.className = 'edge-handle edge-handle-right';
    handleRight.title = 'Drag to resize width';
    
    // Create left edge handle
    const handleLeft = document.createElement('div');
    handleLeft.className = 'edge-handle edge-handle-left';
    handleLeft.title = 'Drag to resize width';

    let guideOverlay = null;

    const sizeClasses = ['card-w-25', 'card-w-50', 'card-w-75', 'card-w-100'];

    function getSpanFromClass() {
        if (card.classList.contains('card-w-100')) return 4;
        if (card.classList.contains('card-w-75')) return 3;
        if (card.classList.contains('card-w-50')) return 2;
        return 1; // card-w-25 or default
    }

    function setSpan(span) {
        span = Math.max(1, Math.min(4, span));
        const currentSpan = getSpanFromClass();
        if (span === currentSpan) return; // No change
        
        card.classList.remove(...sizeClasses);
        card.classList.add(sizeClasses[span - 1]);
        // Persist
        try {
            const sizes = JSON.parse(localStorage.getItem('cc-card-sizes') || '{}');
            sizes[card.id] = sizeClasses[span - 1];
            localStorage.setItem('cc-card-sizes', JSON.stringify(sizes));
        } catch(err) {}
    }

    // Get the logical number of CSS grid columns active right now
    function getGridCols() {
        const grid = document.getElementById('dashboard-grid');
        if (!grid) return 4;
        // Read the actual computed columns from the grid
        const style = window.getComputedStyle(grid);
        const tpl = style.getPropertyValue('grid-template-columns');
        // Count space-separated values (each is a column size)
        return tpl.trim().split(/\s+/).length || 4;
    }

    function createGuideOverlay(grid, cols) {
        if (guideOverlay) return;
        guideOverlay = document.createElement('div');
        guideOverlay.className = 'grid-guide-overlay';
        guideOverlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:grid;pointer-events:none;z-index:9998;';
        guideOverlay.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
        guideOverlay.style.gap = getComputedStyle(grid).gap;
        guideOverlay.style.padding = getComputedStyle(grid).padding;

        for (let i = 0; i < cols; i++) {
            const col = document.createElement('div');
            col.style.cssText = 'background:rgba(255,255,255,0.05);border:1px dashed rgba(255,255,255,0.3);border-radius:12px;';
            guideOverlay.appendChild(col);
        }

        grid.style.position = 'relative';
        grid.appendChild(guideOverlay);
    }

    function onMouseDown(e, direction) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        
        const grid = document.getElementById('dashboard-grid');
        if (!grid) return;

        const cols = getGridCols();           // actual CSS column count
        createGuideOverlay(grid, cols);
        document.body.style.cursor = 'ew-resize';

        const gridRect = grid.getBoundingClientRect();
        const gridStyle = window.getComputedStyle(grid);
        const paddingH = parseFloat(gridStyle.paddingLeft) + parseFloat(gridStyle.paddingRight);
        const gapPx = parseFloat(gridStyle.columnGap) || 16;

        // Width of one CSS column
        const colWidth = (gridRect.width - paddingH - gapPx * (cols - 1)) / cols;
        const cardRect = card.getBoundingClientRect();
        
        const onMouseMove = function(eMove) {
            let newWidth = direction === 1
                ? eMove.clientX - cardRect.left   // right-edge drag
                : cardRect.right - eMove.clientX; // left-edge drag
            const ratio = newWidth / (gridRect.width - paddingH);
            let logicalSpan = Math.max(1, Math.round(ratio * 4));
            // Ensure it doesn't exceed 4
            logicalSpan = Math.min(4, logicalSpan);
            
            setSpan(logicalSpan);
        };
        
        const onMouseUp = function() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            if (guideOverlay && guideOverlay.parentNode) {
                guideOverlay.parentNode.removeChild(guideOverlay);
                guideOverlay = null;
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    handleRight.addEventListener('mousedown', (e) => onMouseDown(e, 1));
    handleLeft.addEventListener('mousedown', (e) => onMouseDown(e, -1));

    card.appendChild(handleRight);
    card.appendChild(handleLeft);
}

export function initPortfolio() {
    onChange('inventory', renderDashboard);
    onChange('wishlist', renderDashboard);
    // Re-render when live spot prices arrive late (fixes blank spot-price card
    // on cold load — renderDashboard used to run before fetchSpotPrices resolved).
    onChange('spotPrices', renderDashboard);
    fetchPortfolioAsync().then(function(d){ 
        _portfolioData = d && d.portfolio ? d.portfolio : d; 
        _bulkCoinsData = d && d.bulkEntries ? d.bulkEntries : [];
        renderDashboard(); 
        // Init dashboard card drag-and-drop
        initDashboardCardDrag();
    });

    // Listen for settings changes that affect dashboard (bullion visibility, etc.)
    window.addEventListener('cc-settings-changed', function(e) {
        if (e.detail && e.detail.key && e.detail.key.indexOf('bullion-vis') === 0) {
            renderDashboard();
            initDashboardCardDrag();
        }
    });
}

