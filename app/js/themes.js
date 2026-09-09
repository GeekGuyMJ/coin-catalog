/**
 * themes.js — Coin Catalog v2
 * Theme switching and custom theme slot management.
 * @module themes
 */

import { showToast } from './notifications.js';

/** Apply a theme by name. Called by the <select> onchange and on boot. */
export function setTheme(name) {
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
export function saveCustomTheme(slot, colors) {
    localStorage.setItem(`cc-custom-theme-${slot}`, JSON.stringify(colors));
    applyCustomThemeVars(slot, colors);
    setTheme(`custom${slot}`);
    showToast(`Custom Theme ${slot} saved`, 'success');
}

// Expose to window for index.html onchange handler
window.setTheme = setTheme;

// Load custom themes on module init
loadCustomThemes();
