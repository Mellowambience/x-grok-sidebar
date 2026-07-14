const keyEl = document.getElementById('key');
const mistEl = document.getElementById('mist');
const osEl = document.getElementById('os');
const saveEl = document.getElementById('save');
const statusEl = document.getElementById('status');

chrome.storage.local.get(['xaiKey', 'mistEndpoint', 'osEndpoint'], (s) => {
  keyEl.value = s.xaiKey || '';
  mistEl.value = s.mistEndpoint || 'http://localhost:7842';
  osEl.value = s.osEndpoint || 'http://localhost:8742';
});

saveEl.addEventListener('click', () => {
  chrome.storage.local.set(
    {
      xaiKey: keyEl.value.trim(),
      mistEndpoint: mistEl.value.trim(),
      osEndpoint: osEl.value.trim()
    },
    () => {
      statusEl.textContent = 'Saved ✓';
      setTimeout(() => { statusEl.textContent = ''; }, 1500);
    }
  );
});
