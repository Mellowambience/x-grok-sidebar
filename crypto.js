// AES-GCM at-rest encryption for secrets + local message/contact store.
// Trust boundary is the browser profile (chrome.storage.local). The AES key
// lives in the same store — this obfuscates secrets from casual dumps / backups,
// not from malware with extension-storage access. Document that honestly.
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
  try {
    const key = await getKey();
    const buf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(payload.iv) }, key, new Uint8Array(payload.ct));
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return null;
  }
}

/** Encrypt a string secret (xAI key, etc.). Returns null for empty. */
export async function encryptSecret(plain) {
  if (plain == null || plain === '') return null;
  return encryptJSON({ v: String(plain) });
}

/** Decrypt a secret payload; supports legacy plaintext string values. */
export async function decryptSecret(payloadOrPlain) {
  if (payloadOrPlain == null || payloadOrPlain === '') return '';
  if (typeof payloadOrPlain === 'string') return payloadOrPlain; // legacy plaintext
  const obj = await decryptJSON(payloadOrPlain);
  return (obj && typeof obj.v === 'string') ? obj.v : '';
}
