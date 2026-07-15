// MV3 service worker — owns SSO (X OAuth2 + PKCE), token persistence, gated post.
// Tokens are AES-GCM wrapped in chrome.storage.local (same key material as crypto.js).
// Classic SW script (not ES module) so we keep AES helpers inline.

const REDIRECT = chrome.identity.getRedirectURL(); // https://<ext-id>.chromiumapp.org/
// Prefer CLIENT_ID from storage (set in popup). Fallback constant for forks.
const DEFAULT_CLIENT_ID = 'REPLACE_WITH_YOUR_X_OAUTH2_CLIENT_ID';
const SCOPES = 'tweet.read users.read tweet.write offline.access';
const KEY_NAME = 'xgrok_enc_key';

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256B64url(str) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return b64url(d);
}
function randomB64url(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

async function getAesKey() {
  const s = await chrome.storage.local.get(KEY_NAME);
  if (s[KEY_NAME]) {
    return crypto.subtle.importKey(
      'raw', Uint8Array.from(atob(s[KEY_NAME]), (c) => c.charCodeAt(0)),
      'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', k));
  await chrome.storage.local.set({ [KEY_NAME]: btoa(String.fromCharCode(...raw)) });
  return k;
}

async function encryptJSON(obj) {
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: Array.from(iv), ct: Array.from(new Uint8Array(buf)) };
}

async function decryptJSON(payload) {
  if (!payload || !payload.ct) return null;
  try {
    const key = await getAesKey();
    const buf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(payload.iv) }, key, new Uint8Array(payload.ct));
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return null;
  }
}

async function loadToken() {
  const s = await chrome.storage.local.get(['xTokenEnc', 'xToken']);
  if (s.xTokenEnc) {
    const t = await decryptJSON(s.xTokenEnc);
    if (t) return t;
  }
  // legacy plaintext migration
  if (s.xToken) {
    await saveToken(s.xToken);
    await chrome.storage.local.remove('xToken');
    return s.xToken;
  }
  return null;
}

async function saveToken(tok) {
  const enc = await encryptJSON(tok);
  await chrome.storage.local.set({ xTokenEnc: enc });
  await chrome.storage.local.remove('xToken');
}

async function getClientId() {
  const s = await chrome.storage.local.get('xClientId');
  const id = (s.xClientId || DEFAULT_CLIENT_ID || '').trim();
  return id;
}

function xErrorMessage(j, status) {
  if (!j) return 'HTTP ' + status;
  if (typeof j.error === 'string') return j.error;
  if (j.detail) return String(j.detail);
  if (Array.isArray(j.errors) && j.errors.length) {
    return j.errors.map((e) => e.detail || e.message || e.title || JSON.stringify(e)).join('; ');
  }
  if (j.title) return j.title;
  return 'HTTP ' + status;
}

async function ssoLogin() {
  const CLIENT_ID = await getClientId();
  if (!CLIENT_ID || CLIENT_ID.startsWith('REPLACE_WITH')) {
    throw new Error('Set your X OAuth Client ID in the extension popup first.');
  }
  const state = randomB64url(16);
  const verifier = randomB64url(64);
  const challenge = await sha256B64url(verifier);
  const url = 'https://x.com/i/oauth2/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString();
  const respUrl = await new Promise((resolve, reject) =>
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (r) => {
      if (chrome.runtime.lastError || !r) reject(new Error(chrome.runtime.lastError?.message || 'SSO cancelled'));
      else resolve(r);
    })
  );
  const params = new URLSearchParams(new URL(respUrl).search);
  if (params.get('state') !== state) throw new Error('SSO state mismatch');
  const code = params.get('code');
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT,
    code_verifier: verifier,
    client_id: CLIENT_ID
  });
  const r = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const tok = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Token exchange failed: ' + xErrorMessage(tok, r.status));
  await saveToken({ ...tok, obtained_at: Date.now() });
  return { ok: true, hasToken: true };
}

async function getValidToken() {
  const t = await loadToken();
  if (!t) return null;
  const expAt = (t.obtained_at || 0) + (t.expires_in || 7200) * 1000;
  if (Date.now() < expAt - 30000) return t.access_token;
  if (t.refresh_token) return ssoRefresh(t.refresh_token);
  return null;
}

async function ssoRefresh(refresh) {
  const CLIENT_ID = await getClientId();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: CLIENT_ID
  });
  const r = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const tok = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Token refresh failed: ' + xErrorMessage(tok, r.status));
  // Preserve refresh_token if API omits it on refresh
  const prev = await loadToken();
  const merged = {
    ...tok,
    refresh_token: tok.refresh_token || prev?.refresh_token || refresh,
    obtained_at: Date.now()
  };
  await saveToken(merged);
  return merged.access_token;
}

function isExtensionSender(sender) {
  // Only accept messages from our own extension pages / content scripts
  return !!(sender && sender.id === chrome.runtime.id);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!isExtensionSender(sender)) {
    sendResponse({ ok: false, error: 'unauthorized' });
    return false;
  }

  if (msg.type === 'SSO_LOGIN') {
    ssoLogin().then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'SSO_STATUS') {
    loadToken().then((t) => sendResponse({ hasToken: !!t })).catch(() => sendResponse({ hasToken: false }));
    return true;
  }
  if (msg.type === 'SSO_GET_TOKEN') {
    getValidToken().then((token) => sendResponse({ token })).catch(() => sendResponse({ token: null }));
    return true;
  }
  if (msg.type === 'SSO_LOGOUT') {
    chrome.storage.local.remove(['xToken', 'xTokenEnc'], () => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'SSO_POST') {
    // Gated in panel UI (propose → approve). Text length hard-capped here too.
    getValidToken().then(async (token) => {
      if (!token) return sendResponse({ ok: false, error: 'no token — sign in with X first' });
      const text = String(msg.text || '').slice(0, 28000);
      if (!text.trim()) return sendResponse({ ok: false, error: 'empty text' });
      const body = { text };
      if (msg.reply && msg.reply.in_reply_to_tweet_id) {
        const id = String(msg.reply.in_reply_to_tweet_id);
        // Tweet ids are numeric snowflakes — reject obvious user-id mistakes if needed
        if (!/^\d{1,25}$/.test(id)) {
          return sendResponse({ ok: false, error: 'invalid in_reply_to_tweet_id' });
        }
        body.reply = { in_reply_to_tweet_id: id };
      }
      const r = await fetch('https://api.x.com/2/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body)
      });
      const j = await r.json().catch(() => ({}));
      sendResponse({
        ok: r.ok,
        data: j.data,
        error: r.ok ? null : xErrorMessage(j, r.status)
      });
    }).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
