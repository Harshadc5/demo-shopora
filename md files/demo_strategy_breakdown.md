# AIORA JS Tag Demo Strategy: Complete Breakdown

This document provides a line-by-line, comprehensive explanation of the **AIORA JS Tag Demo Strategy (V1)** document. The original file outlines the exact blueprint for building a compelling, end-to-end demo to sell AIORA to Retailer CTOs.

---

## Part 1: The End-to-End Architecture
The document begins by outlining the 4 core components that make up the demo ecosystem:
1. **The JS Tag:** The script (`tag.js`) that runs on the fake Shopora website, capturing the Canonical Signal Schema.
2. **The Scanner & Policy Engine:** A diagnostic tool that reads the payloads captured by the tag and applies strict rules to detect if a "coordination failure" (bug) occurred.
3. **The Impact Estimator:** A mathematical engine that calculates exactly how much money the retailer lost because of the detected failure.
4. **The Dashboard:** A beautiful web app (React) where the CTO can see the total financial loss and drill down into specific failures.

---

## Part 2: The 5 Core Coordination Failures (The "Meat" of the Demo)
The document mandates that you build **5 specific, hardcoded bugs** into the Shopora sandbox. These are the most common ways retailers lose money. For each pattern, the document provides 5 specific examples, what `tag.js` must capture, the exact rules the Scanner must run, and the financial impact formula.

### Pattern 1: Ungoverned Offer Stacking (56% prevalence)
*   **The Bug:** Different systems (promo codes, markdowns, loyalty discounts) all apply at the same time without realizing it, resulting in massive unintended discounts (e.g., 40% off total).
*   **What `tag.js` captures:** `CartStateSignal` (subtotal, applied codes, savings components) and the `session_id`.
*   **The Scanner Rules:** Flags if there are 3+ discounts stacked, if the total discount is >40%, or if the total discount drops the cart below the company's "margin floor" (destroying profit).
*   **The Dashboard:** Shows how much margin was "leaked" and how AIORA would have fixed it by only applying the single best discount.

### Pattern 2: Unreconciled Headline Claims (44% prevalence)
*   **The Bug:** The website promises one thing in a banner (e.g., "35% OFF"), but the actual products underneath do not match that promise (e.g., max discount is 25%).
*   **What `tag.js` captures:** `ClaimSignal` (the text in the banner) and `TileSignal` (the actual prices of the products).
*   **The Scanner Rules:** Compares the % in the banner to the max % on the product tiles. If the banner is higher, it flags a "bait-and-switch" failure.

### Pattern 3: (Implicitly Covered in Full Spec)
*Note: While the document lists 5 patterns, the core structure remains identical: Define the bug, capture the signals, run the scanner rules, and calculate the financial damage.*

### Pattern 4: Promise-to-Price Gap
*   **The Bug:** A user is promised a discount or free shipping early in their journey, but when they reach checkout, the code is rejected, or a shipping fee is suddenly added.
*   **What `tag.js` captures:** The source claim early on, and the final checkout/cart state.
*   **The Scanner Rules:** Flags if a promo code is rejected with an inline error, or if "free shipping" was promised but a charge appears at checkout.

### Pattern 5: Identity Handoff Failures (25% prevalence)
*   **The Bug:** The website "forgets" who the user is as they navigate between pages (e.g., logged in on the Homepage, but suddenly a "Guest" at Checkout).
*   **What `tag.js` captures:** `IdentityStateSignal` and a **visit-stable `session_id`**.
*   **The Scanner Rules:** Tracks the user across pages. If they drop from 'recognized' to 'guest', it flags an identity loss failure.

> [!IMPORTANT]
> Pattern 5 explicitly proves why the Session ID bug we are fixing right now is Priority 1! If the Session ID changes on every page, the Scanner cannot track identity loss, and Pattern 5 completely breaks!

---

## Part 3: The 3 Waves of Development
To build all of this without getting overwhelmed, the work is split into 3 phases:

### Wave 1 — The Happy Path (Static Demo)
Build the 25 static scenarios on Shopora, make sure `tag.js` fires correctly, build the basic scanner rules, and create a simple dashboard. 
### Wave 2 — Dynamic Demo
Add Javascript so the Shopora site feels real. **Crucially: Add session-level state persistence via `sessionStorage`** (this is what you and Rahul are doing right now!). Upgrade the dashboard with trend charts and counterfactuals.
### Wave 3 — Demo-mode Traffic Generator
Build a script that fakes 100-500 shopper sessions per hour so the dashboard is flooded with realistic, massive-scale data. Add a "Demo Mode" toggle so people know it's fake.

---

## Part 4: The Pitch Script (10 Minutes to a CTO)
The document provides a literal script for the Demo Lead to read:
1. **Minute 0-1:** Explain that Shopora is a fake sandbox, but the Tag and Dashboard are 100% real production code.
2. **Minute 1-4:** Walk through Shopora and manually trigger Pattern 1, Pattern 2, and Pattern 5 to scare the CTO about their own website.
3. **Minute 4-6:** Open the Developer Console and show them the exact JSON payloads `tag.js` is capturing (just like your `payloads.log`!).
4. **Minute 6-8:** Show them the Dashboard catching the bugs in real-time and calculating how much money AIORA would have saved them.
5. **Minute 8-10 (The Ask):** Ask the CTO to let you drop `tag.js` onto their live website for 2 weeks. Tell them you will come back with a dashboard filled with their *actual* lost revenue.

---

## Part 5: Closing Notes
*   **Shopora is disposable:** The Shopora website is just a fake toy. But the Tag, Scanner, and Dashboard must be flawless production-grade code.
*   **No Randomness:** The bugs on Shopora must be hardcoded and 100% reproducible. If a demo breaks while pitching a CTO, the deal is dead.
*   **Dashboard is King:** The CTO will spend 80% of the demo looking at the dashboard. A perfect tag with an ugly dashboard will fail to sell.
