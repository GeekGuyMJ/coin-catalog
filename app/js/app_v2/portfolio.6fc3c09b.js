/**
 * portfolio.js - Coin Catalog v2
 * Dashboard cards: Completion, Portfolio (V1-style), Bullion, Spot, Scrap, Paper, Custom
 */

import { el } from './utils.js';
import { onChange, getSpotPrices, getInventory, getSections,
    getScrapMetal, getPaperCurrency, getCustomCategories, getOtherCollectables,
    getBullion } from './state.js';
import { openScrapMetalModal, openPaperCurrencyModal, openCollectablesModal } from './modals.js';
import { openPortfolioHistoryModal } from './portfolio_history.js';
import { buildInvestmentsCard } from './investments.js';

var _portfolioData = null;

function fetchPortfolioAsync() {
    return fetch('/api/portfolio').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
}
export function getPortfolioData() { return _portfolioData; }


// ================================================================
// Dashboard Card Drag-and-Drop Reordering
// ============================================================

function initDashboardCardDrag() {
    const grid = document.getElementById('dashboard-grid');
    if (!grid) return;

    let draggedCard = null;

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

        // Persist order
        persistDashboardOrder();
    });

    grid.addEventListener('dragend', function() {
        grid.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over', 'dragging'));
        draggedCard = null;
    });

    // Make cards draggable on drag-handle mousedown
    grid.querySelectorAll('.card').forEach(card => {
        card.setAttribute('draggable', 'false');
        const handle = card.querySelector('.drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', function() {
                card.setAttribute('draggable', 'true');
            });
            handle.addEventListener('mouseup', function() {
                card.setAttribute('draggable', 'false');
            });
        }
    });

    // Re-init when dashboard re-renders
    const observer = new MutationObserver(function() {
        grid.querySelectorAll('.card').forEach(card => {
            if (card.getAttribute('draggable') !== 'false') {
                card.setAttribute('draggable', 'false');
            }
            const handle = card.querySelector('.drag-handle');
            if (handle && !handle.dataset.dndInit) {
                handle.dataset.dndInit = 'true';
                handle.addEventListener('mousedown', function() {
                    card.setAttribute('draggable', 'true');
                });
                handle.addEventListener('mouseup', function() {
                    card.setAttribute('draggable', 'false');
                });
            }
        });
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


function addDragHandle(card) {
    if (!card) return;

    // Hamburger drag handle (top-right) — always added, even on mobile
    const hamburger = document.createElement('div');
    hamburger.className = 'drag-handle';
    hamburger.draggable = true;
    hamburger.title = 'Drag to reorder';
    hamburger.style.cssText = 'position:absolute;top:var(--space-4);right:var(--space-4);font-size:1.5rem;color:var(--color-text-muted);cursor:grab;user-select:none;opacity:0.5;z-index:3;line-height:1;';
    hamburger.textContent = '☰';
    card.appendChild(hamburger);

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

/** Create a small "?" in a circle help button for a card. */
function makeCardHelpIcon(cardKey, helpText) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'help-icon';
    btn.setAttribute('aria-label', 'Help');
    btn.title = helpText;
    btn.style.cssText = 'width:20px;height:20px;border-radius:50%;border:1px solid var(--color-border);background:var(--color-bg-card);color:var(--color-text-main);font-size:0.68rem;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-left:8px;';
    btn.textContent = '?';
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        openCardHelpPopup(cardKey, helpText);
    });
    return btn;
}

/** Open a small popup explaining how to use a card. */
function openCardHelpPopup(cardKey, helpText) {
    const existing = document.getElementById('card-help-' + cardKey);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'card-help-' + cardKey;
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = 'background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-5);max-width:360px;width:88vw;box-shadow:var(--shadow-xl);position:relative;';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.style.cssText = 'position:absolute;top:var(--space-2);right:var(--space-2);background:none;border:none;color:var(--color-text-muted);font-size:1.5rem;cursor:pointer;';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close');

    const title = document.createElement('h3');
    title.style.cssText = 'margin:0 0 var(--space-3) 0;color:var(--color-accent);font-size:var(--font-size-lg);';
    title.textContent = cardKey.replace(/^card-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const body = document.createElement('div');
    body.style.cssText = 'font-size:var(--font-size-sm);color:var(--color-text-main);line-height:1.5;';
    body.textContent = helpText;

    const okBtn = document.createElement('button');
    okBtn.className = 'btn-secondary';
    okBtn.style.cssText = 'margin-top:var(--space-3);padding:4px 12px;float:right;';
    okBtn.textContent = 'Got it';
    okBtn.addEventListener('click', () => overlay.remove());
    closeBtn.addEventListener('click', () => overlay.remove());

    box.appendChild(closeBtn);
    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(okBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

export function initPortfolio() {
    onChange('spotPrices', renderDashboard);
    onChange('inventory', renderDashboard);
    onChange('scrapMetal', renderDashboard);
    onChange('paperCurrency', renderDashboard);
    onChange('customCategories', renderDashboard);
    onChange('otherCollectables', renderDashboard);
    onChange('bullion', renderDashboard);
    fetchPortfolioAsync().then(function(d){ _portfolioData = d; renderDashboard(); 
    // Init dashboard card drag-and-drop
    initDashboardCardDrag();});
    applyDashboardOrder();
}

function fmt(v) { return '$'+v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }

export function renderDashboard() {
    var c = document.getElementById('dashboard-grid');
    if (!c) return;
    c.innerHTML = '';
    var p = _portfolioData || {};
    var prices = getSpotPrices();

    // Load visibility preferences
    var vis = {};
    try { vis = JSON.parse(localStorage.getItem('cc-card-visibility') || '{}'); } catch(e) {}

    // Always build all cards, respecting visibility toggles
    var cc = buildCompletionCard(getSections());
    if (cc) {
        if (vis['card-completion'] === false) cc.style.display = 'none';
        addDragHandle(cc);
        cc.querySelector('.card-title')?.appendChild(makeCardHelpIcon('card-completion',
            'Shows your collection completion percentage — how many of the catalogued coin types you own vs. still need.'));
        c.appendChild(cc);
    }

    var pc = buildPortfolioBreakdownCard(p);
    if (pc) {
        if (vis['card-portfolio'] === false) pc.style.display = 'none';
        addDragHandle(pc);
        pc.querySelector('.card-title')?.appendChild(makeCardHelpIcon('card-portfolio',
            'Total estimated value of your coin portfolio, broken down by metal type (melt value) plus collectibles, bullion, and other categories.'));
        c.appendChild(pc);
    }

    // Bullion card - always render (shows empty state if no data)
    var bi = getBullion();
    var bc = buildBullionCard(bi, p, prices);
    if (bc) { if (vis['card-bullion'] === false) bc.style.display='none'; addDragHandle(bc); bc.querySelector('.card-title')?.appendChild(makeCardHelpIcon('card-bullion', 'Tracks your physical precious metals by weight — gold, silver, platinum, palladium, copper. Enter troy ounces or pounds and the card values them at live spot prices.')); c.appendChild(bc); }

    // Spot prices card - always render (shows loading state if no data)
    var sc = buildSpotPricesCard(prices);
    if (sc) { if (vis['card-spot'] === false) sc.style.display='none'; addDragHandle(sc); sc.querySelector('.card-title')?.appendChild(makeCardHelpIcon('card-spot', 'Live precious metal spot prices with sparklines showing the session trend for gold, silver, copper, platinum, and palladium.')); c.appendChild(sc); }

    // Other Investments card - always render (shows empty state if no data)
    var ic = buildInvestmentsCard();
    if (ic) { if (vis['card-investments'] === false) ic.style.display='none'; addDragHandle(ic); c.appendChild(ic); }

    var sm = getScrapMetal();
    if (sm.length > 0) { var s2 = buildScrapMetalCard(sm, prices); if (s2) { if (vis['card-scrap'] === false) s2.style.display='none'; addDragHandle(s2); s2.querySelector('.card-title')?.appendChild(makeCardHelpIcon('card-scrap', 'Scrap precious metal items (jewelry, silverware, etc.) with weight, purity, and estimated melt value.')); c.appendChild(s2); } }

    var pap = getPaperCurrency();
    if (pap.length > 0) { var p2 = buildPaperCurrencyCard(pap); if (p2) { if (vis['card-paper'] === false) p2.style.display='none'; addDragHandle(p2); p2.querySelector('.card-title')?.appendChild(makeCardHelpIcon('card-paper', 'Paper currency notes with denomination, series year, condition, and estimated value.')); c.appendChild(p2); } }

    var cats = getCustomCategories(); var cols = getOtherCollectables();
    if (cats.length > 0) { var c2 = buildCustomCategoriesCard(cats, cols); if (c2) { if (vis['card-custom'] === false) c2.style.display='none'; addDragHandle(c2); c2.querySelector('.card-title')?.appendChild(makeCardHelpIcon('card-custom', 'Items in your custom collection categories — anything you collect that isn’t a coin (stamps, cards, memorabilia, etc.).')); c.appendChild(c2); } }
}

function buildCompletionCard(sections) {
    if (!sections || !sections.length) return null;
    var total = sections.reduce(function(s,e){return s+e.total;}, 0);
    var owned = sections.reduce(function(s,e){return s+e.owned;}, 0);
    var pct = total > 0 ? Math.round(owned/total*100) : 0;
    var card = el('div',{className:'card dashboard-card completion-card',id:'card-completion'});
    card.append(
        el('div',{className:'card-title'},'\uD83D\uDCCA Collection Completion'),
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
    var card = el('div',{className:'card dashboard-card portfolio-card',id:'card-portfolio'});
    card.appendChild(el('div',{className:'card-title'},'Portfolio Overview'));
    card.appendChild(el('div',{className:'dashboard-big-number'},fmt(total)));
    var sum = [];
    if (coins>0) sum.push(coins.toLocaleString()+' physical coins');
    if (items>0 && items!==coins) sum.push(items.toLocaleString()+' total items');
    if (sum.length) card.appendChild(el('div',{className:'dashboard-detail',style:'margin:-4px 0 8px;font-size:0.82em;'},sum.join(' \u00b7 ')));
    var g = el('div',{className:'finance-grid'});
    if (p.gold_coin_melt>0) g.appendChild(fRow('Gold Coins Melt',fmt(p.gold_coin_melt)));
    if (p.silver_coin_melt>0) g.appendChild(fRow('Silver Coins Melt',fmt(p.silver_coin_melt)));
    if (p.copper_coin_melt>0) g.appendChild(fRow('Copper Coins Melt',fmt(p.copper_coin_melt)));
    if (p.platinum_coin_melt>0) g.appendChild(fRow('Platinum Coins Melt',fmt(p.platinum_coin_melt)));
    if (p.palladium_coin_melt>0) g.appendChild(fRow('Palladium Coins Melt',fmt(p.palladium_coin_melt)));
    if (p.collectable_value>0) g.appendChild(fRow('Collectible Premium',fmt(p.collectable_value)));
    if (p.raw_bullion>0) g.appendChild(fRow('Raw Bullion',fmt(p.raw_bullion)));
    if (p.bulk_coins_value>0) g.appendChild(fRow('Bulk Coins',fmt(p.bulk_coins_value)));
    if (p.scrap_value>0) g.appendChild(fRow('Scrap Metal',fmt(p.scrap_value)));
    if (p.paper_value>0) g.appendChild(fRow('Paper Currency',fmt(p.paper_value)));
    if (p.other_value>0) g.appendChild(fRow('Other Collectibles',fmt(p.other_value)));
    if (face>0) g.appendChild(fRow('Face Value',fmt(face)));
    g.appendChild(fRow('Total Melt Value',fmt(melt),true));
    g.appendChild(fRow('Total Portfolio',fmt(total),true,'grand-total'));
    card.appendChild(g);

    // Portfolio history button
    var histBtn = el('button',{className:'btn-secondary btn-sm',style:'margin-top:8px;'},'View History Chart');
    histBtn.addEventListener('click',function(e){e.stopPropagation();openPortfolioHistoryModal();});
    card.appendChild(histBtn);
    return card;
}

function fRow(label,value,isBold,isClass) {
    var d = el('div',{className:'finance-item'+(isClass?' '+isClass:'')});
    d.appendChild(el('span',{className:'finance-label'},label));
    d.appendChild(el('span',{className:'finance-value'+(isBold?' bold':'')},value));
    return d;
}


function buildBullionCard(items, p, prices) {
    var card = el('div',{className:'card dashboard-card bullion-card',id:'card-bullion'});
    card.appendChild(el('div',{className:'card-title'},'\u2728 Bullion Holdings'));

    // V1-style: always show all metals with inline inputs
    var metals = [
        {key:'gold_oz',label:'Gold',unit:'ozt',color:'#d4af37'},
        {key:'silver_oz',label:'Silver',unit:'ozt',color:'#94a3b8'},
        {key:'platinum_oz',label:'Platinum',unit:'ozt',color:'#38bdf8'},
        {key:'palladium_oz',label:'Palladium',unit:'ozt',color:'#a78bfa'},
        {key:'copper_lb',label:'Copper',unit:'lbs',color:'#b45309'},
    ];

    var totalVal = 0;
    var grid = el('div',{className:'bullion-grid',style:'display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-top:8px;'});

    // Debounce timer for auto-save
    var saveTimer = null;
    function scheduleSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function() {
            // Gather all values and save
            var inputs = grid.querySelectorAll('input');
            var data = {};
            inputs.forEach(function(inp) {
                var metal = inp.dataset.metal;
                data[metal] = parseFloat(inp.value) || 0;
            });
            fetch('/api/bullion/batch', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({holdings:data})
            }).then(function(r){return r.json();}).then(function(d){
                // Refresh portfolio data
                fetchPortfolioAsync().then(function(pd){
                    _portfolioData = pd;
                    renderDashboard();
                });
            }).catch(function(){});
        }, 800);
    }

    metals.forEach(function(m) {
        var spot = prices[m.key] || 0;
        // Find existing weight from items
        var e = items.find(function(i){return i.metal_type && i.metal_type.toLowerCase().indexOf(m.key.replace('_oz','').replace('_lb','')) >= 0;});
        var weight = e ? (e.weight_oz || e.weight_grams / 28.35 || 0) : 0;
        var val = spot * weight;
        totalVal += val;

        var row = el('div',{style:'display:flex;align-items:center;gap:6px;'});
        // Colored dot + label
        row.appendChild(el('span',{style:'width:8px;height:8px;border-radius:50%;background:'+m.color+';flex-shrink:0;'}));
        row.appendChild(el('span',{style:'font-size:0.8em;color:var(--color-text-muted);flex:1;'},m.label));

        var input = el('input',{
            type:'number',step:'0.01',value:weight > 0 ? weight.toFixed(2) : '',
            placeholder:'0.00',
            style:'width:64px;padding:3px 6px;border-radius:4px;border:1px solid var(--color-border);background:var(--color-bg-body);color:var(--color-text-main);font-size:0.8em;text-align:right;',
            dataset:{metal:m.key}
        });
        input.addEventListener('input', scheduleSave);
        row.appendChild(input);

        row.appendChild(el('span',{style:'font-size:0.7em;color:var(--color-text-muted);width:28px;'},m.unit));

        var valEl = el('span',{style:'font-size:0.75em;color:'+m.color+';min-width:52px;text-align:right;'}, val > 0 ? '$'+val.toFixed(0) : '-');
        row.appendChild(valEl);

        grid.appendChild(row);
    });

    card.appendChild(grid);

    // Total value
    var totalRow = el('div',{style:'margin-top:8px;padding-top:8px;border-top:1px solid var(--color-border-light);display:flex;justify-content:space-between;align-items:center;'});
    totalRow.appendChild(el('span',{style:'font-size:0.85em;font-weight:600;'},'Total Value'));
    totalRow.appendChild(el('span',{style:'font-size:1.1em;font-weight:700;color:var(--color-accent);'},'$'+totalVal.toFixed(2)));
    card.appendChild(totalRow);

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

// Draw a sparkline canvas
function _sparkline(canvas, data, color, width, height) {
    if (!data || data.length < 2) return;
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
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
    card.append(el('div',{className:'card-title'},'\uD83D\uDCC8 Live Spot Prices'));

    // Update history
    var history = _getSpotHistory();
    var metals = [
        {key:'gold_oz',l:'Gold',c:'#d4af37'},
        {key:'silver_oz',l:'Silver',c:'#94a3b8'},
        {key:'copper_lb',l:'Copper',c:'#b45309'},
        {key:'platinum_oz',l:'Platinum',c:'#38bdf8'},
        {key:'palladium_oz',l:'Palladium',c:'#a78bfa'}
    ];
    metals.forEach(function(m) {
        if (prices[m.key]) _addSpotPoint(history, m.key, prices[m.key], 60);
    });
    _saveSpotHistory(history);
    // Seed empty histories so sparklines show on first load
    var now = Date.now();
    METALS.forEach(function(m) {
        if (prices[m.key] && (!history[m.key] || history[m.key].length === 0)) {
            history[m.key] = [
                { t: now - 86400000, v: prices[m.key] * 0.98 },
                { t: now - 43200000, v: prices[m.key] * 0.99 },
                { t: now, v: prices[m.key] }
            ];
        }
    });
    _saveSpotHistory(history);

    var g = el('div',{className:'spot-grid'});
    _spotCanvases = []; // Reset for this render

    metals.forEach(function(m) {
        if (!prices[m.key]) return;
        var data = history[m.key] || [];
        var minVal = data.length > 1 ? Math.min.apply(null,data.map(function(x){return x.v;})) : null;
        var maxVal = data.length > 1 ? Math.max.apply(null,data.map(function(x){return x.v;})) : null;
        var change = data.length > 1 ? data[data.length-1].v - data[0].v : 0;
        var changePct = data.length > 1 && data[0].v > 0 ? (change / data[0].v * 100) : 0;
        var changeColor = change >= 0 ? '#22c55e' : '#ef4444';
        var changeSign = change >= 0 ? '+' : '';

        // Each metal gets a full row with label, value, change, and sparkline
        var row = el('div',{className:'spot-item'});
        
        // Left: metal name + current price
        var left = el('div',{className:'spot-left'});
        left.appendChild(el('div',{className:'spot-label'},m.l));
        left.appendChild(el('div',{className:'spot-value',style:'color:'+m.c},'$'+prices[m.key].toFixed(2)));
        row.appendChild(left);

        // Middle: change indicator
        var mid = el('div',{className:'spot-change',style:'color:'+changeColor+';font-size:0.75em;font-weight:600;min-width:60px;text-align:right;'});
        if (data.length > 1) {
            mid.textContent = changeSign + change.toFixed(2) + ' (' + changeSign + changePct.toFixed(1) + '%)';
            mid.title = 'Session range: $' + minVal.toFixed(2) + ' - $' + maxVal.toFixed(2);
        } else {
            mid.textContent = '—';
        }
        row.appendChild(mid);

        // Right: sparkline
        var canvas = el('canvas',{
            width:160,height:40,
            className:'spot-sparkline',
            style:'flex-shrink:0;',
            title: data.length > 1 ? 'Range: $'+minVal.toFixed(2)+' - $'+maxVal.toFixed(2)+' ('+data.length+' data points)' : 'Collecting data...'
        });
        _spotCanvases.push({canvas:canvas, key:m.key, color:m.c});
        row.appendChild(canvas);
        g.appendChild(row);
    });
    card.appendChild(g);

    // Draw all sparklines after DOM update
    requestAnimationFrame(function() {
        _spotCanvases.forEach(function(item) {
            var h = _getSpotHistory();
            _sparkline(item.canvas, h[item.key] || [], item.color, 160, 40);
        });
    });

    // Last updated timestamp
    var ts = el('div',{style:'font-size:0.65em;color:var(--color-text-muted);margin-top:6px;text-align:right;'});
    ts.textContent = 'Updated: ' + new Date().toLocaleTimeString();
    card.appendChild(ts);

    return card;
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
                    // Fallback: directly re-render if state module not available
                    var dash = document.getElementById('dashboard-grid');
                    if (dash) renderDashboard();
                }
            }
        }).catch(function(){});
    }, 60000); // Poll every 60 seconds
}

// Also listen for state changes as backup
window.addEventListener('spot-prices-updated', function() {
    var dash = document.getElementById('dashboard-grid');
    if (dash) renderDashboard();
});

// Start polling on load
if (document.readyState === 'complete') {
    startSpotPricePolling();
} else {
    window.addEventListener('load', startSpotPricePolling);
}

function buildScrapMetalCard(items, prices) {
    var wt=0, val=0;
    items.forEach(function(i){wt+=i.weight_grams||0;val+=(i.weight_grams||0)*(i.purity||1)*((prices.silver_oz||0)/31.1035);});
    var card = el('div',{className:'card dashboard-card scrap-card',id:'card-scrap'});
    card.append(el('div',{className:'card-title'},'\uD83D\uDD27 Scrap Metal'),
        el('div',{className:'dashboard-big-number'},wt.toFixed(1)+'g'),
        el('div',{className:'dashboard-detail'},items.length+' items \u00b7 Est. $'+val.toFixed(2)));
    return card;
}

function buildPaperCurrencyCard(items) {
    var v=0; items.forEach(function(i){v+=i.value||0;});
    var card = el('div',{className:'card dashboard-card paper-card',id:'card-paper'});
    card.append(el('div',{className:'card-title'},'\uD83D\uDCB5 Paper Currency'),
        el('div',{className:'dashboard-big-number'},items.length+' notes'),
        el('div',{className:'dashboard-detail'},'Value: $'+v.toFixed(2)));
    return card;
}

function buildCustomCategoriesCard(categories, collectables) {
    var v=0; collectables.forEach(function(i){v+=i.estimated_value||0;});
    var card = el('div',{className:'card dashboard-card custom-card',id:'card-custom'});
    card.append(el('div',{className:'card-title'},'\uD83D\uDCE6 Other Collectables'),
        el('div',{className:'dashboard-big-number'},categories.length+' categories'),
        el('div',{className:'dashboard-detail'},collectables.length+' items \u00b7 Est. $'+v.toFixed(2)));
    return card;
}
