# SHOPORA

A responsive multi-page ecommerce demo with product search, filters, wishlist, cart, checkout, custom product photos, and locally stored shopping data. 

**This project also serves as a testing environment for the `tag.js` analytics tracking system**, which captures user interaction events, e-commerce workflows, and data attributes.

## Run the Project

For complete beginner-friendly instructions, read:

**[How to Run SHOPORA](HOW-TO-RUN.md)**

### Quick Start

To run the site and the analytics receiver simultaneously, open two separate terminal windows in your `Shopora` folder:

**Terminal 1: Start the analytics receiver**
```powershell
node tools/html-receiver.js
```
*(This listens for payload data from `tag.js` and logs it to `payloads.log` and `interaction_events.log`)*

**Terminal 2: Start the web server**
```powershell
npx http-server .
```
*(Alternatively, you can use `python -m http.server 8000`)*

Then open the generated local URL (usually [http://localhost:8080](http://localhost:8080)) in your web browser.

## Pages

- `index.html` — storefront homepage
- `category.html` — searchable and filterable product catalog
- `pdp.html` — dynamic Product Detail Page (PDP)
- `cart.html` — editable shopping cart
- `checkout.html` — demo checkout flow
- `orders.html` — user order history & returns

## Notes

- **Tracking & Analytics:** User interactions and e-commerce events are actively tracked via `tag.js` and pushed to the local receiver.
- Product data is dynamically loaded from `data/products.js`.
- Custom product photos can be placed in `assets/products`.
- Cart, wishlist, and past order history are persisted using the browser's local storage.
- The checkout page is a frontend demonstration; no real payment is processed.
