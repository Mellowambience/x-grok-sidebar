import { decideTransport } from './router.mjs';
import { encryptJSON, decryptJSON, encryptSecret, decryptSecret } from './crypto.js';
import { setEndpoint as setMistEndpoint, isMistReady, probeMist, askMist } from './mist.js';
import { setEndpoint as setOsEndpoint, isOsReady, probeOs, getStatus, askOs } from './os.js';
import twitter from './lib/twitter-text/index.js';

const $ = (id) => document.getElementById(id);
const contactListEl = $('contactList');
const messagesEl = $('messages');
const inputEl = $('input');
const sendEl = $('send');
const counterEl = $('charCount');
const ctxEl = $('chatContext');
const transportEl = $('transport');
const channelSel = $('channel');
const ssoBtn = $('sso');
const moodEl = $('mood');
const brandName = $('brandName');
const hudEl = $('hud');

const MAX_LEN = 280;
const MAX_MESSAGES = 80;
const MAX_FRIEND_PAGES = 10;
const SAFE_AVATAR = /^https:\/\/[a-z0-9.-]*twimg\.com\//i;

// ---- the presence: first-person mood bubble (intimate, not telemetry) ----
function setMood(text, kind = '') {
  moodEl.textContent = text;
  moodEl.className = 'mood' + (kind ? ' ' + kind : '');
}
function moodForTransport(t, persona) {
  if (t === 'mist') return ['I am MIST — sovereign, local, and yours. Ask me anything.', 'mist'];
  if (t === 'os') return ['Sovereign OS online. Agents, tasks, and memory are mine to command.', 'os'];
  if (t === 'local') return ['Thinking quietly, on my own. Nothing leaves this device.', 'local'];
  if (t === 'queued') return ["You drifted offline — I'll hold your words until we reconnect.", 'drift'];
  return [persona === 'mist' ? 'Aurelia is listening.' : persona === 'os' ? 'OS standing by.' : "I'm Grok. I can see what you're reading — and who. Ask me anything, unfiltered.", 'think'];
}

let contacts = [];
let activeContact = null;
/** @type {{ tweetId: string, handle: string|null, text?: string }|null} */
let pinnedTweet = null;
let channel = 'grok';
let messages = [];
let xaiKey = '';
let grokModel = 'grok-4-latest';
let online = navigator.onLine;
let queue = [];
let localReady = false;
let flushing = false;

// ---- bootstrap from encrypted store ----
chrome.storage.local.get(
  ['xaiKey', 'xaiKeyEnc', 'contactsEnc', 'messagesEnc', 'queueEnc', 'mistEndpoint', 'osEndpoint', 'grokModel'],
  async (s) => {
    if (s.xaiKeyEnc) {
      xaiKey = await decryptSecret(s.xaiKeyEnc);
    } else if (s.xaiKey) {
      // migrate legacy plaintext key
      xaiKey = s.xaiKey;
      const enc = await encryptSecret(xaiKey);
      await chrome.storage.local.set({ xaiKeyEnc: enc });
      await chrome.storage.local.remove('xaiKey');
    }
    grokModel = s.grokModel || 'grok-4-latest';
    contacts = (await decryptJSON(s.contactsEnc)) || [];
    messages = (await decryptJSON(s.messagesEnc)) || [];
    queue = (await decryptJSON(s.queueEnc)) || [];
    if (s.mistEndpoint) setMistEndpoint(s.mistEndpoint);
    if (s.osEndpoint) setOsEndpoint(s.osEndpoint);
    renderContacts();
    renderMessages();
    probeMist().finally(() => probeOs().finally(refreshTransport));
    if (queue.length) flushQueue();
    // SSO-only welcome: pin + post work without cloud key
    if (!xaiKey && !messages.length) {
      pushMessage(
        'assistant',
        'SSO-first mode: Sign in with X (Client ID in the toolbar popup) to sync friends and post with approval. ' +
        'Cloud Grok needs an optional xAI key; until then use #mist / #local / #os, or /post a draft after you sign in.'
      );
    }
  }
);

// live-reload key / endpoints when popup saves
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  (async () => {
    if (changes.xaiKeyEnc) {
      xaiKey = await decryptSecret(changes.xaiKeyEnc.newValue);
      refreshTransport();
    } else if (changes.xaiKey) {
      xaiKey = changes.xaiKey.newValue || '';
      refreshTransport();
    }
    if (changes.grokModel?.newValue) grokModel = changes.grokModel.newValue;
    if (changes.mistEndpoint?.newValue) {
      setMistEndpoint(changes.mistEndpoint.newValue);
      probeMist().finally(refreshTransport);
    }
    if (changes.osEndpoint?.newValue) {
      setOsEndpoint(changes.osEndpoint.newValue);
      probeOs().finally(refreshTransport);
    }
  })();
});

// ---- SSO (X OAuth2 via background service worker) — works without xAI key ----
ssoBtn.addEventListener('click', async () => {
  ssoBtn.disabled = true;
  ssoBtn.textContent = 'Signing in…';
  ssoBtn.title = '';
  const res = await chrome.runtime.sendMessage({ type: 'SSO_LOGIN' });
  if (res && res.ok) {
    ssoBtn.textContent = '✓ Synced';
    ssoBtn.disabled = false;
    setMood('Signed in with X. Friends + gated /post ready — no xAI key required for that.', 'focus');
    fetchFriends();
  } else {
    const err = (res && res.error) || 'SSO failed';
    ssoBtn.textContent = 'SSO failed — retry';
    ssoBtn.title = err;
    ssoBtn.disabled = false;
    setMood(
      err.includes('Client ID')
        ? 'Open the toolbar popup → paste X OAuth Client ID → Save → Sign in. xAI key is optional.'
        : 'SSO: ' + err,
      'drift'
    );
  }
});

async function fetchFriends() {
  const res = await chrome.runtime.sendMessage({ type: 'SSO_GET_TOKEN' });
  const t = res && res.token;
  if (!t) {
    ssoBtn.textContent = 'Token expired — re-sign in';
    ssoBtn.disabled = false;
    return;
  }
  const me = await (await fetch('https://api.x.com/2/users/me', {
    headers: { Authorization: 'Bearer ' + t }
  })).json();
  if (!me.data) return;
  let next = null;
  let pages = 0;
  const seen = new Set(contacts.map((c) => c.handle));
  do {
    let url = `https://api.x.com/2/users/${me.data.id}/following?max_results=100&user.fields=profile_image_url,name,username`;
    if (next) url += '&pagination_token=' + next;
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
    if (r.status === 429) break;
    const j = await r.json();
    (j.data || []).forEach((u) => {
      if (!seen.has(u.username)) {
        seen.add(u.username);
        contacts.push({ handle: u.username, name: u.name, avatar: u.profile_image_url || '' });
      }
    });
    next = j.meta?.next_token;
    pages += 1;
  } while (next && pages < MAX_FRIEND_PAGES);
  await persist();
  renderContacts();
}

// ---- encrypted persistence ----
async function persist() {
  // trim history so storage + prompts stay bounded
  if (messages.length > MAX_MESSAGES) messages = messages.slice(-MAX_MESSAGES);
  if (queue.length > 40) queue = queue.slice(-40);
  await chrome.storage.local.set({
    contactsEnc: await encryptJSON(contacts),
    messagesEnc: await encryptJSON(messages),
    queueEnc: await encryptJSON(queue)
  });
}

// ---- transport badge + routing + presence rebrand + HUD ----
function renderHud() {
  const st = getStatus();
  $('hudAgents').textContent = st.agents;
  $('hudTasks').textContent = st.tasks;
  $('hudMem').textContent = st.mem;
  $('hudUptime').textContent = st.uptime;
  const on = isOsReady();
  hudEl.querySelectorAll('.tile').forEach((t) => t.classList.toggle('off', !on));
}

async function refreshTransport() {
  const { isLocalReady } = await import('./localmodel.js');
  const t = decideTransport({
    online,
    hasCloudKey: !!xaiKey,
    channel,
    localReady: isLocalReady(),
    mistReady: isMistReady(),
    osReady: isOsReady()
  });
  localReady = isLocalReady();
  transportEl.textContent =
    t === 'cloud' ? '☁ Grok' :
    t === 'local' ? '🔒 On-device' :
    t === 'mist' ? '✦ Aurelia' :
    t === 'os' ? '⬡ OS' : '⏳ Queued';
  transportEl.className = 'badge ' + t;
  const persona = channel === 'mist' ? 'mist' : channel === 'os' ? 'os' : 'grok';
  brandName.textContent = persona === 'mist' ? 'Aurelia' : persona === 'os' ? 'OS' : 'Grok';
  document.querySelector('.orb')?.classList.toggle('mist', persona === 'mist');
  document.querySelector('.orb')?.classList.toggle('os', persona === 'os');
  hudEl.style.display = (channel === 'os' || (channel === 'grok' && t === 'os')) ? 'grid' : 'none';
  if (hudEl.style.display === 'grid') renderHud();
  const [text, kind] = moodForTransport(t, persona);
  setMood(text, kind);
  document.body.dataset.channel = t === 'queued' ? channel : (t === 'cloud' ? 'grok' : t);
  updateBridge(t);
  flashFrame();
}

function updateBridge(t) {
  const tag = {
    cloud: 'CMD · GROK LINK',
    mist: 'CMD · AURELIA',
    os: 'CMD · SOVEREIGN',
    local: 'CMD · ON-DEVICE',
    queued: 'CMD · STANDBY'
  }[t] || 'CMD · STANDBY';
  const bt = document.getElementById('bridgeTag');
  if (bt) bt.textContent = tag;
  const lp = document.getElementById('ltPort');
  const ls = document.getElementById('ltStbd');
  const lc = document.getElementById('ltCore');
  if (lp) lp.classList.toggle('on', t === 'cloud' || t === 'mist' || t === 'os');
  if (ls) ls.classList.toggle('on', t === 'mist' || t === 'os');
  if (lc) lc.classList.toggle('on', localReady);
}

channelSel.addEventListener('change', () => {
  channel = channelSel.value;
  if (channel === 'mist') probeMist().finally(refreshTransport);
  else if (channel === 'os') probeOs().finally(refreshTransport);
  else if (channel === 'local') {
    setMood('Warming up the on-device mind…', 'local');
    import('./localmodel.js').then(({ loadLocalModel, isLocalReady }) =>
      loadLocalModel()
        .then(() => { localReady = isLocalReady(); refreshTransport(); setMood('Thinking quietly, on my own. Nothing leaves this device.', 'local'); })
        .catch((e) => setMood('On-device model failed: ' + e.message, 'drift'))
    );
  } else refreshTransport();
});
window.addEventListener('online', () => {
  online = true;
  flushQueue();
  refreshTransport();
  setMood('Back with you. Sending what I held.', 'focus');
});
window.addEventListener('offline', () => { online = false; refreshTransport(); });

// ---- cross-frame contacts + pin (from content.js on the X page) ----
function hostTargetOrigin() {
  try {
    if (location.ancestorOrigins && location.ancestorOrigins[0]) return location.ancestorOrigins[0];
  } catch { /* ignore */ }
  return 'https://x.com';
}
function isPageOrigin(origin) {
  return origin === 'https://x.com' || origin === 'https://twitter.com' ||
    origin === 'https://www.x.com' || origin === 'https://www.twitter.com';
}
function postToHost(type, data = {}) {
  try {
    window.parent.postMessage({ type, ...data }, hostTargetOrigin());
  } catch { /* ignore */ }
}
window.addEventListener('message', (e) => {
  if (!isPageOrigin(e.origin)) return;
  const d = e.data || {};
  if (typeof d.type !== 'string' || !d.type.startsWith('XGROK_')) return;
  if (d.type === 'XGROK_CONTACTS' || d.type === 'XGROK_CONTACTS_LIVE') {
    mergeContacts(d.contacts || []);
  } else if (d.type === 'XGROK_PINNED_TWEET') {
    if (d.tweetId) {
      pinnedTweet = {
        tweetId: String(d.tweetId),
        handle: d.handle || null,
        text: d.text || ''
      };
      if (pinnedTweet.handle) activeContact = pinnedTweet.handle;
      ctxEl.textContent = pinnedTweet.handle
        ? `Pinned @${pinnedTweet.handle}`
        : `Pinned tweet ${pinnedTweet.tweetId}`;
      setMood(
        pinnedTweet.text
          ? `Reading @${pinnedTweet.handle || 'them'}: “${pinnedTweet.text.slice(0, 80)}${pinnedTweet.text.length > 80 ? '…' : ''}”`
          : `You're looking at a tweet${pinnedTweet.handle ? ' by @' + pinnedTweet.handle : ''}. Ask me anything about it.`,
        'focus'
      );
      renderContacts();
    } else {
      pinnedTweet = null;
      ctxEl.textContent = activeContact ? `With @${activeContact}` : 'Talking to Grok';
    }
  }
});
postToHost('XGROK_GET_CONTACTS');
$('sync').addEventListener('click', () => postToHost('XGROK_GET_CONTACTS'));
$('toggle').addEventListener('click', () => postToHost('XGROK_TOGGLE'));

function mergeContacts(list) {
  const map = new Map(contacts.map((c) => [c.handle, c]));
  list.forEach((c) => { if (c && c.handle && !map.has(c.handle)) map.set(c.handle, c); });
  contacts = [...map.values()];
  persist();
  renderContacts();
}

function renderContacts() {
  contactListEl.innerHTML = '';
  if (!contacts.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--muted);padding:6px 8px;line-height:1.4;';
    empty.textContent = 'Your circle is quiet. Scroll X and hit sync, or sign in with X to bring your friends here.';
    contactListEl.appendChild(empty);
    return;
  }
  contacts.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'contact' + (activeContact === c.handle ? ' active' : '');

    if (c.avatar && SAFE_AVATAR.test(c.avatar)) {
      const img = document.createElement('img');
      img.src = c.avatar;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      row.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'ph';
      row.appendChild(ph);
    }

    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = c.name || c.handle;
    const handle = document.createElement('span');
    handle.className = 'handle';
    handle.textContent = '@' + c.handle;
    meta.appendChild(name);
    meta.appendChild(handle);
    row.appendChild(meta);

    row.addEventListener('click', () => setActiveContact(c.handle));
    contactListEl.appendChild(row);
  });
}

function setActiveContact(handle) {
  activeContact = handle;
  if (!pinnedTweet) ctxEl.textContent = handle ? `With @${handle}` : 'Talking to Grok';
  renderContacts();
  setMood(handle ? `You're focused on @${handle}. I'll keep them in mind.` : 'Talking to Grok', 'focus');
}

function renderMessages() {
  messagesEl.innerHTML = '';
  messages.forEach((m) => {
    const el = document.createElement('div');
    el.className = 'msg ' + (m.role === 'user' ? 'user' : 'assistant');
    el.textContent = m.content;
    messagesEl.appendChild(el);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function pushMessage(role, content) {
  messages.push({ role, content, ts: Date.now() });
  persist();
  renderMessages();
}

function enqueue(userText) {
  queue.push({ role: 'user', content: userText, ts: Date.now() });
  persist();
}

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
sendEl.addEventListener('click', send);

inputEl.addEventListener('input', () => {
  if (!counterEl) return;
  const len = twitter.getTweetLength(inputEl.value);
  counterEl.textContent = len + ' / ' + MAX_LEN;
  counterEl.style.color = len > MAX_LEN ? 'var(--queued)' : 'var(--muted)';
  sendEl.disabled = len === 0 || len > MAX_LEN;
});

let typingEl = null;
function showTyping() {
  hideTyping();
  typingEl = document.createElement('div');
  typingEl.className = 'msg assistant typing';
  typingEl.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  messagesEl.appendChild(typingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function hideTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }

async function send() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  if (counterEl) { counterEl.textContent = '0 / ' + MAX_LEN; counterEl.style.color = 'var(--muted)'; }
  if (text.startsWith('/post ')) {
    // refresh pin before proposing
    postToHost('XGROK_PIN_TWEET');
    proposePost(text.slice(6).trim());
    return;
  }
  if (text.startsWith('/draft ')) {
    postToHost('XGROK_PIN_TWEET');
    proposePost('☁ ' + text.slice(6).trim());
    return;
  }
  pushMessage('user', text);
  pulseRipple();
  sendEl.disabled = true;
  showTyping();
  const reply = await route(text);
  hideTyping();
  pushMessage('assistant', reply);
  const m = reply.match(/\[POST\]\s*([\s\S]+)$/);
  if (m) proposePost(m[1].trim());
  sendEl.disabled = false;
  const t = transportEl.className;
  const kind = t.includes('os') ? 'os' : t.includes('mist') ? 'mist' : t.includes('local') ? 'local' : 'bliss';
  setMood(
    kind === 'os' ? 'Command acknowledged — executed locally, sovereign.' :
    kind === 'mist' ? 'Spoken as Aurelia — sovereign, and kept local.' :
    kind === 'local' ? 'Said that quietly, just between us.' :
    "Here's what I found.",
    kind
  );
}

async function tryLocal(messagesForModel) {
  const { loadLocalModel, localGenerate, isLocalReady } = await import('./localmodel.js');
  await loadLocalModel();
  localReady = isLocalReady();
  return localGenerate(messagesForModel);
}

// bitchat smart routing: cloud -> MIST -> local -> queue
// opts.skipQueue: true when flushing already-queued items (avoid re-enqueue loops)
async function route(userText, opts = {}) {
  const mist = await import('./mist.js');
  const os = await import('./os.js');
  const { isLocalReady } = await import('./localmodel.js');

  // Soft-load local weights when we may need them (does not generate text)
  if (!isLocalReady() && (channel === 'local' || (!xaiKey && !mist.isMistReady()))) {
    try {
      const { loadLocalModel } = await import('./localmodel.js');
      await loadLocalModel();
      localReady = true;
    } catch { /* keep going; may queue */ }
  }

  const t = decideTransport({
    online,
    hasCloudKey: !!xaiKey,
    channel,
    localReady: isLocalReady(),
    mistReady: mist.isMistReady(),
    osReady: os.isOsReady()
  });

  if (t === 'queued') {
    if (!opts.skipQueue) enqueue(userText);
    return "(held — I'll answer when a channel comes back online.)";
  }

  if (t === 'os') {
    try { return await os.askOs(contextMessages()); }
    catch (e) {
      if (mist.isMistReady()) return '⬡→✦ ' + (await mist.askMist(contextMessages()));
      try { return '⬡→🔒 ' + (await tryLocal(contextMessages())); }
      catch { return 'OS unreachable: ' + e.message; }
    }
  }
  if (t === 'mist') {
    try { return await mist.askMist(contextMessages()); }
    catch (e) {
      try { return '✦→🔒 ' + (await tryLocal(contextMessages())); }
      catch { return 'Aurelia is unreachable: ' + e.message; }
    }
  }
  if (t === 'local') {
    try { return await tryLocal(contextMessages()); }
    catch (e) {
      if (!opts.skipQueue) enqueue(userText);
      return 'On-device model error (held for later): ' + e.message;
    }
  }
  // cloud (Grok)
  try {
    return await askGrok(userText);
  } catch (e) {
    if (mist.isMistReady()) {
      try { return '☁→✦ ' + (await mist.askMist(contextMessages())); } catch { /* fall through */ }
    }
    if (os.isOsReady()) {
      try { return '☁→⬡ ' + (await os.askOs(contextMessages())); } catch { /* fall through */ }
    }
    try { return '☁→🔒 ' + (await tryLocal(contextMessages())); }
    catch {
      if (!opts.skipQueue) enqueue(userText);
      return 'Grok unreachable (held): ' + e.message;
    }
  }
}

/** Recent chat + optional pinned tweet context as chat messages for local/mist/os. */
function contextMessages() {
  const out = [];
  if (pinnedTweet && (pinnedTweet.text || pinnedTweet.handle)) {
    out.push({
      role: 'system',
      content: 'Pinned tweet' +
        (pinnedTweet.handle ? ' by @' + pinnedTweet.handle : '') +
        (pinnedTweet.tweetId ? ' (id ' + pinnedTweet.tweetId + ')' : '') +
        ': ' + (pinnedTweet.text || '(text unavailable)')
    });
  } else if (activeContact) {
    out.push({ role: 'system', content: 'User is focused on @' + activeContact + '.' });
  }
  return out.concat(messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-24));
}

async function askGrok(_userText) {
  if (!xaiKey) {
    throw new Error(
      'no xAI key — optional for SSO (friends + /post). For cloud chat: popup → paste xAI key, or switch #mist / #local'
    );
  }
  let sys = 'You are Grok, embedded as a sidebar companion on X (Twitter). Be concise, witty, and useful. ' +
    'If the user wants you to draft a post they can approve, end with [POST] followed by the draft text.';
  if (pinnedTweet) {
    sys += ` The user pinned a tweet${pinnedTweet.handle ? ' by @' + pinnedTweet.handle : ''}` +
      ` (id ${pinnedTweet.tweetId}).` +
      (pinnedTweet.text ? ` Tweet text: """${pinnedTweet.text.slice(0, 1500)}"""` : '') +
      ' Answer with that context in mind.';
  } else if (activeContact) {
    sys += ` The user is currently focused on @${activeContact}.`;
  }
  const payloadMessages = [
    { role: 'system', content: sys },
    ...messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-24)
      .map((m) => ({ role: m.role, content: m.content }))
  ];
  const r = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + xaiKey },
    body: JSON.stringify({
      model: grokModel || 'grok-4-latest',
      messages: payloadMessages
    })
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()).choices?.[0]?.message?.content || '(empty response)';
}

async function flushQueue() {
  if (flushing || !queue.length) return;
  flushing = true;
  try {
    const pending = queue.splice(0);
    await persist();
    for (const m of pending) {
      // User message was already shown when they sent; only generate the answer.
      showTyping();
      const reply = await route(m.content, { skipQueue: true });
      hideTyping();
      // Still no channel — put back and stop until next online event.
      if (typeof reply === 'string' && (reply.startsWith('(held') || reply.includes('(held'))) {
        queue.unshift(m);
        await persist();
        break;
      }
      pushMessage('assistant', reply);
    }
  } finally {
    flushing = false;
  }
}

// ---- Grok posting on your behalf (gated: Grok proposes, YOU approve) ----
// Works with SSO alone — no xAI key required.
function proposePost(draft) {
  const box = document.createElement('div');
  box.className = 'post-proposal';
  const target = pinnedTweet
    ? ` (reply to @${pinnedTweet.handle || pinnedTweet.tweetId})`
    : '';
  const lbl = document.createElement('div');
  lbl.className = 'lbl';
  lbl.textContent = '☁ Draft ready for your approval' + target;
  const draftEl = document.createElement('textarea');
  draftEl.className = 'draft-edit';
  draftEl.rows = 4;
  draftEl.value = draft;
  draftEl.setAttribute('maxlength', '280');
  const countEl = document.createElement('div');
  countEl.className = 'draft-count';
  const acts = document.createElement('div');
  acts.className = 'acts';
  const yes = document.createElement('button');
  yes.className = 'yes';
  yes.textContent = 'Post it ✓';
  const no = document.createElement('button');
  no.className = 'no';
  no.textContent = 'No, cancel';
  const refreshCount = () => {
    const len = twitter.getTweetLength(draftEl.value);
    countEl.textContent = len + ' / 280';
    countEl.style.color = len > MAX_LEN ? 'var(--queued)' : 'var(--muted)';
    yes.disabled = len === 0 || len > MAX_LEN;
  };
  acts.appendChild(yes);
  acts.appendChild(no);
  const status = document.createElement('div');
  status.className = 'status';
  box.appendChild(lbl);
  box.appendChild(draftEl);
  box.appendChild(countEl);
  box.appendChild(acts);
  box.appendChild(status);
  draftEl.addEventListener('input', refreshCount);
  refreshCount();
  yes.addEventListener('click', () => approvePost(draftEl.value.trim(), box));
  no.addEventListener('click', () => { box.remove(); });
  messagesEl.appendChild(box);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  draftEl.focus();
}

async function approvePost(draft, box) {
  const status = box.querySelector('.status');
  const yes = box.querySelector('.yes');
  const no = box.querySelector('.no');
  yes.disabled = true;
  no.disabled = true;
  const weighted = twitter.getTweetLength(draft);
  if (!draft || weighted > MAX_LEN) {
    status.textContent = '✗ Draft empty or over 280 (twitter-text weighted).';
    status.style.color = 'var(--queued)';
    yes.disabled = false;
    no.disabled = false;
    return;
  }
  status.textContent = 'Posting…';

  const payload = { text: draft };
  let replyTarget = null;

  if (pinnedTweet && pinnedTweet.tweetId) {
    payload.reply = { in_reply_to_tweet_id: String(pinnedTweet.tweetId) };
    replyTarget = pinnedTweet.handle || pinnedTweet.tweetId;
  } else if (activeContact) {
    try {
      const token = await getTokenSafe();
      if (token) {
        const tu = await (await fetch(
          `https://api.x.com/2/users/by/username/${encodeURIComponent(activeContact)}`,
          { headers: { Authorization: 'Bearer ' + token } }
        )).json();
        if (tu.data?.id) {
          const tw = await (await fetch(
            `https://api.x.com/2/users/${tu.data.id}/tweets?max_results=5&exclude=retweets,replies`,
            { headers: { Authorization: 'Bearer ' + token } }
          )).json();
          const latest = tw.data && tw.data[0];
          if (latest?.id) {
            payload.reply = { in_reply_to_tweet_id: String(latest.id) };
            replyTarget = activeContact;
          } else {
            status.textContent = 'No recent tweet from @' + activeContact + ' — posting standalone.';
          }
        }
      }
    } catch {
      /* best-effort standalone */
    }
  }

  const res = await chrome.runtime.sendMessage({ type: 'SSO_POST', ...payload });
  if (res && res.ok) {
    status.textContent = '✓ Posted to X as you.' + (replyTarget ? ' (reply to @' + replyTarget + ')' : '');
    status.style.color = 'var(--local)';
    pushMessage('assistant', 'Posted to X on your behalf: "' + draft + '"' + (replyTarget ? ' → @' + replyTarget : ''));
  } else {
    status.textContent = '✗ ' + ((res && res.error) || 'post failed — Sign in with X in the popup (Client ID, no xAI key needed)');
    status.style.color = 'var(--queued)';
    yes.disabled = false;
    no.disabled = false;
  }
}

async function getTokenSafe() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'SSO_GET_TOKEN' }, (r) => resolve((r && r.token) || ''));
  });
}

// auto-sync circle if already signed in
(function autoload() {
  chrome.runtime.sendMessage({ type: 'SSO_STATUS' }, (s) => {
    if (s && s.hasToken) {
      ssoBtn.textContent = '✓ Synced';
      fetchFriends();
    }
  });
})();

// ============ FLARES ============
(function spawnStars() {
  const wrap = document.getElementById('stars');
  if (!wrap) return;
  const n = 60;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + 'vw';
    s.style.top = Math.random() * 100 + 'vh';
    s.style.setProperty('--d', (2 + Math.random() * 4).toFixed(2) + 's');
    s.style.setProperty('--t', (30 + Math.random() * 40).toFixed(0) + 's');
    s.style.opacity = (0.3 + Math.random() * 0.7).toFixed(2);
    wrap.appendChild(s);
  }
})();

(function boot() {
  const el = document.getElementById('boot');
  const line = document.getElementById('bootLine');
  if (!el || !line) return;
  const lines = [
    'INITIALIZING SOVEREIGN LINK…',
    '> presence: GROK // MARS CORE ONLINE',
    '> channels: cloud · mist · os · local',
    '> you are in command.'
  ];
  let i = 0, j = 0, out = '';
  const tick = () => {
    if (i < lines.length) {
      if (j <= lines[i].length) {
        out = lines.slice(0, i).join('\n') + (i ? '\n' : '') + lines[i].slice(0, j);
        j++;
      } else {
        i++;
        j = 0;
        out = lines.slice(0, i).join('\n');
      }
      line.textContent = out;
      setTimeout(tick, j === 0 && i > 0 ? 260 : 18);
    } else {
      setTimeout(() => el.classList.add('gone'), 520);
    }
  };
  tick();
})();

function pulseRipple() {
  const orb = document.querySelector('.presence');
  if (!orb) return;
  const r = document.createElement('div');
  r.className = 'ripple';
  orb.appendChild(r);
  setTimeout(() => r.remove(), 720);
}

function flashFrame() {
  const sb = document.querySelector('.sidebar');
  if (!sb) return;
  sb.classList.remove('flash');
  void sb.offsetWidth;
  sb.classList.add('flash');
}
