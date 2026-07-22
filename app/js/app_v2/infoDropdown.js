/**
 * infoDropdown.js - Coin Catalog v2
 * Info button dropdown menu (replaces the full-screen blurred Help modal).
 * Clicking "Info" opens a small popover with categorized info options;
 * each option opens a clean, readable modal.
 */

import { el, escHtml } from './utils.js?v=4';
import { createModal, closeModal } from './modals.v2.js?v=4';

let _dropdownEl = null;
let _storiesCache = null;

// ---------------------------------------------------------------------------
// Dropdown toggle
// ---------------------------------------------------------------------------
export function toggleInfoDropdown(evt) {
 evt?.stopPropagation();
 const btn = document.getElementById('btn-info');
 if (!btn) return;

 if (_dropdownEl && _dropdownEl.classList.contains('open')) {
 closeInfoDropdown();
 return;
 }
 openInfoDropdown(btn);
}

export function closeInfoDropdown() {
 if (_dropdownEl) {
 _dropdownEl.classList.remove('open');
 _dropdownEl.remove();
 _dropdownEl = null;
 }
 const btn = document.getElementById('btn-info');
 if (btn) btn.setAttribute('aria-expanded', 'false');
 document.removeEventListener('click', _outsideHandler, true);
 document.removeEventListener('keydown', _escHandler, true);
}

function _outsideHandler(e) {
 if (_dropdownEl && !_dropdownEl.contains(e.target) && e.target.id !== 'btn-info') {
 closeInfoDropdown();
 }
}

function _escHandler(e) {
 if (e.key === 'Escape') closeInfoDropdown();
}

function openInfoDropdown(btn) {
 closeInfoDropdown();

 const items = [
  { key: 'about', label: 'About the App' },
  { key: 'values', label: 'How Values Work' },
  { key: 'coinTips', label: 'Coin Collecting Tips' },
  { key: 'noteTips', label: 'Note Collecting Tips' },
  { key: 'famousStories', label: 'Famous Coin Stories' },
  { key: 'rollHunting', label: 'Roll Hunting Tips' },
  { key: 'donate', label: 'Support This App' },
  { key: 'privacy', label: 'Privacy & Reporting Bugs' },
  ];

 const menu = el('div', { className: 'info-menu', role: 'menu' });
 items.forEach(it => {
 const item = el('button', {
 className: 'info-menu-item',
 role: 'menuitem',
 type: 'button',
 onclick: () => { closeInfoDropdown(); openInfoSection(it.key); },
 });
 item.appendChild(el('span', { className: 'info-menu-label' }, it.label));
 menu.appendChild(item);
 });

 _dropdownEl = el('div', { className: 'info-dropdown open', role: 'dialog', 'aria-label': 'Info menu' }, menu);

 document.body.appendChild(_dropdownEl);

 // Position under the Info button (clamped to viewport)
 const rect = btn.getBoundingClientRect();
 const ddW = 240;
 let left = rect.right - ddW + window.scrollX;
 if (left < 8) left = 8;
 const top = rect.bottom + 8 + window.scrollY;
 _dropdownEl.style.top = top + 'px';
 _dropdownEl.style.left = left + 'px';
 _dropdownEl.style.width = ddW + 'px';

 if (btn) btn.setAttribute('aria-expanded', 'true');

 document.addEventListener('click', _outsideHandler, true);
 document.addEventListener('keydown', _escHandler, true);
}

// ---------------------------------------------------------------------------
// Section content
// ---------------------------------------------------------------------------
function _sectionBody(title, intro, blocks) {
 const body = el('div', { className: 'info-section-body' });
 if (intro) body.appendChild(el('p', { className: 'info-intro' }, intro));
 blocks.forEach(b => {
 if (b.heading) body.appendChild(el('h4', { className: 'info-subhead' }, b.heading));
 if (b.text) body.appendChild(el('p', { className: 'info-text' }, b.text));
 if (b.list) {
 const ul = el('ul', { className: 'info-list' });
 b.list.forEach(li => ul.appendChild(el('li', {}, li)));
 body.appendChild(ul);
 }
 });
 return body;
}

export function openInfoSection(key) {
 switch (key) {
 case 'about': return showAbout();
 case 'values': return showValues();
 case 'coinTips': return showCoinTips();
 case 'noteTips': return showNoteTips();
 case 'famousStories': return showFamousStories();
 case 'rollHunting': return showRollHunting();
 case 'donate': return showDonate();
 case 'privacy': return showPrivacy();
 }
}

// --- About ---------------------------------------------------------------
function showAbout() {
 const version = window.APP_VERSION || 'dev';
 const body = _sectionBody(
 'About Coin Catalog v2',
 `Version ${version}`,
 [
 { text: 'A self-hosted coin and collectable collection tracker with live metal prices, album view, and inventory management.' },
 { heading: 'What it does', list: [
 'Tracks 6,400+ US coin types across albums and sections',
 'Live gold / silver / platinum / palladium / copper spot prices',
 'Per-coin and per-type images, with cropping and master-image promotion',
 'Inventory, bullion, scrap metal, paper currency, and other collectables',
 'Portfolio valuation using melt vs. collectable "waterfall" logic',
 ]},
 { heading: 'Tips', list: [
 'Click a coin hole in album view to add it to your inventory',
 'Right-click a coin for quick actions',
 'Use the search bar to filter by year, type, or mint mark',
 'Export your data regularly via Settings → Data & Backup',
 ]},
 ]
 );
 createModal('modal-info-about', 'About the App', body, null);
}

// --- How Values Work -----------------------------------------------------
function showValues() {
 const body = _sectionBody(
 'How Values Work',
 'Every figure in the Portfolio Overview is built from a small set of rules. This explains each source, how individual coins and bulk lots are priced, and how the totals are added up — so the number at the bottom is never a mystery.',
 [
 { heading: 'Two kinds of value', list: [
 'Melt value — the raw worth of the metal in a coin at the current live spot price (gold, silver, copper, platinum, palladium).',
 'Collectable (numismatic) value — what a coin is worth to collectors, based on type, date, grade, and rarity, not just its metal.',
 ]},
 { heading: 'Per-coin value (your inventory)', list: [
 'For each coin you own, the app picks the HIGHER of melt vs. collectable value (it never undervalues you).',
 'Collectable value uses a priority order: (1) a coin\'s own "Current Value" if you typed one, (2) its "Purchase Price" if set, (3) your custom Pricing Rule for that coin type, (4) a built-in catalog default. Face value is always the floor — a coin is never worth less than its denomination.',
 'If melt is higher than collectable (e.g. a 90% silver quarter when silver is high), the coin is counted under its metal\'s melt row; otherwise it lands in Collectible Premium.',
 'Key dates: a coin flagged as a key date uses your Pricing Rule\'s Key $ price instead of its Base $ price.',
 ]},
 { heading: 'Bulk Coins card', list: [
 'Bulk lots are priced by weight, not by individual coin.',
 'Copper Pennies (1959–1981) → melt value (95% copper × live copper $/lb). Shown in the card labeled "melt" and added to the Copper Coins Melt row.',
 '90% Silver Coins → melt value (90% silver × live silver $/oz). Shown labeled "melt" and added to the Silver Coins Melt row.',
 'All other bulk lots (Zinc pennies, Nickels, Clad dimes/quarters/halves) → estimated FACE value (coin count × denomination). Shown labeled "face" and added to the Bulk Coins row.',
 ]},
 { heading: 'Other categories', list: [
 'Raw Bullion — weight × purity × live spot for each metal.',
 'Scrap Metal — weight × purity × live spot.',
 'Paper Currency — the note\'s value, or denomination (×2 for star notes) if no value is entered.',
 'Other Collectibles — estimated value × quantity.',
 ]},
 { heading: 'How the Overview totals up', list: [
 'Gold / Silver / Copper / Platinum / Palladium Coins Melt — sum of every coin (individual + bulk) whose melt beat its collectable value, for that metal.',
 'Collectible Premium — sum of all coins counted on their collectable value.',
 'Raw Bullion, Bulk Coins, Scrap Metal, Paper Currency, Other Collectibles — each summed separately.',
 'Total Melt Value = Gold + Silver + Copper + Platinum + Palladium melt rows combined.',
 'Total Portfolio = Collectible Premium + Total Melt Value + Raw Bullion + Bulk Coins + Scrap Metal + Paper Currency + Other Collectibles.',
 ]},
 { heading: 'Editing Base & Key values (Pricing Rules)', list: [
 'Open Settings → Edit Pricing Rules.',
 'Each coin type has two fields: Base $ (ordinary date) and Key $ (key date). Type a value and it saves automatically.',
 'These override the built-in catalog defaults for that type and feed straight into the collectable-value calculation above.',
 'To value a single coin differently, set its own "Current Value" on the coin — that beats every rule.',
 ]},
 { heading: 'Spot prices', list: [
 'Melt figures depend on live spot prices shown on the Spot Prices card. If a price is missing or offline, melt values for that metal show as $0 until it updates.',
 ]},
 ]
 );
 createModal('modal-info-values', 'How Values Work', body, null);
}

// --- Coin Collecting Tips -------------------------------------------------
function showCoinTips() {
 const body = _sectionBody(
 'Coin Collecting Tips',
 'Practical advice for building and preserving a coin collection.',
 [
 { heading: 'Handling', list: [
 'Always hold coins by the edge — oils from your skin cause permanent toning and spots',
 'Never clean a coin. Cleaning destroys numismatic value even if it looks better',
 'Use soft vinyl-free (Mylar) flips, not PVC holders which leach chemicals',
 'Store in a cool, dry place; humidity drives corrosion',
 ]},
 { heading: 'Grading & Value', list: [
 'Learn the Sheldon scale (1–70) basics before buying',
 'Key date + low mintage + high grade = the coins worth the most',
 'Check for "full steps" (Jefferson nickels) and "full bands" (Mercury dimes)',
 'Mint errors and varieties often outvalue the base coin — research yours',
 ]},
 { heading: 'Buying', list: [
 'Buy the book before the coin — know the series',
 'Prefer certified (PCGS/NGC) coins for high-value purchases',
 'Condition rarity matters more than raw rarity for common dates',
 ]},
 ]
 );
 createModal('modal-info-coin', 'Coin Collecting Tips', body, null);
}

// --- Note (Paper Currency) Collecting Tips -------------------------------
function showNoteTips() {
 const body = _sectionBody(
 'Note Collecting Tips',
 'US paper currency (notes) have their own grading and rarity rules.',
 [
 { heading: 'Basics', list: [
 'Grade by the standard 1–70 scale; centering, margins, and color are key',
 'Star notes (★) are replacement notes — scarcer and more desirable',
 'Low serial numbers (00000001x) and fancy serials (radar, ladder, solid) command premiums',
 'Friedberg numbers (Fr. 230, etc.) identify the exact type',
 ]},
 { heading: 'What to look for', list: [
 'Egyptian / Emerald Bookmark errors and misprints',
 'Web press errors and cutting errors',
 'Older large-size notes (pre-1929) and National Bank Notes',
 'Star notes with low print runs (check the BEP production tables)',
 ]},
 { heading: 'Care', list: [
 'Store flat in acid-free currency sleeves — never fold',
 'Keep out of direct light to prevent fading',
 'Avoid humidity; use silica packets in storage boxes',
 ]},
 ]
 );
 createModal('modal-info-note', 'Note Collecting Tips', body, null);
}

// --- Famous Coin Stories --------------------------------------------------
async function showFamousStories() {
 const overlay = createModal('modal-info-stories', 'Famous Coin Stories',
 el('p', { className: 'info-intro' }, 'Loading stories…'), null);
 try {
 const data = await fetchStories();
 const body = el('div', { className: 'info-section-body' });
 const stories = (data.stories || []).filter(s => s.category === 'Famous Coin Stories' || !s.category);
 if (stories.length === 0 && data.stories) stories.push(...data.stories);
 stories.forEach(s => {
 body.appendChild(el('h4', { className: 'info-subhead' }, s.title));
 const c = el('div', { className: 'info-story' });
 c.innerHTML = s.content || '';
 body.appendChild(c);
 });
 const box = overlay.querySelector('.modal-body');
 if (box) box.replaceChildren(body);
 } catch (err) {
 const box = overlay.querySelector('.modal-body');
 if (box) box.textContent = 'Failed to load stories. Please try again later.';
 }
}

function fetchStories() {
 if (_storiesCache) return Promise.resolve(_storiesCache);
 return fetch('data/stories.json')
 .then(r => r.ok ? r.json() : { stories: [] })
 .then(d => { _storiesCache = d; return d; })
 .catch(() => ({ stories: [] }));
}

// --- Roll Hunting Tips ----------------------------------------------------
function showRollHunting() {
 const denoms = [
 { h: 'Pennies (1¢)', list: [
 '1909-S VDB — first year, key date',
 '1914-D — low mintage',
 '1922 (no D) — error, all 1922 cents came from Denver',
 '1943 copper — major error (should be steel); worth six figures',
 '1944 steel — error (should be copper)',
 '1955, 1969-S, 1972 doubled dies — strong doubling',
 'Wheat cents (pre-1959) for copper melt; 1982 is the date to check (small/large date, zinc vs copper)',
 ]},
 { h: 'Nickels (5¢)', list: [
 '1913 Liberty Head — only 5 known, legendary',
 '1937-D "3-legged" buffalo — missing front leg',
 '1942–1945 War Nickels — 35% silver (large mint mark above Monticello)',
 '1950-D — key date',
 ]},
 { h: 'Dimes (10¢)', list: [
 'Pre-1965 Roosevelt & Mercury — 90% silver',
 '1894-S Barber — 24 minted, among the rarest US coins',
 '1916-D Mercury — key date',
 '1982 (no mint mark) — error; all 1982 dimes should have a mark',
 ]},
 { h: 'Quarters (25¢)', list: [
 'Pre-1965 — 90% silver',
 '1932-D / 1932-S — first-year keys',
 '1970 — no 1970-D quarter was ever minted; a 1970-D is a famous error',
 '1976 Bicentennial — silver versions only in mint/proof sets',
 ]},
 { h: 'Half Dollars (50¢)', list: [
 '1964 Kennedy — 90% silver',
 '1965–1970 Kennedy — 40% silver',
 '1970-D Kennedy — low mintage, key date',
 '1982 (no mint mark) — error; all 1982 halves should have a mark',
 'Franklin and Walking Liberty halves — 90% silver pre-1964',
 ]},
 { h: 'Dollars ($1)', list: [
 'Morgan (1878–1921) & Peace (1921–1935) — 90% silver',
 'Eisenhower 1971–1976 (40% silver in proofs/souvenir sets)',
 '2000 "Cheerios" Sacagawea — enhanced tail feathers error',
 '2000 Wide AM — reverse design spacing error',
 ]},
 { h: 'Errors to look for in ANY denomination', list: [
 'Doubled dies (strong, offset lettering/date)',
 'Off-center strikes & broadstrikes',
 'Clipped planchets & wrong-planchet strikes',
 'Repunched / missing mint marks',
 'Mules (mismatched obverse/reverse)',
 ]},
 ];

 const body = _sectionBody(
 'Roll Hunting Tips',
 'What key dates and errors to look for when searching bank rolls and circulation.',
 denoms
 );
 createModal('modal-info-roll', 'Roll Hunting Tips', body, null);
}

// --- Privacy & Reporting Bugs --------------------------------------------
function showPrivacy() {
 const version = window.APP_VERSION || 'dev';
 const body = _sectionBody(
 'Privacy & Reporting Bugs',
 `Coin Catalog v2 — ${version}`,
 [
 { heading: 'Your data stays yours', list: [
 'All collection data is stored locally on your self-hosted server',
 'No accounts, no telemetry, no third-party analytics',
 'Live spot prices are fetched from a public metals API only',
 'Export anytime from Settings → Data & Backup',
 ]},
 { heading: 'Reporting a bug', list: [
 'Through Telegram: message the catalog bot with a description and screenshot',
 'By email: send details to the address configured for your deployment',
 'Include: what you did, what happened, and your browser/device',
 'Check the browser console (F12) for red errors to include',
 ]},
 { heading: 'Updating', list: [
 'Pull the latest container image and restart to receive fixes',
 'Hard-refresh (Ctrl+Shift+R) after updates to clear cached assets',
 ]},
 ]
 );
 createModal('modal-info-privacy', 'Privacy & Reporting Bugs', body, null);
}


function showDonate() {
    const body = el('div', { className: 'info-content' });
    body.appendChild(el('h2', { className: 'info-title' }, 'Support This App'));
    body.appendChild(el('p', { className: 'info-sub' }, 'This app is completely free. If you find it useful and want to support its development, donations are greatly appreciated.'));
    
    const donateUrl = localStorage.getItem('cc-donate-url') || 'https://paypal.me/mattejenkins';
    const buttons = el('div', { style: 'display:flex; flex-direction:column; gap:12px; margin-top: var(--space-4);' });
    
    buttons.appendChild(el('a', { 
        href: donateUrl, 
        target: '_blank', 
        rel: 'noopener',
        className: 'btn-primary',
        style: 'display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:12px 24px; text-decoration:none; font-size:1rem;'
    }, 'Donate with PayPal'));
    
    buttons.appendChild(el('p', { style: 'font-size:0.8em; color:var(--color-text-muted); text-align:center;' },
        'Or visit the project page for other ways to contribute.'
    ));
    
    body.appendChild(buttons);
    closeInfoDropdown();
    const modal = createModal('modal-donate', 'Support This App', body, null);
    return modal;
}

// Expose for HTML onclick handlers
window.toggleInfoDropdown = toggleInfoDropdown;
window.openInfoSection = openInfoSection;
