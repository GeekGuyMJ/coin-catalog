export function fmt(v) { return '$'+v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }


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

export function buildSpotTrendCard(prices) {
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