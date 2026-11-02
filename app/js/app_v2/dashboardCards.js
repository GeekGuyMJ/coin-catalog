/**
 * dashboardCards.js — the ONE list of dashboard cards.
 *
 * GGMJ-431 (2026-10-21)
 * ---------------------
 * The "Dashboard Card Visibility" list was a HARD-CODED array in modals.js
 * (12 entries) and a DIFFERENT hard-coded array in settingsDropdown.js
 * (9 entries). Neither matched the cards the dashboard actually renders
 * (15), so six cards the user could see could not be hidden:
 *
 *   card-investments  Other Investments
 *   card-trend        Metal Price Trends
 *   card-gallery      Photos & Documents
 *   card-backup       Your Backup
 *   card-support      Support This App
 *   card-search       Search Bar
 *
 * The two lists also disagreed with each other, and the settingsDropdown
 * one stored its state under a DIFFERENT localStorage key than the one
 * portfolio.js reads, so toggling a card from the settings dropdown did
 * nothing at all (measured: card-spot stayed display:flex and
 * localStorage 'card-spot' stayed null after the toggle).
 *
 * THE FIX
 * -------
 * This module is the single source of truth. It derives the list from the
 * cards the dashboard ACTUALLY renders:
 *
 *   1. Every card element carries a `data-card-label` and a
 *      `data-card-desc` attribute, set where the card is created
 *      (portfolio.js / gallery.js / index.html). Adding a card to the
 *      dashboard therefore adds it to this list automatically — there is
 *      no second list to keep in sync, which was the actual bug.
 *   2. getDashboardCards() reads those attributes from the live DOM, so
 *      a card that is not rendered (e.g. card-user-custom, which only
 *      exists when the user has custom dashboard cards) does not appear
 *      as a toggle for a card that is not there.
 *   3. The visibility STATE lives in one localStorage key,
 *      'cc-card-visibility', which is the key portfolio.js already reads
 *      when it renders the dashboard. Both UIs now use it.
 *
 * The two consumers:
 *   - modals.js buildCardVisibilityRows()  (Settings > Appearance)
 *   - settingsDropdown.js showCardVisibilityModal()  (Settings dropdown)
 *
 * Both now call getDashboardCards() and setCardVisible(), so they can
 * never drift apart again.
 *
 * THE COLD-OPEN RACE
 * -------------------
 * The dashboard renders ASYNCHRONOUSLY. Measured on the preview the grid
 * populates at t=3.5s after load, so a panel opened at t=0 sees an empty
 * grid and would render a ONE-row list (only card-search) while the
 * dashboard goes on to render 15 cards. A fixed timeout is the wrong tool
 * — the dashboard can take longer than any fixed budget.
 *
 * So the list is not a one-shot snapshot. watchDashboardCards() reports
 * every change to the rendered card set, and a consumer that keeps its
 * panel open re-derives from it. A cold open therefore corrects itself
 * the moment the dashboard renders, without the user reopening the panel.
 */

// The card elements live in the dashboard grid, plus the search card,
// which the app renders OUTSIDE the grid (it is a full-width bar above
// the catalog) but which is still a card the user may want to hide.
const CARD_SELECTOR = '#dashboard-grid > [id^="card-"], #card-search';

/**
 * Return the dashboard cards that are currently rendered, in DOM order.
 *
 * Each entry is { id, label, desc }. `label` and `desc` come from the
 * card's own data-card-label / data-card-desc attributes, so the list can
 * never disagree with the card it describes.
 *
 * @returns {Array<{id: string, label: string, desc: string}>}
 */
export function getDashboardCards() {
    const out = [];
    const seen = new Set();
    document.querySelectorAll(CARD_SELECTOR).forEach(el => {
        const id = el.id;
        if (!id || seen.has(id)) return;
        seen.add(id);
        out.push({
            id,
            label: (el.getAttribute('data-card-label') || '').trim(),
            desc: (el.getAttribute('data-card-desc') || '').trim(),
        });
    });
    return out;
}

/**
 * Read the whole visibility map from localStorage.
 * @returns {Object<string, boolean>} card id -> visible
 */
export function getCardVisibilityMap() {
    try {
        const raw = localStorage.getItem('cc-card-visibility');
        const parsed = raw ? JSON.parse(raw) : {};
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) {
        return {};
    }
}

/**
 * Is this card currently visible? A card is visible unless it has been
 * explicitly hidden (stored as false).
 * @param {string} id card id
 * @returns {boolean}
 */
export function isCardVisible(id) {
    return getCardVisibilityMap()[id] !== false;
}

/**
 * Show or hide a dashboard card and persist the choice.
 *
 * The card element is hidden in place so the change is visible
 * immediately; the state is ALSO written to 'cc-card-visibility', which
 * is what portfolio.js reads when it next renders the dashboard, so the
 * card stays hidden across a reload.
 *
 * @param {string} id card id
 * @param {boolean} visible whether the card should be shown
 * @returns {boolean} the new visible state
 */
export function setCardVisible(id, visible) {
    const map = getCardVisibilityMap();
    if (visible) {
        delete map[id];
    } else {
        map[id] = false;
    }
    try {
        localStorage.setItem('cc-card-visibility', JSON.stringify(map));
    } catch (e) {
        console.warn('[dashboardCards] could not persist card visibility:', e);
    }

    // Apply to the live element so the toggle has a visible effect now.
    // card-search lives outside the grid, so it is looked up by id
    // directly rather than through the grid.
    const el = document.getElementById(id);
    if (el) {
        el.style.display = visible ? '' : 'none';
    }

    return visible;
}

/**
 * Watch the rendered card set and call back whenever it changes.
 *
 * The dashboard renders asynchronously, so a consumer that builds its
 * list once can capture an empty grid. This reports the moment the
 * dashboard populates, so the consumer can re-derive.
 *
 * The returned function stops the watch. Callers MUST call it when they
 * are done, otherwise the observer leaks and keeps a detached modal
 * alive.
 *
 * @param {(cards: Array<{id: string, label: string, desc: string}>) => void} onChange
 * @returns {() => void} stop function
 */
export function watchDashboardCards(onChange) {
    if (typeof MutationObserver === 'undefined') return () => {};

    const grid = document.getElementById('dashboard-grid');
    if (!grid) return () => {};

    let signature = null;
    const report = () => {
        const cards = getDashboardCards();
        const next = cards.map(c => c.id).join(',');
        // Only report an actual change in the SET of cards. The observer
        // also fires for content changes inside a card (a price ticking
        // over), and rebuilding the panel for those would be wasteful
        // and would fight the user's focus.
        if (next === signature) return;
        signature = next;
        onChange(cards);
    };

    const observer = new MutationObserver(report);
    observer.observe(grid, { childList: true });
    return () => observer.disconnect();
}
