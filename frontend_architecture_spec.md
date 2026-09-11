# Shopora Demo Architecture: Data-Driven Rendering Engine

We are building a deterministic demo sandbox (Shopora) to showcase 25 distinct "Coordination Failure" bugs to CTOs.

**Efficient way(from my POV): Data-Driven Configuration architecture.**

---

## 1. The Core Philosophy

Instead of writing imperative JavaScript for every single scenario (e.g., `document.querySelector(...).innerHTML = ...`), we will build a single "Rendering Engine" (`demo_router.js`).

This engine will dynamically read a JSON configuration file (`demo_scenarios.json`), and automatically inject the fake bugs into the DOM based on the data provided in the JSON block.

This means that to add a new scenario, we never write JavaScript. We only add a new block to the JSON file.

---

## 2. Component 1: The Configuration File (`demo_scenarios.json`)
**Below is the JSON for TWO scenarios:**

We will create this new file. It will map the URL parameter (e.g., `?demo=margin-floor-violation`) to an exact state override object.

```json
// demo_scenarios.json

// ── Scenario 1.5 : margin-floor-violation ──────────────────────
{
  "margin-floor-violation": {
    "target_page": "cart",
    "cart": {
      "items": [
        { "sku": "fa-3", "qty": 1 }
      ],
      "savings_breakdown": [
        { "type": "markdown", "label": "Markdown (21% off original)", "amount": 20.00 },
        { "type": "code",     "label": "SAVE20 code (20% off)",       "amount": 15.00, "code": "SAVE20" },
        { "type": "loyalty",  "label": "Shopora Plus (5%)",           "amount": 3.75 },
        { "type": "sale",     "label": "$10 sale credit",             "amount": 10.00 },
        { "type": "code",     "label": "Extra 15% stacked code",      "amount": 5.94, "code": "EXTRA15" }
      ],
      "shipping_label": "FREE delivery"
    }
  },

  // ── Scenario 1.2 : shipping-threshold-broken (NOT 1.5 — separate example) ──
  "shipping-threshold-broken": {
    "target_page": "cart",
    "cart": {
      "items": [
        { "sku": "fa-6", "qty": 1 },
        { "sku": "el-9", "qty": 1 },
        { "sku": "ho-4", "qty": 1 }
      ],
      "savings_breakdown": [
        { "type": "code",    "label": "SAVE20 code (20% off)", "amount": 13.59, "code": "SAVE20" },
        { "type": "markdown", "label": "Markdown on all 3 items", "amount": 9.00 },
        { "type": "loyalty", "label": "Stacked loyalty credit", "amount": 15.00 }
      ],
      "shipping_label": "FREE delivery",
      "override_total": 30.38
    }
  }
}
```

---

## 3. Component 2: The Rendering Engine (`demo_router.js`)

We will create a single `demo_router.js` script and inject it into the HTML files via `<script type="module" src="./demo_router.js"></script>`.

This script will:

1. Parse the `?demo=` parameter from the URL.
2. `fetch()` the `demo_scenarios.json` file.
3. Look up the corresponding scenario block.
4. Look up each cart item's real price/name from the existing product catalog (`products.js`), using the `sku`.
5. If a block exists, dynamically overwrite the DOM targets to match the JSON data, computing totals itself unless the scenario explicitly overrides them.

```javascript
// demo_router.js

document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const demoScenario = urlParams.get('demo');

    if (!demoScenario) return; // Let the healthy Shopora site run normally!

    console.warn(`[AIORA DEMO MODE] Hijacking DOM for: ${demoScenario}`);

    try {
        // Fetch our data-driven config
        const response = await fetch('./demo_scenarios.json');
        const scenarios = await response.json();
        const state = scenarios[demoScenario];

        if (!state) {
            console.error("Demo scenario not found in JSON config!");
            return;
        }

        // --- ENGINE LOGIC ---
        // Dynamically parse the JSON and hijack the DOM

        if (state.target_page === "cart") {
            const cart = state.cart;

            // 1. Resolve items against the real product catalog (single source of truth)
            const resolvedItems = cart.items.map(item => {
                const product = PRODUCTS.find(p => p.sku === item.sku);
                const lineTotal = product.price * item.qty;
                return { ...item, name: product.name, price: product.price, lineTotal };
            });

            const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0);
            const totalSavings = (cart.savings_breakdown || [])
                .reduce((sum, s) => sum + s.amount, 0);

            // 2. Compute the total unless the scenario explicitly overrides it
            const total = cart.override_total !== undefined
                ? cart.override_total
                : subtotal - totalSavings;

            document.querySelector('#summaryTotal').textContent = `$${total.toFixed(2)}`;

            // 3. Override Shipping Label
            if (cart.shipping_label !== undefined) {
                document.querySelector('#summaryDelivery').textContent = cart.shipping_label;
            }

            // 4. Inject cart line items
            document.querySelector('#cartItems').innerHTML = resolvedItems.map(item => `
                <div class="cart-line"
                     data-cart-item-sku="${item.sku}"
                     data-cart-item-quantity="${item.qty}"
                     data-cart-item-line-total="${item.lineTotal.toFixed(2)}">
                    ${item.name} × ${item.qty}   $${item.lineTotal.toFixed(2)}
                </div>
            `).join('');

            // 5. Inject discounts, tagged with their real type
            if (cart.savings_breakdown) {
                document.querySelector('#summarySavings').innerHTML = cart.savings_breakdown.map(discount => `
                    <div class="savings-component"
                         data-component-type="${discount.type}"
                         data-amount="${discount.amount.toFixed(2)}">
                        ${discount.label}: -$${discount.amount.toFixed(2)}
                    </div>
                `).join('');
            }
        }

    } catch (err) {
        console.error("Failed to initialize demo mode:", err);
    }
});
```

---

## 4. Limitation :

If we use the hardcoded switch statement, and if we made a tiny typo on Scenario 1.4, only Scenario 1.4 will break. The other 24 scenarios are safe.

But, if we use the Data-Driven Engine, the engine uses a single template to generate the HTML for all 25 scenarios.

If we made a tiny typo in the Engine's template (for ex., typing 'data-component-type' as 'data-comp-type'), it will instantly break the tag for all the 25 scenarios simultaneously.

---

## 5. Conclusion :

The Data-Driven Rendering Engine is the simplest and best architectural decision we can make for this sandbox.
This approach will save us hundreds of lines of code and make scaling to 25 scenarios effortless!
1.) We have to write the JavaScript only once.
2.) We can do infinite scaling via .JSON file
3.) We will have the Codebase clean.