// demo_router.js — AIORA / Shopora demo scenario engine
// Built for Pattern 1 (1.1–1.5). Verified against the REAL tag.js parsing
// This file deliberately does NOT render identity or the loyalty chip — app.js's initIdentity() and initLoyaltyChip() already do this correctly, driven by the same ?identity=/&member_tier= URL params, using the exact attributes tag.js reads. The one exception is Scenario 1.4, whose trigger URL has no ?identity= param at all, yet still needs a recognized Plus member — forceIdentity() covers that case only.

import { products } from './data/products.js';
// versioned separately from this file's own <script> tag ?v= — bump this
// whenever demo_scenarios.js content changes, so edits can't get stuck
// behind a stale cached copy.
import { demoScenarios } from './data/demo_scenarios.js?v=10';

function money(n) {
    return '$' + Number(n).toFixed(2);
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const demoSlug = params.get('demo');
    if (!demoSlug) return; // No demo param — real Shopora runs untouched.

    console.warn(`[AIORA DEMO] Applying scenario: ${demoSlug}`);

    // demoScenarios is a static import (resolved at script-load time, no
    // network round trip) rather than a fetch() of the JSON file — that
    // round trip used to be exactly the kind of delay that let tag.js's
    // DOM-settle extraction fire before our override had landed.
    const scenario = demoScenarios[demoSlug];

    if (!scenario) {
        console.warn(`[AIORA DEMO] Unknown scenario slug: "${demoSlug}"`);
        window.__AIORA_DEMO_READY__ = true;
        return;
    }

    const currentPageType = document.body.dataset.pageType;
    if (scenario.target_page && scenario.target_page !== currentPageType) {
        window.__AIORA_DEMO_READY__ = true;
        return;
    }

    if (scenario.forceIdentity && params.get('identity') !== 'logged-in') {
        forceIdentity(scenario.forceIdentity);
    }

    // tag.js (see its waitForHydration) holds off extracting the page,
    // whenever a ?demo= param is present, until this flag is true — so it
    // never captures mid-override regardless of which scenario/page is
    // active. Most overrides below are synchronous, but scenario.pdp isn't
    // (waitForRealPdpHero can take up to its own maxWaitMs), so the flag is
    // only set once every synchronous AND async override has actually
    // landed in the DOM.
    let pendingAsync = 0;
    function markAsyncDone() {
        pendingAsync--;
        if (pendingAsync <= 0) window.__AIORA_DEMO_READY__ = true;
    }

    if (scenario.hideSections) hideSections(scenario.hideSections);      // Pattern 2 (2.1)
    if (scenario.cart) renderCart(scenario.cart);
    if (scenario.claims) renderClaims(scenario.claims);       // Pattern 2+
    if (scenario.hero) renderHeroOverride(scenario.hero);
    if (scenario.featuredTiles) renderFeaturedTiles(scenario.featuredTiles);
    if (scenario.featuredSectionHeading) renderFeaturedSectionHeading(scenario.featuredSectionHeading);   // Pattern 2 (2.1)
    if (scenario.banner) renderCategoryBanner(scenario.banner);       // Pattern 4 (4.1)
    if (scenario.pdp) {
        pendingAsync++;
        waitForRealPdpHero(() => { renderPdpOverride(scenario.pdp); markAsyncDone(); });  // Pattern 4 (4.1)
    }
    // tiles overrides must run AFTER featuredTiles/real grid are in the DOM
    // — it targets tiles by [data-product-id], which must already exist.
    if (scenario.tiles) applyTileOverrides(scenario.tiles);  // Pattern 3+, 4.1
    if (scenario.clickThrough) attachClickThrough(scenario.clickThrough);  // Pattern 4 (4.1)
    if (scenario.carryDemoForward || scenario.navOverrides) {
        attachDemoNavRouting(demoSlug, scenario.navOverrides, scenario.carryDemoForward);  // Pattern 5 (5.1)
    }

    if (pendingAsync === 0) window.__AIORA_DEMO_READY__ = true;
});

// Pattern 5 (5.1): app.js's own global click handler already carries
// ?identity=/&member_tier= forward on internal links (see initGlobalInteractions
// in app.js), but never ?demo= — so navigating off this page via a plain
// link (Orders, Wishlist, ...) silently drops back into real-site mode,
// which breaks the "recognized everywhere except cart" story this scenario
// needs. This carries the CURRENT demo slug forward on every internal link
// click (in addition to identity/member_tier, replicating app.js's own
// behavior since stopImmediatePropagation prevents its handler from also
// firing), except for links matching `overrides` — those jump to an
// explicit, different destination instead (Pattern 5.1's Cart link, which
// must lose identity entirely, not carry it forward).
function attachDemoNavRouting(demoSlug, overrides, carryForward) {
    console.warn('[AIORA DEMO] attachDemoNavRouting armed. overrides =', overrides, 'carryForward =', carryForward);
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link || !link.href) return;
        console.warn('[AIORA DEMO] nav-routing saw click on link:', link.href, 'classList =', link.className);
        const override = (overrides || []).find(o => link.closest(o.selector));
        if (override) {
            console.warn('[AIORA DEMO] nav-routing: override matched ->', override.destination);
            e.preventDefault();
            e.stopImmediatePropagation();
            window.location.href = override.destination;
            return;
        }
        if (!carryForward) { console.warn('[AIORA DEMO] nav-routing: no override, carryForward is off, letting it pass through.'); return; }
        let url;
        try { url = new URL(link.href, window.location.origin); } catch (err) { console.warn('[AIORA DEMO] nav-routing: URL parse failed', err); return; }
        if (url.origin !== window.location.origin) { console.warn('[AIORA DEMO] nav-routing: external origin, ignoring.'); return; }
        const current = new URLSearchParams(window.location.search);
        if (current.has('identity')) url.searchParams.set('identity', current.get('identity'));
        if (current.has('member_tier')) url.searchParams.set('member_tier', current.get('member_tier'));
        url.searchParams.set('demo', demoSlug);
        console.warn('[AIORA DEMO] nav-routing: carrying forward ->', url.toString());
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.href = url.toString();
    }, true);
}

// Generic click-through override: while this scenario is active, clicking
// ANY product tile on the page navigates to that tile's own SKU on the
// destination demo slug (./pdp.html?sku=<clicked-sku>&demo=<destinationSlug>)
// instead of app.js's default ?id=<sku> link with no demo param.
//
// This listens on `window` (the earliest possible point in the capturing
// phase — even before `document`) with capture:true, so it always runs
// before app.js's own bubble-phase click handlers on the tile's image/title,
// and stopImmediatePropagation() stops the event before it can reach them.
// It's pure event delegation (e.target read fresh at click time, not a
// stored element reference), so it keeps working even if the grid re-renders
// after this listener is attached.
function attachClickThrough(config) {
    console.warn(`[AIORA DEMO] click-through armed -> any tile redirects to ?sku=<sku>&demo=${config.destinationSlug}`);
    window.addEventListener('click', (e) => {
        const card = e.target.closest('[data-product-id]');
        if (!card) return;
        if (e.target.closest('.wishlist-button, .add-to-cart, .quick-view')) return;
        const sku = card.dataset.productId;
        if (!sku) return;
        const destination = `./pdp.html?sku=${encodeURIComponent(sku)}&demo=${encodeURIComponent(config.destinationSlug)}`;
        console.warn(`[AIORA DEMO] click-through firing for sku="${sku}" -> ${destination}`);
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.href = destination;
    }, true);
}


// =====================================================================
// IDENTITY FALLBACK — only for scenarios needing recognized/Plus state
// without a matching URL param (currently: 1.4 only).
// =====================================================================
function forceIdentity(identity) {
    const chip = document.querySelector('.account-chip');
    if (chip) {
        chip.dataset.identityState = identity.state;
        if (identity.tier) chip.dataset.memberTier = identity.tier;
        chip.dataset.customerHash = 'demo-customer-hash-abc123';
        chip.innerHTML = '<span class="greeting">Hello, Rahul</span><strong class="account-label">Shopora Plus</strong>';
    }
    if (identity.tier === 'plus') {
        // Mirrors initLoyaltyChip()'s own markup exactly.
        // NOTE: data-loyalty-tier is not read by tag.js (data-member-tier on
        // .account-chip already covers this) — kept for forward compatibility.
        const chipHtml = `
      <div class="loyalty-chip" data-loyalty-tier="plus" data-loyalty-balance="${identity.points || 450}" style="display:flex;width:fit-content;margin:0 auto 0.75rem;">
        <span class="tier-label">Shopora Plus</span>
        <span class="points">${identity.points || 450} points</span>
      </div>`;
        const summaryCard = document.querySelector('.summary-card');
        const checkoutSummary = document.querySelector('.checkout-summary');
        if (checkoutSummary) checkoutSummary.insertAdjacentHTML('afterbegin', chipHtml);
        else if (summaryCard) summaryCard.insertAdjacentHTML('afterbegin', chipHtml);
    }
}


// =====================================================================
// HIDE SECTIONS — removes real homepage sections that would otherwise
// distract from a scenario's specific claim (e.g. 2.1's hero-vs-category
// mismatch doesn't need the "popular categories" grid, today's deals
// strip, or the two bottom promo banners competing for attention — and
// removing them outright, rather than hiding with CSS, also keeps them
// out of tag.js's extraction entirely).
// =====================================================================
function hideSections(selectors) {
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
    });
}

// Retitles the real "Trending products" heading above #featuredGrid —
// used by 2.1 so the featured-tiles section reads as the thing the hero
// is claiming a discount on, instead of an unrelated "trending" framing.
function renderFeaturedSectionHeading(text) {
    const grid = document.querySelector('#featuredGrid');
    const heading = grid && grid.closest('.section')?.querySelector('.section-heading h2');
    if (heading) heading.textContent = text;
}

// =====================================================================
// CART & SAVINGS — covers all five Pattern 1 scenarios. Mirrors the REAL
// markup app.js's own renderCart() produces and the REAL element IDs
// verified in cart.html.
// =====================================================================
function renderCart(cart) {
    const itemsEl = document.querySelector('#cartItems');
    if (!itemsEl) {
        console.error('[AIORA DEMO] #cartItems not found on this page.');
        return;
    }

    // products.js uses `id`, not `sku`.
    const resolvedItems = cart.items.map(({ sku, qty }) => {
        const product = products.find(p => p.id === sku);
        if (!product) {
            console.error(`[AIORA DEMO] Unknown SKU "${sku}" — check products.js`);
            return { sku, qty, name: sku, price: 0, lineTotal: 0 };
        }
        return {
            sku, qty,
            name: product.name,
            price: product.price,
            category: product.category,
            description: product.description,
            oldPrice: product.oldPrice,
            discount: product.discount,
            lineTotal: +(product.price * qty).toFixed(2)
        };
    });

    const subtotal = +resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2);
    const totalSavings = +(cart.savings_breakdown || []).reduce((sum, s) => sum + s.amount, 0).toFixed(2);
    // shipping_label is a display string ("FREE delivery" or "$5.99") — parse
    // out the numeric delivery cost so it's actually reflected in the total.
    const deliveryMatch = (cart.shipping_label || '').match(/[\d.]+/);
    const deliveryCost = deliveryMatch ? Number(deliveryMatch[0]) : 0;
    const total = cart.override_total !== undefined ? cart.override_total : +(subtotal + deliveryCost - totalSavings).toFixed(2);
    const itemCount = resolvedItems.reduce((sum, i) => sum + i.qty, 0);

    itemsEl.innerHTML = resolvedItems.map(item => {
        // Mirrors app.js's own applyVisual() sprite-positioning logic, so
        // the demo cart shows the same product image as the real cart.
        const spriteIndex = Math.max(0, Number(item.sku.split('-')[1]) - 1);
        const spriteX = (spriteIndex % 5) * 25 + '%';
        const spriteY = Math.floor(spriteIndex / 5) * 50 + '%';
        const oldPriceTotal = item.oldPrice ? +(item.oldPrice * item.qty).toFixed(2) : null;
        return `
    <article class="cart-item" data-cart-id="${item.sku}" data-product-id="${item.sku}">
      <div class="product-image sprite-${item.category}" style="--sprite-x:${spriteX};--sprite-y:${spriteY}"></div>
      <div>
        <h3>${item.name}</h3>
        <p class="cart-item-meta">${item.description || ''}</p>
        <p class="cart-item-meta" data-availability="in-stock"><b>In stock</b> · FREE returns</p>
        <div class="cart-item-actions">
          <div class="quantity-control"><button disabled>−</button><span>${item.qty}</span><button disabled>+</button></div>
        </div>
      </div>
      <div class="cart-item-price">
        <strong class="cart-item-total">${money(item.lineTotal)}</strong>
        ${oldPriceTotal ? `<del>${money(oldPriceTotal)}</del>` : ''}
        ${item.discount ? `<small>${item.discount} off</small>` : ''}
      </div>
    </article>
  `;
    }).join('');

    const set = (id, text) => { const el = document.querySelector(id); if (el) el.textContent = text; };
    set('#summaryItems', String(itemCount));
    set('#cartItemLabel', `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`);
    set('#summarySubtotal', money(subtotal));

    // Per-unit price breakdown next to "Items (N)" — only shown when it's
    // unambiguous (a single SKU with qty > 1), e.g. "(2 × $18.99 = $37.98)".
    // This also gives a real per-unit price a place to exist in the DOM,
    // since cart rows themselves only ever show the line total.
    /* we need to add attr. here , app.js and tag.js as well
    const existingBreakdown = document.querySelector('[data-demo-qty-breakdown]');
    if (existingBreakdown) existingBreakdown.remove();
    if (resolvedItems.length === 1 && resolvedItems[0].qty > 1) {
        const only = resolvedItems[0];
        const itemsLabel = document.querySelector('#summaryItems')?.parentElement;
        if (itemsLabel) {
            itemsLabel.insertAdjacentHTML('beforeend', ` <small data-demo-qty-breakdown style="color:var(--muted);font-weight:500;">(${only.qty} × ${money(only.price)} = ${money(only.lineTotal)})</small>`);
        }
    }*/
    if (cart.shipping_label !== undefined) set('#summaryDelivery', cart.shipping_label);

    // app.js's #shippingProgress banner is computed off the real (leftover)
    // cart subtotal, not this demo's data — it can claim "FREE delivery
    // unlocked" while the summary panel charges for delivery. Override it so
    // the banner agrees with what the demo actually shows.
    const shippingProgress = document.querySelector('#shippingProgress');
    if (shippingProgress) {
        const FREE_DELIVERY_MIN = 35; // mirrors app.js's own threshold
        const remaining = Math.max(0, FREE_DELIVERY_MIN - subtotal);
        const pct = Math.min(100, (subtotal / FREE_DELIVERY_MIN) * 100);
        if (cart.shippingNudgeOverride) {
            // Pattern 2 (2.2): a deliberately WRONG nudge message — the
            // header elsewhere on the page still claims the real $35
            // threshold, so this creates a genuine claim-vs-nudge
            // disagreement instead of the accurate-by-construction nudge
            // every other cart scenario gets below.
            shippingProgress.innerHTML = `<p>${cart.shippingNudgeOverride}</p><div class="progress-track"><i style="width:${pct}%"></i></div>`;
        } else {
            shippingProgress.innerHTML = deliveryCost === 0
                ? '<p><strong>✓ You unlocked FREE delivery!</strong></p><div class="progress-track"><i style="width:100%"></i></div>'
                : `<p>Spend <strong>${money(remaining)}</strong> more to unlock free delivery — delivery is ${money(deliveryCost)} on this order</p><div class="progress-track"><i style="width:${pct}%"></i></div>`;
        }
    }
    set('#summarySavings', money(totalSavings)); // single aggregate value — see comment above on why it can't hold child rows
    set('#summaryTotal', money(total));

    // Header cart-count badge — kept in sync so Pattern 1 doesn't accidentally
    // create a Pattern-5-style cart-count mismatch by omission.
    const cartBadge = document.querySelector('[data-cart-count]');
    if (cartBadge) {
        cartBadge.dataset.cartCount = itemCount;
        cartBadge.textContent = itemCount;
    }

    renderSavingsBreakdown(cart.savings_breakdown || []);

    // Promo field state — data-promo-state/applied-code/inline-reason are not
    // read by tag.js today, kept for forward compatibility with the intended
    // contract described in Pdp Css Contract.md.
    if (cart.promo) {
        const promoInput = document.querySelector('#promoInput, .promo-input');
        if (promoInput) {
            const promoField = promoInput.closest('.promo-field') || promoInput.parentElement;
            if (promoField) {
                promoField.dataset.promoState = cart.promo.state;
                if (cart.promo.code) promoField.dataset.appliedCode = cart.promo.code;
                if (cart.promo.reason) promoField.dataset.inlineReason = cart.promo.reason;
            }
        }
    }
}

function renderSavingsBreakdown(components) {
    document.querySelectorAll('[data-demo-savings-row]').forEach(el => el.remove());

    const hasOwnLoyaltyLine = components.some(c => c.type === 'loyalty');
    const autoPlusRow = document.querySelector('#plusMemberRow, #coPlusMemberRow');
    // Remove it outright rather than hiding it — display:none left it in the
    // DOM as a genuinely-hidden discount, which tag.js's hidden-content
    // detector correctly flags as suspicious (a real discount hidden from
    // the customer).
    if (autoPlusRow && hasOwnLoyaltyLine) autoPlusRow.remove();

    const totalRow = document.querySelector('#summaryTotal')?.closest('.summary-row');
    if (!totalRow) {
        console.warn('[AIORA DEMO] Could not find the total row to insert savings breakdown before.');
        return;
    }

    // SPEC: Savings breakdown section (.savings-display) contains separate
    // .savings-component divs, each with data-component-type and data-amount.
    // display:contents keeps this wrapper from affecting the existing
    // .summary-card layout — each child .summary-row still lays out exactly
    // as if it were a direct sibling.
    let savingsDisplay = document.querySelector('.savings-display');
    if (!savingsDisplay) {
        savingsDisplay = document.createElement('div');
        savingsDisplay.className = 'savings-display';
        savingsDisplay.style.display = 'contents';
        savingsDisplay.dataset.demoSavingsRow = 'true';
        totalRow.before(savingsDisplay);
    } else {
        savingsDisplay.innerHTML = '';
    }

    // Only the FIRST code-type discount reuses the site's real #promoRow —
    // this keeps the DOM structure identical to before for every scenario
    // that has just one code (the common case). If a scenario stacks a
    // SECOND code discount on top (only 1.5 does this today), #promoRow is
    // already taken, so it falls through and gets its own fresh row instead
    // — the old approach silently overwrote #promoRow's content the second
    // time, making the first code discount disappear from the screen.
    let promoRowClaimed = false;
    components.forEach(c => {
        if (c.type === 'code' && c.code && !promoRowClaimed) {
            const promoRow = document.querySelector('#promoRow');
            if (promoRow) {
                promoRowClaimed = true;
                promoRow.hidden = false;
                // app.js's own renderCart() runs first (module top-level,
                // before this DOMContentLoaded handler) and sets
                // style.display='none' on this row when the real cart has
                // no active promo. Clearing the `hidden` attribute alone
                // isn't enough — the inline style still wins and keeps the
                // row invisible (which tag.js correctly detects and flags).
                promoRow.style.display = '';
                // Real classes tag.js actually reads, plus the spec's
                // literal .savings-component class.
                promoRow.classList.add('savings-component', 'cart-discount', 'promo-applied');
                promoRow.dataset.demoSavingsRow = 'true';
                promoRow.dataset.discountType = c.type;
                promoRow.dataset.componentType = c.type;
                promoRow.dataset.amount = c.amount.toFixed(2);

                // Replace the native "Promo (CODE) Remove" boilerplate
                // entirely — its wrapper text and original HTML whitespace
                // were leaking into tag.js's applied_discount_constructs
                // (e.g. "Promo\n    (WELCOME10) Remove-$6.00"). Same clean
                // two-part shape as the other savings rows instead.
                promoRow.innerHTML = `<span class="promo-name">${c.label}</span> <strong class="promo-amount">-${money(c.amount)}</strong>`;

                savingsDisplay.appendChild(promoRow);
            }
            return;
        }

        let cls;
        if (c.type === 'loyalty') cls = 'loyalty-discount';
        else if (c.type === 'code') cls = 'cart-discount promo-applied'; // 2nd+ code, no #promoRow left
        else cls = 'discount-line'; // markdown / sale — visible, but not a "promotion"
        const row = document.createElement('div');
        row.className = `summary-row savings savings-component ${cls}`;
        row.dataset.demoSavingsRow = 'true';
        row.dataset.discountType = c.type; // real: matches [data-discount-type]
        // data-component-type / data-amount: not read by tag.js today, kept for
        // forward compatibility with the intended future contract.
        row.dataset.componentType = c.type;
        row.dataset.amount = c.amount.toFixed(2);
        row.innerHTML = `<span class="promo-name">${c.label}</span> <strong class="promo-amount">-${money(c.amount)}</strong>`;
        savingsDisplay.appendChild(row);
    });

    // Move the "You save" aggregate row to right above the total, after all
    // the individual discount lines, so the overall savings figure is the
    // last thing seen before the final price.
    const savingsRow = document.querySelector('#summarySavings')?.closest('.summary-row');
    if (savingsRow) {
        totalRow.before(savingsRow);
        // Bold the whole row so "You save" reads as the aggregate figure,
        // visually distinct from the individual discount lines above it.
        savingsRow.style.fontWeight = '800';
    }
}


// =====================================================================
// HERO OVERRIDE — Pattern 2 (2.1). Overrides the real homepage hero's
// headline text and adds a category scope to its claim, so the claim
// tag.js's Tier 6 extractClaim() reads (data-claim-percent is already
// baked into the real .hero markup at 35 — this scenario just needs to
// scope that existing claim to "electronics" and match the spec's exact
// headline wording).
// =====================================================================
function renderHeroOverride(hero) {
    const heroSection = document.querySelector('.hero');
    if (!heroSection) {
        console.error('[AIORA DEMO] .hero section not found on this page.');
        return;
    }
    heroSection.dataset.moduleType = 'hero';
    if (hero.claim_scope) heroSection.dataset.claimScope = hero.claim_scope;
    if (hero.claim_amount != null) {
        heroSection.dataset.claimAmount = hero.claim_amount;
        heroSection.dataset.claimType = 'dollar_off';
    }
    if (hero.headline) {
        const h1 = heroSection.querySelector('.hero-copy h1, h1');
        if (h1) h1.textContent = hero.headline;
    }
}

function ratingCountFor(id) {
    return 120 + [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) * 9;
}

// =====================================================================
// FEATURED TILES — Pattern 2 (2.1). Replaces the real #featuredGrid's
// default product mix with an explicit SKU list, using the site's own
// #productCardTemplate so the resulting cards are identical in shape to
// what app.js's buildProductCard() would produce.
// =====================================================================
function renderFeaturedTiles(skus) {
    const grid = document.querySelector('#featuredGrid');
    const template = document.querySelector('#productCardTemplate');
    if (!grid || !template) {
        console.error('[AIORA DEMO] #featuredGrid or #productCardTemplate not found.');
        return;
    }
    grid.innerHTML = '';
    skus.forEach(sku => {
        const product = products.find(p => p.id === sku);
        if (!product) {
            console.error(`[AIORA DEMO] Unknown SKU "${sku}" — check products.js`);
            return;
        }
        const card = template.content.firstElementChild.cloneNode(true);

        // Mirrors app.js's own applyVisual() sprite-positioning logic.
        const spriteIndex = Math.max(0, Number(product.id.split('-')[1]) - 1);
        const img = card.querySelector('.product-image');
        img.classList.add(`sprite-${product.category}`);
        img.style.setProperty('--sprite-x', (spriteIndex % 5) * 25 + '%');
        img.style.setProperty('--sprite-y', Math.floor(spriteIndex / 5) * 50 + '%');

        card.dataset.productId = product.id;
        card.dataset.brand = product.name.split(' ')[0];
        card.dataset.category = product.category;
        card.dataset.sponsored = 'false';
        card.dataset.availability = product.availability || 'in-stock';
        card.querySelector('.discount-badge').textContent = `${product.discount} OFF`;
        card.querySelector('.product-brand').textContent = product.brand;
        card.querySelector('h3').textContent = product.name;
        card.querySelector('.stars').textContent = `${product.rating.toFixed(1)} ★`;
        card.querySelector('.rating-count').textContent = ratingCountFor(product.id).toLocaleString('en-IN');
        card.querySelector('.product-meta').textContent = product.description;
        card.querySelector('.price-stack strong').textContent = money(product.price);
        card.querySelector('.price-stack del').textContent = money(product.oldPrice);
        card.querySelector('.price-stack span').textContent = `Save ${money(product.oldPrice - product.price)}`;

        grid.appendChild(card);
    });
}


// =====================================================================
// CLAIMS — generic claim-attribute setter for Pattern 2 scenarios that
// target an arbitrary existing module by ID (2.1 uses renderHeroOverride()
// above instead, since it also needs to swap headline text and tile SKUs).
// tag.js's Tier 6 extractClaim() now reads data-claim-percent/type/scope/
// code/min-spend off any element — this just sets those attributes.
// =====================================================================
function renderClaims(claims) {
    claims.forEach(claim => {
        const el = document.querySelector(`[data-module-id="${claim.moduleId}"]`);
        if (!el) return console.warn(`[AIORA DEMO] Claim target not found: ${claim.moduleId}`);
        if (claim.percent != null) el.dataset.claimPercent = claim.percent;
        if (claim.amount != null) el.dataset.claimAmount = claim.amount;
        if (claim.threshold != null) el.dataset.claimThreshold = claim.threshold;
        if (claim.type) el.dataset.claimType = claim.type;
        if (claim.scope) el.dataset.claimScope = claim.scope;
        if (claim.text) el.textContent = claim.text;
    });
}


// =====================================================================
// TILE OVERRIDES — Pattern 3+. No Pattern 1 scenario uses this either.
// =====================================================================
function applyTileOverrides(tiles) {
    (tiles.brandOverrides || []).forEach(({ sku, brand }) => {
        const card = document.querySelector(`[data-product-id="${sku}"]`);
        if (!card) return;
        card.dataset.brand = brand; // not read by tag.js, kept for forward compatibility
        // tag.js's real brand selector reads the VISIBLE .product-brand text,
        // never a data-brand attribute — that's the field that must change.
        const brandEl = card.querySelector('.product-brand');
        if (brandEl) brandEl.textContent = brand;
    });
    (tiles.sponsoredSkus || []).forEach(sku => {
        const card = document.querySelector(`[data-product-id="${sku}"]`);
        if (card) card.dataset.sponsored = 'true';
    });
    (tiles.bogoSkus || []).forEach(sku => {
        // data-bogo: not read by tag.js today, kept for forward compatibility.
        const card = document.querySelector(`[data-product-id="${sku}"]`);
        if (card) card.dataset.bogo = 'true';
    });
    // 4.1: overrides a tile's visible discount badge text (e.g. "17% OFF" ->
    // "25% OFF") and, optionally, its displayed price — so the category tile
    // is internally consistent (badge % actually matches the price shown).
    // The coordination failure this demo captures isn't badge-vs-price on
    // the same tile; it's this genuinely-25%-off category price vs. the
    // worse price the PDP page (a different demo slug) actually charges.
    (tiles.discountOverrides || []).forEach(({ sku, badge, price }) => {
        const card = document.querySelector(`[data-product-id="${sku}"]`);
        if (!card) return;
        const badgeEl = card.querySelector('.discount-badge');
        if (badgeEl) badgeEl.textContent = badge;
        if (price != null) {
            const priceEl = card.querySelector('.price-stack strong');
            if (priceEl) priceEl.textContent = money(price);
            // Recompute "Save $X" from the tile's own old-price element
            // rather than hardcoding it, so it can't drift out of sync with
            // whatever price is actually shown.
            const oldPriceEl = card.querySelector('.price-stack del');
            const saveEl = card.querySelector('.price-stack span');
            if (oldPriceEl && saveEl) {
                const oldPrice = Number(oldPriceEl.textContent.replace(/[^0-9.]/g, ''));
                if (!isNaN(oldPrice)) saveEl.textContent = 'Save ' + money(oldPrice - price);
            }
        }
    });
}


// =====================================================================
// CATEGORY BANNER — Pattern 4 (4.1). category.html has no banner element
// of its own, so this injects one, reusing the .promo-banner class (and
// its existing CSS) that already exists for the homepage's promo tiles.
// =====================================================================
function renderCategoryBanner(banner) {
    const heading = document.querySelector('.catalog-heading');
    if (!heading) {
        console.error('[AIORA DEMO] .catalog-heading not found on this page.');
        return;
    }
    let bannerEl = document.querySelector('[data-demo-banner]');
    if (!bannerEl) {
        bannerEl = document.createElement('div');
        // .promo-banner + .promo-tech reuse the homepage's own polished
        // gradient-banner styling (same classes as "Smart tech. Smarter
        // prices.") instead of an unstyled div — free, on-brand visuals.
        bannerEl.className = 'promo-banner promo-tech';
        bannerEl.dataset.demoBanner = 'true';
        // Inserted INSIDE .catalog-heading, between the text block and the
        // "Filters & sort" button — sits beside the heading on the same
        // row, not as a block below it. align-self overrides the parent's
        // align-items:flex-end so this item is vertically centered.
        // justify-content:space-between pins the text to the far left and
        // the thumbnails to the far right, instead of clustering both on
        // one side with the rest of the banner left empty.
        bannerEl.style.cssText = 'display:flex;flex-direction:row;align-items:center;justify-content:space-between;flex:0 0 auto;align-self:center;box-sizing:border-box;margin:0 1.5rem;min-height:110px;padding:1rem 1.5rem;overflow:hidden;';
        const filterToggle = heading.querySelector('#filterToggle, .filter-toggle');
        if (filterToggle) heading.insertBefore(bannerEl, filterToggle);
        else heading.appendChild(bannerEl);
    }
    // Width matches .results-toolbar's actual rendered width, so the
    // banner's right edge lines up with the "12 products / Sort by" row
    // below it exactly, regardless of screen size — .catalog-heading spans
    // the full page width while .results-toolbar only spans the grid
    // column (narrower, offset past the sidebar), so a flex-filled banner
    // inside .catalog-heading otherwise overshoots the toolbar's width.
    const toolbar = document.querySelector('.results-toolbar');
    if (toolbar) bannerEl.style.width = toolbar.getBoundingClientRect().width + 'px';
    bannerEl.dataset.moduleType = 'banner';
    if (banner.claim_percent != null) bannerEl.dataset.claimPercent = banner.claim_percent;
    if (banner.claim_scope) bannerEl.dataset.claimScope = banner.claim_scope;
    // Compact sizing to fit inline within the heading row — configurable
    // per-scenario via banner.eyebrowSize/headlineSize/ctaSize (rem).
    const eyebrowSize = banner.eyebrowSize || 0.65;
    const headlineSize = banner.headlineSize || 1.5;
    const ctaSize = banner.ctaSize || 0.8;

    // Overlapping product thumbnail cluster, scaled down to fit this
    // compact row — same sprite technique as renderFeaturedTiles().
    const thumbSkus = banner.thumbnails || ['el-1', 'el-2', 'el-8'];
    const thumbsHtml = thumbSkus.map((sku, i) => {
        const product = products.find(p => p.id === sku);
        if (!product) return '';
        const spriteIndex = Math.max(0, Number(product.id.split('-')[1]) - 1);
        const spriteX = (spriteIndex % 5) * 25 + '%';
        const spriteY = Math.floor(spriteIndex / 5) * 50 + '%';
        const size = i % 2 === 0 ? 72 : 58;
        return `<div class="product-image sprite-${product.category}" style="--sprite-x:${spriteX};--sprite-y:${spriteY};width:${size}px;height:${size}px;border-radius:50%;background-color:#fff;box-shadow:0 6px 14px rgba(0,0,0,0.35);flex-shrink:0;margin-left:${i === 0 ? 0 : -14}px;"></div>`;
    }).join('');

    bannerEl.innerHTML = `
        <div style="flex:0 1 auto;min-width:0;">
            <span style="font-size:${eyebrowSize}rem;">${banner.eyebrow || 'ELECTRONICS SALE'}</span>
            <h2 style="font-size:${headlineSize}rem;">${banner.headline}</h2>
            <b style="font-size:${ctaSize}rem;">${banner.ctaText || 'Limited time — shop now →'}</b>
        </div>
        <div style="flex:0 0 auto;display:flex;align-items:center;padding-left:1rem;">${thumbsHtml}</div>
    `;
}


// pdp.html ships with a static placeholder #hero (data-sku="FAKE-123")
// that app.js's renderPDP() replaces with the real product once it finishes
// (which may be async, e.g. a Supabase fetch). Now that demo_router.js no
// longer waits on its own network fetch, it can otherwise run its PDP
// override BEFORE that replacement happens — the override would land on
// the placeholder and then get wiped out when app.js's real markup swaps
// in. This waits until #hero's data-sku is no longer the placeholder value
// before calling back, so the override always lands on the real content.
function waitForRealPdpHero(callback, maxWaitMs = 3000) {
    const isReal = (hero) => hero && hero.dataset.sku && hero.dataset.sku !== 'FAKE-123';
    const hero = document.querySelector('#hero');
    if (isReal(hero)) { callback(); return; }
    const observer = new MutationObserver(() => {
        if (isReal(document.querySelector('#hero'))) {
            observer.disconnect();
            clearTimeout(fallback);
            callback();
        }
    });
    observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true, attributes: true });
    const fallback = setTimeout(() => {
        observer.disconnect();
        console.warn('[AIORA DEMO] waitForRealPdpHero: gave up waiting, applying override anyway.');
        callback();
    }, maxWaitMs);
}

// =====================================================================
// PDP OVERRIDE — Pattern 4 (4.1). Overrides the real, already-rendered
// PDP price/discount badge (app.js's renderPDP() runs first, same
// script-load-order pattern as everywhere else in this file) and adds
// the fine-print exclusion note below the price.
// =====================================================================
function renderPdpOverride(pdp) {
    const hero = document.querySelector('#hero');
    if (!hero) {
        console.error('[AIORA DEMO] #hero not found on this page.');
        return;
    }
    const priceEl = hero.querySelector('.price-stack .price, .price-stack strong, .price');
    if (priceEl && pdp.price != null) priceEl.textContent = money(pdp.price);
    const badgeEl = hero.querySelector('.discount-badge');
    if (badgeEl && pdp.badge) badgeEl.textContent = pdp.badge;
    // The "Add to Cart — $X" button has its own separate price span that
    // app.js renders from the real price — keep it in sync with the override
    // so it doesn't keep showing the pre-override amount.
    const addToCartPriceEl = document.querySelector('#add-to-cart-price');
    if (addToCartPriceEl && pdp.price != null) addToCartPriceEl.textContent = money(pdp.price);

    if (pdp.exclusionNote) {
        let noteEl = document.querySelector('[data-demo-exclusion-note]');
        if (!noteEl) {
            noteEl = document.createElement('p');
            noteEl.dataset.demoExclusionNote = 'true';
            noteEl.style.cssText = 'font-size:0.75rem;color:var(--muted);margin-top:0.5rem;';
            const priceStack = hero.querySelector('.price-stack');
            if (priceStack) priceStack.after(noteEl); else hero.appendChild(noteEl);
        }
        noteEl.textContent = pdp.exclusionNote;
    }
}
