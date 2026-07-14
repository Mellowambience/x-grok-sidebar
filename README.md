# X Grok Sidebar — MIST-grade

A persistent **Grok** companion living on X's right rail, built as a Manifest V3 Chrome extension.
It reads the page you're on, knows **who** you're looking at, and talks to you like a presence — not a dashboard.

> Cyberpunk glass HUD · rotating **Mars** orb · Star-Trek command-deck console · Grok as the hero, with sovereign fallbacks.

---

## What it is

- **Grok, hero.** The default channel is live Grok (`grok-3-latest` via xAI). Real Grok logo mark, Grok's own voice, and Grok reads the X circle with you — click any tweet to pin it and he answers *from the horse's mouth*.
- **Sovereign fallbacks.** Cascade: `#grok` (cloud) → `#mist` (Aurelia, your local soul) → `#local` (on-device Qwen2.5-0.5B) → `#os` (your sovereign OS). If the cloud drops, you never go dark.
- **Post on your behalf — gated.** Grok *proposes* a tweet; **you approve** it. Nothing posts to X without your click. (`/post <text>`, or Grok ending a reply with `[POST] …`.)
- **Cherry-picked from `github.com/twitter`.** The vendored `lib/twitter-text` is X's own open-source tweet parser (powers x.com's character counter). Used for the live char counter + handle extraction.

## Visuals (it's fly)

- Rotating **Mars** orb with drifting terminator shadow + channel-tinted aura
- Neon scan-grid, CRT scanlines, chromatic-aberration brand glitch
- Spinning conic neon frame around the whole sidebar (per channel: Grok amber / MIST purple / OS cyan / local green)
- **Boot sequence** — neon type-on ("INITIALIZING SOVEREIGN LINK…")
- Drifting starfield, transmit ripple from Mars on send, frame flash on channel switch
- **Star-Trek command-deck console** at the bottom: sweep readout, PORT/STBD/CORE status lights, slanted **ENGAGE** key, `CMD · GROK LINK` tag

## Install (load unpacked)

1. `chrome://extensions` → Developer mode → **Load unpacked** → select this folder.
2. Click the toolbar icon on `x.com` / `twitter.com`.
3. Open the popup → paste your **xAI key** (for Grok), and set MIST/OS endpoints if you run them locally.

### Sign in with X (optional, for friends + posting)

- Register an app at developer.x.com, add the redirect URI `https://<ext-id>.chromiumapp.org/`, and put the **Client ID** in `background.js` (`CLIENT_ID`).
- Required scopes: `tweet.read users.read tweet.write offline.access`.
- After sign-in, your circle auto-syncs and Grok can post **with your approval**.

> No credentials are ever stored in code. The xAI key and X token live in `chrome.storage.local`, encrypted at rest (see `crypto.js`).

## Architecture (MV3-clean)

| File | Role |
|---|---|
| `manifest.json` | MV3, widened to x.com/twitter.com, no remotely-hosted code |
| `background.js` | Service worker — X OAuth2 PKCE + token refresh + gated `SSO_POST` only |
| `content.js` | Scrapes the live X circle (real `[data-testid="User-Name"]`) → panel |
| `panel.*` | The HUB+HUD UI (glass, Mars, command deck) |
| `router.mjs` | `decideTransport()` cascade |
| `mist.js` / `os.js` | Bridges to your local Aurelia / sovereign OS |
| `localmodel.js` | On-device Qwen2.5-0.5B (transformers.js, WebGPU→WASM) |
| `crypto.js` | AES-GCM at rest |
| `lib/twitter-text` | **Vendored** from github.com/twitter — tweet parser |
| `lib/transformers.js` | Vendored transformers.js (weights stream from HF at runtime — data, not code) |

## Commands

- `/post <text>` — Grok drafts a post; you approve before it goes to X.
- `/draft <idea>` — same, prefixed with ☁.
- If a contact is **focused** (clicked), an approved post is sent as a **reply** to them.

## Status

Functional scaffold, headlessly verified (syntax + router logic + twitter-text). Visuals verified structurally (no headless Chrome in the build env). The real Grok path needs your xAI key; MIST/OS paths need your local endpoints; X posting needs an X OAuth app.

Built for review by @Mellowambience. Fly responsibly. 🚀
