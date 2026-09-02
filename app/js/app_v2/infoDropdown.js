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
  { key: 'noteTips', label: 'Paper Currency Guide' },
  { key: 'famousStories', label: 'Famous Coin Stories' },
  { key: 'rollHunting', label: 'Coin Roll-Hunting Guide' },
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


// --- Full-guide renderer ------------------------------------------------
function showGuide(key, title, html) {
  const wrap = el('div', { className: 'info-guide-wrap', style: 'max-height:72vh; overflow-y:auto; padding-right:8px;' });
  wrap.innerHTML = html;
  createModal('modal-info-' + key, title, wrap, null);
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

// --- Coin Collecting Guide (full master guide, 2026-09-02) -------------------
const COLLECTING_GUIDE_HTML = `<style>
.cc-guide { line-height: 1.55; font-size: 0.92em; color: var(--color-text-main); }
.cc-guide h1 { font-size: 1.35em; margin: 0.6em 0 0.4em; color: var(--color-accent); }
.cc-guide h2, .cc-guide h3 { font-size: 1.1em; margin: 1.1em 0 0.4em; color: var(--color-accent); border-bottom: 1px solid var(--color-border-light); padding-bottom: 2px; }
.cc-guide table { border-collapse: collapse; margin: 0.6em 0; width: 100%; }
.cc-guide th, .cc-guide td { border: 1px solid var(--color-border-light); padding: 4px 8px; font-size: 0.9em; text-align: left; }
.cc-guide th { background: var(--color-bg-card); }
.cc-guide code { background: var(--color-bg-body); padding: 1px 4px; border-radius: 3px; }
.cc-guide hr { border: none; border-top: 1px solid var(--color-border-light); margin: 1.2em 0; }
.cc-guide blockquote { border-left: 3px solid var(--color-accent); margin: 0.6em 0; padding: 2px 12px; color: var(--color-text-muted); }
</style><div class="cc-guide"><h1>U.S. Coin Collecting: A Complete Beginner&#39;s Guide</h1>
<h2>Identification, Varieties, Errors, Grading, Buying, Selling, Storage, Research, and Building a Collection</h2>
<hr>
<h1>Table of Contents</h1>
<ol>
<li><a href="#1-introduction">Introduction</a></li>
<li><a href="#2-what-is-numismatics">What Is Numismatics?</a></li>
<li><a href="#3-how-to-identify-a-us-coin">How to Identify a U.S. Coin</a></li>
<li><a href="#4-basic-coin-anatomy">Basic Coin Anatomy</a></li>
<li><a href="#5-us-mintmarks">U.S. Mintmarks</a></li>
<li><a href="#6-mintage-vs-rarity">Mintage vs. Rarity</a></li>
<li><a href="#7-key-dates-semi-key-dates-and-better-dates">Key Dates, Semi-Key Dates, and Better Dates</a></li>
<li><a href="#8-coin-types-and-type-designations">Coin Types and Type Designations</a></li>
<li><a href="#9-small-date-large-date-close-date-wide-date-and-other-date-styles">Small Date, Large Date, Close Date, Wide Date, and Other Date Styles</a></li>
<li><a href="#10-die-varieties">Die Varieties</a></li>
<li><a href="#11-doubled-dies">Doubled Dies</a></li>
<li><a href="#12-machine-doubling">Machine Doubling</a></li>
<li><a href="#13-repunched-mintmarks">Repunched Mintmarks</a></li>
<li><a href="#14-over-mintmarks">Over-Mintmarks</a></li>
<li><a href="#15-die-cracks">Die Cracks</a></li>
<li><a href="#16-cuds">Cuds</a></li>
<li><a href="#17-die-chips">Die Chips</a></li>
<li><a href="#18-die-clashes">Die Clashes</a></li>
<li><a href="#19-die-polish-lines">Die Polish Lines</a></li>
<li><a href="#20-die-states">Die States</a></li>
<li><a href="#21-mint-errors">Mint Errors</a></li>
<li><a href="#22-wrong-planchet-errors">Wrong-Planchet Errors</a></li>
<li><a href="#23-off-center-strikes">Off-Center Strikes</a></li>
<li><a href="#24-broadstrikes">Broadstrikes</a></li>
<li><a href="#25-clipped-planchets">Clipped Planchets</a></li>
<li><a href="#26-struck-through-errors">Struck-Through Errors</a></li>
<li><a href="#27-brockages">Brockages</a></li>
<li><a href="#28-multiple-strikes">Multiple Strikes</a></li>
<li><a href="#29-rotated-dies">Rotated Dies</a></li>
<li><a href="#30-transitional-errors">Transitional Errors</a></li>
<li><a href="#31-post-mint-damage">Post-Mint Damage</a></li>
<li><a href="#32-coin-weight">Coin Weight</a></li>
<li><a href="#33-coin-diameter-and-thickness">Coin Diameter and Thickness</a></li>
<li><a href="#34-us-coin-metal-compositions">U.S. Coin Metal Compositions</a></li>
<li><a href="#35-silver-coins">Silver Coins</a></li>
<li><a href="#36-gold-coins">Gold Coins</a></li>
<li><a href="#37-copper-coins">Copper Coins</a></li>
<li><a href="#38-nickel-and-nickel-alloy-coins">Nickel and Nickel-Alloy Coins</a></li>
<li><a href="#39-clad-coins">Clad Coins</a></li>
<li><a href="#40-proof-coins">Proof Coins</a></li>
<li><a href="#41-reverse-proof-coins">Reverse Proof Coins</a></li>
<li><a href="#42-mint-state-and-circulated-grades">Mint State and Circulated Grades</a></li>
<li><a href="#43-understanding-the-sheldon-grading-scale">Understanding the Sheldon Grading Scale</a></li>
<li><a href="#44-details-grades-and-problem-coins">Details Grades and Problem Coins</a></li>
<li><a href="#45-wear-vs-damage">Wear vs. Damage</a></li>
<li><a href="#46-cleaning-coins">Cleaning Coins</a></li>
<li><a href="#47-toning">Toning</a></li>
<li><a href="#48-luster">Luster</a></li>
<li><a href="#49-strike-quality">Strike Quality</a></li>
<li><a href="#50-eye-appeal">Eye Appeal</a></li>
<li><a href="#51-contact-marks-and-bag-marks">Contact Marks and Bag Marks</a></li>
<li><a href="#52-authenticating-a-coin">Authenticating a Coin</a></li>
<li><a href="#53-counterfeit-warning-signs">Counterfeit Warning Signs</a></li>
<li><a href="#54-using-a-scale">Using a Scale</a></li>
<li><a href="#55-using-magnification">Using Magnification</a></li>
<li><a href="#56-using-lighting">Using Lighting</a></li>
<li><a href="#57-using-a-magnet">Using a Magnet</a></li>
<li><a href="#58-inspecting-the-edge">Inspecting the Edge</a></li>
<li><a href="#59-researching-a-coin">Researching a Coin</a></li>
<li><a href="#60-coin-price-guides">Coin Price Guides</a></li>
<li><a href="#61-auction-prices-vs-asking-prices">Auction Prices vs. Asking Prices</a></li>
<li><a href="#62-population-reports">Population Reports</a></li>
<li><a href="#63-buying-coins">Buying Coins</a></li>
<li><a href="#64-buying-from-coin-dealers">Buying From Coin Dealers</a></li>
<li><a href="#65-buying-at-coin-shows">Buying at Coin Shows</a></li>
<li><a href="#66-buying-online">Buying Online</a></li>
<li><a href="#67-buying-from-auctions">Buying From Auctions</a></li>
<li><a href="#68-selling-coins">Selling Coins</a></li>
<li><a href="#69-getting-multiple-opinions">Getting Multiple Opinions</a></li>
<li><a href="#70-professional-authentication-and-grading">Professional Authentication and Grading</a></li>
<li><a href="#71-when-should-you-have-a-coin-graded">When Should You Have a Coin Graded?</a></li>
<li><a href="#72-coin-storage">Coin Storage</a></li>
<li><a href="#73-pvc-and-plastic-holders">PVC and Plastic Holders</a></li>
<li><a href="#74-handling-coins">Handling Coins</a></li>
<li><a href="#75-photographing-coins">Photographing Coins</a></li>
<li><a href="#76-keeping-a-collection-inventory">Keeping a Collection Inventory</a></li>
<li><a href="#77-provenance-and-documentation">Provenance and Documentation</a></li>
<li><a href="#78-insurance">Insurance</a></li>
<li><a href="#79-building-a-collection">Building a Collection</a></li>
<li><a href="#80-collecting-by-type">Collecting by Type</a></li>
<li><a href="#81-collecting-by-date">Collecting by Date</a></li>
<li><a href="#82-collecting-by-mintmark">Collecting by Mintmark</a></li>
<li><a href="#83-collecting-errors">Collecting Errors</a></li>
<li><a href="#84-collecting-die-varieties">Collecting Die Varieties</a></li>
<li><a href="#85-collecting-silver">Collecting Silver</a></li>
<li><a href="#86-collecting-gold">Collecting Gold</a></li>
<li><a href="#87-collecting-modern-coins">Collecting Modern Coins</a></li>
<li><a href="#88-roll-hunting">Roll Hunting</a></li>
<li><a href="#89-pocket-change-hunting">Pocket Change Hunting</a></li>
<li><a href="#90-estate-and-inherited-collections">Estate and Inherited Collections</a></li>
<li><a href="#91-coin-clubs-and-communities">Coin Clubs and Communities</a></li>
<li><a href="#92-beginner-equipment">Beginner Equipment</a></li>
<li><a href="#93-advanced-equipment">Advanced Equipment</a></li>
<li><a href="#94-how-to-study-a-coin-series">How to Study a Coin Series</a></li>
<li><a href="#95-the-normal-first-rule">The Normal-First Rule</a></li>
<li><a href="#96-the-did-the-mint-make-it-rule">The &quot;Did the Mint Make It?&quot; Rule</a></li>
<li><a href="#97-the-why-is-it-valuable-rule">The &quot;Why Is It Valuable?&quot; Rule</a></li>
<li><a href="#98-common-beginner-mistakes">Common Beginner Mistakes</a></li>
<li><a href="#99-master-coin-identification-workflow">Master Coin Identification Workflow</a></li>
<li><a href="#100-master-is-this-coin-special-checklist">Master &quot;Is This Coin Special?&quot; Checklist</a></li>
<li><a href="#101-final-advice">Final Advice</a></li>
</ol>
<hr>
<h1>1. Introduction</h1>
<p>Coin collecting is one of the easiest hobbies to begin and one of the deepest hobbies to master.</p>
<p>You can start by looking through pocket change, searching bank rolls, examining coins inherited from family, or building a collection of historically important pieces.</p>
<p>The important thing to understand is that <strong>valuable coins are not valuable simply because they are old</strong>.</p>
<p>A coin can be valuable because it is:</p>
<ul>
<li>Rare</li>
<li>Historically important</li>
<li>Difficult to find in high grade</li>
<li>A scarce date or mintmark</li>
<li>A major die variety</li>
<li>A genuine Mint error</li>
<li>Made from precious metal</li>
<li>An unusual die state</li>
<li>An important transitional issue</li>
<li>Exceptionally attractive</li>
<li>In demand among collectors</li>
</ul>
<p>The goal of this guide is to teach you how to determine <strong>what you actually have before deciding what it is worth</strong>.</p>
<hr>
<h1>2. What Is Numismatics?</h1>
<p><strong>Numismatics</strong> is the study and collection of coins, paper money, medals, tokens, and related objects.</p>
<p>A person who collects or studies coins is commonly called a:</p>
<p><strong>Numismatist</strong></p>
<p>You do not have to be an expert to be a numismatist.</p>
<p>The moment you begin learning why coins were made, how they were produced, and why some are more desirable than others, you are studying numismatics.</p>
<hr>
<h1>3. How to Identify a U.S. Coin</h1>
<p>When you find an unfamiliar coin, do not immediately search for its value.</p>
<p>Identify it first.</p>
<p>Use this order:</p>
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
<li>Variety</li>
<li>Error status</li>
<li>Condition</li>
<li>Authenticity</li>
<li>Market value</li>
</ol>
<p>This sequence prevents many identification mistakes.</p>
<hr>
<h1>4. Basic Coin Anatomy</h1>
<h2>Obverse</h2>
<p>The obverse is commonly called the &quot;heads&quot; side.</p>
<h2>Reverse</h2>
<p>The reverse is commonly called the &quot;tails&quot; side.</p>
<h2>Edge</h2>
<p>The edge is the surface around the outside of the coin.</p>
<p>It can be:</p>
<ul>
<li>Plain</li>
<li>Reeded</li>
<li>Lettered</li>
<li>Decorated</li>
</ul>
<h2>Rim</h2>
<p>The rim is the raised border around the coin.</p>
<h2>Field</h2>
<p>The field is the relatively flat background area surrounding the main design.</p>
<h2>Relief</h2>
<p>Relief refers to the raised portions of the design.</p>
<h2>Devices</h2>
<p>The individual design elements are commonly called devices.</p>
<h2>Mintmark</h2>
<p>A mintmark identifies the Mint facility that produced the coin.</p>
<h2>Date</h2>
<p>The date normally identifies the year of the coin&#39;s issue, although certain historical varieties and restrikes require more investigation.</p>
<hr>
<h1>5. U.S. Mintmarks</h1>
<p>Modern and historical U.S. coins can have different mintmarks.</p>
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
<p>Historical mintmarks include:</p>
<table>
<thead>
<tr>
<th>Mintmark</th>
<th>Mint</th>
</tr>
</thead>
<tbody><tr>
<td>C</td>
<td>Charlotte</td>
</tr>
<tr>
<td>CC</td>
<td>Carson City</td>
</tr>
<tr>
<td>D</td>
<td>Dahlonega</td>
</tr>
<tr>
<td>O</td>
<td>New Orleans</td>
</tr>
</tbody></table>
<p>Some Philadelphia coins have no mintmark.</p>
<h2>Important</h2>
<p>The same letter can represent different historical mints.</p>
<p>For example:</p>
<p><strong>D</strong></p>
<p>can mean:</p>
<ul>
<li>Denver</li>
<li>Dahlonega</li>
</ul>
<p>The date and coin type determine which one is possible.</p>
<hr>
<h1>6. Mintage vs. Rarity</h1>
<p><strong>Mintage</strong> means the number of coins produced.</p>
<p>It does <strong>not</strong> mean the number of coins surviving today.</p>
<p>For example:</p>
<p>A coin may have had a large mintage but very few survivors because:</p>
<ul>
<li>It was melted</li>
<li>It circulated heavily</li>
<li>It was exported</li>
<li>It was lost</li>
<li>It was damaged</li>
<li>It was destroyed</li>
<li>Collectors did not save it</li>
<li>Precious-metal content encouraged melting</li>
</ul>
<p>Conversely, a low-mintage coin can sometimes have a relatively large surviving population because collectors saved most examples.</p>
<p>Therefore:</p>
<p><strong>Mintage ≠ surviving population ≠ rarity in a particular grade</strong></p>
<hr>
<h1>7. Key Dates, Semi-Key Dates, and Better Dates</h1>
<p>These terms are usually used within a particular coin series.</p>
<h2>Key Date</h2>
<p>A key date is one of the most difficult issues to obtain for a series.</p>
<h2>Semi-Key Date</h2>
<p>A semi-key is scarce enough to be notably more difficult to find than common issues, but generally not as difficult as the major keys.</p>
<h2>Better Date</h2>
<p>A better date is a somewhat informal term for a date that is scarcer or more desirable than common dates.</p>
<h2>Important</h2>
<p>These classifications can vary by reference and market.</p>
<p>A date should not be called a &quot;key&quot; merely because an internet listing says it is rare.</p>
<hr>
<h1>8. Coin Types and Type Designations</h1>
<p>A <strong>type</strong> is a particular design or major design variation.</p>
<p>For example, the United States has produced multiple types of:</p>
<ul>
<li>Cents</li>
<li>Nickels</li>
<li>Dimes</li>
<li>Quarters</li>
<li>Half dollars</li>
<li>Dollars</li>
</ul>
<p>Type numbers are <strong>not universal</strong>.</p>
<p>If a reference says:</p>
<p><strong>Type 1</strong></p>
<p>that does not mean the same thing for every series.</p>
<p>The exact series must always be identified first.</p>
<hr>
<h1>9. Small Date, Large Date, Close Date, Wide Date, and Other Date Styles</h1>
<p>One of the most confusing areas for beginners is terminology involving dates.</p>
<p>Terms such as:</p>
<ul>
<li>Small Date</li>
<li>Large Date</li>
<li>Close Date</li>
<li>Wide Date</li>
<li>High Date</li>
<li>Low Date</li>
<li>Near Date</li>
<li>Far Date</li>
</ul>
<p>are generally <strong>series-specific descriptions</strong>.</p>
<p>They do not have one universal measurement that applies to every U.S. coin.</p>
<p>Differences can involve:</p>
<ul>
<li>Numeral height</li>
<li>Numeral width</li>
<li>Spacing</li>
<li>Shape</li>
<li>Position</li>
<li>Alignment</li>
<li>Relationship to the rim</li>
<li>Relationship between individual digits</li>
<li>Relationship to nearby design elements</li>
</ul>
<h2>Example</h2>
<p>A &quot;Small Date&quot; variety may have:</p>
<ul>
<li>Shorter numerals</li>
<li>Narrower numerals</li>
<li>Different spacing</li>
<li>Different placement</li>
</ul>
<p>while the &quot;Large Date&quot; may have taller or wider numerals.</p>
<p>The exact diagnostic depends on the coin.</p>
<h2>Critical Rule</h2>
<p>Never identify a Small Date or Large Date simply because the date &quot;looks smaller.&quot;</p>
<p>Compare the coin against known examples and the published diagnostics for that exact issue.</p>
<hr>
<h1>10. Die Varieties</h1>
<p>A <strong>die variety</strong> is a repeatable difference caused by the creation or modification of a particular die.</p>
<p>The important concept is:</p>
<p><strong>The difference originates from the die.</strong></p>
<p>That means multiple coins struck by the same die can show the same characteristic.</p>
<p>Examples include:</p>
<ul>
<li>Doubled dies</li>
<li>Repunched mintmarks</li>
<li>Over-mintmarks</li>
<li>Different date punches</li>
<li>Hub changes</li>
<li>Die chips</li>
<li>Die cracks</li>
<li>Die clashes</li>
<li>Other die markers</li>
</ul>
<hr>
<h1>11. Doubled Dies</h1>
<p>A doubled die is created during the die-making process.</p>
<p>The design is accidentally impressed into the die more than once in different positions.</p>
<p>Coins struck by that die can show the resulting doubling.</p>
<h2>DDO</h2>
<p><strong>DDO = Doubled Die Obverse</strong></p>
<p>The doubling is on the obverse.</p>
<h2>DDR</h2>
<p><strong>DDR = Doubled Die Reverse</strong></p>
<p>The doubling is on the reverse.</p>
<h2>What to Look For</h2>
<p>Potential doubled-die characteristics include:</p>
<ul>
<li>Split serifs</li>
<li>Extra outlines</li>
<li>Extra lettering</li>
<li>Extra date elements</li>
<li>Distinct separation</li>
<li>Doubling in design elements</li>
</ul>
<p>The exact appearance depends on the coin.</p>
<hr>
<h1>12. Machine Doubling</h1>
<p>Machine doubling is often confused with a doubled die.</p>
<p>Machine doubling occurs during the striking process rather than being created as a doubled die variety.</p>
<p>It often appears:</p>
<ul>
<li>Flat</li>
<li>Shelf-like</li>
<li>Abraded</li>
<li>One-sided</li>
<li>Blunt</li>
</ul>
<p>A genuine doubled die usually has more distinct separation or secondary design characteristics.</p>
<h2>Important</h2>
<p>Not every coin showing something that looks like doubling is valuable.</p>
<p>Always compare the feature with known examples.</p>
<hr>
<h1>13. Repunched Mintmarks</h1>
<p>A <strong>Repunched Mintmark</strong>, or <strong>RPM</strong>, occurs when a mintmark was punched into a die more than once in different positions.</p>
<p>This is especially important on older U.S. coins.</p>
<p>The earlier punch can leave remnants visible next to or underneath the final mintmark.</p>
<p>RPM varieties are highly series-specific.</p>
<hr>
<h1>14. Over-Mintmarks</h1>
<p>An <strong>Over-Mintmark</strong>, commonly abbreviated OMM, occurs when one mintmark was punched over another.</p>
<p>These are particularly associated with periods when mintmarks were applied manually.</p>
<p>They can be difficult to identify and should be compared against documented examples.</p>
<hr>
<h1>15. Die Cracks</h1>
<p>A die crack develops when a coin die physically cracks.</p>
<p>The crack can appear on struck coins as a:</p>
<p><strong>Raised line</strong></p>
<p>This distinction is important.</p>
<p>A crack in the die becomes a raised feature on the coin because the damaged area of the die creates metal displacement during striking.</p>
<h2>Why They Matter</h2>
<p>A die can continue producing coins after developing a crack.</p>
<p>Therefore the same crack can appear on:</p>
<ul>
<li>Dozens of coins</li>
<li>Hundreds of coins</li>
<li>Thousands of coins</li>
<li>Potentially many more</li>
</ul>
<p>Some die cracks are common and have little premium.</p>
<p>Others become famous and collectible.</p>
<hr>
<h1>16. Cuds</h1>
<p>A <strong>cud</strong> occurs when part of the die breaks away.</p>
<p>The missing section of the die can produce a large raised area on the coin.</p>
<p>A dramatic cud can be much more collectible than a tiny die crack.</p>
<h2>General Rule</h2>
<p>The larger, clearer, and more dramatic the cud, the more likely it is to attract collector interest.</p>
<hr>
<h1>17. Die Chips</h1>
<p>A die chip occurs when a small piece of the die breaks away.</p>
<p>This can produce a raised blob or lump on the coin.</p>
<p>Small die chips are common.</p>
<p>Large, unusual, or well-known die chips can be collectible.</p>
<p>Do not assume every tiny raised bump is a valuable die chip.</p>
<hr>
<h1>18. Die Clashes</h1>
<p>A die clash occurs when the obverse and reverse dies come together without a planchet properly between them.</p>
<p>Parts of one die can leave impressions on the opposing die.</p>
<p>Coins struck afterward can show unusual transferred design elements.</p>
<p>Clashes can be highly collectible depending on the series and severity.</p>
<hr>
<h1>19. Die Polish Lines</h1>
<p>Dies are sometimes polished to remove damage or imperfections.</p>
<p>Polishing can leave lines in the die.</p>
<p>Those lines may transfer to coins.</p>
<p>Because the die feature is recessed, die polish lines are generally:</p>
<p><strong>Raised on the coin</strong></p>
<p>This is an important diagnostic distinction.</p>
<hr>
<h1>20. Die States</h1>
<p>A die can change throughout its useful life.</p>
<p>A coin struck early in the life of a die can look different from one struck after the die develops:</p>
<ul>
<li>Cracks</li>
<li>Chips</li>
<li>Clash marks</li>
<li>Polishing</li>
<li>Wear</li>
<li>Other damage</li>
</ul>
<p>These stages are called <strong>die states</strong>.</p>
<p>Collectors sometimes specialize in tracking the progression of a die.</p>
<hr>
<h1>21. Mint Errors</h1>
<p>A Mint error is a manufacturing mistake that occurred during production and escaped normal quality control.</p>
<p>Major categories include:</p>
<ul>
<li>Wrong planchet</li>
<li>Off-center</li>
<li>Broadstrike</li>
<li>Clipped planchet</li>
<li>Struck-through</li>
<li>Brockage</li>
<li>Multiple strike</li>
<li>Rotated die</li>
<li>Transitional error</li>
<li>Other striking or planchet errors</li>
</ul>
<h2>Important</h2>
<p>A coin being damaged after leaving the Mint does <strong>not</strong> make it a Mint error.</p>
<hr>
<h1>22. Wrong-Planchet Errors</h1>
<p>A planchet is the prepared metal blank that is struck into a coin.</p>
<p>A wrong-planchet error occurs when a coin is struck on a planchet intended for a different coin.</p>
<p>Potential clues include:</p>
<ul>
<li>Incorrect weight</li>
<li>Incorrect diameter</li>
<li>Incorrect thickness</li>
<li>Wrong metal</li>
<li>Wrong edge characteristics</li>
<li>Design that does not fit the planchet properly</li>
</ul>
<h2>Example Concept</h2>
<p>If a dime design is found struck on a planchet intended for another denomination, the resulting coin can be a major error.</p>
<h2>Important</h2>
<p>Weight alone is never sufficient proof.</p>
<hr>
<h1>23. Off-Center Strikes</h1>
<p>An off-center strike occurs when the planchet is not properly positioned beneath the dies.</p>
<p>The resulting coin may have:</p>
<ul>
<li>Missing design</li>
<li>A large blank crescent</li>
<li>Partial rim</li>
<li>Distorted positioning</li>
</ul>
<p>The amount of off-center striking can vary dramatically.</p>
<p>Large, dramatic off-center errors are generally more desirable than tiny deviations.</p>
<hr>
<h1>24. Broadstrikes</h1>
<p>A broadstrike occurs when the collar does not properly contain the planchet during striking.</p>
<p>The coin can expand outward.</p>
<p>Typical characteristics include:</p>
<ul>
<li>Enlarged diameter</li>
<li>Flattened or expanded shape</li>
<li>Missing normal edge characteristics</li>
<li>Design spread outward</li>
</ul>
<hr>
<h1>25. Clipped Planchets</h1>
<p>A clipped planchet occurs when part of the blank is missing before the coin is struck.</p>
<p>Types can include:</p>
<ul>
<li>Curved clips</li>
<li>Straight clips</li>
<li>Ragged clips</li>
</ul>
<p>Authentic clips have recognizable physical characteristics.</p>
<h2>Important</h2>
<p>Post-mint damage can imitate a clip.</p>
<p>Do not assume a curved missing section automatically means a clipped planchet.</p>
<hr>
<h1>26. Struck-Through Errors</h1>
<p>A struck-through error occurs when foreign material interferes with the striking process.</p>
<p>Possible results include:</p>
<ul>
<li>Weak design</li>
<li>Missing design</li>
<li>Distorted design</li>
<li>Incuse impressions</li>
<li>Strange surface texture</li>
</ul>
<p>The appearance depends on what was between the die and planchet.</p>
<hr>
<h1>27. Brockages</h1>
<p>A brockage can occur when a struck coin sticks to a die.</p>
<p>That coin can then transfer part of its design to another planchet.</p>
<p>Brockages can create:</p>
<ul>
<li>Incuse design</li>
<li>Mirror-image design</li>
<li>Partial transferred designs</li>
</ul>
<p>They can be dramatic and highly collectible.</p>
<hr>
<h1>28. Multiple Strikes</h1>
<p>A coin can occasionally be struck more than once.</p>
<p>Potential clues include:</p>
<ul>
<li>Duplicated design</li>
<li>Overlapping impressions</li>
<li>Multiple rims</li>
<li>Displaced lettering</li>
<li>Rotated secondary strikes</li>
</ul>
<p>Do not confuse a true multiple strike with:</p>
<ul>
<li>Machine doubling</li>
<li>Die doubling</li>
<li>Die deterioration</li>
</ul>
<hr>
<h1>29. Rotated Dies</h1>
<p>The obverse and reverse of a coin have an intended orientation.</p>
<p>A significant deviation from the intended orientation can be collectible.</p>
<p>Small deviations can occur and may not be significant depending on the issue.</p>
<p>When checking a rotated die:</p>
<ol>
<li>Hold the coin upright by the obverse.</li>
<li>Rotate it vertically.</li>
<li>Observe the reverse.</li>
<li>Compare the orientation to the expected standard.</li>
</ol>
<hr>
<h1>30. Transitional Errors</h1>
<p>A transitional error occurs around a change in coin composition or design.</p>
<p>The Mint changes specifications, but an old planchet or old composition can sometimes be struck with a new design.</p>
<p>These errors can be extremely valuable.</p>
<p>Because transitional errors are frequently counterfeited or misidentified, authentication is especially important.</p>
<hr>
<h1>31. Post-Mint Damage</h1>
<p>One of the most important skills in collecting is recognizing damage that happened <strong>after the coin left the Mint</strong>.</p>
<p>Common examples include:</p>
<ul>
<li>Scratches</li>
<li>Bends</li>
<li>Gouges</li>
<li>Filing</li>
<li>Drilling</li>
<li>Grinding</li>
<li>Polishing</li>
<li>Chemical damage</li>
<li>Heat damage</li>
<li>Road damage</li>
<li>Plating</li>
<li>Artificial toning</li>
</ul>
<h2>The Key Question</h2>
<blockquote>
<p>Could this feature realistically have been created during Mint production?</p>
</blockquote>
<p>If not, it is probably post-Mint damage.</p>
<hr>
<h1>32. Coin Weight</h1>
<p>Weight is one of the most useful diagnostic tools available to a collector.</p>
<p>A digital scale accurate to:</p>
<p><strong>0.01 gram</strong></p>
<p>is an excellent basic tool.</p>
<p>Weight can help identify:</p>
<ul>
<li>Silver coins</li>
<li>Wrong-planchet errors</li>
<li>Counterfeits</li>
<li>Composition changes</li>
<li>Altered coins</li>
<li>Clipped planchets</li>
</ul>
<h2>Important</h2>
<p>Weight is evidence, not proof.</p>
<p>A counterfeit can be made to the correct weight.</p>
<p>A genuine damaged coin can also weigh incorrectly.</p>
<hr>
<h1>33. Coin Diameter and Thickness</h1>
<p>When investigating an unusual coin, measure:</p>
<ul>
<li>Weight</li>
<li>Diameter</li>
<li>Thickness</li>
</ul>
<p>Then compare those measurements with a reliable reference.</p>
<p>The combination is much more useful than any individual measurement.</p>
<hr>
<h1>34. U.S. Coin Metal Compositions</h1>
<p>Coin specifications have changed repeatedly throughout U.S. history.</p>
<p>Common examples include:</p>
<table>
<thead>
<tr>
<th>Coin / Period</th>
<th>Approximate Composition</th>
</tr>
</thead>
<tbody><tr>
<td>Early U.S. cents</td>
<td>Various copper-based alloys</td>
</tr>
<tr>
<td>Indian Head cents</td>
<td>Bronze for most later issues</td>
</tr>
<tr>
<td>Lincoln cents before 1982</td>
<td>Mostly copper</td>
</tr>
<tr>
<td>1943 cent</td>
<td>Zinc-coated steel</td>
</tr>
<tr>
<td>Lincoln cents after 1982</td>
<td>Copper-plated zinc, with some exceptions and special issues</td>
</tr>
<tr>
<td>Jefferson nickel</td>
<td>Copper-nickel</td>
</tr>
<tr>
<td>Wartime Jefferson nickel</td>
<td>35% silver, 56% copper, 9% manganese</td>
</tr>
<tr>
<td>Roosevelt dime through 1964</td>
<td>90% silver</td>
</tr>
<tr>
<td>Washington quarter through 1964</td>
<td>90% silver</td>
</tr>
<tr>
<td>Kennedy half, 1964</td>
<td>90% silver</td>
</tr>
<tr>
<td>Kennedy half, 1965-1970</td>
<td>40% silver</td>
</tr>
<tr>
<td>Modern clad coins</td>
<td>Copper-nickel over copper core</td>
</tr>
<tr>
<td>Morgan dollar</td>
<td>90% silver</td>
</tr>
<tr>
<td>Peace dollar</td>
<td>90% silver</td>
</tr>
</tbody></table>
<p>Always verify the exact issue.</p>
<hr>
<h1>35. Silver Coins</h1>
<p>Many U.S. coins contain silver.</p>
<p>Major circulation silver milestones include:</p>
<h2>Dimes</h2>
<p>U.S. dimes dated:</p>
<p><strong>1964 and earlier</strong></p>
<p>are generally 90% silver.</p>
<h2>Quarters</h2>
<p>U.S. quarters dated:</p>
<p><strong>1964 and earlier</strong></p>
<p>are generally 90% silver.</p>
<h2>Half Dollars</h2>
<p>Half dollars dated:</p>
<p><strong>1964 and earlier</strong></p>
<p>are generally 90% silver.</p>
<p>Kennedy halves dated:</p>
<p><strong>1965-1970</strong></p>
<p>are generally 40% silver.</p>
<h2>Wartime Nickels</h2>
<p>Certain Jefferson nickels dated:</p>
<p><strong>1942-1945</strong></p>
<p>contain 35% silver.</p>
<p>These are identifiable by the large mintmark above Monticello on the reverse.</p>
<hr>
<h1>36. Gold Coins</h1>
<p>U.S. gold coins have been produced in many denominations.</p>
<p>Historic denominations include:</p>
<ul>
<li>$1</li>
<li>$2.50</li>
<li>$3</li>
<li>$5</li>
<li>$10</li>
<li>$20</li>
</ul>
<p>Modern bullion and commemorative gold coins also exist.</p>
<p>When evaluating gold coins determine:</p>
<ul>
<li>Gross weight</li>
<li>Fineness</li>
<li>Actual gold weight</li>
<li>Date</li>
<li>Mintmark</li>
<li>Type</li>
<li>Condition</li>
<li>Rarity</li>
<li>Authenticity</li>
</ul>
<p>Do not assume the total weight equals the amount of gold.</p>
<hr>
<h1>37. Copper Coins</h1>
<p>Copper and bronze cents can be especially interesting because composition changed over time.</p>
<p>Important examples include:</p>
<ul>
<li>Large cents</li>
<li>Flying Eagle cents</li>
<li>Indian Head cents</li>
<li>Early Lincoln cents</li>
<li>1943 steel cents</li>
<li>Modern copper-plated zinc cents</li>
</ul>
<p>Some dates can be valuable because of rarity or varieties rather than metal content.</p>
<hr>
<h1>38. Nickel and Nickel-Alloy Coins</h1>
<p>The U.S. five-cent coin has historically used several compositions.</p>
<p>The standard Jefferson nickel composition is generally:</p>
<p><strong>75% copper / 25% nickel</strong></p>
<p>The major exception is the wartime alloy:</p>
<p><strong>35% silver / 56% copper / 9% manganese</strong></p>
<p>These wartime nickels were made during:</p>
<p><strong>1942-1945</strong></p>
<p>and have a large mintmark above Monticello.</p>
<hr>
<h1>39. Clad Coins</h1>
<p>Modern U.S. dimes, quarters, and many half dollars use clad construction.</p>
<p>Clad means the coin is composed of layers of different metals.</p>
<p>Modern clad coins generally have:</p>
<ul>
<li>Copper-nickel outer layers</li>
<li>Copper core</li>
</ul>
<p>The edge can reveal the layered construction.</p>
<p>A coin showing an unusual edge color or layer can deserve additional investigation.</p>
<hr>
<h1>40. Proof Coins</h1>
<p>Proof describes a special manufacturing process.</p>
<p>Proof coins commonly have:</p>
<ul>
<li>Mirrorlike fields</li>
<li>Sharp details</li>
<li>Frosted design elements</li>
</ul>
<p>A coin being shiny does not automatically make it a proof.</p>
<p>Proofs are generally made specifically for collectors rather than ordinary circulation.</p>
<hr>
<h1>41. Reverse Proof Coins</h1>
<p>A reverse proof uses the opposite visual contrast from a conventional proof.</p>
<p>Generally:</p>
<ul>
<li>Fields appear frosted</li>
<li>Design elements appear mirrorlike</li>
</ul>
<p>Reverse proofs are modern collector issues and are often produced for special sets.</p>
<hr>
<h1>42. Mint State and Circulated Grades</h1>
<p><strong>Mint State</strong> generally means a coin that has not experienced circulation wear.</p>
<p>Circulated coins show varying amounts of wear.</p>
<p>Common circulated grades include:</p>
<ul>
<li>Good</li>
<li>Very Good</li>
<li>Fine</li>
<li>Very Fine</li>
<li>Extremely Fine</li>
<li>About Uncirculated</li>
</ul>
<p>Uncirculated grades include:</p>
<ul>
<li>MS-60</li>
<li>MS-61</li>
<li>MS-62</li>
<li>MS-63</li>
<li>MS-64</li>
<li>MS-65</li>
<li>MS-66</li>
<li>MS-67</li>
<li>MS-68</li>
<li>MS-69</li>
<li>MS-70</li>
</ul>
<p>Not every coin can realistically exist at every grade.</p>
<hr>
<h1>43. Understanding the Sheldon Grading Scale</h1>
<p>The Sheldon scale runs from:</p>
<p><strong>1 to 70</strong></p>
<p>with:</p>
<ul>
<li>1 representing extremely poor condition</li>
<li>70 representing a theoretically perfect coin</li>
</ul>
<p>The scale is now widely used for certified U.S. coins.</p>
<p>Examples:</p>
<p><strong>G-4</strong><br>Very heavily worn but identifiable.</p>
<p><strong>VG-8</strong><br>More detail remains.</p>
<p><strong>F-12</strong><br>Moderate circulation wear.</p>
<p><strong>VF-20</strong><br>Considerable detail remains.</p>
<p><strong>XF-40</strong><br>Light wear.</p>
<p><strong>AU-50</strong><br>About Uncirculated.</p>
<p><strong>MS-60+</strong><br>Uncirculated.</p>
<hr>
<h1>44. Details Grades and Problem Coins</h1>
<p>A coin can be genuine but have a problem preventing a normal numerical grade.</p>
<p>Examples:</p>
<ul>
<li>Cleaning</li>
<li>Scratches</li>
<li>Environmental damage</li>
<li>Corrosion</li>
<li>Mounting</li>
<li>Alteration</li>
</ul>
<p>A grading service may therefore assign a:</p>
<p><strong>Details grade</strong></p>
<p>rather than a normal numeric grade.</p>
<p>A genuine coin with a Details grade can still be valuable.</p>
<hr>
<h1>45. Wear vs. Damage</h1>
<p>Wear is primarily caused by circulation.</p>
<p>Damage is caused by something abnormal happening to the coin.</p>
<h2>Wear</h2>
<p>Usually produces gradual loss of detail.</p>
<h2>Damage</h2>
<p>Can include:</p>
<ul>
<li>Sharp scratches</li>
<li>Gouges</li>
<li>Chemical discoloration</li>
<li>Dents</li>
<li>Bends</li>
<li>Filing</li>
<li>Polishing</li>
</ul>
<p>Learning this distinction is essential for grading.</p>
<hr>
<h1>46. Cleaning Coins</h1>
<h2>Do Not Clean Valuable Coins</h2>
<p>Avoid:</p>
<ul>
<li>Metal polish</li>
<li>Toothpaste</li>
<li>Baking soda</li>
<li>Abrasive cloth</li>
<li>Jewelry cleaner</li>
<li>Tarnish remover</li>
<li>Erasers</li>
<li>Dremels</li>
<li>Sandpaper</li>
</ul>
<p>Cleaning can leave permanent hairlines and change the surface.</p>
<p>A cleaned coin can be worth substantially less than an otherwise similar uncleaned coin.</p>
<hr>
<h1>47. Toning</h1>
<p>Toning is a chemical change to the coin&#39;s surface.</p>
<p>It can occur naturally over time.</p>
<p>Toning can be:</p>
<ul>
<li>Attractive</li>
<li>Neutral</li>
<li>Unattractive</li>
<li>Artificial</li>
<li>Damaging</li>
</ul>
<p>Some collectors strongly value attractive natural toning.</p>
<p>Others prefer brilliant untoned coins.</p>
<p>Color alone does not determine value.</p>
<hr>
<h1>48. Luster</h1>
<p>Mint luster is the characteristic reflective appearance created by the striking process and movement of metal across the die.</p>
<p>It is different from:</p>
<p><strong>Shine caused by polishing.</strong></p>
<p>Strong original luster can be an important factor in determining the quality and desirability of an uncirculated coin.</p>
<hr>
<h1>49. Strike Quality</h1>
<p>Strike refers to how strongly the dies impressed the design.</p>
<p>Some coin series are notorious for weak strikes in specific areas.</p>
<p>A weak strike does not necessarily mean the coin is damaged.</p>
<p>A sharply struck coin can be more desirable than another coin of the same numerical grade.</p>
<hr>
<h1>50. Eye Appeal</h1>
<p>Eye appeal is the overall visual attractiveness of a coin.</p>
<p>It can involve:</p>
<ul>
<li>Color</li>
<li>Toning</li>
<li>Luster</li>
<li>Strike</li>
<li>Surfaces</li>
<li>Marks</li>
<li>Centering</li>
<li>Overall appearance</li>
</ul>
<p>Two coins with identical grades can have very different eye appeal and market values.</p>
<hr>
<h1>51. Contact Marks and Bag Marks</h1>
<p>Coins can hit one another during:</p>
<ul>
<li>Mint transport</li>
<li>Bagging</li>
<li>Storage</li>
<li>Handling</li>
</ul>
<p>These marks are commonly called:</p>
<ul>
<li>Contact marks</li>
<li>Bag marks</li>
</ul>
<p>They are particularly noticeable on large silver dollars.</p>
<hr>
<h1>52. Authenticating a Coin</h1>
<p>For an important coin, evaluate:</p>
<ul>
<li>Weight</li>
<li>Diameter</li>
<li>Thickness</li>
<li>Edge</li>
<li>Metal</li>
<li>Design</li>
<li>Lettering</li>
<li>Date</li>
<li>Mintmark</li>
<li>Surface texture</li>
<li>Strike</li>
<li>Die characteristics</li>
</ul>
<p>Compare the coin with known genuine examples.</p>
<p>For expensive coins, professional authentication is strongly recommended.</p>
<hr>
<h1>53. Counterfeit Warning Signs</h1>
<p>Potential warning signs include:</p>
<ul>
<li>Incorrect weight</li>
<li>Incorrect dimensions</li>
<li>Incorrect edge</li>
<li>Wrong lettering</li>
<li>Incorrect mintmark</li>
<li>Casting bubbles</li>
<li>Seams</li>
<li>Soft details</li>
<li>Unusual luster</li>
<li>Incorrect color</li>
<li>Wrong metal</li>
<li>Unusual surface texture</li>
<li>Suspicious tooling</li>
</ul>
<h2>Important</h2>
<p>No single characteristic proves a coin is counterfeit.</p>
<p>Use multiple diagnostics.</p>
<hr>
<h1>54. Using a Scale</h1>
<p>A collector&#39;s digital scale should ideally read to:</p>
<p><strong>0.01 gram</strong></p>
<p>Place the coin directly on the scale.</p>
<p>Record the result.</p>
<p>Then compare it with a trusted specification.</p>
<p>For particularly important coins, repeat the measurement using another scale if possible.</p>
<hr>
<h1>55. Using Magnification</h1>
<p>A:</p>
<p><strong>5x-10x loupe</strong></p>
<p>is an excellent starting point.</p>
<p>Use magnification for:</p>
<ul>
<li>Mintmarks</li>
<li>Date varieties</li>
<li>Doubled dies</li>
<li>Die chips</li>
<li>Die cracks</li>
<li>Small scratches</li>
<li>Surface problems</li>
</ul>
<p>Do not assume something is valuable merely because it can be seen under extreme magnification.</p>
<hr>
<h1>56. Using Lighting</h1>
<p>Good lighting is one of the most important tools for coin examination.</p>
<p>Move the coin under the light.</p>
<p>Change the angle.</p>
<p>Look for:</p>
<ul>
<li>Hairlines</li>
<li>Cleaning</li>
<li>Luster</li>
<li>Scratches</li>
<li>Toning</li>
<li>Die cracks</li>
<li>Surface damage</li>
</ul>
<p>A coin can look completely different under different lighting.</p>
<hr>
<h1>57. Using a Magnet</h1>
<p>A magnet can be useful as a screening tool.</p>
<p>For example:</p>
<p><strong>1943 steel cents are magnetic.</strong></p>
<p>Most ordinary copper cents are not.</p>
<p>However:</p>
<p><strong>Magnetism does not prove authenticity.</strong></p>
<p>Use magnetic behavior together with:</p>
<ul>
<li>Weight</li>
<li>Dimensions</li>
<li>Appearance</li>
<li>Edge</li>
<li>Composition</li>
</ul>
<hr>
<h1>58. Inspecting the Edge</h1>
<p>The edge is one of the most useful and overlooked parts of a coin.</p>
<p>Check for:</p>
<ul>
<li>Reeded edge</li>
<li>Plain edge</li>
<li>Lettered edge</li>
<li>Missing reeds</li>
<li>Partial reeds</li>
<li>Double reeding</li>
<li>Filing</li>
<li>Seams</li>
<li>Casting evidence</li>
<li>Edge lettering errors</li>
<li>Layering</li>
</ul>
<p>Always check the edge of an expensive or unusual coin.</p>
<hr>
<h1>59. Researching a Coin</h1>
<p>Good research should answer:</p>
<ol>
<li>What coin is it?</li>
<li>What is its normal specification?</li>
<li>How many were produced?</li>
<li>How many are believed to survive?</li>
<li>Are there recognized varieties?</li>
<li>Are there recognized errors?</li>
<li>What grades are common?</li>
<li>What grades are rare?</li>
<li>What have comparable coins sold for recently?</li>
</ol>
<hr>
<h1>60. Coin Price Guides</h1>
<p>Price guides can be useful for learning approximate market ranges.</p>
<p>However, price-guide values should not automatically be treated as actual selling prices.</p>
<p>Prices vary according to:</p>
<ul>
<li>Grade</li>
<li>Variety</li>
<li>Eye appeal</li>
<li>Market conditions</li>
<li>Dealer markup</li>
<li>Auction fees</li>
<li>Certification</li>
<li>Demand</li>
</ul>
<hr>
<h1>61. Auction Prices vs. Asking Prices</h1>
<p>This is one of the most important valuation lessons.</p>
<p>An online listing is:</p>
<p><strong>An asking price</strong></p>
<p>An auction result is:</p>
<p><strong>A realized price</strong></p>
<p>A seller can ask $5,000 for a coin.</p>
<p>That does not mean anyone will pay $5,000.</p>
<p>When determining value, look for multiple recent sales of comparable coins.</p>
<hr>
<h1>62. Population Reports</h1>
<p>A grading-service population report shows how many coins the service has graded at various levels.</p>
<p>For example:</p>
<ul>
<li>MS-63</li>
<li>MS-64</li>
<li>MS-65</li>
<li>MS-66</li>
</ul>
<p>Population reports are useful but imperfect.</p>
<p>Coins can be:</p>
<ul>
<li>Resubmitted</li>
<li>Crossed to another service</li>
<li>Removed from holders</li>
<li>Regraded</li>
</ul>
<p>Therefore:</p>
<p><strong>Population is not the same thing as total surviving population.</strong></p>
<hr>
<h1>63. Buying Coins</h1>
<p>Possible sources include:</p>
<ul>
<li>Coin shops</li>
<li>Coin shows</li>
<li>Auctions</li>
<li>Established online dealers</li>
<li>Collector-to-collector sales</li>
<li>Estate collections</li>
<li>Bank rolls</li>
<li>U.S. Mint products</li>
</ul>
<p>Before spending significant money, research both:</p>
<p><strong>The coin</strong></p>
<p>and</p>
<p><strong>The seller</strong></p>
<hr>
<h1>64. Buying From Coin Dealers</h1>
<p>A good dealer should be willing to explain:</p>
<ul>
<li>What the coin is</li>
<li>Why it is valuable</li>
<li>The grade</li>
<li>The variety</li>
<li>The price</li>
</ul>
<p>Do not be afraid to say:</p>
<blockquote>
<p>&quot;I am still learning.&quot;</p>
</blockquote>
<p>A reputable dealer should not be offended by questions.</p>
<hr>
<h1>65. Buying at Coin Shows</h1>
<p>Coin shows are excellent places to learn.</p>
<p>Tips:</p>
<ul>
<li>Ask before handling coins.</li>
<li>Use trays when provided.</li>
<li>Keep coins over the table.</li>
<li>Do not mix coins between dealers.</li>
<li>Take notes.</li>
<li>Compare prices.</li>
<li>Examine multiple examples.</li>
</ul>
<p>Do not feel pressured to buy immediately.</p>
<hr>
<h1>66. Buying Online</h1>
<p>Online marketplaces can be useful but require caution.</p>
<p>Potential problems include:</p>
<ul>
<li>Misidentified coins</li>
<li>Artificially inflated prices</li>
<li>Counterfeits</li>
<li>Altered coins</li>
<li>Misrepresented grades</li>
<li>Fake errors</li>
<li>Stock photographs</li>
<li>Old photographs</li>
<li>Edited photographs</li>
</ul>
<p>Always verify important purchases independently.</p>
<hr>
<h1>67. Buying From Auctions</h1>
<p>Auction prices can be excellent research tools.</p>
<p>Before bidding:</p>
<ol>
<li>Identify the exact coin.</li>
<li>Determine the grade.</li>
<li>Check comparable sales.</li>
<li>Add buyer&#39;s premium.</li>
<li>Add shipping and taxes where applicable.</li>
<li>Set a maximum price.</li>
<li>Do not chase the coin emotionally.</li>
</ol>
<hr>
<h1>68. Selling Coins</h1>
<p>Before selling:</p>
<ol>
<li>Identify the coins.</li>
<li>Separate valuable dates.</li>
<li>Separate silver and gold.</li>
<li>Look for major varieties.</li>
<li>Look for errors.</li>
<li>Determine approximate grades.</li>
<li>Research recent sales.</li>
<li>Get multiple opinions for expensive pieces.</li>
</ol>
<p>Never assume the first offer is the best offer.</p>
<hr>
<h1>69. Getting Multiple Opinions</h1>
<p>Get another opinion when:</p>
<ul>
<li>Dealers disagree</li>
<li>You suspect a major variety</li>
<li>You suspect a major error</li>
<li>A coin might be counterfeit</li>
<li>The coin is expensive</li>
<li>The grade is disputed</li>
<li>Someone makes an extraordinary claim</li>
</ul>
<p>A second opinion can prevent an expensive mistake.</p>
<hr>
<h1>70. Professional Authentication and Grading</h1>
<p>Professional grading can provide:</p>
<ul>
<li>Authentication</li>
<li>Numerical grade</li>
<li>Encapsulation</li>
<li>Variety attribution when offered</li>
<li>Market recognition</li>
</ul>
<p>Professional grading is not necessary for every coin.</p>
<p>It becomes more useful as:</p>
<ul>
<li>Value increases</li>
<li>Rarity increases</li>
<li>Authenticity becomes more important</li>
<li>Grade has a large effect on price</li>
</ul>
<hr>
<h1>71. When Should You Have a Coin Graded?</h1>
<p>Consider professional grading when:</p>
<ul>
<li>The coin is valuable.</li>
<li>It is a major key date.</li>
<li>It may be a major variety.</li>
<li>It may be a major error.</li>
<li>Authenticity is uncertain.</li>
<li>Grade strongly affects value.</li>
<li>You intend to sell it.</li>
<li>You want long-term protection.</li>
</ul>
<p>Do not spend $50-$100 or more grading a coin worth $5 unless there is another compelling reason.</p>
<hr>
<h1>72. Coin Storage</h1>
<p>Good storage should protect coins from:</p>
<ul>
<li>Moisture</li>
<li>Chemicals</li>
<li>PVC</li>
<li>Scratching</li>
<li>Excessive handling</li>
<li>Temperature extremes</li>
</ul>
<p>Useful storage methods include:</p>
<ul>
<li>Coin flips</li>
<li>2x2 holders</li>
<li>Capsules</li>
<li>Albums</li>
<li>Hard holders</li>
<li>Certified holders</li>
</ul>
<hr>
<h1>73. PVC and Plastic Holders</h1>
<p>Avoid soft plastic holders containing PVC.</p>
<p>PVC can eventually leave a greenish or oily residue on coins.</p>
<p>Long-term PVC exposure can damage surfaces.</p>
<p>Look for:</p>
<p><strong>PVC-free</strong></p>
<p>coin storage products.</p>
<hr>
<h1>74. Handling Coins</h1>
<p>Handle coins by their edges.</p>
<p>Avoid touching the faces of coins whenever possible.</p>
<p>Fingerprints contain oils and contaminants that can permanently stain surfaces.</p>
<p>For proof coins and high-grade coins, handling precautions are especially important.</p>
<hr>
<h1>75. Photographing Coins</h1>
<p>For important coins photograph:</p>
<ul>
<li>Obverse</li>
<li>Reverse</li>
<li>Edge</li>
<li>Date</li>
<li>Mintmark</li>
<li>Variety diagnostics</li>
<li>Problem areas</li>
</ul>
<p>Use consistent lighting and camera settings.</p>
<p>Photographs are useful for:</p>
<ul>
<li>Insurance</li>
<li>Inventory</li>
<li>Comparison</li>
<li>Selling</li>
<li>Documentation</li>
</ul>
<hr>
<h1>76. Keeping a Collection Inventory</h1>
<p>A good inventory should record:</p>
<ul>
<li>Inventory number</li>
<li>Date</li>
<li>Denomination</li>
<li>Mintmark</li>
<li>Variety</li>
<li>Grade</li>
<li>Certification number</li>
<li>Purchase price</li>
<li>Purchase date</li>
<li>Seller</li>
<li>Estimated value</li>
<li>Storage location</li>
<li>Photograph filename</li>
<li>Notes</li>
</ul>
<p>A spreadsheet is an excellent way to manage a collection.</p>
<hr>
<h1>77. Provenance and Documentation</h1>
<p><strong>Provenance</strong> means the documented history of ownership of an item.</p>
<p>Keep:</p>
<ul>
<li>Receipts</li>
<li>Auction invoices</li>
<li>Certificates</li>
<li>Dealer information</li>
<li>Previous photographs</li>
<li>Family history</li>
<li>Appraisals</li>
</ul>
<p>Provenance can be especially useful for important or historically significant coins.</p>
<hr>
<h1>78. Insurance</h1>
<p>If your collection becomes valuable, check whether your current insurance adequately covers it.</p>
<p>Maintain:</p>
<ul>
<li>Inventory</li>
<li>Photographs</li>
<li>Receipts</li>
<li>Appraisals</li>
<li>Certification information</li>
</ul>
<p>Do not assume a normal household policy provides sufficient coverage for a valuable collection.</p>
<hr>
<h1>79. Building a Collection</h1>
<p>There are many ways to build a collection.</p>
<p>You can collect by:</p>
<ul>
<li>Date</li>
<li>Mintmark</li>
<li>Type</li>
<li>Variety</li>
<li>Error</li>
<li>Metal</li>
<li>Historical period</li>
<li>Grade</li>
<li>Theme</li>
<li>Denomination</li>
</ul>
<p>There is no single correct method.</p>
<hr>
<h1>80. Collecting by Type</h1>
<p>A type set attempts to obtain one example of each major coin design/type.</p>
<p>For example, a collector might have:</p>
<ul>
<li>One Indian Head cent</li>
<li>One Lincoln cent</li>
<li>One Buffalo nickel</li>
<li>One Jefferson nickel</li>
<li>One Mercury dime</li>
<li>One Roosevelt dime</li>
<li>One Standing Liberty quarter</li>
<li>One Washington quarter</li>
<li>One Walking Liberty half</li>
<li>One Franklin half</li>
<li>One Kennedy half</li>
<li>One Morgan dollar</li>
<li>One Peace dollar</li>
</ul>
<p>Type collecting is excellent for beginners because it introduces many areas of U.S. numismatics without requiring every date.</p>
<hr>
<h1>81. Collecting by Date</h1>
<p>A date collection attempts to obtain examples from different years.</p>
<p>This can range from:</p>
<p><strong>Every year</strong></p>
<p>to:</p>
<p><strong>Every year and mintmark</strong></p>
<p>The second approach is much more difficult.</p>
<hr>
<h1>82. Collecting by Mintmark</h1>
<p>A collector can build sets organized around different U.S. Mint facilities.</p>
<p>This can be especially interesting for historical series.</p>
<p>A coin&#39;s mintmark can sometimes make an otherwise common date significantly more valuable.</p>
<hr>
<h1>83. Collecting Errors</h1>
<p>Error collectors may specialize in:</p>
<ul>
<li>Wrong planchets</li>
<li>Off-centers</li>
<li>Clips</li>
<li>Broadstrikes</li>
<li>Brockages</li>
<li>Struck-throughs</li>
<li>Multiple strikes</li>
<li>Transitional errors</li>
</ul>
<p>Major authenticated errors can be extremely valuable.</p>
<hr>
<h1>84. Collecting Die Varieties</h1>
<p>Variety collectors study:</p>
<ul>
<li>DDOs</li>
<li>DDRs</li>
<li>RPMs</li>
<li>OMMs</li>
<li>Die cracks</li>
<li>Die clashes</li>
<li>Die chips</li>
<li>Date varieties</li>
<li>Hub varieties</li>
</ul>
<p>Variety collecting rewards careful observation and research.</p>
<hr>
<h1>85. Collecting Silver</h1>
<p>Silver collecting can range from inexpensive circulated coins to extremely rare numismatic pieces.</p>
<p>A beginner can start with:</p>
<ul>
<li>90% silver dimes</li>
<li>90% silver quarters</li>
<li>90% silver half dollars</li>
<li>40% silver Kennedy halves</li>
<li>Wartime nickels</li>
<li>Silver dollars</li>
</ul>
<p>Remember:</p>
<p><strong>Silver value and collector value are different things.</strong></p>
<hr>
<h1>86. Collecting Gold</h1>
<p>Gold collecting can involve:</p>
<ul>
<li>Historic U.S. gold</li>
<li>Modern bullion</li>
<li>Commemoratives</li>
<li>Proofs</li>
<li>Type sets</li>
<li>Rare dates</li>
<li>High-grade coins</li>
</ul>
<p>Authentication is especially important because valuable gold coins are frequent counterfeit targets.</p>
<hr>
<h1>87. Collecting Modern Coins</h1>
<p>Do not ignore modern coins.</p>
<p>Modern collecting opportunities include:</p>
<ul>
<li>Proofs</li>
<li>Mint errors</li>
<li>Die varieties</li>
<li>Low-mintage issues</li>
<li>Special finishes</li>
<li>Commemoratives</li>
<li>High-grade condition rarities</li>
<li>Limited releases</li>
</ul>
<p>Some major modern varieties are discovered long after the coins were produced.</p>
<hr>
<h1>88. Roll Hunting</h1>
<p>Roll hunting involves obtaining rolls of coins and searching them for desirable examples.</p>
<p>Possible finds include:</p>
<ul>
<li>Silver</li>
<li>Wheat cents</li>
<li>Older dates</li>
<li>Better dates</li>
<li>Varieties</li>
<li>Errors</li>
<li>Foreign coins</li>
<li>Tokens</li>
<li>Interesting die states</li>
</ul>
<p>Roll hunting is inexpensive compared with buying rare coins individually and can be an excellent way to train your eye.</p>
<hr>
<h1>89. Pocket Change Hunting</h1>
<p>Search pocket change for:</p>
<ul>
<li>Older dates</li>
<li>Key dates</li>
<li>Varieties</li>
<li>Errors</li>
<li>Unusual mintmarks</li>
<li>Foreign coins</li>
<li>Silver</li>
<li>Missing-clad errors</li>
<li>Off-centers</li>
<li>Other unusual characteristics</li>
</ul>
<p>Most coins will be ordinary.</p>
<p>That is completely normal.</p>
<p>The skill is learning to recognize the exceptions.</p>
<hr>
<h1>90. Estate and Inherited Collections</h1>
<p>Never assume a collection is valuable simply because someone spent decades collecting it.</p>
<p>An inherited collection can contain:</p>
<ul>
<li>Valuable coins</li>
<li>Common coins</li>
<li>World coins</li>
<li>Tokens</li>
<li>Damaged coins</li>
<li>Counterfeits</li>
<li>Sentimental pieces</li>
</ul>
<p>Before selling:</p>
<ol>
<li>Photograph everything.</li>
<li>Inventory everything.</li>
<li>Separate precious-metal coins.</li>
<li>Identify key dates.</li>
<li>Look for major varieties.</li>
<li>Do not clean anything.</li>
<li>Get opinions on important pieces.</li>
<li>Preserve family history.</li>
</ol>
<hr>
<h1>91. Coin Clubs and Communities</h1>
<p>Coin clubs can provide:</p>
<ul>
<li>Mentoring</li>
<li>Grading practice</li>
<li>Variety attribution help</li>
<li>Error identification</li>
<li>Research assistance</li>
<li>Coin shows</li>
<li>Buying opportunities</li>
<li>Friendships</li>
</ul>
<p>One experienced collector can sometimes teach more in an hour than weeks of random internet searching.</p>
<hr>
<h1>92. Beginner Equipment</h1>
<p>A good beginner setup includes:</p>
<ul>
<li>5x-10x loupe</li>
<li>0.01 g digital scale</li>
<li>Good lamp</li>
<li>Digital calipers or ruler</li>
<li>PVC-free flips</li>
<li>2x2 holders</li>
<li>Album</li>
<li>Notebook</li>
<li>Spreadsheet</li>
<li>Basic reference book</li>
</ul>
<p>You do not need expensive equipment to begin.</p>
<hr>
<h1>93. Advanced Equipment</h1>
<p>As your interests develop, you might consider:</p>
<ul>
<li>Stereo microscope</li>
<li>Precision scale</li>
<li>Digital calipers</li>
<li>Macro camera</li>
<li>UV light</li>
<li>Magnet</li>
<li>Coin microscope</li>
<li>Specialized reference books</li>
<li>Metal-testing equipment</li>
</ul>
<p>Buy equipment because it solves a problem you actually have.</p>
<hr>
<h1>94. How to Study a Coin Series</h1>
<p>Instead of trying to learn every U.S. coin at once, choose one series.</p>
<p>For example:</p>
<p><strong>Lincoln cents</strong></p>
<p>Learn:</p>
<ul>
<li>Complete date range</li>
<li>Mintmarks</li>
<li>Key dates</li>
<li>Semi-key dates</li>
<li>Better dates</li>
<li>Composition changes</li>
<li>Major varieties</li>
<li>Major errors</li>
<li>Important die markers</li>
<li>Grading characteristics</li>
<li>Counterfeit warnings</li>
</ul>
<p>Then move to another series.</p>
<p>This is one of the fastest ways to become knowledgeable.</p>
<hr>
<h1>95. The Normal-First Rule</h1>
<p>The best way to recognize something abnormal is to know what normal looks like.</p>
<p>Study:</p>
<ul>
<li>Normal lettering</li>
<li>Normal dates</li>
<li>Normal mintmarks</li>
<li>Normal rims</li>
<li>Normal edges</li>
<li>Normal weight</li>
<li>Normal strike</li>
<li>Normal color</li>
<li>Normal luster</li>
</ul>
<p>Then unusual examples become much easier to identify.</p>
<hr>
<h1>96. The &quot;Did the Mint Make It?&quot; Rule</h1>
<p>When you find something strange, ask:</p>
<blockquote>
<p>Could the Mint have created this during production?</p>
</blockquote>
<p>Think about the production process:</p>
<p><strong>Metal preparation</strong></p>
<p>↓</p>
<p><strong>Blanking</strong></p>
<p>↓</p>
<p><strong>Annealing</strong></p>
<p>↓</p>
<p><strong>Cleaning</strong></p>
<p>↓</p>
<p><strong>Upsetting</strong></p>
<p>↓</p>
<p><strong>Die preparation</strong></p>
<p>↓</p>
<p><strong>Striking</strong></p>
<p>↓</p>
<p><strong>Inspection</strong></p>
<p>↓</p>
<p><strong>Counting</strong></p>
<p>↓</p>
<p><strong>Bagging</strong></p>
<p>If the feature could only have happened after the coin left the Mint, it is probably post-Mint damage.</p>
<hr>
<h1>97. The &quot;Why Is It Valuable?&quot; Rule</h1>
<p>Whenever someone says:</p>
<blockquote>
<p>&quot;This coin is worth $500!&quot;</p>
</blockquote>
<p>ask:</p>
<blockquote>
<p>&quot;Why?&quot;</p>
</blockquote>
<p>There should be a specific reason.</p>
<p>Possible reasons include:</p>
<ul>
<li>Key date</li>
<li>Scarce mintmark</li>
<li>Major variety</li>
<li>Major error</li>
<li>High grade</li>
<li>Condition rarity</li>
<li>Precious metal</li>
<li>Historical significance</li>
<li>Exceptional eye appeal</li>
</ul>
<p>If nobody can explain the reason, investigate before believing the valuation.</p>
<hr>
<h1>98. Common Beginner Mistakes</h1>
<h2>Mistake 1: Assuming Old Means Valuable</h2>
<p>It doesn&#39;t.</p>
<h2>Mistake 2: Believing Every Doubled-Looking Coin Is a Doubled Die</h2>
<p>Many are machine doubling.</p>
<h2>Mistake 3: Cleaning Coins</h2>
<p>Cleaning can permanently reduce value.</p>
<h2>Mistake 4: Trusting Internet Listings</h2>
<p>A seller&#39;s description is not proof.</p>
<h2>Mistake 5: Ignoring the Edge</h2>
<p>The edge can reveal major clues.</p>
<h2>Mistake 6: Ignoring Weight</h2>
<p>Weight can quickly reveal inconsistencies.</p>
<h2>Mistake 7: Looking Only at the Date</h2>
<p>Mintmark, variety, composition, and condition can completely change value.</p>
<h2>Mistake 8: Assuming Low Mintage Means Rare</h2>
<p>Survival matters.</p>
<h2>Mistake 9: Assuming Rare Means Expensive</h2>
<p>Demand matters too.</p>
<h2>Mistake 10: Spending Too Much Too Soon</h2>
<p>Learn first.</p>
<p>Buy later.</p>
<hr>
<h1>99. Master Coin Identification Workflow</h1>
<p>Use this procedure whenever you find an interesting coin.</p>
<h2>Step 1 — Identify the Country</h2>
<p>Confirm that it is actually a U.S. coin.</p>
<h2>Step 2 — Identify the Denomination</h2>
<p>Determine whether it is:</p>
<ul>
<li>Cent</li>
<li>Nickel</li>
<li>Dime</li>
<li>Quarter</li>
<li>Half dollar</li>
<li>Dollar</li>
<li>Gold denomination</li>
<li>Commemorative</li>
<li>Other</li>
</ul>
<h2>Step 3 — Identify the Date</h2>
<p>Record the exact date.</p>
<h2>Step 4 — Identify the Mintmark</h2>
<p>Look carefully for the mintmark.</p>
<h2>Step 5 — Identify the Type</h2>
<p>Determine the exact design.</p>
<h2>Step 6 — Determine Composition</h2>
<p>Ask what metal the coin should contain.</p>
<h2>Step 7 — Weigh It</h2>
<p>Use a 0.01 g scale when practical.</p>
<h2>Step 8 — Measure It</h2>
<p>Check diameter and thickness when necessary.</p>
<h2>Step 9 — Inspect the Edge</h2>
<p>Look for unusual characteristics.</p>
<h2>Step 10 — Look for Varieties</h2>
<p>Check:</p>
<ul>
<li>DDO</li>
<li>DDR</li>
<li>RPM</li>
<li>OMM</li>
<li>Date varieties</li>
<li>Die markers</li>
<li>Die cracks</li>
<li>Die chips</li>
<li>Die clashes</li>
</ul>
<h2>Step 11 — Look for Errors</h2>
<p>Check for:</p>
<ul>
<li>Wrong planchet</li>
<li>Off-center</li>
<li>Broadstrike</li>
<li>Clip</li>
<li>Struck-through</li>
<li>Brockage</li>
<li>Multiple strike</li>
<li>Rotated die</li>
<li>Transitional composition</li>
</ul>
<h2>Step 12 — Assess Condition</h2>
<p>Determine:</p>
<ul>
<li>Circulated</li>
<li>About Uncirculated</li>
<li>Mint State</li>
<li>Proof</li>
<li>Details/problem</li>
</ul>
<h2>Step 13 — Authenticate</h2>
<p>If valuable or questionable, verify authenticity.</p>
<h2>Step 14 — Research Value</h2>
<p>Use:</p>
<ul>
<li>Auction results</li>
<li>Dealer prices</li>
<li>Price guides</li>
<li>Certified examples</li>
<li>Comparable sales</li>
</ul>
<h2>Step 15 — Record It</h2>
<p>Add the coin to your collection inventory.</p>
<h2>Step 16 — Store It Correctly</h2>
<p>Use appropriate PVC-free storage.</p>
<hr>
<h1>100. Master &quot;Is This Coin Special?&quot; Checklist</h1>
<p>When examining a coin, ask whether it has any of these characteristics:</p>
<ul>
<li><input disabled="" type="checkbox"> Key date</li>
<li><input disabled="" type="checkbox"> Semi-key date</li>
<li><input disabled="" type="checkbox"> Better date</li>
<li><input disabled="" type="checkbox"> Scarce mintmark</li>
<li><input disabled="" type="checkbox"> Major variety</li>
<li><input disabled="" type="checkbox"> DDO</li>
<li><input disabled="" type="checkbox"> DDR</li>
<li><input disabled="" type="checkbox"> RPM</li>
<li><input disabled="" type="checkbox"> OMM</li>
<li><input disabled="" type="checkbox"> Small Date</li>
<li><input disabled="" type="checkbox"> Large Date</li>
<li><input disabled="" type="checkbox"> Close Date</li>
<li><input disabled="" type="checkbox"> Wide Date</li>
<li><input disabled="" type="checkbox"> Major type</li>
<li><input disabled="" type="checkbox"> Die crack</li>
<li><input disabled="" type="checkbox"> Die chip</li>
<li><input disabled="" type="checkbox"> Cud</li>
<li><input disabled="" type="checkbox"> Die clash</li>
<li><input disabled="" type="checkbox"> Die state</li>
<li><input disabled="" type="checkbox"> Wrong planchet</li>
<li><input disabled="" type="checkbox"> Off-center strike</li>
<li><input disabled="" type="checkbox"> Broadstrike</li>
<li><input disabled="" type="checkbox"> Clipped planchet</li>
<li><input disabled="" type="checkbox"> Struck-through</li>
<li><input disabled="" type="checkbox"> Brockage</li>
<li><input disabled="" type="checkbox"> Multiple strike</li>
<li><input disabled="" type="checkbox"> Rotated die</li>
<li><input disabled="" type="checkbox"> Transitional composition</li>
<li><input disabled="" type="checkbox"> Proof</li>
<li><input disabled="" type="checkbox"> Reverse proof</li>
<li><input disabled="" type="checkbox"> High grade</li>
<li><input disabled="" type="checkbox"> Condition rarity</li>
<li><input disabled="" type="checkbox"> Attractive toning</li>
<li><input disabled="" type="checkbox"> Precious-metal content</li>
<li><input disabled="" type="checkbox"> Historical significance</li>
</ul>
<hr>
<h1>Master &quot;Do Not Damage It&quot; Checklist</h1>
<p>Before doing anything to a potentially valuable coin:</p>
<ul>
<li><input disabled="" type="checkbox"> Do not polish it.</li>
<li><input disabled="" type="checkbox"> Do not scrub it.</li>
<li><input disabled="" type="checkbox"> Do not use metal cleaner.</li>
<li><input disabled="" type="checkbox"> Do not use toothpaste.</li>
<li><input disabled="" type="checkbox"> Do not use baking soda.</li>
<li><input disabled="" type="checkbox"> Do not use an abrasive cloth.</li>
<li><input disabled="" type="checkbox"> Do not use an eraser.</li>
<li><input disabled="" type="checkbox"> Do not use a Dremel.</li>
<li><input disabled="" type="checkbox"> Do not scratch it to test the metal.</li>
<li><input disabled="" type="checkbox"> Do not bend it.</li>
<li><input disabled="" type="checkbox"> Do not drill it.</li>
<li><input disabled="" type="checkbox"> Do not glue it.</li>
<li><input disabled="" type="checkbox"> Do not strip the toning.</li>
<li><input disabled="" type="checkbox"> Do not put it in PVC.</li>
<li><input disabled="" type="checkbox"> Do not perform destructive tests.</li>
</ul>
<hr>
<h1>Quick Reference: The Collector&#39;s Workflow</h1>
<p><strong>Find coin</strong></p>
<p>↓</p>
<p><strong>Identify</strong></p>
<p>↓</p>
<p><strong>Date + Mintmark</strong></p>
<p>↓</p>
<p><strong>Identify Type</strong></p>
<p>↓</p>
<p><strong>Determine Composition</strong></p>
<p>↓</p>
<p><strong>Weigh</strong></p>
<p>↓</p>
<p><strong>Measure</strong></p>
<p>↓</p>
<p><strong>Inspect Edge</strong></p>
<p>↓</p>
<p><strong>Look for Varieties</strong></p>
<p>↓</p>
<p><strong>Look for Errors</strong></p>
<p>↓</p>
<p><strong>Assess Condition</strong></p>
<p>↓</p>
<p><strong>Authenticate if Necessary</strong></p>
<p>↓</p>
<p><strong>Research Recent Sales</strong></p>
<p>↓</p>
<p><strong>Record</strong></p>
<p>↓</p>
<p><strong>Store Safely</strong></p>
<hr>
<h1>Quick Reference: Before Buying an Expensive Coin</h1>
<p><strong>STOP</strong></p>
<p>Ask:</p>
<ol>
<li>What exactly is it?</li>
<li>Is it genuine?</li>
<li>What grade is it?</li>
<li>Is the variety/error attribution correct?</li>
<li>What are comparable coins actually selling for?</li>
<li>Is the price reasonable?</li>
<li>What happens if I later decide to sell it?</li>
</ol>
<p>Then decide whether to buy.</p>
<hr>
<h1>Quick Reference: Before Selling an Expensive Coin</h1>
<p>Ask:</p>
<ol>
<li>Is it correctly identified?</li>
<li>Is the date correct?</li>
<li>Is the mintmark correct?</li>
<li>Is there a major variety?</li>
<li>Is there a major error?</li>
<li>Is it silver or gold?</li>
<li>What is the approximate grade?</li>
<li>What have comparable coins recently sold for?</li>
<li>Have I obtained more than one opinion?</li>
<li>Am I selling through the right market?</li>
</ol>
<hr>
<h1>Quick Reference: Before Cleaning a Coin</h1>
<h2>STOP.</h2>
<p>If you think a coin might be valuable:</p>
<p><strong>Do not clean it.</strong></p>
<p>Have it evaluated first.</p>
<hr>
<h1>Final Advice</h1>
<p>The best coin collectors are not necessarily the people who spend the most money.</p>
<p>They are the people who learn to answer:</p>
<blockquote>
<p><strong>What exactly is this?</strong></p>
</blockquote>
<p>Then:</p>
<blockquote>
<p><strong>Why is it different?</strong></p>
</blockquote>
<p>Then:</p>
<blockquote>
<p><strong>Is that difference recognized?</strong></p>
</blockquote>
<p>Then:</p>
<blockquote>
<p><strong>How rare is it?</strong></p>
</blockquote>
<p>Then:</p>
<blockquote>
<p><strong>How much do comparable examples actually sell for?</strong></p>
</blockquote>
<p>That mindset will protect you from a huge number of mistakes.</p>
<p>You do not need to know everything.</p>
<p>You only need to know enough to recognize when a coin deserves a closer look.</p>
<p>And when you find something you cannot explain:</p>
<p><strong>Don&#39;t clean it.</strong></p>
<p><strong>Don&#39;t alter it.</strong></p>
<p><strong>Don&#39;t sell it immediately.</strong></p>
<p><strong>Research it.</strong></p>
<hr>
<h1>The Golden Rule of Coin Collecting</h1>
<h2>Learn first. Handle carefully. Research everything. Buy slowly. Sell intelligently.</h2>
<p>And most importantly:</p>
<h1>Have Fun!</h1>
<p>Coin collecting is not only about finding something worth money.</p>
<p>Coins are pieces of history.</p>
<p>They can tell stories about:</p>
<ul>
<li>Wars</li>
<li>Presidents</li>
<li>Economic crises</li>
<li>Industrial changes</li>
<li>Technological advances</li>
<li>Immigration</li>
<li>Art</li>
<li>Politics</li>
<li>Manufacturing</li>
<li>Everyday American life</li>
</ul>
<p>A common coin with an interesting story is still a great coin.</p>
<p>The more you learn, the more interesting every coin becomes.</p>
<hr>
<h1>Important Reference Note</h1>
<p>Coin specifications, compositions, mintages, die varieties, error classifications, type designations, key-date classifications, and market values can be issue-specific.</p>
<p>Terminology such as <strong>Small Date, Large Date, Type 1, Type 2, Type 3, Close Date, Wide Date, DDO, DDR, RPM, OMM, and die state</strong> must always be interpreted in the context of the specific coin series and date.</p>
<p>For expensive coins, verify information against authoritative references, specialist variety guides, professional grading resources, and recent realized auction prices.</p>
<p><strong>Never rely on a single photograph, price guide, dealer claim, or internet listing when a substantial amount of money is involved.</strong></p>
</div>`;

function showCoinTips() {
 const wrap = el('div', { className: 'info-guide-wrap',
   style: 'max-height:72vh; overflow-y:auto; padding-right:8px;' });
 wrap.innerHTML = COLLECTING_GUIDE_HTML;
 createModal('modal-info-coin', 'U.S. Coin Collecting Guide', wrap, null);
}

// --- Paper Currency Guide (full master field guide) -------------------
const PAPER_CURRENCY_GUIDE_HTML = `<style>
.cc-guide { font-size: 0.9rem; line-height: 1.55; }
.cc-guide h2 { font-size: 1.12rem; margin: 1.3em 0 0.45em; border-bottom: 1px solid var(--color-border, #d8d8d8); padding-bottom: 4px; }
.cc-guide h3 { font-size: 1.0rem; margin: 1.0em 0 0.35em; }
.cc-guide h4 { font-size: 0.95rem; margin: 0.8em 0 0.3em; }
.cc-guide p { margin: 0.45em 0; }
.cc-guide ul, .cc-guide ol { margin: 0.45em 0 0.45em 1.3em; padding: 0; }
.cc-guide li { margin: 0.22em 0; }
.cc-guide table { border-collapse: collapse; width: 100%; margin: 0.7em 0; font-size: 0.85rem; }
.cc-guide th, .cc-guide td { border: 1px solid var(--color-border, #ccc); padding: 4px 8px; text-align: left; vertical-align: top; }
.cc-guide th { background: var(--color-bg-alt, #f3f3f3); }
.cc-guide blockquote { border-left: 3px solid var(--color-accent, #4a90d9); margin: 0.6em 0; padding: 0.3em 0.8em; color: var(--color-text-muted, #666); background: rgba(0,0,0,0.03); }
.cc-guide code { background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; font-size: 0.85em; }
.cc-guide strong { font-weight: 600; }
.cc-guide input[type="checkbox"] { margin-right: 6px; vertical-align: middle; }
</style><div class="cc-guide"><h1>U.S. PAPER CURRENCY HUNTING &amp; CURRENCY-FINDING MASTER GUIDE</h1>
<h2>A beginner-to-advanced field manual for finding valuable U.S. notes in circulation, bank straps, old wallets, drawers, collections, and inherited currency</h2>
<p><strong>Scope:</strong> Primarily United States paper currency. The guide emphasizes notes that an ordinary person can realistically encounter, while also explaining older and obsolete issues so that a surprising note is not accidentally spent.</p>
<p><strong>Core rule:</strong> Do not judge a bill only by its denomination or age. Identify the <strong>type of note, series, signatures, seal, serial number, Federal Reserve district, condition, and possible printing error</strong>.</p>
<blockquote>
<p><strong>Important:</strong> This is a hunting and identification guide, not a price guide. Values change with grade, rarity, market demand, serial number, and authentication. Major rarities and suspected errors should be examined by a specialist or professional grading service.</p>
</blockquote>
<hr>
<h1>1. THE FIRST 30 SECONDS</h1>
<p>When you receive a bill, look at these things before spending it:</p>
<ol>
<li><strong>Denomination</strong></li>
<li><strong>Series year</strong></li>
<li><strong>Serial number</strong></li>
<li><strong>Star at the end of the serial?</strong></li>
<li><strong>Seal color</strong></li>
<li><strong>Federal Reserve district</strong></li>
<li><strong>Signatures</strong></li>
<li><strong>Condition</strong></li>
<li><strong>Unusual serial number</strong></li>
<li><strong>Printing error</strong></li>
<li><strong>Old design/type</strong></li>
<li><strong>Silver Certificate / Gold Certificate / United States Note / National Bank Note / other obsolete type</strong></li>
</ol>
<p>The Bureau of Engraving and Printing states that all U.S. currency remains legal tender regardless of when it was issued. That means an old note should not automatically be spent simply because it looks unfamiliar.</p>
<hr>
<h1>2. THE MOST IMPORTANT CONCEPT: IDENTIFY THE NOTE BEFORE VALUING IT</h1>
<p>A $1 bill is not necessarily &quot;just a dollar.&quot;</p>
<p>A $1 note might be:</p>
<ul>
<li>Federal Reserve Note</li>
<li>Silver Certificate</li>
<li>United States Note</li>
<li>National Bank Note</li>
<li>Legal Tender Note</li>
<li>Emergency/obsolete issue</li>
<li>Star note</li>
<li>Fancy serial number</li>
<li>Low serial number</li>
<li>Printing error</li>
<li>Rare signature combination</li>
<li>Rare series</li>
<li>High-grade example</li>
</ul>
<p>The same principle applies to every denomination.</p>
<hr>
<h1>3. PAPER MONEY TERMINOLOGY</h1>
<h2>Face</h2>
<p>The front of the note.</p>
<h2>Back</h2>
<p>The reverse of the note.</p>
<h2>Series</h2>
<p>The year or year-with-letter designation printed on the note.</p>
<p>Examples:</p>
<ul>
<li>Series 1957</li>
<li>Series 1995</li>
<li>Series 2009A</li>
<li>Series 2017A</li>
</ul>
<p><strong>Series is not necessarily the year the particular note was printed.</strong></p>
<hr>
<h1>4. SIGNATURES</h1>
<p>Historical U.S. notes normally carry signatures representing Treasury officials.</p>
<p>For modern small-size notes, collectors commonly describe a signature combination using the names of the:</p>
<ul>
<li><strong>Treasurer of the United States</strong></li>
<li><strong>Secretary of the Treasury</strong></li>
</ul>
<h3>Why signatures matter</h3>
<p>A short-serving Treasury official can produce a relatively scarce signature combination.</p>
<p>The famous example is:</p>
<h2>Joseph W. Barr</h2>
<p>Barr served as Secretary of the Treasury for only about one month, from December 21, 1968 to January 20, 1969.</p>
<p>As a result, <strong>Series 1963B $1 Federal Reserve Notes with Barr&#39;s signature are popularly collected as &quot;Barr notes.&quot;</strong></p>
<p>The Bureau of Engraving and Printing specifically notes that fewer notes bear Barr&#39;s facsimile signature because of his unusually short tenure.</p>
<h3>Roll-hunting rule</h3>
<p>Whenever you find an older note:</p>
<p><strong>Read the signatures.</strong></p>
<p>Do not rely on the series year alone.</p>
<hr>
<h1>5. SERIAL NUMBERS</h1>
<p>Serial numbers are one of the easiest things to hunt because you can examine them without specialized equipment.</p>
<h2>Modern basic structure</h2>
<p>Historically, many Federal Reserve Notes used:</p>
<p><strong>one letter + eight digits + one letter</strong></p>
<p>Example:</p>
<p><code>A12345678B</code></p>
<p>Beginning with Series 1996, $5 and higher Federal Reserve Notes use two letters before the eight digits, while $1 and $2 retain the older-style one-letter prefix format.</p>
<p>The first/second prefix letters can identify the Federal Reserve district and series information.</p>
<hr>
<h1>6. FEDERAL RESERVE BANK LETTERS</h1>
<p>The 12 Federal Reserve districts use:</p>
<table>
<thead>
<tr>
<th>Letter</th>
<th>District</th>
</tr>
</thead>
<tbody><tr>
<td>A</td>
<td>Boston</td>
</tr>
<tr>
<td>B</td>
<td>New York</td>
</tr>
<tr>
<td>C</td>
<td>Philadelphia</td>
</tr>
<tr>
<td>D</td>
<td>Cleveland</td>
</tr>
<tr>
<td>E</td>
<td>Richmond</td>
</tr>
<tr>
<td>F</td>
<td>Atlanta</td>
</tr>
<tr>
<td>G</td>
<td>Chicago</td>
</tr>
<tr>
<td>H</td>
<td>St. Louis</td>
</tr>
<tr>
<td>I</td>
<td>Minneapolis</td>
</tr>
<tr>
<td>J</td>
<td>Kansas City</td>
</tr>
<tr>
<td>K</td>
<td>Dallas</td>
</tr>
<tr>
<td>L</td>
<td>San Francisco</td>
</tr>
</tbody></table>
<p>The BEP confirms this letter-to-district relationship.</p>
<h3>Why collectors care</h3>
<p>Some older series/district combinations are substantially scarcer than others.</p>
<p>The district letter can also help identify a note that appears ordinary at first glance.</p>
<hr>
<h1>7. STAR NOTES</h1>
<h2>What is a star note?</h2>
<p>A star note is a replacement note.</p>
<p>If a sheet is discovered to be defective after serial numbers have been printed, the defective sheet cannot simply receive the same serial numbers again.</p>
<p>A replacement sheet is therefore produced with a <strong>star in place of the normal suffix letter</strong>.</p>
<p>The BEP explains this manufacturing process directly.</p>
<p>Example:</p>
<p><code>B12345678*</code></p>
<p>instead of:</p>
<p><code>B12345678A</code></p>
<hr>
<h1>8. ARE ALL STAR NOTES RARE?</h1>
<p><strong>No.</strong></p>
<p>This is one of the most important beginner lessons.</p>
<p>A star note can be:</p>
<ul>
<li>Common</li>
<li>Moderately scarce</li>
<li>Scarce</li>
<li>Very scarce</li>
<li>Extremely rare</li>
</ul>
<h3>What determines scarcity?</h3>
<p>Collectors may consider:</p>
<ul>
<li>Denomination</li>
<li>Series</li>
<li>Federal Reserve district</li>
<li>Print run</li>
<li>Replacement rate</li>
<li>Whether the star note was produced for a limited run</li>
<li>Condition</li>
</ul>
<h3>Beginner rule</h3>
<p><strong>Pull star notes from circulation.</strong></p>
<p>Research them later.</p>
<p>Do not assume every star is worth a fortune.</p>
<hr>
<h1>9. FANCY SERIAL NUMBERS</h1>
<p>A fancy serial number has an unusually memorable or mathematically interesting pattern.</p>
<p>These are highly collectible.</p>
<hr>
<h1>10. SOLID SERIAL NUMBERS</h1>
<p>Example:</p>
<p><code>11111111</code></p>
<p>All eight digits are identical.</p>
<p>These are extremely desirable.</p>
<p>A true eight-digit solid is much more important than something merely containing several repeated digits.</p>
<hr>
<h1>11. NEAR-SOLID SERIAL NUMBERS</h1>
<p>Example:</p>
<p><code>11111112</code></p>
<p>Seven identical digits and one different digit.</p>
<p>These can be collectible, although generally less desirable than a true solid.</p>
<hr>
<h1>12. LOW SERIAL NUMBERS</h1>
<p>Examples:</p>
<p><code>00000001</code>
<code>00000010</code>
<code>00000100</code>
<code>00001000</code></p>
<p>The closer a serial number is to the beginning of the production run, the more interesting it may be.</p>
<h2>Particularly desirable</h2>
<ul>
<li>00000001</li>
<li>00000002</li>
<li>00000003</li>
<li>00000007</li>
<li>00000010</li>
<li>00000100</li>
<li>00001000</li>
<li>00010000</li>
</ul>
<h3>Important</h3>
<p>Not every low serial number is equally rare.</p>
<p>A low number on an obscure or scarce note can be especially interesting.</p>
<hr>
<h1>13. RADAR SERIAL NUMBERS</h1>
<p>A radar serial reads the same forwards and backwards.</p>
<p>Example:</p>
<p><code>12344321</code></p>
<p>Another:</p>
<p><code>00055000</code></p>
<h3>Rule</h3>
<p>Ignore the prefix/suffix letters when evaluating the basic eight-digit radar pattern.</p>
<hr>
<h1>14. REPEATER SERIAL NUMBERS</h1>
<p>A repeating pattern repeats across the number.</p>
<p>Example:</p>
<p><code>12341234</code></p>
<p>or:</p>
<p><code>45454545</code></p>
<p>The most obvious form is a four-digit sequence repeated twice.</p>
<hr>
<h1>15. SUPER-REPEATER / REPEATING PATTERNS</h1>
<p>Examples:</p>
<p><code>12121212</code>
<code>12341234</code>
<code>71717171</code></p>
<p>The stronger and more obvious the repetition, the more interesting the note can become.</p>
<hr>
<h1>16. LADDER SERIAL NUMBERS</h1>
<p>A ladder runs upward or downward in numerical sequence.</p>
<p>Examples:</p>
<p><code>12345678</code>
<code>87654321</code></p>
<p>These are among the most recognizable fancy serial numbers.</p>
<hr>
<h1>17. PARTIAL LADDER</h1>
<p>Example:</p>
<p><code>12345679</code></p>
<p>This is close to a ladder but is not a perfect ladder.</p>
<p>Do not value it like:</p>
<p><code>12345678</code></p>
<p>Collectors generally distinguish exact patterns from approximate ones.</p>
<hr>
<h1>18. BINARY SERIAL NUMBERS</h1>
<p>A binary serial contains only two different digits.</p>
<p>Example:</p>
<p><code>10101010</code></p>
<p>or:</p>
<p><code>10001111</code></p>
<h3>Important distinction</h3>
<p>A note containing only 0 and 1 is a true binary.</p>
<p>The exact pattern affects desirability.</p>
<hr>
<h1>19. TRUE BINARY</h1>
<p>Examples:</p>
<p><code>10101010</code>
<code>11001100</code>
<code>11110000</code></p>
<p>These are especially easy to recognize.</p>
<hr>
<h1>20. REPEATED-DIGIT SERIALS</h1>
<p>Examples:</p>
<p><code>12222222</code>
<code>77777770</code>
<code>55555555</code></p>
<p>The more extreme the repetition, the more collectible the number may be.</p>
<hr>
<h1>21. SEQUENTIAL SERIAL NUMBERS</h1>
<p>Examples:</p>
<p><code>12345678</code>
<code>23456789</code></p>
<p>Reverse sequences:</p>
<p><code>87654321</code></p>
<p>These are classic fancy numbers.</p>
<hr>
<h1>22. BIRTHDAY SERIAL NUMBERS</h1>
<p>A serial can represent a date.</p>
<p>Example:</p>
<p><code>07141976</code></p>
<p>could be interpreted as:</p>
<p><strong>07/14/1976</strong></p>
<p>or:</p>
<p><strong>July 14, 1976</strong></p>
<h3>Important</h3>
<p>Birthday serials are subjective.</p>
<p>A number may be meaningful to one collector but not another.</p>
<p>Shorter or more clearly interpretable dates are generally easier to market.</p>
<hr>
<h1>23. YEAR SERIAL NUMBERS</h1>
<p>Example:</p>
<p><code>00001976</code></p>
<p>A serial containing a recognizable year can be interesting.</p>
<p>But:</p>
<p><strong>A year-looking serial is not automatically rare.</strong></p>
<p>The exact pattern and collector demand matter.</p>
<hr>
<h1>24. 7-OF-A-KIND / 8-OF-A-KIND</h1>
<p>Examples:</p>
<p><code>77777770</code>
<code>77777777</code></p>
<p>A note with seven identical digits is sometimes called a <strong>seven-of-a-kind</strong>.</p>
<p>Eight identical digits is a <strong>solid</strong>.</p>
<hr>
<h1>25. REPEATED PAIRS</h1>
<p>Example:</p>
<p><code>11223344</code></p>
<p>This has a strong repeated-pair structure.</p>
<p>Another:</p>
<p><code>12121212</code></p>
<p>is a much stronger repeater.</p>
<hr>
<h1>26. RADAR + REPEATER COMBINATIONS</h1>
<p>Some serials have multiple desirable characteristics.</p>
<p>Example:</p>
<p><code>12211221</code></p>
<p>may have more than one recognizable pattern.</p>
<h3>General principle</h3>
<p>The more compelling the exact mathematical pattern, the more interesting the note.</p>
<hr>
<h1>27. SERIAL NUMBER ERRORS</h1>
<p>These are potentially much more important than ordinary fancy numbers.</p>
<p>Look for:</p>
<ul>
<li>Mismatched serial numbers</li>
<li>Missing serial number</li>
<li>Partially printed serial number</li>
<li>Wrong color serial number</li>
<li>Misaligned serial number</li>
<li>Double-printed serial number</li>
<li>Serial number printed over another design element</li>
<li>Incorrect serial number relationship</li>
<li>Serial number that does not match the note&#39;s design/series</li>
</ul>
<hr>
<h1>28. MISMATCHED SERIAL NUMBERS</h1>
<p>A note normally has matching serial numbers.</p>
<p>If the two serial numbers are genuinely different:</p>
<p><strong>STOP.</strong></p>
<p>Do not spend it.</p>
<p>Do not attempt to alter it.</p>
<p>Photograph both sides and seek expert attribution.</p>
<p>A genuine mismatched serial-number error can be a major collectible error.</p>
<hr>
<h1>29. MISSING SERIAL NUMBER</h1>
<p>If one serial number is completely missing but the other is present, investigate.</p>
<p>However, determine whether:</p>
<ul>
<li>It is a genuine printing error</li>
<li>Ink was removed</li>
<li>The note was chemically altered</li>
<li>The serial number was intentionally erased</li>
</ul>
<hr>
<h1>30. MISALIGNED SERIAL NUMBERS</h1>
<p>A serial number can sometimes be noticeably shifted.</p>
<p>Minor variation is not necessarily collectible.</p>
<p>A major, dramatic misalignment can be an error.</p>
<hr>
<h1>31. PRINTING ERRORS</h1>
<p>A paper-money error occurs during production.</p>
<p>Potential things to watch for:</p>
<ul>
<li>Missing printing</li>
<li>Misregistration</li>
<li>Offset printing</li>
<li>Foldover</li>
<li>Cutting error</li>
<li>Obstruction</li>
<li>Ink smear</li>
<li>Missing seal</li>
<li>Misplaced seal</li>
<li>Misplaced serial numbers</li>
<li>Wrong denomination components</li>
<li>Dramatically shifted overprint</li>
<li>Blank back</li>
<li>Missing face/back printing</li>
<li>Overprint errors</li>
<li>Mismatched serials</li>
</ul>
<hr>
<h1>32. OFFSET ERROR</h1>
<p>An image can transfer from one sheet or surface to another before the ink has fully dried.</p>
<p>This can create a mirrored or transferred image.</p>
<h3>Warning</h3>
<p>Do not call every strange ink mark an offset error.</p>
<p>Compare:</p>
<ul>
<li>Direction</li>
<li>Mirroring</li>
<li>Ink characteristics</li>
<li>Placement</li>
</ul>
<hr>
<h1>33. FOLDOVER ERROR</h1>
<p>A portion of the sheet folds during printing or cutting.</p>
<p>The folded section can receive an abnormal print impression.</p>
<p>This can create:</p>
<ul>
<li>Missing portions</li>
<li>Extra portions</li>
<li>Misplaced printing</li>
<li>Unusual margins</li>
</ul>
<p>A genuine foldover error is much more interesting than an ordinary crease.</p>
<hr>
<h1>34. CUTTING ERRORS</h1>
<p>Currency is printed on large sheets and later separated.</p>
<p>A note can occasionally be cut incorrectly.</p>
<p>Look for:</p>
<ul>
<li>Abnormally wide margin</li>
<li>Abnormally narrow margin</li>
<li>Design cut into the margin</li>
<li>Part of neighboring note design</li>
<li>Dramatically uneven borders</li>
</ul>
<h3>Beginner warning</h3>
<p>A slightly uneven margin is not automatically a major error.</p>
<p>The production sheet geometry matters.</p>
<hr>
<h1>35. BLANK BACK / MISSING PRINTING</h1>
<p>A note with an entirely missing reverse printing can be an important error.</p>
<h3>But verify</h3>
<p>Make sure the reverse was actually never printed.</p>
<p>Do not confuse:</p>
<ul>
<li>Heavy wear</li>
<li>Chemical damage</li>
<li>Ink removal</li>
<li>Counterfeit manufacture</li>
</ul>
<p>with a genuine missing-print error.</p>
<hr>
<h1>36. INK ERRORS</h1>
<p>Look for:</p>
<ul>
<li>Missing ink</li>
<li>Extra ink</li>
<li>Smearing</li>
<li>Misregistration</li>
<li>Wrong-color ink</li>
<li>Overinking</li>
</ul>
<h3>Particularly important</h3>
<p>A dramatic error affecting an important design element can be considerably more collectible than a tiny ink spot.</p>
<hr>
<h1>37. SEAL ERRORS</h1>
<p>The Treasury seal and Federal Reserve seal are important diagnostic features.</p>
<p>Look for:</p>
<ul>
<li>Missing seal</li>
<li>Dramatically misplaced seal</li>
<li>Double seal</li>
<li>Partial seal</li>
<li>Wrong seal color</li>
<li>Misaligned seal</li>
</ul>
<h3>Warning</h3>
<p>Do not assume every weak seal is an error.</p>
<p>Wear, ink variation, and printing pressure can affect appearance.</p>
<hr>
<h1>38. SILVER CERTIFICATES</h1>
<h2>What is a Silver Certificate?</h2>
<p>Silver Certificates were U.S. currency certificates backed by silver held by the Treasury.</p>
<p>They were first issued in <strong>1878</strong>.</p>
<p>The BEP lists Silver Certificates as an official U.S. currency issue from <strong>1878 through 1965</strong>.</p>
<hr>
<h1>39. THE EASY SILVER CERTIFICATE IDENTIFIER</h1>
<p>For many small-size Silver Certificates:</p>
<p><strong>Blue Treasury seal</strong></p>
<p>is the most obvious clue.</p>
<p>Examples include:</p>
<ul>
<li>1935 $1</li>
<li>1935A</li>
<li>1935B</li>
<li>1935C</li>
<li>1935D</li>
<li>1935E</li>
<li>1935F</li>
<li>1935G</li>
<li>1935H</li>
<li>1957</li>
<li>1957A</li>
<li>1957B</li>
<li>1957C</li>
</ul>
<h3>Pull them</h3>
<p>Do not spend an old blue-seal note without checking the series.</p>
<hr>
<h1>40. 1957 SILVER CERTIFICATE</h1>
<p>The 1957 $1 Silver Certificate is particularly common.</p>
<h3>Important</h3>
<p>It is collectible.</p>
<p>But:</p>
<p><strong>Common does not mean rare.</strong></p>
<p>A circulated 1957 blue-seal $1 usually does not belong in the same category as a scarce early Silver Certificate.</p>
<hr>
<h1>41. 1957-B / 1957-C / OTHER VARIANTS</h1>
<p>Study:</p>
<ul>
<li>Series</li>
<li>Signatures</li>
<li>Serial range</li>
<li>Seal</li>
<li>Condition</li>
</ul>
<p>Some signature/series combinations are more desirable.</p>
<hr>
<h1>42. SPECIAL SILVER CERTIFICATE NOTES</h1>
<p>Look especially for:</p>
<ul>
<li>1899 $1 Black Eagle</li>
<li>1899 $1 Indian Princess</li>
<li>1923 $1</li>
<li>1928 series</li>
<li>1934 series</li>
<li>1935 series</li>
<li>1957 series</li>
</ul>
<p>Older Silver Certificates should almost always be researched before being spent.</p>
<hr>
<h1>43. 1899 BLACK EAGLE</h1>
<p>A famous large-size Silver Certificate.</p>
<h3>Why important?</h3>
<p>It has a dramatic eagle design on the face and portraits of:</p>
<ul>
<li>Abraham Lincoln</li>
<li>Ulysses S. Grant</li>
</ul>
<h3>Roll-hunting equivalent</h3>
<p>If you find one in an old envelope, safe, collection, or estate:</p>
<p><strong>STOP.</strong></p>
<p>Do not treat it as a $1 bill.</p>
<hr>
<h1>44. GOLD CERTIFICATES</h1>
<h2>What is a Gold Certificate?</h2>
<p>Gold Certificates were certificates associated with gold held by the Treasury.</p>
<p>They were first issued in <strong>1865</strong>.</p>
<p>The BEP lists Gold Certificates as an official currency issue from <strong>1865 through 1936</strong>.</p>
<hr>
<h1>45. GOLD CERTIFICATE IDENTIFICATION</h1>
<p>Common small-size Gold Certificates have:</p>
<p><strong>yellow/orange/gold-colored seal</strong></p>
<p>and serial-number coloring associated with the issue.</p>
<p>Older large-size notes can be dramatically different.</p>
<h3>Pull every genuine Gold Certificate candidate.</h3>
<hr>
<h1>46. IMPORTANT GOLD CERTIFICATE WARNING</h1>
<p>Do not assume:</p>
<blockquote>
<p>&quot;Gold Certificate = redeemable for gold today.&quot;</p>
</blockquote>
<p>That is not how modern collectors should interpret these notes.</p>
<p>They are historical currency issues.</p>
<p>Their collector value can be far above face value.</p>
<hr>
<h1>47. UNITED STATES NOTES</h1>
<p>Often called:</p>
<p><strong>Legal Tender Notes</strong></p>
<p>They typically have:</p>
<p><strong>red Treasury seal</strong></p>
<p>and red serial numbers on small-size examples.</p>
<p>The BEP states that United States Notes were issued from 1862 onward and that no new United States Notes have been placed into circulation since January 21, 1971. Outstanding United States Notes remain redeemable at face value.</p>
<hr>
<h1>48. RED-SEAL $2 NOTES</h1>
<p>If you see an older $2 with:</p>
<p><strong>red seal</strong></p>
<p>do not spend it automatically.</p>
<p>Check:</p>
<ul>
<li>Series</li>
<li>Signatures</li>
<li>Serial number</li>
<li>Condition</li>
</ul>
<hr>
<h1>49. RED-SEAL $5 / $10 / $20 / ETC.</h1>
<p>Older United States Notes can occur in denominations beyond $2.</p>
<p>They are historical collectible currency.</p>
<hr>
<h1>50. FEDERAL RESERVE NOTES</h1>
<p>Modern U.S. paper money is primarily Federal Reserve Notes.</p>
<p>Federal Reserve Notes began in <strong>1914</strong>.</p>
<p>The BEP currently produces:</p>
<ul>
<li>$1</li>
<li>$2</li>
<li>$5</li>
<li>$10</li>
<li>$20</li>
<li>$50</li>
<li>$100</li>
</ul>
<p>Federal Reserve Notes.</p>
<hr>
<h1>51. LARGE-SIZE FEDERAL RESERVE NOTES</h1>
<p>Before 1929, U.S. notes were substantially larger.</p>
<p>Large-size notes measure approximately:</p>
<p><strong>7.375 × 3.125 inches</strong></p>
<p>Modern small-size notes are approximately:</p>
<p><strong>6.14 × 2.61 inches</strong></p>
<p>The 1929 redesign reduced the physical size of U.S. paper money by about 30 percent.</p>
<h3>Pull</h3>
<p>Any genuine large-size U.S. note.</p>
<hr>
<h1>52. NATIONAL BANK NOTES</h1>
<p>National Bank Notes are a major historical collecting field.</p>
<p>They can contain:</p>
<ul>
<li>National bank name</li>
<li>Charter number</li>
<li>Town/state</li>
<li>Serial information</li>
<li>Portraits</li>
<li>Treasury signatures/seals</li>
</ul>
<p>A genuine National Bank Note is not simply an ordinary Federal Reserve Note.</p>
<h3>If found</h3>
<p>Photograph it and research the exact bank and charter.</p>
<hr>
<h1>53. HIGH-DENOMINATION NOTES</h1>
<p>U.S. notes of:</p>
<ul>
<li>$500</li>
<li>$1,000</li>
<li>$5,000</li>
<li>$10,000</li>
</ul>
<p>were discontinued in 1969.</p>
<p>They were last printed in 1945.</p>
<p>The BEP states that these notes remain legal tender, although most are in private collections.</p>
<h3>If found</h3>
<p>Do not spend it.</p>
<p>Do not sell it to the first person who offers cash.</p>
<p>Have it professionally evaluated.</p>
<hr>
<h1>54. $100,000 GOLD CERTIFICATE</h1>
<p>The $100,000 Gold Certificate, Series 1934, was used only for transactions between Federal Reserve Banks.</p>
<p>It was <strong>not circulated among the general public</strong> and cannot legally be held by currency collectors.</p>
<p>If someone offers you one from an ordinary collection, be extremely skeptical.</p>
<hr>
<h1>55. LARGE-SIZE NOTE COLORS AND SEALS</h1>
<p>Older U.S. currency can have:</p>
<ul>
<li>Red seals</li>
<li>Blue seals</li>
<li>Gold/orange seals</li>
<li>Brown seals</li>
<li>Green seals</li>
</ul>
<p>Do not assume:</p>
<p><strong>&quot;blue = Silver Certificate&quot;</strong></p>
<p>or:</p>
<p><strong>&quot;red = United States Note&quot;</strong></p>
<p>without considering the note&#39;s exact issue.</p>
<p>The seal system changed over time.</p>
<hr>
<h1>56. CONDITION: PAPER MONEY HAS ITS OWN LANGUAGE</h1>
<h2>Uncirculated</h2>
<p>No evidence of normal circulation.</p>
<h2>Crisp Uncirculated</h2>
<p>Fresh-looking note with strong original appearance.</p>
<h2>Choice/Crisp Uncirculated</h2>
<p>A particularly attractive uncirculated note.</p>
<h2>Extremely Fine</h2>
<p>Light circulation but still sharp.</p>
<h2>Very Fine</h2>
<p>Moderate circulation.</p>
<h2>Fine</h2>
<p>Clear circulation wear.</p>
<h2>Very Good / Good</h2>
<p>Heavily circulated.</p>
<hr>
<h1>57. FOLDS MATTER</h1>
<p>For paper currency:</p>
<p><strong>A single vertical fold can substantially reduce the value of an otherwise beautiful note.</strong></p>
<p>Collectors distinguish between:</p>
<ul>
<li>Handling</li>
<li>Teller counting marks</li>
<li>Light bends</li>
<li>Folds</li>
<li>Creases</li>
<li>Tears</li>
</ul>
<h3>Never flatten a valuable note yourself.</h3>
<p>Improper pressing/flattening can affect collector value and may be detectable.</p>
<hr>
<h1>58. NEVER CLEAN PAPER MONEY</h1>
<p>Do not:</p>
<ul>
<li>Wash</li>
<li>Iron</li>
<li>Bleach</li>
<li>Laminate</li>
<li>Tape</li>
<li>Glue</li>
<li>Trim</li>
<li>Erase</li>
<li>Rub stains</li>
<li>Apply chemicals</li>
</ul>
<p>A damaged-looking note can still be valuable.</p>
<p>Cleaning can make it worse.</p>
<hr>
<h1>59. SERIAL NUMBER CHECKLIST</h1>
<p>When you see a bill, ask:</p>
<h3>Is it:</h3>
<ul>
<li>Star?</li>
<li>00000001?</li>
<li>00000002?</li>
<li>Low serial?</li>
<li>Radar?</li>
<li>Repeater?</li>
<li>Ladder?</li>
<li>Reverse ladder?</li>
<li>Solid?</li>
<li>Near-solid?</li>
<li>Binary?</li>
<li>Seven-of-a-kind?</li>
<li>Birthday?</li>
<li>Year?</li>
<li>Repeated pairs?</li>
<li>Interesting sequence?</li>
<li>Mismatched?</li>
<li>Missing?</li>
<li>Misaligned?</li>
</ul>
<hr>
<h1>60. THE BEST SERIAL NUMBERS TO PULL</h1>
<h2>Tier 1</h2>
<ul>
<li>00000001</li>
<li>00000002</li>
<li>00000003</li>
<li>00000007</li>
<li>11111111</li>
<li>22222222</li>
<li>12345678</li>
<li>87654321</li>
<li>12344321</li>
<li>00000000 where applicable/legitimate</li>
<li>Dramatic genuine serial-number errors</li>
</ul>
<h2>Tier 2</h2>
<ul>
<li>00000010</li>
<li>00000100</li>
<li>00001000</li>
<li>10101010</li>
<li>12121212</li>
<li>12341234</li>
<li>11223344</li>
<li>77777770</li>
<li>Strong birthday numbers</li>
<li>Scarce star-note combinations</li>
</ul>
<h2>Tier 3</h2>
<ul>
<li>Interesting years</li>
<li>Partial ladders</li>
<li>Near solids</li>
<li>Repeated pairs</li>
<li>Personal dates</li>
<li>Other recognizable patterns</li>
</ul>
<hr>
<h1>61. WHY PREFIXES MATTER</h1>
<p>The eight digits are not the whole serial number.</p>
<p>For modern notes, the letters can identify:</p>
<ul>
<li>Series information</li>
<li>Federal Reserve district</li>
<li>Printing/serial system</li>
</ul>
<p>Therefore record the <strong>entire serial number</strong>, not just the eight digits.</p>
<p>The BEP&#39;s current serial-number explanation provides the official relationship between the prefixes and Federal Reserve districts.</p>
<hr>
<h1>62. THE TWO SERIAL NUMBERS SHOULD MATCH</h1>
<p>On a normal note:</p>
<p><strong>Left serial = right serial</strong></p>
<p>If they do not match:</p>
<p><strong>STOP.</strong></p>
<p>This is one of the easiest potentially major errors for a beginner to notice.</p>
<hr>
<h1>63. STAR NOTE + FANCY SERIAL</h1>
<p>A note can have both.</p>
<p>Example:</p>
<p><code>B12344321*</code></p>
<p>This combines:</p>
<ul>
<li>Star replacement note</li>
<li>Radar serial</li>
</ul>
<p>Such combinations deserve special attention.</p>
<hr>
<h1>64. STAR NOTE + LOW SERIAL</h1>
<p>Also potentially desirable.</p>
<p>Example:</p>
<p><code>A00000123*</code></p>
<p>Again:</p>
<p><strong>Research the exact series and district.</strong></p>
<hr>
<h1>65. FANCY SERIAL DOES NOT AUTOMATICALLY MEAN HIGH VALUE</h1>
<p>This is critical.</p>
<p>Collectors disagree on some patterns.</p>
<p>A fancy serial can be:</p>
<ul>
<li>Extremely desirable</li>
<li>Moderately desirable</li>
<li>Novelty-level</li>
</ul>
<p>Market demand determines actual value.</p>
<hr>
<h1>66. DENOMINATION-BY-DENOMINATION HUNTING</h1>
<h1>$1 NOTES</h1>
<p>Look for:</p>
<ul>
<li>Silver Certificates</li>
<li>United States Notes</li>
<li>Barr notes</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Low serials</li>
<li>Rare series</li>
<li>Printing errors</li>
<li>Older large-size notes</li>
<li>1935/1957 Silver Certificates</li>
<li>1899 and older large-size types</li>
</ul>
<h3>Especially inspect</h3>
<p>Every old-looking $1.</p>
<hr>
<h1>$2 NOTES</h1>
<p>$2 notes are particularly fun because people often overlook them.</p>
<p>Look for:</p>
<ul>
<li>1928 red-seal notes</li>
<li>1953 red-seal</li>
<li>1963 red-seal</li>
<li>1976+ Federal Reserve Notes</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Errors</li>
<li>Proof/specimen-like unusual notes</li>
<li>Very high-grade examples</li>
</ul>
<p>The $2 Federal Reserve Note was reintroduced in 1976.</p>
<hr>
<h1>$5 NOTES</h1>
<p>Look for:</p>
<ul>
<li>Large-size notes</li>
<li>Red-seal United States Notes</li>
<li>Silver Certificates</li>
<li>Older Federal Reserve Notes</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Errors</li>
<li>Rare signature combinations</li>
</ul>
<hr>
<h1>$10 NOTES</h1>
<p>Look for:</p>
<ul>
<li>Large-size notes</li>
<li>Gold Certificates</li>
<li>Silver Certificates</li>
<li>United States Notes</li>
<li>Federal Reserve Bank Notes</li>
<li>Federal Reserve Notes</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Errors</li>
</ul>
<hr>
<h1>$20 NOTES</h1>
<p>Look for:</p>
<ul>
<li>Large-size notes</li>
<li>Gold Certificates</li>
<li>Silver Certificates</li>
<li>United States Notes</li>
<li>Federal Reserve Notes</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Errors</li>
</ul>
<hr>
<h1>$50 NOTES</h1>
<p>Look for:</p>
<ul>
<li>Large-size notes</li>
<li>Gold Certificates</li>
<li>Federal Reserve Notes</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Errors</li>
</ul>
<hr>
<h1>$100 NOTES</h1>
<p>This denomination deserves special attention because it has a long history of major collectible varieties.</p>
<p>Look for:</p>
<ul>
<li>Large-size notes</li>
<li>Gold Certificates</li>
<li>Silver Certificates</li>
<li>1914/1918 Federal Reserve Notes</li>
<li>1928 and later notes</li>
<li>1990 security-thread transition</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Printing errors</li>
</ul>
<p>The BEP notes that security thread and microprinting first appeared on Series 1990 $100 notes.</p>
<hr>
<h1>67. OLD $1 NOTES — QUICK REFERENCE</h1>
<h2>1899 $1 Silver Certificate</h2>
<p><strong>Black Eagle</strong></p>
<p>Pull.</p>
<h2>1923 $1 Silver Certificate</h2>
<p>Pull.</p>
<h2>1928 series</h2>
<p>Research.</p>
<h2>1935 Silver Certificate</h2>
<p>Pull and research series/signatures.</p>
<h2>1957 Silver Certificate</h2>
<p>Common but collectible; inspect condition, serial, and star.</p>
<hr>
<h1>68. SILVER CERTIFICATE VS FEDERAL RESERVE NOTE</h1>
<h3>Silver Certificate</h3>
<p>Usually:</p>
<p><strong>Blue seal</strong></p>
<h3>Federal Reserve Note</h3>
<p>Usually:</p>
<p><strong>Green seal</strong></p>
<h3>United States Note</h3>
<p>Usually:</p>
<p><strong>Red seal</strong></p>
<h3>Gold Certificate</h3>
<p>Historically:</p>
<p><strong>Gold/orange seal</strong></p>
<p>These are useful beginner clues, but <strong>always identify the complete issue</strong>.</p>
<hr>
<h1>69. HISTORICAL U.S. PAPER MONEY CATEGORIES</h1>
<p>A surprising note can belong to:</p>
<ol>
<li>Demand Notes</li>
<li>United States Notes</li>
<li>Fractional Currency</li>
<li>National Bank Notes</li>
<li>Gold Certificates</li>
<li>Silver Certificates</li>
<li>Treasury Notes</li>
<li>Federal Reserve Notes</li>
<li>Federal Reserve Bank Notes</li>
<li>Emergency/obsolete issues</li>
</ol>
<p>The BEP&#39;s historical currency timeline lists these major issue families and their periods.</p>
<hr>
<h1>70. FRACTIONAL CURRENCY</h1>
<p>Fractional Currency was issued during the Civil War era.</p>
<p>Denominations included:</p>
<ul>
<li>3 cents</li>
<li>5 cents</li>
<li>10 cents</li>
<li>15 cents</li>
<li>25 cents</li>
<li>50 cents</li>
</ul>
<h3>If found</h3>
<p>Do not spend it.</p>
<p>Even a small denomination can be a valuable historical collectible.</p>
<hr>
<h1>71. DEMAND NOTES</h1>
<p>Demand Notes are among the earliest federal paper-money issues.</p>
<p>They date to:</p>
<p><strong>1861-1862</strong></p>
<p>If found:</p>
<p><strong>STOP and research.</strong></p>
<hr>
<h1>72. COUNTERFEIT AWARENESS</h1>
<p>The older and more valuable the note appears, the more important authentication becomes.</p>
<p>Watch for:</p>
<ul>
<li>Wrong paper feel</li>
<li>Incorrect printing</li>
<li>Poor engraving</li>
<li>Incorrect serial font</li>
<li>Incorrect seal</li>
<li>Missing design elements</li>
<li>Incorrect signatures</li>
<li>Modern printer artifacts</li>
<li>Wrong dimensions</li>
</ul>
<p>The BEP describes currency paper as approximately <strong>75% cotton and 25% linen</strong>, and an individual note weighs approximately one gram regardless of denomination.</p>
<hr>
<h1>73. DO NOT DESTROY A SUSPECTED COUNTERFEIT</h1>
<p>If you believe a note is counterfeit:</p>
<p><strong>Do not alter it.</strong></p>
<p>Keep it separate and follow appropriate reporting/legal procedures.</p>
<p>A counterfeit is not a collectible substitute for a genuine note.</p>
<hr>
<h1>74. SECURITY FEATURES OF MODERN NOTES</h1>
<p>Modern notes can use:</p>
<ul>
<li>Security threads</li>
<li>Watermarks</li>
<li>Color-shifting ink</li>
<li>Microprinting</li>
<li>Security fibers</li>
<li>Raised/intaglio printing</li>
<li>Color-shifting numerals</li>
<li>3-D security ribbons on newer denominations</li>
</ul>
<p>The exact features vary by denomination and series.</p>
<p>Use official U.S. currency resources when authenticating modern notes.</p>
<hr>
<h1>75. THE 1990 SECURITY-THREAD MILESTONE</h1>
<p>Beginning with Series 1990:</p>
<p><strong>$100 notes received security thread and microprinting.</strong></p>
<p>By Series 1993, these features appeared on all denominations except $1 and $2.</p>
<p>This makes 1990s notes useful for learning the evolution of U.S. anti-counterfeiting technology.</p>
<hr>
<h1>76. SIGNATURE HUNTING STRATEGY</h1>
<p>When examining an older note:</p>
<ol>
<li>Identify denomination.</li>
<li>Identify series.</li>
<li>Read Secretary of Treasury.</li>
<li>Read Treasurer.</li>
<li>Record both.</li>
<li>Check whether that combination is scarce.</li>
<li>Check district.</li>
<li>Check serial range.</li>
<li>Check condition.</li>
</ol>
<h3>Do not use</h3>
<p>&quot;That signature looks old.&quot;</p>
<p>Use:</p>
<p><strong>exact signature combination.</strong></p>
<hr>
<h1>77. WHY SHORT TENURES MATTER</h1>
<p>Treasury officials change.</p>
<p>If a person served only briefly, fewer notes may have been produced bearing that signature.</p>
<p>Barr is the famous modern example.</p>
<p>This concept also applies to many earlier issues.</p>
<hr>
<h1>78. PRINTING FACILITY</h1>
<p>Modern U.S. currency can be produced at:</p>
<ul>
<li>Washington, D.C.</li>
<li>Fort Worth, Texas</li>
</ul>
<p>The BEP&#39;s Fort Worth facility began operating in 1990.</p>
<p>Some notes carry facility-related identifiers that can be useful to advanced collectors.</p>
<hr>
<h1>79. CONDITION-FIRST RULE FOR ERRORS</h1>
<p>A dramatic error can be valuable even when circulated.</p>
<p>But:</p>
<p><strong>The better the condition, the better the presentation.</strong></p>
<p>Avoid unnecessary handling.</p>
<p>Use clean hands and a protective currency sleeve for anything valuable.</p>
<hr>
<h1>80. STORAGE</h1>
<p>For important paper currency:</p>
<p>Use:</p>
<ul>
<li>Archival-quality currency sleeves</li>
<li>Acid-free materials</li>
<li>Stable temperature</li>
<li>Moderate humidity</li>
<li>No PVC</li>
<li>No adhesive</li>
<li>No rubber bands</li>
</ul>
<p>Avoid:</p>
<ul>
<li>Tape</li>
<li>Staples</li>
<li>Paper clips</li>
<li>Lamination</li>
<li>Plastic bags of unknown composition</li>
</ul>
<hr>
<h1>81. HOW TO HANDLE A NOTE</h1>
<p>Hold it by the edges.</p>
<p>Do not:</p>
<ul>
<li>Fold it</li>
<li>Bend it</li>
<li>Write on it</li>
<li>Put fingerprints across the face</li>
<li>Wet it</li>
<li>Press it</li>
</ul>
<p>For very valuable notes, use cotton/nitrile gloves only when appropriate and avoid dropping the note.</p>
<hr>
<h1>82. WHAT TO PHOTOGRAPH</h1>
<p>For a potentially valuable note, photograph:</p>
<ol>
<li>Entire face</li>
<li>Entire back</li>
<li>Serial number</li>
<li>Star</li>
<li>Seal</li>
<li>Signatures</li>
<li>Series</li>
<li>District identifiers</li>
<li>Error area</li>
<li>Edge/corners if relevant</li>
</ol>
<p>Good photographs are extremely useful for attribution.</p>
<hr>
<h1>83. CURRENCY RESEARCH WORKFLOW</h1>
<p>When you find a suspicious note:</p>
<h3>Step 1</h3>
<p>Identify denomination.</p>
<h3>Step 2</h3>
<p>Identify note type.</p>
<h3>Step 3</h3>
<p>Record series.</p>
<h3>Step 4</h3>
<p>Record both serial numbers.</p>
<h3>Step 5</h3>
<p>Record star/non-star.</p>
<h3>Step 6</h3>
<p>Record seal color.</p>
<h3>Step 7</h3>
<p>Record Federal Reserve district.</p>
<h3>Step 8</h3>
<p>Record signatures.</p>
<h3>Step 9</h3>
<p>Inspect condition.</p>
<h3>Step 10</h3>
<p>Look for errors.</p>
<h3>Step 11</h3>
<p>Look up exact issue.</p>
<h3>Step 12</h3>
<p>Compare with reputable examples.</p>
<h3>Step 13</h3>
<p>Only then investigate value.</p>
<hr>
<h1>84. WHAT NOT TO DO</h1>
<p>Do not:</p>
<ul>
<li>Spend an old note before identifying it.</li>
<li>Assume a blue seal is automatically valuable.</li>
<li>Assume every star note is rare.</li>
<li>Assume every fancy serial is valuable.</li>
<li>Wash currency.</li>
<li>Iron currency.</li>
<li>Tape currency.</li>
<li>Trim currency.</li>
<li>Flatten currency.</li>
<li>Trust a social-media &quot;rare bill&quot; post without diagnostics.</li>
<li>Assume a printing error is genuine without checking the manufacturing process.</li>
</ul>
<hr>
<h1>85. BEGINNER &quot;PULL EVERYTHING&quot; LIST</h1>
<p>If you are sorting a large amount of cash, immediately separate:</p>
<ul>
<li>Any note dated before 1930</li>
<li>Any large-size note</li>
<li>Any Silver Certificate</li>
<li>Any Gold Certificate</li>
<li>Any United States Note</li>
<li>Any National Bank Note</li>
<li>Any Federal Reserve Bank Note</li>
<li>Any star note</li>
<li>Any obvious fancy serial</li>
<li>Any serial mismatch</li>
<li>Any obvious printing error</li>
<li>Any unusual seal</li>
<li>Any unusual signature</li>
<li>Any $2 note</li>
<li>Any exceptionally crisp old note</li>
<li>Any high denomination older note</li>
</ul>
<hr>
<h1>86. ADVANCED HUNTING LIST</h1>
<p>After the obvious finds, examine:</p>
<h3>Serial</h3>
<ul>
<li>Radars</li>
<li>Repeaters</li>
<li>Ladders</li>
<li>Solids</li>
<li>Near-solids</li>
<li>Binaries</li>
<li>Seven-of-a-kind</li>
<li>Birthdays</li>
<li>Years</li>
<li>Repeated pairs</li>
</ul>
<h3>Production</h3>
<ul>
<li>Misalignment</li>
<li>Cutting</li>
<li>Offset</li>
<li>Foldover</li>
<li>Missing print</li>
<li>Seal errors</li>
<li>Serial errors</li>
<li>Ink errors</li>
</ul>
<h3>Historical</h3>
<ul>
<li>Signature combinations</li>
<li>District combinations</li>
<li>Series varieties</li>
<li>Small/large seal varieties</li>
<li>Large-size types</li>
<li>Certificates</li>
<li>National Bank Notes</li>
</ul>
<hr>
<h1>87. MASTER DENOMINATION CHECKLIST</h1>
<h2>$1</h2>
<ul>
<li><input disabled="" type="checkbox"> Silver Certificate</li>
<li><input disabled="" type="checkbox"> United States Note</li>
<li><input disabled="" type="checkbox"> Large-size note</li>
<li><input disabled="" type="checkbox"> 1899 Black Eagle</li>
<li><input disabled="" type="checkbox"> 1923 Silver Certificate</li>
<li><input disabled="" type="checkbox"> 1935 Silver Certificate</li>
<li><input disabled="" type="checkbox"> 1957 Silver Certificate</li>
<li><input disabled="" type="checkbox"> Barr</li>
<li><input disabled="" type="checkbox"> Star</li>
<li><input disabled="" type="checkbox"> Fancy serial</li>
<li><input disabled="" type="checkbox"> Printing error</li>
</ul>
<h2>$2</h2>
<ul>
<li><input disabled="" type="checkbox"> Red-seal note</li>
<li><input disabled="" type="checkbox"> 1928</li>
<li><input disabled="" type="checkbox"> 1953</li>
<li><input disabled="" type="checkbox"> 1963</li>
<li><input disabled="" type="checkbox"> 1976+</li>
<li><input disabled="" type="checkbox"> Star</li>
<li><input disabled="" type="checkbox"> Fancy serial</li>
<li><input disabled="" type="checkbox"> Error</li>
</ul>
<h2>$5</h2>
<ul>
<li><input disabled="" type="checkbox"> Large-size</li>
<li><input disabled="" type="checkbox"> Silver Certificate</li>
<li><input disabled="" type="checkbox"> United States Note</li>
<li><input disabled="" type="checkbox"> Gold Certificate</li>
<li><input disabled="" type="checkbox"> Star</li>
<li><input disabled="" type="checkbox"> Fancy serial</li>
<li><input disabled="" type="checkbox"> Error</li>
</ul>
<h2>$10</h2>
<ul>
<li><input disabled="" type="checkbox"> Large-size</li>
<li><input disabled="" type="checkbox"> Gold Certificate</li>
<li><input disabled="" type="checkbox"> Silver Certificate</li>
<li><input disabled="" type="checkbox"> United States Note</li>
<li><input disabled="" type="checkbox"> Federal Reserve Bank Note</li>
<li><input disabled="" type="checkbox"> Star</li>
<li><input disabled="" type="checkbox"> Fancy serial</li>
<li><input disabled="" type="checkbox"> Error</li>
</ul>
<h2>$20</h2>
<ul>
<li><input disabled="" type="checkbox"> Large-size</li>
<li><input disabled="" type="checkbox"> Gold Certificate</li>
<li><input disabled="" type="checkbox"> Silver Certificate</li>
<li><input disabled="" type="checkbox"> United States Note</li>
<li><input disabled="" type="checkbox"> Federal Reserve Note</li>
<li><input disabled="" type="checkbox"> Star</li>
<li><input disabled="" type="checkbox"> Fancy serial</li>
<li><input disabled="" type="checkbox"> Error</li>
</ul>
<h2>$50</h2>
<ul>
<li><input disabled="" type="checkbox"> Large-size</li>
<li><input disabled="" type="checkbox"> Gold Certificate</li>
<li><input disabled="" type="checkbox"> Federal Reserve Note</li>
<li><input disabled="" type="checkbox"> Star</li>
<li><input disabled="" type="checkbox"> Fancy serial</li>
<li><input disabled="" type="checkbox"> Error</li>
</ul>
<h2>$100</h2>
<ul>
<li><input disabled="" type="checkbox"> Large-size</li>
<li><input disabled="" type="checkbox"> Gold Certificate</li>
<li><input disabled="" type="checkbox"> Silver Certificate</li>
<li><input disabled="" type="checkbox"> Federal Reserve Note</li>
<li><input disabled="" type="checkbox"> 1914/1918 type</li>
<li><input disabled="" type="checkbox"> Security-thread transition</li>
<li><input disabled="" type="checkbox"> Star</li>
<li><input disabled="" type="checkbox"> Fancy serial</li>
<li><input disabled="" type="checkbox"> Error</li>
</ul>
<hr>
<h1>88. QUICK REFERENCE: SEAL COLORS</h1>
<table>
<thead>
<tr>
<th>Seal</th>
<th>Common association</th>
</tr>
</thead>
<tbody><tr>
<td>Green</td>
<td>Federal Reserve Note</td>
</tr>
<tr>
<td>Blue</td>
<td>Silver Certificate</td>
</tr>
<tr>
<td>Red</td>
<td>United States Note / Legal Tender</td>
</tr>
<tr>
<td>Gold/Orange</td>
<td>Gold Certificate</td>
</tr>
<tr>
<td>Brown</td>
<td>Several older/historical issues</td>
</tr>
</tbody></table>
<p><strong>This table is a starting point, not a complete attribution guide.</strong></p>
<p>Older currency used more complicated seal systems.</p>
<hr>
<h1>89. QUICK REFERENCE: U.S. PAPER MONEY ERAS</h1>
<table>
<thead>
<tr>
<th>Era</th>
<th>Things to learn</th>
</tr>
</thead>
<tbody><tr>
<td>1861-1862</td>
<td>Demand Notes</td>
</tr>
<tr>
<td>1862-1994</td>
<td>United States Notes</td>
</tr>
<tr>
<td>1862-1876</td>
<td>Fractional Currency</td>
</tr>
<tr>
<td>1863-1938</td>
<td>National Bank Notes</td>
</tr>
<tr>
<td>1865-1936</td>
<td>Gold Certificates</td>
</tr>
<tr>
<td>1878-1965</td>
<td>Silver Certificates</td>
</tr>
<tr>
<td>1890-1899</td>
<td>Treasury Notes</td>
</tr>
<tr>
<td>1914-present</td>
<td>Federal Reserve Notes</td>
</tr>
<tr>
<td>1915-1945</td>
<td>Federal Reserve Bank Notes</td>
</tr>
<tr>
<td>1929-present</td>
<td>Small-size currency</td>
</tr>
</tbody></table>
<p>The issue ranges above follow the BEP&#39;s historical currency timeline.</p>
<hr>
<h1>90. THE PAPER-MONEY &quot;OH WOW&quot; TEST</h1>
<p>When you see an unfamiliar bill, ask:</p>
<h3>Is it:</h3>
<p><strong>Older?</strong></p>
<p>→ Research.</p>
<p><strong>Large?</strong></p>
<p>→ Research.</p>
<p><strong>Blue seal?</strong></p>
<p>→ Research.</p>
<p><strong>Gold/orange seal?</strong></p>
<p>→ Research.</p>
<p><strong>Red seal?</strong></p>
<p>→ Research.</p>
<p><strong>Star?</strong></p>
<p>→ Research.</p>
<p><strong>Crazy serial?</strong></p>
<p>→ Research.</p>
<p><strong>Mismatched serials?</strong></p>
<p>→ STOP.</p>
<p><strong>Weird printing?</strong></p>
<p>→ Research.</p>
<p><strong>Unusual signature?</strong></p>
<p>→ Research.</p>
<p><strong>National Bank name?</strong></p>
<p>→ Research.</p>
<p><strong>$500/$1,000/$5,000/$10,000?</strong></p>
<p>→ STOP AND GET EXPERT HELP.</p>
<hr>
<h1>91. THE MOST IMPORTANT BEGINNER LESSONS</h1>
<h2>Lesson 1</h2>
<p><strong>Old does not automatically mean rare.</strong></p>
<h2>Lesson 2</h2>
<p><strong>Rare does not automatically mean valuable.</strong></p>
<h2>Lesson 3</h2>
<p><strong>Fancy does not automatically mean rare.</strong></p>
<h2>Lesson 4</h2>
<p><strong>Star does not automatically mean rare.</strong></p>
<h2>Lesson 5</h2>
<p><strong>A printing error can be much more valuable than an old note.</strong></p>
<h2>Lesson 6</h2>
<p><strong>Condition matters enormously.</strong></p>
<h2>Lesson 7</h2>
<p><strong>Signatures matter.</strong></p>
<h2>Lesson 8</h2>
<p><strong>Serial numbers matter.</strong></p>
<h2>Lesson 9</h2>
<p><strong>The exact series matters.</strong></p>
<h2>Lesson 10</h2>
<p><strong>Never alter a suspected valuable note.</strong></p>
<hr>
<h1>92. MASTER CURRENCY IDENTIFICATION WORKSHEET</h1>
<p><strong>Denomination:</strong><br><strong>Note type:</strong><br><strong>Series:</strong><br><strong>Serial number #1:</strong><br><strong>Serial number #2:</strong><br><strong>Star?:</strong><br><strong>Federal Reserve district:</strong><br><strong>Seal color:</strong><br><strong>Treasurer:</strong><br><strong>Secretary of Treasury:</strong><br><strong>Large-size or small-size?:</strong><br><strong>Silver Certificate?:</strong><br><strong>Gold Certificate?:</strong><br><strong>United States Note?:</strong><br><strong>Federal Reserve Note?:</strong><br><strong>National Bank Note?:</strong><br><strong>Fancy serial type:</strong><br><strong>Printing error?:</strong><br><strong>Security feature:</strong><br><strong>Condition:</strong><br><strong>Reference used:</strong><br><strong>Photos taken?:</strong><br><strong>Professional authentication needed?:</strong></p>
<hr>
<h1>93. FINAL PAPER-CURRENCY HUNTING RULE</h1>
<p>When a coin looks strange, you inspect the <strong>date, mintmark, weight, and design</strong>.</p>
<p>When paper currency looks strange, inspect:</p>
<p><strong>TYPE → SERIES → SIGNATURES → SEAL → DISTRICT → SERIAL → CONDITION → ERROR</strong></p>
<p>That sequence will prevent a huge number of beginner mistakes.</p>
<p>The best currency hunters don&#39;t just memorize &quot;valuable bills.&quot;</p>
<p>They learn to recognize <strong>how U.S. currency was manufactured, numbered, signed, sealed, issued, and replaced</strong>.</p>
<p>Once you understand those systems, the unusual notes start becoming much easier to spot.</p>
<hr>
<h1>OFFICIAL REFERENCE SOURCES</h1>
<p>For identification and authentication research, start with the U.S. Bureau of Engraving and Printing:</p>
<ul>
<li><strong>Circulating Currency</strong></li>
<li><strong>Historical Currency</strong></li>
<li><strong>Currency History</strong></li>
<li><strong>Serial Numbers</strong></li>
<li><strong>Denomination-specific currency pages</strong></li>
</ul>
<p>The BEP confirms that it currently prints $1, $2, $5, $10, $20, $50 and $100 notes, and provides official information about serial numbers, security features, historical issues, and currency types.</p>
<p>For collectible attribution and grading, use established numismatic references and professional grading services rather than relying solely on social-media posts or online marketplace asking prices.</p>
</div>`;

function showNoteTips() {
  showGuide('paper', 'Paper Currency Guide', PAPER_CURRENCY_GUIDE_HTML);
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

// --- Coin Roll-Hunting Guide (full master field guide) ------------------
const COIN_ROLL_GUIDE_HTML = `<style>
.cc-guide { font-size: 0.9rem; line-height: 1.55; }
.cc-guide h2 { font-size: 1.12rem; margin: 1.3em 0 0.45em; border-bottom: 1px solid var(--color-border, #d8d8d8); padding-bottom: 4px; }
.cc-guide h3 { font-size: 1.0rem; margin: 1.0em 0 0.35em; }
.cc-guide h4 { font-size: 0.95rem; margin: 0.8em 0 0.3em; }
.cc-guide p { margin: 0.45em 0; }
.cc-guide ul, .cc-guide ol { margin: 0.45em 0 0.45em 1.3em; padding: 0; }
.cc-guide li { margin: 0.22em 0; }
.cc-guide table { border-collapse: collapse; width: 100%; margin: 0.7em 0; font-size: 0.85rem; }
.cc-guide th, .cc-guide td { border: 1px solid var(--color-border, #ccc); padding: 4px 8px; text-align: left; vertical-align: top; }
.cc-guide th { background: var(--color-bg-alt, #f3f3f3); }
.cc-guide blockquote { border-left: 3px solid var(--color-accent, #4a90d9); margin: 0.6em 0; padding: 0.3em 0.8em; color: var(--color-text-muted, #666); background: rgba(0,0,0,0.03); }
.cc-guide code { background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; font-size: 0.85em; }
.cc-guide strong { font-weight: 600; }
.cc-guide input[type="checkbox"] { margin-right: 6px; vertical-align: middle; }
</style><div class="cc-guide"><h1>U.S. Coin Roll-Hunting Master Field Guide</h1>
<h2>A beginner-to-advanced reference for finding keys, semi-keys, varieties, errors, silver, and condition rarities</h2>
<p><strong>Scope:</strong> Primarily U.S. circulating coins, with emphasis on coins a roll hunter can realistically encounter.</p>
<p><strong>How to use this book:</strong> Start with the denomination chapter for the coin in your hand. Use the pull list as triage, then use the diagnostics to determine <em>why</em> a coin is interesting.</p>
<blockquote>
<p><strong>Important:</strong> Weight, color, magnetism, and magnification are screening tools—not authentication. Major rarities and valuable errors should be professionally authenticated.</p>
</blockquote>
<hr>
<h1>1. The Roll Hunter&#39;s Method</h1>
<p>For every coin, ask:</p>
<ol>
<li>What denomination is it?</li>
<li>What year?</li>
<li>What mintmark?</li>
<li>Is the composition unusual?</li>
<li>Is it a proof?</li>
<li>Is the design/type unusual?</li>
<li>Is there a recognized variety for this date?</li>
<li>Is there a genuine mint error?</li>
<li>Is it unusually well preserved?</li>
<li>Does it need closer examination?</li>
</ol>
<p>Do not begin with <strong>&quot;Is this worth money?&quot;</strong> Begin with <strong>&quot;What exactly is this coin?&quot;</strong></p>
<hr>
<h1>2. Core Terminology</h1>
<h2>Key date</h2>
<p>A particularly scarce date/mint combination important to completing a series.</p>
<h2>Semi-key</h2>
<p>A date/mint combination noticeably scarcer than ordinary dates but generally below the principal keys. Definitions vary by reference and grade.</p>
<h2>Better date</h2>
<p>A flexible collector term for a date deserving more attention than a common issue.</p>
<h2>Low mintage</h2>
<p>A coin with low original production. Low mintage does <strong>not</strong> automatically mean rare today; survival matters.</p>
<h2>Die variety</h2>
<p>A repeatable difference caused by the die(s) used to strike coins. Examples: doubled die, repunched mintmark, overmintmark, overdate, hub/design subtype, and some die clashes.</p>
<h2>Mint error</h2>
<p>An abnormal result of manufacture. Examples: wrong planchet, off-center, broadstrike, clip, struck-through, brockage, double strike, and missing clad layer.</p>
<h2>Die state</h2>
<p>The condition of a die at a particular point in its life. A die can progress from an early state to cracked, heavily cracked, and finally broken/shattered states.</p>
<hr>
<h1>3. Variety vs. Error vs. Damage</h1>
<h3>Die variety</h3>
<p>The die itself contains the unusual feature. A 1955 Lincoln doubled die is an example; the same die can strike many coins with the same feature.</p>
<h3>Mint error</h3>
<p>Something abnormal happened during manufacture, such as a wrong planchet or off-center strike.</p>
<h3>Post-mint damage</h3>
<p>Something happened after the coin left the Mint: scratches, gouges, bent rims, chemical stains, filing, grinding, heat damage, etc.</p>
<p><strong>Rule of thumb:</strong> A die crack normally appears as a raised line on the coin because the die is the negative image. An ordinary scratch is normally incuse. Always inspect the entire feature rather than relying on one rule.</p>
<hr>
<h1>4. Doubling: The Biggest Beginner Trap</h1>
<h2>True doubled die</h2>
<p>A doubled die is created during die manufacture. The coin repeatedly shows the doubled design. Look for distinct secondary design elements, separation, and consistent spread.</p>
<h2>Machine doubling</h2>
<p>Machine doubling happens during striking. It commonly looks flat, shelf-like, or like a design edge has been pushed down. It is generally <strong>not</strong> the valuable doubled-die variety collectors seek.</p>
<blockquote>
<p>Never call a coin a doubled die merely because something looks doubled under magnification.</p>
</blockquote>
<hr>
<h1>5. Weights, Metals, and Composition</h1>
<h2>Current standard circulating specifications</h2>
<table>
<thead>
<tr>
<th>Denomination</th>
<th align="right">Weight</th>
<th align="right">Diameter</th>
<th>Composition</th>
</tr>
</thead>
<tbody><tr>
<td>Cent</td>
<td align="right"><strong>2.500 g</strong></td>
<td align="right">19.05 mm</td>
<td>2.5% copper / 97.5% zinc</td>
</tr>
<tr>
<td>Nickel</td>
<td align="right"><strong>5.000 g</strong></td>
<td align="right">21.21 mm</td>
<td>75% copper / 25% nickel</td>
</tr>
<tr>
<td>Dime</td>
<td align="right"><strong>2.268 g</strong></td>
<td align="right">17.91 mm</td>
<td>91.67% copper / 8.33% nickel overall</td>
</tr>
<tr>
<td>Quarter</td>
<td align="right"><strong>5.670 g</strong></td>
<td align="right">24.26 mm</td>
<td>91.67% copper / 8.33% nickel overall</td>
</tr>
<tr>
<td>Half dollar</td>
<td align="right"><strong>11.340 g</strong></td>
<td align="right">30.61 mm</td>
<td>91.67% copper / 8.33% nickel overall</td>
</tr>
<tr>
<td>Dollar</td>
<td align="right"><strong>8.100 g</strong></td>
<td align="right">26.49 mm</td>
<td>copper-based manganese/brass alloy</td>
</tr>
</tbody></table>
<p>The U.S. Mint&#39;s current specifications confirm these standard weights and compositions.</p>
<h3>Why weight matters</h3>
<p>Weight can flag possible silver, steel, bronze, wrong planchets, missing clad layers, foreign planchets, or counterfeits.</p>
<h3>Why weight is not proof</h3>
<p>Wear, damage, plating, counterfeit construction, scale error, and normal tolerances can affect measurements. Use weight as a <strong>screening test</strong>.</p>
<hr>
<h1>6. Lincoln Cents</h1>
<h2>6.1 Composition timeline</h2>
<table>
<thead>
<tr>
<th>Issue</th>
<th>Composition</th>
<th align="right">Weight</th>
</tr>
</thead>
<tbody><tr>
<td>1909-1942 Wheat</td>
<td>95% copper / 5% zinc</td>
<td align="right">3.11 g</td>
</tr>
<tr>
<td>1943</td>
<td>Zinc-coated steel</td>
<td align="right">2.70 g</td>
</tr>
<tr>
<td>1944-1946 shell-case bronze</td>
<td>Copper alloy</td>
<td align="right">3.11 g</td>
</tr>
<tr>
<td>1947-1981</td>
<td>95% copper / 5% zinc</td>
<td align="right">3.11 g</td>
</tr>
<tr>
<td>1982 bronze</td>
<td>95% copper / 5% zinc</td>
<td align="right">3.11 g</td>
</tr>
<tr>
<td>1982 zinc</td>
<td>Copper-plated zinc</td>
<td align="right">2.50 g</td>
</tr>
<tr>
<td>1983-present</td>
<td>Copper-plated zinc</td>
<td align="right">2.50 g</td>
</tr>
</tbody></table>
<h2>6.2 Indian Head cents</h2>
<p><strong>Pull every Indian Head cent.</strong> Especially research 1877, 1908-S, and 1909-S.</p>
<h2>6.3 Wheat cents</h2>
<p><strong>Pull every Wheat cent.</strong> Then inspect date and mint.</p>
<h3>Major keys</h3>
<table>
<thead>
<tr>
<th>Date</th>
<th>Diagnostic</th>
<th>Level</th>
</tr>
</thead>
<tbody><tr>
<td>1909-S VDB</td>
<td>VDB on reverse</td>
<td>Major key</td>
</tr>
<tr>
<td>1909-S</td>
<td>S mintmark</td>
<td>Key</td>
</tr>
<tr>
<td>1914-D</td>
<td>D mintmark</td>
<td>Major key</td>
</tr>
<tr>
<td>1922 No D</td>
<td>Denver issue with absent/obscured D</td>
<td>Major variety</td>
</tr>
<tr>
<td>1931-S</td>
<td>S mintmark</td>
<td>Major key</td>
</tr>
</tbody></table>
<h3>Better/semi-key dates to research</h3>
<p>1911-D, 1912-D, 1912-S, 1913-D, 1913-S, 1914-S, 1915-D, 1915-S, 1916-S, 1917-S, 1918-D, 1918-S, 1919-D, 1919-S, 1921-S, 1923-S, 1924-D, 1924-S, 1925-D, 1926-D, 1926-S, 1927-D, 1927-S, 1928-S, 1929-D, 1929-S, 1930-S.</p>
<p><strong>Note:</strong> Semi-key labels vary by grade and reference.</p>
<h2>6.4 1909-S VDB</h2>
<p>Turn the coin over and inspect below the wheat stalks for <strong>VDB</strong>. Pull every candidate.</p>
<h2>6.5 1922 No D</h2>
<p>Denver was the only Mint striking Lincoln cents in 1922. Some Denver dies developed problems that caused the D to become extremely weak or disappear.</p>
<p><strong>Beginner warning:</strong> &quot;I cannot see the D&quot; is not enough. Weak-D pieces, damage, and genuine No D varieties must be separated by diagnostics.</p>
<h2>6.6 1943 steel cent</h2>
<p>Normal: zinc-coated steel, about <strong>2.70 g</strong>. Search for suspected <strong>1943 bronze</strong> cents. A genuine bronze example is an extraordinary error and should be authenticated.</p>
<h2>6.7 1944 steel cent</h2>
<p>Normal 1944 cents are bronze/shell-case bronze, about <strong>3.11 g</strong>. A genuine steel 1944 is an extraordinary off-metal error.</p>
<h2>6.8 1955 Doubled Die Obverse</h2>
<p>Inspect the date, LIBERTY, and IN GOD WE TRUST. The genuine variety has strong, unmistakable doubling. Major authentication candidate.</p>
<h2>6.9 1960 Small Date / Large Date</h2>
<p>1960 and 1960-D cents have different date styles and recognized overdate varieties. Use numeral shape, height, and spacing—not wear—to distinguish them.</p>
<h2>6.10 1969-S Doubled Die Obverse</h2>
<p>Inspect date, LIBERTY, and IN GOD WE TRUST. This is heavily counterfeited and frequently confused with machine doubling. A genuine candidate deserves professional authentication.</p>
<h2>6.11 1970-S Small Date</h2>
<p>A genuine Small Date is a distinct date-hub variety. A useful diagnostic is the relationship of the top of the <strong>7</strong> to the other numerals, along with the shape of the 7 and LIBERTY. Do not diagnose from one feature alone.</p>
<h2>6.12 1970-S Large Date Doubled Die Obverse</h2>
<p>Inspect Large Date examples for strong doubling on the date, LIBERTY, and motto. Compare with recognized diagnostics.</p>
<h2>6.13 1972 Doubled Die Obverse</h2>
<p>Inspect LIBERTY, IN GOD WE TRUST, and the date. There are multiple 1972 doubled dies; identify the exact variety rather than simply writing &quot;1972 DDO.&quot;</p>
<h2>6.14 1982 — the essential cent-hunting year</h2>
<p>Both bronze and zinc cents were made.</p>
<ul>
<li>Bronze: <strong>~3.11 g</strong></li>
<li>Zinc: <strong>~2.50 g</strong></li>
<li>Date styles: Large Date and Small Date</li>
</ul>
<p>Pull every 1982 until you have identified <strong>date style + composition + mint</strong>. A bronze 1982 is not automatically rare; rarity depends on the exact combination.</p>
<h2>6.15 1983 Doubled Die Reverse</h2>
<p>Inspect reverse lettering and compare against recognized diagnostics.</p>
<h2>6.16 1984 Doubled Ear</h2>
<p>Inspect Lincoln&#39;s ear. Separate genuine doubled-ear diagnostics from scratches, contact marks, and die chips.</p>
<h2>6.17 1988 Reverse of 1989</h2>
<p>A recognized reverse hub/design-transition variety. Compare against known diagnostics.</p>
<h2>6.18 1992 Close AM</h2>
<p>Inspect <strong>AMERICA</strong> on the reverse. Compare the relationship between the bases of A and M. The Close AM is significantly tighter than the Wide AM arrangement. Identify the exact year/mint before assigning the variety.</p>
<h2>6.19 1995 Doubled Die Obverse</h2>
<p>Inspect LIBERTY, IN GOD WE TRUST, and date for strong recognized doubling.</p>
<h2>6.20 1998-2000 Close AM / Wide AM</h2>
<p>These are reverse varieties. Do not use one year&#39;s diagnostic blindly on another year&#39;s coin; year and mint matter.</p>
<h2>6.21 2009 Bicentennial cents</h2>
<p>Four reverse designs were issued. Save one of each, then inspect for doubled dies, cuds, die chips, off-centers, broadstrikes, and proofs.</p>
<h2>6.22 Modern Shield cents</h2>
<p>Search for major doubled dies, cuds, major die cracks, clashes, off-centers, broadstrikes, wrong planchets, and missing plating. Tiny plating blisters are not automatically major errors.</p>
<hr>
<h1>7. Jefferson Nickels</h1>
<h2>7.1 Normal composition</h2>
<p>Most Jefferson nickels are <strong>75% copper / 25% nickel</strong>, <strong>5.00 g</strong>.</p>
<h2>7.2 Wartime silver nickels, 1942-1945</h2>
<p>Composition: <strong>56% copper / 35% silver / 9% manganese</strong>. Weight: <strong>5.00 g</strong>. Large P, D, or S above Monticello is the key visual clue. Philadelphia&#39;s P appeared on a U.S. circulation coin for the first time on this issue. </p>
<p>Pull every one.</p>
<h2>7.3 Buffalo nickels</h2>
<p>Pull every Buffalo. Research especially 1913-D/S, 1914-D/S, 1915-S, 1916-D, 1917-S, 1918-D/S, 1921-S, 1924-S, 1926-S, 1927-S, 1929-D/S, 1930-S, and 1931-S.</p>
<h2>7.4 1913 Buffalo Type 1 / Type 2</h2>
<h3>Type 1</h3>
<p>Reverse shows the buffalo standing on a <strong>raised mound</strong>.</p>
<h3>Type 2</h3>
<p>The ground/mound design was redesigned, including the denomination area, to reduce wear.</p>
<p>If you find a 1913 Buffalo, identify the type before returning it.</p>
<h2>7.5 1916/16 Buffalo</h2>
<p>Major doubled-die date variety. Inspect the date closely.</p>
<h2>7.6 1937-D Three-Legged Buffalo</h2>
<p>Heavy die polishing after a clash removed much of the buffalo&#39;s front leg. Do not simply count legs; inspect the leg, hoof, belly, and surrounding diagnostics.</p>
<h2>7.7 1935 Doubled Die Reverse</h2>
<p>Inspect reverse lettering and compare to a recognized example.</p>
<h2>7.8 Jefferson key dates</h2>
<p>Research 1938-D, 1938-S, 1939-D, 1939-S, and 1950-D.</p>
<h2>7.9 Wartime varieties</h2>
<p>Pay special attention to <strong>1943/2-P, 1943-P Doubled Eye, and 1945-P Doubled Die Reverse</strong>. These are recognized varieties.</p>
<h2>7.10 Full Steps</h2>
<p>Inspect the steps beneath Monticello. A sharp coin with uninterrupted steps can be substantially more desirable in high grade. Save exceptionally sharp examples.</p>
<hr>
<h1>8. Roosevelt Dimes</h1>
<h2>8.1 Mercury dimes</h2>
<p>Pull every Mercury dime. Major dates include 1916-D, 1921, 1921-D, 1926-S, 1931-D, and 1931-S.</p>
<h2>8.2 Silver Roosevelt dimes</h2>
<p>All normal Roosevelt dimes dated <strong>1946-1964</strong> are <strong>90% silver / 10% copper</strong> and weigh <strong>2.50 g</strong>. </p>
<h2>8.3 Better Roosevelt dates</h2>
<p>Research 1949-S, 1950-S, 1955, 1955-D, 1955-S, 1956-D, 1958-D, 1959-D, 1960-D, 1961-D, 1962-D, and 1963-D, with condition in mind.</p>
<h2>8.4 1964-D variety hunting</h2>
<p>Recognized varieties include RPM FS-501, MPM FS-502, RPM FS-503 through FS-506, and DDR FS-801 through FS-803. PCGS lists these and also distinguishes Full Bands examples.</p>
<p>This is an excellent example of why a silver hunter should not automatically stop at pulling the silver.</p>
<h2>8.5 Full Bands</h2>
<p>Inspect the horizontal torch bands. A very sharp Roosevelt with complete band separation can be much more desirable in high grade. Save exceptionally sharp examples.</p>
<hr>
<h1>9. Washington Quarters</h1>
<h2>9.1 Standing Liberty quarters</h2>
<p>Pull every one. Research 1916, 1919-D/S, 1920-D/S, 1921, 1923-S, 1924-S, 1926-S, and 1927-S.</p>
<h2>9.2 1918/7-S</h2>
<p>Classic overdate. Look for the underlying 7 beneath the final 8.</p>
<h2>9.3 Barber quarters</h2>
<p>Pull every Barber. Especially research 1896-S, 1901-S, 1904-S, and 1913-S.</p>
<h2>9.4 Silver Washington quarters</h2>
<p>Regular Washington quarters from <strong>1932-1964</strong> are <strong>90% silver / 10% copper</strong> and weigh <strong>6.25 g</strong>.</p>
<h2>9.5 1932-D and 1932-S</h2>
<p>Both are major keys. Pull immediately.</p>
<h2>9.6 1950-D/S and 1950-S/D</h2>
<p>Recognized overmintmark varieties. Inspect the mintmark closely.</p>
<h2>9.7 1942-D doubled die</h2>
<p>Inspect the obverse for recognized doubling and compare with attribution references.</p>
<h2>9.8 1964-D doubled die reverse</h2>
<p>Inspect reverse lettering and compare with recognized diagnostics.</p>
<h2>9.9 1965 silver quarter</h2>
<p>Normal 1965 quarter: <strong>5.67 g clad</strong>. A silver-planchet candidate will be around <strong>6.25 g</strong>. A genuine 1965 quarter struck on a silver planchet is a major transitional error. Weigh suspicious examples.</p>
<h2>9.10 1970-S wrong-planchet candidates</h2>
<p>If a 1970-S quarter is unusually small, oddly colored, has a strange edge, or abnormal weight, isolate it and investigate.</p>
<h2>9.11 1976 Bicentennial quarters</h2>
<p>Save P, D, S, proofs, silver issues, type varieties, and major errors.</p>
<h2>9.12 State quarter varieties</h2>
<h3>2004-D Wisconsin Extra Leaf</h3>
<p>Inspect the corn ear. Recognized forms are <strong>Extra Leaf High</strong> and <strong>Extra Leaf Low</strong>. These are die varieties, not scratches.</p>
<h3>2005-P Minnesota</h3>
<p>Numerous doubled-die varieties exist. The famous extra-tree appearance is doubling; do not count trees without matching exact diagnostics.</p>
<hr>
<h1>10. Kennedy Half Dollars</h1>
<h2>1964</h2>
<p><strong>90% silver</strong>, <strong>12.50 g</strong>. Pull all.</p>
<h2>1965-1970</h2>
<p><strong>40% silver</strong>, <strong>11.50 g</strong>. Pull all.</p>
<h2>1970-D</h2>
<p>Final regular circulation 40% silver Kennedy half. Pull it.</p>
<h2>Proofs</h2>
<p>Inspect 1964 proofs, Accented Hair, cameo/deep-cameo candidates, major varieties, and errors.</p>
<hr>
<h1>11. Eisenhower Dollars</h1>
<h2>11.1 1972-P Type 1 / Type 2 / Type 3</h2>
<p>The three reverse types are primarily distinguished by the <strong>earth/map details</strong>.</p>
<h3>Type 1</h3>
<p>Early reverse with less accurately rendered map/island details.</p>
<h3>Type 2</h3>
<p>Intermediate reverse with revised map details.</p>
<h3>Type 3</h3>
<p>Final reverse with more refined geography.</p>
<p><strong>Beginner method:</strong> Learn the three reference images first; then learn the geographic diagnostics. The important lesson is that 1972-P is not one uniform reverse.</p>
<h2>11.2 1976 Type 1 / Type 2</h2>
<p>Bicentennial Ike dollars have different reverse hub varieties. Compare against recognized examples.</p>
<h2>11.3 Silver Ikes</h2>
<p>Some S-mint collector issues contain 40% silver. <strong>S does not automatically mean silver.</strong> Identify the exact issue.</p>
<hr>
<h1>12. Susan B. Anthony Dollars</h1>
<h2>12.1 1979-P Near Date / Wide Rim</h2>
<p>Normal 1979-P: date farther from rim. Wide Rim/Near Date: date much closer to rim.</p>
<p><strong>Why both names?</strong> Wide Rim describes the rim relationship; Near Date describes the date&#39;s position. They refer to the same important variety.</p>
<h2>12.2 1979-S Type 1 / Type 2</h2>
<p>Type 1 has the more rounded/blobby S mintmark. Type 2 has a clearer, more sharply defined S. Type 2 is scarcer and desirable.</p>
<h2>12.3 1981-S Type 1 / Type 2</h2>
<p>The distinction is the mintmark-punch style. Type 2 uses the newer, clearer S.</p>
<hr>
<h1>13. Sacagawea and Native American Dollars</h1>
<p>Search for 2000-P Cheerios, Wounded Eagle, doubled dies, cuds, major die chips, clashes, off-centers, broadstrikes, wrong planchets, and edge errors.</p>
<h2>13.1 2000-P Cheerios</h2>
<p>Special 2000-P dollars distributed in Cheerios promotions can have enhanced reverse detail. Do not identify one from the date alone; compare the exact reverse diagnostics.</p>
<h2>13.2 Wounded Eagle</h2>
<p>Recognized reverse variety. Look for the diagnostic line across the eagle&#39;s breast and compare with a trusted reference.</p>
<hr>
<h1>14. Presidential Dollars</h1>
<p>The edge is critical. Look for missing, doubled, partial, or misaligned edge lettering.</p>
<p><strong>Warning:</strong> Weak edge lettering is not automatically an error. Study the complete edge.</p>
<hr>
<h1>15. Morgan and Peace Dollars</h1>
<p>These are unlikely modern roll finds but should be recognized instantly.</p>
<h2>Morgan</h2>
<p>Learn major keys: 1879-CC, 1889-CC, 1892-S, 1893, 1893-CC, 1893-S, 1894, 1895, 1895-O, 1895-S, 1903-O, and 1903-S.</p>
<h3>VAM</h3>
<p>Morgan varieties use the VAM system. Diagnostics can involve date position, mintmark, doubling, clashes, die breaks, polishing, and lettering.</p>
<h2>Peace</h2>
<p>Important dates include 1921, 1927-D, 1928, and 1934-S.</p>
<hr>
<h1>16. Proofs</h1>
<p>Proofs are specially manufactured collector coins. Clues include mirror-like fields, frosted design, sharp detail, and often an S mintmark on modern issues.</p>
<p><strong>Pull every proof.</strong> Then check date, variety, contrast, and errors.</p>
<hr>
<h1>17. Die Cracks, Die Chips, and Cuds</h1>
<h2>Die crack</h2>
<p>A crack in the die. Because the die is the negative image, it normally appears as a <strong>raised line</strong> on the coin.</p>
<h2>Die chip</h2>
<p>A small piece of die breaks away, producing a <strong>raised blob/lump</strong>.</p>
<h2>Cud</h2>
<p>A large die break involving the edge, usually producing a substantial raised area connected to the rim.</p>
<h3>Why a die crack can appear on many coins</h3>
<p>One die can strike thousands or far more coins. If it cracks and stays in service, the same crack can repeat on many coins. As the die deteriorates, the crack may lengthen and grow into a larger break. Repeated markers can therefore act like a fingerprint and identify die states.</p>
<hr>
<h1>18. Major Mint Error Types</h1>
<ul>
<li><strong>Off-center:</strong> planchet not centered in collar.</li>
<li><strong>Broadstrike:</strong> struck without normal collar containment.</li>
<li><strong>Clip:</strong> missing planchet material.</li>
<li><strong>Wrong planchet:</strong> struck on a blank intended for another denomination.</li>
<li><strong>Missing clad layer:</strong> one clad layer is absent.</li>
<li><strong>Struck-through:</strong> foreign material came between die and planchet.</li>
<li><strong>Brockage:</strong> a coin transfers an incuse/mirrored design to another planchet.</li>
<li><strong>Double strike:</strong> receives a second strike.</li>
<li><strong>Die clash:</strong> dies hit one another without a planchet between them.</li>
<li><strong>Cud:</strong> major die break.</li>
</ul>
<hr>
<h1>19. Wrong-Planchet Investigation</h1>
<p>For a suspicious coin, record:</p>
<ol>
<li>Weight</li>
<li>Diameter</li>
<li>Thickness</li>
<li>Edge appearance</li>
<li>Color</li>
<li>Magnetic behavior</li>
<li>Design/strike characteristics</li>
</ol>
<p>Example: normal quarter <strong>5.67 g</strong> versus a suspected silver-planchet quarter around <strong>6.25 g</strong>.</p>
<p><strong>Weight is a clue, not proof.</strong></p>
<hr>
<h1>20. Condition Rarities</h1>
<p>A common date can become scarce in exceptional condition.</p>
<h3>Lincoln cents</h3>
<p>Look for original red color, strong strike, and minimal marks.</p>
<h3>Jefferson nickels</h3>
<p>Look for Full Steps.</p>
<h3>Roosevelt dimes</h3>
<p>Look for Full Bands.</p>
<h3>Washington quarters</h3>
<p>Look for strong strike, original luster, and minimal contact marks.</p>
<p>If a modern coin looks <em>shockingly new</em>, save it.</p>
<hr>
<h1>21. Things Usually NOT Rare</h1>
<p>Usually do not treat these as major discoveries:</p>
<ul>
<li>Random scratches</li>
<li>Rim dents</li>
<li>Flattened rims</li>
<li>Machine doubling</li>
<li>Tiny die chips</li>
<li>Plating bubbles</li>
<li>Chemical discoloration</li>
<li>Polishing marks</li>
<li>Heat damage</li>
<li>Post-mint holes</li>
<li>Gouges</li>
</ul>
<hr>
<h1>22. Beginner Date-Priority System</h1>
<h2>Tier A — Pull immediately</h2>
<p>Silver; war nickels; Indian Heads; Wheat cents; Buffalo nickels; Mercury dimes; Barber coins; Standing Liberty quarters; Walking Liberty halves; Franklin halves; Morgan dollars; Peace dollars; major keys; obvious proofs; obvious major errors.</p>
<h2>Tier B — Stop and investigate</h2>
<p>1982 cents; 1960 cents; 1970-S cents; 1972 cents; 1992 cents; 1998-2000 cents; 1964-D dimes; 1976 quarters/Ikes; 1979-P SBA dollars; 1979-S SBA proofs; 1981-S SBA proofs; 1972-P Ikes; Wisconsin Extra Leaf; Minnesota doubled-die candidates.</p>
<h2>Tier C — Save if unusually nice</h2>
<p>Modern high-grade coins; Full Steps nickels; Full Bands dimes; sharp quarters; strongly lustrous cents; uncirculated older coins.</p>
<hr>
<h1>23. Equipment</h1>
<h2>Essential</h2>
<ul>
<li>5x-10x loupe</li>
<li>Accurate digital scale</li>
<li>Bright neutral lighting</li>
<li>Coin tray</li>
<li>Non-PVC holders</li>
<li>Notebook or spreadsheet</li>
</ul>
<h2>Helpful</h2>
<ul>
<li>Digital calipers</li>
<li>USB microscope</li>
<li>Camera/phone</li>
<li>Variety reference</li>
<li>Small magnet</li>
</ul>
<h3>Never use</h3>
<ul>
<li>Knives</li>
<li>Needles</li>
<li>Sandpaper</li>
<li>Metal polish</li>
<li>Abrasive cloth</li>
<li>Chemical cleaners</li>
</ul>
<hr>
<h1>24. Coin Identification Worksheet</h1>
<p><strong>Denomination:</strong><br><strong>Year:</strong><br><strong>Mint:</strong><br><strong>Weight:</strong><br><strong>Diameter:</strong><br><strong>Magnetic?:</strong><br><strong>Composition:</strong><br><strong>Type:</strong><br><strong>Obverse variety:</strong><br><strong>Reverse variety:</strong><br><strong>Mintmark variety:</strong><br><strong>Error?:</strong><br><strong>Die crack/chip/cud?:</strong><br><strong>Condition:</strong><br><strong>Proof?:</strong><br><strong>Reference used:</strong><br><strong>Photos taken?:</strong><br><strong>Authentication needed?:</strong>  </p>
<hr>
<h1>25. When to Get Professional Authentication</h1>
<p>Get professional attribution/authentication when a coin might be:</p>
<ul>
<li>1909-S VDB (Penny)</li>
<li>1914-D (Penny)</li>
<li>1922 No D (Penny)</li>
<li>1955 DDO (Penny)</li>
<li>1969-S DDO (Penny)</li>
<li>1970-S DDO (Penny)</li>
<li>1972 DDO (Penny)</li>
<li>1943 bronze (Penny)</li>
<li>1944 steel (Penny)</li>
<li>1965 silver quarter</li>
<li>Major wrong-planchet error</li>
<li>Major doubled die</li>
<li>Valuable Morgan VAM</li>
<li>Important proof variety</li>
</ul>
<p>The cost of authentication can be small compared with the risk of selling a genuine rarity as a common coin—or paying a premium for a counterfeit.</p>
<hr>
<h1>26. The Golden Rules</h1>
<ol>
<li><strong>Never clean a coin you think may be valuable.</strong></li>
<li><strong>Weigh suspicious coins.</strong></li>
<li><strong>Learn mintmarks.</strong></li>
<li><strong>Learn composition changes.</strong></li>
<li><strong>Do not confuse machine doubling with doubled dies.</strong></li>
<li><strong>Do not confuse damage with mint errors.</strong></li>
<li><strong>Learn the exact diagnostics for each variety.</strong></li>
<li><strong>Save exceptionally nice examples.</strong></li>
<li><strong>Photograph suspicious coins before excessive handling.</strong></li>
<li><strong>Never rely on a single social-media photograph to authenticate a major rarity.</strong></li>
</ol>
<hr>
<h1>27. Master Pull List</h1>
<h2>CENTS</h2>
<p><strong>Pull:</strong> Indian Head; Wheat; 1909-S; 1909-S VDB; 1914-D; 1922 No D candidates; 1931-S; 1943 steel; 1955 DDO candidates; 1969-S DDO candidates; 1970-S Small Date candidates; 1970-S DDO candidates; 1972 DDO candidates; all 1982s until attributed; 1983 DDR candidates; 1984 Doubled Ear candidates; 1988 Reverse of 1989; 1992 Close AM; 1995 DDO; 1998-2000 AM varieties; major modern errors.</p>
<h2>NICKELS</h2>
<p><strong>Pull:</strong> Buffalo; 1938-D; 1938-S; 1939-D; 1939-S; 1950-D; every 1942-1945 silver nickel; 1916/16; 1937-D 3-Legged candidates; 1943/2-P; 1943-P Doubled Eye; 1945-P DDR; Full Steps candidates.</p>
<h2>DIMES</h2>
<p><strong>Pull:</strong> Barber; Mercury; 1916-D; 1921; 1921-D; 1926-S; 1931-D; 1931-S; all 1946-1964 silver; 1964-D varieties; Full Bands candidates.</p>
<h2>QUARTERS</h2>
<p><strong>Pull:</strong> Barber; Standing Liberty; 1918/7-S; 1932-D; 1932-S; all 1932-1964 silver; 1950-D/S; 1950-S/D; 1942-D DDO candidates; 1964-D DDR candidates; 1965 heavy/silver candidates; 1970-S unusual-planchet candidates; 1976 varieties; 2004-D Wisconsin Extra Leaf; 2005-P Minnesota varieties.</p>
<h2>HALF DOLLARS</h2>
<p><strong>Pull:</strong> Barber; Walking Liberty; Franklin; 1964; 1965-1970; 1970-D; proofs; major errors.</p>
<h2>DOLLARS</h2>
<p><strong>Pull:</strong> Morgan; Peace; silver Eisenhower; 1972-P; 1976 varieties; 1979-P SBA; 1979-S proof; 1981-S proof; 2000-P Sacagawea; Presidential edge errors.</p>
<hr>
<h1>28. Final Mindset</h1>
<p>The best roll hunters do not merely memorize lists. They learn to recognize <strong>manufacturing clues</strong>.</p>
<p>When you see a strange coin, ask:</p>
<blockquote>
<p><strong>What happened at the Mint that could have created this?</strong></p>
</blockquote>
<p>If the answer is <strong>&quot;a die was different,&quot;</strong> you may have a variety.</p>
<p>If the answer is <strong>&quot;the blank was wrong,&quot;</strong> you may have an error.</p>
<p>If the answer is <strong>&quot;the die cracked,&quot;</strong> you may have a die-state marker.</p>
<p>If the answer is <strong>&quot;someone damaged it after it was made,&quot;</strong> you probably have damage.</p>
<p>That is the fundamental skill that turns roll hunting from sorting coins into actual numismatic research.</p>
</div>`;

function showRollHunting() {
  showGuide('roll', 'Coin Roll-Hunting Guide', COIN_ROLL_GUIDE_HTML);
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
