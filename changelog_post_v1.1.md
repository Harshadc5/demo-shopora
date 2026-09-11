# AIORA Tag — Architectural Changelog (Post-v1.1 Schema)

## 1. The "Env-Readiness Race" (Micro-polling Implementation)

**The Problem:** Waiting for an artificial 500ms DOM "silence" was causing a race condition. If a retailer's React Cart took 3 seconds to load, our tag was either firing too early (missing the data) or locking up.
**The Current Solution:** We implemented **Micro-polling** (Directive 4). We use a 50ms `setInterval` to aggressively check the DOM for critical data instead of waiting blindly.

* We calculate exactly how many milliseconds hydration took and store it in `window.__AIORA_HYDRATION_MS__`.
* A 3000ms "Hard Cap" timeout acts as a failsafe to ensure the tag never polls infinitely if the site is broken.

## 2. Tier 10: The Live Interaction Engine

We built a completely independent "Invisible Spy" engine to track live user clicks and intent without relying on massive DOM snapshots.

* **The 15-Second Buffer:** Events are stored in a memory buffer. We only send a payload to the backend when the buffer hits 15 seconds, or on page unload (`visibilitychange` / `pagehide`).
* **Priority 1 Events (Immediate Flush):** `checkout_initiated`, `add_to_cart`, `remove_from_cart`, and `purchase_completed`. Because these are critical business metrics, they bypass the 15-second buffer and flush to the server instantly.
* **Priority 2 & 3 Events:** `search_submitted`, `filter_applied/removed`, `sort_changed`, `product_card_clicked`, `wishlist_added`, `promo_code_rejected`, `quick_view_opened`
* **Asynchronous Delays:** For events like `quantity_changed` and `promo_code_applied`, the tag uses a `setTimeout(..., 500)` to wait for the retailer's cart to mathematically re-render *before* scraping the new price.
* *(New Additions: Added `promo_code_removed` event and an `immediate_navigation` flush reason).*

## 3. Tier 0–4 Schema Upgrades

We mapped the tag directly to the Canonical Signal Schema v1.1 requirements.

* **Tier 0 (The Envelope):** Added extraction for `visible_query`, `sequence_no`, `page_heading`, `breadcrumb`, `viewport`, `surface_id`, `region`, `identity_summary`, and `program_match`. Hardcoded the `tag_version: '0.2.0'` to fix payload dropping issues.
* **Side-Cart Detection:** Upgraded `classifyPageType` to detect hidden side-carts. If a user is on a PDP but opens a cart drawer, the tag looks for exact text nodes (like Flipkart's "Place Order" button) to override the URL and correctly flag the `page_type` as `cart`.
* **Tier 1:** Added `categoryWords` extraction to the Product Card logic.
* **Tier 4:** Deleted the stubbed `hydration_events` array, as JS tags cannot natively capture React/Vue hydration hooks.

## 4. Continuous Mutation Tracking (Directive 3 - from the huddle notes)

* **The Fix:** The `startContinuousObserver()` function was previously commented out, meaning the tag only fired once on page load and then died. We uncommented it.
* **The Result:** If a user is on a Cart page and deletes an item, the tag now fires *two* payloads perfectly: A tiny Tier 10 `remove_from_cart` event, followed 500ms later by a massive Tier 0-4 snapshot showing the mathematically updated cart (with `sequence_no: 2`).

## 5. Privacy & Compliance

* **URL PII Scrubbing:** We applied the same aggressive URL cleaning from Tier 0 to Tier 10. All query parameters containing `email`, `password`, `token`, `uid`, or `phone` are instantly stripped from the URL before the payload leaves the browser.
* **Strict Silence:** Confirmed no keystrokes are ever captured (only submit events), and passwords are removed from the DOM clone before extractors even run.

---

### What We Are Working On Next (Pending Upgrades)

* **Element-Level Observer (Env-Readiness Upgrade):** Replacing the Micro-polling `setInterval` with a State-Aware Checklist `MutationObserver` that actively hunts for specific puzzle pieces based on the `pageType` without timers.
* **Session ID Consistency:** Replacing the `crypto.randomUUID()` that regenerates on every page load with a "read-before-write" `sessionStorage` or first-party cookie logic to keep sessions stable.
* **SKU Fallback Chain:** Upgrading Tier 10 `add_to_cart` to parse the SKU from the nearest `href` URL if the direct `data-product-id` is missing (currently resulting in `sku: null`).
* **String Normalization:** Cleaning up raw HTML classes being sent in `filter_type`, separating currency symbols from raw numbers in `displayed_price`, and normalizing `/index.html` to `/`.
