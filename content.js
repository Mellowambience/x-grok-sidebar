// content.js — runs on the REAL x.com / twitter.com.
// Mounts a fixed right-rail iframe (our UI, isolated from X's CSS) and bridges
// the live DOM to the panel. Uses real X anchors ([data-testid="User-Name"])
// with a legacy <article> fallback for resilience against X's class churn.
(function () {
  const ROOT_ID = 'xgrok-sidebar-root';
  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText =
    'position:fixed;top:0;right:0;width:360px;height:100vh;z-index:2147483646;' +
    'box-shadow:-8px 0 24px rgba(0,0,0,0.45);';

  const frame = document.createElement('iframe');
  frame.src = chrome.runtime.getURL('panel.html');
  frame.style.cssText = 'width:100%;height:100%;border:0;background:#000;';
  root.appendChild(frame);
  document.documentElement.appendChild(root);

  // Navigation / system routes we never want in a contact list.
  const SKIP = new Set([
    'home', 'explore', 'notifications', 'messages', 'i', 'settings',
    'compose', 'search', 'hashtag', 'login', 'logout', 'about', 'tos',
    'privacy', 'signup', 'account'
  ]);

  function extractContacts() {
    const seen = new Map();

    // Preferred: real X user-name anchors (stable across redesigns).
    const userNames = document.querySelectorAll('[data-testid="User-Name"]');
    userNames.forEach((un) => {
      const link = un.querySelector('a[href^="/"]');
      if (!link) return;
      const href = (link.getAttribute('href') || '').replace(/^\/+/, '');
      const parts = href.split('/').filter(Boolean);
      if (parts.length === 1) {
        const handle = parts[0];
        if (handle && !SKIP.has(handle) && /^[A-Za-z0-9_]{1,15}$/.test(handle)) {
          const article = un.closest('article') || un;
          const img = article.querySelector('img[src*="twimg"]');
          const nameEl = un.querySelector('a[href^="/"] span span');
          const name = (nameEl ? nameEl.textContent : link.textContent || '').trim() || handle;
          if (!seen.has(handle)) seen.set(handle, { handle, name, avatar: img ? img.src : '' });
        }
      }
    });
    if (seen.size) return [...seen.values()];

    // Fallback: legacy article scan.
    document.querySelectorAll('article').forEach((a) => {
      const links = a.querySelectorAll('a[href^="/"]');
      for (const l of links) {
        const href = (l.getAttribute('href') || '').replace(/^\/+/, '');
        const parts = href.split('/').filter(Boolean);
        if (parts.length === 1) {
          const handle = parts[0];
          if (handle && !SKIP.has(handle) && /^[A-Za-z0-9_]{1,15}$/.test(handle)) {
            const img = a.querySelector('img[src*="twimg"]');
            seen.set(handle, {
              handle,
              name: (l.textContent || '').split('\n')[0].trim() || handle,
              avatar: img ? img.src : ''
            });
            break;
          }
        }
      }
    });
    return [...seen.values()];
  }

  function postToPanel(msg) {
    try { frame.contentWindow.postMessage(msg, '*'); } catch (e) { /* ignore */ }
  }

  window.addEventListener('message', (e) => {
    if (e.source !== frame.contentWindow) return;
    const d = e.data || {};
    if (d.type === 'XGROK_GET_CONTACTS') {
      postToPanel({ type: 'XGROK_CONTACTS', contacts: extractContacts() });
    } else if (d.type === 'XGROK_TOGGLE') {
      root.style.display = root.style.display === 'none' ? 'block' : 'none';
    }
  });

  // Live, throttled re-scan as the timeline loads more tweets.
  let pending = false;
  const mo = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      postToPanel({ type: 'XGROK_CONTACTS_LIVE', contacts: extractContacts() });
    }, 2500);
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
})();
