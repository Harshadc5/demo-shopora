# Moving Backend endpoints from httpbin.org to Webhook

This document outlines the step-by-step process required to move AIORA's data collection from the temporary `httpbin.org` testing endpoint to a real, production-ready webhook.

## 1. Why We Need to Move
`httpbin.org` is a public mirror. It does not store data, it does not process rules, and it is not secure for real user data. A real webhook (backend server) is required to:
1. Actually save the DOM snapshots to a database.
2. Run the Counterfactual Recording Engine (your rules) against the data.
3. Run server-side PII scrubbing (NER) to remove names like "Welcome, Sarah!".
4. Power the retailer reporting dashboard.

---

## 2. The Architecture
The AIORA backend should ideally be built using a **Serverless Function** (like Cloudflare Workers, AWS Lambda, or Vercel Functions) or a fast **Node.js Express** server. 

Because `navigator.sendBeacon` is fired exactly as the user is leaving the page, the webhook must be **extremely fast**.

### Core Requirements for the Webhook:
- **Method:** Must accept `POST` requests.
- **Headers:** Must accept `text/plain` (since we send our JSON stringified inside a text payload to avoid CORS preflight delays).
- **Speed:** Must immediately return a `202 Accepted` status code. Do **not** process the rules while the connection is open. Save it to a queue and close the connection instantly.
- **CORS:** Must have the header `Access-Control-Allow-Origin: *` so browsers don't block the beacon.

---

## 3. Step-by-Step Implementation Guide

### Phase 1: Build the Receiver
If you are using Node.js/Express, the basic structure looks like this:

```javascript
const express = require('express');
const app = express();

// 1. Accept raw text bodies (since we send text/plain to bypass CORS)
app.use(express.text({ type: 'text/plain', limit: '1mb' }));

// 2. Set CORS Headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    next();
});

app.post('/v1/signal', async (req, res) => {
    // 3. Immediately close the connection so the browser is happy
    res.status(202).send('Accepted');

    try {
        // 4. Parse the data in the background
        const payload = JSON.parse(req.body);
        
        // 5. Run Server-Side PII Scrubbing (NER) here
        // e.g., const cleanPayload = runNERScrubber(payload);

        // 6. Save to Database / Send to Queue
        // e.g., await database.insert(cleanPayload);
        
    } catch (err) {
        console.error("Failed to process beacon:", err);
    }
});

app.listen(8080, () => console.log('Webhook listening on port 8080'));
```

### Phase 2: Deploy the Webhook
Deploy this code to a reliable host:
- **Cloudflare Workers** (Highly recommended: it runs at the edge, meaning it catches beacons instantly from anywhere in the world).
- **Vercel** (Good for Next.js apps).
- **AWS Lambda**.

Once deployed, you will get a URL. Let's assume it is:
`https://ingest.aiora.systems/v1/signal`

### Phase 3: Update the Tag Configuration
Now that your webhook is live, you must tell the `tag.js` script to send data there instead of `httpbin.org`.

Go to `Shopora/index.html` (and all other HTML files) and add the `data-endpoint` attribute to your script tag:

```html
<!-- AIORA JS Tag -->
<script src="./tag.js"
        data-client-id="shopora-dev"
        data-endpoint="https://ingest.aiora.systems/v1/signal" <!-- Add this line -->
        data-sampling-rate="1.0"
        data-hydration-timeout="3000"
        data-dom-settle-ms="500"
        async>
</script>
```

### Phase 4: Build the Dashboard & Rules Engine
Once the webhook is successfully catching the data and saving it to your database, you can begin building:
1. **The Rules Engine:** A separate script that runs in the background, pulls the snapshots from the database, and checks for conflicting promos.
2. **The Dashboard:** A front-end React/Next.js app that reads the database and shows the retailer how much money they are losing.
