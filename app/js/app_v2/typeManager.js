/*
 * typeManager.js — Coin Catalog v2 — Type & Image Manager UI
 *
 * Phase 1 of GGMJ-227: user-managed coin type groupings + image sharing.
 *
 * The manager answers the question that the AI type-year mapping could not:
 * "which coins share this type's images, and who else should?"
 *
 * It offers:
 *   VIEW          — every coin type, grouped and searchable, with its year
 *                   span, coin count and obv/rev thumbnails.
 *   SHARED GROUP  — the exact years and coins that share a type's images.
 *   EDIT MAPPING  — re-assign years between types (add or remove).
 *   CREATE TYPE   — a new named type with a year range and its own images.
 *   IMAGES        — set the obv/rev image for a type.
 *
 * It follows the app's existing modal conventions (see modals.js) and uses
 * the shared API layer so it works on the self-hosted backend AND on the
 * static deployments, where api.js routes the same calls to IndexedDB.
 */

import { el, escHtml, resolveImageUrl } from './utils.js';
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
} from './api.js';

const MODAL_ID = 'modal-type-manager';

const state = {
    groups: [],
    yearsByType: {},
    selected: null,      // the coin_type string currently open
    selectedYears: new Set(),
    query: '',
    open: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render an <img> for a type-config image path, or a placeholder box. */
function _thumb(path, alt) {
    if (!path) {
        return el('div', {
            className: 'tm-thumb tm-thumb-empty',
            title: 'No image',
        }, '—');
    }
    return el('div', { className: 'tm-thumb' }, el('img', {
        src: resolveImageUrl(path),
        alt: alt || '',
        loading: 'lazy',
        onerror: (e) => {
            const img = e.currentTarget;
            img.style.display = 'none';
            img.parentElement.classList.add('tm-thumb-broken');
            img.parentElement.title = 'Image failed to load: ' + path;
        },
    }));
}

function _yearRange(g) {
    if (g.year_start == null || g.year_end == null) return '—';
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
        state.groups = Array.isArray(groups) ? groups : [];
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
        showToast('Failed to load years for ' + coinType, 'error');
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

    let groups = state.groups;
    if (q) {
        groups = groups.filter((g) => (g.coin_type || '').toLowerCase().includes(q));
    }

    if (!groups.length) {
        container.appendChild(el('div', { className: 'tm-empty' },
            q ? 'No types match "' + state.query + '".' : 'No coin types found.'));
        return;
    }

    // Group by the leading part of the type name, so related types sit
    // together and the list stays navigable with many types.
    const buckets = new Map();
    groups.forEach((g) => {
        const name = g.coin_type || '';
        const key = name.includes(' - ') ? name.split(' - ')[0] : name;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(g);
    });

    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b));

    sortedKeys.forEach((key) => {
        const items = buckets.get(key);
        const totalCoins = items.reduce((s, g) => s + (g.coin_count || 0), 0);
        const details = el('details', { className: 'tm-group' });
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

    row.appendChild(_thumb(g.obv_image, g.coin_type + ' obverse'));
    row.appendChild(_thumb(g.rev_image, g.coin_type + ' reverse'));

    const info = el('div', { className: 'tm-type-info' });
    info.appendChild(el('div', { className: 'tm-type-name' }, g.coin_type));
    const meta = el('div', { className: 'tm-type-meta' });
    meta.appendChild(el('span', { className: 'tm-chip' }, _yearRange(g)));
    meta.appendChild(el('span', { className: 'tm-chip' },
        _formatCount(g.coin_count) + ' coins'));
    meta.appendChild(el('span', { className: 'tm-chip' },
        _formatCount(g.distinct_years) + ' years'));
    info.appendChild(meta);
    row.appendChild(info);

    const actions = el('div', { className: 'tm-type-actions' });
    const openBtn = el('button', {
        className: 'btn-secondary tm-btn',
        type: 'button',
        onclick: (e) => {
            e.stopPropagation();
            _selectType(g.coin_type);
        },
    }, isSelected ? 'Close' : 'Manage');
    actions.appendChild(openBtn);
    row.appendChild(actions);

    row.addEventListener('click', () => _selectType(g.coin_type));
    return row;
}

function _renderEditor(container) {
    container.innerHTML = '';
    if (!state.selected) {
        container.appendChild(el('div', { className: 'tm-empty' },
            'Select a type on the left to see the years that share its images, ' +
            'edit the mapping, or set its images.'));
        return;
    }

    const g = state.groups.find((x) => x.coin_type === state.selected);
    const yearsData = state.yearsByType[state.selected] || { years: [] };

    const head = el('div', { className: 'tm-editor-head' });
    head.appendChild(el('h3', { className: 'tm-editor-title' }, state.selected));
    if (g) {
        head.appendChild(el('div', { className: 'tm-editor-meta' },
            'Years ' + _yearRange(g) + ' · ' + _formatCount(g.coin_count) + ' coins'));
    }
    container.appendChild(head);

    // --- shared-group view: which coins share this type's images ----------
    const shared = el('div', { className: 'tm-section' });
    shared.appendChild(el('h4', { className: 'tm-section-head' }, 'Coins sharing these images'));
    if (!yearsData.years || !yearsData.years.length) {
        shared.appendChild(el('p', { className: 'tm-hint' },
            'No coins are mapped to this type yet.'));
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
            const mints = (y.coins || []).map((c) => c.mint_mark || '—');
            const row = el('label', { className: 'tm-year-row' });
            row.appendChild(cb);
            row.appendChild(el('span', { className: 'tm-year' }, String(y.year)));
            row.appendChild(el('span', { className: 'tm-mints' },
                mints.length + (mints.length === 1 ? ' coin: ' : ' coins: ') + mints.join(' ')));
            yearList.appendChild(row);
        });
        shared.appendChild(yearList);
    }
    container.appendChild(shared);

    // --- mapping editor ----------------------------------------------------
    const editor = el('div', { className: 'tm-section' });
    editor.appendChild(el('h4', { className: 'tm-section-head' }, 'Move years to another type'));

    const targetSel = el('select', { id: 'tm-move-target', className: 'tm-select' });
    const current = state.groups.find((x) => x.coin_type === state.selected);
    const candidates = state.groups
        .filter((x) => x.coin_type !== state.selected)
        .filter((x) => !current || !x.coin_type.startsWith(current.coin_type.split(' (')[0] + ' (') ||
            x.coin_type !== current.coin_type);
    candidates.forEach((x) => {
        targetSel.appendChild(el('option', { value: x.coin_type }, x.coin_type));
    });
    editor.appendChild(el('div', { className: 'tm-field' },
        el('label', { className: 'tm-label' }, 'Target type'),
        targetSel));

    const fromInput = el('input', {
        type: 'text', id: 'tm-move-from', className: 'tm-input',
        placeholder: 'e.g. 2019, 2020 or 2019-2021',
    });
    editor.appendChild(el('div', { className: 'tm-field' },
        el('label', { className: 'tm-label' }, 'Years to move'),
        fromInput));
    editor.appendChild(el('p', { className: 'tm-hint' },
        'The years are taken away from this type and given to the target type. ' +
        'Leave the range blank to move every year currently ticked above.'));

    const moveBtn = el('button', {
        className: 'btn-primary tm-btn', type: 'button',
        onclick: () => _moveYears(targetSel.value, fromInput.value),
    }, 'Move years');
    editor.appendChild(el('div', { className: 'tm-actions' }, moveBtn));
    container.appendChild(editor);

    // --- images ------------------------------------------------------------
    const images = el('div', { className: 'tm-section' });
    images.appendChild(el('h4', { className: 'tm-section-head' }, 'Images for this type'));
    const imgGrid = el('div', { className: 'tm-image-grid' });
    ['obv', 'rev'].forEach((side) => {
        const current_path = current ? current[side + '_image'] : null;
        const cell = el('div', { className: 'tm-image-cell' });
        cell.appendChild(_thumb(current_path, side));
        cell.appendChild(el('div', { className: 'tm-image-actions' },
            el('button', {
                className: 'btn-secondary tm-btn', type: 'button',
                onclick: () => _pickImage(side),
            }, side === 'obv' ? 'Set obverse' : 'Set reverse')));
        imgGrid.appendChild(cell);
    });
    images.appendChild(imgGrid);
    container.appendChild(images);

    // --- create / delete ---------------------------------------------------
    const danger = el('div', { className: 'tm-section tm-danger' });
    danger.appendChild(el('h4', { className: 'tm-section-head' }, 'Type management'));
    const delBtn = el('button', {
        className: 'btn-danger tm-btn', type: 'button',
        onclick: () => _deleteType(state.selected),
    }, 'Delete this type');
    danger.appendChild(el('div', { className: 'tm-actions' }, delBtn));
    container.appendChild(danger);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function _selectType(coinType) {
    if (state.selected === coinType) {
        state.selected = null;
        _render();
        return;
    }
    state.selected = coinType;
    await _loadYears(coinType);
    _render();
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
        showToast('No years selected', 'warning');
        return;
    }

    try {
        await setTypeYears(targetType, years);
        showToast('Moved ' + years.length + ' year(s) to ' + targetType, 'success');
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
        showToast('Failed to load the image list', 'error');
        return;
    }

    const usable = (images || []).filter((i) => i && i[side]);
    if (!usable.length) {
        showToast('No ' + side + ' images available', 'warning');
        return;
    }

    const body = el('div', { className: 'tm-picker' });
    const search = el('input', {
        type: 'text', className: 'tm-input', placeholder: 'Filter images...',
    });
    body.appendChild(search);
    const grid = el('div', { className: 'tm-picker-grid' });

    const paint = () => {
        grid.innerHTML = '';
        const q = (search.value || '').toLowerCase().trim();
        const list = usable.filter((i) => !q || i.base.toLowerCase().includes(q));
        list.slice(0, 300).forEach((i) => {
            const cell = el('div', { className: 'tm-picker-cell' });
            cell.appendChild(el('img', {
                src: resolveImageUrl('/data/images/types/' + i[side]),
                alt: i.base, loading: 'lazy',
                title: i.base,
                onclick: async () => {
                    try {
                        await assignTypeImage(state.selected, side, i[side]);
                        showToast('Set ' + side + ' image for ' + state.selected, 'success');
                        closeModal('modal-type-manager-image');
                        await _loadGroups();
                        _render();
                    } catch (err) {
                        console.error('[typeManager] assign failed:', err);
                        showToast('Failed to set the image', 'error');
                    }
                },
            }));
            grid.appendChild(cell);
        });
        if (!list.length) grid.appendChild(el('div', { className: 'tm-empty' }, 'No match.'));
    };
    search.addEventListener('input', paint);
    paint();
    body.appendChild(grid);

    createModal('modal-type-manager-image', 'Choose a ' + side + ' image', body, null);
}

async function _deleteType(coinType) {
    if (!coinType) return;
    if (!confirm('Delete the type "' + coinType + '"?\n\n' +
        'Coins mapped to it keep their rows, but they will no longer have a ' +
        'type image slot. This cannot be undone.')) {
        return;
    }
    try {
        await deleteTypeConfig(coinType);
        showToast('Deleted ' + coinType, 'success');
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
        el('label', { className: 'tm-label' }, 'Type name'), nameInput));
    body.appendChild(el('div', { className: 'tm-field' },
        el('label', { className: 'tm-label' }, 'Years'), rangeInput));
    body.appendChild(el('p', { className: 'tm-hint' },
        'The new type is created immediately and the years are moved to it. ' +
        'Set its images afterwards from the type list.'));

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
    }, 'Create type'));

    createModal('modal-type-manager-new', 'New coin type', body, footer);
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

let _listEl = null;
let _editorEl = null;

function _render() {
    if (_listEl) _renderList(_listEl);
    if (_editorEl) _renderEditor(_editorEl);
}

export async function openTypeManager() {
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    const body = el('div', { className: 'tm-body' });

    const toolbar = el('div', { className: 'tm-toolbar' });
    const search = el('input', {
        type: 'text', className: 'tm-search', id: 'tm-search',
        placeholder: 'Search coin types (e.g. Jefferson)...',
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
    }, '＋ New type'));
    body.appendChild(toolbar);

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

    createModal(MODAL_ID, 'Type & Image Manager', body, footer);

    await _loadGroups();
    _render();
    state.open = true;

    const searchEl = document.getElementById('tm-search');
    if (searchEl) searchEl.focus();
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
}
