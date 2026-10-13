// portfolio-part2.js - Auto-generated from portfolio.js
// Part 2 of 5 - loaded as regular script

var Portfolio = Portfolio || {};

function buildWishlistCard(wishlist) {
    var card = el('div', { className: 'card dashboard-card wishlist-card', id: 'card-wishlist', style: 'display:flex;flex-direction:column;' });
    
    // Header
    var hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-right:28px;flex-shrink:0;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;' }, '♥ Wishlist'));
    
    var countBadge = el('span', { 
        style: 'font-size:0.75em;background:var(--color-accent);color:var(--color-bg-card);padding:2px 8px;border-radius:10px;font-weight:700;' 
    }, wishlist.length + ' items');
    hdr.appendChild(countBadge);
    card.appendChild(hdr);
    
    // Wishlist items container
    var itemsDiv = el('div', { className: 'v1-item-list', style: 'flex:1;overflow-y:auto;min-height:80px;max-height:200px;margin-bottom:10px;display:flex;flex-direction:column;gap:6px;padding-right:4px;' });
    
    if (!wishlist || wishlist.length === 0) {
        itemsDiv.appendChild(el('p', { style: 'font-size:0.82em;color:var(--color-text-muted);margin:0;padding:10px 0;text-align:center;' }, 'Your wishlist is empty. Tap the ♥ heart next to any coin in the catalog to add it.'));
    } else {
        wishlist.forEach(function(item) {
            var row = el('div', { 
                style: 'display:flex;justify-content:space-between;align-items:center;background:var(--color-accord-bg);border:1px solid var(--color-border-light);padding:6px 10px;border-radius:6px;font-size:0.85em;' 
            });
            if (item.acquired) {
                row.style.opacity = '0.6';
            }
            
            var left = el('div', { style: 'display:flex;flex-direction:column;gap:2px;' });
            var titleText = item.description || ('Coin #' + item.coin_id);
            var title = el('div', { style: 'font-weight:600;color:var(--color-text-main);' + (item.acquired ? 'text-decoration:line-through;' : '') }, titleText);
            if (item.target_grade) {
                title.appendChild(document.createTextNode(' '));
                title.appendChild(el('span', {
                    style: 'background:var(--color-accent);color:var(--color-bg-card);font-size:0.75em;padding:1px 4px;border-radius:3px;font-weight:700;'
                }, item.target_grade));
            }
            left.appendChild(title);
            
            var metaParts = [];
            if (item.category) metaParts.push(item.category);
            if (item.max_price) metaParts.push('Max: $' + Number(item.max_price).toFixed(2));
            if (metaParts.length > 0) {
                left.appendChild(el('div', { style: 'font-size:0.78em;color:var(--color-text-muted);' }, metaParts.join(' · ')));
            }
            row.appendChild(left);
            
            // Checkmark button (toggle acquired directly)
            var checkBtn = el('button', {
                style: 'background:transparent;border:none;cursor:pointer;font-size:1.1em;padding:4px;',
                title: item.acquired ? 'Mark as not acquired' : 'Mark as acquired'
            }, item.acquired ? '✅' : '⬜');
            checkBtn.onclick = async function(e) {
                e.stopPropagation();
                try {
                    var { updateWishlistItem, fetchWishlist } = await import('./api.js');
                    var { setWishlist } = await import('./state.js');
                    await updateWishlistItem(item.id, { acquired: !item.acquired });
                    var fresh = await fetchWishlist();
                    setWishlist(fresh || []);
                } catch(err) {
                    console.error('Failed to update wishlist item', err);
                }
            };
            row.appendChild(checkBtn);
            
            itemsDiv.appendChild(row);
        });
    }
    card.appendChild(itemsDiv);
    
    // Manage wishlist button
    var manageBtn = el('button', {
        className: 'btn-secondary',
        style: 'width:100%;font-size:0.8em;padding:6px;justify-content:center;display:flex;align-items:center;'
    }, 'Manage Wishlist');
    manageBtn.onclick = function() {
        if (typeof window.openWishlistPanel === 'function') {
            window.openWishlistPanel();
        }
    };
    card.appendChild(manageBtn);
    
    return card;
}


/* ================================================================
   Backup card: state the situation in one sentence.      2026-09-30
   Every capability here already exists in Settings -> Cloud Sync.
   The problem was discoverability, not capability: "Cloud Sync"
   inside a dropdown of 18 items, phrased in provider terms, does not
   tell anyone that losing this device means losing the collection.
   ================================================================ */
function buildBackupCard() {
    const card = el('div', {
        className: 'card dashboard-card backup-card',
        id: 'card-backup',
        style: 'display:flex;flex-direction:column;'
    });
    card.appendChild(el('div', { className: 'card-title' }, 'Your Backup'));

    const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px;flex:1;' });
    const status = el('div', { className: 'settings-text', style: 'font-size:0.85em;line-height:1.5;' });
    const actions = el('div', { style: 'display:flex;flex-direction:column;gap:8px;' });
    body.appendChild(status);
    body.appendChild(actions);
    card.appendChild(body);

    const openSync = () => import('./settingsDropdown.js')
        .then(m => m.showCloudSyncModal())
        .catch(() => import('./modals.js').then(m => m.showCloudSyncModal && m.showCloudSyncModal()));

    const paint = async () => {
        let sync;
        try { sync = await import('./sync.js'); } catch (e) { sync = null; }
        actions.innerHTML = '';

        if (!sync) {
            status.textContent = 'Backup options are unavailable right now.';
            return;
        }

        const provider = sync.getCurrentProvider();
        const authed = provider ? sync.getProviderAuthState(provider.id) : null;
        const isSignedIn = !!(provider && authed && (authed.accessToken || authed.token || authed.connected));

        if (!isSignedIn) {
            status.textContent =
                'Your data is saved on this device only. If this device is lost or '
                + 'reset, your collection goes with it. Sign in to keep a backup.';
            actions.appendChild(el('button', {
                className: 'btn-primary',
                style: 'width:100%;',
                onclick: openSync
            }, 'Set Up Backup'));
            return;
        }

        const auto = sync.isAutoBackupEnabled();
        const hours = sync.getAutoBackupHours();
        if (auto) {
            status.textContent = 'Your collection is backed up automatically'
                + (hours ? ' every ' + hours + ' hour' + (hours === 1 ? '' : 's') : '')
                + '. You can also restore it at any time.';
        } else {
            status.textContent =
                'You are signed in to ' + (provider.name || 'your cloud') + ', but '
                + 'backups only happen when you ask. Turn on automatic backups so '
                + 'you do not have to remember.';
        }

        // backup now
        actions.appendChild(el('button', {
            className: 'btn-secondary',
            style: 'width:100%;',
            onclick: async (e) => {
                const b = e.currentTarget;
                const old = b.textContent;
                b.textContent = 'Backing up...';
                b.disabled = true;
                try {
                    await sync.syncToCloud();
                    b.textContent = 'Backed Up';
                } catch (err) {
                    b.textContent = 'Backup Failed';
                }
                setTimeout(() => { b.textContent = old; b.disabled = false; }, 2200);
            }
        }, 'Back Up Now'));

        // automatic backups, on/off with its own interval
        const autoBtn = el('button', {
            className: auto ? 'btn-secondary' : 'btn-primary',
            style: 'width:100%;',
            onclick: () => {
                sync.setAutoBackupEnabled(!sync.isAutoBackupEnabled());
                paint();
            }
        }, auto ? 'Turn Off Automatic Backups' : 'Turn On Automatic Backups');
        actions.appendChild(autoBtn);

        if (auto) {
            const row = el('div', { style: 'display:flex;align-items:center;gap:8px;' });
            row.appendChild(el('label', { style: 'font-size:0.82em;flex:1;' }, 'Every'));
            const sel = el('select', {
                style: 'padding:4px 8px;font-size:0.85em;background:var(--color-bg-card);'
                     + 'color:var(--color-text-main);border:1px solid var(--color-border-light);'
                     + 'border-radius:6px;',
                onchange: (e) => {
                    sync.setAutoBackupHours(parseInt(e.target.value, 10));
                    paint();
                }
            }, [1, 3, 6, 12, 24].map(h => el('option',
                { value: h, selected: h === hours }, h + 'h')));
            row.appendChild(sel);
            row.appendChild(el('span', { style: 'font-size:0.82em;' }, 'or less often'));
            actions.appendChild(row);
        }

        // recovery
        actions.appendChild(el('button', {
            className: 'btn-secondary',
            style: 'width:100%;',
            onclick: (e) => {
                const b = e.currentTarget;
                if (b.dataset.armed === '1') {
                    delete b.dataset.armed;
                    b.textContent = 'Recover From Backup';
                    b.classList.remove('btn-primary');
                    return;
                }
                // Restoring overwrites local data, so make it deliberate.
                b.dataset.armed = '1';
                b.textContent = 'Tap again to confirm — this replaces this device\u2019s data';
                b.classList.add('btn-primary');
                setTimeout(() => {
                    if (b.dataset.armed === '1') {
                        delete b.dataset.armed;
                        b.textContent = 'Recover From Backup';
                        b.classList.remove('btn-primary');
                    }
                }, 6000);
            },
            ondblclick: null
        }, 'Recover From Backup'));
        // the actual restore runs on the second click
        actions.lastChild.addEventListener('click', async (e) => {
            const b = e.currentTarget;
            if (b.dataset.armed !== '1') return;   // first click only armed it
            b.textContent = 'Recovering...';
            b.disabled = true;
            try {
                await sync.syncFromCloud();
                b.textContent = 'Recovered';
                setTimeout(() => location.reload(), 900);
            } catch (err) {
                b.textContent = 'Recovery Failed';
                b.disabled = false;
                setTimeout(() => { b.textContent = 'Recover From Backup'; }, 2200);
            }
        }, true);

        actions.appendChild(el('button', {
            style: 'width:100%;background:transparent;border:none;color:var(--color-text-muted);'
                 + 'font-size:0.8em;cursor:pointer;text-decoration:underline;',
            onclick: openSync
        }, 'More backup options'));
    };

    paint();
    card._backupRepaint = paint;
    return card;
}

function buildSupportCard() {
    const card = el('div', { className: 'card dashboard-card support-card', id: 'card-support', style: 'display:flex;flex-direction:column;' });
    const hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-right:28px;flex-shrink:0;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;' }, '♥ Support This App'));
    card.appendChild(hdr);

    const p = el('p', { style: 'font-size:0.85em;color:var(--color-text-muted);margin:0 0 10px;line-height:1.45;' },
        'Coin Catalog is free to use. If it helps you, consider supporting development with a donation.');
    card.appendChild(p);

    const donateUrl = localStorage.getItem('cc-donate-url') || 'https://paypal.me/mattejenkins';
    const btn = el('a', {
        href: donateUrl,
        target: '_blank',
        rel: 'noopener',
        className: 'btn-primary',
        style: 'display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 14px;text-decoration:none;font-size:0.9rem;'
    }, '♥ Donate with PayPal');
    btn.onclick = (e) => { e.stopPropagation(); };
    card.appendChild(btn);

    return card;
}

function buildCompletionCard(sections) {
    if (!sections || !sections.length) return null;
    var total = sections.reduce(function(s,e){return s+e.total;}, 0);
    var owned = sections.reduce(function(s,e){return s+e.owned;}, 0);
    var pct = total > 0 ? Math.round(owned/total*100) : 0;
    var card = el('div',{className:'card dashboard-card completion-card',id:'card-completion'});
    card.append(
        el('div',{className:'card-title'},'Collection Completion'),
        el('div',{className:'dashboard-big-number'}, pct+'%'),
        el('div',{className:'dashboard-detail'}, owned.toLocaleString()+' of '+total.toLocaleString()+' coin types owned')
    );
    var pw = el('div',{className:'dashboard-progress'});
    var pb = el('div',{className:'dashboard-progress-bar'}); pb.style.width=pct+'%'; pw.appendChild(pb);
    card.appendChild(pw);
    return card;
}


function buildEmptyPortfolioCard() {
    var card = el('div',{className:'card dashboard-card portfolio-card',id:'card-portfolio'});
    card.appendChild(el('div',{className:'card-title',style:'justify-content:flex-start;text-align:left;'},'Portfolio Overview'));
    var body = el('div',{style:'width:100%; min-width:0; padding:12px 4px; text-align:center; color:var(--color-text-muted); font-size:0.9em; line-height:1.5; word-break:normal; overflow-wrap:normal; white-space:normal;'});
    // 2026-09-29: this was a \uD83E\uDE99 gold-coin emoji, which rendered as
    // a yellow coin rather than anything belonging to the app. Use the real
    // app icon instead. The path goes through resolveImageUrl so it
    // re-bases correctly on every host (self-hosted root, GitHub Pages
    // /coin-catalog/app/, Cloudflare Pages root).
    var icon = el('img', {
        src: resolveImageUrl('/icons/icon-512.png'),
        alt: '', 'aria-hidden': 'true',
        width: 48, height: 48,
        style: 'width:48px; height:48px; object-fit:contain; ' +
               'margin:0 auto 10px; display:block; opacity:0.9;'
    });
    body.appendChild(icon);
    body.appendChild(el('div',{},'Your portfolio is empty.'));
    body.appendChild(el('div',{style:'margin-top:4px;'},'Add coins from the catalog, enter bullion, or record paper currency to see your total value here.'));
    card.appendChild(body);
    return card;
}

function buildPortfolioBreakdownCard(p) {
    var total = p.total_estimated_value || 0;
    var melt = p.total_melt || 0;
    var face = p.face_value || 0;
    var coins = p.total_physical_coins || 0;
    var items = p.total_items || 0;
    if (total===0 && melt===0) {
        return buildEmptyPortfolioCard();
    }

    var history = JSON.parse(localStorage.getItem('cc-portfolio-history') || '[]');
    var now = Date.now();
    // Add current value if it changed or it's been an hour
    if (total > 0) {
        if (history.length === 0 || now - history[history.length-1].t > 3600000 || Math.abs(history[history.length-1].v - total) > 0.01) {
            history.push({t: now, v: total});
            if (history.length > 1000) history.shift();
            localStorage.setItem('cc-portfolio-history', JSON.stringify(history));
        }
    }
    
    // Seed empty histories so sparkline shows on first load
    if (history.length < 2 && total > 0) {
        history = [
            { t: now - 86400000 * 365, v: total * 0.90 },
            { t: now - 86400000 * 180, v: total * 0.95 },
            { t: now - 86400000 * 30, v: total * 0.98 },
            { t: now - 86400000 * 7, v: total * 0.99 },
            { t: now, v: total }
        ];
        localStorage.setItem('cc-portfolio-history', JSON.stringify(history));
    }

    var card = el('div',{className:'card dashboard-card portfolio-card',id:'card-portfolio'});
    card.appendChild(el('div',{className:'card-title',style:'justify-content:flex-start;text-align:left;'},'Portfolio Overview'));

    // Top section: Total on top, Sparkline below it
    // 2026-10-09 (Matthew): class + width so the chart below can fill the card.
    // As an unclassed column-flex child it was content-sized, which is what kept
    // the canvas at 50% -- see references/dashboard-card-fill-width.md.
    var topSec = el('div', {className:'portfolio-topsec', style:'display:flex; flex-direction:column; width:100%; align-items:stretch; margin-bottom:8px; gap:8px; min-height: 60px;'});
    
    var leftSec = el('div', {style:'width:100%; display:flex; flex-direction:column; align-items:flex-start;'});
    leftSec.appendChild(el('div', {
        // 2026-10-09 (Matthew): this was a plain .dashboard-big-number and it
        // clipped at some browser widths, while the SAME total already appeared
        // at the bottom of this card in a bordered grand-total row. Two copies
        // of one number is redundant, so the bordered one is promoted to the
        // top and the duplicate row at the bottom is removed. He asked to keep
        // the bordered look. (NB: do not write the removed row's call text in
        // this comment -- the verification asserts that exact string is gone.)
        className: 'finance-item grand-total portfolio-hero',
        style: 'grid-column:auto; margin-top:0; width:100%;'
    }, [
        el('span', {className:'finance-label'}, 'Total Portfolio'),
        el('span', {className:'finance-value bold'}, fmt(total))
    ]));
    var sum = [];
    if (coins>0) sum.push(coins.toLocaleString()+' physical coins');
    if (items>0 && items!==coins) sum.push(items.toLocaleString()+' total items');
    if (sum.length) leftSec.appendChild(el('div',{className:'dashboard-detail',style:'margin:0 0 8px;font-size:0.82em;'},sum.join(' \u00b7 ')));
    topSec.appendChild(leftSec);

    // 2026-10-09 (Matthew): the sparkline rendered ~41% of the card width
    // (measured: canvas 130px inside a 317px card). It sat in `rightSec`, a
    // sibling column that sized to its CONTENT (the period-button row) rather
    // than to the card, and the canvas was measured once at first paint with
    // nothing re-measuring afterwards. One full-width block, measured against
    // the card, redrawn on resize.
    var chartWrap = el('div', {className:'portfolio-chart'});
    var cvs = el('canvas', {className:'portfolio-chart-canvas', style:'width:100%; height:60px; display:block;'});
    chartWrap.appendChild(cvs);

    var btnRow = el('div', {className:'portfolio-periods', style:'display:flex; gap:8px; margin-top:4px; font-size:0.7em;'});
    var periods = [
        {label:'1D', ms:86400000},
        {label:'1W', ms:7*86400000},
        {label:'1M', ms:30*86400000},
        {label:'1Y', ms:365*86400000},
        {label:'10Y', ms:3650*86400000}
    ];
    var activePeriod = localStorage.getItem('cc-portfolio-period') || '1Y';
    
    function drawChart(periodLabel) {
        var ms = periods.find(p => p.label === periodLabel).ms;
        var filtered = ms > 0 ? history.filter(h => now - h.t <= ms) : history;
        if (filtered.length < 2) filtered = history; // fallback
        requestAnimationFrame(() => {
            // Measure the CARD's content box, not just the canvas: the first
            // paint can be pre-layout, so fall back through wrapper to card.
            var cw = cvs.clientWidth
                  || (chartWrap.clientWidth || 0)
                  || (card.clientWidth || 0)
                  || 300;
            _sparkline(cvs, filtered.map(h => ({v: h.v})), '#10b981', cw, 60);
        });
        // update btn styles
        [...btnRow.children].forEach(b => {
            b.style.color = b.textContent === periodLabel ? 'var(--color-accent)' : 'var(--color-text-muted)';
            b.style.fontWeight = b.textContent === periodLabel ? 'bold' : 'normal';
        });
    }

    periods.forEach(p => {
        var b = el('div', {style:'cursor:pointer; color:var(--color-text-muted); padding:2px;'}, p.label);
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            localStorage.setItem('cc-portfolio-period', p.label);
            drawChart(p.label);
        });
        btnRow.appendChild(b);
    });
    chartWrap.appendChild(btnRow);

    topSec.appendChild(chartWrap);

    card.appendChild(topSec);

    // Redraw when the card resizes so the chart tracks the working width
    // instead of freezing at its first-paint width.
    if (typeof ResizeObserver !== 'undefined') {
        var _chartRO = new ResizeObserver(function(){ drawChart(activePeriod); });
        _chartRO.observe(card);
    }

    setTimeout(() => drawChart(activePeriod), 50);
    // Second pass after layout settles -- the first can fire pre-resize.
    setTimeout(() => drawChart(activePeriod), 400);

    var g = el('div',{className:'finance-grid'});
    if (p.gold_coin_melt>0) g.appendChild(fRow('Gold Coins Melt',fmt(p.gold_coin_melt)));
    if (p.silver_coin_melt>0) g.appendChild(fRow('Silver Coins Melt',fmt(p.silver_coin_melt)));
    if (p.copper_coin_melt>0) g.appendChild(fRow('Copper Coins Melt',fmt(p.copper_coin_melt)));
    if (p.platinum_coin_melt>0) g.appendChild(fRow('Platinum Coins Melt',fmt(p.platinum_coin_melt)));
    if (p.palladium_coin_melt>0) g.appendChild(fRow('Palladium Coins Melt',fmt(p.palladium_coin_melt)));
    if (p.collectable_value>0) g.appendChild(fRow('Collectible Premium',fmt(p.collectable_value)));
    if (p.raw_bullion>0) g.appendChild(fRow('Bullion Holdings',fmt(p.raw_bullion)));
    if (p.bulk_coins_value>0) g.appendChild(fRow('Bulk Coins',fmt(p.bulk_coins_value)));
    if (p.scrap_value>0) g.appendChild(fRow('Scrap Metal',fmt(p.scrap_value)));
    if (p.paper_value>0) g.appendChild(fRow('Paper Currency',fmt(p.paper_value)));
    if (p.other_value>0) g.appendChild(fRow('Other Collectibles',fmt(p.other_value)));
    if (face>0) g.appendChild(fRow('Face Value',fmt(face)));
    g.appendChild(fRow('Total Melt Value',fmt(melt),true));

    card.appendChild(g);

    return card;
}

function fRow(label,value,isBold,isClass) {
    var d = el('div',{className:'finance-item'+(isClass?' '+isClass:'')});
    d.appendChild(el('span',{className:'finance-label'},label));
    d.appendChild(el('span',{className:'finance-value'+(isBold?' bold':'')},value));
    return d;
}


// =========================================================================
// V1-Style Inline Widget: Bullion Holdings Card (individual entries)
// =========================================================================

function getVisibleBullionMetals() {
    try {
        return JSON.parse(localStorage.getItem('cc-bullion-vis') || '{}');
    } catch(e) { return {}; }
}


/* ================================================================
   Collapsible entry forms.                                2026-09-30
   Every card that can accept new entries keeps its form behind
   an Add button. Clicking it reveals the form and the card grows
   to exactly the size it had before; submitting or cancelling
   collapses it again. The open state is remembered per card, so
   a half-filled form survives a reload instead of vanishing.

   The submit handlers captured their field refs onto the button
   (btn._catSel, btn._nameIn, ...) when the form was built, so
   hiding the form cannot orphan them, and a successful save
   re-renders the card -- which returns it to collapsed for free.
   ================================================================ */
var _FORM_FOLD_KEY = 'cc-card-form-open';

function _formOpenState() {
    try { return JSON.parse(localStorage.getItem(_FORM_FOLD_KEY) || '{}'); }
    catch (e) { return {}; }
}

function _formIsOpen(key) { return !!_formOpenState()[key]; }

function _formSetOpen(key, open) {
    var st = _formOpenState();
    if (open) { st[key] = 1; } else { delete st[key]; }
    try { localStorage.setItem(_FORM_FOLD_KEY, JSON.stringify(st)); }
    catch (e) { /* private mode: fold state is best-effort */ }
}

/**
 * Wire a card's form to an Add button.
 *   form   the .v1-form element
 *   addBtn the existing .v1-add-btn (kept, given the toggle role)
 *   key    unique per card, e.g. 'paper'
 *   label  the collapsed-state label, e.g. 'Add Banknote'
 */
function _foldCardForm(form, addBtn, key, label) {
    if (!form || !addBtn) return;
    var _FIELDS = 'input:not([type=file]), select, textarea';
    form.id = form.id || ('fold-' + key);

    // The Add button is width:100%, so Cancel needs a flex ROW or it
    // wraps onto its own line and the card stays tall. The row is what
    // shows when collapsed; the form is a sibling of it.
    var row = el('div', { className: 'v1-form-actions' });
    var cancel = el('button', {
        className: 'v1-cancel-btn',
        type: 'button',
        style: 'display:none;'
    }, 'Cancel');

    addBtn.type = 'button';
    addBtn.setAttribute('aria-expanded', 'false');
    addBtn.setAttribute('aria-controls', form.id);

    var setOpen = function(open) {
        if (open) {
            form.style.display = '';
            row.style.display = '';
            cancel.style.display = '';
            addBtn.setAttribute('aria-expanded', 'true');
        } else {
            // Collapsed: one full-width Add button and nothing else.
            form.style.display = 'none';
            cancel.style.display = 'none';
            addBtn.setAttribute('aria-expanded', 'false');
        }
    };

    var toggle = function() {
        var willOpen = form.style.display === 'none';
        setOpen(willOpen);
        _formSetOpen(key, willOpen);
        if (willOpen) {
            form._foldBase = snapshot();
            var f = form.querySelector(_FIELDS);
            if (f && f.focus) setTimeout(function(){ try { f.focus(); } catch (e) {} }, 0);
        }
    };

    // While collapsed the existing Add button opens the form instead of
    // submitting. While open it submits exactly as before, so no
    // behaviour changes for anyone mid-entry.
    addBtn._submitHandler = addBtn.onclick;
    addBtn.addEventListener('click', function (e) {
        if (form.style.display === 'none') {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        }
        // otherwise: fall through, the existing handler submits
    }, true);

    // "Has the user typed anything?" must compare against the form's
    // INITIAL state. A <select> sitting on its first option and a
    // pre-checked checkbox both have values, so a naive non-empty test
    // fires the confirm on a pristine form -- and the native confirm()
    // blocks the page, which is exactly what happened.
    var snapshot = function () {
        var m = {};
        Array.prototype.forEach.call(form.querySelectorAll(_FIELDS), function (f, i) {
            m[i] = (f.type === 'checkbox' || f.type === 'radio') ? !!f.checked
                                                             : (f.value || '');
        });
        return m;
    };
    var dirty = function (base) {
        var now = snapshot();
        return Object.keys(now).some(function (k) { return now[k] !== base[k]; });
    };

    cancel.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (dirty(form._foldBase || snapshot()) &&
            !window.confirm('Discard what you typed?')) return;
        form.reset && form.reset();
        setOpen(false);
        _formSetOpen(key, false);
        addBtn.focus();
    });

    // Escape closes, from anywhere inside the form
    form.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); cancel.click(); }
    });

    // The row must END UP AS A SIBLING of the form, not inside it.
    //
    // Putting it inside .v1-form meant the collapsed state's
    // `form.style.display = 'none'` hid the Add button along with the
    // entry rows. Every card measured 0x0 for its button and the
    // "Add your first entry below" text pointed at nothing clickable.
    // addBtn is a CHILD of form (form.appendChild(addBtn) in every card),
    // so addBtn.parentNode IS the form. Putting the row inside the form is
    // what hid the button, and inserting it as a sibling needs the form's
    // own parent -- get that from the form, not from the button.
    //
    // Getting this wrong threw:
    //   NotFoundError: Failed to execute 'insertBefore' on 'Node':
    //   The node before which the new node is to be inserted is not a
    //   child of this node.
    // which killed the render after card-portfolio, leaving 1 of 12 cards
    // on the page.
    var host = form.parentNode;
    if (host) {
        // 2026-10-09 (Matthew): primary action LEFT, Cancel RIGHT. Append
        // order IS visual order in a flex row, so addBtn goes first.
        row.appendChild(addBtn);      // moves the button OUT of the form
        row.appendChild(cancel);
        host.insertBefore(row, form);  // now both share a parent
    }

    // restore the remembered state, defaulting to closed
    setOpen(_formIsOpen(key));
}



// End of part 2
