
# The AIORA Perfect PDP Structure

To ensure the AIORA tag extracts 100% of the required data from a Product Details Page (PDP), the HTML must include specific CSS classes or data attributes.

Give this guide to your UI agent so they can build a production-ready PDP that perfectly feeds our analytics engine.

## 1. The Hero Wrapper

The main product container should ideally be wrapped in an ID or class so the tag knows exactly where the primary product is.

- **Required:** `<div id="hero">` or `<div class="hero">`

## 2. Tier 0: Page Context (Envelope)

These elements tell the tag where the user is within the site hierarchy.

- **Breadcrumbs:** `<nav aria-label="breadcrumb">` containing `<li>` elements, or `<ul class="breadcrumbs"><li>...</li></ul>`

## 3. Tier 1: Core Hero Product Data

These are the critical data points for the main product being viewed.

### Identity & Naming

- **Product Name:** Must be an `<h1>` tag, or use `class="product-title"`
- **SKU / ID:** `data-sku="12345"` or `data-product-id="12345"` (Best placed on the hero wrapper or the `<h1>`)
- **Brand:** `class="product-brand"`
- **Manufacturer Part Number:** `data-mfr-no="XX-999"` or `class="mfr-number"`
- **Category Names:** `class="product-category"` or `class="department"` (e.g., `<span class="product-category">Electronics</span>`)

### Pricing & Discounts

- **Current Price:** `class="price"` or `class="price-current"` (e.g., `<span class="price">$19.99</span>`)
- **Old / Strikethrough Price:** `class="price-was"` or simply inside a `<del>` tag.
- **Unit Price (e.g., per ounce):** `class="price-per-unit"` or `class="unit-price"`
- **Discount Percentage Badge:** `class="discount-badge"` (e.g., `<span class="discount-badge">25% OFF</span>`)
- **Discount Absolute Amount:** `class="discount-amount"` or `class="savings-amount"` (e.g., `<span class="discount-amount">Save $10.00</span>`)

### Status & Interactions

- **Add to Cart Button:** `class="add-to-cart"`
- **Availability / Stock Status:** `data-availability="in-stock"` (or `out-of-stock` / `low-stock`), or `class="out-of-stock"`
- **Delivery Promise:** `class="delivery-promise"` or `class="delivery-note"` (e.g., `<p class="delivery-promise">Arrives tomorrow</p>`)
- **Scarcity / General Badges:** `class="scarcity-msg"` or `class="badge"` (e.g., `<span class="scarcity-msg">Only 2 left!</span>`)

---

## Example of a Perfect PDP HTML Block:

```html
<nav aria-label="breadcrumb">
  <ul>
    <li>Home</li>
    <li>Electronics</li>
  </ul>
</nav>

<div id="hero" data-sku="NEO-20W" data-mfr-no="NC-20W-WHT" data-availability="in-stock">
  <p class="product-brand">NeoCharge</p>
  <h1 class="product-title">NeoCharge 20W Fast Charger</h1>
  
  <div class="price-stack">
    <strong class="price">$19.99</strong>
    <del class="price-was">$29.99</del>
    <span class="discount-badge">33% OFF</span>
    <span class="discount-amount">Save $10.00</span>
  </div>

  <p class="delivery-promise">Free Delivery by Tomorrow</p>
  <p class="scarcity-msg">High Demand</p>

  <button class="add-to-cart">Add to Cart</button>
</div>
```
