/**
 * notifications.js — Coin Catalog v2
 *
 * Toast notification system. Kept in its own module so any module
 * can import showToast without creating circular dependencies.
 *
 * @module notifications
 */

/**
 * Show a temporary toast notification at the bottom-right of the screen.
 *
 * @param {string} message - Text to display.
 * @param {'success'|'error'|'info'|'warning'} [type='info']
 * @param {number} [duration=3000] - Auto-dismiss delay in ms.
 */
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('[toast]', message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    container.appendChild(toast);

    // Force reflow so the CSS transition fires correctly
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}
