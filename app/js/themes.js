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

 /** Load and apply saved quick theme CSS variables. */
 export function loadQuickTheme() {
     const saved = localStorage.getItem('cc-quick-theme');
     if (saved) {
         try { applyQuickThemeVars(JSON.parse(saved)); }
         catch { /* Ignore corrupt data */ }
     }
 }

 /** Apply quick theme's color variables to :root. */
 function applyQuickThemeVars(colors) {
     const root = document.documentElement;
     for (const [key, val] of Object.entries(colors)) {
         const cssKey = key.replace(/^color-/, '');
         root.style.setProperty(`--quick-${cssKey}`, val);
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
window.openCustomThemeDesigner = openCustomThemeDesigner;

/**
 * Derive WCAG-compliant text, muted text, borders, sub-panels from 4 core colors.
 * Given 4 base colors (bg-body, bg-card, header-bar, accent), computes readable
 * text colors and supporting palette for the custom theme designer.
 *
 * @param {Object} colors - 4 color values keyed by CSS var name
 *   (color-bg-body, color-bg-card, color-header-bg, color-accent)
 * @returns {Object} Full palette including derived text/muted/border/accent-bg colors
 */
export function deriveReadableFrom4Colors(colors) {
    const bgBody = colors['color-bg-body'] || '#121212';
    const bgCard = colors['color-bg-card'] || '#1e1e1e';
    const headerBg = colors['color-header-bg'] || '#000000';
    const accent = colors['color-accent'] || '#d8a54a';

    // Derive text color from background luminance
    const getTextColor = (bg) => {
        const rgb = hexToRgb(bg);
        const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return lum > 0.6 ? '#000000' : '#ffffff';
    };

    // Derive muted text (darker/lighter variant of main text)
    const getMutedColor = (textColor, bg) => {
        if (textColor === '#ffffff') return 'rgba(255,255,255,0.6)';
        return 'rgba(0,0,0,0.5)';
    };

    // Derive border from card background (slightly lighter/darker)
    const getBorderColor = (bg) => {
        const rgb = hexToRgb(bg);
        const r = Math.min(255, Math.max(0, rgb.r + 30));
        const g = Math.min(255, Math.max(0, rgb.g + 30));
        const b = Math.min(255, Math.max(0, rgb.b + 30));
        return `rgb(${r},${g},${b})`;
    };

    // Derive accent background from accent color (lower opacity panel)
    const getAccentBg = (accentColor) => {
        const rgb = hexToRgb(accentColor);
        return `rgba(${rgb.r},${rgb.g},${rgb.b},0.1)`;
    };

    const textMain = getTextColor(bgBody);
    const textMuted = getMutedColor(textMain, bgBody);
    const border = getBorderColor(bgCard);
    const accentBg = getAccentBg(accent);
    const headerText = getTextColor(headerBg);

    return {
        color-bg-body: bgBody,
        color-bg-card: bgCard,
        color-header-bg: headerBg,
        color-accent: accent,
        color-text-main: textMain,
        color-text-muted: textMuted,
        color-accent-text: textMain === '#ffffff' ? '#000000' : '#ffffff',
        color-border: border,
        color-border-light: border,
        color-header-text: headerText,
        color-accord-bg: accentBg,
        color-finance-bg: accentBg,
    };
}

/** Convert hex color to RGB object. */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
}

// Load custom themes on module init
loadCustomThemes();
loadQuickTheme();
