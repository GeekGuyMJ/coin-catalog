/**
 * investments.js — Coin Catalog v2
 * Other Investments dashboard card.
 *
 * Features (GGMJ-451):
 *  - Sizing parity with other dashboard cards (same .card / .dashboard-card padding)
 *  - Edit icon per entry (pencil) to update date and price without creating a new file
 *  - Per-entry sparkline (canvas) showing trend when value goes up
 *  - Card-total sparkline showing trend over time as items are added/removed/prices change
 *  - Total value in top right of card title (like other cards), not overlapping hamburger
 *  - Help icon (?) in circle on card title
 *  - Card resize handles (left/right edge handles)
 *
 * Data model (per entry):
 *   { id, name, category, total_value, purchase_price, as_of_date, created_at, updated_at }
 *
 * @module investments
 */

import { el, escHtml } from './utils.js';
import { showToast } from './notifications.js';
import {
    fetchInvestments, saveInvestment, deleteInvestment,
} from './api.js';

// ---------------------------------------------------------------------------
// Sparkline helper — shared between per-entry and card-total sparklines
// ---------------------------------------------------------------------------

/** Draw a compact sparkline on a canvas element. */
function drawSparkline(canvas, values, color, width, height) {
    if (!values || values.length < 2) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pad = 3;
    const w = width - pad * 2;
    const h = height - pad * 2;

    // Stroke line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    values.forEach((v, i) => {
        const x = pad + (i / (values.length - 1)) * w;
        const y = pad + h - ((v - min) / range) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under line (subtle)
    ctx.lineTo(pad + w, pad + h);
    ctx.lineTo(pad, pad + h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad, 0, pad + h);
    grad.addColorStop(0, color + '33');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    // Current value dot
    const lastX = pad + w;
    const lastY = pad + h - ((values[values.length - 1] - min) / range) * h;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

// ---------------------------------------------------------------------------
// History storage — per-entry and card-total sparkline history
// Keyed by investment id for per-entry, key 'total' for card-total
// ---------------------------------------------------------------------------

const _entryHistory = {};   // id -> Array<{t:number, v:number}>
let _totalHistory = [];     // Array<{t:number, v:number}>
const MAX_HISTORY = 40;

function _now() { return Date.now(); }

function _addHistoryPoint(history, value, max) {
    history.push({ t: _now(), v: value });
    if (history.length > max) history.splice(0, history.length - max);
}

function _saveHistory() {
    try {
        const payload = {
            entryHistory: _entryHistory,
            totalHistory: _totalHistory,
        };
        localStorage.setItem('cc-investment-history', JSON.stringify(payload));
    } catch (e) { /* ignore */ }
}

function _loadHistory() {
    try {
        const raw = localStorage.getItem('cc-investment-history');
        if (!raw) return;
        const payload = JSON.parse(raw);
        Object.assign(_entryHistory, payload.entryHistory || {});
        _totalHistory = payload.totalHistory || [];
    } catch (e) { /* ignore */ }
}

_loadHistory();

// ---------------------------------------------------------------------------
// Help icon (question mark in circle) — shared helper
// ---------------------------------------------------------------------------

/** Create a small "?" in a circle help button. Clicking opens a popup. */
function makeHelpIcon(cardKey, helpText) {
    const btn = el('button', {
        className: 'help-icon',
        type: 'button',
        'aria-label': 'Help',
        title: helpText,
        style: 'width:20px;height:20px;border-radius:50%;border:1px solid var(--color-border);background:var(--color-bg-card);color:var(--color-text-main);font-size:0.68rem;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-left:8px;',
    }, '?');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        openHelpPopup(cardKey, helpText);
    });

    return btn;
}

/** Open a small popup explaining the card. */
function openHelpPopup(cardKey, helpText) {
    // Remove any existing help popup for this card
    const existing = document.getElementById('help-popup-' + cardKey);
    if (existing) existing.remove();

    const overlay = el('div', {
        id: 'help-popup-' + cardKey,
        className: 'help-popup-overlay',
        style: 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;',
    });

    const box = el('div', {
        style: 'background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-5);max-width:360px;width:88vw;box-shadow:var(--shadow-xl);position:relative;',
    });

    const closeBtn = el('button', {
        className: 'modal-close',
        style: 'position:absolute;top:var(--space-2);right:var(--space-2);background:none;border:none;color:var(--color-text-muted);font-size:1.5rem;cursor:pointer;',
        'aria-label': 'Close',
    }, '✕');

    const title = el('h3', {
        style: 'margin:0 0 var(--space-3) 0;color:var(--color-accent);font-size:var(--font-size-lg);',
    }, cardKey === 'investments' ? 'Other Investments' : cardKey);

    const body = el('div', {
        style: 'font-size:var(--font-size-sm);color:var(--color-text-main);line-height:1.5;',
    }, helpText);

    const okBtn = el('button', {
        className: 'btn-secondary',
        style: 'margin-top:var(--space-3);padding:4px 12px;float:right;',
    }, 'Got it');

    okBtn.addEventListener('click', () => overlay.remove());
    closeBtn.addEventListener('click', () => overlay.remove());

    box.appendChild(closeBtn);
    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(okBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// ---------------------------------------------------------------------------
// Money formatter
// ---------------------------------------------------------------------------

function fmtMoney(v) {
    return '$' + (v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Main card builder
// ---------------------------------------------------------------------------

let _invEntries = [];   // current entries, loaded from server

/**
 * Build the "Other Investments" dashboard card.
 * Returns a DOM element or null.
 */
export function buildInvestmentsCard() {
    const card = el('div', { className: 'card dashboard-card', id: 'card-investments' });

    // --- Card title with total in top-right + help icon ---
    const titleBar = el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:8px;',
    });

    const titleLabel = el('div', { className: 'card-title' }, 'Other Investments');
    const helpIcon = makeHelpIcon('investments',
        'Track investments outside your coin collection (stocks, ETFs, retirement accounts, crypto, etc.). ' +
        'Add entries with name, category, current value, optional purchase price, and as-of date. ' +
        'Click the pencil icon on any entry to edit its date or value. ' +
        'Each entry and the card total show a sparkline trend when values change.');
    titleBar.appendChild(titleLabel);
    titleBar.appendChild(helpIcon);

    // Top-right total
    const totalDisplay = el('div', {
        style: 'font-size:0.85em;font-weight:700;color:var(--color-accent);white-space:nowrap;',
    }, fmtMoney(0));
    titleBar.appendChild(totalDisplay);

    card.appendChild(titleBar);

    // --- Entry list ---
    const listWrap = el('div', { className: 'inv-list', style: 'display:flex;flex-direction:column;gap:6px;' });

    // --- Total row (card-total sparkline below total) ---
    const totalRow = el('div', {
        className: 'finance-item grand-total',
        style: 'margin-top:8px;display:flex;flex-direction:column;gap:4px;',
    });

    const totalLabel = el('span', { className: 'finance-label' }, 'Total');
    const totalValue = el('span', { className: 'finance-value bold' }, fmtMoney(0));

    const totalSparkWrap = el('div', {
        style: 'display:flex;align-items:center;gap:8px;font-size:0.75em;color:var(--color-text-muted);',
    });
    const totalSparkCanvas = el('canvas', {
        className: 'investment-sparkline',
        width: 140,
        height: 24,
        style: 'flex-shrink:0;background:color-mix(in srgb, var(--color-bg-body) 40%, transparent);border-radius:4px;',
        title: 'Card total trend',
    });

    totalRow.appendChild(totalLabel);
    totalRow.appendChild(totalValue);
    totalRow.appendChild(totalSparkWrap);
    totalSparkWrap.appendChild(el('span', {}, 'Trend:'));
    totalSparkWrap.appendChild(totalSparkCanvas);

    card.appendChild(listWrap);
    card.appendChild(totalRow);

    // --- Entry form (V1 style) ---
    const form = el('div', { className: 'v1-form' });
    const nameIn = el('input', {
        className: 'v1-input', type: 'text', placeholder: 'Name (e.g. Fidelity 401k)',
    });
    const catSelect = el('select', { className: 'v1-select' });
    ['Stocks', 'ETFs / Funds', 'Retirement', 'Crypto', 'Bonds / CDs', 'Other'].forEach((c) => {
        catSelect.appendChild(el('option', { value: c }, c));
    });
    const valIn = el('input', {
        className: 'v1-input', type: 'number', placeholder: 'Current value', step: '0.01', min: '0',
    });
    const costIn = el('input', {
        className: 'v1-input', type: 'number', placeholder: 'Purchase price (optional)', step: '0.01', min: '0',
    });
    const dateIn = el('input', { className: 'v1-input', type: 'date' });
    const addBtn = el('button', { className: 'v1-add-btn' }, '+ Add');

    addBtn.addEventListener('click', () => {
        const v = parseFloat(valIn.value);
        if (!nameIn.value.trim() || isNaN(v)) {
            showToast('Enter a name and value', 'error');
            return;
        }
        const cost = costIn.value === '' ? null : parseFloat(costIn.value);
        saveInvestment({
            name: nameIn.value.trim(),
            category: catSelect.value,
            total_value: v,
            purchase_price: cost,
            as_of_date: dateIn.value || '',
        }).then((saved) => {
            _invEntries = _invEntries || [];
            _invEntries.push(saved);
            render();
            nameIn.value = ''; valIn.value = ''; costIn.value = ''; dateIn.value = '';
            showToast('Other Investments added', 'success');
        }).catch((err) => {
            showToast('Failed to save: ' + err.message, 'error');
        });
    });

    [nameIn, catSelect, valIn, costIn, dateIn].forEach((w) => form.appendChild(w));
    form.appendChild(addBtn);

    card.appendChild(form);

    // --- Resize handles (left + right edges) ---
    const edgeRight = el('div', {
        className: 'edge-handle edge-handle-right',
        title: 'Drag to resize width',
    });
    const edgeLeft = el('div', {
        className: 'edge-handle edge-handle-left',
        title: 'Drag to resize width',
    });

    // --- Drag handle (hamburger, top-right corner) ---
    const dragHandle = el('div', {
        className: 'drag-handle',
        draggable: true,
        title: 'Drag to reorder',
        style: 'position:absolute;top:var(--space-4);right:var(--space-4);font-size:1.5rem;color:var(--color-text-muted);cursor:grab;user-select:none;opacity:0.5;z-index:3;',
    }, '≡');

    card.appendChild(edgeRight);
    card.appendChild(edgeLeft);
    card.appendChild(dragHandle);

    // --- Render function ---
    function render() {
        listWrap.textContent = '';
        if (!_invEntries || !_invEntries.length) {
            listWrap.appendChild(el('div', {
                className: 'dashboard-detail',
                style: 'text-align:center;padding:10px 0;',
            }, 'No Other Investments yet'));
        } else {
            _invEntries.forEach((e) => {
                const row = el('div', {
                    className: 'finance-item',
                    style: 'flex-wrap:wrap;gap:4px;align-items:center;',
                });

                // Left: info (name + category/date)
                const info = el('div', { style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;' });
                const label = el('span', {
                    className: 'finance-label',
                    title: e.category,
                }, escHtml(e.category || 'Stocks') + (e.as_of_date ? ' · ' + e.as_of_date : ''));
                const nameDiv = el('div', {
                    style: 'font-weight:600;overflow-wrap:anywhere;',
                }, escHtml(e.name || 'Unnamed'));
                info.appendChild(label);
                info.appendChild(nameDiv);

                // Per-entry edit icon (pencil)
                const editBtn = el('button', {
                    className: 'btn-icon',
                    title: 'Edit entry',
                    'aria-label': 'Edit investment',
                    style: 'padding:var(--space-1);border-radius:var(--radius-sm);',
                }, '✏️');
                editBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    openEditDialog(e);
                });

                // Per-entry sparkline (canvas)
                const sparkWrap = el('div', {
                    style: 'display:flex;align-items:center;gap:6px;flex-shrink:0;',
                });
                const sparkCanvas = el('canvas', {
                    className: 'investment-sparkline',
                    width: 100,
                    height: 20,
                    style: 'flex-shrink:0;background:color-mix(in srgb, var(--color-bg-body) 40%, transparent);border-radius:4px;',
                    title: 'Entry value trend',
                });

                // Right: value + change + sparkline
                const right = el('div', {
                    style: 'display:flex;align-items:center;gap:8px;flex-shrink:0;',
                });

                const valBox = el('div', { style: 'text-align:right;' });
                valBox.appendChild(el('span', { className: 'finance-value' }, fmtMoney(e.total_value)));
                const gain = (e.total_value || 0) - (e.purchase_price || 0);
                if (e.purchase_price != null && e.purchase_price !== '') {
                    const up = gain >= 0;
                    valBox.appendChild(el('div', {
                        style: 'font-size:0.72em;color:' + (up ? 'var(--color-accent)' : 'var(--color-text-muted)') + ';',
                    }, ((gain > 0 ? '+' : gain < 0 ? '−' : '')) + fmtMoney(Math.abs(gain))));
                }

                right.appendChild(valBox);
                right.appendChild(editBtn);
                right.appendChild(sparkWrap);
                sparkWrap.appendChild(sparkCanvas);

                // Remove button
                const del = el('button', {
                    className: 'btn-secondary',
                    title: 'Remove',
                    style: 'padding:2px 8px;font-size:0.8em;margin-left:6px;',
                }, '✕');
                del.addEventListener('click', () => {
                    deleteInvestment(e.id).then(() => {
                        _invEntries = _invEntries.filter((x) => x.id !== e.id);
                        render();
                        refreshTotal();
                    }).catch((err) => {
                        showToast('Failed to delete: ' + err.message, 'error');
                    });
                });
                right.appendChild(del);

                row.appendChild(info);
                row.appendChild(right);
                listWrap.appendChild(row);

                // Draw per-entry sparkline after DOM insertion
                requestAnimationFrame(() => {
                    const hist = _entryHistory[e.id] || [];
                    const vals = hist.map((h) => h.v);
                    if (vals.length >= 2) {
                        drawSparkline(sparkCanvas, vals, 'var(--color-accent)', 100, 20);
                    }
                });
            });
        }
        refreshTotal();
    }

    function refreshTotal() {
        const total = (_invEntries || []).reduce((sum, e) => sum + (e.total_value || 0), 0);
        totalValue.textContent = fmtMoney(total);
        totalDisplay.textContent = fmtMoney(total);

        // Record total history point
        _addHistoryPoint(_totalHistory, total, MAX_HISTORY);
        _saveHistory();

        // Draw card-total sparkline
        requestAnimationFrame(() => {
            const vals = _totalHistory.map((h) => h.v);
            if (vals.length >= 2) {
                drawSparkline(totalSparkCanvas, vals, 'var(--color-accent)', 140, 24);
            }
        });
    }

    // --- Edit dialog ---
    function openEditDialog(entry) {
        const existing = document.getElementById('investment-edit-dialog');
        if (existing) existing.remove();

        const overlay = el('div', {
            id: 'investment-edit-dialog',
            className: 'modal-overlay',
            style: 'display:flex;',
        });

        const box = el('div', {
            className: 'modal-box',
            style: 'max-width:420px;',
        });

        const header = el('div', { className: 'modal-header' });
        header.appendChild(el('h2', { className: 'modal-title' }, 'Edit Investment'));
        header.appendChild(el('button', {
            className: 'modal-close',
            'aria-label': 'Close',
            dataset: { action: 'close-modal' },
        }, '✕'));

        const body = el('div', { className: 'modal-body', style: 'display:flex;flex-direction:column;gap:var(--space-3);' });

        const nameInput = el('input', {
            className: 'form-input',
            type: 'text',
            value: entry.name || '',
            placeholder: 'Name',
        });
        const catInput = el('select', { className: 'form-input' });
        ['Stocks', 'ETFs / Funds', 'Retirement', 'Crypto', 'Bonds / CDs', 'Other'].forEach((c) => {
            catInput.appendChild(el('option', { value: c, selected: c === (entry.category || 'Other') }, c));
        });
        const valInput = el('input', {
            className: 'form-input',
            type: 'number',
            value: entry.total_value || '',
            step: '0.01',
            min: '0',
            placeholder: 'Current value',
        });
        const costInput = el('input', {
            className: 'form-input',
            type: 'number',
            value: entry.purchase_price || '',
            step: '0.01',
            min: '0',
            placeholder: 'Purchase price (optional)',
        });
        const dateInput = el('input', {
            className: 'form-input',
            type: 'date',
            value: entry.as_of_date || '',
        });

        body.appendChild(el('label', {}, 'Name'));
        body.appendChild(nameInput);
        body.appendChild(el('label', {}, 'Category'));
        body.appendChild(catInput);
        body.appendChild(el('label', {}, 'Current value ($)'));
        body.appendChild(valInput);
        body.appendChild(el('label', {}, 'Purchase price ($)'));
        body.appendChild(costInput);
        body.appendChild(el('label', {}, 'As-of date'));
        body.appendChild(dateInput);

        const footer = el('div', { className: 'modal-footer' });
        const cancelBtn = el('button', { className: 'btn-secondary', dataset: { action: 'close-modal' } }, 'Cancel');
        const saveBtn = el('button', { className: 'btn-primary' }, 'Save');

        saveBtn.addEventListener('click', () => {
            const v = parseFloat(valInput.value);
            if (!nameInput.value.trim() || isNaN(v)) {
                showToast('Enter a name and value', 'error');
                return;
            }
            const cost = costInput.value === '' ? null : parseFloat(costInput.value);
            saveInvestment({
                id: entry.id,
                name: nameInput.value.trim(),
                category: catInput.value,
                total_value: v,
                purchase_price: cost,
                as_of_date: dateInput.value || '',
            }).then((saved) => {
                const idx = _invEntries.findIndex((x) => x.id === entry.id);
                if (idx >= 0) _invEntries[idx] = saved;
                // Record history point for the edited entry
                _addHistoryPoint(_entryHistory[entry.id] = _entryHistory[entry.id] || [], v, MAX_HISTORY);
                _saveHistory();
                render();
                showToast('Investment updated', 'success');
                closeModal();
            }).catch((err) => {
                showToast('Failed to save: ' + err.message, 'error');
            });
        });

        cancelBtn.addEventListener('click', closeModal);
        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);

        box.appendChild(header);
        box.appendChild(body);
        box.appendChild(footer);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        overlay.classList.add('open');

        function closeModal() {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 200);
        }

        // Close on Escape or overlay click
        const escHandler = (e2) => { if (e2.key === 'Escape') closeModal(); };
        document.addEventListener('keydown', escHandler);
        overlay.addEventListener('click', (e2) => {
            if (e2.target === overlay) closeModal();
        });
        // Clean up listener after close
        const origClose = closeModal;
        closeModal = () => {
            document.removeEventListener('keydown', escHandler);
            origClose();
        };
    }

    // --- Resize handle logic ---
    function initResizeHandles() {
        let active = null;
        let startX = 0;
        let startWidth = 0;

        const onMove = (e) => {
            if (!active) return;
            const dx = e.clientX - startX;
            if (active === 'right') {
                card.style.width = Math.max(200, startWidth + dx) + 'px';
            } else if (active === 'left') {
                const newW = Math.max(200, startWidth - dx);
                card.style.width = newW + 'px';
                card.style.marginLeft = dx + 'px';
            }
        };

        const onUp = () => {
            active = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        edgeRight.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            active = 'right';
            startX = e.clientX;
            startWidth = card.offsetWidth;
            card.style.transition = 'none';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        edgeLeft.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            active = 'left';
            startX = e.clientX;
            startWidth = card.offsetWidth;
            card.style.transition = 'none';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // Restore transition after drag
        card.addEventListener('mouseup', () => {
            if (!active) {
                card.style.transition = '';
            }
        });
    }

    // Load entries from server
    fetchInvestments().then((entries) => {
        _invEntries = entries || [];
        // Initialize history for each entry
        _invEntries.forEach((e) => {
            _entryHistory[e.id] = _entryHistory[e.id] || [];
            if (_entryHistory[e.id].length === 0) {
                _addHistoryPoint(_entryHistory[e.id], e.total_value, MAX_HISTORY);
            }
        });
        _saveHistory();
        render();
        initResizeHandles();
    }).catch(() => {
        _invEntries = [];
        render();
        initResizeHandles();
    });

    return card;
}
