# For the X / Grok Team

An open-source Chrome extension that puts **Grok on X's right rail as a persistent companion** — not a tab you switch to. It reads the page you're on, knows who you're looking at, and talks to you like a presence.

## What it is
- **Grok as the hero** (live via the xAI API), with sovereign fallbacks so it never goes dark:
  - `#mist` — your local Aurelia soul
  - `#os` — your sovereign OS
  - `#local` — on-device Qwen2.5-0.5B
  - Cascade: cloud → local soul → on-device → OS.
- Cyberpunk glass HUD, rotating **Mars** orb, Star-Trek command-deck console. Fly, but MV3-clean (no remotely-hosted code).
- Vendored X's own `twitter-text` parser (from github.com/twitter) powers the live char counter + handle extraction.

## Why it's useful
- Grok sees the tweet you're reading — click any tweet, ask, he answers *from the horse's mouth*. No copy-paste.
- **Post-on-behalf is gated**: Grok proposes, you approve. Nothing tweets without your click. (OAuth 2.0 PKCE, `tweet.write` scope, refresh token — all per docs.x.com.)
- It's a real, loadable extension today — not a mockup.

## How to run it
1. `git clone https://github.com/Mellowambience/x-grok-sidebar`
2. `chrome://extensions` → Developer mode → Load unpacked → select the folder.
3. Open x.com → toolbar popup → paste **X OAuth Client ID** → **Sign in with X**.
4. *(Optional)* xAI key for live cloud Grok; MIST/OS for local fallbacks.
5. `/post your text` → edit the draft card → **Post it ✓** (gated).

## Verification
`node verify.mjs` — syntax-checks all JS, validates the manifest, and asserts the 4-channel router cascade. Runs automatically in CI on every PR.

Code + open PR: **https://github.com/Mellowambience/x-grok-sidebar/pull/1**

Would love feedback — or a pointer to the right team if this should live elsewhere.
