/**
 * COIN + COLLECTABLE CATALOG V2 - MODULE: MODAL-CORE.JS
 * Core modal orchestrator - NO dependencies on other app modules
 * 
 * Provides:
 *  - registerModal, openModal, closeModal, dismissAllModals
 * 
 * @module modal-core
 */

// ============================================================
// NEW ORCHESTRATOR — used by cards.js, stories.js, info.js, modals.v2.js
// ============================================================

const activeModals = new Set();

function getBackdrop() {
    let backdrop = document.getElementById('modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'modal-backdrop';
        backdrop.className = 'modal-backdrop fade-out';
        backdrop.addEventListener('click', dismissAllModals);
        document.body.appendChild(backdrop);
    }
    return backdrop;
}

export function registerModal(modalId, element) {
    if (!element) return;
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-hidden', 'true');
    element.classList.add('modal-window-wrapper', 'is-dismissed');
}

export function openModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return console.error(`[modals] Target container #${modalId} not found.`);
    const backdrop = getBackdrop();
    backdrop.classList.remove('fade-out');
    backdrop.classList.add('fade-in');
    modalEl.classList.remove('is-dismissed');
    modalEl.setAttribute('aria-hidden', 'false');
    activeModals.add(modalId);
    document.body.style.overflow = 'hidden';
}

export function closeModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;
    modalEl.classList.add('is-dismissed');
    modalEl.setAttribute('aria-hidden', 'true');
    activeModals.delete(modalId);
    if (activeModals.size === 0) {
        const backdrop = document.getElementById('modal-backdrop');
        if (backdrop) {
            backdrop.classList.remove('fade-in');
            backdrop.classList.add('fade-out');
        }
        document.body.style.overflow = '';
    }
}

export function dismissAllModals() {
    activeModals.forEach(id => closeModal(id));
}