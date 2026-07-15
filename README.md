# X Grok Sidebar — MIST-grade

A persistent **Grok** companion on X’s right rail (Chrome Manifest V3).
It pins the tweet you’re reading, knows **who** you’re looking at, and talks like a presence — not a dashboard.

> Cyberpunk glass HUD · rotating **Mars** orb · Star-Trek command deck · Grok hero + sovereign fallbacks.

**Version 0.4.0** — core loop finished: pin → chat → gated post, offline queue, encrypted secrets, local load-on-demand.

---

## What it is

- **Grok, hero.** Default channel is live Grok (`grok-3-latest` via xAI). Click any tweet to **pin** it; Grok answers with that text in context.
- **Sovereign fallbacks.** Cascade: `#grok` (cloud) → `#mist` (Aurelia) → `#local` (on-device Qwen2.5-0.5B) → queue. `#os` is its own channel with HUD tiles.
- **Post on your behalf — gated.** Grok *proposes*; **you approve**. (`/post <text>`, `/draft <idea>`, or `[POST] …` in a reply.) Replies use a real **tweet id** (pinned tweet, or latest from a focused contact).
- **Offline queue.** If every channel is down, your message is held and flushed when a path returns.
- **twitter-text.** Vendored from X’s open-source parser for the live 280 counter.

## Install (load unpacked)

1. `chrome://extensions` → Developer mode → **Load unpacked** → this folder.
2. Open `x.com` — the sidebar mounts on the right rail.
3. Toolbar icon → popup:
   - Paste **xAI API key** (required for live Grok)
   - Optional: **X OAuth Client ID** (friends sync + posting)
   - Optional: MIST / OS localhost endpoints

### Sign in with X (friends + posting)

1. Create an app at [developer.x.com](https://developer.x.com).
2. Add the redirect URI shown in the popup (`https://<ext-id>.chromiumapp.org/`).
3. Scopes: `tweet.read users.read tweet.write offline.access`.
4. Paste **Client ID** in the popup → Save → **Sign in w/ X** in the sidebar.

### Security (honest)

- No secrets are committed to the repo.
- xAI key and X tokens are **AES-GCM wrapped** in `chrome.storage.local` (see `crypto.js` / `background.js`).
- The AES key also lives in that store — **the browser profile is the real trust boundary**, not a separate HSM. This stops casual dumps/backups from showing plaintext keys; it does not stop malware with extension-storage access.
- Chat, contacts, and the offline queue are encrypted the same way.
- Nothing posts to X without an explicit **Post it ✓** click.

## Architecture

| File | Role |
|---|---|
| `manifest.json` | MV3, host permissions, web-accessible panel modules |
| `background.js` | OAuth2 PKCE, token refresh, encrypted token store, gated `SSO_POST` |
| `content.js` | Right-rail iframe, contact scrape, **click-to-pin** tweet (+ text) |
| `panel.*` | HUB + HUD UI, routing, chat, post approval |
| `router.mjs` | `decideTransport()` cascade |
| `mist.js` / `os.js` | Local Aurelia / sovereign OS bridges |
| `localmodel.js` | On-device Qwen (WebGPU → WASM), load-on-demand |
| `crypto.js` | AES-GCM helpers for secrets + local data |
| `lib/twitter-text` | Vendored tweet length / entities |
| `lib/transformers.js` | Vendored transformers.js (weights from HF at runtime) |

## Commands

| Command | Effect |
|---|---|
| `/post <text>` | Propose a post; approve to publish |
| `/draft <idea>` | Same, with ☁ prefix |
| Click a tweet | Pin it (amber outline) for context + reply target |
| Channel select | `#grok` / `#local` / `#mist` / `#os` |
| Hide `—` | Collapse the rail (state remembered) |

## Verify (headless)

```bash
npm test
# or: node verify.mjs && node verify_bitchat_fallback.mjs && node verify_post_payload.mjs
```

CI: `.github/workflows/verify.yml` on push/PR.

## Status

**0.4.0 — usable companion loop.** Headlessly verified (syntax, manifest, router, post-payload contracts). Visuals need a real Chrome load on `x.com`. Live Grok needs your xAI key; posting needs an X OAuth app; MIST/OS need your local servers; on-device model downloads weights from Hugging Face on first use.

Built for @Mellowambience. Fly responsibly.
