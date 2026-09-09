/**
 * guide.js — Coin Catalog v2 spotlight guided tour
 *
 * Walks a first-time user through the app's key features using a spotlight
 * highlight + bubble. Steps are INTERACTIVE: the tour actually drives the app
 * (expands sections, clicks rows, adds a coin, switches to album view) while
 * explaining what it's doing at each step.
 *
 * Relaunchable from the info menu. "Don't show again" persists to localStorage.
 */

export const GUIDE_STORAGE_KEY = 'cc-guide-dismissed';

// ============================================================
// Tour steps. Each step has:
//   selector   — element to spotlight (may become available after `before`)
//   placement  — preferred bubble side
//   title/body — copy shown in the bubble
//   before     — async hook that drives the app into the right state
// ============================================================
const TOUR_STEPS = [
    {
        selector: '#card-portfolio',
        placement: 'below',
        title: 'Your Portfolio Overview',
        body: 'This is your whole collection at a glance — total value, metal melt values, and a sparkline of how it\u2019s changed. Everything you add anywhere shows up here.',
        before: async () => { scrollToSelector('#card-portfolio'); }
    },
    {
        selector: '#dashboard-grid',
        placement: 'below',
        title: 'Your Dashboard Cards',
        body: 'These cards summarize your collection. Drag the \u2630 handle to reorder, drag edges to resize, and hide cards you don\u2019t use from Settings.',
        before: async () => { scrollToSelector('#dashboard-grid'); }
    },
    {
        selector: '#section-USCoinageLargeSmallCent .section-header',
        placement: 'below',
        title: 'Browse the Catalog',
        body: 'Coins are grouped by country and denomination. Let\u2019s open \u201cUS Coinage \u2014 Large & Small Cent\u201d so you can see how the list works.',
        before: async () => {
            await switchToList();
            await ensureSectionOpen('section-USCoinageLargeSmallCent');
            await scrollToSelector('#section-USCoinageLargeSmallCent .section-header');
        }
    },
    {
        selector: null, // dynamic: the Lincoln Wheat type header
        placement: 'below',
        title: 'Pick a Type',
                body: 'Inside each section, coins are broken into types by design and year. Tap \u201cLincoln Wheat\u201d to see every year of that design.',
                before: async () => {
                    await switchToList();
                    await ensureSectionOpen('section-USCoinageLargeSmallCent');
                    await openType('Lincoln Wheat', 'section-USCoinageLargeSmallCent');
                    const header = findLincolnWheatHeader();
                    if (header) await scrollToEl(header);
                }
            },
            {
                selector: null, // dynamic: 1909-S (VDB) row + Historical Note
        placement: 'below',
        title: 'Open a Coin\u2019s Note',
        body: 'Tap the bar for \u201c1909-S (VDB)\u201d to reveal its Historical Note \u2014 interesting history behind each coin.',
        before: async () => {
            await switchToList();
            await ensureSectionOpen('section-USCoinageLargeSmallCent');
            await openType('Lincoln Wheat', 'section-USCoinageLargeSmallCent');
            await ensureCoinRowOpen('155', true); // open detail panel + Historical Note
            const wrapper = findCoinRowWrapper('155');
            if (wrapper) await scrollToEl(wrapper);
        }
    },
    {
        selector: null, // dynamic: the + stepper of the VDB row
        placement: 'below',
        title: 'Add One Coin',
        body: 'Now tap the \u201c+\u201d to add one to your collection. Watch how the Data Entries section appears with fields for grade, price, and notes.',
        before: async () => {
            await switchToList();
            await ensureSectionOpen('section-USCoinageLargeSmallCent');
            await openType('Lincoln Wheat', 'section-USCoinageLargeSmallCent');
            await ensureCoinRowOpen('155');
            const row = findCoinRow('155');
            const stepper = row?.querySelector('[data-action="stepper-inc"]');
            if (stepper) await scrollToEl(stepper);
        }
    },
    {
        selector: null, // dynamic: the Data Entries panel (whole wrapper)
        placement: 'below',
        title: 'Your Data Entries',
        body: 'Here\u2019s your new entry \u2014 record grade, price, value, and notes. Multiple entries let you track each individual coin you own.',
        before: async () => {
            await switchToList();
            await ensureSectionOpen('section-USCoinageLargeSmallCent');
            await openType('Lincoln Wheat', 'section-USCoinageLargeSmallCent');
            await ensureCoinRowOpen('155');
            const wrapper = findCoinRowWrapper('155');
            if (wrapper) await scrollToEl(wrapper);
        }
    },
    {
        selector: '.folder-view-toggle',
        placement: 'below',
        title: 'Switch to Album View',
        body: 'Now tap \u201cAlbum\u201d to see your Lincoln Wheat collection as a real album of coin slots.',
        before: async () => {
            await switchToAlbum();
            scrollToSelector('.folder-view-toggle');
        }
    },
    {
        selector: null, // dynamic: the Lincoln Wheat album inline grid
        placement: 'below',
        title: 'Your Lincoln Wheat Album',
        body: 'That\u2019s your Lincoln Wheat album. Owned coins are filled in; empty slots are still missing. Tap any filled coin to open its details.',
        before: async () => {
            await ensureSectionOpen('section-USCoinageLargeSmallCent');
            await openType('Lincoln Wheat', 'section-USCoinageLargeSmallCent');
            // make sure album mode is active and the grid is rendered
            await switchToAlbum();
        }
    },
    {
        selector: '#btn-settings',
        placement: 'left',
        title: 'Customize Everything',
        body: 'Finally, Settings is where you change themes, pick visible cards/sections, and fine-tune the app \u2014 and you can always replay this tour from the \u24d8 info menu.',
        before: async () => { scrollToSelector('#btn-settings'); }
    }
];

// ============================================================
// DOM + positioning helpers
// ============================================================

let currentStep = 0;
let overlay = null;
let spotlight = null;
let bubble = null;
let isRunning = false;

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

function smartScroll(el) {
    if (!el) return Promise.resolve();
    const h = el.getBoundingClientRect().height;
    const vh = window.innerHeight;
    const block = h > vh * 0.9 ? 'start' : 'center';
    // Use BOTH scrollIntoView and a manual window.scrollTo fallback. scrollIntoView
    // on an element that is still expanding (accordion opening) sometimes lands the
    // element below the fold; a manual absolute scrollTo is more reliable.
    if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'auto', block });
    }
    // Manual absolute correction: compute the element's document position and
    // scroll so its block anchor sits at the desired viewport offset.
    const rect = el.getBoundingClientRect();
    const absTop = window.scrollY + rect.top;
    let targetY;
    if (block === 'start') {
        targetY = absTop - 20;
    } else {
        targetY = absTop - (vh - h) / 2;
    }
    window.scrollTo(0, Math.max(0, targetY));
    // Small delay to let layout settle after scrolling, so spotlight gets correct rect.
    return new Promise(r => setTimeout(r, 120));
}

async function scrollToSelector(sel) {
    await smartScroll(document.querySelector(sel));
}

async function scrollToEl(el) {
    await smartScroll(el);
}

// Resolve the element to spotlight for the current step (may be dynamic).
function resolveTarget() {
    const step = TOUR_STEPS[currentStep];
    if (step.selector) return document.querySelector(step.selector);

    // Dynamic targets:
    switch (currentStep) {
        case 3: { // Lincoln Wheat type header
            return findLincolnWheatHeader();
        }
        case 4: { // 1909-S (VDB) row + Historical Note (highlight the note content)
            const wrapper = findCoinRowWrapper('155');
            // Prefer the reference-note block if it is now visible (opened by the
            // before hook); fall back to the whole wrapper.
            const note = wrapper?.querySelector('.coin-detail-ref');
            if (note && note.style.display !== 'none') return note;
            return wrapper;
        }
        case 5: { // + stepper of VDB row
            const row = findCoinRow('155');
            return row?.querySelector('[data-action="stepper-inc"]');
        }
        case 6: { // Data Entries panel (highlight the slots wrap)
            const wrapper = findCoinRowWrapper('155');
            return wrapper?.querySelector('.coin-slots-wrap') || wrapper?.querySelector('.coin-detail-panel') || wrapper;
        }
        case 8: { // Lincoln Wheat album inline grid
            const card = document.getElementById('section-USCoinageLargeSmallCent');
            const inlines = card?.querySelectorAll('.type-content.album-inline');
            for (const c of inlines || []) {
                if (c.querySelector('.album-inline-title')?.textContent.includes('Lincoln Wheat')) return c;
            }
            // fallback: any album inline in the card
            return card?.querySelector('.type-content.album-inline');
        }
        default:
            return null;
    }
}

function findCoinRow(coinId) {
    const card = document.getElementById('section-USCoinageLargeSmallCent');
    const rows = card?.querySelectorAll('.coin-row');
    for (const r of rows || []) {
        if (r.dataset.coinId === coinId) return r;
    }
    return null;
}

function findCoinRowWrapper(coinId) {
    const card = document.getElementById('section-USCoinageLargeSmallCent');
    const wrappers = card?.querySelectorAll('.coin-row-wrapper');
    for (const w of wrappers || []) {
        if (w.querySelector('.coin-row[data-coin-id="' + coinId + '"]')) return w;
    }
    return null;
}

function findLincolnWheatHeader() {
    const card = document.getElementById('section-USCoinageLargeSmallCent');
    const headers = card?.querySelectorAll('.type-header');
    for (const h of headers || []) {
        if (h.textContent.includes('Lincoln Wheat')) return h;
    }
    return null;
}

// ---- app-driving helpers --------------------------------------------

function getCentCard() {
    return document.getElementById('section-USCoinageLargeSmallCent');
}

async function ensureSectionOpen(sectionId) {
    const card = document.getElementById(sectionId);
    if (!card) return;
    const header = card.querySelector('.section-header');
    const content = card.querySelector('.section-content');
    if (header && content && !content.classList.contains('open')) {
        header.click();
        await new Promise(r => setTimeout(r, 1600)); // wait for coins to load
    }
}

async function openType(typeName, sectionId) {
    const card = document.getElementById(sectionId);
    if (!card) return;
    const headers = card.querySelectorAll('.type-header');
    let target = null;
    for (const h of headers) if (h.textContent.includes(typeName)) { target = h; break; }
    if (!target) return;
    const content = target.closest('.type-wrapper')?.querySelector('.type-content');
    if (content && !content.classList.contains('open')) {
        target.click();
        await new Promise(r => setTimeout(r, 1200));
    }
}

async function ensureCoinRowOpen(coinId, openNote = false) {
    const wrapper = findCoinRowWrapper(coinId);
    if (!wrapper) return;
    // Open the detail panel (▼ Details) if not open. The .coin-detail-panel is a
    // SIBLING of .coin-row (both children of .coin-row-wrapper), not a child of
    // .coin-row, so look it up on the wrapper.
    const dp = wrapper.querySelector('.coin-detail-panel');
    const detailToggle = wrapper.querySelector('.coin-row-detail-toggle');
    if (dp && detailToggle && !dp.classList.contains('open')) {
        detailToggle.click();
        await new Promise(r => setTimeout(r, 600));
    }
    // Ensure the Historical Note (Reference Notes) is VISIBLE. The app auto-opens
    // the note only when qty === 0; when qty >= 1 it stays collapsed, so we must
    // explicitly click the toggle to reveal it for the tour highlight.
    if (openNote) {
        const refDiv = wrapper.querySelector('.coin-detail-ref');
        const refToggle = wrapper.querySelector('[data-action="toggle-historical"]');
        if (refToggle) {
            const isVisible = refDiv && refDiv.style.display !== 'none';
            if (!isVisible) {
                refToggle.click();
                await new Promise(r => setTimeout(r, 400));
            }
        }
    }
}

async function switchToAlbum() {
    const usGroup = document.getElementById('group-united-states');
    const albumBtn = usGroup?.querySelector('.view-toggle-btn[title="Album view"]');
    const listBtn = usGroup?.querySelector('.view-toggle-btn[title="List view"]');
    // only click if not already album (list button would have 'active')
    if (listBtn && listBtn.classList.contains('active')) {
        albumBtn?.click();
        await new Promise(r => setTimeout(r, 1200));
    }
}

async function switchToList() {
    // Force LIST view. This is required for the list-view tour steps — if the user
    // hand-switched to album view before/while the tour runs, the list-view steps'
    // targets (type headers, coin rows, steppers) would not exist, and the tour
    // highlight would drift or vanish.
    const usGroup = document.getElementById('group-united-states');
    const albumBtn = usGroup?.querySelector('.view-toggle-btn[title="Album view"]');
    const listBtn = usGroup?.querySelector('.view-toggle-btn[title="List view"]');
    // If the album button is currently active, click the list button to switch back.
    if (albumBtn && albumBtn.classList.contains('active')) {
        listBtn?.click();
        await new Promise(r => setTimeout(r, 1200));
    }
    // If for some reason neither is marked active (fresh load), ensure list is default.
    if (listBtn && !listBtn.classList.contains('active') && albumBtn && !albumBtn.classList.contains('active')) {
        listBtn?.click();
        await new Promise(r => setTimeout(r, 1200));
    }
}

// ---- positioning ----------------------------------------------------

function positionSpotlight(el) {
    const r = el.getBoundingClientRect();
    spotlight.style.top = r.top + 'px';
    spotlight.style.left = r.left + 'px';
    spotlight.style.width = (r.width + 10) + 'px';
    spotlight.style.height = (r.height + 10) + 'px';
    spotlight.style.display = 'block';
}

function positionBubble(targetRect) {
    const margin = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const step = TOUR_STEPS[currentStep];
    const prefer = step.placement || 'auto';

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
    else if (fitsBelow) placeBelow();
    else if (fitsRight) placeRight();
    else if (fitsAbove) placeAbove();
    else if (fitsLeft) placeLeft();
    else { placeBelow(); }

    top = Math.max(margin, Math.min(top, vh - bh - margin));
    left = Math.max(margin, Math.min(left, vw - bw - margin));

    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
    bubble.className = 'guide-bubble ' + arrowClass;
}

// ---- rendering ------------------------------------------------------

function renderStep() {
    const step = TOUR_STEPS[currentStep];
    const el = resolveTarget();
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
    requestAnimationFrame(() => {
        positionBubble(el.getBoundingClientRect());
    });
    // A second deferred pass after layout settles (accordions expanding, images
    // loading) so the spotlight/bubble land on the final position instead of
    // drifting off-screen while a section is still expanding.
    setTimeout(() => {
        if (!isRunning) return;
        const liveEl = resolveTarget();
        if (liveEl) {
            positionSpotlight(liveEl);
            positionBubble(liveEl.getBoundingClientRect());
        }
    }, 300);
}

// ---- navigation -----------------------------------------------------

async function showCurrent() {
    const step = TOUR_STEPS[currentStep];
    if (step.before) { try { await step.before(); } catch (e) { console.warn('[guide]', e); } }
    // Force a layout flush and correction: after the before hook's async work
    // (accordions expanding, scrolling) completes, force one more scroll pass
    // so the spotlight lands exactly on target. This handles the race where
    // accordions are still expanding when positionSpotlight runs.
    const target = resolveTarget();
    if (target) {
        smartScroll(target);
        await new Promise(r => setTimeout(r, 80));
    }
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

// ---- public API -----------------------------------------------------

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

// Reposition on resize/scroll
window.addEventListener('resize', () => {
    if (!isRunning) return;
    const el = resolveTarget();
    if (el) {
        positionSpotlight(el);
        positionBubble(el.getBoundingClientRect());
    }
});
window.addEventListener('scroll', () => {
    if (!isRunning) return;
    const el = resolveTarget();
    if (el) positionSpotlight(el);
}, { passive: true });

// ESC to exit
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isRunning) stopTour();
});