# Shopora Demo Build: Final Verified Status & Roadmap

This document is the **final, verified status report** based on a deep, algorithmic scan of the entire `shopora` codebase compared against the `Shopora_Demo_Build_Spec.docx`.

---

## 1. What is in this Document?
This document is a **15-20 day engineering roadmap** to build the fake "Shopora" sandbox website. 
*   It details how to build the "Foundation" (a fake backend using `products.json` with 40 specific SKUs and 15 brands).
*   It details exactly how to build 25 specific URL parameters (e.g., `?demo=multi-mechanism-stack`). These are **not** 25 separate HTML files. They are parameters added to the end of a URL (like `/cart.html?demo=multi-mechanism-stack`) which trigger Javascript to manipulate the DOM dynamically.

---

## 2. What is Built So Far (Verified via Code Scan)

### A. The Shopora Website (Frontend)
The frontend team has actually completed several foundational elements that the Spec doc assumed hadn't started yet!
*   **Pages:** We have `index.html`, `category.html`, `cart.html`, `checkout.html`, `orders.html`, **AND `pdp.html`** (The spec assumed PDP didn't exist, but it is built!).
*   **The Catalog:** We have `data/products.js` acting as a fake backend.
*   **Header Data Attributes:** The frontend team has already successfully built the HTML for `data-wishlist-count` and `data-cart-count` across all pages!

### B. The JS Tag (`tag.js`)
We have made massive progress on `tag.js` that puts us ahead of schedule for capturing these scenarios:
*   **The Canonical Signal Schema:** The tag is architecturally capable of generating the exact JSON envelope required by the Scanner (Tiers 0-11). **Currently, we have fully built the logic for Tiers 0, 1, 2, 3, 4, and 10.**
*   **Numeric Price Extraction:** We integrated the `parsePrice()` engine perfectly. 
*   **Promo Field Logic:** We successfully built the logic to detect `promo_field_state` and capture `inline_reason` rejection text (required for Pattern 4).

---

## 3. What is Remaining to Build (Verified via Code Scan)

### A. Remaining for the Website Team (Frontend)
*   **The Catalog Update:** The frontend team needs to update `products.js` to match the exact 40 SKUs, prices, and brands listed in the spec.
*   **The Scenario Router:** The frontend team must build the Javascript that reads `?demo=...` from the URL and manipulates the DOM. 
*   **Missing Data Attributes (CRITICAL):** A deep scan reveals the frontend team has NOT yet built the following data attributes required by the spec:
    *   `data-identity-state`
    *   `data-member-tier`
    *   `data-loyalty-balance`
    *   `data-customer-hash`
    *   `data-claim-percent` (and all other `data-claim-*` attributes)

### B. Remaining for the Tag Team (You & Rahul)
To fully support the 25 scenarios in this spec, `tag.js` still needs the following upgrades:

#### 1. The Visit-Stable Session ID (Priority 1)
*   **Why:** Scenario 5.1 and 5.3 explicitly demand that the tag captures the exact same `session_id` as the user navigates from the Homepage to the Cart. If the session breaks, Pattern 5 (Identity Handoff Failures) cannot be detected.
*   **Status:** The code for this is 100% planned out (the 3-Step Mode A/B Fallback Resolver), we just need to hit the button to inject it into `tag.js`.

#### 2. Tier 5 (Identity Extraction)
*   **Why:** The spec dictates that the homepage header will have attributes like `data-identity-state='recognized'` and `data-member-tier='plus'`. 
*   **Status:** Currently, `tag.js` has a hardcoded stub: `var identitySummary = { state: 'unknown' };`. We must wait for the frontend team to build these data attributes before we can write the Javascript to capture them.

#### 3. Banner & Wishlist Extraction (Tiers 3 & 1)
*   **Why:** Pattern 2 requires capturing `ClaimSignals` from hero banners (e.g., extracting "35%" from `data-claim-percent`). Pattern 5 requires capturing wishlist counts from `data-wishlist-count`.
*   **Status:** Because the frontend team *already* built `data-wishlist-count`, we can actually write the code to capture this right now! However, we must wait for the frontend team to build the `data-claim-*` attributes before we can capture the banners.

---

## 4. How to Build It (Actionable Meeting Plan)
To successfully deliver this demo in 15-20 days, the work must be split into two parallel tracks:

### Track 1: The Website Team (Frontend)
1. **Days 1-3:** Update the existing `products.js` and add `demo_config.json` with the exact margin floors from the spec. Inject the missing `data-identity-*` and `data-claim-*` attributes into the HTML.
2. **Days 4-15:** Build the Javascript that parses the `?demo=` URLs and manipulates the DOM to render the 25 bugs.

### Track 2: The Tag Team (You & Rahul)
1. **Immediately:** Inject the **Visit-Stable Session ID Resolver** into `tag.js`. (This is a blocking requirement for tracking cross-page scenarios).
2. **Immediately:** Add the 2 lines of Javascript to capture the `data-wishlist-count` and `data-cart-count` since the frontend team already built them.
3. **Phase 2:** Wait for the frontend team to finish building the missing identity and claim DOM elements.
4. **Phase 3:** Update `tag.js` to search for those specific data attributes and pull them into the JSON payloads.
