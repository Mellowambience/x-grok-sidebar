import { encryptSecret, decryptSecret } from './crypto.js';

const keyEl = document.getElementById('key');
const clientEl = document.getElementById('client');
const mistEl = document.getElementById('mist');
const osEl = document.getElementById('os');
const modelEl = document.getElementById('model');
const saveEl = document.getElementById('save');
const signinEl = document.getElementById('signin');
const signoutEl = document.getElementById('signout');
const statusEl = document.getElementById('status');
const redirEl = document.getElementById('redir');

function setStatus(msg, ok) {
  statusEl.textContent = msg || '';
  statusEl.className = ok === true ? 'ok' : ok === false ? 'err' : '';
}

try {
  if (redirEl && chrome.identity?.getRedirectURL) {
    redirEl.textContent = chrome.identity.getRedirectURL();
  }
} catch { /* ignore */ }

chrome.storage.local.get(
  ['xaiKey', 'xaiKeyEnc', 'xClientId', 'mistEndpoint', 'osEndpoint', 'grokModel'],
  async (s) => {
    if (s.xaiKeyEnc) keyEl.value = await decryptSecret(s.xaiKeyEnc);
    else keyEl.value = s.xaiKey || '';
    clientEl.value = s.xClientId || '';
    mistEl.value = s.mistEndpoint || 'http://localhost:7842';
    osEl.value = s.osEndpoint || 'http://localhost:8742';
    modelEl.value = s.grokModel || 'grok-4-latest';
    refreshSsoUi();
  }
);

async function saveSettings() {
  const plain = keyEl.value.trim();
  const xaiKeyEnc = plain ? await encryptSecret(plain) : null;
  const payload = {
    mistEndpoint: mistEl.value.trim() || 'http://localhost:7842',
    osEndpoint: osEl.value.trim() || 'http://localhost:8742',
    xClientId: clientEl.value.trim(),
    grokModel: modelEl.value || 'grok-4-latest',
    xaiKeyEnc: xaiKeyEnc
  };
  await new Promise((resolve) => chrome.storage.local.remove('xaiKey', resolve));
  await new Promise((resolve) => chrome.storage.local.set(payload, resolve));
}

saveEl.addEventListener('click', async () => {
  saveEl.disabled = true;
  try {
    if (!clientEl.value.trim()) {
      setStatus('Client ID recommended for SSO — saved anyway (post/friends need it).', false);
    }
    await saveSettings();
    setStatus('Saved ✓ — Sign in with X works without an xAI key.', true);
    setTimeout(() => setStatus(''), 2200);
  } catch (e) {
    setStatus('Save failed: ' + e.message, false);
  } finally {
    saveEl.disabled = false;
  }
});

signinEl.addEventListener('click', async () => {
  signinEl.disabled = true;
  setStatus('Opening X sign-in…');
  try {
    await saveSettings();
    const res = await chrome.runtime.sendMessage({ type: 'SSO_LOGIN' });
    if (res && res.ok) {
      setStatus('✓ Signed in with X — friends + gated post ready (no xAI key required).', true);
      refreshSsoUi();
    } else {
      setStatus('SSO failed: ' + ((res && res.error) || 'unknown'), false);
    }
  } catch (e) {
    setStatus('SSO failed: ' + e.message, false);
  } finally {
    signinEl.disabled = false;
  }
});

signoutEl.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'SSO_LOGOUT' });
  setStatus('Signed out of X.', true);
  refreshSsoUi();
});

function refreshSsoUi() {
  chrome.runtime.sendMessage({ type: 'SSO_STATUS' }, (s) => {
    if (chrome.runtime.lastError) return;
    if (s && s.hasToken) {
      signinEl.textContent = 'Re-sync X';
      signoutEl.disabled = false;
    } else {
      signinEl.textContent = 'Sign in with X';
    }
  });
}
