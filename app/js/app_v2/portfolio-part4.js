// portfolio-part4.js - Auto-generated from portfolio.js
// Part 4 of 5 - loaded as regular script

var Portfolio = Portfolio || {};

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
    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-shrink:0;gap:8px;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;min-width:0;' }, 'Scrap Precious Metals'));
    var hdrRight = el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);text-align:right;padding-right:32px;white-space:nowrap;' });
    hdrRight.innerHTML = '<span style="font-size:1.1em;font-weight:700;color:var(--color-accent);display:block;">$' + totalVal.toFixed(2) + '</span><span style="font-size:0.8em;">' + items.length + ' item' + (items.length !== 1 ? 's' : '') + ' · ' + totalWt.toFixed(1) + 'g</span>';
    hdr.appendChild(hdrRight);
    card.appendChild(hdr);

    // Existing items list
    var listDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;max-height:200px;margin-bottom:10px;' });
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
            info.appendChild(el('span', { style: 'color:var(--color-text-muted);font-size:0.8em;margin-left:6px;' }, '(' + (item.weight_grams||0).toFixed(1) + 'g ' + (item.metal_type||'') + ((item.purity && item.purity < 1) ? ' ' + (((item.purity * 100) % 1 === 0) ? (item.purity * 100).toFixed(0) : (item.purity * 100).toFixed(1)) + '%' : '') + ')'));
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

    // Row 2: Purity (left) + Weight + Unit (right, grouped)
    var row2 = el('div', { className: 'v1-form-row', style: 'align-items:flex-end; gap:8px;' });
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

    // Weight + unit grouped together
    var wgtWrap = el('div', { style: 'display:flex; align-items:flex-end; gap:2px; flex:1; min-width:120px;' });
    var wgtIn = el('input', { className: 'v1-input', type: 'number', step: '0.01', placeholder: 'Weight', dataset: { field: 'sm-weight' }, style: 'flex:1; min-width:80px;' });
    var unitSel = el('select', { className: 'v1-select', style: 'width:70px;', dataset: { field: 'sm-unit' } });
    [['g','g'],['ozt','troy oz'],['oz','oz'],['lbs','lbs'],['gr','grains']].forEach(function(u) {
        unitSel.appendChild(el('option', { value: u[0] }, u[1]));
    });
    wgtWrap.appendChild(wgtIn);
    wgtWrap.appendChild(unitSel);
    row2.appendChild(puritSel);
    row2.appendChild(wgtWrap);
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

    card.appendChild(form)
    _foldCardForm(form, addBtn, 'scrap', 'Add Scrap Item');;
    return card;
}

// =========================================================================
// V1-Style Inline Widget: Paper Currency Card
// =========================================================================




// End of part 4
