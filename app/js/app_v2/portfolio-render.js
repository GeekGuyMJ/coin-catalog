import { buildSpotPricesCard } from './portfolio-trend.js';
import { buildBullionHoldingsCard } from './portfolio-cards-2.js';
import { buildScrapMetalCard, buildPaperCurrencyCard } from './portfolio-cards-3a.js';
import { buildCustomDashboardCardsCard, buildCustomCategoriesCard } from './portfolio-cards-3b.js';
import { buildCompletionCard, buildWishlistCard, buildBackupCard, buildSupportCard } from './portfolio-cards-1.js';

export async function renderDashboard() {
    const generation = ++_dashboardRenderGeneration;
    var prices = getSpotPrices();
    const c = document.getElementById('dashboard-grid');
    if (!c) return;
    var sc = await buildSpotPricesCard(prices);
    if (generation !== _dashboardRenderGeneration) return;
    // 2026-10-07 (COI-20): the DOM commit below IS synchronous, but emptying the
    // grid is still destructive to the scroll position. `innerHTML = ''` collapses
    // the document height for the remainder of this same frame; if the viewport is
    // scrolled below the collapsed document, the browser clamps scrollY down to
    // (collapsedDocHeight - viewportHeight) and never restores it. Rebuilding the
    // cards synchronously afterwards does NOT undo the clamp -- the scroll position
    // is already lost.
    //
    // Measured on self-hosted at 390x844 with the Wishlist card scrolled into view:
    // docHeight 5663 -> 1959 on the emptying write, so scrollY 2454 clamps to 1093
    // (1959 - 866). That is the "screen bounce/jump" reported for any dashboard card
    // interaction that re-renders (wishlist Acquire, inventory edits, etc.).
    //
    // Fix: hold a min-height on the grid for the duration of the rebuild so the
    // document never gets shorter than where the user currently is. Restoring the
    // scroll position afterwards does NOT work -- the restore runs while the
    // document is still collapsed, so it is clamped again to the same value.
    //
    // Only pin when the collapse would actually be destructive, so a re-render that
    // happens near the top of the page costs nothing.
    var _coi20Pin = _pinGridHeight(c);
    c.innerHTML = '';
    // COI-20: safety net. The normal release happens at the end of this
    // function, but a card builder that throws would otherwise leave the grid
    // pinned at a fixed height for the rest of the session. The release is
    // idempotent, so an early release here is harmless.
    setTimeout(function () { _coi20Pin(); }, 400);
    var p = _portfolioData || {};

    // Load visibility preferences
    var vis = {};
    try { vis = JSON.parse(localStorage.getItem('cc-card-visibility') || '{}'); } catch(e) {}

    // Always build all cards, respecting visibility toggles.
    //
    // DEFAULT ORDER (Matthew, 2026-10-09) -- what a NEW install sees:
    //    1 Portfolio Overview      7 Paper Currency
    //    2 Live Spot Prices        8 Other Collectables
    //    3 Metal Price Trends      9 Photos & Documents
    //    4 Bullion Holdings       10 Collection Completion
    //    5 Scrap Precious Metal   11 Wishlist
    //    6 Bulk Coins             12 Your Backup
    //                                13 Support this App
    //
    // The APPEND order below IS the default order. applyDashboardOrder() then
    // re-applies any saved drag order on top, so a dashboard the user has
    // already rearranged keeps their arrangement -- this is only the default.
    //
    // NOTE the spot card is already BUILT before this block (`var sc = await
    // buildSpotPricesCard(prices)` runs earlier); only its append moves.
    var pc = buildPortfolioBreakdownCard(p);
    if (pc) { if (vis['card-portfolio'] === false) pc.style.display='none'; addDragHandle(pc); c.appendChild(pc); }

    // Spot prices card (built above, before the synchronous DOM update).
    if (sc) { if (vis['card-spot'] === false) sc.style.display='none'; addDragHandle(sc); c.appendChild(sc); }

    var tc = buildSpotTrendCard(prices);
    if (tc) { if (vis['card-trend'] === false) tc.style.display='none'; addDragHandle(tc); c.appendChild(tc); }

    // Bullion card - uses raw bullion individual entries
    var bi = getRawBullion();
    var bc = buildBullionCard(bi, p, prices);
    if (bc) { if (vis['card-bullion'] === false) bc.style.display='none'; addDragHandle(bc); c.appendChild(bc); }

    var sm = getScrapMetal();
    var s2 = buildScrapMetalCard(sm, prices); 
    if (s2) { if (vis['card-scrap'] === false) s2.style.display='none'; addDragHandle(s2); c.appendChild(s2); }

    // Coins by Weight card
    var cwCard = buildCoinsByWeightCard(_bulkCoinsData, prices);
    if (cwCard) { if (vis['card-coinweight'] === false) cwCard.style.display='none'; addDragHandle(cwCard); c.appendChild(cwCard); }

    var pap = getPaperCurrency();
    var p2 = buildPaperCurrencyCard(pap); 
    if (p2) { if (vis['card-paper'] === false) p2.style.display='none'; addDragHandle(p2); c.appendChild(p2); }

    var cats = getCustomCategories(); var cols = getOtherCollectables();
    var c2 = buildCustomCategoriesCard(cats, cols); 
    if (c2) { if (vis['card-custom'] === false) c2.style.display='none'; addDragHandle(c2); c.appendChild(c2); }

    // 2026-10-09 (Matthew): the user's own Custom Dashboard Cards. The creator
    // modal has always written this store, but NOTHING read it, so a created
    // card saved, toasted success, and never rendered. This is the renderer
    // that was missing. Returns null when the list is empty, so no empty card
    // is added for users who have not made one.
    var ucc = buildCustomDashboardCardsCard(p);
    if (ucc) { if (vis['card-user-custom'] === false) ucc.style.display='none'; addDragHandle(ucc); c.appendChild(ucc); }

    // Photos & Documents gallery card
    var g2 = renderGalleryCard();
    if (g2) { if (vis['card-gallery'] === false) g2.style.display='none'; addDragHandle(g2); c.appendChild(g2); }

    // Completion ("Percentage Finished")
    // 2026-10-09 (Matthew) DEFAULT ORDER for a new install:
    //   Portfolio Overview, Live Spot Prices, Metal Price Trends,
    //   Bullion Holdings, Scrap Precious Metal, Bulk Coins, Paper Currency,
    //   Other Collectables, Photos & Documents, Collection Completion,
    //   Wishlist, Your Backup, Support this App.
    // The append order below IS the default order. applyDashboardOrder() then
    // re-applies any saved drag order on top, so a rearranged dashboard keeps
    // the arrangement the user chose.
    var cc = buildCompletionCard(getSections());
    if (cc) { if (vis['card-completion'] === false) cc.style.display='none'; addDragHandle(cc); c.appendChild(cc); }

    var wl = getWishlist() || [];
    var w2 = buildWishlistCard(wl);
    if (w2) { if (vis['card-wishlist'] === false) w2.style.display='none'; addDragHandle(w2); c.appendChild(w2); }

    // 2026-09-30: plain-language backup card (Matthew). One sentence
    // stating where the data lives, one button to act on it.
    var bkp = buildBackupCard();
    if (vis['card-backup'] === false) bkp.style.display = 'none';
    addDragHandle(bkp);
    c.appendChild(bkp);

    // Support card — always render LAST, respects visibility toggle.
    var sup = buildSupportCard();
    if (sup) { if (vis['card-support'] === false) sup.style.display='none'; addDragHandle(sup); c.appendChild(sup); }

    // Re-apply sort order after rebuilding DOM
    applyDashboardOrder();
    applyDashboardSizes();

    // COI-20: release the scroll-anchor pin now that the rebuilt cards
    // have their real heights back.
    if (typeof _coi20Pin === 'function') _coi20Pin();

}