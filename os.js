// os.js — bridge to the local sovereign OS runtime (HUD/command-deck backend).
// Exposes /status (HUD tiles) and /v1/chat/completions (optional OS agent chat).
// Endpoint is user-set from the popup; defaults to localhost. Nothing is cloud-bound.
let endpoint = 'http://localhost:8742';
let ready = false;
let statusCache = { agents: 0, tasks: 0, mem: '—', uptime: '—' };
let probing = null;

export function setEndpoint(ep) {
  if (ep && ep !== endpoint) {
    endpoint = ep;
    ready = false;
    probing = null;
  } else if (ep) {
    endpoint = ep;
  }
}
export function isOsReady() { return ready; }
export function getStatus() { return statusCache; }

export async function probeOs() {
  if (probing) return probing;
  probing = (async () => {
    try {
      const c = new AbortController();
      const to = setTimeout(() => c.abort(), 1200);
      const r = await fetch(endpoint + '/status', { signal: c.signal });
      clearTimeout(to);
      if (r.ok) {
        const j = await r.json();
        statusCache = {
          agents: j.agents ?? 0,
          tasks: j.tasks ?? 0,
          mem: j.mem ?? '—',
          uptime: j.uptime ?? '—'
        };
        ready = true;
      } else {
        ready = false;
      }
    } catch {
      ready = false;
    } finally {
      probing = null;
    }
    return ready;
  })();
  return probing;
}

export async function askOs(messages) {
  const sys = {
    role: 'system',
    content: 'You are the local sovereign OS — a command deck that runs agents and tasks ' +
      'on the user\'s own machine. Be precise, system-aware, and terse.'
  };
  const recent = messages.filter((m) => m.role !== 'system').slice(-24);
  const r = await fetch(endpoint + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'os',
      stream: false,
      messages: [sys, ...recent]
    })
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return j.choices?.[0]?.message?.content || '(no output)';
}
