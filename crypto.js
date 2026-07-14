// AES-GCM at-rest encryption for the local message/contact store.
// bitchat uses Noise (mesh) / NIP-17 (Nostr) for transit E2E; we apply the same
// "everything encrypted by default" spirit to on-device persistence. Transit to
// Grok is TLS; the #local channel never leaves the device at all.
const KEY_NAME = 'xgrok_enc_key';
let cachedKey = null;

async function getKey() {
  if (cachedKey) return cachedKey;
  const s = await chrome.storage.local.get(KEY_NAME);
  if (s[KEY_NAME]) {
    cachedKey = await crypto.subtle.importKey(
      'raw', Uint8Array.from(atob(s[KEY_NAME]), (c) => c.charCodeAt(0)),
      'AES-GCM', false, ['encrypt', 'decrypt']);
    return cachedKey;
  }
  const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', k));
  await chrome.storage.local.set({ [KEY_NAME]: btoa(String.fromCharCode(...raw)) });
  cachedKey = k;
  return k;
}

export async function encryptJSON(obj) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: Array.from(iv), ct: Array.from(new Uint8Array(buf)) };
}

export async function decryptJSON(payload) {
  if (!payload || !payload.ct) return null;
  const key = await getKey();
  const buf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(payload.iv) }, key, new Uint8Array(payload.ct));
  return JSON.parse(new TextDecoder().decode(buf));
}
