/**
 * themes.js — Coin Catalog v2
 * Theme switching and custom theme slot management.
 * @module themes
 */

import { showToast } from './notifications.js';

/**
 * Custom theme slot names (Matthew, 2026-09-25).
 *
 * The three custom slots are USER-NAMABLE. Names default to "Custom N" and
 * the value the user types in the Theme Designer is what appears in the
 * theme <select>, the Settings theme list, and the tour. Nothing in the app
 * invents a name for a slot.
 *
 * Stored as plain text in localStorage. Everything that reads a name uses
 * textContent, never innerHTML, so a name can never inject markup.
 */
const NAME_KEY = slot => `cc-custom-theme-name-${slot}`;

/** Strip control characters, collapse whitespace, cap length. */
export function sanitizeThemeName(raw, slot) {
    const fallback = `Custom ${slot}`;
    if (typeof raw !== 'string') return fallback;
    const cleaned = raw
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40);
    return cleaned || fallback;
}

/** The user-chosen name for a slot, or "Custom N" when never set. */
export function getCustomThemeName(slot) {
    try {
        return sanitizeThemeName(localStorage.getItem(NAME_KEY(slot)), slot);
    } catch {
        return `Custom ${slot}`;
    }
}

/** Save a user-chosen name and refresh every place the name is shown. */
export function setCustomThemeName(slot, raw) {
    const name = sanitizeThemeName(raw, slot);
    try { localStorage.setItem(NAME_KEY(slot), name); } catch { /* quota */ }
    applyCustomThemeNames();
    return name;
}

/**
 * Push the stored names into the theme <select> options.
 *
 * Only the option TEXT changes; the option value stays "customN" so nothing
 * about theme application or storage has to change.
 */
export function applyCustomThemeNames() {
    const sel = document.getElementById('theme-selector');
    if (!sel) return;
    for (let slot = 1; slot <= 3; slot++) {
        const opt = sel.querySelector(`option[data-custom-slot="${slot}"]`);
        if (opt) opt.textContent = getCustomThemeName(slot);
    }
    if (typeof window !== 'undefined') window.ccCustomThemeNames = {
        1: getCustomThemeName(1),
        2: getCustomThemeName(2),
        3: getCustomThemeName(3),
    };
    // Settings renders its own list from a static array; tell it to rebuild.
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cc-theme-names-changed'));
    }
}

/** Apply a theme by name. Called by the <select> onchange and on boot. */
export function setTheme(name) {
    // Handle "Theme Designer" pseudo-theme - open designer instead of applying theme
    if (name === 'custom-designer') {
        const sel = document.getElementById('theme-selector');
        if (sel) {
            // Reset to previously saved theme
            const saved = localStorage.getItem('cc-theme');
            if (saved && saved !== 'custom-designer') {
                sel.value = saved;
            } else {
                sel.value = 'dark'; // fallback
            }
        }
        // Open the custom theme designer (same as Settings dropdown)
        if (typeof openCustomThemeDesigner === 'function') {
            openCustomThemeDesigner(1);
        }
        return;
    }
    
    document.documentElement.setAttribute('data-theme', name);
    document.body.setAttribute('data-theme', name);
    localStorage.setItem('cc-theme', name);
    const sel = document.getElementById('theme-selector');
    if (sel) sel.value = name;
}

/** Load and apply any saved custom theme CSS variables for slots 1-3. */
export function loadCustomThemes() {
    for (let slot = 1; slot <= 3; slot++) {
        const saved = localStorage.getItem(`cc-custom-theme-${slot}`);
        if (saved) {
            try { applyCustomThemeVars(slot, JSON.parse(saved)); }
            catch { /* Ignore corrupt data */ }
        }
    }
}

/**
 /** Apply a custom theme's color variables to :root so they're available
  * when the matching [data-theme="customN"] selector is active.
  *
  * Each slot gets its OWN variable namespace so changing one custom theme
  * does NOT affect the others.
  *
  * @param {number} slot   - 1, 2, or 3.
  * @param {Object} colors - Map of CSS var name → color value.
  */
 function applyCustomThemeVars(slot, colors) {
     const root = document.documentElement;
     for (const [key, val] of Object.entries(colors)) {
         // Keys are stored as "color-bg-body" but CSS vars are "--custom1-bg-body"
         const cssKey = key.replace(/^color-/, '');
         root.style.setProperty(`--custom${slot}-${cssKey}`, val);
     }
 }

/**
 * Save and apply a custom theme.
 *
 * @param {number} slot   - 1, 2, or 3.
 * @param {Object} colors - Map of property names → color strings.
 */
export function saveCustomTheme(slot, colors, name) {
    localStorage.setItem(`cc-custom-theme-${slot}`, JSON.stringify(colors));
    applyCustomThemeVars(slot, colors);
    if (typeof name === 'string') setCustomThemeName(slot, name);
    setTheme(`custom${slot}`);
    showToast(`${getCustomThemeName(slot)} saved`, 'success');
}

// Expose to window for index.html onchange handler
window.setTheme = setTheme;
window.getCustomThemeName = getCustomThemeName;
window.setCustomThemeName = setCustomThemeName;
window.applyCustomThemeNames = applyCustomThemeNames;

// Load custom themes on module init
loadCustomThemes();
applyCustomThemeNames();
