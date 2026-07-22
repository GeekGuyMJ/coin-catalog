/**
 * portfolio.js - Coin Catalog v2
 * Dashboard cards: Completion, Portfolio (V1-style), Bullion, Spot, Scrap, Paper, Custom
 */

import { el } from './utils.js?v=4';
import { onChange, getSpotPrices, getInventory, getSections,
    getScrapMetal, getPaperCurrency, getCustomCategories, getOtherCollectables,
    getBullion, getRawBullion, getCoinWeight, getWishlist
} from './state.js?v=4';
import { openScrapMetalModal, openPaperCurrencyModal, openCollectablesModal } from './modals.v2.js?v=4';
import { openPortfolioHistoryModal } from './portfolio_history.js?v=4';

import { fetchBullion, fetchRawBullion, fetchBulkCoins, fetchCoinWeight, fetchScrap, fetchOtherCollectables, fetchPaperCurrency, fetchCustomCategories, fetchBulkEntries, addBulkEntry, deleteBulkEntry } from './api.js?v=4';

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
        const { setBullion, setRawBullion, setScrapMetal, setPaperCurrency, setCustomCategories, setOtherCollectables } = await import('./state.js?v=4');
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

export function renderDashboard() {
    var c = document.getElementById('dashboard-grid');
    if (!c) return;
    var scrollY = window.scrollY;
    var currentHeight = c.offsetHeight;
    if (currentHeight > 0) c.style.minHeight = currentHeight + 'px';
    c.innerHTML = '';
    var p = _portfolioData || {};
    var prices = getSpotPrices();

    // Load visibility preferences
    var vis = {};
    try { vis = JSON.parse(localStorage.getItem('cc-card-visibility') || '{}'); } catch(e) {}

    // Always build all cards, respecting visibility toggles
    var cc = buildCompletionCard(getSections());
    if (cc) { if (vis['card-completion'] === false) cc.style.display='none'; addDragHandle(cc); c.appendChild(cc); }

    var pc = buildPortfolioBreakdownCard(p);
    if (pc) { if (vis['card-portfolio'] === false) pc.style.display='none'; addDragHandle(pc); c.appendChild(pc); }

    // Bullion card - uses raw bullion individual entries
    var bi = getRawBullion();
    var bc = buildBullionCard(bi, p, prices);
    if (bc) { if (vis['card-bullion'] === false) bc.style.display='none'; addDragHandle(bc); c.appendChild(bc); }

    // Coins by Weight card
    var cwCard = buildCoinsByWeightCard(_bulkCoinsData, prices);
    if (cwCard) { if (vis['card-coinweight'] === false) cwCard.style.display='none'; addDragHandle(cwCard); c.appendChild(cwCard); }

    // Spot prices card - always render (shows loading state if no data)
    var sc = buildSpotPricesCard(prices);
    if (sc) { if (vis['card-spot'] === false) sc.style.display='none'; addDragHandle(sc); c.appendChild(sc); }

    var sm = getScrapMetal();
    var s2 = buildScrapMetalCard(sm, prices); 
    if (s2) { if (vis['card-scrap'] === false) s2.style.display='none'; addDragHandle(s2); c.appendChild(s2); }


    var pap = getPaperCurrency();
    var p2 = buildPaperCurrencyCard(pap); 
    if (p2) { if (vis['card-paper'] === false) p2.style.display='none'; addDragHandle(p2); c.appendChild(p2); }

    var cats = getCustomCategories(); var cols = getOtherCollectables();
    var c2 = buildCustomCategoriesCard(cats, cols); 
    if (c2) { if (vis['card-custom'] === false) c2.style.display='none'; addDragHandle(c2); c.appendChild(c2); }

    var wl = getWishlist() || [];
    var w2 = buildWishlistCard(wl);
    if (w2) { if (vis['card-wishlist'] === false) w2.style.display='none'; addDragHandle(w2); c.appendChild(w2); }

    // Re-apply sort order after rebuilding DOM
    applyDashboardOrder();
    applyDashboardSizes();
    requestAnimationFrame(function() { 
        if (c) c.style.minHeight = '';
        window.scrollTo(0, scrollY); 
    });
}

function buildWishlistCard(wishlist) {
    var card = el('div', { className: 'card dashboard-card wishlist-card', id: 'card-wishlist', style: 'display:flex;flex-direction:column;' });
    
    // Header
    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-right:28px;flex-shrink:0;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;' }, '♥ Wishlist'));
    
    var countBadge = el('span', { 
        style: 'font-size:0.75em;background:var(--color-accent);color:var(--color-bg-card);padding:2px 8px;border-radius:10px;font-weight:700;' 
    }, wishlist.length + ' items');
    hdr.appendChild(countBadge);
    card.appendChild(hdr);
    
    // Wishlist items container
    var itemsDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;margin-bottom:10px;display:flex;flex-direction:column;gap:6px;padding-right:4px;' });
    
    if (!wishlist || wishlist.length === 0) {
        itemsDiv.appendChild(el('p', { style: 'font-size:0.82em;color:var(--color-text-muted);margin:0;padding:10px 0;text-align:center;' }, 'Your wishlist is empty. Tap the ♥ heart next to any coin in the catalog to add it.'));
    } else {
        wishlist.forEach(function(item) {
            var row = el('div', { 
                style: 'display:flex;justify-content:space-between;align-items:center;background:var(--color-accord-bg);border:1px solid var(--color-border-light);padding:6px 10px;border-radius:6px;font-size:0.85em;' 
            });
            if (item.acquired) {
                row.style.opacity = '0.6';
            }
            
            var left = el('div', { style: 'display:flex;flex-direction:column;gap:2px;' });
            var titleText = item.description || ('Coin #' + item.coin_id);
            var title = el('div', { style: 'font-weight:600;color:var(--color-text-main);' + (item.acquired ? 'text-decoration:line-through;' : '') }, titleText);
            if (item.target_grade) {
                title.appendChild(document.createTextNode(' '));
                title.appendChild(el('span', {
                    style: 'background:var(--color-accent);color:var(--color-bg-card);font-size:0.75em;padding:1px 4px;border-radius:3px;font-weight:700;'
                }, item.target_grade));
            }
            left.appendChild(title);
            
            var metaParts = [];
            if (item.category) metaParts.push(item.category);
            if (item.max_price) metaParts.push('Max: $' + Number(item.max_price).toFixed(2));
            if (metaParts.length > 0) {
                left.appendChild(el('div', { style: 'font-size:0.78em;color:var(--color-text-muted);' }, metaParts.join(' · ')));
            }
            row.appendChild(left);
            
            // Checkmark button (toggle acquired directly)
            var checkBtn = el('button', {
                style: 'background:transparent;border:none;cursor:pointer;font-size:1.1em;padding:4px;',
                title: item.acquired ? 'Mark as not acquired' : 'Mark as acquired'
            }, item.acquired ? '✅' : '⬜');
            checkBtn.onclick = async function(e) {
                e.stopPropagation();
                try {
                    var { updateWishlistItem, fetchWishlist } = await import('./api.js?v=4');
                    var { setWishlist } = await import('./state.js?v=4');
                    await updateWishlistItem(item.id, { acquired: !item.acquired });
                    var fresh = await fetchWishlist();
                    setWishlist(fresh || []);
                } catch(err) {
                    console.error('Failed to update wishlist item', err);
                }
            };
            row.appendChild(checkBtn);
            
            itemsDiv.appendChild(row);
        });
    }
    card.appendChild(itemsDiv);
    
    // Manage wishlist button
    var manageBtn = el('button', {
        className: 'btn-secondary',
        style: 'width:100%;font-size:0.8em;padding:6px;justify-content:center;display:flex;align-items:center;'
    }, 'Manage Wishlist');
    manageBtn.onclick = function() {
        if (typeof window.openWishlistPanel === 'function') {
            window.openWishlistPanel();
        }
    };
    card.appendChild(manageBtn);
    
    return card;
}

function buildCompletionCard(sections) {
    if (!sections || !sections.length) return null;
    var total = sections.reduce(function(s,e){return s+e.total;}, 0);
    var owned = sections.reduce(function(s,e){return s+e.owned;}, 0);
    var pct = total > 0 ? Math.round(owned/total*100) : 0;
    var card = el('div',{className:'card dashboard-card completion-card',id:'card-completion'});
    card.append(
        el('div',{className:'card-title'},'Collection Completion'),
        el('div',{className:'dashboard-big-number'}, pct+'%'),
        el('div',{className:'dashboard-detail'}, owned.toLocaleString()+' of '+total.toLocaleString()+' coin types owned')
    );
    var pw = el('div',{className:'dashboard-progress'});
    var pb = el('div',{className:'dashboard-progress-bar'}); pb.style.width=pct+'%'; pw.appendChild(pb);
    card.appendChild(pw);
    return card;
}


function buildPortfolioBreakdownCard(p) {
    var total = p.total_estimated_value || 0;
    var melt = p.total_melt || 0;
    var face = p.face_value || 0;
    var coins = p.total_physical_coins || 0;
    var items = p.total_items || 0;
    if (total===0 && melt===0) return null;

    var history = JSON.parse(localStorage.getItem('cc-portfolio-history') || '[]');
    var now = Date.now();
    // Add current value if it changed or it's been an hour
    if (total > 0) {
        if (history.length === 0 || now - history[history.length-1].t > 3600000 || Math.abs(history[history.length-1].v - total) > 0.01) {
            history.push({t: now, v: total});
            if (history.length > 1000) history.shift();
            localStorage.setItem('cc-portfolio-history', JSON.stringify(history));
        }
    }
    
    // Seed empty histories so sparkline shows on first load
    if (history.length < 2 && total > 0) {
        history = [
            { t: now - 86400000 * 365, v: total * 0.90 },
            { t: now - 86400000 * 180, v: total * 0.95 },
            { t: now - 86400000 * 30, v: total * 0.98 },
            { t: now - 86400000 * 7, v: total * 0.99 },
            { t: now, v: total }
        ];
        localStorage.setItem('cc-portfolio-history', JSON.stringify(history));
    }

    var card = el('div',{className:'card dashboard-card portfolio-card',id:'card-portfolio'});
    card.appendChild(el('div',{className:'card-title'},'Portfolio Overview'));

    // Top section: Total on top, Sparkline below it
    var topSec = el('div', {style:'display:flex; flex-direction:column; margin-bottom:8px; gap:8px; min-height: 60px;'});
    
    var leftSec = el('div', {style:'width:100%; display:flex; flex-direction:column; align-items:flex-start;'});
    leftSec.appendChild(el('div',{className:'dashboard-big-number', style:'margin-top:0;'},fmt(total)));
    var sum = [];
    if (coins>0) sum.push(coins.toLocaleString()+' physical coins');
    if (items>0 && items!==coins) sum.push(items.toLocaleString()+' total items');
    if (sum.length) leftSec.appendChild(el('div',{className:'dashboard-detail',style:'margin:0 0 8px;font-size:0.82em;'},sum.join(' \u00b7 ')));
    topSec.appendChild(leftSec);

    var rightSec = el('div', {style:'width:100%; display:flex; flex-direction:column; align-items:flex-end;'});
    var cvs = el('canvas', {style:'width:100%; height:60px;'});
    rightSec.appendChild(cvs);

    var btnRow = el('div', {style:'display:flex; gap:8px; margin-top:4px; font-size:0.7em;'});
    var periods = [
        {label:'1D', ms:86400000},
        {label:'1M', ms:30*86400000},
        {label:'1Y', ms:365*86400000},
        {label:'10Y', ms:3650*86400000}
    ];
    var activePeriod = localStorage.getItem('cc-portfolio-period') || '1Y';
    
    function drawChart(periodLabel) {
        var ms = periods.find(p => p.label === periodLabel).ms;
        var filtered = ms > 0 ? history.filter(h => now - h.t <= ms) : history;
        if (filtered.length < 2) filtered = history; // fallback
        requestAnimationFrame(() => {
            var cw = cvs.clientWidth || 300;
            _sparkline(cvs, filtered.map(h => ({v: h.v})), '#10b981', cw, 60);
        });
        // update btn styles
        [...btnRow.children].forEach(b => {
            b.style.color = b.textContent === periodLabel ? 'var(--color-accent)' : 'var(--color-text-muted)';
            b.style.fontWeight = b.textContent === periodLabel ? 'bold' : 'normal';
        });
    }

    periods.forEach(p => {
        var b = el('div', {style:'cursor:pointer; color:var(--color-text-muted); padding:2px;'}, p.label);
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            localStorage.setItem('cc-portfolio-period', p.label);
            drawChart(p.label);
        });
        btnRow.appendChild(b);
    });
    rightSec.appendChild(btnRow);
    topSec.appendChild(rightSec);

    card.appendChild(topSec);

    setTimeout(() => drawChart(activePeriod), 50);

    var g = el('div',{className:'finance-grid'});
    if (p.gold_coin_melt>0) g.appendChild(fRow('Gold Coins Melt',fmt(p.gold_coin_melt)));
    if (p.silver_coin_melt>0) g.appendChild(fRow('Silver Coins Melt',fmt(p.silver_coin_melt)));
    if (p.copper_coin_melt>0) g.appendChild(fRow('Copper Coins Melt',fmt(p.copper_coin_melt)));
    if (p.platinum_coin_melt>0) g.appendChild(fRow('Platinum Coins Melt',fmt(p.platinum_coin_melt)));
    if (p.palladium_coin_melt>0) g.appendChild(fRow('Palladium Coins Melt',fmt(p.palladium_coin_melt)));
    if (p.collectable_value>0) g.appendChild(fRow('Collectible Premium',fmt(p.collectable_value)));
    if (p.raw_bullion>0) g.appendChild(fRow('Bullion Holdings',fmt(p.raw_bullion)));
    if (p.bulk_coins_value>0) g.appendChild(fRow('Bulk Coins',fmt(p.bulk_coins_value)));
    if (p.scrap_value>0) g.appendChild(fRow('Scrap Metal',fmt(p.scrap_value)));
    if (p.paper_value>0) g.appendChild(fRow('Paper Currency',fmt(p.paper_value)));
    if (p.other_value>0) g.appendChild(fRow('Other Collectibles',fmt(p.other_value)));
    if (face>0) g.appendChild(fRow('Face Value',fmt(face)));
    g.appendChild(fRow('Total Melt Value',fmt(melt),true));
    g.appendChild(fRow('Total Portfolio',fmt(total),true,'grand-total'));
    card.appendChild(g);

    return card;
}

function fRow(label,value,isBold,isClass) {
    var d = el('div',{className:'finance-item'+(isClass?' '+isClass:'')});
    d.appendChild(el('span',{className:'finance-label'},label));
    d.appendChild(el('span',{className:'finance-value'+(isBold?' bold':'')},value));
    return d;
}


// =========================================================================
// V1-Style Inline Widget: Bullion Holdings Card (individual entries)
// =========================================================================

function getVisibleBullionMetals() {
    try {
        return JSON.parse(localStorage.getItem('cc-bullion-vis') || '{}');
    } catch(e) { return {}; }
}

function buildBullionCard(items, p, prices) {
    if (!Array.isArray(items)) items = [];
    var card = el('div', { className: 'card dashboard-card bullion-card', id: 'card-bullion', style: 'display:flex;flex-direction:column;' });

    // Totals per metal
    var totals = { gold: 0, silver: 0, platinum: 0, palladium: 0, copper: 0 };
    var entriesByMetal = { gold: [], silver: [], platinum: [], palladium: [], copper: [] };
    var metalOrder = ['gold', 'silver', 'platinum', 'palladium', 'copper'];
    var metalLabels = { gold: 'Gold', silver: 'Silver', platinum: 'Platinum', palladium: 'Palladium', copper: 'Copper' };
    var metalColors = { gold: '#d4af37', silver: '#94a3b8', platinum: '#38bdf8', palladium: '#a78bfa', copper: '#b45309' };
    var bullionVis = getVisibleBullionMetals();

    items.forEach(function(item) {
        var m = (item.metal_type || '').toLowerCase();
        if (!totals.hasOwnProperty(m)) return;
        var unit = (item.weight_unit || 'oz').toLowerCase();
        var rawW = item.weight || 0;
        var spotKey = m === 'copper' ? 'copper_lb' : m + '_oz';
        var w = rawW;
        // Convert to valuation unit (lbs for copper, ozt for precious metals)
        if (m === 'copper') {
            if (unit === 'oz' || unit === 'ozt') w = rawW / 16;
            else if (unit === 'g')   w = rawW / 453.592;
            else if (unit === 'kg')  w = rawW * 2.20462;
        } else {
            if (unit === 'g')        w = rawW / 31.1035;
            else if (unit === 'kg')  w = rawW * 32.1507;
            else if (unit === 'lbs') w = rawW * 14.5833;
            else if (unit === 'oz')  w = rawW / 1.09714;
        }
        var spot = prices[spotKey] || 0;
        totals[m] += w * spot;
        entriesByMetal[m].push(item);
    });

    // Header with total value
    var grandTotal = Object.values(totals).reduce(function(a, b) { return a + b; }, 0);
    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-shrink:0;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;' }, 'Bullion Holdings'));
    var hdrRight = el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);text-align:right;padding-right:28px;' });
    hdrRight.innerHTML = '<span style="font-size:1.1em;font-weight:700;color:var(--color-accent);">$' + grandTotal.toFixed(2) + '</span><br>' + items.length + ' entr' + (items.length !== 1 ? 'ies' : 'y');
    hdr.appendChild(hdrRight);
    card.appendChild(hdr);

    // Entries list grouped by metal — flex-grow to fill card height
    var listDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;margin-bottom:10px;' });
    if (items.length === 0) {
        listDiv.appendChild(el('p', { style: 'font-size:0.8em;color:var(--color-text-muted);margin:0 0 6px;' }, 'No bullion entries yet. Add your first entry below.'));
    } else {
        metalOrder.forEach(function(m) {
            var entries = entriesByMetal[m];
            if (!entries.length) return;
            if (bullionVis[m] === false) return;
            // Metal group header with total
            var spotKey = m === 'copper' ? 'copper_lb' : m + '_oz';
            var spot = prices[spotKey] || 0;
            listDiv.appendChild(el('div', {
                style: 'font-size:0.75em;font-weight:700;color:' + metalColors[m] + ';text-transform:uppercase;letter-spacing:0.05em;margin:6px 0 2px;display:flex;justify-content:space-between;'
            }, document.createTextNode(metalLabels[m]), el('span', {}, '$' + totals[m].toFixed(2))));
            entries.forEach(function(item) {
                var row = el('div', { className: 'v1-item-row' });
                var info = el('div', { style: 'flex:1;' });
                var label = item.label || (item.metal_type || '').charAt(0).toUpperCase() + (item.metal_type || '').slice(1) + ' bar';
                info.appendChild(el('span', { style: 'font-weight:600;font-size:0.9em;' }, label));
                var subParts = [];
                var iUnit = (item.weight_unit || 'oz').toLowerCase();
                var iW = item.weight || 0;
                subParts.push(iW.toFixed(2) + ' ' + iUnit);
                if (item.purity && item.purity < 1) subParts.push(Math.round(item.purity * 100) + '%');
                // Value for this item (convert to standard valuation unit)
                var convW = iW;
                if (m === 'copper') {
                    // Convert to lbs
                    if (iUnit === 'oz' || iUnit === 'ozt') convW = iW / 16;
                    else if (iUnit === 'g')   convW = iW / 453.592;
                    else if (iUnit === 'kg')  convW = iW * 2.20462;
                } else {
                    // Convert to troy oz
                    if (iUnit === 'g')        convW = iW / 31.1035;
                    else if (iUnit === 'kg')  convW = iW * 32.1507;
                    else if (iUnit === 'lbs') convW = iW * 14.5833;
                    else if (iUnit === 'oz')  convW = iW / 1.09714;
                }
                var val = convW * (prices[spotKey] || 0);
                if (val > 0) subParts.push('$' + val.toFixed(2));
                info.appendChild(el('div', { style: 'font-size:0.75em;color:var(--color-text-muted);' }, subParts.join(' · ')));
                if (item.notes) info.appendChild(el('div', { style: 'font-size:0.75em;color:var(--color-text-muted);font-style:italic;' }, item.notes));
                row.appendChild(info);
                var delBtn = el('button', { className: 'v1-del-btn', dataset: { action: 'v1-del-rawbullion', id: String(item.id) } }, '✕');
                row.appendChild(delBtn);
                listDiv.appendChild(row);
            });
        });
    }
    card.appendChild(listDiv);

    // Add form
    var form = el('div', { className: 'v1-form', style: 'flex-shrink:0;' });

    // Row 1: Label + Metal Type
    var row1 = el('div', { className: 'v1-form-row' });
    var labelIn = el('input', { className: 'v1-input', placeholder: 'Label (e.g. 1oz Gold Bar)', dataset: { field: 'rb-label' }, style: 'flex:1;' });
    var metalSel = el('select', { className: 'v1-select', dataset: { field: 'rb-metal' } });
    ['Gold', 'Silver', 'Platinum', 'Palladium', 'Copper'].forEach(function(m) {
        metalSel.appendChild(el('option', { value: m.toLowerCase() }, m));
    });
    row1.appendChild(labelIn);
    row1.appendChild(metalSel);
    form.appendChild(row1);

    // Row 2: Weight + Unit + Purity
    var row2 = el('div', { className: 'v1-form-row' });
    var wgtIn = el('input', { className: 'v1-input', type: 'number', step: '0.01', placeholder: 'Weight', dataset: { field: 'rb-weight' }, style: 'flex:1;min-width:60px;' });
    var unitSel = el('select', { className: 'v1-select', style: 'width:76px;', dataset: { field: 'rb-unit' } });
    [['oz','oz'],['ozt','troy oz'],['g','g'],['lbs','lbs'],['kg','kg']].forEach(function(u) {
        unitSel.appendChild(el('option', { value: u[0] }, u[1]));
    });
    var purityIn = el('input', { className: 'v1-input', type: 'number', step: '0.01', min: '0.01', max: '1', value: '1.0', placeholder: 'Purity', dataset: { field: 'rb-purity' }, style: 'width:60px;' });
    row2.appendChild(wgtIn);
    row2.appendChild(unitSel);
    row2.appendChild(purityIn);
    form.appendChild(row2);

    // Notes
    var notesIn = el('input', { className: 'v1-input', placeholder: 'Notes (optional)', dataset: { field: 'rb-notes' } });
    form.appendChild(notesIn);

    // Add button
    var addBtn = el('button', { className: 'v1-add-btn', dataset: { action: 'v1-add-rawbullion' } }, 'Add Bullion Entry');
    addBtn._labelIn = labelIn;
    addBtn._metalSel = metalSel;
    addBtn._wgtIn = wgtIn;
    addBtn._unitSel = unitSel;
    addBtn._purityIn = purityIn;
    addBtn._notesIn = notesIn;
    addBtn._prices = prices;
    form.appendChild(addBtn);

    card.appendChild(form);
    return card;
}

// =========================================================================
// V1-Style Inline Widget: Coins by Weight Card
// =========================================================================

// Metal type mapping for display
function getMetalLabel(metalType) {
    var map = {
        'CopperPennies': 'Copper Pennies 1959-1981',
        'ZincPennies': 'Zinc Pennies 1983-2025',
        'Nickels': 'Nickels',
        'CladDimes': 'Clad Dimes',
        'CladQuarters': 'Clad Quarters',
        'CladHalves': 'Clad Half Dollars',
        'SilverCoins90': '90% Silver Coins',
        // Canada
        'CanadianCopperPennies': 'Canadian Copper Pennies 1920-1996',
        'CanadianZincPennies': 'Canadian Zinc Pennies 1997-2012',
        'CanadianNickels': 'Canadian Nickels',
        'CanadianSilverDimes': 'Canadian Silver Dimes (pre-1968)',
        'CanadianCladDimes': 'Canadian Clad Dimes (1968+)',
        'CanadianSilverQuarters': 'Canadian Silver Quarters (pre-1968)',
        'CanadianCladQuarters': 'Canadian Clad Quarters (1968+)',
        'CanadianHalfDollars': 'Canadian 50¢ Pieces',
        'CanadianLoonies': 'Canadian Loonies (1$)'
    };
    return map[metalType] || metalType;
}

// Grams per coin for estimation (coin count)
function getGramsPerCoin(metalType) {
    var map = {
        'CopperPennies': 3.11,
        'ZincPennies': 2.5,
        'Nickels': 5.0,
        'CladDimes': 2.268,
        'CladQuarters': 5.67,
        'CladHalves': 11.34,
        // Canada
        'CanadianCopperPennies': 3.24,
        'CanadianZincPennies': 2.35,
        'CanadianNickels': 4.54,
        'CanadianSilverDimes': 2.33,
        'CanadianCladDimes': 1.75,
        'CanadianSilverQuarters': 5.83,
        'CanadianCladQuarters': 4.4,
        'CanadianHalfDollars': 11.66,
        'CanadianLoonies': 7.0
    };
    return map[metalType] || null;
}

// Coin calculation function: value and estimate
function calcCoinValue(entry, prices) {
    var grams = entry.total_weight_grams || entry.weight_grams || 0;
    var val = 0, coinCount = 0, detail = '';
    var isMelt = false;
    
    if (entry.metal_type === 'CopperPennies') {
        // 3.11g each, 95% copper
        var copperLb = prices['copper_lb'] || 0;
        val = grams * 0.95 * copperLb / 453.592;
        coinCount = Math.round(grams / 3.11);
        detail = copperLb > 0 ? ' at $' + copperLb.toFixed(2) + '/lb copper' : '';
        isMelt = true;
    } else if (entry.metal_type === 'ZincPennies') {
        coinCount = Math.round(grams / 2.5);
        val = coinCount * 0.01;
        detail = ' × 0.01';
    } else if (entry.metal_type === 'Nickels') {
        coinCount = Math.round(grams / 5.0);
        val = coinCount * 0.05;
        detail = ' × 0.05';
    } else if (entry.metal_type === 'CladDimes') {
        coinCount = Math.round(grams / 2.268);
        val = coinCount * 0.10;
        detail = ' × 0.10';
    } else if (entry.metal_type === 'CladQuarters') {
        coinCount = Math.round(grams / 5.67);
        val = coinCount * 0.25;
        detail = ' × 0.25';
    } else if (entry.metal_type === 'CladHalves') {
        coinCount = Math.round(grams / 11.34);
        val = coinCount * 0.50;
        detail = ' × 0.50';
    } else if (entry.metal_type === 'SilverCoins90') {
        // 90% silver coins: weight in grams → ozt
        var ozt = grams / 31.1035;
        val = ozt * (prices['silver_oz'] || 0) * 0.90;
        coinCount = null;
        detail = (prices['silver_oz'] || 0) > 0 ? ' at $' + (prices['silver_oz'] || 0).toFixed(2) + '/oz silver' : '';
        isMelt = true;
    }
    
    return { value: val, coinCount: coinCount, detail: detail, isMelt: isMelt };
}

function buildCoinsByWeightCard(bulkEntries, prices) {
    var card = el('div', { className: 'card dashboard-card coinweight-card', id: 'card-coinweight', style: 'display:flex;flex-direction:column;' });

    // Header with total value and name
    var totalVal = 0;
    (bulkEntries || []).forEach(function(entry) {
        totalVal += calcCoinValue(entry, prices).value;
    });

    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-shrink:0;' });
    var titleDiv = el('div', { className: 'card-title', style: 'margin-bottom:0;' }, 'Bulk Coins');
    hdr.appendChild(titleDiv);
    var hdrRight = el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);text-align:right;padding-right:28px;' });
    hdrRight.innerHTML = '<span style="font-size:1.1em;font-weight:700;color:var(--color-accent);">$' + totalVal.toFixed(2) + '</span><br>' + (bulkEntries || []).length + ' entr' + ((bulkEntries || []).length !== 1 ? 'ies' : 'y');
    hdr.appendChild(hdrRight);
    card.appendChild(hdr);

    // Entries list — flex-grow to fill card height
    var entriesDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;margin-bottom:10px;' });
    if (!bulkEntries || bulkEntries.length === 0) {
        entriesDiv.appendChild(el('p', { style: 'font-size:0.8em;color:var(--color-text-muted);margin:0 0 6px;' }, 'No bulk coin entries yet. Add your first batch below.'));
    } else {
        // Group entries by metal type
        var groups = {};
        (bulkEntries || []).forEach(function(entry) {
            var m = entry.metal_type || 'Other';
            if (!groups[m]) groups[m] = [];
            groups[m].push(entry);
        });

        var metalOrder = ['CopperPennies', 'ZincPennies', 'Nickels', 'CladDimes', 'CladQuarters', 'CladHalves', 'SilverCoins90'];
        var metalColors = {
            'CopperPennies': '#b45309',
            'ZincPennies': '#64748b',
            'Nickels': '#92400e',
            'CladDimes': '#64748b',
            'CladQuarters': '#64748b',
            'CladHalves': '#64748b',
            'SilverCoins90': '#94a3b8'
        };

        metalOrder.forEach(function(m) {
            var entries = groups[m];
            if (!entries || entries.length === 0) return;
            var subParts = [];
            // Metal group header
            var metalLabelText = getMetalLabel(m);
            var spotDetailText = '';
            if (m === 'SilverCoins90') {
                var sSpot = prices['silver_oz'] || 0;
                spotDetailText = sSpot > 0 ? ` ($${sSpot.toFixed(2)}/oz silver)` : '';
            } else if (m === 'CopperPennies') {
                var cSpot = prices['copper_lb'] || 0;
                spotDetailText = cSpot > 0 ? ` ($${cSpot.toFixed(2)}/lb copper)` : '';
            }
            entriesDiv.appendChild(el('div', {
                style: 'font-size:0.75em;font-weight:700;color:' + metalColors[m] + ';text-transform:uppercase;letter-spacing:0.05em;margin:6px 0 2px;'
            }, metalLabelText + spotDetailText));

            entries.forEach(function(entry) {
                var row = el('div', { className: 'v1-item-row' });
                var info = el('div', { style: 'flex:1;' });

                var label = entry.label || getMetalLabel(entry.metal_type);
                if (label.startsWith('1.0 ')) label = label.substring(4);
                if (label === '1.0') label = getMetalLabel(entry.metal_type);
                info.appendChild(el('span', { style: 'font-weight:600;font-size:0.9em;' }, label));

                var calc = calcCoinValue(entry, prices);
                var gramVal = entry.total_weight_grams || entry.weight_grams || 0;
                var unit = entry.weight_unit || (entry.metal_type === 'SilverCoins90' ? 'g' : 'lbs');
                var displayWeight = '';
                if (unit === 'lbs') {
                    displayWeight = (gramVal / 453.592).toFixed(2) + ' lbs';
                } else if (unit === 'oz') {
                    displayWeight = (gramVal / 28.3495).toFixed(2) + ' oz';
                } else if (unit === 'kg') {
                    displayWeight = (gramVal / 1000).toFixed(2) + ' kg';
                } else {
                    displayWeight = gramVal.toFixed(1) + ' g';
                }

                // Show weight + coin estimate
                var weightParts = [displayWeight];
                if (calc.coinCount) {
                    weightParts.push('≈ ' + calc.coinCount.toLocaleString() + ' coins');
                }
                info.appendChild(el('div', { style: 'font-size:0.75em;color:var(--color-text-muted);' }, weightParts.join(' · ')));

                if (entry.notes) {
                    info.appendChild(el('div', { style: 'font-size:0.75em;color:var(--color-text-muted);font-style:italic;' }, entry.notes));
                }

                row.appendChild(info);
                // Value display + melt/face badge
                var valRight = el('div', { style: 'display:flex;flex-direction:column;align-items:flex-end;gap:2px;padding-right:8px;' });
                valRight.appendChild(el('span', { style: 'font-weight:700;font-size:0.9em;color:var(--color-accent);' }, '$' + calc.value.toFixed(2)));
                var badgeColor = calc.isMelt ? '#f59e0b' : '#64748b';
                var badgeText = calc.isMelt ? 'Melt' : 'Face';
                valRight.appendChild(el('span', { style: 'font-size:0.65em;font-weight:600;color:' + badgeColor + ';text-transform:uppercase;letter-spacing:0.03em;' }, badgeText));
                row.appendChild(valRight);
                var delBtn = el('button', { className: 'btn-secondary v1-del-btn', dataset: { action: 'v1-del-bulkentry', id: String(entry.id) } }, '✕');
                row.appendChild(delBtn);
                entriesDiv.appendChild(row);
            });
        });
    }
    card.appendChild(entriesDiv);

    // Add form - matches Bullion pattern
    var form = el('div', { className: 'v1-form', style: 'flex-shrink:0;' });

    // Row 1: Label + Metal Type
    var row1 = el('div', { className: 'v1-form-row' });
    var labelIn = el('input', { className: 'v1-input', placeholder: 'Label (e.g. Wheat Cents)', dataset: { field: 'be-label' }, style: 'flex:1;' });
    var metalSel = el('select', { className: 'v1-select', dataset: { field: 'be-metal' } });
    ['Copper Pennies 1959-1981', 'Zinc Pennies 1983-2025', 'Nickels', 'Clad Dimes', 'Clad Quarters', 'Clad Half Dollars', '90% Silver Coins',
     // Canada (small → large)
     'Canadian Copper Pennies 1920-1996', 'Canadian Zinc Pennies 1997-2012', 'Canadian Nickels', 'Canadian Silver Dimes (pre-1968)', 'Canadian Clad Dimes (1968+)', 'Canadian Silver Quarters (pre-1968)', 'Canadian Clad Quarters (1968+)', 'Canadian 50¢ Pieces', 'Canadian Loonies (1$)'].forEach(function(label) {
        metalSel.appendChild(el('option', { value: label }, label));
    });
    row1.appendChild(labelIn);
    row1.appendChild(metalSel);
    form.appendChild(row1);

    // Row 2: Weight + Unit
    var row2 = el('div', { className: 'v1-form-row' });
    var wgtIn = el('input', { className: 'v1-input', type: 'number', step: '0.01', placeholder: 'Weight', dataset: { field: 'be-weight' }, style: 'flex:1;min-width:60px;' });
    var unitSel = el('select', { className: 'v1-select', style: 'width:76px;', dataset: { field: 'be-unit' } });
    [['lbs','lbs'],['g','g'],['oz','oz'],['kg','kg']].forEach(function(u) {
        unitSel.appendChild(el('option', { value: u[0] }, u[1]));
    });
    row2.appendChild(wgtIn);
    row2.appendChild(unitSel);
    form.appendChild(row2);

    // Notes
    var notesIn = el('input', { className: 'v1-input', placeholder: 'Notes (optional)', dataset: { field: 'be-notes' } });
    form.appendChild(notesIn);

    // Add button
    var addBtn = el('button', { className: 'v1-add-btn', dataset: { action: 'v1-add-bulkentry' } }, 'Add Bulk Entry');
    addBtn._labelIn = labelIn;
    addBtn._metalSel = metalSel;
    addBtn._wgtIn = wgtIn;
    addBtn._unitSel = unitSel; // Map new unit selector
    addBtn._notesIn = notesIn;
    form.appendChild(addBtn);

    card.appendChild(form);
    return card;
}


// Spot price history storage
function _getSpotHistory() {
    try { return JSON.parse(localStorage.getItem('spot_history') || '{}'); } catch(e) { return {}; }
}
function _saveSpotHistory(h) {
    localStorage.setItem('spot_history', JSON.stringify(h));
}
function _addSpotPoint(history, key, value, max) {
    if (!history[key]) history[key] = [];
    history[key].push({ t: Date.now(), v: value });
    // Keep last max points
    if (history[key].length > max) history[key] = history[key].slice(-max);
}

// Generate realistic deterministic chart data for a period
function getSeededChartData(metalKey, currentPrice, period) {
    var points = 60;
    var data = [];
    var now = Date.now();
    
    // Seed based on metalKey and the current day's timestamp
    var dayTimestamp = Math.floor(now / 86400000);
    var seed = 0;
    for (var i = 0; i < metalKey.length; i++) {
        seed += metalKey.charCodeAt(i);
    }
    seed += dayTimestamp;
    
    function random() {
        var x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }
    
    var tempPrice = currentPrice * (0.8 + random() * 0.1); // start lower
    var interval = 0;
    if (period === '1M') interval = 30 * 86400000 / points;
    else if (period === '1Y') interval = 365 * 86400000 / points;
    else if (period === 'ALL') interval = 5 * 365 * 86400000 / points;
    
    for (var i = 0; i < points; i++) {
        var t = now - (points - i) * interval;
        var change = (random() - 0.47) * 0.02; // slight upward bias
        tempPrice = tempPrice * (1 + change);
        data.push({ t: t, v: tempPrice });
    }
    
    var lastPoint = data[data.length - 1];
    var diff = currentPrice - lastPoint.v;
    for (var i = 0; i < points; i++) {
        data[i].v += diff * (i / (points - 1));
    }
    
    return data;
}

// Draw a sparkline canvas (crisp High-DPI support)
function _sparkline(canvas, data, color, width, height) {
    if (!data || data.length < 2) return;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    var vals = data.map(function(d){return d.v;});
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var range = max - min || 1;
    var pad = 4;
    var w = width - pad * 2;
    var h = height - pad * 2;

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    vals.forEach(function(v, i) {
        var x = pad + (i / (vals.length - 1)) * w;
        var y = pad + h - ((v - min) / range) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw fill under line
    ctx.lineTo(pad + w, pad + h);
    ctx.lineTo(pad, pad + h);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, pad, 0, pad + h);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, color + '05');
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw current value dot
    var lastX = pad + w;
    var lastY = pad + h - ((vals[vals.length-1] - min) / range) * h;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

// Track which canvas elements need updating
var _spotCanvases = [];

function buildSpotPricesCard(prices) {
    var card = el('div',{className:'card dashboard-card spot-card',id:'card-spot'});
    
    var titleRow = el('div', {style:'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;padding-right:28px;'});
    titleRow.appendChild(el('div',{className:'card-title', style:'margin-bottom:0;'},'Live Spot Prices'));
    
    var btnRow = el('div', {style:'display:flex; gap:8px; font-size:0.7em;'});
    var periods = [
        {label:'1D', range:'1D'},
        {label:'1W', range:'1W'},
        {label:'1M', range:'1M'},
        {label:'1Y', range:'1Y'},
        {label:'All', range:'All'}
    ];
    var activePeriod = localStorage.getItem('cc-spot-period') || '1M';
    
    // Automatically trigger fetch if we don't have data for the active period (and it's not 1D)
    if (activePeriod !== '1D' && (!window._historicalSpotData || window._historicalSpotData._period !== activePeriod)) {
        if (!window._fetchingHistory) {
            window._fetchingHistory = true;
            fetch('/api/spot_history?period=' + activePeriod)
                .then(r => r.json())
                .then(hist => {
                    window._historicalSpotData = hist;
                    window._historicalSpotData._period = activePeriod;
                    window._fetchingHistory = false;
                    renderDashboard();
                })
                .catch(e => { window._fetchingHistory = false; });
        }
    }
    
    periods.forEach(p => {
        var b = el('div', {
            style:'cursor:pointer; color: ' + (p.label === activePeriod ? 'var(--color-accent)' : 'var(--color-text-muted)') + '; font-weight: ' + (p.label === activePeriod ? 'bold' : 'normal') + '; padding:2px;'
        }, p.label);
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            localStorage.setItem('cc-spot-period', p.label);
            window._historicalSpotData = null; // Clear old data to show empty sparkline while loading
            renderDashboard();
        });
        btnRow.appendChild(b);
    });
    titleRow.appendChild(btnRow);
    card.appendChild(titleRow);

    if (prices && prices._meta && prices._meta.is_stale) {
        var warnDate = prices._meta.updated_at === 'Never' ? 'Never' : new Date(prices._meta.updated_at).toLocaleString();
        var warning = el('div', {
            style: 'color: #ea580c; font-size: 0.85em; background: rgba(234, 88, 12, 0.1); padding: 6px 10px; border-radius: 6px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;'
        });
        warning.innerHTML = '<span>⚠</span> <span>API Offline. Showing cached prices from <b>' + warnDate + '</b></span>';
        card.appendChild(warning);
    }

    // Get visible bullion metals setting
    var bullionVis = getVisibleBullionMetals();

    // Update history
    var history = _getSpotHistory();
    var metals = [
        {key:'gold_oz',l:'Gold',c:'#d4af37'},
        {key:'silver_oz',l:'Silver',c:'#94a3b8'},
        {key:'copper_lb',l:'Copper',c:'#b45309'},
        {key:'platinum_oz',l:'Platinum',c:'#38bdf8'},
        {key:'palladium_oz',l:'Palladium',c:'#a78bfa'}
    ];
    // Filter by visible metals
    var filteredMetals = metals.filter(function(m) {
        var metalKey = m.key.replace('_oz','').replace('_lb','');
        return bullionVis[metalKey] !== false;
    });
    var now = Date.now();
    // Seed empty histories FIRST so sparklines have data even on first visit
    metals.forEach(function(m) {
        if (prices[m.key] && (!history[m.key] || history[m.key].length < 2)) {
            history[m.key] = [
                { t: now - 86400000, v: prices[m.key] * (1 + (Math.random() * 0.04 - 0.02)) },
                { t: now - 43200000, v: prices[m.key] * (1 + (Math.random() * 0.02 - 0.01)) },
            ];
        }
    });
    _saveSpotHistory(history);
    // Then add the current data point
    metals.forEach(function(m) {
        if (prices[m.key]) _addSpotPoint(history, m.key, prices[m.key], 60);
    });
    _saveSpotHistory(history);
    // Track session open price for meaningful change display (resets on tab close)
    var sessionOpen = {};
    try { sessionOpen = JSON.parse(sessionStorage.getItem('cc-spot-session') || '{}'); } catch(e) {}
    var sessionDirty = false;
    metals.forEach(function(m) {
        if (prices[m.key] && !sessionOpen[m.key]) {
            sessionOpen[m.key] = prices[m.key];
            sessionDirty = true;
        }
    });
    if (sessionDirty) {
        try { sessionStorage.setItem('cc-spot-session', JSON.stringify(sessionOpen)); } catch(e) {}
    }

    var g = el('div',{className:'spot-grid'});
    _spotCanvases = []; // Reset for this render

    filteredMetals.forEach(function(m) {
        if (!prices[m.key]) return;
        // Change relative to session open price
        var openPrice = sessionOpen[m.key] || prices[m.key];
        var change = prices[m.key] - openPrice;
        var changePct = openPrice > 0 ? (change / openPrice * 100) : 0;
        var changeColor = change >= 0 ? '#22c55e' : '#ef4444';
        var changeSign = change >= 0 ? '+' : '';
        
        var data = [];
        if (activePeriod === '1D') {
            data = history[m.key] || [];
        } else {
            data = (window._historicalSpotData && window._historicalSpotData[m.key]) ? window._historicalSpotData[m.key] : [];
        }
        
        var minVal = data.length > 1 ? Math.min.apply(null,data.map(function(x){return x.v;})) : null;
        var maxVal = data.length > 1 ? Math.max.apply(null,data.map(function(x){return x.v;})) : null;

        // Each metal gets a full row
        var row = el('div',{className:'spot-item', style:'display:flex; justify-content:space-between; align-items:center; gap:8px;'});
        
        // Left: metal name + current price + change indicator
        var left = el('div',{className:'spot-left', style:'display:flex; flex-direction:column; min-width:90px; flex: 1;'});
        left.appendChild(el('div',{className:'spot-label', style:'font-weight:bold; margin-bottom:2px;'},m.l));
        
        var priceLine = el('div', {style:'display:flex; flex-direction:column; gap:2px; line-height:1.2;'});
        priceLine.appendChild(el('span',{className:'spot-value',style:'color:'+m.c},'$'+prices[m.key].toFixed(2)));
        if (data.length > 1) {
            var mid = el('span',{className:'spot-change',style:'color:'+changeColor+';font-size:0.75em;font-weight:600; white-space:nowrap;'});
            mid.textContent = changeSign + change.toFixed(2) + ' (' + changeSign + changePct.toFixed(1) + '%)';
            mid.title = 'Session range: $' + minVal.toFixed(2) + ' - $' + maxVal.toFixed(2);
            priceLine.appendChild(mid);
        }
        left.appendChild(priceLine);
        row.appendChild(left);

        // Right: sparkline
        var right = el('div',{className:'spot-right', style:'flex: 1; min-width: 60px; max-width: 160px; height: 32px; display: flex; justify-content: flex-end;'});
        var canvas = el('canvas',{
            className:'spot-sparkline',
            style:'width:100%; height:32px;',
            title: data.length > 1 ? 'Range: $'+minVal.toFixed(2)+' - $'+maxVal.toFixed(2)+' ('+data.length+' data points)' : 'Collecting data...'
        });
        _spotCanvases.push(function() {
            requestAnimationFrame(() => {
                var cw = canvas.clientWidth || 160;
                _sparkline(canvas, data, m.c, cw, 32);
            });
        });
        right.appendChild(canvas);
        row.appendChild(right);
        g.appendChild(row);
    });
    card.appendChild(g);

    // Draw all sparklines after DOM update
    requestAnimationFrame(function() {
        _spotCanvases.forEach(function(fn) {
            fn();
        });
    });

    // Last updated timestamp
    var ts = el('div',{style:'font-size:0.65em;color:var(--color-text-muted);margin-top:6px;text-align:right;'});
    ts.textContent = 'Updated: ' + new Date().toLocaleTimeString();
    card.appendChild(ts);

    return card;
}

function updateSpotCardPrices() {
    var prices = getSpotPrices();
    if (!prices) return;
    var spotCard = document.getElementById('card-spot');
    if (!spotCard) return;
    var bullionVis = getVisibleBullionMetals();
    var metals = ['gold','silver','copper','platinum','palladium'];
    metals.forEach(function(m) {
        if (bullionVis[m] === false) return;
        var v = prices[m+'_oz'];
        if (!v) return;
        var el = spotCard.querySelector('[data-spot="'+m+'"]');
        if (el) el.textContent = '$' + v.toFixed(2);
    });
    var updatedEl = spotCard.querySelector('.spot-updated');
    if (updatedEl) updatedEl.textContent = 'Updated: ' + new Date().toLocaleTimeString();
}

// Auto-poll spot prices every 60 seconds
var _spotPollTimer = null;
function startSpotPricePolling() {
    if (_spotPollTimer) return;
    _spotPollTimer = setInterval(function() {
        fetch('/api/spot_prices').then(function(r){return r.json();}).then(function(prices) {
            if (prices && (prices.gold_oz || prices.silver_oz)) {
                // Update state - this triggers onChange('spotPrices', ...) which calls renderDashboard
                var stateMod = window.__state;
                if (stateMod && stateMod.setSpotPrices) {
                    stateMod.setSpotPrices(prices);
                } else {
                    // Fallback: update spot prices card in-place without destroying dashboard
                    updateSpotCardPrices();
                }
            }
        }).catch(function(){});
    }, 60000); // Poll every 60 seconds
}

// Also listen for state changes as backup

// Start polling on load
if (document.readyState === 'complete') {
    startSpotPricePolling();
} else {
    window.addEventListener('load', startSpotPricePolling);
}

function fmtDenom(d) { return '$' + (Number(d) >= 1 ? d : (d * 100) + '¢'); }

// =========================================================================
// V1-Style Inline Widget: Scrap Metal Card
// =========================================================================

function buildScrapMetalCard(items, prices) {
    if (!Array.isArray(items)) items = [];

    var totalWt = 0, totalVal = 0;
    items.forEach(function(i) {
        totalWt += i.weight_grams || 0;
        var spot = prices[(i.metal_type||'').toLowerCase()+'_oz'] || 0;
        if ((i.metal_type||'').toLowerCase() === 'copper') spot = (prices.copper_lb||0) / 14.5833;
        totalVal += ((i.weight_grams||0) / 31.1035) * (i.purity||1) * spot;
    });

    var card = el('div', { className: 'card dashboard-card scrap-card', id: 'card-scrap', style: 'display:flex;flex-direction:column;' });
    // Header with title + totals
    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-shrink:0;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;' }, 'Scrap Precious Metals'));
    var hdrRight = el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);text-align:right;padding-right:28px;' });
    hdrRight.innerHTML = '<span style="font-size:1.1em;font-weight:700;color:var(--color-accent);">$' + totalVal.toFixed(2) + '</span><br>' + items.length + ' item' + (items.length !== 1 ? 's' : '') + ' · ' + totalWt.toFixed(1) + 'g';
    hdr.appendChild(hdrRight);
    card.appendChild(hdr);

    // Existing items list
    var listDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;margin-bottom:10px;' });
    if (items.length === 0) {
        listDiv.appendChild(el('p', { style: 'font-size:0.8em;color:var(--color-text-muted);margin:0 0 6px;' }, 'No scrap items yet.'));
    } else {
        items.forEach(function(item) {
            var spot = prices[(item.metal_type||'').toLowerCase()+'_oz'] || 0;
            if ((item.metal_type||'').toLowerCase() === 'copper') spot = (prices.copper_lb||0) / 14.5833;
            var meltVal = ((item.weight_grams||0) / 31.1035) * (item.purity||1) * spot;
            var row = el('div', { className: 'v1-item-row' });
            var info = el('div', { style: 'flex:1;' });
            info.appendChild(el('span', { style: 'font-weight:600;font-size:0.9em;' }, item.name));
            info.appendChild(el('span', { style: 'color:var(--color-text-muted);font-size:0.8em;margin-left:6px;' }, '(' + (item.weight_grams||0).toFixed(1) + 'g ' + (item.metal_type||'') + ((item.purity && item.purity < 1) ? ' ' + Math.round(item.purity * 100) + '%' : '') + ')'));
            if (meltVal > 0) info.appendChild(el('span', { style: 'color:var(--color-accent);font-weight:700;margin-left:6px;font-size:0.85em;' }, '$' + meltVal.toFixed(2)));
            if (item.notes) info.appendChild(el('div', { style: 'font-size:0.75em;color:var(--color-text-muted);font-style:italic;' }, item.notes));
            row.appendChild(info);
            var delBtn = el('button', { className: 'v1-del-btn', dataset: { action: 'v1-del-scrap', id: String(item.id) } }, '✕');
            row.appendChild(delBtn);
            listDiv.appendChild(row);
        });
    }
    card.appendChild(listDiv);

    // Add form
    var form = el('div', { className: 'v1-form', style: 'flex-shrink:0;' });

    // Row 1: Item Name + Metal Type
    var row1 = el('div', { className: 'v1-form-row' });
    var nameIn = el('input', { className: 'v1-input', placeholder: 'Item Name', dataset: { field: 'sm-name' } });
    var metalSel = el('select', { className: 'v1-select', dataset: { field: 'sm-metal' } });
    ['Silver', 'Gold', 'Copper', 'Platinum', 'Palladium'].forEach(function(m) {
        metalSel.appendChild(el('option', { value: m.toLowerCase() }, m));
    });
    row1.appendChild(nameIn);
    row1.appendChild(metalSel);
    form.appendChild(row1);

    // Row 2: Purity + Weight + Unit
    var row2 = el('div', { className: 'v1-form-row' });
    var puritSel = el('select', { className: 'v1-select', dataset: { field: 'sm-purity' } });
    var purityPresets = {
        silver: [['0.925','Sterling (92.5%)'],['0.900','Coin Silver (90%)'],['0.999','Fine (99.9%)']],
        gold: [['0.417','10k (41.7%)'],['0.583','14k (58.3%)'],['0.750','18k (75%)'],['0.916','22k (91.6%)'],['0.999','24k (99.9%)']],
        copper: [['1.0','Pure (100%)']],
        platinum: [['0.900','90%'],['0.950','95%'],['0.999','99.9%']],
        palladium: [['0.900','90%'],['0.950','95%'],['0.999','99.9%']],
    };
    function refreshPurityOptions() {
        puritSel.innerHTML = '';
        (purityPresets[metalSel.value] || [['1.0','Pure']]).forEach(function(p) {
            puritSel.appendChild(el('option', { value: p[0] }, p[1]));
        });
        puritSel.appendChild(el('option', { value: 'custom' }, 'Custom...'));
    }
    refreshPurityOptions();
    metalSel.addEventListener('change', refreshPurityOptions);

    var wgtIn = el('input', { className: 'v1-input', type: 'number', step: '0.01', placeholder: 'Weight', dataset: { field: 'sm-weight' }, style: 'flex:1;min-width:60px;' });
    var unitSel = el('select', { className: 'v1-select', style: 'width:76px;', dataset: { field: 'sm-unit' } });
    [['g','g'],['ozt','troy oz'],['oz','oz'],['lbs','lbs'],['gr','grains']].forEach(function(u) {
        unitSel.appendChild(el('option', { value: u[0] }, u[1]));
    });
    row2.appendChild(puritSel);
    row2.appendChild(wgtIn);
    row2.appendChild(unitSel);
    form.appendChild(row2);

    var extraContainer = el('div', { style: 'display:none; flex-direction:column; gap:6px;' });
    
    // Custom purity input
    var customPurIn = el('input', { type: 'number', step: '0.1', min: '0.1', max: '100', placeholder: 'Purity % (e.g. 92.5)', style: 'display:none;width:calc(100% - 30px);padding:4px 8px;margin:0 auto;border-radius:4px;border:1px solid var(--color-border);background:var(--color-bg-body);color:var(--color-text-main);font-size:0.85em;text-align:center;' });
    extraContainer.appendChild(customPurIn);

    // Melt estimate
    var meltEst = el('div', { style: 'font-size:0.75em;color:var(--color-text-muted);display:none;' });
    extraContainer.appendChild(meltEst);
    
    form.appendChild(extraContainer);

    function updateExtraContainer() {
        var isCustom = puritSel.value === 'custom';
        var hasMelt = meltEst.style.display === 'block';
        extraContainer.style.display = (isCustom || hasMelt) ? 'flex' : 'none';
    }

    // Show/hide custom input when purity dropdown changes
    puritSel.addEventListener('change', function() {
        customPurIn.style.display = puritSel.value === 'custom' ? '' : 'none';
        updateMelt();
    });
    // Update melt estimate when custom purity value changes
    customPurIn.addEventListener('input', updateMelt);

    function updateMelt() {
        var w = parseFloat(wgtIn.value) || 0;
        var unit = unitSel.value;
        var grams = unit === 'ozt' ? w*31.1035 : unit === 'oz' ? w*28.3495 : unit === 'lbs' ? w*453.592 : unit === 'gr' ? w*0.06479891 : w;
        var metal = metalSel.value;
        var purity = puritSel.value === 'custom' ? ((parseFloat(customPurIn.value) || 0) / 100) : (parseFloat(puritSel.value) || 1);
        var spot = prices[metal+'_oz'] || 0;
        if (metal === 'copper') spot = (prices.copper_lb||0) / 14.5833;
        var mv = (grams/31.1035)*purity*spot;
        if (mv > 0) {
            var spotRateText = metal === 'copper' 
                ? `$${(prices.copper_lb||0).toFixed(2)}/lb`
                : `$${spot.toFixed(2)}/oz`;
            var pureWeightGrams = grams * purity;
            var pureWeightOzt = pureWeightGrams / 31.1035;
            
            meltEst.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px; line-height:1.3; margin-top:4px; border-top:1px dashed var(--color-border); padding-top:4px;">
                    <div><strong>Pure Content:</strong> ${pureWeightGrams.toFixed(2)}g (${pureWeightOzt.toFixed(3)} ozt)</div>
                    <div><strong>Spot Rate:</strong> ${spotRateText}</div>
                    <div style="color:var(--color-accent); font-weight:700;">Est. Melt: $${mv.toFixed(2)}</div>
                </div>
            `;
            meltEst.style.display = 'block';
        } else {
            meltEst.textContent = '';
            meltEst.style.display = 'none';
        }
        updateExtraContainer();
    }
    wgtIn.addEventListener('input', updateMelt);
    unitSel.addEventListener('change', updateMelt);
    metalSel.addEventListener('change', updateMelt);
    puritSel.addEventListener('change', updateMelt);

    // Notes input
    var notesIn = el('input', { className: 'v1-input', placeholder: 'Notes (optional)', dataset: { field: 'sm-notes' } });
    form.appendChild(notesIn);

    // Add button
    var addBtn = el('button', { className: 'v1-add-btn', dataset: { action: 'v1-add-scrap' } }, 'Add Scrap Item');
    form.appendChild(addBtn);

    // Store references for event handler
    addBtn._nameIn = nameIn;
    addBtn._metalSel = metalSel;
    addBtn._puritSel = puritSel;
    addBtn._wgtIn = wgtIn;
    addBtn._unitSel = unitSel;
    addBtn._notesIn = notesIn;
    addBtn._customPurIn = customPurIn;
    addBtn._prices = prices;

    card.appendChild(form);
    return card;
}

// =========================================================================
// V1-Style Inline Widget: Paper Currency Card
// =========================================================================


function buildPaperCurrencyCard(items) {
    if (!Array.isArray(items)) items = [];
    var totalVal = 0;
    items.forEach(function(i) { totalVal += i.value || 0; });

    var card = el('div', { className: 'card dashboard-card paper-card', id: 'card-paper', style: 'display:flex;flex-direction:column;' });

    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-shrink:0;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;' }, 'Paper Currency'));
    var hdrRight = el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);text-align:right;padding-right:28px;' });
    hdrRight.innerHTML = '<span style="font-size:1.1em;font-weight:700;color:var(--color-accent);">$' + totalVal.toFixed(2) + '</span><br>' + items.length + ' note' + (items.length !== 1 ? 's' : '');
    hdr.appendChild(hdrRight);
    card.appendChild(hdr);

    // Items list
    var listDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;margin-bottom:10px;' });
    if (items.length === 0) {
        listDiv.appendChild(el('p', { style: 'font-size:0.8em;color:var(--color-text-muted);margin:0 0 6px;' }, 'No banknotes yet.'));
    } else {
        items.forEach(function(item) {
            var row = el('div', { className: 'v1-item-row' });
            
            // Add thumbnails
            var thumbs = el('div', { style: 'display: flex; gap: 4px; align-items: center; margin-right: 8px;' });
            if (item.obv_image) {
                var oImg = el('img', { src: item.obv_image, style: 'width:32px; height:20px; object-fit:cover; border-radius:2px; border:1px solid var(--color-border); cursor:zoom-in;' });
                oImg.addEventListener('click', () => openLocalLightbox(item.obv_image));
                thumbs.appendChild(oImg);
            }
            if (item.rev_image) {
                var rImg = el('img', { src: item.rev_image, style: 'width:32px; height:20px; object-fit:cover; border-radius:2px; border:1px solid var(--color-border); cursor:zoom-in;' });
                rImg.addEventListener('click', () => openLocalLightbox(item.rev_image));
                thumbs.appendChild(rImg);
            }
            if (thumbs.childNodes.length > 0) {
                row.appendChild(thumbs);
            }

            var info = el('div', { style: 'flex:1;' });
            var label = fmtDenom(item.denomination) + ' Series ' + (item.series_year || '?');
            info.appendChild(el('span', { style: 'font-weight:600;font-size:0.9em;' }, label));
            if (item.is_star_note) info.appendChild(el('span', { style: 'margin-left:4px;color:gold;' }, '★'));
            var sub = [];
            if (item.serial_number) sub.push('Serial: ' + item.serial_number);
            if (item.friedberg) sub.push('Fr# ' + item.friedberg);
            if (item.signatures) sub.push('Sigs: ' + item.signatures);
            if (item.condition) sub.push(item.condition);
            if (item.value) sub.push('$' + parseFloat(item.value).toFixed(2));
            if (sub.length) info.appendChild(el('div', { style: 'font-size:0.75em;color:var(--color-text-muted);' }, sub.join(' | ')));
            if (item.notes) info.appendChild(el('div', { style: 'font-size:0.75em;color:var(--color-text-muted);font-style:italic;' }, item.notes));
            row.appendChild(info);
            var delBtn = el('button', { className: 'v1-del-btn', dataset: { action: 'v1-del-paper', id: String(item.id) } }, '✕');
            row.appendChild(delBtn);
            listDiv.appendChild(row);
        });
    }
    card.appendChild(listDiv);

    // Add form
    var form = el('div', { className: 'v1-form', style: 'flex-shrink:0;' });

    // Row 1: Denomination + Series
    var row1 = el('div', { className: 'v1-form-row' });
    var denomSel = el('select', { className: 'v1-select', dataset: { field: 'pc-denom' } });
    [1,2,5,10,20,50,100,500,1000].forEach(function(d) {
        denomSel.appendChild(el('option', { value: String(d) }, fmtDenom(d)));
    });
    var seriesIn = el('input', { className: 'v1-input', placeholder: 'Series (e.g. 1957A)', dataset: { field: 'pc-series' } });
    row1.appendChild(denomSel);
    row1.appendChild(seriesIn);
    form.appendChild(row1);

    // Row 2: Serial + Star note
    var row2 = el('div', { className: 'v1-form-row' });
    var serialIn = el('input', { className: 'v1-input', placeholder: 'Serial Number', dataset: { field: 'pc-serial' }, style: 'flex:1;' });
    var starLbl = el('label', { style: 'display:flex;align-items:center;gap:4px;font-size:0.85em;white-space:nowrap;cursor:pointer;' });
    var starCb = el('input', { type: 'checkbox', dataset: { field: 'pc-star' } });
    starLbl.appendChild(starCb);
    starLbl.appendChild(document.createTextNode('Star Note ★'));
    row2.appendChild(serialIn);
    row2.appendChild(starLbl);
    form.appendChild(row2);

    // Row 3: Est. Value + Notes
    var row3 = el('div', { className: 'v1-form-row' });
    var valIn = el('input', { className: 'v1-input', type: 'number', step: '0.01', placeholder: 'Est. Value ($)', dataset: { field: 'pc-value' } });
    var notesIn = el('input', { className: 'v1-input', placeholder: 'Notes (optional)', dataset: { field: 'pc-notes' } });
    row3.appendChild(valIn);
    row3.appendChild(notesIn);
    form.appendChild(row3);

    // Row 4: Friedberg + Signatures
    var row4 = el('div', { className: 'v1-form-row' });
    var friedbergIn = el('input', { className: 'v1-input', placeholder: 'Friedberg Number (e.g. Fr. 230)', dataset: { field: 'pc-friedberg' }, style: 'flex:1;' });
    var signaturesIn = el('input', { className: 'v1-input', placeholder: 'Signatures (e.g. Speelman/White)', dataset: { field: 'pc-signatures' }, style: 'flex:1;' });
    row4.appendChild(friedbergIn);
    row4.appendChild(signaturesIn);
    form.appendChild(row4);

    // Row 5: Obverse / Reverse file pickers
    var row5 = el('div', { className: 'v1-form-row', style: 'align-items:center; gap:8px;' });
    
    var obvContainer = el('div', { style: 'flex:1; display:flex; align-items:center; gap:6px;' });
    var obvFile = el('input', { type: 'file', accept: 'image/*', style: 'display:none;' });
    var obvBtn = el('button', { className: 'btn-secondary', style: 'padding:4px 8px; font-size:0.8em; display:flex; align-items:center; gap:4px; margin:0;' });
    obvBtn.innerHTML = ' Front';
    var obvPreview = el('img', { style: 'width:28px; height:20px; border-radius:2px; object-fit:cover; display:none;' });
    obvBtn.addEventListener('click', (e) => { e.preventDefault(); obvFile.click(); });
    
    let obvBase64 = null;
    obvFile.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            obvBase64 = await resizeAndCompressImage(e.target.files[0]);
            obvPreview.src = obvBase64;
            obvPreview.style.display = 'block';
        }
    });
    obvContainer.appendChild(obvFile);
    obvContainer.appendChild(obvBtn);
    obvContainer.appendChild(obvPreview);
    
    var revContainer = el('div', { style: 'flex:1; display:flex; align-items:center; gap:6px;' });
    var revFile = el('input', { type: 'file', accept: 'image/*', style: 'display:none;' });
    var revBtn = el('button', { className: 'btn-secondary', style: 'padding:4px 8px; font-size:0.8em; display:flex; align-items:center; gap:4px; margin:0;' });
    revBtn.innerHTML = ' Back';
    var revPreview = el('img', { style: 'width:28px; height:20px; border-radius:2px; object-fit:cover; display:none;' });
    revBtn.addEventListener('click', (e) => { e.preventDefault(); revFile.click(); });
    
    let revBase64 = null;
    revFile.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            revBase64 = await resizeAndCompressImage(e.target.files[0]);
            revPreview.src = revBase64;
            revPreview.style.display = 'block';
        }
    });
    revContainer.appendChild(revFile);
    revContainer.appendChild(revBtn);
    revContainer.appendChild(revPreview);
    
    row5.appendChild(obvContainer);
    row5.appendChild(revContainer);
    form.appendChild(row5);

    var addBtn = el('button', { className: 'v1-add-btn', dataset: { action: 'v1-add-paper' } }, 'Add Banknote');
    addBtn._denomSel = denomSel;
    addBtn._seriesIn = seriesIn;
    addBtn._serialIn = serialIn;
    addBtn._starCb = starCb;
    addBtn._valIn = valIn;
    addBtn._notesIn = notesIn;
    addBtn._friedbergIn = friedbergIn;
    addBtn._signaturesIn = signaturesIn;
    addBtn.getObvImage = () => obvBase64;
    addBtn.getRevImage = () => revBase64;
    form.appendChild(addBtn);

    card.appendChild(form);
    return card;
}

// =========================================================================
// V1-Style Inline Widget: Other Collectables Card
// =========================================================================

function buildCustomCategoriesCard(categories, collectables) {
    if (!Array.isArray(collectables)) collectables = [];
    if (!Array.isArray(categories)) categories = [];
    var totalVal = 0;
    collectables.forEach(function(i) { totalVal += i.estimated_value || 0; });

    var card = el('div', { className: 'card dashboard-card custom-card', id: 'card-custom', style: 'display:flex;flex-direction:column;' });

    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-shrink:0;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;' }, ' Other Collectables'));
    var hdrRight = el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);text-align:right;padding-right:28px;' });
    hdrRight.innerHTML = '<span style="font-size:1.1em;font-weight:700;color:var(--color-accent);">$' + totalVal.toFixed(2) + '</span><br>' + collectables.length + ' item' + (collectables.length !== 1 ? 's' : '');
    hdr.appendChild(hdrRight);
    card.appendChild(hdr);

    // Items list grouped by category
    var listDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;margin-bottom:10px;' });
    if (collectables.length === 0) {
        listDiv.appendChild(el('p', { style: 'font-size:0.8em;color:var(--color-text-muted);margin:0 0 6px;' }, 'No collectables yet.'));
    } else {
        // Group by category
        var bycat = {};
        collectables.forEach(function(item) {
            if (!bycat[item.category_name]) bycat[item.category_name] = [];
            bycat[item.category_name].push(item);
        });
        Object.keys(bycat).forEach(function(cat) {
            listDiv.appendChild(el('div', { style: 'font-size:0.75em;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em;margin:6px 0 2px;' }, cat));
            bycat[cat].forEach(function(item) {
                var row = el('div', { className: 'v1-item-row' });
                
                // Add photo thumbnail if exists
                if (item.personal_photo) {
                    var pImg = el('img', { src: item.personal_photo, style: 'width:28px; height:28px; object-fit:cover; border-radius:2px; margin-right:8px; border:1px solid var(--color-border); cursor:zoom-in;' });
                    pImg.addEventListener('click', () => openLocalLightbox(item.personal_photo));
                    row.appendChild(pImg);
                }

                var info = el('div', { style: 'flex:1;' });
                info.appendChild(el('span', { style: 'font-weight:600;font-size:0.9em;' }, item.name));
                if ((item.quantity||1) > 1) info.appendChild(el('span', { style: 'color:var(--color-text-muted);margin-left:4px;font-size:0.8em;' }, 'x' + item.quantity));
                if (item.estimated_value) info.appendChild(el('span', { style: 'color:var(--color-accent);font-weight:700;margin-left:6px;font-size:0.85em;' }, '$' + parseFloat(item.estimated_value).toFixed(2)));
                if (item.notes) info.appendChild(el('div', { style: 'font-size:0.75em;color:var(--color-text-muted);font-style:italic;' }, item.notes));
                row.appendChild(info);
                var delBtn = el('button', { className: 'v1-del-btn', dataset: { action: 'v1-del-collect', id: String(item.id) } }, '✕');
                row.appendChild(delBtn);
                listDiv.appendChild(row);
            });
        });
    }
    card.appendChild(listDiv);

    // Add form
    var form = el('div', { className: 'v1-form', style: 'flex-shrink:0;' });

    // Category row: select existing or type new
    var catRow = el('div', { className: 'v1-form-row' });
    var catSel = el('select', { className: 'v1-select', dataset: { field: 'oc-cat' } });
    catSel.appendChild(el('option', { value: '' }, '-- Category --'));
    categories.forEach(function(c) { catSel.appendChild(el('option', { value: c.name }, c.name)); });
    var newCatIn = el('input', { className: 'v1-input', placeholder: 'Or new category…', dataset: { field: 'oc-newcat' }, style: 'flex:1;' });
    catRow.appendChild(catSel);
    catRow.appendChild(newCatIn);
    form.appendChild(catRow);

    // Item name + Qty
    var row2 = el('div', { className: 'v1-form-row' });
    var nameIn = el('input', { className: 'v1-input', placeholder: 'Item name', dataset: { field: 'oc-name' }, style: 'flex:1;' });
    var qtyIn = el('input', { className: 'v1-input', type: 'number', value: '1', min: '1', placeholder: 'Qty', dataset: { field: 'oc-qty' }, style: 'width:60px;' });
    row2.appendChild(nameIn);
    row2.appendChild(qtyIn);
    form.appendChild(row2);

    // Value + Notes
    var row3 = el('div', { className: 'v1-form-row' });
    var valIn = el('input', { className: 'v1-input', type: 'number', step: '0.01', placeholder: 'Est. Value ($)', dataset: { field: 'oc-value' } });
    var notesIn = el('input', { className: 'v1-input', placeholder: 'Notes (optional)', dataset: { field: 'oc-notes' } });
    row3.appendChild(valIn);
    row3.appendChild(notesIn);
    form.appendChild(row3);

    // Row 4: Photo selector
    var row4 = el('div', { className: 'v1-form-row', style: 'align-items:center; gap:8px;' });
    var photoContainer = el('div', { style: 'flex:1; display:flex; align-items:center; gap:6px;' });
    var photoFile = el('input', { type: 'file', accept: 'image/*', style: 'display:none;' });
    var photoBtn = el('button', { className: 'btn-secondary', style: 'padding:4px 8px; font-size:0.8em; display:flex; align-items:center; gap:4px; margin:0;' });
    photoBtn.innerHTML = ' Photo';
    var photoPreview = el('img', { style: 'width:28px; height:20px; border-radius:2px; object-fit:cover; display:none;' });
    photoBtn.addEventListener('click', (e) => { e.preventDefault(); photoFile.click(); });
    
    let photoBase64 = null;
    photoFile.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            photoBase64 = await resizeAndCompressImage(e.target.files[0]);
            photoPreview.src = photoBase64;
            photoPreview.style.display = 'block';
        }
    });
    photoContainer.appendChild(photoFile);
    photoContainer.appendChild(photoBtn);
    photoContainer.appendChild(photoPreview);
    row4.appendChild(photoContainer);
    form.appendChild(row4);

    var addBtn = el('button', { className: 'v1-add-btn', dataset: { action: 'v1-add-collect' } }, 'Add Item');
    addBtn._catSel = catSel;
    addBtn._newCatIn = newCatIn;
    addBtn._nameIn = nameIn;
    addBtn._qtyIn = qtyIn;
    addBtn._valIn = valIn;
    addBtn._notesIn = notesIn;
    addBtn.getPhoto = () => photoBase64;
    form.appendChild(addBtn);

    card.appendChild(form);
    return card;
}



// =========================================================================
// Inline event delegation for V1-style card actions
// =========================================================================

function _showCardToast(msg, type) {
    try {
        import('./notifications.js?v=4').then(function(m){ m.showToast(msg, type || 'success'); });
    } catch(e) { console.log(msg); }
}

var _saving = false;
document.addEventListener('click', async function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;

    // ---- Scrap Metal ----
    if (action === 'v1-add-scrap') {
        if (_saving) return;
        _saving = true;
        btn.disabled = true;
        var nameIn   = btn._nameIn;
        var metalSel = btn._metalSel;
        var puritSel = btn._puritSel;
        var customPurIn = btn._customPurIn;
        var wgtIn    = btn._wgtIn;
        var unitSel  = btn._unitSel;
        var notesIn  = btn._notesIn;

        // Validation locked — no premature _saving release
        if (!nameIn || !nameIn.value.trim()) { _saving = false; btn.disabled = false; return _showCardToast('Item name is required', 'error'); }
        var w = parseFloat(wgtIn.value) || 0;
        if (!w) { _saving = false; btn.disabled = false; return _showCardToast('Weight is required', 'error'); }
        var unit = unitSel.value;
        var grams = unit === 'ozt' ? w*31.1035 : unit === 'oz' ? w*28.3495 : unit === 'lbs' ? w*453.592 : unit === 'gr' ? w*0.06479891 : w;

        try {
            var { saveScrap, fetchScrap } = await import('./api.js?v=4');
            var { setScrapMetal } = await import('./state.js?v=4');
            await saveScrap({
                name: nameIn.value.trim(),
                metal_type: metalSel.value,
                purity: puritSel.value === 'custom' ? ((parseFloat(customPurIn.value) || 0) / 100) : (parseFloat(puritSel.value) || 1.0),
                weight_grams: grams,
                notes: notesIn.value.trim()
            });
            var freshScrap = await fetchScrap();
            setScrapMetal(freshScrap);
            _showCardToast('Scrap item added', 'success');
            _saving = false;
            btn.disabled = false;
            fetchPortfolioAsync().then(function(pd){ _portfolioData = pd && pd.portfolio ? pd.portfolio : pd; _bulkCoinsData = pd && pd.bulkEntries ? pd.bulkEntries : []; renderDashboard(); });
        } catch(err) {
            _showCardToast('Error: ' + err.message, 'error');
            _saving = false;
            btn.disabled = false;
        }
        return;
    }

    if (action === 'v1-del-scrap') {
        var scrapId = parseInt(btn.dataset.id);
        if (!scrapId) return;
        try {
            var { deleteScrap, fetchScrap } = await import('./api.js?v=4');
            var { setScrapMetal } = await import('./state.js?v=4');
            await deleteScrap(scrapId);
            var freshScrap = await fetchScrap();
            setScrapMetal(freshScrap);
            _showCardToast('Deleted', 'info');
            _saving = false;
            fetchPortfolioAsync().then(function(pd){ _portfolioData = pd && pd.portfolio ? pd.portfolio : pd; _bulkCoinsData = pd && pd.bulkEntries ? pd.bulkEntries : []; renderDashboard(); });
        } catch(err) {
            _showCardToast('Error: ' + err.message, 'error');
            _saving = false;
        }
        return;
    }


    // ---- Raw Bullion (Bullion Holdings entries) ----
    if (action === 'v1-add-rawbullion') {
        if (_saving) return;
        _saving = true;
        btn.disabled = true;
        var rbLabelIn   = btn._labelIn;
        var rbMetalSel  = btn._metalSel;
        var rbWgtIn     = btn._wgtIn;
        var rbUnitSel  = btn._unitSel;
        var rbPurityIn = btn._purityIn;
        var rbNotesIn  = btn._notesIn;

        if (!rbWgtIn || !parseFloat(rbWgtIn.value)) {
            _saving = false; btn.disabled = false; return _showCardToast('Weight is required', 'error');
        }
        var w = parseFloat(rbWgtIn.value);
        var unit = rbUnitSel.value;
        try {
            var { saveRawBullion, fetchRawBullion } = await import('./api.js?v=4');
            var { setRawBullion } = await import('./state.js?v=4');
            await saveRawBullion({
                label: (rbLabelIn.value || '').trim(),
                metal_type: rbMetalSel.value,
                weight: w,
                weight_unit: unit,
                purity: parseFloat(rbPurityIn.value) || 1.0,
                notes: (rbNotesIn.value || '').trim()
            });
            var freshRb = await fetchRawBullion();
            setRawBullion(freshRb);
            _showCardToast('Bullion entry added', 'success');
            _saving = false;
            btn.disabled = false;
            fetchPortfolioAsync().then(function(pd){ _portfolioData = pd && pd.portfolio ? pd.portfolio : pd; _bulkCoinsData = pd && pd.bulkEntries ? pd.bulkEntries : []; renderDashboard(); });
        } catch(err) {
            _showCardToast('Error: ' + err.message, 'error');
            _saving = false;
            btn.disabled = false;
        }
        return;
    }

    if (action === 'v1-del-rawbullion') {
        var rbId = parseInt(btn.dataset.id);
        if (!rbId) return;
        try {
            var { deleteRawBullion, fetchRawBullion } = await import('./api.js?v=4');
            var { setRawBullion } = await import('./state.js?v=4');
            await deleteRawBullion(rbId);
            var freshRb = await fetchRawBullion();
            setRawBullion(freshRb);
            _showCardToast('Deleted', 'info');
            fetchPortfolioAsync().then(function(pd){ _portfolioData = pd && pd.portfolio ? pd.portfolio : pd; _bulkCoinsData = pd && pd.bulkEntries ? pd.bulkEntries : []; renderDashboard(); });
        } catch(err) {
            _showCardToast('Error: ' + err.message, 'error');
        }
        return;
    }

    // ---- Bulk Coins (Coins by Weight) ----
    if (action === 'v1-add-bulkentry') {
        if (_saving) return;
        _saving = true;
        btn.disabled = true;

        try {
            var { fetchBulkEntries, addBulkEntry } = await import('./api.js?v=4');
            var labelIn = btn._labelIn;
            var metalSel = btn._metalSel;
            var wgtIn = btn._wgtIn;
            var unitSel = btn._unitSel;
            var notesIn = btn._notesIn;

            var selectedLabel = metalSel && metalSel.selectedOptions[0] ? metalSel.selectedOptions[0].textContent : 'Copper Pennies';
            var metalMap = {
                'Copper Pennies 1959-1981': 'CopperPennies',
                'Zinc Pennies 1983-2025': 'ZincPennies',
                'Nickels': 'Nickels',
                'Clad Dimes': 'CladDimes',
                'Clad Quarters': 'CladQuarters',
                'Clad Half Dollars': 'CladHalves',
                '90% Silver Coins': 'SilverCoins90'
            };
            var metalType = metalMap[selectedLabel] || 'CopperPennies';
            
            var w = parseFloat(wgtIn.value) || 0;
            var unit = unitSel ? unitSel.value : 'lbs';
            var weightGrams = unit === 'lbs' ? w * 453.592 : unit === 'oz' ? w * 28.3495 : unit === 'kg' ? w * 1000 : w;

            await addBulkEntry({
                metal_type: metalType,
                total_weight_grams: weightGrams,
                weight_unit: unit,
                label: labelIn.value.trim(),
                notes: notesIn.value.trim()
            });
            var freshEntries = await fetchBulkEntries();
            _bulkCoinsData = (freshEntries && freshEntries.entries) ? freshEntries.entries : (Array.isArray(freshEntries) ? freshEntries : []);
            // Refresh portfolio data for real-time updates
            var freshP = await fetchPortfolioAsync();
            _portfolioData = freshP && freshP.portfolio ? freshP.portfolio : freshP;
            _showCardToast('Bulk entry added', 'success');
            _saving = false;
            btn.disabled = false;
            renderDashboard();
        } catch(err) {
            _showCardToast('Error: ' + err.message, 'error');
            _saving = false;
            btn.disabled = false;
        }
        return;
    }

    // ---- Bulk Coin Entry Delete ----
    if (action === 'v1-del-bulkentry') {
        var entryId = parseInt(btn.dataset.id);
        if (!entryId) return;
        try {
            var { fetchBulkEntries, deleteBulkEntry } = await import('./api.js?v=4');
            await deleteBulkEntry(entryId);
            var freshEntries = await fetchBulkEntries();
            _bulkCoinsData = (freshEntries && freshEntries.entries) ? freshEntries.entries : (Array.isArray(freshEntries) ? freshEntries : []);
            _showCardToast('deleted', 'info');
            _saving = false;
            renderDashboard();
        } catch(err) {
            _showCardToast('Error: ' + err.message, 'error');
            _saving = false;
        }
        return;
    }

    // ---- Paper Currency ----
    if (action === 'v1-add-paper') {
        if (_saving) return;
        _saving = true;
        btn.disabled = true;
        var denomSel = btn._denomSel;
        var seriesIn = btn._seriesIn;
        var serialIn = btn._serialIn;
        var starCb   = btn._starCb;
        var valIn    = btn._valIn;
        var pcNotesIn = btn._notesIn;
        var friedbergIn = btn._friedbergIn;
        var signaturesIn = btn._signaturesIn;

        var denom = parseFloat(denomSel.value) || 0;
        if (!denom) { _saving = false; btn.disabled = false; return _showCardToast('Denomination is required', 'error'); }

        try {
            var pcRes = await fetch('/api/paper_currency', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    denomination: denom,
                    series_year: seriesIn.value.trim(),
                    serial_number: serialIn.value.trim(),
                    is_star_note: starCb.checked,
                    condition: 'UNC',
                    value: parseFloat(valIn.value) || denom,
                    notes: pcNotesIn.value.trim(),
                    obv_image: btn.getObvImage ? btn.getObvImage() : null,
                    rev_image: btn.getRevImage ? btn.getRevImage() : null,
                    signatures: signaturesIn ? signaturesIn.value.trim() : "",
                    friedberg: friedbergIn ? friedbergIn.value.trim() : ""
                })
            });
            if (!pcRes.ok) throw new Error('HTTP ' + pcRes.status);
            var { fetchPaperCurrency } = await import('./api.js?v=4');
            var { setPaperCurrency } = await import('./state.js?v=4');
            var freshPaper = await fetchPaperCurrency();
            setPaperCurrency(freshPaper);
            _showCardToast('Banknote added', 'success');
            _saving = false;
            btn.disabled = false;
            fetchPortfolioAsync().then(function(pd){ _portfolioData = pd && pd.portfolio ? pd.portfolio : pd; _bulkCoinsData = pd && pd.bulkEntries ? pd.bulkEntries : []; renderDashboard(); });
        } catch(err) {
            _showCardToast('Error: ' + err.message, 'error');
            _saving = false;
            btn.disabled = false;
        }
        return;
    }

    if (action === 'v1-del-paper') {
        var paperId = parseInt(btn.dataset.id);
        if (!paperId) return;
        try {
            var delPcRes = await fetch('/api/paper_currency/' + paperId, { method: 'DELETE' });
            if (!delPcRes.ok) throw new Error('HTTP ' + delPcRes.status);
            var { fetchPaperCurrency } = await import('./api.js?v=4');
            var { setPaperCurrency } = await import('./state.js?v=4');
            var freshPaper = await fetchPaperCurrency();
            setPaperCurrency(freshPaper);
            _showCardToast('Deleted', 'info');
            _saving = false;
            fetchPortfolioAsync().then(function(pd){ _portfolioData = pd && pd.portfolio ? pd.portfolio : pd; _bulkCoinsData = pd && pd.bulkEntries ? pd.bulkEntries : []; renderDashboard(); });
        } catch(err) {
            _showCardToast('Error: ' + err.message, 'error');
            _saving = false;
        }
        return;
    }

    // ---- Other Collectables ----
    if (action === 'v1-add-collect') {
        if (_saving) return;
        _saving = true;
        btn.disabled = true;
        var catSel   = btn._catSel;
        var newCatIn = btn._newCatIn;
        var ocNameIn = btn._nameIn;
        var qtyIn    = btn._qtyIn;
        var ocValIn  = btn._valIn;
        var ocNotes  = btn._notesIn;

        var catName = (newCatIn.value.trim()) || (catSel.value) || '';
        if (!catName) { _saving = false; btn.disabled = false; return _showCardToast('Select or enter a category', 'error'); }
        if (!ocNameIn.value.trim()) { _saving = false; btn.disabled = false; return _showCardToast('Item name is required', 'error'); }

        try {
            var ocRes = await fetch('/api/other_collectables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category_name: catName,
                    name: ocNameIn.value.trim(),
                    quantity: parseInt(qtyIn.value) || 1,
                    estimated_value: parseFloat(ocValIn.value) || 0,
                    notes: ocNotes.value.trim(),
                    personal_photo: btn.getPhoto ? btn.getPhoto() : null
                })
            });
            if (!ocRes.ok) throw new Error('HTTP ' + ocRes.status);
            var { fetchOtherCollectables, fetchCustomCategories } = await import('./api.js?v=4');
            var { setOtherCollectables, setCustomCategories } = await import('./state.js?v=4');
            var [freshOC, freshCats] = await Promise.all([fetchOtherCollectables(), fetchCustomCategories()]);
            setOtherCollectables(freshOC);
            setCustomCategories(freshCats);
            _showCardToast('Item added', 'success');
            _saving = false;
            btn.disabled = false;
            fetchPortfolioAsync().then(function(pd){ _portfolioData = pd && pd.portfolio ? pd.portfolio : pd; _bulkCoinsData = pd && pd.bulkEntries ? pd.bulkEntries : []; renderDashboard(); });
        } catch(err) {
            _showCardToast('Error: ' + err.message, 'error');
            _saving = false;
            btn.disabled = false;
        }
        return;
    }

    if (action === 'v1-del-collect') {
        var ocId = parseInt(btn.dataset.id);
        if (!ocId) return;
        try {
            var delOcRes = await fetch('/api/other_collectables/' + ocId, { method: 'DELETE' });
            if (!delOcRes.ok) throw new Error('HTTP ' + delOcRes.status);
            var { fetchOtherCollectables } = await import('./api.js?v=4');
            var { setOtherCollectables } = await import('./state.js?v=4');
            var freshOC = await fetchOtherCollectables();
            setOtherCollectables(freshOC);
            _showCardToast('Deleted', 'info');
            _saving = false;
            fetchPortfolioAsync().then(function(pd){ _portfolioData = pd && pd.portfolio ? pd.portfolio : pd; _bulkCoinsData = pd && pd.bulkEntries ? pd.bulkEntries : []; renderDashboard(); });
        } catch(err) {
            _showCardToast('Error: ' + err.message, 'error');
            _saving = false;
        }
        return;
    }
});

function resizeAndCompressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500;
                const MAX_HEIGHT = 500;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                let dataUrl = canvas.toDataURL('image/webp', 0.8);
                if (dataUrl.startsWith('data:image/octet-stream') || dataUrl.startsWith('data:application/octet-stream')) {
                    dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                }
                resolve(dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function openLocalLightbox(base64Src) {
    let lightbox = document.getElementById('local-image-lightbox');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'local-image-lightbox';
        lightbox.className = 'logo-lightbox-overlay';
        lightbox.innerHTML = '<div class="lightbox-img-wrapper"><img src="" alt="Preview" style="max-width:90vw; max-height:90vh; border-radius:8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);"></div>';
        document.body.appendChild(lightbox);
        lightbox.addEventListener('click', () => lightbox.classList.remove('is-active'));
    }
    lightbox.querySelector('img').src = base64Src;
    lightbox.classList.add('is-active');
}

