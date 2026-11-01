/*
 * typeManager.js — Coin Catalog v2 — Type & Image Manager UI (v519 Intuitive Redesign)
 *
 * Phase 1 of GGMJ-227 + Oct 29 v519 UX Overhaul:
 *   - Groups coin types cleanly by Country & Denomination (US — Five Cent Nickel, Canada — Dollar, etc.)
 *   - Filters out legacy 0-coin underscore filename slugs (_1_Panama-Pacific, FIRST_SPOUSE_-_...)
 *   - Filter pills: All Types | Missing Images | US | Canada
 *   - Intuitive 3-Card Right Workspace:
 *       1. Reference Images (Obverse & Reverse) with direct Upload Photo, Pick from Library, and Clear
 *       2. Coins & Years Sharing These Images (clean interactive year/mint pills)
 *       3. Move / Split Years to Another Type (filtered to same denomination by default)
 */

import { el, escHtml, resolveImageUrl, formatSectionWithCountry } from './utils.js';
import { showToast } from './notifications.js';
import { createModal, closeModal } from './modals.js';
import {
    fetchTypeGroups,
    fetchTypeYears,
    setTypeYears,
    upsertTypeConfig,
    deleteTypeConfig,
    assignTypeImage,
    fetchTypeImages,
    uploadImageAsDataUri,
    uploadCoinBankImage,
} from './api.js';

const MODAL_ID = 'modal-type-manager';

const state = {
    groups: [],
    yearsByType: {},
    selected: null,
    selectedYears: new Set(),
    query: '',
    filterMode: 'all', // 'all' | 'missing' | 'us' | 'canada'
    sameDenomOnly: true,
    open: false,
};

function _humanizeTypeName(raw) {
    if (!raw) return 'Unnamed Type';
    return String(raw)
        .replace(/^_+/, '')
        .replace(/_-_/g, ' — ')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function _isGhostType(g) {
    if (!g || !g.coin_type) return true;
    const ct = String(g.coin_type);
    if (ct.includes(' — ')) return true;
    if ((g.coin_count || 0) === 0 && (ct.includes('_') || /^\d/.test(ct))) return true;
    return false;
}

function _categoryLabel(g) {
    if (g && g.section) {
        return formatSectionWithCountry(g.section);
    }
    const name = _humanizeTypeName(g ? g.coin_type : '');
    if (name.includes(' - ')) return name.split(' - ')[0].trim();
    if (name.includes(' (')) return name.split(' (')[0].trim();
    return 'General Types';
}

function _thumb(path, alt, large = false) {
    const cls = large ? 'tm-thumb tm-thumb-lg' : 'tm-thumb';
    if (!path) {
        return el('div', {
            className: cls + ' tm-thumb-empty',
            title: 'No image assigned yet',
        }, large ? 'No Photo' : '—');
    }
    return el('div', { className: cls }, el('img', {
        src: resolveImageUrl(path),
        alt: alt || '',
        loading: 'lazy',
        onerror: (e) => {
            const img = e.currentTarget;
            img.style.display = 'none';
            img.parentElement.classList.add('tm-thumb-broken');
            img.parentElement.textContent = large ? 'Missing' : '!';
        },
    }));
}

function _yearRange(g) {
    if (!g || g.year_start == null || g.year_end == null) return 'All Years';
    if (g.year_start === g.year_end) return String(g.year_start);
    return g.year_start + '–' + g.year_end;
}

function _formatCount(n) {
    return (n == null ? 0 : n).toLocaleString();
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function _loadGroups() {
    try {
        const groups = await fetchTypeGroups();
        const rawList = Array.isArray(groups) ? groups : [];
        state.groups = rawList.filter((g) => !_isGhostType(g));
    } catch (err) {
        console.error('[typeManager] failed to load type groups:', err);
        showToast('Failed to load coin types', 'error');
        state.groups = [];
    }
}

async function _loadYears(coinType) {
    try {
        const data = await fetchTypeYears(coinType);
        state.yearsByType[coinType] = data;
        state.selectedYears = new Set((data.years || []).map((y) => y.year));
    } catch (err) {
        console.error('[typeManager] failed to load years for ' + coinType, err);
        state.yearsByType[coinType] = { years: [], coin_count: 0 };
        state.selectedYears = new Set();
    }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function _renderList(container) {
    container.innerHTML = '';
    const q = (state.query || '').toLowerCase().trim();

    let groups = state.groups.filter((g) => (g.coin_count || 0) > 0 || !g.coin_type.includes('_'));

    if (state.filterMode === 'missing') {
        groups = groups.filter((g) => !g.obv_image || !g.rev_image);
    } else if (state.filterMode === 'us') {
        groups = groups.filter((g) => /^US\b/i.test(g.section || '') || (!g.section && !/canad/i.test(g.coin_type || '')));
    } else if (state.filterMode === 'canada') {
        groups = groups.filter((g) => /^Canad/i.test(g.section || '') || /canad/i.test(g.coin_type || ''));
    }

    if (q) {
        groups = groups.filter((g) =>
            (g.coin_type || '').toLowerCase().includes(q) ||
            _humanizeTypeName(g.coin_type).toLowerCase().includes(q) ||
            (g.section || '').toLowerCase().includes(q) ||
            (g.denomination || '').toLowerCase().includes(q)
        );
    }

    if (!groups.length) {
        container.appendChild(el('div', { className: 'tm-empty' },
            q ? 'No coin types match "' + state.query + '".' : 'No coin types match the selected filter.'));
        return;
    }

    // Group cleanly by Country & Denomination section
    const buckets = new Map();
    groups.forEach((g) => {
        const key = _categoryLabel(g);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(g);
    });

    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
        const aUS = a.startsWith('US —') ? 0 : (a.startsWith('Canada —') ? 1 : 2);
        const bUS = b.startsWith('US —') ? 0 : (b.startsWith('Canada —') ? 1 : 2);
        if (aUS !== bUS) return aUS - bUS;
        return a.localeCompare(b);
    });

    sortedKeys.forEach((key, idx) => {
        const items = buckets.get(key);
        items.sort((a, b) => (a.year_start || 9999) - (b.year_start || 9999) || (a.coin_type || '').localeCompare(b.coin_type || ''));
        const totalCoins = items.reduce((s, g) => s + (g.coin_count || 0), 0);
        const hasSelected = items.some((g) => g.coin_type === state.selected);
        const details = el('details', {
            className: 'tm-group',
            open: Boolean(q || hasSelected || idx < 3),
        });
        details.appendChild(el('summary', { className: 'tm-group-head' },
            el('span', { className: 'tm-group-name' }, key),
            el('span', { className: 'tm-group-count' },
                items.length + (items.length === 1 ? ' type' : ' types') +
                ' · ' + _formatCount(totalCoins) + ' coins')));
        const list = el('div', { className: 'tm-group-list' });
        items.forEach((g) => list.appendChild(_renderTypeRow(g)));
        details.appendChild(list);
        container.appendChild(details);
    });
}

function _renderTypeRow(g) {
    const isSelected = state.selected === g.coin_type;
    const row = el('div', {
        className: 'tm-type-row' + (isSelected ? ' tm-selected' : ''),
        dataset: { coinType: g.coin_type },
    });

    const thumbPair = el('div', { className: 'tm-thumb-pair' });
    thumbPair.appendChild(_thumb(g.obv_image, g.coin_type + ' obverse'));
    thumbPair.appendChild(_thumb(g.rev_image, g.coin_type + ' reverse'));
    row.appendChild(thumbPair);

    const info = el('div', { className: 'tm-type-info' });
    info.appendChild(el('div', { className: 'tm-type-name' }, _humanizeTypeName(g.coin_type)));
    const meta = el('div', { className: 'tm-type-meta' });
    meta.appendChild(el('span', { className: 'tm-chip' }, _yearRange(g)));
    meta.appendChild(el('span', { className: 'tm-chip' }, _formatCount(g.coin_count) + ' coins'));
    const hasBoth = Boolean(g.obv_image && g.rev_image);
    meta.appendChild(el('span', {
        className: 'tm-chip ' + (hasBoth ? 'tm-chip-ok' : 'tm-chip-warn'),
    }, hasBoth ? '✓ Obv & Rev' : (!g.obv_image && !g.rev_image ? 'Missing Both' : (!g.obv_image ? 'Missing Obv' : 'Missing Rev'))));
    info.appendChild(meta);
    row.appendChild(info);

    row.addEventListener('click', () => _selectType(g.coin_type));
    return row;
}

function _renderEditor(container) {
    container.innerHTML = '';
    if (!state.selected) {
        const emptyBox = el('div', { className: 'tm-empty-guide' });
        emptyBox.appendChild(el('div', { style: 'font-size:2rem;margin-bottom:8px;' }, '🪙'));
        emptyBox.appendChild(el('h4', { style: 'margin:0 0 6px 0;color:var(--color-text-main);' }, 'Select a Coin Type on the Left'));
        emptyBox.appendChild(el('p', { style: 'margin:0;color:var(--color-text-muted);font-size:0.86rem;line-height:1.5;' },
            'Choose any coin series from the left panel to upload or pick its Obverse & Reverse photos, inspect which coin years share those photos, or split years into a separate type.'));
        container.appendChild(emptyBox);
        return;
    }

    const g = state.groups.find((x) => x.coin_type === state.selected);
    const yearsData = state.yearsByType[state.selected] || { years: [] };

    const head = el('div', { className: 'tm-editor-head' });
    const catBadge = g && g.section ? el('div', { className: 'tm-editor-cat' }, formatSectionWithCountry(g.section)) : null;
    if (catBadge) head.appendChild(catBadge);
    head.appendChild(el('h3', { className: 'tm-editor-title' }, _humanizeTypeName(state.selected)));
    if (g) {
        head.appendChild(el('div', { className: 'tm-editor-meta' },
            'Years ' + _yearRange(g) + ' · ' + _formatCount(g.coin_count) + ' coins · ' + _formatCount(g.distinct_years) + ' distinct year(s)'));
    }
    container.appendChild(head);

    // --- CARD 1: Type Reference Images (Obverse & Reverse) ---
    const imagesCard = el('div', { className: 'tm-section' });
    imagesCard.appendChild(el('h4', { className: 'tm-section-head' }, '1. Reference Images for This Type'));
    imagesCard.appendChild(el('p', { className: 'tm-hint', style: 'margin-bottom:10px;' },
        'These photos appear as the default Obverse (front) and Reverse (back) images for all coins in this type.'));

    const imgGrid = el('div', { className: 'tm-image-grid' });
    [
        { side: 'obv', label: 'Obverse (Front)' },
        { side: 'rev', label: 'Reverse (Back)' },
    ].forEach(({ side, label }) => {
        const currentPath = g ? g[side + '_image'] : null;
        const cell = el('div', { className: 'tm-image-cell' });
        cell.appendChild(el('div', { className: 'tm-image-side-label' }, label));
        cell.appendChild(_thumb(currentPath, state.selected + ' ' + side, true));

        const btnCol = el('div', { className: 'tm-image-actions' });
        // Direct file upload button
        const uploadBtn = el('button', {
            className: 'btn-primary tm-btn',
            type: 'button',
            onclick: () => _uploadDirectFile(state.selected, side, g ? g.section : ''),
        }, '⬆ Upload Photo');
        btnCol.appendChild(uploadBtn);

        // Library picker button
        const libBtn = el('button', {
            className: 'btn-secondary tm-btn',
            type: 'button',
            onclick: () => _pickImage(side),
        }, '🗂 Choose from Library');
        btnCol.appendChild(libBtn);

        if (currentPath) {
            const clearBtn = el('button', {
                className: 'btn-secondary tm-btn',
                type: 'button',
                style: 'color:var(--color-danger);border-color:rgba(239,68,68,0.35);',
                onclick: async () => {
                    try {
                        await assignTypeImage(state.selected, side, '');
                        showToast('Cleared ' + label + ' image', 'info');
                        await _loadGroups();
                        _render();
                    } catch (err) {
                        showToast('Failed to clear image: ' + err.message, 'error');
                    }
                },
            }, '✕ Clear');
            btnCol.appendChild(clearBtn);
        }

        cell.appendChild(btnCol);
        imgGrid.appendChild(cell);
    });
    imagesCard.appendChild(imgGrid);
    container.appendChild(imagesCard);

    // --- CARD 2: Coins & Years Sharing These Images ---
    const shared = el('div', { className: 'tm-section' });
    const sharedTop = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;' });
    sharedTop.appendChild(el('h4', { className: 'tm-section-head', style: 'margin:0;' }, '2. Coins & Years Sharing These Images'));
    if (yearsData.years && yearsData.years.length > 0) {
        const selBtns = el('div', { style: 'display:flex;gap:6px;' });
        selBtns.appendChild(el('button', {
            type: 'button',
            className: 'btn-secondary tm-btn-xs',
            onclick: () => {
                yearsData.years.forEach((y) => state.selectedYears.add(y.year));
                _renderEditor(container);
            }
        }, 'Select All'));
        selBtns.appendChild(el('button', {
            type: 'button',
            className: 'btn-secondary tm-btn-xs',
            onclick: () => {
                state.selectedYears.clear();
                _renderEditor(container);
            }
        }, 'Clear'));
        sharedTop.appendChild(selBtns);
    }
    shared.appendChild(sharedTop);

    if (!yearsData.years || !yearsData.years.length) {
        shared.appendChild(el('p', { className: 'tm-hint' }, 'No coins are currently mapped to this type.'));
    } else {
        const yearList = el('div', { className: 'tm-year-list' });
        yearsData.years.forEach((y) => {
            const cb = el('input', {
                type: 'checkbox',
                checked: state.selectedYears.has(y.year),
                dataset: { year: String(y.year) },
                onchange: (e) => {
                    if (e.target.checked) state.selectedYears.add(y.year);
                    else state.selectedYears.delete(y.year);
                },
            });
            const mints = (y.coins || []).map((c) => c.mint_mark || 'P');
            const row = el('label', { className: 'tm-year-row' });
            row.appendChild(cb);
            row.appendChild(el('span', { className: 'tm-year' }, String(y.year)));
            row.appendChild(el('span', { className: 'tm-mints' },
                mints.length + (mints.length === 1 ? ' mint: ' : ' mints: ') + mints.join(', ')));
            yearList.appendChild(row);
        });
        shared.appendChild(yearList);
    }
    container.appendChild(shared);

    // --- CARD 3: Move Years to Another Type ---
    const editor = el('div', { className: 'tm-section' });
    editor.appendChild(el('h4', { className: 'tm-section-head' }, '3. Move Checked Years to Another Type'));

    const sameDenomWrap = el('label', { style: 'display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--color-text-muted);margin-bottom:8px;cursor:pointer;' });
    const sameDenomCb = el('input', {
        type: 'checkbox',
        checked: state.sameDenomOnly,
        onchange: (e) => {
            state.sameDenomOnly = e.target.checked;
            _renderEditor(container);
        }
    });
    sameDenomWrap.appendChild(sameDenomCb);
    sameDenomWrap.appendChild(document.createTextNode('Only show target types in the same section / denomination'));
    editor.appendChild(sameDenomWrap);

    const targetSel = el('select', { id: 'tm-move-target', className: 'tm-select' });
    let candidates = state.groups.filter((x) => x.coin_type !== state.selected && !_isGhostType(x));
    if (state.sameDenomOnly && g && g.section) {
        const sameSec = candidates.filter((x) => x.section === g.section);
        if (sameSec.length > 0) candidates = sameSec;
    }
    candidates.sort((a, b) => _humanizeTypeName(a.coin_type).localeCompare(_humanizeTypeName(b.coin_type)));
    candidates.forEach((x) => {
        const secPrefix = (!state.sameDenomOnly && x.section) ? (formatSectionWithCountry(x.section) + ' — ') : '';
        targetSel.appendChild(el('option', { value: x.coin_type }, secPrefix + _humanizeTypeName(x.coin_type) + ' (' + _yearRange(x) + ')'));
    });

    editor.appendChild(el('div', { className: 'tm-field' },
        el('label', { className: 'tm-label' }, 'Target Type'),
        targetSel));

    const fromInput = el('input', {
        type: 'text', id: 'tm-move-from', className: 'tm-input',
        placeholder: 'Optional year range (e.g. 2004-2005) or leave blank to use checked years above',
    });
    editor.appendChild(el('div', { className: 'tm-field' },
        el('label', { className: 'tm-label' }, 'Years to Move'),
        fromInput));

    const actionRow = el('div', { className: 'tm-actions', style: 'justify-content:space-between;flex-wrap:wrap;' });
    const moveBtn = el('button', {
        className: 'btn-primary tm-btn', type: 'button',
        onclick: () => _moveYears(targetSel.value, fromInput.value),
    }, 'Move Years →');
    actionRow.appendChild(moveBtn);

    const delBtn = el('button', {
        className: 'btn-danger tm-btn', type: 'button',
        onclick: () => _deleteType(state.selected),
    }, 'Delete Type');
    actionRow.appendChild(delBtn);

    editor.appendChild(actionRow);
    container.appendChild(editor);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function _selectType(coinType) {
    state.selected = coinType;
    await _loadYears(coinType);
    _render();
}

function _uploadDirectFile(coinType, side, section) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.display = 'none';
    inp.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        inp.remove();
        if (!file) return;
        showToast('Uploading ' + (side === 'obv' ? 'Obverse' : 'Reverse') + ' image for ' + _humanizeTypeName(coinType) + '...', 'info');
        try {
            const dataUri = await uploadImageAsDataUri(file);
            const res = await uploadCoinBankImage({
                coin_type: coinType,
                section: section || undefined,
                side: side,
                image: dataUri,
            });
            if (res && (res.status === 'saved' || res.status === 'success' || res.filename || res.obv_image || res.rev_image)) {
                showToast('Saved ' + (side === 'obv' ? 'Obverse' : 'Reverse') + ' image for ' + _humanizeTypeName(coinType), 'success');
                await _loadGroups();
                _render();
            } else {
                await assignTypeImage(coinType, side, dataUri);
                showToast('Saved ' + (side === 'obv' ? 'Obverse' : 'Reverse') + ' image for ' + _humanizeTypeName(coinType), 'success');
                await _loadGroups();
                _render();
            }
        } catch (err) {
            console.error('[typeManager] direct upload failed:', err);
            showToast('Upload failed: ' + err.message, 'error');
        }
    };
    document.body.appendChild(inp);
    inp.click();
}

async function _moveYears(targetType, rangeText) {
    if (!targetType) {
        showToast('Choose a target type', 'warning');
        return;
    }
    let years = Array.from(state.selectedYears).sort((a, b) => a - b);

    const text = (rangeText || '').trim();
    if (text) {
        const parsed = _parseYearRange(text);
        if (!parsed.length) {
            showToast('Could not read the year range', 'error');
            return;
        }
        years = parsed;
    }

    if (!years.length) {
        showToast('Check at least one year above or enter a year range', 'warning');
        return;
    }

    try {
        await setTypeYears(targetType, years);
        showToast('Moved ' + years.length + ' year(s) to ' + _humanizeTypeName(targetType), 'success');
        await _loadGroups();
        await _loadYears(state.selected);
        _render();
    } catch (err) {
        console.error('[typeManager] move failed:', err);
        showToast('Failed to move years: ' + (err.message || err), 'error');
    }
}

function _parseYearRange(text) {
    const out = [];
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
    parts.forEach((p) => {
        const m = p.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
        if (m) {
            const a = parseInt(m[1], 10);
            const b = parseInt(m[2], 10);
            for (let y = Math.min(a, b); y <= Math.max(a, b); y++) out.push(y);
            return;
        }
        const single = p.match(/^(\d{4})$/);
        if (single) out.push(parseInt(single[1], 10));
    });
    return Array.from(new Set(out)).sort((a, b) => a - b);
}

async function _pickImage(side) {
    let images = [];
    try {
        images = await fetchTypeImages();
    } catch (err) {
        console.error('[typeManager] failed to load images:', err);
        showToast('Failed to load the image library', 'error');
        return;
    }

    const usable = (images || []).filter((i) => i && i[side]);
    if (!usable.length) {
        showToast('No ' + (side === 'obv' ? 'Obverse' : 'Reverse') + ' library images found. Use "Upload Photo" to upload from your device.', 'info');
        return;
    }

    const body = el('div', { className: 'tm-picker' });
    const search = el('input', {
        type: 'text', className: 'tm-input', placeholder: 'Filter library images by name...',
    });
    body.appendChild(search);
    const grid = el('div', { className: 'tm-picker-grid' });

    const paint = () => {
        grid.innerHTML = '';
        const q = (search.value || '').toLowerCase().trim();
        const list = usable.filter((i) => !q || (i.base || '').toLowerCase().includes(q));
        list.slice(0, 300).forEach((i) => {
            const cell = el('div', { className: 'tm-picker-cell', title: _humanizeTypeName(i.base) });
            cell.appendChild(el('img', {
                src: resolveImageUrl('/data/images/types/' + i[side]),
                alt: i.base, loading: 'lazy',
                onclick: async () => {
                    try {
                        await assignTypeImage(state.selected, side, i[side]);
                        showToast('Set ' + (side === 'obv' ? 'Obverse' : 'Reverse') + ' image for ' + _humanizeTypeName(state.selected), 'success');
                        closeModal('modal-type-manager-image');
                        await _loadGroups();
                        _render();
                    } catch (err) {
                        console.error('[typeManager] assign failed:', err);
                        showToast('Failed to set the image', 'error');
                    }
                },
            }));
            cell.appendChild(el('div', { className: 'tm-picker-caption' }, _humanizeTypeName(i.base)));
            grid.appendChild(cell);
        });
        if (!list.length) grid.appendChild(el('div', { className: 'tm-empty' }, 'No matching library images.'));
    };
    search.addEventListener('input', paint);
    paint();
    body.appendChild(grid);

    createModal('modal-type-manager-image', 'Choose ' + (side === 'obv' ? 'Obverse' : 'Reverse') + ' Image from Library', body, null);
}

async function _deleteType(coinType) {
    if (!coinType) return;
    if (!confirm('Delete the type "' + _humanizeTypeName(coinType) + '"?\n\n' +
        'Coins mapped to it keep their rows, and any remaining years will re-attach to the nearest matching type in the same section.')) {
        return;
    }
    try {
        await deleteTypeConfig(coinType);
        showToast('Deleted ' + _humanizeTypeName(coinType), 'success');
        state.selected = null;
        await _loadGroups();
        _render();
    } catch (err) {
        console.error('[typeManager] delete failed:', err);
        showToast('Failed to delete the type', 'error');
    }
}

async function _createType() {
    const body = el('div', { className: 'tm-create' });
    const nameInput = el('input', {
        type: 'text', id: 'tm-new-name', className: 'tm-input',
        placeholder: "e.g. Jefferson 2005 Ocean in View",
    });
    const rangeInput = el('input', {
        type: 'text', id: 'tm-new-years', className: 'tm-input',
        placeholder: 'e.g. 2005 or 2004-2005',
    });
    body.appendChild(el('div', { className: 'tm-field' },
        el('label', { className: 'tm-label' }, 'New Type Name'), nameInput));
    body.appendChild(el('div', { className: 'tm-field' },
        el('label', { className: 'tm-label' }, 'Years to Assign (Optional)'), rangeInput));
    body.appendChild(el('p', { className: 'tm-hint' },
        'Creates a new coin type so you can assign dedicated Obverse & Reverse photos to those specific years.'));

    const footer = el('div', { className: 'tm-actions tm-actions-right' });
    footer.appendChild(el('button', {
        className: 'btn-secondary tm-btn', type: 'button',
        onclick: () => closeModal('modal-type-manager-new'),
    }, 'Cancel'));
    footer.appendChild(el('button', {
        className: 'btn-primary tm-btn', type: 'button',
        onclick: async () => {
            const name = (nameInput.value || '').trim();
            if (!name) {
                showToast('Enter a type name', 'warning');
                return;
            }
            const years = _parseYearRange(rangeInput.value || '');
            try {
                await upsertTypeConfig({ coin_type: name });
                if (years.length) await setTypeYears(name, years);
                showToast('Created ' + name, 'success');
                closeModal('modal-type-manager-new');
                await _loadGroups();
                state.selected = name;
                await _loadYears(name);
                _render();
            } catch (err) {
                console.error('[typeManager] create failed:', err);
                showToast('Failed to create the type', 'error');
            }
        },
    }, 'Create Type'));

    createModal('modal-type-manager-new', 'Create New Coin Type', body, footer);
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

let _listEl = null;
let _editorEl = null;
let _filterBarEl = null;

function _render() {
    if (_filterBarEl) _updateFilterPills();
    if (_listEl) _renderList(_listEl);
    if (_editorEl) _renderEditor(_editorEl);
}

function _updateFilterPills() {
    if (!_filterBarEl) return;
    const missingCount = state.groups.filter((g) => (g.coin_count || 0) > 0 && (!g.obv_image || !g.rev_image)).length;
    _filterBarEl.querySelectorAll('button[data-filter]').forEach((btn) => {
        const f = btn.dataset.filter;
        btn.className = (f === state.filterMode ? 'btn-primary' : 'btn-secondary') + ' tm-filter-pill';
        if (f === 'missing') {
            btn.textContent = `Missing Photos (${missingCount})`;
        }
    });
}

export async function openTypeManager() {
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    const body = el('div', { className: 'tm-body' });

    const toolbar = el('div', { className: 'tm-toolbar' });
    const search = el('input', {
        type: 'text', className: 'tm-search', id: 'tm-search',
        placeholder: 'Search by coin type, denomination, or country (e.g. Jefferson, Morgan, Canada)...',
        value: state.query,
        oninput: (e) => {
            state.query = e.target.value;
            if (_listEl) _renderList(_listEl);
        },
    });
    toolbar.appendChild(search);
    toolbar.appendChild(el('button', {
        className: 'btn-primary tm-btn', type: 'button',
        onclick: () => _createType(),
    }, '＋ New Type'));
    body.appendChild(toolbar);

    // Filter pill bar
    _filterBarEl = el('div', { className: 'tm-filter-bar' });
    [
        { key: 'all', label: 'All Types' },
        { key: 'missing', label: 'Missing Photos' },
        { key: 'us', label: '🇺🇸 US Coins' },
        { key: 'canada', label: '🇨🇦 Canadian Coins' },
    ].forEach((f) => {
        const pill = el('button', {
            type: 'button',
            className: (state.filterMode === f.key ? 'btn-primary' : 'btn-secondary') + ' tm-filter-pill',
            dataset: { filter: f.key },
            onclick: () => {
                state.filterMode = f.key;
                _render();
            }
        }, f.label);
        _filterBarEl.appendChild(pill);
    });
    body.appendChild(_filterBarEl);

    const cols = el('div', { className: 'tm-columns' });
    _listEl = el('div', { className: 'tm-list' });
    _editorEl = el('div', { className: 'tm-editor' });
    cols.appendChild(_listEl);
    cols.appendChild(_editorEl);
    body.appendChild(cols);

    const footer = el('div', { className: 'tm-actions tm-actions-right' });
    footer.appendChild(el('button', {
        className: 'btn-secondary tm-btn', type: 'button',
        onclick: () => closeModal(MODAL_ID),
    }, 'Close'));

    const modalOverlay = createModal(MODAL_ID, 'Type & Image Manager', body, footer);
    const modalBox = modalOverlay && modalOverlay.querySelector('.modal-box');
    if (modalBox) {
        modalBox.style.maxWidth = '960px';
        modalBox.style.width = '94vw';
    }

    await _loadGroups();
    if (!state.selected && state.groups.length > 0) {
        const firstUS = state.groups.find((g) => (g.coin_count || 0) > 0 && /^US\b/i.test(g.section || '')) || state.groups[0];
        if (firstUS) {
            state.selected = firstUS.coin_type;
            await _loadYears(state.selected);
        }
    }
    _render();
    state.open = true;
}

/** Close the manager and drop its cached state. */
export function closeTypeManager() {
    closeModal(MODAL_ID);
    state.open = false;
    state.selected = null;
    state.yearsByType = {};
    state.selectedYears = new Set();
    _listEl = null;
    _editorEl = null;
    _filterBarEl = null;
}