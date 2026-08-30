import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4001;
// Saves to tests/fixtures/retail-pages
const OUTPUT_DIR = path.join(__dirname, '..', 'tests', 'fixtures', 'retail-pages');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  // CORS so the Chrome Extension can POST to us
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Add this so Chrome allows Vercel to talk to your local terminal:
  res.setHeader('Access-Control-Allow-Private-Network', 'true');


  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/save-html') {
    let body = '';
    // Increase payload limits for large HTML files
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const fileName = payload.filename || 'captured-page.html';
        const htmlContent = payload.html || '';

        // Ensure it ends in .html
        const safeName = fileName.endsWith('.html') ? fileName : fileName + '.html';
        const filePath = path.join(OUTPUT_DIR, safeName);

        fs.writeFileSync(filePath, htmlContent, 'utf8');
        console.log(`\n✅ Saved DOM: ${safeName} (${(htmlContent.length / 1024).toFixed(2)} KB)`);
        console.log(`📂 Location: ${filePath}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', file: safeName }));
      } catch (e) {
        console.log('\n❌ Error saving DOM:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: e.message }));
      }
    });
    return;
  }

  // --- NEW: PAYLOAD RECEIVER FOR TESTING ---
  if (req.method === 'POST' && req.url === '/api/collect') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        console.log(`\n======================================================`);
        console.log(`🚀 [AIORA] RECEIVED PAYLOAD: ${payload.envelope_type || 'tier0-9'}`);
        console.log(`======================================================`);
        console.dir(payload, { depth: null, colors: true });

        // Save to file for easy copy-pasting -----------------------
        const logPath = path.join(__dirname, '..', 'payloads.log');
        fs.appendFileSync(logPath, `\n\n--- [${new Date().toISOString()}] PAYLOAD: ${payload.envelope_type || 'tier0-9'} ---\n` + JSON.stringify(payload, null, 2), 'utf8');
        //--------------------------------------------------------- 

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
      } catch (e) {
        console.log('\n❌ Error parsing payload:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end();
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  AIORA HTML Receiver for Test Suite Extension      ║');
  console.log(`║  Listening on http://localhost:${PORT}/save-html      ║`);
  console.log(`║  Saving files to: tests/fixtures/retail-pages/     ║`);
  console.log('╚════════════════════════════════════════════════════╝');
});
