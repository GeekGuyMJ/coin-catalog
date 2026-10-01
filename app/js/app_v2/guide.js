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

import { closeModalLegacy } from './modals.js';

export const GUIDE_STORAGE_KEY = 'cc-guide-dismissed';

// Album details use the legacy modal stack. Keep its lifecycle intact: closing
// through that API releases both the backdrop and the body's scroll lock.
let albumModal = null;
let albumModalObserver = null;
let albumModalStyles = null;

function restoreAlbumModalLayout() {
    if (!albumModalStyles) return;
    for (const [element, style] of albumModalStyles) {
        if (style === null) element.removeAttribute('style');
        else element.setAttribute('style', style);
    }
    albumModalStyles = null;
}

function watchAlbumModal() {
    const layer = document.getElementById('modal-layer');
    if (!layer || albumModalObserver) return;
    albumModalObserver = new MutationObserver(() => {
        if (!isRunning || currentStep !== 8) return;
        const opened = layer.querySelector('.modal-overlay.open[id^="modal-coin-detail-"]');
        if (opened === albumModal) return;
        restoreAlbumModalLayout();
        albumModal = opened;
        if (opened) {
            albumModalStyles = [opened, opened.querySelector('.modal-box'), opened.querySelector('.modal-body')]
                .filter(Boolean).map(element => [element, element.getAttribute('style')]);
        }
        renderStep();
        // The modal entrance animation scales its box; measure again once it
        // finishes, not while its temporary transform is still shrinking it.
        const tracked = opened;
        setTimeout(() => {
            if (!isRunning || currentStep !== 8 || albumModal !== tracked) return;
            const target = resolveTarget();
            if (target) { positionSpotlight(target); positionBubble(target.getBoundingClientRect()); }
        }, 350);
    });
    albumModalObserver.observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

function leaveAlbumModal() {
    albumModalObserver?.disconnect();
    albumModalObserver = null;
    restoreAlbumModalLayout();
    if (albumModal?.classList.contains('open')) closeModalLegacy(albumModal.id);
    albumModal = null;
}

function layoutAlbumModal() {
    if (!albumModal) return;
    // Reserve a separate top band for the bubble. The complete dialog is lit;
    // long detail content scrolls inside it rather than under the tour controls.
    const top = bubble.offsetHeight + 32;
    const height = Math.max(80, window.innerHeight - top - 16);
    Object.assign(albumModal.style, { padding: `${top}px 16px 16px`, alignItems: 'flex-start', boxSizing: 'border-box' });
    const box = albumModal.querySelector('.modal-box');
    if (box) Object.assign(box.style, { maxHeight: `${height}px`, margin: '0', display: 'flex', flexDirection: 'column' });
    const body = albumModal.querySelector('.modal-body');
    if (body) Object.assign(body.style, { overflowY: 'auto', minHeight: '0', flex: '1 1 auto' });
}

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
        body: 'This is your whole collection at a glance — total value, metal melt values, and how it\u2019s changed over time. Everything you add anywhere in the app shows up here.',
        before: async () => { await scrollToSelector('#card-portfolio'); }
    },
    {
        selector: '#card-spot',
        placement: 'below',
        title: 'Your Dashboard Cards',
        body: 'The dashboard is made of cards like this one. Drag the \u2630 handle to reorder them, drag the edges to resize, and hide any card you don\u2019t use — all from Settings.',
        before: async () => { await scrollToSelector('#card-spot'); }
    },
    {
        selector: '#section-USCoinageLargeSmallCent .section-header',
        placement: 'above',
        title: 'Browse the Catalog',
        body: 'Coins are grouped by country and denomination. Tap \u201cUS Coinage — Large & Small Cent\u201d to open it and see how the list is organized.',
        awaitClick: true,
        expandSpotlight: '#section-USCoinageLargeSmallCent',
        isOpen: () => { const c = document.getElementById('section-USCoinageLargeSmallCent'); return c?.querySelector('.section-content')?.classList.contains('open'); },
        before: async () => {
            await switchToList();
            await ensureSectionClosed('section-USCoinageLargeSmallCent');
            await scrollToSelector('#section-USCoinageLargeSmallCent .section-header');
        }
    },
    {
        selector: null, // dynamic: Lincoln Wheat type header
        placement: 'above',
        title: 'Pick a Type',
        body: 'Inside each section, coins are divided into types by design and year. Tap \u201cLincoln Wheat\u201d to see every year of that design in one list.',
        awaitClick: true,
        expandSpotlight: null, // wrapper resolved dynamically below
        isOpen: () => { const h = findLincolnWheatHeader(); return h?.closest('.type-wrapper')?.querySelector('.type-content')?.classList.contains('open'); },
        before: async () => {
            await switchToList();
            await ensureSectionOpen('section-USCoinageLargeSmallCent');
            await closeType('Lincoln Wheat', 'section-USCoinageLargeSmallCent');
            const header = findLincolnWheatHeader();
            if (header) await scrollToEl(header);
        }
    },
    {
        selector: null, // dynamic: 1909-S (VDB) coin row (user taps to open)
        placement: 'above',
        title: 'Open a Coin\u2019s Note',
        body: 'Each coin row has a detail area. Tap the \u25bc Details toggle on the \u201c1909-S (VDB)\u201d row to expand it and reveal its Historical Note and data fields.',
        awaitClick: true,
        isOpen: () => { const w = findCoinRowWrapper('155'); return w?.querySelector('.coin-detail-panel')?.classList.contains('open'); },
        before: async () => {
            await switchToList();
            await ensureSectionOpen('section-USCoinageLargeSmallCent');
            await openType('Lincoln Wheat', 'section-USCoinageLargeSmallCent');
            await ensureCoinRowClosed('155');
            const wrapper = findCoinRowWrapper('155');
            if (wrapper) await scrollToEl(wrapper);
        }
    },
    {
        selector: null, // dynamic: the + stepper of the VDB row — USER taps +
        placement: 'above',
        title: 'Track How Many You Own',
        body: 'Tap the \u201c+\u201d on the 1909-S (VDB) row to record that you own one. The detail area below then adds a data entry for that coin.',
        awaitClick: true,
        isOpen: () => { const s = document.querySelector('#section-USCoinageLargeSmallCent .stepper[data-coin-id="155"] .stepper-value'); return s && parseInt(s.textContent, 10) > 0; },
        before: async () => {
            await switchToList();
            await ensureSectionOpen('section-USCoinageLargeSmallCent');
            await openType('Lincoln Wheat', 'section-USCoinageLargeSmallCent');
            await ensureCoinRowOpen('155', true); // panel + note visible so the + area is shown clearly
            const stepper = document.querySelector('#section-USCoinageLargeSmallCent .stepper[data-coin-id="155"]');
            if (stepper) await scrollToEl(stepper);
        }
    },
    {
        selector: null, // dynamic: the coin detail panel (notes + data entries)
        placement: 'below',
        title: 'Your Entries & Notes',
        body: 'This detail area is where you record grade, price, value, and notes for each coin you own. Add multiple entries to track every individual piece.',
        before: async () => {
            await switchToList();
            await ensureSectionOpen('section-USCoinageLargeSmallCent');
            await openType('Lincoln Wheat', 'section-USCoinageLargeSmallCent');
            await ensureCoinRowOpen('155', true); // open panel + historical note so the area is visible
            const wrapper = findCoinRowWrapper('155');
            const panel = wrapper?.querySelector('.coin-detail-panel');
            if (panel) await scrollToEl(panel);
        }
    },
    {
        selector: '#group-united-states .view-toggle-btn[title="Album view"]',
        placement: 'above',
        title: 'Switch to Album View',
        body: 'Tap \u201cAlbum\u201d to see your collection as a real stamp-style album of coin slots instead of a list.',
        awaitClick: true,
        isOpen: () => document.querySelector('#group-united-states .view-toggle-btn[title="Album view"]')?.classList.contains('active'),
        before: async () => { await scrollToSelector('#group-united-states .folder-view-toggle'); }
    },
    {
        selector: null, // dynamic: Lincoln Wheat album inline grid
        placement: 'below',
        title: 'Your Lincoln Wheat Album',
        body: 'Here\u2019s Lincoln Wheat in album form. Owned coins are filled in; empty slots are still missing from your collection. Tap any filled coin to open its details.',
        before: async () => {
            await ensureSectionOpen('section-USCoinageLargeSmallCent');
            await openType('Lincoln Wheat', 'section-USCoinageLargeSmallCent');
            await switchToAlbum();
            const grid = document.querySelector('#section-USCoinageLargeSmallCent .type-content.album-inline');
            if (grid) await scrollToEl(grid);
        }
    },
    {
        selector: '#btn-settings',
        placement: 'left',
        title: 'Customize Everything',
        body: 'Settings is where you choose which cards and sections are visible and fine-tune the app. You can replay this tour anytime from the \u24d8 info menu.',
        before: async () => { await scrollToSelector('#btn-settings'); }
    },
    {
        selector: '#btn-info',
        placement: 'below',
        title: 'The Info Menu',
        body: 'The \u24d8 info menu holds the collecting guides, how values are worked out, famous coin stories, and a link to replay this tour. Everything written about coins lives here.',
        before: async () => { await scrollToSelector('#btn-info'); }
    },
    {
        selector: '#theme-selector',
        placement: 'below',
        title: 'Pick Your Theme',
        body: 'The color theme dropdown sits in the header. Alongside the built-in themes there are three custom slots \u2014 Custom 1, 2 and 3 until you name them. Open the Theme Designer to change a slot\'s colors and give it any name you like; that name then shows up here and in the dropdown.',
        before: async () => { await scrollToSelector('#theme-selector'); }
    }
];

// Local element builder for the advanced tour. guide.js does not import the
// app's el() helper (it lives in another module), so without this the tour
// threw ReferenceError: el is not defined and never rendered.
function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
        for (const [k, v] of Object.entries(props)) {
            if (v === null || v === undefined || v === false) continue;
            if (k === 'className') node.className = v;
            else if (k === 'textContent') node.textContent = v;
            else if (k === 'innerHTML') node.innerHTML = v;
            else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
            else if (k === 'dataset') Object.assign(node.dataset, v);
            else if (k.startsWith('on') && typeof v === 'function') {
                node.addEventListener(k.slice(2).toLowerCase(), v);
            } else node.setAttribute(k, v);
        }
    }
    for (const c of children.flat()) {
        if (c === null || c === undefined || c === false) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
}

// ============================================================
// Advanced-features tour
// ============================================================
// A second, opt-in walkthrough for the parts of Settings that benefit from
// a sentence of explanation. Separate from TOUR_STEPS so the main tour stays
// short; reachable from the info menu via startAdvancedTour().

const ADVANCED_STEPS = [
    {
        label: 'Export & Backup',
        title: 'Take a Backup First',
        body: 'Settings › Export & Backup writes a full copy of your collection. The ZIP holds everything including images; the JSON is the whole database as text. Grab one before any large change — it is the only thing that can put a collection back exactly as it was.',
    },
    {
        label: 'Import & Restore',
        title: 'Putting a Backup Back',
        body: 'Restoring replaces what is currently in the app, so use it to recover rather than to merge. Take a fresh backup first, then choose the format that matches the file you are restoring from.',
    },
    {
        label: 'Cloud Sync',
        title: 'Automatic Cloud Backup',
        body: 'Cloud Sync keeps a copy off this device using WebDAV, Google Drive or Dropbox, so the collection survives a lost phone or a reinstalled app. Enter the provider details once; the app can then back up and restore on demand.',
    },
    {
        label: 'Pricing Rules',
        title: 'How Coins Are Valued',
        body: 'Pricing Rules set a base value for regular coins and a separate key-date value for scarcer ones, per denomination. These are the numbers the app multiplies by when it adds up a collection.',
    },
    {
        label: 'Coin Image Bank',
        title: 'The Coin Image Bank',
        body: 'Every reference image in the app, searchable and reusable. Place one on a single coin, on a whole type, or on every empty slot of a type at once — the last is usually what you want after a new coin issue appears.',
    },
    {
        label: 'Find Missing Images',
        title: 'Filling Image Gaps',
        body: 'Lists every coin still without a picture, section by section. It is the quickest way to see what is left, and pairs with the Coin Image Bank above.',
    },
    {
        label: 'Completion Dashboard',
        title: 'How Complete Is the Set?',
        body: 'Scores the collection against every date the Mint struck, by type and denomination. Useful for spotting the cheap year to hunt for next, since gaps are where a collection is usually one coin away from complete.',
    },
    {
        label: 'Print Checklist',
        title: 'A Shopping List',
        body: 'Prints the coins you are still missing, as a checklist to take to a dealer, a show, or to keep by the computer while working through it online.',
    },
];

function openSettingsMenu() {
    const b = document.getElementById('btn-settings');
    if (b) b.click();
}

function closeSettingsMenu() {
    const d = document.querySelector('.settings-dropdown.open');
    if (d) d.remove();
}

function findSettingsItem(label) {
    return Array.from(document.querySelectorAll('.settings-menu-item'))
        .find(n => ((n.innerText || '').trim() === label))
        || null;
}

let advEl = null, advBubble = null, advIndex = 0, advOpen = false;

function advClose() {
    advOpen = false;
    if (advBubble) { advBubble.remove(); advBubble = null; }
    if (advEl) { advEl.remove(); advEl = null; }
    closeSettingsMenu();
    document.body.classList.remove('guide-running');
}

function advRender() {
    if (!advOpen) return;
    const step = ADVANCED_STEPS[advIndex];

    // ensure the settings menu is open and the right item is highlighted
    openSettingsMenu();
    const item = findSettingsItem(step.label);
        // Bring the target into view before measuring, so the
        // bubble is placed relative to a visible row instead of
        // one below the fold (2026-09-27).
        try { item.scrollIntoView({ block: 'center' }); }
        catch (e) { /* older engines */ }
    if (advEl) advEl.remove();
    if (item) {
        advEl = document.createElement('div');
        advEl.id = 'guide-spotlight';
        advEl.className = 'guide-spotlight advanced';
        document.body.appendChild(advEl);
        const r = item.getBoundingClientRect();
        Object.assign(advEl.style, {
            position: 'fixed', left: (r.left - 4) + 'px', top: (r.top - 4) + 'px',
            width: (r.width + 8) + 'px', height: (r.height + 8) + 'px',
            borderRadius: '8px', pointerEvents: 'none', zIndex: '999998',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)'
        });
    }

    if (advBubble) advBubble.remove();
    advBubble = el('div', { className: 'guide-bubble advanced', id: 'guide-bubble' });
    const header = el('div', { className: 'guide-bubble-header' });
    header.appendChild(el('div', { className: 'guide-bubble-title' }, step.title));
    const close = el('button', { className: 'guide-bubble-close', 'aria-label': 'Close' });
    close.innerHTML = '&times;';
    close.addEventListener('click', advClose);
    header.appendChild(close);
    advBubble.appendChild(header);
    advBubble.appendChild(el('div', { className: 'guide-bubble-body' }, step.body));

    const footer = el('div', { className: 'guide-bubble-footer' });
    footer.appendChild(el('span', { className: 'guide-step-indicator' },
        (advIndex + 1) + ' of ' + ADVANCED_STEPS.length));
    const nav = el('div', { className: 'guide-bubble-nav' });
    const back = el('button', { className: 'guide-btn' }, '← Back');
    back.disabled = advIndex === 0;
    back.addEventListener('click', () => { advIndex--; advRender(); });
    const isLast = advIndex === ADVANCED_STEPS.length - 1;
    const next = el('button', { className: 'guide-btn' + (isLast ? ' guide-btn-primary' : '') },
        isLast ? 'Done' : 'Next →');
    next.addEventListener('click', () => {
        if (isLast) advClose(); else { advIndex++; advRender(); }
    });
    nav.appendChild(back); nav.appendChild(next);
    footer.appendChild(nav);
    advBubble.appendChild(footer);

    advBubble.style.position = 'fixed';
    advBubble.style.zIndex = '999999';
    advBubble.style.maxWidth = '340px';
    document.body.appendChild(advBubble);

    // Place the bubble so it NEVER covers the item it highlights.
    // The old logic flipped it to the LEFT of the item when there was no
    // room on the right, which on a phone put the dialog directly on top
    // of the highlighted Settings row (2026-09-27).
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = 12;            // edge margin
    const GAP = 14;          // gap between the item and the bubble
    advBubble.style.maxWidth = Math.min(340, vw - M * 2) + 'px';
    advBubble.style.left = '0px';
    advBubble.style.top = '0px';
    const bw = advBubble.offsetWidth;
    const bh = advBubble.offsetHeight;

    if (item) {
        const r = item.getBoundingClientRect();
        const top = Math.max(M, r.top);
        const bottom = r.bottom;
        const rightRoom = vw - r.right - GAP - M;
        const leftRoom = r.left - GAP - M;

        const clampTop = (v) => Math.max(M, Math.min(v, vh - bh - M));

        if (rightRoom >= bw) {
            // 1. to the right of the item
            advBubble.style.left = (r.right + GAP) + 'px';
            advBubble.style.top = clampTop(r.top) + 'px';
        } else if (bottom + GAP + bh + M <= vh) {
            // 2. below the item, full width minus margins (mobile default)
            advBubble.style.left = M + 'px';
            advBubble.style.top = (bottom + GAP) + 'px';
        } else if (top - GAP - bh >= M) {
            // 3. above the item
            advBubble.style.left = M + 'px';
            advBubble.style.top = (top - GAP - bh) + 'px';
        } else {
            // 4. whichever side has room, clamped so it cannot land on the
            //    target
            if (leftRoom >= bw) {
                advBubble.style.left = (r.left - GAP - bw) + 'px';
            } else {
                advBubble.style.left = M + 'px';
            }
            if (vh - bottom - GAP - M >= bh) {
                advBubble.style.top = (bottom + GAP) + 'px';
            } else if (top - GAP - M >= bh) {
                advBubble.style.top = (top - GAP - bh) + 'px';
            } else {
                // Neither above nor below fits: sit at the BOTTOM of the
                // screen rather than tracking the item down the page, so
                // the bubble is always fully visible (2026-09-27).
                advBubble.style.top = (vh - bh - M) + 'px';
            }
        }

        // Final guarantee: if it still overlaps the target, pin it to the
        // top edge rather than covering the row being explained.
        const nb = advBubble.getBoundingClientRect();
        const nr = item.getBoundingClientRect();
        const overlaps = !(nb.right <= nr.left + 1 || nb.left >= nr.right - 1
                        || nb.bottom <= nr.top + 1 || nb.top >= nr.bottom - 1);
        if (overlaps) {
            advBubble.style.left = M + 'px';
            advBubble.style.top = (vh - bh - M >= 0 ? vh - bh - M : M) + 'px';
        }
        // And it must always be fully on screen.
        advBubble.style.left = clampTop(advBubble.offsetLeft) + 'px';
        advBubble.style.top = clampTop(advBubble.offsetTop) + 'px';
    } else {
        advBubble.style.left = M + 'px';
        advBubble.style.top = Math.max(M, Math.min(80, vh - bh - M)) + 'px';
    }
}

/** Entry point: the Info menu button calls this. */
export function startAdvancedTour() {
    if (typeof closeInfoDropdown === 'function') closeInfoDropdown();
    advIndex = 0;
    advOpen = true;
    document.body.classList.add('guide-running');
    advRender();
}

// ============================================================
// DOM + positioning helpers
// ============================================================

let currentStep = 0;
let _navDirection = 'forward'; // 'forward' | 'back'
let overlay = null;
let spotlight = null;
let bubble = null;
let clickCue = null;
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
    // Tap indicator: shown INSIDE the highlight while an interactive step waits
    // for the user's click — points at exactly where to tap.
    clickCue = document.createElement('div');
    clickCue.className = 'guide-click-cue';
    clickCue.innerHTML =
        '<span class="guide-click-cue-ring" aria-hidden="true"></span>' +
        '<span class="guide-click-cue-pointer" aria-hidden="true"><i class="guide-click-cue-arrow"></i> click</span>';
    clickCue.style.display = 'none';
    document.body.appendChild(overlay);
    document.body.appendChild(spotlight);
    document.body.appendChild(clickCue);
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
        case 4: { // 1909-S (VDB) coin ROW WRAPPER (includes expanded historical notes)
            return findCoinRowWrapper('155');
        }
        case 5: { // the + stepper itself — cue sits on the + button
            return document.querySelector('#section-USCoinageLargeSmallCent .stepper[data-coin-id="155"]');
        }
        case 6: { // coin detail panel wrapper (notes + data entries area)
            return findCoinRowWrapper('155');
        }
        case 8: { // Lincoln Wheat album inline grid or its opened detail dialog
            if (albumModal) return albumModal.querySelector('.modal-box');
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

async function ensureSectionClosed(sectionId) {
    const card = document.getElementById(sectionId);
    if (!card) return;
    const header = card.querySelector('.section-header');
    const content = card.querySelector('.section-content');
    if (header && content && content.classList.contains('open')) {
        header.click();
        await new Promise(r => setTimeout(r, 600));
    }
}

async function closeType(typeName, sectionId) {
    const card = document.getElementById(sectionId);
    if (!card) return;
    const headers = card.querySelectorAll('.type-header');
    let target = null;
    for (const h of headers) if (h.textContent.includes(typeName)) { target = h; break; }
    if (!target) return;
    const content = target.closest('.type-wrapper')?.querySelector('.type-content');
    if (content && content.classList.contains('open')) {
        target.click();
        await new Promise(r => setTimeout(r, 600));
    }
}

async function ensureCoinRowClosed(coinId) {
    const wrapper = findCoinRowWrapper(coinId);
    if (!wrapper) return;
    const dp = wrapper.querySelector('.coin-detail-panel');
    const detailToggle = wrapper.querySelector('.coin-row-detail-toggle');
    if (dp && detailToggle && dp.classList.contains('open')) {
        detailToggle.click();
        await new Promise(r => setTimeout(r, 300));
    }
}

// Is the current step's target in its "opened" state? (interactive steps only)
function isStepOpen() {
    const step = TOUR_STEPS[currentStep];
    if (typeof step.isOpen !== 'function') return true; // static steps render immediately
    try { return !!step.isOpen(); } catch (e) { return false; }
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
    layoutAlbumModal();
    const step = TOUR_STEPS[currentStep];
    let hEl = el;

    // After the user expands a section/type, highlight the expanded content area
    // (not just the header) so the opened list isn't left dark outside the hole.
    if (step && step.awaitClick && isStepOpen()) {
        if (step.expandSpotlight) {
            const ex = document.querySelector(step.expandSpotlight);
            if (ex) hEl = ex;
        } else if (step.awaitClick && currentStep === 3) {
            const h = findLincolnWheatHeader();
            const tw = h?.closest('.type-wrapper');
            if (tw) hEl = tw;
        } else if (step.awaitClick && currentStep === 5) {
            // The user just tapped "+" on the stepper: the detail area under the
            // row gains a data entry, so extend the highlight over the whole
            // row + its expanded detail panel immediately — not only after Next.
            const w = findCoinRowWrapper('155');
            if (w) hEl = w;
        }
    }
    const r = hEl.getBoundingClientRect();
    // Clamp oversized targets (whole dashboard grid, full album) to a readable
    // height so the spotlight doesn't span the entire viewport. We highlight the
    // top portion of the element and rely on the bubble copy to explain the rest.
    const CLAMP = Math.round(window.innerHeight * 0.62);
    let h = r.height;
    if (!albumModal && h > CLAMP) h = CLAMP;
    spotlight.style.top = Math.max(0, r.top) + 'px';
    spotlight.style.left = r.left + 'px';
    spotlight.style.width = r.width + 'px';
    spotlight.style.height = h + 'px';
    spotlight.style.display = 'block';
    if (step && step.awaitClick && !isStepOpen()) {
        // Aim the tap cue at the exact interactive element. For the stepper step
        // that's the + button; for album it's the Album toggle button itself.
        let cueEl = el;
        if (currentStep === 5) {
            const inc = el.querySelector('[data-action="stepper-inc"]');
            if (inc) cueEl = inc;
        }
        // The cue container is position:fixed; JS pins its origin to the exact
        // center of the target element. Children (ring + arrow label) are
        // absolutely anchored to the container's 0,0.
        requestAnimationFrame(() => {
            if (!isRunning) return;
            const rr = cueEl.getBoundingClientRect();
            const cx = Math.round(rr.left + rr.width / 2);
            const cy = Math.round(rr.top + rr.height / 2);
            const vw = window.innerWidth, vh = window.innerHeight;
            clickCue.style.left = Math.max(20, Math.min(cx, vw - 24)) + 'px';
            clickCue.style.top = Math.max(24, Math.min(cy, vh - 28)) + 'px';
            clickCue.style.display = 'block';
        });
    } else {
        clickCue.style.display = 'none';
    }
}

function positionBubble(targetRect) {
    const margin = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const step = TOUR_STEPS[currentStep];
    const prefer = step.placement || 'auto';
    if (albumModal) {
        bubble.style.left = Math.max(16, (vw - bw) / 2) + 'px';
        bubble.style.top = '16px';
        bubble.className = 'guide-bubble arrow-top';
        return;
    }

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

function renderStep(allowNoTarget = false) {
    const step = TOUR_STEPS[currentStep];
    let el = resolveTarget();
    if (!el && allowNoTarget) {
        // The target never rendered. Still show the step so the user reads
        // it; just no spotlight to aim at.
        el = document.body;
        spotlight.style.display = 'none';
    }
    if (!el) {
        // Target not in the DOM YET — album grids and freshly expanded
        // sections render asynchronously. 1 second proved too short: step 9
        // ("Your Lincoln Wheat Album") was silently dropped on a slow load
        // (Matthew, 2026-09-25). Retry for ~6s, and if the target still
        // never appears SHOW the step centred without a spotlight rather
        // than skipping past content the user was told they would see.
        let tries = 0;
        const retry = () => {
            if (!isRunning) return;
            const t2 = resolveTarget();
            if (t2) { renderStep(); return; }
            if (++tries < 120) { setTimeout(retry, 50); return; }
            console.warn('[guide] target never rendered for step',
                         currentStep + 1, '— showing without spotlight');
            renderStep(true);
        };
        setTimeout(retry, 50);
        return;
    }

    spotlight.style.display = '';
    bubble.innerHTML = '';
    bubble.className = 'guide-bubble' + (step.awaitClick && !isStepOpen() ? ' guide-bubble-pointer' : '');
    clearTimeout(_settleTimer);

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
    body.textContent = albumModal ? 'Here are your coin details. Scroll within this window to see every field. Next closes it and takes you to Settings.' : step.body;

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
    // Interactive steps: only the user's tap on the highlighted element may
    // advance the tour — hide Next until the target reaches its "open" state.
    if (step.awaitClick && !isStepOpen()) nextBtn.style.display = 'none';

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
}

// ---- navigation -----------------------------------------------------

let _settleTimer = null;

async function showCurrent() {
    _closeAnyImageModal();
    const step = TOUR_STEPS[currentStep];
    if (currentStep === 8) watchAlbumModal();
    const atStart = isStepOpen();
    // BACK-navigation: a completed interactive step (target already open) must
    // NOT have its target re-closed by before() — re-closing made Back feel
    // broken (bubble changed but Next vanished, forcing the user to redo the
    // action they had already completed).
    if (_navDirection === 'back' && step.awaitClick && atStart) {
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        renderStep();
        const t0 = resolveTarget();
        if (t0) { positionSpotlight(t0); positionBubble(t0.getBoundingClientRect()); }
        return;
    }
    if (step.before) { try { await step.before(); } catch (e) { console.warn('[guide]', e); } }
    // Wait for the app's DOM to settle BEFORE reading positions: two layout frames
    // plus a fixed delay so collapsible areas have reached their target height.
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    await new Promise(r => setTimeout(r, 300));
    const target = resolveTarget();
    if (!step.awaitClick && target) await smartScroll(target);
    renderStep();
    // Poll until the target reaches its "open" state, then scroll+spotlight the
    // freshly-expanded element and re-render the full bubble (Next returns).
    // The poll converges immediately for non-interactive steps (~1 tick).
    let attempts = 0;
    const tick = async () => {
        if (!isRunning) return;
        attempts++;
        if (step.awaitClick && attempts < 10 && !isStepOpen()) { _settleTimer = setTimeout(tick, 250); return; }
        clearTimeout(_settleTimer);
        if (!step.awaitClick) {
            const target = resolveTarget();
            if (target) await smartScroll(target);
        }
        renderStep();
        // One corrective pass for late layout shifts (images, reflows)
        setTimeout(() => {
            if (!isRunning) return;
            const liveEl = resolveTarget();
            if (liveEl) {
                positionSpotlight(liveEl);
                positionBubble(liveEl.getBoundingClientRect());
            }
        }, 400);
    };
    _settleTimer = setTimeout(tick, step.awaitClick ? 250 : 400);
}

function next() {
    leaveAlbumModal();
    if (currentStep < TOUR_STEPS.length - 1) {
        currentStep++;
        _navDirection = 'forward';
        showCurrent();
    } else {
        stopTour();
    }
}

function back() {
    leaveAlbumModal();
    if (currentStep > 0) {
        currentStep--;
        _navDirection = 'back';
        showCurrent();
    }
}

function stopTour() {
    leaveAlbumModal();
    _removeImageBlock();
    _closeAnyImageModal();
    clearTimeout(_settleTimer);
    isRunning = false;
    if (overlay) overlay.classList.remove('is-active');
    if (spotlight) spotlight.style.display = 'none';
    if (bubble) bubble.style.display = 'none';
    if (clickCue) clickCue.style.display = 'none';
    currentStep = 0;
}

// ---- public API -----------------------------------------------------

const _TOUR_BLOCK_CLASS = 'cc-guide-block-image-clicks';
let _tourImageBlockHandler = null;

function _installImageBlock() {
    if (_tourImageBlockHandler) return;
    // Capture-phase listener: during the tour, swallow any click that would open
    // the image-interaction modal (view-img) so it doesn't cover the tour bubble.
    _tourImageBlockHandler = (e) => {
        const trigger = e.target && e.target.closest
            ? e.target.closest('[data-action="view-img"]') : null;
        if (trigger) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    };
    document.addEventListener('click', _tourImageBlockHandler, true);
}

function _removeImageBlock() {
    if (!_tourImageBlockHandler) return;
    document.removeEventListener('click', _tourImageBlockHandler, true);
    _tourImageBlockHandler = null;
}

function _closeAnyImageModal() {
    // If the image lightbox snuck open anyway, close it so the tour isn't blocked.
    const img = document.getElementById('modal-image-interaction');
    if (img && img.classList.contains('open')) {
        import('./modals.js').then(m => m.closeModalLegacy ? m.closeModalLegacy('modal-image-interaction') : null);
    }
}

export function startTour() {
    ensureDom();
    currentStep = 0;
    isRunning = true;
    _installImageBlock();
    _closeAnyImageModal();

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
// scroll listener removed: it fought the click scroll and caused bounce


// Interactive steps: when the user clicks ANYWHERE while a click-gated step is
// pending (e.g. tapping the highlighted header), re-run rendering so the
// spotlight opens on the expanded element, the bubble repositions above it,
// and the Next button returns.
document.addEventListener('click', () => {
    if (!isRunning) return;
    const step = TOUR_STEPS[currentStep];
    if (!step || !step.awaitClick) return;
    // The user's own tap is the Next button: once the target flips to its open
    // state, scroll to it, expand the spotlight over the expanded content, and
    // re-render the full bubble (Next returns). NEVER re-run step.before here —
    // that hook ensures the target is closed and would undo the user's click.
    _closeAnyImageModal();
    setTimeout(() => {
        if (!isRunning || !isStepOpen()) return;
        const t = resolveTarget();
        if (t) smartScroll(t).then(() => setTimeout(() => isRunning && renderStep(), 150));
        else setTimeout(() => isRunning && renderStep(), 150);
        clearTimeout(_settleTimer);
        // Settle loop: keep repositioning while the layout is still moving.
        // The app's own post-click reflow (inventory fetch, dashboard rebuild,
        // accordion resize) can land AFTER a single fixed-delay pass, leaving the
        // spotlight stranded mid-page. Track the target rect; stop once it has
        // been stable for three consecutive frames (bounded to ~1.5s so the loop
        // can never run away).
        const t0 = performance.now();
        let last = null, stable = 0;
        const settle = () => {
            if (!isRunning) return;
            const el = resolveTarget();
            if (!el) return;
            positionSpotlight(el);
            positionBubble(el.getBoundingClientRect());
            const r = el.getBoundingClientRect();
            const key = Math.round(r.top) + 'x' + Math.round(r.height);
            stable = (last === key) ? stable + 1 : 0;
            last = key;
            if (stable < 3 && (performance.now() - t0) < 1500) {
                requestAnimationFrame(settle);
            }
        };
        requestAnimationFrame(settle);
    }, 60);
}, true);

// Advanced tour entry point for the Info menu button.
if (typeof window !== 'undefined') window.startAdvancedTour = startAdvancedTour;

// ESC to exit
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isRunning) stopTour();
});