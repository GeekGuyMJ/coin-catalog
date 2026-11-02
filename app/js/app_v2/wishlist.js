/**
 * wishlist.js — Coin Catalog v2
 *
 * Wishlist management: add, remove, mark acquired, and panel display.
 * Wires the existing 🎯 / "Wish List" buttons in coin rows (catalog.js + search.js).
 *
 * @module wishlist
 */

import { el, escHtml } from './utils.js';
import { showToast } from './notifications.js';
import { getWishlist, setWishlist } from './state.js';
import { fetchWishlist, addToWishlist, removeFromWishlist, updateWishlistItem } from './api.js';

// ============================================================
// Init — wire wishlist buttons across catalog and search results
// ============================================================

/**
 * Initialize wishlist module.
 * Fetches current wishlist from server, sets up global click delegation
 * for wishlist buttons, and exposes openWishlistPanel.
 */
export function initWishlist() {
    // Refresh wishlist state from server (non-blocking)
    refreshWishlistState();

    // Global click delegation — handles 🎯 buttons in both catalog rows
    // and search result rows without attaching per-row listeners.
    document.addEventListener('click', handleWishlistClick);
}

// ============================================================
// Click handler (delegated)
// ============================================================

async function handleWishlistClick(e) {
    const btn = e.target.closest('[data-action="add-wishlist"]');
    if (!btn) return;
    e.stopPropagation();
    e.preventDefault();

    const coinId = parseInt(btn.dataset.coinId, 10);
    if (!coinId) return;

    await toggleWishlist(coinId);
}

// ============================================================
// Toggle add/remove
// ============================================================

/**
 * Toggle wishlist status for a coin.
 * Updates server, refreshes local state, updates all matching buttons.
 *
 * @param {number} coinId
 */
export async function toggleWishlist(coinId) {
    // Lock scroll position
    const scrollY = window.scrollY;
    const catalogContainer = document.getElementById('catalog-container');
    const catalogTop = catalogContainer ? catalogContainer.getBoundingClientRect().top : 0;

    try {
        const wishlist = getWishlist() || [];
        const item = wishlist.find(w => w.coin_id === coinId);

        if (item) {
            await removeFromWishlist(coinId);
            showToast('Removed from wishlist', 'info');
        } else {
            await addToWishlist(coinId);
            showToast('Added to wishlist \u2764', 'success');
        }

        // Refresh state from server
        await refreshWishlistState();

        // Update ALL buttons for this coinId (catalog rows + search rows)
        updateWishlistButtons(coinId, !item);
    } catch (err) {
        showToast('Wishlist error: ' + err.message, 'error');
    }

    // Restore scroll position if shifted
    if (catalogContainer) {
        const newTop = catalogContainer.getBoundingClientRect().top;
        const delta = newTop - catalogTop;
        if (Math.abs(delta) > 0.5) {
            window.scrollBy(0, -delta);
        }
    } else if (Math.abs(window.scrollY - scrollY) > 0.5) {
        window.scrollTo(0, scrollY);
    }
}

// ============================================================
// Button state sync
// ============================================================

/**
 * Update all wishlist buttons for a given coin to reflect current state.
 *
 * @param {number} coinId
 * @param {boolean} isNowInWishlist - true if just added, false if just removed
 */
function updateWishlistButtons(coinId, isNowInWishlist) {
    const sel = '[data-action="add-wishlist"][data-coin-id="' + coinId + '"]';
    document.querySelectorAll(sel).forEach(btn => {
        btn.classList.toggle('is-wishlist', isNowInWishlist);
        btn.title = isNowInWishlist ? 'Remove from wishlist' : 'Add to wishlist';
        // Update text for pill-style buttons (catalog.js uses "Wish List" / heart)
        if (btn.classList.contains('pill')) {
            btn.textContent = isNowInWishlist ? '\u2764' : 'Wish List';
        }
    });
}

// ============================================================
// State refresh
// ============================================================

/**
 * Re-fetch wishlist from server and update local state.
 */
export async function refreshWishlistState() {
    try {
        const fresh = await fetchWishlist();
        setWishlist(fresh || []);
    } catch (e) {
        console.warn('[wishlist] Failed to refresh state:', e);
    }
}

// ============================================================
// Wishlist panel (modal overlay)
// ============================================================

/**
 * Open the wishlist panel — shows all wishlist items with options
 * to remove or mark acquired.
 */
export function openWishlistPanel() {
    const wishlist = getWishlist() || [];

    // Remove any existing panel
    const existing = document.getElementById('wishlist-panel');
    if (existing) existing.remove();

    const overlay = el('div', {
        id: 'wishlist-panel',
        className: 'modal-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Wishlist',
    });

    const box = el('div', { className: 'modal-box wide' });

    // --- Header ---
    const header = el('div', { className: 'modal-header' });
    header.appendChild(el('h2', { className: 'modal-title' }, '\uD83C\uDFAF Wishlist'));
    const closeBtn = el('button', {
        className: 'modal-close',
        'aria-label': 'Close',
        dataset: { action: 'close-modal' },
    }, '\u2715');
    header.appendChild(closeBtn);
    box.appendChild(header);

    // --- Body ---
    const body = el('div', { className: 'modal-body', style: 'padding:var(--space-4);' });

    if (!wishlist.length) {
        body.appendChild(el('div', {
            style: 'text-align:center;padding:3rem 1rem;color:var(--color-text-muted);',
        }, el('p', { style: 'font-size:1.2rem;margin-bottom:0.5rem;' }, 'Your wishlist is empty'),
            el('p', { style: 'font-size:0.9rem;' }, 'Tap the \uD83C\uDFAF button on any coin to add it here.')
        ));
    } else {
        const list = el('div', { className: 'wishlist-list' });

        wishlist.forEach(item => {
            const row = buildWishlistRow(item);
            list.appendChild(row);
        });

        body.appendChild(list);
    }

    box.appendChild(body);

    // --- Footer ---
    const footer = el('div', { className: 'modal-footer' });
    const count = el('span', {
        style: 'font-size:var(--font-size-sm);color:var(--color-text-muted);',
    }, wishlist.length + ' item' + (wishlist.length === 1 ? '' : 's'));
    footer.appendChild(count);

    const clearAllBtn = el('button', {
        className: 'btn-danger',
        style: 'display:' + (wishlist.length ? 'inline-flex' : 'none') + ';',
    }, 'Clear All');
    clearAllBtn.addEventListener('click', async () => {
        if (!confirm('Remove all items from your wishlist?')) return;
        try {
            for (const item of wishlist) {
                await removeFromWishlist(item.coin_id);
            }
            await refreshWishlistState();
            showToast('Wishlist cleared', 'info');
            openWishlistPanel(); // refresh panel
        } catch (err) {
            showToast('Failed to clear: ' + err.message, 'error');
        }
    });
    footer.appendChild(clearAllBtn);
    box.appendChild(footer);

    overlay.appendChild(box);

    // Close handlers
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.getElementById('modal-layer')?.appendChild(overlay);
    document.body.classList.add('modal-open');
    if (!window._openModalsStack) window._openModalsStack = [];
    window._openModalsStack.push('wishlist-panel');
}

// ============================================================
// Wishlist row builder
// ============================================================

/**
 * Build a single wishlist item row.
 * @param {Object} item - WishlistItem from API
 * @returns {HTMLElement}
 */
function buildWishlistRow(item) {
    const row = el('div', {
        className: 'wishlist-row',
        dataset: { coinId: String(item.coin_id), wishlistId: String(item.id) },
    });

    // --- Left: coin info ---
    const left = el('div', { className: 'wishlist-row-left' });

    const title = el('div', { className: 'wishlist-row-title' });
    // Build a readable title from available fields
    const titleText = item.description || ('Coin #' + item.coin_id);
    title.appendChild(document.createTextNode(titleText));

    if (item.target_grade) {
        title.appendChild(document.createTextNode(' '));
        title.appendChild(el('span', {
            className: 'badge',
            style: 'background:var(--color-accent);color:var(--color-bg-card);',
        }, 'Target: ' + escHtml(item.target_grade)));
    }

    left.appendChild(title);

    const meta = el('div', { className: 'wishlist-row-meta' });
    const metaParts = [];
    if (item.category) metaParts.push(escHtml(item.category));
    if (item.max_price) metaParts.push('Max: $' + Number(item.max_price).toFixed(2));
    if (item.date_added) metaParts.push('Added: ' + escHtml(item.date_added));
    meta.textContent = metaParts.join(' \u00b7 ');
    left.appendChild(meta);

    if (item.notes) {
        left.appendChild(el('div', {
            className: 'wishlist-row-notes',
            style: 'font-size:var(--font-size-xs);color:var(--color-text-muted);margin-top:2px;',
        }, escHtml(item.notes)));
    }

    row.appendChild(left);

    // --- Right: actions ---
    const actions = el('div', { className: 'wishlist-row-actions' });

    // Mark acquired toggle
    const acquiredBtn = el('button', {
        className: 'btn-secondary' + (item.acquired ? ' is-acquired' : ''),
        title: item.acquired ? 'Mark as not acquired' : 'Mark as acquired',
        style: 'font-size:var(--font-size-xs);padding:4px 10px;',
    }, item.acquired ? '\u2705 Acquired' : '\u2705 Acquire');

    acquiredBtn.addEventListener('click', async () => {
        try {
            const newAcquired = !item.acquired;
            await updateWishlistItem(item.id, { acquired: newAcquired });
            item.acquired = newAcquired;
            await refreshWishlistState();
            // Refresh the entire panel to reflect changes
            openWishlistPanel();
            showToast(newAcquired ? 'Marked as acquired! \u2705' : 'Marked as not acquired', 'success');
        } catch (err) {
            showToast('Update failed: ' + err.message, 'error');
        }
    });
    actions.appendChild(acquiredBtn);

    // Remove button
    const removeBtn = el('button', {
        className: 'btn-danger',
        style: 'font-size:var(--font-size-xs);padding:4px 10px;',
        title: 'Remove from wishlist',
    }, '\u2715');

    removeBtn.addEventListener('click', async () => {
        try {
            await removeFromWishlist(item.coin_id);
            await refreshWishlistState();
            // Update buttons in catalog/search
            updateWishlistButtons(item.coin_id, false);
            showToast('Removed from wishlist', 'info');
            // Refresh panel
            openWishlistPanel();
        } catch (err) {
            showToast('Remove failed: ' + err.message, 'error');
        }
    });
    actions.appendChild(removeBtn);

    row.appendChild(actions);

    // Acquired styling
    if (item.acquired) {
        row.classList.add('is-acquired');
        row.style.opacity = '0.65';
    }

    return row;
}
