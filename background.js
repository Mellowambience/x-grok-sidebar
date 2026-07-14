// MV3 service worker — owns SSO (X OAuth2 + PKCE) and token persistence only.
// Per the build skill: background persists; it does NOT re-forward UI messages.
const REDIRECT = chrome.identity.getRedirectURL(); // https://<ext-id>.chromiumapp.org/
const CLIENT_ID = 'REPLACE_WITH_YOUR_X_OAUTH2_CLIENT_ID'; // register at developer.x.com
const SCOPES = 'tweet.read users.read tweet.write offline.access';

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

async function ssoLogin() {
  const state = randomB64url(16);
  const verifier = randomB64url(64);
  const challenge = await sha256B64url(verifier);
  const url = 'https://twitter.com/i/oauth2/authorize?' + new URLSearchParams({
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
  const r = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!r.ok) throw new Error('Token exchange failed ' + r.status);
  const tok = await r.json();
  // offline.access scope grants refresh_token; stamp obtained_at for expiry math
  await chrome.storage.local.set({ xToken: { ...tok, obtained_at: Date.now() } });
  return { ok: true, hasToken: true };
}

// --- SSO token refresh (X access tokens expire ~2h; refresh_token ~30d) ---
async function getValidToken() {
  const s = await chrome.storage.local.get('xToken');
  const t = s.xToken;
  if (!t) return null;
  const expAt = (t.obtained_at || 0) + (t.expires_in || 7200) * 1000;
  if (Date.now() < expAt - 30000) return t.access_token; // 30s skew
  if (t.refresh_token) return ssoRefresh(t.refresh_token);
  return null;
}

async function ssoRefresh(refresh) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: CLIENT_ID
  });
  const r = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!r.ok) throw new Error('Token refresh failed ' + r.status);
  const tok = await r.json();
  await chrome.storage.local.set({ xToken: { ...tok, obtained_at: Date.now() } });
  return tok.access_token;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SSO_LOGIN') {
    ssoLogin().then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'SSO_STATUS') {
    chrome.storage.local.get('xToken', (s) => sendResponse({ hasToken: !!s.xToken }));
    return true;
  }
  if (msg.type === 'SSO_GET_TOKEN') {
    // Returns a fresh access token, refreshing silently if expired.
    getValidToken().then((token) => sendResponse({ token })).catch(() => sendResponse({ token: null }));
    return true;
  }
  if (msg.type === 'SSO_POST') {
    // Posts a tweet on the user's behalf. Token was already approved via SSO.
    // The user's explicit approval happens in panel.js (propose -> approve).
    // Optional msg.reply.in_reply_to_tweet_id threads the post under a focused contact.
    getValidToken().then(async (token) => {
      if (!token) return sendResponse({ ok: false, error: 'no token' });
      const body = { text: msg.text };
      if (msg.reply && msg.reply.in_reply_to_tweet_id) body.reply = msg.reply;
      const r = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      sendResponse({ ok: r.ok, data: j.data, error: j.error });
    }).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
