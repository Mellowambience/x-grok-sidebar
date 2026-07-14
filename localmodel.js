// On-device fallback brain.
// MV3 FORBIDS remotely-hosted CODE, so the transformers.js LIB is vendored locally
// (npm i @xenova/transformers  ->  copy dist ESM to ./lib/transformers.js). Only the
// model WEIGHTS stream from HuggingFace at runtime — that's data, which is allowed.
// The transformers.js LIB must be vendored locally (MV3 bans remotely-hosted code).
// Install via `npm i @xenova/transformers` then copy dist/transformers.js -> lib/.
// We import dynamically so a missing lib degrades to cloud-only instead of 404-breaking the panel.
let gen = null;
let loading = null;

export function isLocalReady() { return !!gen; }

export async function loadLocalModel() {
  if (gen) return gen;
  if (loading) return loading;
  loading = (async () => {
    const { pipeline } = await import('./lib/transformers.js');
    gen = await pipeline('text-generation', 'Xenova/Qwen2.5-0.5B-Instruct', {
      device: 'webgpu', dtype: 'q4'
    });
    return gen;
  })();
  try {
    return await loading;
  } catch (e) {
    // WebGPU may be unavailable (e.g. old GPU); retry on WASM.
    gen = await pipeline('text-generation', 'Xenova/Qwen2.5-0.5B-Instruct', { device: 'wasm' });
    return gen;
  }
}

export async function localGenerate(messages) {
  const p = await loadLocalModel();
  const prompt = messages
    .filter((m) => m.role !== 'system')
    .map((m) => (m.role === 'user' ? 'User: ' : 'Grok: ') + m.content)
    .join('\n') + '\nGrok:';
  const out = await p(prompt, { max_new_tokens: 220, do_sample: false });
  return out[0].generated_text.replace(prompt, '').trim();
}
