/**
 * modals.js — Coin Catalog v2
 *
 * Clean modal state machine. Handles:
 * - openModal(id) / closeModal(id) / closeAllModals()
 * - Body scroll locking (modal-open class)
 * - Keyboard (Escape) and backdrop-click to close
 *
 * @module modals
 */

let openModalsStack = [];

/**
 * Open a modal by its ID.
 * @param {string} modalId - The DOM ID of the modal element.
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`[modals] Modal not found: ${modalId}`);
        return;
    }

    // If already open, ignore
    if (openModalsStack.includes(modalId)) return;

    modal.classList.add('open');
    openModalsStack.push(modalId);

    updateBodyScrollLock();
}

/**
 * Close a specific modal by its ID.
 * @param {string} modalId - The DOM ID of the modal element.
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('open');
    openModalsStack = openModalsStack.filter(id => id !== modalId);

    updateBodyScrollLock();
}

/**
 * Close the most recently opened modal (the one on top).
 */
export function closeTopModal() {
    if (openModalsStack.length === 0) return;
    const topId = openModalsStack[openModalsStack.length - 1];
    closeModal(topId);
}

/**
 * Close all currently open modals.
 */
export function closeAllModals() {
    openModalsStack.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('open');
    });
    openModalsStack = [];
    updateBodyScrollLock();
}

/**
 * Toggle body class to lock/unlock scrolling.
 */
function updateBodyScrollLock() {
    if (openModalsStack.length > 0) {
        document.body.classList.add('modal-open');
    } else {
        document.body.classList.remove('modal-open');
    }
}

// ============================================================
// Event Listeners (Global)
// ============================================================

// Close top modal on Escape key
window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openModalsStack.length > 0) {
        closeTopModal();
    }
});

// Close modal on backdrop click
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal(e.target.id);
    }
    
    // Also handle close buttons via delegation
    if (e.target.closest('[data-action="close-modal"]')) {
        closeAllModals();
    }
});

// Export to window for legacy inline handlers (if any)
window.closeModals = closeAllModals;
