// demo_scenarios.js — same content as demo_scenarios.json, but as a static
// ES module import instead of a fetch(). Importing resolves synchronously
// at script-load time (no network round trip + JSON.parse), which matters
// because tag.js's DOM-settle extraction can fire in the gap between
// app.js's real render and demo_router.js's override landing — every bit of
// latency here widens that race window. See demo_router.js's boot logic.
export const demoScenarios = {
    "stacked-discounts": {
        "target_page": "cart",
        "cart": {
            "items": [
                {
                    "sku": "el-2",
                    "qty": 1
                }
            ],
            "savings_breakdown": [
                {
                    "type": "markdown",
                    "label": "Markdown (25% off original)",
                    "amount": 30.00
                },
                {
                    "type": "code",
                    "label": "WELCOME10 code (10% off)",
                    "amount": 6.00,
                    "code": "WELCOME10"
                },
                {
                    "type": "loyalty",
                    "label": "Shopora Plus member (5% off)",
                    "amount": 2.70
                }
            ],
            "shipping_label": "FREE delivery"
        }
    },
    "shipping-threshold-broken": {
        "target_page": "cart",
        "cart": {
            "items": [
                {
                    "sku": "fa-6",
                    "qty": 1
                },
                {
                    "sku": "el-9",
                    "qty": 1
                },
                {
                    "sku": "ho-4",
                    "qty": 1
                }
            ],
            "savings_breakdown": [
                {
                    "type": "code",
                    "label": "SAVE20 code (20% off)",
                    "amount": 13.59,
                    "code": "SAVE20"
                },
                {
                    "type": "markdown",
                    "label": "Markdown on all 3 items",
                    "amount": 9.00
                },
                {
                    "type": "loyalty",
                    "label": "Stacked loyalty credit",
                    "amount": 15.00
                }
            ],
            "shipping_label": "FREE delivery"
        }
    },
    "welcome-code-returning-member": {
        "target_page": "cart",
        "cart": {
            "items": [
                {
                    "sku": "bo-2",
                    "qty": 1
                }
            ],
            "savings_breakdown": [
                {
                    "type": "code",
                    "label": "WELCOME10 code (10% off)",
                    "amount": 2.30,
                    "code": "WELCOME10"
                },
                {
                    "type": "loyalty",
                    "label": "Shopora Plus member (5% off)",
                    "amount": 1.15
                }
            ],
            "shipping_label": "$5.99"
        }
    },
    "multi-mechanism-stack": {
        "target_page": "cart",
        "forceIdentity": {
            "state": "recognized",
            "tier": "plus"
        },
        "cart": {
            "items": [
                {
                    "sku": "fa-1",
                    "qty": 2
                }
            ],
            "savings_breakdown": [
                {
                    "type": "markdown",
                    "label": "Markdown (24% off)",
                    "amount": 12.00
                },
                {
                    "type": "sale",
                    "label": "BOGO 50% off 2nd unit",
                    "amount": 9.50
                },
                {
                    "type": "code",
                    "label": "SAVE20 code (20% off)",
                    "amount": 7.60,
                    "code": "SAVE20"
                },
                {
                    "type": "sale",
                    "label": "$5 category coupon",
                    "amount": 5.00
                },
                {
                    "type": "loyalty",
                    "label": "Shopora Plus (5%)",
                    "amount": 1.90
                }
            ],
            "shipping_label": "FREE delivery"
        }
    },
    "margin-floor-violation": {
        "target_page": "cart",
        "cart": {
            "items": [
                {
                    "sku": "fa-3",
                    "qty": 1
                }
            ],
            "savings_breakdown": [
                {
                    "type": "code",
                    "label": "SAVE20 code (20% off)",
                    "amount": 15.00,
                    "code": "SAVE20"
                },
                {
                    "type": "loyalty",
                    "label": "Shopora Plus (5%)",
                    "amount": 3.75
                },
                {
                    "type": "sale",
                    "label": "$10 sale credit",
                    "amount": 10.00
                },
                {
                    "type": "code",
                    "label": "Extra 15% stacked code",
                    "amount": 6.94,
                    "code": "EXTRA15"
                }
            ],
            "shipping_label": "FREE delivery"
        }
    },
    "hero-claim-mismatch": {
        "target_page": "homepage",
        "hero": {
            "headline": "UP TO 35% OFF ON ELECTRONICS",
            "claim_scope": "electronics"
        },
        "featuredTiles": ["el-1", "el-3", "el-4", "el-8", "el-2"],
        "featuredSectionHeading": "Big Savings Day Offered- Products",
        "hideSections": [".category-section", "#best-deals", ".promo-banner.promo-tech", ".promo-banner.promo-home"]
    },
    // 2.1.b: same hero-vs-tiles claim-mismatch story as 2.1, but with a
    // flat dollar-off claim instead of a percentage claim. Only el-1
    // actually honors the $100 headline — every other featured tile shows
    // a smaller, inconsistent dollar-off amount.
    "hero-claim-mismatch-dollar": {
        "target_page": "homepage",
        "hero": {
            "headline": "UP TO $100 OFF ON ELECTRONICS",
            "claim_scope": "electronics"
        },
        "featuredTiles": ["el-3", "el-8", "el-1", "el-4", "el-7", "el-2"],
        "featuredSectionHeading": "Big Savings Day Offered- Products",
        "hideSections": [".category-section", "#best-deals", ".promo-banner.promo-tech", ".promo-banner.promo-home"],
        "tiles": {
            "discountOverrides": [
                { "sku": "el-3", "badge": "$20 OFF", "price": 139.99 },
                { "sku": "el-8", "badge": "$23 OFF", "price": 206.99 },
                { "sku": "el-1", "badge": "$100 OFF", "price": 1699.99 },
                { "sku": "el-4", "badge": "$7 OFF", "price": 242.99 },
                { "sku": "el-7", "badge": "$13 OFF", "price": 416.99 },
                { "sku": "el-2", "badge": "$3 OFF", "price": 116.99 }
            ]
        }
    },
    "trending-brand-dominance": {
        "target_page": "homepage",
        "featuredTiles": ["el-1", "el-4", "el-2", "el-7", "el-10", "fa-1", "el-11", "ho-1", "el-12", "bo-1"],
        "tiles": {
            "brandOverrides": [
                { "sku": "el-11", "brand": "VoltMax" },
                { "sku": "el-12", "brand": "VoltMax" }
            ]
        }
    },
    "category-promise-gap": {
        "target_page": "category",
        "banner": {
            "headline": "UP TO 25% OFF ALL ELECTRONICS",
            "claim_percent": 25,
            "claim_scope": "electronics"
        },
        "tiles": {
            "discountOverrides": [
                { "sku": "el-1", "badge": "25% OFF", "price": 1349.99 }
            ]
        },
        "clickThrough": {
            "destinationSlug": "promise-gap-destination"
        }
    },
    "promise-gap-destination": {
        "target_page": "pdp",
        "pdp": {
            "price": 1619.99,
            "badge": "SAVE 10%",
            "exclusionNote": "Excluded from category promo — new model."
        }
    },
    // Pattern 5 (5.1): both entries are deliberately empty. The homepage's
    // "Hello, Rahul / Shopora Plus" comes entirely from app.js's real
    // initIdentity()/initLoyaltyChip(), driven by the real ?identity=logged-in
    // &member_tier=plus URL params — no override needed. The cart page's
    // "Hello, guest" is just its real default when no identity param is
    // present at all. These entries exist only so `?demo=` has a matching
    // slug (avoids the "Unknown scenario slug" console warning) — the
    // identity mismatch itself is 100% real site behavior, not staged.
    "identity-recognized": {
        "target_page": "homepage",
        "carryDemoForward": true,
        "navOverrides": [
            { "selector": ".cart-link", "destination": "./cart.html?demo=identity-lost" }
        ]
    },
    "identity-lost": {
        "target_page": "cart"
    }
};
