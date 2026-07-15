# Steward Compatible — Self-Assessment
**Project:** [X Grok Sidebar](https://github.com/Mellowambience/x-grok-sidebar)  
**Protocol:** [Steward Compatible v1.0](https://github.com/Mellowambience/steward-protocol/blob/main/STANDARD.md)  
**Date:** 2026-07-15  
**Assessor:** Hermes Agent (standing self-review) · Owner: Amara (Mellowambience)

```
Steward Compatible
Version 1.0
✓ Reflection Loop
✓ Assumption Tracking
✓ Human Override
✓ Evidence Logging
✓ Growth Memory
✓ Transparent Uncertainty
```

This is a **public statement of practice**, not a purchase. Challenges welcome in the open.

---

## Requirements

### Reflection Loop — met
Significant work leaves a reflection artifact:
- Git history + PR bodies on `main`
- Headless harness (`verify.mjs`) as a durable “what still holds” check
- `FOR_X_TEAM.md` documents intent and limits for external review

### Assumption Tracking — met
Assumptions are visible before they drive action:
- OAuth Client ID placeholder refuses login until owner configures it
- Cloud Grok requires an optional xAI key; SSO-only path is explicit
- Cascade fallbacks document which channel is active (cloud → mist → local → queue)

### Human Override — met
Significant automated side-effects require an explicit human gate:
- **Post-on-behalf:** propose → edit → **Post it ✓** (never silent tweet)
- Coinmoth-aligned: agent proposes, owner approves
- SSO logout + cancel on draft card reverse intent at any time

### Evidence Logging — met
Claims are backed by traceable support:
- CI runs `node verify.mjs` on every push/PR
- Pin captures tweet id + text from the live page (permalink snowflake)
- API hosts audited against `docs.x.com` (`api.x.com`, not legacy twitter hosts)

### Growth Memory — met
Persistent, owner-controlled memory:
- Contacts / messages / queue AES-GCM wrapped in `chrome.storage.local`
- Owner can clear storage / sign out / remove extension (full delete)
- No remote proprietary memory store

### Transparent Uncertainty — met
Confidence and limits are stated:
- Demo vs real post honesty in README
- “No headless Chrome” visual caveat documented
- Errors surface X API messages; SSO setup errors name Client ID gaps

---

## Non-claims
- Not a claim about model IQ or Grok’s intelligence  
- Not “fully autonomous” — autonomy without Agency is rejected by the Standard  
- Not certified by a third party yet — self-assessment + open challenge only  

## Display
Link this file and the [Steward Standard](https://github.com/Mellowambience/steward-protocol/blob/main/STANDARD.md) from the project README badge.

## Community
Any Steward may challenge this claim. Answers will be public (issues / PR on this repo).
