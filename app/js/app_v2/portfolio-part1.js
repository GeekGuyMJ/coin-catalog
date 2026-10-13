// portfolio-part1.js - Auto-generated from portfolio.js
// Part 1 of 5 - loaded as regular script

var Portfolio = Portfolio || {};

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

function fmt(v) { return '$'+v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }


// ===== Multi-metal spot trend card (overlapping lines, log Y, draggable cursor) =====
// Estimates "collection value at time T" using the SAME melt formula the app already
// uses for bullion/scrap: value = (fine troy-oz of metal) x spot. We compute each
// metal's current real melt value (current spots) then scale by spotAtT / spotNow,
// which is mathematically identical to recomputing fine-oz x spotAtT.
function _computeMetalMeltNow(prices) {
    var melt = { gold:0, silver:0, platinum:0, palladium:0, copper:0 };
    try {
        var bi = (typeof getRawBullion === 'function') ? (getRawBullion() || []) : [];
        bi.forEach(function(item){
            var m = (item.metal_type || '').toLowerCase();
            if (!melt.hasOwnProperty(m)) return;
            var spotKey = m === 'copper' ? 'copper_lb' : m + '_oz';
            var spot = prices[spotKey] || 0;
            if (!spot) return;
            var unit = (item.weight_unit || 'oz').toLowerCase();
            var rawW = item.weight || 0;
            var w = rawW;
            if (m === 'copper') {
                if (unit === 'oz' || unit === 'ozt') w = rawW / 16;
                else if (unit === 'g') w = rawW / 453.592;
                else if (unit === 'kg') w = rawW * 2.20462;
            } else {
                if (unit === 'g') w = rawW / 31.1035;
                else if (unit === 'kg') w = rawW * 32.1507;
                else if (unit === 'lbs') w = rawW * 14.5833;
                else if (unit === 'oz') w = rawW / 1.09714;
            }
            melt[m] += w * spot;
        });
    } catch (e) {}
    try {
        var sm = (typeof getScrapMetal === 'function') ? (getScrapMetal() || []) : [];
        sm.forEach(function(item){
            var m = (item.metal_type || '').toLowerCase();
            if (!melt.hasOwnProperty(m)) return;
            var spotKey = m === 'copper' ? 'copper_lb' : m + '_oz';
            var spot = prices[spotKey] || 0;
            if (!spot) return;
            if (m === 'copper') spot = spot / 14.5833;
            melt[m] += ((item.weight_grams || 0) / 31.1035) * (item.purity || 1) * spot;
        });
    } catch (e) {}
    return melt;
}

function _interpAt(series, t) {
    if (!series || series.length === 0) return null;
    if (t <= series[0].t) return series[0].v;
    if (t >= series[series.length - 1].t) return series[series.length - 1].v;
    for (var i = 0; i < series.length - 1; i++) {
        var a = series[i], b = series[i + 1];
        if (t >= a.t && t <= b.t) {
            if (b.t === a.t) return b.v;
            var f = (t - a.t) / (b.t - a.t);
            return a.v + (b.v - a.v) * f;
        }
    }
    return series[series.length - 1].v;
}

function _fmtAxis(t) {
    var d = new Date(t);
    return (d.getMonth() + 1) + '/' + d.getFullYear();
}

function buildSpotTrendCard(prices) {
    var card = el('div', { className: 'card dashboard-card trend-card', id: 'card-trend', style: 'display:flex;flex-direction:column;' });
    var titleRow = el('div', { style: 'display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;padding-right:28px;' });
    titleRow.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;' }, 'Metal Price Trends'));

    var metals = [
        { key: 'gold_oz', base: 'gold', l: 'Gold', c: '#d4af37' },
        { key: 'silver_oz', base: 'silver', l: 'Silver', c: '#94a3b8' },
        { key: 'platinum_oz', base: 'platinum', l: 'Platinum', c: '#38bdf8' },
        { key: 'palladium_oz', base: 'palladium', l: 'Palladium', c: '#a78bfa' },
        { key: 'copper_lb', base: 'copper', l: 'Copper', c: '#b45309' }
    ];

    var btnRow = el('div', { className: 'spot-period-row', style: 'display:flex;gap:4px;font-size:0.62em;flex-wrap:nowrap;white-space:nowrap;' });
    var periods = ['1D', '1W', '1M', '1Y', '10Y', 'All'];
    var activePeriod = localStorage.getItem('cc-trend-period') || 'All';
    periods.forEach(function(p) {
        var b = el('div', { style: 'cursor:pointer;color:' + (p === activePeriod ? 'var(--color-accent)' : 'var(--color-text-muted)') + ';font-weight:' + (p === activePeriod ? 'bold' : 'normal') + ';padding:1px 2px;' }, p);
        b.addEventListener('click', function(e) { e.stopPropagation(); localStorage.setItem('cc-trend-period', p); renderDashboard(); });
        btnRow.appendChild(b);
    });
    titleRow.appendChild(btnRow);
    card.appendChild(titleRow);

    if (!window._spotHistoryStore) {
        card.appendChild(el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);padding:12px 0;' }, 'Collecting price history...'));
        return card;
    }

    var store = window._spotHistoryStore;
    var seriesByMetal = {};
    var allPts = [];
    metals.forEach(function(m) {
        var ser = getSeriesForPeriod(store, m.key, activePeriod) || [];
        seriesByMetal[m.key] = ser;
        ser.forEach(function(pt) { allPts.push(pt.t); });
    });
    if (allPts.length < 2) {
        card.appendChild(el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);padding:12px 0;' }, 'Not enough price history yet for this range.'));
        return card;
    }

    var tMin = Math.min.apply(null, allPts), tMax = Math.max.apply(null, allPts);
    var allVals = [];
    metals.forEach(function(m) { seriesByMetal[m.key].forEach(function(pt) { if (pt.v > 0) allVals.push(pt.v); }); });
    var vMin = Math.min.apply(null, allVals), vMax = Math.max.apply(null, allVals);
    var logMin = Math.log10(vMin), logMax = Math.log10(vMax);
    if (logMax === logMin) logMax = logMin + 1;

    var meltNow = _computeMetalMeltNow(prices);
    var canvas = el('canvas', { style: 'width:100%;height:200px;touch-action:none;cursor:ew-resize;' });
    card.appendChild(canvas);

    var legend = el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;font-size:0.72em;margin-top:6px;' });
    metals.forEach(function(m) {
        var item = el('div', { style: 'display:flex;align-items:center;gap:4px;' });
        item.appendChild(el('span', { style: 'width:10px;height:2px;background:' + m.c + ';display:inline-block;' }));
        item.appendChild(el('span', {}, m.l));
        item.dataset.metal = m.key;
        legend.appendChild(item);
    });
    card.appendChild(legend);

    var readout = el('div', { style: 'font-size:0.9em;margin-top:6px;padding:8px 10px;background:var(--color-accord-bg);border-radius:6px;' });
    card.appendChild(readout);

    var cursorT = (tMin + tMax) / 2;

    function xToT(x, W) {
        var pad = 8;
        var fx = (x - pad) / (W - 2 * pad);
        fx = Math.max(0, Math.min(1, fx));
        return tMin + fx * (tMax - tMin);
    }
    function draw() {
        var W = canvas.clientWidth || 300, H = 200;
        canvas.width = W; canvas.height = H;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        var pad = 8, top = 8, bot = H - 22;
        function ty(v) { var l = Math.log10(v > 0 ? v : 1); var f = (l - logMin) / (logMax - logMin); return bot - (bot - top) * f; }
        metals.forEach(function(m) {
            var ser = seriesByMetal[m.key]; if (!ser.length) return;
            ctx.strokeStyle = m.c; ctx.lineWidth = 2; ctx.beginPath();
            ser.forEach(function(pt, i) {
                var fx = (pt.t - tMin) / (tMax - tMin);
                var x = pad + fx * (W - 2 * pad);
                var y = ty(pt.v);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
        var cfx = (cursorT - tMin) / (tMax - tMin);
        var cx = pad + cfx * (W - 2 * pad);
        ctx.strokeStyle = 'rgba(148,163,184,0.8)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bot); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif';
        ctx.fillText(_fmtAxis(tMin), pad, bot + 16);
        ctx.fillText(_fmtAxis(tMax), Math.max(pad, W - 46), bot + 16);
    }
    function rebuildReadout() {
        var totalAtT = 0;
        var priceBits = [];
        metals.forEach(function(m) {
            var v = _interpAt(seriesByMetal[m.key], cursorT);
            if (v == null) return;
            var spotNow = prices[m.key] || 0;
            // Scale current holdings melt value to the historical spot ratio at cursorT.
            var meltAtT = spotNow > 0 ? (meltNow[m.base] || 0) * (v / spotNow) : (meltNow[m.base] || 0);
            totalAtT += meltAtT;
            var leg = legend.querySelector('[data-metal="' + m.key + '"]');
            if (leg) leg.title = '$' + v.toFixed(2);
            priceBits.push('<span style="color:' + m.c + ';font-weight:600;">' + m.l + ' $' + v.toFixed(2) + '</span>');
        });
        var dt = new Date(cursorT);
        var timePart = (activePeriod === '1D' || activePeriod === '1W') ? ' ' + dt.toLocaleTimeString() : '';
        var line1 = '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;"><span>@ ' + dt.toLocaleDateString() + timePart + '</span><span style="font-weight:700;color:var(--color-accent);">Est. collection value: $' + totalAtT.toFixed(2) + '</span></div>';
        var line2 = '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;font-size:1.0em;margin-top:4px;">' + priceBits.join('') + '</div>';
        var minT = null, maxT = null;
        metals.forEach(function(m){ var ser = seriesByMetal[m.key]; if (!ser || !ser.length) return; ser.forEach(function(pt){ if (minT===null||pt.t<minT) minT=pt.t; if (maxT===null||pt.t>maxT) maxT=pt.t; }); });
        var spanTxt = 'No price history yet';
        if (minT!==null && maxT!==null) {
          var df = function(t){ var d=new Date(t); return d.toLocaleDateString(); };
          spanTxt = (activePeriod==='All' ? 'Full history: ' : '') + df(minT) + ' \u2013 ' + df(maxT);
        }
        readout.innerHTML = line1 + line2 + '<div style="color:var(--color-text-muted);margin-top:2px;">' + spanTxt + '</div>';
    }
    function update() { draw(); rebuildReadout(); }

    canvas.addEventListener('pointerdown', function(e) { try { canvas.setPointerCapture(e.pointerId); } catch (x) {} var r = canvas.getBoundingClientRect(); cursorT = xToT(e.clientX - r.left, canvas.clientWidth); update(); });
    canvas.addEventListener('pointermove', function(e) { if (e.buttons === 0) return; var r = canvas.getBoundingClientRect(); cursorT = xToT(e.clientX - r.left, canvas.clientWidth); update(); });

    // Populate the size-affecting text before insertion; only canvas drawing
    // needs the attached element's width on the next animation frame.
    rebuildReadout();
    requestAnimationFrame(function() { draw(); });
    return card;
}

let _dashboardRenderGeneration = 0;

export async function renderDashboard() {
    const generation = ++_dashboardRenderGeneration;
    var prices = getSpotPrices();
    const c = document.getElementById('dashboard-grid');
    if (!c) return;
    var sc = await buildSpotPricesCard(prices);
    if (generation !== _dashboardRenderGeneration) return;
    // 2026-10-07 (COI-20): the DOM commit below IS synchronous, but emptying the
    // grid is still destructive to the scroll position. `innerHTML = ''` collapses
    // the document height for the remainder of this same frame; if the viewport is
    // scrolled below the collapsed document, the browser clamps scrollY down to
    // (collapsedDocHeight - viewportHeight) and never restores it. Rebuilding the
    // cards synchronously afterwards does NOT undo the clamp -- the scroll position
    // is already lost.
    //
    // Measured on self-hosted at 390x844 with the Wishlist card scrolled into view:
    // docHeight 5663 -> 1959 on the emptying write, so scrollY 2454 clamps to 1093
    // (1959 - 866). That is the "screen bounce/jump" reported for any dashboard card
    // interaction that re-renders (wishlist Acquire, inventory edits, etc.).
    //
    // Fix: hold a min-height on the grid for the duration of the rebuild so the
    // document never gets shorter than where the user currently is. Restoring the
    // scroll position afterwards does NOT work -- the restore runs while the
    // document is still collapsed, so it is clamped again to the same value.
    //
    // Only pin when the collapse would actually be destructive, so a re-render that
    // happens near the top of the page costs nothing.
    var _coi20Pin = _pinGridHeight(c);
    c.innerHTML = '';
    // COI-20: safety net. The normal release happens at the end of this
    // function, but a card builder that throws would otherwise leave the grid
    // pinned at a fixed height for the rest of the session. The release is
    // idempotent, so an early release here is harmless.
    setTimeout(function () { _coi20Pin(); }, 400);
    var p = _portfolioData || {};

    // Load visibility preferences
    var vis = {};
    try { vis = JSON.parse(localStorage.getItem('cc-card-visibility') || '{}'); } catch(e) {}

    // Always build all cards, respecting visibility toggles.
    //
    // DEFAULT ORDER (Matthew, 2026-10-09) -- what a NEW install sees:
    //    1 Portfolio Overview      7 Paper Currency
    //    2 Live Spot Prices        8 Other Collectables
    //    3 Metal Price Trends      9 Photos & Documents
    //    4 Bullion Holdings       10 Collection Completion
    //    5 Scrap Precious Metal   11 Wishlist
    //    6 Bulk Coins             12 Your Backup
    //                                13 Support this App
    //
    // The APPEND order below IS the default order. applyDashboardOrder() then
    // re-applies any saved drag order on top, so a dashboard the user has
    // already rearranged keeps their arrangement -- this is only the default.
    //
    // NOTE the spot card is already BUILT before this block (`var sc = await
    // buildSpotPricesCard(prices)` runs earlier); only its append moves.
    var pc = buildPortfolioBreakdownCard(p);
    if (pc) { if (vis['card-portfolio'] === false) pc.style.display='none'; addDragHandle(pc); c.appendChild(pc); }

    // Spot prices card (built above, before the synchronous DOM update).
    if (sc) { if (vis['card-spot'] === false) sc.style.display='none'; addDragHandle(sc); c.appendChild(sc); }

    var tc = buildSpotTrendCard(prices);
    if (tc) { if (vis['card-trend'] === false) tc.style.display='none'; addDragHandle(tc); c.appendChild(tc); }

    // Bullion card - uses raw bullion individual entries
    var bi = getRawBullion();
    var bc = buildBullionCard(bi, p, prices);
    if (bc) { if (vis['card-bullion'] === false) bc.style.display='none'; addDragHandle(bc); c.appendChild(bc); }

    var sm = getScrapMetal();
    var s2 = buildScrapMetalCard(sm, prices); 
    if (s2) { if (vis['card-scrap'] === false) s2.style.display='none'; addDragHandle(s2); c.appendChild(s2); }

    // Coins by Weight card
    var cwCard = buildCoinsByWeightCard(_bulkCoinsData, prices);
    if (cwCard) { if (vis['card-coinweight'] === false) cwCard.style.display='none'; addDragHandle(cwCard); c.appendChild(cwCard); }

    var pap = getPaperCurrency();
    var p2 = buildPaperCurrencyCard(pap); 
    if (p2) { if (vis['card-paper'] === false) p2.style.display='none'; addDragHandle(p2); c.appendChild(p2); }

    var cats = getCustomCategories(); var cols = getOtherCollectables();
    var c2 = buildCustomCategoriesCard(cats, cols); 
    if (c2) { if (vis['card-custom'] === false) c2.style.display='none'; addDragHandle(c2); c.appendChild(c2); }

    // 2026-10-09 (Matthew): the user's own Custom Dashboard Cards. The creator
    // modal has always written this store, but NOTHING read it, so a created
    // card saved, toasted success, and never rendered. This is the renderer
    // that was missing. Returns null when the list is empty, so no empty card
    // is added for users who have not made one.
    var ucc = buildCustomDashboardCardsCard(p);
    if (ucc) { if (vis['card-user-custom'] === false) ucc.style.display='none'; addDragHandle(ucc); c.appendChild(ucc); }

    // Photos & Documents gallery card
    var g2 = renderGalleryCard();
    if (g2) { if (vis['card-gallery'] === false) g2.style.display='none'; addDragHandle(g2); c.appendChild(g2); }

    // Completion ("Percentage Finished")
    // 2026-10-09 (Matthew) DEFAULT ORDER for a new install:
    //   Portfolio Overview, Live Spot Prices, Metal Price Trends,
    //   Bullion Holdings, Scrap Precious Metal, Bulk Coins, Paper Currency,
    //   Other Collectables, Photos & Documents, Collection Completion,
    //   Wishlist, Your Backup, Support this App.
    // The append order below IS the default order. applyDashboardOrder() then
    // re-applies any saved drag order on top, so a rearranged dashboard keeps
    // the arrangement the user chose.
    var cc = buildCompletionCard(getSections());
    if (cc) { if (vis['card-completion'] === false) cc.style.display='none'; addDragHandle(cc); c.appendChild(cc); }

    var wl = getWishlist() || [];
    var w2 = buildWishlistCard(wl);
    if (w2) { if (vis['card-wishlist'] === false) w2.style.display='none'; addDragHandle(w2); c.appendChild(w2); }

    // 2026-09-30: plain-language backup card (Matthew). One sentence
    // stating where the data lives, one button to act on it.
    var bkp = buildBackupCard();
    if (vis['card-backup'] === false) bkp.style.display = 'none';
    addDragHandle(bkp);
    c.appendChild(bkp);

    // Support card — always render LAST, respects visibility toggle.
    var sup = buildSupportCard();
    if (sup) { if (vis['card-support'] === false) sup.style.display='none'; addDragHandle(sup); c.appendChild(sup); }

    // Re-apply sort order after rebuilding DOM
    applyDashboardOrder();
    applyDashboardSizes();

    // COI-20: release the scroll-anchor pin now that the rebuilt cards
    // have their real heights back.
    if (typeof _coi20Pin === 'function') _coi20Pin();

}



// End of part 1
