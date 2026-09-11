document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('captureBtn');
  const statusEl = document.getElementById('status');
  const inputEl = document.getElementById('filename');

  btn.addEventListener('click', async () => {
    const filename = inputEl.value.trim();
    if (!filename) {
      setStatus('Please enter a filename.', 'error');
      return;
    }

    setStatus('Capturing DOM...', '');
    btn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.documentElement.outerHTML,
      });

      const html = results[0].result;
      setStatus('Sending to local server...', '');

      const response = await fetch('http://localhost:4001/save-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, html })
      });

      const data = await response.json();
      
      if (response.ok) {
        setStatus(`Saved successfully: ${data.file}`, 'success');
        inputEl.value = ''; // clear for next time
      } else {
        setStatus(`Error: ${data.message}`, 'error');
      }

    } catch (err) {
      setStatus('Failed: Ensure local server is running.', 'error');
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  });

  function setStatus(msg, className) {
    statusEl.textContent = msg;
    statusEl.className = className;
  }
});
