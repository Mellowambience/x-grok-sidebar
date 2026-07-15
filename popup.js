import { encryptSecret, decryptSecret } from './crypto.js';

const keyEl = document.getElementById('key');
const clientEl = document.getElementById('client');
const mistEl = document.getElementById('mist');
const osEl = document.getElementById('os');
const saveEl = document.getElementById('save');
const statusEl = document.getElementById('status');
const redirEl = document.getElementById('redir');

try {
  if (redirEl && chrome.identity?.getRedirectURL) {
    redirEl.textContent = chrome.identity.getRedirectURL();
  }
} catch { /* ignore */ }

chrome.storage.local.get(['xaiKey', 'xaiKeyEnc', 'xClientId', 'mistEndpoint', 'osEndpoint'], async (s) => {
  if (s.xaiKeyEnc) keyEl.value = await decryptSecret(s.xaiKeyEnc);
  else keyEl.value = s.xaiKey || '';
  clientEl.value = s.xClientId || '';
  mistEl.value = s.mistEndpoint || 'http://localhost:7842';
  osEl.value = s.osEndpoint || 'http://localhost:8742';
});

saveEl.addEventListener('click', async () => {
  saveEl.disabled = true;
  try {
    const plain = keyEl.value.trim();
    const xaiKeyEnc = plain ? await encryptSecret(plain) : null;
    const payload = {
      mistEndpoint: mistEl.value.trim() || 'http://localhost:7842',
      osEndpoint: osEl.value.trim() || 'http://localhost:8742',
      xClientId: clientEl.value.trim()
    };
    if (xaiKeyEnc) payload.xaiKeyEnc = xaiKeyEnc;
    else payload.xaiKeyEnc = null;
    // wipe legacy plaintext key
    await new Promise((resolve) => {
      chrome.storage.local.remove('xaiKey', resolve);
    });
    await new Promise((resolve) => {
      chrome.storage.local.set(payload, resolve);
    });
    statusEl.textContent = 'Saved ✓';
    setTimeout(() => { statusEl.textContent = ''; }, 1500);
  } catch (e) {
    statusEl.textContent = 'Save failed: ' + e.message;
  } finally {
    saveEl.disabled = false;
  }
});
