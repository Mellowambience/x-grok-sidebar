import { decideTransport } from './router.mjs';
import { encryptJSON, decryptJSON } from './crypto.js';
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
let channel = 'grok';
let messages = [];
let xaiKey = '';
let online = navigator.onLine;
let queue = [];
let localReady = false;
const MAX_LEN = 280;

// ---- bootstrap from encrypted store ----
chrome.storage.local.get(['xaiKey', 'contactsEnc', 'messagesEnc', 'queueEnc', 'mistEndpoint', 'osEndpoint'], async (s) => {
  xaiKey = s.xaiKey || '';
  contacts = (await decryptJSON(s.contactsEnc)) || [];
  messages = (await decryptJSON(s.messagesEnc)) || [];
  queue = (await decryptJSON(s.queueEnc)) || [];
  if (s.mistEndpoint) setMistEndpoint(s.mistEndpoint);
  if (s.osEndpoint) setOsEndpoint(s.osEndpoint);
  renderContacts();
  renderMessages();
  probeMist().finally(() => probeOs().finally(refreshTransport));
  if (queue.length) flushQueue();
});

// ---- SSO (X OAuth2 via background service worker) ----
ssoBtn.addEventListener('click', async () => {
  ssoBtn.disabled = true;
  ssoBtn.textContent = 'Signing in…';
  const res = await chrome.runtime.sendMessage({ type: 'SSO_LOGIN' });
  if (res && res.ok) {
    ssoBtn.textContent = '✓ Friends synced';
    fetchFriends();
  } else {
    ssoBtn.textContent = 'SSO failed — retry';
    ssoBtn.disabled = false;
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
  const seen = new Set(contacts.map((c) => c.handle));
  do {
    let url = `https://api.x.com/2/users/${me.data.id}/following?max_results=100&user.fields=profile_image_url,name,username`;
    if (next) url += '&pagination_token=' + next;
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
    const j = await r.json();
    (j.data || []).forEach((u) => {
      if (!seen.has(u.username)) {
        seen.add(u.username);
        contacts.push({ handle: u.username, name: u.name, avatar: u.profile_image_url || '' });
      }
    });
    next = j.meta?.next_token;
  } while (next);
  await persist();
  renderContacts();
}

// ---- encrypted persistence ----
async function persist() {
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
  const t = decideTransport({ online, hasCloudKey: !!xaiKey, channel, localReady: isLocalReady(), mistReady: isMistReady(), osReady: isOsReady() });
  localReady = isLocalReady();
  transportEl.textContent = t === 'cloud' ? '☁ Grok' : t === 'local' ? '🔒 On-device' : t === 'mist' ? '✦ Aurelia' : t === 'os' ? '⬡ OS' : '⏳ Queued';
  transportEl.className = 'badge ' + t;
  const persona = channel === 'mist' ? 'mist' : channel === 'os' ? 'os' : 'grok';
  const isPersona = channel === t || t === persona;
  brandName.textContent = persona === 'mist' ? 'Aurelia' : persona === 'os' ? 'OS' : 'Grok';
  document.querySelector('.orb')?.classList.toggle('mist', persona === 'mist');
  document.querySelector('.orb')?.classList.toggle('os', persona === 'os');
  hudEl.style.display = (channel === 'os' || (channel === 'grok' && t === 'os')) ? 'grid' : 'none';
  if (hudEl.style.display === 'grid') renderHud();
  const [text, kind] = moodForTransport(t, persona);
  setMood(text, kind);
  // presence -> neon theme (Grok amber / MIST purple / OS cyan / local green)
  document.body.dataset.channel = t === 'queued' ? channel : (t === 'cloud' ? 'grok' : t);
  updateBridge(t);
  flashFrame();
}

function updateBridge(t) {
  const tag = { cloud: 'CMD · GROK LINK', mist: 'CMD · AURELIA', os: 'CMD · SOVEREIGN', local: 'CMD · ON-DEVICE', queued: 'CMD · STANDBY' }[t] || 'CMD · STANDBY';
  const bt = document.getElementById('bridgeTag'); if (bt) bt.textContent = tag;
  const lp = document.getElementById('ltPort'), ls = document.getElementById('ltStbd'), lc = document.getElementById('ltCore');
  if (lp) lp.classList.toggle('on', t === 'cloud' || t === 'mist' || t === 'os');
  if (ls) ls.classList.toggle('on', t === 'mist' || t === 'os');
  if (lc) lc.classList.toggle('on', localReady);
}

channelSel.addEventListener('change', () => {
  channel = channelSel.value;
  if (channel === 'mist') probeMist().finally(refreshTransport);
  else if (channel === 'os') probeOs().finally(refreshTransport);
  else refreshTransport();
});
window.addEventListener('online', () => { online = true; flushQueue(); refreshTransport(); setMood('Back with you. Sending what I held.', 'focus'); });
window.addEventListener('offline', () => { online = false; refreshTransport(); });

// ---- cross-frame contacts (from content.js on the X page) ----
function postToHost(type, data = {}) { window.parent.postMessage({ type, ...data }, '*'); }
window.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'XGROK_CONTACTS' || d.type === 'XGROK_CONTACTS_LIVE') mergeContacts(d.contacts || []);
});
postToHost('XGROK_GET_CONTACTS');
$('sync').addEventListener('click', () => postToHost('XGROK_GET_CONTACTS'));

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
    row.innerHTML =
      (c.avatar ? `<img src="${c.avatar}" />` : '<div class="ph"></div>') +
      `<div class="meta"><span class="name">${escapeHtml(c.name || c.handle)}</span>` +
      `<span class="handle">@${escapeHtml(c.handle)}</span></div>`;
    row.addEventListener('click', () => setActiveContact(c.handle));
    contactListEl.appendChild(row);
  });
}

function setActiveContact(handle) {
  activeContact = handle;
  ctxEl.textContent = handle ? `With @${handle}` : 'Talking to Grok';
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
  messages.push({ role, content });
  persist();
  renderMessages();
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
  // explicit /post command -> Grok drafts & you approve
  if (text.startsWith('/post ')) {
    proposePost(text.slice(6).trim());
    return;
  }
  // /draft -> Grok writes the post text for you, then you approve
  if (text.startsWith('/draft ')) {
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
  // if Grok returned a post draft, surface the approval gate
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

// bitchat smart routing: cloud -> MIST -> local -> (OS is its own channel)
async function route(userText) {
  const mist = await import('./mist.js');
  const os = await import('./os.js');
  const { isLocalReady, localGenerate } = await import('./localmodel.js');
  const t = decideTransport({ online, hasCloudKey: !!xaiKey, channel, localReady: isLocalReady(), mistReady: mist.isMistReady(), osReady: os.isOsReady() });
  if (t === 'queued') return "(offline — I'll hold this until we reconnect.)";
  if (t === 'os') {
    try { return await os.askOs(messages); }
    catch (e) { if (mist.isMistReady()) return '⬡→✦ ' + (await mist.askMist(messages)); if (isLocalReady()) return '⬡→🔒 ' + (await localGenerate(messages)); return 'OS unreachable: ' + e.message; }
  }
  if (t === 'mist') {
    try { return await mist.askMist(messages); }
    catch (e) { if (isLocalReady()) return '✦→🔒 ' + (await localGenerate(messages)); return 'Aurelia is unreachable: ' + e.message; }
  }
  if (t === 'local') {
    try { return await localGenerate(messages); }
    catch (e) { return 'On-device model error: ' + e.message; }
  }
  // cloud (Grok)
  try {
    return await askGrok(userText);
  } catch (e) {
    if (mist.isMistReady()) return '☁→✦ ' + (await mist.askMist(messages));
    if (os.isOsReady()) return '☁→⬡ ' + (await os.askOs(messages));
    if (isLocalReady()) return '☁→🔒 ' + (await localGenerate(messages));
    return 'Grok unreachable: ' + e.message;
  }
}

async function askGrok(userText) {
  if (!xaiKey) throw new Error('no xAI key');
  const sys = 'You are Grok, embedded as a sidebar companion on X.' +
    (activeContact ? ` The user is currently focused on @${activeContact}.` : '') +
    ' Be concise, witty, and useful.';
  const r = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + xaiKey },
    body: JSON.stringify({
      model: 'grok-3-latest',
      messages: [
        { role: 'system', content: sys },
        ...messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }))
      ]
    })
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()).choices?.[0]?.message?.content || '(empty response)';
}

async function flushQueue() {
  if (!queue.length) return;
  const pending = queue.splice(0);
  await persist();
  for (const m of pending) {
    const reply = await route(m.content);
    pushMessage('assistant', reply);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---- Grok posting on your behalf (gated: Grok proposes, YOU approve) ----
// Triggered by typing "/post <text>" or when Grok returns a draft tagged [POST].
function proposePost(draft) {
  const box = document.createElement('div');
  box.className = 'post-proposal';
  box.innerHTML =
    '<div class="lbl">☁ Grok wants to post this for you</div>' +
    '<div class="draft"></div>' +
    '<div class="acts"><button class="yes">Post it ✓</button><button class="no">No, cancel</button></div>' +
    '<div class="status"></div>';
  box.querySelector('.draft').textContent = draft;
  box.querySelector('.yes').addEventListener('click', () => approvePost(draft, box));
  box.querySelector('.no').addEventListener('click', () => { box.remove(); });
  messagesEl.appendChild(box);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function approvePost(draft, box) {
  const status = box.querySelector('.status');
  const yes = box.querySelector('.yes');
  const no = box.querySelector('.no');
  yes.disabled = true; no.disabled = true;
  status.textContent = 'Posting…';
  // if a contact is focused, post as a reply to them
  const payload = { text: draft };
  if (activeContact) {
    try {
      const me = await (await fetch('https://api.x.com/2/users/me', { headers: { Authorization: 'Bearer ' + (await getTokenSafe()) } })).json();
      const tu = await (await fetch(`https://api.x.com/2/users/by/username/${activeContact}`, { headers: { Authorization: 'Bearer ' + (await getTokenSafe()) } })).json();
      if (tu.data) payload.reply = { in_reply_to_tweet_id: tu.data.id };
    } catch (e) { /* best-effort; post standalone */ }
  }
  const res = await chrome.runtime.sendMessage({ type: 'SSO_POST', ...payload });
  if (res && res.ok) {
    status.textContent = '✓ Posted to X as you.' + (activeContact ? ' (reply to @' + activeContact + ')' : '');
    status.style.color = 'var(--local)';
    pushMessage('assistant', 'Posted to X on your behalf: "' + draft + '"' + (activeContact ? ' → @' + activeContact : ''));
  } else {
    status.textContent = '✗ ' + ((res && res.error) || 'post failed');
    status.style.color = 'var(--queued)';
    yes.disabled = false; no.disabled = false;
  }
}

// lightweight token getter for reply-targeting (reuses background)
async function getTokenSafe() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'SSO_GET_TOKEN' }, (r) => resolve((r && r.token) || ''));
  });
}

// auto-sync circle if already signed in
(function autoload() {
  chrome.runtime.sendMessage({ type: 'SSO_STATUS' }, (s) => {
    if (s && s.hasToken) { ssoBtn.textContent = '✓ Synced'; fetchFriends(); }
  });
})();

// ============ FLARES ============
// 1) drifting starfield
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

// 2) boot sequence — neon type-on
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
      if (j <= lines[i].length) { out = lines.slice(0, i).join('\n') + (i ? '\n' : '') + lines[i].slice(0, j); j++; }
      else { i++; j = 0; out = lines.slice(0, i).join('\n'); }
      line.textContent = out;
      setTimeout(tick, j === 0 && i > 0 ? 260 : 18);
    } else {
      setTimeout(() => el.classList.add('gone'), 520);
    }
  };
  tick();
})();

// 3) transmit ripple from Mars on send
function pulseRipple() {
  const orb = document.querySelector('.presence');
  if (!orb) return;
  const r = document.createElement('div');
  r.className = 'ripple';
  orb.appendChild(r);
  setTimeout(() => r.remove(), 720);
}

// 4) frame flash on channel switch
function flashFrame() {
  const sb = document.querySelector('.sidebar');
  if (!sb) return;
  sb.classList.remove('flash'); void sb.offsetWidth; sb.classList.add('flash');
}
