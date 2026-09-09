/**
 * guide.js — Coin Catalog v2 spotlight guided tour
 *
 * Walks a first-time user through the app's key features using a
 * spotlight highlight + bubble, one element at a time. Relaunchable
 * from the info menu. "Don't show again" persists to localStorage.
 */

export const GUIDE_STORAGE_KEY = 'cc-guide-dismissed';

// ============================================================
// Tour steps — each highlights a real, live element by selector.
// `before` is an optional async hook run before the step is shown
// (e.g. expand a section so its button is visible).
// ============================================================
const TOUR_STEPS = [
    {
        selector: '#card-portfolio',
        placement: 'below',
        title: 'Your Portfolio Overview',
        body: 'This is your collection at a glance — total value, metal melt values, and a sparkline of how it has changed over time. Everything you add elsewhere shows up here.',
        before: async () => { scrollToSelector('#card-portfolio'); }
    },
    {
        selector: '#dashboard-grid',
        placement: 'below',
        title: 'Your Dashboard Cards',
        body: 'These cards summarize your whole collection. Drag any card by its ☰ handle to rearrange it, or drag its edges to resize. You can also hide cards you don\u2019t use from Settings.',
        before: async () => { scrollToSelector('#dashboard-grid'); }
    },
    {
        selector: '#catalog-container',
        placement: 'below',
        title: 'Browse the Catalog',
        body: 'This is the full coin catalog — organized by country and denomination. Click a group to expand it, then click any section to see the coins inside, with photos and mint details.',
        before: async () => { scrollToSelector('#catalog-container'); }
    },
    {
        selector: '.folder-view-toggle',
        placement: 'below',
        title: 'List & Album Views',
        body: 'This switches between \u201c\u2610 List\u201d and \u201c Album\u201d views. We\u2019ve already switched to Album so you can see it — coins appear in neat slots like a real collection book. Tap it to compare!',
        before: async () => {
            // Ensure a US/Canada group is expanded so the toggle is visible,
            // then actually SWITCH to album view so the user sees it.
            const toggle = document.querySelector('.folder-view-toggle');
            if (!toggle || toggle.offsetParent === null) {
                const header = document.querySelector('.country-group-header');
                if (header && header.onclick) header.onclick();
                await new Promise(r => setTimeout(r, 300));
            }
            // Switch to album view for demo
            try {
                const mod = await import('./catalog.js');
                if (mod.setCatalogViewMode) await mod.setCatalogViewMode('folder');
            } catch (e) {
                const albumBtn = document.querySelector('.view-toggle-btn[title="Album view"]');
                if (albumBtn) albumBtn.click();
            }
            await new Promise(r => setTimeout(r, 400));
            scrollToSelector('.folder-view-toggle');
        }
    },
    {
        selector: '#btn-settings',
        placement: 'below',
        title: 'Customize Everything',
        body: 'The settings menu is where you can change themes, pick which cards and sections are visible, and fine-tune how Coin & Collectible Catalog works for you.',
        before: async () => { scrollToSelector('#btn-settings'); }
    }
];

let currentStep = 0;
let overlay = null;
let spotlight = null;
let bubble = null;
let isRunning = false;

// ============================================================
// DOM construction (lazy, injected once)
// ============================================================
function ensureDom() {
    if (document.getElementById('guide-overlay')) return;

    overlay = document.createElement('div');
    overlay.id = 'guide-overlay';
    overlay.className = 'guide-overlay';

    spotlight = document.createElement('div');
    spotlight.className = 'guide-spotlight';

    bubble = document.createElement('div');
    bubble.className = 'guide-bubble';
    bubble.id = 'guide-bubble';

    document.body.appendChild(overlay);
    document.body.appendChild(spotlight);
    document.body.appendChild(bubble);
}

function scrollToSelector(sel) {
    const el = document.querySelector(sel);
    if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ============================================================
// Positioning
// ============================================================
function positionSpotlight(el) {
    const r = el.getBoundingClientRect();
    spotlight.style.top = r.top + 'px';
    spotlight.style.left = r.left + 'px';
    spotlight.style.width = (r.width + 8) + 'px';
    spotlight.style.height = (r.height + 8) + 'px';
    // soft rounded ring for circular elements (logo coin, round buttons)
    const isRoundish = el.classList.contains('header-logo') ||
                       (el.querySelector && el.querySelector('img') && el.closest('.guide-popup-logo'));
    spotlight.style.borderRadius = isRoundish ? '50%' : '8px';
}

function positionBubble(targetRect) {
    const margin = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;

    const step = TOUR_STEPS[currentStep];
    const prefer = step.placement || 'auto'; // 'below' | 'above' | 'left' | 'right' | 'auto'

    let left = targetRect.left + targetRect.width / 2 - bw / 2;
    let top;
    let arrowClass = 'arrow-top';

    const fitsBelow = (targetRect.bottom + bh + margin) <= vh;
    const fitsAbove = (targetRect.top - bh - margin) >= 0;
    const fitsRight = (targetRect.right + bw + margin) <= vw;
    const fitsLeft  = (targetRect.left - bw - margin) >= 0;

    const placeBelow = () => { top = targetRect.bottom + margin; arrowClass = 'arrow-top'; };
    const placeAbove = () => { top = targetRect.top - bh - margin; arrowClass = 'arrow-bottom'; };
    const placeRight = () => { left = targetRect.right + margin; top = targetRect.top; arrowClass = 'arrow-left'; };
    const placeLeft  = () => { left = targetRect.left - bw - margin; top = targetRect.top; arrowClass = 'arrow-right'; };

    if (prefer === 'below' && fitsBelow) placeBelow();
    else if (prefer === 'above' && fitsAbove) placeAbove();
    else if (prefer === 'right' && fitsRight) placeRight();
    else if (prefer === 'left' && fitsLeft) placeLeft();
    // Auto: try below, then right, then above, then left — pick first that fits.
    else if (fitsBelow) placeBelow();
    else if (fitsRight) placeRight();
    else if (fitsAbove) placeAbove();
    else if (fitsLeft) placeLeft();
    else { placeBelow(); } // fallback

    // Final clamp so the bubble never leaves the viewport.
    top = Math.max(margin, Math.min(top, vh - bh - margin));
    left = Math.max(margin, Math.min(left, vw - bw - margin));

    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
    bubble.className = 'guide-bubble ' + arrowClass;
}

// ============================================================
// Rendering a step
// ============================================================
function renderStep() {
    const step = TOUR_STEPS[currentStep];
    const el = document.querySelector(step.selector);
    if (!el) {
        // Skip to next step if target missing
        next();
        return;
    }

    bubble.innerHTML = '';
    bubble.className = 'guide-bubble';

    const header = document.createElement('div');
    header.className = 'guide-bubble-header';
    const title = document.createElement('div');
    title.className = 'guide-bubble-title';
    title.textContent = step.title;
    const close = document.createElement('button');
    close.className = 'guide-bubble-close';
    close.setAttribute('aria-label', 'Close tour');
    close.innerHTML = '&times;';
    close.addEventListener('click', stopTour);
    header.appendChild(title);
    header.appendChild(close);

    const body = document.createElement('div');
    body.className = 'guide-bubble-body';
    body.textContent = step.body;

    const footer = document.createElement('div');
    footer.className = 'guide-bubble-footer';

    const indicator = document.createElement('span');
    indicator.className = 'guide-step-indicator';
    indicator.textContent = (currentStep + 1) + ' of ' + TOUR_STEPS.length;

    const nav = document.createElement('div');
    nav.className = 'guide-bubble-nav';

    const backBtn = document.createElement('button');
    backBtn.className = 'guide-btn';
    backBtn.textContent = '\u2190 Back';
    backBtn.disabled = currentStep === 0;
    backBtn.addEventListener('click', back);

    const isLast = currentStep === TOUR_STEPS.length - 1;
    const nextBtn = document.createElement('button');
    nextBtn.className = 'guide-btn' + (isLast ? ' guide-btn-primary' : '');
    nextBtn.textContent = isLast ? 'Done' : 'Next \u2192';
    nextBtn.addEventListener('click', () => isLast ? stopTour() : next());

    nav.appendChild(backBtn);
    nav.appendChild(nextBtn);

    footer.appendChild(indicator);
    footer.appendChild(nav);

    bubble.appendChild(header);
    bubble.appendChild(body);
    bubble.appendChild(footer);

    positionSpotlight(el);
    // position bubble after it's in the DOM
    requestAnimationFrame(() => {
        positionBubble(el.getBoundingClientRect());
    });
}

// ============================================================
// Navigation
// ============================================================
async function showCurrent() {
    const step = TOUR_STEPS[currentStep];
    if (step.before) { try { await step.before(); } catch (e) {} }
    renderStep();
}

function next() {
    if (currentStep < TOUR_STEPS.length - 1) {
        currentStep++;
        showCurrent();
    } else {
        stopTour();
    }
}

function back() {
    if (currentStep > 0) {
        currentStep--;
        showCurrent();
    }
}

function stopTour() {
    isRunning = false;
    if (overlay) overlay.classList.remove('is-active');
    if (spotlight) spotlight.style.display = 'none';
    if (bubble) bubble.style.display = 'none';
    currentStep = 0;
}

// ============================================================
// Public API
// ============================================================
export function startTour() {
    ensureDom();
    currentStep = 0;
    isRunning = true;
    overlay.classList.add('is-active');
    spotlight.style.display = 'block';
    bubble.style.display = 'block';
    showCurrent();
}

export function isTourRunning() { return isRunning; }

// Reposition on resize/scroll (bubble + spotlight follow the element)
window.addEventListener('resize', () => {
    if (!isRunning) return;
    const el = document.querySelector(TOUR_STEPS[currentStep].selector);
    if (el) {
        positionSpotlight(el);
        positionBubble(el.getBoundingClientRect());
    }
});
window.addEventListener('scroll', () => {
    if (!isRunning) return;
    const el = document.querySelector(TOUR_STEPS[currentStep].selector);
    if (el) positionSpotlight(el);
}, { passive: true });

// ESC to exit
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isRunning) stopTour();
});