/**
 * portfolio.js - Coin Catalog v2
 * Dashboard cards: Completion, Portfolio (V1-style), Bullion, Spot, Scrap, Paper, Custom
 */

import { el } from './utils.js';
import { onChange, getSpotPrices, getInventory, getSections,
    getScrapMetal, getPaperCurrency, getCustomCategories, getOtherCollectables,
    getBullion,
} from './state.js';
import { openScrapMetalModal, openPaperCurrencyModal, openCollectablesModal } from './modals.js';
import { openPortfolioHistoryModal } from './portfolio_history.js';

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
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '≡';
    handle.title = 'Drag to reorder';
    card.appendChild(handle);
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
    if (cc) { if (vis['card-completion'] === false) cc.style.display='none'; addDragHandle(cc); c.appendChild(cc); }

    var pc = buildPortfolioBreakdownCard(p);
    if (pc) { if (vis['card-portfolio'] === false) pc.style.display='none'; addDragHandle(pc); c.appendChild(pc); }

    // Bullion card - always render (shows empty state if no data)
    var bi = getBullion();
    var bc = buildBullionCard(bi, p, prices);
    if (bc) { if (vis['card-bullion'] === false) bc.style.display='none'; addDragHandle(bc); c.appendChild(bc); }

    // Spot prices card - always render (shows loading state if no data)
    var sc = buildSpotPricesCard(prices);
    if (sc) { if (vis['card-spot'] === false) sc.style.display='none'; addDragHandle(sc); c.appendChild(sc); }

    var sm = getScrapMetal();
    if (sm.length > 0) { var s2 = buildScrapMetalCard(sm, prices); if (s2) { if (vis['card-scrap'] === false) s2.style.display='none'; addDragHandle(s2); c.appendChild(s2); } }

    var pap = getPaperCurrency();
    if (pap.length > 0) { var p2 = buildPaperCurrencyCard(pap); if (p2) { if (vis['card-paper'] === false) p2.style.display='none'; addDragHandle(p2); c.appendChild(p2); } }

    var cats = getCustomCategories(); var cols = getOtherCollectables();
    if (cats.length > 0) { var c2 = buildCustomCategoriesCard(cats, cols); if (c2) { if (vis['card-custom'] === false) c2.style.display='none'; addDragHandle(c2); c.appendChild(c2); } }
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
    if (!Array.isArray(items)) items = [];
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
        {key:'platinum_oz',l:'Platinum',c:'#38bdf8'},
        {key:'palladium_oz',l:'Palladium',c:'#a78bfa'},
        {key:'copper_lb',l:'Copper',c:'#b45309'}
    ];
    metals.forEach(function(m) {
        if (prices[m.key]) _addSpotPoint(history, m.key, prices[m.key], 60);
    });
    _saveSpotHistory(history);
    // Seed empty histories so sparklines show on first load
    var now = Date.now();
    metals.forEach(function(m) {
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
