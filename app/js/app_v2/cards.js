/**
 * COIN & COLLECTABLE CATALOG V2 — MODULE: CARDS.JS
 * Complete Production Accordion Engine with Parent-Group Cascade Toggling
 *
 * Renders the Cards modal with:
 *  1. Dashboard widget toggles
 *  2. Nested accordion schema for all coin series → subtypes
 *  3. Parent-group master checkboxes that cascade to all children
 *  4. "Unhide All & Reset Layout" button
 *  5. "Save Display Layout" and "Cancel" footer buttons
 *  6. Real-time visibility filtering wired to catalog DOM
 */

import {
    state,
    resetGlobalLayoutAndVisibility,
    subscribeToState,
    getWidgets,
    setWidgetState,
    getSubTypesVisibility,
    setSubTypeState,
} from './state.js';
import { openModal, closeModal, registerModal } from './modals.v2.js';

// ============================================================
// ACCORDION_SCHEMA — nested series → subtypes data model
// Exported for use by catalog.js to map coin types to visibility keys.
// Keys MUST match DEFAULT_SUBTYPES in state.js.
// ============================================================
export const ACCORDION_SCHEMA = {
    // ── Half Cent ──────────────────────────────────────────────
    "us-half-cent": {
        title: "US Coinage — Half Cent",
        subtypes: {
            "braided-hair-half-cent":     "Braided Hair Half Cent",
            "classic-head-half-cent":     "Classic Head Half Cent",
            "draped-bust-half-cent":      "Draped Bust Half Cent",
            "liberty-cap-half-cent":      "Liberty Cap Half Cent",
        },
    },
    // ── Large & Small Cent ────────────────────────────────────
    "us-large-small-cent": {
        title: "US Coinage — Large & Small Cent",
        subtypes: {
            "flowing-hair-large":         "Flowing Hair Large Cent",
            "liberty-cap-large":          "Liberty Cap Large Cent",
            "draped-bust-large":          "Draped Bust Large Cent",
            "classic-head-large":         "Classic Head Large Cent",
            "coronet-matron-head":        "Coronet / Matron Head",
            "braided-hair-large":         "Braided Hair Large Cent",
            "flying-eagle-cent":          "Flying Eagle Cent",
            "indian-head-cent":           "Indian Head Cent",
            "lincoln-wheat-cent":         "Lincoln Wheat Cent",
            "lincoln-memorial-cent":      "Lincoln Memorial Cent",
            "lincoln-shield-cent":        "Lincoln Shield Cent",
        },
    },
    // ── Two Cent ──────────────────────────────────────────────
    "us-two-cent": {
        title: "US Coinage — Two Cent",
        subtypes: {
            "two-cent-piece":             "Two Cent Piece",
        },
    },
    // ── Three Cent ────────────────────────────────────────────
    "us-three-cent": {
        title: "US Coinage — Three Cent",
        subtypes: {
            "three-cent-silver":          "Three Cent Silver",
            "three-cent-nickel":          "Three Cent Nickel",
        },
    },
    // ── Half Dime ─────────────────────────────────────────────
    "us-half-dime": {
        title: "US Coinage — Half Dime",
        subtypes: {
            "half-dime-flowing-hair":     "Flowing Hair Half Dime",
            "half-dime-draped-bust":      "Draped Bust Half Dime",
            "half-dime-capped-bust":      "Capped Bust Half Dime",
            "half-dime-seated-liberty":   "Seated Liberty Half Dime",
        },
    },
    // ── Five Cent Nickel ──────────────────────────────────────
    "us-five-cent": {
        title: "US Coinage — Five Cent Nickel",
        subtypes: {
            "five-cent-shield":           "Shield Nickel",
            "five-cent-liberty-v":        "Liberty V Nickel",
            "five-cent-buffalo":          "Buffalo Nickel",
            "five-cent-jefferson":        "Jefferson Nickel",
        },
    },
    // ── Dime ──────────────────────────────────────────────────
    "us-dime": {
        title: "US Coinage — Dime",
        subtypes: {
            "dime-draped-bust":           "Draped Bust Dime",
            "dime-capped-bust":           "Capped Bust Dime",
            "dime-seated-liberty":        "Seated Liberty Dime",
            "dime-barber":                "Barber Dime",
            "dime-mercury":               "Mercury Dime",
            "dime-roosevelt":             "Roosevelt Dime",
        },
    },
    // ── Twenty Cent ───────────────────────────────────────────
    "us-twenty-cent": {
        title: "US Coinage — Twenty Cent",
        subtypes: {
            "twenty-cent-piece":          "Twenty Cent Piece",
        },
    },
    // ── Quarter Dollar ────────────────────────────────────────
    "us-quarter": {
        title: "US Coinage — Quarter Dollar",
        subtypes: {
            "quarter-capped-bust":        "Capped Bust Quarter",
            "quarter-seated-liberty":     "Seated Liberty Quarter",
            "quarter-barber":             "Barber Quarter",
            "quarter-standing-liberty":   "Standing Liberty Quarter",
            "quarter-washington":         "Washington Quarter",
            "quarter-50-state":           "50 State Quarters",
            "quarter-dc-territories":     "DC & US Territories",
            "quarter-atb":                "America the Beautiful",
            "quarter-american-women":     "American Women",
        },
    },
    // ── Half Dollar ───────────────────────────────────────────
    "us-half-dollar": {
        title: "US Coinage — Half Dollar",
        subtypes: {
            "half-dollar-flowing-hair":   "Flowing Hair Half Dollar",
            "half-dollar-draped-bust":    "Draped Bust Half Dollar",
            "half-dollar-capped-bust":    "Capped Bust Half Dollar",
            "half-dollar-seated-liberty": "Seated Liberty Half Dollar",
            "half-dollar-barber":         "Barber Half Dollar",
            "half-dollar-walking-liberty":"Walking Liberty Half Dollar",
            "half-dollar-franklin":       "Franklin Half Dollar",
            "half-dollar-kennedy":        "Kennedy Half Dollar",
        },
    },
    // ── Dollar ────────────────────────────────────────────────
    "us-dollar": {
        title: "US Coinage — Dollar",
        subtypes: {
            "dollar-early":               "Early Dollars",
            "dollar-seated-liberty":      "Seated Liberty Dollar",
            "dollar-morgan":              "Morgan Dollar",
            "dollar-peace":               "Peace Dollar",
            "dollar-eisenhower":          "Eisenhower Dollar",
            "dollar-susan-b-anthony":     "Susan B. Anthony",
            "dollar-sacagawea":           "Sacagawea Dollar",
            "dollar-presidential":        "Presidential Dollar",
            "dollar-innovation":          "American Innovation",
        },
    },
    // ── US Gold — Circulation ─────────────────────────────────
    "us-gold-circulation": {
        title: "US Gold — Circulation",
        subtypes: {
            "gold-one-dollar":            "$1 Gold Piece",
            "gold-quarter-eagle":         "$2.50 Quarter Eagle",
            "gold-three-dollar":          "$3 Gold Piece",
            "gold-half-eagle":            "$5 Half Eagle",
            "gold-eagle":                 "$10 Eagle",
            "gold-double-eagle":          "$20 Double Eagle",
        },
    },
    // ── US Bullion — Silver ───────────────────────────────────
    "us-bullion-silver": {
        title: "US Bullion — Silver",
        subtypes: {
            "silver-eagle-bullion":       "American Silver Eagle",
        },
    },
    // ── US Bullion — Gold ─────────────────────────────────────
    "us-bullion-gold": {
        title: "US Bullion — Gold",
        subtypes: {
            "gold-eagle-bullion":         "American Gold Eagle",
            "gold-buffalo-bullion":       "American Gold Buffalo",
        },
    },
    // ── US Bullion — Platinum & Palladium ─────────────────────
    "us-bullion-plat-pal": {
        title: "US Bullion — Platinum & Palladium",
        subtypes: {
            "platinum-eagle-bullion":     "Platinum Eagle",
            "palladium-eagle-bullion":    "Palladium Eagle",
        },
    },
    // ── US Commemoratives ─────────────────────────────────────
    "us-commemoratives": {
        title: "US Commemoratives",
        subtypes: {
            "early-commemorative":        "Classic Era (1892–1954)",
            "modern-commemorative":       "Modern Era (1982–Present)",
        },
    },
    // ── Canadian Coinage ──────────────────────────────────────
    "ca-cent": {
        title: "Canadian Coinage — Cent",
        subtypes: {
            "ca-one-cent-spec":           "Large & Small Cents",
        },
    },
    "ca-five-cent": {
        title: "Canadian Coinage — Five Cent",
        subtypes: {
            "ca-five-cent-spec":          "Silver & Nickel 5¢",
        },
    },
    "ca-ten-cent": {
        title: "Canadian Coinage — Ten Cent",
        subtypes: {
            "ca-ten-cent-spec":           "Dime Series",
        },
    },
    "ca-twenty-five-cent": {
        title: "Canadian Coinage — Twenty-Five Cent",
        subtypes: {
            "ca-quarter-spec":            "Quarter Series",
        },
    },
    "ca-fifty-cent": {
        title: "Canadian Coinage — Fifty Cent",
        subtypes: {
            "ca-half-dollar-spec":        "Half Dollar Series",
        },
    },
    "ca-dollar": {
        title: "Canadian Coinage — Dollar",
        subtypes: {
            "ca-silver-dollar-spec":      "Voyageur & Commemorative",
            "ca-loonie-spec":             "Loonie ($1)",
        },
    },
    "ca-two-dollar": {
        title: "Canadian Coinage — Two Dollar",
        subtypes: {
            "ca-toonie-spec":             "Toonie ($2)",
        },
    },
};

// ============================================================
// Public entry point
// ============================================================
export function initializeCardsManager() {
    const container = document.getElementById('cards-modal-container');
    if (!container) return;

    registerModal('cards-modal-container', container);
    renderDashboardStructure(container);
    bindEvents(container);
    syncStateToCheckboxes();

    subscribeToState(({ path }) => {
        if (path === 'widgets' || path === 'subTypesVisibility' || path === 'system.reset') {
            syncStateToCheckboxes();
        }
    });
}

// ============================================================
// Render the full modal structure
// ============================================================
function renderDashboardStructure(container) {
    container.innerHTML = `
    <div class="modal-card-content">
        <div class="modal-card-header">
            <h2>Dashboard Cards</h2>
            <button id="btn-unhide-all" class="btn-action-reset">Unhide All &amp; Reset Layout</button>
        </div>
        <div class="modal-card-body">
            <section class="layer-section">
                <h3>DASHBOARD WIDGETS</h3>
                <div class="widgets-checkbox-grid" id="widgets-group"></div>
            </section>
            <hr class="divider" />
            <section class="layer-section">
                <h3>COIN CATEGORIES</h3>
                <div class="accordion-container" id="categories-accordion"></div>
            </section>
        </div>
        <div class="modal-card-footer">
            <button class="btn-footer-save" id="cards-save-btn">Save Display Layout</button>
            <button class="btn-footer-cancel" id="cards-cancel-btn">Cancel</button>
        </div>
    </div>`;
}

// ============================================================
// Bind all interactions
// ============================================================
function bindEvents(container) {
    // Save / Cancel
    container.querySelector('#cards-save-btn').addEventListener('click', () => closeModal('cards-modal-container'));
    container.querySelector('#cards-cancel-btn').addEventListener('click', () => closeModal('cards-modal-container'));

    // Unhide All
    container.querySelector('#btn-unhide-all').addEventListener('click', () => resetGlobalLayoutAndVisibility());

    const accordionBox = container.querySelector('#categories-accordion');

    // Render full accordion dynamically from ACCORDION_SCHEMA
    accordionBox.innerHTML = Object.keys(ACCORDION_SCHEMA).map(key => {
        const data = ACCORDION_SCHEMA[key];
        return `
        <div class="accordion-item-wrapper" data-series="${escAttr(key)}">
            <div class="accordion-trigger-row">
                <div class="header-left-cluster">
                    <input type="checkbox" class="group-master-checkbox" data-series-key="${escAttr(key)}">
                    <span class="title-text-click">► ${escHtml(data.title)}</span>
                </div>
            </div>
            <div class="accordion-content-panel is-hidden">
                <div class="subtype-checkbox-grid">
                    ${Object.keys(data.subtypes).map(subKey => `
                    <label class="subtype-item-label">
                        <input type="checkbox" class="child-checkbox" data-subtype-key="${escAttr(subKey)}">
                        <span>${escHtml(data.subtypes[subKey])}</span>
                    </label>`).join('')}
                </div>
            </div>
        </div>`;
    }).join('');

    // 1. Accordion expansion toggle
    accordionBox.querySelectorAll('.title-text-click').forEach(span => {
        span.addEventListener('click', (e) => {
            const wrapper = e.target.closest('.accordion-item-wrapper');
            const panel = wrapper.querySelector('.accordion-content-panel');
            const isCollapsed = panel.classList.toggle('is-hidden');
            span.textContent = `${isCollapsed ? '►' : '▼'} ${ACCORDION_SCHEMA[wrapper.dataset.series].title}`;
        });
    });

    // 2. Parent-group Master Checkbox → cascade to all children
    accordionBox.querySelectorAll('.group-master-checkbox').forEach(masterBox => {
        masterBox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const wrapper = e.target.closest('.accordion-item-wrapper');
            wrapper.querySelectorAll('.child-checkbox').forEach(childBox => {
                childBox.checked = isChecked;
                setSubTypeState(childBox.dataset.subtypeKey, isChecked);
                applyRowVisibility('subtype', childBox.dataset.subtypeKey, isChecked);
            });
        });
    });

    // 3. Individual child checkbox → update state + sync master
    accordionBox.querySelectorAll('.child-checkbox').forEach(childBox => {
        childBox.addEventListener('change', (e) => {
            const subKey = e.target.dataset.subtypeKey;
            const isChecked = e.target.checked;
            const wrapper = e.target.closest('.accordion-item-wrapper');
            const masterBox = wrapper.querySelector('.group-master-checkbox');

            setSubTypeState(subKey, isChecked);
            applyRowVisibility('subtype', subKey, isChecked);

            // Auto-uncheck master if any child unchecked; re-check if all checked
            const allChildren = [...wrapper.querySelectorAll('.child-checkbox')];
            masterBox.checked = allChildren.every(c => c.checked);
        });
    });

    // 4. Widget checkboxes (delegated from #widgets-group)
    const widgetBox = container.querySelector('#widgets-group');
    widgetBox.addEventListener('change', (e) => {
        if (!e.target.classList.contains('widget-checkbox')) return;
        const key = e.target.dataset.widgetKey;
        const isChecked = e.target.checked;
        setWidgetState(key, isChecked);
        applyRowVisibility('widget', key, isChecked);
    });
}

// ============================================================
// Sync state → checkboxes (for resets / external changes)
// ============================================================
function syncStateToCheckboxes() {
    const container = document.getElementById('cards-modal-container');
    if (!container) return;

    const widgets = getWidgets();
    const subtypes = getSubTypesVisibility();

    // Rebuild widget checkboxes
    const widgetBox = container.querySelector('#widgets-group');
    widgetBox.innerHTML = Object.keys(widgets).map(key => {
        const isChecked = widgets[key] ? 'checked' : '';
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        return `
        <label class="widget-item-label">
            <input type="checkbox" class="widget-checkbox" data-widget-key="${escAttr(key)}" ${isChecked}>
            <span>${escHtml(label)}</span>
        </label>`;
    }).join('');

    // Sync accordion child + master checkboxes
    container.querySelectorAll('.accordion-item-wrapper').forEach(wrapper => {
        const masterBox = wrapper.querySelector('.group-master-checkbox');
        const childBoxes = [...wrapper.querySelectorAll('.child-checkbox')];

        childBoxes.forEach(cb => {
            const subKey = cb.dataset.subtypeKey;
            const targetState = subtypes[subKey] !== false; // undefined → true (default visible)
            cb.checked = targetState;
            applyRowVisibility('subtype', subKey, targetState);
        });

        masterBox.checked = childBoxes.every(c => c.checked);
    });
}

// ============================================================
// Visibility enforcement — DOM manipulation
// ============================================================
function applyRowVisibility(type, key, isVisible) {
    const selector = type === 'widget'
        ? `[data-dashboard-widget="${CSS.escape(key)}"]`
        : `[data-coin-subtype="${CSS.escape(key)}"]`;
    document.querySelectorAll(selector).forEach(el => {
        if (isVisible) el.classList.remove('is-hidden');
        else el.classList.add('is-hidden');
    });
}

// ============================================================
// Utility helpers
// ============================================================
function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escAttr(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}