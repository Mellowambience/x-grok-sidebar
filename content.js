// content.js — runs on the REAL x.com / twitter.com.
// Mounts a fixed right-rail iframe (our UI, isolated from X's CSS) and bridges
// the live DOM to the panel. Uses real X anchors ([data-testid="User-Name"])
// with a legacy <article> fallback for resilience against X's class churn.
(function () {
  const ROOT_ID = 'xgrok-sidebar-root';
  if (document.getElementById(ROOT_ID)) return;

  const EXT_ORIGIN = chrome.runtime.getURL('').replace(/\/$/, '');

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

  // Restore collapsed state
  chrome.storage.local.get('sidebarHidden', (s) => {
    if (s.sidebarHidden) root.style.display = 'none';
  });

  // Navigation / system routes we never want in a contact list.
  const SKIP = new Set([
    'home', 'explore', 'notifications', 'messages', 'i', 'settings',
    'compose', 'search', 'hashtag', 'login', 'logout', 'about', 'tos',
    'privacy', 'signup', 'account'
  ]);

  let pinnedEl = null;
  let lastPinnedId = null;

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
    try {
      if (frame.contentWindow) frame.contentWindow.postMessage(msg, EXT_ORIGIN);
    } catch {
      try { frame.contentWindow.postMessage(msg, '*'); } catch { /* ignore */ }
    }
  }

  function parseTweetFromArticle(art) {
    if (!art) return null;
    const link = art.querySelector('a[href*="/status/"]');
    if (!link) return null;
    const m = (link.getAttribute('href') || '').match(/\/(?:@?[\w]+)\/status\/(\d+)/) ||
      (link.getAttribute('href') || '').match(/\/status\/(\d+)/);
    if (!m) return null;
    const handleLink = art.querySelector('[data-testid="User-Name"] a[href^="/"]');
    let handle = null;
    if (handleLink) {
      handle = (handleLink.getAttribute('href') || '').replace(/^\/+/, '').split('/')[0] || null;
      if (handle && SKIP.has(handle)) handle = null;
    }
    const textEl = art.querySelector('[data-testid="tweetText"]');
    const text = textEl ? (textEl.innerText || textEl.textContent || '').trim().slice(0, 2000) : '';
    return { tweetId: m[1], handle, text };
  }

  function resolveFocusedTweet() {
    // Prefer status detail URL
    const path = location.pathname || '';
    const pathM = path.match(/\/status\/(\d+)/);
    if (pathM) {
      const art = document.querySelector('article[data-testid="tweet"]') || document.querySelector('article');
      const fromArt = parseTweetFromArticle(art);
      if (fromArt && fromArt.tweetId === pathM[1]) return fromArt;
      return { tweetId: pathM[1], handle: fromArt?.handle || null, text: fromArt?.text || '' };
    }
    const art = document.querySelector('article:hover') ||
      document.querySelector('article[data-testid="tweet"]') ||
      document.querySelector('article');
    return parseTweetFromArticle(art);
  }

  function markPinned(art, tw) {
    if (pinnedEl) pinnedEl.classList.remove('xgrok-pinned');
    if (art) {
      art.classList.add('xgrok-pinned');
      pinnedEl = art;
    }
    lastPinnedId = tw?.tweetId || null;
    if (tw) postToPanel({ type: 'XGROK_PINNED_TWEET', ...tw });
  }

  // Click any tweet to pin it for Grok context + reply targeting
  document.addEventListener('click', (e) => {
    if (root.contains(e.target)) return;
    const art = e.target.closest('article');
    if (!art) return;
    // Don't steal clicks on action buttons (like, retweet, etc.)
    if (e.target.closest('[role="button"], button, [data-testid="like"], [data-testid="retweet"], [data-testid="reply"]')) {
      // still pin the article so reply target is set, without blocking
    }
    const tw = parseTweetFromArticle(art);
    if (tw) markPinned(art, tw);
  }, true);

  // SPA navigations (detail view) → auto-pin
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      const tw = resolveFocusedTweet();
      if (tw && tw.tweetId !== lastPinnedId) {
        const art = document.querySelector('article[data-testid="tweet"]') || document.querySelector('article');
        markPinned(art, tw);
      }
    }
  }, 800);

  window.addEventListener('message', (e) => {
    if (e.source !== frame.contentWindow) return;
    // Accept only messages that look like ours
    const d = e.data || {};
    if (typeof d.type !== 'string' || !d.type.startsWith('XGROK_')) return;

    if (d.type === 'XGROK_GET_CONTACTS') {
      postToPanel({ type: 'XGROK_CONTACTS', contacts: extractContacts() });
    } else if (d.type === 'XGROK_TOGGLE') {
      const hide = root.style.display !== 'none';
      root.style.display = hide ? 'none' : 'block';
      chrome.storage.local.set({ sidebarHidden: hide });
    } else if (d.type === 'XGROK_PIN_TWEET') {
      const tw = resolveFocusedTweet();
      if (tw) {
        const art = document.querySelector('article:hover') ||
          document.querySelector('article[data-testid="tweet"]') ||
          document.querySelector('article');
        markPinned(art, tw);
      } else {
        postToPanel({ type: 'XGROK_PINNED_TWEET', tweetId: null });
      }
    } else if (d.type === 'XGROK_SHOW') {
      root.style.display = 'block';
      chrome.storage.local.set({ sidebarHidden: false });
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
