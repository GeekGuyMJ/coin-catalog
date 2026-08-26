/**
 * userCoins.js — "Add Coin" for coins the master catalogue lacks.
 *
 * Use cases:
 *  - A new year passes and the shipped catalogue has no entry for it yet
 *    (e.g. next year's quarters/dimes).
 *  - A year has multiple different designs (state/ATB/park quarters,
 *  - commemoratives) — add one entry per design.
 *  - The user owns a coin the catalogue simply doesn't list.
 *
 * A user coin is a REAL catalogue row (coins_reference / coin_reference)
 * flagged user_added=true, so it sorts in order with its type (type → year →
 * mint), counts toward section totals/completion, can be owned, wishlisted,
 * given images, published — everything a seeded coin can do. Only user_added
 * rows can be deleted.
 *
 * Persistence: self-hosted → POST/DELETE /api/user_coins (server DB, syncs to
 * every device via the fetchCoinsForSection pull). Public → IndexedDB via the
 * api.js interceptor.
 *
 * Entry point: openAddCoinModal(sectionName?) — opened from the Settings →
 * Catalog tab. If no section is passed, the modal shows a section picker so
 * the user can choose where the coin belongs.
 */
import { el } from './utils.js';
import { addUserCoin, deleteUserCoin } from './api.js';
import { getSections } from './state.js';
import { showToast } from './notifications.js';

let _modals = null;
async function modals() {
    if (!_modals) _modals = await import('./modals.js');
    return _modals;
}

const MINTS = [
    { mark: 'P', label: 'P — Philadelphia' },
    { mark: 'D', label: 'D — Denver' },
    { mark: 'S', label: 'S — San Francisco' },
    { mark: 'W', label: 'W — West Point' },
    { mark: '', label: 'No mint mark' },
];

/**
 * Open the Add Coin modal.
 * @param {string} [sectionName] full section name (e.g. "US Coinage — Quarter
 *   Dollar"). If omitted, the modal shows a section picker so the user chooses.
 */
export async function openAddCoinModal(sectionName) {
    const m = await modals();
    const sections = getSections();
    const maxYear = new Date().getFullYear() + 1;

    // ---------- form state ----------
    let mode = 'existing'; // 'existing' | 'newtype'
    let selectedType = null;

    const bodyWrap = el('div', { style: 'padding: var(--space-2) 0;' });

    bodyWrap.appendChild(el('p', {
        style: 'font-size: var(--font-size-xs); color: var(--color-text-muted); line-height:1.5; margin-bottom: var(--space-2);'
    }, 'Add a coin the catalogue is missing — a brand-new year, an extra design (state/ATB/park quarters), or something unlisted. It becomes a real, sortable catalogue entry. Pick the section it belongs to first.'));

    // ---------- section picker (only when no fixed section) ----------
    let sectionSel = null;
    if (!sectionName) {
        bodyWrap.appendChild(el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);margin-bottom:4px;' }, 'Section'));
        sectionSel = el('select', { className: 'v1-select', style: 'width:100%;margin-bottom:var(--space-2);' },
            el('option', { value: '' }, '-- Choose section --'),
            ...sections.map(s => el('option', { value: s.section }, s.section)));
        bodyWrap.appendChild(sectionSel);
    } else {
        bodyWrap.appendChild(el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);margin-bottom:4px;' }, 'Section'));
        bodyWrap.appendChild(el('div', {
            style: 'font-weight:700;margin-bottom:var(--space-3);color:var(--color-accent);'
        }, sectionName));
    }

    const currentTypes = () => {
        const sn = sectionName || (sectionSel && sectionSel.value) || '';
        const sm = sections.find(s => s.section === sn);
        return sm ? (sm.types || []) : [];
    };

    // ---------- type chooser (dynamic per section) ----------
    bodyWrap.appendChild(el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);margin-bottom:4px;' }, 'Type'));

    const typeRow = el('div', { style: 'display:flex;gap:var(--space-2);margin-bottom:var(--space-2);' });
    const typeSel = el('select', { className: 'v1-select', style: 'flex:1;' },
        el('option', { value: '' }, '-- Choose type --'));
    const newTypeToggle = el('button', { className: 'btn-secondary', style: 'white-space:nowrap;font-size:0.82em;' }, '+ New type');
    typeRow.append(typeSel, newTypeToggle);
    bodyWrap.appendChild(typeRow);

    const repopulateTypes = () => {
        const keep = typeSel.value;
        typeSel.innerHTML = '';
        typeSel.appendChild(el('option', { value: '' }, '-- Choose type --'));
        currentTypes().forEach(t => typeSel.appendChild(el('option', { value: t }, t)));
        if ([...typeSel.options].some(o => o.value === keep)) typeSel.value = keep;
    };
    repopulateTypes();
    if (sectionSel) sectionSel.addEventListener('change', repopulateTypes);

    const newTypeRow = el('div', { style: 'display:none;margin-bottom:var(--space-2);' });
    const newTypeIn = el('input', { className: 'v1-input', placeholder: 'e.g. American Women Quarter', style: 'width:100%;' });
    newTypeRow.appendChild(newTypeIn);
    bodyWrap.appendChild(newTypeRow);

    typeSel.addEventListener('change', () => { mode = 'existing'; selectedType = typeSel.value || null; newTypeIn.value = ''; });
    newTypeIn.addEventListener('input', () => { if (newTypeIn.value.trim()) { mode = 'newtype'; typeSel.value = ''; selectedType = null; } });
    newTypeToggle.addEventListener('click', () => {
        mode = 'newtype'; typeSel.value = ''; selectedType = null;
        newTypeRow.style.display = '';
        newTypeIn.focus();
    });

    // ---------- year + mint ----------
    const ymRow = el('div', { style: 'display:flex;gap:var(--space-2);margin-bottom:var(--space-2);' });
    const yearIn = el('input', { className: 'v1-input', type: 'number', min: '1792', max: String(maxYear), step: '1', placeholder: 'Year (e.g. ' + maxYear + ')', style: 'flex:1;' });
    const mintSel = el('select', { className: 'v1-select' }, ...MINTS.map(mk => el('option', { value: mk.mark }, mk.label)));
    ymRow.append(yearIn, mintSel);
    bodyWrap.appendChild(ymRow);

    // ---------- multi-mint helper ----------
    const multiRow = el('label', { style: 'display:flex;align-items:center;gap:8px;font-size:0.85em;margin-bottom:var(--space-2);cursor:pointer;' });
    const multiChk = el('input', { type: 'checkbox', style: 'width:16px;height:16px;' });
    multiRow.append(multiChk, el('span', {}, 'Also add other mints of the same design (P/D/S/W where missing)'));
    bodyWrap.appendChild(multiRow);

    // ---------- optional notes ----------
    const optRow = el('div', { style: 'display:flex;gap:var(--space-2);margin-bottom:var(--space-2);' });
    const notesIn = el('input', { className: 'v1-input', placeholder: 'Notes (optional) — e.g. design name', style: 'flex:1;' });
    optRow.appendChild(notesIn);
    bodyWrap.appendChild(optRow);

    const resultBox = el('div', {});

    // ---------- submit ----------
    let running = false;
    const btnAdd = el('button', { className: 'btn-primary' }, 'Add Coin');
    const btnCancel = el('button', { className: 'btn-secondary' }, 'Cancel');
    btnCancel.addEventListener('click', () => m.closeModal('modal-add-user-coin'));
    const footer = el('div', { style: 'display:flex;gap:var(--space-2);justify-content:flex-end;' }, btnCancel, btnAdd);

    btnAdd.addEventListener('click', async () => {
        if (running) return;
        const secName = sectionName || (sectionSel && sectionSel.value) || '';
        if (!secName) { showToast('Choose a section first', 'error', 3000); return; }

        const coinType = mode === 'newtype'
            ? (newTypeIn.value || '').trim()
            : (typeSel.value || '').trim();
        const yearVal = parseInt(yearIn.value, 10);
        if (!coinType) { showToast('Choose or enter a type first', 'error', 3000); return; }
        if (!yearVal || yearVal < 1792 || String(yearVal).length !== 4) { showToast('Enter a valid 4-digit year', 'error', 3000); return; }

        running = true;
        btnAdd.disabled = true;
        btnAdd.textContent = 'Adding…';
        resultBox.innerHTML = '';

        const baseMint = mintSel.value;
        const mintsToAdd = multiChk.checked
            ? MINTS.map(mk => mk.mark).filter(mk => mk !== baseMint)
            : [];

        try {
            const created = [];
            await addUserCoin({
                section: secName,
                coin_type: coinType,
                year: yearVal,
                mint_mark: baseMint,
                ref_notes: (notesIn.value || '').trim(),
            }).then(r => created.push(r));

            for (const mk of mintsToAdd) {
                try {
                    await addUserCoin({
                        section: secName,
                        coin_type: coinType,
                        year: yearVal,
                        mint_mark: mk,
                        ref_notes: (notesIn.value || '').trim(),
                    }).then(r => created.push(r));
                } catch (e) { /* duplicate mint — skip */ }
            }

            showToast(created.length + ' coin' + (created.length !== 1 ? 's' : '') + ' added to ' + secName, 'success', 3000);
            resultBox.appendChild(el('p', { style: 'color: var(--color-success, #2e7d32); font-weight:600;' },
                `✓ Added ${created.length} coin${created.length !== 1 ? 's' : ''}. They now appear in the list in year order.`));

            // Refresh the open section so the new coins show immediately
            await refreshOpenSection(secName);

            // Close the modal so the user sees the updated list (and can delete if needed)
            m.closeModal('modal-add-user-coin');

            btnAdd.textContent = 'Add Another';
            btnAdd.disabled = false;
            running = false;
            yearIn.value = '';
        } catch (err) {
            resultBox.appendChild(el('p', { style: 'color: var(--color-danger, #c62828);' }, 'Error: ' + (err.message || err)));
            btnAdd.textContent = 'Try Again';
            btnAdd.disabled = false;
            running = false;
        }
    });

    m.createModal('modal-add-user-coin', '＋ Add Coin to Catalogue', bodyWrap, footer);
}

/** Re-fetch and re-render a section so added coins appear immediately. */
export async function refreshOpenSection(sectionName) {
    const catalog = await import('./catalog.js');
    if (typeof catalog.reloadSectionCoins === 'function') {
        await catalog.reloadSectionCoins(sectionName).catch(e => console.warn('[userCoins] refresh skipped:', e.message));
    }
}
