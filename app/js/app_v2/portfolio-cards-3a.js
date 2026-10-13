export function buildScrapMetalCard(items, prices) {
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


export function buildPaperCurrencyCard(items) {
    if (!Array.isArray(items)) items = [];
    var totalVal = 0;
    items.forEach(function(i) { totalVal += i.value || 0; });

    var card = el('div', { className: 'card dashboard-card paper-card', id: 'card-paper', style: 'display:flex;flex-direction:column;' });

    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-shrink:0;gap:8px;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;min-width:0;' }, 'Paper Currency'));
    var hdrRight = el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);text-align:right;padding-right:32px;white-space:nowrap;' });
    hdrRight.innerHTML = '<span style="font-size:1.1em;font-weight:700;color:var(--color-accent);display:block;">$' + totalVal.toFixed(2) + '</span><span style="font-size:0.8em;">' + items.length + ' note' + (items.length !== 1 ? 's' : '') + '</span>';
    hdr.appendChild(hdrRight);
    card.appendChild(hdr);

    // Items list
    var listDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;max-height:200px;margin-bottom:10px;' });
    if (items.length === 0) {
        listDiv.appendChild(el('p', { style: 'font-size:0.8em;color:var(--color-text-muted);margin:0 0 6px;' }, 'No banknotes yet.'));
        // Remove min-height gap when empty
        listDiv.style.minHeight = '0';
        listDiv.style.marginBottom = '0';
    } else {
        items.forEach(function(item) {
            var row = el('div', { className: 'v1-item-row' });
            
            // Front/back thumbnails side by side
            var thumbs = el('div', { style: 'display: flex; gap: 4px; flex-direction:column; align-items: center; margin-right: 8px; flex-shrink: 0;' });
            if (item.obv_image) {
                var oImg = el('img', { src: item.obv_image, style: 'width:40px; height:24px; object-fit:cover; border-radius:2px; border:1px solid var(--color-border); cursor:zoom-in;' });
                oImg.addEventListener('click', () => openLocalLightbox(item.obv_image));
                thumbs.appendChild(oImg);
            }
            if (item.rev_image) {
                var rImg = el('img', { src: item.rev_image, style: 'width:40px; height:24px; object-fit:cover; border-radius:2px; border:1px solid var(--color-border); cursor:zoom-in;' });
                rImg.addEventListener('click', () => openLocalLightbox(item.rev_image));
                thumbs.appendChild(rImg);
            }
            if (thumbs.childNodes.length > 0) {
                row.appendChild(thumbs);
            }

            var info = el('div', { style: 'flex:1;' });
            var label = fmtDenom(item.denomination) + ' Series ' + (item.series_year || '?');
            info.appendChild(el('span', { style: 'font-weight:600;font-size:0.9em;' }, label));
            if (item.is_star_note) info.appendChild(el('span', { style: 'margin-left:4px;color:gold;font-weight:700;font-size:1em;' }, '★'));
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

    // Row 1: Denomination + Star Note + Series
    var row1 = el('div', { className: 'v1-form-row', style: 'align-items:flex-end; gap:8px;' });
    var denomSel = el('select', { className: 'v1-select', dataset: { field: 'pc-denom' } });
    [1,2,5,10,20,50,100,500,1000].forEach(function(d) {
        denomSel.appendChild(el('option', { value: String(d) }, fmtDenom(d)));
    });
    var starLbl = el('label', { style: 'display:flex;align-items:center;gap:4px;font-size:0.8em;white-space:nowrap;cursor:pointer;margin-bottom:2px;' });
    var starCb = el('input', { type: 'checkbox', dataset: { field: 'pc-star' } });
    starLbl.appendChild(starCb);
    starLbl.appendChild(document.createTextNode('★ Star'));
    var seriesIn = el('input', { className: 'v1-input', placeholder: 'Series (e.g. 1957A)', dataset: { field: 'pc-series' }, style: 'flex:1; min-width:80px;' });
    row1.appendChild(denomSel);
    row1.appendChild(starLbl);
    row1.appendChild(seriesIn);
    form.appendChild(row1);

    // Row 2: Serial Number
    var row2 = el('div', { className: 'v1-form-row' });
    var serialIn = el('input', { className: 'v1-input', placeholder: 'Serial Number', dataset: { field: 'pc-serial' }, style: 'flex:1;' });
    row2.appendChild(serialIn);
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

    // Row 5: Obverse / Reverse file pickers (side by side)
    var row5 = el('div', { className: 'v1-form-row', style: 'align-items:flex-end; gap:8px;' });
    
    var obvContainer = el('div', { style: 'flex:1; display:flex; align-items:center; gap:6px;' });
    var obvFile = el('input', { type: 'file', accept: 'image/*', style: 'display:none;' });
    var obvBtn = el('button', { className: 'btn-secondary', style: 'padding:6px 10px; font-size:0.8em; display:flex; align-items:center; gap:4px; margin:0;' });
    obvBtn.innerHTML = ' Front';
    var obvPreview = el('img', { style: 'width:36px; height:24px; border-radius:2px; object-fit:cover; display:none;' });
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
    var revBtn = el('button', { className: 'btn-secondary', style: 'padding:6px 10px; font-size:0.8em; display:flex; align-items:center; gap:4px; margin:0;' });
    revBtn.innerHTML = ' Back';
    var revPreview = el('img', { style: 'width:36px; height:24px; border-radius:2px; object-fit:cover; display:none;' });
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

    card.appendChild(form)
    _foldCardForm(form, addBtn, 'paper', 'Add Banknote');;
    return card;
}

// =========================================================================
// V1-Style Inline Widget: Other Collectables Card
// =========================================================================


/**
 * Render the user's Custom Dashboard Cards (Settings -> Custom Dashboard Card).
 *
 * The creator modal writes these definitions to localStorage, but nothing read
 * that store: a card saved, toasted "Custom card created!", and never appeared.
 * The definitions were always fully formed (title, data source, display style,
 * colours) -- only the renderer was missing. The key itself is read through
 * getCustomDashboardCards() in state.js, so there is one place that owns it.
 *
 * One card per definition, laid out to match the other dashboard cards so it
 * participates in drag-reorder, width classes and the visibility settings.
 */

/* Resolve a definition's dataSource id against the live portfolio payload.
   The modal offers 12 ids and /api/portfolio returns a specific key set, so
   each id is mapped explicitly. Anything unknown resolves to null and renders
   as an em dash -- never "undefined" or "$NaN". */
function _resolveCustomCardValue(def, p) {
    p = p || {};
    var num = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : null; };
    var map = {
        totalValue:         num(p.total_estimated_value),
        totalMelt:          num(p.total_melt),
        collectibleValue:   num(p.collectable_value),
        coinCount:          num(p.total_physical_coins),
        itemCount:          num(p.total_items),
        completion:         null,   // needs a section rollup; see note below
        goldMelt:           num(p.gold_coin_melt),
        silverMelt:         num(p.silver_coin_melt),
        platinumMelt:       num(p.platinum_coin_melt),
        palladiumMelt:      num(p.palladium_coin_melt),
        copperMelt:         num(p.copper_coin_melt),
        bulkValue:          num(p.bulk_coins_value),
        paperValue:         num(p.paper_value),
        scrapValue:         num(p.scrap_value),
        rawBullion:         num(p.raw_bullion),
        otherValue:         num(p.other_value),
        faceValue:          num(p.face_value)
    };
    // `completion` is a percentage, not currency, so it is computed here from
    // the sections already held in state rather than from the payload.
    if (def.dataSource === 'completion') {
        var secs = getSections() || [];
        var tot = 0, own = 0;
        secs.forEach(function (s) { tot += (s.total || 0); own += (s.owned || 0); });
        return tot > 0 ? (Math.round(own / tot * 1000) / 10) : null;
    }
    if (def.dataSource === 'custom') {
        var cv = def.customValue;
        if (cv === null || cv === undefined || cv === '') return null;
        var asNum = Number(cv);
        return isNaN(asNum) ? String(cv) : asNum;
    }
    return Object.prototype.hasOwnProperty.call(map, def.dataSource) ? map[def.dataSource] : null;
}

/* Format a resolved value. Currency ids get 2dp; counts and percentages do not. */
function _formatCustomCardValue(def, value) {
    if (value === null || value === undefined) return '\u2014';
    var CURRENCY = { totalValue:1, totalMelt:1, collectibleValue:1, goldMelt:1,
                     silverMelt:1, platinumMelt:1, palladiumMelt:1, copperMelt:1,
                     bulkValue:1, paperValue:1, scrapValue:1, rawBullion:1,
                     otherValue:1, faceValue:1 };
    if (CURRENCY[def.dataSource]) {
        return '$' + Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 });
    }
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
}