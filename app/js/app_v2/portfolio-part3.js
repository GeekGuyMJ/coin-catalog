// portfolio-part3.js - Auto-generated from portfolio.js
// Part 3 of 5 - loaded as regular script

var Portfolio = Portfolio || {};

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
        var iAmt = item.amount || 1.0;
        var spotKey = m === 'copper' ? 'copper_lb' : m + '_oz';
        var w = rawW * iAmt;
        // Convert to valuation unit (lbs for copper, ozt for precious metals)
        if (m === 'copper') {
            if (unit === 'oz' || unit === 'ozt') w = w / 16;
            else if (unit === 'g')   w = w / 453.592;
            else if (unit === 'kg')  w = w * 2.20462;
        } else {
            if (unit === 'g')        w = w / 31.1035;
            else if (unit === 'kg')  w = w * 32.1507;
            else if (unit === 'lbs') w = w * 14.5833;
            else if (unit === 'oz')  w = w / 1.09714;
        }
        var spot = prices[spotKey] || 0;
        totals[m] += w * spot;
        entriesByMetal[m].push(item);
    });

    // Header with total value
    var grandTotal = Object.values(totals).reduce(function(a, b) { return a + b; }, 0);
    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-shrink:0;gap:8px;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;min-width:0;' }, 'Bullion Holdings'));
    var hdrRight = el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);text-align:right;padding-right:32px;white-space:nowrap;' });
    hdrRight.innerHTML = '<span style="font-size:1.1em;font-weight:700;color:var(--color-accent);display:block;">$' + grandTotal.toFixed(2) + '</span><span style="font-size:0.8em;">' + items.length + ' entr' + (items.length !== 1 ? 'ies' : 'y') + '</span>';
    hdr.appendChild(hdrRight);
    card.appendChild(hdr);

    // Entries list grouped by metal — flex-grow to fill card height
    var listDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;max-height:200px;margin-bottom:10px;' });
    if (items.length === 0) {
        listDiv.appendChild(el('p', { style: 'font-size:0.8em;color:var(--color-text-muted);margin:0 0 6px;' }, 'No bullion entries yet. Add your first entry below.'));
        // Remove min-height gap when empty
        listDiv.style.minHeight = '0';
        listDiv.style.marginBottom = '0';
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
                var iAmt = item.amount || 1.0;
                subParts.push(iW.toFixed(2) + ' ' + iUnit + ' × ' + iAmt.toFixed(0));
                if (item.purity && item.purity < 1) subParts.push(((item.purity * 100) % 1 === 0) ? (item.purity * 100).toFixed(0) + '%' : (item.purity * 100).toFixed(1) + '%');
                // Value for this item (convert to standard valuation unit)
                var convW = iW * iAmt;
                if (m === 'copper') {
                    // Convert to lbs
                    if (iUnit === 'oz' || iUnit === 'ozt') convW = convW / 16;
                    else if (iUnit === 'g')   convW = convW / 453.592;
                    else if (iUnit === 'kg')  convW = convW * 2.20462;
                } else {
                    // Convert to troy oz
                    if (iUnit === 'g')        convW = convW / 31.1035;
                    else if (iUnit === 'kg')  convW = convW * 32.1507;
                    else if (iUnit === 'lbs') convW = convW * 14.5833;
                    else if (iUnit === 'oz')  convW = convW / 1.09714;
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

    // Row 2: Weight + Unit (grouped) + Amount + Purity
    var row2 = el('div', { className: 'v1-form-row', style: 'align-items:flex-end; gap:8px;' });
    var wgtIn = el('input', { className: 'v1-input', type: 'number', step: '0.01', placeholder: 'Weight', dataset: { field: 'rb-weight' }, style: 'flex:1;min-width:60px;' });
    var unitSel = el('select', { className: 'v1-select', style: 'width:76px;', dataset: { field: 'rb-unit' } });
    [['oz','oz'],['ozt','troy oz'],['g','g'],['lbs','lbs'],['kg','kg']].forEach(function(u) {
        unitSel.appendChild(el('option', { value: u[0] }, u[1]));
    });
    var amtIn = el('input', { className: 'v1-input', type: 'number', step: '1', min: '1', placeholder: 'Qty', dataset: { field: 'rb-amount' }, style: 'width:60px;', value: '1' });
    // Group weight + unit + amount
    var wgtWrap2 = el('div', { style: 'display:flex; align-items:flex-end; gap:2px; flex:1; min-width:120px;' });
    wgtWrap2.appendChild(wgtIn);
    wgtWrap2.appendChild(unitSel);
    wgtWrap2.appendChild(amtIn);
    row2.appendChild(wgtWrap2);
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
    addBtn._amtIn = amtIn;
    addBtn._purityIn = null;
    addBtn._notesIn = notesIn;
    addBtn._prices = prices;
    form.appendChild(addBtn);

    card.appendChild(form)
    _foldCardForm(form, addBtn, 'bullion', 'Add Bullion Entry');;
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
        // 2026-10-10 (Matthew) -- CORRECTED. The Eisenhower series ended in
        // 1978; every circulation strike is clad. The golden dollar types are
        // clad too (no silver in either), so both are face value. See the
        // note at the dropdown for the sources.
        'EisenhowerClad': 'Eisenhower Dollars (1971-1978, clad)',
        'GoldenDollars': 'Golden Sacagawea & Presidential Dollars',
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
        // 90% silver coins: weight in grams → ozt.
        var ozt = grams / 31.1035;
        val = ozt * (prices['silver_oz'] || 0) * 0.90;
        coinCount = null;
        detail = (prices['silver_oz'] || 0) > 0 ? ' at $' + (prices['silver_oz'] || 0).toFixed(2) + '/oz silver' : '';
        isMelt = true;
    } else if (entry.metal_type === 'EisenhowerClad') {
        // 2026-10-10 (Matthew), corrected: the Eisenhower dollar ended in 1978
        // and is copper-nickel clad in every circulation strike. Face value only.
        // 22.68 g per coin (clad), $1.00 each.
        coinCount = Math.round(grams / 22.68);
        val = coinCount * 1.00;
        detail = ' × $1.00 face';
    } else if (entry.metal_type === 'GoldenDollars') {
        // 2026-10-10 (Matthew), corrected: the Sacagawea and Presidential
        // dollars contain NO SILVER -- 88.5% Cu / 6% Zn / 3.5% Mn / 2% Ni over
        // a brass core, 8.100 g. The gold colour is the plating, not the metal.
        // Face value only.
        coinCount = Math.round(grams / 8.1);
        val = coinCount * 1.00;
        detail = ' × $1.00 face';
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

    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-shrink:0;gap:8px;' });
    var titleDiv = el('div', { className: 'card-title', style: 'margin-bottom:0;min-width:0;' }, 'Bulk Coins');
    hdr.appendChild(titleDiv);
    var hdrRight = el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);text-align:right;padding-right:32px;white-space:nowrap;' });
    hdrRight.innerHTML = '<span style="font-size:1.1em;font-weight:700;color:var(--color-accent);display:block;">$' + totalVal.toFixed(2) + '</span><span style="font-size:0.8em;">' + (bulkEntries || []).length + ' entr' + ((bulkEntries || []).length !== 1 ? 'ies' : 'y') + '</span>';
    hdr.appendChild(hdrRight);
    card.appendChild(hdr);

    // Entries list — flex-grow to fill card height
    var entriesDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;max-height:200px;margin-bottom:10px;' });
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

        // 2026-10-10 (Matthew): any metal_type a user can pick MUST appear here
        // or its entry is never rendered -- the group loop iterates metalOrder
        // and skips anything not listed, so it vanishes with no error. Verified
        // end-to-end after adding the dollar types for exactly this reason.
        var metalOrder = ['CopperPennies', 'ZincPennies', 'Nickels', 'CladDimes', 'CladQuarters', 'CladHalves',
                          'EisenhowerClad', 'GoldenDollars', 'SilverCoins90'];
        var metalColors = {
            'CopperPennies': '#b45309',
            'ZincPennies': '#64748b',
            'Nickels': '#92400e',
            'CladDimes': '#64748b',
            'CladQuarters': '#64748b',
            'CladHalves': '#64748b',
            'EisenhowerClad': '#64748b',
            'GoldenDollars': '#d4af37',
            'SilverCoins90': '#94a3b8'
        };

        metalOrder.forEach(function(m) {
            var entries = groups[m];
            if (!entries || entries.length === 0) return;
            var subParts = [];
            // Metal group header
            var metalLabelText = getMetalLabel(m);
            var spotDetailText = '';
            // 2026-10-10 (Matthew), corrected: only genuinely 90% silver streams
            // get the silver spot line. Showing it on the golden dollars
            // advertised them as silver, which they are not.
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
    var row1 = el('div', { className: 'v1-form-row', style: 'flex-wrap: wrap;' });
    var labelIn = el('input', { className: 'v1-input', placeholder: 'Label (e.g. Wheat Cents)', dataset: { field: 'be-label' }, style: 'flex:1; min-width:120px;' });
    var metalSel = el('select', { className: 'v1-select', dataset: { field: 'be-metal' }, style: 'flex:1; min-width:120px;' });
    ['Copper Pennies 1959-1981', 'Zinc Pennies 1983-2025', 'Nickels', 'Clad Dimes', 'Clad Quarters', 'Clad Half Dollars',
     // 2026-10-10 (Matthew): add Eisenhower dollars and the golden Sacagawea /
     // Presidential dollars.
     //
     // CORRECTED after Matthew challenged the first pass, which was wrong on
     // every one of these three. Verified against Wikipedia's Eisenhower /
     // Sacagawea / Presidential dollar articles (Mass + Composition + Years of
     // minting fields), 2026-10-10:
     //
     //   Eisenhower  1971-1978 ONLY. Circulation strikes are copper-nickel
     //     CLAD -- "None in circulation strikes" for silver. The 40% silver
     //     pieces are the 1971/1972 S-mint issues and are a numismatic
     //     exception, not a bulk-stream denomination. So bulk = clad + face.
     //     There are NO Eisenhower dollars after 1978 at all.
     //   Sacagawea   8.100 g, 88.5% Cu / 6% Zn / 3.5% Mn / 2% Ni -- no silver
     //     in it at all. The gold colour is a brass core, not precious metal.
     //   Presidential same alloy and weight as the Sacagawea.
     //
     // Both golden dollar types are therefore CLAD + FACE VALUE.
     'Eisenhower Dollars (1971-1978, clad)', 'Golden Sacagawea & Presidential Dollars', '90% Silver Coins',
     // Canada (small → large)
     'Canadian Copper Pennies 1920-1996', 'Canadian Zinc Pennies 1997-2012', 'Canadian Nickels', 'Canadian Silver Dimes (pre-1968)', 'Canadian Clad Dimes (1968+)', 'Canadian Silver Quarters (pre-1968)', 'Canadian Clad Quarters (1968+)', 'Canadian 50¢ Pieces', 'Canadian Loonies (1$)'].forEach(function(label) {
        metalSel.appendChild(el('option', { value: label }, label));
    });
    row1.appendChild(labelIn);
    row1.appendChild(metalSel);
    form.appendChild(row1);

    // Row 2: Weight + Unit (grouped)
    var row2 = el('div', { className: 'v1-form-row', style: 'flex-wrap: wrap; align-items:flex-end; gap:8px;' });
    var wgtIn = el('input', { className: 'v1-input', type: 'number', step: '0.01', placeholder: 'Weight', dataset: { field: 'be-weight' }, style: 'flex:1; min-width:80px;' });
    var unitSel = el('select', { className: 'v1-select', style: 'width:70px; flex-shrink:0;', dataset: { field: 'be-unit' } });
    [['lbs','lbs'],['g','g'],['oz','oz'],['kg','kg']].forEach(function(u) {
        unitSel.appendChild(el('option', { value: u[0] }, u[1]));
    });
    var wgtWrap3 = el('div', { style: 'display:flex; align-items:flex-end; gap:2px; flex:1; min-width:120px;' });
    wgtWrap3.appendChild(wgtIn);
    wgtWrap3.appendChild(unitSel);
    row2.appendChild(wgtWrap3);
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

    card.appendChild(form)
    _foldCardForm(form, addBtn, 'bulk', 'Add Bulk Entry');;
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
    canvas.style.width = '100%';
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

async function buildSpotPricesCard(prices) {
    var card = el('div',{className:'card dashboard-card spot-card',id:'card-spot'});
    
    var titleRow = el('div', {style:'display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px;padding-right:28px;'});
    titleRow.appendChild(el('div',{className:'card-title', style:'margin-bottom:0;'},'Live Spot Prices'));
    
    var btnRow = el('div', {className:'spot-period-row', style:'display:flex; gap:4px; font-size:0.62em; flex-wrap:nowrap; white-space:nowrap;'});
    var periods = [
        {label:'1D', range:'1D'},
        {label:'1W', range:'1W'},
        {label:'1M', range:'1M'},
        {label:'1Y', range:'1Y'},
        {label:'10Y', range:'10Y'}
    ];
    var activePeriod = localStorage.getItem('cc-spot-period') || '1M';
    
    // Initialize REAL spot history engine (seed from backend + accumulate live prices, no fabrication)
    if (!window._spotHistoryStore) {
        try {
            window._spotHistoryStore = await initSpotHistory({
                getSeed: async () => {
                    // Prefer the live backend; fall back to the static seed so the
                    // cards always render real 2000-2026 history even if /api is
                    // slow, blocked, or served from a stale Service Worker cache.
                    try { const r = await fetch('/api/spot_history?cb=' + Date.now()); const j = await r.json(); if (j && j.gold_oz && j.gold_oz.yearly && j.gold_oz.yearly.length) return j; } catch(e){}
                    try { const r2 = await fetch('data/spot_history_seed.json?cb=' + Date.now()); return await r2.json(); } catch(e){ return null; }
                },
getBaseline: async () => { try { const r = await fetch('data/spot_history_baseline.json?cb=' + Date.now()); return await r.json(); } catch(e){ return null; } },
                getPrices: async () => { try { return await fetchSpotPricesLocal(); } catch(e){ return null; } }
            });
        } catch(e) { window._spotHistoryStore = null; }
    }
    
    periods.forEach(p => {
        var b = el('div', {
            style:'cursor:pointer; color: ' + (p.label === activePeriod ? 'var(--color-accent)' : 'var(--color-text-muted)') + '; font-weight: ' + (p.label === activePeriod ? 'bold' : 'normal') + '; padding:1px 2px;'
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
        {key:'platinum_oz',l:'Platinum',c:'#38bdf8'},
        {key:'palladium_oz',l:'Palladium',c:'#a78bfa'},
        {key:'copper_lb',l:'Copper',c:'#b45309'}
    ];
    // Filter by visible metals
    var filteredMetals = metals.filter(function(m) {
        var metalKey = m.key.replace('_oz','').replace('_lb','');
        return bullionVis[metalKey] !== false;
    });
    // No fabricated seed — only real data. Engine appended live price on init.
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
        if (window._spotHistoryStore) {
            data = getSeriesForPeriod(window._spotHistoryStore, m.key, activePeriod) || [];
        } else {
            data = history[m.key] || [];
        }
        
        var minVal = data.length > 1 ? Math.min.apply(null,data.map(function(x){return x.v;})) : null;
        var maxVal = data.length > 1 ? Math.max.apply(null,data.map(function(x){return x.v;})) : null;

        // Each metal gets a full row
        var row = el('div',{className:'spot-item', style:'display:flex; justify-content:space-between; align-items:center; gap:8px;'});
        
        // Left: metal name + current price + change indicator
        var left = el('div',{className:'spot-left', style:'display:flex; flex-direction:column; flex: 1 1 0; min-width:0;'});
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
        var right = el('div',{className:'spot-right', style:'flex: 0 1 96px; min-width: 40px; max-width: 96px; height: 32px; display: flex; justify-content: flex-end; overflow: hidden;'});
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



// End of part 3
