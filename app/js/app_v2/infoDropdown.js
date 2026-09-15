/**
 * infoDropdown.js - Coin Catalog v2
 * Info button dropdown menu (replaces the full-screen blurred Help modal).
 * Clicking "Info" opens a small popover with categorized info options;
 * each option opens a clean, readable modal.
 */

import { el, escHtml } from './utils.js';
import { createModal, closeModal } from './modals.js';

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
  { key: 'guide', label: '✨ Take the Tour' },
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
 case 'guide': {
    import('./guide.js').then(m => m.startTour());
    break;
 }
 }
}

// --- About ---------------------------------------------------------------
function showAbout() {
 const version = window.APP_VERSION || 'dev';
 const body = _sectionBody(
 'About Coin Catalog v2',
 `Version ${version}`,
 [
 { text: 'A coin and collectable collection tracker with live metal prices, album view, and comprehensive inventory management.' },
 { heading: 'What it does', list: [
 'Tracks 6,400+ US coin types across albums and sections (Half Cent through modern issues, US Gold, Bullion Eagles, Commemoratives, State/Park Quarters, Presidential Dollars, First Spouse coins, plus Canadian coins cent through $2 Toonie)',
 '4-level hierarchy: Section → Series → Sub-type → Individual coin — every variety has its own entry',
 'Live spot prices for Gold, Silver, Copper, Platinum, and Palladium via Yahoo Finance API (auto-refresh every 60 seconds)',
 'Per-coin and per-type reference images with upload, cropping, and master-image promotion to type configs',
 'Badges on every coin row: ⭐ Key Date (gold), 💎 Proof (blue), ⚠ Error/Variety (orange — doubled dies, overdates, Wide AM, No-S proofs, and more)',
 'Inventory management: +/− buttons to log quantity; Details panel to record grade, price paid, current value, acquisition date, and notes',
 'Multiple specimens per coin: + Add detail entry tracks each coin individually with its own grade, price, and date',
 'Personal photos: upload a photo of your actual coin in the Details panel',
 '📋 Ref Note pills show historical background for notable coins — expand to read',
 '♥ on any row instantly adds that coin to your Wishlist',
 'Portfolio & Valuation Engine with melt vs. collectable "waterfall" logic',
 'Bulk Coins by Weight — weigh unsorted bags and get estimated count/value',
 'Paper Currency tracking with star note valuation (2× face unless overridden)',
 'Scrap Metal tracking (jewelry, silverware) by metal, karat/purity, and weight',
 'Raw Bullion tracking (Gold, Silver, Copper, Platinum, Palladium) in troy oz/lbs',
 'Custom Collection Cards — create your own dashboard cards for trading cards, stamps, comics, sports memorabilia, art, figurines, etc.',
 ]},
 { heading: 'Portfolio Breakdown', list: [
 'Gold / Silver / Copper / Platinum / Palladium Coins Melt — sum of coins whose melt beats collectable value',
 'Collectible Premium — sum of all coins counted on their collectable value',
 'Raw Bullion — weight × purity × live spot for each metal',
 'Bulk Coins — copper pennies (melt), zinc pennies (face), nickels (face), 90% silver coins (silver melt), clad coins (face estimate)',
 'Scrap Precious Metals — jewelry/silverware by weight and purity',
 'Paper Currency — bills entered by denomination, series year, serial number, star note status',
 'Custom Collections — items from your custom category cards',
 'Total Portfolio = Collectible Premium + Total Melt Value + Raw Bullion + Bulk Coins + Scrap + Paper Currency + Custom',
 'Portfolio history chart: 30 days, 90 days, 1 year, or all time',
 'Global Pricing Rules per series — base price and key-date premium apply automatically',
 ]},
 { heading: 'Image System', list: [
  'Upload obverse & reverse reference photos for any coin type (type-level applies to all coins of that type)',
  'Upload a personal photo of your actual coin in the Details panel (per-coin)',
  'Circular cropping tool with zoom, rotate, and the option to use the original shape for paper currency',
  'The app stores uploads under /data/images/types/user/ (personal photos under /data/images/personal/); the public app resolves the same images relative to its own base path',
  'WebP format with automatic conversion',
  ]},
 { heading: 'Search & View Options', list: [
 'Search by year, mint mark, series, denomination, or reference notes — results update instantly',
 'List / Album toggle on each section header — switch between list view and visual album grid',
 'Album View — displays coins in a visual grid with holes for each coin, progress bars, and reference OBV/REV images',
 'Missing Only — show only coins you don\'t own yet (great for coin show prep)',
 'Hide Proofs and Hide Errors & Varieties to simplify the view without losing the data',
 'Ctrl+F focuses the search bar from anywhere on the page',
 ]},
 { heading: 'Cloud Backup & Sync', list: [
  'Google Drive — backup to your Drive app folder using Google Identity Services',
  'Dropbox — backup using PKCE OAuth flow (no server needed)',
  'WebDAV — WebDAV-compatible storage (Nextcloud, ownCloud, Synology)',
  'All providers work entirely client-side — no backend server required',
  'Full JSON backup & restore, ZIP backup, and CSV export/import',
  ]},
 { heading: 'Themes & Customization', list: [
  '13 built-in themes: Dark, Midnight, Copper, Ocean, Deep Forest, Silver, Aged Paper, Matrix, Cyberpunk, Neon, Violet, Film Noir',
  '3 custom theme slots — design your own theme with a live color preview in Settings → Custom Theme Designer',
  'Drag to reorder dashboard cards with the ≡ handle; hide/show any card individually',
  'Resize the width of dashboard cards by grabbing either edge of a card',
  'All themes defined via CSS custom properties — never hard-coded colors',
  ]},
 { heading: 'Install as an App (PWA)', list: [
 'On a supported browser (Chrome, Edge), click Install in the header to install as a standalone desktop or Android app — no app store required',
 'Works offline for browsing your collection',
 'Android: Open in Chrome → tap the 3-dot menu → "Add to Home Screen" or use the Install button',
 'iPhone/iPad: Open in Safari → tap Share → "Add to Home Screen"',
 'Desktop (Windows/Mac): Open in Chrome or Edge → click the install icon in the address bar',
 ]},
 { heading: 'Keyboard Shortcuts', list: [
 'Ctrl+F / Cmd+F — Focus the search bar',
 'Escape — Close any open modal or lightbox',
 'Ctrl+Shift+R — Hard refresh (clear cache)',
 'F5 — Refresh page',
 'Ctrl+Shift+C — Open developer console',
 ]},
 { heading: 'Data Management', list: [
   'CSV Export — export your collection by section',
   'JSON Backup & Restore — complete data backup at any time',
   'Google Drive Backup — back up to your own Google Drive',
   'Factory Reset — two clean-slate options:  Option A wipes all data AND uploaded images (restoring the default images that shipped with the app);  Option B clears all data but keeps every image you have uploaded and been using.',
   'Missing Images panel — shows which coin types still need obverse or reverse photos',
   'Print Checklist — printable checklist by section with key date markers',
   'Print Inventory Report — professional report with grades, values, purchase prices, and gain/loss per coin',
   'Metal Prices Chart — historical chart of all 5 spot prices overlaid with your portfolio value',
   ]},
 { heading: 'Tips', list: [
 'Click a coin hole in album view to add it to your inventory',
 'Right-click a coin for quick actions (edit, delete, view details)',
 'Use the search bar to filter by year, type, mint mark, or keywords',
 'Upload images at the type level (applies to all coins) or per-coin basis',
 'Check the dashboard for live metal prices and portfolio value',
 'Export your data regularly via Settings → Data & Backup',
 'Use custom themes to personalize the app appearance',
 'Set Global Pricing Rules per series in Settings for automatic valuation',
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

// --- Coin Collecting Tips ----------------------------------------------------
// Full U.S. Coin Collecting General Tips & Reference Guide (embedded markdown)
const COIN_TIPS_GUIDE_HTML = `<style>
.cc-guide h1{font-size:1.15em;margin:1em 0 .4em;color:var(--color-accent,#c9a227);}
.cc-guide h2{font-size:1.05em;margin:1em 0 .35em;}
.cc-guide h3{font-size:.95em;margin:.8em 0 .3em;}
.cc-guide p{font-size:.88em;line-height:1.5;margin:.3em 0;}
.cc-guide ul,.cc-guide ol{margin:.3em 0 .6em 1.2em;font-size:.88em;}
.cc-guide li{margin:.15em 0;}
.cc-guide blockquote{border-left:3px solid var(--color-accent,#c9a227);padding-left:.7em;margin:.5em 0;opacity:.9;}
.cc-guide code{background:rgba(128,128,128,.2);padding:.05em .3em;border-radius:3px;}
.cc-guide hr{border:none;border-top:1px solid var(--color-border-light,#444);margin:.8em 0;}
.cc-guide strong{color:var(--color-accent,#c9a227);}
.cc-guide a{color:var(--color-accent,#c9a227);}
</style><div class="cc-guide"><h1>U.S. Coin Collecting: General Tips &amp; Reference Guide</h1>
<p>A practical beginner-to-intermediate guide to collecting, identifying, researching, grading, storing, and evaluating United States coins.</p>
<hr>
<h2>Table of Contents</h2>
<ol>
<li><a href="#1-what-is-numismatics">What Is Numismatics?</a></li>
<li><a href="#2-how-to-identify-a-coin">How to Identify a Coin</a></li>
<li><a href="#3-anatomy-of-a-coin">Anatomy of a Coin</a></li>
<li><a href="#4-mintmarks">Mintmarks</a></li>
<li><a href="#5-mintage-vs-rarity">Mintage vs. Rarity</a></li>
<li><a href="#6-key-dates">Key Dates</a></li>
<li><a href="#7-types-and-type-sets">Types and Type Sets</a></li>
<li><a href="#8-date-varieties">Date Varieties</a></li>
<li><a href="#9-die-varieties">Die Varieties</a></li>
<li><a href="#10-doubled-dies">Doubled Dies</a></li>
<li><a href="#11-machine-doubling">Machine Doubling</a></li>
<li><a href="#12-repunched-mintmarks">Repunched Mintmarks</a></li>
<li><a href="#13-overpunched-mintmarks">Overpunched Mintmarks</a></li>
<li><a href="#14-die-cracks">Die Cracks</a></li>
<li><a href="#15-cuds">Cuds</a></li>
<li><a href="#16-die-chips">Die Chips</a></li>
<li><a href="#17-die-clashes">Die Clashes</a></li>
<li><a href="#18-die-polish-lines">Die Polish Lines</a></li>
<li><a href="#19-die-states">Die States</a></li>
<li><a href="#20-mint-errors">Mint Errors</a></li>
<li><a href="#21-wrong-planchet-errors">Wrong-Planchet Errors</a></li>
<li><a href="#22-off-center-strikes">Off-Center Strikes</a></li>
<li><a href="#23-broadstrikes">Broadstrikes</a></li>
<li><a href="#24-clipped-planchets">Clipped Planchets</a></li>
<li><a href="#25-struck-through-errors">Struck-Through Errors</a></li>
<li><a href="#26-brockage-errors">Brockage Errors</a></li>
<li><a href="#27-multiple-strikes">Multiple Strikes</a></li>
<li><a href="#28-rotated-dies">Rotated Dies</a></li>
<li><a href="#29-transitional-errors">Transitional Errors</a></li>
<li><a href="#30-post-mint-damage">Post-Mint Damage</a></li>
<li><a href="#31-coin-weight">Coin Weight</a></li>
<li><a href="#32-diameter-and-thickness">Diameter and Thickness</a></li>
<li><a href="#33-us-coin-metal-compositions">U.S. Coin Metal Compositions</a></li>
<li><a href="#34-silver-coins">Silver Coins</a></li>
<li><a href="#35-gold-coins">Gold Coins</a></li>
<li><a href="#36-copper-coins">Copper Coins</a></li>
<li><a href="#37-nickel-coins">Nickel Coins</a></li>
<li><a href="#38-clad-coins">Clad Coins</a></li>
<li><a href="#39-proof-coins">Proof Coins</a></li>
<li><a href="#40-reverse-proof-coins">Reverse Proof Coins</a></li>
<li><a href="#41-coin-grades">Coin Grades</a></li>
<li><a href="#42-the-sheldon-grading-scale">The Sheldon Grading Scale</a></li>
<li><a href="#43-details-and-problem-coins">Details and Problem Coins</a></li>
<li><a href="#44-wear-vs-damage">Wear vs. Damage</a></li>
<li><a href="#45-cleaning-coins">Cleaning Coins</a></li>
<li><a href="#46-toning">Toning</a></li>
<li><a href="#47-luster">Luster</a></li>
<li><a href="#48-strike-quality">Strike Quality</a></li>
<li><a href="#49-eye-appeal">Eye Appeal</a></li>
<li><a href="#50-contact-and-bag-marks">Contact and Bag Marks</a></li>
<li><a href="#51-authentication">Authentication</a></li>
<li><a href="#52-counterfeits">Counterfeits</a></li>
<li><a href="#53-useful-equipment">Useful Equipment</a></li>
<li><a href="#54-researching-coins">Researching Coins</a></li>
<li><a href="#55-price-guides">Price Guides</a></li>
<li><a href="#56-auction-prices-vs-asking-prices">Auction Prices vs. Asking Prices</a></li>
<li><a href="#57-population-reports">Population Reports</a></li>
<li><a href="#58-buying-coins">Buying Coins</a></li>
<li><a href="#59-selling-coins">Selling Coins</a></li>
<li><a href="#60-when-to-have-a-coin-graded">When to Have a Coin Graded</a></li>
<li><a href="#61-coin-storage">Coin Storage</a></li>
<li><a href="#62-pvc-damage">PVC Damage</a></li>
<li><a href="#63-handling-coins">Handling Coins</a></li>
<li><a href="#64-photographing-coins">Photographing Coins</a></li>
<li><a href="#65-keeping-an-inventory">Keeping an Inventory</a></li>
<li><a href="#66-provenance">Provenance</a></li>
<li><a href="#67-insurance">Insurance</a></li>
<li><a href="#68-building-a-collection">Building a Collection</a></li>
<li><a href="#69-type-sets">Type Sets</a></li>
<li><a href="#70-date-sets">Date Sets</a></li>
<li><a href="#71-mintmark-sets">Mintmark Sets</a></li>
<li><a href="#72-error-collections">Error Collections</a></li>
<li><a href="#73-variety-collections">Variety Collections</a></li>
<li><a href="#74-silver-collections">Silver Collections</a></li>
<li><a href="#75-gold-collections">Gold Collections</a></li>
<li><a href="#76-modern-coin-collecting">Modern Coin Collecting</a></li>
<li><a href="#77-roll-hunting">Roll Hunting</a></li>
<li><a href="#78-pocket-change-hunting">Pocket-Change Hunting</a></li>
<li><a href="#79-estate-and-inherited-collections">Estate and Inherited Collections</a></li>
<li><a href="#80-coin-clubs">Coin Clubs</a></li>
<li><a href="#81-beginner-equipment-checklist">Beginner Equipment Checklist</a></li>
<li><a href="#82-advanced-equipment">Advanced Equipment</a></li>
<li><a href="#83-study-one-series">Study One Series</a></li>
<li><a href="#84-the-normal-first-rule">The Normal-First Rule</a></li>
<li><a href="#85-did-the-mint-make-it">Did the Mint Make It?</a></li>
<li><a href="#86-why-is-it-valuable">Why Is It Valuable?</a></li>
<li><a href="#87-common-beginner-mistakes">Common Beginner Mistakes</a></li>
<li><a href="#88-coin-identification-workflow">Coin Identification Workflow</a></li>
<li><a href="#89-special-coin-checklist">Special-Coin Checklist</a></li>
<li><a href="#90-final-advice">Final Advice</a></li>
</ol>
<hr>
<h1>1. What Is Numismatics?</h1>
<p><strong>Numismatics</strong> is the study and collection of coins, paper money, medals, tokens, and related forms of currency.</p>
<p>Coin collecting can be as simple as keeping interesting coins from pocket change or as specialized as collecting a particular die variety from a specific mint and year.</p>
<p>There is no single &quot;correct&quot; way to collect.</p>
<p>Common collecting approaches include:</p>
<ul>
<li>By denomination</li>
<li>By date</li>
<li>By mintmark</li>
<li>By historical period</li>
<li>By design type</li>
<li>By metal</li>
<li>By proof coins</li>
<li>By errors</li>
<li>By die varieties</li>
<li>By condition</li>
<li>By key dates</li>
<li>By a specific series</li>
<li>By a complete type set</li>
<li>By coins found in circulation</li>
</ul>
<p>The best collection is one that you enjoy building.</p>
<hr>
<h1>2. How to Identify a Coin</h1>
<p>Before deciding whether a coin is rare or valuable, identify it correctly.</p>
<p>Record:</p>
<ol>
<li>Country</li>
<li>Denomination</li>
<li>Date</li>
<li>Mintmark</li>
<li>Design/type</li>
<li>Composition</li>
<li>Weight</li>
<li>Diameter</li>
<li>Edge</li>
<li>Condition</li>
<li>Possible variety</li>
<li>Possible error</li>
</ol>
<p>For U.S. coins, the <strong>date and mintmark</strong> are often extremely important.</p>
<p>For example:</p>
<blockquote>
<p>1964-D Roosevelt dime</p>
</blockquote>
<p>is much more useful than:</p>
<blockquote>
<p>Old dime</p>
</blockquote>
<hr>
<h1>3. Anatomy of a Coin</h1>
<p>Important terms include:</p>
<h3>Obverse</h3>
<p>The front or &quot;heads&quot; side.</p>
<h3>Reverse</h3>
<p>The back or &quot;tails&quot; side.</p>
<h3>Edge</h3>
<p>The outer surface between the obverse and reverse.</p>
<p>The edge may be:</p>
<ul>
<li>Plain</li>
<li>Reeded</li>
<li>Lettered</li>
<li>Ornamented</li>
</ul>
<h3>Rim</h3>
<p>The raised border around the coin.</p>
<h3>Field</h3>
<p>The relatively flat background area surrounding the design.</p>
<h3>Relief</h3>
<p>The raised portions of the design.</p>
<h3>Devices</h3>
<p>The main design elements, such as:</p>
<ul>
<li>Portraits</li>
<li>Buildings</li>
<li>Eagles</li>
<li>Wreaths</li>
<li>Liberty figures</li>
</ul>
<h3>Legend</h3>
<p>Major lettering on the coin.</p>
<h3>Mintmark</h3>
<p>A letter identifying the mint facility that struck the coin.</p>
<hr>
<h1>4. Mintmarks</h1>
<p>U.S. coins have been struck at multiple facilities.</p>
<p>Common modern mintmarks include:</p>
<table>
<thead>
<tr>
<th>Mintmark</th>
<th>Mint</th>
</tr>
</thead>
<tbody><tr>
<td>P</td>
<td>Philadelphia</td>
</tr>
<tr>
<td>D</td>
<td>Denver</td>
</tr>
<tr>
<td>S</td>
<td>San Francisco</td>
</tr>
<tr>
<td>W</td>
<td>West Point</td>
</tr>
</tbody></table>
<p>Not every coin from Philadelphia historically received a mintmark.</p>
<p>Some series also contain coins with no mintmark that are significant varieties or key dates.</p>
<p>Never assume:</p>
<blockquote>
<p>No mintmark = rare.</p>
</blockquote>
<p>The date, denomination, design, and series must all be considered.</p>
<hr>
<h1>5. Mintage vs. Rarity</h1>
<p><strong>Mintage</strong> is the number of coins produced.</p>
<p>A low mintage can indicate scarcity, but mintage alone does not determine value.</p>
<p>A coin can have:</p>
<ul>
<li>Low mintage but many survivors</li>
<li>High mintage but very few survivors in high grade</li>
<li>High mintage but heavy melting or attrition</li>
<li>Low mintage but little collector demand</li>
</ul>
<p>Always distinguish between:</p>
<h3>Mintage</h3>
<p>How many were produced.</p>
<h3>Survival</h3>
<p>How many are believed to still exist.</p>
<h3>Condition rarity</h3>
<p>How difficult the coin is to find in a particular grade.</p>
<h3>Market demand</h3>
<p>How many collectors want it.</p>
<hr>
<h1>6. Key Dates</h1>
<p>A <strong>key date</strong> is a particularly scarce and important date within a coin series.</p>
<p>Examples from U.S. collecting include:</p>
<ul>
<li>1909-S VDB Lincoln cent</li>
<li>1914-D Lincoln cent</li>
<li>1931-S Lincoln cent</li>
<li>1922 No D Lincoln cent</li>
<li>1955 Doubled Die Obverse Lincoln cent</li>
<li>1969-S Doubled Die Obverse Lincoln cent</li>
<li>1970-S Large Date Doubled Die Obverse Lincoln cent</li>
<li>1932-D Washington quarter</li>
<li>1932-S Washington quarter</li>
<li>1916-D Mercury dime</li>
</ul>
<p>A key date can be valuable even when it does not contain an obvious mint error.</p>
<hr>
<h1>7. Types and Type Sets</h1>
<p>A <strong>type</strong> refers to a particular design or major design variation.</p>
<p>Collectors may build a:</p>
<blockquote>
<p>Type Set</p>
</blockquote>
<p>rather than collecting every date.</p>
<p>For example, instead of collecting every Washington quarter, someone might collect one representative example of each major U.S. quarter design.</p>
<p>Type collecting is an excellent way to learn U.S. coin history without needing thousands of coins.</p>
<hr>
<h1>8. Date Varieties</h1>
<p>A date variety occurs when there are identifiable differences in the date.</p>
<p>Common terminology includes:</p>
<h3>Small Date</h3>
<p>Digits are smaller or arranged differently than another recognized date style.</p>
<h3>Large Date</h3>
<p>Digits are larger or positioned differently.</p>
<h3>Close Date / Close Numbers</h3>
<p>Digits are positioned closer together.</p>
<h3>Wide Date / Wide Numbers</h3>
<p>Digits are spaced farther apart.</p>
<h3>Near Date</h3>
<p>A digit is unusually close to another design element.</p>
<h3>Near Rim</h3>
<p>A digit or design element is positioned unusually close to the rim.</p>
<h3>Far Date</h3>
<p>The date is positioned farther from another design element than the normal variety.</p>
<h3>High Date</h3>
<p>The date is positioned higher than another recognized variety.</p>
<h3>Low Date</h3>
<p>The date is positioned lower than another recognized variety.</p>
<p>Always use a recognized reference when identifying a date variety.</p>
<p>A coin that merely &quot;looks different&quot; is not automatically a recognized variety.</p>
<hr>
<h1>9. Die Varieties</h1>
<p>A <strong>die variety</strong> is a recurring characteristic caused by the dies used to strike coins.</p>
<p>This is different from a random mint error.</p>
<p>A die variety can appear on many coins struck by the same die pair.</p>
<p>Examples include:</p>
<ul>
<li>Doubled dies</li>
<li>Repunched mintmarks</li>
<li>Overmintmarks</li>
<li>Re-engraved dates</li>
<li>Different lettering styles</li>
<li>Different hub designs</li>
<li>Die markers</li>
</ul>
<p>A useful rule:</p>
<blockquote>
<p>If the same unusual feature appears in exactly the same location on multiple coins, it may be a die variety.</p>
</blockquote>
<hr>
<h1>10. Doubled Dies</h1>
<p>A <strong>doubled die</strong> occurs when a die itself receives multiple impressions from a hub in slightly different positions.</p>
<p>The resulting doubling is transferred to every coin struck by that die.</p>
<p>Look for:</p>
<ul>
<li>Separation</li>
<li>Extra outlines</li>
<li>Extra serifs</li>
<li>Distinct secondary images</li>
<li>Doubling on letters</li>
<li>Doubling on numbers</li>
<li>Doubling on design elements</li>
</ul>
<p>Important:</p>
<p><strong>Doubled die != machine doubling.</strong></p>
<p>True doubled dies are generally much more desirable than ordinary machine doubling.</p>
<p>Famous examples include:</p>
<ul>
<li>1955 DDO Lincoln cent</li>
<li>1969-S DDO Lincoln cent</li>
<li>1972 DDO Lincoln cent</li>
<li>1970-S Large Date DDO Lincoln cent</li>
<li>1995 DDO Lincoln cent</li>
</ul>
<hr>
<h1>11. Machine Doubling</h1>
<p>Machine doubling occurs during the striking process when the die or coin shifts or moves slightly.</p>
<p>It often creates:</p>
<ul>
<li>Flat shelf-like doubling</li>
<li>Reduced-looking lettering</li>
<li>A flattened secondary edge</li>
<li>A &quot;smeared&quot; appearance</li>
</ul>
<p>Machine doubling usually does <strong>not</strong> create the strong separated secondary design associated with a major doubled die.</p>
<p>Do not automatically assume any visible doubling is valuable.</p>
<hr>
<h1>12. Repunched Mintmarks</h1>
<p>A <strong>Repunched Mintmark (RPM)</strong> occurs when a mintmark is punched into a die more than once in different positions.</p>
<p>This can produce:</p>
<ul>
<li>Extra portions of the mintmark</li>
<li>Secondary outlines</li>
<li>Extra serifs</li>
<li>Offset letters</li>
</ul>
<p>RPMs are especially important on older U.S. coins.</p>
<p>Always compare your coin to a trusted variety reference.</p>
<hr>
<h1>13. Overpunched Mintmarks</h1>
<p>An <strong>Over Mint Mark (OMM)</strong> occurs when one mintmark is punched over another mintmark.</p>
<p>Examples may include:</p>
<ul>
<li>D over S</li>
<li>S over D</li>
</ul>
<p>These are especially interesting on series in which mintmarks were manually added to dies.</p>
<hr>
<h1>14. Die Cracks</h1>
<p>A <strong>die crack</strong> occurs when a coin die develops a crack.</p>
<p>The crack is transferred to the coins struck afterward.</p>
<p>A die crack generally appears as a raised line on the finished coin.</p>
<p>Important:</p>
<blockquote>
<p>The crack is raised on the coin because the defect is recessed into the die.</p>
</blockquote>
<p>Common forms include:</p>
<ul>
<li>Hairline cracks</li>
<li>Large branching cracks</li>
<li>Cracks through letters</li>
<li>Cracks through dates</li>
<li>Cracks extending from the rim</li>
<li>&quot;Cud&quot; formations</li>
</ul>
<p>A die crack that appears repeatedly in the same position can help identify a particular die state or variety.</p>
<hr>
<h1>15. Cuds</h1>
<p>A <strong>cud</strong> occurs when part of the die face breaks away, typically involving the die&#39;s edge.</p>
<p>The resulting coin has a raised area where metal flowed into the missing portion of the die.</p>
<p>A cud is usually:</p>
<ul>
<li>Raised</li>
<li>Connected to the rim</li>
<li>Associated with a broken portion of the die</li>
</ul>
<p>Do not confuse a cud with damage caused after the coin left the Mint.</p>
<hr>
<h1>16. Die Chips</h1>
<p>A <strong>die chip</strong> occurs when a small piece of a die breaks away.</p>
<p>The resulting coin can have a small raised blob of metal.</p>
<p>Die chips can occur:</p>
<ul>
<li>Near letters</li>
<li>Near numbers</li>
<li>On portraits</li>
<li>Around mintmarks</li>
<li>In the field</li>
</ul>
<p>Some famous recurring die chips have become collectible varieties.</p>
<hr>
<h1>17. Die Clashes</h1>
<p>A <strong>die clash</strong> occurs when the obverse and reverse dies come together without a planchet between them.</p>
<p>Parts of one die can leave impressions on the opposite die.</p>
<p>This can produce unusual design remnants on subsequently struck coins.</p>
<p>Clashes can appear as:</p>
<ul>
<li>Lines</li>
<li>Curves</li>
<li>Letter remnants</li>
<li>Design fragments</li>
<li>Parts of the opposite design</li>
</ul>
<hr>
<h1>18. Die Polish Lines</h1>
<p>Dies are sometimes polished to remove marks or damage.</p>
<p>The polishing can leave lines on the die.</p>
<p>Those lines can then appear as raised lines on coins struck from that die.</p>
<p>Important:</p>
<blockquote>
<p>Die polish lines are generally raised on the coin.</p>
</blockquote>
<p>They are not automatically errors.</p>
<hr>
<h1>19. Die States</h1>
<p>A die changes as it strikes coins.</p>
<p>Collectors may describe dies as:</p>
<ul>
<li>Early die state</li>
<li>Middle die state</li>
<li>Late die state</li>
</ul>
<p>A die may begin with no crack, later develop a small crack, and eventually develop a large crack or cud.</p>
<p>Studying die states can help determine when a coin was struck relative to other coins from the same die.</p>
<hr>
<h1>20. Mint Errors</h1>
<p>A <strong>mint error</strong> is an abnormality that occurs during production.</p>
<p>Unlike many die varieties, errors are generally accidental events affecting individual coins or limited groups of coins.</p>
<p>Examples:</p>
<ul>
<li>Off-center strike</li>
<li>Wrong planchet</li>
<li>Broadstrike</li>
<li>Clipped planchet</li>
<li>Struck-through</li>
<li>Brockage</li>
<li>Multiple strike</li>
<li>Die cap</li>
<li>Missing design elements</li>
<li>Transitional error</li>
</ul>
<p>A useful distinction:</p>
<blockquote>
<p>Variety = the die made it that way repeatedly.</p>
</blockquote>
<blockquote>
<p>Error = something went wrong during production.</p>
</blockquote>
<hr>
<h1>21. Wrong-Planchet Errors</h1>
<p>A wrong-planchet error occurs when a coin is struck on a planchet intended for another denomination or composition.</p>
<p>Potential clues include:</p>
<ul>
<li>Incorrect weight</li>
<li>Incorrect diameter</li>
<li>Incorrect thickness</li>
<li>Incorrect metal</li>
<li>Missing expected edge characteristics</li>
<li>Design larger or smaller than expected</li>
</ul>
<p>Some wrong-planchet errors are extremely valuable.</p>
<p>Weight is one of the most important first checks.</p>
<hr>
<h1>22. Off-Center Strikes</h1>
<p>An off-center strike occurs when the planchet is not properly centered between the dies.</p>
<p>Look for:</p>
<ul>
<li>Blank area</li>
<li>Partial design</li>
<li>Crescent-shaped unstruck area</li>
<li>Design shifted toward the edge</li>
</ul>
<p>Generally, dramatic off-center errors are more desirable than minor ones.</p>
<p>A coin struck 2% off center may be less interesting than one struck 40% off center.</p>
<hr>
<h1>23. Broadstrikes</h1>
<p>A broadstrike occurs when a coin is struck without the collar properly containing the planchet.</p>
<p>The coin may become:</p>
<ul>
<li>Wider</li>
<li>Flatter</li>
<li>Missing the normal raised rim</li>
</ul>
<p>The coin should still show evidence consistent with a Mint-produced strike.</p>
<p>Post-Mint flattening is not a broadstrike.</p>
<hr>
<h1>24. Clipped Planchets</h1>
<p>A clipped planchet occurs when part of the blank is missing before striking.</p>
<p>Common types include:</p>
<ul>
<li>Curved clip</li>
<li>Straight clip</li>
<li>Ragged clip</li>
<li>Multiple clips</li>
</ul>
<p>A genuine clip often exhibits diagnostic characteristics such as metal flow patterns near the clipped area.</p>
<p>Be careful with coins that were damaged after leaving the Mint.</p>
<hr>
<h1>25. Struck-Through Errors</h1>
<p>A struck-through error occurs when foreign material comes between the die and planchet during striking.</p>
<p>Possible materials include:</p>
<ul>
<li>Cloth</li>
<li>Grease</li>
<li>Wire</li>
<li>Metal fragments</li>
<li>Other debris</li>
</ul>
<p>The resulting coin may have:</p>
<ul>
<li>Missing design</li>
<li>Weak design</li>
<li>Texture</li>
<li>Depressions</li>
<li>Unusual shapes</li>
</ul>
<p>Grease-filled dies can produce weak or missing lettering.</p>
<hr>
<h1>26. Brockage Errors</h1>
<p>A <strong>brockage</strong> occurs when a previously struck coin sticks to a die and impresses its design into another coin.</p>
<p>A classic brockage can show:</p>
<ul>
<li>Incuse design</li>
<li>Mirror-image design</li>
<li>Missing normal design in the affected area</li>
</ul>
<p>Brockages can be highly collectible.</p>
<hr>
<h1>27. Multiple Strikes</h1>
<p>A multiple strike occurs when a coin is struck more than once.</p>
<p>The second strike may occur:</p>
<ul>
<li>In the collar</li>
<li>Outside the collar</li>
<li>With the coin rotated</li>
<li>With the coin partially overlapping its previous position</li>
</ul>
<p>Strong multiple strikes can be dramatic and valuable.</p>
<hr>
<h1>28. Rotated Dies</h1>
<p>The obverse and reverse dies of a U.S. coin normally have a specific orientation.</p>
<p>A major deviation can be collectible.</p>
<p>To test rotation:</p>
<ol>
<li>Hold the coin upright with the obverse facing you.</li>
<li>Rotate it vertically from top to bottom.</li>
<li>Observe the reverse.</li>
</ol>
<p>Do not rotate the coin sideways.</p>
<p>Minor rotations may have little premium.</p>
<p>Major rotations can be much more interesting.</p>
<hr>
<h1>29. Transitional Errors</h1>
<p>A transitional error occurs when a coin is struck using an outdated planchet after the Mint has changed specifications.</p>
<p>Examples can occur when:</p>
<ul>
<li>Composition changes</li>
<li>Weight changes</li>
<li>Planchet specifications change</li>
</ul>
<p>Famous U.S. transitional errors include certain:</p>
<ul>
<li>1943/1944 cents</li>
<li>1964/1965 silver/clad issues</li>
<li>1982 cent transitions</li>
</ul>
<p>These can be extremely valuable.</p>
<hr>
<h1>30. Post-Mint Damage</h1>
<p>Not everything unusual was created by the Mint.</p>
<p>Common post-Mint damage includes:</p>
<ul>
<li>Scratches</li>
<li>Gouges</li>
<li>Bends</li>
<li>Dents</li>
<li>Drilled holes</li>
<li>Filing</li>
<li>Polishing</li>
<li>Grinding</li>
<li>Chemical damage</li>
<li>Heat damage</li>
<li>Plating</li>
<li>Coloring</li>
<li>Acid treatment</li>
</ul>
<p>This distinction is critical.</p>
<p>A damaged coin can look spectacular while having little numismatic premium.</p>
<hr>
<h1>31. Coin Weight</h1>
<p>A precision scale is one of the most useful tools for coin hunting.</p>
<p>Use a scale capable of at least:</p>
<blockquote>
<p>0.01 gram resolution</p>
</blockquote>
<p>Whenever possible, record the expected standard weight.</p>
<p>Approximate modern U.S. specifications include:</p>
<table>
<thead>
<tr>
<th>Coin</th>
<th align="right">Standard Weight</th>
</tr>
</thead>
<tbody><tr>
<td>Cent</td>
<td align="right">2.500 g</td>
</tr>
<tr>
<td>Nickel</td>
<td align="right">5.000 g</td>
</tr>
<tr>
<td>Dime</td>
<td align="right">2.268 g</td>
</tr>
<tr>
<td>Quarter</td>
<td align="right">5.670 g</td>
</tr>
<tr>
<td>Half Dollar</td>
<td align="right">11.340 g</td>
</tr>
<tr>
<td>Native American/Presidential dollar</td>
<td align="right">8.100 g</td>
</tr>
</tbody></table>
<p>Older coins may have different specifications.</p>
<p>Wear can reduce weight slightly.</p>
<p>Environmental contamination can increase weight.</p>
<p>A large weight difference can indicate:</p>
<ul>
<li>Wrong planchet</li>
<li>Counterfeit</li>
<li>Clipped planchet</li>
<li>Composition change</li>
<li>Severe damage</li>
</ul>
<hr>
<h1>32. Diameter and Thickness</h1>
<p>Weight alone is not enough.</p>
<p>Measure:</p>
<ul>
<li>Weight</li>
<li>Diameter</li>
<li>Thickness</li>
<li>Edge</li>
</ul>
<p>For example, a coin that weighs incorrectly but has normal diameter may indicate a different problem than one that has both incorrect weight and diameter.</p>
<p>Use a digital caliper carefully.</p>
<p>Do not scratch a coin while measuring it.</p>
<hr>
<h1>33. U.S. Coin Metal Compositions</h1>
<p>Common modern compositions include:</p>
<h3>Lincoln cent</h3>
<p>Since 1982, circulating cents are generally:</p>
<ul>
<li>97.5% zinc</li>
<li>2.5% copper</li>
</ul>
<p>Copper-alloy cents from earlier periods generally have substantially different weights.</p>
<h3>Nickel</h3>
<ul>
<li>75% copper</li>
<li>25% nickel</li>
<li>5.000 g</li>
</ul>
<h3>Dime</h3>
<p>Modern clad dime:</p>
<ul>
<li>Outer layers: copper-nickel alloy</li>
<li>Core: copper</li>
</ul>
<h3>Quarter</h3>
<p>Modern clad quarter:</p>
<ul>
<li>Outer layers: copper-nickel alloy</li>
<li>Core: copper</li>
</ul>
<h3>Half dollar</h3>
<p>Modern clad half dollar:</p>
<ul>
<li>Outer layers: copper-nickel alloy</li>
<li>Core: copper</li>
</ul>
<h3>Dollar</h3>
<p>Modern manganese-brass/clad-style dollar composition differs from older silver dollars.</p>
<p>Always verify the specifications for the exact issue being examined.</p>
<hr>
<h1>34. Silver Coins</h1>
<p>Major U.S. silver issues include:</p>
<ul>
<li>Morgan dollars</li>
<li>Peace dollars</li>
<li>Barber coinage</li>
<li>Mercury dimes</li>
<li>Roosevelt dimes through 1964</li>
<li>Standing Liberty quarters</li>
<li>Washington quarters through 1964</li>
<li>Franklin half dollars</li>
<li>Kennedy half dollars 1964</li>
<li>Certain 1965‑1970 Kennedy halves containing 40% silver</li>
</ul>
<p>Common U.S. pre-1965 circulation silver coins are generally:</p>
<blockquote>
<p>90% silver / 10% copper</p>
</blockquote>
<p>The 1965‑1970 Kennedy half dollar is generally:</p>
<blockquote>
<p>40% silver / 60% copper</p>
</blockquote>
<p>Always verify the exact issue.</p>
<hr>
<h1>35. Gold Coins</h1>
<p>Historic U.S. gold coins include:</p>
<ul>
<li>$1 gold</li>
<li>$2.50 quarter eagles</li>
<li>$3 gold pieces</li>
<li>$5 half eagles</li>
<li>$10 eagles</li>
<li>$20 double eagles</li>
</ul>
<p>Many classic U.S. gold coins are highly collectible.</p>
<p>Value can depend on:</p>
<ul>
<li>Gold content</li>
<li>Date</li>
<li>Mintmark</li>
<li>Condition</li>
<li>Rarity</li>
<li>Variety</li>
<li>Historical significance</li>
</ul>
<p>Never clean gold coins simply because they look dirty.</p>
<hr>
<h1>36. Copper Coins</h1>
<p>Older U.S. cents can contain substantial copper.</p>
<p>Important copper issues include:</p>
<ul>
<li>Large cents</li>
<li>Indian Head cents</li>
<li>Lincoln wheat cents</li>
<li>Early Lincoln Memorial cents</li>
</ul>
<p>Copper coins can develop attractive natural toning.</p>
<p>Environmental exposure can also cause:</p>
<ul>
<li>Verdigris</li>
<li>Corrosion</li>
<li>Darkening</li>
<li>Spotting</li>
</ul>
<p>Avoid abrasive cleaning.</p>
<hr>
<h1>37. Nickel Coins</h1>
<p>The U.S. nickel has traditionally been:</p>
<blockquote>
<p>75% copper / 25% nickel</p>
</blockquote>
<p>Important exceptions include wartime nickels.</p>
<h3>1942‑1945 Wartime Nickels</h3>
<p>Certain wartime Jefferson nickels contain:</p>
<ul>
<li>35% silver</li>
<li>56% copper</li>
<li>9% manganese</li>
</ul>
<p>They can be identified by the large mintmark above Monticello on the reverse.</p>
<p>Look for:</p>
<blockquote>
<p>P, D, or S</p>
</blockquote>
<p>A &quot;P&quot; wartime nickel is particularly notable because Philadelphia nickels normally did not carry a P mintmark before this period.</p>
<hr>
<h1>38. Clad Coins</h1>
<p>Modern U.S. dimes, quarters, and half dollars generally use clad construction.</p>
<p>A clad coin contains multiple layers.</p>
<p>The edge can reveal:</p>
<ul>
<li>Copper core</li>
<li>Outer alloy layers</li>
</ul>
<p>A coin with an unusual edge color can deserve further investigation.</p>
<p>However:</p>
<blockquote>
<p>A copper-colored edge does not automatically mean the coin is rare.</p>
</blockquote>
<hr>
<h1>39. Proof Coins</h1>
<p>Proof coins are specially manufactured for collectors.</p>
<p>Typical characteristics include:</p>
<ul>
<li>Highly polished fields</li>
<li>Frosted design elements</li>
<li>Sharp details</li>
<li>Special preparation of dies and planchets</li>
</ul>
<p>Modern proofs are usually produced at San Francisco or West Point depending on the issue.</p>
<p>Older proof coins can have different characteristics.</p>
<hr>
<h1>40. Reverse Proof Coins</h1>
<p>A reverse proof uses a finish opposite the conventional proof appearance.</p>
<p>Typically:</p>
<ul>
<li>Design elements appear mirror-like</li>
<li>Fields appear frosted</li>
</ul>
<p>These are usually collector issues rather than normal circulation coins.</p>
<hr>
<h1>41. Coin Grades</h1>
<p>Condition has a major effect on value.</p>
<p>Common grading categories include:</p>
<ul>
<li>Poor</li>
<li>Fair</li>
<li>About Good</li>
<li>Good</li>
<li>Very Good</li>
<li>Fine</li>
<li>Very Fine</li>
<li>Extremely Fine</li>
<li>About Uncirculated</li>
<li>Uncirculated</li>
<li>Mint State</li>
<li>Proof</li>
</ul>
<p>Professional grading uses numerical grades.</p>
<hr>
<h1>42. The Sheldon Grading Scale</h1>
<p>The Sheldon scale ranges from:</p>
<blockquote>
<p>1 to 70</p>
</blockquote>
<p>Very broadly:</p>
<ul>
<li>1 = heavily worn</li>
<li>20 = Very Fine territory</li>
<li>30 = Very Fine/Extremely Fine territory</li>
<li>40 = Extremely Fine</li>
<li>50 = About Uncirculated</li>
<li>60 = Uncirculated</li>
<li>65+ = high-grade Mint State</li>
</ul>
<p>The exact standards depend on the series.</p>
<p>A coin&#39;s grade should be based on its overall condition, not simply how shiny it looks.</p>
<hr>
<h1>43. Details and Problem Coins</h1>
<p>A coin may have excellent remaining detail but still receive a &quot;Details&quot; designation because of a problem.</p>
<p>Possible problems include:</p>
<ul>
<li>Cleaning</li>
<li>Scratches</li>
<li>Environmental damage</li>
<li>Corrosion</li>
<li>Artificial toning</li>
<li>Damage</li>
<li>Mounting</li>
<li>Improper treatment</li>
</ul>
<p>A cleaned AU coin is not equivalent to a straight-graded AU coin.</p>
<hr>
<h1>44. Wear vs. Damage</h1>
<p>This is one of the most important skills in coin collecting.</p>
<h3>Wear</h3>
<p>Usually:</p>
<ul>
<li>Smooth</li>
<li>Even</li>
<li>Occurs on high points</li>
<li>Reduces detail gradually</li>
</ul>
<h3>Damage</h3>
<p>May be:</p>
<ul>
<li>Sharp</li>
<li>Localized</li>
<li>Random</li>
<li>Scratched</li>
<li>Gouged</li>
<li>Bent</li>
<li>Dented</li>
</ul>
<p>Learning the difference takes practice.</p>
<p>Compare questionable areas with photographs of known genuine coins.</p>
<hr>
<h1>45. Cleaning Coins</h1>
<p><strong>Do not clean collectible coins.</strong></p>
<p>Avoid:</p>
<ul>
<li>Toothpaste</li>
<li>Baking soda</li>
<li>Vinegar</li>
<li>Lemon juice</li>
<li>Jewelry cleaner</li>
<li>Abrasive cloth</li>
<li>Wire brushes</li>
<li>Erasers</li>
<li>Metal polish</li>
<li>Dipping without understanding the consequences</li>
</ul>
<p>Cleaning can permanently alter the surface.</p>
<p>A coin that appears dirty may actually have desirable original surfaces.</p>
<hr>
<h1>46. Toning</h1>
<p>Toning is a change in surface color caused by environmental exposure over time.</p>
<p>Natural toning can be:</p>
<ul>
<li>Brown</li>
<li>Gold</li>
<li>Blue</li>
<li>Purple</li>
<li>Gray</li>
<li>Rainbow</li>
<li>Multicolored</li>
</ul>
<p>Toning is not automatically bad.</p>
<p>Some collectors pay significant premiums for attractive natural toning.</p>
<p>Artificial toning is another matter.</p>
<hr>
<h1>47. Luster</h1>
<p><strong>Luster</strong> is the way light reflects from the microscopic surface structure of a coin.</p>
<p>Mint State coins can exhibit strong cartwheel luster.</p>
<p>When examining a coin:</p>
<ol>
<li>Hold it under a light.</li>
<li>Slowly tilt it.</li>
<li>Observe how the light moves across the surface.</li>
</ol>
<p>Strong original luster can be an important indicator of Mint State preservation.</p>
<hr>
<h1>48. Strike Quality</h1>
<p>A coin can be technically uncirculated but poorly struck.</p>
<p>Look for:</p>
<ul>
<li>Weak lettering</li>
<li>Weak hair details</li>
<li>Weak central design</li>
<li>Missing detail</li>
<li>Strong peripheral detail</li>
</ul>
<p>Do not mistake strike weakness for wear.</p>
<p>This is particularly important for series known for weak strikes.</p>
<hr>
<h1>49. Eye Appeal</h1>
<p>Eye appeal is subjective but important.</p>
<p>Two coins with similar technical grades may have very different desirability.</p>
<p>Factors include:</p>
<ul>
<li>Attractive toning</li>
<li>Original surfaces</li>
<li>Strong luster</li>
<li>Clean fields</li>
<li>Sharp strike</li>
<li>Pleasant color</li>
<li>Lack of distracting marks</li>
</ul>
<hr>
<h1>50. Contact and Bag Marks</h1>
<p>Coins can acquire marks while being transported or stored in bags.</p>
<p>These are commonly called:</p>
<blockquote>
<p>Bag marks</p>
</blockquote>
<p>or</p>
<blockquote>
<p>Contact marks</p>
</blockquote>
<p>They are particularly common on large silver dollars.</p>
<p>They can affect the grade without being post-Mint damage.</p>
<hr>
<h1>51. Authentication</h1>
<p>Authentication becomes increasingly important as coin value increases.</p>
<p>Warning signs include:</p>
<ul>
<li>Incorrect weight</li>
<li>Incorrect diameter</li>
<li>Wrong metal</li>
<li>Strange surfaces</li>
<li>Incorrect lettering</li>
<li>Wrong mintmark</li>
<li>Incorrect edge</li>
<li>Casting seams</li>
<li>Unusual texture</li>
<li>Poor details</li>
</ul>
<p>For expensive coins, professional authentication is strongly recommended.</p>
<hr>
<h1>52. Counterfeits</h1>
<p>Counterfeit U.S. coins exist across many denominations.</p>
<p>Commonly counterfeited coins include:</p>
<ul>
<li>Gold coins</li>
<li>Silver dollars</li>
<li>Key-date cents</li>
<li>Rare quarters</li>
<li>Rare half dollars</li>
</ul>
<p>A counterfeit may look convincing.</p>
<p>Use multiple tests:</p>
<ol>
<li>Weight</li>
<li>Diameter</li>
<li>Thickness</li>
<li>Magnet response</li>
<li>Edge</li>
<li>Surface</li>
<li>Die characteristics</li>
<li>Correct design</li>
<li>Professional authentication</li>
</ol>
<p>Do not rely on a single test.</p>
<hr>
<h1>53. Useful Equipment</h1>
<p>A basic coin-hunting setup can include:</p>
<ul>
<li>10× loupe</li>
<li>Digital scale</li>
<li>Good LED lighting</li>
<li>Coin holders</li>
<li>Magnifying glass</li>
<li>Digital caliper</li>
<li>Small magnet</li>
<li>Gloves for certain handling situations</li>
<li>Soft work surface</li>
<li>Camera or phone</li>
<li>Reference books</li>
</ul>
<p>You do not need expensive equipment to begin.</p>
<hr>
<h1>54. Researching Coins</h1>
<p>Before deciding that a coin is rare:</p>
<ol>
<li>Identify it.</li>
<li>Verify the date.</li>
<li>Verify the mintmark.</li>
<li>Determine the normal design.</li>
<li>Check the weight.</li>
<li>Compare photographs.</li>
<li>Research known varieties.</li>
<li>Research known errors.</li>
<li>Check auction records.</li>
<li>Consider condition.</li>
</ol>
<p>Useful reference organizations include:</p>
<ul>
<li>U.S. Mint</li>
<li>Professional Coin Grading Service (PCGS)</li>
<li>Numismatic Guaranty Company (NGC)</li>
<li>American Numismatic Association (ANA)</li>
</ul>
<hr>
<h1>55. Price Guides</h1>
<p>Price guides are useful but should not be treated as guaranteed selling prices.</p>
<p>Values can change based on:</p>
<ul>
<li>Market demand</li>
<li>Grade</li>
<li>Eye appeal</li>
<li>Certification</li>
<li>Auction venue</li>
<li>Population</li>
<li>Rarity</li>
<li>Precious-metal prices</li>
</ul>
<p>A guide may list a coin at $500 while actual recent sales range from $350 to $650.</p>
<p>Always investigate actual sales.</p>
<hr>
<h1>56. Auction Prices vs. Asking Prices</h1>
<p>An asking price is:</p>
<blockquote>
<p>What someone wants.</p>
</blockquote>
<p>A completed auction sale is:</p>
<blockquote>
<p>What someone actually paid.</p>
</blockquote>
<p>For determining market value, completed sales are generally more useful.</p>
<p>Be cautious with:</p>
<ul>
<li>Unsold eBay listings</li>
<li>Inflated dealer asking prices</li>
<li>&quot;Buy It Now&quot; prices</li>
<li>Online posts claiming extreme values</li>
</ul>
<hr>
<h1>57. Population Reports</h1>
<p>Professional grading companies publish population data.</p>
<p>A population report can help answer:</p>
<blockquote>
<p>How many examples has this grading service graded at or above this grade?</p>
</blockquote>
<p>But population is not identical to total surviving population.</p>
<p>The same coin may:</p>
<ul>
<li>Be resubmitted</li>
<li>Be crossed over</li>
<li>Be graded by another company</li>
<li>Be cracked out of a holder</li>
</ul>
<p>Population reports should therefore be interpreted carefully.</p>
<hr>
<h1>58. Buying Coins</h1>
<p>Potential sources include:</p>
<ul>
<li>Coin dealers</li>
<li>Coin shows</li>
<li>Auctions</li>
<li>Estate sales</li>
<li>Bank rolls</li>
<li>Collector-to-collector sales</li>
<li>Online marketplaces</li>
</ul>
<p>When buying expensive coins:</p>
<ul>
<li>Compare prices</li>
<li>Check return policies</li>
<li>Research the seller</li>
<li>Ask about authenticity</li>
<li>Examine photographs carefully</li>
<li>Avoid pressure sales</li>
</ul>
<hr>
<h1>59. Selling Coins</h1>
<p>Before selling a valuable coin:</p>
<ol>
<li>Identify it.</li>
<li>Verify authenticity.</li>
<li>Determine condition.</li>
<li>Research recent sales.</li>
<li>Get multiple opinions.</li>
<li>Decide whether grading makes sense.</li>
<li>Compare selling venues.</li>
</ol>
<p>Never assume the first dealer&#39;s offer is automatically fair.</p>
<p>Dealers need room for overhead and profit, so dealer buy offers are normally below retail asking prices.</p>
<hr>
<h1>60. When to Have a Coin Graded</h1>
<p>Professional grading can make sense when:</p>
<ul>
<li>The coin is valuable</li>
<li>Authentication matters</li>
<li>The coin is rare</li>
<li>Condition significantly affects value</li>
<li>You plan to sell</li>
<li>You want long-term protection</li>
</ul>
<p>It may not make sense for a common $2 coin.</p>
<p>Consider:</p>
<blockquote>
<p>Expected increase in marketability/value vs. grading and shipping costs.</p>
</blockquote>
<hr>
<h1>61. Coin Storage</h1>
<p>Good storage protects a coin from:</p>
<ul>
<li>Moisture</li>
<li>Chemicals</li>
<li>PVC</li>
<li>Scratches</li>
<li>Handling</li>
<li>Environmental contaminants</li>
</ul>
<p>Recommended materials include:</p>
<ul>
<li>Archival-quality holders</li>
<li>Mylar</li>
<li>Inert plastic</li>
<li>Quality flips specifically designed for numismatic storage</li>
<li>Certified coin slabs</li>
</ul>
<p>Keep coins:</p>
<blockquote>
<p>Cool, dry, and away from extreme temperature changes.</p>
</blockquote>
<hr>
<h1>62. PVC Damage</h1>
<p>Avoid coin holders made with problematic PVC.</p>
<p>PVC can leave a greenish or oily residue on coins.</p>
<p>Long-term exposure can damage the surface.</p>
<p>Look for:</p>
<blockquote>
<p>PVC-free</p>
</blockquote>
<p>or</p>
<blockquote>
<p>archival / inert</p>
</blockquote>
<p>storage materials.</p>
<p>If you discover suspected PVC damage on a valuable coin, avoid experimenting with household cleaners.</p>
<hr>
<h1>63. Handling Coins</h1>
<p>Hold collectible coins by the edges.</p>
<p>Avoid touching the surfaces with bare fingers.</p>
<p>Finger oils can leave:</p>
<ul>
<li>Spots</li>
<li>Residue</li>
<li>Corrosion</li>
<li>Permanent fingerprints</li>
</ul>
<p>A clean soft surface beneath your work area can prevent accidental damage if a coin is dropped.</p>
<hr>
<h1>64. Photographing Coins</h1>
<p>Good photographs are extremely useful for identification.</p>
<p>Use:</p>
<ul>
<li>Diffused lighting</li>
<li>Macro mode</li>
<li>Stable camera</li>
<li>High resolution</li>
<li>Obverse and reverse photographs</li>
<li>Edge photographs for important coins</li>
<li>Close-ups of questionable areas</li>
</ul>
<p>Avoid excessive sharpening or editing.</p>
<p>The goal is accurate documentation, not making the coin look better than it really is.</p>
<hr>
<h1>65. Keeping an Inventory</h1>
<p>Maintain a spreadsheet or database.</p>
<p>Useful fields include:</p>
<table>
<thead>
<tr>
<th>Field</th>
<th>Example</th>
</tr>
</thead>
<tbody><tr>
<td>Country</td>
<td>United States</td>
</tr>
<tr>
<td>Denomination</td>
<td>Lincoln cent</td>
</tr>
<tr>
<td>Date</td>
<td>1955</td>
</tr>
<tr>
<td>Mintmark</td>
<td>None</td>
</tr>
<tr>
<td>Variety</td>
<td>DDO</td>
</tr>
<tr>
<td>Error</td>
<td>None</td>
</tr>
<tr>
<td>Composition</td>
<td>Bronze</td>
</tr>
<tr>
<td>Weight</td>
<td>3.11 g</td>
</tr>
<tr>
<td>Grade</td>
<td>VF</td>
</tr>
<tr>
<td>Purchase Price</td>
<td>$___</td>
</tr>
<tr>
<td>Estimated Value</td>
<td>$___</td>
</tr>
<tr>
<td>Source</td>
<td>Coin show</td>
</tr>
<tr>
<td>Notes</td>
<td>Strong doubling</td>
</tr>
</tbody></table>
<p>Add photographs for important coins.</p>
<hr>
<h1>66. Provenance</h1>
<p><strong>Provenance</strong> is the documented history of ownership or origin.</p>
<p>Useful provenance can include:</p>
<ul>
<li>Old collection records</li>
<li>Auction invoices</li>
<li>Dealer receipts</li>
<li>Certification records</li>
<li>Family records</li>
<li>Photographs</li>
<li>Estate documentation</li>
</ul>
<p>Strong provenance can add confidence, especially for unusual or expensive pieces.</p>
<hr>
<h1>67. Insurance</h1>
<p>A valuable collection may require insurance.</p>
<p>Keep:</p>
<ul>
<li>Inventory</li>
<li>Photographs</li>
<li>Receipts</li>
<li>Certification numbers</li>
<li>Purchase records</li>
<li>Appraisals</li>
</ul>
<p>Ask your insurer whether collectibles are fully covered.</p>
<p>Do not assume a normal homeowners policy automatically covers a valuable coin collection at full replacement value.</p>
<hr>
<h1>68. Building a Collection</h1>
<p>Start with a clear goal.</p>
<p>Examples:</p>
<blockquote>
<p>&quot;I want one example of every U.S. coin design.&quot;</p>
</blockquote>
<p>or:</p>
<blockquote>
<p>&quot;I want to collect Lincoln cents.&quot;</p>
</blockquote>
<p>or:</p>
<blockquote>
<p>&quot;I want to find errors in circulation.&quot;</p>
</blockquote>
<p>A focused goal prevents random spending.</p>
<hr>
<h1>69. Type Sets</h1>
<p>A type set contains one example of each major coin type.</p>
<p>Advantages:</p>
<ul>
<li>Historical variety</li>
<li>Manageable size</li>
<li>Educational</li>
<li>Easy to display</li>
</ul>
<p>A type set can range from inexpensive modern coins to extremely expensive early U.S. pieces.</p>
<hr>
<h1>70. Date Sets</h1>
<p>A date set focuses on obtaining each year of a series.</p>
<p>Example:</p>
<blockquote>
<p>Lincoln cents 1909–present</p>
</blockquote>
<p>A date set may or may not include every mintmark.</p>
<hr>
<h1>71. Mintmark Sets</h1>
<p>A mintmark set focuses on collecting coins from different mints.</p>
<p>For example:</p>
<ul>
<li>Philadelphia</li>
<li>Denver</li>
<li>San Francisco</li>
<li>West Point</li>
</ul>
<p>Older series can include additional historical mint facilities.</p>
<hr>
<h1>72. Error Collections</h1>
<p>Error collectors specialize in production mistakes.</p>
<p>Interesting categories include:</p>
<ul>
<li>Wrong planchets</li>
<li>Off-center strikes</li>
<li>Broadstrikes</li>
<li>Clips</li>
<li>Brockages</li>
<li>Struck-throughs</li>
<li>Multiple strikes</li>
<li>Die caps</li>
<li>Missing design elements</li>
<li>Transitional errors</li>
</ul>
<p>Major errors can be highly valuable.</p>
<hr>
<h1>73. Variety Collections</h1>
<p>Variety collectors look for differences caused by dies.</p>
<p>Examples:</p>
<ul>
<li>Doubled dies</li>
<li>RPMs</li>
<li>OMMs</li>
<li>Small/Large dates</li>
<li>Hub changes</li>
<li>Reverse varieties</li>
<li>Die states</li>
</ul>
<p>Variety collecting rewards close examination and research.</p>
<hr>
<h1>74. Silver Collections</h1>
<p>Silver collecting can be approached in two ways:</p>
<h3>Bullion-oriented</h3>
<p>Focus primarily on metal content.</p>
<h3>Numismatic</h3>
<p>Focus on:</p>
<ul>
<li>Date</li>
<li>Mintmark</li>
<li>Grade</li>
<li>Variety</li>
<li>Historical importance</li>
</ul>
<p>A common silver coin and a rare silver coin can have dramatically different values.</p>
<hr>
<h1>75. Gold Collections</h1>
<p>Gold collecting requires additional caution.</p>
<p>Large amounts of money can be involved.</p>
<p>Always verify:</p>
<ul>
<li>Weight</li>
<li>Diameter</li>
<li>Thickness</li>
<li>Purity</li>
<li>Design</li>
<li>Mintmark</li>
<li>Authenticity</li>
</ul>
<p>For expensive gold coins, professional authentication is highly recommended.</p>
<hr>
<h1>76. Modern Coin Collecting</h1>
<p>Do not assume modern coins are worthless.</p>
<p>Modern collectors can specialize in:</p>
<ul>
<li>Proofs</li>
<li>Reverse proofs</li>
<li>Mint sets</li>
<li>Commemoratives</li>
<li>Modern errors</li>
<li>Modern varieties</li>
<li>Low-mintage issues</li>
<li>Special finishes</li>
<li>High-grade examples</li>
</ul>
<p>Modern coins can also contain dramatic Mint errors.</p>
<hr>
<h1>77. Roll Hunting</h1>
<p>Roll hunting involves searching rolls of coins for collectible pieces.</p>
<p>Possible sources:</p>
<ul>
<li>Banks</li>
<li>Credit unions</li>
<li>Coin-counting machines</li>
<li>Personal collections</li>
</ul>
<p>Look for:</p>
<ul>
<li>Silver</li>
<li>Wheat cents</li>
<li>Key dates</li>
<li>Better dates</li>
<li>Varieties</li>
<li>Errors</li>
<li>Foreign coins</li>
<li>Older designs</li>
<li>Unusual compositions</li>
</ul>
<p>Always return unwanted coins to circulation appropriately.</p>
<hr>
<h1>78. Pocket-Change Hunting</h1>
<p>Search your normal change for:</p>
<ul>
<li>Older coins</li>
<li>Wheat cents</li>
<li>West Point quarters</li>
<li>Errors</li>
<li>Doubled dies</li>
<li>Die cracks</li>
<li>Unusual dates</li>
<li>Foreign coins</li>
</ul>
<p>Modern circulation can occasionally produce surprisingly interesting finds.</p>
<hr>
<h1>79. Estate and Inherited Collections</h1>
<p>If you inherit a collection:</p>
<h3>Do not immediately clean anything.</h3>
<p>Instead:</p>
<ol>
<li>Photograph everything.</li>
<li>Separate coins carefully.</li>
<li>Preserve existing holders.</li>
<li>Inventory the collection.</li>
<li>Identify key dates.</li>
<li>Identify precious-metal coins.</li>
<li>Look for rare varieties.</li>
<li>Research values.</li>
<li>Obtain professional opinions for important pieces.</li>
</ol>
<p>Large inherited collections may contain both common coins and valuable pieces.</p>
<hr>
<h1>80. Coin Clubs</h1>
<p>Coin clubs are excellent places to learn.</p>
<p>Benefits can include:</p>
<ul>
<li>Experienced collectors</li>
<li>Local knowledge</li>
<li>Educational presentations</li>
<li>Coin shows</li>
<li>Trading opportunities</li>
<li>Variety identification</li>
<li>Authentication advice</li>
</ul>
<p>The numismatic community can be one of the best learning resources available.</p>
<hr>
<h1>81. Beginner Equipment Checklist</h1>
<p>A good starter kit:</p>
<ul>
<li><input disabled="" type="checkbox"> 10× loupe</li>
<li><input disabled="" type="checkbox"> Digital scale</li>
<li><input disabled="" type="checkbox"> LED light</li>
<li><input disabled="" type="checkbox"> Coin flips</li>
<li><input disabled="" type="checkbox"> Coin tubes</li>
<li><input disabled="" type="checkbox"> Small magnet</li>
<li><input disabled="" type="checkbox"> Digital caliper</li>
<li><input disabled="" type="checkbox"> Notebook</li>
<li><input disabled="" type="checkbox"> Camera/phone</li>
<li><input disabled="" type="checkbox"> Reference guide</li>
<li><input disabled="" type="checkbox"> Soft work surface</li>
</ul>
<p>You can build this gradually.</p>
<hr>
<h1>82. Advanced Equipment</h1>
<p>More advanced collectors may use:</p>
<ul>
<li>Higher-quality microscopes</li>
<li>Macro photography equipment</li>
<li>Precision calipers</li>
<li>Better scales</li>
<li>UV lighting</li>
<li>Specialized reference books</li>
<li>Die-variety databases</li>
<li>Electronic inventory systems</li>
<li>Professional grading services</li>
</ul>
<p>Equipment should support research rather than replace knowledge.</p>
<hr>
<h1>83. Study One Series</h1>
<p>One of the fastest ways to improve is to specialize temporarily.</p>
<p>For example:</p>
<blockquote>
<p>Study Lincoln cents for a month.</p>
</blockquote>
<p>Learn:</p>
<ul>
<li>Every major date</li>
<li>Every mintmark</li>
<li>Major varieties</li>
<li>Common errors</li>
<li>Weights</li>
<li>Composition changes</li>
<li>Major grading characteristics</li>
</ul>
<p>After becoming familiar with one series, identifying abnormalities becomes much easier.</p>
<hr>
<h1>84. The Normal-First Rule</h1>
<p>When you see something unusual:</p>
<h3>First ask:</h3>
<blockquote>
<p>What should this coin normally look like?</p>
</blockquote>
<p>Then ask:</p>
<blockquote>
<p>How is mine different?</p>
</blockquote>
<p>Then:</p>
<blockquote>
<p>Is that difference recognized?</p>
</blockquote>
<p>This prevents many false discoveries.</p>
<hr>
<h1>85. Did the Mint Make It?</h1>
<p>Whenever something looks strange, ask:</p>
<blockquote>
<p>Could this have happened at the Mint?</p>
</blockquote>
<p>Examples:</p>
<h3>Raised line</h3>
<p>Could be:</p>
<ul>
<li>Die crack</li>
<li>Die polish line</li>
<li>Die marker</li>
</ul>
<h3>Incuse line</h3>
<p>Could be:</p>
<ul>
<li>Struck-through</li>
<li>Damage</li>
</ul>
<h3>Missing design</h3>
<p>Could be:</p>
<ul>
<li>Grease-filled die</li>
<li>Weak strike</li>
<li>Damage</li>
<li>Variety</li>
<li>Die deterioration</li>
</ul>
<h3>Wrong color</h3>
<p>Could be:</p>
<ul>
<li>Natural composition</li>
<li>Toning</li>
<li>Environmental damage</li>
<li>Plating</li>
<li>Chemical alteration</li>
</ul>
<hr>
<h1>86. Why Is It Valuable?</h1>
<p>Before calling a coin valuable, identify the reason.</p>
<p>Potential reasons include:</p>
<h3>Rarity</h3>
<p>Few survivors.</p>
<h3>Key date</h3>
<p>Important scarce date.</p>
<h3>Variety</h3>
<p>Recognized die variety.</p>
<h3>Error</h3>
<p>Mint production mistake.</p>
<h3>Condition</h3>
<p>Very high grade.</p>
<h3>Precious metal</h3>
<p>Significant intrinsic value.</p>
<h3>Historical importance</h3>
<p>Important historical issue.</p>
<h3>Eye appeal</h3>
<p>Exceptional appearance.</p>
<h3>Demand</h3>
<p>Many collectors want it.</p>
<p>If you cannot explain why a coin is valuable, research it further.</p>
<hr>
<h1>87. Common Beginner Mistakes</h1>
<p>Avoid these mistakes:</p>
<h3>Mistake 1: Cleaning coins</h3>
<p>Don&#39;t.</p>
<h3>Mistake 2: Believing internet price claims</h3>
<p>Verify actual sales.</p>
<h3>Mistake 3: Assuming old = rare</h3>
<p>Age alone does not determine rarity.</p>
<h3>Mistake 4: Assuming low mintage = expensive</h3>
<p>Survival and demand matter.</p>
<h3>Mistake 5: Calling machine doubling a doubled die</h3>
<p>Learn the difference.</p>
<h3>Mistake 6: Calling damage an error</h3>
<p>Compare with known Mint characteristics.</p>
<h3>Mistake 7: Ignoring weight</h3>
<p>Weight can reveal major clues.</p>
<h3>Mistake 8: Handling coins by the surfaces</h3>
<p>Use the edges.</p>
<h3>Mistake 9: Buying before researching</h3>
<p>Research first.</p>
<h3>Mistake 10: Trusting a single opinion</h3>
<p>For valuable coins, seek multiple opinions.</p>
<hr>
<h1>88. Coin Identification Workflow</h1>
<p>Use this process whenever you find something interesting.</p>
<h2>Step 1 – Identify the denomination</h2>
<p>Cent?</p>
<p>Nickel?</p>
<p>Dime?</p>
<p>Quarter?</p>
<p>Half?</p>
<p>Dollar?</p>
<h2>Step 2 – Identify the date</h2>
<p>Record the exact year.</p>
<h2>Step 3 – Identify the mintmark</h2>
<p>Check carefully.</p>
<h2>Step 4 – Identify the design</h2>
<p>Determine the exact series/type.</p>
<h2>Step 5 – Check composition</h2>
<p>Is it:</p>
<ul>
<li>Copper?</li>
<li>Bronze?</li>
<li>Zinc?</li>
<li>Nickel?</li>
<li>Silver?</li>
<li>Clad?</li>
<li>Gold?</li>
</ul>
<h2>Step 6 – Weigh it</h2>
<p>Compare with the expected weight.</p>
<h2>Step 7 – Measure it</h2>
<p>Check diameter and thickness if necessary.</p>
<h2>Step 8 – Examine the edge</h2>
<p>Look for:</p>
<ul>
<li>Reeding</li>
<li>Lettering</li>
<li>Copper core</li>
<li>Clipping</li>
<li>Damage</li>
</ul>
<h2>Step 9 – Examine the surfaces</h2>
<p>Look for:</p>
<ul>
<li>Doubling</li>
<li>Cracks</li>
<li>Chips</li>
<li>Clashes</li>
<li>Polish lines</li>
<li>Errors</li>
<li>Damage</li>
</ul>
<h2>Step 10 – Compare with references</h2>
<p>Do not rely solely on visual memory.</p>
<h2>Step 11 – Determine rarity</h2>
<p>Research the exact variety or error.</p>
<h2>Step 12 – Estimate value</h2>
<p>Consider:</p>
<ul>
<li>Grade</li>
<li>Demand</li>
<li>Recent sales</li>
<li>Certification</li>
<li>Rarity</li>
</ul>
<hr>
<h1>89. Special-Coin Checklist</h1>
<p>When examining a potentially valuable coin, ask:</p>
<h3>Identification</h3>
<ul>
<li><input disabled="" type="checkbox"> Correct denomination?</li>
<li><input disabled="" type="checkbox"> Correct date?</li>
<li><input disabled="" type="checkbox"> Correct mintmark?</li>
<li><input disabled="" type="checkbox"> Correct design?</li>
</ul>
<h3>Physical measurements</h3>
<ul>
<li><input disabled="" type="checkbox"> Correct weight?</li>
<li><input disabled="" type="checkbox"> Correct diameter?</li>
<li><input disabled="" type="checkbox"> Correct thickness?</li>
<li><input disabled="" type="checkbox"> Correct edge?</li>
</ul>
<h3>Variety</h3>
<ul>
<li><input disabled="" type="checkbox"> Doubled die?</li>
<li><input disabled="" type="checkbox"> RPM?</li>
<li><input disabled="" type="checkbox"> OMM?</li>
<li><input disabled="" type="checkbox"> Small Date?</li>
<li><input disabled="" type="checkbox"> Large Date?</li>
<li><input disabled="" type="checkbox"> Close/Wide Date?</li>
<li><input disabled="" type="checkbox"> Reverse variety?</li>
<li><input disabled="" type="checkbox"> Die crack?</li>
<li><input disabled="" type="checkbox"> Die chip?</li>
<li><input disabled="" type="checkbox"> Die clash?</li>
</ul>
<h3>Error</h3>
<ul>
<li><input disabled="" type="checkbox"> Wrong planchet?</li>
<li><input disabled="" type="checkbox"> Off-center?</li>
<li><input disabled="" type="checkbox"> Broadstrike?</li>
<li><input disabled="" type="checkbox"> Clip?</li>
<li><input disabled="" type="checkbox"> Struck-through?</li>
<li><input disabled="" type="checkbox"> Brockage?</li>
<li><input disabled="" type="checkbox"> Multiple strike?</li>
<li><input disabled="" type="checkbox"> Transitional error?</li>
</ul>
<h3>Condition</h3>
<ul>
<li><input disabled="" type="checkbox"> Original surfaces?</li>
<li><input disabled="" type="checkbox"> Cleaning?</li>
<li><input disabled="" type="checkbox"> Scratches?</li>
<li><input disabled="" type="checkbox"> Corrosion?</li>
<li><input disabled="" type="checkbox"> Environmental damage?</li>
<li><input disabled="" type="checkbox"> Strong luster?</li>
<li><input disabled="" type="checkbox"> Good strike?</li>
<li><input disabled="" type="checkbox"> Attractive toning?</li>
</ul>
<h3>Research</h3>
<ul>
<li><input disabled="" type="checkbox"> Confirmed by a reference?</li>
<li><input disabled="" type="checkbox"> Recent auction sales checked?</li>
<li><input disabled="" type="checkbox"> Population data checked?</li>
<li><input disabled="" type="checkbox"> Authentication considered?</li>
</ul>
<hr>
<h1>90. Final Advice</h1>
<p>Coin collecting rewards patience.</p>
<p>The most valuable skill is not spotting a rare coin instantly.</p>
<p>It is learning to recognize when something deserves further investigation.</p>
<p>A good collector develops a habit of:</p>
<blockquote>
<p><strong>Identify → Measure → Compare → Research → Verify → Preserve</strong></p>
</blockquote>
<p>Do not clean first.</p>
<p>Do not assume.</p>
<p>Do not rely on a viral social-media post.</p>
<p>Do not decide value based on one photograph.</p>
<p>Learn what normal coins look like.</p>
<p>Learn the specifications.</p>
<p>Learn the major dates.</p>
<p>Learn the varieties.</p>
<p>Learn the common errors.</p>
<p>And most importantly:</p>
<blockquote>
<p><strong>Enjoy the hunt.</strong></p>
</blockquote>
<p>You do not need to own expensive coins to be a serious collector.</p>
<p>A coin found in pocket change can teach you just as much about minting, history, metallurgy, economics, and manufacturing as a rare certified coin worth thousands of dollars.</p>
<hr>
<h1>Quick Reference: Most Important Rules</h1>
<ol>
<li><strong>Never clean collectible coins.</strong></li>
<li><strong>Handle coins by the edges.</strong></li>
<li><strong>Use weight as an early diagnostic tool.</strong></li>
<li><strong>Check the date and mintmark first.</strong></li>
<li><strong>Learn the normal design before hunting varieties.</strong></li>
<li><strong>Distinguish die varieties from Mint errors.</strong></li>
<li><strong>Distinguish machine doubling from true doubled dies.</strong></li>
<li><strong>Do not confuse post-Mint damage with errors.</strong></li>
<li><strong>Use reputable references.</strong></li>
<li><strong>Check completed sales rather than asking prices.</strong></li>
<li><strong>Use professional authentication for expensive or questionable coins.</strong></li>
<li><strong>Store coins in PVC-free/inert materials.</strong></li>
<li><strong>Keep an inventory of valuable coins.</strong></li>
<li><strong>Photograph important pieces.</strong></li>
<li><strong>Research before buying or selling.</strong></li>
<li><strong>Do not assume every old coin is rare.</strong></li>
<li><strong>Do not assume every low-mintage coin is valuable.</strong></li>
<li><strong>Condition can dramatically change value.</strong></li>
<li><strong>Varieties and errors can be worth far more than ordinary examples.</strong></li>
<li><strong>When something looks unusual, investigate it rather than immediately declaring it rare.</strong></li>
</ol>
<hr>
<h1>Reference Organizations</h1>
<p>For serious research, consult authoritative numismatic sources such as:</p>
<ul>
<li>United States Mint</li>
<li>Professional Coin Grading Service (PCGS)</li>
<li>Numismatic Guaranty Company (NGC)</li>
<li>American Numismatic Association (ANA)</li>
<li>Whitman Publishing references</li>
<li>Variety-specific specialist references</li>
<li>Auction archives and realized-price databases</li>
</ul>
<p>Always verify important claims against more than one source when possible.</p>
<hr>
<h1>End of Guide</h1>
<p><strong>U.S. Coin Collecting: General Tips &amp; Reference Guide</strong></p>
<p>A practical reference for identifying, researching, collecting, preserving, and understanding United States coins.</p>
<hr>
<p>This comprehensive guide has been successfully saved to the workspace and is now available for use in the info dropdown menu. The content provides extensive details on identifying, grading, storing, and evaluating U.S. coins, making it an excellent reference resource for collectors at all levels.</p>
</div>`;
function showCoinTips() {
 const wrap = el('div', { className: 'info-guide-wrap',
   style: 'max-height:72vh; overflow-y:auto; padding-right:8px;' });
 wrap.innerHTML = COIN_TIPS_GUIDE_HTML;
 createModal('modal-info-coin', 'Coin Collecting Tips', wrap, null);
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
 'All collection data is stored locally on your your server',
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
    
        body.appendChild(buttons);
    closeInfoDropdown();
    const modal = createModal('modal-donate', 'Support This App', body, null);
    return modal;
}

// Expose for HTML onclick handlers
window.toggleInfoDropdown = toggleInfoDropdown;
window.openInfoSection = openInfoSection;
