export function buildCustomDashboardCardsCard(p) {
    var defs;
    try { defs = getCustomDashboardCards(); } catch (e) { defs = []; }
    if (!Array.isArray(defs) || defs.length === 0) return null;

    var card = el('div', { className: 'card dashboard-card', id: 'card-user-custom',
                           style: 'display:flex; flex-direction:column;' });

    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-shrink:0;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;' }, ' My Cards'));
    hdr.appendChild(el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);padding-right:28px;' },
                       defs.length + ' card' + (defs.length !== 1 ? 's' : '')));
    card.appendChild(hdr);

    var list = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:0;max-height:200px;margin-bottom:0;' });

    defs.forEach(function (def) {
        var bg = def.bgColor || 'var(--color-bg-card)';
        var fg = def.textColor || 'var(--color-text-main)';
        var resolved = _resolveCustomCardValue(def, p);
        var text = _formatCustomCardValue(def, resolved);
        var style = def.displayStyle || 'bigNumber';

        var row = el('div', {
            className: 'user-custom-card',
            style: 'background:' + bg + '; color:' + fg + '; border:1px solid var(--color-border);' +
                   'border-radius:var(--radius-base); padding:10px 12px; margin-bottom:8px;' +
                   'display:flex; gap:10px; align-items:center; justify-content:space-between;'
        });

        var label = el('div', { style: 'font-size:0.82em; font-weight:600; opacity:0.9; min-width:0;' },
                       String(def.title));

        var valueEl;
        if (style === 'labelValue') {
            valueEl = el('div', { style: 'font-size:1.05em; font-weight:700; white-space:nowrap;' }, text);
            row.appendChild(label); row.appendChild(valueEl);
        } else if (style === 'progress') {
            var pct = (typeof resolved === 'number') ? Math.max(0, Math.min(100, resolved)) : 0;
            var track = el('div', { style: 'flex:1; height:8px; border-radius:4px; background:rgba(128,128,128,0.35); overflow:hidden;' });
            var fill = el('div', { style: 'width:' + pct + '%; height:100%; background:currentColor; border-radius:4px;' });
            track.appendChild(fill);
            label.appendChild(el('div', { style: 'font-size:0.72em; font-weight:400; opacity:0.8; margin-top:2px;' }, text));
            row.appendChild(label); row.appendChild(track);
        } else if (style === 'trend') {
            var arrow = (typeof resolved === 'number' && resolved >= 0) ? '\u25b2' : '\u25bc';
            var acol = (typeof resolved === 'number' && resolved >= 0) ? '#22c55e' : '#ef4444';
            valueEl = el('div', { style: 'display:flex; align-items:center; gap:6px; font-weight:700; white-space:nowrap;' },
                el('span', { style: 'color:' + acol + '; font-size:0.9em;' }, arrow),
                el('span', {}, text));
            row.appendChild(label); row.appendChild(valueEl);
        } else {
            // bigNumber (default): title above, value centred beneath
            row.style.flexDirection = 'column';
            row.style.justifyContent = 'center';
            row.style.alignItems = 'center';
            row.style.textAlign = 'center';
            row.style.padding = '14px 12px';
            label.appendChild(el('div', { style: 'font-size:1.35em; font-weight:700; margin-top:4px; color:inherit;' }, text));
            row.appendChild(label);
        }
        list.appendChild(row);
    });

    card.appendChild(list);
    return card;
}

export function buildCustomCategoriesCard(categories, collectables) {
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
    var listDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;max-height:200px;margin-bottom:10px;' });
    if (collectables.length === 0) {
        listDiv.appendChild(el('p', { style: 'font-size:0.8em;color:var(--color-text-muted);margin:0 0 6px;' }, 'No collectables yet.'));
        // Remove min-height gap when empty
        listDiv.style.minHeight = '0';
        listDiv.style.marginBottom = '0';
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

    card.appendChild(form)
    _foldCardForm(form, addBtn, 'collect', 'Add Item');;
    return card;
}



// =========================================================================
// Inline event delegation for V1-style card actions
// =========================================================================

function _showCardToast(msg, type) {
    try {
        import('./notifications.js').then(function(m){ m.showToast(msg, type || 'success'); });
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
            var { saveScrap, fetchScrap } = await import('./api.js');
            var { setScrapMetal } = await import('./state.js');
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
            var { deleteScrap, fetchScrap } = await import('./api.js');
            var { setScrapMetal } = await import('./state.js');
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
        var rbAmtIn    = btn._amtIn;
        var rbPurityIn = btn._purityIn;
        var rbNotesIn  = btn._notesIn;

        if (!rbWgtIn || !parseFloat(rbWgtIn.value)) {
            _saving = false; btn.disabled = false; return _showCardToast('Weight is required', 'error');
        }
        var w = parseFloat(rbWgtIn.value);
        var amt = parseInt(rbAmtIn?.value || '1', 10);
        var unit = rbUnitSel.value;
        try {
            var { saveRawBullion, fetchRawBullion } = await import('./api.js');
            var { setRawBullion } = await import('./state.js');
            await saveRawBullion({
                label: (rbLabelIn.value || '').trim(),
                metal_type: rbMetalSel.value,
                weight: w,
                amount: amt,
                weight_unit: unit,
                purity: 1.0,
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
            var { deleteRawBullion, fetchRawBullion } = await import('./api.js');
            var { setRawBullion } = await import('./state.js');
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
            var { fetchBulkEntries, addBulkEntry } = await import('./api.js');
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
                // 2026-10-10 (Matthew), corrected year ranges
                'Eisenhower Dollars (1971-1978, clad)': 'EisenhowerClad',
                'Golden Sacagawea & Presidential Dollars': 'GoldenDollars',
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
            var { fetchBulkEntries, deleteBulkEntry } = await import('./api.js');
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
            var { fetchPaperCurrency } = await import('./api.js');
            var { setPaperCurrency } = await import('./state.js');
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
            var { fetchPaperCurrency } = await import('./api.js');
            var { setPaperCurrency } = await import('./state.js');
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
            var { fetchOtherCollectables, fetchCustomCategories } = await import('./api.js');
            var { setOtherCollectables, setCustomCategories } = await import('./state.js');
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
            var { fetchOtherCollectables } = await import('./api.js');
            var { setOtherCollectables } = await import('./state.js');
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