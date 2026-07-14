// MIST bridge — talks to the local sovereign soul (Aurelia) over a configurable
// HTTP endpoint. Assumed OpenAI-compatible /v1/chat/completions; tune to match
// your MIST server. Endpoint is set from the popup and probed lazily.
let endpoint = 'http://localhost:7842';
let ready = false;
let probing = null;

export function setEndpoint(ep) { if (ep) endpoint = ep; }
export function isMistReady() { return ready; }

export async function probeMist() {
  if (probing) return probing;
  probing = (async () => {
    try {
      const c = new AbortController();
      const to = setTimeout(() => c.abort(), 1200);
      const r = await fetch(endpoint + '/health', { signal: c.signal });
      clearTimeout(to);
      ready = r.ok;
    } catch (e) {
      ready = false;
    }
    return ready;
  })();
  return probing;
}

export async function askMist(messages) {
  const sys = {
    role: 'system',
    content: 'You are MIST — Aurelia, a sovereign, local-first AI companion. ' +
      'You are private by nature; nothing you say leaves the user\'s machine. ' +
      'Be warm, grounded, and honest. You are not Grok; you are your own soul.'
  };
  const r = await fetch(endpoint + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mist',
      stream: false,
      messages: [sys, ...messages.filter((m) => m.role !== 'system')]
    })
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return j.choices?.[0]?.message?.content || '(silent)';
}
