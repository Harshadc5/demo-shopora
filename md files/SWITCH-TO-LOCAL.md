# Switching from httpbin.org → Local Receiver

Use this when `httpbin.org` is down or you want to see the full beacon payload in your terminal.

---

## Step 1 — Start the Local Receiver

Open a **new terminal** in VS Code and run:

```powershell
cd "i:\JS TAG\js-tag"
node receiver.js
```

You should see:

```
╔══════════════════════════════════════════════╗
║   AIORA Local Beacon Receiver                ║
║   Listening on http://localhost:4000         ║
╚══════════════════════════════════════════════╝
```

> **Keep this terminal open.** Every beacon will print here.

---

## Step 2 — Add `data-endpoint` to Each Shopora Page

Add `data-endpoint="http://localhost:4000"` to the AIORA script tag on each page.

### `Shopora/index.html`
```html
<script src="../js-tag/src/tag.js"
        data-client-id="shopora-dev"
        data-endpoint="http://localhost:4000"
        data-sampling-rate="1.0"
        data-hydration-timeout="3000"
        data-dom-settle-ms="500"
        async>
</script>
```

### `Shopora/cart.html`
```html
<script src="../js-tag/src/tag.js"
        data-client-id="shopora-dev"
        data-endpoint="http://localhost:4000"
        data-sampling-rate="1.0"
        data-hydration-timeout="3000"
        data-dom-settle-ms="500"
        async>
</script>
```

### `Shopora/category.html`
```html
<script src="../js-tag/src/tag.js"
        data-client-id="shopora-dev"
        data-endpoint="http://localhost:4000"
        data-sampling-rate="1.0"
        data-hydration-timeout="3000"
        data-dom-settle-ms="500"
        async>
</script>
```

### `Shopora/checkout.html`
```html
<script src="../js-tag/src/tag.js"
        data-client-id="shopora-dev"
        data-endpoint="http://localhost:4000"
        data-sampling-rate="1.0"
        data-hydration-timeout="3000"
        data-dom-settle-ms="500"
        async>
</script>
```

---

## Step 3 — Open Shopora in Live Server

Right-click any HTML file in VS Code → **Open with Live Server**

Navigate to `category.html` — it has a full product grid so you'll see tiles captured.

---

## Step 4 — Watch the Terminal

After ~1 second the beacon fires. You'll see:

```
════════════════════════════════════════════════════════════
📡 BEACON RECEIVED  [3:01:12 pm]
════════════════════════════════════════════════════════════
📄 Page      : CATEGORY — http://127.0.0.1:5500/Shopora/category.html
🆔 Client    : shopora-dev

🏷  Promo Banners (3):
   [announcement_bar] "Free delivery above ₹799" → free_offer

🚚 Fulfillment Offers (1):
   [free_shipping] "Free delivery above ₹799"  threshold: mid

📦 Product Tiles Captured (15):
   #1 ApexView 55" 4K HDR Smart TV  ₹41,234 [MARKDOWN]  badge: Hot Deal  stock: ✓
   #2 VoltMax 15.6" Laptop  ₹60,749  badge: Popular  stock: ✓
   ...

🧩 DOM size  : 22 KB (scrubbed)
════════════════════════════════════════════════════════════
```

---

## Switching Back to httpbin (when it's up)

Remove the `data-endpoint` line from each script tag. The tag will fall back to `httpbin.org/post` automatically.

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `EADDRINUSE port 4000` | Receiver already running | Don't run `node receiver.js` twice. Check terminal tabs. |
| `503 httpbin.org` | httpbin is down globally | Switch to localhost using steps above |
| Beacon not appearing | Page loaded before receiver started | Refresh the page after starting receiver |
| Tiles: 0 on homepage | Products inject after DOM capture | Use `category.html` instead — products render before capture |
