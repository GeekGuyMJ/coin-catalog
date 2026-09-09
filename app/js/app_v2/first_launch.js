/**
 * first_launch.js — first-launch popup + tour trigger + info-menu hook
 */

import { startTour, GUIDE_STORAGE_KEY } from './guide.js';

// ============================================================
// First-launch popup (logo coin + Start Tour + don't-show + close)
// ============================================================
function buildPopup() {
    if (document.getElementById('guide-popup-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'guide-popup-overlay';
    overlay.className = 'guide-popup-overlay';

    const popup = document.createElement('div');
    popup.className = 'guide-popup';

    const logo = document.createElement('img');
    logo.className = 'guide-popup-logo';
    logo.alt = 'Coin & Collectible Catalog';
    // Reuse the header logo coin if present; otherwise fall back to the app icon.
    const headerLogo = document.getElementById('header-coin-img');
    if (headerLogo && headerLogo.src) {
        logo.src = headerLogo.src;
    } else {
        logo.src = '/icons/icon-192.png';
    }

    const title = document.createElement('h2');
    title.className = 'guide-popup-title';
    title.textContent = 'Welcome to Coin & Collectible Catalog!';

    const body = document.createElement('p');
    body.className = 'guide-popup-body';
    body.textContent = 'Take the Tour to see how to track your collection, browse the catalog, use the album view, and customize everything.';

    const checkboxLabel = document.createElement('label');
    checkboxLabel.className = 'guide-popup-checkbox';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'guide-popup-dont-show';
    const checkboxText = document.createElement('span');
    checkboxText.textContent = "Don't show this again";
    checkboxLabel.appendChild(checkbox);
    checkboxLabel.appendChild(checkboxText);

    const actions = document.createElement('div');
    actions.className = 'guide-popup-actions';

    const startBtn = document.createElement('button');
    startBtn.className = 'guide-popup-btn guide-popup-btn-primary';
    startBtn.textContent = 'Start Tour';
    startBtn.addEventListener('click', () => {
        closePopup();
        startTour();
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'guide-popup-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closePopup);

    actions.appendChild(startBtn);
    actions.appendChild(closeBtn);

    const note = document.createElement('p');
    note.className = 'guide-popup-note';
    note.textContent = 'You can take the tour anytime from the info menu (\u24d8).';

    popup.appendChild(logo);
    popup.appendChild(title);
    popup.appendChild(body);
    popup.appendChild(checkboxLabel);
    popup.appendChild(actions);
    popup.appendChild(note);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePopup();
    });

    function closePopup() {
        overlay.classList.remove('is-active');
        if (checkbox.checked) {
            localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
        }
    }
}

function showPopup() {
    buildPopup();
    const overlay = document.getElementById('guide-popup-overlay');
    if (overlay) overlay.classList.add('is-active');
}

// ============================================================
// Info-menu hook: add a "Take the Tour"/"User Guide" item
// ============================================================
function addInfoMenuEntry() {
    const tryAdd = () => {
        const dropdown = document.getElementById('info-dropdown');
        if (!dropdown) return;
        if (dropdown.querySelector('.guide-link')) return;

        const item = document.createElement('div');
        item.className = 'info-dropdown-item guide-link';
        item.textContent = '\u2728 Take the Tour';
        item.addEventListener('click', () => {
            dropdown.classList.remove('open');
            startTour();
        });

        dropdown.appendChild(item);
    };

    // Info dropdown may be built later; retry a few times.
    let attempts = 0;
    const interval = setInterval(() => {
        tryAdd();
        attempts++;
        if (attempts > 20) clearInterval(interval);
    }, 500);
}

// ============================================================
// Init — run after splash is gone
// ============================================================
export function initFirstLaunch() {
    // Wire the info-menu entry regardless of dismissed state.
    addInfoMenuEntry();

    // Only auto-show the popup if not dismissed.
    if (localStorage.getItem(GUIDE_STORAGE_KEY) === 'true') return;

    // Wait for splash to clear, then show popup.
    const wait = () => {
        const splash = document.getElementById('app-splash');
        if (splash && !splash.classList.contains('hidden')) {
            setTimeout(wait, 300);
            return;
        }
        setTimeout(showPopup, 400);
    };
    setTimeout(wait, 300);
}