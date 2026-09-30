/**
 * infoDropdown.js - Coin Catalog v2
 * Info button dropdown menu (replaces the full-screen blurred Help modal).
 * Clicking "Info" opens a small popover with categorized info options;
 * each option opens a clean, readable modal.
 */

import { el, escHtml } from './utils.js';

/* ------------------------------------------------------------------------
   2026-09-29: Image sources. Matthew asked for this in the Info menu.
   Every entry below is a source actually used for images in the catalog,
   with the licence that governs reuse. Keep it accurate -- do not list a
   source that is not represented, and do not remove one that is.
   ------------------------------------------------------------------------ */
const IMAGE_SOURCES = [
    {
        name: 'National Numismatic Collection',
        via: 'Wikimedia Commons',
        licence: 'Public domain',
        url: 'https://commons.wikimedia.org/wiki/Category:National_Numismatic_Collection',
        note: 'Principal source for 1792-1943. Photograph pairs, some with ' +
              'single obverse or reverse crops.'
    },
    {
        name: 'Smithsonian Institution',
        via: 'Wikimedia Commons',
        licence: 'Public domain (CC0 where noted)',
        url: 'https://www.si.edu/object/national-numismatic-collection',
        note: 'Open-access numismatic holdings.'
    },
    {
        name: 'Wikimedia Commons',
        via: 'Category listings, individually licensed',
        licence: 'Public domain / CC0 / CC BY / CC BY-SA per file',
        url: 'https://commons.wikimedia.org/wiki/Category:Coins_of_the_United_States',
        note: 'Each image keeps its own licence. Attribution and share-alike ' +
              'terms apply where a file is CC BY or CC BY-SA.'
    },
    {
        name: 'Your own uploads',
        via: 'This app',
        licence: 'Yours',
        url: null,
        note: 'Images you add are yours to use, on this device and any ' +
              'device you sync to.'
    }
];

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
  { key: 'coinTips', label: 'Coin Collecting Guide' },
  { key: 'noteTips', label: 'Paper Currency Guide' },
  { key: 'famousStories', label: 'Famous Coin Stories' },
  { key: 'rollHunting', label: 'Coin Roll-Hunting Guide' },
  { key: 'donate', label: 'Support This App' },
  // 2026-09-29: Matthew asked where the coin images come from.
  { key: 'imageSources', label: 'Image Sources' },
  { key: 'privacy', label: 'Privacy & Reporting Bugs' },
  { key: 'guide', label: '✨ Take the Tour' },
  { key: 'advancedTour', label: '🧰 Advanced Features Tour' },
  ];

 const menu = el('div', { className: 'info-menu', role: 'menu' });
 items.forEach(it => {
 const item = el('button', {
 className: 'info-menu-item',
 role: 'menuitem',
 type: 'button',
 onclick: () => {
  closeInfoDropdown();
  // The advanced tour is a live walkthrough of Settings, not a
  // static panel, so it launches guide.js rather than openInfoSection.
  if (it.key === 'advancedTour') {
    import('./guide.js')
      .then(m => m.startAdvancedTour())
      .catch(e => console.error('[guide] advanced tour failed', e));
    return;
  }
  openInfoSection(it.key);
},
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
/* ================================================================
   Long-reference renderer.                               2026-09-30
   _sectionBody() renders a handful of blocks, which is right for
   "About" and wrong for a 101-section field guide. This adds a
   live filter and collapsible sections so a long guide opens as
   an index instead of an endless scroll.

   Same visual language as the short sections (.info-section-body,
   .info-subhead, .info-list) so both feel like the same product.
   ================================================================ */
function _longGuide(title, intro, sections, opts) {
    opts = opts || {};
    const body = el('div', { className: 'info-section-body info-longguide' });

    if (intro) body.appendChild(el('p', { className: 'info-intro' }, intro));

    // ---- search ----------------------------------------------------
    const search = el('input', {
        type: 'search',
        className: 'info-guide-search',
        placeholder: opts.searchPlaceholder || 'Search this guide...',
        'aria-label': 'Search this guide'
    });
    const count = el('div', { className: 'info-guide-count' });
    body.appendChild(search);
    body.appendChild(count);

    // ---- sections --------------------------------------------------
    const wrap = el('div', { className: 'info-guide-sections' });
    const items = sections.map((s, i) => {
        const node = el('div', { className: 'info-guide-sec', 'data-i': i });
        const h = el('button', {
            className: 'info-guide-h',
            type: 'button',
            'aria-expanded': i < (opts.openByDefault || 0) ? 'true' : 'false'
        }, [
            el('span', { className: 'info-guide-hn' }, s.h),
            el('span', { className: 'info-guide-hc' }, '▾')
        ]);
        const inner = el('div', { className: 'info-guide-b' });
        if (inner.style.display === undefined) { /* noop */ }
        // open by default for the first N, closed after
        if (i >= (opts.openByDefault || 0)) inner.style.display = 'none';

        h.addEventListener('click', () => {
            const open = inner.style.display !== 'none';
            inner.style.display = open ? 'none' : '';
            h.setAttribute('aria-expanded', open ? 'false' : 'true');
        });

        if (s.t) inner.appendChild(el('p', { className: 'info-text' }, s.t));
        (s.l || []).forEach(li => inner.appendChild(el('li', { className: 'info-li' }, li)));
        (s.tbl || []).forEach(row => {
            const t = el('table', { className: 'info-guide-tbl' });
            const tb = el('tbody');
            row.forEach((cell, ci) => {
                const tr = el('tr');
                tr.appendChild(el(ci === 0 ? 'th' : 'td', {}, String(cell)));
                tb.appendChild(tr);
            });
            t.appendChild(tb);
            inner.appendChild(t);
        });

        node.appendChild(h);
        node.appendChild(inner);
        wrap.appendChild(node);
        return { node, h, inner, s };
    });
    body.appendChild(wrap);

    // ---- filtering --------------------------------------------------
    const apply = () => {
        const q = search.value.trim().toLowerCase();
        let shown = 0;
        items.forEach(it => {
            const hay = (it.s.h + ' ' + (it.s.t || '') + ' ' + (it.s.l || []).join(' ')
                         + ' ' + (it.s.tbl || []).flat().join(' ')).toLowerCase();
            const hit = !q || hay.indexOf(q) !== -1;
            it.node.style.display = hit ? '' : 'none';
            if (hit) {
                shown++;
                // a search should reveal matches, not leave them collapsed
                if (q) { it.inner.style.display = ''; it.h.setAttribute('aria-expanded', 'true'); }
            }
        });
        count.textContent = q
            ? shown + ' of ' + items.length + ' sections match'
            : items.length + ' sections';
    };
    search.addEventListener('input', apply);
    search.addEventListener('search', apply);
    apply();

    return body;
}


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
 case 'imageSources': return showImageSources();
 case 'privacy': return showPrivacy();
 case 'guide': {
    import('./guide.js').then(m => m.startTour());
    break;
 }
 }
}

// --- About ---------------------------------------------------------------
/* ================================================================
   Field guide content, generated from Matthew's documents.
                                    2026-09-30
   Regenerate with md_to_sections.py; do not hand-edit these arrays.
   ================================================================ */





/* ================================================================
   Field guide content, generated from Matthew's documents.
                                    2026-09-30
   Regenerate with md_to_sections.py; do not hand-edit these arrays.
   ================================================================ */

const COIN_GUIDE_SECTIONS = [
    { h: "U.S. Coin Collecting: A Complete Beginner’s Guide",
      t: "Identification, Varieties, Errors, Grading, Buying, Selling, Storage, Research, and Building a Collection:",
    },
    { h: "1. Introduction",
      t: "Coin collecting is one of the easiest hobbies to begin and one of the deepest hobbies to master. You can start by looking through pocket change, searching bank rolls, examining coins inherited from family, or building a collection of historically important pieces. The important thing to understand is that valuable coins are not valuable simply because they are old. A coin can be valuable because it is: The goal of this guide is to teach you how to determine what you actually have before deciding what it is worth.",
      l: [
        "Rare",
        "Historically important",
        "Difficult to find in high grade",
        "A scarce date or mintmark",
        "A major die variety",
        "A genuine Mint error",
        "Made from precious metal",
        "An unusual die state",
        "An important transitional issue",
        "Exceptionally attractive",
        "In demand among collectors",
      ],
    },
    { h: "2. What Is Numismatics?",
      t: "Numismatics is the study and collection of coins, paper money, medals, tokens, and related objects. A person who collects or studies coins is commonly called a: Numismatist You do not have to be an expert to be a numismatist. The moment you begin learning why coins were made, how they were produced, and why some are more desirable than others, you are studying numismatics.",
    },
    { h: "3. How to Identify a U.S. Coin",
      t: "When you find an unfamiliar coin, do not immediately search for its value. Identify it first. Use this order: This sequence prevents many identification mistakes.",
      l: [
        "Country",
        "Denomination",
        "Date",
        "Mintmark",
        "Design/type",
        "Composition",
        "Weight",
        "Diameter",
        "Edge",
        "Variety",
        "Error status",
        "Condition",
        "Authenticity",
        "Market value",
      ],
    },
    { h: "4. Basic Coin Anatomy",
      t: "Obverse: The obverse is commonly called the \"heads\" side. Reverse: The reverse is commonly called the \"tails\" side. Edge: The edge is the surface around the outside of the coin. It can be: Rim: The rim is the raised border around the coin. Field: The field is the relatively flat background area surrounding the main design. Relief: Relief refers to the raised portions of the design. Devices: The individual design elements are commonly called devices. Mintmark: A mintmark identifies the Mint facility that produced the coin. Date: The date normally identifies the year of the coin’s issue, although certain historical varieties and restrikes require more investigation.",
      l: [
        "Plain",
        "Reeded",
        "Lettered",
        "Decorated",
      ],
    },
    { h: "5. U.S. Mintmarks",
      t: "Modern and historical U.S. coins can have different mintmarks. Common modern mintmarks include: Historical mintmarks include: Some Philadelphia coins have no mintmark. Important: The same letter can represent different historical mints. For example: D can mean: The date and coin type determine which one is possible.",
      l: [
        "Denver",
        "Dahlonega",
      ],
      tbl: [
        ["Mintmark", "Mint"],
        ["-", "-"],
        ["P", "Philadelphia"],
        ["D", "Denver"],
        ["S", "San Francisco"],
        ["W", "West Point"],
        ["Mintmark", "Mint"],
        ["-", "-"],
        ["C", "Charlotte"],
        ["CC", "Carson City"],
        ["D", "Dahlonega"],
        ["O", "New Orleans"],
      ],
    },
    { h: "6. Mintage vs. Rarity",
      t: "Mintage means the number of coins produced. It does not mean the number of coins surviving today. For example: A coin may have had a large mintage but very few survivors because: Conversely, a low-mintage coin can sometimes have a relatively large surviving population because collectors saved most examples. Therefore: Mintage ≠ surviving population ≠ rarity in a particular grade",
      l: [
        "It was melted",
        "It circulated heavily",
        "It was exported",
        "It was lost",
        "It was damaged",
        "It was destroyed",
        "Collectors did not save it",
        "Precious-metal content encouraged melting",
      ],
    },
    { h: "7. Key Dates, Semi-Key Dates, and Better Dates",
      t: "These terms are usually used within a particular coin series. Key Date: A key date is one of the most difficult issues to obtain for a series. Semi-Key Date: A semi-key is scarce enough to be notably more difficult to find than common issues, but generally not as difficult as the major keys. Better Date: A better date is a somewhat informal term for a date that is scarcer or more desirable than common dates. Important: These classifications can vary by reference and market. A date should not be called a \"key\" merely because an internet listing says it is rare.",
    },
    { h: "8. Coin Types and Type Designations",
      t: "A type is a particular design or major design variation. For example, the United States has produced multiple types of: Type numbers are not universal. If a reference says: Type 1 that does not mean the same thing for every series. The exact series must always be identified first.",
      l: [
        "Cents",
        "Nickels",
        "Dimes",
        "Quarters",
        "Half dollars",
        "Dollars",
      ],
    },
    { h: "9. Small Date, Large Date, Close Date, Wide Date, and Other Date Styles",
      t: "One of the most confusing areas for beginners is terminology involving dates. Terms such as: are generally series-specific descriptions. They do not have one universal measurement that applies to every U.S. coin. Differences can involve: Example: A \"Small Date\" variety may have: while the \"Large Date\" may have taller or wider numerals. The exact diagnostic depends on the coin. Critical Rule: Never identify a Small Date or Large Date simply because the date \"looks smaller.\" Compare the coin against known examples and the published diagnostics for that exact issue.",
      l: [
        "Small Date",
        "Large Date",
        "Close Date",
        "Wide Date",
        "High Date",
        "Low Date",
        "Near Date",
        "Far Date",
        "Numeral height",
        "Numeral width",
        "Spacing",
        "Shape",
        "Position",
        "Alignment",
        "Relationship to the rim",
        "Relationship between individual digits",
        "Relationship to nearby design elements",
        "Shorter numerals",
        "Narrower numerals",
        "Different spacing",
        "Different placement",
      ],
    },
    { h: "10. Die Varieties",
      t: "A die variety is a repeatable difference caused by the creation or modification of a particular die. The important concept is: The difference originates from the die. That means multiple coins struck by the same die can show the same characteristic. Examples include:",
      l: [
        "Doubled dies",
        "Repunched mintmarks",
        "Over-mintmarks",
        "Different date punches",
        "Hub changes",
        "Die chips",
        "Die cracks",
        "Die clashes",
        "Other die markers",
      ],
    },
    { h: "11. Doubled Dies",
      t: "A doubled die is created during the die-making process. The design is accidentally impressed into the die more than once in different positions. Coins struck by that die can show the resulting doubling. DDO: DDO = Doubled Die Obverse The doubling is on the obverse. DDR: DDR = Doubled Die Reverse The doubling is on the reverse. What to Look For: Potential doubled-die characteristics include: The exact appearance depends on the coin.",
      l: [
        "Split serifs",
        "Extra outlines",
        "Extra lettering",
        "Extra date elements",
        "Distinct separation",
        "Doubling in design elements",
      ],
    },
    { h: "12. Machine Doubling",
      t: "Machine doubling is often confused with a doubled die. Machine doubling occurs during the striking process rather than being created as a doubled die variety. It often appears: A genuine doubled die usually has more distinct separation or secondary design characteristics. Important: Not every coin showing something that looks like doubling is valuable. Always compare the feature with known examples.",
      l: [
        "Flat",
        "Shelf-like",
        "Abraded",
        "One-sided",
        "Blunt",
      ],
    },
    { h: "13. Repunched Mintmarks",
      t: "A Repunched Mintmark, or RPM, occurs when a mintmark was punched into a die more than once in different positions. This is especially important on older U.S. coins. The earlier punch can leave remnants visible next to or underneath the final mintmark. RPM varieties are highly series-specific.",
    },
    { h: "14. Over-Mintmarks",
      t: "An Over-Mintmark, commonly abbreviated OMM, occurs when one mintmark was punched over another. These are particularly associated with periods when mintmarks were applied manually. They can be difficult to identify and should be compared against documented examples.",
    },
    { h: "15. Die Cracks",
      t: "A die crack develops when a coin die physically cracks. The crack can appear on struck coins as a: Raised line This distinction is important. A crack in the die becomes a raised feature on the coin because the damaged area of the die creates metal displacement during striking. Why They Matter: A die can continue producing coins after developing a crack. Therefore the same crack can appear on: Some die cracks are common and have little premium. Others become famous and collectible.",
      l: [
        "Dozens of coins",
        "Hundreds of coins",
        "Thousands of coins",
        "Potentially many more",
      ],
    },
    { h: "16. Cuds",
      t: "A cud occurs when part of the die breaks away. The missing section of the die can produce a large raised area on the coin. A dramatic cud can be much more collectible than a tiny die crack. General Rule: The larger, clearer, and more dramatic the cud, the more likely it is to attract collector interest.",
    },
    { h: "17. Die Chips",
      t: "A die chip occurs when a small piece of the die breaks away. This can produce a raised blob or lump on the coin. Small die chips are common. Large, unusual, or well-known die chips can be collectible. Do not assume every tiny raised bump is a valuable die chip.",
    },
    { h: "18. Die Clashes",
      t: "A die clash occurs when the obverse and reverse dies come together without a planchet properly between them. Parts of one die can leave impressions on the opposing die. Coins struck afterward can show unusual transferred design elements. Clashes can be highly collectible depending on the series and severity.",
    },
    { h: "19. Die Polish Lines",
      t: "Dies are sometimes polished to remove damage or imperfections. Polishing can leave lines in the die. Those lines may transfer to coins. Because the die feature is recessed, die polish lines are generally: Raised on the coin This is an important diagnostic distinction.",
    },
    { h: "20. Die States",
      t: "A die can change throughout its useful life. A coin struck early in the life of a die can look different from one struck after the die develops: These stages are called die states. Collectors sometimes specialize in tracking the progression of a die.",
      l: [
        "Cracks",
        "Chips",
        "Clash marks",
        "Polishing",
        "Wear",
        "Other damage",
      ],
    },
    { h: "21. Mint Errors",
      t: "A Mint error is a manufacturing mistake that occurred during production and escaped normal quality control. Major categories include: Important: A coin being damaged after leaving the Mint does not make it a Mint error.",
      l: [
        "Wrong planchet",
        "Off-center",
        "Broadstrike",
        "Clipped planchet",
        "Struck-through",
        "Brockage",
        "Multiple strike",
        "Rotated die",
        "Transitional error",
        "Other striking or planchet errors",
      ],
    },
    { h: "22. Wrong-Planchet Errors",
      t: "A planchet is the prepared metal blank that is struck into a coin. A wrong-planchet error occurs when a coin is struck on a planchet intended for a different coin. Potential clues include: Example Concept: If a dime design is found struck on a planchet intended for another denomination, the resulting coin can be a major error. Important: Weight alone is never sufficient proof.",
      l: [
        "Incorrect weight",
        "Incorrect diameter",
        "Incorrect thickness",
        "Wrong metal",
        "Wrong edge characteristics",
        "Design that does not fit the planchet properly",
      ],
    },
    { h: "23. Off-Center Strikes",
      t: "An off-center strike occurs when the planchet is not properly positioned beneath the dies. The resulting coin may have: The amount of off-center striking can vary dramatically. Large, dramatic off-center errors are generally more desirable than tiny deviations.",
      l: [
        "Missing design",
        "A large blank crescent",
        "Partial rim",
        "Distorted positioning",
      ],
    },
    { h: "24. Broadstrikes",
      t: "A broadstrike occurs when the collar does not properly contain the planchet during striking. The coin can expand outward. Typical characteristics include:",
      l: [
        "Enlarged diameter",
        "Flattened or expanded shape",
        "Missing normal edge characteristics",
        "Design spread outward",
      ],
    },
    { h: "25. Clipped Planchets",
      t: "A clipped planchet occurs when part of the blank is missing before the coin is struck. Types can include: Authentic clips have recognizable physical characteristics. Important: Post-mint damage can imitate a clip. Do not assume a curved missing section automatically means a clipped planchet.",
      l: [
        "Curved clips",
        "Straight clips",
        "Ragged clips",
      ],
    },
    { h: "26. Struck-Through Errors",
      t: "A struck-through error occurs when foreign material interferes with the striking process. Possible results include: The appearance depends on what was between the die and planchet.",
      l: [
        "Weak design",
        "Missing design",
        "Distorted design",
        "Incuse impressions",
        "Strange surface texture",
      ],
    },
    { h: "27. Brockages",
      t: "A brockage can occur when a struck coin sticks to a die. That coin can then transfer part of its design to another planchet. Brockages can create: They can be dramatic and highly collectible.",
      l: [
        "Incuse design",
        "Mirror-image design",
        "Partial transferred designs",
      ],
    },
    { h: "28. Multiple Strikes",
      t: "A coin can occasionally be struck more than once. Potential clues include: Do not confuse a true multiple strike with:",
      l: [
        "Duplicated design",
        "Overlapping impressions",
        "Multiple rims",
        "Displaced lettering",
        "Rotated secondary strikes",
        "Machine doubling",
        "Die doubling",
        "Die deterioration",
      ],
    },
    { h: "29. Rotated Dies",
      t: "The obverse and reverse of a coin have an intended orientation. A significant deviation from the intended orientation can be collectible. Small deviations can occur and may not be significant depending on the issue. When checking a rotated die:",
      l: [
        "Hold the coin upright by the obverse.",
        "Rotate it vertically.",
        "Observe the reverse.",
        "Compare the orientation to the expected standard.",
      ],
    },
    { h: "30. Transitional Errors",
      t: "A transitional error occurs around a change in coin composition or design. The Mint changes specifications, but an old planchet or old composition can sometimes be struck with a new design. These errors can be extremely valuable. Because transitional errors are frequently counterfeited or misidentified, authentication is especially important.",
    },
    { h: "31. Post-Mint Damage",
      t: "One of the most important skills in collecting is recognizing damage that happened after the coin left the Mint. Common examples include: The Key Question: Could this feature realistically have been created during Mint production? If not, it is probably post-Mint damage.",
      l: [
        "Scratches",
        "Bends",
        "Gouges",
        "Filing",
        "Drilling",
        "Grinding",
        "Polishing",
        "Chemical damage",
        "Heat damage",
        "Road damage",
        "Plating",
        "Artificial toning",
      ],
    },
    { h: "32. Coin Weight",
      t: "Weight is one of the most useful diagnostic tools available to a collector. A digital scale accurate to: 0.01 gram is an excellent basic tool. Weight can help identify: Important: Weight is evidence, not proof. A counterfeit can be made to the correct weight. A genuine damaged coin can also weigh incorrectly.",
      l: [
        "Silver coins",
        "Wrong-planchet errors",
        "Counterfeits",
        "Composition changes",
        "Altered coins",
        "Clipped planchets",
      ],
    },
    { h: "33. Coin Diameter and Thickness",
      t: "When investigating an unusual coin, measure: Then compare those measurements with a reliable reference. The combination is much more useful than any individual measurement.",
      l: [
        "Weight",
        "Diameter",
        "Thickness",
      ],
    },
    { h: "34. U.S. Coin Metal Compositions",
      t: "Coin specifications have changed repeatedly throughout U.S. history. Common examples include: Always verify the exact issue.",
      tbl: [
        ["Coin / Period", "Approximate Composition"],
        ["-", "-"],
        ["Early U.S. cents", "Various copper-based alloys"],
        ["Indian Head cents", "Bronze for most later issues"],
        ["Lincoln cents before 1982", "Mostly copper"],
        ["1943 cent", "Zinc-coated steel"],
        ["Lincoln cents after 1982", "Copper-plated zinc, with some exceptions and special issues"],
        ["Jefferson nickel", "Copper-nickel"],
        ["Wartime Jefferson nickel", "35% silver, 56% copper, 9% manganese"],
        ["Roosevelt dime through 1964", "90% silver"],
        ["Washington quarter through 1964", "90% silver"],
        ["Kennedy half, 1964", "90% silver"],
        ["Kennedy half, 1965-1970", "40% silver"],
        ["Modern clad coins", "Copper-nickel over copper core"],
        ["Morgan dollar", "90% silver"],
        ["Peace dollar", "90% silver"],
      ],
    },
    { h: "35. Silver Coins",
      t: "Many U.S. coins contain silver. Major circulation silver milestones include: Dimes: U.S. dimes dated: 1964 and earlier are generally 90% silver. Quarters: U.S. quarters dated: 1964 and earlier are generally 90% silver. Half Dollars: Half dollars dated: 1964 and earlier are generally 90% silver. Kennedy halves dated: 1965-1970 are generally 40% silver. Wartime Nickels: Certain Jefferson nickels dated: 1942-1945 contain 35% silver. These are identifiable by the large mintmark above Monticello on the reverse.",
    },
    { h: "36. Gold Coins",
      t: "U.S. gold coins have been produced in many denominations. Historic denominations include: Modern bullion and commemorative gold coins also exist. When evaluating gold coins determine: Do not assume the total weight equals the amount of gold.",
      l: [
        "$1",
        "$2.50",
        "$3",
        "$5",
        "$10",
        "$20",
        "Gross weight",
        "Fineness",
        "Actual gold weight",
        "Date",
        "Mintmark",
        "Type",
        "Condition",
        "Rarity",
        "Authenticity",
      ],
    },
    { h: "37. Copper Coins",
      t: "Copper and bronze cents can be especially interesting because composition changed over time. Important examples include: Some dates can be valuable because of rarity or varieties rather than metal content.",
      l: [
        "Large cents",
        "Flying Eagle cents",
        "Indian Head cents",
        "Early Lincoln cents",
        "1943 steel cents",
        "Modern copper-plated zinc cents",
      ],
    },
    { h: "38. Nickel and Nickel-Alloy Coins",
      t: "The U.S. five-cent coin has historically used several compositions. The standard Jefferson nickel composition is generally: 75% copper / 25% nickel The major exception is the wartime alloy: 35% silver / 56% copper / 9% manganese These wartime nickels were made during: 1942-1945 and have a large mintmark above Monticello.",
    },
    { h: "39. Clad Coins",
      t: "Modern U.S. dimes, quarters, and many half dollars use clad construction. Clad means the coin is composed of layers of different metals. Modern clad coins generally have: The edge can reveal the layered construction. A coin showing an unusual edge color or layer can deserve additional investigation.",
      l: [
        "Copper-nickel outer layers",
        "Copper core",
      ],
    },
    { h: "40. Proof Coins",
      t: "Proof describes a special manufacturing process. Proof coins commonly have: A coin being shiny does not automatically make it a proof. Proofs are generally made specifically for collectors rather than ordinary circulation.",
      l: [
        "Mirrorlike fields",
        "Sharp details",
        "Frosted design elements",
      ],
    },
    { h: "41. Reverse Proof Coins",
      t: "A reverse proof uses the opposite visual contrast from a conventional proof. Generally: Reverse proofs are modern collector issues and are often produced for special sets.",
      l: [
        "Fields appear frosted",
        "Design elements appear mirrorlike",
      ],
    },
    { h: "42. Mint State and Circulated Grades",
      t: "Mint State generally means a coin that has not experienced circulation wear. Circulated coins show varying amounts of wear. Common circulated grades include: Uncirculated grades include: Not every coin can realistically exist at every grade.",
      l: [
        "Good",
        "Very Good",
        "Fine",
        "Very Fine",
        "Extremely Fine",
        "About Uncirculated",
        "MS-60",
        "MS-61",
        "MS-62",
        "MS-63",
        "MS-64",
        "MS-65",
        "MS-66",
        "MS-67",
        "MS-68",
        "MS-69",
        "MS-70",
      ],
    },
    { h: "43. Understanding the Sheldon Grading Scale",
      t: "The Sheldon scale runs from: 1 to 70 with: The scale is now widely used for certified U.S. coins. Examples: G-4 Very heavily worn but identifiable. VG-8 More detail remains. F-12 Moderate circulation wear. VF-20 Considerable detail remains. XF-40 Light wear. AU-50 About Uncirculated. MS-60+ Uncirculated.",
      l: [
        "1 representing extremely poor condition",
        "70 representing a theoretically perfect coin",
      ],
    },
    { h: "44. Details Grades and Problem Coins",
      t: "A coin can be genuine but have a problem preventing a normal numerical grade. Examples: A grading service may therefore assign a: Details grade rather than a normal numeric grade. A genuine coin with a Details grade can still be valuable.",
      l: [
        "Cleaning",
        "Scratches",
        "Environmental damage",
        "Corrosion",
        "Mounting",
        "Alteration",
      ],
    },
    { h: "45. Wear vs. Damage",
      t: "Wear is primarily caused by circulation. Damage is caused by something abnormal happening to the coin. Wear: Usually produces gradual loss of detail. Damage: Can include: Learning this distinction is essential for grading.",
      l: [
        "Sharp scratches",
        "Gouges",
        "Chemical discoloration",
        "Dents",
        "Bends",
        "Filing",
        "Polishing",
      ],
    },
    { h: "46. Cleaning Coins",
      t: "Do Not Clean Valuable Coins: Avoid: Cleaning can leave permanent hairlines and change the surface. A cleaned coin can be worth substantially less than an otherwise similar uncleaned coin.",
      l: [
        "Metal polish",
        "Toothpaste",
        "Baking soda",
        "Abrasive cloth",
        "Jewelry cleaner",
        "Tarnish remover",
        "Erasers",
        "Dremels",
        "Sandpaper",
      ],
    },
    { h: "47. Toning",
      t: "Toning is a chemical change to the coin’s surface. It can occur naturally over time. Toning can be: Some collectors strongly value attractive natural toning. Others prefer brilliant untoned coins. Color alone does not determine value.",
      l: [
        "Attractive",
        "Neutral",
        "Unattractive",
        "Artificial",
        "Damaging",
      ],
    },
    { h: "48. Luster",
      t: "Mint luster is the characteristic reflective appearance created by the striking process and movement of metal across the die. It is different from: Shine caused by polishing. Strong original luster can be an important factor in determining the quality and desirability of an uncirculated coin.",
    },
    { h: "49. Strike Quality",
      t: "Strike refers to how strongly the dies impressed the design. Some coin series are notorious for weak strikes in specific areas. A weak strike does not necessarily mean the coin is damaged. A sharply struck coin can be more desirable than another coin of the same numerical grade.",
    },
    { h: "50. Eye Appeal",
      t: "Eye appeal is the overall visual attractiveness of a coin. It can involve: Two coins with identical grades can have very different eye appeal and market values.",
      l: [
        "Color",
        "Toning",
        "Luster",
        "Strike",
        "Surfaces",
        "Marks",
        "Centering",
        "Overall appearance",
      ],
    },
    { h: "51. Contact Marks and Bag Marks",
      t: "Coins can hit one another during: These marks are commonly called: They are particularly noticeable on large silver dollars.",
      l: [
        "Mint transport",
        "Bagging",
        "Storage",
        "Handling",
        "Contact marks",
        "Bag marks",
      ],
    },
    { h: "52. Authenticating a Coin",
      t: "For an important coin, evaluate: Compare the coin with known genuine examples. For expensive coins, professional authentication is strongly recommended.",
      l: [
        "Weight",
        "Diameter",
        "Thickness",
        "Edge",
        "Metal",
        "Design",
        "Lettering",
        "Date",
        "Mintmark",
        "Surface texture",
        "Strike",
        "Die characteristics",
      ],
    },
    { h: "53. Counterfeit Warning Signs",
      t: "Potential warning signs include: Important: No single characteristic proves a coin is counterfeit. Use multiple diagnostics.",
      l: [
        "Incorrect weight",
        "Incorrect dimensions",
        "Incorrect edge",
        "Wrong lettering",
        "Incorrect mintmark",
        "Casting bubbles",
        "Seams",
        "Soft details",
        "Unusual luster",
        "Incorrect color",
        "Wrong metal",
        "Unusual surface texture",
        "Suspicious tooling",
      ],
    },
    { h: "54. Using a Scale",
      t: "A collector’s digital scale should ideally read to: 0.01 gram Place the coin directly on the scale. Record the result. Then compare it with a trusted specification. For particularly important coins, repeat the measurement using another scale if possible.",
    },
    { h: "55. Using Magnification",
      t: "A: 5x-10x loupe is an excellent starting point. Use magnification for: Do not assume something is valuable merely because it can be seen under extreme magnification.",
      l: [
        "Mintmarks",
        "Date varieties",
        "Doubled dies",
        "Die chips",
        "Die cracks",
        "Small scratches",
        "Surface problems",
      ],
    },
    { h: "56. Using Lighting",
      t: "Good lighting is one of the most important tools for coin examination. Move the coin under the light. Change the angle. Look for: A coin can look completely different under different lighting.",
      l: [
        "Hairlines",
        "Cleaning",
        "Luster",
        "Scratches",
        "Toning",
        "Die cracks",
        "Surface damage",
      ],
    },
    { h: "57. Using a Magnet",
      t: "A magnet can be useful as a screening tool. For example: 1943 steel cents are magnetic. Most ordinary copper cents are not. However: Magnetism does not prove authenticity. Use magnetic behavior together with:",
      l: [
        "Weight",
        "Dimensions",
        "Appearance",
        "Edge",
        "Composition",
      ],
    },
    { h: "58. Inspecting the Edge",
      t: "The edge is one of the most useful and overlooked parts of a coin. Check for: Always check the edge of an expensive or unusual coin.",
      l: [
        "Reeded edge",
        "Plain edge",
        "Lettered edge",
        "Missing reeds",
        "Partial reeds",
        "Double reeding",
        "Filing",
        "Seams",
        "Casting evidence",
        "Edge lettering errors",
        "Layering",
      ],
    },
    { h: "59. Researching a Coin",
      t: "Good research should answer:",
      l: [
        "What coin is it?",
        "What is its normal specification?",
        "How many were produced?",
        "How many are believed to survive?",
        "Are there recognized varieties?",
        "Are there recognized errors?",
        "What grades are common?",
        "What grades are rare?",
        "What have comparable coins sold for recently?",
      ],
    },
    { h: "60. Coin Price Guides",
      t: "Price guides can be useful for learning approximate market ranges. However, price-guide values should not automatically be treated as actual selling prices. Prices vary according to:",
      l: [
        "Grade",
        "Variety",
        "Eye appeal",
        "Market conditions",
        "Dealer markup",
        "Auction fees",
        "Certification",
        "Demand",
      ],
    },
    { h: "61. Auction Prices vs. Asking Prices",
      t: "This is one of the most important valuation lessons. An online listing is: An asking price An auction result is: A realized price A seller can ask $5,000 for a coin. That does not mean anyone will pay $5,000. When determining value, look for multiple recent sales of comparable coins.",
    },
    { h: "62. Population Reports",
      t: "A grading-service population report shows how many coins the service has graded at various levels. For example: Population reports are useful but imperfect. Coins can be: Therefore: Population is not the same thing as total surviving population.",
      l: [
        "MS-63",
        "MS-64",
        "MS-65",
        "MS-66",
        "Resubmitted",
        "Crossed to another service",
        "Removed from holders",
        "Regraded",
      ],
    },
    { h: "63. Buying Coins",
      t: "Possible sources include: Before spending significant money, research both: The coin and The seller",
      l: [
        "Coin shops",
        "Coin shows",
        "Auctions",
        "Established online dealers",
        "Collector-to-collector sales",
        "Estate collections",
        "Bank rolls",
        "U.S. Mint products",
      ],
    },
    { h: "64. Buying From Coin Dealers",
      t: "A good dealer should be willing to explain: Do not be afraid to say: \"I am still learning.\" A reputable dealer should not be offended by questions.",
      l: [
        "What the coin is",
        "Why it is valuable",
        "The grade",
        "The variety",
        "The price",
      ],
    },
    { h: "65. Buying at Coin Shows",
      t: "Coin shows are excellent places to learn. Tips: Do not feel pressured to buy immediately.",
      l: [
        "Ask before handling coins.",
        "Use trays when provided.",
        "Keep coins over the table.",
        "Do not mix coins between dealers.",
        "Take notes.",
        "Compare prices.",
        "Examine multiple examples.",
      ],
    },
    { h: "66. Buying Online",
      t: "Online marketplaces can be useful but require caution. Potential problems include: Always verify important purchases independently.",
      l: [
        "Misidentified coins",
        "Artificially inflated prices",
        "Counterfeits",
        "Altered coins",
        "Misrepresented grades",
        "Fake errors",
        "Stock photographs",
        "Old photographs",
        "Edited photographs",
      ],
    },
    { h: "67. Buying From Auctions",
      t: "Auction prices can be excellent research tools. Before bidding:",
      l: [
        "Identify the exact coin.",
        "Determine the grade.",
        "Check comparable sales.",
        "Add buyer’s premium.",
        "Add shipping and taxes where applicable.",
        "Set a maximum price.",
        "Do not chase the coin emotionally.",
      ],
    },
    { h: "68. Selling Coins",
      t: "Before selling: Never assume the first offer is the best offer.",
      l: [
        "Identify the coins.",
        "Separate valuable dates.",
        "Separate silver and gold.",
        "Look for major varieties.",
        "Look for errors.",
        "Determine approximate grades.",
        "Research recent sales.",
        "Get multiple opinions for expensive pieces.",
      ],
    },
    { h: "69. Getting Multiple Opinions",
      t: "Get another opinion when: A second opinion can prevent an expensive mistake.",
      l: [
        "Dealers disagree",
        "You suspect a major variety",
        "You suspect a major error",
        "A coin might be counterfeit",
        "The coin is expensive",
        "The grade is disputed",
        "Someone makes an extraordinary claim",
      ],
    },
    { h: "70. Professional Authentication and Grading",
      t: "Professional grading can provide: Professional grading is not necessary for every coin. It becomes more useful as:",
      l: [
        "Authentication",
        "Numerical grade",
        "Encapsulation",
        "Variety attribution when offered",
        "Market recognition",
        "Value increases",
        "Rarity increases",
        "Authenticity becomes more important",
        "Grade has a large effect on price",
      ],
    },
    { h: "71. When Should You Have a Coin Graded?",
      t: "Consider professional grading when: Do not spend $50-$100 or more grading a coin worth $5 unless there is another compelling reason.",
      l: [
        "The coin is valuable.",
        "It is a major key date.",
        "It may be a major variety.",
        "It may be a major error.",
        "Authenticity is uncertain.",
        "Grade strongly affects value.",
        "You intend to sell it.",
        "You want long-term protection.",
      ],
    },
    { h: "72. Coin Storage",
      t: "Good storage should protect coins from: Useful storage methods include:",
      l: [
        "Moisture",
        "Chemicals",
        "PVC",
        "Scratching",
        "Excessive handling",
        "Temperature extremes",
        "Coin flips",
        "2x2 holders",
        "Capsules",
        "Albums",
        "Hard holders",
        "Certified holders",
      ],
    },
    { h: "73. PVC and Plastic Holders",
      t: "Avoid soft plastic holders containing PVC. PVC can eventually leave a greenish or oily residue on coins. Long-term PVC exposure can damage surfaces. Look for: PVC-free coin storage products.",
    },
    { h: "74. Handling Coins",
      t: "Handle coins by their edges. Avoid touching the faces of coins whenever possible. Fingerprints contain oils and contaminants that can permanently stain surfaces. For proof coins and high-grade coins, handling precautions are especially important.",
    },
    { h: "75. Photographing Coins",
      t: "For important coins photograph: Use consistent lighting and camera settings. Photographs are useful for:",
      l: [
        "Obverse",
        "Reverse",
        "Edge",
        "Date",
        "Mintmark",
        "Variety diagnostics",
        "Problem areas",
        "Insurance",
        "Inventory",
        "Comparison",
        "Selling",
        "Documentation",
      ],
    },
    { h: "76. Keeping a Collection Inventory",
      t: "A good inventory should record: A spreadsheet is an excellent way to manage a collection.",
      l: [
        "Inventory number",
        "Date",
        "Denomination",
        "Mintmark",
        "Variety",
        "Grade",
        "Certification number",
        "Purchase price",
        "Purchase date",
        "Seller",
        "Estimated value",
        "Storage location",
        "Photograph filename",
        "Notes",
      ],
    },
    { h: "77. Provenance and Documentation",
      t: "Provenance means the documented history of ownership of an item. Keep: Provenance can be especially useful for important or historically significant coins.",
      l: [
        "Receipts",
        "Auction invoices",
        "Certificates",
        "Dealer information",
        "Previous photographs",
        "Family history",
        "Appraisals",
      ],
    },
    { h: "78. Insurance",
      t: "If your collection becomes valuable, check whether your current insurance adequately covers it. Maintain: Do not assume a normal household policy provides sufficient coverage for a valuable collection.",
      l: [
        "Inventory",
        "Photographs",
        "Receipts",
        "Appraisals",
        "Certification information",
      ],
    },
    { h: "79. Building a Collection",
      t: "There are many ways to build a collection. You can collect by: There is no single correct method.",
      l: [
        "Date",
        "Mintmark",
        "Type",
        "Variety",
        "Error",
        "Metal",
        "Historical period",
        "Grade",
        "Theme",
        "Denomination",
      ],
    },
    { h: "80. Collecting by Type",
      t: "A type set attempts to obtain one example of each major coin design/type. For example, a collector might have: Type collecting is excellent for beginners because it introduces many areas of U.S. numismatics without requiring every date.",
      l: [
        "One Indian Head cent",
        "One Lincoln cent",
        "One Buffalo nickel",
        "One Jefferson nickel",
        "One Mercury dime",
        "One Roosevelt dime",
        "One Standing Liberty quarter",
        "One Washington quarter",
        "One Walking Liberty half",
        "One Franklin half",
        "One Kennedy half",
        "One Morgan dollar",
        "One Peace dollar",
      ],
    },
    { h: "81. Collecting by Date",
      t: "A date collection attempts to obtain examples from different years. This can range from: Every year to: Every year and mintmark The second approach is much more difficult.",
    },
    { h: "82. Collecting by Mintmark",
      t: "A collector can build sets organized around different U.S. Mint facilities. This can be especially interesting for historical series. A coin’s mintmark can sometimes make an otherwise common date significantly more valuable.",
    },
    { h: "83. Collecting Errors",
      t: "Error collectors may specialize in: Major authenticated errors can be extremely valuable.",
      l: [
        "Wrong planchets",
        "Off-centers",
        "Clips",
        "Broadstrikes",
        "Brockages",
        "Struck-throughs",
        "Multiple strikes",
        "Transitional errors",
      ],
    },
    { h: "84. Collecting Die Varieties",
      t: "Variety collectors study: Variety collecting rewards careful observation and research.",
      l: [
        "DDOs",
        "DDRs",
        "RPMs",
        "OMMs",
        "Die cracks",
        "Die clashes",
        "Die chips",
        "Date varieties",
        "Hub varieties",
      ],
    },
    { h: "85. Collecting Silver",
      t: "Silver collecting can range from inexpensive circulated coins to extremely rare numismatic pieces. A beginner can start with: Remember: Silver value and collector value are different things.",
      l: [
        "90% silver dimes",
        "90% silver quarters",
        "90% silver half dollars",
        "40% silver Kennedy halves",
        "Wartime nickels",
        "Silver dollars",
      ],
    },
    { h: "86. Collecting Gold",
      t: "Gold collecting can involve: Authentication is especially important because valuable gold coins are frequent counterfeit targets.",
      l: [
        "Historic U.S. gold",
        "Modern bullion",
        "Commemoratives",
        "Proofs",
        "Type sets",
        "Rare dates",
        "High-grade coins",
      ],
    },
    { h: "87. Collecting Modern Coins",
      t: "Do not ignore modern coins. Modern collecting opportunities include: Some major modern varieties are discovered long after the coins were produced.",
      l: [
        "Proofs",
        "Mint errors",
        "Die varieties",
        "Low-mintage issues",
        "Special finishes",
        "Commemoratives",
        "High-grade condition rarities",
        "Limited releases",
      ],
    },
    { h: "88. Roll Hunting",
      t: "Roll hunting involves obtaining rolls of coins and searching them for desirable examples. Possible finds include: Roll hunting is inexpensive compared with buying rare coins individually and can be an excellent way to train your eye.",
      l: [
        "Silver",
        "Wheat cents",
        "Older dates",
        "Better dates",
        "Varieties",
        "Errors",
        "Foreign coins",
        "Tokens",
        "Interesting die states",
      ],
    },
    { h: "89. Pocket Change Hunting",
      t: "Search pocket change for: Most coins will be ordinary. That is completely normal. The skill is learning to recognize the exceptions.",
      l: [
        "Older dates",
        "Key dates",
        "Varieties",
        "Errors",
        "Unusual mintmarks",
        "Foreign coins",
        "Silver",
        "Missing-clad errors",
        "Off-centers",
        "Other unusual characteristics",
      ],
    },
    { h: "90. Estate and Inherited Collections",
      t: "Never assume a collection is valuable simply because someone spent decades collecting it. An inherited collection can contain: Before selling:",
      l: [
        "Valuable coins",
        "Common coins",
        "World coins",
        "Tokens",
        "Damaged coins",
        "Counterfeits",
        "Sentimental pieces",
        "Photograph everything.",
        "Inventory everything.",
        "Separate precious-metal coins.",
        "Identify key dates.",
        "Look for major varieties.",
        "Do not clean anything.",
        "Get opinions on important pieces.",
        "Preserve family history.",
      ],
    },
    { h: "91. Coin Clubs and Communities",
      t: "Coin clubs can provide: One experienced collector can sometimes teach more in an hour than weeks of random internet searching.",
      l: [
        "Mentoring",
        "Grading practice",
        "Variety attribution help",
        "Error identification",
        "Research assistance",
        "Coin shows",
        "Buying opportunities",
        "Friendships",
      ],
    },
    { h: "92. Beginner Equipment",
      t: "A good beginner setup includes: You do not need expensive equipment to begin.",
      l: [
        "5x-10x loupe",
        "0.01 g digital scale",
        "Good lamp",
        "Digital calipers or ruler",
        "PVC-free flips",
        "2x2 holders",
        "Album",
        "Notebook",
        "Spreadsheet",
        "Basic reference book",
      ],
    },
    { h: "93. Advanced Equipment",
      t: "As your interests develop, you might consider: Buy equipment because it solves a problem you actually have.",
      l: [
        "Stereo microscope",
        "Precision scale",
        "Digital calipers",
        "Macro camera",
        "UV light",
        "Magnet",
        "Coin microscope",
        "Specialized reference books",
        "Metal-testing equipment",
      ],
    },
    { h: "94. How to Study a Coin Series",
      t: "Instead of trying to learn every U.S. coin at once, choose one series. For example: Lincoln cents Learn: Then move to another series. This is one of the fastest ways to become knowledgeable.",
      l: [
        "Complete date range",
        "Mintmarks",
        "Key dates",
        "Semi-key dates",
        "Better dates",
        "Composition changes",
        "Major varieties",
        "Major errors",
        "Important die markers",
        "Grading characteristics",
        "Counterfeit warnings",
      ],
    },
    { h: "95. The Normal-First Rule",
      t: "The best way to recognize something abnormal is to know what normal looks like. Study: Then unusual examples become much easier to identify.",
      l: [
        "Normal lettering",
        "Normal dates",
        "Normal mintmarks",
        "Normal rims",
        "Normal edges",
        "Normal weight",
        "Normal strike",
        "Normal color",
        "Normal luster",
      ],
    },
    { h: "96. The \"Did the Mint Make It?\" Rule",
      t: "When you find something strange, ask: Could the Mint have created this during production? Think about the production process: Metal preparation ↓ Blanking ↓ Annealing ↓ Cleaning ↓ Upsetting ↓ Die preparation ↓ Striking ↓ Inspection ↓ Counting ↓ Bagging If the feature could only have happened after the coin left the Mint, it is probably post-Mint damage.",
    },
    { h: "97. The \"Why Is It Valuable?\" Rule",
      t: "Whenever someone says: \"This coin is worth $500!\" ask: \"Why?\" There should be a specific reason. Possible reasons include: If nobody can explain the reason, investigate before believing the valuation.",
      l: [
        "Key date",
        "Scarce mintmark",
        "Major variety",
        "Major error",
        "High grade",
        "Condition rarity",
        "Precious metal",
        "Historical significance",
        "Exceptional eye appeal",
      ],
    },
    { h: "98. Common Beginner Mistakes",
      t: "Mistake 1: Assuming Old Means Valuable: It doesn’t. Mistake 2: Believing Every Doubled-Looking Coin Is a Doubled Die: Many are machine doubling. Mistake 3: Cleaning Coins: Cleaning can permanently reduce value. Mistake 4: Trusting Internet Listings: A seller’s description is not proof. Mistake 5: Ignoring the Edge: The edge can reveal major clues. Mistake 6: Ignoring Weight: Weight can quickly reveal inconsistencies. Mistake 7: Looking Only at the Date: Mintmark, variety, composition, and condition can completely change value. Mistake 8: Assuming Low Mintage Means Rare: Survival matters. Mistake 9: Assuming Rare Means Expensive: Demand matters too. Mistake 10: Spending Too Much Too Soon: Learn first. Buy later.",
    },
    { h: "99. Master Coin Identification Workflow",
      t: "Use this procedure whenever you find an interesting coin. Step 1 - Identify the Country: Confirm that it is actually a U.S. coin. Step 2 - Identify the Denomination: Determine whether it is: Step 3 - Identify the Date: Record the exact date. Step 4 - Identify the Mintmark: Look carefully for the mintmark. Step 5 - Identify the Type: Determine the exact design. Step 6 - Determine Composition: Ask what metal the coin should contain. Step 7 - Weigh It: Use a 0.01 g scale when practical. Step 8 - Measure It: Check diameter and thickness when necessary. Step 9 - Inspect the Edge: Look for unusual characteristics. Step 10 - Look for Varieties: Check: Step 11 - Look for Errors: Check for: Step 12 - Assess Condition: Determine: Step 13 - Authenticate: If valuable or questionable, verify authenticity. Step 14 - Research Value: Use: Step 15 - Record It: Add the coin to your collection inventory. Step 16 - Store It Correctly: Use appropriate PVC-free storage.",
      l: [
        "Cent",
        "Nickel",
        "Dime",
        "Quarter",
        "Half dollar",
        "Dollar",
        "Gold denomination",
        "Commemorative",
        "Other",
        "DDO",
        "DDR",
        "RPM",
        "OMM",
        "Date varieties",
        "Die markers",
        "Die cracks",
        "Die chips",
        "Die clashes",
        "Wrong planchet",
        "Off-center",
        "Broadstrike",
        "Clip",
        "Struck-through",
        "Brockage",
        "Multiple strike",
        "Rotated die",
        "Transitional composition",
        "Circulated",
        "About Uncirculated",
        "Mint State",
        "Proof",
        "Details/problem",
        "Auction results",
        "Dealer prices",
        "Price guides",
        "Certified examples",
        "Comparable sales",
      ],
    },
    { h: "100. Master \"Is This Coin Special?\" Checklist",
      t: "When examining a coin, ask whether it has any of these characteristics:",
      l: [
        "[ ] Key date",
        "[ ] Semi-key date",
        "[ ] Better date",
        "[ ] Scarce mintmark",
        "[ ] Major variety",
        "[ ] DDO",
        "[ ] DDR",
        "[ ] RPM",
        "[ ] OMM",
        "[ ] Small Date",
        "[ ] Large Date",
        "[ ] Close Date",
        "[ ] Wide Date",
        "[ ] Major type",
        "[ ] Die crack",
        "[ ] Die chip",
        "[ ] Cud",
        "[ ] Die clash",
        "[ ] Die state",
        "[ ] Wrong planchet",
        "[ ] Off-center strike",
        "[ ] Broadstrike",
        "[ ] Clipped planchet",
        "[ ] Struck-through",
        "[ ] Brockage",
        "[ ] Multiple strike",
        "[ ] Rotated die",
        "[ ] Transitional composition",
        "[ ] Proof",
        "[ ] Reverse proof",
        "[ ] High grade",
        "[ ] Condition rarity",
        "[ ] Attractive toning",
        "[ ] Precious-metal content",
        "[ ] Historical significance",
      ],
    },
    { h: "Master \"Do Not Damage It\" Checklist",
      t: "Before doing anything to a potentially valuable coin:",
      l: [
        "[ ] Do not polish it.",
        "[ ] Do not scrub it.",
        "[ ] Do not use metal cleaner.",
        "[ ] Do not use toothpaste.",
        "[ ] Do not use baking soda.",
        "[ ] Do not use an abrasive cloth.",
        "[ ] Do not use an eraser.",
        "[ ] Do not use a Dremel.",
        "[ ] Do not scratch it to test the metal.",
        "[ ] Do not bend it.",
        "[ ] Do not drill it.",
        "[ ] Do not glue it.",
        "[ ] Do not strip the toning.",
        "[ ] Do not put it in PVC.",
        "[ ] Do not perform destructive tests.",
      ],
    },
    { h: "Quick Reference: The Collector’s Workflow",
      t: "Find coin ↓ Identify ↓ Date + Mintmark ↓ Identify Type ↓ Determine Composition ↓ Weigh ↓ Measure ↓ Inspect Edge ↓ Look for Varieties ↓ Look for Errors ↓ Assess Condition ↓ Authenticate if Necessary ↓ Research Recent Sales ↓ Record ↓ Store Safely",
    },
    { h: "Quick Reference: Before Buying an Expensive Coin",
      t: "STOP Ask: Then decide whether to buy.",
      l: [
        "What exactly is it?",
        "Is it genuine?",
        "What grade is it?",
        "Is the variety/error attribution correct?",
        "What are comparable coins actually selling for?",
        "Is the price reasonable?",
        "What happens if I later decide to sell it?",
      ],
    },
    { h: "Quick Reference: Before Selling an Expensive Coin",
      t: "Ask:",
      l: [
        "Is it correctly identified?",
        "Is the date correct?",
        "Is the mintmark correct?",
        "Is there a major variety?",
        "Is there a major error?",
        "Is it silver or gold?",
        "What is the approximate grade?",
        "What have comparable coins recently sold for?",
        "Have I obtained more than one opinion?",
        "Am I selling through the right market?",
      ],
    },
    { h: "Quick Reference: Before Cleaning a Coin",
      t: "STOP.: If you think a coin might be valuable: Do not clean it. Have it evaluated first.",
    },
    { h: "Final Advice",
      t: "The best coin collectors are not necessarily the people who spend the most money. They are the people who learn to answer: What exactly is this? Then: Why is it different? Then: Is that difference recognized? Then: How rare is it? Then: How much do comparable examples actually sell for? That mindset will protect you from a huge number of mistakes. You do not need to know everything. You only need to know enough to recognize when a coin deserves a closer look. And when you find something you cannot explain: Don’t clean it. Don’t alter it. Don’t sell it immediately. Research it.",
    },
    { h: "The Golden Rule of Coin Collecting",
      t: "Learn first. Handle carefully. Research everything. Buy slowly. Sell intelligently.: And most importantly:",
    },
    { h: "Have Fun!",
      t: "Coin collecting is not only about finding something worth money. Coins are pieces of history. They can tell stories about: A common coin with an interesting story is still a great coin. The more you learn, the more interesting every coin becomes.",
      l: [
        "Wars",
        "Presidents",
        "Economic crises",
        "Industrial changes",
        "Technological advances",
        "Immigration",
        "Art",
        "Politics",
        "Manufacturing",
        "Everyday American life",
      ],
    },
    { h: "Important Reference Note",
      t: "Coin specifications, compositions, mintages, die varieties, error classifications, type designations, key-date classifications, and market values can be issue-specific. Terminology such as Small Date, Large Date, Type 1, Type 2, Type 3, Close Date, Wide Date, DDO, DDR, RPM, OMM, and die state must always be interpreted in the context of the specific coin series and date. For expensive coins, verify information against authoritative references, specialist variety guides, professional grading resources, and recent realized auction prices. Never rely on a single photograph, price guide, dealer claim, or internet listing when a substantial amount of money is involved.",
    },
];

const NOTE_GUIDE_SECTIONS = [
    { h: "U.S. PAPER CURRENCY ROLL-HUNTING & CURRENCY-FINDING MASTER FIELD GUIDE",
      t: "Expanded Collector Edition - Identification, Hunting, Varieties, Errors, and Research Workflow: Purpose: A practical U.S. paper-money field guide for finding, identifying, documenting, and researching potentially collectible notes. Important: This is not a price guide. Values change with rarity, condition, market demand, authenticity, serial number, and variety. Scope: Primarily United States paper currency. The guide emphasizes notes that an ordinary person can realistically encounter, while also explaining older and obsolete issues so that a surprising note is not accidentally spent. Core rule: Do not judge a bill only by its denomination or age. Identify the **type of note, series, signatures, seal, serial number, Federal Reserve district, condition, and possible printing error**. Important: This is a hunting and identification guide, not a price guide. Values change with grade, rarity, market demand, serial number, and authentication. Major rarities and suspected errors should be examined by a specialist or professional grading service.",
    },
    { h: "1. THE FIRST 30 SECONDS",
      t: "When you receive a bill, look at these things before spending it: National Bank Note / other obsolete type** The Bureau of Engraving and Printing states that all U.S. currency remains legal tender regardless of when it was issued. That means an old note should not automatically be spent simply because it looks unfamiliar.",
      l: [
        "Denomination",
        "Series year",
        "Serial number",
        "Star at the end of the serial?",
        "Seal color",
        "Federal Reserve district",
        "Signatures",
        "Condition",
        "Unusual serial number",
        "Printing error",
        "Old design/type",
        "**Silver Certificate / Gold Certificate / United States Note /",
      ],
    },
    { h: "2. THE MOST IMPORTANT CONCEPT: IDENTIFY THE NOTE BEFORE VALUING IT",
      t: "A \\$1 bill is not necessarily \"just a dollar.\" A \\$1 note might be: The same principle applies to every denomination.",
      l: [
        "Federal Reserve Note",
        "Silver Certificate",
        "United States Note",
        "National Bank Note",
        "Legal Tender Note",
        "Emergency/obsolete issue",
        "Star note",
        "Fancy serial number",
        "Low serial number",
        "Printing error",
        "Rare signature combination",
        "Rare series",
        "High-grade example",
      ],
    },
    { h: "3. PAPER MONEY TERMINOLOGY",
      t: "Face: The front of the note. Back: The reverse of the note. Series: The year or year-with-letter designation printed on the note. Examples: Series is not necessarily the year the particular note was printed.",
      l: [
        "Series 1957",
        "Series 1995",
        "Series 2009A",
        "Series 2017A",
      ],
    },
    { h: "4. SIGNATURES",
      t: "Historical U.S. notes normally carry signatures representing Treasury officials. For modern small-size notes, collectors commonly describe a signature combination using the names of the: Why signatures matter: A short-serving Treasury official can produce a relatively scarce signature combination. The famous example is: Joseph W. Barr: Barr served as Secretary of the Treasury for only about one month, from December 21, 1968 to January 20, 1969. As a result, **Series 1963B \\$1 Federal Reserve Notes with Barr’s signature are popularly collected as \"Barr notes.\"** The Bureau of Engraving and Printing specifically notes that fewer notes bear Barr’s facsimile signature because of his unusually short tenure. Roll-hunting rule: Whenever you find an older note: Read the signatures. Do not rely on the series year alone.",
      l: [
        "Treasurer of the United States",
        "Secretary of the Treasury",
      ],
    },
    { h: "5. SERIAL NUMBERS",
      t: "Serial numbers are one of the easiest things to hunt because you can examine them without specialized equipment. Modern basic structure: Historically, many Federal Reserve Notes used: one letter + eight digits + one letter Example: A12345678B Beginning with Series 1996, \\$5 and higher Federal Reserve Notes use two letters before the eight digits, while \\$1 and \\$2 retain the older-style one-letter prefix format. For modern Federal Reserve Notes of \\$5 and higher, the first serial-number letter identifies the series and the second letter identifies the issuing Federal Reserve Bank. For \\$1 and \\$2 notes, the first serial-number letter identifies the issuing Federal Reserve Bank.",
    },
    { h: "6. FEDERAL RESERVE BANK LETTERS",
      t: "The 12 Federal Reserve districts use: Letter District ---- ----- A Boston B New York C Philadelphia D Cleveland E Richmond F Atlanta G Chicago H St. Louis I Minneapolis J Kansas City K Dallas L San Francisco The BEP confirms this letter-to-district relationship. Why collectors care: Some older series/district combinations are substantially scarcer than others. The district letter can also help identify a note that appears ordinary at first glance.",
    },
    { h: "7. STAR NOTES",
      t: "What is a star note?: A star note is a replacement note. If a sheet is discovered to be defective after serial numbers have been printed, the defective sheet cannot simply receive the same serial numbers again. A replacement sheet is therefore produced with a **star in place of the normal suffix letter**. The BEP explains this manufacturing process directly. Example: B12345678* instead of: B12345678A",
    },
    { h: "8. ARE ALL STAR NOTES RARE?",
      t: "No. This is one of the most important beginner lessons. A star note can be: What determines scarcity?: Collectors may consider: Beginner rule: Pull star notes from circulation. Research them later. Do not assume every star is worth a fortune.",
      l: [
        "Common",
        "Moderately scarce",
        "Scarce",
        "Very scarce",
        "Extremely rare",
        "Denomination",
        "Series",
        "Federal Reserve district",
        "Print run",
        "Replacement rate",
        "Whether the star note was produced for a limited run",
        "Condition",
      ],
    },
    { h: "9. FANCY SERIAL NUMBERS",
      t: "A fancy serial number has an unusually memorable or mathematically interesting pattern. These are highly collectible.",
    },
    { h: "10. SOLID SERIAL NUMBERS",
      t: "Example: 11111111 All eight digits are identical. These are extremely desirable. A true eight-digit solid is much more important than something merely containing several repeated digits.",
    },
    { h: "11. NEAR-SOLID SERIAL NUMBERS",
      t: "Example: 11111112 Seven identical digits and one different digit. These can be collectible, although generally less desirable than a true solid.",
    },
    { h: "12. LOW SERIAL NUMBERS",
      t: "Examples: 00000001 00000010 00000100 00001000 The closer a serial number is to the beginning of the production run, the more interesting it may be. Particularly desirable: Important: Not every low serial number is equally rare. A low number on an obscure or scarce note can be especially interesting.",
      l: [
        "00000001",
        "00000002",
        "00000003",
        "00000007",
        "00000010",
        "00000100",
        "00001000",
        "00010000",
      ],
    },
    { h: "13. RADAR SERIAL NUMBERS",
      t: "A radar serial reads the same forwards and backwards. Example: 12344321 Another: 00055000 Rule: Ignore the prefix/suffix letters when evaluating the basic eight-digit radar pattern.",
    },
    { h: "14. REPEATER SERIAL NUMBERS",
      t: "A repeating pattern repeats across the number. Example: 12341234 or: 45454545 The most obvious form is a four-digit sequence repeated twice.",
    },
    { h: "15. SUPER-REPEATER / REPEATING PATTERNS",
      t: "Examples: 12121212 12341234 71717171 The stronger and more obvious the repetition, the more interesting the note can become.",
    },
    { h: "16. LADDER SERIAL NUMBERS",
      t: "A ladder runs upward or downward in numerical sequence. Examples: 12345678 87654321 These are among the most recognizable fancy serial numbers.",
    },
    { h: "17. PARTIAL LADDER",
      t: "Example: 12345679 This is close to a ladder but is not a perfect ladder. Do not value it like: 12345678 Collectors generally distinguish exact patterns from approximate ones.",
    },
    { h: "18. BINARY SERIAL NUMBERS",
      t: "A binary serial contains only two different digits. Example: 10101010 or: 10001111 Important distinction: A note containing only 0 and 1 is a true binary. The exact pattern affects desirability.",
    },
    { h: "19. TRUE BINARY",
      t: "Examples: 10101010 11001100 11110000 These are especially easy to recognize.",
    },
    { h: "20. REPEATED-DIGIT SERIALS",
      t: "Examples: 12222222 77777770 55555555 The more extreme the repetition, the more collectible the number may be.",
    },
    { h: "21. SEQUENTIAL SERIAL NUMBERS",
      t: "Examples: 12345678 23456789 Reverse sequences: 87654321 These are classic fancy numbers.",
    },
    { h: "22. BIRTHDAY SERIAL NUMBERS",
      t: "A serial can represent a date. Example: 07141976 could be interpreted as: 07/14/1976 or: July 14, 1976 Important: Birthday serials are subjective. A number may be meaningful to one collector but not another. Shorter or more clearly interpretable dates are generally easier to market.",
    },
    { h: "23. YEAR SERIAL NUMBERS",
      t: "Example: 00001976 A serial containing a recognizable year can be interesting. But: A year-looking serial is not automatically rare. The exact pattern and collector demand matter.",
    },
    { h: "24. 7-OF-A-KIND / 8-OF-A-KIND",
      t: "Examples: 77777770 77777777 A note with seven identical digits is sometimes called a seven-of-a-kind. Eight identical digits is a solid.",
    },
    { h: "25. REPEATED PAIRS",
      t: "Example: 11223344 This has a strong repeated-pair structure. Another: 12121212 is a much stronger repeater.",
    },
    { h: "26. RADAR + REPEATER COMBINATIONS",
      t: "Some serials have multiple desirable characteristics. Example: 12211221 may have more than one recognizable pattern. General principle: The more compelling the exact mathematical pattern, the more interesting the note.",
    },
    { h: "27. SERIAL NUMBER ERRORS",
      t: "These are potentially much more important than ordinary fancy numbers. Look for:",
      l: [
        "Mismatched serial numbers",
        "Missing serial number",
        "Partially printed serial number",
        "Wrong color serial number",
        "Misaligned serial number",
        "Double-printed serial number",
        "Serial number printed over another design element",
        "Incorrect serial number relationship",
        "Serial number that does not match the note’s design/series",
      ],
    },
    { h: "28. MISMATCHED SERIAL NUMBERS",
      t: "A note normally has matching serial numbers. If the two serial numbers are genuinely different: STOP. Do not spend it. Do not attempt to alter it. Photograph both sides and seek expert attribution. A genuine mismatched serial-number error can be a major collectible error.",
    },
    { h: "29. MISSING SERIAL NUMBER",
      t: "If one serial number is completely missing but the other is present, investigate. However, determine whether:",
      l: [
        "It is a genuine printing error",
        "Ink was removed",
        "The note was chemically altered",
        "The serial number was intentionally erased",
      ],
    },
    { h: "30. MISALIGNED SERIAL NUMBERS",
      t: "A serial number can sometimes be noticeably shifted. Minor variation is not necessarily collectible. A major, dramatic misalignment can be an error.",
    },
    { h: "31. PRINTING ERRORS",
      t: "A paper-money error occurs during production. Potential things to watch for:",
      l: [
        "Missing printing",
        "Misregistration",
        "Offset printing",
        "Foldover",
        "Cutting error",
        "Obstruction",
        "Ink smear",
        "Missing seal",
        "Misplaced seal",
        "Misplaced serial numbers",
        "Wrong denomination components",
        "Dramatically shifted overprint",
        "Blank back",
        "Missing face/back printing",
        "Overprint errors",
        "Mismatched serials",
      ],
    },
    { h: "32. OFFSET ERROR",
      t: "An image can transfer from one sheet or surface to another before the ink has fully dried. This can create a mirrored or transferred image. Warning: Do not call every strange ink mark an offset error. Compare: - Direction - Mirroring - Ink characteristics - Placement",
    },
    { h: "33. FOLDOVER ERROR",
      t: "A portion of the sheet folds during printing or cutting. The folded section can receive an abnormal print impression. This can create: A genuine foldover error is much more interesting than an ordinary crease.",
      l: [
        "Missing portions",
        "Extra portions",
        "Misplaced printing",
        "Unusual margins",
      ],
    },
    { h: "34. CUTTING ERRORS",
      t: "Currency is printed on large sheets and later separated. A note can occasionally be cut incorrectly. Look for: Beginner warning: A slightly uneven margin is not automatically a major error. The production sheet geometry matters.",
      l: [
        "Abnormally wide margin",
        "Abnormally narrow margin",
        "Design cut into the margin",
        "Part of neighboring note design",
        "Dramatically uneven borders",
      ],
    },
    { h: "35. BLANK BACK / MISSING PRINTING",
      t: "A note with an entirely missing reverse printing can be an important error. But verify: Make sure the reverse was actually never printed. Do not confuse: - Heavy wear - Chemical damage - Ink removal - Counterfeit manufacture with a genuine missing-print error.",
    },
    { h: "36. INK ERRORS",
      t: "Look for: Particularly important: A dramatic error affecting an important design element can be considerably more collectible than a tiny ink spot.",
      l: [
        "Missing ink",
        "Extra ink",
        "Smearing",
        "Misregistration",
        "Wrong-color ink",
        "Overinking",
      ],
    },
    { h: "37. SEAL ERRORS",
      t: "The Treasury seal and Federal Reserve seal are important diagnostic features. Look for: Warning: Do not assume every weak seal is an error. Wear, ink variation, and printing pressure can affect appearance.",
      l: [
        "Missing seal",
        "Dramatically misplaced seal",
        "Double seal",
        "Partial seal",
        "Wrong seal color",
        "Misaligned seal",
      ],
    },
    { h: "38. SILVER CERTIFICATES",
      t: "What is a Silver Certificate?: Silver Certificates were U.S. currency certificates backed by silver held by the Treasury. They were first issued in 1878. The BEP lists Silver Certificates as an official U.S. currency issue from 1878 through 1965.",
    },
    { h: "39. THE EASY SILVER CERTIFICATE IDENTIFIER",
      t: "For many small-size Silver Certificates: Blue Treasury seal is the most obvious clue. Examples include: Pull them: Do not spend an old blue-seal note without checking the series.",
      l: [
        "1935 \\$1",
        "1935A",
        "1935B",
        "1935C",
        "1935D",
        "1935E",
        "1935F",
        "1935G",
        "1935H",
        "1957",
        "1957A",
        "1957B",
        "1957C",
      ],
    },
    { h: "40. 1957 SILVER CERTIFICATE",
      t: "The 1957 \\$1 Silver Certificate is particularly common. Important: It is collectible. But: Common does not mean rare. A circulated 1957 blue-seal \\$1 usually does not belong in the same category as a scarce early Silver Certificate.",
    },
    { h: "41. 1957-B / 1957-C / OTHER VARIANTS",
      t: "Study: - Series - Signatures - Serial range - Seal - Condition Some signature/series combinations are more desirable.",
    },
    { h: "42. SPECIAL SILVER CERTIFICATE NOTES",
      t: "Look especially for: Older Silver Certificates should almost always be researched before being spent.",
      l: [
        "1899 \\$1 Black Eagle",
        "1896 \\$1 Educational Silver Certificate",
        "1923 \\$1",
        "1928 series",
        "1934 series",
        "1935 series",
        "1957 series",
      ],
    },
    { h: "43. 1899 BLACK EAGLE",
      t: "A famous large-size Silver Certificate. Why important?: It has a dramatic eagle design on the face and portraits of: Roll-hunting equivalent: If you find one in an old envelope, safe, collection, or estate: STOP. Do not treat it as a \\$1 bill.",
      l: [
        "Abraham Lincoln",
        "Ulysses S. Grant",
      ],
    },
    { h: "44. GOLD CERTIFICATES",
      t: "What is a Gold Certificate?: Gold Certificates were certificates associated with gold held by the Treasury. They were first issued in 1865. The BEP lists Gold Certificates as an official currency issue from 1865 through 1936.",
    },
    { h: "45. GOLD CERTIFICATE IDENTIFICATION",
      t: "Common small-size Gold Certificates have: yellow/orange/gold-colored seal and serial-number coloring associated with the issue. Older large-size notes can be dramatically different. Pull every genuine Gold Certificate candidate.:",
    },
    { h: "46. IMPORTANT GOLD CERTIFICATE WARNING",
      t: "Do not assume: \"Gold Certificate = redeemable for gold today.\" That is not how modern collectors should interpret these notes. They are historical currency issues. Their collector value can be far above face value.",
    },
    { h: "47. UNITED STATES NOTES",
      t: "Often called: Legal Tender Notes They typically have: red Treasury seal and red serial numbers on small-size examples. United States Notes were authorized beginning in 1862. Their issuance was discontinued in 1971; outstanding United States Notes remain legal tender at face value.",
    },
    { h: "48. RED-SEAL \\$2 NOTES",
      t: "If you see an older \\$2 with: red seal do not spend it automatically. Check: - Series - Signatures - Serial number - Condition",
    },
    { h: "49. RED-SEAL \\$5 / \\$10 / \\$20 / ETC.",
      t: "Older United States Notes can occur in denominations beyond \\$2. They are historical collectible currency.",
    },
    { h: "50. FEDERAL RESERVE NOTES",
      t: "Modern U.S. paper money is primarily Federal Reserve Notes. Federal Reserve Notes began in 1914. The Bureau of Engraving and Printing prints the Federal Reserve notes ordered by the Federal Reserve Board. The seven currently issued denominations are \\$1, \\$2, \\$5, \\$10, \\$20, \\$50, and \\$100.",
    },
    { h: "51. LARGE-SIZE FEDERAL RESERVE NOTES",
      t: "Before the 1929 redesign, U.S. paper currency was substantially larger. Large-size notes are generally about 7.375 × 3.125 inches, while small-size notes are about 6.14 × 2.61 inches. Large-size notes measure approximately: 7.375 × 3.125 inches Modern small-size notes are approximately: 6.14 × 2.61 inches The 1929 redesign reduced the physical size of U.S. paper money by about 30 percent. Pull: Any genuine large-size U.S. note.",
    },
    { h: "52. NATIONAL BANK NOTES",
      t: "National Bank Notes are a major historical collecting field. They can contain: A genuine National Bank Note is not simply an ordinary Federal Reserve Note. If found: Photograph it and research the exact bank and charter.",
      l: [
        "National bank name",
        "Charter number",
        "Town/state",
        "Serial information",
        "Portraits",
        "Treasury signatures/seals",
      ],
    },
    { h: "53. HIGH-DENOMINATION NOTES",
      t: "U.S. notes of: were discontinued in 1969. They were last printed in 1945. The BEP states that these notes remain legal tender, although most are in private collections. If found: Do not spend it. Do not sell it to the first person who offers cash. Have it professionally evaluated.",
      l: [
        "\\$500",
        "\\$1,000",
        "\\$5,000",
        "\\$10,000",
      ],
    },
    { h: "54. \\$100,000 GOLD CERTIFICATE",
      t: "The \\$100,000 Gold Certificate, Series 1934, was used only for transactions between Federal Reserve Banks. It was not circulated among the general public and cannot legally be held by currency collectors. If someone offers you one from an ordinary collection, be extremely skeptical.",
    },
    { h: "55. LARGE-SIZE NOTE COLORS AND SEALS",
      t: "Older U.S. currency can have: Do not assume: \"blue = Silver Certificate\" or: \"red = United States Note\" without considering the note’s exact issue. The seal system changed over time.",
      l: [
        "Red seals",
        "Blue seals",
        "Gold/orange seals",
        "Brown seals",
        "Green seals",
      ],
    },
    { h: "56. CONDITION: PAPER MONEY HAS ITS OWN LANGUAGE",
      t: "Uncirculated: No evidence of normal circulation. Crisp Uncirculated: Fresh-looking note with strong original appearance. Choice/Crisp Uncirculated: A particularly attractive uncirculated note. Extremely Fine: Light circulation but still sharp. Very Fine: Moderate circulation. Fine: Clear circulation wear. Very Good / Good: Heavily circulated.",
    },
    { h: "57. FOLDS MATTER",
      t: "For paper currency: **A single vertical fold can substantially reduce the value of an otherwise beautiful note.** Collectors distinguish between: Never flatten a valuable note yourself.: Improper pressing/flattening can affect collector value and may be detectable.",
      l: [
        "Handling",
        "Teller counting marks",
        "Light bends",
        "Folds",
        "Creases",
        "Tears",
      ],
    },
    { h: "58. NEVER CLEAN PAPER MONEY",
      t: "Do not: A damaged-looking note can still be valuable. Cleaning can make it worse.",
      l: [
        "Wash",
        "Iron",
        "Bleach",
        "Laminate",
        "Tape",
        "Glue",
        "Trim",
        "Erase",
        "Rub stains",
        "Apply chemicals",
      ],
    },
    { h: "59. SERIAL NUMBER CHECKLIST",
      t: "When you see a bill, ask: Is it::",
      l: [
        "Star?",
        "00000001?",
        "00000002?",
        "Low serial?",
        "Radar?",
        "Repeater?",
        "Ladder?",
        "Reverse ladder?",
        "Solid?",
        "Near-solid?",
        "Binary?",
        "Seven-of-a-kind?",
        "Birthday?",
        "Year?",
        "Repeated pairs?",
        "Interesting sequence?",
        "Mismatched?",
        "Missing?",
        "Misaligned?",
      ],
    },
    { h: "60. THE BEST SERIAL NUMBERS TO PULL",
      t: "Tier 1: Tier 2: Tier 3:",
      l: [
        "00000001",
        "00000002",
        "00000003",
        "00000007",
        "11111111",
        "22222222",
        "12345678",
        "87654321",
        "12344321",
        "00000000 where applicable/legitimate",
        "Dramatic genuine serial-number errors",
        "00000010",
        "00000100",
        "00001000",
        "10101010",
        "12121212",
        "12341234",
        "11223344",
        "77777770",
        "Strong birthday numbers",
        "Scarce star-note combinations",
        "Interesting years",
        "Partial ladders",
        "Near solids",
        "Repeated pairs",
        "Personal dates",
        "Other recognizable patterns",
      ],
    },
    { h: "61. WHY PREFIXES MATTER",
      t: "The eight digits are not the whole serial number. For modern notes, the letters can identify: Therefore record the entire serial number, not just the eight digits. The BEP’s current serial-number explanation provides the official relationship between the prefixes and Federal Reserve districts.",
      l: [
        "Series information",
        "Federal Reserve district",
        "Printing/serial system",
      ],
    },
    { h: "62. THE TWO SERIAL NUMBERS SHOULD MATCH",
      t: "On a normal note: Left serial = right serial If they do not match: STOP. This is one of the easiest potentially major errors for a beginner to notice.",
    },
    { h: "63. STAR NOTE + FANCY SERIAL",
      t: "A note can have both. Example: B12344321* This combines: - Star replacement note - Radar serial Such combinations deserve special attention.",
    },
    { h: "64. STAR NOTE + LOW SERIAL",
      t: "Also potentially desirable. Example: A00000123* Again: Research the exact series and district.",
    },
    { h: "65. FANCY SERIAL DOES NOT AUTOMATICALLY MEAN HIGH VALUE",
      t: "This is critical. Collectors disagree on some patterns. A fancy serial can be: - Extremely desirable - Moderately desirable - Novelty-level Market demand determines actual value.",
    },
    { h: "66. DENOMINATION-BY-DENOMINATION HUNTING",
    },
    { h: "\\$1 NOTES",
      t: "Look for: Especially inspect: Every old-looking \\$1.",
      l: [
        "Silver Certificates",
        "United States Notes",
        "Barr notes",
        "Star notes",
        "Fancy serials",
        "Low serials",
        "Rare series",
        "Printing errors",
        "Older large-size notes",
        "1935/1957 Silver Certificates",
        "1899 and older large-size types",
      ],
    },
    { h: "\\$2 NOTES",
      t: "\\$2 notes are particularly fun because people often overlook them. Look for: The \\$2 Federal Reserve Note was reintroduced in 1976.",
      l: [
        "1928 red-seal notes",
        "1953 red-seal",
        "1963 red-seal",
        "1976+ Federal Reserve Notes",
        "Star notes",
        "Fancy serials",
        "Errors",
        "Proof/specimen-like unusual notes",
        "Very high-grade examples",
      ],
    },
    { h: "\\$5 NOTES",
      t: "Look for:",
      l: [
        "Large-size notes",
        "Red-seal United States Notes",
        "Silver Certificates",
        "Older Federal Reserve Notes",
        "Star notes",
        "Fancy serials",
        "Errors",
        "Rare signature combinations",
      ],
    },
    { h: "\\$10 NOTES",
      t: "Look for:",
      l: [
        "Large-size notes",
        "Gold Certificates",
        "Silver Certificates",
        "United States Notes",
        "Federal Reserve Bank Notes",
        "Federal Reserve Notes",
        "Star notes",
        "Fancy serials",
        "Errors",
      ],
    },
    { h: "\\$20 NOTES",
      t: "Look for:",
      l: [
        "Large-size notes",
        "Gold Certificates",
        "Silver Certificates",
        "United States Notes",
        "Federal Reserve Notes",
        "Star notes",
        "Fancy serials",
        "Errors",
      ],
    },
    { h: "\\$50 NOTES",
      t: "Look for:",
      l: [
        "Large-size notes",
        "Gold Certificates",
        "Federal Reserve Notes",
        "Star notes",
        "Fancy serials",
        "Errors",
      ],
    },
    { h: "\\$100 NOTES",
      t: "This denomination deserves special attention because it has a long history of major collectible varieties. Look for: The BEP notes that security thread and microprinting first appeared on Series 1990 \\$100 notes.",
      l: [
        "Large-size notes",
        "Gold Certificates",
        "Silver Certificates",
        "1914/1918 Federal Reserve Notes",
        "1928 and later notes",
        "1990 security-thread transition",
        "Star notes",
        "Fancy serials",
        "Printing errors",
      ],
    },
    { h: "67. OLD \\$1 NOTES - QUICK REFERENCE",
      t: "1899 \\$1 Silver Certificate: Black Eagle Pull. 1923 \\$1 Silver Certificate: Pull. 1928 series: Research. 1935 Silver Certificate: Pull and research series/signatures. 1957 Silver Certificate: Common but collectible; inspect condition, serial, and star.",
    },
    { h: "68. SILVER CERTIFICATE VS FEDERAL RESERVE NOTE",
      t: "Silver Certificate: Usually: Blue seal Federal Reserve Note: Usually: Green seal United States Note: Usually: Red seal Gold Certificate: Historically: Gold/orange seal These are useful beginner clues, but **always identify the complete issue**.",
    },
    { h: "69. HISTORICAL U.S. PAPER MONEY CATEGORIES",
      t: "A surprising note can belong to: The BEP’s historical currency timeline lists these major issue families and their periods.",
      l: [
        "Demand Notes",
        "United States Notes",
        "Fractional Currency",
        "National Bank Notes",
        "Gold Certificates",
        "Silver Certificates",
        "Treasury Notes",
        "Federal Reserve Notes",
        "Federal Reserve Bank Notes",
        "Emergency/obsolete issues",
      ],
    },
    { h: "70. FRACTIONAL CURRENCY",
      t: "Fractional Currency was issued during the Civil War era. Denominations included: If found: Do not spend it. Even a small denomination can be a valuable historical collectible.",
      l: [
        "3 cents",
        "5 cents",
        "10 cents",
        "15 cents",
        "25 cents",
        "50 cents",
      ],
    },
    { h: "71. DEMAND NOTES",
      t: "Demand Notes are among the earliest federal paper-money issues. They date to: 1861-1862 If found: STOP and research.",
    },
    { h: "72. COUNTERFEIT AWARENESS",
      t: "The older and more valuable the note appears, the more important authentication becomes. Watch for: The BEP describes currency paper as approximately **75% cotton and 25% linen**, and an individual note weighs approximately one gram regardless of denomination.",
      l: [
        "Wrong paper feel",
        "Incorrect printing",
        "Poor engraving",
        "Incorrect serial font",
        "Incorrect seal",
        "Missing design elements",
        "Incorrect signatures",
        "Modern printer artifacts",
        "Wrong dimensions",
      ],
    },
    { h: "73. DO NOT DESTROY A SUSPECTED COUNTERFEIT",
      t: "If you believe a note is counterfeit: Do not alter it. Keep it separate and follow appropriate reporting/legal procedures. A counterfeit is not a collectible substitute for a genuine note.",
    },
    { h: "74. SECURITY FEATURES OF MODERN NOTES",
      t: "Modern notes can use: The exact features vary by denomination and series. Use official U.S. currency resources when authenticating modern notes.",
      l: [
        "Security threads",
        "Watermarks",
        "Color-shifting ink",
        "Microprinting",
        "Security fibers",
        "Raised/intaglio printing",
        "Color-shifting numerals",
        "3-D security ribbons on newer denominations",
      ],
    },
    { h: "75. THE 1990 SECURITY-THREAD MILESTONE",
      t: "Beginning with Series 1990: \\$100 notes received security thread and microprinting. By Series 1993, these features appeared on all denominations except \\$1 and \\$2. This makes 1990s notes useful for learning the evolution of U.S. anti-counterfeiting technology.",
    },
    { h: "76. SIGNATURE HUNTING STRATEGY",
      t: "When examining an older note: Do not use: \"That signature looks old.\" Use: exact signature combination.",
      l: [
        "Identify denomination.",
        "Identify series.",
        "Read Secretary of Treasury.",
        "Read Treasurer.",
        "Record both.",
        "Check whether that combination is scarce.",
        "Check district.",
        "Check serial range.",
        "Check condition.",
      ],
    },
    { h: "77. WHY SHORT TENURES MATTER",
      t: "Treasury officials change. If a person served only briefly, fewer notes may have been produced bearing that signature. Barr is the famous modern example. This concept also applies to many earlier issues.",
    },
    { h: "78. PRINTING FACILITY",
      t: "Modern U.S. currency can be produced at: The BEP’s Fort Worth facility began operating in 1990. Some notes carry facility-related identifiers that can be useful to advanced collectors.",
      l: [
        "Washington, D.C.",
        "Fort Worth, Texas",
      ],
    },
    { h: "79. CONDITION-FIRST RULE FOR ERRORS",
      t: "A dramatic error can be valuable even when circulated. But: The better the condition, the better the presentation. Avoid unnecessary handling. Use clean hands and a protective currency sleeve for anything valuable.",
    },
    { h: "80. STORAGE",
      t: "For important paper currency: Use: Avoid: - Tape - Staples - Paper clips - Lamination - Plastic bags of unknown composition",
      l: [
        "Archival-quality currency sleeves",
        "Acid-free materials",
        "Stable temperature",
        "Moderate humidity",
        "No PVC",
        "No adhesive",
        "No rubber bands",
      ],
    },
    { h: "81. HOW TO HANDLE A NOTE",
      t: "Hold it by the edges. Do not: - Fold it - Bend it - Write on it - Put fingerprints across the face - Wet it - Press it For very valuable notes, use cotton/nitrile gloves only when appropriate and avoid dropping the note.",
    },
    { h: "82. WHAT TO PHOTOGRAPH",
      t: "For a potentially valuable note, photograph: Good photographs are extremely useful for attribution.",
      l: [
        "Entire face",
        "Entire back",
        "Serial number",
        "Star",
        "Seal",
        "Signatures",
        "Series",
        "District identifiers",
        "Error area",
        "Edge/corners if relevant",
      ],
    },
    { h: "83. CURRENCY RESEARCH WORKFLOW",
      t: "When you find a suspicious note: Step 1: Identify denomination. Step 2: Identify note type. Step 3: Record series. Step 4: Record both serial numbers. Step 5: Record star/non-star. Step 6: Record seal color. Step 7: Record Federal Reserve district. Step 8: Record signatures. Step 9: Inspect condition. Step 10: Look for errors. Step 11: Look up exact issue. Step 12: Compare with reputable examples. Step 13: Only then investigate value.",
    },
    { h: "84. WHAT NOT TO DO",
      t: "Do not: manufacturing process.",
      l: [
        "Spend an old note before identifying it.",
        "Assume a blue seal is automatically valuable.",
        "Assume every star note is rare.",
        "Assume every fancy serial is valuable.",
        "Wash currency.",
        "Iron currency.",
        "Tape currency.",
        "Trim currency.",
        "Flatten currency.",
        "Trust a social-media \"rare bill\" post without diagnostics.",
        "Assume a printing error is genuine without checking the",
      ],
    },
    { h: "85. BEGINNER \"PULL EVERYTHING\" LIST",
      t: "If you are sorting a large amount of cash, immediately separate:",
      l: [
        "Any note dated before 1930",
        "Any large-size note",
        "Any Silver Certificate",
        "Any Gold Certificate",
        "Any United States Note",
        "Any National Bank Note",
        "Any Federal Reserve Bank Note",
        "Any star note",
        "Any obvious fancy serial",
        "Any serial mismatch",
        "Any obvious printing error",
        "Any unusual seal",
        "Any unusual signature",
        "Any \\$2 note",
        "Any exceptionally crisp old note",
        "Any high denomination older note",
      ],
    },
    { h: "86. ADVANCED HUNTING LIST",
      t: "After the obvious finds, examine: Serial: Production: Historical:",
      l: [
        "Radars",
        "Repeaters",
        "Ladders",
        "Solids",
        "Near-solids",
        "Binaries",
        "Seven-of-a-kind",
        "Birthdays",
        "Years",
        "Repeated pairs",
        "Misalignment",
        "Cutting",
        "Offset",
        "Foldover",
        "Missing print",
        "Seal errors",
        "Serial errors",
        "Ink errors",
        "Signature combinations",
        "District combinations",
        "Series varieties",
        "Small/large seal varieties",
        "Large-size types",
        "Certificates",
        "National Bank Notes",
      ],
    },
    { h: "87. MASTER DENOMINATION CHECKLIST",
      t: "\\$1: \\$2: \\$5: \\$10: \\$20: \\$50: \\$100:",
      l: [
        "[ ] Silver Certificate",
        "[ ] United States Note",
        "[ ] Large-size note",
        "[ ] 1899 Black Eagle",
        "[ ] 1923 Silver Certificate",
        "[ ] 1935 Silver Certificate",
        "[ ] 1957 Silver Certificate",
        "[ ] Barr",
        "[ ] Star",
        "[ ] Fancy serial",
        "[ ] Printing error",
        "[ ] Red-seal note",
        "[ ] 1928",
        "[ ] 1953",
        "[ ] 1963",
        "[ ] 1976+",
        "[ ] Star",
        "[ ] Fancy serial",
        "[ ] Error",
        "[ ] Large-size",
        "[ ] Silver Certificate",
        "[ ] United States Note",
        "[ ] Gold Certificate",
        "[ ] Star",
        "[ ] Fancy serial",
        "[ ] Error",
        "[ ] Large-size",
        "[ ] Gold Certificate",
        "[ ] Silver Certificate",
        "[ ] United States Note",
        "[ ] Federal Reserve Bank Note",
        "[ ] Star",
        "[ ] Fancy serial",
        "[ ] Error",
        "[ ] Large-size",
        "[ ] Gold Certificate",
        "[ ] Silver Certificate",
        "[ ] United States Note",
        "[ ] Federal Reserve Note",
        "[ ] Star",
        "[ ] Fancy serial",
        "[ ] Error",
        "[ ] Large-size",
        "[ ] Gold Certificate",
        "[ ] Federal Reserve Note",
        "[ ] Star",
        "[ ] Fancy serial",
        "[ ] Error",
        "[ ] Large-size",
        "[ ] Gold Certificate",
        "[ ] Silver Certificate",
        "[ ] Federal Reserve Note",
        "[ ] 1914/1918 type",
        "[ ] Security-thread transition",
        "[ ] Star",
        "[ ] Fancy serial",
        "[ ] Error",
      ],
    },
    { h: "88. QUICK REFERENCE: SEAL COLORS",
      t: "Seal Common association ----- ------------- Green Federal Reserve Note Blue Silver Certificate Red United States Note / Legal Tender Gold/Orange Gold Certificate Brown Several older/historical issues This table is a starting point, not a complete attribution guide. Older currency used more complicated seal systems.",
    },
    { h: "89. QUICK REFERENCE: U.S. PAPER MONEY ERAS",
      t: "Era Things to learn ------ ---------- 1861-1862 Demand Notes 1862-1994 United States Notes 1862-1876 Fractional Currency 1863-1938 National Bank Notes 1865-1936 Gold Certificates 1878-1965 Silver Certificates 1890-1899 Treasury Notes 1914-present Federal Reserve Notes 1915-1945 Federal Reserve Bank Notes 1929-present Small-size currency The issue ranges above follow the BEP’s historical currency timeline.",
    },
    { h: "90. THE PAPER-MONEY \"OH WOW\" TEST",
      t: "When you see an unfamiliar bill, ask: Is it:: Older? → Research. Large? → Research. Blue seal? → Research. Gold/orange seal? → Research. Red seal? → Research. Star? → Research. Crazy serial? → Research. Mismatched serials? → STOP. Weird printing? → Research. Unusual signature? → Research. National Bank name? → Research. \\$500/\\$1,000/\\$5,000/\\$10,000? → STOP AND GET EXPERT HELP.",
    },
    { h: "91. THE MOST IMPORTANT BEGINNER LESSONS",
      t: "Lesson 1: Old does not automatically mean rare. Lesson 2: Rare does not automatically mean valuable. Lesson 3: Fancy does not automatically mean rare. Lesson 4: Star does not automatically mean rare. Lesson 5: A printing error can be much more valuable than an old note. Lesson 6: Condition matters enormously. Lesson 7: Signatures matter. Lesson 8: Serial numbers matter. Lesson 9: The exact series matters. Lesson 10: Never alter a suspected valuable note.",
    },
    { h: "92. MASTER CURRENCY IDENTIFICATION WORKSHEET",
      t: "Denomination:\\ Note type:\\ Series:\\ Serial number #1:\\ Serial number #2:\\ Star?:\\ Federal Reserve district:\\ Seal color:\\ Treasurer:\\ Secretary of Treasury:\\ Large-size or small-size?:\\ Silver Certificate?:\\ Gold Certificate?:\\ United States Note?:\\ Federal Reserve Note?:\\ National Bank Note?:\\ Fancy serial type:\\ Printing error?:\\ Security feature:\\ Condition:\\ Reference used:\\ Photos taken?:\\ Professional authentication needed?:",
    },
    { h: "93. FINAL PAPER-CURRENCY HUNTING RULE",
      t: "When a coin looks strange, you inspect the **date, mintmark, weight, and design**. When paper currency looks strange, inspect: **TYPE → SERIES → SIGNATURES → SEAL → DISTRICT → SERIAL → CONDITION → ERROR** That sequence will prevent a huge number of beginner mistakes. The best currency hunters don’t just memorize \"valuable bills.\" They learn to recognize **how U.S. currency was manufactured, numbered, signed, sealed, issued, and replaced**. Once you understand those systems, the unusual notes start becoming much easier to spot.",
    },
    { h: "OFFICIAL REFERENCE SOURCES",
      t: "For identification and authentication research, start with the U.S. Bureau of Engraving and Printing: The BEP confirms that it currently prints \\$1, \\$2, \\$5, \\$10, \\$20, \\$50 and \\$100 notes, and provides official information about serial numbers, security features, historical issues, and currency types. For collectible attribution and grading, use established numismatic references and professional grading services rather than relying solely on social-media posts or online marketplace asking prices.",
      l: [
        "Circulating Currency",
        "Historical Currency",
        "Currency History",
        "Serial Numbers",
        "Denomination-specific currency pages",
      ],
    },
    { h: "94. EXPANDED FIELD GUIDE: HOW TO ACTUALLY HUNT PAPER MONEY",
      t: "This section turns the identification material above into a practical roll-hunting and cash-sorting system. The Golden Rule: **Do not try to decide what a note is worth while you are still identifying it.** First identify the note. Then determine whether it is a recognized variety, scarce issue, fancy serial, star note, or genuine error. Only after that should you research value.",
    },
    { h: "95. THREE LEVELS OF FINDS",
      t: "Use three mental buckets while sorting. LEVEL A - STOP IMMEDIATELY: Set the note aside and do not spend it if you find: LEVEL B - PULL AND RESEARCH: Set aside: LEVEL C - KEEP ONLY IF YOU COLLECT THEM: These include: The purpose of this three-level system is to prevent a beginner from filling an entire box with notes that have little collector demand.",
      l: [
        "A genuine serial-number mismatch",
        "A major printing error",
        "A large-size note",
        "A Demand Note",
        "A National Bank Note",
        "A Gold Certificate",
        "An early Silver Certificate",
        "An early United States Note",
        "A high-denomination note",
        "A note that appears to be a major rarity",
        "A suspected counterfeit",
        "A note with an unusual production feature you cannot explain",
        "Star notes",
        "Older \\$2 notes",
        "1935 and 1957 Silver Certificates",
        "Older red-seal notes",
        "Fancy serial numbers",
        "Very low serial numbers",
        "Interesting signature combinations",
        "Crisp older notes",
        "Unusual seals",
        "Dramatic cutting or alignment abnormalities",
        "Older Federal Reserve Notes",
        "Notes with unusual district combinations",
        "Mildly interesting serial numbers",
        "Common star notes",
        "Ordinary circulated \\$2 notes",
        "Common older-design Federal Reserve Notes",
        "Personal-date serial numbers",
        "Minor printing variations",
        "Slightly uneven margins",
      ],
    },
    { h: "96. THE \\$1 NOTE - DETAILED HUNTING GUIDE",
      t: "The \\$1 is the most practical denomination for everyday hunting because enormous numbers circulate. Highest-priority \\$1 finds: Pull and research: Important \\$1 distinction: A modern \\$1 Federal Reserve Note normally has: Example: B12345678C The first letter identifies the Federal Reserve Bank. Do not apply the modern \\$5-and-higher two-letter-prefix rule to the \\$1. \\$1 Silver Certificates: The most common examples encountered by modern collectors are 1935 and 1957 series notes. Common does not mean worthless, but common circulated examples should not automatically be treated as rare notes. Check: Barr notes: Series 1963B \\$1 Federal Reserve Notes bearing Joseph W. Barr’s signature are a famous collectible signature combination. Do not identify a Barr note from the series alone. **Look at the actual Secretary of the Treasury signature.**",
      l: [
        "1935-series Silver Certificates",
        "1957-series Silver Certificates",
        "Star notes",
        "Barr signature notes",
        "Very low serial numbers",
        "Solid serial numbers",
        "True radars",
        "True repeaters",
        "True ladders",
        "Major serial-number errors",
        "Major printing errors",
        "Older large-size \\$1 notes",
        "One letter",
        "Eight digits",
        "One suffix letter or star",
        "Series",
        "Signature combination",
        "Serial number",
        "Star",
        "Condition",
        "Variety",
        "Any unusual production characteristic",
      ],
    },
    { h: "97. THE \\$2 NOTE - DETAILED HUNTING GUIDE",
      t: "The \\$2 denomination is one of the best beginner hunting areas because many people overlook it. Pull immediately: Modern \\$2: The current \\$2 design dates to the Federal Reserve Note reintroduction in 1976. A 1976 \\$2 is not automatically rare. Check: Common mistake: Do not assume that every red-seal \\$2 is a major rarity. Red seal identifies an issue family; the exact series and variety still matter.",
      l: [
        "Large-size \\$2 notes",
        "1928-series red-seal notes",
        "1953-series red-seal notes",
        "1963-series red-seal notes",
        "Star notes",
        "Very low serial numbers",
        "Fancy serial numbers",
        "Major errors",
        "Extremely crisp older examples",
        "Series",
        "District",
        "Serial number",
        "Star",
        "Condition",
        "Error",
      ],
    },
    { h: "98. THE \\$5 NOTE - DETAILED HUNTING GUIDE",
      t: "Pull and research: Modern \\$5 milestones: Useful design checkpoints include: The 1990 security-thread/microprinting milestone is especially useful when learning modern currency evolution.",
      l: [
        "1914 and other large-size Federal Reserve Notes",
        "Large-size United States Notes",
        "Silver Certificates",
        "Star notes",
        "Fancy serials",
        "Low serials",
        "Major errors",
        "Scarce signature combinations",
        "Very high-grade older notes",
        "1914--1990 style",
        "1990--1993 style",
        "1993--2000 style",
        "2000--2008 style",
        "2008--present style",
      ],
    },
    { h: "99. THE \\$10 NOTE - DETAILED HUNTING GUIDE",
      t: "Pull and research: Modern \\$10 checkpoints: Learn the visual differences among: The security-thread and microprinting transition makes 1990s \\$10 notes particularly useful for learning production changes.",
      l: [
        "Large-size notes",
        "Gold Certificates",
        "Silver Certificates",
        "United States Notes",
        "Federal Reserve Bank Notes",
        "Early Federal Reserve Notes",
        "Star notes",
        "Fancy serials",
        "Major errors",
        "Scarce signature combinations",
        "1914--1990",
        "1990--2000",
        "2000--2006",
        "2006--present",
      ],
    },
    { h: "100. THE \\$20 NOTE - DETAILED HUNTING GUIDE",
      t: "Pull and research: Modern \\$20 checkpoints: Learn: The 2003 redesign introduced additional security features and is an important visual breakpoint.",
      l: [
        "Large-size notes",
        "Gold Certificates",
        "Silver Certificates",
        "United States Notes",
        "Federal Reserve Bank Notes",
        "Early Federal Reserve Notes",
        "Star notes",
        "Fancy serials",
        "Major errors",
        "Scarce signature combinations",
        "1914--1990",
        "1990--1998",
        "1998--2003",
        "2003--present",
      ],
    },
    { h: "101. THE \\$50 NOTE - DETAILED HUNTING GUIDE",
      t: "The \\$50 is less common in casual roll hunting than the \\$1, \\$5, \\$10, or \\$20, but every older example deserves attention. Pull: Modern checkpoints include:",
      l: [
        "Large-size notes",
        "Gold Certificates",
        "Early Federal Reserve Notes",
        "Star notes",
        "Fancy serials",
        "Major errors",
        "Scarce signatures",
        "Very high-grade examples",
        "1914--1990",
        "1990s redesign",
        "1997 redesign",
        "2004 redesign",
      ],
    },
    { h: "102. THE \\$100 NOTE - DETAILED HUNTING GUIDE",
      t: "The \\$100 is one of the most historically diverse denominations. Pull and research: Security-feature milestone: Series 1990 \\$100 notes were the first U.S. notes to receive the new security thread and microprinting features introduced in that period. Modern \\$100 design checkpoints include:",
      l: [
        "Large-size notes",
        "Gold Certificates",
        "Silver Certificates",
        "United States Notes",
        "Early Federal Reserve Notes",
        "1914 Federal Reserve Notes",
        "1918 Federal Reserve Notes",
        "1928 and later issues",
        "Star notes",
        "Fancy serials",
        "Major errors",
        "Scarce signatures",
        "1914--1990",
        "1990--1996",
        "1996--2013",
        "2013--present",
      ],
    },
    { h: "103. LARGE-SIZE NOTES - MASTER PULL LIST",
      t: "Large-size currency is generally recognizable immediately because it is physically larger than modern notes. Approximate dimensions: Large size: 7.375 × 3.125 inches Small size: 6.14 × 2.61 inches If a note is substantially larger than a modern bill, stop and identify it before doing anything else. Large-size note families worth learning: Large-size currency is a field of its own. Exact type, Friedberg number, signatures, seal, district, and condition are often necessary for attribution.",
      l: [
        "United States Notes",
        "Silver Certificates",
        "Gold Certificates",
        "Treasury Notes / Treasury Coin Notes",
        "Federal Reserve Notes",
        "Federal Reserve Bank Notes",
        "National Bank Notes",
        "Demand Notes",
        "Fractional Currency",
      ],
    },
    { h: "104. CERTIFICATE IDENTIFICATION - DO NOT STOP AT THE SEAL",
      t: "Seal color is a clue, not a complete identification. Blue seal: Often associated with Silver Certificates. But: Blue seal alone does not tell you the exact value or rarity. Gold/orange seal: Often associated with Gold Certificates. Again: Identify the exact issue. Red seal: Often associated with United States Notes / Legal Tender Notes. Again: Identify the exact series. Green seal: Commonly associated with Federal Reserve Notes. The green seal by itself does not make a note common or rare.",
    },
    { h: "105. FRIEDBERG NUMBERS - WHY ADVANCED COLLECTORS USE THEM",
      t: "Collectors and dealers frequently use Friedberg numbers, usually written as Fr. followed by a number, to identify specific U.S. paper-money varieties. Example format: Fr. 236 A Friedberg number can distinguish varieties that share the same general series and denomination. When researching a potentially valuable note, record: Do not guess a Friedberg number from memory. Use a current specialized catalog or trusted attribution source.",
      l: [
        "Denomination",
        "Series",
        "Note type",
        "Friedberg number if known",
        "Signature combination",
        "Federal Reserve district",
        "Serial number",
        "Star status",
        "Condition",
        "Error or variety",
      ],
    },
    { h: "106. SIGNATURES - BUILD YOUR OWN REFERENCE SYSTEM",
      t: "Do not attempt to memorize every signature combination at once. Instead, build a table for each denomination. Denomination Series Secretary Treasurer District Star? Notes ------ --- ----- ----- ---- --- --- \\$1 \\$2 \\$5 \\$10 \\$20 \\$50 \\$100 Signature-hunting strategy: When you find an older note: Series → Secretary → Treasurer → District → Serial range → Condition Then research the exact combination. This is much safer than relying on a list of \"old-looking signatures.\"",
    },
    { h: "107. FEDERAL RESERVE DISTRICT IDENTIFICATION",
      t: "There are 12 Federal Reserve Banks. Letter Bank ---- ----- A Boston B New York C Philadelphia D Cleveland E Richmond F Atlanta G Chicago H St. Louis I Minneapolis J Kansas City K Dallas L San Francisco Modern \\$5--\\$100 notes: The second serial-number letter identifies the issuing Federal Reserve Bank. The note also has a Federal Reserve indicator such as: A1 B2 C3 and so on. These two systems should agree. \\$1 and \\$2: The serial-number system is different. Do not use the \\$5--\\$100 two-letter-prefix rule on these denominations.",
    },
    { h: "108. SERIAL-NUMBER PATTERN SCORECARD",
      t: "Instead of treating every \"cool number\" equally, classify it. Tier 1 - Strong: Tier 2 - Good: Tier 3 - Interesting: Important: This is a hunting priority system, not a price guide. The market may value two apparently similar serial numbers very differently.",
      l: [
        "00000001",
        "00000002",
        "00000003",
        "00000007",
        "11111111",
        "22222222",
        "33333333",
        "12345678",
        "87654321",
        "Strong true radar",
        "Strong true repeater",
        "Major serial-number error",
        "00000010",
        "00000100",
        "00001000",
        "10101010",
        "12121212",
        "12341234",
        "11223344",
        "Strong birthday",
        "Seven-of-a-kind",
        "Strong year pattern",
        "Partial ladder",
        "Near solid",
        "Weak repeater",
        "Personal date",
        "Recognizable year",
        "Mild repeated pairs",
      ],
    },
    { h: "109. SERIAL NUMBERS THAT BEGIN WITH ZERO",
      t: "Leading zeroes are important. Treat: 00001234 as an eight-digit serial number. Do not rewrite it as: 1234 When recording a note, preserve every digit exactly as printed.",
    },
    { h: "110. SERIAL-NUMBER ERROR TRIAGE",
      t: "If the two serial numbers do not match: Step 1: Photograph both. Step 2: Check whether one is actually a star replacement. Step 3: Compare the complete serials, including letters. Step 4: Check the note’s denomination and series. Step 5: Do not alter the note. Step 6: Seek specialist attribution. A genuine mismatched serial-number error can be substantially more important than an ordinary fancy serial.",
    },
    { h: "111. ERROR OR DAMAGE?",
      t: "This is one of the most important skills in paper-money collecting. More likely to be a production error: More likely to be damage: The test: Ask: **Can the strange feature be explained by something that happened after the note left the printing process?** If yes, be cautious about calling it an error.",
      l: [
        "Printing clearly missing where it should exist",
        "A fold that caused a displaced print impression",
        "Dramatic cutting that exposes neighboring-note design",
        "Genuine offset transfer",
        "Clearly doubled or misplaced printing",
        "Serial-number mismatch produced during printing",
        "Major misregistration",
        "Missing design components",
        "Ink rubbed off by handling",
        "Chemical bleaching",
        "Writing",
        "Tape residue",
        "Glue",
        "Tears",
        "Artificial folds",
        "Washed paper",
        "Trimmed edges",
        "Stains caused after printing",
      ],
    },
    { h: "112. CUTTING-ERROR CHECK",
      t: "A genuine cutting error is not simply a note with a crooked-looking edge. Look for evidence that the note was cut incorrectly relative to the original sheet layout. Strong clues include: Minor unevenness should not automatically be called an error.",
      l: [
        "Part of a neighboring note’s design",
        "Dramatically abnormal margins",
        "Design elements cut into the border",
        "A clearly displaced cut line",
        "A combination of unusual margins and neighboring-note evidence",
      ],
    },
    { h: "113. OFFSET ERROR CHECK",
      t: "A suspected offset should be evaluated for: process Random stains, fingerprints, ink from another object, and chemical marks are not automatically offsets.",
      l: [
        "Mirrored appearance",
        "Correct ink color",
        "Corresponding design shapes",
        "Appropriate placement",
        "Evidence that the transferred ink originated from the printing",
      ],
    },
    { h: "114. FOLDOVER ERROR CHECK",
      t: "A true foldover error should show evidence that the paper was folded when printing occurred. Look for: print An ordinary crease acquired during circulation is not a foldover error.",
      l: [
        "Missing design where the fold blocked the impression",
        "Printing transferred onto the folded portion",
        "An abnormal margin caused by the folded sheet",
        "A consistent relationship between the fold and the displaced/missing",
      ],
    },
    { h: "115. STAR-NOTE HUNTING - A BETTER METHOD",
      t: "Do not simply collect every star note and assume they are rare. Record: Star + fancy serial: A star note with a strong fancy serial deserves extra attention. Star + error: A genuine production error combined with a star replacement feature may deserve specialist attribution.",
      l: [
        "Denomination",
        "Series",
        "District",
        "Serial range",
        "Star suffix",
        "Condition",
        "Whether the run appears limited",
        "Whether the note has another desirable feature",
      ],
    },
    { h: "116. CONDITION - A MORE PRACTICAL APPROACH",
      t: "For hunting purposes, ask these questions: Are there folds?: Count and inspect them. Are there corner bends?: A bent corner may affect grade. Are there tears?: Record location and size. Are there stains?: Do not clean them. Is the paper crisp?: Crispness can matter greatly for collectible notes. Is there writing?: Writing generally affects desirability. Are there pinholes?: Especially important on older notes. Has the note been repaired?: Tape, glue, pressing, trimming, and other repairs can materially affect collector value.",
    },
    { h: "117. STORAGE - FIELD-READY SYSTEM",
      t: "For notes you intend to keep: Label each holder: Write the identification on the holder or a separate inventory record rather than writing on the currency. Recommended label: $1 - Series 1957 - Silver Certificate - Star - Serial XXXXXXXX - Condition: circulated",
      l: [
        "Use archival-quality currency holders",
        "Avoid PVC",
        "Keep notes flat",
        "Keep them away from direct sunlight",
        "Avoid excessive humidity",
        "Avoid adhesives",
        "Avoid rubber bands",
        "Avoid paper clips",
        "Avoid tape",
        "Avoid lamination",
      ],
    },
    { h: "118. YOUR PAPER-MONEY INVENTORY DATABASE",
      t: "For serious hunting, create a spreadsheet with these columns: Field What to record ------- ----------- Inventory ID Your own identifier Denomination \\$1, \\$2, etc. Note type FRN, SC, USN, etc. Series Exact series Fr. number If known Secretary Exact name Treasurer Exact name District FRB Serial #1 Complete Serial #2 Complete Star Yes/No Serial pattern Radar, repeater, etc. Seal Color/type Error Description Condition Your preliminary assessment Source Catalog/reference used Purchase/source Bank, roll, estate, etc. Cost basis Optional Photos File name Authentication Yes/No Notes Anything unusual This turns casual hunting into a searchable collection.",
    },
    { h: "119. PHOTOGRAPHING NOTES FOR RESEARCH",
      t: "Take photographs in this order: Use even lighting and avoid glare. Do not write directly on the note to identify it.",
      l: [
        "Full front",
        "Full back",
        "Left serial",
        "Right serial",
        "Treasury seal",
        "Federal Reserve seal/indicator",
        "Series year",
        "Signatures",
        "Error area",
        "Edges",
        "Corners",
        "Any unusual markings",
      ],
    },
    { h: "120. WHEN TO USE PROFESSIONAL GRADING",
      t: "Consider professional authentication/grading when: Do not spend large amounts on grading simply because a note is old.",
      l: [
        "The note appears rare",
        "The note may have a major error",
        "The note is an expensive historical issue",
        "Authenticity is uncertain",
        "Condition is important to value",
        "You are preparing to sell a significant note",
        "A dealer or buyer questions authenticity",
        "The note appears dramatically different from normal examples",
      ],
    },
    { h: "121. AUTHENTICATION BEFORE VALUE",
      t: "Use this sequence: AUTHENTIC? ↓ WHAT TYPE? ↓ WHAT SERIES? ↓ WHAT VARIETY? ↓ WHAT FRIEDBERG NUMBER? ↓ WHAT SIGNATURE COMBINATION? ↓ WHAT DISTRICT? ↓ WHAT SERIAL? ↓ WHAT CONDITION? ↓ ERROR OR VARIETY? ↓ WHAT IS THE MARKET? This order prevents one of the most common collecting mistakes: looking at an asking price before knowing exactly what the note is.",
    },
    { h: "122. MARKET-PRICE WARNING",
      t: "Online marketplace asking prices are not the same thing as realized prices. When researching value, distinguish: For serious notes, prioritize documented sales and recognized numismatic references.",
      l: [
        "Asking price",
        "Sold price",
        "Auction realization",
        "Dealer offer",
        "Insurance value",
        "Catalog estimate",
      ],
    },
    { h: "123. COMMON BEGINNER MISTAKES",
      t: "Mistake 1: \"It’s old, so it is valuable.\": Not necessarily. Mistake 2: \"It’s a star, so it is rare.\": Not necessarily. Mistake 3: \"It has a cool serial, so it is worth hundreds.\": Not necessarily. Mistake 4: \"Blue seal means rare.\": No. Mistake 5: \"Red seal means rare.\": No. Mistake 6: \"The margin is crooked, so it is an error.\": Not necessarily. Mistake 7: \"The note looks different, so it is an error.\": Compare it with normal production examples. Mistake 8: \"I can clean it.\": Do not. Mistake 9: \"I found the value on eBay.\": Check completed sales and specialized references. Mistake 10: \"I only need the serial number.\": You need the entire note attribution.",
    },
    { h: "124. THE 10-SECOND BANK-TELLER CHECK",
      t: "When receiving a note in everyday circulation: Look at the front: Flip it: If anything is unusual: Pull it. Research later.",
      l: [
        "Denomination",
        "Series",
        "Serial",
        "Star",
        "Seal",
        "Signatures",
        "Design",
        "Major printing abnormality",
        "Cutting abnormality",
        "Missing print",
      ],
    },
    { h: "125. THE 60-SECOND ADVANCED CHECK",
      t: "If a note passes the first screen:",
      l: [
        "Identify type.",
        "Confirm denomination.",
        "Confirm series.",
        "Read both serials.",
        "Check star.",
        "Identify Federal Reserve district.",
        "Read signatures.",
        "Check seal.",
        "Check serial pattern.",
        "Inspect printing.",
        "Inspect margins.",
        "Inspect condition.",
        "Photograph it.",
        "Record it.",
        "Research exact variety.",
      ],
    },
    { h: "126. THE \"DO NOT SPEND\" MASTER LIST",
      t: "Do not casually spend a note that is:",
      l: [
        "Pre-1929 large size",
        "A Demand Note",
        "A National Bank Note",
        "A Gold Certificate",
        "An early Silver Certificate",
        "An early United States Note",
        "A Federal Reserve Bank Note",
        "A high denomination",
        "A suspected major error",
        "A mismatched-serial note",
        "A major fancy serial",
        "An unusually low serial",
        "A scarce-looking star note",
        "A note with an unusual signature combination",
        "A note whose authenticity is uncertain",
      ],
    },
    { h: "127. HISTORICAL CURRENCY ISSUE FAMILIES",
      t: "The major federal issue families include: Issue Approximate period ---------- --------- Demand Notes 1861--1862 United States Notes 1862--1994 issue family Fractional Currency 1862--1876 National Bank Notes 1863--1938 Gold Certificates 1865--1936 Silver Certificates 1878--1965 Treasury Coin Notes 1890--1899 Federal Reserve Notes 1914--present Federal Reserve Bank Notes 1915--1945 These dates identify broad issue families. They do not replace exact series and variety attribution.",
    },
    { h: "128. IMPORTANT: \"LEGAL TENDER\" IS NOT A COLLECTOR-GRADE DESCRIPTION",
      t: "\"Legal tender\" describes a legal status, not a rarity level. A note can be: Do not use legal-tender status as a substitute for identification.",
      l: [
        "Legal tender and common",
        "Legal tender and scarce",
        "Legal tender and historically important",
        "Legal tender and extremely rare",
      ],
    },
    { h: "129. IMPORTANT: \"STAR NOTE\" IS NOT A VALUE CATEGORY",
      t: "A star tells you something about the production/replacement process. It does not by itself tell you: Always identify the exact issue.",
      l: [
        "How rare the note is",
        "How valuable it is",
        "How many survive",
        "What grade it deserves",
      ],
    },
    { h: "130. IMPORTANT: \"ERROR\" IS NOT A VALUE CATEGORY",
      t: "A genuine error can range from minor to spectacular. Ask:",
      l: [
        "What printing operation produced the error?",
        "How dramatic is it?",
        "Is it unquestionably genuine?",
        "How many examples are known?",
        "Does the error affect an important design element?",
        "Is the note otherwise desirable?",
        "What condition is it in?",
      ],
    },
    { h: "131. SPECIALIST TERMS WORTH LEARNING",
      t: "As you progress, learn: The more of this vocabulary you understand, the easier it becomes to research a note accurately.",
      l: [
        "Friedberg number / Fr. number",
        "Mule",
        "Overprint",
        "Misalignment",
        "Misregistration",
        "Offset",
        "Foldover",
        "Obstruction",
        "Missing print",
        "Cutting error",
        "Serial-number error",
        "Star replacement",
        "Plate position",
        "Face plate",
        "Back plate",
        "Treasury seal",
        "Federal Reserve seal",
        "Signature combination",
        "Large size",
        "Small size",
        "Legal Tender / United States Note",
        "National Bank Note",
        "Federal Reserve Bank Note",
        "Federal Reserve Note",
        "Silver Certificate",
        "Gold Certificate",
        "Treasury Note",
        "Fractional Currency",
      ],
    },
    { h: "132. RESEARCH SOURCES - PRIORITY ORDER",
      t: "For identification: U.S. Currency Education Program: Use it for: Bureau of Engraving and Printing: Use it for: Specialized numismatic catalogs: Use them for: Professional grading services: Use them for: Auction archives: Use realized sales to understand the market. Marketplace listings: Use cautiously. An unsold asking price is not proof of market value.",
      l: [
        "Current designs",
        "Security features",
        "Historical timeline",
        "Serial-number basics",
        "Denomination information",
        "Production information",
        "Historical currency",
        "Serial numbers",
        "Printing facilities",
        "Currency issue history",
        "Friedberg numbers",
        "Signature varieties",
        "Serial ranges",
        "Detailed issue attribution",
        "Authentication information",
        "Population data",
        "Certified examples",
        "Error attribution",
        "Market research",
      ],
    },
    { h: "133. MASTER RESEARCH CARD",
      t: "Copy this for every interesting note: ``` text PAPER MONEY RESEARCH CARD Denomination: Note type: Series: Friedberg number: Secretary: Treasurer: Federal Reserve district: Federal Reserve indicator: Serial #1: Serial #2: Star: Serial pattern: Seal: Large or small size: Printing facility, if identifiable: Error/variety: Condition: Repairs/damage: Authentication: Reference #1: Reference #2: Comparable sales: Estimated market range: Final identification: ```",
    },
    { h: "134. FINAL ADVANCED RULE",
      t: "When you find an unusual note, do not ask: \"How much is this worth?\" Ask: \"Exactly what is this?\" That question leads to: **Type → Series → Variety → Signatures → District → Serial → Condition → Error → Authentication → Market** That is the workflow that separates casual \"old money\" hunting from serious U.S. paper-money collecting.",
    },
    { h: "135. CURRENT OFFICIAL REFERENCE CHECKPOINT",
      t: "The U.S. Currency Education Program currently identifies seven circulating Federal Reserve denominations: It also provides denomination-specific history and authentication guidance. For current serial-number rules, remember: prefix before the eight digits. the second identifies the issuing Federal Reserve Bank. Always verify unusual notes against current official and specialized references rather than relying on an old checklist.",
      l: [
        "\\$1",
        "\\$2",
        "\\$5",
        "\\$10",
        "\\$20",
        "\\$50",
        "\\$100",
        "\\$1 and \\$2 retain the one-letter/eight-digit/letter-or-star format.",
        "Modern \\$5 through \\$100 Federal Reserve Notes use a two-letter",
        "On those modern notes, the first letter relates to the series and",
        "The final letter may be replaced by a star for a replacement note.",
      ],
    },
    { h: "136. MASTER POCKET CHECKLIST",
      t: "``` text PAPER MONEY HUNT [ ] Old? [ ] Large size? [ ] $2? [ ] Blue seal? [ ] Red seal? [ ] Gold/orange seal? [ ] Silver Certificate? [ ] Gold Certificate? [ ] United States Note? [ ] National Bank Note? [ ] Federal Reserve Bank Note? [ ] Star? [ ] Low serial? [ ] Solid? [ ] Near solid? [ ] Radar? [ ] Repeater? [ ] Ladder? [ ] Binary? [ ] Birthday? [ ] Year? [ ] Seven-of-a-kind? [ ] Serial mismatch? [ ] Missing print? [ ] Offset? [ ] Foldover? [ ] Cutting error? [ ] Seal error? [ ] Misregistration? [ ] Major ink error? [ ] Unusual signatures? [ ] Unusual district? [ ] Crisp/high grade? [ ] Photograph taken? [ ] Research completed? ```",
    },
    { h: "137. EDITORIAL NOTE FOR FUTURE EXPANSION",
      t: "This guide is intentionally a field guide, not a complete Friedberg catalog. A truly exhaustive U.S. paper-money catalog would require denomination-by-denomination tables containing every major series, signature combination, district, star variety, Friedberg number, print range, and known error. The best way to build that material is as a separate reference section so that the hunting guide remains usable in the field while the catalog remains searchable and updateable.",
    },
    { h: "138. SOURCE AND VERIFICATION NOTES",
      t: "The expanded material was checked against current U.S. government currency information, including the U.S. Currency Education Program and the Bureau of Engraving and Printing, with particular attention to serial-number rules, historical issue families, denomination histories, and authentication features. Particular attention was given to: Where collector terminology is subjective, this guide deliberately uses language such as \"interesting,\" \"desirable,\" \"pull and research,\" and \"may be collectible\" rather than assigning unsupported dollar values. For exact variety attribution, use a current specialized U.S. paper-money catalog and, when appropriate, professional authentication/grading.",
      l: [
        "Current circulating denominations",
        "Serial-number structure",
        "Federal Reserve district identification",
        "Star/replacement notes",
        "1929 large-size/small-size transition",
        "Historical currency issue families",
        "Security-thread and microprinting milestones",
        "\\$2 reintroduction",
        "High-denomination note history",
        "Gold Certificate and Silver Certificate history",
        "Modern denomination design checkpoints",
      ],
    },
];

const STORIES_SECTIONS = [
    { h: "Famous Coin Stories: Incredible Tales from American Numismatics",
      t: "Welcome to the secret history of American money\\! Behind pocket change and rare museum artifacts lie forgotten crimes, wartime compromises, midnight capers, and mechanical mishaps. These stories are curated to be fun, factual, and easy to explore on any mobile screen.",
    },
    { h: "1. The 1933 Double Eagle: The Great Gold Heist & Courtroom Drama",
      l: [
        "The Backstory: In 1933, amidst the depths of the Great Depression, President Franklin D. Roosevelt signed Executive Order 6102, taking the United States off the domestic gold standard and recalling gold coinage1. Before the order went into effect, the Philadelphia Mint had already produced 445,500 brand-new \\$20 Saint-Gaudens Double Eagles1. The entire mintage was ordered melted down into gold bars, with two specimens officially preserved for the Smithsonian Institution1.",
        "The Smuggling Operation: Around twenty coins vanished before reaching the furnace, likely assisted by a corrupt mint cashier1. Local Philadelphia jeweler Israel Switt quietly bought and dispersed them to elite collectors2. In 1944, after one appeared in an auction, the Secret Service launched a manhunt and confiscated several1. However, King Farouk of Egypt legally obtained an export license due to a clerical mistake by the U.S. State Department just before the Secret Service intervened1. When the King was deposed in 1952, the coin disappeared into the criminal underworld1.",
        "The Waldorf Astoria Sting: In 1996, British dealer Stephen Fenton brought Farouk’s coin to New York to sell it, walking right into an undercover Secret Service sting at the Waldorf Astoria Hotel1. The coin was locked in a federal vault at 7 World Trade Center1. In July 2001-just two months before 9/11-the government reached a settlement with Fenton and transferred the coin to Fort Knox1. In 2002, the coin was officially auctioned at Sotheby’s for \\$7.59 million, split evenly between Fenton and the U.S. Treasury1. In 2021, that same specimen sold for an eye-watering \\$18.9 million, making it the most expensive coin on Earth1.",
        "The Safe-Deposit Box Twist: In 2003, Israel Switt’s daughter, Joan Langbord, drilled open an old family safe-deposit box and discovered ten more 1933 Double Eagles2\\! When her family submitted them to the U.S. Mint for authentication in 2004, the Secret Service promptly seized every single one2. A grueling decade-long legal battle ensued2. In 2016, a federal appeals court ruled definitively that because no 1933 Double Eagles were ever legally issued into circulation, they remain stolen government property4. All ten remain permanently locked away in Fort Knox1.",
      ],
    },
    { h: "2. The \"Granite Lady\" Cornerstone: The Ghost Coins of San Francisco",
      l: [
        "The Dedication: In May 1870, construction began on the second San Francisco Mint-an imposing neoclassical fortress that earned the nickname \"The Granite Lady\"6. For the dedication ceremony on May 25, 1870, officials decided to bury a time capsule inside the building’s cornerstone containing one specimen of every coin produced by the San Francisco branch that year7.",
        "The Missing Denominations: The San Francisco Mint had not scheduled production for several denominations in 1870: the half dime, the three-dollar gold piece, the silver dollar, and the quarter8. To ensure the time capsule set was complete, officials used Philadelphia dies to strike a single specimen of each missing denomination strictly for the cornerstone8.",
        "The Chicago Coin Shop Surprise: For over a century, official records showed zero 1870-S half dimes minted, and everyone assumed the cornerstone coin was the only one in existence8. Then, in 1978, a patron walked into a suburban coin shop in Orland Park, Illinois, with a small box of family coins9. Inside was an authentic 1870-S half dime-proving a mint coiner had secretly struck at least one extra before defacing the dies6\\! That unique collectible specimen sold at auction in 2023 for \\$3.12 million9.",
        "The Unopened Vault: A matching second 1870-S \\$3 gold piece also escaped (selling for \\$5.52 million in 2023\\)10, while roughly nine 1870-S silver dollars are known to exist12. However, to this day, no collectible 1870-S quarter has ever been seen13. The cornerstone itself was never removed during the 1906 earthquake or later restorations, meaning that the world’s only 1870-S quarter is still entombed somewhere inside the Granite Lady’s foundation7.",
      ],
    },
    { h: "3. The 2000 \"Cheerios Dollar\": Cereal Box Gold",
      l: [
        "The Breakfast Promotion: In January 2000, General Mills partnered with the U.S. Mint to promote the newly minted Sacagawea \"Golden Dollar\"15. Exactly 5,500 coins were tucked into random boxes of Cheerios (roughly one in every 2,000 specially marked boxes)15.",
        "Spent on Candy: Packaged in simple plastic cards, most families thought they were regular \\$1 coins15. Millions of kids ripped open the plastic and spent their dollars on candy or vending machine sodas15.",
        "The Discovery: In 2005, a coin collector examined a preserved Cheerios dollar under magnification and noticed distinctive, sharp details on the eagle’s tail feathers on the reverse side-including raised central shafts and crisp internal veins17.",
        "The Prototype Die: It turned out that the Mint had supplied General Mills with coins struck using early prototype dies16. Before launching general circulation production, the Mint smoothed out the eagle’s tail feathers to improve die longevity17. Today, while a normal 2000 Sacagawea dollar is worth face value, an authentic \"Cheerios Dollar\" with enhanced tail feathers commands between \\$2,000 and \\$10,000+15.",
      ],
    },
    { h: "4. The 1883 \"Racketeer\" Nickel: Josh Tatum’s Silent Scam",
      l: [
        "The Mistake: In 1883, the U.S. Mint introduced the \"Liberty Head\" nickel. The reverse showed a large Roman numeral \"V\" surrounded by a wreath, but nowhere did it say the word \"CENTS.\"",
        "The Scam: The new nickel happened to match the exact diameter and thickness of the genuine \\$5 Gold Half Eagle. Enter Josh Tatum, a clever hustler who gold-plated the new nickels and took them on a spending tour. He would buy a five-cent cigar, place the gold-plated coin on the counter, and wait. Because Tatum was deaf and mute, he never uttered a single word. Cashiers simply assumed it was a \\$5 gold piece and handed him \\$4.95 in real silver change.",
        "The Verdict: When Tatum was eventually arrested, his defense attorney argued that his client had never claimed the coin was worth five dollars-he simply paid for his items and accepted whatever change clerks chose to give him\\! Legend says he walked free. The Mint hastily added the word \"CENTS\" to the reverse later that year.",
      ],
    },
    { h: "5. The 1913 Liberty Head Nickel: Midnight Strikes and the Car Crash Mystery",
      l: [
        "The Secret Strike: In 1913, the Liberty Head design was officially replaced by the Buffalo nickel. Yet, five Liberty Head nickels dated 1913 were struck under mysterious circumstances at the Philadelphia Mint. Former Mint employee Samuel Brown later surfaced with all five, placing newspaper ads offering to buy them-likely a clever cover story to \"legitimize\" coins he had secretly struck himself before leaving government employment.",
        "The Car Crash: In 1962, North Carolina collector George Walton was driving to a coin exhibition with his prized 1913 Liberty Head nickel in his pocket when he was killed in a car crash. The coin was recovered from the wreckage, but an appraiser mistakenly declared it an altered fake. Walton’s sister tucked the \"worthless\" coin inside an envelope in her closet, where it sat forgotten for over forty years.",
        "The Reunion: In 2003, the American Numismatic Association brought the four known authentic 1913 nickels together for an exhibition and offered a bounty to find Walton’s missing fifth coin. Walton’s heirs brought the closet coin in, and a panel of six world experts authenticated it under museum lamps. In 2013, that long-lost nickel sold at auction for over \\$3.1 million.",
      ],
    },
    { h: "6. The 1894-S Barber Dime: The Three-Cent Dish of Ice Cream",
      l: [
        "The Rarity: Only 24 Barber dimes were struck at the San Francisco Mint in 1894, making it one of the premier rarities in world coinage.",
        "The Legend: Mint Superintendent John Daggett reportedly struck the tiny run for banking associates to balance a ledger discrepancy. Daggett gave three of the proof dimes to his young daughter, Hallie, telling her to put them in a safe place until she grew up.",
        "The Treat: On her walk home from the mint, young Hallie couldn’t resist a temptation: she stopped by a sweet shop and spent one of the ultra-rare dimes on a dish of ice cream\\! She kept the other two and sold them decades later to a prominent dealer. Today, only nine 1894-S dimes are known to survive, each worth up to \\$2 million.",
      ],
    },
    { h: "7. The 1943 Copper Lincoln Cent: The Wartime Blunder",
      l: [
        "The Change: To save essential copper for military ammunition during World War II, the U.S. Mint transitioned to zinc-coated steel blanks for pennies in 1943.",
        "The Error: A handful of bronze planchets from late 1942 remained trapped inside the hopper bins at the mint. When regular production started, these stray blanks tumbled into the presses and were struck with the 1943 date.",
        "The Magnet Test: Only about 20 to 40 genuine 1943 copper pennies exist. Because copper-plated steel cents are common counterfeits, collectors test them with an ordinary refrigerator magnet. If the penny sticks to the magnet, it is an altered steel penny. If it doesn’t stick, it could be a life-changing rarity worth \\$100,000 to over \\$1,000,000.",
      ],
    },
    { h: "8. The 1974 Aluminum Cent: The Lightweight Penny",
      l: [
        "The Experiment: In late 1973, surging copper prices pushed the raw metal cost of a cent past its face value. The Philadelphia Mint experimented with aluminum, striking roughly 1.5 million trial cents dated 1974.",
        "The Rejection: The Mint distributed dozens of sample coins to members of Congress. However, vending machine operators strongly protested because the lightweight metal jammed coin mechanisms, and pediatric radiologists worried that swallowed aluminum pennies would not show up clearly on pediatric X-rays.",
        "The Recall: The program was canceled, and all specimens were ordered destroyed. Several dozen disappeared. One was given to Capitol Police officer Albert Toven after an official dropped it on the floor, and another Denver Mint specimen surfaced in 2014 before being surrendered to the government following a legal dispute. Owning an aluminum penny is illegal, as the federal government considers them unreleased property.",
      ],
    },
    { h: "9. The 1982 Penny Metamorphosis: Copper vs. Zinc",
      l: [
        "The Transition: In 1982, rising copper costs forced the Mint to permanently replace the historic 95% copper alloy with a core of 99.2% zinc, thinly electroplated with copper.",
        "The Seven Varieties: Because the Mint changed both the alloy and the font of the date (\"Large Date\" vs. \"Small Date\") across two mint facilities (Philadelphia and Denver), seven distinct varieties entered general circulation. Copper cents weigh 3.1 grams, while zinc cents weigh 2.5 grams.",
        "The 1982-D Small Date Copper: By the time the Denver Mint switched to the more delicate \"Small Date\" die, it was supposed to be minting zinc cents exclusively. In 2016, an eagle-eyed collector discovered a 1982-D Small Date that weighed 3.1 grams-an impossible transitional copper error\\! Only two examples are known, with one fetching \\$18,800 at auction.",
      ],
    },
    { h: "10. The 2007 \"Godless\" Dollars: The Missing Edge Inscription Panic",
      l: [
        "The Feature: When the Presidential \\$1 Coin series debuted in 2007, the Mint moved the date, mint mark, and statutory mottos (\"In God We Trust\" and \"E Pluribus Unum\") to the outer rim of the coin via edge lettering, clearing up room for larger presidential portraits.",
        "The Error: Striking the face and rolling the rim letters required two separate machines. Tens of thousands of George Washington dollars accidentally bypassed the lettering machine, entering circulation with completely smooth rims.",
        "The Panic: Lacking the motto, the coins were instantly branded \"Godless Dollars\" by the media. Rumors spread that the government was secretly stripping religious phrases from currency. Public outcry was so intense that Congress passed legislation mandating that \"In God We Trust\" be moved back to the face of the coin beginning in 2009.",
      ],
    },
    { h: "11. The 1804 Silver Dollar: The \"King of Coins\" Struck Thirty Years Late",
      l: [
        "The Secret: The 1804 Draped Bust Silver Dollar is universally hailed as the \"King of American Coins,\" but not a single one was struck in 1804.",
        "The Mission: In 1834, President Andrew Jackson’s administration needed prestigious diplomatic gift sets for foreign rulers, including the King of Siam and the Sultan of Muscat. Because official mint ledgers showed silver dollars had been produced in 1804, mint workers created new dies bearing that date, unaware that those early coins had actually been struck with leftover 1803 dies.",
        "The Value: Only 15 specimens across three classes exist today. Whenever an 1804 dollar comes to market, it routinely commands between \\$3 million and \\$12 million.",
      ],
    },
    { h: "12. The 1849 Double Eagle: The Giant of the California Gold Rush",
      l: [
        "The Rush: When gold was discovered at Sutter’s Mill in 1848, hundreds of thousands of miners poured into California. To absorb the colossal influx of raw gold bullion, Congress authorized the creation of the largest circulating U.S. coin: the \\$20 Double Eagle.",
        "The Survivor: Chief Engraver James B. Longacre produced two experimental patterns dated 1849. One disappeared, while the single surviving specimen was placed in the National Numismatic Collection at the Smithsonian. Because it is completely unique and represents the California Gold Rush, numismatists consider it one of the most valuable single objects in American history-often appraised well over \\$20 million.",
      ],
    },
    { h: "13. The 1921 Peace Dollar: The Midnight Scraping of the \"Broken Sword\"",
      l: [
        "The Symbol: Following the devastation of World War I, Italian-American sculptor Anthony de Francisci designed a new silver dollar featuring the goddess Liberty and a perched bald eagle gripping an olive branch and a broken sword.",
        "The Backlash: In late December 1921, just days before release, newspapers published sketches of the design. Outraged readers protested that a broken sword looked like national defeat and surrender rather than peaceful disarmament.",
        "The Midnight Surgery: With dies already prepped, Chief Engraver George Morgan spent hours under a magnifying glass with a graver, painstakingly grinding the broken sword completely off the master hub. The coins were successfully struck on New Year’s Eve 1921, showing the eagle perched solely on an olive branch.",
      ],
    },
    { h: "14. The 1787 Fugio Cent: Benjamin Franklin’s Blunt Philosophy",
      l: [
        "The First Coin: Authorized by the Congress of the Confederation, the 1787 Fugio Cent was the very first official coin issued by the United States.",
        "The Design: Designed by Benjamin Franklin, the coin avoided portraits of politicians. The obverse featured a sundial, the Latin word Fugio (\"I fly\"), and the blunt motto: \"MIND YOUR BUSINESS.\"",
        "The Meaning: In 18th-century parlance, this was not an insult; it meant \"attend diligently to your daily labor and commerce.\" Franklin’s message was that time flies quickly, so waste no time in building the young republic. The reverse displayed 13 interlocking rings labeled \"WE ARE ONE.\"",
      ],
    },
    { h: "15. The 1937-D \"Three-Legged\" Buffalo Nickel: An Over-Polished Die",
      l: [
        "The Accident: In 1937, a mint worker at the Denver Mint named Young accidentally clashed a pair of coin dies together. Attempting to repair the damaged surface, he vigorously polished the dies with an abrasive stone.",
        "The Missing Leg: In the process, he accidentally ground away the relief for the buffalo’s right front leg\\! Tens of thousands of these three-legged nickels were struck and released into circulation before the error was caught, creating an instant favorite that remains highly collectible today.",
      ],
    },
    { h: "16. The 1955 Doubled Die Cent: The Blurry Vision That Thrilled Collectors",
      l: [
        "The Double Strike: During die manufacture, the master die must be pressed into the working die multiple times. In 1955, a die shifted slightly out of alignment between presses, creating dramatic doubling of the date and the lettering \"LIBERTY\" and \"IN GOD WE TRUST.\"",
        "The Release: An estimated 40,000 cents were struck before an inspector spotted the defect. Rather than melt down the entire batch of hundreds of thousands of pennies, mint supervisors chose to release them into vending and cigarette machines across New England, creating one of the most recognizable errors in history.",
      ],
    },
    { h: "17. The 1916 Standing Liberty Quarter: The Great Armor Redesign",
      l: [
        "The Scandal: Designed by sculptor Hermon MacNeil, the 1916 Standing Liberty quarter featured an allegorical image of Lady Liberty holding a shield and an olive branch, with one breast bare in the style of classical Greek art.",
        "The Redesign: Public outcry over Liberty’s exposed bodice caused embarrassment for the Treasury. In 1917, the Mint quickly issued a revised \"Type 2\" design, clothing Liberty in a protective coat of chain mail, which also symbolized America’s entrance into World War I.",
      ],
    },
    { h: "18. Modern Pocket Change Oddities",
      l: [
        "The 2004-D Wisconsin \"Extra Leaf\" Quarter: A small tool mark or metal gouge on the die created an extra raised corn husking leaf pointing either \"High\" or \"Low\" on the ear of corn.",
        "The 2005-P \"In God We Rust\" Kansas Quarter: A build-up of grease clogged the letter \"T\" in the word \"TRUST\" on the coin die, resulting in thousands of quarters reading \"IN GOD WE RUST.\"",
        "The 2005 \"Speared Bison\" Nickel: A deep die gouge directly through the torso of the American bison makes it appear as if a spear is piercing through the animal’s back.",
        "The 2000 \"Wounded Eagle\" Sacagawea Dollar: A raised die scratch cuts across the chest of the flying eagle on the reverse.",
        "The 2009 \"Extra Thumb\" Lincoln Cent: A minor hub doubling error on the reverse of the Lincoln Bicentennial cent makes it appear as though Abraham Lincoln has an extra thumb resting on his book.",
      ],
    },
    { h: "19. The Small Dollar Saga: Susan B. Anthony to Presidential Dollars",
      t: "Works cited: 1. 1933 double eagle \\- Wikipedia, https://en.wikipedia.org/wiki/1933\\_double\\_eagle 2. The Case of the Missing Double Eagle Coins, https://pbnlaw.com/media-and-events/article/2015/06/the-case-of-the-missing-double-eagle-coins 3. Judge upholds jury verdict awarding disputed ’33 ’Double Eagle, https://www.legalnewsline.com/pennsylvania-record/judge-upholds-jury-verdict-awarding-disputed-33-double-eagle-gold-coins-to-u-s-govt/article\\_9da088d6-4f7c-5ff1-9abb-2064edefb974.html 4. Langbord v. United States Dep’t of the Treasury, No. 12-4574 (3d Cir, https://law.justia.com/cases/federal/appellate-courts/ca3/12-4574/12-4574-2016-08-01.html 5. Third Circuit Affirms United States’ Forfeiture and Ownership of, https://www.justice.gov/usao-edpa/pr/third-circuit-affirms-united-states-forfeiture-and-ownership-double-eagle-coins 6. 1870 S Seated Liberty Half Dime Unique Coin Value, Prices & Info, https://www.usacoinbook.com/coins/841/half-dimes/seated-liberty/1870-S/ 7. Restoration of the Old San Francisco Mint Has Been Completed, https://www.usmint.gov/learn/history/historical-documents/restoration-of-old-san-francisco-mint-completed 8. Item of the Week: 1870-S Half Dime \\- Numismatic News, https://www.numismaticnews.net/us-coins/item-of-the-week-1870-s-half-dime 9. 1870-S Liberty Seated Half Dime: History, Discovery and Value, https://coinweek.com/1870-s-liberty-seated-half-dime-the-tiny-coin-behind-a-san-francisco-mint-mystery/ 10. 1870-S \\$3 (Special Strike) Three Dollar \\- PCGS CoinFacts, https://www.pcgs.com/coinfacts/coin/1870-s-3/7992 11. Item of the Week; 1870-S \\$3 Gold \\- Numismatic News, https://www.numismaticnews.net/collecting-101/item-of-the-week-1870-s-3-gold 12. 1870-S Seated Liberty Dollar | America’s Greatest Coin Mystery, https://www.blanchardgold.com/market-news/1870-s-seated-liberty-dollar/ 13. Seated Liberty Dollars 1870 S \\$1 MS \\- Coin Explorer \\- NGC, https://www.ngccoin.com/coin-explorer/united-states/dollars/seated-liberty-dollars-1840-1873/16965/1870-s-1-ms/ 14. Old San Francisco Mint Cornerstone \\- Coin Community Forum, https://www.coincommunity.com/forum/topic.asp?topic\\_id=402055 15. A \\$1 coin worth \\$10000?\\! In 2000, Cheerios partnered with the U.S., https://www.facebook.com/bullionshark/videos/cotdmp4/617810651336076/ 16. 2000 P Sacagawea Cheerios Dollar \\- Error-Ref.com, https://www.error-ref.com/2000-p\\_sacagawea\\_\\_cheerios\\_\\_dollar/ 17. Cheerios Dollar: How to Tell If You Have This Rare Coin \\- wikiHow, https://www.wikihow.com/Cheerios-Dollar 18. Sacagawea Dollar Pattern/Cheerios Dollar \\- Dollar Coins, https://www.smalldollars.com/dollar/page20c.html",
      l: [
        "Susan B. Anthony (1979–1981, 1999): The first historical woman on a circulating U.S. coin. However, because it was clad-colored, reeded, and only slightly larger than a quarter, consumers frequently mixed them up in pocket change, leading to broad commercial rejection.",
        "Sacagawea Dollar (2000–Present): Created to fix the confusion by using a manganese-brass alloy with a distinctive golden color and smooth edge. The obverse depicts Sacagawea carrying her infant son Jean Baptiste Charbonneau.",
        "Presidential Dollars (2007–2016): A multi-year series honoring deceased U.S. presidents. These coins revived edge lettering for the first time on circulating coinage since the 1930s, paving the way for the famous \"Godless\" dollar error.",
      ],
    },
];

const ROLL_GUIDE_SECTIONS = [
    { h: "U.S. Coin Roll-Hunting Master Field Guide",
    },
    { h: "A beginner-to-advanced reference for finding keys, semi-keys, varieties, errors, silver, and condition rarities",
      t: "Scope: Primarily U.S. circulating coins, with emphasis on coins a roll hunter can realistically encounter. How to use this book: Start with the denomination chapter for the coin in your hand. Use the pull list as triage, then use the diagnostics to determine why a coin is interesting. Important: Weight, color, magnetism, and magnification are screening tools-not authentication. Major rarities and valuable errors should be professionally authenticated.",
    },
    { h: "1. The Roll Hunter’s Method",
      t: "For every coin, ask: Do not begin with \"Is this worth money?\" Begin with \"What exactly is this coin?\"",
      l: [
        "What denomination is it?",
        "What year?",
        "What mintmark?",
        "Is the composition unusual?",
        "Is it a proof?",
        "Is the design/type unusual?",
        "Is there a recognized variety for this date?",
        "Is there a genuine mint error?",
        "Is it unusually well preserved?",
        "Does it need closer examination?",
      ],
    },
    { h: "2. Core Terminology",
    },
    { h: "Key date",
      t: "A particularly scarce date/mint combination important to completing a series.",
    },
    { h: "Semi-key",
      t: "A date/mint combination noticeably scarcer than ordinary dates but generally below the principal keys. Definitions vary by reference and grade.",
    },
    { h: "Better date",
      t: "A flexible collector term for a date deserving more attention than a common issue.",
    },
    { h: "Low mintage",
      t: "A coin with low original production. Low mintage does not automatically mean rare today; survival matters.",
    },
    { h: "Die variety",
      t: "A repeatable difference caused by the die(s) used to strike coins. Examples: doubled die, repunched mintmark, overmintmark, overdate, hub/design subtype, and some die clashes.",
    },
    { h: "Mint error",
      t: "An abnormal result of manufacture. Examples: wrong planchet, off-center, broadstrike, clip, struck-through, brockage, double strike, and missing clad layer.",
    },
    { h: "Die state",
      t: "The condition of a die at a particular point in its life. A die can progress from an early state to cracked, heavily cracked, and finally broken/shattered states.",
    },
    { h: "3. Variety vs. Error vs. Damage",
      t: "Die variety: The die itself contains the unusual feature. A 1955 Lincoln doubled die is an example; the same die can strike many coins with the same feature. Mint error: Something abnormal happened during manufacture, such as a wrong planchet or off-center strike. Post-mint damage: Something happened after the coin left the Mint: scratches, gouges, bent rims, chemical stains, filing, grinding, heat damage, etc. Rule of thumb: A die crack normally appears as a raised line on the coin because the die is the negative image. An ordinary scratch is normally incuse. Always inspect the entire feature rather than relying on one rule.",
    },
    { h: "4. Doubling: The Biggest Beginner Trap",
    },
    { h: "True doubled die",
      t: "A doubled die is created during die manufacture. The coin repeatedly shows the doubled design. Look for distinct secondary design elements, separation, and consistent spread.",
    },
    { h: "Machine doubling",
      t: "Machine doubling happens during striking. It commonly looks flat, shelf-like, or like a design edge has been pushed down. It is generally not the valuable doubled-die variety collectors seek. Never call a coin a doubled die merely because something looks doubled under magnification.",
    },
    { h: "5. Weights, Metals, and Composition",
    },
    { h: "Current U.S. Mint specifications",
      t: "2026 note: The Mint’s current annual-set penny is still 2.50 g copper-plated zinc, but it is produced for collectible sets rather than ordinary circulating production. Half dollars are primarily produced for numismatic products, though they remain legal tender. citeturn0search0 Why weight matters: Weight can flag possible silver, steel, bronze, wrong planchets, missing clad layers, foreign planchets, or counterfeits. Why weight is not proof: Wear, damage, plating, counterfeit construction, scale error, and normal tolerances can affect measurements. Use weight as a screening test.",
      tbl: [
        ["Denomination", "Weight", "Diameter", "Composition"],
        ["Cent", "2.500 g", "19.05 mm", "2.5% copper / 97.5% zinc"],
        ["Nickel", "5.000 g", "21.21 mm", "75% copper / 25% nickel"],
        ["Dime", "2.268 g", "17.91 mm", "91.67% copper / 8.33% nickel overall"],
        ["Quarter", "5.670 g", "24.26 mm", "91.67% copper / 8.33% nickel overall"],
        ["Half dollar", "11.340 g", "30.61 mm", "91.67% copper / 8.33% nickel overall"],
        ["Dollar", "8.100 g", "26.49 mm", "copper-based manganese/brass alloy"],
      ],
    },
    { h: "6. Cents",
    },
    { h: "6.1 Composition timeline",
      tbl: [
        ["Issue", "Composition", "Weight"],
        ["1909-1942 Wheat", "95% copper / 5% zinc", "3.11 g"],
        ["1943", "Zinc-coated steel", "2.70 g"],
        ["1944-1946 shell-case bronze", "Copper alloy", "3.11 g"],
        ["1947-1981", "95% copper / 5% zinc", "3.11 g"],
        ["1982 bronze", "95% copper / 5% zinc", "3.11 g"],
        ["1982 zinc", "Copper-plated zinc", "2.50 g"],
        ["1983-present", "Copper-plated zinc", "2.50 g"],
      ],
    },
    { h: "6.2 Indian Head cents",
      t: "Pull every Indian Head cent. Especially research 1877, 1908-S, and 1909-S.",
    },
    { h: "6.3 Wheat cents",
      t: "Pull every Wheat cent. Then inspect date and mint. Major keys: Better/semi-key dates to research: 1911-D, 1912-D, 1912-S, 1913-D, 1913-S, 1914-S, 1915-D, 1915-S, 1916-S, 1917-S, 1918-D, 1918-S, 1919-D, 1919-S, 1921-S, 1923-S, 1924-D, 1924-S, 1925-D, 1926-D, 1926-S, 1927-D, 1927-S, 1928-S, 1929-D, 1929-S, 1930-S. Note: Semi-key labels vary by grade and reference.",
      tbl: [
        ["Date", "Diagnostic", "Level"],
        ["1909-S VDB", "VDB on reverse", "Major key"],
        ["1909-S", "S mintmark", "Key"],
        ["1914-D", "D mintmark", "Major key"],
        ["1922 No D", "Denver issue with absent/obscured D", "Major variety"],
        ["1931-S", "S mintmark", "Major key"],
      ],
    },
    { h: "6.4 1909-S VDB",
      t: "Turn the coin over and inspect below the wheat stalks for VDB. Pull every candidate.",
    },
    { h: "6.5 1922 No D",
      t: "Denver was the only Mint striking Lincoln cents in 1922. Some Denver dies developed problems that caused the D to become extremely weak or disappear. Beginner warning: \"I cannot see the D\" is not enough. Weak-D pieces, damage, and genuine No D varieties must be separated by diagnostics.",
    },
    { h: "6.6 1943 steel cent",
      t: "Normal: zinc-coated steel, about 2.70 g. Search for suspected 1943 bronze cents. A genuine bronze example is an extraordinary error and should be authenticated.",
    },
    { h: "6.7 1944 steel cent",
      t: "Normal 1944 cents are bronze/shell-case bronze, about 3.11 g. A genuine steel 1944 is an extraordinary off-metal error.",
    },
    { h: "6.8 1955 Doubled Die Obverse",
      t: "Inspect the date, LIBERTY, and IN GOD WE TRUST. The genuine variety has strong, unmistakable doubling. Major authentication candidate.",
    },
    { h: "6.9 1960 Small Date / Large Date",
      t: "Both 1960 and 1960-D have Small Date and Large Date varieties. The 1960-D also has a recognized Small Date over Large Date variety. Use the shape, proportions, alignment, and spacing of the date-not wear alone-to distinguish them.",
    },
    { h: "6.10 1969-S Doubled Die Obverse",
      t: "Inspect date, LIBERTY, and IN GOD WE TRUST. This is heavily counterfeited and frequently confused with machine doubling. A genuine candidate deserves professional authentication.",
    },
    { h: "6.11 1970-S Small Date",
      t: "A genuine Small Date is a distinct date-hub variety. A useful diagnostic is the relationship of the top of the 7 to the other numerals, along with the shape of the 7 and LIBERTY. Do not diagnose from one feature alone.",
    },
    { h: "6.12 1970-S Large Date Doubled Die Obverse",
      t: "Inspect Large Date examples for strong doubling on the date, LIBERTY, and motto. Compare with recognized diagnostics.",
    },
    { h: "6.13 1972 Doubled Die Obverse",
      t: "Inspect LIBERTY, IN GOD WE TRUST, and the date. There are multiple 1972 doubled dies; identify the exact variety rather than simply writing \"1972 DDO.\"",
    },
    { h: "6.14 1982 - the essential cent-hunting year",
      t: "Both bronze and zinc cents were made. Pull every 1982 until you have identified date style \\+ composition \\+ mint. A bronze 1982 is not automatically rare; rarity depends on the exact combination.",
      l: [
        "Bronze: \\~3.11 g",
        "Zinc: \\~2.50 g",
        "Date styles: Large Date and Small Date",
      ],
    },
    { h: "6.15 1983 Doubled Die Reverse",
      t: "Inspect reverse lettering and compare against recognized diagnostics.",
    },
    { h: "6.16 1984 Doubled Ear",
      t: "Inspect Lincoln’s ear. Separate genuine doubled-ear diagnostics from scratches, contact marks, and die chips.",
    },
    { h: "6.17 1988 Reverse of 1989",
      t: "A recognized reverse hub/design-transition variety. Compare against known diagnostics.",
    },
    { h: "6.18 1992 Close AM",
      t: "Inspect AMERICA on the reverse. The 1992 and 1992-D Close AM varieties use the reverse design associated with 1993. The bases of A and M are unusually close, and the FG position is a useful secondary diagnostic. Both Philadelphia and Denver examples are known and are extremely scarce. citeturn0search1turn0search5",
    },
    { h: "6.19 1995 Doubled Die Obverse",
      t: "Inspect LIBERTY, IN GOD WE TRUST, and date for strong recognized doubling.",
    },
    { h: "6.20 1998-2000 Close AM / Wide AM",
      t: "For 1998-2000 business strikes, the important scarce varieties are Wide AM reverses. The 1999 Wide AM is particularly important. Always identify the exact year, mint, finish, and reverse before attributing the variety.",
    },
    { h: "6.21 2009 Bicentennial cents",
      t: "Four reverse designs were issued. Save one of each, then inspect for doubled dies, cuds, die chips, off-centers, broadstrikes, and proofs.",
    },
    { h: "6.22 Modern Shield cents",
      t: "Search for major doubled dies, cuds, major die cracks, clashes, off-centers, broadstrikes, wrong planchets, and missing plating. Tiny plating blisters are not automatically major errors.",
    },
    { h: "7. Nickels",
    },
    { h: "7.1 Normal composition",
      t: "Most Jefferson nickels are 75% copper / 25% nickel, 5.00 g.",
    },
    { h: "7.2 Wartime silver nickels, 1942-1945",
      t: "Composition: 56% copper / 35% silver / 9% manganese. Weight: 5.00 g. Large P, D, or S above Monticello is the key visual clue. Philadelphia’s P appeared on a U.S. circulation coin for the first time on this issue. Pull every one.",
    },
    { h: "7.3 Buffalo nickels",
      t: "Pull every Buffalo. Research especially 1913-D/S, 1914-D/S, 1915-S, 1916-D, 1917-S, 1918-D/S, 1921-S, 1924-S, 1926-S, 1927-S, 1929-D/S, 1930-S, and 1931-S.",
    },
    { h: "7.4 1913 Buffalo Type 1 / Type 2",
      t: "Type 1: Reverse shows the buffalo standing on a raised mound. Type 2: The ground/mound design was redesigned, including the denomination area, to reduce wear. If you find a 1913 Buffalo, identify the type before returning it.",
    },
    { h: "7.5 1916/16 Buffalo",
      t: "Major doubled-die date variety. Inspect the date closely.",
    },
    { h: "7.6 1937-D Three-Legged Buffalo",
      t: "Heavy die polishing after a clash removed much of the buffalo’s front leg. Do not simply count legs; inspect the leg, hoof, belly, and surrounding diagnostics.",
    },
    { h: "7.7 1935 Doubled Die Reverse",
      t: "Inspect reverse lettering and compare to a recognized example.",
    },
    { h: "7.8 Jefferson key dates",
      t: "Research 1938-D, 1938-S, 1939-D, 1939-S, and 1950-D.",
    },
    { h: "7.9 Wartime varieties",
      t: "Pay special attention to 1943/2-P, 1943-P Doubled Eye, and 1945-P Doubled Die Reverse. These are recognized varieties.",
    },
    { h: "7.10 Full Steps",
      t: "Inspect the steps beneath Monticello. A sharp coin with uninterrupted steps can be substantially more desirable in high grade. Save exceptionally sharp examples.",
    },
    { h: "8. Dimes",
    },
    { h: "8.1 Mercury dimes",
      t: "Pull every Mercury dime. Major dates include 1916-D, 1921, 1921-D, 1926-S, 1931-D, and 1931-S.",
    },
    { h: "8.2 Silver Roosevelt dimes",
      t: "All normal Roosevelt dimes dated 1946-1964 are 90% silver / 10% copper and weigh 2.50 g.",
    },
    { h: "8.3 Better Roosevelt dates",
      t: "Research 1949-S, 1950-S, 1955, 1955-D, 1955-S, 1956-D, 1958-D, 1959-D, 1960-D, 1961-D, 1962-D, and 1963-D, with condition in mind.",
    },
    { h: "8.4 1964-D variety hunting",
      t: "Recognized varieties include RPM FS-501, MPM FS-502, RPM FS-503 through FS-506, and DDR FS-801 through FS-803. PCGS lists these and also distinguishes Full Bands examples. This is an excellent example of why a silver hunter should not automatically stop at pulling the silver.",
    },
    { h: "8.5 Full Bands",
      t: "Inspect the horizontal torch bands. A very sharp Roosevelt with complete band separation can be much more desirable in high grade. Save exceptionally sharp examples.",
    },
    { h: "9. Quarters",
    },
    { h: "9.1 Standing Liberty quarters",
      t: "Pull every one. Research 1916, 1919-D/S, 1920-D/S, 1921, 1923-S, 1924-S, 1926-S, and 1927-S.",
    },
    { h: "9.2 1918/7-S",
      t: "Classic overdate. Look for the underlying 7 beneath the final 8.",
    },
    { h: "9.3 Barber quarters",
      t: "Pull every Barber. Especially research 1896-S, 1901-S, 1904-S, and 1913-S.",
    },
    { h: "9.4 Silver Washington quarters",
      t: "Regular Washington quarters from 1932-1964 are 90% silver / 10% copper and weigh 6.25 g.",
    },
    { h: "9.5 1932-D and 1932-S",
      t: "Both are major keys. Pull immediately.",
    },
    { h: "9.6 1950-D/S and 1950-S/D",
      t: "Recognized overmintmark varieties. Inspect the mintmark closely.",
    },
    { h: "9.7 1942-D doubled die",
      t: "Inspect the obverse for recognized doubling and compare with attribution references.",
    },
    { h: "9.8 1964-D doubled die reverse",
      t: "Inspect reverse lettering and compare with recognized diagnostics.",
    },
    { h: "9.9 1965 silver quarter",
      t: "Normal 1965 quarter: 5.67 g clad. A silver-planchet candidate will be around 6.25 g. A genuine 1965 quarter struck on a silver planchet is a major transitional error. Weigh suspicious examples.",
    },
    { h: "9.10 1970-S wrong-planchet candidates",
      t: "If a 1970-S quarter is unusually small, oddly colored, has a strange edge, or abnormal weight, isolate it and investigate.",
    },
    { h: "9.11 1976 Bicentennial quarters",
      t: "Save P, D, S, proofs, silver issues, type varieties, and major errors.",
    },
    { h: "9.12 State quarter varieties",
      t: "2004-D Wisconsin Extra Leaf: Inspect the corn ear. Recognized forms are Extra Leaf High and Extra Leaf Low. These are die varieties, not scratches. 2005-P Minnesota: Numerous doubled-die varieties exist. The famous extra-tree appearance is doubling; do not count trees without matching exact diagnostics.",
    },
    { h: "10. Half Dollars",
    },
    { h: "1964",
      t: "90% silver, 12.50 g. Pull all.",
    },
    { h: "1965-1969",
      t: "40% silver, 11.50 g. Pull all.",
    },
    { h: "1970-D",
      t: "Only released in mint sets. Not for circulation. Pull it.",
    },
    { h: "Proofs",
      t: "Inspect 1964 proofs, Accented Hair, cameo/deep-cameo candidates, major varieties, and errors.",
    },
    { h: "11. Eisenhower Dollars",
    },
    { h: "11.1 1972-P Type 1 / Type 2 / Type 3",
      t: "The three reverse types are primarily distinguished by the earth/map details. Type 1: Early reverse with less accurately rendered map/island details. Type 2: Intermediate reverse with revised map details. Type 3: Final reverse with more refined geography. Beginner method: Learn the three reference images first; then learn the geographic diagnostics. The important lesson is that 1972-P is not one uniform reverse.",
    },
    { h: "11.2 1976 Type 1 / Type 2",
      t: "Bicentennial Ike dollars have different reverse hub varieties. Compare against recognized examples.",
    },
    { h: "11.3 Silver Ikes",
      t: "Some S-mint collector issues contain 40% silver. S does not automatically mean silver. Identify the exact issue.",
    },
    { h: "12. Susan B. Anthony Dollars",
    },
    { h: "12.1 1979-P Near Date / Wide Rim",
      t: "Normal 1979-P: date farther from rim. Wide Rim/Near Date: date much closer to rim. Why both names? Wide Rim describes the rim relationship; Near Date describes the date’s position. They refer to the same important variety.",
    },
    { h: "12.2 1979-S Type 1 / Type 2",
      t: "These are proof varieties. Type 1 has a filled/blobby S; Type 2 has a clearer, more defined S. Type 2 is scarcer. Do not apply this proof diagnostic indiscriminately to ordinary business strikes.",
    },
    { h: "12.3 1981-S Type 1 / Type 2",
      t: "These are proof varieties distinguished by the S mintmark punch. Type 2 uses the newer, clearer S and is the scarcer variety.",
    },
    { h: "13. Sacagawea and Native American Dollars",
      t: "Search for 2000-P Cheerios, Wounded Eagle, doubled dies, cuds, major die chips, clashes, off-centers, broadstrikes, wrong planchets, and edge errors.",
    },
    { h: "13.1 2000-P Cheerios",
      t: "Special 2000-P dollars distributed in Cheerios promotions can have enhanced reverse detail. Do not identify one from the date alone; compare the exact reverse diagnostics.",
    },
    { h: "13.2 Wounded Eagle",
      t: "Recognized reverse variety. Look for the diagnostic line across the eagle’s breast and compare with a trusted reference.",
    },
    { h: "14. Presidential Dollars",
      t: "The edge is critical. Look for missing, doubled, partial, or misaligned edge lettering. Warning: Weak edge lettering is not automatically an error. Study the complete edge.",
    },
    { h: "15. Morgan and Peace Dollars",
      t: "These are unlikely modern roll finds but should be recognized instantly.",
    },
    { h: "Morgan",
      t: "Learn major keys: 1879-CC, 1889-CC, 1892-S, 1893, 1893-CC, 1893-S, 1894, 1895, 1895-O, 1895-S, 1903-O, and 1903-S. VAM: Morgan varieties use the VAM system. Diagnostics can involve date position, mintmark, doubling, clashes, die breaks, polishing, and lettering.",
    },
    { h: "Peace",
      t: "Important dates include 1921, 1927-D, 1928, and 1934-S.",
    },
    { h: "16. Proofs",
      t: "Proofs are specially manufactured collector coins. Clues include mirror-like fields, frosted design, sharp detail, and often an S mintmark on modern issues. Pull every proof. Then check date, variety, contrast, and errors.",
    },
    { h: "17. Die Cracks, Die Chips, and Cuds",
    },
    { h: "Die crack",
      t: "A crack in the die. Because the die is the negative image, it normally appears as a raised line on the coin.",
    },
    { h: "Die chip",
      t: "A small piece of die breaks away, producing a raised blob/lump.",
    },
    { h: "Cud",
      t: "A large die break involving the edge, usually producing a substantial raised area connected to the rim. Why a die crack can appear on many coins: One die can strike thousands or far more coins. If it cracks and stays in service, the same crack can repeat on many coins. As the die deteriorates, the crack may lengthen and grow into a larger break. Repeated markers can therefore act like a fingerprint and identify die states.",
    },
    { h: "18. Major Mint Error Types",
      l: [
        "Off-center: planchet not centered in collar.",
        "Broadstrike: struck without normal collar containment.",
        "Clip: missing planchet material.",
        "Wrong planchet: struck on a blank intended for another denomination.",
        "Missing clad layer: one clad layer is absent.",
        "Struck-through: foreign material came between die and planchet.",
        "Brockage: a coin transfers an incuse/mirrored design to another planchet.",
        "Double strike: receives a second strike.",
        "Die clash: dies hit one another without a planchet between them.",
        "Cud: major die break.",
      ],
    },
    { h: "19. Wrong-Planchet Investigation",
      t: "For a suspicious coin, record: Example: normal quarter 5.67 g versus a suspected silver-planchet quarter around 6.25 g. Weight is a clue, not proof.",
      l: [
        "Weight",
        "Diameter",
        "Thickness",
        "Edge appearance",
        "Color",
        "Magnetic behavior",
        "Design/strike characteristics",
      ],
    },
    { h: "20. Condition Rarities",
      t: "A common date can become scarce in exceptional condition. Lincoln cents: Look for original red color, strong strike, and minimal marks. Jefferson nickels: Look for Full Steps. Roosevelt dimes: Look for Full Bands. Washington quarters: Look for strong strike, original luster, and minimal contact marks. If a modern coin looks shockingly new, save it.",
    },
    { h: "21. Things Usually NOT Rare",
      t: "Usually do not treat these as major discoveries:",
      l: [
        "Random scratches",
        "Rim dents",
        "Flattened rims",
        "Machine doubling",
        "Tiny die chips",
        "Plating bubbles",
        "Chemical discoloration",
        "Polishing marks",
        "Heat damage",
        "Post-mint holes",
        "Gouges",
      ],
    },
    { h: "22. Beginner Date-Priority System",
    },
    { h: "Tier A - Pull immediately",
      t: "Silver; war nickels; Indian Heads; Wheat cents; Buffalo nickels; Mercury dimes; Barber coins; Standing Liberty quarters; Walking Liberty halves; Franklin halves; Morgan dollars; Peace dollars; major keys; obvious proofs; obvious major errors.",
    },
    { h: "Tier B - Stop and investigate",
      t: "1982 cents; 1960 cents; 1970-S cents; 1972 cents; 1992 cents; 1998-2000 cents; 1964-D dimes; 1976 quarters/Ikes; 1979-P SBA dollars; 1979-S SBA proofs; 1981-S SBA proofs; 1972-P Ikes; Wisconsin Extra Leaf; Minnesota doubled-die candidates.",
    },
    { h: "Tier C - Save if unusually nice",
      t: "Modern high-grade coins; Full Steps nickels; Full Bands dimes; sharp quarters; strongly lustrous cents; uncirculated older coins.",
    },
    { h: "23. Practical Attribution Workflow",
      t: "When a coin looks unusual, do not jump directly to a variety name. Step 1 - Establish the normal coin: Identify denomination, date, mint, composition, and normal design. Step 2 - Document it: Record weight, diameter, thickness if relevant, edge appearance, and magnetic behavior. Step 3 - Photograph it: Take full obverse/reverse photos plus a close-up of the suspected diagnostic. Photograph the edge for errors. Step 4 - Compare with a normal example: This is one of the fastest ways to separate a real variety/error from damage. Step 5 - Identify the mechanism: Ask whether the feature came from a different die/hub, an abnormal planchet, an abnormal striking event, or something that happened after the coin left the Mint. Step 6 - Attribute before valuing: Do not use an auction listing or asking price to decide what the coin is. First establish the exact variety/error; then research value.",
    },
    { h: "Edge-first diagnostics",
      t: "The edge can reveal silver versus clad construction, missing clad layer, unusual thickness, broadstrike/collar problems, altered edges, and Presidential-dollar edge-lettering errors.",
    },
    { h: "Photography checklist",
      t: "For an important candidate, save: full obverse, full reverse, edge, diagnostic close-up, weight/measurement record, and a comparison with a normal coin.",
    },
    { h: "23. Equipment",
    },
    { h: "Essential",
      l: [
        "5x-10x loupe",
        "Accurate digital scale",
        "Bright neutral lighting",
        "Coin tray",
        "Non-PVC holders",
        "Notebook or spreadsheet",
      ],
    },
    { h: "Helpful",
      t: "Never use:",
      l: [
        "Digital calipers",
        "USB microscope",
        "Camera/phone",
        "Variety reference",
        "Small magnet",
        "Knives",
        "Needles",
        "Sandpaper",
        "Metal polish",
        "Abrasive cloth",
        "Chemical cleaners",
      ],
    },
    { h: "24. Coin Identification Worksheet",
      t: "Denomination: Year: Mint: Weight: Diameter: Magnetic?: Composition: Type: Obverse variety: Reverse variety: Mintmark variety: Error?: Die crack/chip/cud?: Condition: Proof?: Reference used: Photos taken?: Authentication needed?:",
    },
    { h: "25. When to Get Professional Authentication",
      t: "Get professional attribution/authentication when a coin might be: The cost of authentication can be small compared with the risk of selling a genuine rarity as a common coin-or paying a premium for a counterfeit.",
      l: [
        "1909-S VDB",
        "1914-D",
        "1922 No D",
        "1955 DDO",
        "1969-S DDO",
        "1970-S DDO",
        "1972 DDO",
        "1943 bronze",
        "1944 steel",
        "1965 silver quarter",
        "Major wrong-planchet error",
        "Major doubled die",
        "Valuable Morgan VAM",
        "Important proof variety",
      ],
    },
    { h: "26. The Golden Rules",
      l: [
        "Never clean a coin you think may be valuable.",
        "Weigh suspicious coins.",
        "Learn mintmarks.",
        "Learn composition changes.",
        "Do not confuse machine doubling with doubled dies.",
        "Do not confuse damage with mint errors.",
        "Learn the exact diagnostics for each variety.",
        "Save exceptionally nice examples.",
        "Photograph suspicious coins before excessive handling.",
        "Never rely on a single social-media photograph to authenticate a major rarity.",
      ],
    },
    { h: "27. Master Pull List",
    },
    { h: "CENTS",
      t: "Pull: Indian Head; Wheat; 1909-S; 1909-S VDB; 1914-D; 1922 No D candidates; 1931-S; 1943 steel; 1955 DDO candidates; 1969-S DDO candidates; 1970-S Small Date candidates; 1970-S DDO candidates; 1972 DDO candidates; all 1982s until attributed; 1983 DDR candidates; 1984 Doubled Ear candidates; 1988 Reverse of 1989; 1992 Close AM; 1995 DDO; 1998-2000 AM varieties; major modern errors.",
    },
    { h: "NICKELS",
      t: "Pull: Buffalo; 1938-D; 1938-S; 1939-D; 1939-S; 1950-D; every 1942-1945 silver nickel; 1916/16; 1937-D 3-Legged candidates; 1943/2-P; 1943-P Doubled Eye; 1945-P DDR; Full Steps candidates.",
    },
    { h: "DIMES",
      t: "Pull: Barber; Mercury; 1916-D; 1921; 1921-D; 1926-S; 1931-D; 1931-S; all 1946-1964 silver; 1964-D varieties; Full Bands candidates.",
    },
    { h: "QUARTERS",
      t: "Pull: Barber; Standing Liberty; 1918/7-S; 1932-D; 1932-S; all 1932-1964 silver; 1950-D/S; 1950-S/D; 1942-D DDO candidates; 1964-D DDR candidates; 1965 heavy/silver candidates; 1970-S unusual-planchet candidates; 1976 varieties; 2004-D Wisconsin Extra Leaf; 2005-P Minnesota varieties.",
    },
    { h: "HALF DOLLARS",
      t: "Pull: Barber; Walking Liberty; Franklin; 1964; 1965-1970; 1970-D; proofs; major errors.",
    },
    { h: "DOLLARS",
      t: "Pull: Morgan; Peace; silver Eisenhower; 1972-P; 1976 varieties; 1979-P SBA; 1979-S proof; 1981-S proof; 2000-P Sacagawea; Presidential edge errors.",
    },
    { h: "28. Final Mindset",
      t: "The best roll hunters do not merely memorize lists. They learn to recognize manufacturing clues. When you see a strange coin, ask: What happened at the Mint that could have created this? If the answer is \"a die was different,\" you may have a variety. If the answer is \"the blank was wrong,\" you may have an error. If the answer is \"the die cracked,\" you may have a die-state marker. If the answer is \"someone damaged it after it was made,\" you probably have damage. That is the fundamental skill that turns roll hunting from sorting coins into actual numismatic research.",
    },
    { h: "Verification and Maintenance Note",
      t: "This guide should be treated as a living field reference. Major rarity diagnostics should be rechecked against current specialist references before buying, selling, or authenticating a coin. U.S. Mint specifications and production practices can change; the Mint’s current 2026 specifications are reflected in this edition. citeturn0search0 &nbsp;",
    },
];

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
const PAPER_GUIDE_HTML = `<style>
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
.cc-guide table{border-collapse:collapse;margin:.5em 0;font-size:.85em;}
.cc-guide th,.cc-guide td{border:1px solid var(--color-border-light,#444);padding:3px 8px;}
</style><div class="cc-guide"><h1>U.S. PAPER CURRENCY ROLL-HUNTING &amp; CURRENCY-FINDING MASTER FIELD GUIDE</h1>
<h2>Expanded Collector Edition --- Identification, Hunting, Varieties, Errors, and Research Workflow</h2>
<p><strong>Purpose:</strong> A practical U.S. paper-money field guide for finding,
identifying, documenting, and researching potentially collectible notes.</p>
<p><strong>Important:</strong> This is not a price guide. Values change with rarity,
condition, market demand, authenticity, serial number, and variety.</p>
<hr>
<p><strong>Scope:</strong> Primarily United States paper currency. The guide emphasizes
notes that an ordinary person can realistically encounter, while also
explaining older and obsolete issues so that a surprising note is not
accidentally spent.</p>
<p><strong>Core rule:</strong> Do not judge a bill only by its denomination or age.
Identify the <strong>type of note, series, signatures, seal, serial number,
Federal Reserve district, condition, and possible printing error</strong>.</p>
<blockquote>
<p><strong>Important:</strong> This is a hunting and identification guide, not a price
guide. Values change with grade, rarity, market demand, serial number,
and authentication. Major rarities and suspected errors should be
examined by a specialist or professional grading service.</p>
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
<li><strong>Silver Certificate / Gold Certificate / United States Note /
National Bank Note / other obsolete type</strong></li>
</ol>
<p>The Bureau of Engraving and Printing states that all U.S. currency
remains legal tender regardless of when it was issued. That means an old
note should not automatically be spent simply because it looks
unfamiliar.</p>
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
<p>Historical U.S. notes normally carry signatures representing Treasury
officials.</p>
<p>For modern small-size notes, collectors commonly describe a signature
combination using the names of the:</p>
<ul>
<li><strong>Treasurer of the United States</strong></li>
<li><strong>Secretary of the Treasury</strong></li>
</ul>
<h3>Why signatures matter</h3>
<p>A short-serving Treasury official can produce a relatively scarce
signature combination.</p>
<p>The famous example is:</p>
<h2>Joseph W. Barr</h2>
<p>Barr served as Secretary of the Treasury for only about one month, from
December 21, 1968 to January 20, 1969.</p>
<p>As a result, <strong>Series 1963B $1 Federal Reserve Notes with Barr&#39;s
signature are popularly collected as &quot;Barr notes.&quot;</strong></p>
<p>The Bureau of Engraving and Printing specifically notes that fewer notes
bear Barr&#39;s facsimile signature because of his unusually short tenure.</p>
<h3>Roll-hunting rule</h3>
<p>Whenever you find an older note:</p>
<p><strong>Read the signatures.</strong></p>
<p>Do not rely on the series year alone.</p>
<hr>
<h1>5. SERIAL NUMBERS</h1>
<p>Serial numbers are one of the easiest things to hunt because you can
examine them without specialized equipment.</p>
<h2>Modern basic structure</h2>
<p>Historically, many Federal Reserve Notes used:</p>
<p><strong>one letter + eight digits + one letter</strong></p>
<p>Example:</p>
<p><code>A12345678B</code></p>
<p>Beginning with Series 1996, $5 and higher Federal Reserve Notes use two
letters before the eight digits, while $1 and $2 retain the
older-style one-letter prefix format.</p>
<p>For modern Federal Reserve Notes of $5 and higher, the first
serial-number letter identifies the series and the second letter
identifies the issuing Federal Reserve Bank. For $1 and $2 notes, the
first serial-number letter identifies the issuing Federal Reserve Bank.</p>
<hr>
<h1>6. FEDERAL RESERVE BANK LETTERS</h1>
<p>The 12 Federal Reserve districts use:</p>
<p>  Letter   District</p>
<hr>
<p>  A        Boston
  B        New York
  C        Philadelphia
  D        Cleveland
  E        Richmond
  F        Atlanta
  G        Chicago
  H        St. Louis
  I        Minneapolis
  J        Kansas City
  K        Dallas
  L        San Francisco</p>
<p>The BEP confirms this letter-to-district relationship.</p>
<h3>Why collectors care</h3>
<p>Some older series/district combinations are substantially scarcer than
others.</p>
<p>The district letter can also help identify a note that appears ordinary
at first glance.</p>
<hr>
<h1>7. STAR NOTES</h1>
<h2>What is a star note?</h2>
<p>A star note is a replacement note.</p>
<p>If a sheet is discovered to be defective after serial numbers have been
printed, the defective sheet cannot simply receive the same serial
numbers again.</p>
<p>A replacement sheet is therefore produced with a <strong>star in place of the
normal suffix letter</strong>.</p>
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
<p>A fancy serial number has an unusually memorable or mathematically
interesting pattern.</p>
<p>These are highly collectible.</p>
<hr>
<h1>10. SOLID SERIAL NUMBERS</h1>
<p>Example:</p>
<p><code>11111111</code></p>
<p>All eight digits are identical.</p>
<p>These are extremely desirable.</p>
<p>A true eight-digit solid is much more important than something merely
containing several repeated digits.</p>
<hr>
<h1>11. NEAR-SOLID SERIAL NUMBERS</h1>
<p>Example:</p>
<p><code>11111112</code></p>
<p>Seven identical digits and one different digit.</p>
<p>These can be collectible, although generally less desirable than a true
solid.</p>
<hr>
<h1>12. LOW SERIAL NUMBERS</h1>
<p>Examples:</p>
<p><code>00000001</code> <code>00000010</code> <code>00000100</code> <code>00001000</code></p>
<p>The closer a serial number is to the beginning of the production run,
the more interesting it may be.</p>
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
<p>Ignore the prefix/suffix letters when evaluating the basic eight-digit
radar pattern.</p>
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
<p><code>12121212</code> <code>12341234</code> <code>71717171</code></p>
<p>The stronger and more obvious the repetition, the more interesting the
note can become.</p>
<hr>
<h1>16. LADDER SERIAL NUMBERS</h1>
<p>A ladder runs upward or downward in numerical sequence.</p>
<p>Examples:</p>
<p><code>12345678</code> <code>87654321</code></p>
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
<p><code>10101010</code> <code>11001100</code> <code>11110000</code></p>
<p>These are especially easy to recognize.</p>
<hr>
<h1>20. REPEATED-DIGIT SERIALS</h1>
<p>Examples:</p>
<p><code>12222222</code> <code>77777770</code> <code>55555555</code></p>
<p>The more extreme the repetition, the more collectible the number may be.</p>
<hr>
<h1>21. SEQUENTIAL SERIAL NUMBERS</h1>
<p>Examples:</p>
<p><code>12345678</code> <code>23456789</code></p>
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
<p>Shorter or more clearly interpretable dates are generally easier to
market.</p>
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
<p><code>77777770</code> <code>77777777</code></p>
<p>A note with seven identical digits is sometimes called a
<strong>seven-of-a-kind</strong>.</p>
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
<p>The more compelling the exact mathematical pattern, the more interesting
the note.</p>
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
<p>A genuine mismatched serial-number error can be a major collectible
error.</p>
<hr>
<h1>29. MISSING SERIAL NUMBER</h1>
<p>If one serial number is completely missing but the other is present,
investigate.</p>
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
<p>An image can transfer from one sheet or surface to another before the
ink has fully dried.</p>
<p>This can create a mirrored or transferred image.</p>
<h3>Warning</h3>
<p>Do not call every strange ink mark an offset error.</p>
<p>Compare: - Direction - Mirroring - Ink characteristics - Placement</p>
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
<p>A genuine foldover error is much more interesting than an ordinary
crease.</p>
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
<p>A note with an entirely missing reverse printing can be an important
error.</p>
<h3>But verify</h3>
<p>Make sure the reverse was actually never printed.</p>
<p>Do not confuse: - Heavy wear - Chemical damage - Ink removal -
Counterfeit manufacture</p>
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
<p>A dramatic error affecting an important design element can be
considerably more collectible than a tiny ink spot.</p>
<hr>
<h1>37. SEAL ERRORS</h1>
<p>The Treasury seal and Federal Reserve seal are important diagnostic
features.</p>
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
<p>Silver Certificates were U.S. currency certificates backed by silver
held by the Treasury.</p>
<p>They were first issued in <strong>1878</strong>.</p>
<p>The BEP lists Silver Certificates as an official U.S. currency issue
from <strong>1878 through 1965</strong>.</p>
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
<p>A circulated 1957 blue-seal $1 usually does not belong in the same
category as a scarce early Silver Certificate.</p>
<hr>
<h1>41. 1957-B / 1957-C / OTHER VARIANTS</h1>
<p>Study: - Series - Signatures - Serial range - Seal - Condition</p>
<p>Some signature/series combinations are more desirable.</p>
<hr>
<h1>42. SPECIAL SILVER CERTIFICATE NOTES</h1>
<p>Look especially for:</p>
<ul>
<li>1899 $1 Black Eagle</li>
<li>1896 $1 Educational Silver Certificate</li>
<li>1923 $1</li>
<li>1928 series</li>
<li>1934 series</li>
<li>1935 series</li>
<li>1957 series</li>
</ul>
<p>Older Silver Certificates should almost always be researched before
being spent.</p>
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
<p>Gold Certificates were certificates associated with gold held by the
Treasury.</p>
<p>They were first issued in <strong>1865</strong>.</p>
<p>The BEP lists Gold Certificates as an official currency issue from
<strong>1865 through 1936</strong>.</p>
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
<p>United States Notes were authorized beginning in 1862. Their issuance
was discontinued in 1971; outstanding United States Notes remain legal
tender at face value.</p>
<hr>
<h1>48. RED-SEAL $2 NOTES</h1>
<p>If you see an older $2 with:</p>
<p><strong>red seal</strong></p>
<p>do not spend it automatically.</p>
<p>Check: - Series - Signatures - Serial number - Condition</p>
<hr>
<h1>49. RED-SEAL $5 / $10 / $20 / ETC.</h1>
<p>Older United States Notes can occur in denominations beyond $2.</p>
<p>They are historical collectible currency.</p>
<hr>
<h1>50. FEDERAL RESERVE NOTES</h1>
<p>Modern U.S. paper money is primarily Federal Reserve Notes.</p>
<p>Federal Reserve Notes began in <strong>1914</strong>.</p>
<p>The Bureau of Engraving and Printing prints the Federal Reserve notes
ordered by the Federal Reserve Board. The seven currently issued
denominations are $1, $2, $5, $10, $20, $50, and $100.</p>
<hr>
<h1>51. LARGE-SIZE FEDERAL RESERVE NOTES</h1>
<p>Before the 1929 redesign, U.S. paper currency was substantially larger.
Large-size notes are generally about 7.375 × 3.125 inches, while
small-size notes are about 6.14 × 2.61 inches.</p>
<p>Large-size notes measure approximately:</p>
<p><strong>7.375 × 3.125 inches</strong></p>
<p>Modern small-size notes are approximately:</p>
<p><strong>6.14 × 2.61 inches</strong></p>
<p>The 1929 redesign reduced the physical size of U.S. paper money by about
30 percent.</p>
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
<p>A genuine National Bank Note is not simply an ordinary Federal Reserve
Note.</p>
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
<p>The BEP states that these notes remain legal tender, although most are
in private collections.</p>
<h3>If found</h3>
<p>Do not spend it.</p>
<p>Do not sell it to the first person who offers cash.</p>
<p>Have it professionally evaluated.</p>
<hr>
<h1>54. $100,000 GOLD CERTIFICATE</h1>
<p>The $100,000 Gold Certificate, Series 1934, was used only for
transactions between Federal Reserve Banks.</p>
<p>It was <strong>not circulated among the general public</strong> and cannot legally be
held by currency collectors.</p>
<p>If someone offers you one from an ordinary collection, be extremely
skeptical.</p>
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
<p><strong>A single vertical fold can substantially reduce the value of an
otherwise beautiful note.</strong></p>
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
<p>Improper pressing/flattening can affect collector value and may be
detectable.</p>
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
<p>Therefore record the <strong>entire serial number</strong>, not just the eight
digits.</p>
<p>The BEP&#39;s current serial-number explanation provides the official
relationship between the prefixes and Federal Reserve districts.</p>
<hr>
<h1>62. THE TWO SERIAL NUMBERS SHOULD MATCH</h1>
<p>On a normal note:</p>
<p><strong>Left serial = right serial</strong></p>
<p>If they do not match:</p>
<p><strong>STOP.</strong></p>
<p>This is one of the easiest potentially major errors for a beginner to
notice.</p>
<hr>
<h1>63. STAR NOTE + FANCY SERIAL</h1>
<p>A note can have both.</p>
<p>Example:</p>
<p><code>B12344321*</code></p>
<p>This combines: - Star replacement note - Radar serial</p>
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
<p>A fancy serial can be: - Extremely desirable - Moderately desirable -
Novelty-level</p>
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
<p>This denomination deserves special attention because it has a long
history of major collectible varieties.</p>
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
<p>The BEP notes that security thread and microprinting first appeared on
Series 1990 $100 notes.</p>
<hr>
<h1>67. OLD $1 NOTES --- QUICK REFERENCE</h1>
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
<p>These are useful beginner clues, but <strong>always identify the complete
issue</strong>.</p>
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
<p>The BEP&#39;s historical currency timeline lists these major issue families
and their periods.</p>
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
<p>The older and more valuable the note appears, the more important
authentication becomes.</p>
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
<p>The BEP describes currency paper as approximately <strong>75% cotton and 25%
linen</strong>, and an individual note weighs approximately one gram regardless
of denomination.</p>
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
<p>By Series 1993, these features appeared on all denominations except $1
and $2.</p>
<p>This makes 1990s notes useful for learning the evolution of U.S.
anti-counterfeiting technology.</p>
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
<p>If a person served only briefly, fewer notes may have been produced
bearing that signature.</p>
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
<p>Some notes carry facility-related identifiers that can be useful to
advanced collectors.</p>
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
<p>Avoid: - Tape - Staples - Paper clips - Lamination - Plastic bags of
unknown composition</p>
<hr>
<h1>81. HOW TO HANDLE A NOTE</h1>
<p>Hold it by the edges.</p>
<p>Do not: - Fold it - Bend it - Write on it - Put fingerprints across the
face - Wet it - Press it</p>
<p>For very valuable notes, use cotton/nitrile gloves only when appropriate
and avoid dropping the note.</p>
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
<li>Assume a printing error is genuine without checking the
manufacturing process.</li>
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
<p>  Seal          Common association</p>
<hr>
<p>  Green         Federal Reserve Note
  Blue          Silver Certificate
  Red           United States Note / Legal Tender
  Gold/Orange   Gold Certificate
  Brown         Several older/historical issues</p>
<p><strong>This table is a starting point, not a complete attribution guide.</strong></p>
<p>Older currency used more complicated seal systems.</p>
<hr>
<h1>89. QUICK REFERENCE: U.S. PAPER MONEY ERAS</h1>
<p>  Era            Things to learn</p>
<hr>
<p>  1861-1862      Demand Notes
  1862-1994      United States Notes
  1862-1876      Fractional Currency
  1863-1938      National Bank Notes
  1865-1936      Gold Certificates
  1878-1965      Silver Certificates
  1890-1899      Treasury Notes
  1914-present   Federal Reserve Notes
  1915-1945      Federal Reserve Bank Notes
  1929-present   Small-size currency</p>
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
<p>When a coin looks strange, you inspect the <strong>date, mintmark, weight, and
design</strong>.</p>
<p>When paper currency looks strange, inspect:</p>
<p><strong>TYPE → SERIES → SIGNATURES → SEAL → DISTRICT → SERIAL → CONDITION →
ERROR</strong></p>
<p>That sequence will prevent a huge number of beginner mistakes.</p>
<p>The best currency hunters don&#39;t just memorize &quot;valuable bills.&quot;</p>
<p>They learn to recognize <strong>how U.S. currency was manufactured, numbered,
signed, sealed, issued, and replaced</strong>.</p>
<p>Once you understand those systems, the unusual notes start becoming much
easier to spot.</p>
<hr>
<h1>OFFICIAL REFERENCE SOURCES</h1>
<p>For identification and authentication research, start with the U.S.
Bureau of Engraving and Printing:</p>
<ul>
<li><strong>Circulating Currency</strong></li>
<li><strong>Historical Currency</strong></li>
<li><strong>Currency History</strong></li>
<li><strong>Serial Numbers</strong></li>
<li><strong>Denomination-specific currency pages</strong></li>
</ul>
<p>The BEP confirms that it currently prints $1, $2, $5, $10, $20,
$50 and $100 notes, and provides official information about serial
numbers, security features, historical issues, and currency types.</p>
<p>For collectible attribution and grading, use established numismatic
references and professional grading services rather than relying solely
on social-media posts or online marketplace asking prices.</p>
<hr>
<h1>94. EXPANDED FIELD GUIDE: HOW TO ACTUALLY HUNT PAPER MONEY</h1>
<p>This section turns the identification material above into a practical
roll-hunting and cash-sorting system.</p>
<h2>The Golden Rule</h2>
<p><strong>Do not try to decide what a note is worth while you are still
identifying it.</strong></p>
<p>First identify the note. Then determine whether it is a recognized
variety, scarce issue, fancy serial, star note, or genuine error. Only
after that should you research value.</p>
<hr>
<h1>95. THREE LEVELS OF FINDS</h1>
<p>Use three mental buckets while sorting.</p>
<h2>LEVEL A --- STOP IMMEDIATELY</h2>
<p>Set the note aside and do not spend it if you find:</p>
<ul>
<li>A genuine serial-number mismatch</li>
<li>A major printing error</li>
<li>A large-size note</li>
<li>A Demand Note</li>
<li>A National Bank Note</li>
<li>A Gold Certificate</li>
<li>An early Silver Certificate</li>
<li>An early United States Note</li>
<li>A high-denomination note</li>
<li>A note that appears to be a major rarity</li>
<li>A suspected counterfeit</li>
<li>A note with an unusual production feature you cannot explain</li>
</ul>
<h2>LEVEL B --- PULL AND RESEARCH</h2>
<p>Set aside:</p>
<ul>
<li>Star notes</li>
<li>Older $2 notes</li>
<li>1935 and 1957 Silver Certificates</li>
<li>Older red-seal notes</li>
<li>Fancy serial numbers</li>
<li>Very low serial numbers</li>
<li>Interesting signature combinations</li>
<li>Crisp older notes</li>
<li>Unusual seals</li>
<li>Dramatic cutting or alignment abnormalities</li>
<li>Older Federal Reserve Notes</li>
<li>Notes with unusual district combinations</li>
</ul>
<h2>LEVEL C --- KEEP ONLY IF YOU COLLECT THEM</h2>
<p>These include:</p>
<ul>
<li>Mildly interesting serial numbers</li>
<li>Common star notes</li>
<li>Ordinary circulated $2 notes</li>
<li>Common older-design Federal Reserve Notes</li>
<li>Personal-date serial numbers</li>
<li>Minor printing variations</li>
<li>Slightly uneven margins</li>
</ul>
<p>The purpose of this three-level system is to prevent a beginner from
filling an entire box with notes that have little collector demand.</p>
<hr>
<h1>96. THE $1 NOTE --- DETAILED HUNTING GUIDE</h1>
<p>The $1 is the most practical denomination for everyday hunting because
enormous numbers circulate.</p>
<h2>Highest-priority $1 finds</h2>
<p>Pull and research:</p>
<ul>
<li>1935-series Silver Certificates</li>
<li>1957-series Silver Certificates</li>
<li>Star notes</li>
<li>Barr signature notes</li>
<li>Very low serial numbers</li>
<li>Solid serial numbers</li>
<li>True radars</li>
<li>True repeaters</li>
<li>True ladders</li>
<li>Major serial-number errors</li>
<li>Major printing errors</li>
<li>Older large-size $1 notes</li>
</ul>
<h2>Important $1 distinction</h2>
<p>A modern $1 Federal Reserve Note normally has:</p>
<ul>
<li>One letter</li>
<li>Eight digits</li>
<li>One suffix letter or star</li>
</ul>
<p>Example:</p>
<p><code>B12345678C</code></p>
<p>The first letter identifies the Federal Reserve Bank.</p>
<p>Do not apply the modern $5-and-higher two-letter-prefix rule to the
$1.</p>
<h2>$1 Silver Certificates</h2>
<p>The most common examples encountered by modern collectors are 1935 and
1957 series notes.</p>
<p>Common does not mean worthless, but common circulated examples should
not automatically be treated as rare notes.</p>
<p>Check:</p>
<ul>
<li>Series</li>
<li>Signature combination</li>
<li>Serial number</li>
<li>Star</li>
<li>Condition</li>
<li>Variety</li>
<li>Any unusual production characteristic</li>
</ul>
<h2>Barr notes</h2>
<p>Series 1963B $1 Federal Reserve Notes bearing Joseph W. Barr&#39;s
signature are a famous collectible signature combination.</p>
<p>Do not identify a Barr note from the series alone. <strong>Look at the actual
Secretary of the Treasury signature.</strong></p>
<hr>
<h1>97. THE $2 NOTE --- DETAILED HUNTING GUIDE</h1>
<p>The $2 denomination is one of the best beginner hunting areas because
many people overlook it.</p>
<h2>Pull immediately</h2>
<ul>
<li>Large-size $2 notes</li>
<li>1928-series red-seal notes</li>
<li>1953-series red-seal notes</li>
<li>1963-series red-seal notes</li>
<li>Star notes</li>
<li>Very low serial numbers</li>
<li>Fancy serial numbers</li>
<li>Major errors</li>
<li>Extremely crisp older examples</li>
</ul>
<h2>Modern $2</h2>
<p>The current $2 design dates to the Federal Reserve Note reintroduction
in 1976.</p>
<p>A 1976 $2 is not automatically rare.</p>
<p>Check:</p>
<ul>
<li>Series</li>
<li>District</li>
<li>Serial number</li>
<li>Star</li>
<li>Condition</li>
<li>Error</li>
</ul>
<h2>Common mistake</h2>
<p>Do not assume that every red-seal $2 is a major rarity.</p>
<p>Red seal identifies an issue family; the exact series and variety still
matter.</p>
<hr>
<h1>98. THE $5 NOTE --- DETAILED HUNTING GUIDE</h1>
<h2>Pull and research</h2>
<ul>
<li>1914 and other large-size Federal Reserve Notes</li>
<li>Large-size United States Notes</li>
<li>Silver Certificates</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Low serials</li>
<li>Major errors</li>
<li>Scarce signature combinations</li>
<li>Very high-grade older notes</li>
</ul>
<h2>Modern $5 milestones</h2>
<p>Useful design checkpoints include:</p>
<ul>
<li>1914--1990 style</li>
<li>1990--1993 style</li>
<li>1993--2000 style</li>
<li>2000--2008 style</li>
<li>2008--present style</li>
</ul>
<p>The 1990 security-thread/microprinting milestone is especially useful
when learning modern currency evolution.</p>
<hr>
<h1>99. THE $10 NOTE --- DETAILED HUNTING GUIDE</h1>
<h2>Pull and research</h2>
<ul>
<li>Large-size notes</li>
<li>Gold Certificates</li>
<li>Silver Certificates</li>
<li>United States Notes</li>
<li>Federal Reserve Bank Notes</li>
<li>Early Federal Reserve Notes</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Major errors</li>
<li>Scarce signature combinations</li>
</ul>
<h2>Modern $10 checkpoints</h2>
<p>Learn the visual differences among:</p>
<ul>
<li>1914--1990</li>
<li>1990--2000</li>
<li>2000--2006</li>
<li>2006--present</li>
</ul>
<p>The security-thread and microprinting transition makes 1990s $10 notes
particularly useful for learning production changes.</p>
<hr>
<h1>100. THE $20 NOTE --- DETAILED HUNTING GUIDE</h1>
<h2>Pull and research</h2>
<ul>
<li>Large-size notes</li>
<li>Gold Certificates</li>
<li>Silver Certificates</li>
<li>United States Notes</li>
<li>Federal Reserve Bank Notes</li>
<li>Early Federal Reserve Notes</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Major errors</li>
<li>Scarce signature combinations</li>
</ul>
<h2>Modern $20 checkpoints</h2>
<p>Learn:</p>
<ul>
<li>1914--1990</li>
<li>1990--1998</li>
<li>1998--2003</li>
<li>2003--present</li>
</ul>
<p>The 2003 redesign introduced additional security features and is an
important visual breakpoint.</p>
<hr>
<h1>101. THE $50 NOTE --- DETAILED HUNTING GUIDE</h1>
<p>The $50 is less common in casual roll hunting than the $1, $5, $10,
or $20, but every older example deserves attention.</p>
<p>Pull:</p>
<ul>
<li>Large-size notes</li>
<li>Gold Certificates</li>
<li>Early Federal Reserve Notes</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Major errors</li>
<li>Scarce signatures</li>
<li>Very high-grade examples</li>
</ul>
<p>Modern checkpoints include:</p>
<ul>
<li>1914--1990</li>
<li>1990s redesign</li>
<li>1997 redesign</li>
<li>2004 redesign</li>
</ul>
<hr>
<h1>102. THE $100 NOTE --- DETAILED HUNTING GUIDE</h1>
<p>The $100 is one of the most historically diverse denominations.</p>
<h2>Pull and research</h2>
<ul>
<li>Large-size notes</li>
<li>Gold Certificates</li>
<li>Silver Certificates</li>
<li>United States Notes</li>
<li>Early Federal Reserve Notes</li>
<li>1914 Federal Reserve Notes</li>
<li>1918 Federal Reserve Notes</li>
<li>1928 and later issues</li>
<li>Star notes</li>
<li>Fancy serials</li>
<li>Major errors</li>
<li>Scarce signatures</li>
</ul>
<h2>Security-feature milestone</h2>
<p>Series 1990 $100 notes were the first U.S. notes to receive the new
security thread and microprinting features introduced in that period.</p>
<p>Modern $100 design checkpoints include:</p>
<ul>
<li>1914--1990</li>
<li>1990--1996</li>
<li>1996--2013</li>
<li>2013--present</li>
</ul>
<hr>
<h1>103. LARGE-SIZE NOTES --- MASTER PULL LIST</h1>
<p>Large-size currency is generally recognizable immediately because it is
physically larger than modern notes.</p>
<p>Approximate dimensions:</p>
<p><strong>Large size:</strong> 7.375 × 3.125 inches</p>
<p><strong>Small size:</strong> 6.14 × 2.61 inches</p>
<p>If a note is substantially larger than a modern bill, stop and identify
it before doing anything else.</p>
<h2>Large-size note families worth learning</h2>
<ul>
<li>United States Notes</li>
<li>Silver Certificates</li>
<li>Gold Certificates</li>
<li>Treasury Notes / Treasury Coin Notes</li>
<li>Federal Reserve Notes</li>
<li>Federal Reserve Bank Notes</li>
<li>National Bank Notes</li>
<li>Demand Notes</li>
<li>Fractional Currency</li>
</ul>
<p>Large-size currency is a field of its own. Exact type, Friedberg number,
signatures, seal, district, and condition are often necessary for
attribution.</p>
<hr>
<h1>104. CERTIFICATE IDENTIFICATION --- DO NOT STOP AT THE SEAL</h1>
<p>Seal color is a clue, not a complete identification.</p>
<h2>Blue seal</h2>
<p>Often associated with Silver Certificates.</p>
<p>But:</p>
<p><strong>Blue seal alone does not tell you the exact value or rarity.</strong></p>
<h2>Gold/orange seal</h2>
<p>Often associated with Gold Certificates.</p>
<p>Again:</p>
<p><strong>Identify the exact issue.</strong></p>
<h2>Red seal</h2>
<p>Often associated with United States Notes / Legal Tender Notes.</p>
<p>Again:</p>
<p><strong>Identify the exact series.</strong></p>
<h2>Green seal</h2>
<p>Commonly associated with Federal Reserve Notes.</p>
<p>The green seal by itself does not make a note common or rare.</p>
<hr>
<h1>105. FRIEDBERG NUMBERS --- WHY ADVANCED COLLECTORS USE THEM</h1>
<p>Collectors and dealers frequently use Friedberg numbers, usually written
as <strong>Fr.</strong> followed by a number, to identify specific U.S. paper-money
varieties.</p>
<p>Example format:</p>
<p><code>Fr. 236</code></p>
<p>A Friedberg number can distinguish varieties that share the same general
series and denomination.</p>
<p>When researching a potentially valuable note, record:</p>
<ol>
<li>Denomination</li>
<li>Series</li>
<li>Note type</li>
<li>Friedberg number if known</li>
<li>Signature combination</li>
<li>Federal Reserve district</li>
<li>Serial number</li>
<li>Star status</li>
<li>Condition</li>
<li>Error or variety</li>
</ol>
<p><strong>Do not guess a Friedberg number from memory.</strong></p>
<p>Use a current specialized catalog or trusted attribution source.</p>
<hr>
<h1>106. SIGNATURES --- BUILD YOUR OWN REFERENCE SYSTEM</h1>
<p>Do not attempt to memorize every signature combination at once.</p>
<p>Instead, build a table for each denomination.</p>
<hr>
<p>  Denomination   Series    Secretary   Treasurer   District   Star?     Notes</p>
<hr>
<p>  $1                                                                   </p>
<p>  $2                                                                   </p>
<p>  $5                                                                   </p>
<p>  $10                                                                  </p>
<p>  $20                                                                  </p>
<p>  $50                                                                  </p>
<h2>  $100                                                                 </h2>
<h2>Signature-hunting strategy</h2>
<p>When you find an older note:</p>
<p><strong>Series → Secretary → Treasurer → District → Serial range → Condition</strong></p>
<p>Then research the exact combination.</p>
<p>This is much safer than relying on a list of &quot;old-looking signatures.&quot;</p>
<hr>
<h1>107. FEDERAL RESERVE DISTRICT IDENTIFICATION</h1>
<p>There are 12 Federal Reserve Banks.</p>
<p>  Letter   Bank</p>
<hr>
<p>  A        Boston
  B        New York
  C        Philadelphia
  D        Cleveland
  E        Richmond
  F        Atlanta
  G        Chicago
  H        St. Louis
  I        Minneapolis
  J        Kansas City
  K        Dallas
  L        San Francisco</p>
<h2>Modern $5--$100 notes</h2>
<p>The second serial-number letter identifies the issuing Federal Reserve
Bank.</p>
<p>The note also has a Federal Reserve indicator such as:</p>
<p><code>A1</code></p>
<p><code>B2</code></p>
<p><code>C3</code></p>
<p>and so on.</p>
<p>These two systems should agree.</p>
<h2>$1 and $2</h2>
<p>The serial-number system is different. Do not use the $5--$100
two-letter-prefix rule on these denominations.</p>
<hr>
<h1>108. SERIAL-NUMBER PATTERN SCORECARD</h1>
<p>Instead of treating every &quot;cool number&quot; equally, classify it.</p>
<h2>Tier 1 --- Strong</h2>
<ul>
<li>00000001</li>
<li>00000002</li>
<li>00000003</li>
<li>00000007</li>
<li>11111111</li>
<li>22222222</li>
<li>33333333</li>
<li>12345678</li>
<li>87654321</li>
<li>Strong true radar</li>
<li>Strong true repeater</li>
<li>Major serial-number error</li>
</ul>
<h2>Tier 2 --- Good</h2>
<ul>
<li>00000010</li>
<li>00000100</li>
<li>00001000</li>
<li>10101010</li>
<li>12121212</li>
<li>12341234</li>
<li>11223344</li>
<li>Strong birthday</li>
<li>Seven-of-a-kind</li>
<li>Strong year pattern</li>
</ul>
<h2>Tier 3 --- Interesting</h2>
<ul>
<li>Partial ladder</li>
<li>Near solid</li>
<li>Weak repeater</li>
<li>Personal date</li>
<li>Recognizable year</li>
<li>Mild repeated pairs</li>
</ul>
<h3>Important</h3>
<p>This is a <strong>hunting priority system, not a price guide</strong>.</p>
<p>The market may value two apparently similar serial numbers very
differently.</p>
<hr>
<h1>109. SERIAL NUMBERS THAT BEGIN WITH ZERO</h1>
<p>Leading zeroes are important.</p>
<p>Treat:</p>
<p><code>00001234</code></p>
<p>as an eight-digit serial number.</p>
<p>Do not rewrite it as:</p>
<p><code>1234</code></p>
<p>When recording a note, preserve every digit exactly as printed.</p>
<hr>
<h1>110. SERIAL-NUMBER ERROR TRIAGE</h1>
<p>If the two serial numbers do not match:</p>
<h3>Step 1</h3>
<p>Photograph both.</p>
<h3>Step 2</h3>
<p>Check whether one is actually a star replacement.</p>
<h3>Step 3</h3>
<p>Compare the complete serials, including letters.</p>
<h3>Step 4</h3>
<p>Check the note&#39;s denomination and series.</p>
<h3>Step 5</h3>
<p>Do not alter the note.</p>
<h3>Step 6</h3>
<p>Seek specialist attribution.</p>
<p>A genuine mismatched serial-number error can be substantially more
important than an ordinary fancy serial.</p>
<hr>
<h1>111. ERROR OR DAMAGE?</h1>
<p>This is one of the most important skills in paper-money collecting.</p>
<h2>More likely to be a production error</h2>
<ul>
<li>Printing clearly missing where it should exist</li>
<li>A fold that caused a displaced print impression</li>
<li>Dramatic cutting that exposes neighboring-note design</li>
<li>Genuine offset transfer</li>
<li>Clearly doubled or misplaced printing</li>
<li>Serial-number mismatch produced during printing</li>
<li>Major misregistration</li>
<li>Missing design components</li>
</ul>
<h2>More likely to be damage</h2>
<ul>
<li>Ink rubbed off by handling</li>
<li>Chemical bleaching</li>
<li>Writing</li>
<li>Tape residue</li>
<li>Glue</li>
<li>Tears</li>
<li>Artificial folds</li>
<li>Washed paper</li>
<li>Trimmed edges</li>
<li>Stains caused after printing</li>
</ul>
<h3>The test</h3>
<p>Ask:</p>
<p><strong>Can the strange feature be explained by something that happened after
the note left the printing process?</strong></p>
<p>If yes, be cautious about calling it an error.</p>
<hr>
<h1>112. CUTTING-ERROR CHECK</h1>
<p>A genuine cutting error is not simply a note with a crooked-looking
edge.</p>
<p>Look for evidence that the note was cut incorrectly relative to the
original sheet layout.</p>
<p>Strong clues include:</p>
<ul>
<li>Part of a neighboring note&#39;s design</li>
<li>Dramatically abnormal margins</li>
<li>Design elements cut into the border</li>
<li>A clearly displaced cut line</li>
<li>A combination of unusual margins and neighboring-note evidence</li>
</ul>
<p>Minor unevenness should not automatically be called an error.</p>
<hr>
<h1>113. OFFSET ERROR CHECK</h1>
<p>A suspected offset should be evaluated for:</p>
<ul>
<li>Mirrored appearance</li>
<li>Correct ink color</li>
<li>Corresponding design shapes</li>
<li>Appropriate placement</li>
<li>Evidence that the transferred ink originated from the printing
process</li>
</ul>
<p>Random stains, fingerprints, ink from another object, and chemical marks
are not automatically offsets.</p>
<hr>
<h1>114. FOLDOVER ERROR CHECK</h1>
<p>A true foldover error should show evidence that the paper was folded
when printing occurred.</p>
<p>Look for:</p>
<ul>
<li>Missing design where the fold blocked the impression</li>
<li>Printing transferred onto the folded portion</li>
<li>An abnormal margin caused by the folded sheet</li>
<li>A consistent relationship between the fold and the displaced/missing
print</li>
</ul>
<p>An ordinary crease acquired during circulation is not a foldover error.</p>
<hr>
<h1>115. STAR-NOTE HUNTING --- A BETTER METHOD</h1>
<p>Do not simply collect every star note and assume they are rare.</p>
<p>Record:</p>
<ul>
<li>Denomination</li>
<li>Series</li>
<li>District</li>
<li>Serial range</li>
<li>Star suffix</li>
<li>Condition</li>
<li>Whether the run appears limited</li>
<li>Whether the note has another desirable feature</li>
</ul>
<h2>Star + fancy serial</h2>
<p>A star note with a strong fancy serial deserves extra attention.</p>
<h2>Star + error</h2>
<p>A genuine production error combined with a star replacement feature may
deserve specialist attribution.</p>
<hr>
<h1>116. CONDITION --- A MORE PRACTICAL APPROACH</h1>
<p>For hunting purposes, ask these questions:</p>
<h3>1. Are there folds?</h3>
<p>Count and inspect them.</p>
<h3>2. Are there corner bends?</h3>
<p>A bent corner may affect grade.</p>
<h3>3. Are there tears?</h3>
<p>Record location and size.</p>
<h3>4. Are there stains?</h3>
<p>Do not clean them.</p>
<h3>5. Is the paper crisp?</h3>
<p>Crispness can matter greatly for collectible notes.</p>
<h3>6. Is there writing?</h3>
<p>Writing generally affects desirability.</p>
<h3>7. Are there pinholes?</h3>
<p>Especially important on older notes.</p>
<h3>8. Has the note been repaired?</h3>
<p>Tape, glue, pressing, trimming, and other repairs can materially affect
collector value.</p>
<hr>
<h1>117. STORAGE --- FIELD-READY SYSTEM</h1>
<p>For notes you intend to keep:</p>
<ul>
<li>Use archival-quality currency holders</li>
<li>Avoid PVC</li>
<li>Keep notes flat</li>
<li>Keep them away from direct sunlight</li>
<li>Avoid excessive humidity</li>
<li>Avoid adhesives</li>
<li>Avoid rubber bands</li>
<li>Avoid paper clips</li>
<li>Avoid tape</li>
<li>Avoid lamination</li>
</ul>
<h2>Label each holder</h2>
<p>Write the identification on the holder or a separate inventory record
rather than writing on the currency.</p>
<p>Recommended label:</p>
<p><code>$1 — Series 1957 — Silver Certificate — Star — Serial XXXXXXXX — Condition: circulated</code></p>
<hr>
<h1>118. YOUR PAPER-MONEY INVENTORY DATABASE</h1>
<p>For serious hunting, create a spreadsheet with these columns:</p>
<p>  Field             What to record</p>
<hr>
<p>  Inventory ID      Your own identifier
  Denomination      $1, $2, etc.
  Note type         FRN, SC, USN, etc.
  Series            Exact series
  Fr. number        If known
  Secretary         Exact name
  Treasurer         Exact name
  District          FRB
  Serial #1         Complete
  Serial #2         Complete
  Star              Yes/No
  Serial pattern    Radar, repeater, etc.
  Seal              Color/type
  Error             Description
  Condition         Your preliminary assessment
  Source            Catalog/reference used
  Purchase/source   Bank, roll, estate, etc.
  Cost basis        Optional
  Photos            File name
  Authentication    Yes/No
  Notes             Anything unusual</p>
<p>This turns casual hunting into a searchable collection.</p>
<hr>
<h1>119. PHOTOGRAPHING NOTES FOR RESEARCH</h1>
<p>Take photographs in this order:</p>
<ol>
<li>Full front</li>
<li>Full back</li>
<li>Left serial</li>
<li>Right serial</li>
<li>Treasury seal</li>
<li>Federal Reserve seal/indicator</li>
<li>Series year</li>
<li>Signatures</li>
<li>Error area</li>
<li>Edges</li>
<li>Corners</li>
<li>Any unusual markings</li>
</ol>
<p>Use even lighting and avoid glare.</p>
<p>Do not write directly on the note to identify it.</p>
<hr>
<h1>120. WHEN TO USE PROFESSIONAL GRADING</h1>
<p>Consider professional authentication/grading when:</p>
<ul>
<li>The note appears rare</li>
<li>The note may have a major error</li>
<li>The note is an expensive historical issue</li>
<li>Authenticity is uncertain</li>
<li>Condition is important to value</li>
<li>You are preparing to sell a significant note</li>
<li>A dealer or buyer questions authenticity</li>
<li>The note appears dramatically different from normal examples</li>
</ul>
<p>Do not spend large amounts on grading simply because a note is old.</p>
<hr>
<h1>121. AUTHENTICATION BEFORE VALUE</h1>
<p>Use this sequence:</p>
<p><strong>AUTHENTIC?</strong></p>
<p>↓</p>
<p><strong>WHAT TYPE?</strong></p>
<p>↓</p>
<p><strong>WHAT SERIES?</strong></p>
<p>↓</p>
<p><strong>WHAT VARIETY?</strong></p>
<p>↓</p>
<p><strong>WHAT FRIEDBERG NUMBER?</strong></p>
<p>↓</p>
<p><strong>WHAT SIGNATURE COMBINATION?</strong></p>
<p>↓</p>
<p><strong>WHAT DISTRICT?</strong></p>
<p>↓</p>
<p><strong>WHAT SERIAL?</strong></p>
<p>↓</p>
<p><strong>WHAT CONDITION?</strong></p>
<p>↓</p>
<p><strong>ERROR OR VARIETY?</strong></p>
<p>↓</p>
<p><strong>WHAT IS THE MARKET?</strong></p>
<p>This order prevents one of the most common collecting mistakes: looking
at an asking price before knowing exactly what the note is.</p>
<hr>
<h1>122. MARKET-PRICE WARNING</h1>
<p>Online marketplace asking prices are not the same thing as realized
prices.</p>
<p>When researching value, distinguish:</p>
<ul>
<li>Asking price</li>
<li>Sold price</li>
<li>Auction realization</li>
<li>Dealer offer</li>
<li>Insurance value</li>
<li>Catalog estimate</li>
</ul>
<p>For serious notes, prioritize documented sales and recognized numismatic
references.</p>
<hr>
<h1>123. COMMON BEGINNER MISTAKES</h1>
<h2>Mistake 1: &quot;It&#39;s old, so it is valuable.&quot;</h2>
<p>Not necessarily.</p>
<h2>Mistake 2: &quot;It&#39;s a star, so it is rare.&quot;</h2>
<p>Not necessarily.</p>
<h2>Mistake 3: &quot;It has a cool serial, so it is worth hundreds.&quot;</h2>
<p>Not necessarily.</p>
<h2>Mistake 4: &quot;Blue seal means rare.&quot;</h2>
<p>No.</p>
<h2>Mistake 5: &quot;Red seal means rare.&quot;</h2>
<p>No.</p>
<h2>Mistake 6: &quot;The margin is crooked, so it is an error.&quot;</h2>
<p>Not necessarily.</p>
<h2>Mistake 7: &quot;The note looks different, so it is an error.&quot;</h2>
<p>Compare it with normal production examples.</p>
<h2>Mistake 8: &quot;I can clean it.&quot;</h2>
<p>Do not.</p>
<h2>Mistake 9: &quot;I found the value on eBay.&quot;</h2>
<p>Check completed sales and specialized references.</p>
<h2>Mistake 10: &quot;I only need the serial number.&quot;</h2>
<p>You need the entire note attribution.</p>
<hr>
<h1>124. THE 10-SECOND BANK-TELLER CHECK</h1>
<p>When receiving a note in everyday circulation:</p>
<h3>Look at the front</h3>
<ul>
<li>Denomination</li>
<li>Series</li>
<li>Serial</li>
<li>Star</li>
<li>Seal</li>
<li>Signatures</li>
</ul>
<h3>Flip it</h3>
<ul>
<li>Design</li>
<li>Major printing abnormality</li>
<li>Cutting abnormality</li>
<li>Missing print</li>
</ul>
<h3>If anything is unusual</h3>
<p><strong>Pull it.</strong></p>
<p>Research later.</p>
<hr>
<h1>125. THE 60-SECOND ADVANCED CHECK</h1>
<p>If a note passes the first screen:</p>
<ol>
<li>Identify type.</li>
<li>Confirm denomination.</li>
<li>Confirm series.</li>
<li>Read both serials.</li>
<li>Check star.</li>
<li>Identify Federal Reserve district.</li>
<li>Read signatures.</li>
<li>Check seal.</li>
<li>Check serial pattern.</li>
<li>Inspect printing.</li>
<li>Inspect margins.</li>
<li>Inspect condition.</li>
<li>Photograph it.</li>
<li>Record it.</li>
<li>Research exact variety.</li>
</ol>
<hr>
<h1>126. THE &quot;DO NOT SPEND&quot; MASTER LIST</h1>
<p>Do not casually spend a note that is:</p>
<ul>
<li>Pre-1929 large size</li>
<li>A Demand Note</li>
<li>A National Bank Note</li>
<li>A Gold Certificate</li>
<li>An early Silver Certificate</li>
<li>An early United States Note</li>
<li>A Federal Reserve Bank Note</li>
<li>A high denomination</li>
<li>A suspected major error</li>
<li>A mismatched-serial note</li>
<li>A major fancy serial</li>
<li>An unusually low serial</li>
<li>A scarce-looking star note</li>
<li>A note with an unusual signature combination</li>
<li>A note whose authenticity is uncertain</li>
</ul>
<hr>
<h1>127. HISTORICAL CURRENCY ISSUE FAMILIES</h1>
<p>The major federal issue families include:</p>
<p>  Issue                        Approximate period</p>
<hr>
<p>  Demand Notes                 1861--1862
  United States Notes          1862--1994 issue family
  Fractional Currency          1862--1876
  National Bank Notes          1863--1938
  Gold Certificates            1865--1936
  Silver Certificates          1878--1965
  Treasury Coin Notes          1890--1899
  Federal Reserve Notes        1914--present
  Federal Reserve Bank Notes   1915--1945</p>
<p>These dates identify broad issue families. They do <strong>not</strong> replace exact
series and variety attribution.</p>
<hr>
<h1>128. IMPORTANT: &quot;LEGAL TENDER&quot; IS NOT A COLLECTOR-GRADE DESCRIPTION</h1>
<p>&quot;Legal tender&quot; describes a legal status, not a rarity level.</p>
<p>A note can be:</p>
<ul>
<li>Legal tender and common</li>
<li>Legal tender and scarce</li>
<li>Legal tender and historically important</li>
<li>Legal tender and extremely rare</li>
</ul>
<p>Do not use legal-tender status as a substitute for identification.</p>
<hr>
<h1>129. IMPORTANT: &quot;STAR NOTE&quot; IS NOT A VALUE CATEGORY</h1>
<p>A star tells you something about the production/replacement process.</p>
<p>It does not by itself tell you:</p>
<ul>
<li>How rare the note is</li>
<li>How valuable it is</li>
<li>How many survive</li>
<li>What grade it deserves</li>
</ul>
<p>Always identify the exact issue.</p>
<hr>
<h1>130. IMPORTANT: &quot;ERROR&quot; IS NOT A VALUE CATEGORY</h1>
<p>A genuine error can range from minor to spectacular.</p>
<p>Ask:</p>
<ul>
<li>What printing operation produced the error?</li>
<li>How dramatic is it?</li>
<li>Is it unquestionably genuine?</li>
<li>How many examples are known?</li>
<li>Does the error affect an important design element?</li>
<li>Is the note otherwise desirable?</li>
<li>What condition is it in?</li>
</ul>
<hr>
<h1>131. SPECIALIST TERMS WORTH LEARNING</h1>
<p>As you progress, learn:</p>
<ul>
<li>Friedberg number / Fr. number</li>
<li>Mule</li>
<li>Overprint</li>
<li>Misalignment</li>
<li>Misregistration</li>
<li>Offset</li>
<li>Foldover</li>
<li>Obstruction</li>
<li>Missing print</li>
<li>Cutting error</li>
<li>Serial-number error</li>
<li>Star replacement</li>
<li>Plate position</li>
<li>Face plate</li>
<li>Back plate</li>
<li>Treasury seal</li>
<li>Federal Reserve seal</li>
<li>Signature combination</li>
<li>Large size</li>
<li>Small size</li>
<li>Legal Tender / United States Note</li>
<li>National Bank Note</li>
<li>Federal Reserve Bank Note</li>
<li>Federal Reserve Note</li>
<li>Silver Certificate</li>
<li>Gold Certificate</li>
<li>Treasury Note</li>
<li>Fractional Currency</li>
</ul>
<p>The more of this vocabulary you understand, the easier it becomes to
research a note accurately.</p>
<hr>
<h1>132. RESEARCH SOURCES --- PRIORITY ORDER</h1>
<p>For identification:</p>
<h3>1. U.S. Currency Education Program</h3>
<p>Use it for:</p>
<ul>
<li>Current designs</li>
<li>Security features</li>
<li>Historical timeline</li>
<li>Serial-number basics</li>
<li>Denomination information</li>
</ul>
<h3>2. Bureau of Engraving and Printing</h3>
<p>Use it for:</p>
<ul>
<li>Production information</li>
<li>Historical currency</li>
<li>Serial numbers</li>
<li>Printing facilities</li>
<li>Currency issue history</li>
</ul>
<h3>3. Specialized numismatic catalogs</h3>
<p>Use them for:</p>
<ul>
<li>Friedberg numbers</li>
<li>Signature varieties</li>
<li>Serial ranges</li>
<li>Detailed issue attribution</li>
</ul>
<h3>4. Professional grading services</h3>
<p>Use them for:</p>
<ul>
<li>Authentication information</li>
<li>Population data</li>
<li>Certified examples</li>
<li>Error attribution</li>
<li>Market research</li>
</ul>
<h3>5. Auction archives</h3>
<p>Use realized sales to understand the market.</p>
<h3>6. Marketplace listings</h3>
<p>Use cautiously.</p>
<p>An unsold asking price is not proof of market value.</p>
<hr>
<h1>133. MASTER RESEARCH CARD</h1>
<p>Copy this for every interesting note:</p>
<pre><code class="language-text">PAPER MONEY RESEARCH CARD

Denomination:
Note type:
Series:
Friedberg number:
Secretary:
Treasurer:
Federal Reserve district:
Federal Reserve indicator:
Serial #1:
Serial #2:
Star:
Serial pattern:
Seal:
Large or small size:
Printing facility, if identifiable:
Error/variety:
Condition:
Repairs/damage:
Authentication:
Reference #1:
Reference #2:
Comparable sales:
Estimated market range:
Final identification:
</code></pre>
<hr>
<h1>134. FINAL ADVANCED RULE</h1>
<p>When you find an unusual note, do not ask:</p>
<p><strong>&quot;How much is this worth?&quot;</strong></p>
<p>Ask:</p>
<p><strong>&quot;Exactly what is this?&quot;</strong></p>
<p>That question leads to:</p>
<p><strong>Type → Series → Variety → Signatures → District → Serial → Condition →
Error → Authentication → Market</strong></p>
<p>That is the workflow that separates casual &quot;old money&quot; hunting from
serious U.S. paper-money collecting.</p>
<hr>
<h1>135. CURRENT OFFICIAL REFERENCE CHECKPOINT</h1>
<p>The U.S. Currency Education Program currently identifies seven
circulating Federal Reserve denominations:</p>
<ul>
<li>$1</li>
<li>$2</li>
<li>$5</li>
<li>$10</li>
<li>$20</li>
<li>$50</li>
<li>$100</li>
</ul>
<p>It also provides denomination-specific history and authentication
guidance.</p>
<p>For current serial-number rules, remember:</p>
<ul>
<li>$1 and $2 retain the one-letter/eight-digit/letter-or-star format.</li>
<li>Modern $5 through $100 Federal Reserve Notes use a two-letter
prefix before the eight digits.</li>
<li>On those modern notes, the first letter relates to the series and
the second identifies the issuing Federal Reserve Bank.</li>
<li>The final letter may be replaced by a star for a replacement note.</li>
</ul>
<p>Always verify unusual notes against current official and specialized
references rather than relying on an old checklist.</p>
<hr>
<h1>136. MASTER POCKET CHECKLIST</h1>
<pre><code class="language-text">PAPER MONEY HUNT

[ ] Old?
[ ] Large size?
[ ] $2?
[ ] Blue seal?
[ ] Red seal?
[ ] Gold/orange seal?
[ ] Silver Certificate?
[ ] Gold Certificate?
[ ] United States Note?
[ ] National Bank Note?
[ ] Federal Reserve Bank Note?
[ ] Star?
[ ] Low serial?
[ ] Solid?
[ ] Near solid?
[ ] Radar?
[ ] Repeater?
[ ] Ladder?
[ ] Binary?
[ ] Birthday?
[ ] Year?
[ ] Seven-of-a-kind?
[ ] Serial mismatch?
[ ] Missing print?
[ ] Offset?
[ ] Foldover?
[ ] Cutting error?
[ ] Seal error?
[ ] Misregistration?
[ ] Major ink error?
[ ] Unusual signatures?
[ ] Unusual district?
[ ] Crisp/high grade?
[ ] Photograph taken?
[ ] Research completed?
</code></pre>
<hr>
<h1>137. EDITORIAL NOTE FOR FUTURE EXPANSION</h1>
<p>This guide is intentionally a <strong>field guide</strong>, not a complete Friedberg
catalog.</p>
<p>A truly exhaustive U.S. paper-money catalog would require
denomination-by-denomination tables containing every major series,
signature combination, district, star variety, Friedberg number, print
range, and known error.</p>
<p>The best way to build that material is as a separate reference section
so that the hunting guide remains usable in the field while the catalog
remains searchable and updateable.</p>
<hr>
<h1>138. SOURCE AND VERIFICATION NOTES</h1>
<p>The expanded material was checked against current U.S. government
currency information, including the U.S. Currency Education Program and
the Bureau of Engraving and Printing, with particular attention to
serial-number rules, historical issue families, denomination histories,
and authentication features.</p>
<p>Particular attention was given to:</p>
<ul>
<li>Current circulating denominations</li>
<li>Serial-number structure</li>
<li>Federal Reserve district identification</li>
<li>Star/replacement notes</li>
<li>1929 large-size/small-size transition</li>
<li>Historical currency issue families</li>
<li>Security-thread and microprinting milestones</li>
<li>$2 reintroduction</li>
<li>High-denomination note history</li>
<li>Gold Certificate and Silver Certificate history</li>
<li>Modern denomination design checkpoints</li>
</ul>
<p>Where collector terminology is subjective, this guide deliberately uses
language such as <strong>&quot;interesting,&quot; &quot;desirable,&quot; &quot;pull and research,&quot;</strong>
and <strong>&quot;may be collectible&quot;</strong> rather than assigning unsupported dollar
values.</p>
<p>For exact variety attribution, use a current specialized U.S.
paper-money catalog and, when appropriate, professional
authentication/grading.</p>
</div>`;
function showNoteTips() {
    const body = _longGuide(
        'Paper Currency Guide',
        'Identifying, hunting and researching U.S. paper currency — serials, seals, signatures, certificates and errors.',
        NOTE_GUIDE_SECTIONS,
        { searchPlaceholder: 'Search a topic, e.g. “star note”, “radar serial”, “seal color”.', openByDefault: 0 }
    );
    closeInfoDropdown();
    return createModal('modal-info-notes', 'Paper Currency Guide', body, null);
}

// --- Famous Coin Stories --------------------------------------------------
const ROLL_GUIDE_HTML = `<style>
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
.cc-guide table{border-collapse:collapse;margin:.5em 0;font-size:.85em;}
.cc-guide th,.cc-guide td{border:1px solid var(--color-border-light,#444);padding:3px 8px;}
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
<li>What denomination is it?  </li>
<li>What year?  </li>
<li>What mintmark?  </li>
<li>Is the composition unusual?  </li>
<li>Is it a proof?  </li>
<li>Is the design/type unusual?  </li>
<li>Is there a recognized variety for this date?  </li>
<li>Is there a genuine mint error?  </li>
<li>Is it unusually well preserved?  </li>
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
<h2>Current U.S. Mint specifications</h2>
<table>
<thead>
<tr>
<th align="left">Denomination</th>
<th align="right">Weight</th>
<th align="right">Diameter</th>
<th align="left">Composition</th>
</tr>
</thead>
<tbody><tr>
<td align="left">Cent</td>
<td align="right"><strong>2.500 g</strong></td>
<td align="right">19.05 mm</td>
<td align="left">2.5% copper / 97.5% zinc</td>
</tr>
<tr>
<td align="left">Nickel</td>
<td align="right"><strong>5.000 g</strong></td>
<td align="right">21.21 mm</td>
<td align="left">75% copper / 25% nickel</td>
</tr>
<tr>
<td align="left">Dime</td>
<td align="right"><strong>2.268 g</strong></td>
<td align="right">17.91 mm</td>
<td align="left">91.67% copper / 8.33% nickel overall</td>
</tr>
<tr>
<td align="left">Quarter</td>
<td align="right"><strong>5.670 g</strong></td>
<td align="right">24.26 mm</td>
<td align="left">91.67% copper / 8.33% nickel overall</td>
</tr>
<tr>
<td align="left">Half dollar</td>
<td align="right"><strong>11.340 g</strong></td>
<td align="right">30.61 mm</td>
<td align="left">91.67% copper / 8.33% nickel overall</td>
</tr>
<tr>
<td align="left">Dollar</td>
<td align="right"><strong>8.100 g</strong></td>
<td align="right">26.49 mm</td>
<td align="left">copper-based manganese/brass alloy</td>
</tr>
</tbody></table>
<p><strong>2026 note:</strong> The Mint&#39;s current annual-set penny is still 2.50 g copper-plated zinc, but it is produced for collectible sets rather than ordinary circulating production. Half dollars are primarily produced for numismatic products, though they remain legal tender. citeturn0search0</p>
<h3>Why weight matters</h3>
<p>Weight can flag possible silver, steel, bronze, wrong planchets, missing clad layers, foreign planchets, or counterfeits.</p>
<h3>Why weight is not proof</h3>
<p>Wear, damage, plating, counterfeit construction, scale error, and normal tolerances can affect measurements. Use weight as a <strong>screening test</strong>.</p>
<hr>
<h1>6. Cents</h1>
<h2>6.1 Composition timeline</h2>
<table>
<thead>
<tr>
<th align="left">Issue</th>
<th align="left">Composition</th>
<th align="right">Weight</th>
</tr>
</thead>
<tbody><tr>
<td align="left">1909-1942 Wheat</td>
<td align="left">95% copper / 5% zinc</td>
<td align="right">3.11 g</td>
</tr>
<tr>
<td align="left">1943</td>
<td align="left">Zinc-coated steel</td>
<td align="right">2.70 g</td>
</tr>
<tr>
<td align="left">1944-1946 shell-case bronze</td>
<td align="left">Copper alloy</td>
<td align="right">3.11 g</td>
</tr>
<tr>
<td align="left">1947-1981</td>
<td align="left">95% copper / 5% zinc</td>
<td align="right">3.11 g</td>
</tr>
<tr>
<td align="left">1982 bronze</td>
<td align="left">95% copper / 5% zinc</td>
<td align="right">3.11 g</td>
</tr>
<tr>
<td align="left">1982 zinc</td>
<td align="left">Copper-plated zinc</td>
<td align="right">2.50 g</td>
</tr>
<tr>
<td align="left">1983-present</td>
<td align="left">Copper-plated zinc</td>
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
<th align="left">Date</th>
<th align="left">Diagnostic</th>
<th align="left">Level</th>
</tr>
</thead>
<tbody><tr>
<td align="left">1909-S VDB</td>
<td align="left">VDB on reverse</td>
<td align="left">Major key</td>
</tr>
<tr>
<td align="left">1909-S</td>
<td align="left">S mintmark</td>
<td align="left">Key</td>
</tr>
<tr>
<td align="left">1914-D</td>
<td align="left">D mintmark</td>
<td align="left">Major key</td>
</tr>
<tr>
<td align="left">1922 No D</td>
<td align="left">Denver issue with absent/obscured D</td>
<td align="left">Major variety</td>
</tr>
<tr>
<td align="left">1931-S</td>
<td align="left">S mintmark</td>
<td align="left">Major key</td>
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
<p>Both 1960 and 1960-D have Small Date and Large Date varieties. The 1960-D also has a recognized Small Date over Large Date variety. Use the shape, proportions, alignment, and spacing of the date—not wear alone—to distinguish them.</p>
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
<li>Bronze: <strong>~3.11 g</strong>  </li>
<li>Zinc: <strong>~2.50 g</strong>  </li>
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
<p>Inspect <strong>AMERICA</strong> on the reverse. The 1992 and 1992-D Close AM varieties use the reverse design associated with 1993. The bases of A and M are unusually close, and the FG position is a useful secondary diagnostic. Both Philadelphia and Denver examples are known and are extremely scarce. citeturn0search1turn0search5</p>
<h2>6.19 1995 Doubled Die Obverse</h2>
<p>Inspect LIBERTY, IN GOD WE TRUST, and date for strong recognized doubling.</p>
<h2>6.20 1998-2000 Close AM / Wide AM</h2>
<p>For 1998-2000 business strikes, the important scarce varieties are <strong>Wide AM</strong> reverses. The 1999 Wide AM is particularly important. Always identify the exact year, mint, finish, and reverse before attributing the variety.</p>
<h2>6.21 2009 Bicentennial cents</h2>
<p>Four reverse designs were issued. Save one of each, then inspect for doubled dies, cuds, die chips, off-centers, broadstrikes, and proofs.</p>
<h2>6.22 Modern Shield cents</h2>
<p>Search for major doubled dies, cuds, major die cracks, clashes, off-centers, broadstrikes, wrong planchets, and missing plating. Tiny plating blisters are not automatically major errors.</p>
<hr>
<h1>7. Nickels</h1>
<h2>7.1 Normal composition</h2>
<p>Most Jefferson nickels are <strong>75% copper / 25% nickel</strong>, <strong>5.00 g</strong>.</p>
<h2>7.2 Wartime silver nickels, 1942-1945</h2>
<p>Composition: <strong>56% copper / 35% silver / 9% manganese</strong>. Weight: <strong>5.00 g</strong>. Large P, D, or S above Monticello is the key visual clue. Philadelphia&#39;s P appeared on a U.S. circulation coin for the first time on this issue.</p>
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
<h1>8. Dimes</h1>
<h2>8.1 Mercury dimes</h2>
<p>Pull every Mercury dime. Major dates include 1916-D, 1921, 1921-D, 1926-S, 1931-D, and 1931-S.</p>
<h2>8.2 Silver Roosevelt dimes</h2>
<p>All normal Roosevelt dimes dated <strong>1946-1964</strong> are <strong>90% silver / 10% copper</strong> and weigh <strong>2.50 g</strong>.</p>
<h2>8.3 Better Roosevelt dates</h2>
<p>Research 1949-S, 1950-S, 1955, 1955-D, 1955-S, 1956-D, 1958-D, 1959-D, 1960-D, 1961-D, 1962-D, and 1963-D, with condition in mind.</p>
<h2>8.4 1964-D variety hunting</h2>
<p>Recognized varieties include RPM FS-501, MPM FS-502, RPM FS-503 through FS-506, and DDR FS-801 through FS-803. PCGS lists these and also distinguishes Full Bands examples.</p>
<p>This is an excellent example of why a silver hunter should not automatically stop at pulling the silver.</p>
<h2>8.5 Full Bands</h2>
<p>Inspect the horizontal torch bands. A very sharp Roosevelt with complete band separation can be much more desirable in high grade. Save exceptionally sharp examples.</p>
<hr>
<h1>9. Quarters</h1>
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
<h1>10. Half Dollars</h1>
<h2>1964</h2>
<p><strong>90% silver</strong>, <strong>12.50 g</strong>. Pull all.</p>
<h2>1965-1969</h2>
<p><strong>40% silver</strong>, <strong>11.50 g</strong>. Pull all.</p>
<h2>1970-D</h2>
<p>Only released in mint sets. Not for circulation. Pull it.</p>
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
<p>These are <strong>proof</strong> varieties. Type 1 has a filled/blobby S; Type 2 has a clearer, more defined S. Type 2 is scarcer. Do not apply this proof diagnostic indiscriminately to ordinary business strikes.</p>
<h2>12.3 1981-S Type 1 / Type 2</h2>
<p>These are <strong>proof</strong> varieties distinguished by the S mintmark punch. Type 2 uses the newer, clearer S and is the scarcer variety.</p>
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
<li><strong>Off-center:</strong> planchet not centered in collar.  </li>
<li><strong>Broadstrike:</strong> struck without normal collar containment.  </li>
<li><strong>Clip:</strong> missing planchet material.  </li>
<li><strong>Wrong planchet:</strong> struck on a blank intended for another denomination.  </li>
<li><strong>Missing clad layer:</strong> one clad layer is absent.  </li>
<li><strong>Struck-through:</strong> foreign material came between die and planchet.  </li>
<li><strong>Brockage:</strong> a coin transfers an incuse/mirrored design to another planchet.  </li>
<li><strong>Double strike:</strong> receives a second strike.  </li>
<li><strong>Die clash:</strong> dies hit one another without a planchet between them.  </li>
<li><strong>Cud:</strong> major die break.</li>
</ul>
<hr>
<h1>19. Wrong-Planchet Investigation</h1>
<p>For a suspicious coin, record:</p>
<ol>
<li>Weight  </li>
<li>Diameter  </li>
<li>Thickness  </li>
<li>Edge appearance  </li>
<li>Color  </li>
<li>Magnetic behavior  </li>
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
<li>Random scratches  </li>
<li>Rim dents  </li>
<li>Flattened rims  </li>
<li>Machine doubling  </li>
<li>Tiny die chips  </li>
<li>Plating bubbles  </li>
<li>Chemical discoloration  </li>
<li>Polishing marks  </li>
<li>Heat damage  </li>
<li>Post-mint holes  </li>
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
<h1>23. Practical Attribution Workflow</h1>
<p>When a coin looks unusual, do not jump directly to a variety name.</p>
<h3>Step 1 — Establish the normal coin</h3>
<p>Identify denomination, date, mint, composition, and normal design.</p>
<h3>Step 2 — Document it</h3>
<p>Record weight, diameter, thickness if relevant, edge appearance, and magnetic behavior.</p>
<h3>Step 3 — Photograph it</h3>
<p>Take full obverse/reverse photos plus a close-up of the suspected diagnostic. Photograph the edge for errors.</p>
<h3>Step 4 — Compare with a normal example</h3>
<p>This is one of the fastest ways to separate a real variety/error from damage.</p>
<h3>Step 5 — Identify the mechanism</h3>
<p>Ask whether the feature came from a different die/hub, an abnormal planchet, an abnormal striking event, or something that happened after the coin left the Mint.</p>
<h3>Step 6 — Attribute before valuing</h3>
<p>Do not use an auction listing or asking price to decide what the coin is. First establish the exact variety/error; then research value.</p>
<h2>Edge-first diagnostics</h2>
<p>The edge can reveal silver versus clad construction, missing clad layer, unusual thickness, broadstrike/collar problems, altered edges, and Presidential-dollar edge-lettering errors.</p>
<h2>Photography checklist</h2>
<p>For an important candidate, save: full obverse, full reverse, edge, diagnostic close-up, weight/measurement record, and a comparison with a normal coin.</p>
<h1>23. Equipment</h1>
<h2>Essential</h2>
<ul>
<li>5x-10x loupe  </li>
<li>Accurate digital scale  </li>
<li>Bright neutral lighting  </li>
<li>Coin tray  </li>
<li>Non-PVC holders  </li>
<li>Notebook or spreadsheet</li>
</ul>
<h2>Helpful</h2>
<ul>
<li>Digital calipers  </li>
<li>USB microscope  </li>
<li>Camera/phone  </li>
<li>Variety reference  </li>
<li>Small magnet</li>
</ul>
<h3>Never use</h3>
<ul>
<li>Knives  </li>
<li>Needles  </li>
<li>Sandpaper  </li>
<li>Metal polish  </li>
<li>Abrasive cloth  </li>
<li>Chemical cleaners</li>
</ul>
<hr>
<h1>24. Coin Identification Worksheet</h1>
<p><strong>Denomination:</strong><br><strong>Year:</strong><br><strong>Mint:</strong><br><strong>Weight:</strong><br><strong>Diameter:</strong><br><strong>Magnetic?:</strong><br><strong>Composition:</strong><br><strong>Type:</strong><br><strong>Obverse variety:</strong><br><strong>Reverse variety:</strong><br><strong>Mintmark variety:</strong><br><strong>Error?:</strong><br><strong>Die crack/chip/cud?:</strong><br><strong>Condition:</strong><br><strong>Proof?:</strong><br><strong>Reference used:</strong><br><strong>Photos taken?:</strong><br><strong>Authentication needed?:</strong></p>
<hr>
<h1>25. When to Get Professional Authentication</h1>
<p>Get professional attribution/authentication when a coin might be:</p>
<ul>
<li>1909-S VDB  </li>
<li>1914-D  </li>
<li>1922 No D  </li>
<li>1955 DDO  </li>
<li>1969-S DDO  </li>
<li>1970-S DDO  </li>
<li>1972 DDO  </li>
<li>1943 bronze  </li>
<li>1944 steel  </li>
<li>1965 silver quarter  </li>
<li>Major wrong-planchet error  </li>
<li>Major doubled die  </li>
<li>Valuable Morgan VAM  </li>
<li>Important proof variety</li>
</ul>
<p>The cost of authentication can be small compared with the risk of selling a genuine rarity as a common coin—or paying a premium for a counterfeit.</p>
<hr>
<h1>26. The Golden Rules</h1>
<ol>
<li><strong>Never clean a coin you think may be valuable.</strong>  </li>
<li><strong>Weigh suspicious coins.</strong>  </li>
<li><strong>Learn mintmarks.</strong>  </li>
<li><strong>Learn composition changes.</strong>  </li>
<li><strong>Do not confuse machine doubling with doubled dies.</strong>  </li>
<li><strong>Do not confuse damage with mint errors.</strong>  </li>
<li><strong>Learn the exact diagnostics for each variety.</strong>  </li>
<li><strong>Save exceptionally nice examples.</strong>  </li>
<li><strong>Photograph suspicious coins before excessive handling.</strong>  </li>
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
<h1>Verification and Maintenance Note</h1>
<p>This guide should be treated as a living field reference. Major rarity diagnostics should be rechecked against current specialist references before buying, selling, or authenticating a coin. U.S. Mint specifications and production practices can change; the Mint&#39;s current 2026 specifications are reflected in this edition. citeturn0search0</p>
<p>&nbsp;</p>
</div>`;
function showRollHunting() {
    const body = _longGuide(
        'Coin Roll-Hunting Guide',
        'A beginner-to-advanced reference for finding keys, semi-keys, varieties, errors, silver and condition rarities in a roll.',
        ROLL_GUIDE_SECTIONS,
        { searchPlaceholder: 'Search a topic, e.g. “1909-S VDB”, “Full Steps”, “magnet”.', openByDefault: 0 }
    );
    closeInfoDropdown();
    return createModal('modal-info-rollhunting', 'Coin Roll-Hunting Guide', body, null);
}

// --- Image sources --------------------------------------------------------
// 2026-09-29. Lists where the coin images come from and the licence each
// one carries. Kept factual: only sources actually represented in the
// image tree are listed.
function showImageSources() {
  const wrap = el('div', { className: 'info-section' });
  wrap.appendChild(el('h2', { className: 'info-title' }, 'Image Sources'));

  const intro = el('p', { className: 'info-intro' },
    'Coin images come from open, freely licensed collections. Every image ' +
    'keeps its own licence, and where a file is CC BY or CC BY-SA the ' +
    'attribution and share-alike terms apply to it.');
  wrap.appendChild(intro);

  IMAGE_SOURCES.forEach(src => {
    const block = el('div', { className: 'info-section-body' });
    block.appendChild(el('h4', { className: 'info-subhead' }, src.name));
    const meta = el('p', { className: 'info-text' },
      src.via + ' \u00b7 ' + src.licence);
    block.appendChild(meta);
    if (src.url) {
      block.appendChild(el('p', { className: 'info-text' },
        el('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' },
          src.url)));
    }
    if (src.note) {
      block.appendChild(el('p', { className: 'info-text' }, src.note));
    }
    wrap.appendChild(block);
  });

  const foot = el('div', { className: 'info-section-body' });
  foot.appendChild(el('p', { className: 'info-text' },
    'Nothing here is scraped from a commercial site. If an image is wrong, ' +
    'remove it in the app and it stays removed \u2014 the catalog never ' +
    're-adds an image you deleted.'));
  wrap.appendChild(foot);

  // 2026-09-29: 4th arg is a CSS class string or a single element -- NOT an
  // array. Passing an array made createModal call footer.appendChild(array),
  // which throws. Every other Info section passes null and relies on the
  // header close button.
  createModal('modal-info-image-sources', 'Image Sources', wrap, null);
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

// --- Coin Collecting Guide ----------------------------------------------
// Restores the "Coin Collecting Guide" Info entry. openInfoSection('coinTips')
// called showCoinTips(), but the function was never defined, so the button
// threw ReferenceError and opened nothing. Built from the same helpers the
// sibling sections use (_sectionBody + createModal).
function showCoinTips() {
    const body = _longGuide(
        'Coin Collecting Guide',
        'Identification, varieties, errors, grading, buying, selling, storage and research — the complete beginner’s guide.',
        COIN_GUIDE_SECTIONS,
        { searchPlaceholder: 'Search a topic, e.g. “doubled die”, “PVC”, “Sheldon scale”.', openByDefault: 0 }
    );
    closeInfoDropdown();
    return createModal('modal-info-cointips', 'Coin Collecting Guide', body, null);
}

// --- Famous Coin Stories -------------------------------------------------
// Restores the "Famous Coin Stories" Info entry. openInfoSection('famousStories')
// called showFamousStories(), which was likewise never defined.
function showFamousStories() {
    const body = _longGuide(
        'Famous Coin Stories',
        'Heists, courtroom dramas, wartime blunders and mechanical mishaps from American numismatics.',
        STORIES_SECTIONS,
        { searchPlaceholder: 'Search a story, e.g. “double eagle”, “Cheerios”, “Tatum”.', openByDefault: 0 }
    );
    closeInfoDropdown();
    return createModal('modal-info-stories', 'Famous Coin Stories', body, null);
}

// Expose for HTML onclick handlers
window.toggleInfoDropdown = toggleInfoDropdown;
window.openInfoSection = openInfoSection;
// Info menu -> 'Advanced Features Tour' opens the second walkthrough.
window.startAdvancedTour = function () {
    if (typeof closeInfoDropdown === 'function') closeInfoDropdown();
    import('./guide.js')
        .then(m => m.startAdvancedTour())
        .catch(e => console.error('[guide] advanced tour failed', e));
};
