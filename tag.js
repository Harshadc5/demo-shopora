/**
 * AIORA JS Tag — v0.2.0
 *
 * Tiered structured extraction. Replaces raw DOM capture with
 * signal-specific extractors organized in priority tiers.
 * Payload budget: 50 KB hard cap, stop at 90 % (45 KB).
 *
 * Installation:
 *   <script src="https://cdn.aiora.systems/v2/tag.js"
 *           data-client-id="retailer-prod-xxxx"
 *           data-sampling-rate="1.0"
 *           data-hydration-timeout="3000"
 *           data-dom-settle-ms="500"
 *           async>
 *   </script>
 *
 * Architecture:
 *   - All intelligence lives server-side. This tag is a dumb sensor.
 *   - Never modifies the retailer's DOM.
 *   - Never blocks page render.
 *   - Fails silently — any error must be invisible to the retailer's page.
 *   - One beacon per page load only.
 *   - No raw DOM in payload — structured tier fields only.
 */

(function () {
    try {

        // ================================================================
        // SECTION 1 — CONFIG
        // ================================================================

        const _script = document.currentScript;

        const config = {
            clientId: _script?.dataset?.clientId ?? null,
            samplingRate: parseFloat(_script?.dataset?.samplingRate ?? '1.0'),
            hydrationTimeout: parseInt(_script?.dataset?.hydrationTimeout ?? '3000'),
            domSettleMs: parseInt(_script?.dataset?.domSettleMs ?? '500'),
            //endpoint: _script?.dataset?.endpoint ?? 'https://ingest.aiora.systems/v1/signal',
            endpoint: 'https://9d94b0b527a5f0.lhr.life/api/collect',
        };

        if (!config.clientId) {
            console.warn('[AIORA] No data-client-id found on script tag. Tag will not fire.');
            return;
        }


        // ================================================================
        // SECTION 2 — SAMPLING GATE
        // TODO: replace with session-coherent hash sampling (see DECISIONS.md)
        // ================================================================

        if (Math.random() > config.samplingRate) return;


        // ================================================================
        // SECTION 3 — SESSION TOKEN
        // In-memory only — never written to any persistent storage.
        // ================================================================

        // const sessionToken = crypto.randomUUID(); //when it is in live production
        const sessionToken = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2) + Date.now().toString(36);

        // ================================================================
        // SECTION 4 — BEACON GUARD
        // ================================================================

        let beaconFired = false;


        // ================================================================
        // SECTION 5 — HYDRATION DETECTION (old)
        // ================================================================

        // old code - problem with subtotal (Home Depot cart subtotal and total are missing because HD renders them via React after page load. How general do you think this problem is? )
        /*function waitForHydration(onComplete) {
          let settleTimer = null;
    
          function onDomSettled() {
            observer.disconnect();
            clearTimeout(hardCap);
            onComplete();
          }
    
          function onDomMutation() {
            clearTimeout(settleTimer);
            settleTimer = setTimeout(onDomSettled, config.domSettleMs);
          }
    
          function onHardCapFired() {
            observer.disconnect();
            clearTimeout(settleTimer);
            onComplete();
          }
    
          const hardCap = setTimeout(onHardCapFired, config.hydrationTimeout);
          const observer = new MutationObserver(onDomMutation);
    
          settleTimer = setTimeout(onDomSettled, config.domSettleMs);
    
          if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
          }
        }*/

        //New code -waitforHydration() Home Depot cart subtotal and total are missing because HD renders them via React after page load. How general do you think this problem is? )
        /*function waitForHydration(onComplete) {
          let settleTimer = null;
          let isCartPage = window.location.href.toLowerCase().includes('/cart');
    
          // NEW: Checks if React has finished injecting the cart totals
          function isCriticalDataPresent() {
            if (!isCartPage) return true; // Don't hold up normal pages
            return !!document.querySelector('#summarySubtotal, .summary-subtotal, #summaryTotal');
          }
    
          function onDomSettled() {
            if (!isCriticalDataPresent()) {
              // React hasn't rendered the totals yet! Wait another 500ms (unless hardCap forces us).
              settleTimer = setTimeout(onDomSettled, config.domSettleMs);
              return;
            }
            observer.disconnect();
            clearTimeout(hardCap);
            onComplete();
          }
    
          function onDomMutation() {
            clearTimeout(settleTimer);
            settleTimer = setTimeout(onDomSettled, config.domSettleMs);
          }
    
          function onHardCapFired() {
            observer.disconnect();
            clearTimeout(settleTimer);
            onComplete();
          }
    
          const hardCap = setTimeout(onHardCapFired, config.hydrationTimeout);
          const observer = new MutationObserver(onDomMutation);
    
          settleTimer = setTimeout(onDomSettled, config.domSettleMs);
    
          if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
          }
        }*/

        // ------Micropolling logic to avoid the artificial 3s hard capped delay-------------------
        // ================================================================
        // SECTION 5 — HYDRATION DETECTION (DIRECTIVE 4: MICRO-POLLING)
        // ================================================================

        // We store the performance metric globally so Tier 4 can inject it into the payload
        /*window.__AIORA_HYDRATION_MS__ = 0;

        function waitForHydration(onComplete) {
            var startTime = performance.now();
            var isCartPage = window.location.href.toLowerCase().includes('/cart');

            // If it's not a cart/checkout page, there's no complex React hydration to wait for.
            if (!isCartPage) {
                setTimeout(onComplete, config.domSettleMs);
                return;
            }

            // DIRECTIVE 4: Aggressive Micro-Polling
            var pollTimer = setInterval(function () {
                // Did the React Cart finally render the subtotal?
                var found = !!firstMatch(document, FIELD_SEL.cartSubtotal) || !!firstMatch(document, FIELD_SEL.cartTotal);
                var elapsed = performance.now() - startTime;

                if (found || elapsed >= config.hydrationTimeout) {
                    clearInterval(pollTimer);
                    window.__AIORA_HYDRATION_MS__ = Math.round(elapsed); // Log the exact millisecond!
                    onComplete();
                }
            }, 50); // Polling every 50ms instead of waiting blindly!
        }*/


        // ================================================================
        // SECTION 5 — HYDRATION DETECTION (ELEMENT-LEVEL OBSERVER)
        // ================================================================

        window.__AIORA_HYDRATION_MS__ = 0;

        function waitForHydration(onComplete) {
            var startTime = performance.now();
            var path = window.location.pathname;

            // Re-use our classification logic to know what page we are on
            var pageType = 'other';
            if (path.includes('/cart')) pageType = 'cart';
            else if (path.includes('/product') || path.includes('/p/')) pageType = 'pdp';
            else if (path.includes('/search') || path.includes('/category')) pageType = 'search';

            // The Checklist Flags
            var hasFoundItems = false;
            var hasFoundTotal = false;
            var hasFoundEmptyState = false;

            // 1. The Safety Net (Hard Cap Timeout)
            var hardCapTimer = setTimeout(function () {
                if (observer) observer.disconnect();
                window.__AIORA_HYDRATION_MS__ = Math.round(performance.now() - startTime);
                onComplete(); // Fire anyway after 3 seconds if the site is broken
            }, config.hydrationTimeout);

            // 2. The Smart Element-Level Observer
            var observer = new MutationObserver(function () {
                var isReadyToFire = false;

                // Cart Page Checklist
                if (pageType === 'cart') {
                    if (firstMatch(document, CARD_SELECTORS)) hasFoundItems = true;
                    if (firstMatch(document, FIELD_SEL.cartSubtotal) || firstMatch(document, FIELD_SEL.cartTotal)) hasFoundTotal = true;
                    if (document.querySelector('.empty-cart-message, .empty-cart, [data-testid="empty-cart"]')) hasFoundEmptyState = true;

                    isReadyToFire = (hasFoundItems && hasFoundTotal) || hasFoundEmptyState;
                }
                // PDP Page Checklist
                else if (pageType === 'pdp') {
                    if (firstMatch(document, FIELD_SEL.name)) hasFoundItems = true;
                    if (firstMatch(document, FIELD_SEL.price)) hasFoundTotal = true;

                    isReadyToFire = hasFoundItems && hasFoundTotal;
                }
                // Search/Category Page Checklist
                else if (pageType === 'search') {
                    if (firstMatch(document, CARD_SELECTORS)) hasFoundItems = true;
                    if (document.querySelector('.no-results, .zero-results, .empty-search')) hasFoundEmptyState = true;

                    isReadyToFire = hasFoundItems || hasFoundEmptyState;
                }
                // Generic Pages (Fire instantly)
                else {
                    isReadyToFire = true;
                }

                // 3. Did we complete the checklist? Stop the observer and send payload!
                if (isReadyToFire) {
                    observer.disconnect();
                    clearTimeout(hardCapTimer);
                    window.__AIORA_HYDRATION_MS__ = Math.round(performance.now() - startTime);
                    onComplete();
                }
            });

            // Start watching the DOM instantly!
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true, characterData: true });

                // Trigger a fake mutation instantly, just in case the page loaded extremely fast!
                var textNode = document.createTextNode('');
                document.body.appendChild(textNode);
                document.body.removeChild(textNode);
            } else {
                // Failsafe if document.body is somehow missing
                setTimeout(onComplete, 100);
            }
        }



        // ================================================================
        // SECTION 6 — IDLE WAIT
        // ================================================================

        function waitForIdle(work) {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(work, { timeout: config.hydrationTimeout });
            } else {
                setTimeout(work, 0);
            }
        }


        // ================================================================
        // SECTION 7 — PII SCRUBBING
        // Defense-in-depth: scrub the DOM clone before extractors run.
        // Returns a parsed document, not a string.
        // ================================================================

        function scrubPII(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            doc.querySelectorAll('input, textarea, select').forEach(function (el) {
                el.removeAttribute('value');
                if (el.tagName === 'TEXTAREA') el.textContent = '';
            });

            doc.querySelectorAll('input[type="password"]').forEach(function (el) {
                el.removeAttribute('value');
                el.setAttribute('data-aiora-scrubbed', 'true');
            });

            doc.querySelectorAll('script').forEach(function (el) { el.remove(); });
            doc.querySelectorAll('style').forEach(function (el) { el.remove(); });

            var PII_DATA_ATTRS = [
                'data-email', 'data-user-email', 'data-customer-email',
                'data-user-id', 'data-customer-id', 'data-account-id',
                'data-phone', 'data-mobile',
                'data-first-name', 'data-last-name', 'data-full-name',
                'data-address', 'data-postcode', 'data-zip',
            ];
            var piiSelector = PII_DATA_ATTRS.map(function (a) { return '[' + a + ']'; }).join(',');
            doc.querySelectorAll(piiSelector).forEach(function (el) {
                PII_DATA_ATTRS.forEach(function (attr) { el.removeAttribute(attr); });
            });

            return doc;
        }


        // ================================================================
        // SECTION 8 — SELECTOR UTILITIES
        // ================================================================

        // Returns the first element matched by any selector in the list.
        function firstMatch(root, selectors) {
            for (var i = 0; i < selectors.length; i++) {
                try {
                    var found = root.querySelector(selectors[i]);
                    if (found) return found;
                } catch (e) { /* malformed selector — skip */ }
            }
            return null;
        }

        // Safe text content, trimmed and truncated. Returns null if empty.
        function textOf(el, max) {
            if (!el) return null;
            var t = (el.textContent || '').trim();
            return t ? t.slice(0, max || 120) : null;
        }


        // ================================================================
        // SECTION 9 — BUDGET TRACKER
        // 50 KB hard cap. Soft cap at 90 % (45 KB) — stop adding tiers
        // when soft cap is reached. Tiers 0–4 must always fit.
        // ================================================================

        var BUDGET_HARD_CAP = 50 * 1024;
        var BUDGET_SOFT_CAP = Math.floor(BUDGET_HARD_CAP * 0.9);

        function makeBudget() {
            var used = 0;
            var dropped = [];
            return {
                add: function (tier, data) {
                    used += JSON.stringify(data).length;
                },
                drop: function (tier) {
                    dropped.push(tier);
                },
                isOver: function () {
                    return used >= BUDGET_SOFT_CAP;
                },
                summary: function () {
                    return { bytes_used: used, hard_cap: BUDGET_HARD_CAP, tiers_dropped: dropped };
                },
            };
        }


        // ================================================================
        // SECTION 10 — TIER EXTRACTORS
        // ================================================================


        // ── 10.0  TIER 0 — ENVELOPE ────────────────────────────────────
        // Always present. Target ~300 bytes.
        // Includes: client_id, session_token, page_type, page_url_path, 
        // timestamp, tag_version, sampled, sequence_no, page_heading, 
        // breadcrumb, viewport, surface_id, region, identity_summary, 
        // and program_match.


        function classifyPageType(path) {
            var p = (path || '').toLowerCase();
            if (p.includes('/cart')) return 'cart';
            if (p.includes('/checkout')) return 'checkout';
            if (p.includes('/search')) return 'search';
            if (p.includes('/product') || p.includes('/p/') || p.includes('/pdp')) return 'pdp';
            if (p === '/' || p.includes('/home')) return 'homepage';
            return 'category';
        }

        function classifyPageTypeFromTitle(title) {
            var t = (title || '').toLowerCase();
            if (t.includes('cart') || t.includes('bag')) return 'cart';
            if (t.includes('checkout')) return 'checkout';
            if (t.includes('search')) return 'search';
            if (t.includes('product')) return 'pdp';
            return null;
        }
        // (Changes) used params instead of .pathname to extract search query
        function extractTier0(sampledIn) {
            try {
                var urlStr = window.location.href;

                // Prefer canonical URL path — carries the real path even when the page is
                // loaded at a different URL (e.g. proxies, test harnesses).
                var canonical = document.querySelector('link[rel="canonical"]');
                if (canonical && canonical.href) {
                    urlStr = canonical.href;
                }

                var path = '';
                try {
                    var urlObj = new URL(urlStr);
                    var params = new URLSearchParams(urlObj.search);
                    var blacklist = ['email', 'token', 'auth', 'password', 'session', 'uid', 'key', 'mobile', 'phone', 'contact', 'number'];
                    var keysToDelete = [];

                    params.forEach(function (value, key) {
                        var lowerKey = key.toLowerCase();
                        for (var i = 0; i < blacklist.length; i++) {
                            if (lowerKey.includes(blacklist[i])) {
                                keysToDelete.push(key);
                                break;
                            }
                        }
                    });

                    keysToDelete.forEach(function (k) { params.delete(k); });

                    path = urlObj.pathname;
                    var safeQuery = params.toString();
                    if (safeQuery) {
                        path += '?' + safeQuery;
                    }
                } catch (e) {
                    path = window.location.pathname; // Fallback just in case
                }

                var pageType;
                if (document.body && document.body.dataset && document.body.dataset.pageType) {
                    pageType = document.body.dataset.pageType;
                } else {

                    //-----OLD CODE---(changes) if any retailer has a modern websites often open "Side Carts" on top of PDPs
                    /*pageType = classifyPageType(path);
                    // Title overrides a generic path classification (category or homepage at "/").
                    // e.g. HD cart has canonical="/" but title="The Home Depot - Cart".
                    if (pageType === 'category' || pageType === 'homepage') {
                      pageType = classifyPageTypeFromTitle(document.title) || pageType;
                    }*/
                    //-------NEW--------
                    pageType = classifyPageType(path);

                    // ALWAYS let the Title override the URL if the title explicitly says it's a Cart or Checkout.
                    // This fixes side-carts or popups that open on top of a PDP.
                    var titleType = classifyPageTypeFromTitle(document.title);
                    if (titleType === 'cart' || titleType === 'checkout') {
                        pageType = titleType;
                    } else if (pageType === 'category' || pageType === 'homepage') {
                        // For generic URLs, fall back to title classification
                        pageType = titleType || pageType;
                    }
                    // Final Fallback: DOM Inspection for Side-Carts (The Ultimate Escalation)
                    if (pageType !== 'cart' && pageType !== 'checkout') {
                        // Look for obvious cart identifiers or a "checkout" button anywhere on the screen
                        var cartEl = document.querySelector('[data-type="cart"], .cart-drawer, .minicart, [data-testid="cart-drawer"]');
                        var checkoutBtn = document.querySelector('button[aria-label*="checkout" i], a[href*="checkout" i], button[title*="checkout" i]');

                        // TEMP, NEW: Look for Flipkart's exact "Place Order" div, OR any button/link containing the text "Place order"
                        var placeOrderTextNode = Array.from(document.querySelectorAll('button, a, div[dir="auto"], div[role="button"]'))
                            .find(function (el) { return el.innerText && el.innerText.toLowerCase().trim() === 'place order'; });
                        // If there is a checkout/place-order element physically visible on the screen, a cart overlay is open!
                        if (cartEl || checkoutBtn || (placeOrderTextNode && placeOrderTextNode.getBoundingClientRect().width > 0)) {
                            pageType = 'cart';
                        }
                    }
                }

                // --- NEW TIER 0 EXTRACTION LOGIC w.r.t Canonical Signal Schema

                // 1. Sequence number (defaults to 1 for standard page loads)
                var sequenceNo = 1;

                // 2. Page heading text (Fallback to document.title if no H1 exists)
                var headingEl = document.querySelector('h1');
                var pageHeading = headingEl ? headingEl.innerText.trim() : document.title;

                // 3. Breadcrumb trail array
                var breadcrumbs = [];
                var bcNodes = document.querySelectorAll('nav[aria-label="breadcrumb"] li, .breadcrumbs li, .breadcrumb li');
                for (var i = 0; i < bcNodes.length; i++) {
                    var bcText = bcNodes[i].innerText.trim();
                    if (bcText) breadcrumbs.push(bcText);
                }

                // 4. Viewport dimensions
                var viewport = { width: window.innerWidth, height: window.innerHeight };

                // 5. Surface ID (Unique ID for this specific payload capture event)
                var surfaceId = crypto.randomUUID();

                // 6. Region
                var region = document.documentElement.lang || 'unknown';

                // 7. Identity summary (Basic stub until we build Tier 5)
                var identitySummary = { state: 'unknown' };

                // 8. Third-party program match (Looking for common UTM/affiliate parameters)
                var programMatch = null;
                if (window.location.search.includes('utm_') || window.location.search.includes('affiliate')) {
                    programMatch = 'affiliate_or_campaign_detected';
                }

                // ---NEW---(add) w.r.t Canonical Signal Schema
                // 9. Visible Query
                var visibleQuery = null;
                var searchInput = firstMatch(document, FIELD_SEL.searchQueryInput);
                if (searchInput && searchInput.value) visibleQuery = searchInput.value.trim();


                return {
                    // Old Fields
                    client_id: config.clientId,
                    session_token: sessionToken,
                    tag_version: '0.2.0',
                    timestamp: new Date().toISOString(),
                    sampled: sampledIn,
                    page_type: pageType,
                    page_url_path: path,

                    // New Fields
                    sequence_no: sequenceNo,
                    page_heading: pageHeading,
                    breadcrumb: breadcrumbs,
                    viewport: viewport,
                    surface_id: surfaceId,
                    region: region,
                    identity_summary: identitySummary,
                    visible_query: visibleQuery,
                    program_match: programMatch
                };
            } catch (e) { return {}; }
        }



        // ── 10.1  TIER 1 — PRODUCT CARDS ──────────────────────────────
        // Primary/fallback selector lists per field.
        // Missing fields are omitted from the tile object (not nulled).
        // Positions capped at 40.

        var CARD_SELECTORS = [
            'article.product-card',
            '.product-card',
            '.product-tile',
            '[data-testid="product-pod"]',
            '[data-product-id]',
            '[data-product]',
        ];

        var FIELD_SEL = {

            // For Tier 0 (The Envelope)
            searchQueryInput: ['input[type="search"]', 'input[name="q"]', 'input[name="search"]', 'input[name="keyword"]'],

            // Existing Tier 1
            sku: ['[data-product-id]', '[data-sku]', '[data-product]', 'a[href*="/p/"]', '[class*="model"]', '.model-number'],
            name: ['[data-testid="attribute-product-label"]', 'h3', '.product-name', '[class*="name"]'],
            brand: ['[data-testid="attribute-brandname-inline"]', '.product-brand', '[class*="brand"]'],
            price: ['[data-testid="price-simple"]', '[data-automation-id="itemPrice"]', '.price-stack strong', '.deal-price strong', '[class*="price"] strong', '.price-current', '.price'],
            oldPrice: ['.price-stack del', 'del', '[class*="old-price"]', '.price-was', '.sui-line-through'],
            badge: ['.discount-badge', '[class*="badge"]', '[class*="deal-chip"]'],
            addToCart: ['.add-to-cart', '.button-primary.add-to-cart', '[class*="add-to-cart"]'],
            deliveryNote: ['.delivery-note', '[class*="delivery-note"]', '.delivery-promise', '.shipping-msg', '[class*="delivery"]'],

            // ---NEW: Tier 1 Additions --- w.r.t Canonical Signal Schema
            categoryWords: ['.category', '.department', '[data-category]', '.product-category'],
            mfrNumber: ['[data-mfr-no]', '[data-part-number]', '.mfr-number', '[class*="model"]', '.model-number'],
            dedupKey: ['[data-dedup-key]'],
            unitPrice: ['.unit-price', '.price-per-unit', '[data-unit-price]', '.price-measurement'],
            generalBadges: ['.badge', '.flag', '.product-label', '.scarcity-msg', '[data-automation-id="productBadge"]'],
            discountAmount: ['.discount-amount', '.savings-amount', '[class*="save"]', '.sui-text-success', '.price-stack span'],
            availability: ['.availability-msg', '.stock-msg', '.sold-out', '[data-availability]'],



            //--------NEW-------(add) 
            // NEW: Tier 2 Cart Summary
            cartSubtotal: ['#summarySubtotal', '[data-automation-id="totalsSubTotal"]'],
            cartTotal: ['#summaryTotal', '[data-automation-id="totalsTotal"]'],
            cartSavings: ['#summarySavings'],
            cartDelivery: ['#summaryDelivery'],
            cartTax: ['.summary-tax', '#summaryTax', '[data-automation-id="summaryTax"]'],
            cartPromotions: ['.cart-discount', '.promo-applied', '[data-automation-id="appliedPromotion"]', '#promoRow'],
            cartShippingThreshold: ['.shipping-threshold', '#shippingProgress', '.shipping-progress'],
            cartLoyalty: ['.loyalty-discount', '[data-automation-id="loyaltyDiscount"]'],
            // --- NEW TIER 2 ADDITIONS --- w.r.t Canonical Signal Schema
            appliedDiscountConstructs: ['.applied-discount-type', '[data-discount-type]', '.discount-construct'],
            promoInput: ['input[name*="discount"]', 'input[name*="coupon"]', '#promoCode', '.promo-input', '#promoInput'],
            altPaymentButtons: ['[data-testid*="apple"]', '.apple-pay', '#applePay', '.paypal-button', '[data-payment-method="google-pay"]', '.alt-payment'],
            promoInlineReason: ['.promo-error', '.discount-error', '.inline-error', '[data-automation-id="promoError"]'],
            loyaltyBalance: ['.loyalty-balance', '.points-balance', '[data-automation-id="loyaltyPointsBalance"]'],


            // NEW: Tier 2 Cart Line Items
            cartItemName: ['[data-automation-id="productDescription"]', 'h3'],
            cartItemBrand: ['[data-automation-id="productBrand"]'],
            cartItemQuantity: ['[data-automation-id="itemQuantity"] input', 'input[type="number"]', 'input.qty', 'select.qty', '.quantity-control span', 'input[class*="quantity"]', '[class*="qty"]'],
            cartItemDiscount: ['.cart-item-price small'],
            cartItemLineTotal: ['.line-total', '[data-automation-id="itemLineTotal"]', '.cart-item-total'],

            // NEW: Tier 2 Checkout
            checkoutItemName: ['[class*="name"]', 'p', 'span', 'strong',],
            checkoutItemPrice: ['[class*="price"]', 'strong'],
            checkoutSubtotal: ['#checkoutSubtotal', '[data-automation-id="totalsSubTotal"]'],
            checkoutTotal: ['#checkoutTotal', '[data-automation-id="totalsTotal"]'],
            checkoutDelivery: ['#checkoutDelivery', '[data-automation-id="pickupTotal"]'],
            checkoutTax: ['#checkoutTax', '[data-automation-id="salesTaxTotal"]'],
            checkoutOrderButton: ['#placeOrderButton', '.place-order', '[data-automation-id="checkoutButton"]'],
            checkoutItemQuantity: ['small', '[class*="qty"]'],  // <--- ADDED THIS LINE


            // NEW: Tier 4 Consistency
            heroElement: ['#heroDealName', '.hero', '#hero'],
            cartCount: ['[data-cart-count]'],
            resultCount: ['[class*="result-count"]', '.results-count', '#resultCount'],
            pageHeading: ['h1'],
            activeFilter: ['.filter.active', '[aria-current="page"]', '.active-filter'],
            cartItemLabel: ['#cartItemLabel']




        };

        var EXCLUDE_SURFACES = [
            '#recommendedGrid',
            '.cart-recommendations',
            '#suggestedGrid',
        ];

        // Maps currency symbols to ISO 4217 codes for price parsing.
        var CURRENCY_MAP = { '$': 'USD', '£': 'GBP', '€': 'EUR', '₹': 'INR', '¥': 'JPY', '₩': 'KRW' };

        // Surface name — one of: deals-strip, featured, recommendations, category-grid,
        // hero, catalog-grid, search-results, also-bought, other.
        function getSurface(card) {
            if (card.closest('#dealStrip')) return 'deals-strip';
            if (card.closest('#featuredGrid')) return 'featured';
            if (card.closest('#recommendedGrid')) return 'recommendations';
            if (card.closest('#categoryGrid')) return 'category-grid';
            if (card.closest('.hero')) return 'hero';
            if (card.closest('.product-grid')) return 'catalog-grid';
            if (card.closest('#searchResults, .search-results')) return 'search-results';
            if (card.closest('.also-bought, #alsoBought')) return 'also-bought';
            return 'other';
        }

        function addCardsFromSelector(doc, sel, seen, cards) {
            var matches = doc.querySelectorAll(sel);
            for (var i = 0; i < matches.length; i++) {
                var el = matches[i];
                if (seen) {
                    if (!seen.has(el)) { seen.add(el); cards.push(el); }
                } else {
                    cards.push(el);
                }
            }
        }

        function collectAllCards(doc) {
            var seen = typeof Set !== 'undefined' ? new Set() : null;
            var cards = [];
            for (var i = 0; i < CARD_SELECTORS.length; i++) {
                addCardsFromSelector(doc, CARD_SELECTORS[i], seen, cards);
            }
            return cards;
        }

        function isExcluded(card) {
            for (var i = 0; i < EXCLUDE_SURFACES.length; i++) {
                if (card.closest(EXCLUDE_SURFACES[i])) return true;
            }
            return false;
        }

        function extractSku(card) {
            var el = firstMatch(card, FIELD_SEL.sku);
            if (!el) return null;
            var sku = el.getAttribute('data-product-id') || el.getAttribute('data-sku') || el.getAttribute('data-product');
            // --- NEW: SKU-in-href Fallback ---
            if (!sku && (el.tagName === 'A' || el.hasAttribute('href'))) {
                var href = el.getAttribute('href') || '';
                var match = href.match(/\/p\/(?:[^\/]+\/)*(\d+)/);
                if (match) sku = match[1];
            }
            return sku ? sku.slice(0, 60) : null;
        }

        // Availability state — one of: in-stock, out-of-stock, low-stock, unknown.
        // out-of-stock: disabled add-to-cart button, or explicit .out-of-stock / .sold-out element.
        // low-stock: explicit class/attribute, or text pattern ("only N left", "low stock", "hurry").
        // unknown: no add-to-cart button found.
        function extractAvailability(card) {
            if (card.querySelector('[data-availability="out-of-stock"], .out-of-stock, .sold-out')) return 'out-of-stock';
            var btn = firstMatch(card, FIELD_SEL.addToCart);
            if (!btn) return 'unknown';
            if (btn.disabled) return 'out-of-stock';
            if (card.querySelector('[data-availability="low-stock"], .low-stock, [data-stock="low"]')) return 'low-stock';
            if (/only \d+ left|low stock|hurry/i.test(card.textContent)) return 'low-stock';
            return 'in-stock';
        }

        function extractBadgeInfo(card) {
            var text = textOf(firstMatch(card, FIELD_SEL.badge), 30);
            if (!text) return null;
            var result = { badge: text };
            var pct = text.match(/(\d+)\s*%/);
            if (pct) result.discount_pct = parseInt(pct[1]);
            return result;
        }

        // Splits a raw price string into numeric amount and ISO currency code.
        // Matches the FIRST price pattern found — ignores trailing was-price, per-unit, savings text.
        // "$99.00($49.50/unit)Save $129" → { amount: 99.00, currency: "USD" }
        function parsePrice(text) {
            if (!text) return null;
            var match = text.match(/([£$€₹¥₩])\s*([\d,]+(?:\.\d{1,2})?)/);
            if (!match) return null;
            var currency = CURRENCY_MAP[match[1]] || null;
            var num = parseFloat(match[2].replace(/,/g, ''));
            return isNaN(num) ? null : { amount: num, currency: currency };
        }

        // Builds a single product tile from a card DOM element.
        // All fields are spec-defined; missing fields are omitted (not set to null).
        function buildTile(card, position) {
            // Product name — required; tile is skipped if absent.
            var name = textOf(firstMatch(card, FIELD_SEL.name), 80);
            if (!name) return null;

            // Position in surface (integer, starting at 1) and surface name.
            var tile = { position: position, surface: getSurface(card), name: name };

            // SKU / data-product-id (or fallback selector).
            var sku = extractSku(card);
            if (sku) tile.sku = sku;

            // Brand text (if shown on card).
            var brand = textOf(firstMatch(card, FIELD_SEL.brand), 40);
            if (brand) tile.brand = brand;

            // Current price (numeric) and currency code separately.
            var parsed = parsePrice(textOf(firstMatch(card, FIELD_SEL.price), 20));
            if (parsed) { tile.price = parsed.amount; if (parsed.currency) tile.currency = parsed.currency; }

            // Original / strikethrough price (if visible).
            var parsedOld = parsePrice(textOf(firstMatch(card, FIELD_SEL.oldPrice), 20));
            if (parsedOld && parsedOld.amount !== (parsed && parsed.amount)) {
                tile.old_price = parsedOld.amount;
                tile.has_markdown = true;
            }

            // Discount badge text (e.g. "25% OFF") and parsed percentage as integer.
            var badgeInfo = extractBadgeInfo(card);
            if (badgeInfo) {
                tile.badge = badgeInfo.badge;
                if (badgeInfo.discount_pct) tile.discount_pct = badgeInfo.discount_pct;
            }

            // Availability state — one of: in-stock, out-of-stock, low-stock, unknown.
            tile.availability = extractAvailability(card);

            // Sponsored flag (boolean) — data-sponsored="true", .sponsored-label, .ad-label, or ad-slot class.
            tile.sponsored = !!card.querySelector('[data-sponsored="true"], .sponsored-label, .ad-label, [class*="ad-slot"]');

            // Per-card delivery promise text (if shown).
            var delivery = textOf(firstMatch(card, FIELD_SEL.deliveryNote), 60);
            if (delivery) tile.delivery_promise = delivery;


            // --- NEW TIER 1 EXTRACTION LOGIC --- w.r.t Canonical Signal Schema

            // 1. Visible category words (array of strings)
            var catWords = [];
            var catMatches = card.querySelectorAll(FIELD_SEL.categoryWords.join(', '));
            for (var j = 0; j < catMatches.length; j++) {
                var txt = catMatches[j].textContent.trim();
                if (txt) catWords.push(txt);
            }
            if (catWords.length > 0) tile.visible_category_words = catWords;

            // 2. Manufacturer number or deduplication keys
            var mfr = firstMatch(card, FIELD_SEL.mfrNumber);
            var dedup = firstMatch(card, FIELD_SEL.dedupKey);
            if (mfr || dedup) {
                tile.keys = {};
                if (mfr) tile.keys.mfr_number = mfr.getAttribute('data-mfr-no') || mfr.getAttribute('data-part-number') || textOf(mfr, 40);
                if (dedup) tile.keys.dedup_key = dedup.getAttribute('data-dedup-key') || textOf(dedup, 40);
            }

            // 3. Unit price
            var parsedUnit = parsePrice(textOf(firstMatch(card, FIELD_SEL.unitPrice), 30));
            if (parsedUnit) {
                tile.unit_price = parsedUnit.amount;
            }

            // 4. Badges array 
            var badges = [];
            var badgeEls = card.querySelectorAll(FIELD_SEL.generalBadges.join(', '));
            for (var b = 0; b < badgeEls.length; b++) {
                var bText = badgeEls[b].textContent.trim();
                if (bText && badges.indexOf(bText) === -1) badges.push(bText);
            }
            if (badges.length > 0) tile.badges = badges;

            // 5. Discount Amount 
            var amtEl = firstMatch(card, FIELD_SEL.discountAmount);
            if (amtEl) tile.discount_amount = textOf(amtEl, 20);

            // 6. Availability flag text 
            var availEl = firstMatch(card, FIELD_SEL.availability);
            if (availEl) tile.availability_flag_text = textOf(availEl, 40);


            return tile;
        }
        //-----OLD CODE--------
        // Enhancing the code to fit our Tier requirement
        /*function extractTier1(doc) {
          try {
            var cards = collectAllCards(doc);
            var tiles = [];
    
            // Phase 1: Extract up to 40 cards max for high performance speed
            for (var i = 0; i < cards.length; i++) {
              if (tiles.length >= 40) break;
              if (isExcluded(cards[i])) continue;
              var tile = buildTile(cards[i], tiles.length + 1);
              if (tile) tiles.push(tile);
            }
    
            // Phase 2: Dynamic Budget Enforcement (Target ~8KB / 8192 bytes) (add)
            var TIER1_BUDGET = 8192;
            var currentSize = JSON.stringify(tiles).length;
    
            // If those 40 products put us over budget AND we have more than 20,
            // dynamically drop from the back until we fit under 8KB.
            while (currentSize > TIER1_BUDGET && tiles.length > 20) {
              tiles.pop();
              currentSize = JSON.stringify(tiles).length;
            }
            return tiles;
          } catch (e) { return []; }
        }*/

        //--------- NEW CODE------
        // Enhancing the code to fit our Tier requirement
        function extractTier1(doc, pageType) {
            try {
                var tiles = [];
                var positionCounter = 1;

                // --- NEW:  - HERO PRODUCT EXTRACTION ---
                if (pageType === 'pdp') {
                    var heroEl = firstMatch(doc, FIELD_SEL.heroElement);

                    if (heroEl) {
                        // BUGFIX: If a hero wrapper is found, use the master full-extraction engine!
                        var heroTile = buildTile(heroEl, positionCounter);
                        if (heroTile) {
                            heroTile.surface = 'hero';
                            tiles.push(heroTile);
                            positionCounter++;
                        }
                    } else {
                        // Fallback: If we can't find a wrapper, we build the Hero manually using the h1 and main price
                        var h1 = textOf(doc.querySelector('h1, .product-title, [data-automation-id="productName"]'), 80);
                        if (h1) {
                            var heroTile = { position: positionCounter, surface: 'hero', name: h1 };
                            var skuEl = firstMatch(doc, FIELD_SEL.sku);
                            if (skuEl) heroTile.sku = skuEl.getAttribute('data-product-id') || skuEl.getAttribute('data-sku') || textOf(skuEl, 30);

                            var parsedPrice = parsePrice(textOf(firstMatch(doc, FIELD_SEL.price), 20));
                            if (parsedPrice) {
                                heroTile.price = parsedPrice.amount;
                                if (parsedPrice.currency) heroTile.currency = parsedPrice.currency;
                            }
                            tiles.push(heroTile);
                            positionCounter++;
                        }
                    }
                }


                // Phase 1: Extract the regular grids (Customers Also Bought, etc.)
                var cards = collectAllCards(doc);
                for (var i = 0; i < cards.length; i++) {
                    if (tiles.length >= 40) break;
                    if (isExcluded(cards[i])) continue;

                    // Prevent accidentally extracting the Hero product twice if it looks like a card
                    var heroSelectors = FIELD_SEL.heroElement.join(',');
                    if (pageType === 'pdp' && cards[i].closest && cards[i].closest(heroSelectors)) continue;

                    var tile = buildTile(cards[i], positionCounter);
                    if (tile) {
                        tiles.push(tile);
                        positionCounter++;
                    }
                }

                // Phase 2: Dynamic Budget Enforcement (Target ~8KB / 8192 bytes)
                var TIER1_BUDGET = 8192;
                var currentSize = JSON.stringify(tiles).length;

                while (currentSize > TIER1_BUDGET && tiles.length > 20) {
                    tiles.pop();
                    currentSize = JSON.stringify(tiles).length;
                }
                return tiles;
            } catch (e) { return []; }
        }


        // ── 10.2  TIER 2 — CART / CHECKOUT STATE ──────────────────────
        // Present when page_type is cart or checkout.
        // Each visible promo/discount line captured as a separate object.

        // old code for query selector 
        /*function buildCartLineItem(item) {
          var name = textOf(item.querySelector('[data-automation-id="productDescription"], h3'), 80);
          if (!name) return null;
          var li = { name: name };
          var brand = textOf(item.querySelector('[data-automation-id="productBrand"]'), 40);
          var priceEl = item.querySelector('[data-automation-id="itemPrice"]');
          var price = priceEl ? textOf(priceEl, 20) : textOf(item.querySelector('.cart-item-price strong'), 20);
          var oldPrice = textOf(item.querySelector('.cart-item-price del'), 20);
          var discount = textOf(item.querySelector('.cart-item-price small'), 20);
          var skuEl = item.querySelector('[data-item-id]');
          // --- [NEW] Extracting Quantity and Line Total --- (Changes)
          var qtyEl = item.querySelector('input[type="number"], input.qty, select.qty, [data-automation-id="itemQuantity"]');
          var qtyText = qtyEl ? (qtyEl.value || qtyEl.textContent).trim() : null;
          if (qtyText) li.quantity = parseInt(qtyText, 10);
          var lineTotalEl = item.querySelector('.line-total, [data-automation-id="itemLineTotal"], .cart-item-total');
          if (lineTotalEl) li.line_total = textOf(lineTotalEl, 20);*/

        //------------New-----------(Add)---code for first match
        function buildCartLineItem(item) {
            // Look how clean this is! No more hardcoded strings.
            // We just use firstMatch() to check the FIELD_SEL list.
            var name = textOf(firstMatch(item, FIELD_SEL.cartItemName), 80);
            if (!name) return null;
            var li = { name: name };

            var brand = textOf(firstMatch(item, FIELD_SEL.cartItemBrand), 40);

            // We can reuse the price/badge logic from Tier 1!
            var price = textOf(firstMatch(item, FIELD_SEL.price), 20);
            var oldPrice = textOf(firstMatch(item, FIELD_SEL.oldPrice), 20);
            var discount = textOf(firstMatch(item, FIELD_SEL.cartItemDiscount), 20);

            var skuEl = item.querySelector('[data-item-id]') || firstMatch(item, FIELD_SEL.sku);
            if (skuEl) {
                li.sku = skuEl.getAttribute('data-item-id') || skuEl.getAttribute('data-product-id') || skuEl.getAttribute('data-sku') || textOf(skuEl, 30);

                // --- NEW: SKU-in-href Fallback ---
                if (!li.sku && (skuEl.tagName === 'A' || skuEl.hasAttribute('href'))) {
                    var href = skuEl.getAttribute('href') || '';
                    var match = href.match(/\/p\/(?:[^\/]+\/)*(\d+)/);
                    if (match) li.sku = match[1];
                }
            }
            var qtyEl = firstMatch(item, FIELD_SEL.cartItemQuantity);
            var qtyText = qtyEl ? (qtyEl.getAttribute('aria-valuenow') || qtyEl.getAttribute('value') || qtyEl.value || qtyEl.textContent).trim() : null;
            if (qtyText) li.quantity = parseInt(qtyText, 10);

            var lineTotal = textOf(firstMatch(item, FIELD_SEL.cartItemLineTotal), 20);
            if (lineTotal) li.line_total = lineTotal;

            // ----------------------------------------------
            if (brand) li.brand = brand;
            if (price) li.price = price;
            if (oldPrice) li.old_price = oldPrice;
            if (discount) li.discount = discount;
            /*if (skuEl) li.sku = skuEl.getAttribute('data-item-id');*/
            return li;
        }

        function collectCartLineItems(doc) {
            var items = doc.querySelectorAll(
                '#cartItems article.cart-item, #cartItems .cart-item, [data-automation-id="cart-item"]'
            );
            var lineItems = [];
            for (var i = 0; i < items.length; i++) {
                var li = buildCartLineItem(items[i]);
                if (li) lineItems.push(li);
            }
            return lineItems;
        }

        // old code for query selector
        /*function buildCheckoutLineItem(item) {
          var nameEl = item.querySelector('[class*="name"], span, strong, p');
          var priceEl = item.querySelector('[class*="price"], strong');
          var name = textOf(nameEl, 80);
          if (!name) return null;
          var li = { name: name };
          var price = textOf(priceEl, 20);
          if (price) li.price = price;
          return li;
        }*/

        //---------------New------------(add) - code for first match
        function buildCheckoutLineItem(item) {
            var name = textOf(firstMatch(item, FIELD_SEL.checkoutItemName), 80);
            if (!name) return null;
            var li = { name: name };

            var price = textOf(firstMatch(item, FIELD_SEL.checkoutItemPrice), 20);
            if (price) li.price = price;

            // --- NEW: Grab Quantity ---
            var qty = textOf(firstMatch(item, FIELD_SEL.checkoutItemQuantity), 20);
            if (qty) li.quantity = qty;

            return li;
        }

        function collectCheckoutLineItems(doc) {
            var lineItems = [];
            var seen = {};

            function addIfUnseen(item) {
                var key = (item.name || '') + '|' + (item.price || '');
                if (!seen[key]) { seen[key] = true; lineItems.push(item); }
            }

            // Generic pattern
            var items = doc.querySelectorAll('#checkoutItems .mini-cart-item, #checkoutItems [class*="item"], #checkoutItems li');
            for (var i = 0; i < items.length; i++) {
                var li = buildCheckoutLineItem(items[i]);
                if (li) addIfUnseen(li);
            }

            // HD bopis pattern: itemTitle_bopis_N / itemDescription_bopis_N / itemPrice_bopis_N
            var titleEls = doc.querySelectorAll('[data-automation-id^="itemTitle_bopis_"]');
            for (var j = 0; j < titleEls.length; j++) {
                var titleEl = titleEls[j];
                var brand = textOf(titleEl.querySelector('p'), 40);
                var descEl = titleEl.querySelector('[data-automation-id^="itemDescription_bopis_"]');
                var name = textOf(descEl ? descEl.querySelector('p') : null, 80);
                if (!name) continue;
                var item = { name: name };
                if (brand) item.brand = brand;
                var parent = titleEl.parentElement;
                var priceEl = parent ? parent.querySelector('[data-automation-id^="itemPrice_bopis_"]') : null;
                var price = textOf(priceEl ? priceEl.querySelector('p') : null, 20);
                if (price) item.price = price;
                var qtyEl = titleEl.querySelector('[data-automation-id^="itemQuantity_bopis_"]');
                var qty = textOf(qtyEl ? qtyEl.querySelector('p') : null, 10);
                if (qty) item.quantity = qty;
                addIfUnseen(item);
            }

            return lineItems;
        }
        // old code for queryselector
        /*function extractCartState(doc) {
          var result = { page_context: 'cart', line_items: collectCartLineItems(doc) };
    
          var subtotal = textOf(doc.querySelector('#summarySubtotal'), 20);
          var total = textOf(doc.querySelector('#summaryTotal'), 20);
          var savings = textOf(doc.querySelector('#summarySavings'), 20);
          var delivery = textOf(doc.querySelector('#summaryDelivery'), 20);
    
    
          if (subtotal) result.subtotal = subtotal;
          if (total) result.total = total;
          if (savings) result.savings_shown = savings;
          if (delivery) result.delivery_cost = delivery;
    
          // --- [NEW] Extracting Numerics for Tier 4 Math --- (Changes)
          if (subtotal) {
            var num = parseFloat(subtotal.replace(/[^0-9.-]+/g, ''));
            if (!isNaN(num)) result.subtotal_numeric = num;
          }
          if (total) {
            var numTotal = parseFloat(total.replace(/[^0-9.-]+/g, ''));
            if (!isNaN(numTotal)) result.total_numeric = numTotal;
          }
          if (savings) {
            var numSavings = parseFloat(savings.replace(/[^0-9.-]+/g, ''));
            if (!isNaN(numSavings)) result.savings_numeric = numSavings;
          }
          if (delivery) {
            var numDelivery = parseFloat(delivery.replace(/[^0-9.-]+/g, ''));
            if (!isNaN(numDelivery)) result.delivery_numeric = numDelivery;
          }
          // ----------------------------------------------
    
          var itemLabelEl = doc.querySelector('#cartItemLabel');
          if (itemLabelEl) {
            var n = parseInt(itemLabelEl.textContent);
            if (!isNaN(n)) result.item_count = n;
          }
    
          var shippingBar = doc.querySelector('#shippingProgress, .shipping-progress');
          result.promo_field_present = !!doc.querySelector('input[name*="discount"], input[name*="coupon"]');
          result.checkout_reachable = !!doc.querySelector('#checkoutButton');
          result.shipping_bar_shown = !!(shippingBar && shippingBar.textContent.trim());
    
          // --- [NEW] Extracting Tier 2 Missing Requirements --- (Changes)
    
          // 3(as per doc). Promotion line items
          var promoEls = doc.querySelectorAll('.cart-discount, .promo-applied, [data-automation-id="appliedPromotion"]');
          if (promoEls.length > 0) {
            result.promotions = [];
            promoEls.forEach(function (el) {
              var promo = {};
              var nameEl = el.querySelector('.promo-name, strong, p');
              var amtEl = el.querySelector('.promo-amount, .discount-amount, span');
    
              if (nameEl) promo.name = nameEl.textContent.trim();
              if (amtEl) {
                promo.amount = textOf(amtEl, 20);
    
                // Check for percentage like "20%" or "15%"
                var pctMatch = promo.amount.match(/(\d+)%/);
                if (pctMatch) promo.percentage = parseInt(pctMatch[1], 10);
              }
              if (promo.name || promo.amount) result.promotions.push(promo);
            });
          }
          // 4(as per doc). Loyalty discount line
          var loyaltyEl = doc.querySelector('.loyalty-discount, [data-automation-id="loyaltyDiscount"]');
          if (loyaltyEl) result.loyalty_discount = textOf(loyaltyEl, 20);
    
          // 5(as per doc). Tax line
          var taxEl = doc.querySelector('.summary-tax, #summaryTax, [data-automation-id="summaryTax"]');
          if (taxEl) {
            result.tax = textOf(taxEl, 20);
            var numTax = parseFloat(result.tax.replace(/[^0-9.-]+/g, ''));
            if (!isNaN(numTax)) result.tax_numeric = numTax;
          }
    
          // 6 & 7(as per doc). Shipping Promise & Threshold Messaging
          var shippingPromiseEl = doc.querySelector('.shipping-promise, #shippingPromise');
          if (shippingPromiseEl) result.shipping_promise = shippingPromiseEl.textContent.trim();
    
          var shippingThresholdEl = doc.querySelector('.shipping-threshold, #shippingProgress, .shipping-progress');
          if (shippingThresholdEl) {
            var msg = shippingThresholdEl.textContent.trim();
            result.shipping_threshold_message = msg;
    
            // 8(as per doc). Parse Free Shipping Eligibility
            var lowerMsg = msg.toLowerCase();
            if (lowerMsg.includes('you have free') || lowerMsg.includes('eligible') || lowerMsg.includes('qualify')) {
              result.free_shipping_eligibility = 'eligible';
            } else if (lowerMsg.includes('away from free') || lowerMsg.includes('add') || lowerMsg.includes('spend')) {
              result.free_shipping_eligibility = 'not-eligible';
            } else {
              result.free_shipping_eligibility = 'unknown';
            }
    
            // Extract threshold dollar value (e.g. "Add $15 for free shipping" -> 15)
            var threshNum = parseFloat(msg.replace(/[^0-9.-]+/g, ''));
            if (!isNaN(threshNum)) result.free_shipping_threshold_value = threshNum;
          }
          // ----------------------------------------------------
    
          return result;
        }*/

        //-----------NEW------(add) code for first match
        function extractCartState(doc) {
            var result = { page_context: 'cart', line_items: collectCartLineItems(doc) };

            var subtotal = textOf(firstMatch(doc, FIELD_SEL.cartSubtotal), 20);
            var total = textOf(firstMatch(doc, FIELD_SEL.cartTotal), 20);
            var savings = textOf(firstMatch(doc, FIELD_SEL.cartSavings), 20);
            var delivery = textOf(firstMatch(doc, FIELD_SEL.cartDelivery), 20);

            if (subtotal) result.subtotal = subtotal;
            if (total) result.total = total;
            if (savings) result.savings_shown = savings;
            if (delivery) result.delivery_cost = delivery;

            // Extracting Numerics for Tier 4 Math
            if (subtotal) {
                var num = parseFloat(subtotal.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(num)) result.subtotal_numeric = num;
            }
            if (total) {
                var numTotal = parseFloat(total.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(numTotal)) result.total_numeric = numTotal;
            }
            if (savings) {
                var numSavings = parseFloat(savings.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(numSavings)) result.savings_numeric = numSavings;
            }
            if (delivery) {
                var numDelivery = parseFloat(delivery.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(numDelivery)) result.delivery_numeric = numDelivery;
            }

            var itemLabelEl = doc.querySelector('#cartItemLabel');
            if (itemLabelEl) {
                var n = parseInt(itemLabelEl.textContent);
                if (!isNaN(n)) result.item_count = n;
            }

            var shippingBar = doc.querySelector('#shippingProgress, .shipping-progress');
            // old code 
            /*result.promo_field_present = !!doc.querySelector('input[name*="discount"], input[name*="coupon"]');*/

            // --- NEW TIER 2 EXTRACTION LOGIC --- w.r.t Canonical Signal Schema

            // 1. Promo field state (active, disabled, hidden, or not-present)
            var promoInput = firstMatch(doc, FIELD_SEL.promoInput);
            if (promoInput) {
                if (promoInput.disabled) result.promo_field_state = 'disabled';
                else if (promoInput.offsetParent === null) result.promo_field_state = 'hidden';
                else result.promo_field_state = 'active';
            } else {
                result.promo_field_state = 'not-present';
            }
            result.promo_field_present = (result.promo_field_state !== 'not-present');

            // 2. Checkout controls (Alternative payment buttons)
            var altPayments = doc.querySelectorAll(FIELD_SEL.altPaymentButtons.join(', '));
            if (altPayments.length > 0) {
                result.alt_payment_methods = [];
                for (var i = 0; i < altPayments.length; i++) {
                    var btnClass = (altPayments[i].className || '').toLowerCase();
                    var btnId = (altPayments[i].id || '').toLowerCase();
                    if (btnClass.includes('apple') || btnId.includes('apple')) result.alt_payment_methods.push('apple_pay');
                    else if (btnClass.includes('paypal') || btnId.includes('paypal')) result.alt_payment_methods.push('paypal');
                    else if (btnClass.includes('google') || btnId.includes('google')) result.alt_payment_methods.push('google_pay');
                }
            }

            // 3. Applied discount constructs
            var discountConstructEls = doc.querySelectorAll(FIELD_SEL.appliedDiscountConstructs.join(', '));
            if (discountConstructEls.length > 0) {
                result.applied_discount_constructs = [];
                for (var k = 0; k < discountConstructEls.length; k++) {
                    var constructText = discountConstructEls[k].innerText.trim();
                    if (constructText) result.applied_discount_constructs.push(constructText);
                }
            }

            result.checkout_reachable = !!doc.querySelector('#checkoutButton');
            result.shipping_bar_shown = !!(shippingBar && shippingBar.textContent.trim());

            // 4. Promo Inline Reason 
            var promoReasonEl = firstMatch(doc, FIELD_SEL.promoInlineReason);
            if (promoReasonEl) result.promo_field_inline_reason = textOf(promoReasonEl, 40);

            // 5. Loyalty Balance Rendered 
            var loyaltyBalanceEl = firstMatch(doc, FIELD_SEL.loyaltyBalance);
            result.loyalty_balance_rendered = !!loyaltyBalanceEl;


            // 3. Promotion line items
            var promoEls = doc.querySelectorAll(FIELD_SEL.cartPromotions.join(', '));
            if (promoEls.length > 0) {
                result.promotions = [];
                promoEls.forEach(function (el) {
                    var promo = {};
                    var nameEl = el.querySelector('.promo-name, strong, p');
                    var amtEl = el.querySelector('.promo-amount, .discount-amount') || el.querySelector('span:not(.promo-name)');

                    if (nameEl) promo.name = nameEl.textContent.trim();
                    if (amtEl) {
                        promo.amount = textOf(amtEl, 20);
                        var pctMatch = promo.amount.match(/(\d+)%/);
                        if (pctMatch) promo.percentage = parseInt(pctMatch[1], 10);
                    }
                    if (promo.name || promo.amount) result.promotions.push(promo);
                });
            }

            // 4. Loyalty discount line
            var loyaltyEl = firstMatch(doc, FIELD_SEL.cartLoyalty);
            if (loyaltyEl) result.loyalty_discount = textOf(loyaltyEl, 20);

            // 5. Tax line
            var taxEl = firstMatch(doc, FIELD_SEL.cartTax);
            if (taxEl) {
                result.tax = textOf(taxEl, 20);
                var numTax = parseFloat(result.tax.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(numTax)) result.tax_numeric = numTax;
            }

            // 6 & 7. Shipping Promise & Threshold Messaging
            var shippingPromiseEl = doc.querySelector('.shipping-promise, #shippingPromise, [data-automation-id="pickupETA"], [data-testid="pickupTimeline"]');
            if (shippingPromiseEl) result.shipping_promise = shippingPromiseEl.textContent.trim();

            var shippingThresholdEl = firstMatch(doc, FIELD_SEL.cartShippingThreshold);
            if (shippingThresholdEl) {
                var msg = shippingThresholdEl.textContent.trim();
                result.shipping_threshold_message = msg;

                // 8. Parse Free Shipping Eligibility
                var lowerMsg = msg.toLowerCase();
                if (lowerMsg.includes('you have free') || lowerMsg.includes('eligible') || lowerMsg.includes('qualify')) {
                    result.free_shipping_eligibility = 'eligible';
                } else if (lowerMsg.includes('away from free') || lowerMsg.includes('add') || lowerMsg.includes('spend')) {
                    result.free_shipping_eligibility = 'not-eligible';
                } else {
                    result.free_shipping_eligibility = 'unknown';
                }
                var threshNum = parseFloat(msg.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(threshNum)) result.free_shipping_threshold_value = threshNum;
            }


            return result;
        }

        // old code for query selector
        /*function extractCheckoutState(doc) {
          var result = { page_context: 'checkout', line_items: collectCheckoutLineItems(doc) };
    
          var subtotal = textOf(doc.querySelector('#checkoutSubtotal, [data-automation-id="totalsSubTotal"]'), 20);
          var total = textOf(doc.querySelector('#checkoutTotal, [data-automation-id="totalsTotal"]'), 20);
          var delivery = textOf(doc.querySelector('#checkoutDelivery'), 20);
    
          if (subtotal) result.subtotal = subtotal;
          if (total) result.total = total;
          if (delivery) result.delivery_cost = delivery;
    
          result.order_button_shown = !!doc.querySelector('#placeOrderButton, .place-order, [data-automation-id="checkoutButton"]');
          return result;
        }*/

        //---------NEW-------------add -code for first match
        function extractCheckoutState(doc) {
            var result = { page_context: 'checkout', line_items: collectCheckoutLineItems(doc) };

            var subtotal = textOf(firstMatch(doc, FIELD_SEL.checkoutSubtotal), 20);
            var total = textOf(firstMatch(doc, FIELD_SEL.checkoutTotal), 20);
            var delivery = textOf(firstMatch(doc, FIELD_SEL.checkoutDelivery), 20);
            var tax = textOf(firstMatch(doc, FIELD_SEL.checkoutTax), 20);

            if (subtotal) {
                result.subtotal = subtotal;
                var numSub = parseFloat(subtotal.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(numSub)) result.subtotal_numeric = numSub;
            }
            if (total) {
                result.total = total;
                var numTotal = parseFloat(total.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(numTotal)) result.total_numeric = numTotal;
            }
            if (delivery) {
                result.delivery_cost = delivery;
                var numDel = parseFloat(delivery.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(numDel)) result.delivery_numeric = numDel;
            }
            if (tax) {
                result.tax = tax;
                var numTax = parseFloat(tax.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(numTax)) result.tax_numeric = numTax;
            }

            result.order_button_shown = !!firstMatch(doc, FIELD_SEL.checkoutOrderButton);
            return result;
        }

        function extractTier2(doc) {
            try {
                var isCart = !!doc.querySelector('.cart-layout, .cart-items, #cartItems, [data-automation-id="cart-item"]');
                var isCheckout = !!doc.querySelector('.checkout-layout, .checkout-summary, #checkoutItems, [data-testid="checkout-sections"], [data-automation-id^="itemTitle_bopis_"]');
                if (!isCart && !isCheckout) return null;
                if (isCart) return extractCartState(doc);
                if (isCheckout) return extractCheckoutState(doc);
                return null;
            } catch (e) { return null; }
        }


        // ── 10.3  TIER 3 — SURFACE AGGREGATES ─────────────────────────
        // Cheap pass over Tier 1 output. ~200 bytes.

        function numericAsc(a, b) { return a - b; }

        function accumulateTile(tile, acc) {
            if (tile.sponsored) acc.sponsored++;
            if (tile.has_markdown || tile.discount_pct) acc.discounted++;
            if (tile.availability === 'out-of-stock') acc.outOfStock++;
            if (tile.availability === 'low-stock') acc.lowStock++;
            if (tile.discount_pct) acc.discountPcts.push(tile.discount_pct);
            if (tile.price !== undefined && tile.price !== null) {
                var n = typeof tile.price === 'number' ? tile.price : parseFloat(String(tile.price).replace(/[^0-9.]/g, ''));
                if (!isNaN(n)) acc.prices.push(n);
            }
            // --- [NEW] Grab the currency from the product card --- (changes)
            if (tile.currency && acc.currencies.indexOf(tile.currency) === -1) {
                acc.currencies.push(tile.currency);
            }
            // ----------------------------------------------------
        }

        function computeMedian(sorted) {
            var mid = Math.floor(sorted.length / 2);
            return sorted.length % 2
                ? sorted[mid]
                : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
        }

        function extractTier3(t1Tiles) {
            try {
                if (!t1Tiles || !t1Tiles.length) return null;

                var acc = { sponsored: 0, discounted: 0, outOfStock: 0, lowStock: 0, discountPcts: [], prices: [], currencies: [] }; // added curriences:[] (Changes)
                for (var i = 0; i < t1Tiles.length; i++) {
                    accumulateTile(t1Tiles[i], acc);
                }

                var result = {
                    total_products: t1Tiles.length,
                    sponsored_count: acc.sponsored,
                    organic_count: t1Tiles.length - acc.sponsored,
                    discounted_count: acc.discounted,
                    full_price_count: t1Tiles.length - acc.discounted,
                    out_of_stock_count: acc.outOfStock,
                    low_stock_count: acc.lowStock,
                };

                if (acc.discountPcts.length) {
                    acc.discountPcts.sort(numericAsc);
                    result.discount_pct_min = acc.discountPcts[0];
                    result.discount_pct_max = acc.discountPcts[acc.discountPcts.length - 1];
                    result.discount_pct_median = computeMedian(acc.discountPcts);
                }

                if (acc.prices.length) {
                    acc.prices.sort(numericAsc);
                    result.price_min = acc.prices[0];
                    result.price_max = acc.prices[acc.prices.length - 1];

                    // --- [NEW] Attach the currency to the output --- (changes)
                    if (acc.currencies.length > 0) result.price_currency = acc.currencies[0];
                    // -----------------------------------------------
                }

                return result;
            } catch (e) { return null; }
        }


        // ── 10.4  TIER 4 — DOM CONSISTENCY SIGNALS ────────────────────
        // Boolean flags + the values being compared.
        // Tag notes discrepancies; backend holds source-of-truth.

        // old code for query selector
        /*function extractTier4(doc, t1Tiles, t2)//added t2 - (changes)
        {
          try {
            var signals = {};
    
            // --- [NEW] Page heading vs filter state --- (add)
            var h1 = doc.querySelector('h1');
            var activeFilter = doc.querySelector('.filter.active, [aria-current="page"], .active-filter');
            if (h1 && activeFilter) {
              signals.heading_matches_filter = h1.textContent.trim().toLowerCase() === activeFilter.textContent.trim().toLowerCase();
            }
    
            // --- [NEW] Cart Math Reconciliation --- (Changes)
            if (t2 && t2.subtotal_numeric !== undefined && t2.total_numeric !== undefined) {
              var sub = t2.subtotal_numeric || 0;
              var sav = t2.savings_numeric || 0;
              var tax = t2.tax_numeric || 0;
              var del = t2.delivery_numeric || 0;
    
              // Using penny-math to avoid JS floating point bugs!
              var calculatedTotal = Math.round((sub - sav + tax + del) * 100) / 100;
              signals.cart_math_match = (calculatedTotal === t2.total_numeric);
            }
            // ------------------------------------------
    
    
            // Header cart count vs. page item count
            var headerCartEl = doc.querySelector('[data-cart-count]');
            var cartItemLabelEl = doc.querySelector('#cartItemLabel');
            if (headerCartEl && cartItemLabelEl) {
              var headerCount = parseInt(
                headerCartEl.getAttribute('data-cart-count') || headerCartEl.textContent
              );
              var pageCount = parseInt(cartItemLabelEl.textContent);
              if (!isNaN(headerCount) && !isNaN(pageCount)) {
                signals.cart_count_match = headerCount === pageCount;
                signals.cart_count_header = headerCount;
                signals.cart_count_page = pageCount;
              }
            }
    
            // Sponsored-same-as-organic: any SKU appears in both buckets
            if (t1Tiles && t1Tiles.length && typeof Set !== 'undefined') {
              var sponsoredSkus = new Set();
              var organicSkus = new Set();
              t1Tiles.forEach(function (tile) {
                if (!tile.sku) return;
                if (tile.sponsored) sponsoredSkus.add(tile.sku);
                else organicSkus.add(tile.sku);
              });
              var overlap = false;
              sponsoredSkus.forEach(function (sku) {
                if (organicSkus.has(sku)) overlap = true;
              });
              if (overlap) signals.sponsored_same_as_organic = true;
            }
    
            // --- [NEW] Hero Matcher by SKU --- (Changes)
            var heroDealName = doc.querySelector('#heroDealName, .hero, #hero');
            if (heroDealName && t1Tiles && t1Tiles.length) {
              // Look for the SKU on the hero element itself or inside it
              var heroSkuEl = heroDealName.querySelector('[data-product-id], [data-sku]');
              var heroSku = heroSkuEl ? (heroSkuEl.getAttribute('data-product-id') || heroSkuEl.getAttribute('data-sku')) :
                (heroDealName.getAttribute('data-product-id') || heroDealName.getAttribute('data-sku'));
    
              if (heroSku) {
                signals.hero_product_in_grid = t1Tiles.some(function (tile) {
                  return tile.sku === heroSku;
                });
              }
            }*/
        // ---------------------------------

        /* old code
        // Hero product same as a card in the primary grid
        var heroDealName = doc.querySelector('#heroDealName');
        if (heroDealName && t1Tiles && t1Tiles.length) {
          var heroName = textOf(heroDealName, 80);
          if (heroName) {
            signals.hero_product_in_grid = t1Tiles.some(function (tile) {
              return tile.name === heroName;
            });
          }
        }*/

        /* 
       // Result count label vs. actual rendered card count
       var resultCountEl = doc.querySelector('[class*="result-count"], .results-count, #resultCount');
       if (resultCountEl && t1Tiles) {
         var match = resultCountEl.textContent.match(/(\d+)/);
         if (match) {
           signals.result_count_stated = parseInt(match[1]);
           signals.result_count_rendered = t1Tiles.length;
           signals.result_count_match = parseInt(match[1]) === t1Tiles.length;
         }
       }
    
       return Object.keys(signals).length ? signals : null;
     } catch (e) { return null; }
    }*/

        //----------------------NEW-------------------------- code for first match
        function extractTier4(doc, t1Tiles, t2) {
            try {
                var signals = {};
                // --- NEW: DIRECTIVE 4 HYDRATION METRICS ---
                signals.hydration_events = [];
                if (window.__AIORA_HYDRATION_MS__ >= 0) {
                    signals.hydration_events.push({
                        metric: "cart_hydration_time_ms",
                        value: window.__AIORA_HYDRATION_MS__
                    });
                }

                var h1 = firstMatch(doc, FIELD_SEL.pageHeading);
                var activeFilter = firstMatch(doc, FIELD_SEL.activeFilter);
                if (h1 && activeFilter) {
                    signals.heading_matches_filter = h1.textContent.trim().toLowerCase() === activeFilter.textContent.trim().toLowerCase();
                }

                // --- [NEW] Cart Math Reconciliation --- (Changes)
                if (t2 && t2.subtotal_numeric !== undefined && t2.total_numeric !== undefined) {
                    var sub = t2.subtotal_numeric || 0;
                    var sav = t2.savings_numeric || 0;
                    var tax = t2.tax_numeric || 0;
                    var del = t2.delivery_numeric || 0;
                    // THE FIX: Calculate both potential scenarios using penny-math
                    var totalWithSavingsDeducted = Math.round((sub - sav + tax + del) * 100) / 100;
                    var totalWithoutSavingsDeducted = Math.round((sub + tax + del) * 100) / 100;

                    signals.cart_math_match = (t2.total_numeric === totalWithSavingsDeducted) ||
                        (t2.total_numeric === totalWithoutSavingsDeducted);
                }

                var headerCartEl = firstMatch(doc, FIELD_SEL.cartCount);
                var cartItemLabelEl = firstMatch(doc, FIELD_SEL.cartItemLabel);
                if (headerCartEl && cartItemLabelEl) {
                    var headerCount = parseInt(
                        headerCartEl.getAttribute('data-cart-count') || headerCartEl.textContent
                    );
                    var pageCount = parseInt(cartItemLabelEl.textContent);
                    if (!isNaN(headerCount) && !isNaN(pageCount)) {
                        signals.cart_count_match = headerCount === pageCount;
                        signals.cart_count_header = headerCount;
                        signals.cart_count_page = pageCount;
                    }
                }

                if (t1Tiles && t1Tiles.length && typeof Set !== 'undefined') {
                    var sponsoredSkus = new Set();
                    var organicSkus = new Set();
                    t1Tiles.forEach(function (tile) {
                        if (!tile.sku) return;
                        if (tile.sponsored) sponsoredSkus.add(tile.sku);
                        else organicSkus.add(tile.sku);
                    });
                    var overlap = false;
                    sponsoredSkus.forEach(function (sku) {
                        if (organicSkus.has(sku)) overlap = true;
                    });
                    if (overlap) signals.sponsored_same_as_organic = true;
                }

                /*var heroDealName = firstMatch(doc, FIELD_SEL.heroElement);
                if (heroDealName && t1Tiles && t1Tiles.length) {
                  var heroSkuEl = heroDealName.querySelector('[data-product-id], [data-sku]');
                  var heroSku = heroSkuEl ? (heroSkuEl.getAttribute('data-product-id') || heroSkuEl.getAttribute('data-sku')) :
                    (heroDealName.getAttribute('data-product-id') || heroDealName.getAttribute('data-sku'));
        
                  if (heroSku) {
                    signals.hero_product_in_grid = t1Tiles.some(function (tile) {
                      return tile.sku === heroSku;
                    });
                  }
                }*/

                //----new----
                // --- NEW: Hero Product Same-SKU Flag (Coordination Check) ---
                // Does the Hero product accidentally appear again in the recommendation grid below?
                if (t1Tiles && t1Tiles.length > 1 && t1Tiles[0].surface === 'hero' && t1Tiles[0].sku) {
                    var heroSku = t1Tiles[0].sku;
                    var duplicated = false;
                    // Loop through the rest of the grid to check for duplicates
                    for (var i = 1; i < t1Tiles.length; i++) {
                        if (t1Tiles[i].sku === heroSku) {
                            duplicated = true;
                            break;
                        }
                    }
                    signals.hero_product_in_grid = duplicated;
                }


                var resultCountEl = firstMatch(doc, FIELD_SEL.resultCount);
                if (resultCountEl && t1Tiles) {
                    var match = resultCountEl.textContent.match(/(\d+)/);
                    if (match) {
                        signals.result_count_stated = parseInt(match[1]);
                        signals.result_count_rendered = t1Tiles.length;
                        signals.result_count_match = parseInt(match[1]) === t1Tiles.length;
                    }
                }

                // --- NEW ADDITIONS FOR TIER 4 --- w.r.t. Canonical Signal Schema

                // 1. CSS Hidden Blocks (Checking for common hidden patterns)
                var hiddenEls = doc.querySelectorAll('.hidden, .d-none, .sr-only, [hidden], [style*="display: none"], [style*="display:none"]');
                if (hiddenEls.length > 0) {
                    signals.css_hidden_blocks = [];
                    // Cap at 5 to protect the 1KB budget!
                    for (var i = 0; i < Math.min(hiddenEls.length, 5); i++) {
                        var copy = textOf(hiddenEls[i], 100);
                        if (copy) {
                            signals.css_hidden_blocks.push({
                                selector: hiddenEls[i].className || hiddenEls[i].tagName.toLowerCase(),
                                gated_copy: copy,
                                rendered: false
                            });
                        }
                    }
                }

                // 2. Metadata (OG, Description, Twitter)
                var metaDesc = doc.querySelector('meta[name="description"]');
                var ogTags = doc.querySelectorAll('meta[property^="og:"]');
                var twitterTags = doc.querySelectorAll('meta[name^="twitter:"]');

                if (metaDesc || ogTags.length > 0 || twitterTags.length > 0) {
                    signals.metadata = {};

                    if (metaDesc) signals.metadata.meta_description = metaDesc.getAttribute('content');

                    if (ogTags.length > 0) {
                        signals.metadata.og = {};
                        for (var j = 0; j < ogTags.length; j++) {
                            var prop = ogTags[j].getAttribute('property').replace('og:', '');
                            signals.metadata.og[prop] = ogTags[j].getAttribute('content');
                        }
                    }

                    if (twitterTags.length > 0) {
                        signals.metadata.twitter = {};
                        for (var k = 0; k < twitterTags.length; k++) {
                            var tName = twitterTags[k].getAttribute('name').replace('twitter:', '');
                            signals.metadata.twitter[tName] = twitterTags[k].getAttribute('content');
                        }
                    }
                }

                // 3. Hydration events log (Empty array stub since JS tags can't natively capture React/Vue hydration hooks)
                /*signals.hydration_events = [];*/

                // 4. Raw unparsed URL (For backend reconciliation)
                if (typeof window !== 'undefined' && window.location) {
                    signals.raw_url = window.location.href;
                }

                return signals;
            } catch (e) { return null; }
        }


        // ── 10.5  TIERS 5–9 — STUBS (Phase 2+) ───────────────────────

        function extractTier5() { return null; } // Customer / loyalty state
        function extractTier6() { return null; } // Promotional context
        function extractTier7() { return null; } // Search context
        function extractTier8() { return null; } // Trust / social proof
        function extractTier9() { return null; } // Recommendation set detail


        // ================================================================
        // SECTION 11 — PAGE-TYPE ROUTER
        // Each page type gets a specific subset of tiers.
        // ================================================================

        var TIER_ROUTES = {
            homepage: [0, 1, 3, 4, 5, 6, 8],
            category: [0, 1, 3, 4, 5, 6, 7, 8],
            cart: [0, 1, 2, 3, 4, 5, 6, 9],
            checkout: [0, 1, 2, 4, 5, 6],
            pdp: [0, 1, 2, 4, 5, 6, 8, 9],
            search: [0, 1, 3, 4, 5, 6, 7, 8],
            other: [0, 4, 5],
        };

        function getActiveTiers(pageType) {
            return TIER_ROUTES[pageType] || TIER_ROUTES.other;
        }


        // ================================================================
        // SECTION 12 — CONFIG FETCH STUB
        // Non-blocking per-retailer selector overrides.
        // 200 ms timeout, fails open with defaults.
        // Replace body when /v1/config/{clientId} is live.
        // ================================================================

        function fetchRetailerConfig() {
            return Promise.resolve({});
        }


        // ================================================================
        // SECTION 13 — PAYLOAD ASSEMBLY
        // Runs router → tiers in order → budget enforcement.
        // No raw DOM field.
        // ================================================================

        function assemblePayload(doc) {
            var budget = makeBudget();

            var t0 = extractTier0(true);
            budget.add(0, t0);

            var pageType = t0.page_type || 'other';
            var activeTiers = getActiveTiers(pageType);
            var has = function (n) { return activeTiers.indexOf(n) !== -1; };

            var t1 = null, t2 = null, t3 = null, t4 = null;

            if (has(1) && !budget.isOver()) {
                t1 = extractTier1(doc, pageType); //NEW pagetype
                budget.add(1, t1);
            } else if (!has(1)) {
                budget.drop(1);
            }

            if (has(2) && !budget.isOver()) {
                t2 = extractTier2(doc);
                if (t2) budget.add(2, t2);
            }

            if (has(3) && !budget.isOver() && t1) {
                t3 = extractTier3(t1);
                if (t3) budget.add(3, t3);
            }

            if (has(4) && !budget.isOver()) {
                t4 = extractTier4(doc, t1, t2);//added t2 (passes from the Tier 2 numbers down) --(Changes)
                if (t4) budget.add(4, t4);
            }

            var signals = {};
            if (t1 !== null) signals.t1 = t1;
            if (t2 !== null) signals.t2 = t2;
            if (t3 !== null) signals.t3 = t3;
            if (t4 !== null) signals.t4 = t4;

            var payload = Object.assign({
                schema_version: '0.2.0',
                beacon_id: crypto.randomUUID()
            }, t0, {
                page: {
                    page_type: pageType,
                    page_url: window.location.href,
                },
                signals: signals,
                budget: budget.summary(),
                privacy_metadata: {
                    pii_scrubbing_version: '0.2.0',
                    local_scrubbing_applied: true,
                    inputs_scrubbed: true,
                    scripts_removed: true,
                    styles_removed: true,
                    persistent_storage_used: false,
                },
            });
            return payload;
        }

        // -------OLD CODE (without dom mutation)-------------------
        // ================================================================
        // SECTION 14 — SEND
        // Fire and forget. Never blocks. Never retries.
        // ================================================================

        /*function sendPayload(payload) {
          if (beaconFired) return;
          beaconFired = true;
    
          const blob = new Blob(
            [JSON.stringify(payload)],
            { type: 'text/plain' }
          );
    
          const queued = navigator.sendBeacon(config.endpoint, blob);
    
          if (!queued) {
            console.warn('[AIORA] sendBeacon returned false. Beacon was not queued.');
          }
        }
    
    
        // ================================================================
        // SECTION 15 — MAIN EXECUTION
        // ================================================================
    
        function onIdleReady() {
          var rawHTML = document.documentElement.outerHTML;
          var scrubbedDoc = scrubPII(rawHTML);
          var payload = assemblePayload(scrubbedDoc);
          sendPayload(payload);
        }
    
        function onHydrationComplete() {
          fetchRetailerConfig().then(function () {
            waitForIdle(onIdleReady);
          });
        }
    
        waitForHydration(onHydrationComplete);*/

        //------NEW CODE ACCORDING TO DIRECTIVE 1 & 3-----------------
        //-------SECTION 14 and 15-------------------

        // ================================================================
        // SECTION 14 — SEND
        // Fire and forget. Never blocks. Never retries.
        // ================================================================

        // NEW: We track the sequence globally so Payload 2 gets sequence_no: 2
        var globalSequenceNo = 1;

        function sendPayload(payload) {
            // OVERRIDE the sequence number right before sending!
            payload.sequence_no = globalSequenceNo++;

            const blob = new Blob(
                [JSON.stringify(payload)],
                { type: 'text/plain' }
            );

            const queued = navigator.sendBeacon(config.endpoint, blob);

            if (!queued) {
                console.warn('[AIORA] sendBeacon returned false. Beacon was not queued.');
            }
        }

        // ================================================================
        // SECTION 15 — MAIN EXECUTION & MUTATION OBSERVER
        // ================================================================

        function onIdleReady() {
            var rawHTML = document.documentElement.outerHTML;
            var scrubbedDoc = scrubPII(rawHTML);
            var payload = assemblePayload(scrubbedDoc);
            sendPayload(payload);
        }

        // Handles the INITIAL page load payload
        function onHydrationComplete() {
            fetchRetailerConfig().then(function () {
                waitForIdle(onIdleReady);
                //startContinuousObserver(); // NEW: Start watching for future changes!

                initTier10(); // Live Interaction


            });
        }

        // NEW: DIRECTIVE 3 - The Continuous Mutation Observer
        function startContinuousObserver() {
            var mutationTimer = null;

            var observer = new MutationObserver(function () {
                clearTimeout(mutationTimer);
                // Debounce timer: wait 500ms after the DOM STOPS moving before firing
                mutationTimer = setTimeout(function () {
                    waitForIdle(onIdleReady);
                }, 500);
            });

            if (document.body) {
                // We watch the whole body for elements added/removed or text changed
                observer.observe(document.body, { childList: true, subtree: true, attributes: true });
            }
        }

        waitForHydration(onHydrationComplete);


        // --- NEW: Event-Driven Tracking ---
        // ================================================================
        // SECTION 16 — TIER 10 (INTERACTION EVENTS / INVISIBLE SPY)
        // ================================================================

        var interactionBuffer = [];
        var interactionTimer = null;
        var MAX_BUFFER_SIZE = 15;
        var MAX_BUFFER_BYTES = 8192;
        var FLUSH_INTERVAL_MS = 15000;

        function extractCurrency(text) {
            if (!text) return null;
            var match = text.match(/[\$£€₹¥]/);
            return match ? match[0] : null;
        }

        function flushInteractionEvents(reason) {
            if (interactionBuffer.length === 0) return;

            var payload = {
                envelope_type: "interaction_events",
                schema_version: "0.2.0",
                tag_version: "0.2.0",
                client_id: config.clientId,
                session_token: sessionToken,
                flush_id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2),
                flush_reason: reason,
                events: interactionBuffer
            };

            var payloadString = JSON.stringify(payload);
            interactionBuffer = []; // Clear immediately
            if (interactionTimer) { clearTimeout(interactionTimer); interactionTimer = null; }
            try {
                if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                    var success = navigator.sendBeacon(config.endpoint, payloadString);
                    if (!success && typeof fetch !== 'undefined') {
                        fetch(config.endpoint, { method: "POST", body: payloadString, keepalive: true }).catch(function () { });
                    }
                } else if (typeof fetch !== 'undefined') {
                    fetch(config.endpoint, { method: "POST", body: payloadString, keepalive: true }).catch(function () { });
                }
            } catch (e) { }
        }

        function pushEvent(eventType, fields, flushImmediately) {
            var eventObj = {
                event_id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2),
                event_type: eventType,
                timestamp: new Date().toISOString(),
                page_type: document.body.dataset.pageType || 'unknown',
                // old (index.html) : page_url_path: window.location.pathname
                page_url_path: window.location.pathname.replace(/\/index\.html$/i, '') || '/'

            };

            for (var k in fields) { if (fields.hasOwnProperty(k)) eventObj[k] = fields[k]; }

            interactionBuffer.push(eventObj);

            var currentSizeBytes = JSON.stringify(interactionBuffer).length;
            if (flushImmediately || interactionBuffer.length >= 15 || currentSizeBytes >= 8192) {
                flushInteractionEvents(flushImmediately ? "immediate_navigation" : "size");
            } else if (!interactionTimer) {
                interactionTimer = setTimeout(function () { flushInteractionEvents("time"); }, 15000);
            }
        }

        // ================================================================
        // NEW : Priority 2 - handleDocumentSubmit
        // Tracks search_submitted events
        // ================================================================
        function handleDocumentSubmit(e) {
            try {
                var target = e.target;
                if (!target || target.tagName !== 'FORM') return;

                // MATCH: search_submitted
                var isSearchForm = target.matches('form[role="search"], form#searchForm, form.search-form') ||
                    !!target.querySelector('input[type="search"], input[name="q"], input[name="search"]');

                if (isSearchForm) {
                    var searchInput = target.querySelector('input[type="search"], input[name="q"], input[name="search"]');
                    var searchData = {
                        query: searchInput ? searchInput.value.trim() : null,
                        category_scope: null,
                        submission_surface: 'on-page-search-widget'
                    };

                    // Try to find a category scope dropdown (like Amazon's "All Departments")
                    var scopeDropdown = target.querySelector('select');
                    if (scopeDropdown && scopeDropdown.selectedOptions && scopeDropdown.selectedOptions.length) {
                        searchData.category_scope = scopeDropdown.selectedOptions[0].text;
                    }

                    if (target.closest('header')) searchData.submission_surface = 'header-search';
                    else if (target.closest('.mobile-menu, [role="navigation"]')) searchData.submission_surface = 'mobile-search';

                    pushEvent("search_submitted", searchData, true);
                }
                // MATCH: purchase_completed (SPA form submit on checkout page)
                var isCheckoutForm = target.matches('form#checkoutForm, form.checkout-form') || target.querySelector('[data-action="place-order"], .place-order, #placeOrderButton');
                if (isCheckoutForm) {
                    var orderData = { order_confirmed: true, order_total_displayed: null, order_currency: null, line_item_count: 0 };
                    var totalEl = firstMatch(document, FIELD_SEL.checkoutTotal) || document.querySelector('.order-total');
                    if (totalEl) {
                        orderData.order_total_displayed = totalEl.textContent.trim();
                        orderData.order_currency = extractCurrency(orderData.order_total_displayed);
                    }
                    var items = document.querySelectorAll('#checkoutItems .mini-item, #checkoutItems li, .order-item');
                    orderData.line_item_count = items.length;

                    pushEvent("purchase_completed", orderData, true); // Flush immediately!
                }


            } catch (err) { }
        }

        // ================================================================
        // NEW : Priority 2 - handleDocumentChange
        // Tracks sort_changed and checkbox-based filters
        // ================================================================
        function handleDocumentChange(e) {
            try {
                var target = e.target;
                if (!target) return;

                // MATCH: sort_changed
                if (target.tagName === 'SELECT' && (target.name.toLowerCase().includes('sort') || target.id.toLowerCase().includes('sort') || target.className.toLowerCase().includes('sort'))) {
                    var sortData = {
                        sort_value: target.value || target.options[target.selectedIndex].text,
                        page_type: document.body.dataset.pageType || 'unknown'
                    };
                    pushEvent("sort_changed", sortData);
                    return;
                }

                // MATCH: filter_applied / filter_removed (for checkboxes/radios)
                var isFilterInput = target.tagName === 'INPUT' && (target.type === 'checkbox' || target.type === 'radio') && (target.closest('.filters, .facets, aside, [role="complementary"]') || target.name.toLowerCase().includes('filter'));

                if (isFilterInput) {
                    var isApplied = target.checked;
                    var filterData = {
                        filter_type: target.name || target.closest('fieldset, .filter-group, .facet')?.querySelector('legend, h3, h4')?.textContent.trim() || target.closest('[data-filter-group]')?.getAttribute('data-filter-group') || 'unknown',
                        filter_value: target.value || target.nextElementSibling?.textContent?.trim() || 'unknown',
                        active_filter_count_after: document.querySelectorAll('.filters input:checked, .facets input:checked').length
                    };
                    pushEvent(isApplied ? "filter_applied" : "filter_removed", filterData);
                }
            } catch (err) { }
        }

        function handleDocumentClick(e) {
            try {
                var target = e.target;
                if (!target) return;

                // ================================================================
                // NEW : Priority 3 - promo_code_applied / promo_removed
                // ================================================================
                // 1. Check for Promo Remove Click
                var isPromoRemove = target.closest('#removePromoBtn, button[id*="removePromo"]');
                if (isPromoRemove) {
                    var removedCode = document.querySelector('#promoCodeName') ? document.querySelector('#promoCodeName').textContent.trim() : 'unknown';
                    pushEvent("promo_removed", { code: removedCode });
                    return; // Stop here so remove_from_cart doesn't fire!
                }
                // 2. Check for Promo Apply Click
                var isPromoClick = target.closest('#applyPromoBtn, button[id*="promo"], button[id*="apply"]');
                if (isPromoClick) {
                    var promoInputEl = document.querySelector('#promoInput, input[name*="promo"], input[name*="discount"]');
                    if (promoInputEl) {
                        var codeStr = promoInputEl.value.trim();
                        // Wait 500ms to allow your app.js logic to run and update the UI
                        setTimeout(function () {
                            var promoData = {
                                code: codeStr,
                                result: 'unknown',
                                discount_amount_shown: null
                            };
                            // Check if an error message appeared
                            var errorEl = document.querySelector('.promo-error, .discount-error, #promoError, .toast.error');
                            if (errorEl && errorEl.offsetParent !== null) {
                                promoData.result = 'rejected';
                                pushEvent("promo_code_rejected", promoData);
                            } else {
                                // Check if the success row is visible
                                var successEl = document.querySelector('#promoRow, .promo-applied');
                                if (successEl && successEl.offsetParent !== null) {
                                    promoData.result = 'accepted';
                                    var amtEl = successEl.querySelector('#summaryPromo, .promo-amount');
                                    if (amtEl) promoData.discount_amount_shown = amtEl.textContent.trim();
                                }
                                pushEvent("promo_code_applied", promoData);
                            }
                        }, 500);
                    }
                    return; // Stop here so no other generic rules catch this click
                }

                // ================================================================
                // NEW : Priority 1: MATCH: checkout_initiated
                // ================================================================
                var isCheckoutBtn = target.closest('[data-action="checkout"], .checkout-button, #placeOrderButton, #checkoutButton, [href*="checkout"], [data-automation-id="checkoutButton"]') ||
                    ((target.tagName === 'BUTTON' || target.tagName === 'A') && /(proceed to checkout|checkout|continue to checkout)/i.test(target.textContent));
                if (isCheckoutBtn && (window.location.href.toLowerCase().includes('/cart') || window.location.href.toLowerCase().includes('cart.html') || !!document.querySelector('.cart-layout') || document.body.dataset.pageType === 'cart')) {
                    var cartTotals = { cart_line_count: 0, cart_displayed_total: null, cart_displayed_currency: null };
                    var items = document.querySelectorAll('#cartItems article.cart-item, #cartItems .cart-item, [data-automation-id="cart-item"]');
                    cartTotals.cart_line_count = items.length;

                    var totalEl = firstMatch(document, FIELD_SEL.cartTotal);
                    if (totalEl) {
                        cartTotals.cart_displayed_total = totalEl.textContent.trim();
                        cartTotals.cart_displayed_currency = extractCurrency(cartTotals.cart_displayed_total);
                    }
                    // just for local testing
                    // STOP THE BROWSER FROM NAVIGATING INSTANTLY
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    pushEvent("checkout_initiated", cartTotals, true);

                    // just for local testing
                    // WAIT 100ms TO SEND PAYLOAD, THEN NAVIGATE MANUALLY
                    var href = isCheckoutBtn.href || './checkout.html';
                    setTimeout(function () { window.location.href = href; }, 100);

                    return;
                }

                // ================================================================
                // NEW : Priority 1: MATCH: add_to_cart
                // ================================================================
                var isAddBtn = target.closest('[data-action="add-to-cart"], .add-to-cart') ||
                    (target.tagName === 'BUTTON' && /^(add to cart|add to bag|add)$/i.test(target.textContent));

                if (isAddBtn) {
                    var productCard = target.closest('.product-card, .product-tile, [data-product-id], article, [data-automation-id="product-pod"]');
                    var eventData = { sku: null, surface: "catalog-grid", position: 1, price: null, currency: null };

                    if (productCard) {
                        var siblings = productCard.parentElement ? productCard.parentElement.children : [];
                        for (var i = 0; i < siblings.length; i++) {
                            if (siblings[i] === productCard) { eventData.position = i + 1; break; }
                        }

                        var skuEl = firstMatch(productCard, FIELD_SEL.sku);
                        if (skuEl) {
                            eventData.sku = skuEl.getAttribute('data-product-id') || skuEl.getAttribute('data-sku') || textOf(skuEl, 30);
                            if (!eventData.sku && (skuEl.tagName === 'A' || skuEl.hasAttribute('href'))) {
                                var match = (skuEl.getAttribute('href') || '').match(/\/p\/(?:[^\/]+\/)*(\d+)/);
                                if (match) eventData.sku = match[1];
                            }
                        }
                        var priceEl = firstMatch(productCard, FIELD_SEL.price);
                        if (priceEl) {
                            // Only replace the code inside this block!
                            var parsed = parsePrice(priceEl.textContent.trim());
                            if (parsed) {
                                eventData.price = parsed.amount;
                                eventData.currency = parsed.currency;
                            }
                        }
                    }
                    pushEvent("add_to_cart", eventData);
                    return;
                }

                // ================================================================
                // NEW : Priority 1: MATCH: remove_from_cart
                // ================================================================
                var isRemoveBtn = target.closest('.remove-item, [data-action="remove"], [data-automation-id="removeItem"]') ||
                    (target.tagName === 'BUTTON' && /^(remove|delete)$/i.test(target.textContent));

                if (isRemoveBtn) {
                    var cartItem = target.closest('.cart-item, [data-automation-id="cart-item"], article');
                    var removeData = { sku: null, quantity_before_remove: null, displayed_line_total: null };

                    if (cartItem) {
                        var rSkuEl = firstMatch(cartItem, FIELD_SEL.sku) || cartItem.querySelector('[data-item-id]');
                        if (rSkuEl) removeData.sku = rSkuEl.getAttribute('data-item-id') || rSkuEl.getAttribute('data-product-id') || rSkuEl.getAttribute('data-sku');

                        var lineTotalEl = firstMatch(cartItem, FIELD_SEL.cartItemLineTotal);
                        if (lineTotalEl) removeData.displayed_line_total = lineTotalEl.textContent.trim();

                        var qtyEl = firstMatch(cartItem, FIELD_SEL.cartItemQuantity);
                        if (qtyEl) {
                            var qVal = qtyEl.getAttribute('aria-valuenow') || qtyEl.value || qtyEl.textContent;
                            removeData.quantity_before_remove = parseInt(qVal, 10);
                        }
                    }
                    pushEvent("remove_from_cart", removeData);
                    return;
                }

                // ================================================================
                // NEW : Priority 2 - filter_applied / filter_removed (Click based filters)
                // ================================================================
                var isFilterLink = target.closest('a.filter-link, button.filter-btn, [data-action="filter"], .category-filter-list button, .filters button');
                if (isFilterLink) {
                    var isRemoving = target.closest('.active-filter, .remove-filter') !== null;
                    var filterClickData = {
                        filter_type: isFilterLink.closest('fieldset, .filter-group, .facet')?.querySelector('legend, h3, h4')?.textContent.trim() || isFilterLink.closest('[data-filter-group]')?.getAttribute('data-filter-group') || 'unknown',
                        filter_value: isFilterLink.getAttribute('data-category') || isFilterLink.textContent.trim(),
                        active_filter_count_after: document.querySelectorAll('.active-filter, .filters input:checked').length + (isRemoving ? -1 : 1)
                    };
                    pushEvent(isRemoving ? "filter_removed" : "filter_applied", filterClickData);
                    return;
                }


                // ================================================================
                // NEW : Priority 2 - product_card_clicked
                // (Runs AFTER add_to_cart so we don't confuse a cart click with a browse click)
                // ================================================================
                var clickedCard = target.closest('.product-card, .product-tile, [data-product-id], article, [data-automation-id="product-pod"]');
                var isCardClick = clickedCard && (target.closest('a') || target.closest('.product-image') || target.tagName === 'H3' || target.tagName === 'IMG' || target.tagName === 'P');
                if (isCardClick && !target.closest('[data-action="add-to-cart"], .add-to-cart, button')) {
                    var cardData = { sku: null, surface: "catalog-grid", position: 1, price: null, currency: null };
                    var cardSiblings = clickedCard.parentElement ? clickedCard.parentElement.children : [];
                    for (var j = 0; j < cardSiblings.length; j++) {
                        if (cardSiblings[j] === clickedCard) { cardData.position = j + 1; break; }
                    }

                    // Check the clickedCard directly first, then look inside it
                    var cardSku = clickedCard.getAttribute('data-product-id') || clickedCard.getAttribute('data-sku');
                    if (!cardSku) {
                        var cardSkuEl = firstMatch(clickedCard, FIELD_SEL.sku);
                        if (cardSkuEl) cardSku = cardSkuEl.getAttribute('data-product-id') || cardSkuEl.getAttribute('data-sku');
                    }
                    cardData.sku = cardSku || null;
                    var cardPriceEl = firstMatch(clickedCard, FIELD_SEL.price);
                    if (cardPriceEl) {
                        var parsed = parsePrice(cardPriceEl.textContent.trim());
                        if (parsed) {
                            cardData.price = parsed.amount;
                            cardData.currency = parsed.currency;
                        }
                    }

                    // just for local testing
                    // STOP THE BROWSER FROM NAVIGATING INSTANTLY
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    pushEvent("product_card_clicked", cardData, true);

                    // just for local testing
                    // WAIT 100ms TO SEND PAYLOAD, THEN NAVIGATE MANUALLY
                    setTimeout(function () {
                        window.location.href = './pdp.html?id=' + cardData.sku;
                    }, 100);

                    return;
                }

                // ================================================================
                // NEW : Priority 3 - quick_view_opened
                // ================================================================
                // (Ignore buttons that have the word 'close' in their aria-label or class)
                var isQuickViewBtn = target.closest('.quick-view, [data-action="quick-view"], button[aria-label*="quick view" i]:not(.modal-close):not([aria-label*="close" i])');
                if (isQuickViewBtn) {
                    var qvCard = target.closest('.product-card, .product-tile, article, [data-automation-id="product-pod"]');
                    var qvData = { sku: null, surface: "catalog-grid", position: 1 };

                    if (qvCard) {
                        var qvCardSku = qvCard.getAttribute('data-product-id') || qvCard.getAttribute('data-sku');
                        if (!qvCardSku) {
                            var qvSkuEl = firstMatch(qvCard, FIELD_SEL.sku);
                            if (qvSkuEl) qvCardSku = qvSkuEl.getAttribute('data-product-id') || qvSkuEl.getAttribute('data-sku');
                        }
                        qvData.sku = qvCardSku || null;

                        var qvSiblings = qvCard.parentElement ? qvCard.parentElement.children : [];
                        for (var k = 0; k < qvSiblings.length; k++) {
                            if (qvSiblings[k] === qvCard) { qvData.position = k + 1; break; }
                        }
                    }
                    pushEvent("quick_view_opened", qvData);
                    return;
                }

                // ================================================================
                // NEW : Priority 3 - wishlist_added
                // ================================================================
                var isWishlistBtn = target.closest('.wishlist-button, [data-action="wishlist"], [data-save], button[aria-label*="wishlist" i]');
                if (isWishlistBtn) {
                    var wlCard = target.closest('.product-card, .product-tile, article, .cart-item');
                    var wlData = { sku: null, surface: wlCard && wlCard.classList.contains('cart-item') ? "cart" : "catalog-grid", position: 1, displayed_price: null };

                    if (wlCard) {
                        var wlCardSku = wlCard.getAttribute('data-product-id') || wlCard.getAttribute('data-sku') || wlCard.getAttribute('data-cart-id');
                        if (!wlCardSku) {
                            var wlSkuEl = firstMatch(wlCard, FIELD_SEL.sku);
                            if (wlSkuEl) wlCardSku = wlSkuEl.getAttribute('data-product-id') || wlSkuEl.getAttribute('data-sku');
                        }
                        wlData.sku = wlCardSku || null;

                        var wlPriceEl = firstMatch(wlCard, FIELD_SEL.price) || wlCard.querySelector('.cart-item-price strong');
                        if (wlPriceEl) {
                            wlData.displayed_price = wlPriceEl.textContent.trim();
                        }

                        var wlSiblings = wlCard.parentElement ? wlCard.parentElement.children : [];
                        for (var m = 0; m < wlSiblings.length; m++) {
                            if (wlSiblings[m] === wlCard) { wlData.position = m + 1; break; }
                        }
                    }

                    // If the button is already 'active', the user is clicking to remove it!
                    // (Note: 'data-save' is the Cart "Save for later" button, which always adds)
                    var isRemoving = isWishlistBtn.classList.contains('active') && !isWishlistBtn.hasAttribute('data-save');

                    pushEvent(isRemoving ? "wishlist_removed" : "wishlist_added", wlData);


                    return;
                }

                // ================================================================
                // NEW : Priority 3 - quantity_changed
                // ================================================================
                var isQtyBtn = target.closest('[data-dec], [data-inc], .qty-minus, .qty-plus');
                if (isQtyBtn) {
                    var qtyItem = target.closest('.cart-item, article');
                    if (qtyItem) {
                        var qtyData = { sku: null, quantity_before: null, quantity_after: null, line_total_before: null, line_total_after: null };

                        var qtySku = qtyItem.getAttribute('data-cart-id') || qtyItem.getAttribute('data-product-id');
                        qtyData.sku = qtySku || null;

                        var qtySpan = qtyItem.querySelector('.quantity-control span, input.qty');
                        if (qtySpan) {
                            var currentQty = parseInt(qtySpan.textContent || qtySpan.value, 10);
                            qtyData.quantity_before = currentQty;
                            qtyData.quantity_after = isQtyBtn.hasAttribute('data-inc') || isQtyBtn.classList.contains('qty-plus') ? currentQty + 1 : Math.max(0, currentQty - 1);
                        }

                        var lineTotalElQty = firstMatch(qtyItem, FIELD_SEL.cartItemLineTotal);
                        if (lineTotalElQty) {
                            qtyData.line_total_before = lineTotalElQty.textContent.trim();
                        }

                        // Wait 500ms for Shopora to recalculate and redraw the cart
                        setTimeout(function () {
                            // The cart completely redraws, so we must find the item again using its SKU
                            var freshItem = document.querySelector('[data-cart-id="' + qtySku + '"], [data-product-id="' + qtySku + '"]');
                            if (freshItem) {
                                var newTotalEl = firstMatch(freshItem, FIELD_SEL.cartItemLineTotal);
                                if (newTotalEl) {
                                    qtyData.line_total_after = newTotalEl.textContent.trim();
                                }
                            }
                            // If the user drops the quantity to 0, they effectively removed it!
                            if (qtyData.quantity_after === 0) {
                                pushEvent("remove_from_cart", qtyData, true); // Log it as a REMOVE event
                            } else {
                                pushEvent("quantity_changed", qtyData); // Log it as a QUANTITY event
                            }

                        }, 500);

                    }
                    return;
                }



            } catch (err) { }
        }

        // ================================================================
        // NEW : Priority 1: MATCH: purchase_completed
        // (Fired immediately on page load, not click)
        // ================================================================
        function checkPurchaseCompleted() {
            var url = window.location.href.toLowerCase();
            if (url.includes('/thank-you') || url.includes('/order-complete') || url.includes('/confirmation') || url.includes('/receipt') || document.body.innerHTML.toLowerCase().includes('thank you for your order')) {
                var orderData = { order_confirmed: true, order_total_displayed: null, order_currency: null, line_item_count: 0 };
                var totalEl = firstMatch(document, FIELD_SEL.checkoutTotal) || document.querySelector('.order-total');
                if (totalEl) {
                    orderData.order_total_displayed = totalEl.textContent.trim();
                    orderData.order_currency = extractCurrency(orderData.order_total_displayed);
                }
                var items = document.querySelectorAll('#checkoutItems li, .order-item');
                orderData.line_item_count = items.length;
                pushEvent("purchase_completed", orderData);
                flushInteractionEvents("page-load");
            }
        }

        // ================================================================
        // NEW : Update initTier10 to attach Priority 2 & 1 listeners
        // ================================================================
        function initTier10() {
            document.addEventListener('click', handleDocumentClick, { capture: true, passive: true });
            document.addEventListener('submit', handleDocumentSubmit, { capture: true, passive: true }); // (add) Priority 2
            document.addEventListener('change', handleDocumentChange, { capture: true, passive: true }); // (add) Priority 2
            setInterval(function () { flushInteractionEvents("time"); }, FLUSH_INTERVAL_MS);
            document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushInteractionEvents("unload"); });
            window.addEventListener('pagehide', function () { flushInteractionEvents("unload"); });
            checkPurchaseCompleted();
        }



        // ================================================================
        // TEST HOOK
        // Exposes internals when window.__AIORA_TEST__ = true.
        // Never set in production — the IIFE hides everything otherwise.
        // ================================================================

        if (typeof window !== 'undefined' && window.__AIORA_TEST__) {
            window.__AIORA__ = {
                extractTier0: extractTier0,
                extractTier1: extractTier1,
                extractTier2: extractTier2,
                extractTier3: extractTier3,
                extractTier4: extractTier4,
                classifyPageType: classifyPageType,
                scrubPII: scrubPII,
                makeBudget: makeBudget,
                getActiveTiers: getActiveTiers,
                firstMatch: firstMatch,
                textOf: textOf,
                config: config,
                FIELD_SEL: FIELD_SEL,
                CARD_SELECTORS: CARD_SELECTORS,
                TIER_ROUTES: TIER_ROUTES,
            };
        }

    } catch (e) {
        // Fail silently — errors must be invisible to the retailer's page.
        console.error("🚨 AIORA FATAL ERROR:", e);
    }
}());
